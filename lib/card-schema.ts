// O backup legado usa a coluna citada "Final"; a migration local acrescenta
// `final`. Cada tentativa é uma gravação única, nunca uma sequência parcial.
export function legacyCardPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const { final, ...rest } = payload;
  return final === undefined ? rest : { ...rest, Final: final };
}

export function isMissingCardColumn(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST204' || error?.code === '42703';
}

export async function persistCardWithLegacyRetry<T extends { error: { code?: string } | null }>(
  payload: Record<string, unknown>,
  write: (value: Record<string, unknown>) => PromiseLike<T>,
  onLegacyRetry?: (error: { code?: string }) => void,
): Promise<T> {
  const result = await write(payload);
  if (!result.error || !isMissingCardColumn(result.error)) return result;
  onLegacyRetry?.(result.error);
  return write(legacyCardPayload(payload));
}
