import { addMonths, format, getDate, isLastDayOfMonth, parseISO } from 'date-fns';
import {
  calcularCompetencia,
  contaFixaPermiteOcorrencia,
  primeiraParcelaContaFixa,
  projetarProximoVencimento,
  resolverAgendamentoReceita,
} from './finance-service';
import { somarDinheiro, subtrairDinheiro } from './money';
import { calcularValorFaturaCartao } from './card-projection';
import {
  CartaoConfig,
  CartaoTransacao,
  ContaFixaConfig,
  ContaFixaExcecao,
  Despesa,
  Emprestimo,
  Receita,
} from './types';

export interface FluxoCaixaProjetado {
  competencia: string;
  receitas: number;
  despesas: number;
  faturas: number;
  totalDespesas: number;
  saldo: number;
}

interface ProjetarFluxoCaixaParams {
  mesInicial: number;
  anoInicial: number;
  quantidadeMeses: number;
  despesas: readonly Despesa[];
  receitas: readonly Receita[];
  cartoes: readonly CartaoConfig[];
  transacoesCartao: readonly CartaoTransacao[];
  emprestimos: readonly Emprestimo[];
  contasFixas: readonly ContaFixaConfig[];
  contasFixasExcecoes?: readonly ContaFixaExcecao[];
  titularId?: number | null;
}

function pertenceAoTitular(itemTitularId: number, titularId?: number | null): boolean {
  return titularId == null || Number(itemTitularId) === Number(titularId);
}

function competenciaConfigurada(competenciaInicial: string, ocorrencia: number): string {
  const [mes, ano] = competenciaInicial.split('/').map(Number);
  return format(addMonths(new Date(ano, mes - 1, 1), ocorrencia - 1), 'MM/yyyy');
}

export function projetarFluxoCaixa({
  mesInicial,
  anoInicial,
  quantidadeMeses,
  despesas,
  receitas,
  cartoes,
  transacoesCartao,
  emprestimos,
  contasFixas,
  contasFixasExcecoes = [],
  titularId = null,
}: ProjetarFluxoCaixaParams): FluxoCaixaProjetado[] {
  const ocorrenciasIgnoradas = new Set(
    contasFixasExcecoes.map(item => `${Number(item.conta_fixa_id)}:${Number(item.ocorrencia)}`)
  );
  const ocorrenciaIgnorada = (contaFixaId: number, ocorrencia: number) => (
    ocorrenciasIgnoradas.has(`${Number(contaFixaId)}:${Number(ocorrencia)}`)
  );
  const receitasPorContaECompetencia = new Set<string>();
  const receitasPorContaEParcela = new Set<string>();
  receitas.forEach(item => {
    if (item.conta_fixa_id == null) return;
    const contaId = Number(item.conta_fixa_id);
    receitasPorContaECompetencia.add(`${contaId}:${item.competencia}`);
    receitasPorContaEParcela.add(`${contaId}:${Number(item.parcela_atual)}`);
  });

  const despesasPorContaEParcela = new Set<string>();
  const despesasPorEmprestimoEParcela = new Set<string>();
  despesas.forEach(item => {
    if (item.conta_fixa_id != null) {
      despesasPorContaEParcela.add(`${Number(item.conta_fixa_id)}:${Number(item.parcela_atual)}`);
    }
    if (item.emprestimo_id != null) {
      despesasPorEmprestimoEParcela.add(`${Number(item.emprestimo_id)}:${Number(item.parcela_atual)}`);
    }
  });

  const contasDeReceita = contasFixas.filter(item =>
    item.tipo === 'receita' && pertenceAoTitular(item.titular_id, titularId)
  );
  const contasDeDespesa = contasFixas.filter(item =>
    (!item.tipo || item.tipo === 'despesa') && !item.cartao_id && pertenceAoTitular(item.titular_id, titularId)
  );
  const emprestimosSelecionados = emprestimos.filter(item => pertenceAoTitular(item.titular_id, titularId));
  const cartoesSelecionados = cartoes.filter(item => pertenceAoTitular(item.titular_id, titularId));

  return Array.from({ length: quantidadeMeses }, (_, indice) => {
    const dataDoMes = addMonths(new Date(anoInicial, mesInicial - 1, 1), indice);
    const competencia = format(dataDoMes, 'MM/yyyy');

    const receitasFisicas = somarDinheiro(receitas
      .filter(item => item.competencia === competencia && pertenceAoTitular(item.titular_id, titularId))
      .map(item => item.valor));

    let receitasVirtuais = 0;
    contasDeReceita.forEach(config => {
        const dataInicial = parseISO(config.data_inicio);
        const diaOriginal = getDate(dataInicial);
        const ultimoDiaOriginal = isLastDayOfMonth(dataInicial);
        const primeiraParcela = primeiraParcelaContaFixa(config);
        const limite = config.total_parcelas || (primeiraParcela + 35);

        for (let ocorrencia = primeiraParcela; ocorrencia <= limite; ocorrencia++) {
          if (!contaFixaPermiteOcorrencia(config, ocorrencia) || ocorrenciaIgnorada(config.id, ocorrencia)) continue;
          const vencimento = projetarProximoVencimento(dataInicial, ocorrencia - primeiraParcela, ultimoDiaOriginal, diaOriginal, false);
          const competenciaOcorrencia = config.competencia_inicial
            ? competenciaConfigurada(config.competencia_inicial, ocorrencia - primeiraParcela + 1)
            : resolverAgendamentoReceita(vencimento).competencia;

          if (competenciaOcorrencia !== competencia) continue;
          const materializada = receitasPorContaECompetencia.has(`${Number(config.id)}:${competencia}`)
            || receitasPorContaEParcela.has(`${Number(config.id)}:${ocorrencia}`);
          if (!materializada) receitasVirtuais = somarDinheiro([receitasVirtuais, config.valor_mensal]);
        }
      });

    const receitasTotais = somarDinheiro([receitasFisicas, receitasVirtuais]);
    const despesasFisicas = somarDinheiro(despesas
      .filter(item =>
        item.competencia === competencia
        && pertenceAoTitular(item.titular_id, titularId)
        && !item.isSummary
        && !item.cartao_vencimento_id
      )
      .map(item => item.valor));

    let contasFixasVirtuais = 0;
    contasDeDespesa.forEach(config => {
        const dataInicial = parseISO(config.data_inicio);
        const diaOriginal = getDate(dataInicial);
        const ultimoDiaOriginal = isLastDayOfMonth(dataInicial);
        const primeiraParcela = primeiraParcelaContaFixa(config);
        const limite = config.total_parcelas || (primeiraParcela + 35);

        for (let ocorrencia = primeiraParcela; ocorrencia <= limite; ocorrencia++) {
          if (!contaFixaPermiteOcorrencia(config, ocorrencia) || ocorrenciaIgnorada(config.id, ocorrencia)) continue;
          const vencimento = projetarProximoVencimento(dataInicial, ocorrencia - primeiraParcela, ultimoDiaOriginal, diaOriginal);
          const competenciaOcorrencia = config.competencia_inicial
            ? competenciaConfigurada(config.competencia_inicial, ocorrencia - primeiraParcela + 1)
            : calcularCompetencia(vencimento);

          if (competenciaOcorrencia !== competencia) continue;
          const materializada = despesasPorContaEParcela.has(`${Number(config.id)}:${ocorrencia}`);
          if (!materializada) contasFixasVirtuais = somarDinheiro([contasFixasVirtuais, config.valor_mensal]);
        }
      });

    let emprestimosVirtuais = 0;
    emprestimosSelecionados.forEach(emprestimo => {
        const dataInicial = parseISO(emprestimo.data_primeiro_vencimento);
        const diaOriginal = getDate(dataInicial);
        const ultimoDiaOriginal = isLastDayOfMonth(dataInicial);

        for (let parcela = 1; parcela <= emprestimo.total_parcelas; parcela++) {
          const vencimento = projetarProximoVencimento(dataInicial, parcela - 1, ultimoDiaOriginal, diaOriginal);
          const competenciaParcela = emprestimo.competencia_inicial
            ? competenciaConfigurada(emprestimo.competencia_inicial, parcela)
            : calcularCompetencia(vencimento);

          if (competenciaParcela !== competencia) continue;
          const materializada = despesasPorEmprestimoEParcela.has(`${Number(emprestimo.id)}:${parcela}`);
          if (!materializada) emprestimosVirtuais = somarDinheiro([emprestimosVirtuais, emprestimo.valor_parcela]);
        }
      });

    let faturas = 0;
    cartoesSelecionados.forEach(cartao => {
        faturas = somarDinheiro([faturas, calcularValorFaturaCartao({
          cartao,
          competencia,
          transacoes: transacoesCartao,
          despesas,
          titularId,
        })]);
      });

    const despesasRegulares = somarDinheiro([despesasFisicas, contasFixasVirtuais, emprestimosVirtuais]);
    const totalDespesas = somarDinheiro([despesasRegulares, faturas]);

    return {
      competencia,
      receitas: receitasTotais,
      despesas: despesasRegulares,
      faturas,
      totalDespesas,
      saldo: subtrairDinheiro(receitasTotais, totalDespesas),
    };
  });
}
