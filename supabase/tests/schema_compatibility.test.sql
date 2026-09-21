BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(4);

SELECT has_column(
  'public',
  'cartoes_config',
  'final',
  'cartões possuem o campo canônico final'
);

SELECT has_column(
  'public',
  'cartoes_config',
  'color',
  'cartões possuem cor de apresentação'
);

SELECT has_column(
  'public',
  'cartoes_config',
  'icone',
  'cartões possuem ícone de apresentação'
);

SELECT col_type_is(
  'public',
  'cartoes_config',
  'final',
  'text',
  'final usa o tipo textual esperado pela aplicação'
);

SELECT * FROM finish();

ROLLBACK;

