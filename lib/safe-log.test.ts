import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { reportOperationFailure } from './safe-log';

describe('observabilidade financeira sem dados sensíveis', () => {
  it('registra somente operação e código conhecido', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const error = { code: '23503', message: 'Cartão da pessoa X', details: 'valor=1234' };
      reportOperationFailure('card_delete', error);
      expect(spy).toHaveBeenCalledWith('[finance-operation]', {
        operation: 'card_delete', code: '23503', kind: 'unknown',
      });
      expect(JSON.stringify(spy.mock.calls)).not.toContain('Cartão da pessoa X');
      expect(JSON.stringify(spy.mock.calls)).not.toContain('1234');
    } finally {
      spy.mockRestore();
    }
  });

  it('não inclui códigos arbitrários vindos da resposta', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      reportOperationFailure('load', { code: 'email@exemplo.com', message: 'segredo' });
      expect(spy).toHaveBeenCalledWith('[finance-operation]', {
        operation: 'load', code: 'unknown', kind: 'unknown',
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('classifica somente sinais técnicos conhecidos', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      reportOperationFailure('load', new Error('permission denied for table despesas'));
      expect(spy).toHaveBeenCalledWith('[finance-operation]', {
        operation: 'load', code: 'unknown', kind: 'permission_denied',
      });
      expect(JSON.stringify(spy.mock.calls)).not.toContain('despesas');
    } finally {
      spy.mockRestore();
    }
  });

  it('não registra objetos de erro brutos nos fluxos financeiros principais', () => {
    for (const path of ['../hooks/use-finance.ts', './finance-service.ts', '../components/modals.tsx']) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source).not.toMatch(/console\.(?:error|warn|log)\([^\n]*(?:error|err|\.message)/i);
    }
  });
});
