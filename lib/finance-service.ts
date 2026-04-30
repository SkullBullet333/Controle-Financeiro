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

export async function salvarDespesa(dados: Partial<Despesa>, userId: string, familyId: string) {
  if (dados.id && dados.id > 0) {
    const { id, isSummary, ...camposParaAtualizar } = dados as any;
    
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
    // Se for uma parcela específica (empréstimo ou conta fixa), 
    // salvamos apenas ela ao invés de disparar o gerador de parcelas múltiplas.
    if ((dados.emprestimo_id || dados.conta_fixa_id) && dados.parcela_atual) {
      const { data, error } = await supabase
        .from('despesas')
        .insert([{
          ...dados,
          user_id: userId,
          family_id: familyId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
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

    if (dados.data_recebimento) {
      const dataPretendida = parseISO(dados.data_recebimento);
      const dataAjustada = ajustarDataReceita(dataPretendida);
      const comp = calcularCompetenciaReceita(dataAjustada);
      
      updatePayload.data_recebimento = format(dataAjustada, 'yyyy-MM-dd');
      updatePayload.competencia = comp;
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
    // Para inserções simples via conta fixa, usamos lancarParcelas
    return lancarParcelas('receita', dados, userId, familyId);
  }
}

export async function lancarParcelas(
  tipo: 'despesa' | 'receita' | 'cartao' | 'emprestimo', 
  dados: (Partial<Despesa> & Partial<Receita> & { cartao_config?: CartaoConfig; vencimento_original?: string; cartao_id?: number; emprestimo_id?: number; conta_fixa_id?: number }), 
  userId: string,
  familyId: string
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
      family_id: familyId,
      descricao: dados.descricao,
      valor: valorParcela,
      competencia: comp,
      categoria: dados.categoria || categorizar(dados.descricao || ''),
    };

    if (tipo === 'despesa' || tipo === 'emprestimo') {
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
        user_id: userId,
        family_id: familyId,
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

  const table = tipo === 'despesa' || tipo === 'emprestimo' ? 'despesas' : tipo === 'receita' ? 'receitas' : 'cartoes';
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
    .eq('competencia', competencia);
  
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

  // 4. Buscar faturas "Em aberto" para limpar (migração para virtual)
  const { data: faturasEmAberto } = await supabase
    .from('despesas')
    .select('id')
    .eq('competencia', competencia)
    .like('descricao', 'Fatura %')
    .eq('status', 'Em aberto');

  const idsParaRemover = faturasEmAberto?.map(f => f.id);

  if (idsParaRemover && idsParaRemover.length > 0) {
    const { error: deleteError } = await supabase.from('despesas').delete().in('id', idsParaRemover);
    if (deleteError) throw deleteError;
  }
}

// ==================== NOVOS: EMPRÉSTIMOS ====================

export async function salvarEmprestimo(dados: Partial<Emprestimo>, userId: string, familyId: string) {
  if (dados.id) {
    const { error } = await supabase.from('emprestimos').update(dados).eq('id', dados.id);
    if (error) throw error;
    return { success: true };
  } else {
    // 1. Salvar mestre do empréstimo
    const { id, ...insertData } = dados;
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
  // 1. Deletar as despesas associadas primeiro (evita erro de FK se não houver cascade)
  // 1. Desvincular as despesas associadas para preservar o histórico
  await supabase
    .from('despesas')
    .update({ emprestimo_id: null })
    .eq('emprestimo_id', id);

  // 2. Deletar o mestre do empréstimo
  const { error } = await supabase.from('emprestimos').delete().eq('id', id);
  if (error) throw error;
  
  return { success: true };
}

// ==================== NOVOS: CONTAS FIXAS ====================

export async function salvarContaFixaConfig(dados: Partial<ContaFixaConfig>, userId: string, familyId: string) {
  if (dados.id) {
    const { error } = await supabase.from('contas_fixas').update(dados).eq('id', dados.id);
    if (error) throw error;
    return { success: true };
  } else {
    const { id, ...insertData } = dados;
    const { data, error } = await supabase
      .from('contas_fixas')
      .insert([{ ...insertData, user_id: userId, family_id: familyId }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

export async function deletarContaFixaConfig(id: number) {
  // 1. Desvincular as despesas associadas para preservar o histórico
  await supabase.from('despesas').update({ conta_fixa_id: null }).eq('conta_fixa_id', id);
  
  // 2. Desvincular as receitas associadas
  await supabase.from('receitas').update({ conta_fixa_id: null }).eq('conta_fixa_id', id);

  // 3. Deletar o mestre
  const { error } = await supabase.from('contas_fixas').delete().eq('id', id);
  if (error) throw error;
  
  return { success: true };
}

export function calculatePresentValue(vf: number, monthlyRatePercent: number, dueDate: string, refDate: Date): { vp: number, discount: number } {
  const i = monthlyRatePercent / 100;
  const targetDate = parseISO(dueDate);
  const now = startOfDay(refDate);
  
  const days = Math.max(0, differenceInDays(targetDate, now));
  const nMonths = days / 30;
  
  const vp = vf / Math.pow(1 + i, nMonths);
  const discount = vf - vp;
  
  return { vp, discount };
}
