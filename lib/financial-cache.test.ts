import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFinancialCache,
  financialCacheKey,
  getFinancialCache,
  purgeLegacyFinancialCache,
  setFinancialCache,
} from './financial-cache';

beforeEach(() => clearFinancialCache());

describe('cache financeiro efêmero', () => {
  it('isola usuário e janela sem gravar no armazenamento persistente', () => {
    const first = financialCacheKey('usuario-a', '01-2026_06-2026');
    const second = financialCacheKey('usuario-b', '01-2026_06-2026');
    setFinancialCache(first, { total: 1 });

    expect(getFinancialCache<{ total: number }>(first)).toEqual({ total: 1 });
    expect(getFinancialCache(second)).toBeNull();
  });

  it('mantém somente as seis janelas usadas mais recentemente', () => {
    for (let index = 0; index < 6; index++) setFinancialCache(`janela-${index}`, index);
    expect(getFinancialCache<number>('janela-0')).toBe(0);
    setFinancialCache('janela-6', 6);

    expect(getFinancialCache('janela-1')).toBeNull();
    expect(getFinancialCache<number>('janela-0')).toBe(0);
  });

  it('descarta todos os snapshots ao sair ou trocar de usuário', () => {
    setFinancialCache('uma-janela', { total: 1 });
    clearFinancialCache();

    expect(getFinancialCache('uma-janela')).toBeNull();
  });

  it('remove apenas snapshots persistidos por versões anteriores', () => {
    const values = new Map([
      ['fin_cache_usuario_01-2026_06-2026', 'dados-antigos'],
      ['fin_cache_outro_02-2026_07-2026', 'dados-antigos'],
      ['fin_theme_color_usuario', '#123456'],
      ['outra_chave', 'preservada'],
    ]);
    const storage = {
      get length() { return values.size; },
      key(index: number) { return [...values.keys()][index] ?? null; },
      removeItem(key: string) { values.delete(key); },
    };

    expect(purgeLegacyFinancialCache(storage)).toBe(2);
    expect([...values.keys()]).toEqual(['fin_theme_color_usuario', 'outra_chave']);
  });
});
