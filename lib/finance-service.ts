import { supabase } from './supabase';
import { Despesa, Receita, CartaoTransacao, CartaoConfig, Titular } from './types';
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
  startOfDay
} from 'date-fns';
import { categorizar } from './categories-utils';

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

export function calcularCompetenciaReceita(dateAjustada: Date): string {
  const dia = getDate(dateAjustada);
  if (dia >= 28) {
    return formatCompetencia(addMonths(dateAjustada, 1));
  }
  return formatCompetencia(dateAjustada);
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

export async function salvarDespesa(dados: Partial<Despesa>, userId: string) {
  if (dados.id) {
    const { id, ...camposParaAtualizar } = dados;
    
    // Se houver vencimento, recalculamos a competência e ajustamos a data
    let updatePayload: any = { 
      ...camposParaAtualizar,
      updated_at: new Date().toISOString() 
    };

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
    return lancarParcelas('despesa', dados, userId);
  }
}

export async function salvarReceita(dados: Partial<Receita>, userId: string) {
  if (dados.id) {
    const dataPretendida = parseISO(dados.data_recebimento!);
    
    // Aplica regras de ajuste de data de receita
    const dataAjustada = ajustarDataReceita(dataPretendida);
    const comp = calcularCompetenciaReceita(dataAjustada);

    const { data, error } = await supabase
      .from('receitas')
      .update({
        descricao: dados.descricao,
        categoria: dados.categoria,
        valor: dados.valor,
        data_recebimento: format(dataAjustada, 'yyyy-MM-dd'),
        titular_id: dados.titular_id,
        competencia: comp,
        simulada: dados.simulada
      })
      .eq('id', dados.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    return lancarParcelas('receita', dados, userId);
  }
}

export async function lancarParcelas(
  tipo: 'despesa' | 'receita' | 'cartao', 
  dados: (Partial<Despesa> & Partial<Receita> & { cartao_config?: CartaoConfig; vencimento_original?: string; cartao_id?: number }), 
  userId: string
) {
  const totalParcelas = Number(dados.parcela_total || 1);
  const valorParcela = Number(dados.valor || 0);
  const dataStr = dados.vencimento || dados.data_recebimento || dados.vencimento_original;
  
  if (!dataStr) throw new Error('Data não informada');
  
  const dataInicial = parseISO(dataStr);
  const diaOriginal = getDate(dataInicial);
  const isUltimoDiaOriginal = isLastDayOfMonth(dataInicial);
  
  const inserts = [];
  const competenciasAfetadas = new Set<string>();

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
      // Para receitas, calcula competência sobre a data pretendida ANTES do ajuste
      comp = calcularCompetenciaReceita(dataVenc);
      dataVenc = ajustarDataReceita(dataVenc);
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
      user_id: userId,
      descricao: dados.descricao,
      valor: valorParcela,
      competencia: comp,
      simulada: !!dados.simulada,
      categoria: dados.categoria || categorizar(dados.descricao || ''),
    };

    if (tipo === 'despesa') {
      inserts.push({
        ...common,
        parcela_atual: i,
        parcela_total: totalParcelas,
        vencimento: format(dataVenc, 'yyyy-MM-dd'),
        status: 'Em aberto',
        titular_id: dados.titular_id
      });
    } else if (tipo === 'receita') {
      inserts.push({
        ...common,
        data_recebimento: format(dataVenc, 'yyyy-MM-dd'),
        titular_id: dados.titular_id
      });
    } else if (tipo === 'cartao') {
      inserts.push({
        user_id: userId,
        estabelecimento: dados.descricao,
        valor: valorParcela,
        competencia: comp,
        simulada: !!dados.simulada,
        cartao_id: dados.cartao_id,
        categoria: common.categoria,
        titular_id: dados.titular_id,
        parcela_atual: i,
        parcela_total: totalParcelas,
        data_compra: format(dataInicial, 'yyyy-MM-dd'),
      });
    }
  }

  const table = tipo === 'despesa' ? 'despesas' : tipo === 'receita' ? 'receitas' : 'cartoes';
  const { data, error } = await supabase.from(table).insert(inserts).select();
  
  if (error) throw error;

  if (tipo === 'cartao') {
    for (const comp of competenciasAfetadas) {
      await consolidarFaturas(comp, userId);
    }
  }

  return data;
}

export async function consolidarFaturas(competencia: string, userId: string) {
  // 1. Buscar configurações de cartões (RLS cuidará da visibilidade)
  const { data: configs, error: configError } = await supabase
    .from('cartoes_config')
    .select('*');
  
  if (configError) throw configError;

  // 2. Buscar lançamentos de cartões para a competência (apenas reais, não simulados)
  const { data: lancamentos, error: lancError } = await supabase
    .from('cartoes')
    .select('*, cartoes_config(nome_cartao, titular_id, titulares(nome))')
    .eq('competencia', competencia)
    .eq('simulada', false);
  
  if (lancError) throw lancError;

  // 3. Agrupar por cartão e titular
  const totais: Record<string, { valor: number, cartao_id: number, titular_id: number, nome_cartao: string, nome_titular: string }> = {};

  lancamentos?.forEach(l => {
    // Supabase pode retornar objeto ou array dependendo da definição da FK
    const configRaw = l.cartoes_config;
    if (!configRaw) return;
    
    const config = (Array.isArray(configRaw) ? configRaw[0] : configRaw) as any;
    if (!config) return;

    const titularRaw = config.titulares;
    const titularNome = (Array.isArray(titularRaw) ? titularRaw[0]?.nome : titularRaw?.nome) || 'N/A';

    const key = `${l.cartao_id}-${config.titular_id}`;
    if (!totais[key]) {
      totais[key] = { 
        valor: 0, 
        cartao_id: l.cartao_id, 
        titular_id: config.titular_id,
        nome_cartao: config.nome_cartao,
        nome_titular: titularNome
      };
    }
    const valorNum = Number(l.valor);
    if (!isNaN(valorNum)) {
      totais[key].valor += valorNum;
    }
  });

  // 4. Buscar faturas já consolidadas para esta competência para comparar e remover se necessário
  const { data: faturasExistentes } = await supabase
    .from('despesas')
    .select('id, descricao, titular_id, status, cartao_vencimento_id, user_id')
    .eq('competencia', competencia)
    .like('descricao', 'Fatura %');

  // 5. Preparar payloads para upsert (batch)
  const upserts = [];
  const idsProcessados = new Set<number>();

  for (const key in totais) {
    const item = totais[key];
    const config = configs?.find(c => c.id === item.cartao_id);
    if (!config) continue;

    const diaVenc = config.dia_vencimento;
    const [mes, ano] = competencia.split('/').map(Number);
    const dataBase = new Date(ano, mes - 1, 1);
    const isUltimoDia = diaVenc === 31;
    
    const dataVenc = projetarProximoVencimento(dataBase, 0, isUltimoDia, diaVenc);
    
    const desc = `Fatura ${item.nome_cartao} - ${item.nome_titular}`;

    // Tentar encontrar fatura existente pelo ID do cartão ou pela descrição (se ID não estiver setado)
    // Garantimos que não pegamos uma fatura já processada por outro cartão
    const existente = faturasExistentes?.find(f => 
      !idsProcessados.has(f.id) && (
        (f.cartao_vencimento_id === item.cartao_id && f.titular_id === item.titular_id) ||
        (f.descricao === desc && f.titular_id === item.titular_id && !f.cartao_vencimento_id)
      )
    );

    if (existente) {
      idsProcessados.add(existente.id);
    }

    upserts.push({
      ...(existente ? { id: existente.id } : {}),
      user_id: userId,
      descricao: desc,
      valor: item.valor,
      parcela_atual: 1,
      parcela_total: 1,
      vencimento: format(dataVenc, 'yyyy-MM-dd'),
      status: existente ? (existente as any).status : 'Em aberto',
      titular_id: item.titular_id,
      competencia: competencia,
      cartao_vencimento_id: item.cartao_id,
      simulada: false,
      updated_at: new Date().toISOString()
    });
  }

  if (upserts.length > 0) {
    const { data: upsertedData, error: upsertError } = await supabase.from('despesas').upsert(upserts).select('id');
    if (upsertError) throw upsertError;
    
    // Adicionar IDs recém-criados aos processados para não serem deletados
    upsertedData?.forEach(d => idsProcessados.add(d.id));
  }

  // 6. Remover faturas que não existem mais (batch)
  const idsParaRemover = faturasExistentes
    ?.filter(f => !idsProcessados.has(f.id))
    .map(f => f.id);

  if (idsParaRemover && idsParaRemover.length > 0) {
    const { error: deleteError } = await supabase.from('despesas').delete().in('id', idsParaRemover);
    if (deleteError) throw deleteError;
  }
}
