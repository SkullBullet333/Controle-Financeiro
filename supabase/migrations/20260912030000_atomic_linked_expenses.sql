-- Materialize one or more loan/fixed-expense occurrences in one transaction.
-- The preflight deliberately aborts on ambiguous legacy data instead of
-- choosing or deleting a financial record automatically.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.despesas
    WHERE emprestimo_id IS NOT NULL
    GROUP BY family_id, emprestimo_id, parcela_atual
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem parcelas duplicadas de empréstimo; saneamento manual obrigatório.'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.despesas
    WHERE conta_fixa_id IS NOT NULL
    GROUP BY family_id, conta_fixa_id, parcela_atual
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem parcelas duplicadas de conta fixa; saneamento manual obrigatório.'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.despesas
    WHERE num_nonnulls(emprestimo_id, conta_fixa_id) > 1
       OR (
         num_nonnulls(emprestimo_id, conta_fixa_id) = 1
         AND (
           parcela_atual IS NULL
           OR parcela_atual < 1
           OR valor <= 0
           OR competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
         )
       )
  ) THEN
    RAISE EXCEPTION
      'Existem despesas vinculadas com formato inválido; saneamento manual obrigatório.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_single_source_check
    CHECK (num_nonnulls(emprestimo_id, conta_fixa_id) <= 1)
    NOT VALID,
  ADD CONSTRAINT despesas_linked_occurrence_check
    CHECK (
      num_nonnulls(emprestimo_id, conta_fixa_id) = 0
      OR (
        parcela_atual IS NOT NULL
        AND parcela_atual >= 1
        AND valor > 0
        AND competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
      )
    )
    NOT VALID;

ALTER TABLE public.despesas
  VALIDATE CONSTRAINT despesas_single_source_check,
  VALIDATE CONSTRAINT despesas_linked_occurrence_check;

ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_family_emprestimo_parcela_key
    UNIQUE (family_id, emprestimo_id, parcela_atual),
  ADD CONSTRAINT despesas_family_conta_fixa_parcela_key
    UNIQUE (family_id, conta_fixa_id, parcela_atual);

CREATE OR REPLACE FUNCTION public.materializar_despesas_vinculadas(
  p_despesas JSONB
)
RETURNS SETOF public.despesas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_my_family_id();
  v_item JSONB;
  v_emprestimo_id BIGINT;
  v_conta_fixa_id BIGINT;
  v_parcela_atual INTEGER;
  v_parcela_total INTEGER;
  v_descricao TEXT;
  v_categoria TEXT;
  v_valor NUMERIC(12, 2);
  v_vencimento DATE;
  v_status TEXT;
  v_titular_id INTEGER;
  v_competencia TEXT;
  v_emprestimo public.emprestimos%ROWTYPE;
  v_conta_fixa public.contas_fixas%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e família são obrigatórias.'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_despesas) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_despesas) = 0
     OR jsonb_array_length(p_despesas) > 240 THEN
    RAISE EXCEPTION 'Informe entre 1 e 240 despesas vinculadas.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_despesas) AS item(value)
    GROUP BY
      CASE
        WHEN NULLIF(item.value ->> 'emprestimo_id', '') IS NOT NULL
          THEN 'emprestimo'
        WHEN NULLIF(item.value ->> 'conta_fixa_id', '') IS NOT NULL
          THEN 'conta_fixa'
        ELSE 'sem_origem'
      END,
      COALESCE(
        NULLIF(item.value ->> 'emprestimo_id', ''),
        NULLIF(item.value ->> 'conta_fixa_id', '')
      ),
      NULLIF(item.value ->> 'parcela_atual', '')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'O lote contém a mesma ocorrência mais de uma vez.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_despesas)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Cada despesa do lote deve ser um objeto.'
        USING ERRCODE = '22023';
    END IF;

    v_emprestimo_id := NULLIF(v_item ->> 'emprestimo_id', '')::BIGINT;
    v_conta_fixa_id := NULLIF(v_item ->> 'conta_fixa_id', '')::BIGINT;

    IF num_nonnulls(v_emprestimo_id, v_conta_fixa_id) <> 1 THEN
      RAISE EXCEPTION 'Cada despesa deve ter exatamente uma origem vinculada.'
        USING ERRCODE = '22023';
    END IF;

    v_parcela_atual := NULLIF(v_item ->> 'parcela_atual', '')::INTEGER;
    v_valor := NULLIF(v_item ->> 'valor', '')::NUMERIC(12, 2);
    v_vencimento := NULLIF(v_item ->> 'vencimento', '')::DATE;
    v_status := COALESCE(NULLIF(v_item ->> 'status', ''), 'Pago');
    v_competencia := NULLIF(v_item ->> 'competencia', '');
    v_descricao := NULLIF(btrim(v_item ->> 'descricao'), '');
    v_categoria := NULLIF(btrim(v_item ->> 'categoria'), '');
    v_titular_id := NULLIF(v_item ->> 'titular_id', '')::INTEGER;
    v_parcela_total := NULLIF(v_item ->> 'parcela_total', '')::INTEGER;

    IF v_parcela_atual IS NULL OR v_parcela_atual < 1 THEN
      RAISE EXCEPTION 'O número da parcela deve ser maior ou igual a 1.'
        USING ERRCODE = '22023';
    END IF;

    IF v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION 'O valor da parcela deve ser maior que zero.'
        USING ERRCODE = '22023';
    END IF;

    IF v_vencimento IS NULL THEN
      RAISE EXCEPTION 'O vencimento da parcela é obrigatório.'
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

    IF v_emprestimo_id IS NOT NULL THEN
      SELECT *
      INTO v_emprestimo
      FROM public.emprestimos
      WHERE id = v_emprestimo_id
        AND family_id = v_family_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Empréstimo % não pertence à família autenticada.', v_emprestimo_id
          USING ERRCODE = 'P0001';
      END IF;

      IF v_parcela_atual > v_emprestimo.total_parcelas THEN
        RAISE EXCEPTION 'Parcela % inválida para o empréstimo %.', v_parcela_atual, v_emprestimo_id
          USING ERRCODE = 'P0001';
      END IF;

      v_descricao := COALESCE(v_descricao, v_emprestimo.descricao);
      v_categoria := COALESCE(v_categoria, 'Empréstimos e Financiamentos');
      v_titular_id := COALESCE(v_titular_id, v_emprestimo.titular_id);
      v_parcela_total := v_emprestimo.total_parcelas;

      RETURN QUERY
      INSERT INTO public.despesas AS destino (
        family_id,
        user_id,
        emprestimo_id,
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
        v_emprestimo_id,
        v_descricao,
        v_categoria,
        v_valor,
        v_parcela_atual,
        v_parcela_total,
        v_vencimento,
        v_status,
        v_titular_id,
        v_competencia
      )
      ON CONFLICT ON CONSTRAINT despesas_family_emprestimo_parcela_key
      DO UPDATE SET
        descricao = EXCLUDED.descricao,
        categoria = EXCLUDED.categoria,
        valor = EXCLUDED.valor,
        parcela_total = EXCLUDED.parcela_total,
        vencimento = EXCLUDED.vencimento,
        status = EXCLUDED.status,
        titular_id = EXCLUDED.titular_id,
        competencia = EXCLUDED.competencia,
        updated_at = now()
      RETURNING destino.*;
    ELSE
      SELECT *
      INTO v_conta_fixa
      FROM public.contas_fixas
      WHERE id = v_conta_fixa_id
        AND family_id = v_family_id
        AND tipo = 'despesa';

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta fixa % não pertence à família autenticada ou não é uma despesa.', v_conta_fixa_id
          USING ERRCODE = 'P0001';
      END IF;

      IF v_conta_fixa.total_parcelas IS NOT NULL
         AND v_parcela_atual > v_conta_fixa.total_parcelas THEN
        RAISE EXCEPTION 'Parcela % inválida para a conta fixa %.', v_parcela_atual, v_conta_fixa_id
          USING ERRCODE = 'P0001';
      END IF;

      v_descricao := COALESCE(v_descricao, v_conta_fixa.descricao);
      v_categoria := COALESCE(v_categoria, v_conta_fixa.categoria, 'Contas Fixas');
      v_titular_id := COALESCE(v_titular_id, v_conta_fixa.titular_id);
      v_parcela_total := COALESCE(v_conta_fixa.total_parcelas, v_parcela_total, 0);

      RETURN QUERY
      INSERT INTO public.despesas AS destino (
        family_id,
        user_id,
        conta_fixa_id,
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
        v_conta_fixa_id,
        v_descricao,
        v_categoria,
        v_valor,
        v_parcela_atual,
        v_parcela_total,
        v_vencimento,
        v_status,
        v_titular_id,
        v_competencia
      )
      ON CONFLICT ON CONSTRAINT despesas_family_conta_fixa_parcela_key
      DO UPDATE SET
        descricao = EXCLUDED.descricao,
        categoria = EXCLUDED.categoria,
        valor = EXCLUDED.valor,
        parcela_total = EXCLUDED.parcela_total,
        vencimento = EXCLUDED.vencimento,
        status = EXCLUDED.status,
        titular_id = EXCLUDED.titular_id,
        competencia = EXCLUDED.competencia,
        updated_at = now()
      RETURNING destino.*;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_despesas_vinculadas(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materializar_despesas_vinculadas(JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.materializar_despesas_vinculadas(JSONB)
  TO authenticated, service_role;
