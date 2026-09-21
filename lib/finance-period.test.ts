import { describe, expect, it, vi } from 'vitest';
import {
  carregarTodasPaginas,
  chaveJanelaFinanceira,
  criarJanelaCompetencias,
  deveAbrirProximoMesQuandoQuitado,
} from './finance-period';

describe('janela de dados financeiros', () => {
  it('cria seis competências a partir do período selecionado atravessando o ano', () => {
    expect(criarJanelaCompetencias(10, 2026)).toEqual([
      '10/2026',
      '11/2026',
      '12/2026',
      '01/2027',
      '02/2027',
      '03/2027',
    ]);
  });

  it('permite uma janela de doze competências para o gráfico anual', () => {
    expect(criarJanelaCompetencias(10, 2026, 12)).toEqual([
      '10/2026', '11/2026', '12/2026', '01/2027', '02/2027', '03/2027',
      '04/2027', '05/2027', '06/2027', '07/2027', '08/2027', '09/2027',
    ]);
  });

  it('avança somente ao abrir o mês atual com despesas integralmente pagas', () => {
    const agora = new Date(2026, 8, 20);

    expect(deveAbrirProximoMesQuandoQuitado(9, 2026, [{ status: 'Pago' }], agora)).toBe(true);
    expect(deveAbrirProximoMesQuandoQuitado(9, 2026, [], agora)).toBe(false);
    expect(deveAbrirProximoMesQuandoQuitado(9, 2026, [{ status: 'Em aberto' }], agora)).toBe(false);
    expect(deveAbrirProximoMesQuandoQuitado(8, 2026, [{ status: 'Pago' }], agora)).toBe(false);
  });

  it('gera uma chave estável para o cache de cada janela', () => {
    expect(chaveJanelaFinanceira(criarJanelaCompetencias(10, 2026)))
      .toBe('10-2026_03-2027');
  });

  it('recusa parâmetros de período inválidos', () => {
    expect(() => criarJanelaCompetencias(0, 2026)).toThrow('Mês inicial inválido.');
    expect(() => criarJanelaCompetencias(1, 0)).toThrow('Ano inicial inválido.');
    expect(() => criarJanelaCompetencias(1, 2026, 0)).toThrow('Quantidade de competências inválida.');
  });
});

describe('paginação financeira', () => {
  it('carrega todas as páginas sem truncar no limite do servidor', async () => {
    const buscarPagina = vi.fn(async (inicio: number, fim: number) => {
      const registros = [1, 2, 3, 4, 5];
      return { data: registros.slice(inicio, fim + 1), error: null };
    });

    await expect(carregarTodasPaginas(buscarPagina, 2)).resolves.toEqual([1, 2, 3, 4, 5]);
    expect(buscarPagina).toHaveBeenCalledTimes(3);
    expect(buscarPagina).toHaveBeenNthCalledWith(1, 0, 1);
    expect(buscarPagina).toHaveBeenNthCalledWith(3, 4, 5);
  });

  it('interrompe o carregamento se qualquer página falhar', async () => {
    await expect(carregarTodasPaginas(async () => ({
      data: null,
      error: { message: 'consulta recusada' },
    }))).rejects.toThrow('consulta recusada');
  });
});
