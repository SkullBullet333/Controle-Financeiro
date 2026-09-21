import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Despesa, Receita, ConfigApp, Status, Titular, CartaoConfig, CartaoTransacao, Profile, Emprestimo, ContaFixaConfig, ContaFixaExcecao } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { salvarDespesa, salvarReceita, consolidarFaturas, lancarParcelas, salvarEmprestimo, deletarEmprestimo, calculatePresentValue, projetarProximoVencimento, calcularCompetencia, calcularCompetenciaCartao, resolverAgendamentoReceita, salvarContaFixaConfig, encerrarContaFixaConfig, contaFixaPermiteOcorrencia, resolverOcorrenciaContaFixa, ignorarOcorrenciaContaFixa, encerrarContaFixaDesde, renomearCategoriaEmLote, atualizarCategoriaPorDescricao, materializarDespesasVinculadas, materializarOcorrenciaCartao } from '@/lib/finance-service';
import { format, addMonths, addDays, parseISO, isLastDayOfMonth, lastDayOfMonth, startOfMonth, startOfDay, getDate, differenceInMonths, isBefore } from 'date-fns';
import { clearFinancialCache, financialCacheKey, getFinancialCache, purgeLegacyFinancialCache, setFinancialCache } from '@/lib/financial-cache';
import { categorizar } from '@/lib/categories-utils';
import { carregarTodasPaginas, chaveJanelaFinanceira, criarJanelaCompetencias, deveAbrirProximoMesQuandoQuitado } from '@/lib/finance-period';
import { normalizarDinheiro } from '@/lib/money';
import { projetarFluxoCaixa } from '@/lib/cashflow-projection';
import { calcularTotaisPorCartao } from '@/lib/card-projection';
import { calcularDividaAberta, calcularResumoFinanceiro, calcularTotaisPorTitular } from '@/lib/finance-selectors';
import { reportOperationFailure } from '@/lib/safe-log';
import { persistCardWithLegacyRetry } from '@/lib/card-schema';

export function useFinance(activeView: string) {
  const [user, setUser] = useState<User | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [cartaoTransacoes, setCartaoTransacoes] = useState<CartaoTransacao[]>([]);
  const [config, setConfig] = useState<ConfigApp>({ titulares: [], cartoes: [] });
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [contasFixas, setContasFixas] = useState<ContaFixaConfig[]>([]);
  const [contasFixasExcecoes, setContasFixasExcecoes] = useState<ContaFixaExcecao[]>([]);
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
  const financialCompetencies = useMemo(
    // O painel de evolução exibe doze meses; a consulta precisa cobrir o
    // mesmo intervalo para que um mês comum não mude de valor ao navegar.
    () => criarJanelaCompetencias(currentMonth, currentYear, 12),
    [currentMonth, currentYear]
  );
  const financialWindowKey = useMemo(
    () => chaveJanelaFinanceira(financialCompetencies),
    [financialCompetencies]
  );
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userType, setUserType] = useState<'titular' | 'membro'>('membro');
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const isInitialLoad = useRef(true);
  const loadedFinancialWindow = useRef<string | null>(null);
  const fetchSequence = useRef(0);
  const authenticatedUserId = useRef<string | null>(null);
  const periodWasManuallyChanged = useRef(false);
  const initialPeriodWasResolved = useRef(false);

  // Após uma alteração administrativa local, nenhuma leitura anterior pode
  // repor cadastros antigos; janelas futuras serão consultadas novamente.
  const invalidateFinancialSnapshots = useCallback(() => {
    fetchSequence.current++;
    clearFinancialCache();
    setIsLoading(false);
  }, []);

  // Restaura apenas snapshots desta aba; a rede atualiza os dados em seguida.
  const restoreFromCache = useCallback((userId: string, windowKey: string) => {
    const cached = getFinancialCache<any>(financialCacheKey(userId, windowKey));
    if (cached) {
      if (cached.despesas) setDespesas(cached.despesas);
      if (cached.receitas) setReceitas(cached.receitas);
      if (cached.cartaoTransacoes) setCartaoTransacoes(cached.cartaoTransacoes);
      if (cached.config) setConfig(cached.config);
      if (cached.emprestimos) setEmprestimos(cached.emprestimos);
      if (cached.contasFixas) setContasFixas(cached.contasFixas);
      if (cached.contasFixasExcecoes) setContasFixasExcecoes(cached.contasFixasExcecoes);
      if (cached.nota !== undefined) setNota(cached.nota);
      if (cached.lembretes) setLembretes(cached.lembretes);
      if (cached.avisosConfig) setAvisosConfig(cached.avisosConfig);
      loadedFinancialWindow.current = windowKey;
      setIsLoading(false);
      return true;
    }
    return false;
  }, []);

  const fetchData = useCallback(async (userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;
    const requestId = ++fetchSequence.current;
    const cacheKey = financialCacheKey(targetId, financialWindowKey);

    if (isInitialLoad.current || loadedFinancialWindow.current !== financialWindowKey) {
      // Cada janela possui seu próprio snapshot. Uma navegação histórica nunca
      // reutiliza silenciosamente o recorte de outro período.
      const cached = getFinancialCache(cacheKey);
      // Em trocas de período, preservamos os dados que já estão na tela e
      // atualizamos a nova janela em segundo plano. A tela de carregamento
      // fica reservada ao primeiro acesso, quando ainda não há dados úteis.
      if (!cached && isInitialLoad.current) {
        setIsLoading(true);
      }
    }

    try {
      const [
        periodDespesasData,
        linkedDespesasData,
        overdueDespesasData,
        rawReceitasData,
        rawCartaoTransacoesData,
        titularesResult,
        cartoesConfigResult,
        notaResult,
        emprestimosResult,
        contasFixasResult,
        contasFixasExcecoesData,
      ] = await Promise.all([
        carregarTodasPaginas<Despesa>((inicio, fim) => supabase
          .from('despesas')
          .select('*')
          .in('competencia', financialCompetencies)
          .order('id', { ascending: true })
          .range(inicio, fim)),
        carregarTodasPaginas<Despesa>((inicio, fim) => supabase
          .from('despesas')
          .select('*')
          .or('emprestimo_id.not.is.null,conta_fixa_id.not.is.null')
          .order('id', { ascending: true })
          .range(inicio, fim)),
        carregarTodasPaginas<Despesa>((inicio, fim) => supabase
          .from('despesas')
          .select('*')
          .eq('status', 'Em aberto')
          .lt('vencimento', format(new Date(), 'yyyy-MM-dd'))
          .order('id', { ascending: true })
          .range(inicio, fim)),
        carregarTodasPaginas<Receita>((inicio, fim) => supabase
          .from('receitas')
          .select('*')
          .in('competencia', financialCompetencies)
          .order('id', { ascending: true })
          .range(inicio, fim)),
        carregarTodasPaginas<CartaoTransacao>((inicio, fim) => supabase
          .from('cartoes')
          .select('*')
          .in('competencia', financialCompetencies)
          .order('id', { ascending: true })
          .range(inicio, fim)),
        supabase.from('titulares').select('*'),
        supabase.from('cartoes_config').select('*').order('id', { ascending: true }),
        supabase.from('table_notas').select('conteudo').maybeSingle(),
        supabase.from('emprestimos').select('*').order('id', { ascending: true }),
        supabase.from('contas_fixas').select('*').order('id', { ascending: true }),
        // Consulta opcional para manter compatibilidade enquanto o remoto ainda
        // não recebeu a migration de comandos por ocorrência.
        carregarTodasPaginas<ContaFixaExcecao>((inicio, fim) => supabase
          .from('contas_fixas_excecoes')
          .select('*')
          .order('id', { ascending: true })
          .range(inicio, fim)).catch(() => [] as ContaFixaExcecao[])
      ]);

      const requiredResults = [
        titularesResult,
        cartoesConfigResult,
        notaResult,
        emprestimosResult,
        contasFixasResult,
      ];
      const errors = requiredResults.filter(result => result.error).map(result => result.error?.message);
      if (errors.length > 0) {
        throw new Error(errors.join(' | '));
      }

      // Descarta respostas antigas quando o usuário navega rapidamente entre períodos.
      if (requestId !== fetchSequence.current) return;

      // Merge and deduplicate despesas
      const rawDespesas = [
        ...periodDespesasData,
        ...linkedDespesasData,
        ...overdueDespesasData,
      ];
      const uniqueDespesasMap = new Map();
      rawDespesas.forEach(d => uniqueDespesasMap.set(d.id, d));
      const mergedDespesasData = Array.from(uniqueDespesasMap.values()) as Despesa[];

      const titularesData = titularesResult.data;
      const cartoesConfigData = cartoesConfigResult.data;
      const notaData = notaResult.data as any;
      const emprestimosData = ((emprestimosResult.data || []) as Emprestimo[]).map(item => ({
        ...item,
        valor_total: item.valor_total === undefined ? undefined : normalizarDinheiro(item.valor_total),
        valor_parcela: normalizarDinheiro(item.valor_parcela),
      }));
      const contasFixasData = ((contasFixasResult.data || []) as ContaFixaConfig[]).map(item => ({
        ...item,
        valor_mensal: normalizarDinheiro(item.valor_mensal),
      }));
      const ignoredOccurrenceKeys = new Set(
        contasFixasExcecoesData.map(item => `${Number(item.conta_fixa_id)}:${Number(item.ocorrencia)}`)
      );
      const contasFixasById = new Map(contasFixasData.map(item => [Number(item.id), item]));

      const despesasData = mergedDespesasData
        .map(item => ({
          ...item,
          valor: normalizarDinheiro(item.valor),
          ...(item.conta_fixa_id
            ? { conta_fixa_ocorrencia: Number(item.parcela_atual) }
            : {}),
        }))
        .filter(item => !item.conta_fixa_id || !ignoredOccurrenceKeys.has(
          `${Number(item.conta_fixa_id)}:${Number(item.conta_fixa_ocorrencia)}`
        ));
      const receitasData = rawReceitasData
        .map(item => {
          const normalizedItem = { ...item, valor: normalizarDinheiro(item.valor) };
          if (!normalizedItem.conta_fixa_id) return normalizedItem;
          const master = contasFixasById.get(Number(normalizedItem.conta_fixa_id));
          const occurrence = master
            ? resolverOcorrenciaContaFixa(master.competencia_inicial, normalizedItem.competencia)
            : null;
          return occurrence ? { ...normalizedItem, conta_fixa_ocorrencia: occurrence } : normalizedItem;
        })
        .filter(item => !item.conta_fixa_id || !item.conta_fixa_ocorrencia || !ignoredOccurrenceKeys.has(
          `${Number(item.conta_fixa_id)}:${Number(item.conta_fixa_ocorrencia)}`
        ));
      const cartaoTransacoesData = rawCartaoTransacoesData
        .map(item => ({ ...item, valor: normalizarDinheiro(item.valor) }))
        .filter(item =>
          !item.conta_fixa_id
          || !item.conta_fixa_parcela
          || !ignoredOccurrenceKeys.has(`${Number(item.conta_fixa_id)}:${Number(item.conta_fixa_parcela)}`)
        );

      const formattedDespesas = (despesasData || []).map(d => ({
        ...d,
        // Fallback somente de leitura enquanto o remoto ainda não recebeu o
        // backfill estrutural de faturas da migration 60000.
        isSummary: Boolean(d.cartao_vencimento_id) || d.descricao.startsWith('Fatura ')
      }));

      let parsedNotaStr = '';
      let parsedLembretesList: any[] = [];
      let parsedAvisosList: any = undefined;

      if (despesasData) {
        setDespesas(formattedDespesas);
      }
      if (receitasData) setReceitas(receitasData);
      if (cartaoTransacoesData) setCartaoTransacoes(cartaoTransacoesData);
      setContasFixasExcecoes(contasFixasExcecoesData);
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

      // O carregamento é estritamente de leitura: mestres concluídos permanecem
      // disponíveis para auditoria e deixam de projetar após total_parcelas.
      const contasFixasPreservadas = (contasFixasData || []) as ContaFixaConfig[];
      setContasFixas(contasFixasPreservadas);

      const normalizedCartoes: CartaoConfig[] = (cartoesConfigData || []).map((c: any) => {
        const rawFinal = c.final ?? c['FINAL'] ?? c['Final'] ?? c.final_cartao ?? c.ultimos_digitos ?? c.numero_final;
        const rawColor = c.color ?? c['COLOR'] ?? c['Color'] ?? c.cor ?? c['COR'] ?? c['Cor'];
        const rawIcone = c.icone ?? c['ICONE'] ?? c['ícone'] ?? c['ÍCONE'] ?? c.icon ?? c['ICON'];

        return {
          ...c,
          id: Number(c.id),
          limite: c.limite === undefined || c.limite === null
            ? undefined
            : normalizarDinheiro(c.limite),
          color: rawColor ? String(rawColor).trim() : undefined,
          icone: rawIcone ? String(rawIcone).trim() : undefined,
          final: (rawFinal !== undefined && rawFinal !== null && String(rawFinal).trim() !== '') ? String(rawFinal).trim() : undefined
        };
      });

      const configData = {
        titulares: titularesData || [],
        cartoes: normalizedCartoes
      };
      setConfig(configData);

      // Mantém somente as últimas janelas em memória nesta aba.
      setFinancialCache(cacheKey, {
          despesas: formattedDespesas,
          receitas: receitasData || [],
          cartaoTransacoes: cartaoTransacoesData || [],
          config: configData,
          emprestimos: emprestimosData || [],
          contasFixas: contasFixasPreservadas,
          contasFixasExcecoes: contasFixasExcecoesData,
          nota: parsedNotaStr,
          lembretes: parsedLembretesList,
          avisosConfig: parsedAvisosList
      });
      loadedFinancialWindow.current = financialWindowKey;

    } catch (error: any) {
      reportOperationFailure('finance_load', error);
      const msg = typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error);
      alert(`Erro ao carregar dados: ${msg}`);
    } finally {
      if (requestId === fetchSequence.current) {
        setIsLoading(false);
        isInitialLoad.current = false;
      }
    }
  }, [financialCompetencies, financialWindowKey, user?.id]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    const profileUserId = user.id;
    const { data: myProfile, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (authenticatedUserId.current !== profileUserId) return;
    
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
      if (authenticatedUserId.current !== profileUserId) return;
      if (members) setFamilyMembers(members);
    } else {
      // Se não houver perfil mas o usuário estiver logado, cria um registro padrão
      const { data: createdProfile } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        nome: user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário',
        tipo: 'titular'
      }).select().single();

      if (authenticatedUserId.current !== profileUserId) return;
      if (createdProfile) {
        setUserProfile(createdProfile);
        setFamilyId(createdProfile.family_id);
        setUserName(createdProfile.nome);
        setUserType('titular');
      }
    }
  }, [user?.id]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user?.id) throw new Error('Sessão indisponível para atualizar o perfil.');
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;

    // A sincronização da foto é complementar: o perfil principal já foi salvo.
    const currentName = updates.nome || userName;
    let photoSynced = false;
    if (updates.foto && currentName) {
      const { error: syncError } = await supabase.from('titulares')
        .update({ foto: updates.foto })
        .eq('nome', currentName)
        .eq('user_id', user.id);
      if (syncError) reportOperationFailure('profile_photo_sync', syncError);
      else photoSynced = true;
    }

    await fetchProfile();
    if (updates.family_id !== undefined && updates.family_id !== familyId) {
      await fetchData();
      return;
    }
    if (photoSynced) {
      invalidateFinancialSnapshots();
      setConfig(prev => ({
        ...prev,
        titulares: prev.titulares.map(t => t.nome === currentName && t.user_id === user.id
          ? { ...t, foto: updates.foto }
          : t)
      }));
    }
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

  // Dados financeiros acompanham a janela selecionada; metadados do perfil
  // continuam vinculados apenas à sessão.
  useEffect(() => {
    if (user?.id) {
      restoreFromCache(user.id, financialWindowKey);
      fetchData(user.id);
    }
  }, [user?.id, fetchData, financialWindowKey, restoreFromCache]);

  useEffect(() => {
    if (user?.id) fetchProfile();
  }, [user?.id, fetchProfile]);

  // Auth listener - roda apenas uma vez para configurar o ouvinte
  useEffect(() => {
    purgeLegacyFinancialCache();
    const discardSessionData = () => {
      clearFinancialCache();
      loadedFinancialWindow.current = null;
      fetchSequence.current++;
      isInitialLoad.current = true;
      periodWasManuallyChanged.current = false;
      initialPeriodWasResolved.current = false;
      setDespesas([]);
      setReceitas([]);
      setCartaoTransacoes([]);
      setConfig({ titulares: [], cartoes: [] });
      setEmprestimos([]);
      setContasFixas([]);
      setContasFixasExcecoes([]);
      setNota('');
      setLembretes([]);
      setAvisosConfig({ vencidas: true, hoje: true, radar: false });
      setFamilyId(null);
      setFamilyMembers([]);
      setUserName(null);
      setUserType('membro');
      setUserProfile(null);
      setThemeMode('light');
      setThemeColor('#4361ee');
    };
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const currentUser = session?.user ?? null;
        if (authenticatedUserId.current && authenticatedUserId.current !== currentUser?.id) {
          discardSessionData();
          setIsLoading(Boolean(currentUser));
        }
        authenticatedUserId.current = currentUser?.id ?? null;
        setUser(currentUser);
        if (!currentUser) setIsLoading(false);
      })
      .catch(async (error) => {
        reportOperationFailure('session_read', error);
        if (error.message?.includes('refresh_token_not_found')) {
          await supabase.auth.signOut();
        }
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      if (event === 'SIGNED_OUT' || (authenticatedUserId.current && authenticatedUserId.current !== currentUser?.id)) {
        discardSessionData();
        setIsLoading(event !== 'SIGNED_OUT');
      }
      authenticatedUserId.current = currentUser?.id ?? null;
      setUser(currentUser);
      
      if (event === 'SIGNED_OUT') {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // On mount: apply a neutral default until fetchProfile loads the user's preference
  useEffect(() => {
    // No-op: dark mode is loaded per-user inside fetchProfile
  }, []);

  useEffect(() => {
    // Apply theme classes whenever state changes
    document.body.classList.remove('dark-mode', 'black-mode', 'dark');
    document.documentElement.classList.remove('dark-mode', 'black-mode', 'dark');
    if (themeMode === 'dark') {
      document.body.classList.add('dark-mode', 'dark');
      document.documentElement.classList.add('dark-mode', 'dark');
    } else if (themeMode === 'black') {
      document.body.classList.add('black-mode', 'dark');
      document.documentElement.classList.add('black-mode', 'dark');
    }
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
      reportOperationFailure('settings_sync', error);
    }
  };

  useEffect(() => {
    if (themeColor) {
      document.documentElement.style.setProperty('--primary', themeColor);
      document.documentElement.style.setProperty('--bs-primary', themeColor);
      document.documentElement.style.setProperty('--primary-glow', `${themeColor}40`);
      document.documentElement.style.setProperty('--primary-subtle', `${themeColor}1a`);
      if (user?.id) {
        localStorage.setItem(`fin_theme_color_${user.id}`, themeColor);
      }
    }
  }, [themeColor, user?.id]);

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
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousDespesas = despesas;
    const previousCartaoTransacoes = cartaoTransacoes;

    try {
      const totalParcelas = Number(d.parcela_total || 1);
      const valorParcela = normalizarDinheiro(d.valor);
      const dataStr = d.vencimento || format(new Date(), 'yyyy-MM-dd');
      const dataInicial = parseISO(dataStr);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDiaOriginal = isLastDayOfMonth(dataInicial);

      if (d.cartao_vencimento_id) {
        // Se for despesa de cartão, lança na tabela 'cartoes' (pode ser parcelado)
        const cartaoConfig = config.cartoes.find(c => c.id === d.cartao_vencimento_id);
        const newCartaoItems: CartaoTransacao[] = [];
        let firstComp = '';

        for (let i = 1; i <= totalParcelas; i++) {
          let comp: string;
          if (i === 1) {
            if (cartaoConfig) {
              comp = calcularCompetenciaCartao(dataInicial, cartaoConfig.dia_vencimento, cartaoConfig.dia_fechamento);
            } else {
              comp = format(dataInicial, 'MM/yyyy');
            }
            firstComp = comp;
          } else {
            if (firstComp) {
              const [m, y] = firstComp.split('/').map(Number);
              const firstDate = new Date(y, m - 1, 1);
              comp = format(addMonths(firstDate, i - 1), 'MM/yyyy');
            } else {
              comp = format(addMonths(dataInicial, i - 1), 'MM/yyyy');
            }
          }

          newCartaoItems.push({
            id: -Date.now() - i,
            user_id: user.id,
            estabelecimento: d.descricao,
            valor: valorParcela,
            competencia: comp,
            cartao_id: d.cartao_vencimento_id,
            categoria: d.categoria || 'cartoes',
            titular_id: d.titular_id,
            parcela_atual: i,
            parcela_total: totalParcelas,
            data_compra: format(dataInicial, 'yyyy-MM-dd'),
          });
        }

        // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
        setCartaoTransacoes(prev => [...prev, ...newCartaoItems]);

        await lancarParcelas('cartao', {
          ...d,
          cartao_id: d.cartao_vencimento_id,
          cartao_config: cartaoConfig
        }, user.id, familyId!);
      } else {
        // Despesa fixa/variável normal
        const newDespesaItems: Despesa[] = [];
        for (let i = 1; i <= totalParcelas; i++) {
          const dataVenc = projetarProximoVencimento(
            dataInicial,
            i - 1,
            isUltimoDiaOriginal,
            diaOriginal,
            true
          );
          const comp = calcularCompetencia(dataVenc);

          newDespesaItems.push({
            id: -Date.now() - i,
            descricao: d.descricao,
            valor: valorParcela,
            competencia: comp,
            categoria: d.categoria || categorizar(d.descricao || ''),
            parcela_atual: i,
            parcela_total: totalParcelas,
            vencimento: format(dataVenc, 'yyyy-MM-dd'),
            status: (d.status as Status) || 'Em aberto',
            titular_id: d.titular_id,
            emprestimo_id: d.emprestimo_id,
            conta_fixa_id: d.conta_fixa_id,
            isSummary: false
          });
        }

        // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
        setDespesas(prev => [...prev, ...newDespesaItems]);

        await salvarDespesa(d, user.id, familyId!);
      }
      await fetchData();
    } catch (error) {
      reportOperationFailure('expense_create', error);
      setDespesas(previousDespesas);
      setCartaoTransacoes(previousCartaoTransacoes);
      throw error;
    }
  };

  const addContaFixa = async (c: Omit<ContaFixaConfig, 'id' | 'user_id' | 'family_id'>) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousContas = contasFixas;
    try {
      const tempContaFixa: ContaFixaConfig = {
        id: -Date.now(),
        user_id: user.id,
        family_id: familyId,
        descricao: c.descricao,
        valor_mensal: normalizarDinheiro(c.valor_mensal),
        total_parcelas: c.total_parcelas,
        parcela_atual: c.parcela_atual || 1,
        data_inicio: c.data_inicio,
        competencia_inicial: c.competencia_inicial,
        titular_id: c.titular_id,
        categoria: c.categoria,
        cartao_id: c.cartao_id,
        tipo: c.tipo || 'despesa'
      };
      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setContasFixas(prev => [...prev, tempContaFixa]);

      await salvarContaFixaConfig(c, user.id, familyId);
      await fetchData();
    } catch (error) {
      reportOperationFailure('recurrence_create', error);
      setContasFixas(previousContas);
      throw error;
    }
  };

  const updateContaFixa = async (id: number, updates: Partial<ContaFixaConfig>) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousContas = contasFixas;
    const normalizedUpdates = updates.valor_mensal === undefined
      ? updates
      : { ...updates, valor_mensal: normalizarDinheiro(updates.valor_mensal) };
    try {
      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setContasFixas(prev => prev.map(c => c.id === id ? { ...c, ...normalizedUpdates } : c));
      await salvarContaFixaConfig({ id, ...normalizedUpdates }, user.id, familyId);
      await fetchData();
    } catch (error) {
      reportOperationFailure('recurrence_update', error);
      setContasFixas(previousContas);
      throw error;
    }
  };

  const endContaFixa = async (id: number) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousContas = contasFixas;
    try {
      setContasFixas(prev => prev.map(c => c.id === id
        ? { ...c, status: 'cancelado', encerrada_em: new Date().toISOString(), encerrada_por: user.id }
        : c));
      await encerrarContaFixaConfig(id, 'cancelado');
      await fetchData();
    } catch (error) {
      reportOperationFailure('recurrence_end', error);
      setContasFixas(previousContas);
      throw error;
    }
  };

  const endContaFixaFromOccurrence = async (id: number, occurrence: number) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousContas = contasFixas;
    try {
      setContasFixas(prev => prev.map(c => c.id === id
        ? {
            ...c,
            status: 'cancelado',
            encerrada_em: new Date().toISOString(),
            encerrada_por: user.id,
            encerrada_a_partir_da_ocorrencia: occurrence
          }
        : c));
      await encerrarContaFixaDesde(id, occurrence);
      await fetchData();
    } catch (error) {
      reportOperationFailure('recurrence_end_from_occurrence', error);
      setContasFixas(previousContas);
      throw error;
    }
  };

  const updateDespesa = async (id: number, updates: Partial<Despesa>) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousDespesas = despesas;
    const normalizedUpdates = updates.valor === undefined
      ? updates
      : { ...updates, valor: normalizarDinheiro(updates.valor) };
    try {
      const isVirtual = id < 0;
      const item = isVirtual 
        ? consolidatedDespesas.find(d => d.id === id) 
        : despesas.find(d => d.id === id);

      if (!item) return;

      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO ESTADO LOCAL (0ms de atraso)
      if (isVirtual) {
        // Ao pagar/atualizar um item virtual, insere-o imediatamente no estado local
        setDespesas(prev => [
          ...prev.filter(d => !(item.conta_fixa_id && Number(d.conta_fixa_id) === Number(item.conta_fixa_id) && Number(d.parcela_atual) === Number(item.parcela_atual))),
          { ...item, ...normalizedUpdates, isSummary: false, id: id } as Despesa
        ]);
      } else if (item.emprestimo_id && normalizedUpdates.status === 'Em aberto') {
        // Ao reabrir empréstimo físico, remove do banco/estado físico para voltar a ser projetado virtualmente
        setDespesas(prev => prev.filter(d => d.id !== id));
      } else {
        // Item físico existente: altera status instantaneamente
        setDespesas(prev => prev.map(d => d.id === id ? { ...d, ...normalizedUpdates } : d));
      }

      // REGRAS ESPECIAIS PARA EMPRÉSTIMOS NO BANCO
      if (item.emprestimo_id) {
        if (!isVirtual && normalizedUpdates.status === 'Em aberto') {
          const { error } = await supabase.from('despesas').delete().eq('id', id);
          if (error) throw error;
          await fetchData();
          return;
        }
      }

      if (isVirtual) {
        const { id: _, ...dadosParaSalvar } = { ...item, ...normalizedUpdates };
        await salvarDespesa(dadosParaSalvar, user.id, familyId);
      } else {
        await salvarDespesa({ ...normalizedUpdates, id }, user.id, familyId);
      }

      await fetchData();
    } catch (error: any) {
      reportOperationFailure('expense_update', error);
      setDespesas(previousDespesas);
      throw error;
    }
  };

  const deleteDespesa = async (id: number) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousDespesas = despesas;
    const previousContas = contasFixas;
    const previousEmprestimos = emprestimos;
    const previousExceptions = contasFixasExcecoes;
    try {
      const isVirtual = id < 0;
      const item = isVirtual 
        ? consolidatedDespesas.find(d => d.id === id) 
        : despesas.find(d => d.id === id);

      if (!item) throw new Error('O lançamento informado não foi encontrado.');

      if (item.conta_fixa_id) {
        const occurrence = Number(item.conta_fixa_ocorrencia || item.parcela_atual);
        setDespesas(prev => prev.filter(d => d.id !== id));
        setContasFixasExcecoes(prev => [...prev, {
          id: -Date.now(),
          family_id: familyId,
          conta_fixa_id: Number(item.conta_fixa_id),
          ocorrencia: occurrence,
          acao: 'ignorar',
          created_by: user.id
        }]);
        await ignorarOcorrenciaContaFixa(Number(item.conta_fixa_id), occurrence);
        await fetchData();
        return;
      }

      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setDespesas(prev => prev.filter(d => d.id !== id));

      if (isVirtual) {
        // Se for um item virtual avulso da lista de despesas, NÃO exclui a conta fixa mestre!
        // A exclusão da conta fixa mestre deve ocorrer exclusivamente pela aba/modal de Contas Fixas
      } else {
        const { data: itemDb } = await supabase.from('despesas').select('competencia').eq('id', id).single();
        const { error } = await supabase.from('despesas').delete().eq('id', id);
        if (error) throw error;
        if (itemDb) await consolidarFaturas(itemDb.competencia, user.id);
      }
      await fetchData();
    } catch (error) {
      reportOperationFailure('expense_delete', error);
      setDespesas(previousDespesas);
      setContasFixas(previousContas);
      setEmprestimos(previousEmprestimos);
      setContasFixasExcecoes(previousExceptions);
      throw error;
    }
  };

  const deleteCartaoTransacao = async (id: number) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousTransacoes = cartaoTransacoes;
    const previousExceptions = contasFixasExcecoes;
    try {
      const isVirtual = id < 0;
      const item = isVirtual
        ? allProjectedCartaoTransacoes.find(c => c.id === id)
        : cartaoTransacoes.find(c => c.id === id);

      if (!item) throw new Error('A compra informada não foi encontrada.');

      if (item.conta_fixa_id && item.conta_fixa_parcela) {
        setCartaoTransacoes(prev => prev.filter(c => c.id !== id));
        setContasFixasExcecoes(prev => [...prev, {
          id: -Date.now(),
          family_id: familyId,
          conta_fixa_id: Number(item.conta_fixa_id),
          ocorrencia: Number(item.conta_fixa_parcela),
          acao: 'ignorar',
          created_by: user.id
        }]);
        await ignorarOcorrenciaContaFixa(Number(item.conta_fixa_id), Number(item.conta_fixa_parcela));
        await fetchData();
        return;
      }

      if (isVirtual) {
        throw new Error('A ocorrência projetada não possui uma recorrência válida.');
      }

      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setCartaoTransacoes(prev => prev.filter(c => c.id !== id));

      const { data: itemDb } = await supabase.from('cartoes').select('competencia').eq('id', id).single();
      const { error } = await supabase.from('cartoes').delete().eq('id', id);
      if (error) throw error;
      if (itemDb) await consolidarFaturas(itemDb.competencia, user.id);
      await fetchData();
    } catch (error) {
      reportOperationFailure('card_transaction_delete', error);
      setCartaoTransacoes(previousTransacoes);
      setContasFixasExcecoes(previousExceptions);
      throw error;
    }
  };

  const updateCartaoTransacao = async (id: number, updates: Partial<CartaoTransacao>) => {
    if (!user) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousTransacoes = cartaoTransacoes;
    const normalizedUpdates = updates.valor === undefined
      ? updates
      : { ...updates, valor: normalizarDinheiro(updates.valor) };
    try {
      const isVirtual = id < 0;
      const projectedItem = isVirtual
        ? allProjectedCartaoTransacoes.find(c => c.id === id)
        : undefined;

      if (isVirtual) {
        if (!projectedItem?.conta_fixa_id) {
          throw new Error('A ocorrência projetada não possui uma recorrência válida.');
        }

        await materializarOcorrenciaCartao({ ...projectedItem, ...normalizedUpdates });
        await consolidarFaturas(normalizedUpdates.competencia || projectedItem.competencia, user.id);
        await fetchData();
        return;
      }

      // Atualização otimista imediata
      setCartaoTransacoes(prev => prev.map(c => c.id === id ? { ...c, ...normalizedUpdates } : c));

      // 1. Obter competência atual para recalcular faturas se necessário
      const { data: item } = await supabase.from('cartoes').select('competencia').eq('id', id).single();
      
      const payload: any = { ...normalizedUpdates };

      const { error } = await supabase.from('cartoes').update(payload).eq('id', id);
      if (error) throw error;
      
      // 2. Consolidar faturas da competência afetada
      if (item?.competencia) await consolidarFaturas(item.competencia, user.id);
      
      // 3. Se a competência mudou, consolidar a nova também
      if (normalizedUpdates.competencia && normalizedUpdates.competencia !== item?.competencia) {
        await consolidarFaturas(normalizedUpdates.competencia, user.id);
      }
      
      await fetchData();
    } catch (error) {
      reportOperationFailure('card_transaction_update', error);
      setCartaoTransacoes(previousTransacoes);
      throw error;
    }
  };

  const addReceita = async (r: Omit<Receita, 'id'>) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousReceitas = receitas;
    try {
      const totalParcelas = Number(r.parcela_total || 1);
      const valorParcela = normalizarDinheiro(r.valor);
      const dataStr = r.data_recebimento || format(new Date(), 'yyyy-MM-dd');
      const dataInicial = parseISO(dataStr);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDiaOriginal = isLastDayOfMonth(dataInicial);

      const newReceitaItems: Receita[] = [];
      for (let i = 1; i <= totalParcelas; i++) {
        let dataVenc = projetarProximoVencimento(
          dataInicial,
          i - 1,
          isUltimoDiaOriginal,
          diaOriginal,
          false
        );
        const agendamento = resolverAgendamentoReceita(dataVenc);
        const comp = agendamento.competencia;
        dataVenc = agendamento.dataRecebimento;

        newReceitaItems.push({
          id: -Date.now() - i,
          descricao: r.descricao,
          valor: valorParcela,
          competencia: comp,
          categoria: r.categoria || categorizar(r.descricao || ''),
          data_recebimento: format(dataVenc, 'yyyy-MM-dd'),
          titular_id: r.titular_id,
          conta_fixa_id: r.conta_fixa_id,
          parcela_atual: i,
          parcela_total: totalParcelas,
          status: (r.status as Status) || (format(dataVenc, 'yyyy-MM-dd') <= format(new Date(), 'yyyy-MM-dd') ? 'Recebido' : 'Pendente')
        });
      }

      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setReceitas(prev => [...prev, ...newReceitaItems]);

      await salvarReceita(r, user.id, familyId);
      await fetchData();
    } catch (error) {
      reportOperationFailure('income_create', error);
      setReceitas(previousReceitas);
      throw error;
    }
  };

  const updateReceita = async (id: number, updates: Partial<Receita>) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousReceitas = receitas;
    const normalizedUpdates = updates.valor === undefined
      ? updates
      : { ...updates, valor: normalizarDinheiro(updates.valor) };
    try {
      const isVirtual = id < 0;
      const item = isVirtual 
        ? consolidatedReceitas.find(r => r.id === id) 
        : receitas.find(r => r.id === id);

      if (!item) return;

      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO ESTADO LOCAL (0ms de atraso)
      if (isVirtual) {
        setReceitas(prev => [
          ...prev.filter(r => !(item.conta_fixa_id && Number(r.conta_fixa_id) === Number(item.conta_fixa_id) && (r.competencia === item.competencia || Number(r.parcela_atual) === Number(item.parcela_atual)))),
          { ...item, ...normalizedUpdates, id: id } as Receita
        ]);
      } else {
        setReceitas(prev => prev.map(r => r.id === id ? { ...r, ...normalizedUpdates } : r));
      }

      if (isVirtual) {
        const { id: _, ...dadosParaSalvar } = { ...item, ...normalizedUpdates };
        await salvarReceita(dadosParaSalvar, user.id, familyId);
      } else {
        await salvarReceita({ ...normalizedUpdates, id }, user.id, familyId);
      }
      
      await fetchData();
    } catch (error) {
      reportOperationFailure('income_update', error);
      setReceitas(previousReceitas);
      throw error;
    }
  };

  const deleteReceita = async (id: number) => {
    if (!user || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousReceitas = receitas;
    const previousContas = contasFixas;
    const previousExceptions = contasFixasExcecoes;
    try {
      const isVirtual = id < 0;
      const item = isVirtual 
        ? consolidatedReceitas.find(r => r.id === id) 
        : receitas.find(r => r.id === id);

      if (!item) throw new Error('A receita informada não foi encontrada.');

      if (item.conta_fixa_id) {
        const master = contasFixas.find(c => Number(c.id) === Number(item.conta_fixa_id));
        const occurrence = Number(
          item.conta_fixa_ocorrencia
          || (master ? resolverOcorrenciaContaFixa(master.competencia_inicial, item.competencia) : null)
          || item.parcela_atual
        );
        setReceitas(prev => prev.filter(r => r.id !== id));
        setContasFixasExcecoes(prev => [...prev, {
          id: -Date.now(),
          family_id: familyId,
          conta_fixa_id: Number(item.conta_fixa_id),
          ocorrencia: occurrence,
          acao: 'ignorar',
          created_by: user.id
        }]);
        await ignorarOcorrenciaContaFixa(Number(item.conta_fixa_id), occurrence);
        await fetchData();
        return;
      }

      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setReceitas(prev => prev.filter(r => r.id !== id));

      if (!isVirtual) {
        const { error } = await supabase.from('receitas').delete().eq('id', id);
        if (error) throw error;
      }
      await fetchData();
    } catch (error) {
      reportOperationFailure('income_delete', error);
      setReceitas(previousReceitas);
      setContasFixas(previousContas);
      setContasFixasExcecoes(previousExceptions);
      throw error;
    }
  };

  const addTitular = async (t: Omit<Titular, 'id'>) => {
    if (!user || !familyId) throw new Error('Sessão indisponível para cadastrar o titular.');
    const { data, error } = await supabase.from('titulares').insert([{
      nome: t.nome,
      foto: t.foto,
      user_id: user.id,
      family_id: familyId
    }]).select();
    
    if (error) {
      reportOperationFailure('holder_create', error);
      throw error;
    }

    if (!data?.[0]) throw new Error('O titular não foi retornado após a gravação.');
    setConfig(prev => ({ ...prev, titulares: [...prev.titulares, data[0]] }));
  };

  const deleteTitular = async (id: number) => {
    const previousConfig = config;
    try {
      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setConfig(prev => ({ ...prev, titulares: prev.titulares.filter(t => t.id !== id) }));
      const { error } = await supabase.from('titulares').delete().eq('id', id);
      if (error) throw error;
      invalidateFinancialSnapshots();
      setConfig(prev => ({ ...prev, titulares: prev.titulares.filter(t => t.id !== id) }));
    } catch (error: any) {
      reportOperationFailure('holder_delete', error);
      setConfig(previousConfig);
      if (error?.code === '23503') {
        throw new Error('Este titular possui cartões ou lançamentos vinculados e precisa ser mantido para preservar o histórico.');
      }
      throw new Error('Não foi possível excluir o titular. Tente novamente.');
    }
  };

  const updateTitular = async (id: number, updated: Partial<Titular>) => {
    if (!user) throw new Error('Sessão indisponível para atualizar o titular.');
    const { error } = await supabase.from('titulares').update(updated).eq('id', id);
    if (error) {
      reportOperationFailure('holder_update', error);
      throw error;
    }

    // A sincronização do perfil é complementar à atualização do titular.
    const titular = config.titulares.find(t => t.id === id);
    const tName = updated.nome || titular?.nome;
    if (updated.foto && tName === userName && user?.id) {
      const { error: syncError } = await supabase.from('profiles')
        .update({ foto: updated.foto })
        .eq('id', user.id);
      if (syncError) reportOperationFailure('holder_photo_sync', syncError);
      else await fetchProfile();
    }

    setConfig(prev => ({
      ...prev,
      titulares: prev.titulares.map(t => t.id === id ? { ...t, ...updated } : t)
    }));
  };

  const sendCartaoInsert = async (payload: any) => {
    return persistCardWithLegacyRetry(
      payload,
      cardPayload => supabase.from('cartoes_config').insert([cardPayload]).select(),
      error => reportOperationFailure('card_insert_legacy_retry', error),
    );
  };

  const addCartao = async (c: Omit<CartaoConfig, 'id'>) => {
    if (!user || !familyId) throw new Error('Sessão indisponível para cadastrar o cartão.');

    const payload: any = {
      user_id: user.id,
      family_id: familyId,
      nome_cartao: c.nome_cartao,
      titular_id: c.titular_id,
      dia_vencimento: Number(c.dia_vencimento),
      dia_fechamento: Number(c.dia_fechamento),
      final: c.final ? String(c.final).trim() : null,
      color: c.color || '#00AE9A',
      icone: c.icone || null
    };

    // Atualização otimista imediata
    const tempId = Date.now();
    const optimisticCard: CartaoConfig = { id: tempId, ...payload } as any;
    setConfig(prev => ({ ...prev, cartoes: [...prev.cartoes, optimisticCard] }));

    const { data, error } = await sendCartaoInsert(payload);

    if (error) {
      reportOperationFailure('card_create', error);
      setConfig(prev => ({ ...prev, cartoes: prev.cartoes.filter(item => item.id !== tempId) }));
      throw error;
    }

    if (data && data[0]) {
      const savedCard: CartaoConfig = {
        ...data[0],
        color: data[0].color || data[0].cor || payload.color,
        icone: data[0].icone || data[0]['ícone'] || data[0].icon || payload.icone,
        final: data[0].final || data[0]['Final'] || payload.final
      };
      setConfig(prev => ({
        ...prev,
        cartoes: prev.cartoes.map(item => item.id === tempId ? savedCard : item)
      }));
    } else {
      setConfig(prev => ({ ...prev, cartoes: prev.cartoes.filter(item => item.id !== tempId) }));
      throw new Error('O cartão não foi retornado após a gravação.');
    }
  };

  const sendCartaoUpdate = async (id: number, payload: any) => {
    const cardId = Number(id);
    return persistCardWithLegacyRetry(
      payload,
      cardPayload => supabase.from('cartoes_config').update(cardPayload).eq('id', cardId),
      error => reportOperationFailure('card_update_legacy_retry', error),
    );
  };

  const updateCartao = async (id: number, updated: Partial<CartaoConfig>) => {
    const previousConfig = config;
    const cardId = Number(id);
    const finalVal = updated.final !== undefined ? (updated.final ? String(updated.final).trim() : null) : undefined;
    const colorVal = updated.color !== undefined ? (updated.color || '#00AE9A') : undefined;
    const iconeVal = updated.icone !== undefined ? (updated.icone || null) : undefined;

    const payload: any = {
      nome_cartao: updated.nome_cartao,
      titular_id: updated.titular_id,
      dia_vencimento: updated.dia_vencimento !== undefined ? Number(updated.dia_vencimento) : undefined,
      dia_fechamento: updated.dia_fechamento !== undefined ? Number(updated.dia_fechamento) : undefined,
      final: finalVal,
      color: colorVal,
      icone: iconeVal
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    // Atualização otimista imediata no estado local
    setConfig(prev => ({
      ...prev,
      cartoes: prev.cartoes.map(c => Number(c.id) === cardId ? { 
        ...c, 
        ...updated, 
        final: finalVal !== undefined ? (finalVal || undefined) : c.final,
        color: colorVal || c.color,
        icone: iconeVal !== undefined ? (iconeVal || undefined) : c.icone
      } : c)
    }));

    const { error } = await sendCartaoUpdate(cardId, payload);
    if (error) {
      reportOperationFailure('card_update', error);
      setConfig(previousConfig);
      throw error;
    }
  };

  const deleteCartao = async (id: number) => {
    const previousConfig = config;
    try {
      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setConfig(prev => ({ ...prev, cartoes: prev.cartoes.filter(c => c.id !== id) }));
      const { error } = await supabase.from('cartoes_config').delete().eq('id', id);
      if (error) throw error;
      invalidateFinancialSnapshots();
      setConfig(prev => ({ ...prev, cartoes: prev.cartoes.filter(c => c.id !== id) }));
    } catch (error: any) {
      reportOperationFailure('card_delete', error);
      setConfig(previousConfig);
      if (error?.code === '23503') {
        throw new Error('Este cartão possui configurações ou lançamentos vinculados e precisa ser mantido para preservar o histórico.');
      }
      throw new Error('Não foi possível excluir o cartão. Tente novamente.');
    }
  };

  const addEmprestimo = async (dados: Partial<Emprestimo>) => {
    if (!user?.id || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousEmprestimos = emprestimos;
    try {
      const tempEmprestimo: Emprestimo = {
        id: -Date.now(),
        user_id: user.id,
        family_id: familyId,
        descricao: dados.descricao || '',
        valor_total: normalizarDinheiro(dados.valor_total),
        total_parcelas: Number(dados.total_parcelas || 1),
        valor_parcela: normalizarDinheiro(dados.valor_parcela),
        taxa_mensal_percentual: Number(dados.taxa_mensal_percentual || 0),
        data_primeiro_vencimento: dados.data_primeiro_vencimento || format(new Date(), 'yyyy-MM-dd'),
        competencia_inicial: dados.competencia_inicial || competencia,
        titular_id: dados.titular_id || config.titulares[0]?.id || 1,
        ...dados
      } as Emprestimo;
      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setEmprestimos(prev => [...prev, tempEmprestimo]);

      await salvarEmprestimo(dados, user.id, familyId);
      await fetchData();
    } catch (error: any) {
      reportOperationFailure('loan_create', error);
      setEmprestimos(previousEmprestimos);
      throw error;
    }
  };

  const updateEmprestimo = async (dados: Partial<Emprestimo>) => {
    if (!user?.id || !familyId) throw new Error('Sessão financeira indisponível. Recarregue a página.');
    const previousEmprestimos = emprestimos;
    const dadosNormalizados = {
      ...dados,
      ...(dados.valor_total === undefined ? {} : { valor_total: normalizarDinheiro(dados.valor_total) }),
      ...(dados.valor_parcela === undefined ? {} : { valor_parcela: normalizarDinheiro(dados.valor_parcela) }),
    };
    try {
      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setEmprestimos(prev => prev.map(e => e.id === dadosNormalizados.id ? { ...e, ...dadosNormalizados } : e));
      await salvarEmprestimo(dadosNormalizados, user.id, familyId);
      await fetchData();
    } catch (error: any) {
      reportOperationFailure('loan_update', error);
      setEmprestimos(previousEmprestimos);
      throw error;
    }
  };

  const deleteEmprestimo = async (id: number) => {
    const previousEmprestimos = emprestimos;
    try {
      // ⚡ ATUALIZAÇÃO OTIMISTA IMEDIATA NO FRONT-END (0ms)
      setEmprestimos(prev => prev.filter(e => e.id !== id));
      await deletarEmprestimo(id);
      await fetchData();
    } catch (error) {
      reportOperationFailure('loan_delete', error);
      setEmprestimos(previousEmprestimos);
      throw error;
    }
  };

  const quitarParcelas = async (parcelas: Despesa[]) => {
    if (!user?.id || !familyId) {
      throw new Error('Sua sessão expirou. Entre novamente para confirmar a quitação.');
    }

    await materializarDespesasVinculadas(parcelas.map((p) => ({
        descricao: p.descricao,
        valor: p.valor,
        status: 'Pago',
        titular_id: p.titular_id,
        vencimento: p.vencimento && p.vencimento !== '-' ? p.vencimento : format(new Date(), 'yyyy-MM-dd'),
        competencia: p.competencia || competencia,
        parcela_atual: p.parcela_atual,
        parcela_total: p.parcela_total,
        emprestimo_id: p.emprestimo_id || undefined,
        conta_fixa_id: p.conta_fixa_id || undefined,
        categoria: p.emprestimo_id ? 'Empréstimos e Financiamentos' : (p.conta_fixa_id ? (p.categoria || 'Contas Fixas') : 'Outros')
      })));

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
      reportOperationFailure('note_update', error);
    }
  };

  const renameCategory = async (oldCategory: string, newCategory: string) => {
    if (!user || !familyId || !oldCategory || !newCategory) return;
    const oldCat = oldCategory.trim();
    const newCat = newCategory.trim();
    if (oldCat === newCat) return;

    try {
      // 1. Atualização otimista no estado local
      setDespesas(prev => prev.map(d => (d.categoria?.trim() === oldCat ? { ...d, categoria: newCat } : d)));
      setContasFixas(prev => prev.map(c => (c.categoria?.trim() === oldCat ? { ...c, categoria: newCat } : c)));
      setCartaoTransacoes(prev => prev.map(t => (t.categoria?.trim() === oldCat ? { ...t, categoria: newCat } : t)));

      // 2. Persistir em lote no Supabase
      await renomearCategoriaEmLote(oldCat, newCat, familyId, user.id);

      await fetchData();
    } catch (error) {
      reportOperationFailure('category_rename', error);
      await fetchData();
      throw new Error('Não foi possível concluir a renomeação. Os dados foram atualizados para mostrar o estado salvo.');
    }
  };

  const updateCategoryByDescription = async (descricao: string, newCategory: string) => {
    if (!user || !familyId || !descricao || !newCategory) return;
    const descTrim = descricao.trim().toLowerCase();
    const newCat = newCategory.trim();

    try {
      // 1. Atualização otimista no estado local para todos os lançamentos com esta descrição
      setDespesas(prev => prev.map(d => (d.descricao?.trim().toLowerCase() === descTrim ? { ...d, categoria: newCat } : d)));
      setContasFixas(prev => prev.map(c => (c.descricao?.trim().toLowerCase() === descTrim ? { ...c, categoria: newCat } : c)));
      setCartaoTransacoes(prev => prev.map(t => (t.estabelecimento?.trim().toLowerCase() === descTrim ? { ...t, categoria: newCat } : t)));

      // 2. Persistir em lote no Supabase
      await atualizarCategoriaPorDescricao(descricao, newCat, familyId, user.id);

      await fetchData();
    } catch (error) {
      reportOperationFailure('category_update_by_description', error);
      await fetchData();
      throw new Error('Não foi possível concluir a reclassificação. Os dados foram atualizados para mostrar o estado salvo.');
    }
  };

  const ignoredOccurrenceKeys = useMemo(() => new Set(
    contasFixasExcecoes.map(item => `${Number(item.conta_fixa_id)}:${Number(item.ocorrencia)}`)
  ), [contasFixasExcecoes]);

  const occurrenceIsIgnored = useCallback((contaFixaId: number, occurrence: number) => (
    ignoredOccurrenceKeys.has(`${Number(contaFixaId)}:${Number(occurrence)}`)
  ), [ignoredOccurrenceKeys]);




  const filteredDespesas = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return despesas.filter(d => d.competencia === competencia);
  }, [despesas, competencia]);

  const filteredReceitas = useMemo(() => {
    return receitas.filter(r => r.competencia === competencia);
  }, [receitas, competencia]);

  const allProjectedCartaoTransacoes = useMemo(() => {
    const base = cartaoTransacoes;
    const supportsStructuralRecurrences = base.some(item =>
      Object.prototype.hasOwnProperty.call(item, 'conta_fixa_id')
      && Object.prototype.hasOwnProperty.call(item, 'conta_fixa_parcela')
    );
    
    // Lançamentos virtuais de cartões vindos de contasFixas
    const virtuals: CartaoTransacao[] = [];
    contasFixas.filter(cf => cf.cartao_id && (!cf.tipo || cf.tipo === 'despesa')).forEach(cf => {
      const dataInicial = parseISO(cf.data_inicio);
      const diaOriginal = getDate(dataInicial);
      const isUltimoDia = isLastDayOfMonth(dataInicial);
      
      const lastParcelaToProject = cf.total_parcelas || 24;

      for (let i = 1; i <= lastParcelaToProject; i++) {
        if (!contaFixaPermiteOcorrencia(cf, i) || occurrenceIsIgnored(cf.id, i)) continue;
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
          (
            Number(ct.conta_fixa_id) === Number(cf.id)
            && Number(ct.conta_fixa_parcela) === i
          )
          || (
            !supportsStructuralRecurrences
            && !ct.conta_fixa_id
            && ct.cartao_id === cf.cartao_id
            && ct.estabelecimento === cf.descricao
            && ct.competencia === comp
          )
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
            conta_fixa_id: cf.id,
            conta_fixa_parcela: i,
          });
        }
      }
    });

    return [...base, ...virtuals];
  }, [cartaoTransacoes, contasFixas, config.cartoes, user?.id, occurrenceIsIgnored]);

  const filteredCartaoTransacoes = useMemo(() => {
    return allProjectedCartaoTransacoes.filter(c => c.competencia === competencia);
  }, [allProjectedCartaoTransacoes, competencia]);
  
  const totalsByCard = useMemo(() => {
    return calcularTotaisPorCartao(filteredCartaoTransacoes, config.cartoes);
  }, [filteredCartaoTransacoes, config.cartoes]);

  const consolidatedDespesas = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // 1. Despesas base (físicas), ignorando faturas de cartão consolidadas
    const baseDespesas = filteredDespesas.filter(d => !d.isSummary && !d.cartao_vencimento_id);

    // 2. Faturas de Cartão (Dinâmicas/Virtuais)
    const dynamicInvoices: Despesa[] = config.cartoes.map(card => {
      const total = totalsByCard[card.id] || 0;
      if (total === 0) return null;

      const existingInDB = filteredDespesas.find(f =>
        f.cartao_vencimento_id === card.id
        || (
          !f.cartao_vencimento_id
          && f.isSummary
          && f.descricao === `Fatura ${card.nome_cartao}`
          && Number(f.titular_id) === Number(card.titular_id)
        )
      );

      const invoiceMonth = new Date(currentYear, currentMonth - 1, 1);
      const invoiceDueDay = Math.min(
        card.dia_vencimento,
        getDate(lastDayOfMonth(invoiceMonth))
      );

      return {
        id: existingInDB?.id || (-10000000 - card.id),
        descricao: `Fatura ${card.nome_cartao}`,
        valor: existingInDB?.status === 'Pago' ? existingInDB.valor : total,
        status: existingInDB?.status || 'Em aberto',
        titular_id: card.titular_id,
        vencimento: existingInDB?.vencimento || format(
          new Date(currentYear, currentMonth - 1, invoiceDueDay),
          'yyyy-MM-dd'
        ),
        competencia: competencia,
        isSummary: true,
        parcela_atual: 1,
        parcela_total: 1,
        cartao_vencimento_id: card.id,
        categoria: existingInDB?.categoria || 'Cartões'
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
        if (!contaFixaPermiteOcorrencia(config, i) || occurrenceIsIgnored(config.id, i)) continue;
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
              conta_fixa_ocorrencia: i,
              categoria: config.categoria || 'Contas Fixas'
            } as Despesa);
          }
        }
      }
    });

    return [...baseDespesas, ...dynamicInvoices, ...virtualLoanInstallments, ...virtualFixedInstallments].filter(Boolean);
  }, [filteredDespesas, totalsByCard, config.cartoes, currentMonth, currentYear, competencia, emprestimos, contasFixas, despesas, occurrenceIsIgnored]);

  useEffect(() => {
    if (isLoading || initialPeriodWasResolved.current || periodWasManuallyChanged.current) return;

    initialPeriodWasResolved.current = true;
    if (deveAbrirProximoMesQuandoQuitado(currentMonth, currentYear, consolidatedDespesas)) {
      changeMonth(1);
    }
  }, [isLoading, currentMonth, currentYear, consolidatedDespesas]);

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
        if (!contaFixaPermiteOcorrencia(config, i) || occurrenceIsIgnored(config.id, i)) continue;
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
  }, [despesas, emprestimos, contasFixas, avisosConfig, occurrenceIsIgnored]);

  const consolidatedReceitas = useMemo(() => {
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
        if (!contaFixaPermiteOcorrencia(config, i) || occurrenceIsIgnored(config.id, i)) continue;
        let dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal, false);
        const agendamento = resolverAgendamentoReceita(dataVenc);
        
        let comp = agendamento.competencia;
        if (config.competencia_inicial) {
          const [m, y] = config.competencia_inicial.split('/').map(Number);
          const baseDate = new Date(y, m - 1, 1);
          comp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
        }
        dataVenc = agendamento.dataRecebimento;

        const existeNoBanco = receitas.find(r => 
          Number(r.conta_fixa_id) === Number(config.id) && (r.competencia === comp || Number(r.parcela_atual) === Number(i))
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
              conta_fixa_ocorrencia: i,
              parcela_atual: i,
              parcela_total: config.total_parcelas || 0,
              categoria: config.categoria || 'Recursos',
              // A data prevista não comprova recebimento; só o registro materializado pode estar realizado.
              status: 'Pendente'
            } as Receita);
          }
        }
      }
    });

    return [...baseReceitas, ...virtualFixedRevenues].filter(Boolean);
  }, [filteredReceitas, contasFixas, currentMonth, currentYear, competencia, receitas, occurrenceIsIgnored]);

  const despesasGerais = useMemo(() => {
    return consolidatedDespesas;
  }, [consolidatedDespesas]);

  const stats = useMemo(() => {
    return calcularResumoFinanceiro(
      consolidatedReceitas,
      consolidatedDespesas,
      format(new Date(), 'yyyy-MM-dd')
    );
  }, [consolidatedReceitas, consolidatedDespesas]);

  const changeMonth = (delta: number) => {
    periodWasManuallyChanged.current = true;
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
    periodWasManuallyChanged.current = true;
    setCurrentMonth(month);
  };

  const setYear = (year: number) => {
    periodWasManuallyChanged.current = true;
    setCurrentYear(year);
  };


  const totalsByTitular = useMemo(() => {
    return calcularTotaisPorTitular(
      config.titulares,
      consolidatedReceitas,
      consolidatedDespesas,
      competencia
    );
  }, [consolidatedDespesas, consolidatedReceitas, config.titulares, competencia]);

  const radarStats = useMemo(() => {
    return {
      ...calcularDividaAberta(despesas),
      getFiltered: (titularId: number | null) => calcularDividaAberta(despesas, titularId),
    };
  }, [despesas]);

  const projecaoSemestral = useMemo(() => {
    return projetarFluxoCaixa({
      mesInicial: currentMonth,
      anoInicial: currentYear,
      quantidadeMeses: 12,
      despesas,
      receitas,
      cartoes: config.cartoes,
      transacoesCartao: allProjectedCartaoTransacoes,
      emprestimos,
      contasFixas,
      contasFixasExcecoes,
    }).map(item => ({
      competencia: item.competencia,
      receitas: item.receitas,
      despesas: item.totalDespesas,
      faturas: 0,
      saldo: item.saldo,
    }));
  }, [despesas, receitas, currentMonth, currentYear, allProjectedCartaoTransacoes, contasFixas, contasFixasExcecoes, emprestimos, config.cartoes]);



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
    contasFixasExcecoes,
    addContaFixa,
    updateContaFixa,
    endContaFixa,
    endContaFixaFromOccurrence,
    deleteContaFixa: endContaFixa,
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
    updateAvisosConfig,
    renameCategory,
    updateCategoryByDescription
  };
}
