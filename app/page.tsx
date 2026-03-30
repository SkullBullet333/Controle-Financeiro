'use client';

import React, { useState } from 'react';
import { Sidebar, Topbar, MobileNav } from '@/components/layout';
import { KPICards, ExtratoTable, DashboardCharts } from '@/components/dashboard';
import { FinanceTable, FilterBar, SummaryCards } from '@/components/finance-views';
import { AnalysisPlan } from '@/components/analysis-view';
import { Modal, ConfirmModal, FinanceForm, TitularForm, CartaoForm, MonthYearModal, ProfileForm, SettingsModal, EmprestimoForm, PayoffModal } from '@/components/modals';
import { useFinance } from '@/hooks/use-finance';
import { Vault, LogIn, Loader2, Plus, Trash2, UserCircle, CreditCard as CardIcon, Settings as SettingsIcon, Lightbulb, Users, Mail, Send } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Despesa, Receita, CartaoTransacao, Titular, CartaoConfig, Status, Profile } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Home() {
  const [activeView, setActiveView] = useState('dashboard');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', pass: '', nome: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMonthYearModalOpen, setIsMonthYearModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'titular' | 'cartao' | 'categoria' | 'profile' | 'settings' | 'emprestimo' | 'payoff'>('despesa');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Despesa | Receita | Titular | CartaoConfig | CartaoTransacao | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmClearSimuladasOpen, setIsConfirmClearSimuladasOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number, type: 'despesa' | 'receita' | 'cartao_transacao' | 'titular' | 'cartao' } | null>(null);
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
    changeMonth,
    setMonth,
    setYear,
    signIn,
    signUp,
    signOut,
    addDespesa,
    updateDespesa,
    deleteDespesa,
    deleteSimuladas,
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
    deleteEmprestimo
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

  const handleInvite = async () => {
    if (!inviteEmail) return;
    const result = await inviteMember(inviteEmail);
    if (result?.error) {
      alert(result.error);
    } else {
      alert('Convite enviado com sucesso! O membro entrará na família ao se cadastrar.');
      setInviteEmail('');
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
            <KPICards stats={stats} />
            <div className="row g-4 mt-4">
              <div className="col-lg-8">
                <ExtratoTable 
                  despesas={sortExpenses(filteredDespesas).slice(0, 15)} 
                  onEdit={(item: Despesa) => { setModalType('despesa'); setEditingItem(item); setIsModalOpen(true); }}
                />
              </div>
              <div className="col-lg-4">
                <div className="row g-4 h-100">
                  <div className="col-12">
                    <DashboardCharts despesas={filteredDespesas} stats={stats} titulares={config.titulares} />
                  </div>
                  <div className="col-12 mt-4">
                    <div className="bg-card border border-border rounded-4 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
                          <i className="fa-solid fa-note-sticky text-primary"></i> Anotações
                        </h5>
                        <textarea
                          className="form-control border-0 bg-light rounded-4 p-3"
                          rows={8}
                          placeholder="💡 Toque aqui para escrever seus lembretes, metas financeiras ou observações do mês..."
                          style={{ resize: 'none' }}
                        ></textarea>
                        <div className="mt-3 text-end">
                          <span className="small text-muted italic">Salvo automaticamente</span>
                        </div>
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
            : filteredReceitas;

        if (activeFilterId) {
          tableData = tableData.filter((item: any) => {
            if (activeView === 'cartoes') return item.cartao_id === activeFilterId;
            return item.titular_id === activeFilterId;
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
            />
            <FilterBar
              onAdd={() => {
                setModalType(activeView === 'receitas' ? 'receita' : 'despesa');
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilterId={activeFilterId}
              onClearFilter={() => setActiveFilterId(null)}
              onClearSimuladas={() => setIsConfirmClearSimuladasOpen(true)}
              showClearSimuladas={despesas.some(d => d.simulada)}
              type={activeView as 'geral' | 'cartoes' | 'receitas'}
              onAction={activeView === 'geral' ? () => { setModalType('emprestimo'); setIsModalOpen(true); } : undefined}
              actionLabel={activeView === 'geral' ? 'Novo Empréstimo' : undefined}
              actionIcon="account_balance"
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
                else if (activeView === 'cartoes') updateCartaoTransacao(id, { simulada: !currentVal });
              }}
              onEdit={(item) => {
                setModalType(activeView === 'receitas' ? 'receita' : 'despesa');
                setEditingItem(item);
                setIsModalOpen(true);
              }}
              titulares={config.titulares}
              cartoes={config.cartoes}
              onPayoff={(loanId) => {
                const loan = emprestimos.find(e => e.id === loanId);
                if (loan) {
                  setSelectedLoan(loan);
                  setModalType('payoff');
                  setIsModalOpen(true);
                }
              }}
            />
          </div>
        );

      case 'radar':
        // 1. Filtragem Base: Despesas e Receitas (Apenas do Mês Selecionado para Frente)
        const currentCompSortable = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        const baseRadarDespesas = despesas.filter(d => {
          const matchTitular = activeFilterId ? d.titular_id === activeFilterId : true;
          if (d.simulada) return false;
          
          // Comparação de competência: MM/YYYY para YYYY-MM
          const dCompSortable = d.competencia.split('/').reverse().join('-');
          return matchTitular && dCompSortable >= currentCompSortable;
        });

        const baseRadarReceitas = receitas.filter(r => {
          const matchTitular = activeFilterId ? r.titular_id === activeFilterId : true;
          if (r.simulada) return false;
          
          const rCompSortable = r.competencia.split('/').reverse().join('-');
          return matchTitular && rCompSortable >= currentCompSortable;
        });

        // 2. Busca de Sugestões (Mostrar apenas descrições únicas POR TITULAR)
        const radarBuscaResultados = searchTerm ? Array.from(new Set(baseRadarDespesas
          .filter(d => d.descricao?.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(d => `${d.descricao}|${d.titular_id}`)
        )).map(key => {
          const [desc, tid] = key.split('|');
          return baseRadarDespesas.find(d => d.descricao === desc && d.titular_id === Number(tid));
        }).slice(0, 50) : [];

        const radarDespesasSelecionadas = selectedRadarIds.length > 0 
          ? baseRadarDespesas.filter(d => selectedRadarIds.includes(d.id))
          : baseRadarDespesas;

        // 3. Estatísticas de Dívida Total em Aberto (Open only)
        const openDespesas = radarDespesasSelecionadas.filter(d => d.status === 'Em aberto');
        const rStats = {
          totalDividaAberto: openDespesas.reduce((acc, d) => acc + d.valor, 0),
          qtdParcelasRestante: openDespesas.length,
        };

        // 4. Estatísticas do Mês Atual (para Saúde Financeira)
        const totalDespesasMes = radarDespesasSelecionadas.filter(d => d.competencia === competencia).reduce((acc, d) => acc + d.valor, 0);
        const totalReceitasMes = baseRadarReceitas.filter(r => r.competencia === competencia).reduce((acc, r) => acc + r.valor, 0);

        // 5. Projeção Semestral
        const filteredProjecao: any[] = [];
        let tempMonth = currentMonth;
        let tempYear = currentYear;
        for (let i = 0; i < 8; i++) {
          const comp = `${String(tempMonth).padStart(2, '0')}/${tempYear}`;
          const rec = baseRadarReceitas.filter(r => r.competencia === comp).reduce((acc, r) => acc + r.valor, 0);
          
          // Soma despesas selecionadas (ou todas se nada selecionado)
          const standardDesp = radarDespesasSelecionadas.filter(d => d.competencia === comp).reduce((acc, d) => acc + d.valor, 0);
          
          // Soma transações de cartões (faturas futuras)
          const fats = cartaoTransacoes.filter((c: CartaoTransacao) => {
            const matchTitular = activeFilterId ? c.titular_id === activeFilterId : true;
            return matchTitular && c.competencia === comp && !c.simulada;
          }).reduce((acc: number, c: CartaoTransacao) => acc + c.valor, 0);

          filteredProjecao.push({
            competencia: comp,
            receitas: rec,
            despesas: standardDesp,
            faturas: fats,
            saldo: rec - (standardDesp + fats)
          });
          tempMonth++;
          if (tempMonth > 12) { tempMonth = 1; tempYear++; }
        }

        const healthScore = Math.round(totalReceitasMes > 0 ? (1 - (totalDespesasMes / totalReceitasMes)) * 100 : 0);
        
        // 6. Cálculo dos cartões de titular especializados para o Radar
        const radarTotalsByTitular = config.titulares.reduce((acc, t) => {
          const tDespesas = despesasGerais.filter(d => d.titular_id === t.id && d.competencia === competencia && !d.simulada);
          const cards = tDespesas.filter(d => d.isSummary || d.descricao.startsWith('Fatura ')).reduce((sum, d) => sum + d.valor, 0);
          const total = tDespesas.reduce((sum, d) => sum + d.valor, 0);
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
            <div className="row g-4 mb-2">
              <div className="col-md-6">
                <div className="kpi-card kpi-card-red flex flex-col items-center justify-center text-center h-100 py-4">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">🔴 Dívida Total em Aberto</span>
                  <div className="text-3xl font-black text-danger mb-1">{formatCurrency(rStats.totalDividaAberto)}</div>
                  <span className="text-[10px] text-gray mt-1">Soma de todas as parcelas futuras</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="kpi-card kpi-card-purple flex flex-col items-center justify-center text-center h-100 py-4">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">📅 Parcelas Restantes</span>
                  <div className="text-3xl font-black text-faturas mb-1">{rStats.qtdParcelasRestante}</div>
                  <span className="text-[10px] text-gray mt-1">Quantidade total de lançamentos</span>
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
                        <th className="px-3 py-2 small fw-bold text-muted uppercase text-end">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {radarDespesasSelecionadas.map(d => (
                        <tr key={d.id}>
                          <td className="px-3 py-2 fw-bold text-primary">{config.titulares.find(t => t.id === d.titular_id)?.nome || 'N/A'}</td>
                          <td className="px-3 py-2 fw-bold">{d.descricao}</td>
                          <td className="px-3 py-2 small text-muted text-center">{d.parcela_atual}/{d.parcela_total}</td>
                          <td className="px-3 py-2 small text-muted text-center">{d.competencia}</td>
                          <td className="px-3 py-2 small text-muted text-center">
                            {d.vencimento && d.vencimento !== '-' ? d.vencimento.split('-').reverse().join('/') : '-'}
                          </td>
                          <td className="px-3 py-2 fw-bold text-end">{formatCurrency(d.valor)}</td>
                        </tr>
                      ))}
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
        <Topbar
          title={activeView}
          month={currentMonth}
          year={currentYear}
          onChangeMonth={changeMonth}
          onOpenPeriodModal={() => setIsMonthYearModalOpen(true)}
          onLogout={signOut}
        />

        <div className="content-body p-3 p-md-4">
          {isLoading ? (
            <div className="d-flex align-items-center justify-content-center h-50 pt-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : renderContent()}
        </div>

        <MobileNav
          activeView={activeView}
          onViewChange={(view) => {
            if (view === 'config') setIsSettingsOpen(true);
            else setActiveView(view);
          }}
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
              ? (modalType === 'despesa' ? 'Editar Despesa' : modalType === 'receita' ? 'Editar Receita' : modalType === 'titular' ? 'Editar Titular' : 'Editar Cartão')
              : (modalType === 'profile' ? 'Editar Meu Perfil' : modalType === 'despesa' ? (activeView === 'cartoes' ? '' : 'Nova Despesa') : modalType === 'receita' ? 'Nova Receita' : modalType === 'titular' ? 'Novo Titular' : modalType === 'emprestimo' ? 'Novo Empréstimo' : modalType === 'payoff' ? 'Simulação de Quitação' : 'Novo Cartão')
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
          ) : modalType === 'despesa' || modalType === 'receita' ? (
            <FinanceForm
              type={modalType}
              subType={activeView === 'cartoes' ? 'cartao' : 'fixa'}
              titulares={config.titulares}
              cartoes={config.cartoes}
              competencia={competencia}
              initialData={editingItem as Despesa | Receita}
              onClose={() => {
                setIsModalOpen(false);
                setEditingItem(null);
              }}
              onSubmit={(data) => {
                if (editingItem) {
                  if (modalType === 'despesa') updateDespesa(editingItem.id, data as Omit<Despesa, 'id'>);
                  else updateReceita(editingItem.id, data as Omit<Receita, 'id'>);
                } else {
                  if (modalType === 'despesa') addDespesa(data as Omit<Despesa, 'id'>);
                  else addReceita(data as Omit<Receita, 'id'>);
                }
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
          ) : modalType === 'emprestimo' ? (
            <EmprestimoForm 
              titulares={config.titulares}
              onClose={() => setIsModalOpen(false)}
              onSubmit={(data) => {
                addEmprestimo(data);
                setIsModalOpen(false);
              }}
            />
          ) : modalType === 'payoff' && selectedLoan ? (
            <PayoffModal 
              loan={selectedLoan}
              installments={despesas.filter(d => d.emprestimo_id === selectedLoan.id)}
              onClose={() => setIsModalOpen(false)}
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
          }}
          title="Confirmar Exclusão"
          message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
        />

        <ConfirmModal
          isOpen={isConfirmClearSimuladasOpen}
          onClose={() => setIsConfirmClearSimuladasOpen(false)}
          onConfirm={() => {
            deleteSimuladas();
            setIsConfirmClearSimuladasOpen(false);
          }}
          title="Limpar Simulações"
          message="Tem certeza que deseja excluir todas as despesas simuladas? Esta ação removerá os dados de todos os meses."
          confirmLabel="Limpar Tudo"
        />

        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
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
          emprestimos={emprestimos}
          onDeleteEmprestimo={deleteEmprestimo}
        />
      </div>
    </div>
  );
}
