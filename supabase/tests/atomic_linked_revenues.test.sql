BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(13);

INSERT INTO auth.users (id, email)
VALUES
  ('e1000000-0000-4000-8000-000000000001', 'revenue-owner@example.test'),
  ('e1000000-0000-4000-8000-000000000002', 'revenue-member@example.test'),
  ('e2000000-0000-4000-8000-000000000001', 'revenue-outsider@example.test');

UPDATE public.profiles
SET family_id = 'e1000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'e1000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET family_id = 'e1000000-0000-4000-8000-000000000000', tipo = 'membro'
WHERE id = 'e1000000-0000-4000-8000-000000000002';

UPDATE public.profiles
SET family_id = 'e2000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'e2000000-0000-4000-8000-000000000001';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (4101, 'e1000000-0000-4000-8000-000000000000', 'e1000000-0000-4000-8000-000000000001', 'Titular Receita'),
  (4201, 'e2000000-0000-4000-8000-000000000000', 'e2000000-0000-4000-8000-000000000001', 'Titular Receita Externo');

INSERT INTO public.contas_fixas (
  id, family_id, user_id, descricao, valor_mensal, total_parcelas,
  data_inicio, competencia_inicial, titular_id, categoria, tipo
)
VALUES
  (
    4101, 'e1000000-0000-4000-8000-000000000000',
    'e1000000-0000-4000-8000-000000000001', 'Receita Recorrente',
    1000, NULL, '2026-09-30', '10/2026', 4101, 'Trabalho', 'receita'
  ),
  (
    4102, 'e1000000-0000-4000-8000-000000000000',
    'e1000000-0000-4000-8000-000000000001', 'Despesa Recorrente',
    100, NULL, '2026-09-10', '09/2026', 4101, 'Moradia', 'despesa'
  ),
  (
    4201, 'e2000000-0000-4000-8000-000000000000',
    'e2000000-0000-4000-8000-000000000001', 'Receita Externa',
    2000, NULL, '2026-09-30', '10/2026', 4201, 'Trabalho', 'receita'
  );

SELECT has_function(
  'public',
  'materializar_receitas_vinculadas',
  ARRAY['jsonb'],
  'RPC transacional de receitas vinculadas existe'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.materializar_receitas_vinculadas(jsonb)', 'EXECUTE'),
  'anon não executa a RPC de receitas'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.materializar_receitas_vinculadas(jsonb)', 'EXECUTE'),
  'usuário autenticado executa a RPC de receitas'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'e1000000-0000-4000-8000-000000000002',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT * FROM public.materializar_receitas_vinculadas(
    '[
      {"conta_fixa_id":4101,"valor":1000,"parcela_atual":1,"parcela_total":0,"data_recebimento":"2026-09-30","competencia":"10/2026","status":"Recebido"},
      {"conta_fixa_id":4101,"valor":1000,"parcela_atual":1,"parcela_total":0,"data_recebimento":"2026-10-30","competencia":"11/2026","status":"Recebido"}
    ]'::jsonb
  )$$,
  'duas competências podem reutilizar parcela_atual legado'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.receitas WHERE conta_fixa_id = 4101),
  2::BIGINT,
  'as duas competências são persistidas separadamente'
);

SELECT ok(
  (SELECT bool_and(
    family_id = 'e1000000-0000-4000-8000-000000000000'
    AND user_id = 'e1000000-0000-4000-8000-000000000002'
    AND status = 'Recebido'
    AND descricao = 'Receita Recorrente'
  ) FROM public.receitas WHERE conta_fixa_id = 4101),
  'família, autor, status e descrição do mestre são preservados'
);

SELECT lives_ok(
  $$SELECT * FROM public.materializar_receitas_vinculadas(
    '[{"conta_fixa_id":4101,"valor":1000,"parcela_atual":1,"parcela_total":0,"data_recebimento":"2026-09-30","competencia":"10/2026","status":"Recebido"}]'::jsonb
  )$$,
  'retry da mesma competência é aceito'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.receitas WHERE conta_fixa_id = 4101),
  2::BIGINT,
  'retry não duplica a receita'
);

SELECT throws_ok(
  $$SELECT * FROM public.materializar_receitas_vinculadas(
    '[
      {"conta_fixa_id":4101,"valor":1000,"parcela_atual":1,"data_recebimento":"2026-11-30","competencia":"12/2026","status":"Recebido"},
      {"conta_fixa_id":4101,"valor":1000,"parcela_atual":0,"data_recebimento":"2026-12-30","competencia":"01/2027","status":"Recebido"}
    ]'::jsonb
  )$$,
  '22023',
  'O número da parcela deve ser maior ou igual a 1.',
  'uma receita inválida aborta o lote'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.receitas WHERE conta_fixa_id = 4101 AND competencia = '12/2026'),
  0::BIGINT,
  'a receita válida anterior também é revertida'
);

SELECT throws_ok(
  $$SELECT * FROM public.materializar_receitas_vinculadas(
    '[{"conta_fixa_id":4201,"valor":2000,"parcela_atual":1,"data_recebimento":"2026-09-30","competencia":"10/2026","status":"Recebido"}]'::jsonb
  )$$,
  'P0001',
  'Conta fixa 4201 não pertence à família autenticada ou não é uma receita.',
  'conta de outra família é recusada'
);

SELECT throws_ok(
  $$SELECT * FROM public.materializar_receitas_vinculadas(
    '[{"conta_fixa_id":4102,"valor":100,"parcela_atual":1,"data_recebimento":"2026-09-10","competencia":"09/2026","status":"Recebido"}]'::jsonb
  )$$,
  'P0001',
  'Conta fixa 4102 não pertence à família autenticada ou não é uma receita.',
  'configuração do tipo despesa é recusada'
);

RESET ROLE;

SELECT is(
  (SELECT count(*)::BIGINT FROM public.contas_fixas WHERE id = 4101),
  1::BIGINT,
  'recebimento não exclui a conta fixa mestre'
);

SELECT * FROM finish();

ROLLBACK;
