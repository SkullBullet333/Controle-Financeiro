import { addMonths, format } from 'date-fns';
import { somarDinheiro } from './money';
import { CartaoConfig, CartaoTransacao, Despesa } from './types';

export interface FaturaCartaoProjetada {
  competencia: string;
  mes: string;
  total: number;
}

interface ValorFaturaCartaoParams {
  cartao: CartaoConfig;
  competencia: string;
  transacoes: readonly CartaoTransacao[];
  despesas?: readonly Despesa[];
  titularId?: number | null;
}

interface ProjetarFaturasCartaoParams {
  mesInicial: number;
  anoInicial: number;
  quantidadeMeses: number;
  cartoes: readonly CartaoConfig[];
  transacoes: readonly CartaoTransacao[];
  despesas?: readonly Despesa[];
  cartaoId?: number | null;
  titularId?: number | null;
}

function pertenceAoTitular(itemTitularId: number, titularId?: number | null): boolean {
  return titularId == null || Number(itemTitularId) === Number(titularId);
}

export function calcularTotaisPorCartao(
  transacoes: readonly CartaoTransacao[],
  cartoes: readonly Pick<CartaoConfig, 'id'>[] = []
): Record<number, number> {
  const totais: Record<number, number> = {};
  cartoes.forEach(cartao => {
    totais[cartao.id] = 0;
  });
  transacoes.forEach(transacao => {
    totais[transacao.cartao_id] = somarDinheiro([
      totais[transacao.cartao_id] || 0,
      transacao.valor,
    ]);
  });
  return totais;
}

export function calcularValorFaturaCartao({
  cartao,
  competencia,
  transacoes,
  despesas = [],
  titularId = null,
}: ValorFaturaCartaoParams): number {
  if (!pertenceAoTitular(cartao.titular_id, titularId)) return 0;

  const totalTransacoes = somarDinheiro(transacoes
    .filter(item =>
      item.cartao_id === cartao.id
      && item.competencia === competencia
      && pertenceAoTitular(item.titular_id, titularId)
    )
    .map(item => item.valor));
  const faturaPersistida = despesas.find(item =>
    item.competencia === competencia
    && pertenceAoTitular(item.titular_id, titularId)
    && (
      item.cartao_vencimento_id === cartao.id
      || (
        !item.cartao_vencimento_id
        && item.isSummary
        && item.descricao === `Fatura ${cartao.nome_cartao}`
        && Number(item.titular_id) === Number(cartao.titular_id)
      )
    )
  );

  if (!faturaPersistida) return totalTransacoes;
  if (faturaPersistida.status === 'Pago') return faturaPersistida.valor;
  return totalTransacoes || faturaPersistida.valor;
}

export function projetarFaturasCartao({
  mesInicial,
  anoInicial,
  quantidadeMeses,
  cartoes,
  transacoes,
  despesas = [],
  cartaoId = null,
  titularId = null,
}: ProjetarFaturasCartaoParams): FaturaCartaoProjetada[] {
  const cartoesSelecionados = cartoes.filter(cartao =>
    (cartaoId == null || Number(cartao.id) === Number(cartaoId))
    && pertenceAoTitular(cartao.titular_id, titularId)
  );

  return Array.from({ length: quantidadeMeses }, (_, indice) => {
    const data = addMonths(new Date(anoInicial, mesInicial - 1, 1), indice);
    const competencia = format(data, 'MM/yyyy');
    const total = somarDinheiro(cartoesSelecionados.map(cartao =>
      calcularValorFaturaCartao({ cartao, competencia, transacoes, despesas, titularId })
    ));

    return {
      competencia,
      mes: format(data, 'MMM'),
      total,
    };
  });
}
