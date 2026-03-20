import { useState, useEffect, useMemo, useCallback } from 'react';
import { Despesa, Receita, ConfigApp, Status, Titular, CartaoConfig, Categoria, CartaoTransacao, Nota } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { salvarDespesa, salvarReceita, consolidarFaturas, lancarParcelas } from '@/lib/finance-service';
import { format, addMonths } from 'date-fns';

export function useFinance(activeView: string) {
  const [user, setUser] = useState<User | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [cartaoTransacoes, setCartaoTransacoes] = useState<CartaoTransacao[]>([]);
  const [config, setConfig] = useState<ConfigApp>({ titulares: [], cartoes: [] });
  const [nota, setNota] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userType, setUserType] = useState<'titular' | 'membro'>('membro');

  const fetchData = useCallback(async (userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;

    setIsLoading(true);
    const now = new Date();
    const sixMonthsAgo = format(addMonths(now, -6), 'yyyy-MM-01');

    try {
      const [
        { data: despesasData },
        { data: receitasData },
        { data: cartaoTransacoesData },
        { data: titularesData },
        { data: cartoesConfigData },
        { data: notaData }
      ] = await Promise.all([
        supabase.from('despesas').select('*').gte('vencimento', sixMonthsAgo).order('id', { ascending: true }),
        supabase.from('receitas').select('*').gte('data_recebimento', sixMonthsAgo).order('id', { ascending: true }),
        supabase.from('cartoes').select('*').gte('data_compra', sixMonthsAgo).order('id', { ascending: true }),
        supabase.from('titulares').select('*'),
        supabase.from('cartoes_config').select('*').order('id', { ascending: true }),
        supabase.from('notas').select('conteudo').maybeSingle()
      ]);

      if (despesasData) {
        setDespesas(despesasData.map(d => ({
          ...d,
          isSummary: d.descricao.startsWith('Fatura ')
        })));
      }
      if (receitasData) setReceitas(receitasData);
      if (cartaoTransacoesData) setCartaoTransacoes(cartaoTransacoesData);
      if (notaData) setNota(notaData.conteudo || '');

      setConfig({
        titulares: titularesData || [],
        cartoes: cartoesConfigData || []
      });

    } catch (error) {
      console.error('Error fetching data from Supabase:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('profiles').select('family_id, nome, tipo').eq('id', user.id).maybeSingle();
    if (data) {
      setFamilyId(data.family_id);
      setUserName(data.nome);
      setUserType(data.tipo as 'titular' | 'membro');
    }
  }, [user?.id]);

  const inviteMember = async (email: string) => {
    if (!user || !familyId || userType !== 'titular') return { error: 'Apenas titulares podem convidar.' };
    
    const { error } = await supabase.from('convites').insert({
      family_id: familyId,
      email: email.toLowerCase().trim()
    });

    if (error) {
      if (error.code === '23505') return { error: 'Este e-mail já possui um convite pendente.' };
      return { error: error.message };
    }

    return { success: true };
  };

  // Carregamento de dados disparado por mudanças no usuário ou no período
  useEffect(() => {
    if (user?.id) {
      fetchData(user.id);
      fetchProfile();
    }
  }, [user?.id, currentMonth, currentYear, fetchData, fetchProfile]);

  // Auth listener - roda apenas uma vez para configurar o ouvinte
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (!session?.user) setIsLoading(false);
      })
      .catch(async (error) => {
        console.error('Error getting session:', error);
        if (error.message?.includes('refresh_token_not_found')) {
          await supabase.auth.signOut();
        }
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_OUT') {
        setDespesas([]);
        setReceitas([]);
        setCartaoTransacoes([]);
        setConfig({ titulares: [], cartoes: [] });
        setNota('');
        setFamilyId(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const signUp = async (email: string, pass: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          display_name: name
        }
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // CRUD Operations with Supabase sync
  const addDespesa = async (d: Omit<Despesa, 'id'>) => {
    if (!user) return;
    try {
      if (d.cartao_vencimento_id) {
        // Se for despesa de cartão, lança na tabela 'cartoes' (pode ser parcelado)
        const cartaoConfig = config.cartoes.find(c => c.id === d.cartao_vencimento_id);
        await lancarParcelas('cartao', {
          ...d,
          cartao_id: d.cartao_vencimento_id,
          cartao_config: cartaoConfig
        }, user.id);
      } else {
        // Despesa fixa/variável normal
        await salvarDespesa(d, user.id);
      }
      await fetchData();
    } catch (error) {
      console.error('Error adding despesa:', error);
    }
  };

  const updateDespesa = async (id: number, updates: Partial<Despesa>) => {
    if (!user) return;
    try {
      await salvarDespesa({ ...updates, id }, user.id);
      await fetchData();
    } catch (error) {
      console.error('Error updating despesa:', error);
    }
  };

  const deleteDespesa = async (id: number) => {
    if (!user) return;
    try {
      const { data: item } = await supabase.from('despesas').select('competencia').eq('id', id).single();
      const { error } = await supabase.from('despesas').delete().eq('id', id);
      if (error) throw error;
      if (item) await consolidarFaturas(item.competencia, user.id);
      await fetchData();
    } catch (error) {
      console.error('Error deleting despesa:', error);
    }
  };

  const deleteCartaoTransacao = async (id: number) => {
    if (!user) return;
    try {
      const { data: item } = await supabase.from('cartoes').select('competencia').eq('id', id).single();
      const { error } = await supabase.from('cartoes').delete().eq('id', id);
      if (error) throw error;
      if (item) await consolidarFaturas(item.competencia, user.id);
      await fetchData();
    } catch (error) {
      console.error('Error deleting cartao transacao:', error);
    }
  };

  const updateCartaoTransacao = async (id: number, updates: Partial<CartaoTransacao>) => {
    if (!user) return;
    try {
      const { data: item } = await supabase.from('cartoes').select('competencia').eq('id', id).single();
      const { error } = await supabase.from('cartoes').update({
        ...updates,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      
      if (item) await consolidarFaturas(item.competencia, user.id);
      if (updates.competencia && updates.competencia !== item?.competencia) {
        await consolidarFaturas(updates.competencia, user.id);
      }
      
      await fetchData();
    } catch (error) {
      console.error('Error updating cartao transacao:', error);
    }
  };

  const addReceita = async (r: Omit<Receita, 'id'>) => {
    if (!user) return;
    try {
      await salvarReceita(r, user.id);
      await fetchData();
    } catch (error) {
      console.error('Error adding receita:', error);
    }
  };

  const updateReceita = async (id: number, updates: Partial<Receita>) => {
    if (!user) return;
    try {
      await salvarReceita({ ...updates, id }, user.id);
      await fetchData();
    } catch (error) {
      console.error('Error updating receita:', error);
    }
  };

  const deleteReceita = async (id: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('receitas').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error deleting receita:', error);
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

  const updateNota = async (conteudo: string) => {
    if (!user) return;
    // Em um sistema multi-tenancy, o RLS e o DEFAULT get_my_family_id() 
    // cuidarão para que o upsert caia na linha correta da família.
    const { error } = await supabase.from('notas').upsert({ conteudo });
    if (!error) setNota(conteudo);
    else console.error('Error updating nota:', error);
  };

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const filteredDespesas = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return despesas.filter(d => {
      if (d.competencia === competencia) return true;
      if (d.status === 'Em aberto' && d.vencimento && d.vencimento !== '-' && d.vencimento < todayStr) {
        return true;
      }
      return false;
    });
  }, [despesas, competencia]);

  const filteredReceitas = useMemo(() => {
    return receitas.filter(r => r.competencia === competencia);
  }, [receitas, competencia]);

  const filteredCartaoTransacoes = useMemo(() => {
    return cartaoTransacoes.filter(c => c.competencia === competencia);
  }, [cartaoTransacoes, competencia]);

  const despesasGerais = useMemo(() => {
    // 1. Get expenses without card (these are fixed/variable expenses)
    // Note: consolidated card bills also end up in 'despesas' table but with a specific description
    // and they don't have cartao_vencimento_id in the DB schema anymore.
    return filteredDespesas;
  }, [filteredDespesas]);

  const stats = useMemo(() => {
    const totalReceitas = filteredReceitas.reduce((acc, r) => acc + (r.simulada ? 0 : r.valor), 0);
    const totalDespesas = filteredDespesas.reduce((acc, d) => acc + (d.simulada ? 0 : d.valor), 0);
    const totalPago = filteredDespesas.filter(d => d.status === 'Pago').reduce((acc, d) => acc + (d.simulada ? 0 : d.valor), 0);
    const totalAberto = filteredDespesas.filter(d => d.status === 'Em aberto').reduce((acc, d) => acc + (d.simulada ? 0 : d.valor), 0);
    
    // Check for overdue (Vencido)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const totalVencido = filteredDespesas
      .filter(d => d.status === 'Em aberto' && d.vencimento && d.vencimento !== '-' && d.vencimento < todayStr)
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
    const totals: Record<number, number> = {};
    config.cartoes.forEach(c => totals[c.id] = 0);
    
    filteredCartaoTransacoes.forEach(d => {
      if (!d.simulada) {
        totals[d.cartao_id] = (totals[d.cartao_id] || 0) + Number(d.valor);
      }
    });
    return totals;
  }, [filteredCartaoTransacoes, config.cartoes]);

  const totalsByTitular = useMemo(() => {
    const totals: Record<number, { despesas: number, receitas: number }> = {};
    config.titulares.forEach(t => totals[t.id] = { despesas: 0, receitas: 0 });
    
    filteredDespesas.forEach(d => {
      if (!d.simulada && totals[d.titular_id]) {
        totals[d.titular_id].despesas += d.valor;
      }
    });

    filteredReceitas.forEach(r => {
      if (!r.simulada && totals[r.titular_id]) {
        totals[r.titular_id].receitas += r.valor;
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
    deleteCartaoTransacao,
    updateCartaoTransacao,
    addReceita,
    updateReceita,
    deleteReceita,
    addTitular,
    updateTitular,
    deleteTitular,
    addCartao,
    updateCartao,
    deleteCartao,
    setDespesas,
    setReceitas,
    setConfig,
    familyId,
    inviteMember,
    userName,
    userType
  };
}
