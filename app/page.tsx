'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Sidebar, Topbar, MobileNav } from '@/components/layout';
import { KPICards, ExtratoTable, DashboardCharts } from '@/components/dashboard';
import { FinanceTable, FilterBar, SummaryCards } from '@/components/finance-views';
import { AnalysisPlan } from '@/components/analysis-view';
import { Modal, ConfirmModal, FinanceForm, TitularForm, CartaoForm, MonthYearModal, ProfileForm, SettingsModal } from '@/components/modals';
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
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'titular' | 'cartao' | 'categoria' | 'profile' | 'settings'>('despesa');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Despesa | Receita | Titular | CartaoConfig | CartaoTransacao | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number, type: 'despesa' | 'receita' | 'cartao_transacao' | 'titular' | 'cartao' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const {
    user,
    currentMonth,
    currentYear,
    competencia,
    filteredDespesas,
    filteredReceitas,
    filteredCartaoTransacoes,
    despesasGerais,
    config,
    stats,
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
    updateProfile
  } = useFinance(activeView);

  const userProfile: Profile | null = user ? {
    id: user.id,
    email: user.email || '',
    nome: userName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
    foto: user.user_metadata?.avatar_url,
    tipo: userType,
    family_id: familyId || ''
  } : null;

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

  if (!user) {
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
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilterId={activeFilterId}
              onClearFilter={() => setActiveFilterId(null)}
              onAdd={() => {
                setModalType(activeView === 'receitas' ? 'receita' : 'despesa');
                setEditingItem(null);
                setIsModalOpen(true);
              }} 
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
            />
          </div>
        );

      case 'radar':
        const healthScore = Math.round(stats.totalReceitas > 0 ? (1 - (stats.totalDespesas / stats.totalReceitas)) * 100 : 0);
        return (
          <div className="space-y-4">
            <AnalysisPlan projecao={projecaoSemestral} />
            
            <div className="row g-4">
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
                  <div className="text-3xl font-black text-success">{formatCurrency(stats.totalDespesas * 0.15)}</div>
                  <span className="text-[10px] text-gray mt-1">Baseado em gastos não essenciais</span>
                </div>
              </div>
              <div className="col-md-4">
                <div className="kpi-card kpi-card-purple flex flex-col items-center justify-center text-center h-100">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">📉 Limite de Gastos</span>
                  <div className="text-3xl font-black text-faturas">{Math.round((stats.totalDespesas / (stats.totalReceitas * 0.8 || 1)) * 100)}%</div>
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
                            { name: 'Essencial', value: stats.totalDespesas * 0.6 },
                            { name: 'Lifestyle', value: stats.totalDespesas * 0.4 }
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
              : (modalType === 'profile' ? 'Editar Meu Perfil' : modalType === 'despesa' ? (activeView === 'cartoes' ? '' : 'Nova Despesa') : modalType === 'receita' ? 'Nova Receita' : modalType === 'titular' ? 'Novo Titular' : 'Novo Cartão')
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
        />
      </div>
    </div>
  );
}
