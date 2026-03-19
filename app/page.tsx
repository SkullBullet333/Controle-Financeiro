'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Sidebar, Topbar, MobileNav } from '@/components/layout';
import { KPICards, ExtratoTable, DashboardCharts } from '@/components/dashboard';
import { FinanceTable, FilterBar, SummaryCards } from '@/components/finance-views';
import { AnalysisPlan } from '@/components/analysis-view';
import { Modal, ConfirmModal, FinanceForm, TitularForm, CartaoForm, CategoriaForm, MonthYearModal } from '@/components/modals';
import { useFinance } from '@/hooks/use-finance';
import { Vault, LogIn, Loader2, Plus, Trash2, UserCircle, CreditCard as CardIcon, Tags, Settings as SettingsIcon, Lightbulb, Users } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Despesa, Receita, CartaoTransacao, Titular, CartaoConfig, Categoria, Status } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Home() {
  const [activeView, setActiveView] = useState('dashboard');
  const [inviteCode, setInviteCode] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', pass: '', nome: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMonthYearModalOpen, setIsMonthYearModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'titular' | 'cartao' | 'categoria'>('despesa');
  const [editingItem, setEditingItem] = useState<Despesa | Receita | Titular | CartaoConfig | Categoria | CartaoTransacao | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number, type: 'despesa' | 'receita' | 'cartao_transacao' | 'titular' | 'cartao' | 'categoria' } | null>(null);
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
    addCategoria,
    updateCategoria,
    deleteCategoria,
    familyId,
    joinFamily,
    userName
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
        alert('Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro (se necessário) ou tente entrar agora.');
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
                  categorias={config.categorias}
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
              categorias={config.categorias}
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

      case 'config':
        return (
          <div className="row g-4">
            <div className="col-lg-6">
              <div className="card border-0 rounded-4 shadow-sm mb-4">
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
                    <SettingsIcon className="text-primary" /> Preferências
                  </h5>
                  <div className="flex items-center justify-between p-3 bg-light rounded-3">
                    <span className="fw-bold">Modo Escuro</span>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={isDarkMode}
                        onChange={toggleDarkMode}
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Família Section */}
              <div className="card border-0 rounded-4 shadow-sm overflow-hidden mb-4">
                <div className="card-body p-4 bg-light bg-opacity-20">
                  <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                    <Users className="text-primary" /> Minha Família
                  </h5>
                  <p className="small text-muted mt-2 mb-3">
                    Compartilhe este código com outras pessoas para que elas possam ver e gerenciar este dashboard.
                  </p>
                  
                  <div className="input-group mb-3 shadow-sm border rounded-3 overflow-hidden">
                    <input 
                      type="text" 
                      className="form-control border-0 bg-white" 
                      value={familyId || 'Carregando...'} 
                      readOnly 
                    />
                    <button 
                      className="btn btn-outline-primary border-0 bg-white" 
                      onClick={() => {
                        navigator.clipboard.writeText(familyId || '');
                        alert('Código copiado!');
                      }}
                    >
                      Copiar
                    </button>
                  </div>

                  <hr className="my-3 opacity-10" />

                  <h6 className="fw-bold small text-muted text-uppercase mb-2">Entrar em outra Família</h6>
                  <div className="d-flex gap-2">
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Cole o código da família aqui..."
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                    />
                    <button 
                      className="btn btn-primary"
                      onClick={async () => {
                        if (!inviteCode) return;
                        if (confirm('Ao entrar em outra família, você deixará de ver seus dados atuais. Continuar?')) {
                          const res = await joinFamily(inviteCode);
                          if (res.success) {
                            alert('Vinculado com sucesso!');
                            setInviteCode('');
                          } else {
                            alert('Erro: ' + res.error);
                          }
                        }
                      }}
                    >
                      Entrar
                    </button>
                  </div>
                </div>
              </div>

              {/* Titulares Accordion */}
              <div className="card border-0 rounded-4 shadow-sm mb-4 overflow-hidden">
                <div 
                  className="card-body p-4 cursor-pointer d-flex align-items-center justify-content-between hover:bg-light transition-colors"
                  onClick={() => toggleSection('titulares')}
                >
                  <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                    <UserCircle className="text-primary" /> Titulares
                  </h5>
                  <div className="d-flex align-items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setModalType('titular'); setEditingItem(null); setIsModalOpen(true); }}
                      className="btn btn-sm btn-primary rounded-circle p-0 d-flex align-items-center justify-content-center shadow-sm"
                      style={{ width: '28px', height: '28px' }}
                      title="Adicionar Titular"
                    >
                      <Plus size={18} />
                    </button>
                    <i className={cn("fa-solid transition-transform duration-300", expandedSections.includes('titulares') ? "fa-chevron-up" : "fa-chevron-down")}></i>
                  </div>
                </div>
                {expandedSections.includes('titulares') && (
                  <div className="card-body p-4 pt-0 border-top border-light">
                    <div className="list-group list-group-flush">
                      {config.titulares.map((t: Titular) => (
                        <div key={t.id} className="list-group-item d-flex align-items-center justify-content-between px-0 py-3 border-light bg-transparent">
                          <div className="d-flex align-items-center gap-3">
                            <div className="position-relative" style={{ width: '32px', height: '32px' }}>
                              <Image
                                src={t.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nome)}&background=random&color=fff&bold=true`}
                                fill
                                unoptimized
                                className="rounded-circle object-fit-cover"
                                alt={t.nome}
                              />
                            </div>
                            <span className="fw-bold">{t.nome}</span>
                          </div>
                          <div>
                            <button onClick={() => { setModalType('titular'); setEditingItem(t); setIsModalOpen(true); }} className="btn btn-sm btn-outline-primary border-0 me-1"><i className="fa-solid fa-pen"></i></button>
                            <button onClick={() => { setItemToDelete({ id: t.id, type: 'titular' }); setIsConfirmDeleteOpen(true); }} className="btn btn-sm btn-outline-danger border-0"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="col-lg-6">
              {/* Cartões Accordion */}
              <div className="card border-0 rounded-4 shadow-sm mb-4 overflow-hidden">
                <div 
                  className="card-body p-4 cursor-pointer d-flex align-items-center justify-content-between hover:bg-light transition-colors"
                  onClick={() => toggleSection('cartoes')}
                >
                  <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                    <CardIcon className="text-primary" /> Cartões
                  </h5>
                  <div className="d-flex align-items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setModalType('cartao'); setEditingItem(null); setIsModalOpen(true); }}
                      className="btn btn-sm btn-primary rounded-circle p-0 d-flex align-items-center justify-content-center shadow-sm"
                      style={{ width: '28px', height: '28px' }}
                      title="Adicionar Cartão"
                    >
                      <Plus size={18} />
                    </button>
                    <i className={cn("fa-solid transition-transform duration-300", expandedSections.includes('cartoes') ? "fa-chevron-up" : "fa-chevron-down")}></i>
                  </div>
                </div>
                {expandedSections.includes('cartoes') && (
                  <div className="card-body p-4 pt-0 border-top border-light">
                    <div className="list-group list-group-flush">
                      {config.cartoes.map((c: CartaoConfig) => {
                        const titular = config.titulares.find((t: Titular) => t.id === c.titular_id);
                        return (
                          <div key={c.id} className="list-group-item d-flex align-items-center justify-content-between px-0 py-3 border-light bg-transparent">
                            <div>
                              <span className="fw-bold d-block">{c.nome_cartao}</span>
                              <span className="small text-muted text-uppercase">{titular?.nome || 'N/A'} • Venc. {c.dia_vencimento}</span>
                            </div>
                            <div>
                              <button onClick={() => { setModalType('cartao'); setEditingItem(c); setIsModalOpen(true); }} className="btn btn-sm btn-outline-primary border-0 me-1"><i className="fa-solid fa-pen"></i></button>
                              <button onClick={() => { setItemToDelete({ id: c.id, type: 'cartao' }); setIsConfirmDeleteOpen(true); }} className="btn btn-sm btn-outline-danger border-0"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Categorias Accordion */}
              <div className="card border-0 rounded-4 shadow-sm overflow-hidden">
                <div 
                  className="card-body p-4 cursor-pointer d-flex align-items-center justify-content-between hover:bg-light transition-colors"
                  onClick={() => toggleSection('categorias')}
                >
                  <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                    <Tags className="text-primary" /> Categorias
                  </h5>
                  <div className="d-flex align-items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setModalType('categoria'); setEditingItem(null); setIsModalOpen(true); }}
                      className="btn btn-sm btn-primary rounded-circle p-0 d-flex align-items-center justify-content-center shadow-sm"
                      style={{ width: '28px', height: '28px' }}
                      title="Adicionar Categoria"
                    >
                      <Plus size={18} />
                    </button>
                    <i className={cn("fa-solid transition-transform duration-300", expandedSections.includes('categorias') ? "fa-chevron-up" : "fa-chevron-down")}></i>
                  </div>
                </div>
                {expandedSections.includes('categorias') && (
                  <div className="card-body p-4 pt-0 border-top border-light">
                    <div className="list-group list-group-flush">
                      {config.categorias.map((cat: Categoria) => (
                        <div key={cat.id} className="list-group-item d-flex align-items-center justify-content-between px-0 py-3 border-light bg-transparent">
                          <div className="overflow-hidden">
                            <span className="fw-bold d-block">{cat.label}</span>
                            <span className="small text-muted text-truncate d-block" style={{ maxWidth: '200px' }}>{cat.keywords}</span>
                          </div>
                          <div>
                            <button onClick={() => { setModalType('categoria'); setEditingItem(cat); setIsModalOpen(true); }} className="btn btn-sm btn-outline-primary border-0 me-1"><i className="fa-solid fa-pen"></i></button>
                            <button onClick={() => { setItemToDelete({ id: cat.id, type: 'categoria' }); setIsConfirmDeleteOpen(true); }} className="btn btn-sm btn-outline-danger border-0"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
        user={{
          nome: userName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário',
          foto: user?.user_metadata?.avatar_url
        }}
        onLogout={signOut}
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
          onViewChange={setActiveView}
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
              ? (modalType === 'despesa' ? 'Editar Despesa' : modalType === 'receita' ? 'Editar Receita' : modalType === 'titular' ? 'Editar Titular' : modalType === 'cartao' ? 'Editar Cartão' : 'Editar Categoria')
              : (modalType === 'despesa' ? (activeView === 'cartoes' ? '' : 'Nova Despesa') : modalType === 'receita' ? 'Nova Receita' : modalType === 'titular' ? 'Novo Titular' : modalType === 'cartao' ? 'Novo Cartão' : 'Nova Categoria')
          }
        >
          {modalType === 'despesa' || modalType === 'receita' ? (
            <FinanceForm
              type={modalType}
              subType={activeView === 'cartoes' ? 'cartao' : 'fixa'}
              titulares={config.titulares}
              categorias={config.categorias}
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
          ) : (
            <CategoriaForm
              key={editingItem ? `edit-${(editingItem as any).id}` : 'new'}
              initialData={editingItem as Categoria}
              onSubmit={(data) => {
                if (editingItem) updateCategoria(editingItem.id, data);
                else addCategoria(data);
                setIsModalOpen(false);
                setEditingItem(null);
              }}
            />
          )}
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
            else if (type === 'categoria') deleteCategoria(id);
          }}
          title="Confirmar Exclusão"
          message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
        />
      </div>
    </div>
  );
}
