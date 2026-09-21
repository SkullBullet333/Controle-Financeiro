-- Ensaio das RPCs transacionais com dados sintéticos; tudo é revertido.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
SET LOCAL search_path = public, extensions, pg_catalog;
SELECT extensions.no_plan();

INSERT INTO auth.users (id, email) VALUES
  ('ca700000-0000-4000-8000-000000000001', 'category-owner@example.test'),
  ('ca700000-0000-4000-8000-000000000002', 'category-outsider@example.test');

UPDATE public.profiles
SET family_id = 'ca700000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'ca700000-0000-4000-8000-000000000001';
UPDATE public.profiles
SET family_id = 'ca800000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'ca700000-0000-4000-8000-000000000002';

INSERT INTO public.despesas
  (id, family_id, user_id, descricao, categoria, valor, vencimento, competencia)
VALUES
  (9900101, 'ca700000-0000-4000-8000-000000000000', 'ca700000-0000-4000-8000-000000000001', 'Conta teste', 'Antiga', 10, '2026-09-10', '09/2026'),
  (9900102, 'ca800000-0000-4000-8000-000000000000', 'ca700000-0000-4000-8000-000000000002', 'Conta teste', 'Antiga', 20, '2026-09-10', '09/2026');

INSERT INTO public.contas_fixas
  (id, family_id, user_id, descricao, categoria, valor_mensal, data_inicio, competencia_inicial)
VALUES
  (9900101, 'ca700000-0000-4000-8000-000000000000', 'ca700000-0000-4000-8000-000000000001', 'Conta teste', 'Antiga', 10, '2026-09-10', '09/2026');

INSERT INTO public.cartoes
  (id, family_id, user_id, estabelecimento, categoria, valor, data_compra, competencia)
VALUES
  (9900101, 'ca700000-0000-4000-8000-000000000000', 'ca700000-0000-4000-8000-000000000001', 'Conta teste', 'Antiga', 10, '2026-09-10', '09/2026');

CREATE FUNCTION public.draft_reject_category_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.categoria = 'Falha' THEN
    RAISE EXCEPTION 'falha simulada' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER draft_reject_category_update
  BEFORE UPDATE OF categoria ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION public.draft_reject_category_update();

SELECT extensions.has_function('public', 'renomear_categoria_em_lote', ARRAY['text', 'text']);
SELECT extensions.has_function('public', 'atualizar_categoria_por_descricao', ARRAY['text', 'text']);
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.renomear_categoria_em_lote(text,text)', 'EXECUTE'));
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.atualizar_categoria_por_descricao(text,text)', 'EXECUTE'));

SELECT set_config('request.jwt.claim.sub', 'ca700000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok($$SELECT public.renomear_categoria_em_lote('Antiga', 'Nova')$$);
SELECT extensions.is((SELECT categoria FROM public.despesas WHERE id = 9900101), 'Nova');
SELECT extensions.is((SELECT categoria FROM public.contas_fixas WHERE id = 9900101), 'Nova');
SELECT extensions.is((SELECT categoria FROM public.cartoes WHERE id = 9900101), 'Nova');

SELECT extensions.lives_ok($$SELECT public.atualizar_categoria_por_descricao('conta teste', 'Outros')$$);
SELECT extensions.is((SELECT categoria FROM public.despesas WHERE id = 9900101), 'Outros');
SELECT extensions.is((SELECT categoria FROM public.contas_fixas WHERE id = 9900101), 'Outros');
SELECT extensions.is((SELECT categoria FROM public.cartoes WHERE id = 9900101), 'Outros');

SELECT extensions.throws_ok(
  $$SELECT public.renomear_categoria_em_lote('Outros', 'Falha')$$,
  'P0001', 'falha simulada',
  'falha no último UPDATE reverte as outras tabelas'
);
SELECT extensions.is((SELECT categoria FROM public.despesas WHERE id = 9900101), 'Outros');
SELECT extensions.is((SELECT categoria FROM public.contas_fixas WHERE id = 9900101), 'Outros');
SELECT extensions.is((SELECT categoria FROM public.cartoes WHERE id = 9900101), 'Outros');

RESET ROLE;
SELECT extensions.is((SELECT categoria FROM public.despesas WHERE id = 9900102), 'Antiga', 'outra família não é alterada');
SELECT * FROM extensions.finish();
ROLLBACK;
