import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Despesa, Receita, ConfigApp, Status, Titular, CartaoConfig, CartaoTransacao, Profile, Emprestimo, ContaFixaConfig } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { salvarDespesa, salvarReceita, consolidarFaturas, lancarParcelas, salvarEmprestimo, deletarEmprestimo, calculatePresentValue, projetarProximoVencimento, calcularCompetencia, calcularCompetenciaCartao, salvarContaFixaConfig, deletarContaFixaConfig } from '@/lib/finance-service';
import { format, addMonths, addDays, parseISO, isLastDayOfMonth, lastDayOfMonth, startOfMonth, startOfDay, getDate, differenceInMonths, isBefore } from 'date-fns';
import { setCompressedCache, getCompressedCache, clearUserCompressedCache } from '@/lib/compressed-cache';

export function useFinance(activeView: string) {
  const [user, setUser] = useState<User | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [cartaoTransacoes, setCartaoTransacoes] = useState<CartaoTransacao[]>([]);
  const [config, setConfig] = useState<ConfigApp>({ titulares: [], cartoes: [] });
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [contasFixas, setContasFixas] = useState<ContaFixaConfig[]>([]);
  const [nota, setNota] = useState<string>('');
  const [lembretes, setLembretes] = useState<{id: number, texto: string, concluido: boolean, data?: string}[]>([]);
  const [avisosConfig, setAvisosConfig] = useState({
    vencidas: true,
    hoje: true,
    radar: false
  });
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'black'>('light');
  const isDarkMode = themeMode !== 'light';
  const [themeColor, setThemeColor] = useState<string>('#4361ee');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userType, setUserType] = useState<'titular' | 'membro'>('membro');
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const isInitialLoad = useRef(true);

  // Restaura dados do cache comprimido com fflate instantaneamente
  const restoreFromCache = useCallback((userId: string) => {
    try {
      const cached = getCompressedCache<any>(`fin_cache_${userId}`);
      if (cached) {
        if (cached.despesas) setDespesas(cached.despesas);
        if (cached.receitas) setReceitas(cached.receitas);
        if (cached.cartaoTransacoes) setCartaoTransacoes(cached.cartaoTransacoes);
        if (cached.config) setConfig(cached.config);
        if (cached.emprestimos) setEmprestimos(cached.emprestimos);
        if (cached.contasFixas) setContasFixas(cached.contasFixas);
        if (cached.nota !== undefined) setNota(cached.nota);
        if (cached.lembretes) setLembretes(cached.lembretes);
        if (cached.avisosConfig) setAvisosConfig(cached.avisosConfig);
        setIsLoading(false);
        return true;
      }
    } catch (e) {
      console.warn('[Cache] Erro ao descompactar dados iniciais:', e);
    }
    return false;
  }, []);

  const fetchData = useCallback(async (userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;

    if (isInitialLoad.current) {
      // Se não havia cache carregado, mantém loading como true; se já havia, não bloqueia a tela
      const cached = getCompressedCache<any>(`fin_cache_${targetId}`);
      if (!cached) {
        setIsLoading(true);
      }
    }
    const now = new Date();
    const sixMonthsAgo = format(addMonths(now, -6), 'yyyy-MM-01');

    try {
      const results = await Promise.all([
        supabase.from('despesas').select('*').gte('vencimento', sixMonthsAgo).order('id', { ascending: true }),
        supabase.from('despesas').select('*').not('emprestimo_id', 'is', null).order('id', { ascending: true }),
        supabase.from('despesas').select('*').not('conta_fixa_id', 'is', null).order('id', { ascending: true }),
        supabase.from('receitas').select('*').gte('data_recebimento', sixMonthsAgo).order('id', { ascending: true }),
        supabase.from('cartoes').select('*').gte('data_compra', sixMonthsAgo).order('id', { ascending: true }),
        supabase.from('titulares').select('*'),
        supabase.from('cartoes_config').select('*').order('id', { ascending: true }),
        supabase.from('table_notas').select('conteudo').maybeSingle(),
        supabase.from('emprestimos').select('*').order('id', { ascending: true }),
        supabase.from('contas_fixas').select('*').order('id', { ascending: true })
      ]);

      const errors = results.filter(r => r.error).map(r => r.error?.message);
      if (errors.length > 0) {
        throw new Error(errors.join(' | '));
      }

      // Merge and deduplicate despesas
      const rawDespesas = [
        ...(results[0].data || []), 
        ...(results[1].data || []),
        ...(results[2].data || [])
      ];
      const uniqueDespesasMap = new Map();
      rawDespesas.forEach(d => uniqueDespesasMap.set(d.id, d));
      const despesasData = Array.from(uniqueDespesasMap.values());

      const receitasData = results[3].data;
      const cartaoTransacoesData = results[4].data;
      const titularesData = results[5].data;
      const cartoesConfigData = results[6].data;
      const notaData = results[7].data as any;
      const emprestimosData = results[8].data;
      const contasFixasData = results[9].data;

      const formattedDespesas = (despesasData || []).map(d => ({
        ...d,
        isSummary: d.descricao.startsWith('Fatura ')
      }));

      let parsedNotaStr = '';
      let parsedLembretesList: any[] = [];
      let parsedAvisosList: any = undefined;

      if (despesasData) {
        setDespesas(formattedDespesas);
      }
      if (receitasData) setReceitas(receitasData);
      if (cartaoTransacoesData) setCartaoTransacoes(cartaoTransacoesData);
      if (notaData) {
        const raw = notaData?.conteudo || '';
        try {
          if (raw.startsWith('{')) {
            const parsed = JSON.parse(raw);
            parsedNotaStr = parsed.nota || '';
            parsedLembretesList = parsed.lembretes || [];
            setNota(parsedNotaStr);
            setLembretes(parsedLembretesList);
            
            // Sincronizar preferências se existirem
            if (parsed.preferencias) {
              const prefs = parsed.preferencias;
              if (prefs.avisos) {
                parsedAvisosList = prefs.avisos;
                setAvisosConfig(prev => ({ ...prev, ...prefs.avisos }));
              }
            }
          } else {
            parsedNotaStr = raw;
            setNota(raw);
            setLembretes([]);
          }
        } catch {
          parsedNotaStr = raw;
          setNota(raw);
          setLembretes([]);
        }
      }
      if (emprestimosData) setEmprestimos(emprestimosData);
      if (contasFixasData) setContasFixas(contasFixasData);

      const configData = {
        titulares: titularesData || [],
        cartoes: cartoesConfigData || []
      };
      setConfig(configData);

      // Salva snapshot comprimido em alta velocidade com fflate
      try {
        setCompressedCache(`fin_cache_${targetId}`, {
          despesas: formattedDespesas,
          receitas: receitasData || [],
          cartaoTransacoes: cartaoTransacoesData || [],
          config: configData,
          emprestimos: emprestimosData || [],
          contasFixas: contasFixasData || [],
          nota: parsedNotaStr,
          lembretes: parsedLembretesList,
          avisosConfig: parsedAvisosList
        });
      } catch (cacheErr) {
        console.warn('[Cache] Erro ao gravar snapshot comprimido:', cacheErr);
      }

    } catch (error: any) {
      console.error('Error fetching data from Supabase:', error);
      const msg = typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error);
      alert(`Erro ao carregar dados: ${msg}`);
    } finally {
      setIsLoading(false);
      isInitialLoad.current = false;
    }
  }, [user?.id]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data: myProfile, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    
    if (myProfile) {
      setUserProfile(myProfile);
      setFamilyId(myProfile.family_id);
      setUserName(myProfile.nome);
      setUserType(myProfile.tipo as 'titular' | 'membro');

      // Load per-user theme color — profile takes priority over localStorage
      const userColorKey = `fin_theme_color_${user.id}`;
      if (myProfile.theme_color) {
        setThemeColor(myProfile.theme_color);
        localStorage.setItem(userColorKey, myProfile.theme_color);
        document.documentElement.style.setProperty('--primary', myProfile.theme_color);
      } else {
        const savedColor = localStorage.getItem(userColorKey);
        if (savedColor) {
          setThemeColor(savedColor);
          document.documentElement.style.setProperty('--primary', savedColor);
        }
      }

      // Load per-user theme mode — profile takes priority over localStorage
      const userThemeKey = `fin_theme_mode_${user.id}`;
      const savedTheme = localStorage.getItem(userThemeKey) as any;

      if (myProfile.theme_mode) {
        setThemeMode(myProfile.theme_mode);
        localStorage.setItem(userThemeKey, myProfile.theme_mode);
      } else if (savedTheme === 'black' && myProfile.dark_mode === true) {
        // Fallback: Se local diz 'black' e DB diz 'dark_mode: true', mantém 'black'
        setThemeMode('black');
      } else if (myProfile.dark_mode !== undefined && myProfile.dark_mode !== null) {
        // Fallback to legacy dark_mode boolean
        const mode = myProfile.dark_mode ? 'dark' : 'light';
        setThemeMode(mode);
        localStorage.setItem(userThemeKey, mode);
      } else if (savedTheme) {
        setThemeMode(savedTheme);
      }

      const { data: members } = await supabase.from('profiles')
        .select('*')
        .eq('family_id', myProfile.family_id)
        .order('nome', { ascending: true });
      if (members) setFamilyMembers(members);
    } else {
      // Se não houver perfil mas o usuário estiver logado, cria um registro padrão
      const { data: createdProfile } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        nome: user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário',
        tipo: 'titular'
      }).select().single();

      if (createdProfile) {
        setUserProfile(createdProfile);
        setFamilyId(createdProfile.family_id);
        setUserName(createdProfile.nome);
        setUserType('titular');
      }
    }
  }, [user?.id]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user?.id) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) {
      // Sync with titulares if name matches
      const currentName = updates.nome || userName;
      if (updates.foto && currentName) {
        await supabase.from('titulares')
          .update({ foto: updates.foto })
          .eq('nome', currentName)
          .eq('user_id', user.id);
      }
      await fetchProfile();
      await fetchData(); // Refresh titulares in config
    }
    return { error };
  };

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

  // Carregamento de dados disparado por mudanças no usuário (com restauração de cache imediata)
  useEffect(() => {
    if (user?.id) {
      restoreFromCache(user.id);
      fetchData(user.id);
      fetchProfile();
    }
  }, [user?.id, fetchData, fetchProfile, restoreFromCache]);

  // Auth listener - roda apenas uma vez para configurar o ouvinte
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser?.id) {
          restoreFromCache(currentUser.id);
        }
        if (!currentUser) setIsLoading(false);
      })
      .catch(async (error) => {
        console.error('Error getting session:', error);
        if (error.message?.includes('refresh_token_not_found')) {
          await supabase.auth.signOut();
        }
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (event === 'SIGNED_OUT') {
        if (user?.id) clearUserCompressedCache(user.id);
        setDespesas([]);
        setReceitas([]);
        setCartaoTransacoes([]);
        setConfig({ titulares: [], cartoes: [] });
        setNota('');
        setFamilyId(null);
        setIsLoading(false);
        isInitialLoad.current = true;
      }
    });

    return () => subscription.unsubscribe();
  }, [restoreFromCache, user?.id]);

  // On mount: apply a neutral default until fetchProfile loads the user's preference
  useEffect(() => {
    // No-op: dark mode is loaded per-user inside fetchProfile
  }, []);

  useEffect(() => {
    // Apply theme classes whenever state changes
    document.body.classList.remove('dark-mode', 'black-mode');
    if (themeMode === 'dark') document.body.classList.add('dark-mode');
    else if (themeMode === 'black') document.body.classList.add('black-mode');
  }, [themeMode]);

  const saveSettingsToCloud = async (overrides: any = {}) => {
    try {
      const payload = JSON.stringify({ 
        nota, 
        lembretes: overrides.lembretes || lembretes,
        preferencias: {
          avisos: overrides.avisosConfig || avisosConfig
        }
      });
      await supabase.from('table_notas').upsert({ conteudo: payload });
    } catch (error) {
      console.error('Erro ao sincronizar configurações:', error);
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      // Apply theme color to CSS variable whenever it changes
      document.documentElement.style.setProperty('--primary', themeColor);
      // Save to user-specific localStorage key
      localStorage.setItem(`fin_theme_color_${user.id}`, themeColor);
    }
  }, [themeColor, isLoading, user]);

  const addLembrete = async (texto: string, data?: string) => {
    const newReminders = [...lembretes, { id: Date.now(), texto, concluido: false, data }];
    setLembretes(newReminders);
    await saveSettingsToCloud({ lembretes: newReminders });
  };

  const toggleLembrete = async (id: number) => {
    const newReminders = lembretes.map(l => l.id === id ? { ...l, concluido: !l.concluido } : l);
    setLembretes(newReminders);
    await saveSettingsToCloud({ lembretes: newReminders });
  };

  const deleteLembrete = async (id: number) => {
    const newReminders = lembretes.filter(l => l.id !== id);
    setLembretes(newReminders);
    await saveSettingsToCloud({ lembretes: newReminders });
  };

  const updateAvisosConfig = async (key: keyof typeof avisosConfig, value: boolean) => {
    const newConfig = { ...avisosConfig, [key]: value };
    setAvisosConfig(newConfig);
    await saveSettingsToCloud({ avisosConfig: newConfig });
  };

  const setAndSyncThemeColor = async (color: string) => {
    setThemeColor(color);
    // Save to profiles table — per user, not shared with family
    if (user?.id) {
      localStorage.setItem(`fin_theme_color_${user.id}`, color);
      document.documentElement.style.setProperty('--primary', color);
      await supabase.from('profiles').update({ theme_color: color }).eq('id', user.id);
    }
  };

  const setThemeModeAndSync = async (mode: 'light' | 'dark' | 'black') => {
    setThemeMode(mode);
    if (user?.id) {
      localStorage.setItem(`fin_theme_mode_${user.id}`, mode);
      await supabase.from('profiles').update({ 
        theme_mode: mode,
        dark_mode: mode !== 'light' // Keep legacy field in sync
      }).eq('id', user.id);
    }
  };

  const toggleAndSyncDarkMode = async () => {
    // Cycles through themes
    const modes: ('light' | 'dark' | 'black')[] = ['light', 'dark', 'black'];
    const nextIdx = (modes.indexOf(themeMode) + 1) % modes.length;
    await setThemeModeAndSync(modes[nextIdx]);
  };

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
        }, user.id, familyId!);
      } else {
        // Despesa fixa/variável normal
        await salvarDespesa(d, user.id, familyId!);
      }
      await fetchData();
    } catch (error) {
      console.error('Error adding despesa:', error);
    }
  };

  const addContaFixa = async (c: Omit<ContaFixaConfig, 'id' | 'user_id' | 'family_id'>) => {
    if (!user || !familyId) return;
    try {
      await salvarContaFixaConfig(c, user.id, familyId);
      await fetchData();
    } catch (error) {
      console.error('Error adding conta fixa:', error);
    }
  };

  const updateContaFixa = async (id: number, updates: Partial<ContaFixaConfig>) => {
    try {
      await salvarContaFixaConfig({ id, ...updates }, user?.id!, familyId!);
      await fetchData();
    } catch (error) {
      console.error('Error updating conta fixa:', error);
    }
  };

  const deleteContaFixa = async (id: number) => {
    try {
      await deletarContaFixaConfig(id);
      await fetchData();
    } catch (error) {
      console.error('Error deleting conta fixa:', error);
    }
  };

  const updateDespesa = async (id: number, updates: Partial<Despesa>) => {
    if (!user || !familyId) return;
    try {
      const isVirtual = id < 0;
      const item = isVirtual 
        ? consolidatedDespesas.find(d => d.id === id) 
        : despesas.find(d => d.id === id);

      if (!item) return;

      // REGRAS ESPECIAIS PARA EMPRÉSTIMOS
      if (item.emprestimo_id) {
        if (!isVirtual && updates.status === 'Em aberto') {
          const { error } = await supabase.from('despesas').delete().eq('id', id);
          if (error) throw error;
          await fetchData();
          return;
        }
      }

      if (isVirtual) {
        const { id: _, ...dadosParaSalvar } = { ...item, ...updates };
        await salvarDespesa(dadosParaSalvar, user.id, familyId);
      } else {
        await salvarDespesa({ ...updates, id }, user.id, familyId);
      }

      await fetchData();
    } catch (error: any) {
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
      // 1. Obter competência atual para recalcular faturas se necessário
      const { data: item } = await supabase.from('cartoes').select('competencia').eq('id', id).single();
      
      const payload: any = { ...updates };
      if (payload.valor !== undefined) payload.valor = Number(payload.valor);

      const { error } = await supabase.from('cartoes').update(payload).eq('id', id);
      if (error) throw error;
      
      // 2. Consolidar faturas da competência afetada
      if (item?.competencia) await consolidarFaturas(item.competencia, user.id);
      
      // 3. Se a competência mudou, consolidar a nova também
      if (updates.competencia && updates.competencia !== item?.competencia) {
        await consolidarFaturas(updates.competencia, user.id);
      }
      
      await fetchData();
    } catch (error) {
      console.error('Error updating cartao transacao:', error);
    }
  };

  const addReceita = async (r: Omit<Receita, 'id'>) => {
    if (!user || !familyId) return;
    try {
      await salvarReceita(r, user.id, familyId);
      await fetchData();
    } catch (error) {
      console.error('Error adding receita:', error);
    }
  };

  const updateReceita = async (id: number, updates: Partial<Receita>) => {
    if (!user || !familyId) return;
    try {
      const isVirtual = id < 0;
      const item = isVirtual 
        ? consolidatedReceitas.find(r => r.id === id) 
        : receitas.find(r => r.id === id);

      if (!item) return;

      if (isVirtual) {
        const { id: _, ...dadosParaSalvar } = { ...item, ...updates };
        await salvarReceita(dadosParaSalvar, user.id, familyId);
      } else {
        await salvarReceita({ ...updates, id }, user.id, familyId);
      }
      
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
    if (!user || !familyId) return;
    const { data, error } = await supabase.from('titulares').insert([{
      nome: t.nome,
      foto: t.foto,
      user_id: user.id,
      family_id: familyId
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
    if (!user) return;
    const { error } = await supabase.from('titulares').update(updated).eq('id', id);
    if (!error) {
       // Sync with profile if name matches
       const titular = config.titulares.find(t => t.id === id);
       const tName = updated.nome || titular?.nome;
       if (updated.foto && tName === userName && user?.id) {
         await supabase.from('profiles')
           .update({ foto: updated.foto })
           .eq('id', user.id);
         await fetchProfile();
       }

      setConfig(prev => ({
        ...prev,
        titulares: prev.titulares.map(t => t.id === id ? { ...t, ...updated } : t)
      }));
    } else {
      console.error('Error updating titular:', error);
    }
  };

  const addCartao = async (c: Omit<CartaoConfig, 'id'>) => {
    if (!user || !familyId) return;
    const { data, error } = await supabase.from('cartoes_config').insert([{
      user_id: user.id,
      family_id: familyId,
      nome_cartao: c.nome_cartao,
      titular_id: c.titular_id,
      dia_vencimento: Number(c.dia_vencimento),
      dia_fechamento: Number(c.dia_fechamento)
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

  const addEmprestimo = async (dados: Partial<Emprestimo>) => {
    if (!user?.id) {
      alert('Usuário não autenticado.');
      return;
    }
    if (!familyId) {
      alert('ID da família não encontrado. Tente recarregar a página.');
      return;
    }
    
    try {
      await salvarEmprestimo(dados, user.id, familyId);
      await fetchData();
    } catch (error: any) {
      console.error('Error adding emprestimo:', error);
      alert(`Erro ao salvar empréstimo: ${error.message || JSON.stringify(error)}`);
    }
  };

  const updateEmprestimo = async (dados: Partial<Emprestimo>) => {
    if (!user?.id || !familyId) return;
    try {
      await salvarEmprestimo(dados, user.id, familyId);
      await fetchData();
    } catch (error: any) {
      console.error('Error updating emprestimo:', error);
      alert(`Erro ao atualizar empréstimo: ${error.message || JSON.stringify(error)}`);
    }
  };

  const deleteEmprestimo = async (id: number) => {
    await deletarEmprestimo(id);
    await fetchData();
  };

  const quitarParcelas = async (parcelas: Despesa[]) => {
    if (!user?.id) return;
    
    const { error } = await supabase.from('despesas').insert(
      parcelas.map(p => {
        const isLoan = !!p.emprestimo_id;
        const isFixed = !!p.conta_fixa_id;
        
        return {
          descricao: p.descricao,
          valor: p.valor,
          status: 'Pago',
          titular_id: p.titular_id,
          vencimento: format(new Date(), 'yyyy-MM-dd'),
          competencia: competencia,
          parcela_atual: p.parcela_atual,
          parcela_total: p.parcela_total,
          emprestimo_id: p.emprestimo_id || null,
          conta_fixa_id: p.conta_fixa_id || null,
          categoria: isLoan ? 'Empréstimos e Financiamentos' : (isFixed ? (p.categoria || 'Contas Fixas') : 'Outros'),
          user_id: user.id,
          family_id: familyId
        };
      })
    );

    if (error) {
      console.error('Error quitting parcelas:', error);
      throw error;
    }

    await fetchData();
  };

  const updateNota = async (conteudo: string) => {
    if (!user) return;
    try {
      const payload = JSON.stringify({ 
        nota: conteudo, 
        lembretes,
        preferencias: {
          darkMode: isDarkMode,
          themeColor,
          avisos: avisosConfig
        }
      });
      const { error } = await supabase.from('table_notas').upsert({ conteudo: payload });
      if (!error) setNota(conteudo);
    } catch (error) {
      console.error('Error updating nota:', error);
    }
  };



  const filteredDespesas = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return despesas.filter(d => d.competencia === competencia);
  }, [despesas, competencia]);

  const filteredReceitas = useMemo(() => {
    return receitas.filter(r => r.competencia === competencia);
  }, [receitas, competencia]);

  const allProjectedCartaoTransacoes = useMemo(() => {
    const base = cartaoTransacoes;
    
    // Lançamentos virtuais de cartões vindos de contasFixas
    const virtuals: CartaoTransacao[] = [];
    contasFixas.filter(cf => cf.cartao_id && (!cf.tipo || cf.tipo === 'despesa')).forEach(cf => {
      const dataInicial = parseISO(cf.data_inicio);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDia = isLastDayOfMonth(dataInicial);
      
      const lastParcelaToProject = cf.total_parcelas || 24;

      for (let i = 1; i <= lastParcelaToProject; i++) {
        const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
        
        let comp = '';
        if (cf.competencia_inicial) {
          const [m, y] = cf.competencia_inicial.split('/').map(Number);
          const baseDate = new Date(y, m - 1, 1);
          comp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
        } else {
          const card = config.cartoes.find(c => c.id === cf.cartao_id);
          if (card) {
            comp = calcularCompetenciaCartao(dataVenc, card.dia_vencimento, card.dia_fechamento);
          } else {
            comp = calcularCompetencia(dataVenc);
          }
        }

        // Verifica se já existe um lançamento real para esta "parcela" virtual
        const existeNoBanco = cartaoTransacoes.find(ct => 
          ct.cartao_id === cf.cartao_id && 
          ct.estabelecimento === cf.descricao &&
          ct.competencia === comp
        );

        if (!existeNoBanco) {
          virtuals.push({
            id: -50000000 - (cf.id * 1000) - i,
            cartao_id: cf.cartao_id!,
            estabelecimento: cf.descricao,
            valor: cf.valor_mensal,
            parcela_atual: i,
            parcela_total: cf.total_parcelas || 1,
            competencia: comp,
            data_compra: format(dataVenc, 'yyyy-MM-dd'),
            titular_id: cf.titular_id,
            categoria: cf.categoria,
            user_id: user?.id || '',
          });
        }
      }
    });

    return [...base, ...virtuals];
  }, [cartaoTransacoes, contasFixas, user?.id]);

  const filteredCartaoTransacoes = useMemo(() => {
    return allProjectedCartaoTransacoes.filter(c => c.competencia === competencia);
  }, [allProjectedCartaoTransacoes, competencia]);
  
  const totalsByCard = useMemo(() => {
    const totals: Record<number, number> = {};
    config.cartoes.forEach(c => totals[c.id] = 0);
    
    filteredCartaoTransacoes.forEach(d => {
      totals[d.cartao_id] = (totals[d.cartao_id] || 0) + Number(d.valor);
    });
    return totals;
  }, [filteredCartaoTransacoes, config.cartoes]);

  const consolidatedDespesas = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // 1. Despesas base (físicas), ignorando faturas de cartão consolidadas
    const baseDespesas = filteredDespesas.filter(d => !d.isSummary && !d.descricao.startsWith('Fatura '));

    // 2. Faturas de Cartão (Dinâmicas/Virtuais)
    const dynamicInvoices: Despesa[] = config.cartoes.map(card => {
      const total = totalsByCard[card.id] || 0;
      if (total === 0) return null;

      const existingInDB = filteredDespesas.find(f => 
        (f.isSummary || f.descricao.startsWith('Fatura ')) && 
        (f.cartao_vencimento_id === card.id || f.descricao.includes(card.nome_cartao))
      );

      return {
        id: existingInDB?.id || (-10000000 - card.id),
        descricao: `Fatura ${card.nome_cartao}`,
        valor: existingInDB?.status === 'Pago' ? existingInDB.valor : total,
        status: existingInDB?.status || 'Em aberto',
        titular_id: card.titular_id,
        vencimento: existingInDB?.vencimento || `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(card.dia_vencimento).padStart(2, '0')}`,
        competencia: competencia,
        isSummary: true,
        parcela_atual: 1,
        parcela_total: 1,
        cartao_vencimento_id: card.id
      } as Despesa;
    }).filter(Boolean) as Despesa[];

    // 3. Parcelas de Empréstimo (Virtuais)
    const virtualLoanInstallments: Despesa[] = [];
    emprestimos.forEach(loan => {
      const dataInicial = parseISO(loan.data_primeiro_vencimento);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDia = isLastDayOfMonth(dataInicial);

      for (let i = 1; i <= loan.total_parcelas; i++) {
        const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
        
        let comp = '';
        if (loan.competencia_inicial) {
          // Calcula a competência incrementando meses a partir da inicial
          const [m, y] = loan.competencia_inicial.split('/').map(Number);
          const baseDate = new Date(y, m - 1, 1);
          comp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
        } else {
          comp = calcularCompetencia(dataVenc);
        }

        // Verifica se essa parcela já foi paga (existe no banco)
        const existeNoBanco = despesas.find(d => 
          Number(d.emprestimo_id) === Number(loan.id) && Number(d.parcela_atual) === Number(i)
        );

        if (!existeNoBanco) {
          // Só mostramos de forma virtual se for o mês selecionado OU estiver vencida
          const compSortable = comp.split('/').reverse().join('-');
          const competenciaSortable = competencia.split('/').reverse().join('-');
          const vencStr = format(dataVenc, 'yyyy-MM-dd');
          
          if (comp === competencia) {
            virtualLoanInstallments.push({
              id: -20000000 - (loan.id * 1000) - i, // ID virtual único e não sobreposto
              descricao: loan.descricao,
              valor: loan.valor_parcela,
              status: 'Em aberto',
              titular_id: loan.titular_id,
              vencimento: vencStr,
              competencia: comp,
              parcela_atual: i,
              parcela_total: loan.total_parcelas,
              emprestimo_id: loan.id,
              categoria: 'Empréstimos e Financiamentos'
            } as Despesa);
          }
        }
      }
    });

    // 4. Parcelas de Contas Fixas (Virtuais)
    const virtualFixedInstallments: Despesa[] = [];
    contasFixas.filter(c => (!c.tipo || c.tipo === 'despesa') && !c.cartao_id).forEach(config => {
      const dataInicial = parseISO(config.data_inicio);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDia = isLastDayOfMonth(dataInicial);
      
      // Se total_parcelas for null, projetamos até o mês atual + 1 para segurança
      const lastParcelaToProject = config.total_parcelas || 
        (differenceInMonths(parseISO(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`), dataInicial) + 2);

      for (let i = 1; i <= lastParcelaToProject; i++) {
        const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
        
        let comp = '';
        if (config.competencia_inicial) {
          const [m, y] = config.competencia_inicial.split('/').map(Number);
          const baseDate = new Date(y, m - 1, 1);
          comp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
        } else {
          comp = calcularCompetencia(dataVenc);
        }

        // Verifica se essa parcela já foi paga (existe no banco)
        const existeNoBanco = despesas.find(d => 
          Number(d.conta_fixa_id) === Number(config.id) && Number(d.parcela_atual) === Number(i)
        );

        if (!existeNoBanco) {
          const vencStr = format(dataVenc, 'yyyy-MM-dd');
          if (comp === competencia) {
            virtualFixedInstallments.push({
              id: -30000000 - (config.id * 1000) - i, // ID virtual único e não sobreposto
              descricao: config.descricao,
              valor: config.valor_mensal,
              status: 'Em aberto',
              titular_id: config.titular_id,
              vencimento: vencStr,
              competencia: comp,
              parcela_atual: i,
              parcela_total: config.total_parcelas || 0, // 0 indica sem fim definido na UI
              conta_fixa_id: config.id,
              categoria: config.categoria || 'Contas Fixas'
            } as Despesa);
          }
        }
      }
    });

    return [...baseDespesas, ...dynamicInvoices, ...virtualLoanInstallments, ...virtualFixedInstallments].filter(Boolean);
  }, [filteredDespesas, totalsByCard, config.cartoes, currentMonth, currentYear, competencia, emprestimos, contasFixas, despesas]);

  const alertas = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    // 1. Alertas de itens físicos (qualquer competência)
    const physicalVencidas = despesas.filter(d => 
      d.status === 'Em aberto' && d.vencimento && d.vencimento !== '-' && d.vencimento < todayStr && !d.cartao_vencimento_id && !d.isSummary
    );
    const physicalHoje = despesas.filter(d => 
      d.status === 'Em aberto' && d.vencimento === todayStr && !d.cartao_vencimento_id && !d.isSummary
    );

    // 2. Alertas de itens virtuais (Empréstimos)
    const virtualLoanAlerts: Despesa[] = [];
    emprestimos.forEach(loan => {
      const dataInicial = parseISO(loan.data_primeiro_vencimento);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDia = isLastDayOfMonth(dataInicial);

      for (let i = 1; i <= loan.total_parcelas; i++) {
        const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
        const vencStr = format(dataVenc, 'yyyy-MM-dd');
        
        // Se já passou ou é hoje, e não está no banco
        if (vencStr <= todayStr) {
          const existeNoBanco = despesas.find(d => 
            Number(d.emprestimo_id) === Number(loan.id) && Number(d.parcela_atual) === Number(i)
          );
          if (!existeNoBanco) {
            virtualLoanAlerts.push({
              descricao: loan.descricao,
              valor: loan.valor_parcela,
              status: 'Em aberto',
              vencimento: vencStr,
              competencia: calcularCompetencia(dataVenc)
            } as Despesa);
          }
        } else {
          break; // Datas futuras não geram alerta
        }
      }
    });

    // 3. Alertas de itens virtuais (Contas Fixas - Exclui Cartões)
    const virtualFixedAlerts: Despesa[] = [];
    contasFixas.filter(c => (!c.tipo || c.tipo === 'despesa') && !c.cartao_id).forEach(config => {
      const dataInicial = parseISO(config.data_inicio);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDia = isLastDayOfMonth(dataInicial);
      const limit = config.total_parcelas || 24;

      for (let i = 1; i <= limit; i++) {
        const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
        const vencStr = format(dataVenc, 'yyyy-MM-dd');

        if (vencStr <= todayStr) {
          const existeNoBanco = despesas.find(d => 
            Number(d.conta_fixa_id) === Number(config.id) && Number(d.parcela_atual) === Number(i)
          );
          if (!existeNoBanco) {
            virtualFixedAlerts.push({
              descricao: config.descricao,
              valor: config.valor_mensal,
              status: 'Em aberto',
              vencimento: vencStr,
              competencia: calcularCompetencia(dataVenc)
            } as Despesa);
          }
        } else {
          break;
        }
      }
    });

    const allVencidas = [
      ...physicalVencidas, 
      ...virtualLoanAlerts.filter(d => d.vencimento! < todayStr),
      ...virtualFixedAlerts.filter(d => d.vencimento! < todayStr)
    ];

    const allHoje = [
      ...physicalHoje,
      ...virtualLoanAlerts.filter(d => d.vencimento === todayStr),
      ...virtualFixedAlerts.filter(d => d.vencimento === todayStr)
    ];

    const vencidas = (avisosConfig.vencidas !== false) ? allVencidas : [];
    const hoje = (avisosConfig.hoje !== false) ? allHoje : [];

    return {
      vencidas,
      vencendoHoje: hoje,
      total: vencidas.length + hoje.length
    };
  }, [despesas, emprestimos, contasFixas, avisosConfig]);

  const consolidatedReceitas = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-01');

    // 1. Receitas base (físicas)
    const baseReceitas = filteredReceitas;

    // 2. Receitas Fixas (Virtuais)
    const virtualFixedRevenues: Receita[] = [];
    contasFixas.filter(c => c.tipo === 'receita').forEach(config => {
      const dataInicial = parseISO(config.data_inicio);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDia = isLastDayOfMonth(dataInicial);
      
      const lastParcelaToProject = config.total_parcelas || 
        (differenceInMonths(parseISO(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`), dataInicial) + 2);

      for (let i = 1; i <= lastParcelaToProject; i++) {
        const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
        
        let comp = '';
        if (config.competencia_inicial) {
          const [m, y] = config.competencia_inicial.split('/').map(Number);
          const baseDate = new Date(y, m - 1, 1);
          comp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
        } else {
          comp = calcularCompetencia(dataVenc);
        }

        const existeNoBanco = receitas.find(r => 
          Number(r.conta_fixa_id) === Number(config.id) && r.competencia === comp
        );

        if (!existeNoBanco) {
          const vencStr = format(dataVenc, 'yyyy-MM-dd');
          if (comp === competencia) {
            virtualFixedRevenues.push({
              id: -40000000 - (config.id * 1000) - i, 
              descricao: config.descricao,
              valor: config.valor_mensal,
              titular_id: config.titular_id,
              data_recebimento: vencStr,
              competencia: comp,
              conta_fixa_id: config.id,
              categoria: config.categoria || 'Recursos',
              status: (vencStr <= todayStr) ? 'Recebido' : 'Pendente'
            } as Receita);
          }
        }
      }
    });

    return [...baseReceitas, ...virtualFixedRevenues].filter(Boolean);
  }, [filteredReceitas, contasFixas, currentMonth, currentYear, competencia, receitas]);

  const despesasGerais = useMemo(() => {
    return consolidatedDespesas;
  }, [consolidatedDespesas]);

  const stats = useMemo(() => {
    const totalReceitas = consolidatedReceitas.reduce((acc, r) => acc + r.valor, 0);
    const totalDespesas = consolidatedDespesas.reduce((acc, d) => acc + d.valor, 0);
    const totalPago = consolidatedDespesas.filter(d => d.status === 'Pago').reduce((acc, d) => acc + d.valor, 0);
    const totalAberto = consolidatedDespesas.filter(d => d.status === 'Em aberto').reduce((acc, d) => acc + d.valor, 0);
    
    // Check for overdue (Vencido)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const totalVencido = consolidatedDespesas
      .filter(d => d.status === 'Em aberto' && d.vencimento && d.vencimento !== '-' && d.vencimento < todayStr)
      .reduce((acc, d) => acc + d.valor, 0);

    const margem = totalReceitas - totalDespesas;

    return {
      totalReceitas,
      totalDespesas,
      totalPago,
      totalAberto,
      totalVencido,
      margem
    };
  }, [consolidatedReceitas, consolidatedDespesas]);

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


  const totalsByTitular = useMemo(() => {
    const totals: Record<number, { despesas: number, receitas: number }> = {};
    config.titulares.forEach(t => totals[t.id] = { despesas: 0, receitas: 0 });
    
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    consolidatedDespesas.forEach(d => {
      // Excluir se não for da competência atual OU se estiver vencido (vencimento < hoje e em aberto)
      const isOverdue = d.status === 'Em aberto' && d.vencimento && d.vencimento !== '-' && d.vencimento < todayStr;
      if (d.competencia !== competencia || isOverdue) return;

      if (totals[d.titular_id]) {
        totals[d.titular_id].despesas += d.valor;
      }
    });

    filteredReceitas.forEach(r => {
      if (totals[r.titular_id]) {
        totals[r.titular_id].receitas += r.valor;
      }
    });

    // Incluir receitas virtuais nos totais por titular
    consolidatedReceitas.filter(r => r.id < 0).forEach(r => {
      if (totals[r.titular_id]) {
        totals[r.titular_id].receitas += r.valor;
      }
    });

    return totals;
  }, [consolidatedDespesas, filteredReceitas, config.titulares]);

  const radarStats = useMemo(() => {
    // Calculamos para TODOS os dados carregados (futuros e passados em aberto)
    const openDespesas = despesas.filter(d => d.status === 'Em aberto');
    
    return {
      totalDividaAberto: openDespesas.reduce((acc, d) => acc + d.valor, 0),
      qtdParcelasRestante: openDespesas.length,
      // Adicionando uma função para filtrar sob demanda ou retornar os dados brutos
      getFiltered: (titularId: number | null) => {
        const filtered = titularId 
          ? openDespesas.filter(d => d.titular_id === titularId)
          : openDespesas;
        return {
          totalDividaAberto: filtered.reduce((acc, d) => acc + d.valor, 0),
          qtdParcelasRestante: filtered.length,
        };
      }
    };
  }, [despesas]);

  const projecaoSemestral = useMemo(() => {
    const calculateTotalsForMonth = (comp: string) => {
      // 1. RECEITAS
      const baseRec = receitas
        .filter(r => r.competencia === comp)
        .reduce((sum, r) => sum + Number(r.valor || 0), 0);

      let virtualRec = 0;
      contasFixas.filter(c => c.tipo === 'receita').forEach(cfg => {
        const dataInicial = parseISO(cfg.data_inicio);
        const diaOriginal = getDate(dataInicial);
        const isUltimoDia = isLastDayOfMonth(dataInicial);
        const limit = cfg.total_parcelas || 36;

        for (let i = 1; i <= limit; i++) {
          const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
          let cComp = '';
          if (cfg.competencia_inicial) {
            const [m, y] = cfg.competencia_inicial.split('/').map(Number);
            const baseDate = new Date(y, m - 1, 1);
            cComp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
          } else {
            cComp = calcularCompetencia(dataVenc);
          }

          if (cComp === comp) {
            const existeNoBanco = receitas.find(r => 
              Number(r.conta_fixa_id) === Number(cfg.id) && r.competencia === comp
            );
            if (!existeNoBanco) {
              virtualRec += Number(cfg.valor_mensal || 0);
            }
          }
        }
      });

      const totalReceitas = baseRec + virtualRec;

      // 2. DESPESAS
      // 2.1 Despesas físicas regulares (não faturas)
      const baseDesp = despesas
        .filter(d => d.competencia === comp && !d.isSummary && !d.descricao?.startsWith('Fatura '))
        .reduce((sum, d) => sum + Number(d.valor || 0), 0);

      // 2.2 Faturas de Cartão (físicas + virtuais dinâmicas de allProjectedCartaoTransacoes)
      let totalFaturas = 0;
      config.cartoes.forEach(card => {
        const cardTransactionsTotal = allProjectedCartaoTransacoes
          .filter(ct => ct.cartao_id === card.id && ct.competencia === comp)
          .reduce((sum, ct) => sum + Number(ct.valor || 0), 0);

        const existingInDB = despesas.find(f => 
          f.competencia === comp &&
          (f.isSummary || f.descricao?.startsWith('Fatura ')) && 
          (f.cartao_vencimento_id === card.id || f.descricao?.includes(card.nome_cartao))
        );

        if (existingInDB) {
          totalFaturas += existingInDB.status === 'Pago' 
            ? Number(existingInDB.valor || 0) 
            : (cardTransactionsTotal || Number(existingInDB.valor || 0));
        } else if (cardTransactionsTotal > 0) {
          totalFaturas += cardTransactionsTotal;
        }
      });

      // 2.3 Parcelas de Empréstimo (Virtuais)
      let virtualLoans = 0;
      emprestimos.forEach(loan => {
        const dataInicial = parseISO(loan.data_primeiro_vencimento);
        const diaOriginal = getDate(dataInicial);
        const isUltimoDia = isLastDayOfMonth(dataInicial);

        for (let i = 1; i <= loan.total_parcelas; i++) {
          const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
          let lComp = '';
          if (loan.competencia_inicial) {
            const [m, y] = loan.competencia_inicial.split('/').map(Number);
            const baseDate = new Date(y, m - 1, 1);
            lComp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
          } else {
            lComp = calcularCompetencia(dataVenc);
          }

          if (lComp === comp) {
            const existeNoBanco = despesas.find(d => 
              Number(d.emprestimo_id) === Number(loan.id) && Number(d.parcela_atual) === Number(i)
            );
            if (!existeNoBanco) {
              virtualLoans += Number(loan.valor_parcela || 0);
            }
          }
        }
      });

      // 2.4 Parcelas de Contas Fixas (Virtuais - não cartão)
      let virtualFixed = 0;
      contasFixas.filter(c => (!c.tipo || c.tipo === 'despesa') && !c.cartao_id).forEach(cfg => {
        const dataInicial = parseISO(cfg.data_inicio);
        const diaOriginal = getDate(dataInicial);
        const isUltimoDia = isLastDayOfMonth(dataInicial);
        const limit = cfg.total_parcelas || 36;

        for (let i = 1; i <= limit; i++) {
          const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
          let fComp = '';
          if (cfg.competencia_inicial) {
            const [m, y] = cfg.competencia_inicial.split('/').map(Number);
            const baseDate = new Date(y, m - 1, 1);
            fComp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
          } else {
            fComp = calcularCompetencia(dataVenc);
          }

          if (fComp === comp) {
            const existeNoBanco = despesas.find(d => 
              Number(d.conta_fixa_id) === Number(cfg.id) && Number(d.parcela_atual) === Number(i)
            );
            if (!existeNoBanco) {
              virtualFixed += Number(cfg.valor_mensal || 0);
            }
          }
        }
      });

      const totalDespesas = baseDesp + totalFaturas + virtualLoans + virtualFixed;
      return { totalReceitas, totalDespesas };
    };

    const projecao = [];
    let tempMonth = currentMonth;
    let tempYear = currentYear;

    for (let i = 0; i < 8; i++) {
      const comp = `${String(tempMonth).padStart(2, '0')}/${tempYear}`;
      const { totalReceitas, totalDespesas } = calculateTotalsForMonth(comp);

      projecao.push({
        competencia: comp,
        receitas: totalReceitas,
        despesas: totalDespesas,
        faturas: 0,
        saldo: totalReceitas - totalDespesas
      });

      tempMonth++;
      if (tempMonth > 12) {
        tempMonth = 1;
        tempYear++;
      }
    }
    return projecao;
  }, [despesas, receitas, currentMonth, currentYear, allProjectedCartaoTransacoes, contasFixas, emprestimos, config.cartoes]);

  // Auto-Sync of Virtual Revenues (Recurrent/Fixed) on their due date
  useEffect(() => {
    if (!user || isLoading || !familyId) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const toSync = consolidatedReceitas.filter(r => 
      r.id < 0 && 
      r.data_recebimento <= todayStr &&
      !syncedRevenuesRef.current.has(r.id) // Evitar duplicados
    );

    if (toSync.length > 0) {
      console.log('Antigravity: Auto-syncing virtual revenues:', toSync.length);
      // Marcar como sincronizando
      toSync.forEach(r => syncedRevenuesRef.current.add(r.id));
      
      Promise.all(toSync.map(r => {
        const { id, ...dados } = r;
        return salvarReceita({ ...dados, status: 'Recebido' }, user.id, familyId);
      })).then(() => {
        console.log('Antigravity: Auto-sync complete.');
        fetchData(user.id);
      }).catch(err => console.error('Antigravity: Error auto-syncing revenues:', err));
    }
  }, [consolidatedReceitas, user, familyId, isLoading, fetchData]);

  const lastAutoLaunchRef = useRef<string | null>(null);
  const syncedRevenuesRef = useRef<Set<number>>(new Set());
  const syncedExpensesRef = useRef<Set<string>>(new Set());

  // Auto-lançamento de despesas projetadas (cartões no dia da compra, empréstimos e fixas comuns 5 dias antes do fim do mês)
  useEffect(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    const autoLaunch = async () => {
      if (isLoading || !familyId || !user?.id || (emprestimos.length === 0 && contasFixas.length === 0)) return;
      if (lastAutoLaunchRef.current === todayStr) return;
      
      const today = new Date();
      const lastDay = lastDayOfMonth(today);
      const daysToLast = lastDay.getDate() - today.getDate();
      
      const nextMonthDate = addMonths(today, 1);
      const currentComp = format(today, 'MM/yyyy');
      const nextComp = format(nextMonthDate, 'MM/yyyy');
      const targetComps = [currentComp, nextComp];
      
      const toLaunch: any[] = [];

      // 1. Verificar Empréstimos (Apenas nos últimos 5 dias do mês)
      if (daysToLast <= 5) {
        for (const loan of emprestimos) {
          const dataIni = parseISO(loan.data_primeiro_vencimento);
          const diaOriginal = getDate(dataIni);
          const isUltimo = isLastDayOfMonth(dataIni);

          for (let i = 1; i <= loan.total_parcelas; i++) {
            let comp = '';
            if (loan.competencia_inicial) {
              const [m, y] = loan.competencia_inicial.split('/').map(Number);
              comp = format(addMonths(new Date(y, m - 1, 1), i - 1), 'MM/yyyy');
            } else {
              const dataV = projetarProximoVencimento(dataIni, i - 1, isUltimo, diaOriginal);
              comp = format(dataV, 'MM/yyyy');
            }

            if (targetComps.includes(comp)) {
              const exists = despesas.find(d => Number(d.emprestimo_id) === Number(loan.id) && Number(d.parcela_atual) === Number(i));
              if (!exists) {
                const dataVenc = projetarProximoVencimento(dataIni, i - 1, isUltimo, diaOriginal);
                toLaunch.push({
                  descricao: loan.descricao,
                  valor: loan.valor_parcela,
                  vencimento: format(dataVenc, 'yyyy-MM-dd'),
                  competencia: comp,
                  status: 'Em aberto',
                  titular_id: loan.titular_id,
                  emprestimo_id: loan.id,
                  parcela_atual: i,
                  parcela_total: loan.total_parcelas,
                  categoria: 'Empréstimos e Financiamentos',
                  user_id: user.id,
                  family_id: familyId
                });
              }
            }
          }
        }
      }

      // 2. Verificar Contas Fixas
      for (const fixedConfig of contasFixas) {
        if (fixedConfig.tipo === 'receita') continue;
        const dataIni = parseISO(fixedConfig.data_inicio);
        const diaOriginal = getDate(dataIni);
        const isUltimo = isLastDayOfMonth(dataIni);
        const limit = fixedConfig.total_parcelas || 24;

        for (let i = 1; i <= limit; i++) {
          const dataV = projetarProximoVencimento(dataIni, i - 1, isUltimo, diaOriginal);
          
          let comp = '';
          if (fixedConfig.competencia_inicial) {
            const [m, y] = fixedConfig.competencia_inicial.split('/').map(Number);
            comp = format(addMonths(new Date(y, m - 1, 1), i - 1), 'MM/yyyy');
          } else {
            if (fixedConfig.cartao_id) {
              const card = config.cartoes.find(c => c.id === fixedConfig.cartao_id);
              if (card) {
                comp = calcularCompetenciaCartao(dataV, card.dia_vencimento, card.dia_fechamento);
              } else {
                comp = format(dataV, 'MM/yyyy');
              }
            } else {
              comp = format(dataV, 'MM/yyyy');
            }
          }

          const isCartao = !!fixedConfig.cartao_id;
          let shouldLaunch = false;

          if (isCartao) {
            const dataVencStr = format(dataV, 'yyyy-MM-dd');
            shouldLaunch = dataVencStr <= todayStr;
          } else {
            shouldLaunch = (daysToLast <= 5) && targetComps.includes(comp);
          }

          if (shouldLaunch) {
            const existsInDespesas = despesas.find(d => Number(d.conta_fixa_id) === Number(fixedConfig.id) && Number(d.parcela_atual) === Number(i));
            const existsInCartoes = cartaoTransacoes.find(ct => 
              Number(ct.cartao_id) === Number(fixedConfig.cartao_id) && 
              ct.estabelecimento === fixedConfig.descricao && 
              ct.competencia === comp &&
              Number(ct.parcela_atual) === Number(i)
            );
            
            if (!existsInDespesas && !existsInCartoes) {
              toLaunch.push({
                descricao: fixedConfig.descricao,
                valor: fixedConfig.valor_mensal,
                vencimento: format(dataV, 'yyyy-MM-dd'), // Para despesas comuns
                data_compra: format(dataV, 'yyyy-MM-dd'), // Para cartões
                competencia: comp,
                status: 'Em aberto',
                titular_id: fixedConfig.titular_id,
                conta_fixa_id: fixedConfig.id,
                parcela_atual: i,
                parcela_total: fixedConfig.total_parcelas || 0,
                categoria: fixedConfig.categoria || (isCartao ? 'cartoes' : 'Contas Fixas'),
                cartao_id: fixedConfig.cartao_id || null,
                user_id: user.id,
                family_id: familyId
              });
            }
          }
        }
      }

      if (toLaunch.length > 0) {
        // Filtrar o que já está sendo lançado para evitar duplicidade em disparos rápidos
        const finalToLaunch = toLaunch.filter(item => {
          const key = item.emprestimo_id 
            ? `loan-${item.emprestimo_id}-${item.parcela_atual}`
            : `fixed-${item.conta_fixa_id}-${item.parcela_atual}`;
          
          if (syncedExpensesRef.current.has(key)) return false;
          syncedExpensesRef.current.add(key);
          return true;
        });

        if (finalToLaunch.length > 0) {
          console.log(`Auto-lançando ${finalToLaunch.length} despesas projetadas.`);
          lastAutoLaunchRef.current = todayStr; 
          
          // Separa o que é cartão do que é despesa comum
          const cardsToLaunch = finalToLaunch.filter(item => (item as any).cartao_id);
          const normalsToLaunch = finalToLaunch.filter(item => !(item as any).cartao_id);

          if (cardsToLaunch.length > 0) {
            const mappedCards = cardsToLaunch.map(item => ({
              user_id: item.user_id,
              family_id: item.family_id,
              estabelecimento: item.descricao,
              valor: item.valor,
              competencia: item.competencia,
              cartao_id: item.cartao_id,
              categoria: item.categoria,
              titular_id: item.titular_id,
              parcela_atual: item.parcela_atual,
              parcela_total: item.parcela_total,
              data_compra: item.data_compra
            }));
            const { error: cardError } = await supabase.from('cartoes').insert(mappedCards);
            if (cardError) console.error('Erro ao auto-lançar transações de cartão:', cardError);
          }

          if (normalsToLaunch.length > 0) {
            const { error: normalError } = await supabase.from('despesas').insert(normalsToLaunch);
            if (normalError) {
              console.error('Erro ao auto-lançar despesas:', normalError);
              // Fallback
              lastAutoLaunchRef.current = null;
            }
          }

          fetchData();
        }
      } else {
        // Se não tem nada para lançar, também marcamos como checado para hoje
        lastAutoLaunchRef.current = todayStr;
      }
    };

    autoLaunch();
  }, [isLoading, familyId, user?.id, emprestimos, contasFixas, despesas.length, config.cartoes, fetchData]);

  return {
    user,
    userProfile,
    despesas,
    receitas,
    cartaoTransacoes,
    config,
    nota,
    emprestimos,
    currentMonth,
    currentYear,
    competencia,
    filteredDespesas,
    filteredReceitas,
    consolidatedDespesas,
    consolidatedReceitas,
    filteredCartaoTransacoes,
    allProjectedCartaoTransacoes,
    despesasGerais,
    stats,
    radarStats,
    totalsByCard,
    totalsByTitular,
    projecaoSemestral,
    isLoading,
    isDarkMode,
    changeMonth,
    setMonth,
    setYear,
    toggleDarkMode: toggleAndSyncDarkMode,
    setThemeMode: setThemeModeAndSync,
    themeMode,
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
    addEmprestimo,
    updateEmprestimo,
    deleteEmprestimo,
    contasFixas,
    addContaFixa,
    updateContaFixa,
    deleteContaFixa,
    quitarParcelas,
    setDespesas,
    setReceitas,
    setConfig,
    familyId,
    familyMembers,
    inviteMember,
    userName,
    userType,
    updateProfile,
    themeColor,
    setThemeColor: setAndSyncThemeColor,
    alertas,
    lembretes,
    addLembrete,
    toggleLembrete,
    deleteLembrete,
    avisosConfig,
    updateAvisosConfig
  };
}
