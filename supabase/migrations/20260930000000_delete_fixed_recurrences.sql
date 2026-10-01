BEGIN;

-- Permite que comandos internos privilegiados desvinculem uma ocorrência de cartão
-- antes da exclusão do mestre. Usuários comuns continuam impedidos de alterar a
-- identidade estrutural de uma recorrência diretamente.
CREATE OR REPLACE FUNCTION public.protect_card_recurrence_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.conta_fixa_id IS DISTINCT FROM NEW.conta_fixa_id
     OR OLD.conta_fixa_parcela IS DISTINCT FROM NEW.conta_fixa_parcela THEN
    RAISE EXCEPTION 'A identidade da recorrência de cartão é imutável.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_card_recurrence_identity() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.excluir_conta_fixa(
  p_conta_fixa_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_my_family_id();
  v_config public.contas_fixas%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e família são obrigatórias.'
      USING ERRCODE = '42501';
  END IF;

  IF p_conta_fixa_id IS NULL OR p_conta_fixa_id < 1 THEN
    RAISE EXCEPTION 'A recorrência informada é inválida.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_config
  FROM public.contas_fixas
  WHERE family_id = v_family_id
    AND id = p_conta_fixa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A recorrência informada não pertence à família autenticada.'
      USING ERRCODE = '23503';
  END IF;

  IF v_config.user_id IS DISTINCT FROM v_user_id
     AND NOT public.is_my_family_admin() THEN
    RAISE EXCEPTION 'Apenas o responsável ou titular da família pode excluir a recorrência.'
      USING ERRCODE = '42501';
  END IF;

  -- Preserva lançamentos históricos, removendo apenas a identidade da série.
  UPDATE public.despesas
  SET conta_fixa_id = NULL
  WHERE family_id = v_family_id
    AND conta_fixa_id = v_config.id;

  UPDATE public.receitas
  SET conta_fixa_id = NULL
  WHERE family_id = v_family_id
    AND conta_fixa_id = v_config.id;

  UPDATE public.cartoes
  SET conta_fixa_id = NULL,
      conta_fixa_parcela = NULL
  WHERE family_id = v_family_id
    AND conta_fixa_id = v_config.id;

  DELETE FROM public.contas_fixas_excecoes
  WHERE family_id = v_family_id
    AND conta_fixa_id = v_config.id;

  DELETE FROM public.contas_fixas
  WHERE family_id = v_family_id
    AND id = v_config.id;

  RETURN jsonb_build_object(
    'id', v_config.id,
    'deleted', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_conta_fixa(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_conta_fixa(BIGINT)
  TO authenticated, service_role;

COMMIT;
