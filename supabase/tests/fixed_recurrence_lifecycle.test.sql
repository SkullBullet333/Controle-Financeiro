BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

SELECT col_type_is(
  'public', 'contas_fixas', 'status', 'text',
  'recorrência possui estado de ciclo de vida'
);

SELECT col_default_is(
  'public', 'contas_fixas', 'status', 'ativo',
  'recorrência nova inicia ativa'
);

SELECT col_type_is(
  'public', 'contas_fixas', 'encerrada_em', 'timestamp with time zone',
  'data de encerramento é auditável'
);

SELECT col_type_is(
  'public', 'contas_fixas', 'encerrada_por', 'uuid',
  'responsável pelo encerramento é auditável'
);

SELECT ok(
  (SELECT convalidated FROM pg_constraint WHERE conname = 'contas_fixas_status_check'),
  'domínio de estados está validado'
);

SELECT ok(
  (SELECT convalidated FROM pg_constraint WHERE conname = 'contas_fixas_lifecycle_shape_check'),
  'forma do ciclo de vida está validada'
);

SELECT has_function(
  'public', 'encerrar_conta_fixa', ARRAY['bigint', 'text'],
  'RPC de encerramento existe'
);

SELECT ok(
  NOT has_function_privilege(
    'anon', 'public.encerrar_conta_fixa(bigint,text)', 'EXECUTE'
  ),
  'anon não pode encerrar recorrências'
);

SELECT ok(
  has_function_privilege(
    'authenticated', 'public.encerrar_conta_fixa(bigint,text)', 'EXECUTE'
  ),
  'usuário autenticado pode chamar o encerramento'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_trigger
    WHERE tgname IN (
      'require_active_conta_fixa_for_despesa',
      'require_active_conta_fixa_for_receita',
      'require_active_conta_fixa_for_cartao'
    )
      AND NOT tgisinternal
  ),
  3,
  'todas as materializações exigem uma recorrência ativa'
);

SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'despesas_family_conta_fixa_fkey'),
  'r',
  'despesas históricas impedem apagar o mestre'
);

SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'receitas_family_conta_fixa_fkey'),
  'r',
  'receitas históricas impedem apagar o mestre'
);

INSERT INTO auth.users (id, email)
VALUES
  ('d1000000-0000-4000-8000-000000000001', 'lifecycle-owner@example.test'),
  ('d2000000-0000-4000-8000-000000000001', 'lifecycle-outsider@example.test');

UPDATE public.profiles
SET family_id = 'd1000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'd1000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET family_id = 'd2000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'd2000000-0000-4000-8000-000000000001';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (8101, 'd1000000-0000-4000-8000-000000000000', 'd1000000-0000-4000-8000-000000000001', 'Titular Ciclo'),
  (8201, 'd2000000-0000-4000-8000-000000000000', 'd2000000-0000-4000-8000-000000000001', 'Titular Externo');

INSERT INTO public.contas_fixas (
  id, family_id, user_id, descricao, valor_mensal, total_parcelas,
  parcela_atual, data_inicio, competencia_inicial, titular_id, categoria, tipo
)
VALUES
  (8101, 'd1000000-0000-4000-8000-000000000000', 'd1000000-0000-4000-8000-000000000001', 'Série auditável', 25, NULL, 1, '2026-09-10', '09/2026', 8101, 'Teste', 'despesa'),
  (8201, 'd2000000-0000-4000-8000-000000000000', 'd2000000-0000-4000-8000-000000000001', 'Série externa', 30, NULL, 1, '2026-09-10', '09/2026', 8201, 'Teste', 'despesa');

SELECT ok(
  (SELECT status = 'ativo' AND encerrada_em IS NULL AND encerrada_por IS NULL FROM public.contas_fixas WHERE id = 8101),
  'registro legado permanece ativo sem inventar encerramento'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'd1000000-0000-4000-8000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$INSERT INTO public.despesas (
      family_id, user_id, conta_fixa_id, descricao, categoria, valor,
      parcela_atual, parcela_total, vencimento, status, titular_id, competencia
    ) VALUES (
      'd1000000-0000-4000-8000-000000000000',
      'd1000000-0000-4000-8000-000000000001',
      8101, 'Ocorrência histórica', 'Teste', 25,
      1, 1, '2026-09-10', 'Pago', 8101, '09/2026'
    )$$,
  'recorrência ativa aceita materialização'
);

SELECT throws_ok(
  $$UPDATE public.contas_fixas
    SET status = 'cancelado', encerrada_em = now()
    WHERE id = 8101$$,
  'P0001',
  'O ciclo de vida da recorrência só pode ser alterado pelo comando de encerramento.',
  'estado não pode ser alterado diretamente'
);

SELECT throws_ok(
  $$SELECT public.encerrar_conta_fixa(8101, 'arquivado')$$,
  '22023',
  'Estado final inválido para a recorrência.',
  'estado final desconhecido é recusado'
);

SELECT throws_ok(
  $$SELECT public.encerrar_conta_fixa(8201, 'cancelado')$$,
  '23503',
  'A recorrência informada não pertence à família autenticada.',
  'recorrência de outra família não pode ser encerrada'
);

SELECT lives_ok(
  $$SELECT public.encerrar_conta_fixa(8101, 'cancelado')$$,
  'responsável encerra a própria recorrência'
);

SELECT ok(
  (SELECT
    status = 'cancelado'
    AND encerrada_em IS NOT NULL
    AND encerrada_por = 'd1000000-0000-4000-8000-000000000001'
   FROM public.contas_fixas
   WHERE id = 8101),
  'encerramento registra estado, instante e responsável'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE conta_fixa_id = 8101),
  1::BIGINT,
  'encerramento preserva o histórico vinculado'
);

SELECT lives_ok(
  $$SELECT public.encerrar_conta_fixa(8101, 'cancelado')$$,
  'repetir o mesmo encerramento é idempotente'
);

SELECT throws_ok(
  $$INSERT INTO public.despesas (
      family_id, user_id, conta_fixa_id, descricao, categoria, valor,
      parcela_atual, parcela_total, vencimento, status, titular_id, competencia
    ) VALUES (
      'd1000000-0000-4000-8000-000000000000',
      'd1000000-0000-4000-8000-000000000001',
      8101, 'Ocorrência posterior', 'Teste', 25,
      2, 2, '2026-10-10', 'Em aberto', 8101, '10/2026'
  )$$,
  '55000',
  'A ocorrência está fora do período ativo da recorrência.',
  'série encerrada não aceita novas materializações'
);

SELECT throws_ok(
  $$SELECT public.encerrar_conta_fixa(8101, 'concluido')$$,
  '55000',
  'Uma recorrência encerrada não pode mudar seu ponto de corte.',
  'estado terminal não pode ser trocado'
);

SELECT throws_ok(
  $$DELETE FROM public.contas_fixas WHERE id = 8101$$,
  'P0001',
  'Recorrências devem ser encerradas, não excluídas.',
  'cliente autenticado não pode apagar o mestre diretamente'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
