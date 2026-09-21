BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(22);

INSERT INTO auth.users (id, email)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'installment-owner@example.test'),
  ('a2000000-0000-4000-8000-000000000001', 'installment-outsider@example.test');

UPDATE public.profiles
SET family_id = 'a1000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'a1000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET family_id = 'a2000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'a2000000-0000-4000-8000-000000000001';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (5101, 'a1000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'Titular Parcelas'),
  (5201, 'a2000000-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000001', 'Titular Externo');

INSERT INTO public.cartoes_config (
  id, family_id, user_id, nome_cartao, titular_id, dia_vencimento, dia_fechamento
)
VALUES
  (5101, 'a1000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'Cartão Parcelas', 5101, 10, 7),
  (5201, 'a2000000-0000-4000-8000-000000000000', 'a2000000-0000-4000-8000-000000000001', 'Cartão Externo', 5201, 15, 5);

SELECT has_function(
  'public',
  'criar_lancamentos_parcelados',
  ARRAY['text', 'uuid', 'jsonb'],
  'RPC idempotente de criação parcelada existe'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.criar_lancamentos_parcelados(text,uuid,jsonb)', 'EXECUTE'),
  'anon não executa a RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.criar_lancamentos_parcelados(text,uuid,jsonb)', 'EXECUTE'),
  'usuário autenticado executa a RPC'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.financial_operation_requests'::regclass),
  'a tabela de operações usa RLS'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.financial_operation_requests', 'UPDATE'),
  'operações não podem ser alteradas diretamente'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'despesa',
    '51000000-0000-4000-8000-000000000001',
    '[
      {"descricao":"Despesa parcelada","valor":75,"parcela_atual":1,"parcela_total":2,"vencimento":"2026-09-30","status":"Em aberto","titular_id":5101,"competencia":"10/2026"},
      {"descricao":"Despesa parcelada","valor":75,"parcela_atual":2,"parcela_total":2,"vencimento":"2026-11-02","status":"Em aberto","titular_id":5101,"competencia":"11/2026"}
    ]'::jsonb
  )$$,
  'um lote válido de despesas é criado'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE operation_id = '51000000-0000-4000-8000-000000000001'),
  2::BIGINT,
  'o lote cria exatamente duas despesas'
);

SELECT ok(
  (SELECT bool_and(
    family_id = 'a1000000-0000-4000-8000-000000000000'
    AND user_id = 'a1000000-0000-4000-8000-000000000001'
    AND operation_item = parcela_atual
    AND emprestimo_id IS NULL
    AND conta_fixa_id IS NULL
  ) FROM public.despesas WHERE operation_id = '51000000-0000-4000-8000-000000000001'),
  'família, autor e identidade são derivados sem origem vinculada'
);

SELECT lives_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'despesa',
    '51000000-0000-4000-8000-000000000001',
    '[
      {"descricao":"Despesa parcelada","valor":75,"parcela_atual":1,"parcela_total":2,"vencimento":"2026-09-30","status":"Em aberto","titular_id":5101,"competencia":"10/2026"},
      {"descricao":"Despesa parcelada","valor":75,"parcela_atual":2,"parcela_total":2,"vencimento":"2026-11-02","status":"Em aberto","titular_id":5101,"competencia":"11/2026"}
    ]'::jsonb
  )$$,
  'retry com a mesma chave e conteúdo é aceito'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE operation_id = '51000000-0000-4000-8000-000000000001'),
  2::BIGINT,
  'retry não duplica despesas'
);

SELECT throws_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'despesa',
    '51000000-0000-4000-8000-000000000001',
    '[{"descricao":"Conteúdo alterado","valor":75,"parcela_atual":1,"parcela_total":1,"vencimento":"2026-09-30","status":"Em aberto","titular_id":5101,"competencia":"10/2026"}]'::jsonb
  )$$,
  '22023',
  'O identificador da operação foi reutilizado com conteúdo diferente.',
  'a mesma chave não aceita conteúdo alterado'
);

SELECT lives_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'despesa',
    '51000000-0000-4000-8000-000000000002',
    '[
      {"descricao":"Despesa parcelada","valor":75,"parcela_atual":1,"parcela_total":2,"vencimento":"2026-09-30","status":"Em aberto","titular_id":5101,"competencia":"10/2026"},
      {"descricao":"Despesa parcelada","valor":75,"parcela_atual":2,"parcela_total":2,"vencimento":"2026-11-02","status":"Em aberto","titular_id":5101,"competencia":"11/2026"}
    ]'::jsonb
  )$$,
  'outra chave permite um lançamento de negócio visualmente idêntico'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE descricao = 'Despesa parcelada'),
  4::BIGINT,
  'operações legítimas distintas não são confundidas'
);

SELECT throws_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'despesa',
    '51000000-0000-4000-8000-000000000003',
    '[
      {"descricao":"Lote inválido","valor":50,"parcela_atual":1,"parcela_total":2,"vencimento":"2026-09-10","status":"Em aberto","titular_id":5101,"competencia":"09/2026"},
      {"descricao":"Lote inválido","valor":50,"parcela_atual":3,"parcela_total":2,"vencimento":"2026-10-12","status":"Em aberto","titular_id":5101,"competencia":"10/2026"}
    ]'::jsonb
  )$$,
  '22023',
  'As parcelas devem formar uma sequência completa de 1 até o total.',
  'uma sequência incompleta é recusada'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.financial_operation_requests WHERE operation_id = '51000000-0000-4000-8000-000000000003'),
  0::BIGINT,
  'falha reverte também o registro de idempotência'
);

SELECT lives_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'receita',
    '51000000-0000-4000-8000-000000000004',
    '[
      {"descricao":"Receita parcelada","valor":200,"parcela_atual":1,"parcela_total":2,"data_recebimento":"2026-09-15","status":"Recebido","titular_id":5101,"competencia":"09/2026"},
      {"descricao":"Receita parcelada","valor":200,"parcela_atual":2,"parcela_total":2,"data_recebimento":"2026-10-15","status":"Pendente","titular_id":5101,"competencia":"10/2026"}
    ]'::jsonb
  )$$,
  'receitas parceladas usam o mesmo contrato idempotente'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.receitas WHERE operation_id = '51000000-0000-4000-8000-000000000004'),
  2::BIGINT,
  'a receita gera exatamente duas parcelas'
);

SELECT lives_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'cartao',
    '51000000-0000-4000-8000-000000000005',
    '[
      {"estabelecimento":"Compra parcelada","valor":30,"parcela_atual":1,"parcela_total":2,"data_compra":"2026-09-12","cartao_id":5101,"titular_id":5201,"competencia":"10/2026"},
      {"estabelecimento":"Compra parcelada","valor":30,"parcela_atual":2,"parcela_total":2,"data_compra":"2026-09-12","cartao_id":5101,"titular_id":5201,"competencia":"11/2026"}
    ]'::jsonb
  )$$,
  'compras parceladas no cartão também são idempotentes'
);

SELECT ok(
  (SELECT bool_and(
    user_id = 'a1000000-0000-4000-8000-000000000001'
    AND titular_id = 5101
  ) FROM public.cartoes WHERE operation_id = '51000000-0000-4000-8000-000000000005'),
  'autor vem da sessão e titular vem da configuração do cartão'
);

SELECT lives_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'cartao',
    '51000000-0000-4000-8000-000000000007',
    '[{"estabelecimento":"Estorno","valor":-15,"parcela_atual":1,"parcela_total":1,"data_compra":"2026-09-12","cartao_id":5101,"competencia":"10/2026"}]'::jsonb
  )$$,
  'cartão preserva créditos e estornos com valor negativo'
);

SELECT throws_ok(
  $$SELECT public.criar_lancamentos_parcelados(
    'cartao',
    '51000000-0000-4000-8000-000000000006',
    '[{"estabelecimento":"Cartão externo","valor":10,"parcela_atual":1,"parcela_total":1,"data_compra":"2026-09-12","cartao_id":5201,"competencia":"09/2026"}]'::jsonb
  )$$,
  '23503',
  'O cartão informado não pertence à família autenticada.',
  'cartão de outra família é recusado'
);

SELECT throws_ok(
  $$UPDATE public.despesas
    SET operation_id = '51000000-0000-4000-8000-000000000099'
    WHERE operation_id = '51000000-0000-4000-8000-000000000001'
      AND operation_item = 1$$,
  'P0001',
  'A identidade da operação financeira é imutável.',
  'a identidade persistida não pode ser trocada'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
