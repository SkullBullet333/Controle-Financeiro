import { somarDinheiro, subtrairDinheiro } from './money';
import { Despesa, Receita, Titular } from './types';

export interface TotaisFluxo {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
}

export interface ResumoFinanceiro extends TotaisFluxo {
  totalRecebido: number;
  totalPendenteReceber: number;
  totalPago: number;
  totalAberto: number;
  totalVencido: number;
  margem: number;
}

export function despesaEstaPaga(item: Pick<Despesa, 'status'>): boolean {
  return item.status === 'Pago';
}

export function receitaEstaRealizada(item: Pick<Receita, 'status'>): boolean {
  return item.status === 'Recebido' || item.status === 'Pago';
}

export function calcularScoreOrcamentario(totalReceitas: number, totalDespesas: number): number | null {
  const receitas = Math.max(0, totalReceitas);
  if (receitas === 0) return null;

  const despesas = Math.max(0, totalDespesas);
  const comprometimento = despesas / receitas;
  return Math.round(Math.max(0, Math.min(100, (1 - comprometimento * 0.7) * 100)));
}

interface FiltroLancamentos {
  competencia?: string;
  titularId?: number | null;
}

function correspondeAoFiltro(
  item: Pick<Despesa | Receita, 'competencia' | 'titular_id'>,
  filtro: FiltroLancamentos
): boolean {
  if (filtro.competencia && item.competencia !== filtro.competencia) return false;
  return filtro.titularId == null || Number(item.titular_id) === Number(filtro.titularId);
}

export function calcularTotaisFluxo(
  receitas: readonly Receita[],
  despesas: readonly Despesa[],
  filtro: FiltroLancamentos = {}
): TotaisFluxo {
  const totalReceitas = somarDinheiro(receitas
    .filter(item => correspondeAoFiltro(item, filtro))
    .map(item => item.valor));
  const totalDespesas = somarDinheiro(despesas
    .filter(item => correspondeAoFiltro(item, filtro))
    .map(item => item.valor));

  return {
    totalReceitas,
    totalDespesas,
    saldo: subtrairDinheiro(totalReceitas, totalDespesas),
  };
}

export function calcularResumoFinanceiro(
  receitas: readonly Receita[],
  despesas: readonly Despesa[],
  dataReferencia: string
): ResumoFinanceiro {
  const totais = calcularTotaisFluxo(receitas, despesas);
  const totalRecebido = somarDinheiro(receitas
    .filter(receitaEstaRealizada)
    .map(item => item.valor));
  const totalPendenteReceber = somarDinheiro(receitas
    .filter(item => !receitaEstaRealizada(item))
    .map(item => item.valor));
  const totalPago = somarDinheiro(despesas
    .filter(despesaEstaPaga)
    .map(item => item.valor));
  const totalAberto = somarDinheiro(despesas
    .filter(item => !despesaEstaPaga(item))
    .map(item => item.valor));
  const totalVencido = somarDinheiro(despesas
    .filter(item =>
      !despesaEstaPaga(item)
      && Boolean(item.vencimento)
      && item.vencimento !== '-'
      && item.vencimento < dataReferencia
    )
    .map(item => item.valor));

  return {
    ...totais,
    totalRecebido,
    totalPendenteReceber,
    totalPago,
    totalAberto,
    totalVencido,
    margem: totais.saldo,
  };
}

export function calcularTotaisPorTitular(
  titulares: readonly Titular[],
  receitas: readonly Receita[],
  despesas: readonly Despesa[],
  competencia: string
): Record<number, { despesas: number; receitas: number }> {
  const totais: Record<number, { despesas: number; receitas: number }> = {};
  titulares.forEach(titular => {
    totais[titular.id] = { despesas: 0, receitas: 0 };
  });

  despesas.forEach(item => {
    if (item.competencia !== competencia || !totais[item.titular_id]) return;
    totais[item.titular_id].despesas = somarDinheiro([totais[item.titular_id].despesas, item.valor]);
  });

  receitas.forEach(item => {
    if (item.competencia !== competencia || !totais[item.titular_id]) return;
    totais[item.titular_id].receitas = somarDinheiro([totais[item.titular_id].receitas, item.valor]);
  });

  return totais;
}

export function calcularDividaAberta(
  despesas: readonly Despesa[],
  titularId: number | null = null
): { totalDividaAberto: number; qtdParcelasRestante: number } {
  const abertas = despesas.filter(item =>
    !despesaEstaPaga(item)
    && (titularId == null || Number(item.titular_id) === Number(titularId))
  );

  return {
    totalDividaAberto: somarDinheiro(abertas.map(item => item.valor)),
    qtdParcelasRestante: abertas.length,
  };
}
