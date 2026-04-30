'use client';

import React, { useState } from 'react';
import { Sidebar, Topbar, MobileNav } from '@/components/layout';
import { KPICards, ExtratoTable, TitularChart, PaymentStatusChart } from '@/components/dashboard';

import { FinanceTable, FilterBar, SummaryCards } from '@/components/finance-views';
import { AnalysisPlan } from '@/components/analysis-view';
import { Modal, ConfirmModal, FinanceForm, TitularForm, CartaoForm, MonthYearModal, ProfileForm, EmprestimoForm, PayoffModal, ExpenseSettingsModal, UniversalFinanceForm } from '@/components/modals';
import { SettingsView, SettingsModal } from '@/components/settings-view';
import { useFinance } from '@/hooks/use-finance';
import { Vault, LogIn, Loader2, Plus, Trash2, UserCircle, CreditCard as CardIcon, Settings as SettingsIcon, Lightbulb, Users, Mail, Send } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Despesa, Receita, CartaoTransacao, Titular, CartaoConfig, Status, Profile, Emprestimo, ContaFixaConfig } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { parseISO, format, getDate, isLastDayOfMonth, differenceInMonths, addMonths } from 'date-fns';
import { calculatePresentValue, projetarProximoVencimento } from '@/lib/finance-service';

export default function Home() {
  const [activeView, setActiveView] = useState('dashboard');
  const [activeSettingsTab, setActiveSettingsTab] = useState('geral');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', pass: '', nome: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMonthYearModalOpen, setIsMonthYearModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'titular' | 'cartao' | 'categoria' | 'profile' | 'settings' | 'emprestimo' | 'payoff' | 'despesa_cartao'>('despesa');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExpenseSettingsOpen, setIsExpenseSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Despesa | Receita | Titular | CartaoConfig | CartaoTransacao | Emprestimo | ContaFixaConfig | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [selectedFixed, setSelectedFixed] = useState<any>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number, type: 'despesa' | 'receita' | 'cartao_transacao' | 'titular' | 'cartao' | 'emprestimo' | 'conta_fixa' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<number | null>(null);
  const [selectedRadarIds, setSelectedRadarIds] = useState<number[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const {
    user: authUser,
    userProfile,
    despesas,
    receitas,
    cartaoTransacoes,
    currentMonth,
    currentYear,
    competencia,
    filteredDespesas,
    filteredReceitas,
    consolidatedDespesas,
    consolidatedReceitas,
    filteredCartaoTransacoes,
    despesasGerais,
    config,
    stats,
    radarStats,
    totalsByCard,
    totalsByTitular,
    projecaoSemestral,
    isLoading,
    isDarkMode,
    toggleDarkMode,
    themeColor,
    setThemeColor,
    changeMonth,
    setMonth,
    setYear,
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
    familyId,
    familyMembers,
    inviteMember,
    userName,
    userType,
    updateProfile,
    emprestimos,
    addEmprestimo,
    updateEmprestimo,
    deleteEmprestimo,
    contasFixas,
    addContaFixa,
    updateContaFixa,
    deleteContaFixa,
    quitarParcelas,
    alertas,
    lembretes,
    addLembrete,
    toggleLembrete,
    deleteLembrete,
    avisosConfig,
    updateAvisosConfig
  } = useFinance(activeView);


  React.useEffect(() => {
    setActiveFilterId(null);
    setSearchTerm('');
  }, [activeView]);

  const translateError = (error: any) => {
    const msg = error?.message || error || 'Erro inesperado';
    if (typeof msg !== 'string') return 'Erro na autenticação';
    
    if (msg.includes('Email rate limit exceeded')) {
      return 'Limite de envio de e-mail excedido. Por favor, aguarde alguns minutos antes de tentar novamente.';
    }
    if (msg.includes('Invalid login credentials')) {
      return 'E-mail ou senha incorretos.';
    }
    if (msg.includes('User already registered')) {
      return 'Este e-mail já está cadastrado.';
    }
    if (msg.includes('Signup disabled')) {
      return 'O cadastro está temporariamente desativado.';
    }
    if (msg.includes('Password should be at least 6 characters')) {
      return 'A senha deve ter pelo menos 6 caracteres.';
    }
    return msg;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      if (isSignUp) {
        await signUp(loginForm.email, loginForm.pass, loginForm.nome);
        alert('Conta criada com sucesso! Verifique seu e-mail (ou entre se já tiver convite para uma família).');
        setIsSignUp(false);
      } else {
        await signIn(loginForm.email, loginForm.pass);
      }
    } catch (error: any) {
      setLoginError(translateError(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleInvite = async (email: string) => {
    if (!email) return;
    const result = await inviteMember(email);
    if (result?.error) {
      alert(result.error);
    } else {
      alert('Convite enviado com sucesso! O membro entrará na família ao se cadastrar.');
    }
  };

  if (!authUser) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center p-3 bg-slate-900">
        <div className="card border-0 rounded-4 shadow-lg overflow-hidden w-100" style={{ maxWidth: '400px' }}>
          <div className="card-body p-4 p-md-5">
            <div className="text-center mb-4">
              <div className="d-inline-flex p-3 rounded-4 bg-primary text-white mb-3 shadow-sm">
                <i className="fa-solid fa-vault fa-2xl"></i>
              </div>
              <h2 className="fw-bold mb-1">Radar Financeiro</h2>
              <p className="text-muted small">Controle total da sua vida financeira</p>
            </div>

            <form onSubmit={handleAuth}>
              {isSignUp && (
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted text-uppercase">Como quer ser chamado?</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0"><i className="fa-solid fa-user text-muted"></i></span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 py-2"
                      placeholder="Seu nome ou apelido"
                      required={isSignUp}
                      value={loginForm.nome}
                      onChange={(e) => setLoginForm({ ...loginForm, nome: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted text-uppercase">E-mail</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-0"><i className="fa-solid fa-envelope text-muted"></i></span>
                  <input
                    type="email"
                    className="form-control bg-light border-0 py-2"
                    placeholder="exemplo@email.com"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="form-label small fw-bold text-muted text-uppercase">Senha</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-0"><i className="fa-solid fa-lock text-muted"></i></span>
                  <input
                    type="password"
                    className="form-control bg-light border-0 py-2"
                    placeholder="Sua senha"
                    required
                    value={loginForm.pass}
                    onChange={(e) => setLoginForm({ ...loginForm, pass: e.target.value })}
                  />
                </div>
              </div>

              {loginError && (
                <div className="alert alert-danger py-2 px-3 small border-0 mb-4 rounded-3 d-flex align-items-center">
                  <i className="fa-solid fa-circle-exclamation me-2"></i>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="btn btn-primary w-100 py-3 fw-bold rounded-pill shadow-sm mb-3 transition-all"
              >
                {isLoggingIn ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>{isSignUp ? 'Criando...' : 'Entrando...'}</>
                ) : (
                  <>{isSignUp ? 'Criar Conta' : 'Entrar na Conta'}<i className="fa-solid fa-arrow-right ms-2"></i></>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setLoginError(''); }}
                  className="btn btn-link link-secondary text-decoration-none small fw-bold"
                >
                  {isSignUp ? 'Já tem conta? Faça login' : 'Ainda não tem conta? Clique aqui'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
  const sortExpenses = (data: any[]) => {
    return [...data].sort((a, b) => {
      if (a.status === 'Pago' && b.status !== 'Pago') return 1;
      if (a.status !== 'Pago' && b.status === 'Pago') return -1;
      if (a.vencimento && b.vencimento && a.vencimento !== '-' && b.vencimento !== '-') {
        return a.vencimento.localeCompare(b.vencimento);
      }
      return 0;
    });
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <div className="space-y-4">
            <KPICards stats={stats} onViewChange={setActiveView} />
            <div className="row g-3 mt-1">
              <div className="col-lg-6">
                <ExtratoTable 
                  despesas={sortExpenses(consolidatedDespesas).slice(0, 15)} 
                  onEdit={(item: Despesa) => { setModalType('despesa'); setEditingItem(item); setIsModalOpen(true); }}
                />
              </div>
              <div className="col-lg-6">
                <div className="row g-3 h-100">
                  <div className="col-md-6">
                    <TitularChart despesas={consolidatedDespesas} titulares={config.titulares} />
                  </div>
                  <div className="col-md-6">
                    <PaymentStatusChart stats={stats} />
                  </div>
                  <div className="col-12">
                    <div className="bg-card border border-border rounded-4 shadow-sm h-100">
                      <div className="card-body p-3">
                        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 small text-muted text-uppercase">
                          <i className="fa-solid fa-note-sticky text-primary"></i> Anotações
                        </h6>
                        <textarea
                          className="form-control border-0 bg-light rounded-4 p-2 small transition-all focus:bg-white focus:ring-1 focus:ring-primary"
                          rows={8}

                          placeholder="💡 Seus lembretes..."
                          style={{ resize: 'none', fontSize: '0.85rem' }}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'geral':
      case 'cartoes':
      case 'receitas':
        let tableData: any = activeView === 'geral'
          ? sortExpenses(despesasGerais)
          : activeView === 'cartoes'
            ? filteredCartaoTransacoes
            : consolidatedReceitas;

        if (activeFilterId) {
          tableData = tableData.filter((item: any) => {
            if (activeView === 'cartoes') return Number(item.cartao_id) === Number(activeFilterId);
            return Number(item.titular_id) === Number(activeFilterId);
          });
        }

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          tableData = tableData.filter((item: any) => {
            if (activeView === 'geral' || activeView === 'receitas') {
              return item.descricao?.toLowerCase().includes(term);
            }
            if (activeView === 'cartoes') {
              return item.estabelecimento?.toLowerCase().includes(term);
            }
            return false;
          });
        }

        return (
          <div className="space-y-4">
            <SummaryCards
              type={activeView as 'geral' | 'cartoes' | 'receitas'}
              cartoes={config.cartoes}
              titulares={config.titulares}
              totalsByCard={totalsByCard}
              totalsByTitular={totalsByTitular}
              totalVencido={stats.totalVencido}
              activeFilterId={activeFilterId}
              onFilterChange={setActiveFilterId}
              allCartaoTransacoes={cartaoTransacoes}
              currentMonth={currentMonth}
              currentYear={currentYear}
            />
            <FilterBar
              onAdd={() => {
                let defaultType: any = 'despesa';
                if (activeView === 'cartoes') defaultType = 'despesa_cartao';
                else if (activeView === 'receitas') defaultType = 'receita';
                
                setModalType(defaultType);
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onOpenExpenseSettings={() => setIsExpenseSettingsOpen(true)}
              activeFilterId={activeFilterId}
              onClearFilter={() => setActiveFilterId(null)}
              type={activeView as 'geral' | 'cartoes' | 'receitas'}
            />
            <FinanceTable
              data={tableData}
              type={activeView === 'geral' ? 'geral' : activeView === 'cartoes' ? 'cartoes' : 'receitas'}
              onDelete={(id) => {
                setItemToDelete({ id, type: activeView === 'receitas' ? 'receita' : activeView === 'cartoes' ? 'cartao_transacao' : 'despesa' });
                setIsConfirmDeleteOpen(true);
              }}
              onToggleStatus={(id, currentVal) => {
                if (activeView === 'geral') updateDespesa(id, { status: currentVal === 'Pago' ? 'Em aberto' : 'Pago' });
                if (activeView === 'receitas') updateReceita(id, { status: currentVal === 'Recebido' ? 'Pendente' : 'Recebido' });
              }}
              onEdit={(item) => {
                const isRevenue = (item as any).data_recebimento || (item as any).tipo === 'receita';
                setModalType(isRevenue ? 'receita' : 'despesa');
                
                // Se for uma conta fixa VIRTUAL (id < 0), carregar a configuração mestre para edição/reajuste
                if ((item as any).conta_fixa_id && (item as any).id < 0) {
                  const masterConfig = contasFixas.find(c => c.id === (item as any).conta_fixa_id);
                  if (masterConfig) {
                    setEditingItem(masterConfig as any);
                    setIsModalOpen(true);
                    return;
                  }
                }

                setEditingItem(item);
                setIsModalOpen(true);
              }}
              onInlineUpdate={(id, updates) => {
                if (activeView === 'cartoes') {
                  // Mapeia descricao de volta para estabelecimento para a tabela de cartões
                  const cardUpdates = { ...updates };
                  if (cardUpdates.descricao) {
                    cardUpdates.estabelecimento = cardUpdates.descricao;
                    delete cardUpdates.descricao;
                  }
                  updateCartaoTransacao(id, cardUpdates);
                }
                if (activeView === 'geral') updateDespesa(id, updates);
              }}
              titulares={config.titulares}
              cartoes={config.cartoes}
              onPayoff={(itemId) => {
                // Busca a despesa (física ou virtual) no consolidado geral usando o ID
                const item = despesasGerais.find(d => d.id === itemId);
                if (!item) return;

                if (item.emprestimo_id) {
                  const loan = emprestimos.find(e => e.id === item.emprestimo_id);
                  if (loan) {
                    setSelectedLoan(loan);
                    setSelectedFixed(null);
                    setModalType('payoff');
                    setIsModalOpen(true);
                  }
                  return;
                }
                
                if (item.conta_fixa_id) {
                  setSelectedFixed(item);
                  setSelectedLoan(null);
                  setModalType('payoff');
                  setIsModalOpen(true);
                }
              }}
            />
          </div>
        );

      case 'radar':
        const currentCompSortable = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        // 1. Projeção de Empréstimos Virtuais (Toda a história futura)
        const projectedLoansSummary = emprestimos.reduce((acc, loan) => {
          const matchTitular = activeFilterId ? Number(loan.titular_id) === Number(activeFilterId) : true;
          if (!matchTitular) return acc;

          const dataIni = parseISO(loan.data_primeiro_vencimento);
          const diaOriginal = getDate(dataIni);
          const isUltimoDia = isLastDayOfMonth(dataIni);

          for (let i = 1; i <= loan.total_parcelas; i++) {
             const dataVenc = projetarProximoVencimento(dataIni, i - 1, isUltimoDia, diaOriginal);
             const vStr = format(dataVenc, 'yyyy-MM-dd');
             
             const exists = despesas.find(d => Number(d.emprestimo_id) === Number(loan.id) && Number(d.parcela_atual) === i);
             
             let comp = '';
             if (loan.competencia_inicial) {
               const [m, y] = loan.competencia_inicial.split('/').map(Number);
               comp = format(addMonths(new Date(y, m - 1, 1), i - 1), 'MM/yyyy');
             } else {
               comp = format(dataVenc, 'MM/yyyy');
             }

             if (!exists) {
               acc.push({
                 id: (loan.id * -2000) - i,
                 descricao: loan.descricao,
                 valor: loan.valor_parcela,
                 status: 'Em aberto',
                 vencimento: vStr,
                 competencia: comp,
                 emprestimo_id: loan.id,
                 titular_id: loan.titular_id,
                 parcela_atual: i,
                 parcela_total: loan.total_parcelas,
                 categoria: 'Empréstimos e Financiamentos'
               } as Despesa);
             }
          }
          return acc;
        }, [] as Despesa[]);

        // 2. Projeção de Contas Fixas Virtuais (Despesas)
        const projectedFixedSummary = contasFixas.reduce((acc, config) => {
          if (config.tipo === 'receita') return acc;
          const matchTitular = activeFilterId ? Number(config.titular_id) === Number(activeFilterId) : true;
          if (!matchTitular) return acc;

          const dataIni = parseISO(config.data_inicio);
          const diaOriginal = getDate(dataIni);
          const isUltimoDia = isLastDayOfMonth(dataIni);

          const limit = config.total_parcelas || (differenceInMonths(new Date(), dataIni) + 24);

          for (let i = 1; i <= limit; i++) {
             const dataVenc = projetarProximoVencimento(dataIni, i - 1, isUltimoDia, diaOriginal);
             const vStr = format(dataVenc, 'yyyy-MM-dd');
             
             const exists = despesas.find(d => Number(d.conta_fixa_id) === Number(config.id) && Number(d.parcela_atual) === i);
             
             let comp = '';
             if (config.competencia_inicial) {
               const [m, y] = config.competencia_inicial.split('/').map(Number);
               comp = format(addMonths(new Date(y, m - 1, 1), i - 1), 'MM/yyyy');
             } else {
               comp = format(dataVenc, 'MM/yyyy');
             }

             if (!exists) {
               acc.push({
                 id: (config.id * -3000) - i,
                 descricao: config.descricao,
                 valor: config.valor_mensal,
                 status: 'Em aberto',
                 vencimento: vStr,
                 competencia: comp,
                 conta_fixa_id: config.id,
                 titular_id: config.titular_id,
                 parcela_atual: i,
                 parcela_total: config.total_parcelas || 0,
                 categoria: config.categoria || 'Contas Fixas'
               } as Despesa);
             }
          }
          return acc;
        }, [] as Despesa[]);

        // 3. Filtragem Base Consolidada (Inclui Físicas, Virtuais Mês Atual e Virtuais Futuras)
        // Usamos 'despesas' (lista completa) em vez de 'despesasGerais' para garantir que a projeção 
        // seja estável independente do mês selecionado no topo.
        const baseRadarDespesas = [
          ...despesas.filter(d => !d.isSummary && !d.descricao?.startsWith('Fatura ')),
          ...projectedLoansSummary,
          ...projectedFixedSummary
        ].filter(d => {
          const matchTitular = activeFilterId ? Number(d.titular_id) === Number(activeFilterId) : true;
          const dCompSortable = d.competencia.split('/').reverse().join('-');
          // No radar, mostramos tudo da competência selecionada para frente
          return matchTitular && dCompSortable >= currentCompSortable;
        });

        const baseRadarReceitas = receitas.filter(r => {
          const matchTitular = activeFilterId ? Number(r.titular_id) === Number(activeFilterId) : true;
          const rCompSortable = r.competencia.split('/').reverse().join('-');
          return matchTitular && rCompSortable >= currentCompSortable;
        });

        // 4. Busca de Sugestões (Mostrar apenas descrições únicas POR TITULAR)
        const radarBuscaResultados = searchTerm ? Array.from(new Set(baseRadarDespesas
          .filter(d => d.descricao?.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(d => `${d.descricao}|${d.titular_id}`)
        )).map(key => {
          const [desc, tid] = key.split('|');
          return baseRadarDespesas.find(d => d.descricao === desc && Number(d.titular_id) === Number(tid));
        }).slice(0, 50) : [];

        const radarDespesasSelecionadas = selectedRadarIds.length > 0 
          ? baseRadarDespesas.filter(d => selectedRadarIds.includes(d.id))
          : baseRadarDespesas;

        // 5. Projeção de Receitas Fixas Virtuais (Incomes)
        const projectedFixedRevenuesRadar = contasFixas.reduce((acc, config) => {
          if (config.tipo !== 'receita') return acc;
          const matchTitular = activeFilterId ? Number(config.titular_id) === Number(activeFilterId) : true;
          if (!matchTitular) return acc;

          const dataIni = parseISO(config.data_inicio);
          const diaOriginal = getDate(dataIni);
          const isUltimoDia = isLastDayOfMonth(dataIni);

          const limit = config.total_parcelas || (differenceInMonths(new Date(), dataIni) + 24);

          for (let i = 1; i <= limit; i++) {
             const dataVenc = projetarProximoVencimento(dataIni, i - 1, isUltimoDia, diaOriginal, false);
             const vStr = format(dataVenc, 'yyyy-MM-dd');
             let comp = '';
             if (config.competencia_inicial) {
               const [m, y] = config.competencia_inicial.split('/').map(Number);
               comp = format(addMonths(new Date(y, m - 1, 1), i - 1), 'MM/yyyy');
             } else {
               comp = format(dataVenc, 'MM/yyyy');
             }
             
             const exists = receitas.find(r => Number(r.conta_fixa_id) === Number(config.id) && r.competencia === comp);
             
             if (!exists) {
               acc.push({
                 id: (config.id * -4000) - i,
                 descricao: config.descricao,
                 valor: config.valor_mensal,
                 data_recebimento: vStr,
                 competencia: comp,
                 conta_fixa_id: config.id,
                 titular_id: config.titular_id,
                 categoria: config.categoria || 'Recursos'
               } as Receita);
             }
          }
          return acc;
        }, [] as Receita[]);

        // 6. Estatísticas de Dívida Total (Física + Virtual filtradas pela seleção)
        const allOpenDespesas = radarDespesasSelecionadas.filter(d => {
          if (d.status !== 'Em aberto') return false;
          // Se for recorrente sem limite de parcelas, não é "dívida" acumulada
          if (d.conta_fixa_id) {
             const config = contasFixas.find(c => c.id === d.conta_fixa_id);
             if (!config || config.total_parcelas === null) return false;
          }
          return true;
        });

        const rStats = allOpenDespesas.reduce((acc, d) => {
          const loan = d.emprestimo_id ? emprestimos.find(e => e.id === d.emprestimo_id) : null;
          const taxa = loan?.taxa_mensal_percentual || 0;
          const { vp, discount } = (taxa > 0 && d.vencimento && d.vencimento !== '-')
            ? calculatePresentValue(d.valor, taxa, d.vencimento, new Date())
            : { vp: d.valor, discount: 0 };
            
          return {
            totalDividaAberto: acc.totalDividaAberto + d.valor,
            totalVP: acc.totalVP + vp,
            totalDiscount: acc.totalDiscount + discount,
            qtdParcelasRestante: acc.qtdParcelasRestante + 1
          };
        }, { totalDividaAberto: 0, totalVP: 0, totalDiscount: 0, qtdParcelasRestante: 0 });
        
        const discountPercentage = rStats.totalDividaAberto > 0 ? (rStats.totalDiscount / rStats.totalDividaAberto) * 100 : 0;

        // 7. Estatísticas do Mês Atual (para Saúde Financeira)
        const totalDespesasMes = radarDespesasSelecionadas.filter(d => d.competencia === competencia).reduce((acc, d) => acc + d.valor, 0);
        
        const currentFixedRevenues = projectedFixedRevenuesRadar.filter(p => p.competencia === competencia);
        const totalReceitasMes = baseRadarReceitas.filter(r => r.competencia === competencia).reduce((acc, r) => acc + r.valor, 0)
                               + currentFixedRevenues.reduce((acc, p) => acc + p.valor, 0);

        // 8. Projeção de 8 Meses
        const filteredProjecao: any[] = [];
        let tempMonth = currentMonth;
        let tempYear = currentYear;
        for (let i = 0; i < 8; i++) {
          const comp = `${String(tempMonth).padStart(2, '0')}/${tempYear}`;
          
          // Receitas reais + Virtuais do mês
          const standardRec = baseRadarReceitas.filter(r => r.competencia === comp).reduce((acc, r) => acc + r.valor, 0);
          const projectedFixedRec = projectedFixedRevenuesRadar.filter(p => p.competencia === comp).reduce((acc, p) => acc + p.valor, 0);
          
          const totalRec = standardRec + projectedFixedRec;
          
          // Despesas totais do mês (físicas + virtuais, EXCLUINDO faturas de cartão para não duplicar)
          const totalDesp = radarDespesasSelecionadas
            .filter(d => d.competencia === comp && !d.isSummary && !d.descricao?.startsWith('Fatura '))
            .reduce((acc, d) => acc + d.valor, 0);
          
          // Soma transações de cartões (faturas projetadas e reais)
          const fats = cartaoTransacoes.filter((c: CartaoTransacao) => {
            const matchTitular = activeFilterId ? Number(c.titular_id) === Number(activeFilterId) : true;
            return matchTitular && c.competencia === comp;
          }).reduce((acc: number, c: CartaoTransacao) => acc + c.valor, 0);

          filteredProjecao.push({
            competencia: comp,
            receitas: totalRec,
            despesas: totalDesp,
            faturas: fats,
            saldo: totalRec - (totalDesp + fats)
          });
          tempMonth++;
          if (tempMonth > 12) { tempMonth = 1; tempYear++; }
        }

        const healthScore = Math.round(totalReceitasMes > 0 ? (1 - (totalDespesasMes / totalReceitasMes)) * 100 : 0);
        
        // 9. Cálculo dos cartões de titular especializados para o Radar
        const radarTotalsByTitular = config.titulares.reduce((acc, t) => {
          // despesasGerais já contém as virtuais (loans e fixed) do mês atual
          const combined = despesasGerais.filter(d => {
            const isMyTitular = Number(d.titular_id) === Number(t.id);
            const isCurrentComp = d.competencia === competencia;
            const isOverdue = d.status === 'Em aberto' && d.vencimento && d.vencimento !== '-' && d.vencimento < todayStr;
            return isMyTitular && isCurrentComp && !isOverdue;
          });
          
          const cards = combined.filter(d => d.isSummary || d.descricao?.startsWith('Fatura ')).reduce((sum, d) => sum + d.valor, 0);
          const total = combined.reduce((sum, d) => sum + d.valor, 0);
          
          acc[t.id] = { cards, others: total - cards, total };
          return acc;
        }, {} as Record<number, { cards: number, others: number, total: number }>);

        return (
          <div className="space-y-4">
            <SummaryCards
              type="radar"
              cartoes={config.cartoes}
              titulares={config.titulares}
              totalsByCard={totalsByCard}
              totalsByTitular={totalsByTitular}
              radarTotalsByTitular={radarTotalsByTitular}
              totalVencido={0}
              activeFilterId={activeFilterId}
              onFilterChange={(id) => { setActiveFilterId(id); setSelectedRadarIds([]); }}
            />

            {/* KPIs Principais de Dívida - Agora no TOPO */}
            <div className="row g-3 mb-2">
              <div className="col-6 col-lg-3">
                <div className="kpi-card kpi-card-red flex flex-col items-center justify-center text-center h-100 py-4">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">🔴 Dívida Nominal</span>
                  <div className="text-2xl font-black text-danger mb-1">{formatCurrency(rStats.totalDividaAberto)}</div>
                  <span className="text-[10px] text-gray mt-1">Soma das parcelas</span>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div className="kpi-card kpi-card-blue flex flex-col items-center justify-center text-center h-100 py-4">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">💰 V. Presente (Hoje)</span>
                  <div className="text-2xl font-black text-primary mb-1">{formatCurrency(rStats.totalVP)}</div>
                  <span className="text-[10px] text-gray mt-1">Pagando tudo hoje</span>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div className="kpi-card kpi-card-green flex flex-col items-center justify-center text-center h-100 py-4">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">💸 Desconto Ganho</span>
                  <div className="text-2xl font-black text-success mb-1">{formatCurrency(rStats.totalDiscount)}</div>
                  <span className="text-[10px] text-success mt-1 fw-bold opacity-80">Economia de {discountPercentage.toFixed(1)}%</span>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div className="kpi-card kpi-card-purple flex flex-col items-center justify-center text-center h-100 py-4">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">📅 Parcelas</span>
                  <div className="text-2xl font-black text-faturas mb-1">{rStats.qtdParcelasRestante}</div>
                  <span className="text-[10px] text-gray mt-1">Lançamentos pendentes</span>
                </div>
              </div>
            </div>

            <div className="position-relative" ref={searchRef}>
              <FilterBar 
                type="geral"
                onAdd={() => {}} 
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                activeFilterId={activeFilterId}
                onClearFilter={() => { setActiveFilterId(null); setSelectedRadarIds([]); }}
                hideAdd={true}
                hideSearch={false}
                onFocus={() => setIsSearchFocused(true)}
              />
              
              {/* Sugestões da Busca */}
              {isSearchFocused && radarBuscaResultados.length > 0 && (
                <div className="position-absolute bg-card border border-border rounded-4 shadow-lg w-100 z-50 mt-[-15px] overflow-x-hidden overflow-y-auto" style={{ maxWidth: '400px', maxHeight: '400px' }}>
                  {radarBuscaResultados.map(d => {
                    if (!d) return null;
                    const isSelected = selectedRadarIds.includes(d.id);
                    const titularNome = config.titulares.find(t => t.id === d.titular_id)?.nome || 'N/A';
                    
                    return (
                      <div 
                        key={d.id} 
                        className="p-3 cursor-pointer transition-all d-flex justify-content-between align-items-center border-b border-border last:border-0 hover:bg-primary hover:bg-opacity-5"
                        onClick={() => {
                          const matchingIds = baseRadarDespesas
                            .filter(item => item.descricao === d.descricao && item.titular_id === d.titular_id)
                            .map(item => item.id);
                            
                          if (isSelected) {
                            setSelectedRadarIds(prev => prev.filter(id => !matchingIds.includes(id)));
                          } else {
                            setSelectedRadarIds(prev => Array.from(new Set([...prev, ...matchingIds])));
                          }
                        }}
                      >
                        <div className="fw-bold">
                          {d.descricao} 
                          <span className="ms-1 text-muted fw-normal opacity-75 small italic">"{titularNome}"</span>
                        </div>
                        <i className={cn(
                          "fa-solid transition-all",
                          isSelected ? "fa-circle-minus text-danger" : "fa-circle-plus text-primary"
                        )}></i>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* Lista de Despesas Selecionadas */}
            {selectedRadarIds.length > 0 && (
              <div className="bg-card rounded-4 border border-border shadow-sm overflow-hidden mb-4">
                <div className="p-3 border-b border-border d-flex justify-content-between align-items-center bg-light bg-opacity-30">
                  <h6 className="fw-bold m-0 d-flex align-items-center gap-2">
                    <i className="fa-solid fa-list-check text-primary"></i> Analisando ({selectedRadarIds.length}) itens específicos
                  </h6>
                  <button 
                    onClick={() => setSelectedRadarIds([])}
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold"
                  >
                    <i className="fa-solid fa-rotate-left me-1"></i> Limpar Seleção
                  </button>
                </div>
                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="px-3 py-2 small fw-bold text-muted uppercase">Titular</th>
                        <th className="px-3 py-2 small fw-bold text-muted uppercase">Descrição</th>
                        <th className="px-3 py-2 small fw-bold text-muted uppercase text-center">Parcela</th>
                        <th className="px-3 py-2 small fw-bold text-muted uppercase text-center">Competência</th>
                        <th className="px-3 py-2 small fw-bold text-muted uppercase text-center">Vencimento</th>
                        <th className="px-3 py-2 small fw-bold text-muted uppercase text-end">V. Nominal</th>
                        <th className="px-3 py-2 small fw-bold text-muted uppercase text-end">Desconto</th>
                        <th className="px-3 py-2 small fw-bold text-muted uppercase text-end">V. Presente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {radarDespesasSelecionadas.map(d => {
                        const loan = d.emprestimo_id ? emprestimos.find(e => e.id === d.emprestimo_id) : null;
                        const taxa = loan?.taxa_mensal_percentual || 0;
                        const { vp, discount } = (taxa > 0 && d.vencimento && d.vencimento !== '-')
                          ? calculatePresentValue(d.valor, taxa, d.vencimento, new Date())
                          : { vp: d.valor, discount: 0 };

                        return (
                          <tr key={d.id}>
                            <td className="px-3 py-2 fw-bold text-primary">{config.titulares.find(t => t.id === d.titular_id)?.nome || 'N/A'}</td>
                            <td className="px-3 py-2 fw-bold">{d.descricao}</td>
                            <td className="px-3 py-2 small text-muted text-center">{d.parcela_atual}/{d.parcela_total}</td>
                            <td className="px-3 py-2 small text-muted text-center">{d.competencia}</td>
                            <td className="px-3 py-2 small text-muted text-center">
                              {d.vencimento && d.vencimento !== '-' ? d.vencimento.split('-').reverse().join('/') : '-'}
                            </td>
                            <td className="px-3 py-2 fw-bold text-muted text-end">
                              {discount > 0 ? <del className="text-muted opacity-75 fw-normal">{formatCurrency(d.valor)}</del> : formatCurrency(d.valor)}
                            </td>
                            <td className="px-3 py-2 text-success fw-bold text-end">
                              {discount > 0 ? `-${formatCurrency(discount)}` : '-'}
                            </td>
                            <td className="px-3 py-2 fw-black text-primary text-end">
                              {formatCurrency(vp)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <AnalysisPlan projecao={filteredProjecao} />
            
            <div className="row g-4">
              {/* Saúde Financeira - Agora nesta linha detalhada */}
              <div className="col-md-4">
                <div className="kpi-card kpi-card-blue flex flex-col items-center justify-center text-center h-100">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">🛡️ Saúde Financeira</span>
                  <div className="text-4xl font-black text-primary mb-2">{healthScore}%</div>
                  <div className="w-full bg-light h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${healthScore}%` }} />
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="kpi-card kpi-card-green flex flex-col items-center justify-center text-center h-100">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">💡 Potencial de Economia</span>
                  <div className="text-3xl font-black text-success">{formatCurrency(totalDespesasMes * 0.15)}</div>
                  <span className="text-[10px] text-gray mt-1">Baseado em gastos não essenciais</span>
                </div>
              </div>
              <div className="col-md-4">
                <div className="kpi-card kpi-card-purple flex flex-col items-center justify-center text-center h-100">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">📉 Limite de Gastos</span>
                  <div className="text-3xl font-black text-faturas">{Math.round((totalDespesasMes / (totalReceitasMes * 0.8 || 1)) * 100)}%</div>
                  <span className="text-[10px] text-gray mt-1">Do orçamento utilizado</span>
                </div>
              </div>
            </div>


            <div className="row g-4 mt-4">
              <div className="col-lg-6">
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-fit">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Lightbulb className="text-warning" /> Insights e Sugestões
                  </h3>
                  <div className="space-y-4">
                    {[
                      { title: 'Atenção ao Saldo', text: 'Suas despesas estão próximas da receita. Revise gastos.', color: 'bg-danger/10 text-danger' },
                      { title: 'Reserva de Emergência', text: 'Tente separar 10% da receita antes do mês começar.', color: 'bg-primary/10 text-primary' },
                      { title: 'Gastos com Lazer', text: 'Seus gastos extras subiram 12% em relação ao mês passado.', color: 'bg-warning/10 text-warning' }
                    ].map((insight, i) => (
                      <div key={i} className={`p-4 rounded-xl border-l-4 border-l-current ${insight.color}`}>
                        <h4 className="font-bold text-sm mb-1">{insight.title}</h4>
                        <p className="text-xs opacity-80">{insight.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-lg-6">
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-[400px] flex flex-col">
                  <h3 className="text-center font-bold text-gray text-xs uppercase tracking-widest mb-6">📊 Distribuição Essencial vs. Estilo de Vida</h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Essencial', value: totalDespesasMes * 0.6 },
                            { name: 'Lifestyle', value: totalDespesasMes * 0.4 }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#4361ee" />
                          <Cell fill="#ff9f1c" />
                        </Pie>
                        <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'config':
        return (
          <SettingsView
            user={userProfile}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            familyMembers={familyMembers}
            onInvite={handleInvite}
            userType={userType}
            titulares={config.titulares}
            cartoes={config.cartoes}
            onAddTitular={addTitular}
            onUpdateTitular={updateTitular}
            onDeleteTitular={(id) => { 
              setItemToDelete({ id, type: 'titular' });
              setIsConfirmDeleteOpen(true);
            }}
            onAddCartao={addCartao}
            onUpdateCartao={updateCartao}
            onDeleteCartao={(id) => {
              setItemToDelete({ id, type: 'cartao' });
              setIsConfirmDeleteOpen(true);
            }}
            isMobile={true}
            themeColor={themeColor}
            setThemeColor={setThemeColor}
            activeTab={activeSettingsTab}
            onTabChange={setActiveSettingsTab}
            onCloseSettings={() => setActiveView('dashboard')}
            lembretes={lembretes}
            onAddLembrete={addLembrete}
            onToggleLembrete={toggleLembrete}
            onDeleteLembrete={deleteLembrete}
            avisosConfig={avisosConfig}
            onUpdateAvisosConfig={updateAvisosConfig}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="layout-wrapper">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        user={userProfile}
        familyMembers={familyMembers}
        onLogout={signOut}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        onInvite={handleInvite}
        onUpdateProfile={updateProfile}
        onOpenModal={(type) => {
          if (type === 'settings') setIsSettingsOpen(true);
          else if (type === 'emprestimo') {
            setModalType('emprestimo');
            setEditingItem(null);
            setIsModalOpen(true);
          }
          else {
            setModalType(type as any);
            setEditingItem(null);
            setIsModalOpen(true);
          }
        }}
      />

      <div className="content">
        {activeView !== 'config' && (
          <Topbar
            title={activeView}
            month={currentMonth}
            year={currentYear}
            onChangeMonth={changeMonth}
            onOpenPeriodModal={() => setIsMonthYearModalOpen(true)}
            onLogout={signOut}
            showBackButton={activeView !== 'dashboard'}
            onBack={() => setActiveView('dashboard')}
            user={userProfile}
            themeColor={themeColor}
            alertas={alertas}
          />
        )}

        <div className={cn("content-body p-md-4", activeView === 'config' ? "p-0" : "px-1 py-3")}>
          {isLoading ? (
            <div className="d-flex align-items-center justify-content-center h-50 pt-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : renderContent()}
        </div>

        {activeView !== 'config' && (
          <MobileNav
            activeView={activeView}
            onViewChange={(view) => {
              setActiveView(view);
            }}
            onLaunch={() => {
              setModalType('despesa');
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            activeSettingsTab={activeSettingsTab}
            onSettingsTabChange={setActiveSettingsTab}
            themeColor={themeColor}
          />
        )}

        {/* Modals */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          title={
            editingItem
              ? (modalType === 'despesa' ? 'Editar Gasto' : modalType === 'receita' ? 'Editar Ganho' : modalType === 'titular' ? 'Editar Titular' : modalType === 'cartao' ? 'Editar Cartão' : modalType === 'emprestimo' ? 'Editar Empréstimo' : 'Editar')
              : (modalType === 'profile' ? 'Editar Meu Perfil' : (modalType === 'despesa' || modalType === 'receita' || modalType === 'emprestimo') ? 'Novo Registro' : modalType === 'titular' ? 'Novo Titular' : modalType === 'cartao' ? 'Novo Cartão' : modalType === 'payoff' ? 'Simulação de Quitação' : 'Novo Registro')
          }
        >
          {modalType === 'profile' ? (
            <ProfileForm 
              initialData={userProfile}
              onSubmit={(data) => {
                updateProfile(data);
                setIsModalOpen(false);
              }}
            />
          ) : (modalType === 'despesa' || modalType === 'receita' || modalType === 'emprestimo' || modalType === 'despesa_cartao') ? (
            <UniversalFinanceForm
              initialType={modalType as any}
              subType={activeView === 'cartoes' ? 'cartao' : 'fixa'}
              titulares={config.titulares}
              cartoes={config.cartoes}
              competencia={competencia}
              initialData={editingItem}
              onClose={() => {
                setIsModalOpen(false);
                setEditingItem(null);
              }}
              onSubmitFinance={(data: Omit<Despesa, 'id'> | Omit<Receita, 'id'>) => {
                if (editingItem) {
                  if ((editingItem as any).taxa_mensal_percentual !== undefined) {
                      updateEmprestimo(data as any);
                  } else if (modalType === 'despesa' || (editingItem as any).vencimento) updateDespesa(editingItem.id, data as Omit<Despesa, 'id'>);
                  else updateReceita(editingItem.id, data as Omit<Receita, 'id'>);
                } else {
                  if ((data as any).data_recebimento) addReceita(data as Omit<Receita, 'id'>);
                  else addDespesa(data as Omit<Despesa, 'id'>);
                }
                setIsModalOpen(false);
                setEditingItem(null);
              }}
              onSubmitContaFixa={async (data: Omit<ContaFixaConfig, 'id' | 'user_id' | 'family_id'>) => {
                if (editingItem && (editingItem as any).id) {
                  await updateContaFixa((editingItem as any).id, data);
                } else {
                  await addContaFixa(data);
                }
                setIsModalOpen(false);
                setEditingItem(null);
              }}
              onSubmitEmprestimo={(data: Partial<Emprestimo>) => {
                if (editingItem) updateEmprestimo(data);
                else addEmprestimo(data);
                setIsModalOpen(false);
                setEditingItem(null);
              }}
            />
          ) : modalType === 'titular' ? (
            <TitularForm
              key={editingItem ? `edit-${(editingItem as any).id}` : 'new'}
              initialData={editingItem as Titular}
              onSubmit={(data) => {
                if (editingItem) updateTitular(editingItem.id, data);
                else addTitular(data);
                setIsModalOpen(false);
                setEditingItem(null);
              }}
            />
          ) : modalType === 'cartao' ? (
            <CartaoForm
              key={editingItem ? `edit-${(editingItem as any).id}` : 'new'}
              initialData={editingItem as CartaoConfig}
              titulares={config.titulares}
              onSubmit={(data) => {
                if (editingItem) updateCartao(editingItem.id, data);
                else addCartao(data);
                setIsModalOpen(false);
                setEditingItem(null);
              }}
            />

          ) : modalType === 'payoff' && (selectedLoan || selectedFixed) ? (
            <PayoffModal 
              loan={selectedLoan!}
              item={selectedFixed!}
              installments={despesas.filter(d => 
                (selectedLoan && d.emprestimo_id === selectedLoan.id) || 
                (selectedFixed && d.conta_fixa_id === selectedFixed.conta_fixa_id)
              )}
              onConfirmPayoff={quitarParcelas}
              onClose={() => {
                setIsModalOpen(false);
                setSelectedLoan(null);
                setSelectedFixed(null);
              }}
            />
          ) : null}
        </Modal>

        <MonthYearModal
          isOpen={isMonthYearModalOpen}
          onClose={() => setIsMonthYearModalOpen(false)}
          currentMonth={currentMonth}
          currentYear={currentYear}
          onSelect={(m, y) => {
            setMonth(m);
            setYear(y);
          }}
        />

        <ConfirmModal
          isOpen={isConfirmDeleteOpen}
          onClose={() => {
            setIsConfirmDeleteOpen(false);
            setItemToDelete(null);
          }}
          onConfirm={() => {
            if (!itemToDelete) return;
            const { id, type } = itemToDelete;
            if (type === 'despesa') deleteDespesa(id);
            else if (type === 'receita') deleteReceita(id);
            else if (type === 'cartao_transacao') deleteCartaoTransacao(id);
            else if (type === 'titular') deleteTitular(id);
            else if (type === 'cartao') deleteCartao(id);
            else if (type === 'emprestimo') deleteEmprestimo(id);
            else if (type === 'conta_fixa') deleteContaFixa(id);
          }}
          title="Confirmar Exclusão"
          message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
        />


        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={userProfile}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          themeColor={themeColor}
          setThemeColor={setThemeColor}
          familyMembers={familyMembers}
          onInvite={handleInvite}
          userType={userType}
          titulares={config.titulares}
          cartoes={config.cartoes}
          onAddTitular={addTitular}
          onUpdateTitular={updateTitular}
          onDeleteTitular={(id) => { 
            setItemToDelete({ id, type: 'titular' });
            setIsConfirmDeleteOpen(true);
          }}
          onAddCartao={addCartao}
          onUpdateCartao={updateCartao}
          onDeleteCartao={(id) => {
            setItemToDelete({ id, type: 'cartao' });
            setIsConfirmDeleteOpen(true);
          }}
          lembretes={lembretes}
          onAddLembrete={addLembrete}
          onToggleLembrete={toggleLembrete}
          onDeleteLembrete={deleteLembrete}
          avisosConfig={avisosConfig}
          onUpdateAvisosConfig={updateAvisosConfig}
        />

        <ExpenseSettingsModal
          isOpen={isExpenseSettingsOpen}
          onClose={() => setIsExpenseSettingsOpen(false)}
          emprestimos={emprestimos}
          contasFixas={contasFixas}
          onEditEmprestimo={(loan: Emprestimo) => {
            setEditingItem(loan);
            setModalType('emprestimo');
            setIsExpenseSettingsOpen(false);
            setIsModalOpen(true);
          }}
          onEditContaFixa={(config: ContaFixaConfig) => {
            setEditingItem(config);
            setModalType(config.tipo === 'receita' ? 'receita' : 'despesa');
            setIsExpenseSettingsOpen(false);
            setIsModalOpen(true);
          }}
          onDeleteEmprestimo={(id) => {
            setItemToDelete({ id, type: 'emprestimo' });
            setIsConfirmDeleteOpen(true);
          }}
          onDeleteContaFixa={(id) => {
            setItemToDelete({ id, type: 'conta_fixa' });
            setIsConfirmDeleteOpen(true);
          }}
        />
      </div>
    </div>
  );
}
