export interface PendingCreationOperation {
  fingerprint: string;
  id: string;
}

export function resolveCreationOperation(
  previous: PendingCreationOperation | null,
  payload: unknown,
  createId: () => string = () => globalThis.crypto.randomUUID()
): PendingCreationOperation {
  const fingerprint = JSON.stringify(payload);

  if (previous?.fingerprint === fingerprint) {
    return previous;
  }

  return {
    fingerprint,
    id: createId(),
  };
}

