-- Reconcile card presentation fields found in the production data export.
-- The legacy remote schema contains a quoted "Final" column; keep it intact for
-- rollback compatibility while copying its value into the canonical `final`.

ALTER TABLE public.cartoes_config
  ADD COLUMN IF NOT EXISTS final TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS icone TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cartoes_config'
      AND column_name = 'Final'
  ) THEN
    EXECUTE 'UPDATE public.cartoes_config SET final = COALESCE(final, "Final") WHERE final IS NULL';
  END IF;
END $$;

COMMENT ON COLUMN public.cartoes_config.final IS
  'Últimos dígitos do cartão; substitui gradualmente a coluna legada "Final".';
COMMENT ON COLUMN public.cartoes_config.color IS
  'Cor escolhida para apresentação visual do cartão.';
COMMENT ON COLUMN public.cartoes_config.icone IS
  'URL ou referência visual do ícone do cartão.';

