import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('carregamento das visões', () => {
  it('divide as telas secundárias sem atrasar o Dashboard inicial', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain("import { DashboardView } from '@/components/dashboard'");
    for (const view of ['DespesasReceitasView', 'CartoesView', 'RadarFinanceiroView', 'SettingsView']) {
      expect(source).toContain(`const ${view} = dynamic(`);
    }
    expect(source).toContain('role="status"');
    expect(source).not.toMatch(/import\s+\{\s*(DespesasReceitasView|CartoesView|RadarFinanceiroView|SettingsView)\s*\}\s+from/);
  });
});
