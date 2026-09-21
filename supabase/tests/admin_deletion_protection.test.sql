BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'cartoes_config_family_titular_fkey'),
  'r',
  'cartão cadastrado impede apagar seu titular'
);
SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'emprestimos_family_titular_fkey'),
  'r',
  'empréstimo impede apagar seu titular'
);
SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'contas_fixas_family_titular_fkey'),
  'r',
  'conta fixa impede apagar seu titular'
);
SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'contas_fixas_family_cartao_fkey'),
  'r',
  'conta fixa impede apagar seu cartão'
);
SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'cartoes_family_cartao_fkey'),
  'r',
  'compra impede apagar seu cartão'
);
SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'cartoes_family_titular_fkey'),
  'r',
  'compra impede apagar seu titular'
);
SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'despesas_family_titular_fkey'),
  'r',
  'despesa impede apagar seu titular'
);
SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'receitas_family_titular_fkey'),
  'r',
  'receita impede apagar seu titular'
);

INSERT INTO auth.users (id, email)
VALUES ('abababab-abab-4bab-8bab-abababababab', 'deletion-protection@example.test');

UPDATE public.profiles
SET family_id = 'abababab-abab-4bab-8bab-abababababab', tipo = 'titular'
WHERE id = 'abababab-abab-4bab-8bab-abababababab';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (3101, 'abababab-abab-4bab-8bab-abababababab', 'abababab-abab-4bab-8bab-abababababab', 'Titular em uso'),
  (3102, 'abababab-abab-4bab-8bab-abababababab', 'abababab-abab-4bab-8bab-abababababab', 'Titular sem uso');

INSERT INTO public.cartoes_config (
  id, family_id, user_id, nome_cartao, titular_id, dia_vencimento, dia_fechamento
)
VALUES
  (3101, 'abababab-abab-4bab-8bab-abababababab', 'abababab-abab-4bab-8bab-abababababab', 'Cartão em uso', 3101, 10, 5),
  (3102, 'abababab-abab-4bab-8bab-abababababab', 'abababab-abab-4bab-8bab-abababababab', 'Cartão sem uso', 3101, 15, 7);

INSERT INTO public.cartoes (
  family_id, user_id, cartao_id, estabelecimento, valor,
  data_compra, competencia, titular_id
)
VALUES (
  'abababab-abab-4bab-8bab-abababababab',
  'abababab-abab-4bab-8bab-abababababab',
  3101, 'Compra protegida', 25, '2026-09-13', '09/2026', 3101
);

SELECT throws_ok(
  $$DELETE FROM public.cartoes_config WHERE id = 3101$$,
  '23503',
  'update or delete on table "cartoes_config" violates foreign key constraint "cartoes_family_cartao_fkey" on table "cartoes"',
  'cartão em uso não pode ser apagado'
);

SELECT throws_ok(
  $$DELETE FROM public.titulares WHERE id = 3101$$,
  '23503',
  'update or delete on table "titulares" violates foreign key constraint "cartoes_config_family_titular_fkey" on table "cartoes_config"',
  'titular em uso não pode ser apagado'
);

SELECT lives_ok(
  $$DELETE FROM public.cartoes_config WHERE id = 3102$$,
  'cartão sem uso pode ser apagado'
);

SELECT lives_ok(
  $$DELETE FROM public.titulares WHERE id = 3102$$,
  'titular sem uso pode ser apagado'
);

SELECT * FROM finish();

ROLLBACK;
