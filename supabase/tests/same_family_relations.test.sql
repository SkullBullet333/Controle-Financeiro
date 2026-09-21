BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(7);

INSERT INTO auth.users (id, email)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'family-one@example.test'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'family-two@example.test');

UPDATE public.profiles
SET family_id = '33333333-3333-4333-8333-333333333333', tipo = 'titular'
WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

UPDATE public.profiles
SET family_id = '44444444-4444-4444-8444-444444444444', tipo = 'titular'
WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (1001, '33333333-3333-4333-8333-333333333333', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Titular Família Um'),
  (2001, '44444444-4444-4444-8444-444444444444', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Titular Família Dois');

INSERT INTO public.cartoes_config (
  id, family_id, user_id, nome_cartao, titular_id, dia_vencimento, dia_fechamento
)
VALUES (
  1001,
  '33333333-3333-4333-8333-333333333333',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Cartão Família Um', 1001, 10, 5
);

INSERT INTO public.contas_fixas (
  id, family_id, user_id, descricao, valor_mensal, data_inicio,
  competencia_inicial, titular_id
)
VALUES (
  1001,
  '33333333-3333-4333-8333-333333333333',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Conta Família Um', 100, '2026-09-01', '09/2026', 1001
);

SELECT throws_ok(
  $$INSERT INTO public.despesas (family_id, user_id, descricao, valor, vencimento, competencia, titular_id)
    VALUES (
      '33333333-3333-4333-8333-333333333333',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'Referência cruzada', 10, '2026-09-10', '09/2026', 2001
    )$$,
  '23503',
  'insert or update on table "despesas" violates foreign key constraint "despesas_family_titular_fkey"',
  'despesa não referencia titular de outra família'
);

SELECT lives_ok(
  $$INSERT INTO public.despesas (family_id, user_id, descricao, valor, vencimento, competencia, titular_id)
    VALUES (
      '33333333-3333-4333-8333-333333333333',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'Referência válida', 10, '2026-09-10', '09/2026', 1001
    )$$,
  'despesa aceita titular da própria família'
);

SELECT throws_ok(
  $$INSERT INTO public.cartoes_config (family_id, user_id, nome_cartao, titular_id, dia_vencimento, dia_fechamento)
    VALUES (
      '33333333-3333-4333-8333-333333333333',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'Cartão cruzado', 2001, 15, 7
    )$$,
  '23503',
  'insert or update on table "cartoes_config" violates foreign key constraint "cartoes_config_family_titular_fkey"',
  'cartão não referencia titular de outra família'
);

SELECT throws_ok(
  $$INSERT INTO public.contas_fixas (
      family_id, user_id, descricao, valor_mensal, data_inicio,
      competencia_inicial, titular_id, cartao_id
    ) VALUES (
      '44444444-4444-4444-8444-444444444444',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'Conta cruzada', 20, '2026-09-01', '09/2026', 2001, 1001
    )$$,
  '23503',
  'insert or update on table "contas_fixas" violates foreign key constraint "contas_fixas_family_cartao_fkey"',
  'conta fixa não referencia cartão de outra família'
);

SELECT throws_ok(
  $$INSERT INTO public.receitas (
      family_id, user_id, descricao, valor, data_recebimento,
      status, competencia, titular_id, conta_fixa_id
    ) VALUES (
      '44444444-4444-4444-8444-444444444444',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'Receita cruzada', 30, '2026-09-10', 'Pendente', '09/2026', 2001, 1001
    )$$,
  '23503',
  'insert or update on table "receitas" violates foreign key constraint "receitas_family_conta_fixa_fkey"',
  'receita não referencia conta fixa de outra família'
);

SELECT throws_ok(
  $$INSERT INTO public.cartoes (
      family_id, user_id, cartao_id, estabelecimento, valor,
      data_compra, competencia, titular_id
    ) VALUES (
      '44444444-4444-4444-8444-444444444444',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      1001, 'Compra cruzada', 40, '2026-09-10', '09/2026', 2001
    )$$,
  '23503',
  'insert or update on table "cartoes" violates foreign key constraint "cartoes_family_cartao_fkey"',
  'compra não referencia cartão de outra família'
);

SELECT throws_ok(
  $$INSERT INTO public.emprestimos (
      family_id, user_id, descricao, valor_parcela, taxa_mensal_percentual,
      total_parcelas, data_primeiro_vencimento, titular_id
    ) VALUES (
      '33333333-3333-4333-8333-333333333333',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'Empréstimo cruzado', 50, 1, 12, '2026-09-10', 2001
    )$$,
  '23503',
  'insert or update on table "emprestimos" violates foreign key constraint "emprestimos_family_titular_fkey"',
  'empréstimo não referencia titular de outra família'
);

SELECT * FROM finish();

ROLLBACK;

