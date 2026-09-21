import { describe, expect, it, vi } from 'vitest';
import { format, parseISO } from 'date-fns';

vi.mock('./supabase', () => ({ supabase: {} }));

import {
  prepararDespesasVinculadas,
  prepararFaturaCartao,
  prepararReceitasVinculadas,
  calculatePresentValue,
  contaFixaPermiteOcorrencia,
  resolverOcorrenciaContaFixa,
  resolverAgendamentoReceita,
} from './finance-service';

describe('ciclo de vida das recorrências', () => {
  it('preserva ocorrências anteriores e corta a partir do ponto informado', () => {
    const config = { status: 'cancelado' as const, encerrada_a_partir_da_ocorrencia: 4 };

    expect(contaFixaPermiteOcorrencia(config, 3)).toBe(true);
    expect(contaFixaPermiteOcorrencia(config, 4)).toBe(false);
    expect(contaFixaPermiteOcorrencia(config, 5)).toBe(false);
  });

  it('trata o schema remoto legado sem estado como ativo', () => {
    expect(contaFixaPermiteOcorrencia({}, 12)).toBe(true);
  });

  it('resolve a ocorrência por competência inclusive na virada do ano', () => {
    expect(resolverOcorrenciaContaFixa('11/2026', '02/2027')).toBe(4);
    expect(resolverOcorrenciaContaFixa('11/2026', '10/2026')).toBeNull();
    expect(resolverOcorrenciaContaFixa('inválida', '02/2027')).toBeNull();
  });
});

function resolve(date: string) {
  const result = resolverAgendamentoReceita(parseISO(date));
  return {
    dataRecebimento: format(result.dataRecebimento, 'yyyy-MM-dd'),
    competencia: result.competencia,
  };
}

describe('resolverAgendamentoReceita', () => {
  it('mantém uma data útil comum na competência corrente', () => {
    expect(resolve('2026-09-15')).toEqual({
      dataRecebimento: '2026-09-15',
      competencia: '09/2026',
    });
  });

  it('preserva a competência contratual quando o fim de semana volta ao dia 27', () => {
    expect(resolve('2026-03-29')).toEqual({
      dataRecebimento: '2026-03-27',
      competencia: '04/2026',
    });
  });

  it('move o dia 1 para o quinto dia útil sem trocar a competência', () => {
    expect(resolve('2026-11-01')).toEqual({
      dataRecebimento: '2026-11-06',
      competencia: '11/2026',
    });
  });

  it('trata a virada do ano para receitas dos últimos dias de dezembro', () => {
    expect(resolve('2026-12-31')).toEqual({
      dataRecebimento: '2026-12-31',
      competencia: '01/2027',
    });
  });

  it('trata o último dia de fevereiro em ano bissexto', () => {
    expect(resolve('2028-02-29')).toEqual({
      dataRecebimento: '2028-02-29',
      competencia: '03/2028',
    });
  });
});

describe('prepararDespesasVinculadas', () => {
  it('serializa somente os campos financeiros aceitos pela RPC', () => {
    expect(prepararDespesasVinculadas([{
      id: -42,
      emprestimo_id: 9,
      descricao: '  Financiamento  ',
      categoria: '  Crédito  ',
      valor: 123.45,
      parcela_atual: 3,
      parcela_total: 12,
      vencimento: '2026-11-10',
      status: 'Pago',
      titular_id: 7,
      competencia: '11/2026',
    }])).toEqual([{
      emprestimo_id: 9,
      conta_fixa_id: null,
      descricao: 'Financiamento',
      categoria: 'Crédito',
      valor: 123.45,
      parcela_atual: 3,
      parcela_total: 12,
      vencimento: '2026-11-10',
      status: 'Pago',
      titular_id: 7,
      competencia: '11/2026',
    }]);
  });

  it('recusa uma ocorrência ligada a duas origens', () => {
    expect(() => prepararDespesasVinculadas([{
      emprestimo_id: 9,
      conta_fixa_id: 10,
      valor: 100,
      parcela_atual: 1,
      vencimento: '2026-09-10',
      competencia: '09/2026',
    }])).toThrow('exatamente uma origem');
  });

  it('recusa valor não positivo antes de chamar o banco', () => {
    expect(() => prepararDespesasVinculadas([{
      emprestimo_id: 9,
      valor: 0,
      parcela_atual: 1,
      vencimento: '2026-09-10',
      competencia: '09/2026',
    }])).toThrow('maior que zero');
  });

  it('normaliza a parcela para centavos antes de chamar a RPC', () => {
    expect(prepararDespesasVinculadas([{
      emprestimo_id: 9,
      valor: 10.075,
      parcela_atual: 1,
      vencimento: '2026-09-10',
      competencia: '09/2026',
    }])[0].valor).toBe(10.08);
  });
});

describe('valor presente monetário', () => {
  it('arredonda valor presente e desconto para centavos', () => {
    expect(calculatePresentValue(100, 1, '2026-01-31', parseISO('2026-01-01'))).toEqual({
      vp: 99.01,
      discount: 0.99,
    });
  });

  it('normaliza o nominal quando não existe intervalo para desconto', () => {
    expect(calculatePresentValue(10.075, 1, '2026-01-01', parseISO('2026-01-01'))).toEqual({
      vp: 10.08,
      discount: 0,
    });
  });
});

describe('prepararReceitasVinculadas', () => {
  it('usa conta fixa e competência como identidade da ocorrência', () => {
    expect(prepararReceitasVinculadas([{
      id: -10,
      conta_fixa_id: 12,
      descricao: '  Salário  ',
      valor: 4500,
      parcela_atual: 1,
      parcela_total: 0,
      data_recebimento: '2026-09-30',
      status: 'Recebido',
      titular_id: 2,
      competencia: '10/2026',
    }])).toEqual([{
      conta_fixa_id: 12,
      descricao: 'Salário',
      categoria: null,
      valor: 4500,
      parcela_atual: 1,
      parcela_total: 0,
      data_recebimento: '2026-09-30',
      status: 'Recebido',
      titular_id: 2,
      competencia: '10/2026',
    }]);
  });

  it('recusa receita sem conta fixa vinculada', () => {
    expect(() => prepararReceitasVinculadas([{
      valor: 100,
      parcela_atual: 1,
      data_recebimento: '2026-09-10',
      competencia: '09/2026',
    }])).toThrow('conta fixa vinculada');
  });

  it('recusa competência fora do contrato MM/AAAA', () => {
    expect(() => prepararReceitasVinculadas([{
      conta_fixa_id: 12,
      valor: 100,
      parcela_atual: 1,
      data_recebimento: '2026-09-10',
      competencia: '2026-09',
    }])).toThrow('formato MM/AAAA');
  });
});

describe('prepararFaturaCartao', () => {
  it('envia somente a identidade e o snapshot financeiro da fatura', () => {
    expect(prepararFaturaCartao({
      id: -100,
      cartao_vencimento_id: 7,
      descricao: 'Texto ignorado pelo servidor',
      categoria: 'Categoria ignorada',
      valor: 987.65,
      vencimento: '2026-09-30',
      status: 'Pago',
      competencia: '09/2026',
      titular_id: 99,
    })).toEqual({
      cartao_vencimento_id: 7,
      valor: 987.65,
      vencimento: '2026-09-30',
      status: 'Pago',
      competencia: '09/2026',
    });
  });

  it('recusa fatura sem vínculo estrutural com cartão', () => {
    expect(() => prepararFaturaCartao({
      valor: 100,
      vencimento: '2026-09-10',
      competencia: '09/2026',
    })).toThrow('cartão vinculado');
  });

  it('recusa fatura com valor não positivo', () => {
    expect(() => prepararFaturaCartao({
      cartao_vencimento_id: 7,
      valor: 0,
      vencimento: '2026-09-10',
      competencia: '09/2026',
    })).toThrow('maior que zero');
  });
});
