import { describe, expect, it } from 'vitest';
import { calcularTotaisPorCartao, calcularValorFaturaCartao, projetarFaturasCartao } from './card-projection';
import { CartaoConfig, CartaoTransacao, Despesa } from './types';

const cartoes: CartaoConfig[] = [
  { id: 1, nome_cartao: 'Principal', titular_id: 10, dia_vencimento: 10, dia_fechamento: 7 },
  { id: 2, nome_cartao: 'Principal Plus', titular_id: 20, dia_vencimento: 15, dia_fechamento: 5 },
];

const transacao = (id: number, cartaoId: number, titularId: number, competencia: string, valor: number): CartaoTransacao => ({
  id,
  user_id: 'u',
  cartao_id: cartaoId,
  data_compra: '2026-01-01',
  estabelecimento: 'Compra',
  valor,
  parcela_atual: 1,
  parcela_total: 1,
  competencia,
  titular_id: titularId,
});

describe('projeção canônica de cartões', () => {
  it('soma por cartão usando centavos e inicializa cartões sem movimento', () => {
    const totais = calcularTotaisPorCartao([
      transacao(1, 1, 10, '01/2026', 0.1),
      transacao(2, 1, 10, '01/2026', 0.2),
    ], cartoes);

    expect(totais).toEqual({ 1: 0.3, 2: 0 });
  });

  it('projeta cada competência com filtro opcional de cartão', () => {
    const resultado = projetarFaturasCartao({
      mesInicial: 1,
      anoInicial: 2026,
      quantidadeMeses: 2,
      cartoes,
      cartaoId: 1,
      transacoes: [
        transacao(1, 1, 10, '01/2026', 100),
        transacao(2, 1, 10, '02/2026', 80),
        transacao(3, 2, 20, '01/2026', 900),
      ],
    });

    expect(resultado.map(item => [item.competencia, item.total])).toEqual([
      ['01/2026', 100],
      ['02/2026', 80],
    ]);
  });

  it('preserva o valor registrado de uma fatura paga', () => {
    const despesas: Despesa[] = [{
      id: 5,
      descricao: 'Fatura Principal',
      valor: 95,
      parcela_atual: 1,
      parcela_total: 1,
      vencimento: '2026-01-10',
      status: 'Pago',
      titular_id: 10,
      competencia: '01/2026',
      isSummary: true,
      cartao_vencimento_id: 1,
    }];

    expect(calcularValorFaturaCartao({
      cartao: cartoes[0],
      competencia: '01/2026',
      transacoes: [transacao(1, 1, 10, '01/2026', 100)],
      despesas,
    })).toBe(95);
  });

  it('não associa fatura legada por nome parcial e mantém créditos negativos', () => {
    const despesas: Despesa[] = [{
      id: 6,
      descricao: 'Fatura Principal Plus',
      valor: 500,
      parcela_atual: 1,
      parcela_total: 1,
      vencimento: '2026-01-15',
      status: 'Pago',
      titular_id: 20,
      competencia: '01/2026',
      isSummary: true,
    }];

    expect(calcularValorFaturaCartao({
      cartao: cartoes[0],
      competencia: '01/2026',
      transacoes: [transacao(1, 1, 10, '01/2026', -25)],
      despesas,
    })).toBe(-25);
  });
});
