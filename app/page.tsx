'use client';

import React, { useState } from 'react';
import { Sidebar, Topbar, MobileNav } from '@/components/layout';
import Image from 'next/image';
import { DashboardView, KPICards, ExtratoTable, TitularChart, PaymentStatusChart } from '@/components/dashboard';

import { FinanceTable, FilterBar, SummaryCards } from '@/components/finance-views';
import { DespesasReceitasView } from '@/components/despesas-receitas-view';
import { CartoesView } from '@/components/cards-view';
import { RadarFinanceiroView } from '@/components/radar-view';
import { AnalysisPlan } from '@/components/analysis-view';
import { Modal, ConfirmModal, FinanceForm, TitularForm, CartaoForm, MonthYearModal, ProfileForm, EmprestimoForm, PayoffModal, ExpenseSettingsModal, UniversalFinanceForm } from '@/components/modals';
import { SettingsView } from '@/components/settings-view';
import { useFinance } from '@/hooks/use-finance';
import { Vault, LogIn, Loader2, Plus, Trash2, UserCircle, CreditCard as CardIcon, Settings as SettingsIcon, Lightbulb, Users, Mail, Send } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Despesa, Receita, CartaoTransacao, Titular, CartaoConfig, Status, Profile, Emprestimo, ContaFixaConfig } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { parseISO, format, getDate, isLastDayOfMonth, differenceInMonths, addMonths } from 'date-fns';
import { calculatePresentValue, projetarProximoVencimento } from '@/lib/finance-service';
import { motion, AnimatePresence } from 'motion/react';

function LoadingScreen({ themeColor }: { themeColor: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 overflow-hidden">
      {/* Animated Background Orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
          x: [-20, 20, -20],
          y: [-20, 20, -20]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full blur-[120px]"
        style={{ backgroundColor: themeColor }}
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.1, 0.15, 0.1],
          x: [20, -20, 20],
          y: [20, -20, 20]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full blur-[120px]"
        style={{ backgroundColor: themeColor }}
      />

      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-8 p-6 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl relative"
        >
          {/* Glowing Ring */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-[32px] border-2 border-transparent border-t-white/30 border-r-white/10"
          />
          
          <div className="relative flex items-center justify-center" style={{ width: '64px', height: '64px' }}>
             <motion.div
               animate={{ 
                 scale: [1, 1.05, 1],
                 filter: ["drop-shadow(0 0 0px rgba(255,255,255,0))", `drop-shadow(0 0 20px ${themeColor}44)`, "drop-shadow(0 0 0px rgba(255,255,255,0))"]
               }}
               transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
             >
                <Image 
                  src="/icons/icon-192.png" 
                  alt="App Logo" 
                  width={64} 
                  height={64}
                  priority
                  className="rounded-2xl"
                />
             </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-2xl font-black text-white tracking-tighter mb-2">Controle Financeiro</h1>
          <div className="flex items-center justify-center gap-2">
            <motion.div
              animate={{ width: ["0%", "100%", "0%"], left: ["0%", "0%", "100%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="h-0.5 rounded-full relative overflow-hidden bg-white/10 w-24"
            >
              <motion.div 
                className="absolute inset-0"
                style={{ backgroundColor: themeColor }}
              />
            </motion.div>
          </div>
          <motion.p 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[10px] uppercase tracking-[0.3em] font-black text-white/40 mt-6"
          >
            Preparando seu painel
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

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
  const [isGlobalHidden, setIsGlobalHidden] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // Synchronize activeView, activeSettingsTab and Modals with browser history for system back button
  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If any modal is open, close it and stay on same view
      if (isModalOpen || isSettingsOpen || isExpenseSettingsOpen || isMonthYearModalOpen || isConfirmDeleteOpen) {
        setIsModalOpen(false);
        setIsSettingsOpen(false);
        setIsExpenseSettingsOpen(false);
        setIsMonthYearModalOpen(false);
        setIsConfirmDeleteOpen(false);
        return;
      }

      // Otherwise, navigate between views and settings tabs
      if (event.state) {
        if (event.state.view) setActiveView(event.state.view);
        if (event.state.tab) setActiveSettingsTab(event.state.tab);
      } else {
        setActiveView('dashboard');
        setActiveSettingsTab('geral');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isModalOpen, isSettingsOpen, isExpenseSettingsOpen, isMonthYearModalOpen, isConfirmDeleteOpen, activeView, activeSettingsTab]);

  // Update history when view or settings tab changes
  const lastPushedView = React.useRef(activeView);
  const lastPushedTab = React.useRef(activeSettingsTab);
  React.useEffect(() => {
    if (lastPushedView.current !== activeView || lastPushedTab.current !== activeSettingsTab) {
      window.history.pushState({ view: activeView, tab: activeSettingsTab }, '');
      lastPushedView.current = activeView;
      lastPushedTab.current = activeSettingsTab;
    }
  }, [activeView, activeSettingsTab]);

  // Push history state when opening modals so system back button closes them
  React.useEffect(() => {
    if (isModalOpen || isSettingsOpen || isExpenseSettingsOpen || isMonthYearModalOpen || isConfirmDeleteOpen) {
      window.history.pushState({ view: activeView, modal: true }, '');
    }
  }, [isModalOpen, isSettingsOpen, isExpenseSettingsOpen, isMonthYearModalOpen, isConfirmDeleteOpen]);

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
    allProjectedCartaoTransacoes,
    despesasGerais,
    config,
    stats,
    radarStats,
    totalsByCard,
    totalsByTitular,
    projecaoSemestral,
    isLoading,
    isDarkMode,
    themeMode,
    setThemeMode,
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
    updateAvisosConfig,
    renameCategory
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

  if (!isLoading && !authUser) {
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
          <DashboardView
            stats={stats}
            despesas={sortExpenses(consolidatedDespesas)}
            receitas={consolidatedReceitas}
            cartoes={config.cartoes}
            titulares={config.titulares}
            projecaoSemestral={projecaoSemestral}
            currentMonth={currentMonth}
            currentYear={currentYear}
            onViewChange={setActiveView}
            onOpenPeriodModal={() => setIsMonthYearModalOpen(true)}
            isHidden={isGlobalHidden}
            onToggleVisibility={() => setIsGlobalHidden((prev) => !prev)}
            onEditDespesa={(item: Despesa) => {
              const isRevenue = (item as any).data_recebimento || (item as any).tipo === 'receita';
              setModalType(isRevenue ? 'receita' : 'despesa');
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
            onEditReceita={(item: Receita) => {
              setModalType('receita');
              setEditingItem(item);
              setIsModalOpen(true);
            }}
          />
        );

      case 'extrato':
      case 'geral':
      case 'receitas':
        return (
          <DespesasReceitasView
            despesas={despesasGerais}
            receitas={consolidatedReceitas}
            titulares={config.titulares}
            cartoes={config.cartoes}
            contasFixas={contasFixas}
            emprestimos={emprestimos}
            isHidden={isGlobalHidden}
            onOpenExpenseSettings={() => setIsExpenseSettingsOpen(true)}
            onAdd={(defaultType = 'despesa') => {
              setModalType(defaultType);
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            onDelete={(id, type) => {
              setItemToDelete({ id, type });
              setIsConfirmDeleteOpen(true);
            }}
            onToggleStatus={(id, type, currentVal) => {
              if (type === 'despesa') {
                updateDespesa(id, { status: currentVal === 'Pago' ? 'Em aberto' : 'Pago' });
              } else {
                updateReceita(id, { status: currentVal === 'Recebido' ? 'Pendente' : 'Recebido' });
              }
            }}
            onEdit={(item) => {
              const isRevenue = (item as any).data_recebimento || (item as any).tipo === 'receita';
              setModalType(isRevenue ? 'receita' : 'despesa');
              
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
            onPayoff={(itemId) => {
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
        );

      case 'cartoes':
        return (
          <CartoesView
            cartoes={config.cartoes}
            titulares={config.titulares}
            transacoes={filteredCartaoTransacoes}
            despesas={despesasGerais}
            totalsByCard={totalsByCard}
            competencia={competencia}
            currentMonth={currentMonth}
            currentYear={currentYear}
            isHidden={isGlobalHidden}
            onOpenPayoffModal={() => {
              setModalType('payoff');
              setIsModalOpen(true);
            }}
            onOpenExpenseSettings={() => setIsExpenseSettingsOpen(true)}
            onAdd={() => {
              setModalType('despesa_cartao');
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            onEdit={(item) => {
              setModalType('despesa_cartao');
              setEditingItem(item);
              setIsModalOpen(true);
            }}
            onDelete={(id) => {
              setItemToDelete({ id, type: 'cartao_transacao' });
              setIsConfirmDeleteOpen(true);
            }}
          />
        );

      case 'radar':
        return (
          <RadarFinanceiroView
            despesas={despesas}
            receitas={receitas}
            cartoes={config.cartoes}
            titulares={config.titulares}
            emprestimos={emprestimos}
            contasFixas={contasFixas}
            allProjectedCartaoTransacoes={allProjectedCartaoTransacoes}
            currentMonth={currentMonth}
            currentYear={currentYear}
            activeFilterId={activeFilterId}
            onFilterChange={setActiveFilterId}
            isHidden={isGlobalHidden}
            onPayoff={(itemId, emprestimoId) => {
              if (emprestimoId) {
                const loan = emprestimos.find((e) => e.id === emprestimoId);
                if (loan) {
                  setSelectedLoan(loan);
                  setSelectedFixed(null);
                  setModalType('payoff');
                  setIsModalOpen(true);
                  return;
                }
              }

              const item = despesasGerais.find((d) => d.id === itemId) || despesas.find((d) => d.id === itemId);
              if (item) {
                if (item.emprestimo_id) {
                  const loan = emprestimos.find((e) => e.id === item.emprestimo_id);
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
                  return;
                }
              }

              // Fallback to first loan if available
              if (emprestimos.length > 0) {
                setSelectedLoan(emprestimos[0]);
                setSelectedFixed(null);
                setModalType('payoff');
                setIsModalOpen(true);
              }
            }}
          />
        );

      case 'config':
        return (
          <SettingsView
            user={userProfile}
            isDarkMode={isDarkMode}
            themeMode={themeMode}
            toggleDarkMode={toggleDarkMode}
            setThemeMode={setThemeMode}
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
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[10000]"
        >
          <LoadingScreen themeColor={themeColor} />
        </motion.div>
      ) : (
        <motion.div
          key="main-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="layout-wrapper"
        >
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
              if (type === 'settings') {
                setActiveView('config');
              } else if (type === 'emprestimo') {
                setModalType('emprestimo');
                setEditingItem(null);
                setIsModalOpen(true);
              } else {
                setModalType(type as any);
                setEditingItem(null);
                setIsModalOpen(true);
              }
            }}
          />

          <div className="content">
            <Topbar
              title={activeView}
              month={currentMonth}
              year={currentYear}
              onChangeMonth={changeMonth}
              onOpenPeriodModal={() => setIsMonthYearModalOpen(true)}
              onLogout={signOut}
              showBackButton={false}
              onBack={() => setActiveView('dashboard')}
              user={userProfile}
              themeColor={themeColor}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              toggleDarkMode={toggleDarkMode}
              alertas={alertas}
              isHidden={isGlobalHidden}
              onToggleVisibility={() => setIsGlobalHidden((prev) => !prev)}
              onOpenModal={(type) => { 
                if (type === 'settings') {
                  setActiveView('config');
                } else {
                  setModalType(type as any); 
                  setEditingItem(null); 
                  setIsModalOpen(true); 
                }
              }}
            />

            <div className={cn("content-body p-md-4", activeView === 'config' ? "px-2 py-3 pb-5" : "px-1 py-3")}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>

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
                  isDarkMode={isDarkMode}
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
                    (selectedLoan && Number(d.emprestimo_id) === Number(selectedLoan.id)) || 
                    (selectedFixed && Number(d.conta_fixa_id) === Number(selectedFixed.conta_fixa_id))
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
              onConfirm={async () => {
                if (!itemToDelete) return;
                const { id, type } = itemToDelete;
                if (type === 'despesa') await deleteDespesa(id);
                else if (type === 'receita') await deleteReceita(id);
                else if (type === 'cartao_transacao') await deleteCartaoTransacao(id);
                else if (type === 'titular') await deleteTitular(id);
                else if (type === 'cartao') await deleteCartao(id);
                else if (type === 'emprestimo') await deleteEmprestimo(id);
                else if (type === 'conta_fixa') await deleteContaFixa(id);
                
                setIsConfirmDeleteOpen(false);
                setItemToDelete(null);
              }}
              title="Confirmar Exclusão"
              message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
              confirmLabel="Excluir"
            />
          </div>

        <ExpenseSettingsModal
          isOpen={isExpenseSettingsOpen}
          onClose={() => setIsExpenseSettingsOpen(false)}
          themeColor={themeColor}
          themeMode={themeMode}
          isDarkMode={isDarkMode}
          emprestimos={emprestimos}
          contasFixas={contasFixas}
          despesas={despesas}
          initialTab={
            activeView === 'cartoes' 
              ? 'cartoes_rec' 
              : activeView === 'receitas' 
                ? 'rec_recorrentes' 
                : 'recorrentes'
          }
          onSaveEmprestimo={async (data) => {
            await updateEmprestimo(data);
          }}
          onSaveContaFixa={async (id, data) => {
            await updateContaFixa(id, data);
          }}
          onRenameCategory={async (oldCat, newCat) => {
            await renameCategory(oldCat, newCat);
          }}
          onUpdateDespesa={async (id, data) => {
            await updateDespesa(id, data);
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
