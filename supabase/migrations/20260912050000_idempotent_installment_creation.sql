-- Make ordinary installment creation replay-safe without guessing a business
-- identity from description, amount or dates. Existing rows remain unlinked.

CREATE TABLE public.financial_operation_requests (
  family_id UUID NOT NULL DEFAULT public.get_my_family_id(),
  operation_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  operation_type TEXT NOT NULL
    CHECK (operation_type IN ('despesa', 'receita', 'cartao')),
  request_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, operation_id),
  CONSTRAINT financial_operation_requests_family_user_operation_key
    UNIQUE (family_id, user_id, operation_id)
);

ALTER TABLE public.financial_operation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_operation_requests_select_own
  ON public.financial_operation_requests
  FOR SELECT
  TO authenticated
  USING (
    family_id = public.get_my_family_id()
    AND user_id = auth.uid()
  );

CREATE POLICY financial_operation_requests_insert_own
  ON public.financial_operation_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id = public.get_my_family_id()
    AND user_id = auth.uid()
  );

REVOKE ALL ON TABLE public.financial_operation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.financial_operation_requests TO authenticated;
GRANT ALL ON TABLE public.financial_operation_requests TO service_role;

ALTER TABLE public.despesas
  ADD COLUMN operation_id UUID,
  ADD COLUMN operation_item INTEGER,
  ADD CONSTRAINT despesas_operation_shape_check
    CHECK (
      (operation_id IS NULL AND operation_item IS NULL)
      OR (
        operation_id IS NOT NULL
        AND operation_item >= 1
        AND user_id IS NOT NULL
      )
    ),
  ADD CONSTRAINT despesas_family_operation_item_key
    UNIQUE (family_id, operation_id, operation_item),
  ADD CONSTRAINT despesas_financial_operation_fkey
    FOREIGN KEY (family_id, user_id, operation_id)
    REFERENCES public.financial_operation_requests (family_id, user_id, operation_id)
    ON DELETE RESTRICT;

ALTER TABLE public.receitas
  ADD COLUMN operation_id UUID,
  ADD COLUMN operation_item INTEGER,
  ADD CONSTRAINT receitas_operation_shape_check
    CHECK (
      (operation_id IS NULL AND operation_item IS NULL)
      OR (
        operation_id IS NOT NULL
        AND operation_item >= 1
        AND user_id IS NOT NULL
      )
    ),
  ADD CONSTRAINT receitas_family_operation_item_key
    UNIQUE (family_id, operation_id, operation_item),
  ADD CONSTRAINT receitas_financial_operation_fkey
    FOREIGN KEY (family_id, user_id, operation_id)
    REFERENCES public.financial_operation_requests (family_id, user_id, operation_id)
    ON DELETE RESTRICT;

ALTER TABLE public.cartoes
  ADD COLUMN operation_id UUID,
  ADD COLUMN operation_item INTEGER,
  ADD CONSTRAINT cartoes_operation_shape_check
    CHECK (
      (operation_id IS NULL AND operation_item IS NULL)
      OR (
        operation_id IS NOT NULL
        AND operation_item >= 1
        AND user_id IS NOT NULL
      )
    ),
  ADD CONSTRAINT cartoes_family_operation_item_key
    UNIQUE (family_id, operation_id, operation_item),
  ADD CONSTRAINT cartoes_financial_operation_fkey
    FOREIGN KEY (family_id, user_id, operation_id)
    REFERENCES public.financial_operation_requests (family_id, user_id, operation_id)
    ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.protect_financial_operation_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.operation_id IS DISTINCT FROM NEW.operation_id
     OR OLD.operation_item IS DISTINCT FROM NEW.operation_item THEN
    RAISE EXCEPTION 'A identidade da operação financeira é imutável.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_financial_operation_identity() FROM PUBLIC;

CREATE TRIGGER protect_despesas_operation_identity
  BEFORE UPDATE OF operation_id, operation_item ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_operation_identity();

CREATE TRIGGER protect_receitas_operation_identity
  BEFORE UPDATE OF operation_id, operation_item ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_operation_identity();

CREATE TRIGGER protect_cartoes_operation_identity
  BEFORE UPDATE OF operation_id, operation_item ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_operation_identity();

CREATE OR REPLACE FUNCTION public.criar_lancamentos_parcelados(
  p_tipo TEXT,
  p_operation_id UUID,
  p_lancamentos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_my_family_id();
  v_request JSONB;
  v_existing public.financial_operation_requests%ROWTYPE;
  v_created BOOLEAN := false;
  v_item JSONB;
  v_ordinality BIGINT;
  v_total INTEGER;
  v_descricao TEXT;
  v_categoria TEXT;
  v_valor NUMERIC(12, 2);
  v_parcela_atual INTEGER;
  v_parcela_total INTEGER;
  v_competencia TEXT;
  v_titular_id INTEGER;
  v_vencimento DATE;
  v_data_recebimento DATE;
  v_data_compra DATE;
  v_status TEXT;
  v_cartao_id INTEGER;
  v_cartao public.cartoes_config%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e família são obrigatórias.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('despesa', 'receita', 'cartao') THEN
    RAISE EXCEPTION 'Tipo de lançamento parcelado inválido.'
      USING ERRCODE = '22023';
  END IF;

  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'O identificador da operação é obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_lancamentos) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lancamentos) = 0
     OR jsonb_array_length(p_lancamentos) > 240 THEN
    RAISE EXCEPTION 'Informe entre 1 e 240 lançamentos.'
      USING ERRCODE = '22023';
  END IF;

  v_total := jsonb_array_length(p_lancamentos);
  v_request := jsonb_build_object(
    'tipo', p_tipo,
    'lancamentos', p_lancamentos
  );

  INSERT INTO public.financial_operation_requests (
    family_id,
    operation_id,
    user_id,
    operation_type,
    request_payload
  )
  VALUES (
    v_family_id,
    p_operation_id,
    v_user_id,
    p_tipo,
    v_request
  )
  ON CONFLICT (family_id, operation_id) DO NOTHING
  RETURNING true INTO v_created;

  IF NOT COALESCE(v_created, false) THEN
    SELECT *
    INTO v_existing
    FROM public.financial_operation_requests
    WHERE family_id = v_family_id
      AND operation_id = p_operation_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'O identificador da operação já está em uso.'
        USING ERRCODE = '23505';
    END IF;

    IF v_existing.operation_type <> p_tipo
       OR v_existing.request_payload <> v_request THEN
      RAISE EXCEPTION 'O identificador da operação foi reutilizado com conteúdo diferente.'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    FOR v_item, v_ordinality IN
      SELECT value, ordinality
      FROM jsonb_array_elements(p_lancamentos) WITH ORDINALITY
    LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Cada lançamento deve ser um objeto.'
          USING ERRCODE = '22023';
      END IF;

      v_descricao := NULLIF(btrim(COALESCE(v_item ->> 'descricao', v_item ->> 'estabelecimento')), '');
      v_categoria := NULLIF(btrim(v_item ->> 'categoria'), '');
      v_valor := NULLIF(v_item ->> 'valor', '')::NUMERIC(12, 2);
      v_parcela_atual := NULLIF(v_item ->> 'parcela_atual', '')::INTEGER;
      v_parcela_total := NULLIF(v_item ->> 'parcela_total', '')::INTEGER;
      v_competencia := NULLIF(v_item ->> 'competencia', '');
      v_titular_id := NULLIF(v_item ->> 'titular_id', '')::INTEGER;

      IF v_descricao IS NULL THEN
        RAISE EXCEPTION 'A descrição do lançamento é obrigatória.'
          USING ERRCODE = '22023';
      END IF;

      IF v_valor IS NULL
         OR (p_tipo = 'cartao' AND v_valor = 0)
         OR (p_tipo <> 'cartao' AND v_valor <= 0) THEN
        IF p_tipo = 'cartao' THEN
          RAISE EXCEPTION 'O valor da compra ou crédito deve ser diferente de zero.'
            USING ERRCODE = '22023';
        END IF;

        RAISE EXCEPTION 'O valor da parcela deve ser maior que zero.'
          USING ERRCODE = '22023';
      END IF;

      IF v_parcela_atual IS DISTINCT FROM v_ordinality::INTEGER
         OR v_parcela_total IS DISTINCT FROM v_total THEN
        RAISE EXCEPTION 'As parcelas devem formar uma sequência completa de 1 até o total.'
          USING ERRCODE = '22023';
      END IF;

      IF v_competencia IS NULL
         OR v_competencia !~ '^(0[1-9]|1[0-2])/[0-9]{4}$' THEN
        RAISE EXCEPTION 'A competência deve usar o formato MM/AAAA.'
          USING ERRCODE = '22023';
      END IF;

      IF p_tipo <> 'cartao'
         AND v_titular_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM public.titulares
           WHERE family_id = v_family_id
             AND id = v_titular_id
         ) THEN
        RAISE EXCEPTION 'O titular informado não pertence à família autenticada.'
          USING ERRCODE = '23503';
      END IF;

      IF p_tipo = 'despesa' THEN
        v_vencimento := NULLIF(v_item ->> 'vencimento', '')::DATE;
        v_status := COALESCE(NULLIF(v_item ->> 'status', ''), 'Em aberto');

        IF v_vencimento IS NULL THEN
          RAISE EXCEPTION 'O vencimento da despesa é obrigatório.'
            USING ERRCODE = '22023';
        END IF;

        IF v_status NOT IN ('Pago', 'Em aberto', 'Vencida', 'Hoje') THEN
          RAISE EXCEPTION 'Status de despesa inválido.'
            USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.despesas (
          family_id, user_id, descricao, categoria, valor,
          parcela_atual, parcela_total, vencimento, status,
          titular_id, competencia, operation_id, operation_item
        )
        VALUES (
          v_family_id, v_user_id, v_descricao, v_categoria, v_valor,
          v_parcela_atual, v_parcela_total, v_vencimento, v_status,
          v_titular_id, v_competencia, p_operation_id, v_ordinality
        );
      ELSIF p_tipo = 'receita' THEN
        v_data_recebimento := NULLIF(v_item ->> 'data_recebimento', '')::DATE;
        v_status := COALESCE(NULLIF(v_item ->> 'status', ''), 'Recebido');

        IF v_data_recebimento IS NULL THEN
          RAISE EXCEPTION 'A data de recebimento é obrigatória.'
            USING ERRCODE = '22023';
        END IF;

        IF v_status NOT IN ('Recebido', 'Pendente') THEN
          RAISE EXCEPTION 'Status de receita inválido.'
            USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.receitas (
          family_id, user_id, descricao, categoria, valor,
          parcela_atual, parcela_total, data_recebimento, status,
          titular_id, competencia, operation_id, operation_item
        )
        VALUES (
          v_family_id, v_user_id, v_descricao, v_categoria, v_valor,
          v_parcela_atual, v_parcela_total, v_data_recebimento, v_status,
          v_titular_id, v_competencia, p_operation_id, v_ordinality
        );
      ELSE
        v_cartao_id := NULLIF(v_item ->> 'cartao_id', '')::INTEGER;
        v_data_compra := NULLIF(v_item ->> 'data_compra', '')::DATE;

        SELECT *
        INTO v_cartao
        FROM public.cartoes_config
        WHERE family_id = v_family_id
          AND id = v_cartao_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'O cartão informado não pertence à família autenticada.'
            USING ERRCODE = '23503';
        END IF;

        IF v_data_compra IS NULL THEN
          RAISE EXCEPTION 'A data da compra é obrigatória.'
            USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.cartoes (
          family_id, user_id, cartao_id, estabelecimento, categoria,
          titular_id, valor, parcela_atual, parcela_total, data_compra,
          competencia, operation_id, operation_item
        )
        VALUES (
          v_family_id, v_user_id, v_cartao_id, v_descricao, v_categoria,
          v_cartao.titular_id, v_valor, v_parcela_atual, v_parcela_total,
          v_data_compra, v_competencia, p_operation_id, v_ordinality
        );
      END IF;
    END LOOP;
  END IF;

  IF p_tipo = 'despesa' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(item) ORDER BY item.operation_item), '[]'::JSONB)
    INTO v_result
    FROM public.despesas AS item
    WHERE item.family_id = v_family_id
      AND item.operation_id = p_operation_id;
  ELSIF p_tipo = 'receita' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(item) ORDER BY item.operation_item), '[]'::JSONB)
    INTO v_result
    FROM public.receitas AS item
    WHERE item.family_id = v_family_id
      AND item.operation_id = p_operation_id;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(item) ORDER BY item.operation_item), '[]'::JSONB)
    INTO v_result
    FROM public.cartoes AS item
    WHERE item.family_id = v_family_id
      AND item.operation_id = p_operation_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_lancamentos_parcelados(TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_lancamentos_parcelados(TEXT, UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.criar_lancamentos_parcelados(TEXT, UUID, JSONB)
  TO authenticated, service_role;
