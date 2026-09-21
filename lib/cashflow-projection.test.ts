import { describe, expect, it } from 'vitest';
import { projetarFluxoCaixa } from './cashflow-projection';
import { CartaoConfig, CartaoTransacao, ContaFixaConfig, Despesa, Emprestimo, Receita } from './types';

const base = {
  mesInicial: 1,
  anoInicial: 2026,
  quantidadeMeses: 2,
  despesas: [] as Despesa[],
  receitas: [] as Receita[],
  cartoes: [] as CartaoConfig[],
  transacoesCartao: [] as CartaoTransacao[],
  emprestimos: [] as Emprestimo[],
  contasFixas: [] as ContaFixaConfig[],
};

describe('projetarFluxoCaixa', () => {
  it('consolida valores físicos e mantém faturas separadas do restante', () => {
    const resultado = projetarFluxoCaixa({
      ...base,
      quantidadeMeses: 1,
      receitas: [{ id: 1, descricao: 'Receita', valor: 100.1, parcela_atual: 1, parcela_total: 1, data_recebimento: '2026-01-10', status: 'Recebido', titular_id: 1, competencia: '01/2026' }],
      despesas: [{ id: 2, descricao: 'Despesa', valor: 30.05, parcela_atual: 1, parcela_total: 1, vencimento: '2026-01-10', status: 'Pago', titular_id: 1, competencia: '01/2026' }],
      cartoes: [{ id: 3, nome_cartao: 'Principal', titular_id: 1, dia_vencimento: 10, dia_fechamento: 7 }],
      transacoesCartao: [{ id: 4, user_id: 'u', cartao_id: 3, data_compra: '2026-01-01', estabelecimento: 'Compra', valor: 20.05, parcela_atual: 1, parcela_total: 1, competencia: '01/2026', titular_id: 1 }],
    });

    expect(resultado[0]).toEqual({
      competencia: '01/2026',
      receitas: 100.1,
      despesas: 30.05,
      faturas: 20.05,
      totalDespesas: 50.1,
      saldo: 50,
    });
  });

  it('projeta recorrências e empréstimos sem duplicar ocorrências materializadas', () => {
    const contasFixas: ContaFixaConfig[] = [
      { id: 10, user_id: 'u', family_id: 'f', descricao: 'Entrada', valor_mensal: 1000, total_parcelas: 2, parcela_atual: 1, data_inicio: '2026-01-05', competencia_inicial: '01/2026', titular_id: 1, tipo: 'receita' },
      { id: 11, user_id: 'u', family_id: 'f', descricao: 'Saída', valor_mensal: 100, total_parcelas: 2, parcela_atual: 1, data_inicio: '2026-01-10', competencia_inicial: '01/2026', titular_id: 1, tipo: 'despesa' },
    ];
    const emprestimos: Emprestimo[] = [{ id: 12, user_id: 'u', family_id: 'f', descricao: 'Empréstimo', valor_parcela: 50, taxa_mensal_percentual: 1, total_parcelas: 2, parcela_atual: 1, data_primeiro_vencimento: '2026-01-10', competencia_inicial: '01/2026', titular_id: 1 }];
    const despesas: Despesa[] = [{ id: 20, descricao: 'Saída', valor: 100, parcela_atual: 1, parcela_total: 2, vencimento: '2026-01-10', status: 'Pago', titular_id: 1, competencia: '01/2026', conta_fixa_id: 11 }];

    const resultado = projetarFluxoCaixa({ ...base, contasFixas, emprestimos, despesas });

    expect(resultado.map(item => [item.receitas, item.despesas])).toEqual([[1000, 150], [1000, 150]]);
  });

  it('preserva as duas identidades legadas de receita materializada', () => {
    const contasFixas: ContaFixaConfig[] = [
      { id: 10, user_id: 'u', family_id: 'f', descricao: 'Por competência', valor_mensal: 100, total_parcelas: 2, parcela_atual: 1, data_inicio: '2026-01-05', competencia_inicial: '01/2026', titular_id: 1, tipo: 'receita' },
      { id: 11, user_id: 'u', family_id: 'f', descricao: 'Por parcela', valor_mensal: 200, total_parcelas: 2, parcela_atual: 1, data_inicio: '2026-01-05', competencia_inicial: '01/2026', titular_id: 1, tipo: 'receita' },
    ];
    const receitas: Receita[] = [
      { id: 1, descricao: 'Materializada por competência', valor: 100, parcela_atual: 99, parcela_total: 2, data_recebimento: '2026-01-05', status: 'Recebido', titular_id: 1, competencia: '01/2026', conta_fixa_id: 10 },
      { id: 2, descricao: 'Materializada por parcela', valor: 200, parcela_atual: 1, parcela_total: 2, data_recebimento: '2026-03-05', status: 'Recebido', titular_id: 1, competencia: '03/2026', conta_fixa_id: 11 },
    ];

    const resultado = projetarFluxoCaixa({ ...base, contasFixas, receitas });

    expect(resultado.map(item => item.receitas)).toEqual([100, 300]);
  });

  it('respeita filtro de titular e ocorrências ignoradas', () => {
    const contasFixas: ContaFixaConfig[] = [
      { id: 30, user_id: 'u', family_id: 'f', descricao: 'Titular 1', valor_mensal: 100, total_parcelas: 2, parcela_atual: 1, data_inicio: '2026-01-10', competencia_inicial: '01/2026', titular_id: 1, tipo: 'despesa' },
      { id: 31, user_id: 'u', family_id: 'f', descricao: 'Titular 2', valor_mensal: 900, total_parcelas: 2, parcela_atual: 1, data_inicio: '2026-01-10', competencia_inicial: '01/2026', titular_id: 2, tipo: 'despesa' },
    ];
    const resultado = projetarFluxoCaixa({
      ...base,
      contasFixas,
      titularId: 1,
      contasFixasExcecoes: [{ id: 1, family_id: 'f', conta_fixa_id: 30, ocorrencia: 2, acao: 'ignorar', created_by: 'u' }],
    });

    expect(resultado.map(item => item.totalDespesas)).toEqual([100, 0]);
  });

  it('usa o valor persistido de uma fatura paga', () => {
    const cartoes: CartaoConfig[] = [{ id: 40, nome_cartao: 'Principal', titular_id: 1, dia_vencimento: 10, dia_fechamento: 7 }];
    const transacoesCartao: CartaoTransacao[] = [{ id: 41, user_id: 'u', cartao_id: 40, data_compra: '2026-01-01', estabelecimento: 'Compra', valor: 70, parcela_atual: 1, parcela_total: 1, competencia: '01/2026', titular_id: 1 }];
    const despesas: Despesa[] = [{ id: 42, descricao: 'Fatura Principal', valor: 65, parcela_atual: 1, parcela_total: 1, vencimento: '2026-01-10', status: 'Pago', titular_id: 1, competencia: '01/2026', isSummary: true, cartao_vencimento_id: 40 }];

    const resultado = projetarFluxoCaixa({ ...base, quantidadeMeses: 1, cartoes, transacoesCartao, despesas });

    expect(resultado[0].faturas).toBe(65);
    expect(resultado[0].despesas).toBe(0);
  });
});
