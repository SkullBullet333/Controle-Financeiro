import { describe, expect, it, vi } from 'vitest';
import { isMissingCardColumn, legacyCardPayload, persistCardWithLegacyRetry } from './card-schema';

describe('compatibilidade atômica dos cartões', () => {
  it('mapeia somente a coluna final e preserva valores vazios explícitos', () => {
    expect(legacyCardPayload({ nome_cartao: 'Teste', final: null, color: '#123456', icone: null })).toEqual({
      nome_cartao: 'Teste', Final: null, color: '#123456', icone: null,
    });
    expect(legacyCardPayload({ nome_cartao: 'Teste' })).toEqual({ nome_cartao: 'Teste' });
  });

  it('só permite retry quando o servidor indica coluna inexistente', () => {
    expect(isMissingCardColumn({ code: 'PGRST204' })).toBe(true);
    expect(isMissingCardColumn({ code: '42703' })).toBe(true);
    expect(isMissingCardColumn({ code: '23503' })).toBe(false);
    expect(isMissingCardColumn({ code: '42501' })).toBe(false);
  });

  it('faz uma única gravação quando o schema canônico aceita o cartão', async () => {
    const payload = { nome_cartao: 'Teste', final: '1234', color: '#123456' };
    const write = vi.fn().mockResolvedValue({ error: null, data: [{ id: 1 }] });
    const retry = vi.fn();

    expect(await persistCardWithLegacyRetry(payload, write, retry)).toEqual({ error: null, data: [{ id: 1 }] });
    expect(write).toHaveBeenCalledExactlyOnceWith(payload);
    expect(retry).not.toHaveBeenCalled();
  });

  it('refaz a operação inteira uma vez quando falta a coluna canônica', async () => {
    const payload = { nome_cartao: 'Teste', final: '1234', color: '#123456', icone: null };
    const missing = { code: 'PGRST204' };
    const write = vi.fn()
      .mockResolvedValueOnce({ error: missing })
      .mockResolvedValueOnce({ error: null, data: [{ id: 2, Final: '1234' }] });
    const retry = vi.fn();

    expect(await persistCardWithLegacyRetry(payload, write, retry)).toEqual({ error: null, data: [{ id: 2, Final: '1234' }] });
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, payload);
    expect(write).toHaveBeenNthCalledWith(2, { nome_cartao: 'Teste', Final: '1234', color: '#123456', icone: null });
    expect(retry).toHaveBeenCalledExactlyOnceWith(missing);
  });

  it('propaga falhas de permissão sem retry', async () => {
    const error = { code: '42501' };
    const write = vi.fn().mockResolvedValue({ error });
    const retry = vi.fn();

    expect(await persistCardWithLegacyRetry({ final: '1234' }, write, retry)).toEqual({ error });
    expect(write).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it('não esconde a falha da tentativa legada', async () => {
    const error = { code: '23503' };
    const write = vi.fn()
      .mockResolvedValueOnce({ error: { code: '42703' } })
      .mockResolvedValueOnce({ error });

    expect(await persistCardWithLegacyRetry({ final: null }, write)).toEqual({ error });
    expect(write).toHaveBeenCalledTimes(2);
  });
});
