import { useState, useEffect, useMemo, useCallback } from 'react';
import { Despesa, Receita, ConfigApp, Status, Titular, CartaoConfig, Categoria, CartaoTransacao, Nota } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export function useFinance(activeView: string) {
  const [user, setUser] = useState<User | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [cartaoTransacoes, setCartaoTransacoes] = useState<CartaoTransacao[]>([]);
  const [config, setConfig] = useState<ConfigApp>({ titulares: [], cartoes: [], categorias: [] });
  const [nota, setNota] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;

    setIsLoading(true);
    try {
      const [
        { data: despesasData },
        { data: receitasData },
        { data: cartaoTransacoesData },
        { data: titularesData },
        { data: cartoesConfigData },
        { data: categoriasData },
        { data: notaData }
      ] = await Promise.all([
        supabase.from('despesas').select('*').eq('user_id', targetId).order('id', { ascending: true }),
        supabase.from('receitas').select('*').eq('user_id', targetId).order('id', { ascending: true }),
        supabase.from('cartoes').select('*').eq('user_id', targetId).order('id', { ascending: true }),
        supabase.from('titulares').select('*').eq('user_id', targetId),
        supabase.from('cartoes_config').select('*').eq('user_id', targetId).order('id', { ascending: true }),
        supabase.from('categorias').select('*').eq('user_id', targetId).order('id', { ascending: true }),
        supabase.from('notas').select('conteudo').eq('user_id', targetId).maybeSingle()
      ]);

      if (despesasData) setDespesas(despesasData);
      if (receitasData) setReceitas(receitasData);
      if (cartaoTransacoesData) setCartaoTransacoes(cartaoTransacoesData);
      if (notaData) setNota(notaData.conteudo || '');

      setConfig({
        titulares: titularesData || [],
        cartoes: cartoesConfigData || [],
        categorias: categoriasData || []
      });

    } catch (error: any) {
      console.error('Error fetching data from Supabase:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchData(session.user.id);
        } else {
          setIsLoading(false);
        }
      })
      .catch(async (error) => {
        console.error('Error getting session:', error);
        // If there's a refresh token error, sign out to clear local storage
        if (error.message?.includes('refresh_token_not_found') || error.message?.includes('Refresh Token Not Found')) {
          await supabase.auth.signOut();
        }
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_OUT') {
        setDespesas([]);
        setReceitas([]);
        setCartaoTransacoes([]);
        setConfig({ titulares: [], cartoes: [], categorias: [] });
        setNota('');
        setIsLoading(false);
        return;
      }

      if (session?.user) {
        fetchData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

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
  const addDespesa = async (d: Omit<Despesa, 'id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('despesas').insert([{
      user_id: user.id,
      descricao: d.descricao,
      categoria_id: d.categoria_id,
      valor: d.valor,
      parcela_atual: d.parcela_atual,
      parcela_total: d.parcela_total,
      vencimento: d.vencimento,
      competencia: d.competencia,
      status: d.status,
      titular_id: d.titular_id,
      cartao_vencimento_id: d.cartao_vencimento_id,
      simulada: d.simulada
    }]).select();

    if (error) {
      console.error('Error adding despesa:', error);
      return;
    }

    if (data) {
      setDespesas(prev => [...prev, data[0]]);
    }
  };

  const updateDespesa = async (id: number, updates: Partial<Despesa>) => {
    const { error } = await supabase.from('despesas').update(updates).eq('id', id);
    if (!error) {
      setDespesas(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    }
  };

  const deleteDespesa = async (id: number) => {
    const { error } = await supabase.from('despesas').delete().eq('id', id);
    if (!error) {
      setDespesas(prev => prev.filter(d => d.id !== id));
    }
  };

  const addCartaoTransacao = async (t: Omit<CartaoTransacao, 'id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('cartoes').insert([{
      user_id: user.id,
      cartao_id: t.cartao_id,
      descricao: t.descricao,
      categoria_id: t.categoria_id,
      valor: t.valor,
      parcela_atual: t.parcela_atual,
      parcela_total: t.parcela_total,
      vencimento_original: t.vencimento_original,
      competencia: t.competencia,
      simulada: t.simulada
    }]).select();

    if (error) {
      console.error('Error adding cartao transacao:', error);
      return;
    }

    if (data) {
      setCartaoTransacoes(prev => [...prev, data[0]]);
    }
  };

  const updateCartaoTransacao = async (id: number, updates: Partial<CartaoTransacao>) => {
    const { error } = await supabase.from('cartoes').update(updates).eq('id', id);
    if (!error) {
      setCartaoTransacoes(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } else {
      console.error('Error updating cartao transacao:', error);
    }
  };

  const deleteCartaoTransacao = async (id: number) => {
    const { error } = await supabase.from('cartoes').delete().eq('id', id);
    if (!error) {
      setCartaoTransacoes(prev => prev.filter(t => t.id !== id));
    } else {
      console.error('Error deleting cartao transacao:', error);
    }
  };

  const addReceita = async (r: Omit<Receita, 'id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('receitas').insert([{
      user_id: user.id,
      descricao: r.descricao,
      valor: r.valor,
      data_recebimento: r.data_recebimento,
      competencia: r.competencia,
      titular_id: r.titular_id,
      simulada: r.simulada
    }]).select();

    if (error) {
      console.error('Error adding receita:', error);
      return;
    }

    if (data) {
      setReceitas(prev => [...prev, data[0]]);
    }
  };

  const updateReceita = async (id: number, updates: Partial<Receita>) => {
    const { error } = await supabase.from('receitas').update(updates).eq('id', id);
    if (!error) {
      setReceitas(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    }
  };

  const deleteReceita = async (id: number) => {
    const { error } = await supabase.from('receitas').delete().eq('id', id);
    if (!error) {
      setReceitas(prev => prev.filter(r => r.id !== id));
    }
  };

  const addTitular = async (t: Omit<Titular, 'id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('titulares').insert([{
      nome: t.nome,
      foto: t.foto,
      user_id: user.id
    }]).select();
    
    if (error) {
      console.error('Error adding titular:', error);
      return;
    }
    
    if (data) {
      setConfig(prev => ({ ...prev, titulares: [...prev.titulares, data[0]] }));
    }
  };

  const deleteTitular = async (id: number) => {
    const { error } = await supabase.from('titulares').delete().eq('id', id);
    if (!error) {
      setConfig(prev => ({ ...prev, titulares: prev.titulares.filter(t => t.id !== id) }));
    } else {
      console.error('Error deleting titular:', error);
    }
  };

  const updateTitular = async (id: number, updated: Partial<Titular>) => {
    const { error } = await supabase.from('titulares').update(updated).eq('id', id);
    if (!error) {
      setConfig(prev => ({
        ...prev,
        titulares: prev.titulares.map(t => t.id === id ? { ...t, ...updated } : t)
      }));
    } else {
      console.error('Error updating titular:', error);
    }
  };

  const addCartao = async (c: Omit<CartaoConfig, 'id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('cartoes_config').insert([{
      user_id: user.id,
      nome_cartao: c.nome_cartao,
      titular_id: c.titular_id,
      dia_vencimento: c.dia_vencimento,
      dia_fechamento: c.dia_fechamento
    }]).select();

    if (error) {
      console.error('Error adding cartao:', error);
      return;
    }

    if (data) {
      setConfig(prev => ({ ...prev, cartoes: [...prev.cartoes, data[0]] }));
    }
  };

  const updateCartao = async (id: number, updated: Partial<CartaoConfig>) => {
    const { error } = await supabase.from('cartoes_config').update(updated).eq('id', id);
    if (!error) {
      setConfig(prev => ({
        ...prev,
        cartoes: prev.cartoes.map(c => c.id === id ? { ...c, ...updated } : c)
      }));
    }
  };

  const deleteCartao = async (id: number) => {
    const { error } = await supabase.from('cartoes_config').delete().eq('id', id);
    if (!error) {
      setConfig(prev => ({ ...prev, cartoes: prev.cartoes.filter(c => c.id !== id) }));
    }
  };

  const addCategoria = async (cat: Omit<Categoria, 'id'>) => {
    if (!user) return;
    const { data, error } = await supabase.from('categorias').insert([{
      user_id: user.id,
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

  const updateCategoria = async (id: number, updated: Partial<Categoria>) => {
    const { error } = await supabase.from('categorias').update(updated).eq('id', id);
    if (!error) {
      setConfig(prev => ({
        ...prev,
        categorias: prev.categorias.map(cat => cat.id === id ? { ...cat, ...updated } : cat)
      }));
    }
  };

  const deleteCategoria = async (id: number) => {
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (!error) {
      setConfig(prev => ({ ...prev, categorias: prev.categorias.filter(cat => cat.id !== id) }));
    }
  };

  const updateNota = async (conteudo: string) => {
    if (!user) return;
    const { error } = await supabase.from('notas').upsert({ user_id: user.id, conteudo });
    if (!error) setNota(conteudo);
  };

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const filteredDespesas = useMemo(() => {
    return despesas.filter(d => d.competencia === competencia);
  }, [despesas, competencia]);

  const filteredReceitas = useMemo(() => {
    return receitas.filter(r => r.competencia === competencia);
  }, [receitas, competencia]);

  const filteredCartaoTransacoes = useMemo(() => {
    return cartaoTransacoes
      .filter(t => t.competencia === competencia)
      .map(t => {
        const cardConfig = config.cartoes.find(c => c.id === t.cartao_id);
        return {
          ...t,
          titular_id: cardConfig?.titular_id || 0,
          cartao_vencimento_id: t.cartao_id // Alias for FinanceTable compatibility
        };
      });
  }, [cartaoTransacoes, competencia, config.cartoes]);

  const despesasGerais = useMemo(() => {
    // 1. Get expenses without card
    const semCartao = filteredDespesas.filter(d => !d.cartao_vencimento_id);
    
    // 2. Group expenses by card (from both despesas and cartoes tables)
    const porCartao: Record<number, { valor: number, status: Status, titular_id: number, nome_cartao: string }> = {};
    
    // From despesas (consolidated)
    filteredDespesas.filter(d => d.cartao_vencimento_id).forEach(d => {
      const cartaoId = d.cartao_vencimento_id!;
      const cartaoConfig = config.cartoes.find(c => c.id === cartaoId);
      if (!porCartao[cartaoId]) {
        porCartao[cartaoId] = { 
          valor: 0, 
          status: 'Pago', 
          titular_id: cartaoConfig?.titular_id || 0,
          nome_cartao: cartaoConfig?.nome_cartao || 'Cartão'
        };
      }
      porCartao[cartaoId].valor += d.valor;
      if (d.status === 'Em aberto') porCartao[cartaoId].status = 'Em aberto';
    });

    // From cartoes (individual transactions)
    filteredCartaoTransacoes.forEach(t => {
      const cartaoId = t.cartao_id;
      const cartaoConfig = config.cartoes.find(c => c.id === cartaoId);
      if (!porCartao[cartaoId]) {
        porCartao[cartaoId] = { 
          valor: 0, 
          status: 'Em aberto', // Individual transactions are usually considered "open" until the invoice is paid
          titular_id: cartaoConfig?.titular_id || 0,
          nome_cartao: cartaoConfig?.nome_cartao || 'Cartão'
        };
      }
      porCartao[cartaoId].valor += t.valor;
      // Individual transactions in 'cartoes' table are always considered 'Em aberto' for the summary
      porCartao[cartaoId].status = 'Em aberto';
    });

    // 3. Create summary items for cards
    const resumosCartao = Object.entries(porCartao).map(([idStr, info], index) => ({
      id: -1000 - index,
      descricao: info.nome_cartao,
      categoria_id: undefined,
      valor: info.valor,
      parcela_atual: 1,
      parcela_total: 1,
      vencimento: '-',
      competencia,
      status: info.status as Status,
      titular_id: info.titular_id,
      cartao_vencimento_id: parseInt(idStr),
      simulada: false,
      isSummary: true
    }));

    return [...semCartao, ...resumosCartao];
  }, [filteredDespesas, filteredCartaoTransacoes, competencia, config.cartoes]);

  const stats = useMemo(() => {
    const totalReceitas = filteredReceitas.reduce((acc, r) => acc + (r.simulada ? 0 : (Number(r.valor) || 0)), 0);
    const totalDespesas = filteredDespesas.reduce((acc, d) => acc + (d.simulada ? 0 : (Number(d.valor) || 0)), 0) + 
                          filteredCartaoTransacoes.reduce((acc, t) => acc + (t.simulada ? 0 : (Number(t.valor) || 0)), 0);
    const totalPago = filteredDespesas.filter(d => d.status === 'Pago').reduce((acc, d) => acc + (d.simulada ? 0 : (Number(d.valor) || 0)), 0);
    const totalAberto = filteredDespesas.filter(d => d.status === 'Em aberto').reduce((acc, d) => acc + (d.simulada ? 0 : (Number(d.valor) || 0)), 0) +
                        filteredCartaoTransacoes.reduce((acc, t) => acc + (t.simulada ? 0 : (Number(t.valor) || 0)), 0);
    
    // Check for overdue (Vencido)
    const today = new Date();
    const totalVencido = filteredDespesas
      .filter(d => d.status === 'Em aberto' && d.vencimento && new Date(d.vencimento) < today)
      .reduce((acc, d) => acc + (d.simulada ? 0 : (Number(d.valor) || 0)), 0);

    const margem = totalReceitas - totalDespesas;

    return {
      totalReceitas: totalReceitas || 0,
      totalDespesas: totalDespesas || 0,
      totalPago: totalPago || 0,
      totalAberto: totalAberto || 0,
      totalVencido: totalVencido || 0,
      margem: margem || 0
    };
  }, [filteredReceitas, filteredDespesas, filteredCartaoTransacoes]);

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
    const totals: Record<number, number> = {};
    config.cartoes.forEach(c => totals[c.id] = 0);
    
    // Include card transactions from 'cartoes' table
    filteredCartaoTransacoes.forEach(t => {
      if (!t.simulada) {
        totals[t.cartao_id] = (totals[t.cartao_id] || 0) + (Number(t.valor) || 0);
      }
    });

    // Also include card transactions that might be in 'despesas' table (consolidated invoices)
    filteredDespesas.forEach(d => {
      if (d.cartao_vencimento_id && !d.simulada) {
        totals[d.cartao_vencimento_id] = (totals[d.cartao_vencimento_id] || 0) + (Number(d.valor) || 0);
      }
    });
    return totals;
  }, [filteredDespesas, filteredCartaoTransacoes, config.cartoes]);

  const totalsByTitular = useMemo(() => {
    const totals: Record<number, { despesas: number, receitas: number }> = {};
    config.titulares.forEach(t => totals[t.id] = { despesas: 0, receitas: 0 });
    
    filteredDespesas.forEach(d => {
      if (!d.simulada && totals[d.titular_id]) {
        totals[d.titular_id].despesas += (Number(d.valor) || 0);
      }
    });

    filteredCartaoTransacoes.forEach(t => {
      if (!t.simulada && totals[t.titular_id]) {
        totals[t.titular_id].despesas += (Number(t.valor) || 0);
      }
    });

    filteredReceitas.forEach(r => {
      if (!r.simulada && totals[r.titular_id]) {
        totals[r.titular_id].receitas += (Number(r.valor) || 0);
      }
    });

    return totals;
  }, [filteredDespesas, filteredReceitas, filteredCartaoTransacoes, config.titulares]);

  const projecaoSemestral = useMemo(() => {
    const projecao = [];
    let tempMonth = currentMonth;
    let tempYear = currentYear;

    for (let i = 0; i < 8; i++) {
      const comp = `${String(tempMonth).padStart(2, '0')}/${tempYear}`;
      const rec = receitas.filter(r => r.competencia === comp).reduce((acc, r) => acc + (r.simulada ? 0 : (Number(r.valor) || 0)), 0);
      const desp = despesas.filter(d => d.competencia === comp).reduce((acc, d) => acc + (d.simulada ? 0 : (Number(d.valor) || 0)), 0);
      const cardTrans = cartaoTransacoes.filter(t => t.competencia === comp).reduce((acc, t) => acc + (t.simulada ? 0 : (Number(t.valor) || 0)), 0);
      
      projecao.push({
        competencia: comp,
        receitas: rec || 0,
        despesas: (desp + cardTrans) || 0,
        saldo: (rec - (desp + cardTrans)) || 0
      });

      tempMonth++;
      if (tempMonth > 12) {
        tempMonth = 1;
        tempYear++;
      }
    }
    return projecao;
  }, [despesas, receitas, cartaoTransacoes, currentMonth, currentYear]);

  return {
    user,
    despesas,
    receitas,
    cartaoTransacoes,
    config,
    nota,
    currentMonth,
    currentYear,
    competencia,
    filteredDespesas,
    filteredReceitas,
    filteredCartaoTransacoes,
    despesasGerais,
    stats,
    totalsByCard,
    totalsByTitular,
    projecaoSemestral,
    isLoading,
    isDarkMode,
    changeMonth,
    setMonth,
    setYear,
    toggleDarkMode,
    updateNota,
    signIn,
    signUp,
    signOut,
    addDespesa,
    updateDespesa,
    deleteDespesa,
    addReceita,
    updateReceita,
    deleteReceita,
    addCartaoTransacao,
    updateCartaoTransacao,
    deleteCartaoTransacao,
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
