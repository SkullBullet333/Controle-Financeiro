-- Materialize fixed-income occurrences atomically. Recurring legacy income can
-- reuse parcela_atual, so competencia is the stable occurrence identity.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.receitas
    WHERE conta_fixa_id IS NOT NULL
    GROUP BY family_id, conta_fixa_id, competencia
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem receitas fixas duplicadas por competência; saneamento manual obrigatório.'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.receitas AS receita
    JOIN public.contas_fixas AS conta
      ON conta.family_id = receita.family_id
     AND conta.id = receita.conta_fixa_id
    WHERE receita.conta_fixa_id IS NOT NULL
      AND (
        receita.parcela_atual IS NULL
        OR receita.parcela_atual < 1
        OR receita.valor <= 0
        OR receita.competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
        OR conta.tipo <> 'receita'
      )
  ) THEN
    RAISE EXCEPTION
      'Existem receitas vinculadas com formato ou origem inválida; saneamento manual obrigatório.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

ALTER TABLE public.receitas
  ADD CONSTRAINT receitas_linked_occurrence_check
    CHECK (
      conta_fixa_id IS NULL
      OR (
        parcela_atual IS NOT NULL
        AND parcela_atual >= 1
        AND valor > 0
        AND competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'
      )
    )
    NOT VALID;

ALTER TABLE public.receitas
  VALIDATE CONSTRAINT receitas_linked_occurrence_check;

ALTER TABLE public.receitas
  ADD CONSTRAINT receitas_family_conta_fixa_competencia_key
    UNIQUE (family_id, conta_fixa_id, competencia);

CREATE OR REPLACE FUNCTION public.materializar_receitas_vinculadas(
  p_receitas JSONB
)
RETURNS SETOF public.receitas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_my_family_id();
  v_item JSONB;
  v_conta_fixa_id BIGINT;
  v_parcela_atual INTEGER;
  v_parcela_total INTEGER;
  v_descricao TEXT;
  v_categoria TEXT;
  v_valor NUMERIC(12, 2);
  v_data_recebimento DATE;
  v_status TEXT;
  v_titular_id INTEGER;
  v_competencia TEXT;
  v_conta_fixa public.contas_fixas%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e família são obrigatórias.'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_receitas) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_receitas) = 0
     OR jsonb_array_length(p_receitas) > 240 THEN
    RAISE EXCEPTION 'Informe entre 1 e 240 receitas vinculadas.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_receitas) AS item(value)
    GROUP BY
      NULLIF(item.value ->> 'conta_fixa_id', ''),
      NULLIF(item.value ->> 'competencia', '')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'O lote contém a mesma receita por competência mais de uma vez.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_receitas)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Cada receita do lote deve ser um objeto.'
        USING ERRCODE = '22023';
    END IF;

    v_conta_fixa_id := NULLIF(v_item ->> 'conta_fixa_id', '')::BIGINT;
    v_parcela_atual := NULLIF(v_item ->> 'parcela_atual', '')::INTEGER;
    v_valor := NULLIF(v_item ->> 'valor', '')::NUMERIC(12, 2);
    v_data_recebimento := NULLIF(v_item ->> 'data_recebimento', '')::DATE;
    v_status := COALESCE(NULLIF(v_item ->> 'status', ''), 'Recebido');
    v_competencia := NULLIF(v_item ->> 'competencia', '');
    v_descricao := NULLIF(btrim(v_item ->> 'descricao'), '');
    v_categoria := NULLIF(btrim(v_item ->> 'categoria'), '');
    v_titular_id := NULLIF(v_item ->> 'titular_id', '')::INTEGER;
    v_parcela_total := NULLIF(v_item ->> 'parcela_total', '')::INTEGER;

    IF v_conta_fixa_id IS NULL OR v_conta_fixa_id < 1 THEN
      RAISE EXCEPTION 'A receita deve ter uma conta fixa vinculada.'
        USING ERRCODE = '22023';
    END IF;

    IF v_parcela_atual IS NULL OR v_parcela_atual < 1 THEN
      RAISE EXCEPTION 'O número da parcela deve ser maior ou igual a 1.'
        USING ERRCODE = '22023';
    END IF;

    IF v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION 'O valor da receita deve ser maior que zero.'
        USING ERRCODE = '22023';
    END IF;

    IF v_data_recebimento IS NULL THEN
      RAISE EXCEPTION 'A data de recebimento é obrigatória.'
        USING ERRCODE = '22023';
    END IF;

    IF v_competencia IS NULL
       OR v_competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$' THEN
      RAISE EXCEPTION 'A competência deve usar o formato MM/AAAA.'
        USING ERRCODE = '22023';
    END IF;

    IF v_status NOT IN ('Recebido', 'Pendente') THEN
      RAISE EXCEPTION 'Status de receita inválido.'
        USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_conta_fixa
    FROM public.contas_fixas
    WHERE id = v_conta_fixa_id
      AND family_id = v_family_id
      AND tipo = 'receita';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conta fixa % não pertence à família autenticada ou não é uma receita.', v_conta_fixa_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_conta_fixa.total_parcelas IS NOT NULL
       AND v_parcela_atual > v_conta_fixa.total_parcelas THEN
      RAISE EXCEPTION 'Parcela % inválida para a conta fixa %.', v_parcela_atual, v_conta_fixa_id
        USING ERRCODE = 'P0001';
    END IF;

    v_descricao := COALESCE(v_descricao, v_conta_fixa.descricao);
    v_categoria := COALESCE(v_categoria, v_conta_fixa.categoria);
    v_titular_id := COALESCE(v_titular_id, v_conta_fixa.titular_id);
    v_parcela_total := COALESCE(v_conta_fixa.total_parcelas, v_parcela_total, 0);

    RETURN QUERY
    INSERT INTO public.receitas AS destino (
      family_id,
      user_id,
      descricao,
      categoria,
      valor,
      parcela_atual,
      parcela_total,
      data_recebimento,
      status,
      titular_id,
      competencia,
      conta_fixa_id
    )
    VALUES (
      v_family_id,
      v_user_id,
      v_descricao,
      v_categoria,
      v_valor,
      v_parcela_atual,
      v_parcela_total,
      v_data_recebimento,
      v_status,
      v_titular_id,
      v_competencia,
      v_conta_fixa_id
    )
    ON CONFLICT ON CONSTRAINT receitas_family_conta_fixa_competencia_key
    DO UPDATE SET
      descricao = EXCLUDED.descricao,
      categoria = EXCLUDED.categoria,
      valor = EXCLUDED.valor,
      parcela_atual = EXCLUDED.parcela_atual,
      parcela_total = EXCLUDED.parcela_total,
      data_recebimento = EXCLUDED.data_recebimento,
      status = EXCLUDED.status,
      titular_id = EXCLUDED.titular_id,
      updated_at = now()
    RETURNING destino.*;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_receitas_vinculadas(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materializar_receitas_vinculadas(JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.materializar_receitas_vinculadas(JSONB)
  TO authenticated, service_role;
