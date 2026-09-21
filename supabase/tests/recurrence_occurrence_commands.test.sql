BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(33);

SELECT col_type_is(
  'public', 'contas_fixas', 'encerrada_a_partir_da_ocorrencia', 'integer',
  'recorrência registra o número inicial do corte'
);

SELECT ok(
  (SELECT convalidated FROM pg_constraint WHERE conname = 'contas_fixas_lifecycle_shape_check'),
  'constraint do ciclo de vida com ponto de corte está validada'
);

SELECT has_table(
  'public', 'contas_fixas_excecoes',
  'exceções de ocorrências possuem armazenamento próprio'
);

SELECT ok(
  (SELECT contype = 'u' FROM pg_constraint WHERE conname = 'contas_fixas_excecoes_occurrence_key'),
  'cada ocorrência possui no máximo uma exceção'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.contas_fixas_excecoes'::regclass),
  'RLS está ativo nas exceções'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.contas_fixas_excecoes'::regclass
      AND polname = 'contas_fixas_excecoes_select_family'
  ),
  'exceções só possuem leitura por família'
);

SELECT has_function(
  'public', 'ignorar_ocorrencia_conta_fixa', ARRAY['bigint', 'integer'],
  'RPC para ignorar uma ocorrência existe'
);

SELECT has_function(
  'public', 'encerrar_conta_fixa_desde', ARRAY['bigint', 'integer', 'text'],
  'RPC para encerrar ocorrências futuras existe'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.ignorar_ocorrencia_conta_fixa(bigint,integer)', 'EXECUTE'),
  'usuário autenticado pode ignorar ocorrência'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.ignorar_ocorrencia_conta_fixa(bigint,integer)', 'EXECUTE'),
  'anon não pode ignorar ocorrência'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.encerrar_conta_fixa_desde(bigint,integer,text)', 'EXECUTE'),
  'usuário autenticado pode encerrar ocorrências futuras'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.encerrar_conta_fixa_desde(bigint,integer,text)', 'EXECUTE'),
  'anon não pode encerrar ocorrências futuras'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.contas_fixas_excecoes', 'INSERT'),
  'cliente não grava exceções diretamente'
);

INSERT INTO auth.users (id, email)
VALUES
  ('e1000000-0000-4000-8000-000000000001', 'occurrence-owner@example.test'),
  ('e2000000-0000-4000-8000-000000000001', 'occurrence-outsider@example.test');

UPDATE public.profiles
SET family_id = 'e1000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'e1000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET family_id = 'e2000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'e2000000-0000-4000-8000-000000000001';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (9101, 'e1000000-0000-4000-8000-000000000000', 'e1000000-0000-4000-8000-000000000001', 'Titular Ocorrência'),
  (9201, 'e2000000-0000-4000-8000-000000000000', 'e2000000-0000-4000-8000-000000000001', 'Titular Externo');

INSERT INTO public.contas_fixas (
  id, family_id, user_id, descricao, valor_mensal, total_parcelas,
  parcela_atual, data_inicio, competencia_inicial, titular_id, categoria, tipo
)
VALUES
  (9101, 'e1000000-0000-4000-8000-000000000000', 'e1000000-0000-4000-8000-000000000001', 'Série por ocorrência', 25, 6, 1, '2026-09-10', '09/2026', 9101, 'Teste', 'despesa'),
  (9102, 'e1000000-0000-4000-8000-000000000000', 'e1000000-0000-4000-8000-000000000001', 'Série inteira', 20, NULL, 1, '2026-09-12', '09/2026', 9101, 'Teste', 'despesa'),
  (9201, 'e2000000-0000-4000-8000-000000000000', 'e2000000-0000-4000-8000-000000000001', 'Série externa', 30, NULL, 1, '2026-09-10', '09/2026', 9201, 'Teste', 'despesa');

SELECT ok(
  (SELECT status = 'ativo' AND encerrada_a_partir_da_ocorrencia IS NULL FROM public.contas_fixas WHERE id = 9101),
  'série inicia ativa e sem ponto de corte'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'e1000000-0000-4000-8000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT public.ignorar_ocorrencia_conta_fixa(9101, 2)$$,
  'responsável pode ignorar uma ocorrência'
);

SELECT ok(
  (SELECT
    family_id = 'e1000000-0000-4000-8000-000000000000'
    AND conta_fixa_id = 9101
    AND ocorrencia = 2
    AND acao = 'ignorar'
    AND created_by = 'e1000000-0000-4000-8000-000000000001'
   FROM public.contas_fixas_excecoes
   WHERE conta_fixa_id = 9101 AND ocorrencia = 2),
  'exceção registra família, mestre, ocorrência, ação e responsável'
);

SELECT lives_ok(
  $$SELECT public.ignorar_ocorrencia_conta_fixa(9101, 2)$$,
  'repetir a exceção é idempotente'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.contas_fixas_excecoes WHERE conta_fixa_id = 9101 AND ocorrencia = 2),
  1::BIGINT,
  'retry mantém uma única exceção'
);

SELECT throws_ok(
  $$INSERT INTO public.despesas (
      family_id, user_id, conta_fixa_id, descricao, categoria, valor,
      parcela_atual, parcela_total, vencimento, status, titular_id, competencia
    ) VALUES (
      'e1000000-0000-4000-8000-000000000000',
      'e1000000-0000-4000-8000-000000000001',
      9101, 'Ocorrência ignorada', 'Teste', 25,
      2, 6, '2026-10-10', 'Em aberto', 9101, '10/2026'
    )$$,
  '55000',
  'A ocorrência foi ignorada e não pode ser materializada.',
  'ocorrência ignorada não pode ser materializada'
);

SELECT lives_ok(
  $$INSERT INTO public.despesas (
      family_id, user_id, conta_fixa_id, descricao, categoria, valor,
      parcela_atual, parcela_total, vencimento, status, titular_id, competencia
    ) VALUES (
      'e1000000-0000-4000-8000-000000000000',
      'e1000000-0000-4000-8000-000000000001',
      9101, 'Ocorrência preservada', 'Teste', 25,
      3, 6, '2026-11-10', 'Pago', 9101, '11/2026'
    )$$,
  'outra ocorrência ativa continua materializável'
);

SELECT lives_ok(
  $$SELECT public.encerrar_conta_fixa_desde(9101, 4, 'cancelado')$$,
  'responsável encerra a série a partir de uma ocorrência'
);

SELECT ok(
  (SELECT
    status = 'cancelado'
    AND encerrada_a_partir_da_ocorrencia = 4
    AND encerrada_em IS NOT NULL
    AND encerrada_por = 'e1000000-0000-4000-8000-000000000001'
   FROM public.contas_fixas WHERE id = 9101),
  'corte registra estado, número, instante e responsável'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas WHERE conta_fixa_id = 9101 AND parcela_atual = 3),
  1::BIGINT,
  'ocorrência anterior ao corte permanece vinculada'
);

SELECT throws_ok(
  $$INSERT INTO public.despesas (
      family_id, user_id, conta_fixa_id, descricao, categoria, valor,
      parcela_atual, parcela_total, vencimento, status, titular_id, competencia
    ) VALUES (
      'e1000000-0000-4000-8000-000000000000',
      'e1000000-0000-4000-8000-000000000001',
      9101, 'Ocorrência cortada', 'Teste', 25,
      4, 6, '2026-12-10', 'Em aberto', 9101, '12/2026'
    )$$,
  '55000',
  'A ocorrência está fora do período ativo da recorrência.',
  'ocorrência no ponto de corte não pode ser materializada'
);

SELECT throws_ok(
  $$SELECT public.encerrar_conta_fixa_desde(9101, 5, 'cancelado')$$,
  '55000',
  'Uma recorrência encerrada não pode mudar seu ponto de corte.',
  'ponto de corte terminal não pode ser alterado'
);

SELECT throws_ok(
  $$SELECT public.ignorar_ocorrencia_conta_fixa(9201, 1)$$,
  '23503',
  'A recorrência informada não pertence à família autenticada.',
  'não é possível ignorar ocorrência de outra família'
);

SELECT throws_ok(
  $$SELECT public.encerrar_conta_fixa_desde(9201, 1, 'cancelado')$$,
  '23503',
  'A recorrência informada não pertence à família autenticada.',
  'não é possível encerrar ocorrência de outra família'
);

SELECT throws_ok(
  $$SELECT public.ignorar_ocorrencia_conta_fixa(9101, 7)$$,
  '22023',
  'Número de ocorrência inválido para a recorrência.',
  'exceção fora do total contratado é recusada'
);

SELECT throws_ok(
  $$SELECT public.encerrar_conta_fixa_desde(9102, 0, 'cancelado')$$,
  '22023',
  'Número de ocorrência inválido para o encerramento.',
  'ponto de corte zero é recusado'
);

SELECT lives_ok(
  $$SELECT public.encerrar_conta_fixa(9102, 'cancelado')$$,
  'comando de série inteira permanece compatível'
);

SELECT is(
  (SELECT encerrada_a_partir_da_ocorrencia FROM public.contas_fixas WHERE id = 9102),
  1,
  'encerrar a série inteira usa a primeira ocorrência como corte'
);

SELECT throws_ok(
  $$UPDATE public.contas_fixas
    SET encerrada_a_partir_da_ocorrencia = 2
    WHERE id = 9102$$,
  'P0001',
  'O ciclo de vida da recorrência só pode ser alterado pelo comando de encerramento.',
  'ponto de corte não pode ser alterado diretamente'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.contas_fixas WHERE id IN (9101, 9102)),
  2::BIGINT,
  'os dois comandos preservam os mestres'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
