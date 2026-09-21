-- Harden family isolation and role permissions.
-- This migration is intentionally additive and must be exercised locally before
-- it is considered for a linked Supabase project.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tipo_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tipo_check
  CHECK (tipo IN ('titular', 'membro')) NOT VALID;

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_tipo_check;

CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT family_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_my_family_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (
      SELECT tipo = 'titular'
      FROM public.profiles
      WHERE id = auth.uid()
        AND family_id = public.get_my_family_id()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_family_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_my_family_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_family_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_my_family_admin() TO authenticated, service_role;

ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND (
       NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.family_id IS DISTINCT FROM OLD.family_id
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
     ) THEN
    RAISE EXCEPTION 'Campos de segurança do perfil não podem ser alterados diretamente.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields ON public.profiles;
CREATE TRIGGER protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();

REVOKE ALL ON FUNCTION public.protect_profile_security_fields() FROM PUBLIC;

DROP POLICY IF EXISTS "Leitura de perfis da família" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserção do próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Atualização do próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Exclusão do próprio perfil" ON public.profiles;

CREATE POLICY profiles_select_family
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR family_id = public.get_my_family_id());

CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DO $$
DECLARE
  tab TEXT;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'titulares',
    'cartoes_config',
    'cartoes',
    'despesas',
    'receitas',
    'table_notas',
    'emprestimos',
    'convites',
    'contas_fixas'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso por Família', tab);
  END LOOP;
END $$;

-- Family members can read the shared financial book. Mutations are limited to
-- their own rows, while the family owner can administer all family rows.
DO $$
DECLARE
  tab TEXT;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'cartoes',
    'despesas',
    'receitas',
    'emprestimos',
    'contas_fixas'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (family_id = public.get_my_family_id())',
      tab || '_select_family',
      tab
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (family_id = public.get_my_family_id() AND user_id = auth.uid())',
      tab || '_insert_own',
      tab
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (family_id = public.get_my_family_id() AND (user_id = auth.uid() OR public.is_my_family_admin())) WITH CHECK (family_id = public.get_my_family_id() AND (user_id = auth.uid() OR public.is_my_family_admin()))',
      tab || '_update_own_or_admin',
      tab
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (family_id = public.get_my_family_id() AND (user_id = auth.uid() OR public.is_my_family_admin()))',
      tab || '_delete_own_or_admin',
      tab
    );
  END LOOP;
END $$;

-- Titular and card configuration are administrative family records.
DO $$
DECLARE
  tab TEXT;
BEGIN
  FOREACH tab IN ARRAY ARRAY['titulares', 'cartoes_config']
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (family_id = public.get_my_family_id())',
      tab || '_select_family',
      tab
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (family_id = public.get_my_family_id() AND public.is_my_family_admin()) WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_admin())',
      tab || '_admin_write',
      tab
    );
  END LOOP;
END $$;

CREATE POLICY convites_admin_all
  ON public.convites
  FOR ALL
  TO authenticated
  USING (family_id = public.get_my_family_id() AND public.is_my_family_admin())
  WITH CHECK (family_id = public.get_my_family_id() AND public.is_my_family_admin());

-- Notes are deliberately collaborative within a family.
CREATE POLICY table_notas_select_family
  ON public.table_notas
  FOR SELECT
  TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY table_notas_write_family
  ON public.table_notas
  FOR ALL
  TO authenticated
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());
