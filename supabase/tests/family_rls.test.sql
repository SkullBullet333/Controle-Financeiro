BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

INSERT INTO auth.users (id, email)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member@example.test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'outsider@example.test');

UPDATE public.profiles
SET family_id = '11111111-1111-4111-8111-111111111111', tipo = 'titular'
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

UPDATE public.profiles
SET family_id = '11111111-1111-4111-8111-111111111111', tipo = 'membro'
WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

UPDATE public.profiles
SET family_id = '22222222-2222-4222-8222-222222222222', tipo = 'titular'
WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

INSERT INTO public.despesas (
  family_id, user_id, descricao, valor, vencimento, competencia
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Despesa do titular', 100, '2026-09-10', '09/2026'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Despesa do membro', 50, '2026-09-11', '09/2026'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Despesa externa', 75, '2026-09-12', '09/2026'
  );

SELECT set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::BIGINT FROM public.despesas),
  2::BIGINT,
  'membro enxerga somente os lançamentos da própria família'
);

SELECT lives_ok(
  $$UPDATE public.despesas SET descricao = 'Alteração indevida' WHERE descricao = 'Despesa do titular'$$,
  'atualização de linha alheia é filtrada pela RLS'
);

RESET ROLE;
SELECT is(
  (SELECT descricao FROM public.despesas WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Despesa do titular',
  'membro não altera lançamento do titular'
);

SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$UPDATE public.despesas SET descricao = 'Despesa própria atualizada' WHERE user_id = auth.uid()$$,
  'membro pode alterar o próprio lançamento'
);

RESET ROLE;
SELECT is(
  (SELECT descricao FROM public.despesas WHERE user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'Despesa própria atualizada',
  'alteração do próprio lançamento é persistida'
);

SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$DELETE FROM public.despesas WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'exclusão de linha alheia é filtrada pela RLS'
);

RESET ROLE;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.despesas
    WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'membro não exclui lançamento do titular'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.despesas (family_id, user_id, descricao, valor, vencimento, competencia)
    VALUES (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Linha em nome do titular', 10, '2026-09-13', '09/2026'
    )$$,
  '42501',
  'new row violates row-level security policy for table "despesas"',
  'membro não cria lançamento em nome de outra pessoa'
);

SELECT throws_ok(
  $$INSERT INTO public.convites (family_id, email)
    VALUES ('11111111-1111-4111-8111-111111111111', 'unauthorized@example.test')$$,
  '42501',
  'new row violates row-level security policy for table "convites"',
  'membro não cria convite'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET tipo = 'titular' WHERE id = auth.uid()$$,
  'P0001',
  'Campos de segurança do perfil não podem ser alterados diretamente.',
  'membro não promove o próprio papel'
);

SELECT throws_ok(
  $$UPDATE public.profiles
    SET family_id = '22222222-2222-4222-8222-222222222222'
    WHERE id = auth.uid()$$,
  'P0001',
  'Campos de segurança do perfil não podem ser alterados diretamente.',
  'membro não troca a própria família'
);

SELECT lives_ok(
  $$UPDATE public.profiles SET nome = 'Nome permitido', theme_mode = 'dark' WHERE id = auth.uid()$$,
  'membro pode editar campos pessoais permitidos'
);

SELECT lives_ok(
  $$DELETE FROM public.profiles WHERE id = auth.uid()$$,
  'exclusão direta do perfil é filtrada pela RLS'
);

RESET ROLE;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      AND nome = 'Nome permitido'
      AND theme_mode = 'dark'
  ),
  'perfil permanece existente após edição pessoal'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$INSERT INTO public.convites (family_id, email)
    VALUES ('11111111-1111-4111-8111-111111111111', 'invited@example.test')$$,
  'titular pode criar convite para a própria família'
);

SELECT lives_ok(
  $$UPDATE public.despesas SET descricao = 'Administrada pelo titular'
    WHERE user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  'titular pode administrar lançamento de membro da família'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  true
);

SELECT is(
  (SELECT count(*)::BIGINT
   FROM public.despesas
   WHERE family_id = '11111111-1111-4111-8111-111111111111'),
  0::BIGINT,
  'usuário externo não enxerga dados de outra família'
);

SELECT * FROM finish();

ROLLBACK;
