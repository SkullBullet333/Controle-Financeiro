-- Alterações de categoria são transacionais: falha em qualquer tabela reverte
-- a operação inteira. SECURITY INVOKER preserva as políticas RLS existentes.
BEGIN;

CREATE OR REPLACE FUNCTION public.renomear_categoria_em_lote(
  p_categoria_antiga TEXT,
  p_categoria_nova TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_family_id UUID := public.get_my_family_id();
  v_antiga TEXT := btrim(p_categoria_antiga);
  v_nova TEXT := btrim(p_categoria_nova);
  v_despesas INTEGER;
  v_fixas INTEGER;
  v_cartoes INTEGER;
BEGIN
  IF auth.uid() IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão e família obrigatórias.' USING ERRCODE = '42501';
  END IF;
  IF v_antiga IS NULL OR v_nova IS NULL
     OR v_antiga = '' OR v_nova = '' OR v_antiga = v_nova THEN
    RAISE EXCEPTION 'Categorias inválidas.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.despesas
  SET categoria = v_nova
  WHERE family_id = v_family_id AND categoria = v_antiga;
  GET DIAGNOSTICS v_despesas = ROW_COUNT;

  UPDATE public.contas_fixas
  SET categoria = v_nova
  WHERE family_id = v_family_id AND categoria = v_antiga;
  GET DIAGNOSTICS v_fixas = ROW_COUNT;

  UPDATE public.cartoes
  SET categoria = v_nova
  WHERE family_id = v_family_id AND categoria = v_antiga;
  GET DIAGNOSTICS v_cartoes = ROW_COUNT;

  RETURN jsonb_build_object(
    'despesas', v_despesas,
    'contas_fixas', v_fixas,
    'cartoes', v_cartoes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_categoria_por_descricao(
  p_descricao TEXT,
  p_categoria_nova TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_family_id UUID := public.get_my_family_id();
  v_descricao TEXT := btrim(p_descricao);
  v_nova TEXT := btrim(p_categoria_nova);
  v_despesas INTEGER;
  v_fixas INTEGER;
  v_cartoes INTEGER;
BEGIN
  IF auth.uid() IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão e família obrigatórias.' USING ERRCODE = '42501';
  END IF;
  IF v_descricao IS NULL OR v_nova IS NULL
     OR v_descricao = '' OR v_nova = '' THEN
    RAISE EXCEPTION 'Descrição ou categoria inválida.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.despesas
  SET categoria = v_nova
  WHERE family_id = v_family_id
    AND lower(descricao) = lower(v_descricao);
  GET DIAGNOSTICS v_despesas = ROW_COUNT;

  UPDATE public.contas_fixas
  SET categoria = v_nova
  WHERE family_id = v_family_id
    AND lower(descricao) = lower(v_descricao);
  GET DIAGNOSTICS v_fixas = ROW_COUNT;

  UPDATE public.cartoes
  SET categoria = v_nova
  WHERE family_id = v_family_id
    AND lower(estabelecimento) = lower(v_descricao);
  GET DIAGNOSTICS v_cartoes = ROW_COUNT;

  RETURN jsonb_build_object(
    'despesas', v_despesas,
    'contas_fixas', v_fixas,
    'cartoes', v_cartoes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.renomear_categoria_em_lote(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atualizar_categoria_por_descricao(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renomear_categoria_em_lote(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_categoria_por_descricao(TEXT, TEXT) TO authenticated, service_role;

COMMIT;
