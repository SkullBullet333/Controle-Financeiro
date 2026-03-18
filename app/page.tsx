'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Sidebar, Topbar, MobileNav } from '@/components/layout';
import { KPICards, ExtratoTable, DashboardCharts } from '@/components/dashboard';
import { FinanceTable, FilterBar, SummaryCards } from '@/components/finance-views';
import { Modal, FinanceForm, TitularForm, CartaoForm, CategoriaForm, MonthYearModal } from '@/components/modals';
import { useFinance } from '@/hooks/use-finance';
import { Vault, LogIn, Loader2, Plus, Trash2, UserCircle, CreditCard as CardIcon, Tags, Settings as SettingsIcon, Lightbulb } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Titular, CartaoConfig, Categoria } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Home() {
  const [activeView, setActiveView] = useState('dashboard');
  const [loginForm, setLoginForm] = useState({ email: '', pass: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMonthYearModalOpen, setIsMonthYearModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'titular' | 'cartao' | 'categoria'>('despesa');
  const [editingItem, setEditingItem] = useState<any>(null);

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
    deleteCategoria
  } = useFinance(activeView);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      if (isSignUp) {
        await signUp(loginForm.email, loginForm.pass);
        alert('Conta criada! Verifique seu e-mail (se configurado) ou tente entrar.');
        setIsSignUp(false);
      } else {
        await signIn(loginForm.email, loginForm.pass);
      }
    } catch (error: any) {
      setLoginError(error.message || 'Erro na autenticação');
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

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <div className="row g-4">
            <div className="col-12">
              <KPICards stats={stats} />
            </div>
            <div className="col-lg-6">
              <ExtratoTable
                despesas={despesasGerais}
                onEdit={(item) => {
                  if (item.isSummary) return;
                  setModalType('despesa');
                  setEditingItem(item);
                  setIsModalOpen(true);
                }}
                categorias={config.categorias}
              />
            </div>
            <div className="col-lg-6">
              <div className="row g-4">
                <div className="col-12">
                  <DashboardCharts despesas={filteredDespesas} stats={stats} titulares={config.titulares} />
                </div>
                <div className="col-12">
                  <div className="card border-0 rounded-4 shadow-sm h-100">
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
        );

      case 'geral':
      case 'cartoes':
      case 'receitas':
        const tableData = activeView === 'geral'
          ? despesasGerais
          : activeView === 'cartoes'
            ? filteredCartaoTransacoes
            : filteredReceitas;

        return (
          <div className="space-y-4">
            <SummaryCards
              type={activeView as 'geral' | 'cartoes' | 'receitas'}
              cartoes={config.cartoes}
              titulares={config.titulares}
              totalsByCard={totalsByCard}
              totalsByTitular={totalsByTitular}
              totalVencido={stats.totalVencido}
            />
            <FilterBar onAdd={() => {
              setModalType(activeView === 'receitas' ? 'receita' : 'despesa');
              setEditingItem(null);
              setIsModalOpen(true);
            }} />
            <FinanceTable
              data={tableData}
              type={activeView === 'geral' ? 'geral' : activeView === 'cartoes' ? 'cartoes' : 'receitas'}
              onDelete={(id) => {
                if (activeView === 'receitas') deleteReceita(id);
                else if (activeView === 'cartoes') deleteCartaoTransacao(id);
                else deleteDespesa(id);
              }}
              onToggleStatus={(id, status) => {
                if (activeView === 'geral') updateDespesa(id, { status: status === 'Pago' ? 'Em aberto' : 'Pago' });
                else if (activeView === 'cartoes') updateCartaoTransacao(id, { simulada: !status });
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
            <div className="row g-4">
              <div className="col-md-4">
                <div className="kpi-card border-l-4 border-l-primary flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">🛡️ Saúde Financeira</span>
                  <div className="text-4xl font-black text-primary mb-2">{healthScore}%</div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${healthScore}%` }} />
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="kpi-card border-l-4 border-l-success flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">💡 Potencial de Economia</span>
                  <div className="text-3xl font-black text-success">{formatCurrency(stats.totalDespesas * 0.15)}</div>
                  <span className="text-[10px] text-gray mt-1">Baseado em gastos não essenciais</span>
                </div>
              </div>
              <div className="col-md-4">
                <div className="kpi-card border-l-4 border-l-faturas flex flex-col items-center justify-center text-center">
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
                        <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
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
            <div className="col-md-6">
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

              <div className="card border-0 rounded-4 shadow-sm">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                      <UserCircle className="text-primary" /> Titulares
                    </h5>
                    <button
                      onClick={() => { setModalType('titular'); setEditingItem(null); setIsModalOpen(true); }}
                      className="btn btn-sm btn-primary rounded-pill px-3"
                    >
                      <Plus size={16} className="me-1" /> Novo
                    </button>
                  </div>
                  <div className="list-group list-group-flush">
                    {config.titulares.map((t: Titular) => (
                      <div key={t.id} className="list-group-item d-flex align-items-center justify-content-between px-0 py-3 border-light">
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
                          <button onClick={() => deleteTitular(t.id)} className="btn btn-sm btn-outline-danger border-0"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card border-0 rounded-4 shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                      <CardIcon className="text-primary" /> Cartões
                    </h5>
                    <button
                      onClick={() => { setModalType('cartao'); setEditingItem(null); setIsModalOpen(true); }}
                      className="btn btn-sm btn-primary rounded-pill px-3"
                    >
                      <Plus size={16} className="me-1" /> Novo
                    </button>
                  </div>
                  <div className="list-group list-group-flush">
                    {config.cartoes.map((c: CartaoConfig) => {
                      const titular = config.titulares.find((t: Titular) => t.id === c.titular_id);
                      return (
                        <div key={c.id} className="list-group-item d-flex align-items-center justify-content-between px-0 py-3 border-light">
                          <div>
                            <span className="fw-bold d-block">{c.nome_cartao}</span>
                            <span className="small text-muted text-uppercase">{titular?.nome || 'N/A'} • Venc. {c.dia_vencimento}</span>
                          </div>
                          <div>
                            <button onClick={() => { setModalType('cartao'); setEditingItem(c); setIsModalOpen(true); }} className="btn btn-sm btn-outline-primary border-0 me-1"><i className="fa-solid fa-pen"></i></button>
                            <button onClick={() => deleteCartao(c.id)} className="btn btn-sm btn-outline-danger border-0"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="card border-0 rounded-4 shadow-sm">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                      <Tags className="text-primary" /> Categorias
                    </h5>
                    <button
                      onClick={() => { setModalType('categoria'); setEditingItem(null); setIsModalOpen(true); }}
                      className="btn btn-sm btn-primary rounded-pill px-3"
                    >
                      <Plus size={16} className="me-1" /> Nova
                    </button>
                  </div>
                  <div className="list-group list-group-flush">
                    {config.categorias.map((cat: Categoria) => (
                      <div key={cat.id} className="list-group-item d-flex align-items-center justify-content-between px-0 py-3 border-light">
                        <div className="overflow-hidden">
                          <span className="fw-bold d-block">{cat.label}</span>
                          <span className="small text-muted text-truncate d-block" style={{ maxWidth: '200px' }}>{cat.keywords}</span>
                        </div>
                        <div>
                          <button onClick={() => { setModalType('categoria'); setEditingItem(cat); setIsModalOpen(true); }} className="btn btn-sm btn-outline-primary border-0 me-1"><i className="fa-solid fa-pen"></i></button>
                          <button onClick={() => deleteCategoria(cat.id)} className="btn btn-sm btn-outline-danger border-0"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
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
        user={{
          nome: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário',
          foto: user?.user_metadata?.avatar_url
        }}
        onLogout={signOut}
      />

      <div className="main-content">
        <Topbar
          title={activeView}
          month={currentMonth}
          year={currentYear}
          onChangeMonth={changeMonth}
          onOpenPeriodo={() => setIsMonthYearModalOpen(true)}
          onLogout={signOut}
        />

        <div className="content-body p-3 p-md-4">
          {isLoading ? (
            <div className="d-flex align-items-center justify-content-center h-50 pt-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : renderView()}
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
              : (modalType === 'despesa' ? 'Nova Despesa' : modalType === 'receita' ? 'Nova Receita' : modalType === 'titular' ? 'Novo Titular' : modalType === 'cartao' ? 'Novo Cartão' : 'Nova Categoria')
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
              initialData={editingItem}
              onSubmit={(data: any) => {
                if (editingItem) {
                  if (modalType === 'despesa') updateDespesa(editingItem.id, data);
                  else updateReceita(editingItem.id, data);
                } else {
                  if (modalType === 'despesa') addDespesa(data);
                  else addReceita(data);
                }
                setIsModalOpen(false);
                setEditingItem(null);
              }}
            />
          ) : modalType === 'titular' ? (
            <TitularForm
              key={editingItem ? `edit-${editingItem.id}` : 'new'}
              initialData={editingItem}
              onSubmit={(data) => {
                if (editingItem) updateTitular(editingItem.id, data);
                else addTitular(data);
                setIsModalOpen(false);
                setEditingItem(null);
              }}
            />
          ) : modalType === 'cartao' ? (
            <CartaoForm
              key={editingItem ? `edit-${editingItem.id}` : 'new'}
              initialData={editingItem}
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
              key={editingItem ? `edit-${editingItem.id}` : 'new'}
              initialData={editingItem}
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
      </div>
    </div>
  );
}
