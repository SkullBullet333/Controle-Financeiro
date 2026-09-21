BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

INSERT INTO auth.users (id, email)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'invoice-owner@example.test'),
  ('b2000000-0000-4000-8000-000000000001', 'invoice-outsider@example.test');

UPDATE public.profiles
SET family_id = 'b1000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'b1000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET family_id = 'b2000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'b2000000-0000-4000-8000-000000000001';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (6101, 'b1000000-0000-4000-8000-000000000000', 'b1000000-0000-4000-8000-000000000001', 'Titular Fatura'),
  (6201, 'b2000000-0000-4000-8000-000000000000', 'b2000000-0000-4000-8000-000000000001', 'Titular Externo');

INSERT INTO public.cartoes_config (
  id, family_id, user_id, nome_cartao, titular_id, dia_vencimento, dia_fechamento
)
VALUES
  (6101, 'b1000000-0000-4000-8000-000000000000', 'b1000000-0000-4000-8000-000000000001', 'Cartão Estrutural', 6101, 31, 7),
  (6201, 'b2000000-0000-4000-8000-000000000000', 'b2000000-0000-4000-8000-000000000001', 'Cartão Externo', 6201, 10, 5);

INSERT INTO public.emprestimos (
  id, family_id, user_id, descricao, valor_parcela,
  taxa_mensal_percentual, total_parcelas, data_primeiro_vencimento,
  titular_id
)
VALUES (
  6101, 'b1000000-0000-4000-8000-000000000000',
  'b1000000-0000-4000-8000-000000000001', 'Empréstimo de teste',
  100, 1, 2, '2026-09-10', 6101
);

SELECT has_function(
  'public',
  'materializar_fatura_cartao',
  ARRAY['jsonb'],
  'RPC estrutural de fatura existe'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.materializar_fatura_cartao(jsonb)', 'EXECUTE'),
  'anon não executa a RPC de fatura'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.materializar_fatura_cartao(jsonb)', 'EXECUTE'),
  'usuário autenticado executa a RPC de fatura'
);

SELECT col_type_is(
  'public', 'despesas', 'cartao_vencimento_id', 'integer',
  'despesas possui vínculo estrutural com cartão'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT public.materializar_fatura_cartao(
    '{"cartao_vencimento_id":6101,"valor":320.50,"vencimento":"2026-09-30","competencia":"09/2026","status":"Pago"}'::jsonb
  )$$,
  'uma fatura válida é materializada'
);

SELECT ok(
  (SELECT
    family_id = 'b1000000-0000-4000-8000-000000000000'
    AND user_id = 'b1000000-0000-4000-8000-000000000001'
    AND cartao_vencimento_id = 6101
    AND titular_id = 6101
    AND descricao = 'Fatura Cartão Estrutural'
    AND parcela_atual = 1
    AND parcela_total = 1
  FROM public.despesas
  WHERE cartao_vencimento_id = 6101 AND competencia = '09/2026'),
  'família, autor, cartão e metadados vêm da sessão e configuração'
);

SELECT lives_ok(
  $$SELECT public.materializar_fatura_cartao(
    '{"cartao_vencimento_id":6101,"valor":321.75,"vencimento":"2026-09-30","competencia":"09/2026","status":"Pago"}'::jsonb
  )$$,
  'a mesma fatura pode ser materializada novamente sem duplicar'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE cartao_vencimento_id = 6101 AND competencia = '09/2026'),
  1::BIGINT,
  'cartão e competência identificam uma única fatura'
);

SELECT throws_ok(
  $$INSERT INTO public.despesas (
      family_id, user_id, cartao_vencimento_id, descricao, valor,
      parcela_atual, parcela_total, vencimento, status, titular_id, competencia
    ) VALUES (
      'b1000000-0000-4000-8000-000000000000',
      'b1000000-0000-4000-8000-000000000001',
      6101, 'Fatura duplicada', 10, 1, 1, '2026-09-30', 'Pago', 6101, '09/2026'
    )$$,
  '23505',
  'duplicate key value violates unique constraint "despesas_family_card_invoice_key"',
  'a constraint recusa fatura duplicada'
);

SELECT throws_ok(
  $$SELECT public.materializar_fatura_cartao(
    '{"cartao_vencimento_id":6201,"valor":10,"vencimento":"2026-09-10","competencia":"09/2026","status":"Pago"}'::jsonb
  )$$,
  '23503',
  'O cartão informado não pertence à família autenticada.',
  'cartão de outra família é recusado'
);

SELECT throws_ok(
  $$INSERT INTO public.despesas (
      family_id, user_id, emprestimo_id, cartao_vencimento_id,
      descricao, valor, parcela_atual, parcela_total, vencimento,
      status, titular_id, competencia
    ) VALUES (
      'b1000000-0000-4000-8000-000000000000',
      'b1000000-0000-4000-8000-000000000001',
      6101, 6101, 'Duas origens', 10, 1, 1, '2026-10-10',
      'Pago', 6101, '10/2026'
    )$$,
  '23514',
  'new row for relation "despesas" violates check constraint "despesas_single_source_check"',
  'uma despesa não aceita empréstimo e cartão simultaneamente'
);

SELECT throws_ok(
  $$INSERT INTO public.despesas (
      family_id, user_id, cartao_vencimento_id, descricao, valor,
      parcela_atual, parcela_total, vencimento, status, titular_id, competencia
    ) VALUES (
      'b1000000-0000-4000-8000-000000000000',
      'b1000000-0000-4000-8000-000000000001',
      6101, 'Fatura parcelada', 10, 2, 2, '2026-10-31', 'Pago', 6101, '10/2026'
    )$$,
  '23514',
  'new row for relation "despesas" violates check constraint "despesas_card_invoice_shape_check"',
  'fatura estrutural sempre representa uma ocorrência única'
);

SELECT throws_ok(
  $$DELETE FROM public.cartoes_config WHERE id = 6101$$,
  '23503',
  'update or delete on table "cartoes_config" violates foreign key constraint "despesas_family_cartao_vencimento_fkey" on table "despesas"',
  'cartão com histórico de fatura não pode ser excluído em cascata'
);

SELECT throws_ok(
  $$INSERT INTO public.cartoes_config (
      family_id, user_id, nome_cartao, titular_id, dia_vencimento, dia_fechamento
    ) VALUES (
      'b1000000-0000-4000-8000-000000000000',
      'b1000000-0000-4000-8000-000000000001',
      'Fechamento inválido', 6101, 10, 32
    )$$,
  '23514',
  'new row for relation "cartoes_config" violates check constraint "cartoes_config_dia_fechamento_check"',
  'intervalo de fechamento inválido é recusado'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
