// Logs operacionais não podem receber objetos de erro inteiros: respostas do
// banco podem conter valores de lançamentos, SQL e identificadores de pessoas.
const SAFE_CODE = /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/;
const SAFE_FAILURE_KINDS = [
  ['permission denied', 'permission_denied'],
  ['schema cache', 'schema_cache'],
  ['failed to fetch', 'network_failure'],
  ['jwt expired', 'session_expired'],
  ['invalid jwt', 'invalid_session'],
] as const;

function classifyFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  const message = error.message.toLowerCase();
  return SAFE_FAILURE_KINDS.find(([needle]) => message.includes(needle))?.[1] ?? 'unknown';
}

export function reportOperationFailure(operation: string, error: unknown): void {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
  console.error('[finance-operation]', {
    operation,
    code: typeof code === 'string' && SAFE_CODE.test(code) ? code : 'unknown',
    kind: classifyFailure(error),
  });
}
