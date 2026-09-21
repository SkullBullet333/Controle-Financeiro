import { describe, expect, it } from 'vitest';

import { resolveCreationOperation } from './idempotency';

describe('resolveCreationOperation', () => {
  it('reutiliza a chave quando o mesmo formulário é reenviado', () => {
    const first = resolveCreationOperation(null, { tipo: 'despesa', valor: 100 }, () => 'op-1');
    const retry = resolveCreationOperation(first, { tipo: 'despesa', valor: 100 }, () => 'op-2');

    expect(retry).toBe(first);
    expect(retry.id).toBe('op-1');
  });

  it('cria outra chave quando o conteúdo é alterado', () => {
    const first = resolveCreationOperation(null, { tipo: 'despesa', valor: 100 }, () => 'op-1');
    const changed = resolveCreationOperation(first, { tipo: 'despesa', valor: 101 }, () => 'op-2');

    expect(changed.id).toBe('op-2');
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it('diferencia tipos financeiros com os mesmos campos', () => {
    const first = resolveCreationOperation(null, { tipo: 'despesa', valor: 100 }, () => 'op-1');
    const changed = resolveCreationOperation(first, { tipo: 'receita', valor: 100 }, () => 'op-2');

    expect(changed.id).toBe('op-2');
  });
});

