-- Ensure every business relationship stays inside the same family.
-- Existing exports were checked before this migration and contain no
-- cross-family references.

CREATE UNIQUE INDEX IF NOT EXISTS ux_titulares_family_id_id
  ON public.titulares (family_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cartoes_config_family_id_id
  ON public.cartoes_config (family_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_emprestimos_family_id_id
  ON public.emprestimos (family_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_contas_fixas_family_id_id
  ON public.contas_fixas (family_id, id);

ALTER TABLE public.cartoes_config
  DROP CONSTRAINT IF EXISTS cartoes_config_titular_id_fkey,
  ADD CONSTRAINT cartoes_config_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.emprestimos
  DROP CONSTRAINT IF EXISTS emprestimos_titular_id_fkey,
  ADD CONSTRAINT emprestimos_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE SET NULL (titular_id)
    NOT VALID;

ALTER TABLE public.contas_fixas
  DROP CONSTRAINT IF EXISTS contas_fixas_titular_id_fkey,
  DROP CONSTRAINT IF EXISTS contas_fixas_cartao_id_fkey,
  ADD CONSTRAINT contas_fixas_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE SET NULL (titular_id)
    NOT VALID,
  ADD CONSTRAINT contas_fixas_family_cartao_fkey
    FOREIGN KEY (family_id, cartao_id)
    REFERENCES public.cartoes_config (family_id, id)
    ON DELETE SET NULL (cartao_id)
    NOT VALID;

ALTER TABLE public.cartoes
  DROP CONSTRAINT IF EXISTS cartoes_cartao_id_fkey,
  DROP CONSTRAINT IF EXISTS cartoes_titular_id_fkey,
  ADD CONSTRAINT cartoes_family_cartao_fkey
    FOREIGN KEY (family_id, cartao_id)
    REFERENCES public.cartoes_config (family_id, id)
    ON DELETE CASCADE
    NOT VALID,
  ADD CONSTRAINT cartoes_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.despesas
  DROP CONSTRAINT IF EXISTS despesas_emprestimo_id_fkey,
  DROP CONSTRAINT IF EXISTS despesas_conta_fixa_id_fkey,
  DROP CONSTRAINT IF EXISTS despesas_titular_id_fkey,
  ADD CONSTRAINT despesas_family_emprestimo_fkey
    FOREIGN KEY (family_id, emprestimo_id)
    REFERENCES public.emprestimos (family_id, id)
    ON DELETE SET NULL (emprestimo_id)
    NOT VALID,
  ADD CONSTRAINT despesas_family_conta_fixa_fkey
    FOREIGN KEY (family_id, conta_fixa_id)
    REFERENCES public.contas_fixas (family_id, id)
    ON DELETE SET NULL (conta_fixa_id)
    NOT VALID,
  ADD CONSTRAINT despesas_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.receitas
  DROP CONSTRAINT IF EXISTS receitas_titular_id_fkey,
  DROP CONSTRAINT IF EXISTS receitas_conta_fixa_id_fkey,
  ADD CONSTRAINT receitas_family_titular_fkey
    FOREIGN KEY (family_id, titular_id)
    REFERENCES public.titulares (family_id, id)
    ON DELETE CASCADE
    NOT VALID,
  ADD CONSTRAINT receitas_family_conta_fixa_fkey
    FOREIGN KEY (family_id, conta_fixa_id)
    REFERENCES public.contas_fixas (family_id, id)
    ON DELETE SET NULL (conta_fixa_id)
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
  VALIDATE CONSTRAINT despesas_family_emprestimo_fkey,
  VALIDATE CONSTRAINT despesas_family_conta_fixa_fkey,
  VALIDATE CONSTRAINT despesas_family_titular_fkey;
ALTER TABLE public.receitas
  VALIDATE CONSTRAINT receitas_family_titular_fkey,
  VALIDATE CONSTRAINT receitas_family_conta_fixa_fkey;

