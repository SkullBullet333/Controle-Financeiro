-- Give materialized card recurrences a stable structural identity.
-- Legacy rows are linked only when card, description, amount, installment and
-- calculated occurrence agree without any ambiguity.

BEGIN;

ALTER TABLE public.cartoes
  ADD COLUMN conta_fixa_id BIGINT,
  ADD COLUMN conta_fixa_parcela INTEGER;

CREATE TEMP TABLE card_recurrence_backfill_candidates
ON COMMIT DROP
AS
SELECT
  transaction_row.id AS transaction_id,
  fixed_config.id AS conta_fixa_id,
  CASE
    WHEN transaction_row.competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
     AND fixed_config.competencia_inicial ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
    THEN
      (
        (split_part(transaction_row.competencia, '/', 2)::INTEGER
          - split_part(fixed_config.competencia_inicial, '/', 2)::INTEGER) * 12
        + split_part(transaction_row.competencia, '/', 1)::INTEGER
        - split_part(fixed_config.competencia_inicial, '/', 1)::INTEGER
        + 1
      )
  END AS ocorrencia
FROM public.cartoes AS transaction_row
JOIN public.contas_fixas AS fixed_config
  ON fixed_config.family_id = transaction_row.family_id
 AND fixed_config.cartao_id = transaction_row.cartao_id
 AND fixed_config.descricao = transaction_row.estabelecimento
 AND fixed_config.valor_mensal = transaction_row.valor
WHERE transaction_row.operation_id IS NULL;

DELETE FROM card_recurrence_backfill_candidates AS candidate
USING public.cartoes AS transaction_row, public.contas_fixas AS fixed_config
WHERE transaction_row.id = candidate.transaction_id
  AND fixed_config.id = candidate.conta_fixa_id
  AND (
    candidate.ocorrencia IS NULL
    OR candidate.ocorrencia < 1
    OR transaction_row.parcela_atual IS DISTINCT FROM candidate.ocorrencia
    OR (
      fixed_config.total_parcelas IS NOT NULL
      AND fixed_config.total_parcelas > 0
      AND candidate.ocorrencia > fixed_config.total_parcelas
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM card_recurrence_backfill_candidates
    GROUP BY transaction_id
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM card_recurrence_backfill_candidates
    GROUP BY conta_fixa_id, ocorrencia
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Backfill de recorrências de cartão recusado: vínculos ambíguos.';
  END IF;
END;
$$;

UPDATE public.cartoes AS transaction_row
SET
  conta_fixa_id = candidate.conta_fixa_id,
  conta_fixa_parcela = candidate.ocorrencia
FROM card_recurrence_backfill_candidates AS candidate
WHERE transaction_row.id = candidate.transaction_id;

ALTER TABLE public.cartoes
  ADD CONSTRAINT cartoes_fixed_recurrence_shape_check
    CHECK (
      (conta_fixa_id IS NULL AND conta_fixa_parcela IS NULL)
      OR (
        conta_fixa_id IS NOT NULL
        AND conta_fixa_parcela IS NOT NULL
        AND conta_fixa_parcela >= 1
      )
    ),
  ADD CONSTRAINT cartoes_family_conta_fixa_fkey
    FOREIGN KEY (family_id, conta_fixa_id)
    REFERENCES public.contas_fixas (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

CREATE UNIQUE INDEX ux_cartoes_family_fixed_occurrence
  ON public.cartoes (family_id, conta_fixa_id, conta_fixa_parcela)
  WHERE conta_fixa_id IS NOT NULL;

ALTER TABLE public.cartoes
  VALIDATE CONSTRAINT cartoes_family_conta_fixa_fkey;

CREATE OR REPLACE FUNCTION public.protect_card_recurrence_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.conta_fixa_id IS DISTINCT FROM NEW.conta_fixa_id
     OR OLD.conta_fixa_parcela IS DISTINCT FROM NEW.conta_fixa_parcela THEN
    RAISE EXCEPTION 'A identidade da recorrência de cartão é imutável.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_card_recurrence_identity() FROM PUBLIC;

CREATE TRIGGER protect_cartoes_recurrence_identity
  BEFORE UPDATE OF conta_fixa_id, conta_fixa_parcela ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION public.protect_card_recurrence_identity();

CREATE OR REPLACE FUNCTION public.materializar_ocorrencia_cartao(
  p_conta_fixa_id BIGINT,
  p_ocorrencia INTEGER,
  p_data_compra DATE,
  p_valor NUMERIC DEFAULT NULL,
  p_estabelecimento TEXT DEFAULT NULL,
  p_categoria TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_my_family_id();
  v_config public.contas_fixas%ROWTYPE;
  v_card public.cartoes_config%ROWTYPE;
  v_competencia TEXT;
  v_valor NUMERIC(12, 2);
  v_estabelecimento TEXT;
  v_result public.cartoes%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e família são obrigatórias.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_config
  FROM public.contas_fixas
  WHERE family_id = v_family_id
    AND id = p_conta_fixa_id
    AND cartao_id IS NOT NULL
    AND tipo = 'despesa';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A recorrência de cartão informada não pertence à família autenticada.'
      USING ERRCODE = '23503';
  END IF;

  IF p_ocorrencia IS NULL
     OR p_ocorrencia < 1
     OR (
       v_config.total_parcelas IS NOT NULL
       AND v_config.total_parcelas > 0
       AND p_ocorrencia > v_config.total_parcelas
     ) THEN
    RAISE EXCEPTION 'Número de ocorrência inválido para a recorrência.'
      USING ERRCODE = '22023';
  END IF;

  IF p_data_compra IS NULL THEN
    RAISE EXCEPTION 'A data da ocorrência é obrigatória.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_card
  FROM public.cartoes_config
  WHERE family_id = v_family_id
    AND id = v_config.cartao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O cartão da recorrência não pertence à família autenticada.'
      USING ERRCODE = '23503';
  END IF;

  v_competencia := to_char(
    to_date('01/' || v_config.competencia_inicial, 'DD/MM/YYYY')
      + make_interval(months => p_ocorrencia - 1),
    'MM/YYYY'
  );
  v_valor := COALESCE(p_valor, v_config.valor_mensal)::NUMERIC(12, 2);
  v_estabelecimento := COALESCE(NULLIF(btrim(p_estabelecimento), ''), v_config.descricao);

  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'O valor da ocorrência deve ser maior que zero.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.cartoes (
    family_id, user_id, cartao_id, estabelecimento, categoria,
    titular_id, valor, parcela_atual, parcela_total, data_compra,
    competencia, conta_fixa_id, conta_fixa_parcela
  )
  VALUES (
    v_family_id, v_user_id, v_card.id, v_estabelecimento,
    COALESCE(NULLIF(btrim(p_categoria), ''), v_config.categoria),
    v_card.titular_id, v_valor, p_ocorrencia,
    COALESCE(NULLIF(v_config.total_parcelas, 0), 1), p_data_compra,
    v_competencia, v_config.id, p_ocorrencia
  )
  ON CONFLICT (family_id, conta_fixa_id, conta_fixa_parcela)
    WHERE conta_fixa_id IS NOT NULL
  DO UPDATE SET
    estabelecimento = EXCLUDED.estabelecimento,
    categoria = EXCLUDED.categoria,
    valor = EXCLUDED.valor,
    data_compra = EXCLUDED.data_compra,
    competencia = EXCLUDED.competencia
  RETURNING * INTO v_result;

  RETURN to_jsonb(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_ocorrencia_cartao(BIGINT, INTEGER, DATE, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materializar_ocorrencia_cartao(BIGINT, INTEGER, DATE, NUMERIC, TEXT, TEXT)
  TO authenticated, service_role;

COMMIT;
