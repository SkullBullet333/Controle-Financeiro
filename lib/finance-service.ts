import { supabase } from './supabase';
import { Despesa, Receita, CartaoTransacao, CartaoConfig, Titular, Status, Emprestimo, ContaFixaConfig } from './types';
import { 
  addMonths, 
  endOfMonth, 
  format, 
  isLastDayOfMonth, 
  isSaturday, 
  isSunday, 
  nextMonday, 
  previousFriday, 
  startOfMonth,
  parseISO,
  getDate,
  getYear,
  getMonth,
  addDays,
  isBefore,
  startOfDay,
  differenceInDays
} from 'date-fns';
import { categorizar } from './categories-utils';
import { normalizarDinheiro, subtrairDinheiro } from './money';

// ==================== UTILITÁRIOS PUROS ====================

export function formatCompetencia(date: Date): string {
  return format(date, 'MM/yyyy');
}

export function calcularCompetencia(date: Date): string {
  const d = startOfDay(date);
  if (isLastDayOfMonth(d)) {
    return formatCompetencia(addMonths(d, 1));
  }
  return formatCompetencia(d);
}

export function getFifthBusinessDay(date: Date): Date {
  let d = startOfMonth(date);
  let businessDaysCount = 0;
  
  while (businessDaysCount < 5) {
    if (!isSaturday(d) && !isSunday(d)) {
      businessDaysCount++;
    }
    if (businessDaysCount < 5) {
      d = addDays(d, 1);
    }
  }
  return d;
}

export function ajustarDataReceita(date: Date): Date {
  const d = startOfDay(date);
  
  // Regra do Dia 1 -> 5º Dia Útil
  if (getDate(d) === 1) {
    return getFifthBusinessDay(d);
  }

  // Regra de Fim de Semana -> Sexta-feira anterior
  if (isSaturday(d)) {
    return previousFriday(d);
  }
  if (isSunday(d)) {
    return previousFriday(d);
  }

  return d;
}

export function calcularCompetenciaReceita(dateReferencia: Date): string {
  const dia = getDate(dateReferencia);
  if (dia >= 28) {
    return formatCompetencia(addMonths(dateReferencia, 1));
  }
  return formatCompetencia(dateReferencia);
}

/**
 * Resolve a data efetiva e a competência a partir da data contratual da receita.
 * A competência é definida antes do ajuste bancário de fim de semana/dia 1.
 */
export function resolverAgendamentoReceita(datePretendida: Date): { dataRecebimento: Date; competencia: string } {
  return {
    dataRecebimento: ajustarDataReceita(datePretendida),
    competencia: calcularCompetenciaReceita(datePretendida),
  };
}

export function calcularCompetenciaCartao(dataCompra: Date, diaVencimento: number, diasFechamento: number): string {
  const d = startOfDay(dataCompra);
  
  let anoVenc = getYear(d);
  let mesVenc = getMonth(d);
  
  // Vencimento base no mês atual
  let dataVenc = new Date(anoVenc, mesVenc, diaVencimento);
  
  // Se o dia da compra for maior que o dia do vencimento, o vencimento base é o próximo mês
  if (getDate(d) > diaVencimento) {
    dataVenc = addMonths(dataVenc, 1);
  }

  // Data de fechamento = Vencimento - diasFechamento
  const dataFechamento = addDays(dataVenc, -diasFechamento);

  // Se a compra for NA DATA de fechamento ou DEPOIS, cai na próxima fatura
  if (!isBefore(d, dataFechamento)) {
    dataVenc = addMonths(dataVenc, 1);
  }

  return formatCompetencia(dataVenc);
}

export function getProximoFechamento(cartao: CartaoConfig): string {
  const now = startOfDay(new Date());
  
  // Começamos tentando o vencimento do mês atual
  let dataVenc = new Date(now.getFullYear(), now.getMonth(), cartao.dia_vencimento);
  let dataFechamento = startOfDay(addDays(dataVenc, -cartao.dia_fechamento));

  // Enquanto o fechamento for hoje ou no passado, procuramos o próximo ciclo
  while (dataFechamento <= now) {
    dataVenc = addMonths(dataVenc, 1);
    dataFechamento = startOfDay(addDays(dataVenc, -cartao.dia_fechamento));
  }

  return format(dataFechamento, 'dd/MM');
}

export const getCardLogo = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('nubank')) return 'https://i.ibb.co/rRRmcj5K/Nubank.png';
  if (lowerName.includes('inter')) return 'https://i.ibb.co/mFSsyhBj/inter.png';
  if (lowerName.includes('itaú') || lowerName.includes('itau')) return 'https://i.ibb.co/twPnVb6h/itau.avif';
  if (lowerName.includes('bradesco')) return 'https://i.ibb.co/BH4v1bVJ/Bradesco.png';
  if (lowerName.includes('santander')) return 'https://i.ibb.co/Pz3tF8yC/Santander.png';
  if (lowerName.includes('caixa')) return 'https://i.ibb.co/yBk7gxR1/caixa.png';
  if (lowerName.includes('mercado pago')) return 'https://i.ibb.co/hFkY0VVQ/Mercado-Pago.webp';
  if (lowerName.includes('sicoob platinum')) return 'https://i.ibb.co/p6knTbFb/Sicoob-Platinum.png';
  if (lowerName.includes('sicoob clássico')) return 'https://i.ibb.co/m5wswjcc/Sicoob-Cl-ssico.jpg';
  if (lowerName.includes('eucard')) return 'https://i.ibb.co/93nFRcXn/Eucard.jpg';
  if (lowerName.includes('cabal')) return 'https://i.ibb.co/fVNSC8Rs/Cabal.png';

  // Fallbacks para outros bancos
  if (lowerName.includes('bb') || lowerName.includes('brasil')) return 'https://logo.clearbit.com/bb.com.br';
  if (lowerName.includes('xp')) return 'https://logo.clearbit.com/xpi.com.br';
  if (lowerName.includes('btg')) return 'https://logo.clearbit.com/btgpactual.com';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&bold=true`;
};

export function projetarProximoVencimento(
  dataBase: Date, 
  mesesAdicionais: number, 
  isUltimoDiaOriginal: boolean, 
  diaOriginal: number,
  pularFimDeSemana: boolean = true
): Date {
  let d = addMonths(startOfMonth(dataBase), mesesAdicionais);
  
  if (isUltimoDiaOriginal) {
    d = endOfMonth(d);
  } else {
    const ultimoDiaMesAlvo = getDate(endOfMonth(d));
    d = addDays(d, Math.min(diaOriginal, ultimoDiaMesAlvo) - 1);
  }

  if (pularFimDeSemana) {
    if (isSaturday(d) || isSunday(d)) {
      d = nextMonday(d);
    }
  }

  return d;
}

// ==================== PERSISTÊNCIA SUPABASE ====================

export interface DespesaVinculadaPayload {
  emprestimo_id: number | null;
  conta_fixa_id: number | null;
  descricao: string | null;
  categoria: string | null;
  valor: number;
  parcela_atual: number;
  parcela_total: number | null;
  vencimento: string;
  status: Status;
  titular_id: number | null;
  competencia: string;
}

export function prepararDespesasVinculadas(
  despesas: readonly Partial<Despesa>[]
): DespesaVinculadaPayload[] {
  if (despesas.length === 0 || despesas.length > 240) {
    throw new Error('Informe entre 1 e 240 despesas vinculadas.');
  }

  return despesas.map((despesa) => {
    const emprestimoId = despesa.emprestimo_id ?? null;
    const contaFixaId = despesa.conta_fixa_id ?? null;
    const possuiEmprestimo = Number.isInteger(emprestimoId) && Number(emprestimoId) > 0;
    const possuiContaFixa = Number.isInteger(contaFixaId) && Number(contaFixaId) > 0;

    if (possuiEmprestimo === possuiContaFixa) {
      throw new Error('Cada despesa deve ter exatamente uma origem vinculada.');
    }

    const parcelaAtual = Number(despesa.parcela_atual);
    const valor = normalizarDinheiro(despesa.valor);
    if (!Number.isInteger(parcelaAtual) || parcelaAtual < 1) {
      throw new Error('O número da parcela deve ser maior ou igual a 1.');
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('O valor da parcela deve ser maior que zero.');
    }
    if (!despesa.vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(despesa.vencimento)) {
      throw new Error('O vencimento da parcela deve usar o formato AAAA-MM-DD.');
    }
    if (!despesa.competencia || !/^(0[1-9]|1[0-2])\/\d{4}$/.test(despesa.competencia)) {
      throw new Error('A competência deve usar o formato MM/AAAA.');
    }

    return {
      emprestimo_id: possuiEmprestimo ? Number(emprestimoId) : null,
      conta_fixa_id: possuiContaFixa ? Number(contaFixaId) : null,
      descricao: despesa.descricao?.trim() || null,
      categoria: despesa.categoria?.trim() || null,
      valor,
      parcela_atual: parcelaAtual,
      parcela_total: Number.isInteger(Number(despesa.parcela_total))
        ? Number(despesa.parcela_total)
        : null,
      vencimento: despesa.vencimento,
      status: despesa.status || 'Pago',
      titular_id: Number.isInteger(Number(despesa.titular_id))
        ? Number(despesa.titular_id)
        : null,
      competencia: despesa.competencia,
    };
  });
}

export async function materializarDespesasVinculadas(
  despesas: readonly Partial<Despesa>[]
) {
  const payload = prepararDespesasVinculadas(despesas);
  const { data, error } = await supabase.rpc('materializar_despesas_vinculadas', {
    p_despesas: payload,
  });

  if (error) throw error;
  return data as Despesa[];
}

export interface ReceitaVinculadaPayload {
  conta_fixa_id: number;
  descricao: string | null;
  categoria: string | null;
  valor: number;
  parcela_atual: number;
  parcela_total: number | null;
  data_recebimento: string;
  status: Status;
  titular_id: number | null;
  competencia: string;
}

export function prepararReceitasVinculadas(
  receitas: readonly Partial<Receita>[]
): ReceitaVinculadaPayload[] {
  if (receitas.length === 0 || receitas.length > 240) {
    throw new Error('Informe entre 1 e 240 receitas vinculadas.');
  }

  return receitas.map((receita) => {
    const contaFixaId = Number(receita.conta_fixa_id);
    const parcelaAtual = Number(receita.parcela_atual);
    const valor = normalizarDinheiro(receita.valor);

    if (!Number.isInteger(contaFixaId) || contaFixaId < 1) {
      throw new Error('A receita deve ter uma conta fixa vinculada.');
    }
    if (!Number.isInteger(parcelaAtual) || parcelaAtual < 1) {
      throw new Error('O número da parcela deve ser maior ou igual a 1.');
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('O valor da receita deve ser maior que zero.');
    }
    if (!receita.data_recebimento || !/^\d{4}-\d{2}-\d{2}$/.test(receita.data_recebimento)) {
      throw new Error('A data de recebimento deve usar o formato AAAA-MM-DD.');
    }
    if (!receita.competencia || !/^(0[1-9]|1[0-2])\/\d{4}$/.test(receita.competencia)) {
      throw new Error('A competência deve usar o formato MM/AAAA.');
    }

    return {
      conta_fixa_id: contaFixaId,
      descricao: receita.descricao?.trim() || null,
      categoria: receita.categoria?.trim() || null,
      valor,
      parcela_atual: parcelaAtual,
      parcela_total: Number.isInteger(Number(receita.parcela_total))
        ? Number(receita.parcela_total)
        : null,
      data_recebimento: receita.data_recebimento,
      status: receita.status || 'Recebido',
      titular_id: Number.isInteger(Number(receita.titular_id))
        ? Number(receita.titular_id)
        : null,
      competencia: receita.competencia,
    };
  });
}

export async function materializarReceitasVinculadas(
  receitas: readonly Partial<Receita>[]
) {
  const payload = prepararReceitasVinculadas(receitas);
  const { data, error } = await supabase.rpc('materializar_receitas_vinculadas', {
    p_receitas: payload,
  });

  if (error) throw error;
  return data as Receita[];
}

export interface FaturaCartaoPayload {
  cartao_vencimento_id: number;
  valor: number;
  vencimento: string;
  status: Status;
  competencia: string;
}

export function prepararFaturaCartao(
  despesa: Partial<Despesa>
): FaturaCartaoPayload {
  const cartaoId = Number(despesa.cartao_vencimento_id);
  const valor = normalizarDinheiro(despesa.valor);

  if (!Number.isInteger(cartaoId) || cartaoId < 1) {
    throw new Error('A fatura deve ter um cartão vinculado.');
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('O valor da fatura deve ser maior que zero.');
  }
  if (!despesa.vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(despesa.vencimento)) {
    throw new Error('O vencimento da fatura deve usar o formato AAAA-MM-DD.');
  }
  if (!despesa.competencia || !/^(0[1-9]|1[0-2])\/\d{4}$/.test(despesa.competencia)) {
    throw new Error('A competência deve usar o formato MM/AAAA.');
  }

  return {
    cartao_vencimento_id: cartaoId,
    valor,
    vencimento: despesa.vencimento,
    status: despesa.status || 'Pago',
    competencia: despesa.competencia,
  };
}

export async function materializarFaturaCartao(despesa: Partial<Despesa>) {
  const payload = prepararFaturaCartao(despesa);
  const { data, error } = await supabase.rpc('materializar_fatura_cartao', {
    p_fatura: payload,
  });

  if (error) throw error;
  return data as Despesa;
}

export async function salvarDespesa(dados: Partial<Despesa>, userId: string, familyId: string) {
  if (dados.id && dados.id > 0) {
    const { id, isSummary, ...camposParaAtualizar } = dados as any;
    
    // Se houver vencimento, recalculamos a competência e ajustamos a data
    let updatePayload: any = { 
      ...camposParaAtualizar,
      updated_at: new Date().toISOString() 
    };

    if (dados.valor !== undefined) {
      updatePayload.valor = normalizarDinheiro(dados.valor);
    }

    if (dados.vencimento && dados.vencimento !== '-') {
      const dataVenc = parseISO(dados.vencimento);
      const diaOriginal = getDate(dataVenc);
      const isUltimoDia = isLastDayOfMonth(dataVenc);
      
      const dataAjustada = projetarProximoVencimento(dataVenc, 0, isUltimoDia, diaOriginal);
      const comp = calcularCompetencia(dataAjustada);
      
      updatePayload.vencimento = format(dataAjustada, 'yyyy-MM-dd');
      updatePayload.competencia = comp;
    }

    const { data, error } = await supabase
      .from('despesas')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    if (dados.cartao_vencimento_id) {
      return materializarFaturaCartao(dados);
    }

    // Ocorrências virtuais são materializadas por uma RPC transacional. A
    // constraint natural no banco torna retries e duas abas idempotentes.
    if ((dados.emprestimo_id || dados.conta_fixa_id) && dados.parcela_atual) {
      const [despesa] = await materializarDespesasVinculadas([dados]);
      return despesa;
    }

    return lancarParcelas('despesa', dados, userId, familyId);
  }
}

export async function salvarReceita(dados: Partial<Receita>, userId: string, familyId: string) {
  if (dados.id) {
    const { id, ...camposParaAtualizar } = dados as any;
    
    let updatePayload: any = { 
      ...camposParaAtualizar,
      updated_at: new Date().toISOString() 
    };

    if (dados.valor !== undefined) {
      updatePayload.valor = normalizarDinheiro(dados.valor);
    }

    if (dados.data_recebimento) {
      const dataPretendida = parseISO(dados.data_recebimento);
      const agendamento = resolverAgendamentoReceita(dataPretendida);
      
      updatePayload.data_recebimento = format(agendamento.dataRecebimento, 'yyyy-MM-dd');
      updatePayload.competencia = agendamento.competencia;
    }

    const { data, error } = await supabase
      .from('receitas')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    // Receitas recorrentes legadas podem repetir parcela_atual. A competência
    // é a identidade estável usada pela RPC e pela constraint do banco.
    if (dados.conta_fixa_id && dados.parcela_atual) {
      const receitaNormalizada = { ...dados };
      if (dados.data_recebimento) {
        const agendamento = resolverAgendamentoReceita(parseISO(dados.data_recebimento));
        receitaNormalizada.data_recebimento = format(agendamento.dataRecebimento, 'yyyy-MM-dd');
        receitaNormalizada.competencia = dados.competencia || agendamento.competencia;
      }

      const [receita] = await materializarReceitasVinculadas([receitaNormalizada]);
      return receita;
    }

    // Para novas receitas ou múltiplos lançamentos
    return lancarParcelas('receita', dados, userId, familyId);
  }
}

export async function lancarParcelas(
  tipo: 'despesa' | 'receita' | 'cartao',
  dados: (Partial<Despesa> & Partial<Receita> & { cartao_config?: CartaoConfig; vencimento_original?: string; cartao_id?: number; emprestimo_id?: number; conta_fixa_id?: number; operation_id?: string }),
  userId: string,
  _familyId: string
) {
  const totalParcelas = Number(dados.parcela_total || 1);
  const valorParcela = normalizarDinheiro(dados.valor);
  const dataStr = dados.vencimento || dados.data_recebimento || dados.vencimento_original;
  
  if (!dataStr) throw new Error('Data não informada');
  
  const dataInicial = parseISO(dataStr);
  const diaOriginal = getDate(dataInicial);
  const isUltimoDiaOriginal = isLastDayOfMonth(dataInicial);
  
  const inserts = [];
  const competenciasAfetadas = new Set<string>();
  const operationId = dados.operation_id || globalThis.crypto.randomUUID();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    throw new Error('Identificador da operação financeira inválido.');
  }

  for (let i = 1; i <= totalParcelas; i++) {
    let dataVenc = projetarProximoVencimento(
      dataInicial, 
      i - 1, 
      isUltimoDiaOriginal, 
      diaOriginal,
      tipo !== 'receita' // Receitas têm lógica própria de ajuste
    );

    let comp: string;
    
    if (tipo === 'receita') {
      const agendamento = resolverAgendamentoReceita(dataVenc);
      comp = agendamento.competencia;
      dataVenc = agendamento.dataRecebimento;
    } else if (tipo === 'cartao') {
      // Para cartões, a competência da primeira parcela depende da regra de fechamento
      if (i === 1) {
        const cartao = dados.cartao_config; // Passado pelo hook
        if (cartao) {
          comp = calcularCompetenciaCartao(dataInicial, cartao.dia_vencimento, cartao.dia_fechamento);
        } else {
          comp = formatCompetencia(dataInicial);
        }
      } else {
        // Incrementa competência a partir da primeira
        const firstComp = Array.from(competenciasAfetadas)[0];
        if (firstComp) {
          const [m, y] = firstComp.split('/').map(Number);
          const firstDate = new Date(y, m - 1, 1);
          comp = formatCompetencia(addMonths(firstDate, i - 1));
        } else {
          comp = formatCompetencia(addMonths(dataInicial, i - 1));
        }
      }
    } else {
      comp = calcularCompetencia(dataVenc);
    }

    competenciasAfetadas.add(comp);

    const common = {
      descricao: dados.descricao,
      valor: valorParcela,
      competencia: comp,
      categoria: dados.categoria || categorizar(dados.descricao || ''),
    };

    if (tipo === 'despesa') {
      inserts.push({
        ...common,
        parcela_atual: i,
        parcela_total: totalParcelas,
        vencimento: format(dataVenc, 'yyyy-MM-dd'),
        status: (dados.status as Status) || 'Em aberto',
        titular_id: dados.titular_id,
        emprestimo_id: dados.emprestimo_id,
        conta_fixa_id: dados.conta_fixa_id
      });
    } else if (tipo === 'receita') {
      inserts.push({
        ...common,
        data_recebimento: format(dataVenc, 'yyyy-MM-dd'),
        titular_id: dados.titular_id,
        conta_fixa_id: dados.conta_fixa_id,
        parcela_atual: i,
        parcela_total: totalParcelas,
        status: (dados.status as Status) || (format(dataVenc, 'yyyy-MM-dd') <= format(new Date(), 'yyyy-MM-dd') ? 'Recebido' : 'Pendente')
      });
    } else if (tipo === 'cartao') {
      inserts.push({
        estabelecimento: dados.descricao,
        valor: valorParcela,
        competencia: comp,
        cartao_id: dados.cartao_id,
        categoria: common.categoria,
        titular_id: dados.titular_id,
        parcela_atual: i,
        parcela_total: totalParcelas,
        data_compra: format(dataInicial, 'yyyy-MM-dd'),
      });
    }
  }

  const { data, error } = await supabase.rpc('criar_lancamentos_parcelados', {
    p_tipo: tipo,
    p_operation_id: operationId,
    p_lancamentos: inserts,
  });
  
  if (error) throw error;

  if (tipo === 'cartao') {
    for (const comp of competenciasAfetadas) {
      await consolidarFaturas(comp, userId);
    }
  }

  return data;
}

export async function materializarOcorrenciaCartao(
  item: Pick<CartaoTransacao, 'conta_fixa_id' | 'conta_fixa_parcela' | 'parcela_atual' | 'data_compra' | 'valor' | 'estabelecimento' | 'categoria'>
) {
  const contaFixaId = Number(item.conta_fixa_id);
  const ocorrencia = Number(item.conta_fixa_parcela ?? item.parcela_atual);

  if (!Number.isInteger(contaFixaId) || contaFixaId < 1) {
    throw new Error('A ocorrência não possui uma recorrência de cartão válida.');
  }
  if (!Number.isInteger(ocorrencia) || ocorrencia < 1) {
    throw new Error('O número da ocorrência é inválido.');
  }
  if (!item.data_compra || !/^\d{4}-\d{2}-\d{2}$/.test(item.data_compra)) {
    throw new Error('A data da ocorrência deve usar o formato AAAA-MM-DD.');
  }

  const { data, error } = await supabase.rpc('materializar_ocorrencia_cartao', {
    p_conta_fixa_id: contaFixaId,
    p_ocorrencia: ocorrencia,
    p_data_compra: item.data_compra,
    p_valor: normalizarDinheiro(item.valor),
    p_estabelecimento: item.estabelecimento,
    p_categoria: item.categoria || null,
  });

  if (error) throw error;
  return data as CartaoTransacao;
}

export async function consolidarFaturas(competencia: string, _userId: string) {
  // Faturas em aberto são projeções. Quando uma compra muda, removemos apenas
  // o snapshot estrutural daquela competência para que o total seja recalculado.
  const { data: faturasEmAberto, error: invoiceError } = await supabase
    .from('despesas')
    .select('id')
    .eq('competencia', competencia)
    .not('cartao_vencimento_id', 'is', null)
    .eq('status', 'Em aberto');

  if (invoiceError) throw invoiceError;

  const idsParaRemover = faturasEmAberto?.map(f => f.id);

  if (idsParaRemover && idsParaRemover.length > 0) {
    const { error: deleteError } = await supabase.from('despesas').delete().in('id', idsParaRemover);
    if (deleteError) throw deleteError;
  }
}

// ==================== NOVOS: EMPRÉSTIMOS ====================

export async function salvarEmprestimo(dados: Partial<Emprestimo>, userId: string, familyId: string) {
  const dadosNormalizados = {
    ...dados,
    ...(dados.valor_total !== undefined
      ? { valor_total: normalizarDinheiro(dados.valor_total) }
      : {}),
    ...(dados.valor_parcela !== undefined
      ? { valor_parcela: normalizarDinheiro(dados.valor_parcela) }
      : {}),
  };

  if (dados.id) {
    const { error } = await supabase.from('emprestimos').update(dadosNormalizados).eq('id', dados.id);
    if (error) throw error;
    return { success: true };
  } else {
    // 1. Salvar mestre do empréstimo
    const { id, ...insertData } = dadosNormalizados;
    const { data: emprestimo, error } = await supabase
      .from('emprestimos')
      .insert([{ ...insertData, user_id: userId, family_id: familyId }])
      .select()
      .single();
    
    if (error) throw error;

    // 2. Não geramos mais as parcelas automaticamente (serão virtuais via hook)

    return emprestimo;
  }
}

export async function deletarEmprestimo(id: number) {
  // A FK despesas→emprestimos usa ON DELETE SET NULL: o banco desvincula
  // os lançamentos históricos na mesma transação da exclusão do mestre.
  const { error } = await supabase.from('emprestimos').delete().eq('id', id);
  if (error) throw error;
  
  return { success: true };
}

// ==================== NOVOS: CONTAS FIXAS ====================

export async function salvarContaFixaConfig(dados: Partial<ContaFixaConfig>, userId: string, familyId: string) {
  const dadosNormalizados = {
    ...dados,
    ...(dados.valor_mensal !== undefined
      ? { valor_mensal: normalizarDinheiro(dados.valor_mensal) }
      : {}),
  };

  if (dados.id) {
    const { error } = await supabase.from('contas_fixas').update(dadosNormalizados).eq('id', dados.id);
    if (error) throw error;
    return { success: true };
  } else {
    const { id, ...insertData } = dadosNormalizados;
    const { data, error } = await supabase
      .from('contas_fixas')
      .insert([{ ...insertData, user_id: userId, family_id: familyId }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

export function contaFixaEstaAtiva(config: Pick<ContaFixaConfig, 'status'>): boolean {
  return (config.status ?? 'ativo') === 'ativo';
}

/** Retorna a parcela real correspondente à data inicial da série. */
export function primeiraParcelaContaFixa(config: Pick<ContaFixaConfig, 'parcela_atual'>): number {
  const parcela = Number(config.parcela_atual);
  return Number.isInteger(parcela) && parcela > 0 ? parcela : 1;
}

export function contaFixaPermiteOcorrencia(
  config: Pick<ContaFixaConfig, 'status' | 'encerrada_a_partir_da_ocorrencia'>,
  ocorrencia: number
): boolean {
  if (!Number.isInteger(ocorrencia) || ocorrencia < 1) return false;
  if (contaFixaEstaAtiva(config)) return true;

  const corte = Number(config.encerrada_a_partir_da_ocorrencia || 1);
  return ocorrencia < corte;
}

export function resolverOcorrenciaContaFixa(
  competenciaInicial: string,
  competencia: string
): number | null {
  const parse = (value: string) => {
    const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value || '');
    return match ? { month: Number(match[1]), year: Number(match[2]) } : null;
  };
  const initial = parse(competenciaInicial);
  const current = parse(competencia);
  if (!initial || !current) return null;

  const occurrence = ((current.year - initial.year) * 12) + current.month - initial.month + 1;
  return occurrence >= 1 ? occurrence : null;
}

export async function encerrarContaFixaConfig(
  id: number,
  status: 'concluido' | 'cancelado' = 'cancelado'
) {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('A recorrência informada é inválida.');
  }

  const { data, error } = await supabase.rpc('encerrar_conta_fixa', {
    p_conta_fixa_id: id,
    p_status: status
  });
  if (error) throw error;

  return data;
}

export async function ignorarOcorrenciaContaFixa(id: number, ocorrencia: number) {
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(ocorrencia) || ocorrencia < 1) {
    throw new Error('A ocorrência recorrente informada é inválida.');
  }

  const { data, error } = await supabase.rpc('ignorar_ocorrencia_conta_fixa', {
    p_conta_fixa_id: id,
    p_ocorrencia: ocorrencia
  });
  if (error) throw error;
  return data;
}

export async function encerrarContaFixaDesde(id: number, ocorrencia: number) {
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(ocorrencia) || ocorrencia < 1) {
    throw new Error('O ponto de encerramento informado é inválido.');
  }

  const { data, error } = await supabase.rpc('encerrar_conta_fixa_desde', {
    p_conta_fixa_id: id,
    p_ocorrencia: ocorrencia,
    p_status: 'cancelado'
  });
  if (error) throw error;
  return data;
}

export function calculatePresentValue(vf: number, monthlyRatePercent: number, dueDate: string, refDate: Date): { vp: number, discount: number } {
  const nominal = normalizarDinheiro(vf);
  if (!Number.isFinite(monthlyRatePercent) || monthlyRatePercent < 0) {
    throw new Error('Taxa mensal inválida.');
  }
  const i = monthlyRatePercent / 100;
  const targetDate = parseISO(dueDate);
  const now = startOfDay(refDate);
  
  const days = Math.max(0, differenceInDays(targetDate, now));
  const nMonths = days / 30;
  
  const vp = normalizarDinheiro(nominal / Math.pow(1 + i, nMonths));
  const discount = subtrairDinheiro(nominal, vp);
  
  return { vp, discount };
}

// ==================== BATCH CATEGORY RENAMING ====================

function categoryRpcUnavailable(error: { code?: string }): boolean {
  // O remoto legado ainda não recebeu esta migration. Só nesse caso usamos
  // temporariamente as consultas antigas; outros erros não podem ser ocultados.
  return error.code === 'PGRST202' || error.code === '42883';
}

export async function renomearCategoriaEmLote(
  categoriaAntiga: string,
  categoriaNova: string,
  familyId?: string,
  userId?: string
) {
  if (!categoriaAntiga || !categoriaNova || categoriaAntiga.trim() === categoriaNova.trim()) {
    return { success: false, updatedCount: 0 };
  }

  const oldCat = categoriaAntiga.trim();
  const newCat = categoriaNova.trim();
  const { error: rpcError } = await supabase.rpc('renomear_categoria_em_lote', {
    p_categoria_antiga: oldCat,
    p_categoria_nova: newCat,
  });
  if (!rpcError) return { success: true };
  if (!categoryRpcUnavailable(rpcError)) throw rpcError;

  // Compatibilidade temporária: esse caminho não é atômico no remoto legado.
  let qDespesas = supabase
    .from('despesas')
    .update({ categoria: newCat })
    .eq('categoria', oldCat);
  if (familyId) qDespesas = qDespesas.eq('family_id', familyId);
  const { error: err1 } = await qDespesas;
  if (err1) throw err1;

  // 2. Atualizar em contas_fixas
  let qFixas = supabase
    .from('contas_fixas')
    .update({ categoria: newCat })
    .eq('categoria', oldCat);
  if (familyId) qFixas = qFixas.eq('family_id', familyId);
  const { error: err2 } = await qFixas;
  if (err2) throw err2;

  // 3. Atualizar em cartoes (transações de cartão)
  let qCartoes = supabase
    .from('cartoes')
    .update({ categoria: newCat })
    .eq('categoria', oldCat);
  if (familyId) qCartoes = qCartoes.eq('family_id', familyId);
  const { error: err3 } = await qCartoes;
  if (err3) throw err3;

  return { success: true };
}

export async function atualizarCategoriaPorDescricao(
  descricao: string,
  categoriaNova: string,
  familyId?: string,
  userId?: string
) {
  if (!descricao || !categoriaNova) {
    return { success: false };
  }

  const descTrim = descricao.trim();
  const newCat = categoriaNova.trim();
  const { error: rpcError } = await supabase.rpc('atualizar_categoria_por_descricao', {
    p_descricao: descTrim,
    p_categoria_nova: newCat,
  });
  if (!rpcError) return { success: true };
  if (!categoryRpcUnavailable(rpcError)) throw rpcError;

  // Compatibilidade temporária: esse caminho não é atômico no remoto legado.
  let qDespesas = supabase
    .from('despesas')
    .update({ categoria: newCat })
    .ilike('descricao', descTrim);
  if (familyId) qDespesas = qDespesas.eq('family_id', familyId);
  const { error: err1 } = await qDespesas;
  if (err1) throw err1;

  // 2. Atualizar em contas_fixas
  let qFixas = supabase
    .from('contas_fixas')
    .update({ categoria: newCat })
    .ilike('descricao', descTrim);
  if (familyId) qFixas = qFixas.eq('family_id', familyId);
  const { error: err2 } = await qFixas;
  if (err2) throw err2;

  // Cartões usam estabelecimento; a tabela não possui coluna descricao.
  let qCartoes1 = supabase
    .from('cartoes')
    .update({ categoria: newCat })
    .ilike('estabelecimento', descTrim);
  if (familyId) qCartoes1 = qCartoes1.eq('family_id', familyId);
  const { error: err3 } = await qCartoes1;
  if (err3) throw err3;

  return { success: true };
}
