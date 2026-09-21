BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

SELECT col_type_is(
  'public', 'cartoes', 'conta_fixa_id', 'bigint',
  'compra materializada referencia a recorrência'
);

SELECT col_type_is(
  'public', 'cartoes', 'conta_fixa_parcela', 'integer',
  'compra materializada identifica a ocorrência'
);

SELECT is(
  (SELECT confdeltype::TEXT FROM pg_constraint WHERE conname = 'cartoes_family_conta_fixa_fkey'),
  'r',
  'histórico de cartão impede apagar a recorrência mestre'
);

SELECT ok(
  (SELECT indisunique FROM pg_index WHERE indexrelid = 'public.ux_cartoes_family_fixed_occurrence'::regclass),
  'cada ocorrência da recorrência possui uma única compra materializada'
);

SELECT has_function(
  'public',
  'materializar_ocorrencia_cartao',
  ARRAY['bigint', 'integer', 'date', 'numeric', 'text', 'text'],
  'RPC estrutural de recorrência de cartão existe'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.materializar_ocorrencia_cartao(bigint,integer,date,numeric,text,text)',
    'EXECUTE'
  ),
  'anon não executa a RPC de recorrência'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.materializar_ocorrencia_cartao(bigint,integer,date,numeric,text,text)',
    'EXECUTE'
  ),
  'usuário autenticado executa a RPC de recorrência'
);

INSERT INTO auth.users (id, email)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'card-recurrence-owner@example.test'),
  ('c2000000-0000-4000-8000-000000000001', 'card-recurrence-outsider@example.test');

UPDATE public.profiles
SET family_id = 'c1000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'c1000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET family_id = 'c2000000-0000-4000-8000-000000000000', tipo = 'titular'
WHERE id = 'c2000000-0000-4000-8000-000000000001';

INSERT INTO public.titulares (id, family_id, user_id, nome)
VALUES
  (7101, 'c1000000-0000-4000-8000-000000000000', 'c1000000-0000-4000-8000-000000000001', 'Titular Recorrência'),
  (7201, 'c2000000-0000-4000-8000-000000000000', 'c2000000-0000-4000-8000-000000000001', 'Titular Externo');

INSERT INTO public.cartoes_config (
  id, family_id, user_id, nome_cartao, titular_id, dia_vencimento, dia_fechamento
)
VALUES
  (7101, 'c1000000-0000-4000-8000-000000000000', 'c1000000-0000-4000-8000-000000000001', 'Cartão Recorrência', 7101, 10, 5),
  (7201, 'c2000000-0000-4000-8000-000000000000', 'c2000000-0000-4000-8000-000000000001', 'Cartão Externo', 7201, 10, 5);

INSERT INTO public.contas_fixas (
  id, family_id, user_id, descricao, valor_mensal, total_parcelas,
  parcela_atual, data_inicio, competencia_inicial, titular_id,
  categoria, tipo, cartao_id
)
VALUES
  (7101, 'c1000000-0000-4000-8000-000000000000', 'c1000000-0000-4000-8000-000000000001', 'Assinatura estrutural', 30, NULL, 1, '2026-09-05', '09/2026', 7101, 'Assinaturas', 'despesa', 7101),
  (7201, 'c2000000-0000-4000-8000-000000000000', 'c2000000-0000-4000-8000-000000000001', 'Assinatura externa', 40, NULL, 1, '2026-09-05', '09/2026', 7201, 'Assinaturas', 'despesa', 7201);

SELECT set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT public.materializar_ocorrencia_cartao(
    7101, 2, '2026-10-05', 31, 'Assinatura ajustada', 'Serviços'
  )$$,
  'uma ocorrência válida é materializada'
);

SELECT ok(
  (SELECT
    family_id = 'c1000000-0000-4000-8000-000000000000'
    AND user_id = 'c1000000-0000-4000-8000-000000000001'
    AND cartao_id = 7101
    AND titular_id = 7101
    AND conta_fixa_id = 7101
    AND conta_fixa_parcela = 2
    AND competencia = '10/2026'
  FROM public.cartoes
  WHERE conta_fixa_id = 7101 AND conta_fixa_parcela = 2),
  'família, autor, cartão, titular e ocorrência são derivados estruturalmente'
);

SELECT lives_ok(
  $$SELECT public.materializar_ocorrencia_cartao(
    7101, 2, '2026-10-05', 32, 'Assinatura reajustada', 'Serviços'
  )$$,
  'repetir a materialização atualiza a ocorrência sem duplicar'
);

SELECT is(
  (SELECT count(*)::BIGINT FROM public.cartoes WHERE conta_fixa_id = 7101 AND conta_fixa_parcela = 2),
  1::BIGINT,
  'retry mantém uma única ocorrência materializada'
);

SELECT is(
  (SELECT valor FROM public.cartoes WHERE conta_fixa_id = 7101 AND conta_fixa_parcela = 2),
  32.00::NUMERIC,
  'a edição da ocorrência atualiza seu valor'
);

SELECT throws_ok(
  $$SELECT public.materializar_ocorrencia_cartao(
    7101, 0, '2026-09-05', 30, NULL, NULL
  )$$,
  '22023',
  'Número de ocorrência inválido para a recorrência.',
  'ocorrência inválida é recusada'
);

SELECT throws_ok(
  $$SELECT public.materializar_ocorrencia_cartao(
    7201, 1, '2026-09-05', 40, NULL, NULL
  )$$,
  '23503',
  'A recorrência de cartão informada não pertence à família autenticada.',
  'recorrência de outra família é recusada'
);

SELECT throws_ok(
  $$INSERT INTO public.cartoes (
      family_id, user_id, cartao_id, estabelecimento, valor,
      parcela_atual, parcela_total, data_compra, competencia,
      titular_id, conta_fixa_id, conta_fixa_parcela
    ) VALUES (
      'c1000000-0000-4000-8000-000000000000',
      'c1000000-0000-4000-8000-000000000001',
      7101, 'Duplicada', 30, 2, 2, '2026-10-05', '10/2026',
      7101, 7101, 2
    )$$,
  '23505',
  'duplicate key value violates unique constraint "ux_cartoes_family_fixed_occurrence"',
  'uma segunda linha para a mesma ocorrência é recusada'
);

SELECT throws_ok(
  $$UPDATE public.cartoes
    SET conta_fixa_parcela = 3
    WHERE conta_fixa_id = 7101 AND conta_fixa_parcela = 2$$,
  'P0001',
  'A identidade da recorrência de cartão é imutável.',
  'o vínculo estrutural não pode ser alterado'
);

SELECT throws_ok(
  $$DELETE FROM public.contas_fixas WHERE id = 7101$$,
  'P0001',
  'Recorrências devem ser encerradas, não excluídas.',
  'a série com histórico materializado deve ser encerrada, não apagada'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
