BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(15);

INSERT INTO auth.users (id, email)
VALUES
  ('f1000000-0000-4000-8000-000000000001', 'atomic-owner@example.test'),
  ('f1000000-0000-4000-8000-000000000002', 'atomic-member@example.test'),
  ('f2000000-0000-4000-8000-000000000001', 'atomic-outsider@example.test');

UPDATE public.profiles
SET family_id = 'f1000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'f1000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET family_id = 'f1000000-0000-4000-8000-000000000000', tipo = 'membro'
WHERE id = 'f1000000-0000-4000-8000-000000000002';

UPDATE public.profiles
SET family_id = 'f2000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'f2000000-0000-4000-8000-000000000001';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (3101, 'f1000000-0000-4000-8000-000000000000', 'f1000000-0000-4000-8000-000000000001', 'Titular Atômico'),
  (3201, 'f2000000-0000-4000-8000-000000000000', 'f2000000-0000-4000-8000-000000000001', 'Titular Externo');

INSERT INTO public.emprestimos (
  id, family_id, user_id, descricao, valor_parcela,
  taxa_mensal_percentual, total_parcelas, data_primeiro_vencimento,
  competencia_inicial, titular_id
)
VALUES
  (
    3101, 'f1000000-0000-4000-8000-000000000000',
    'f1000000-0000-4000-8000-000000000001', 'Empréstimo Atômico',
    100, 1, 4, '2026-09-10', '09/2026', 3101
  ),
  (
    3201, 'f2000000-0000-4000-8000-000000000000',
    'f2000000-0000-4000-8000-000000000001', 'Empréstimo Externo',
    200, 1, 2, '2026-09-10', '09/2026', 3201
  );

INSERT INTO public.contas_fixas (
  id, family_id, user_id, descricao, valor_mensal, total_parcelas,
  data_inicio, competencia_inicial, titular_id, categoria, tipo
)
VALUES (
  3101, 'f1000000-0000-4000-8000-000000000000',
  'f1000000-0000-4000-8000-000000000001', 'Conta Fixa Atômica',
  80, NULL, '2026-09-05', '09/2026', 3101, 'Moradia', 'despesa'
);

SELECT has_function(
  'public',
  'materializar_despesas_vinculadas',
  ARRAY['jsonb'],
  'RPC transacional de despesas vinculadas existe'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.materializar_despesas_vinculadas(jsonb)', 'EXECUTE'),
  'anon não executa a RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.materializar_despesas_vinculadas(jsonb)', 'EXECUTE'),
  'usuário autenticado executa a RPC'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-4000-8000-000000000002',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT * FROM public.materializar_despesas_vinculadas(
    '[
      {"emprestimo_id":3101,"valor":95.50,"parcela_atual":1,"vencimento":"2026-09-10","competencia":"09/2026","status":"Pago"},
      {"emprestimo_id":3101,"valor":94.25,"parcela_atual":2,"vencimento":"2026-10-10","competencia":"10/2026","status":"Pago"}
    ]'::jsonb
  )$$,
  'lote válido materializa duas parcelas'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE emprestimo_id = 3101),
  2::BIGINT,
  'as duas parcelas são persistidas'
);

SELECT ok(
  (SELECT bool_and(
    family_id = 'f1000000-0000-4000-8000-000000000000'
    AND user_id = 'f1000000-0000-4000-8000-000000000002'
    AND status = 'Pago'
    AND descricao = 'Empréstimo Atômico'
    AND parcela_total = 4
  ) FROM public.despesas WHERE emprestimo_id = 3101),
  'família, autor, status e metadados do mestre são preservados'
);

SELECT lives_ok(
  $$SELECT * FROM public.materializar_despesas_vinculadas(
    '[
      {"emprestimo_id":3101,"valor":95.50,"parcela_atual":1,"vencimento":"2026-09-10","competencia":"09/2026","status":"Pago"},
      {"emprestimo_id":3101,"valor":94.25,"parcela_atual":2,"vencimento":"2026-10-10","competencia":"10/2026","status":"Pago"}
    ]'::jsonb
  )$$,
  'retry do mesmo lote é aceito'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE emprestimo_id = 3101),
  2::BIGINT,
  'retry não cria duplicatas'
);

SELECT lives_ok(
  $$SELECT * FROM public.materializar_despesas_vinculadas(
    '[{"conta_fixa_id":3101,"valor":80,"parcela_atual":7,"parcela_total":0,"vencimento":"2027-03-05","competencia":"03/2027","status":"Pago"}]'::jsonb
  )$$,
  'conta fixa sem prazo materializa ocorrência numerada'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE conta_fixa_id = 3101 AND parcela_atual = 7),
  1::BIGINT,
  'ocorrência de conta fixa é única'
);

SELECT throws_ok(
  $$SELECT * FROM public.materializar_despesas_vinculadas(
    '[
      {"emprestimo_id":3101,"valor":90,"parcela_atual":3,"vencimento":"2026-11-10","competencia":"11/2026","status":"Pago"},
      {"emprestimo_id":3101,"valor":90,"parcela_atual":5,"vencimento":"2027-01-11","competencia":"01/2027","status":"Pago"}
    ]'::jsonb
  )$$,
  'P0001',
  'Parcela 5 inválida para o empréstimo 3101.',
  'uma parcela inválida aborta o lote'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE emprestimo_id = 3101 AND parcela_atual = 3),
  0::BIGINT,
  'a parcela válida anterior também é revertida'
);

SELECT throws_ok(
  $$SELECT * FROM public.materializar_despesas_vinculadas(
    '[{"emprestimo_id":3201,"valor":200,"parcela_atual":1,"vencimento":"2026-09-10","competencia":"09/2026","status":"Pago"}]'::jsonb
  )$$,
  'P0001',
  'Empréstimo 3201 não pertence à família autenticada.',
  'origem de outra família é recusada'
);

SELECT throws_ok(
  $$SELECT * FROM public.materializar_despesas_vinculadas(
    '[{"emprestimo_id":3101,"conta_fixa_id":3101,"valor":80,"parcela_atual":4,"vencimento":"2026-12-10","competencia":"12/2026","status":"Pago"}]'::jsonb
  )$$,
  '22023',
  'Cada despesa deve ter exatamente uma origem vinculada.',
  'duas origens simultâneas são recusadas'
);

RESET ROLE;

SELECT is(
  (SELECT count(*)::BIGINT FROM public.emprestimos WHERE id = 3101),
  1::BIGINT,
  'a quitação não exclui o empréstimo mestre'
);

SELECT * FROM finish();

ROLLBACK;
