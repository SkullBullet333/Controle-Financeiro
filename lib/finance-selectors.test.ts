import { describe, expect, it } from 'vitest';
import {
  calcularDividaAberta,
  calcularResumoFinanceiro,
  calcularScoreOrcamentario,
  calcularTotaisFluxo,
  calcularTotaisPorTitular,
} from './finance-selectors';
import { Despesa, Receita, Titular } from './types';

const receita = (
  id: number,
  titularId: number,
  competencia: string,
  valor: number,
  status: Receita['status'] = 'Recebido'
): Receita => ({
  id,
  descricao: 'Receita',
  valor,
  parcela_atual: 1,
  parcela_total: 1,
  data_recebimento: '2026-09-10',
  status,
  titular_id: titularId,
  competencia,
});

const despesa = (
  id: number,
  titularId: number,
  competencia: string,
  valor: number,
  status: Despesa['status'] = 'Em aberto',
  vencimento = '2026-09-20'
): Despesa => ({
  id,
  descricao: 'Despesa',
  valor,
  parcela_atual: 1,
  parcela_total: 1,
  vencimento,
  status,
  titular_id: titularId,
  competencia,
});

describe('seletores financeiros canônicos', () => {
  it('calcula receitas, despesas e saldo em centavos', () => {
    expect(calcularTotaisFluxo(
      [receita(1, 1, '09/2026', 0.1), receita(2, 1, '09/2026', 0.2)],
      [despesa(3, 1, '09/2026', 0.15)]
    )).toEqual({ totalReceitas: 0.3, totalDespesas: 0.15, saldo: 0.15 });
  });

  it('aplica competência e titular ao total de fluxo', () => {
    const resultado = calcularTotaisFluxo(
      [receita(1, 1, '09/2026', 100), receita(2, 2, '09/2026', 900)],
      [despesa(3, 1, '09/2026', 40), despesa(4, 1, '10/2026', 500)],
      { competencia: '09/2026', titularId: 1 }
    );

    expect(resultado).toEqual({ totalReceitas: 100, totalDespesas: 40, saldo: 60 });
  });

  it('separa previsto, realizado, a pagar e vencido pela data de referência', () => {
    const resultado = calcularResumoFinanceiro(
      [receita(1, 1, '09/2026', 150), receita(5, 1, '09/2026', 50, 'Pendente')],
      [
        despesa(2, 1, '09/2026', 50, 'Pago'),
        despesa(3, 1, '09/2026', 70, 'Em aberto', '2026-09-01'),
        despesa(4, 1, '09/2026', 30, 'Em aberto', '2026-09-30'),
      ],
      '2026-09-14'
    );

    expect(resultado).toEqual({
      totalReceitas: 200,
      totalDespesas: 150,
      saldo: 50,
      totalRecebido: 150,
      totalPendenteReceber: 50,
      totalPago: 50,
      totalAberto: 100,
      totalVencido: 70,
      margem: 50,
    });
  });

  it('agrega por titular sem duplicar receitas virtuais nem excluir vencidas do período', () => {
    const titulares: Titular[] = [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }];
    const resultado = calcularTotaisPorTitular(
      titulares,
      [receita(1, 1, '09/2026', 100), receita(-2, 1, '09/2026', 50), receita(3, 2, '10/2026', 900)],
      [despesa(4, 1, '09/2026', 25), despesa(5, 1, '09/2026', 30, 'Em aberto', '2026-09-01')],
      '09/2026'
    );

    expect(resultado).toEqual({
      1: { despesas: 55, receitas: 150 },
      2: { despesas: 0, receitas: 0 },
    });
  });

  it('calcula dívida aberta para a família ou um titular', () => {
    const despesas = [
      despesa(1, 1, '09/2026', 10),
      despesa(2, 2, '09/2026', 20),
      despesa(3, 1, '09/2026', 30, 'Pago'),
      despesa(4, 1, '09/2026', 40, 'Vencida'),
    ];

    expect(calcularDividaAberta(despesas)).toEqual({ totalDividaAberto: 70, qtdParcelasRestante: 3 });
    expect(calcularDividaAberta(despesas, 1)).toEqual({ totalDividaAberto: 50, qtdParcelasRestante: 2 });
  });

  it('não fabrica score sem receita prevista e limita o resultado ao intervalo válido', () => {
    expect(calcularScoreOrcamentario(0, 0)).toBeNull();
    expect(calcularScoreOrcamentario(100, 40)).toBe(72);
    expect(calcularScoreOrcamentario(100, 200)).toBe(0);
    expect(calcularScoreOrcamentario(100, -20)).toBe(100);
  });
});
