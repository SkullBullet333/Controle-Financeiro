'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Sidebar, Topbar } from '@/components/layout';
import { KPICards, ExtratoTable, DashboardCharts } from '@/components/dashboard';
import { FinanceTable, FilterBar, SummaryCards } from '@/components/finance-views';
import { Modal, FinanceForm, TitularForm, CartaoForm, CategoriaForm } from '@/components/modals';
import { useFinance } from '@/hooks/use-finance';
import { Vault, LogIn, Loader2, Sparkles, Lightbulb, Settings as SettingsIcon, UserCircle, CreditCard as CardIcon, Tags, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Home() {
  const [activeView, setActiveView] = useState('dashboard');
  const [loginForm, setLoginForm] = useState({ email: '', pass: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'titular' | 'cartao' | 'categoria'>('despesa');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const {
    user,
    currentMonth,
    currentYear,
    competencia,
    filteredDespesas,
    filteredReceitas,
    despesasGerais,
    config,
    stats,
    totalsByCard,
    totalsByTitular,
    isLoading,
    isDarkMode,
    activeWorkspaceId,
    workspaces,
    pendingInvites,
    toggleDarkMode,
    changeMonth,
    switchWorkspace,
    sendInvite,
    acceptInvite,
    setMonth,
    setYear,
    signIn,
    signUp,
    signOut,
    addDespesa,
    updateDespesa,
    deleteDespesa,
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

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

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

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      await sendInvite(inviteEmail);
      alert('Convite enviado com sucesso!');
      setInviteEmail('');
    } catch (error: any) {
      alert('Erro ao enviar convite: ' + error.message);
    } finally {
      setIsInviting(false);
    }
  };

  if (!user) {
    return (
      <div className="fixed inset-0 bg-bg flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-md border border-border text-center"
        >
          <div className="w-20 h-20 bg-primary text-white rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-xl shadow-primary/30">
            <Vault size={40} />
          </div>
          <h2 className="text-2xl font-black mb-2 text-text">Radar Financeiro</h2>
          <p className="text-gray text-sm mb-8">{isSignUp ? 'Crie sua conta gratuita' : 'Acesse sua conta para continuar'}</p>

          <form onSubmit={handleAuth} className="space-y-6 text-left">
            <div>
              <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-2">E-mail</label>
              <input 
                type="email" 
                className="w-full p-4 bg-bg border-2 border-border rounded-xl font-bold focus:border-primary focus:outline-none transition-all"
                placeholder="seu@email.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-2">Senha</label>
              <input 
                type="password" 
                className="w-full p-4 bg-bg border-2 border-border rounded-xl font-bold focus:border-primary focus:outline-none transition-all"
                placeholder="Sua senha"
                value={loginForm.pass}
                onChange={(e) => setLoginForm({ ...loginForm, pass: e.target.value })}
              />
            </div>

            {loginError && <p className="text-danger text-xs font-bold text-center">{loginError}</p>}

            <button 
              disabled={isLoggingIn}
              className="w-full bg-primary text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
              {isLoggingIn ? (isSignUp ? 'Criando...' : 'Entrando...') : (isSignUp ? 'Criar Conta' : 'Entrar')}
            </button>

            <p className="text-center text-xs text-gray font-bold">
              {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'} 
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary ml-1 hover:underline"
              >
                {isSignUp ? 'Entrar agora' : 'Criar uma agora'}
              </button>
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  const renderView = () => {
    const commonMotionProps = {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 },
      className: "space-y-8"
    };

    switch (activeView) {
      case 'dashboard':
        return (
          <motion.div {...commonMotionProps}>
            <KPICards stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 h-[600px]">
                <ExtratoTable 
                  despesas={despesasGerais} 
                  onEdit={(item) => {
                    if (item.isSummary) return;
                    setModalType('despesa');
                    setEditingItem(item);
                    setIsModalOpen(true);
                  }}
                />
              </div>
              <div className="lg:col-span-7 space-y-8">
                <DashboardCharts despesas={filteredDespesas} stats={stats} />
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                  <h3 className="font-bold text-lg mb-4">📝 Anotações</h3>
                  <textarea 
                    className="w-full h-32 p-4 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none transition-all resize-none text-sm"
                    placeholder="Digite suas anotações aqui..."
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'geral':
      case 'cartoes':
      case 'receitas':
        const tableData = activeView === 'geral' 
          ? despesasGerais 
          : activeView === 'cartoes' 
            ? filteredDespesas.filter(d => d.cartao) 
            : filteredReceitas;

        return (
          <motion.div {...commonMotionProps}>
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
              onDelete={(id) => activeView === 'receitas' ? deleteReceita(id) : deleteDespesa(id)}
              onToggleStatus={(id, status) => activeView !== 'receitas' && updateDespesa(id, { status: status === 'Pago' ? 'Em aberto' : 'Pago' })}
              onEdit={(item) => {
                setModalType(activeView === 'receitas' ? 'receita' : 'despesa');
                setEditingItem(item);
                setIsModalOpen(true);
              }}
            />
          </motion.div>
        );

      case 'radar':
        const healthScore = Math.round(stats.totalReceitas > 0 ? (1 - (stats.totalDespesas / stats.totalReceitas)) * 100 : 0);
        return (
          <motion.div {...commonMotionProps}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="kpi-card border-l-4 border-l-primary flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">🛡️ Saúde Financeira</span>
                <div className="text-4xl font-black text-primary mb-2">{healthScore}%</div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${healthScore}%` }} />
                </div>
              </div>
              <div className="kpi-card border-l-4 border-l-success flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">💡 Potencial de Economia</span>
                <div className="text-3xl font-black text-success">{formatCurrency(stats.totalDespesas * 0.15)}</div>
                <span className="text-[10px] text-gray mt-1">Baseado em gastos não essenciais</span>
              </div>
              <div className="kpi-card border-l-4 border-l-faturas flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black text-gray uppercase tracking-widest mb-2">📉 Limite de Gastos</span>
                <div className="text-3xl font-black text-faturas">{Math.round((stats.totalDespesas / (stats.totalReceitas * 0.8 || 1)) * 100)}%</div>
                <span className="text-[10px] text-gray mt-1">Do orçamento utilizado</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'config':
        return (
          <motion.div {...commonMotionProps}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Workspace Sharing */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Sparkles className="text-primary" /> Compartilhamento
                </h3>
                <div className="space-y-6">
                  <form onSubmit={handleSendInvite} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-2">Convidar Usuário (E-mail)</label>
                      <div className="flex gap-2">
                        <input 
                          type="email" 
                          required
                          className="flex-1 p-3 bg-bg border border-border rounded-xl font-bold focus:border-primary focus:outline-none"
                          placeholder="email@exemplo.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        <button 
                          disabled={isInviting}
                          className="bg-primary text-white px-4 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                        >
                          {isInviting ? <Loader2 className="animate-spin" size={18} /> : 'Convidar'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {pendingInvites.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-gray uppercase tracking-widest">Convites Recebidos</h4>
                      {pendingInvites.map(invite => (
                        <div key={invite.id} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-xl">
                          <span className="text-xs font-bold">{invite.owner_id.slice(0, 8)}... convidou você</span>
                          <button 
                            onClick={() => acceptInvite(invite.id, invite.owner_id)}
                            className="text-[10px] font-black bg-primary text-white px-3 py-1 rounded-lg uppercase tracking-widest"
                          >
                            Aceitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {workspaces.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-gray uppercase tracking-widest">Dashboards Compartilhados</h4>
                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          onClick={() => switchWorkspace(user.id)}
                          className={`p-3 rounded-xl text-left font-bold text-sm transition-all border ${activeWorkspaceId === user.id ? 'bg-primary text-white border-primary' : 'bg-bg border-border hover:border-primary'}`}
                        >
                          Meu Dashboard (Principal)
                        </button>
                        {workspaces.map(ws => (
                          <button 
                            key={ws.owner_id}
                            onClick={() => switchWorkspace(ws.owner_id)}
                            className={`p-3 rounded-xl text-left font-bold text-sm transition-all border ${activeWorkspaceId === ws.owner_id ? 'bg-primary text-white border-primary' : 'bg-bg border-border hover:border-primary'}`}
                          >
                            Dashboard de {ws.owner_id.slice(0, 8)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <SettingsIcon className="text-primary" /> Preferências e Sistema
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-bg rounded-xl border border-border">
                    <span className="font-bold text-sm">Modo Escuro</span>
                    <button 
                      onClick={toggleDarkMode}
                      className={`w-12 h-6 rounded-full relative transition-all ${isDarkMode ? 'bg-primary' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <p className="text-xs text-gray text-center italic">As configurações de titulares, cartões e categorias são gerenciadas automaticamente.</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <UserCircle className="text-primary" /> Titulares
                  </h3>
                  <button 
                    onClick={() => {
                      setModalType('titular');
                      setEditingItem(null);
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {config.titulares.map(t => (
                    <div 
                      key={t.nome} 
                      onDoubleClick={() => {
                        setModalType('titular');
                        setEditingItem(t);
                        setIsModalOpen(true);
                      }}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8">
                          <Image 
                            src={t.foto || `https://i.pravatar.cc/150?u=${t.nome}`} 
                            fill 
                            className="rounded-full object-cover" 
                            alt={t.nome}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className="font-bold text-sm">{t.nome}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteTitular(t.linha); }}
                        className="text-danger p-2 hover:bg-danger/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <CardIcon className="text-primary" /> Cartões de Crédito
                  </h3>
                  <button 
                    onClick={() => {
                      setModalType('cartao');
                      setEditingItem(null);
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {config.cartoes.map(c => (
                    <div 
                      key={c.nome} 
                      onDoubleClick={() => {
                        setModalType('cartao');
                        setEditingItem(c);
                        setIsModalOpen(true);
                      }}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all cursor-pointer group"
                    >
                      <div>
                        <span className="font-bold text-sm block">{c.nome}</span>
                        <span className="text-[10px] text-gray uppercase">{c.titular} • Venc. {c.diaVencimento}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteCartao(c.linha); }}
                        className="text-danger p-2 hover:bg-danger/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Tags className="text-primary" /> Categorias
                  </h3>
                  <button 
                    onClick={() => {
                      setModalType('categoria');
                      setEditingItem(null);
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {config.categorias.map(cat => (
                    <div 
                      key={cat.label} 
                      onDoubleClick={() => {
                        setModalType('categoria');
                        setEditingItem(cat);
                        setIsModalOpen(true);
                      }}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all cursor-pointer group"
                    >
                      <div>
                        <span className="font-bold text-sm block">{cat.label}</span>
                        <span className="text-[10px] text-gray truncate block max-w-[200px]">{cat.keywords}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteCategoria(cat.linha); }}
                        className="text-danger p-2 hover:bg-danger/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView} 
        user={{ 
          nome: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário',
          foto: user?.user_metadata?.avatar_url
        }} 
        onLogout={signOut}
        onHoverChange={setIsSidebarHovered}
      />
      
      <main className={cn(
        "transition-all duration-300 p-8 pt-10",
        isSidebarHovered ? "ml-64" : "ml-20"
      )}>
        <div className="max-w-7xl mx-auto">
          <Topbar 
            title={activeView} 
            month={currentMonth} 
            year={currentYear} 
            onChangeMonth={changeMonth} 
            onSetMonth={setMonth}
            onSetYear={setYear}
          />
          
          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : renderView()}
          </AnimatePresence>

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
                key={editingItem ? `edit-${editingItem.linha}` : 'new'}
                type={modalType}
                titulares={config.titulares}
                categorias={config.categorias}
                cartoes={config.cartoes}
                competencia={competencia}
                initialData={editingItem}
                onSubmit={(data) => {
                  if (editingItem) {
                    if (modalType === 'despesa') updateDespesa(editingItem.linha, data);
                    else updateReceita(editingItem.linha, data);
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
                key={editingItem ? `edit-${editingItem.linha}` : 'new'}
                initialData={editingItem}
                onSubmit={(data) => {
                  if (editingItem) updateTitular(editingItem.linha, data);
                  else addTitular(data);
                  setIsModalOpen(false);
                  setEditingItem(null);
                }}
              />
            ) : modalType === 'cartao' ? (
              <CartaoForm 
                key={editingItem ? `edit-${editingItem.linha}` : 'new'}
                initialData={editingItem}
                titulares={config.titulares}
                onSubmit={(data) => {
                  if (editingItem) updateCartao(editingItem.linha, data);
                  else addCartao(data);
                  setIsModalOpen(false);
                  setEditingItem(null);
                }}
              />
            ) : (
              <CategoriaForm 
                key={editingItem ? `edit-${editingItem.linha}` : 'new'}
                initialData={editingItem}
                onSubmit={(data) => {
                  if (editingItem) updateCategoria(editingItem.linha, data);
                  else addCategoria(data);
                  setIsModalOpen(false);
                  setEditingItem(null);
                }}
              />
            )}
          </Modal>
        </div>
      </main>
    </div>
  );
}
