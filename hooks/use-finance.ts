import { useState, useEffect, useMemo, useCallback } from 'react';
import { Despesa, Receita, ConfigApp, Status, Titular, CartaoConfig, Categoria } from '@/lib/types';
import { MOCK_DESPESAS, MOCK_RECEITAS, MOCK_CONFIG } from '@/lib/mock-data';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export function useFinance(activeView: string) {
  const [user, setUser] = useState<User | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [config, setConfig] = useState<ConfigApp>({ titulares: [], cartoes: [], categorias: [] });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<{ owner_id: string, owner_email: string }[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  const fetchWorkspaces = useCallback(async (userId: string, email: string) => {
    // Fetch memberships
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('owner_id')
      .eq('member_id', userId);
    
    // Fetch invites
    const { data: invites } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('invitee_email', email)
      .eq('status', 'pending');
    
    if (invites) setPendingInvites(invites);

    if (memberships) {
      setWorkspaces(memberships.map(m => ({ owner_id: m.owner_id, owner_email: 'Shared Dashboard' })));
    }
  }, []);

  const fetchData = useCallback(async (workspaceId?: string) => {
    const targetId = workspaceId || activeWorkspaceId;
    if (!targetId) return;

    setIsLoading(true);
    try {
      const [
        { data: despesasData },
        { data: receitasData },
        { data: titularesData },
        { data: cartoesData },
        { data: categoriasData }
      ] = await Promise.all([
        supabase.from('despesas').select('*').eq('user_id', targetId).order('linha', { ascending: true }),
        supabase.from('receitas').select('*').eq('user_id', targetId).order('linha', { ascending: true }),
        supabase.from('titulares').select('*').eq('user_id', targetId),
        supabase.from('cartoes').select('*').eq('user_id', targetId).order('linha', { ascending: true }),
        supabase.from('categorias').select('*').eq('user_id', targetId).order('linha', { ascending: true })
      ]);

      if (despesasData) setDespesas(despesasData.map(d => ({
        ...d,
        categoria: d.categoria_label,
        titular: d.titular_nome,
        cartao: d.cartao_nome,
        vencimentoIso: d.vencimento_iso
      })));
      
      if (receitasData) setReceitas(receitasData.map(r => ({
        ...r,
        titular: r.titular_nome,
        parcelas: r.parcelas
      })));

      setConfig({
        titulares: titularesData || [],
        cartoes: (cartoesData || []).map(c => ({ ...c, titular: c.titular_nome })),
        categorias: categoriasData || []
      });

    } catch (error: any) {
      console.error('Error fetching data from Supabase:', error);
      if (error.message === 'Invalid API key') {
        console.error('The Supabase API key is invalid. Please check your .env.local file.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setActiveWorkspaceId(session.user.id);
        fetchData(session.user.id);
        fetchWorkspaces(session.user.id, session.user.email || '');
      }
      else setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setActiveWorkspaceId(session.user.id);
        fetchData(session.user.id);
        fetchWorkspaces(session.user.id, session.user.email || '');
      }
      else {
        setDespesas([]);
        setReceitas([]);
        setConfig({ titulares: [], cartoes: [], categorias: [] });
        setWorkspaces([]);
        setPendingInvites([]);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData, fetchWorkspaces]);

  // Sync dark mode to localStorage
  useEffect(() => {
    const savedDark = localStorage.getItem('fin_dark');
    if (savedDark) {
      const dark = JSON.parse(savedDark);
      setIsDarkMode(dark);
      if (dark) document.body.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('fin_dark', JSON.stringify(isDarkMode));
    if (isDarkMode) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  }, [isDarkMode]);

  const competencia = useMemo(() => {
    return `${String(currentMonth).padStart(2, '0')}/${currentYear}`;
  }, [currentMonth, currentYear]);

  // Auth Methods
  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  const signUp = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({ email, password: pass });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // CRUD Operations with Supabase sync
  const addDespesa = async (d: Omit<Despesa, 'linha'>) => {
    if (!activeWorkspaceId) return;
    const { data, error } = await supabase.from('despesas').insert([{
      user_id: activeWorkspaceId,
      descricao: d.descricao,
      categoria_label: d.categoria,
      valor: d.valor,
      parcela: d.parcela,
      vencimento: d.vencimento,
      vencimento_iso: d.vencimentoIso,
      competencia: d.competencia,
      status: d.status,
      titular_nome: d.titular,
      cartao_nome: d.cartao,
      simulada: d.simulada
    }]).select();

    if (error) {
      console.error('Error adding despesa:', error);
      return;
    }

    if (data) {
      const newDespesa = {
        ...data[0],
        categoria: data[0].categoria_label,
        titular: data[0].titular_nome,
        cartao: data[0].cartao_nome,
        vencimentoIso: data[0].vencimento_iso
      };
      setDespesas(prev => [...prev, newDespesa]);
    }
  };

  const updateDespesa = async (linha: number, updates: Partial<Despesa>) => {
    const supabaseUpdates: any = {};
    if (updates.descricao) supabaseUpdates.descricao = updates.descricao;
    if (updates.categoria) supabaseUpdates.categoria_label = updates.categoria;
    if (updates.valor) supabaseUpdates.valor = updates.valor;
    if (updates.parcela) supabaseUpdates.parcela = updates.parcela;
    if (updates.vencimento) supabaseUpdates.vencimento = updates.vencimento;
    if (updates.vencimentoIso) supabaseUpdates.vencimento_iso = updates.vencimentoIso;
    if (updates.competencia) supabaseUpdates.competencia = updates.competencia;
    if (updates.status) supabaseUpdates.status = updates.status;
    if (updates.titular) supabaseUpdates.titular_nome = updates.titular;
    if (updates.cartao !== undefined) supabaseUpdates.cartao_nome = updates.cartao;
    if (updates.simulada !== undefined) supabaseUpdates.simulada = updates.simulada;

    const { error } = await supabase.from('despesas').update(supabaseUpdates).eq('linha', linha);
    if (!error) {
      setDespesas(prev => prev.map(d => d.linha === linha ? { ...d, ...updates } : d));
    }
  };

  const deleteDespesa = async (linha: number) => {
    const { error } = await supabase.from('despesas').delete().eq('linha', linha);
    if (!error) {
      setDespesas(prev => prev.filter(d => d.linha !== linha));
    }
  };

  const addReceita = async (r: Omit<Receita, 'linha'>) => {
    if (!activeWorkspaceId) return;
    const { data, error } = await supabase.from('receitas').insert([{
      user_id: activeWorkspaceId,
      descricao: r.descricao,
      valor: r.valor,
      parcelas: r.parcelas,
      recebimento: r.recebimento,
      competencia: r.competencia,
      titular_nome: r.titular,
      simulada: r.simulada
    }]).select();

    if (error) {
      console.error('Error adding receita:', error);
      return;
    }

    if (data) {
      const newReceita = {
        ...data[0],
        titular: data[0].titular_nome,
        parcelas: data[0].parcelas
      };
      setReceitas(prev => [...prev, newReceita]);
    }
  };

  const updateReceita = async (linha: number, updates: Partial<Receita>) => {
    const supabaseUpdates: any = {};
    if (updates.descricao) supabaseUpdates.descricao = updates.descricao;
    if (updates.valor) supabaseUpdates.valor = updates.valor;
    if (updates.parcelas) supabaseUpdates.parcelas = updates.parcelas;
    if (updates.recebimento) supabaseUpdates.recebimento = updates.recebimento;
    if (updates.competencia) supabaseUpdates.competencia = updates.competencia;
    if (updates.titular) supabaseUpdates.titular_nome = updates.titular;
    if (updates.simulada !== undefined) supabaseUpdates.simulada = updates.simulada;

    const { error } = await supabase.from('receitas').update(supabaseUpdates).eq('linha', linha);
    if (!error) {
      setReceitas(prev => prev.map(r => r.linha === linha ? { ...r, ...updates } : r));
    }
  };

  const deleteReceita = async (linha: number) => {
    const { error } = await supabase.from('receitas').delete().eq('linha', linha);
    if (!error) {
      setReceitas(prev => prev.filter(r => r.linha !== linha));
    }
  };

  const addTitular = async (t: Omit<Titular, 'linha'>) => {
    if (!activeWorkspaceId) return;
    const { data, error } = await supabase.from('titulares').insert([{
      nome: t.nome,
      foto: t.foto,
      user_id: activeWorkspaceId
    }]).select();
    
    if (error) {
      console.error('Error adding titular:', error);
      return;
    }
    
    if (data) {
      setConfig(prev => ({ ...prev, titulares: [...prev.titulares, data[0]] }));
    }
  };

  const deleteTitular = async (linha: number) => {
    const { error } = await supabase.from('titulares').delete().eq('linha', linha);
    if (!error) {
      setConfig(prev => ({ ...prev, titulares: prev.titulares.filter(t => t.linha !== linha) }));
    } else {
      console.error('Error deleting titular:', error);
    }
  };

  const updateTitular = async (linha: number, updated: Partial<Titular>) => {
    const { error } = await supabase.from('titulares').update(updated).eq('linha', linha);
    if (!error) {
      const oldTitular = config.titulares.find(t => t.linha === linha);
      setConfig(prev => ({
        ...prev,
        titulares: prev.titulares.map(t => t.linha === linha ? { ...t, ...updated } : t)
      }));
      
      if (updated.nome && oldTitular && oldTitular.nome !== updated.nome) {
        setDespesas(prev => prev.map(d => d.titular === oldTitular.nome ? { ...d, titular: updated.nome! } : d));
        setReceitas(prev => prev.map(r => r.titular === oldTitular.nome ? { ...r, titular: updated.nome! } : r));
      }
    } else {
      console.error('Error updating titular:', error);
    }
  };

  const addCartao = async (c: Omit<CartaoConfig, 'linha'>) => {
    if (!activeWorkspaceId) return;
    const { data, error } = await supabase.from('cartoes').insert([{
      user_id: activeWorkspaceId,
      nome: c.nome,
      titular_nome: c.titular,
      dia_vencimento: c.diaVencimento,
      dia_fechamento: c.diaFechamento
    }]).select();

    if (error) {
      console.error('Error adding cartao:', error);
      return;
    }

    if (data) {
      const newCartao = {
        ...data[0],
        titular: data[0].titular_nome,
        diaVencimento: data[0].dia_vencimento,
        diaFechamento: data[0].dia_fechamento
      };
      setConfig(prev => ({ ...prev, cartoes: [...prev.cartoes, newCartao] }));
    }
  };

  const updateCartao = async (linha: number, updated: Partial<CartaoConfig>) => {
    const supabaseUpdates: any = {};
    if (updated.nome) supabaseUpdates.nome = updated.nome;
    if (updated.titular) supabaseUpdates.titular_nome = updated.titular;
    if (updated.diaVencimento) supabaseUpdates.dia_vencimento = updated.diaVencimento;
    if (updated.diaFechamento) supabaseUpdates.dia_fechamento = updated.diaFechamento;

    const { error } = await supabase.from('cartoes').update(supabaseUpdates).eq('linha', linha);
    if (!error) {
      setConfig(prev => ({
        ...prev,
        cartoes: prev.cartoes.map(c => c.linha === linha ? { ...c, ...updated } : c)
      }));
    }
  };

  const deleteCartao = async (linha: number) => {
    const { error } = await supabase.from('cartoes').delete().eq('linha', linha);
    if (!error) {
      setConfig(prev => ({ ...prev, cartoes: prev.cartoes.filter(c => c.linha !== linha) }));
    }
  };

  const addCategoria = async (cat: Omit<Categoria, 'linha'>) => {
    if (!activeWorkspaceId) return;
    const { data, error } = await supabase.from('categorias').insert([{
      user_id: activeWorkspaceId,
      label: cat.label,
      keywords: cat.keywords
    }]).select();
    if (error) {
      console.error('Error adding categoria:', error);
      return;
    }
    if (data) {
      setConfig(prev => ({ ...prev, categorias: [...prev.categorias, data[0]] }));
    }
  };

  const updateCategoria = async (linha: number, updated: Partial<Categoria>) => {
    const { error } = await supabase.from('categorias').update(updated).eq('linha', linha);
    if (!error) {
      setConfig(prev => ({
        ...prev,
        categorias: prev.categorias.map(cat => cat.linha === linha ? { ...cat, ...updated } : cat)
      }));
    }
  };

  const deleteCategoria = async (linha: number) => {
    const { error } = await supabase.from('categorias').delete().eq('linha', linha);
    if (!error) {
      setConfig(prev => ({ ...prev, categorias: prev.categorias.filter(cat => cat.linha !== linha) }));
    }
  };

  const sendInvite = async (email: string) => {
    if (!user) return;
    const { error } = await supabase.from('workspace_invites').insert([{
      owner_id: user.id,
      invitee_email: email
    }]);
    if (error) throw error;
  };

  const acceptInvite = async (inviteId: string, ownerId: string) => {
    if (!user) return;
    
    // 1. Add to members
    const { error: memberError } = await supabase.from('workspace_members').insert([{
      owner_id: ownerId,
      member_id: user.id
    }]);
    
    if (memberError) throw memberError;

    // 2. Update invite status
    await supabase.from('workspace_invites').update({ status: 'accepted' }).eq('id', inviteId);
    
    // 3. Refresh
    fetchWorkspaces(user.id, user.email || '');
  };

  const switchWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    fetchData(workspaceId);
  };

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const filteredDespesas = useMemo(() => {
    return despesas.filter(d => d.competencia === competencia);
  }, [despesas, competencia]);

  const filteredReceitas = useMemo(() => {
    return receitas.filter(r => r.competencia === competencia);
  }, [receitas, competencia]);

  const despesasGerais = useMemo(() => {
    // 1. Get expenses without card
    const semCartao = filteredDespesas.filter(d => !d.cartao);
    
    // 2. Group expenses by card
    const porCartao: Record<string, { valor: number, status: Status, titular: string }> = {};
    filteredDespesas.filter(d => d.cartao).forEach(d => {
      const cartaoNome = d.cartao!;
      if (!porCartao[cartaoNome]) {
        porCartao[cartaoNome] = { valor: 0, status: 'Pago', titular: d.titular };
      }
      porCartao[cartaoNome].valor += d.valor;
      // If any item is 'Em aberto', the whole bill is 'Em aberto'
      if (d.status === 'Em aberto') porCartao[cartaoNome].status = 'Em aberto';
    });

    // 3. Create summary items for cards
    const resumosCartao = Object.entries(porCartao).map(([nome, info], index) => ({
      linha: -1000 - index,
      descricao: nome,
      categoria: 'Cartão de Crédito',
      valor: info.valor,
      parcela: '1/1',
      vencimento: '-',
      vencimentoIso: new Date().toISOString(),
      competencia,
      status: info.status as Status,
      titular: info.titular,
      cartao: nome,
      simulada: false,
      isSummary: true
    }));

    return [...semCartao, ...resumosCartao];
  }, [filteredDespesas, competencia]);

  const stats = useMemo(() => {
    const totalReceitas = filteredReceitas.reduce((acc, r) => acc + (r.simulada ? 0 : r.valor), 0);
    const totalDespesas = filteredDespesas.reduce((acc, d) => acc + (d.simulada ? 0 : d.valor), 0);
    const totalPago = filteredDespesas.filter(d => d.status === 'Pago').reduce((acc, d) => acc + (d.simulada ? 0 : d.valor), 0);
    const totalAberto = filteredDespesas.filter(d => d.status === 'Em aberto').reduce((acc, d) => acc + (d.simulada ? 0 : d.valor), 0);
    
    // Check for overdue (Vencido)
    const today = new Date();
    const totalVencido = filteredDespesas
      .filter(d => d.status === 'Em aberto' && d.vencimentoIso && new Date(d.vencimentoIso) < today)
      .reduce((acc, d) => acc + (d.simulada ? 0 : d.valor), 0);

    const margem = totalReceitas - totalDespesas;

    return {
      totalReceitas,
      totalDespesas,
      totalPago,
      totalAberto,
      totalVencido,
      margem
    };
  }, [filteredReceitas, filteredDespesas]);

  const changeMonth = (delta: number) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const setMonth = (month: number) => {
    setCurrentMonth(month);
  };

  const setYear = (year: number) => {
    setCurrentYear(year);
  };

  const totalsByCard = useMemo(() => {
    const totals: Record<string, number> = {};
    config.cartoes.forEach(c => totals[c.nome] = 0);
    
    filteredDespesas.forEach(d => {
      if (d.cartao && !d.simulada) {
        totals[d.cartao] = (totals[d.cartao] || 0) + d.valor;
      }
    });
    return totals;
  }, [filteredDespesas, config.cartoes]);

  const totalsByTitular = useMemo(() => {
    const totals: Record<string, { despesas: number, receitas: number }> = {};
    config.titulares.forEach(t => totals[t.nome] = { despesas: 0, receitas: 0 });
    
    filteredDespesas.forEach(d => {
      if (!d.simulada && totals[d.titular]) {
        totals[d.titular].despesas += d.valor;
      }
    });

    filteredReceitas.forEach(r => {
      if (!r.simulada && totals[r.titular]) {
        totals[r.titular].receitas += r.valor;
      }
    });

    return totals;
  }, [filteredDespesas, filteredReceitas, config.titulares]);

  const projecaoSemestral = useMemo(() => {
    const projecao = [];
    let tempMonth = currentMonth;
    let tempYear = currentYear;

    for (let i = 0; i < 8; i++) {
      const comp = `${String(tempMonth).padStart(2, '0')}/${tempYear}`;
      const rec = receitas.filter(r => r.competencia === comp).reduce((acc, r) => acc + (r.simulada ? 0 : r.valor), 0);
      const desp = despesas.filter(d => d.competencia === comp).reduce((acc, d) => acc + (d.simulada ? 0 : d.valor), 0);
      
      projecao.push({
        competencia: comp,
        receitas: rec,
        despesas: desp,
        saldo: rec - desp
      });

      tempMonth++;
      if (tempMonth > 12) {
        tempMonth = 1;
        tempYear++;
      }
    }
    return projecao;
  }, [despesas, receitas, currentMonth, currentYear]);

  return {
    user,
    despesas,
    receitas,
    config,
    currentMonth,
    currentYear,
    competencia,
    filteredDespesas,
    filteredReceitas,
    despesasGerais,
    stats,
    totalsByCard,
    totalsByTitular,
    projecaoSemestral,
    isLoading,
    isDarkMode,
    activeWorkspaceId,
    workspaces,
    pendingInvites,
    changeMonth,
    setMonth,
    setYear,
    toggleDarkMode,
    switchWorkspace,
    sendInvite,
    acceptInvite,
    signIn,
    signUp,
    signOut,
    addDespesa,
    updateDespesa,
    deleteDespesa,
    addReceita,
    updateReceita,
    deleteReceita,
    addTitular,
    updateTitular,
    deleteTitular,
    addCartao,
    updateCartao,
    deleteCartao,
    addCategoria,
    updateCategoria,
    deleteCategoria,
    setDespesas,
    setReceitas,
    setConfig
  };
}
