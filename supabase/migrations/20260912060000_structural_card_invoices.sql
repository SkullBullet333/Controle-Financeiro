-- Give persisted card invoices a structural identity. Historical rows are
-- backfilled only when the card match is unique and supported by transactions.

ALTER TABLE public.despesas
  ADD COLUMN cartao_vencimento_id INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cartoes_config
    WHERE dia_fechamento < 0 OR dia_fechamento > 31
  ) THEN
    RAISE EXCEPTION
      'Existem cartões com intervalo de fechamento fora de 0 a 31 dias.'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.despesas
    WHERE lower(left(btrim(descricao), 7)) = 'fatura '
      AND (
        emprestimo_id IS NOT NULL
        OR conta_fixa_id IS NOT NULL
        OR parcela_atual IS DISTINCT FROM 1
        OR parcela_total IS DISTINCT FROM 1
        OR valor <= 0
        OR competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
      )
  ) THEN
    RAISE EXCEPTION
      'Existem faturas históricas com formato ou origem incompatível.'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    WITH invoice_candidates AS (
      SELECT despesa.*
      FROM public.despesas AS despesa
      WHERE lower(left(btrim(despesa.descricao), 7)) = 'fatura '
    ), invoice_matches AS (
      SELECT candidate.id, count(card.id) AS match_count
      FROM invoice_candidates AS candidate
      LEFT JOIN public.cartoes_config AS card
        ON card.family_id = candidate.family_id
       AND lower(btrim(card.nome_cartao)) = lower(btrim(substring(candidate.descricao FROM 8)))
       AND card.titular_id IS NOT DISTINCT FROM candidate.titular_id
       AND EXISTS (
         SELECT 1
         FROM public.cartoes AS card_transaction
         WHERE card_transaction.family_id = candidate.family_id
           AND card_transaction.cartao_id = card.id
           AND card_transaction.competencia = candidate.competencia
       )
      GROUP BY candidate.id
    )
    SELECT 1
    FROM invoice_matches
    WHERE match_count <> 1
  ) THEN
    RAISE EXCEPTION
      'Há fatura histórica sem correspondência única com um cartão.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

UPDATE public.despesas AS invoice
SET cartao_vencimento_id = card.id
FROM public.cartoes_config AS card
WHERE lower(left(btrim(invoice.descricao), 7)) = 'fatura '
  AND card.family_id = invoice.family_id
  AND lower(btrim(card.nome_cartao)) = lower(btrim(substring(invoice.descricao FROM 8)))
  AND card.titular_id IS NOT DISTINCT FROM invoice.titular_id
  AND EXISTS (
    SELECT 1
    FROM public.cartoes AS card_transaction
    WHERE card_transaction.family_id = invoice.family_id
      AND card_transaction.cartao_id = card.id
      AND card_transaction.competencia = invoice.competencia
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.despesas
    WHERE lower(left(btrim(descricao), 7)) = 'fatura '
      AND cartao_vencimento_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Nem todas as faturas históricas puderam ser vinculadas com segurança.'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.despesas
    WHERE cartao_vencimento_id IS NOT NULL
      AND (
        emprestimo_id IS NOT NULL
        OR conta_fixa_id IS NOT NULL
        OR parcela_atual IS DISTINCT FROM 1
        OR parcela_total IS DISTINCT FROM 1
        OR valor <= 0
        OR competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
      )
  ) THEN
    RAISE EXCEPTION
      'Existem vínculos de fatura incompatíveis com o domínio.'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.despesas
    WHERE cartao_vencimento_id IS NOT NULL
    GROUP BY family_id, cartao_vencimento_id, competencia
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem faturas duplicadas para o mesmo cartão e competência.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

ALTER TABLE public.cartoes_config
  ADD CONSTRAINT cartoes_config_dia_fechamento_check
    CHECK (dia_fechamento BETWEEN 0 AND 31)
    NOT VALID;

ALTER TABLE public.cartoes_config
  VALIDATE CONSTRAINT cartoes_config_dia_fechamento_check;

ALTER TABLE public.despesas
  DROP CONSTRAINT despesas_single_source_check,
  DROP CONSTRAINT despesas_linked_occurrence_check,
  ADD CONSTRAINT despesas_single_source_check
    CHECK (num_nonnulls(emprestimo_id, conta_fixa_id, cartao_vencimento_id) <= 1)
    NOT VALID,
  ADD CONSTRAINT despesas_linked_occurrence_check
    CHECK (
      num_nonnulls(emprestimo_id, conta_fixa_id, cartao_vencimento_id) = 0
      OR (
        parcela_atual IS NOT NULL
        AND parcela_atual >= 1
        AND valor > 0
        AND competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
      )
    )
    NOT VALID,
  ADD CONSTRAINT despesas_card_invoice_shape_check
    CHECK (
      cartao_vencimento_id IS NULL
      OR (parcela_atual = 1 AND parcela_total = 1)
    )
    NOT VALID,
  ADD CONSTRAINT despesas_family_cartao_vencimento_fkey
    FOREIGN KEY (family_id, cartao_vencimento_id)
    REFERENCES public.cartoes_config (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.despesas
  VALIDATE CONSTRAINT despesas_single_source_check,
  VALIDATE CONSTRAINT despesas_linked_occurrence_check,
  VALIDATE CONSTRAINT despesas_card_invoice_shape_check,
  VALIDATE CONSTRAINT despesas_family_cartao_vencimento_fkey;

ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_family_card_invoice_key
    UNIQUE (family_id, cartao_vencimento_id, competencia);

CREATE OR REPLACE FUNCTION public.materializar_fatura_cartao(
  p_fatura JSONB
)
RETURNS public.despesas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_my_family_id();
  v_cartao_id INTEGER;
  v_valor NUMERIC(12, 2);
  v_vencimento DATE;
  v_competencia TEXT;
  v_status TEXT;
  v_card public.cartoes_config%ROWTYPE;
  v_invoice public.despesas%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e família são obrigatórias.'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_fatura) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'A fatura deve ser um objeto.'
      USING ERRCODE = '22023';
  END IF;

  v_cartao_id := NULLIF(p_fatura ->> 'cartao_vencimento_id', '')::INTEGER;
  v_valor := NULLIF(p_fatura ->> 'valor', '')::NUMERIC(12, 2);
  v_vencimento := NULLIF(p_fatura ->> 'vencimento', '')::DATE;
  v_competencia := NULLIF(p_fatura ->> 'competencia', '');
  v_status := COALESCE(NULLIF(p_fatura ->> 'status', ''), 'Pago');

  IF v_cartao_id IS NULL OR v_cartao_id < 1 THEN
    RAISE EXCEPTION 'A fatura deve ter um cartão vinculado.'
      USING ERRCODE = '22023';
  END IF;

  IF v_valor IS NULL OR v_valor <= 0 THEN
    RAISE EXCEPTION 'O valor da fatura deve ser maior que zero.'
      USING ERRCODE = '22023';
  END IF;

  IF v_vencimento IS NULL THEN
    RAISE EXCEPTION 'O vencimento da fatura é obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  IF v_competencia IS NULL
     OR v_competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$' THEN
    RAISE EXCEPTION 'A competência deve usar o formato MM/AAAA.'
      USING ERRCODE = '22023';
  END IF;

  IF v_status NOT IN ('Pago', 'Em aberto', 'Vencida', 'Hoje') THEN
    RAISE EXCEPTION 'Status de despesa inválido.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_card
  FROM public.cartoes_config
  WHERE family_id = v_family_id
    AND id = v_cartao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O cartão informado não pertence à família autenticada.'
      USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.despesas AS destination (
    family_id,
    user_id,
    cartao_vencimento_id,
    descricao,
    categoria,
    valor,
    parcela_atual,
    parcela_total,
    vencimento,
    status,
    titular_id,
    competencia
  )
  VALUES (
    v_family_id,
    v_user_id,
    v_cartao_id,
    'Fatura ' || v_card.nome_cartao,
    'Cartões',
    v_valor,
    1,
    1,
    v_vencimento,
    v_status,
    v_card.titular_id,
    v_competencia
  )
  ON CONFLICT ON CONSTRAINT despesas_family_card_invoice_key
  DO UPDATE SET
    descricao = EXCLUDED.descricao,
    categoria = EXCLUDED.categoria,
    valor = EXCLUDED.valor,
    vencimento = EXCLUDED.vencimento,
    status = EXCLUDED.status,
    titular_id = EXCLUDED.titular_id,
    updated_at = now()
  RETURNING destination.* INTO v_invoice;

  RETURN v_invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_fatura_cartao(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materializar_fatura_cartao(JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.materializar_fatura_cartao(JSONB)
  TO authenticated, service_role;
