import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./migrations/20260920000000_atomic_category_updates.sql', import.meta.url), 'utf8');
const pgTap = readFileSync(new URL('./tests/atomic_category_updates.test.sql', import.meta.url), 'utf8');

describe('contrato das operações atômicas de categoria', () => {
  it('é uma migration local transacional', () => {
    expect(migration).toContain('BEGIN;');
    expect(migration).toContain('COMMIT;');
  });

  it('restringe acesso e usa RLS do usuário autenticado', () => {
    expect(migration.match(/^SECURITY INVOKER$/gm)).toHaveLength(2);
    expect(migration.match(/auth\.uid\(\) IS NULL/g)).toHaveLength(2);
    expect(migration.match(/REVOKE ALL ON FUNCTION/g)).toHaveLength(2);
    expect(migration.match(/GRANT EXECUTE ON FUNCTION/g)).toHaveLength(2);
  });

  it('atualiza cada tabela uma vez, sem coluna inexistente em cartões', () => {
    expect(migration.match(/UPDATE public\.despesas/g)).toHaveLength(2);
    expect(migration.match(/UPDATE public\.contas_fixas/g)).toHaveLength(2);
    expect(migration.match(/UPDATE public\.cartoes/g)).toHaveLength(2);
    expect(migration).toContain('lower(estabelecimento) = lower(v_descricao)');
    for (const section of migration.split('UPDATE public.cartoes').slice(1)) {
      expect(section.split('GET DIAGNOSTICS v_cartoes')[0]).not.toContain('lower(descricao)');
    }
  });

  it('inclui ensaio de isolamento familiar e reversão quando a última tabela falha', () => {
    expect(pgTap).toContain('throws_ok(');
    expect(pgTap).toContain('outra família não é alterada');
    expect(pgTap).toContain('ROLLBACK;');
  });
});
