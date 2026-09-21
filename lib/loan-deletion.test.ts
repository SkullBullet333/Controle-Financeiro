import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, remove, byId } = vi.hoisted(() => ({
  from: vi.fn(),
  remove: vi.fn(),
  byId: vi.fn(),
}));

vi.mock('./supabase', () => ({ supabase: { from } }));

import { deletarEmprestimo } from './finance-service';

describe('exclusão atômica de empréstimo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ delete: remove });
    remove.mockReturnValue({ eq: byId });
    byId.mockResolvedValue({ error: null });
  });

  it('usa somente o DELETE; a FK desvincula as despesas na mesma transação', async () => {
    await expect(deletarEmprestimo(42)).resolves.toEqual({ success: true });

    expect(from).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith('emprestimos');
    expect(remove).toHaveBeenCalledOnce();
    expect(byId).toHaveBeenCalledOnce();
    expect(byId).toHaveBeenCalledWith('id', 42);

    const baseline = readFileSync(new URL('../supabase/migrations/20260401000000_consolidated_schema.sql', import.meta.url), 'utf8');
    const familyKeys = readFileSync(new URL('../supabase/migrations/20260912020000_same_family_foreign_keys.sql', import.meta.url), 'utf8');
    expect(baseline).toMatch(/emprestimo_id BIGINT REFERENCES public\.emprestimos\(id\) ON DELETE SET NULL/);
    expect(familyKeys).toMatch(/REFERENCES public\.emprestimos \(family_id, id\)\s+ON DELETE SET NULL \(emprestimo_id\)/);
  });

  it('propaga a falha sem declarar a exclusão como concluída', async () => {
    const error = { code: '23503' };
    byId.mockResolvedValue({ error });

    await expect(deletarEmprestimo(42)).rejects.toBe(error);
    expect(from).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith('emprestimos');
  });
});
