-- Administrative records may only be deleted while they have no financial use.
-- Keeping the same-family foreign keys prevents orphaned attribution and protects
-- the historical ledger from implicit CASCADE or SET NULL side effects.

BEGIN;

ALTER TABLE public.cartoes_config
  DROP CONSTRAINT IF EXISTS cartoes_config_family_titular_fkey,
  ADD CONSTRAINT cartoes_config_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.emprestimos
  DROP CONSTRAINT IF EXISTS emprestimos_family_titular_fkey,
  ADD CONSTRAINT emprestimos_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.contas_fixas
  DROP CONSTRAINT IF EXISTS contas_fixas_family_titular_fkey,
  DROP CONSTRAINT IF EXISTS contas_fixas_family_cartao_fkey,
  ADD CONSTRAINT contas_fixas_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE RESTRICT
    NOT VALID,
  ADD CONSTRAINT contas_fixas_family_cartao_fkey
    FOREIGN KEY (family_id, cartao_id)
    REFERENCES public.cartoes_config (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.cartoes
  DROP CONSTRAINT IF EXISTS cartoes_family_cartao_fkey,
  DROP CONSTRAINT IF EXISTS cartoes_family_titular_fkey,
  ADD CONSTRAINT cartoes_family_cartao_fkey
    FOREIGN KEY (family_id, cartao_id)
    REFERENCES public.cartoes_config (family_id, id)
    ON DELETE RESTRICT
    NOT VALID,
  ADD CONSTRAINT cartoes_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.despesas
  DROP CONSTRAINT IF EXISTS despesas_family_titular_fkey,
  ADD CONSTRAINT despesas_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.receitas
  DROP CONSTRAINT IF EXISTS receitas_family_titular_fkey,
  ADD CONSTRAINT receitas_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.cartoes_config
  VALIDATE CONSTRAINT cartoes_config_family_titular_fkey;
ALTER TABLE public.emprestimos
  VALIDATE CONSTRAINT emprestimos_family_titular_fkey;
ALTER TABLE public.contas_fixas
  VALIDATE CONSTRAINT contas_fixas_family_titular_fkey,
  VALIDATE CONSTRAINT contas_fixas_family_cartao_fkey;
ALTER TABLE public.cartoes
  VALIDATE CONSTRAINT cartoes_family_cartao_fkey,
  VALIDATE CONSTRAINT cartoes_family_titular_fkey;
ALTER TABLE public.despesas
  VALIDATE CONSTRAINT despesas_family_titular_fkey;
ALTER TABLE public.receitas
  VALIDATE CONSTRAINT receitas_family_titular_fkey;

COMMIT;
