BEGIN;

ALTER TABLE public.contas_fixas
  ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo',
  ADD COLUMN encerrada_em TIMESTAMPTZ,
  ADD COLUMN encerrada_por UUID,
  ADD CONSTRAINT contas_fixas_status_check
    CHECK (status IN ('ativo', 'concluido', 'cancelado'))
    NOT VALID,
  ADD CONSTRAINT contas_fixas_lifecycle_shape_check
    CHECK (
      (status = 'ativo' AND encerrada_em IS NULL AND encerrada_por IS NULL)
      OR (status IN ('concluido', 'cancelado') AND encerrada_em IS NOT NULL)
    )
    NOT VALID,
  ADD CONSTRAINT contas_fixas_encerrada_por_fkey
    FOREIGN KEY (encerrada_por)
    REFERENCES auth.users (id)
    ON DELETE SET NULL
    NOT VALID;

ALTER TABLE public.contas_fixas
  VALIDATE CONSTRAINT contas_fixas_status_check,
  VALIDATE CONSTRAINT contas_fixas_lifecycle_shape_check,
  VALIDATE CONSTRAINT contas_fixas_encerrada_por_fkey;

ALTER TABLE public.despesas
  DROP CONSTRAINT IF EXISTS despesas_family_conta_fixa_fkey,
  ADD CONSTRAINT despesas_family_conta_fixa_fkey
    FOREIGN KEY (family_id, conta_fixa_id)
    REFERENCES public.contas_fixas (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.receitas
  DROP CONSTRAINT IF EXISTS receitas_family_conta_fixa_fkey,
  ADD CONSTRAINT receitas_family_conta_fixa_fkey
    FOREIGN KEY (family_id, conta_fixa_id)
    REFERENCES public.contas_fixas (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.despesas
  VALIDATE CONSTRAINT despesas_family_conta_fixa_fkey;

ALTER TABLE public.receitas
  VALIDATE CONSTRAINT receitas_family_conta_fixa_fkey;

CREATE OR REPLACE FUNCTION public.protect_fixed_recurrence_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'Recorrências devem ser encerradas, não excluídas.'
        USING ERRCODE = 'P0001';
    END IF;

    RETURN OLD;
  END IF;

  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'ativo'
         OR NEW.encerrada_em IS NOT NULL
         OR NEW.encerrada_por IS NOT NULL THEN
        RAISE EXCEPTION 'Uma recorrência nova deve iniciar ativa.'
          USING ERRCODE = 'P0001';
      END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.encerrada_em IS DISTINCT FROM OLD.encerrada_em
       OR NEW.encerrada_por IS DISTINCT FROM OLD.encerrada_por THEN
      RAISE EXCEPTION 'O ciclo de vida da recorrência só pode ser alterado pelo comando de encerramento.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_fixed_recurrence_lifecycle() FROM PUBLIC;

CREATE TRIGGER protect_contas_fixas_lifecycle
  BEFORE INSERT OR UPDATE OF status, encerrada_em, encerrada_por
  ON public.contas_fixas
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_fixed_recurrence_lifecycle();

CREATE TRIGGER protect_contas_fixas_deletion
  BEFORE DELETE ON public.contas_fixas
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_fixed_recurrence_lifecycle();

CREATE OR REPLACE FUNCTION public.require_active_fixed_recurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NEW.conta_fixa_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.conta_fixa_id IS NOT DISTINCT FROM OLD.conta_fixa_id THEN
    RETURN NEW;
  END IF;

  SELECT status
  INTO v_status
  FROM public.contas_fixas
  WHERE family_id = NEW.family_id
    AND id = NEW.conta_fixa_id;

  IF FOUND AND v_status <> 'ativo' THEN
    RAISE EXCEPTION 'A recorrência está encerrada e não aceita novas ocorrências.'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_active_fixed_recurrence() FROM PUBLIC;

CREATE TRIGGER require_active_conta_fixa_for_despesa
  BEFORE INSERT OR UPDATE OF conta_fixa_id ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.require_active_fixed_recurrence();

CREATE TRIGGER require_active_conta_fixa_for_receita
  BEFORE INSERT OR UPDATE OF conta_fixa_id ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.require_active_fixed_recurrence();

CREATE TRIGGER require_active_conta_fixa_for_cartao
  BEFORE INSERT OR UPDATE OF conta_fixa_id ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION public.require_active_fixed_recurrence();

CREATE OR REPLACE FUNCTION public.encerrar_conta_fixa(
  p_conta_fixa_id BIGINT,
  p_status TEXT DEFAULT 'cancelado'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_family_id UUID := public.get_my_family_id();
  v_status TEXT := lower(btrim(COALESCE(p_status, '')));
  v_config public.contas_fixas%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR v_family_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e família são obrigatórias.'
      USING ERRCODE = '42501';
  END IF;

  IF v_status NOT IN ('concluido', 'cancelado') THEN
    RAISE EXCEPTION 'Estado final inválido para a recorrência.'
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

  IF v_config.user_id <> v_user_id AND NOT public.is_my_family_admin() THEN
    RAISE EXCEPTION 'Apenas o responsável ou titular da família pode encerrar a recorrência.'
      USING ERRCODE = '42501';
  END IF;

  IF v_config.status = v_status THEN
    RETURN jsonb_build_object(
      'id', v_config.id,
      'status', v_config.status,
      'encerrada_em', v_config.encerrada_em
    );
  END IF;

  IF v_config.status <> 'ativo' THEN
    RAISE EXCEPTION 'Uma recorrência encerrada não pode mudar para outro estado final.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.contas_fixas
  SET status = v_status,
      encerrada_em = clock_timestamp(),
      encerrada_por = v_user_id,
      updated_at = clock_timestamp()
  WHERE id = v_config.id
  RETURNING * INTO v_config;

  RETURN jsonb_build_object(
    'id', v_config.id,
    'status', v_config.status,
    'encerrada_em', v_config.encerrada_em
  );
END;
$$;

REVOKE ALL ON FUNCTION public.encerrar_conta_fixa(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_conta_fixa(BIGINT, TEXT)
  TO authenticated, service_role;

COMMIT;
