// Snapshots financeiros existem apenas enquanto a aba está aberta. O banco
// continua sendo a fonte de verdade; cada restauração é seguida de um fetch.
const MAX_WINDOWS = 6;
const snapshots = new Map<string, unknown>();

export function financialCacheKey(userId: string, windowKey: string): string {
  return `fin_cache_${userId}_${windowKey}`;
}

export function getFinancialCache<T>(key: string): T | null {
  if (!snapshots.has(key)) return null;
  const snapshot = snapshots.get(key) as T;
  snapshots.delete(key);
  snapshots.set(key, snapshot);
  return snapshot;
}

export function setFinancialCache<T>(key: string, snapshot: T): void {
  snapshots.delete(key);
  snapshots.set(key, snapshot);
  while (snapshots.size > MAX_WINDOWS) {
    const oldestKey = snapshots.keys().next().value;
    if (oldestKey === undefined) break;
    snapshots.delete(oldestKey);
  }
}

export function clearFinancialCache(): void {
  snapshots.clear();
}

type LegacyStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>;

// Remove apenas snapshots antigos criados por versões anteriores. Não lê nem
// descompacta seus valores e preserva preferências de tema e outros dados.
export function purgeLegacyFinancialCache(storage?: LegacyStorage): number {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return 0;
    const keys: string[] = [];
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index);
      if (key?.startsWith('fin_cache_')) keys.push(key);
    }
    keys.forEach(key => target.removeItem(key));
    return keys.length;
  } catch {
    console.warn('[Cache] Não foi possível limpar snapshots financeiros antigos.');
    return 0;
  }
}
