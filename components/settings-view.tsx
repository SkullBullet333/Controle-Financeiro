'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Profile, Titular, CartaoConfig } from '@/lib/types';
import { TitularForm, CartaoForm } from './modals';

interface SettingsViewProps {
  user: Profile | null;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  themeColor?: string;
  setThemeColor?: (color: string) => void;
  familyMembers: Profile[];
  onInvite: (email: string) => void;
  userType: 'titular' | 'membro';
  titulares: Titular[];
  cartoes: CartaoConfig[];
  onAddTitular: (t: Omit<Titular, 'id'>) => void;
  onUpdateTitular: (id: number, t: Partial<Titular>) => void;
  onDeleteTitular: (id: number) => void;
  onAddCartao: (c: Omit<CartaoConfig, 'id'>) => void;
  onUpdateCartao: (id: number, c: Partial<CartaoConfig>) => void;
  onDeleteCartao: (id: number) => void;
  isMobile?: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onCloseSettings?: () => void;
  lembretes?: {id: number, texto: string, concluido: boolean, data?: string}[];
  onAddLembrete?: (texto: string, data?: string) => void;
  onToggleLembrete?: (id: number) => void;
  onDeleteLembrete?: (id: number) => void;
  avisosConfig?: { vencidas: boolean, hoje: boolean, radar: boolean };
  onUpdateAvisosConfig?: (key: 'vencidas' | 'hoje' | 'radar', value: boolean) => void;
}

import { CardLogo } from './card-ui';

export function SettingsView({
  user,
  isDarkMode,
  toggleDarkMode,
  themeColor = '#4361ee',
  setThemeColor,
  familyMembers,
  onInvite,
  userType,
  titulares,
  cartoes,
  onAddTitular,
  onUpdateTitular,
  onDeleteTitular,
  onAddCartao,
  onUpdateCartao,
  onDeleteCartao,
  isMobile = false,
  activeTab: controlledTab,
  onTabChange: onControlledTabChange,
  onCloseSettings,
  lembretes = [],
  onAddLembrete,
  onToggleLembrete,
  onDeleteLembrete,
  avisosConfig = { vencidas: true, hoje: true, radar: false },
  onUpdateAvisosConfig
}: SettingsViewProps) {
  const [internalTab, setInternalTab] = useState('geral');
  const activeTab = controlledTab || internalTab;
  const setActiveTab = onControlledTabChange || setInternalTab;
  const [inviteEmail, setInviteEmail] = useState('');
  const [internalView, setInternalView] = useState<'list' | 'add' | 'edit'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');
  const [showAddReminder, setShowAddReminder] = useState(false);

  useEffect(() => {
    setInternalView('list');
    setEditingItem(null);
  }, [activeTab]);

  const handleAddReminder = () => {
    if (newReminderText.trim()) {
      onAddLembrete?.(newReminderText, newReminderDate);
      setNewReminderText('');
      setNewReminderDate('');
      setShowAddReminder(false);
    }
  };

  const tabs = [
    { id: 'geral', label: 'Geral', icon: 'settings', desc: 'Dados e segurança da conta' },
    { id: 'titulares', label: 'Titulares', icon: 'person_add', desc: 'Gerencie as pessoas da família' },
    { id: 'cartoes', label: 'Cartões', icon: 'credit_card', desc: 'Configure seus cartões de crédito' },
    { id: 'familia', label: 'Dados', icon: 'database', desc: 'Exportação e backup de dados' },
    { id: 'notificacoes', label: 'Avisos', icon: 'notifications', desc: 'Central de notificações e alertas' },
    { id: 'personalizacao', label: 'Visual', icon: 'palette', desc: 'Cores e temas do aplicativo' },
  ];
  
  const renderHub = () => {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-5 duration-500 overflow-y-auto overflow-x-hidden custom-scrollbar h-full d-flex flex-column">
        <header className="mb-4 pt-4 px-1 flex-shrink-0">
          <div className="d-flex align-items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 d-flex align-items-center justify-content-center text-primary shadow-sm border border-primary/10">
              <span className="material-symbols-outlined text-3xl">handyman</span>
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight m-0 uppercase">Ajustes</h1>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar pb-4 px-1">
          <div className="space-y-2">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="sicoob-settings-item bg-card border border-border/40 rounded-2xl p-3 d-flex align-items-center gap-3 transition-all active:bg-muted/50 cursor-pointer shadow-sm"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 d-flex align-items-center justify-content-center flex-shrink-0 text-primary">
                  <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
                </div>
                <div className="flex-grow">
                  <div className="font-bold text-foreground text-[13px] leading-none mb-1">{tab.label}</div>
                  <div className="text-muted-foreground text-[10px] leading-tight opacity-80">{tab.desc}</div>
                </div>
                <span className="material-symbols-outlined text-muted-foreground/30 text-lg">chevron_right</span>
              </div>
            ))}
          </div>
        </div>

        {/* Back Button at Bottom - Fixed at bottom of view */}
        <div className="px-1 py-3 mt-auto border-top border-border/10 flex-shrink-0">
          <button 
            onClick={onCloseSettings}
            className="btn w-100 py-3 rounded-xl fw-black text-white text-uppercase tracking-widest transition-all active:scale-95 shadow-lg"
            style={{ background: themeColor || '#003641', fontSize: '11px' }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isMobile && activeTab === 'menu') return renderHub();

    switch (activeTab) {
      case 'geral':
        return (
          <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isMobile && (
              <header className="mb-6 md:mb-10">
                <div className="d-flex align-items-center gap-3 mb-2">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight m-0">Geral</h1>
                </div>
                <p className="text-muted-foreground small">Personalize a sua experiência e segurança da conta.</p>
              </header>
            )}

            <section className="pt-2">
              <h3 className="text-lg font-bold text-foreground mb-4">Segurança</h3>
              <div className="bg-card p-4 rounded-2xl border border-border">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 d-flex align-items-center justify-content-center text-primary">
                      <span className="material-symbols-outlined">verified_user</span>
                    </div>
                    <div>
                      <div className="fw-bold text-sm">Autenticação em Duas Etapas</div>
                      <div className="text-muted-foreground text-[10px]">Proteja sua conta com segurança extra.</div>
                    </div>
                  </div>
                  <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
                    <input className="form-check-input ms-0 cursor-pointer" type="checkbox" role="switch" checked={true} readOnly />
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      case 'personalizacao':
        return (
          <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isMobile && (
              <header className="mb-6 md:mb-10">
                <div className="d-flex align-items-center gap-3 mb-2">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight m-0">Visual</h1>
                </div>
                <p className="text-muted-foreground small">Personalize as cores e o tema do seu aplicativo.</p>
              </header>
            )}

            <section className="space-y-6">
              <h3 className="text-lg font-bold text-foreground mb-1">Aparência</h3>
              <div className="row g-3 g-md-4">
                <div className="col-6 col-md-6">
                  <div
                    onClick={() => isDarkMode && toggleDarkMode()}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 p-1 transition-all duration-300",
                      !isDarkMode ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card/50"
                    )}
                  >
                    <div className="aspect-[16/9] rounded-xl bg-slate-100 mb-2 overflow-hidden border border-border/50 relative">
                      <div className="absolute inset-0 p-2">
                        <div className="w-full h-2 bg-white rounded shadow-sm mb-1"></div>
                        <div className="row g-1">
                          <div className="col-4"><div className="h-10 bg-white rounded shadow-sm"></div></div>
                          <div className="col-8"><div className="h-10 bg-white rounded shadow-sm"></div></div>
                        </div>
                      </div>
                    </div>
                    <div className="px-2 pb-1 d-flex align-items-center justify-content-between">
                      <span className="font-bold text-[10px] md:text-sm">Claro</span>
                      {!isDarkMode && <span className="material-symbols-outlined text-primary text-sm md:text-lg">check_circle</span>}
                    </div>
                  </div>
                </div>
                <div className="col-6 col-md-6">
                  <div
                    onClick={() => !isDarkMode && toggleDarkMode()}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 p-1 transition-all duration-300",
                      isDarkMode ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card/50"
                    )}
                  >
                    <div className="aspect-[16/9] rounded-xl bg-slate-900 mb-2 overflow-hidden border border-border/50 relative">
                      <div className="absolute inset-0 p-2">
                        <div className="w-full h-2 bg-slate-800 rounded shadow-sm mb-1"></div>
                        <div className="row g-1">
                          <div className="col-4"><div className="h-10 bg-slate-800 rounded shadow-sm"></div></div>
                          <div className="col-8"><div className="h-10 bg-slate-800 rounded shadow-sm"></div></div>
                        </div>
                      </div>
                    </div>
                    <div className="px-2 pb-1 d-flex align-items-center justify-content-between">
                      <span className="font-bold text-[10px] md:text-sm">Escuro</span>
                      {isDarkMode && <span className="material-symbols-outlined text-primary text-sm md:text-lg">check_circle</span>}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="pt-8 border-top border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">Cor de Destaque</h3>
              <div className="d-flex align-items-center gap-3 flex-wrap">
                {[
                  '#4361ee', // Azul Royal
                  '#003641', // Azul Sicoob (Original)
                  '#1e1b4b', // Azul Noturno (O preferido do usuário)
                  '#10b981', // Verde Esmeralda
                  '#06b6d4', // Ciano
                  '#f43f5e', // Rosa
                  '#f97316', // Laranja Coral
                  '#f59e0b', // Âmbar
                  '#8b5cf6', // Roxo Violeta
                  '#d946ef', // Magenta
                  '#64748b'  // Cinza Aço
                ].map((color) => (
                  <div
                    key={color}
                    onClick={() => setThemeColor && setThemeColor(color)}
                    className={cn(
                      "w-10 h-10 md:w-12 md:h-12 rounded-2xl border-2 transition-all cursor-pointer",
                      themeColor === color ? "scale-110 shadow-md" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: color, borderColor: themeColor === color ? 'var(--text)' : 'transparent' }}
                  ></div>
                ))}
              </div>
            </section>
          </div>
        );
      case 'titulares':
        return (
          <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isMobile ? (
              <header className="mb-6 d-flex justify-content-between align-items-center">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground m-0">Titulares</h1>
                  <p className="text-muted-foreground small m-0">Pessoas da família.</p>
                </div>
                {internalView === 'list' && (
                  <button
                    onClick={() => { setEditingItem(null); setInternalView('add'); }}
                    className="btn btn-primary rounded-xl px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm border-0"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    NOVO
                  </button>
                )}
              </header>
            ) : (
              internalView === 'list' && (
                <div className="mb-4 d-flex justify-content-end">
                  <button
                    onClick={() => { setEditingItem(null); setInternalView('add'); }}
                    className="btn btn-primary rounded-xl px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm border-0"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    NOVO
                  </button>
                </div>
              )
            )}

            {internalView === 'list' ? (
              <div className="grid gap-3">
                {titulares.map((t) => (
                  <div key={t.id} className="bg-card p-3 rounded-2xl border border-border d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border shadow-sm">
                        <Image src={`https://ui-avatars.com/api/?name=${encodeURIComponent(t.nome)}&background=random&color=fff&bold=true`} fill unoptimized alt={t.nome} className="object-cover" />
                      </div>
                      <div className="fw-bold text-foreground">{t.nome}</div>
                    </div>
                    <div className="d-flex gap-1">
                      <button onClick={() => { setEditingItem(t); setInternalView('edit'); }} className="btn-icon p-2 hover:bg-primary/10 rounded-lg"><span className="material-symbols-outlined text-primary">edit</span></button>
                      <button onClick={() => onDeleteTitular(t.id)} className="btn-icon p-2 hover:bg-danger/10 rounded-lg"><span className="material-symbols-outlined text-danger">delete</span></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card p-4 rounded-2xl border border-border border-dashed">
                <TitularForm
                  initialData={editingItem}
                  onCancel={() => { setInternalView('list'); setEditingItem(null); }}
                  onSubmit={(data) => {
                    if (editingItem) onUpdateTitular(editingItem.id, data);
                    else onAddTitular(data);
                    setInternalView('list');
                    setEditingItem(null);
                  }}
                />
              </div>
            )}
          </div>
        );
      case 'cartoes':
        return (
          <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isMobile ? (
              <header className="mb-6 d-flex justify-content-between align-items-center">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground m-0">Cartões</h1>
                  <p className="text-muted-foreground small m-0">Gerencie seus cartões.</p>
                </div>
                {internalView === 'list' && (
                  <button
                    onClick={() => { setEditingItem(null); setInternalView('add'); }}
                    className="btn btn-primary rounded-xl px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm border-0"
                  >
                    <span className="material-symbols-outlined text-sm">add_card</span>
                    NOVO
                  </button>
                )}
              </header>
            ) : (
              internalView === 'list' && (
                <div className="mb-4 d-flex justify-content-end">
                  <button
                    onClick={() => { setEditingItem(null); setInternalView('add'); }}
                    className="btn btn-primary rounded-xl px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm border-0"
                  >
                    <span className="material-symbols-outlined text-sm">add_card</span>
                    NOVO
                  </button>
                </div>
              )
            )}

            {internalView === 'list' ? (
              <div className="row g-3">
                {cartoes.map((c) => (
                  <div key={c.id} className="col-12 col-md-6">
                    <div className="bg-card p-4 rounded-2xl border border-border relative overflow-hidden">
                      <div className="d-flex justify-content-between align-items-start relative z-10">
                        <div className="d-flex align-items-center gap-3">
                          <CardLogo name={c.nome_cartao} />
                          <div className="fw-bold text-foreground">{c.nome_cartao}</div>
                        </div>
                        <div className="d-flex gap-1">
                          <button onClick={() => { setEditingItem(c); setInternalView('edit'); }} className="btn-icon p-2 hover:bg-primary/10 rounded-lg"><span className="material-symbols-outlined text-primary text-sm">edit</span></button>
                          <button onClick={() => onDeleteCartao(c.id)} className="btn-icon p-2 hover:bg-danger/10 rounded-lg"><span className="material-symbols-outlined text-danger text-sm">delete</span></button>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-top border-border/50 d-flex gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                        <div>Vencimento: Dia {c.dia_vencimento}</div>
                        <div>Fechamento: Dia {c.dia_fechamento}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card p-4 rounded-2xl border border-border border-dashed">
                <CartaoForm
                  initialData={editingItem}
                  titulares={titulares}
                  onCancel={() => { setInternalView('list'); setEditingItem(null); }}
                  onSubmit={async (data) => {
                    if (editingItem) await onUpdateCartao(editingItem.id, data);
                    else await onAddCartao(data);
                    setInternalView('list');
                    setEditingItem(null);
                  }}
                />
              </div>
            )}
          </div>
        );
      case 'familia':
        return (
          <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isMobile && (
              <header className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground m-0">Família</h1>
                <p className="text-muted-foreground small">Gerencie membros.</p>
              </header>
            )}

            {userType === 'titular' && (
              <section className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6">
                <h4 className="text-foreground font-bold text-sm mb-3">Convidar por E-mail</h4>
                <div className="d-flex gap-2">
                  <input
                    type="email"
                    className="form-control bg-card border-border rounded-xl px-3 py-2 text-sm"
                    placeholder="E-mail"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <button
                    className="btn btn-primary rounded-xl px-4 fw-bold text-xs"
                    onClick={() => { onInvite(inviteEmail); setInviteEmail(''); }}
                  >
                    CONVIDAR
                  </button>
                </div>
              </section>
            )}

            <div className="grid gap-2">
              {familyMembers.map((member) => (
                <div key={member.id} className="bg-card p-3 rounded-2xl border border-border d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
                      <Image src={member.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.nome)}&background=random&color=fff&bold=true`} width={40} height={40} unoptimized alt={member.nome} className="object-cover" />
                    </div>
                    <div>
                      <div className="fw-bold text-foreground text-sm">{member.nome}</div>
                      <div className="text-muted-foreground text-[10px]">@{member.email.split('@')[0]}</div>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                    member.tipo === 'titular' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {member.tipo === 'titular' ? 'Admin' : 'Membro'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'notificacoes':
        return (
          <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isMobile && (
              <header className="mb-6 md:mb-10">
                <div className="d-flex align-items-center gap-3 mb-2">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight m-0">Avisos</h1>
                </div>
                <p className="text-muted-foreground small">Configure alertas e lembretes importantes.</p>
              </header>
            )}

            <section className="space-y-4">
              <h3 className="text-lg font-bold text-foreground mb-1">Notificações do Sistema</h3>
              <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
                <div className="p-4 d-flex align-items-center justify-content-between hover:bg-muted/30 transition-colors">
                  <div className="d-flex align-items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-danger/10 d-flex align-items-center justify-content-center text-danger">
                      <span className="material-symbols-outlined">event_busy</span>
                    </div>
                    <div>
                      <div className="fw-bold text-sm">Contas Vencidas</div>
                      <div className="text-muted-foreground text-[10px]">Avisar sobre contas que passaram do prazo.</div>
                    </div>
                  </div>
                  <div className="form-check form-switch m-0">
                    <input 
                      className="form-check-input cursor-pointer" 
                      type="checkbox" 
                      role="switch" 
                      checked={avisosConfig.vencidas} 
                      onChange={(e) => onUpdateAvisosConfig?.('vencidas', e.target.checked)} 
                    />
                  </div>
                </div>

                <div className="p-4 d-flex align-items-center justify-content-between hover:bg-muted/30 transition-colors">
                  <div className="d-flex align-items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 d-flex align-items-center justify-content-center text-warning">
                      <span className="material-symbols-outlined">notification_important</span>
                    </div>
                    <div>
                      <div className="fw-bold text-sm">Contas a Vencer Hoje</div>
                      <div className="text-muted-foreground text-[10px]">Notificar quando uma conta vence no dia atual.</div>
                    </div>
                  </div>
                  <div className="form-check form-switch m-0">
                    <input 
                      className="form-check-input cursor-pointer" 
                      type="checkbox" 
                      role="switch" 
                      checked={avisosConfig.hoje} 
                      onChange={(e) => onUpdateAvisosConfig?.('hoje', e.target.checked)} 
                    />
                  </div>
                </div>

                <div className="p-4 d-flex align-items-center justify-content-between hover:bg-muted/30 transition-colors">
                  <div className="d-flex align-items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 d-flex align-items-center justify-content-center text-primary">
                      <span className="material-symbols-outlined">insights</span>
                    </div>
                    <div>
                      <div className="fw-bold text-sm">Resumo do Radar</div>
                      <div className="text-muted-foreground text-[10px]">Avisos sobre extrapolação de orçamento mensal.</div>
                    </div>
                  </div>
                  <div className="form-check form-switch m-0">
                    <input 
                      className="form-check-input cursor-pointer" 
                      type="checkbox" 
                      role="switch" 
                      checked={avisosConfig.radar} 
                      onChange={(e) => onUpdateAvisosConfig?.('radar', e.target.checked)} 
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="d-flex align-items-center justify-content-between">
                <h3 className="text-lg font-bold text-foreground m-0">Meus Lembretes</h3>
                <button 
                  onClick={() => setShowAddReminder(!showAddReminder)}
                  className="btn btn-primary btn-sm rounded-xl px-3 py-1.5 font-bold text-[10px] tracking-widest uppercase border-0 shadow-sm"
                >
                  {showAddReminder ? 'CANCELAR' : 'ADICIONAR'}
                </button>
              </div>

              {showAddReminder && (
                <div className="bg-muted/30 p-4 rounded-2xl border border-border animate-in slide-in-from-top-2 duration-300 space-y-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">O que você deseja lembrar?</label>
                    <input 
                      type="text" 
                      className="form-control bg-card border-border rounded-xl text-sm py-2.5" 
                      placeholder="Ex: Lançar despesas de cartão"
                      value={newReminderText}
                      onChange={(e) => setNewReminderText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddReminder()}
                    />
                  </div>
                  <div className="row g-2">
                    <div className="col-7">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Data (Opcional)</label>
                      <input 
                        type="date" 
                        className="form-control bg-card border-border rounded-xl text-sm" 
                        value={newReminderDate}
                        onChange={(e) => setNewReminderDate(e.target.value)}
                      />
                    </div>
                    <div className="col-5 d-flex align-items-end">
                      <button 
                        className="btn btn-primary rounded-xl px-3 w-100 py-2 font-bold text-xs"
                        disabled={!newReminderText.trim()}
                        onClick={handleAddReminder}
                      >
                        SALVAR
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {lembretes.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border border-dashed p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/20 d-flex align-items-center justify-content-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-muted-foreground opacity-30 text-3xl">task</span>
                  </div>
                  <p className="text-muted-foreground font-medium small m-0">Nenhum lembrete personalizado criado.</p>
                  <p className="text-muted-foreground/60 text-[10px] mt-1">Clique em "Adicionar" para criar um lembrete com data.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lembretes.map((l) => (
                    <div key={l.id} className="bg-card p-3 rounded-2xl border border-border d-flex align-items-center justify-content-between group hover:border-primary/30 transition-all">
                      <div className="d-flex align-items-center gap-3">
                        <div 
                          onClick={() => onToggleLembrete?.(l.id)}
                          className={cn(
                            "w-6 h-6 rounded-lg border-2 d-flex align-items-center justify-content-center cursor-pointer transition-all",
                            l.concluido ? "bg-primary border-primary text-white" : "border-muted-foreground/30 hover:border-primary"
                          )}
                        >
                          {l.concluido && <span className="material-symbols-outlined text-sm font-black">check</span>}
                        </div>
                        <div>
                          <div className={cn(
                            "text-sm font-medium transition-all",
                            l.concluido ? "text-muted-foreground line-through" : "text-foreground"
                          )}>
                            {l.texto}
                          </div>
                          {l.data && (
                            <div className="text-[10px] text-muted-foreground d-flex align-items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-xs">calendar_today</span>
                              {new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => onDeleteLembrete?.(l.id)}
                        className="btn-icon p-2 hover:bg-danger/10 rounded-lg transition-all text-danger opacity-60 hover:opacity-100"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        );
    }
  };
  
  const getTabLabel = (id: string) => tabs.find(t => t.id === id)?.label || 'Ajustes';

  return (
    <div className={cn("SettingsView d-flex flex-column flex-md-row h-100", !isMobile ? "rounded-[2rem] overflow-hidden" : "bg-background")}>
      {/* Mobile Top Navigation (only if not in HUB) */}
      {isMobile && activeTab !== 'menu' && (
        <header className="p-4 border-b border-border bg-card/10 sticky-top">
          <div className="d-flex align-items-center justify-content-center">
            <h2 className="m-0 font-bold text-lg tracking-tighter uppercase">{getTabLabel(activeTab)}</h2>
          </div>
        </header>
      )}
      {!isMobile && (
        <aside className={cn(
          "bg-muted/10 border-end border-border flex-shrink-0 d-flex flex-column",
          isMobile ? "w-100 border-end-0 border-bottom mb-4" : "w-[240px] py-6"
        )}>
          {!isMobile && (
            <div className="px-6 mb-8 mt-2">
              <h2 className="text-foreground fw-bold h4 m-0 tracking-tighter text-uppercase">Definições</h2>
              <p className="text-muted-foreground m-0 tracking-widest text-uppercase mt-1" style={{ fontSize: '9px', fontWeight: 'bold' }}>Preferências</p>
            </div>
          )}

          <nav className={cn(
            "flex-fill",
            isMobile ? "d-flex overflow-x-auto custom-scrollbar px-3 py-2 gap-1" : "space-y-1 px-4 overflow-auto mt-2"
          )}>
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={cn(
                  "d-flex align-items-center gap-2 border-0 transition-all duration-300 rounded-xl",
                  activeTab === tab.id
                    ? (isMobile ? "bg-primary text-white px-3 py-2" : "bg-primary text-white px-4 py-3 shadow-lg shadow-primary/20")
                    : (isMobile ? "bg-transparent text-muted-foreground px-3 py-2" : "bg-transparent text-muted-foreground px-4 py-3 hover:bg-muted hover:text-foreground"),
                  !isMobile && "w-100 mb-1"
                )}
                style={!isMobile ? { fontSize: '10px', textAlign: 'left' } : { fontSize: '11px', whiteSpace: 'nowrap' }}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: isMobile ? '16px' : '18px' }}>{tab.icon}</span>
                <span className="font-bold tracking-widest text-uppercase">{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>
      )}

      <main className={cn("flex-fill h-full overflow-y-auto overflow-x-hidden bg-background custom-scrollbar", isMobile ? "px-0 pt-0 pb-0" : "p-5 p-md-10")}>
        <div className="max-w-4xl mx-auto h-100 d-flex flex-column">
          <div className="flex-fill">
            {renderContent()}
          </div>
          {isMobile && activeTab !== 'menu' && (
            <div className="px-4 py-4 mt-auto border-top border-border/10 flex-shrink-0">
              <button 
                onClick={() => setActiveTab('menu')}
                className="btn w-100 py-3 rounded-xl fw-black text-white text-uppercase tracking-widest transition-all active:scale-95 shadow-lg"
                style={{ background: themeColor || '#003641', fontSize: '11px' }}
              >
                Voltar
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  user,
  isDarkMode,
  toggleDarkMode,
  themeColor,
  setThemeColor,
  familyMembers,
  onInvite,
  userType,
  titulares,
  cartoes,
  onAddTitular,
  onUpdateTitular,
  onDeleteTitular,
  onAddCartao,
  onUpdateCartao,
  onDeleteCartao,
  lembretes,
  onAddLembrete,
  onToggleLembrete,
  onDeleteLembrete,
  avisosConfig,
  onUpdateAvisosConfig
}: {
  isOpen: boolean,
  onClose: () => void,
  user: Profile | null,
  isDarkMode: boolean,
  toggleDarkMode: () => void,
  themeColor: string,
  setThemeColor: (color: string) => void,
  familyMembers: Profile[],
  onInvite: (email: string) => void,
  userType: 'titular' | 'membro',
  titulares: Titular[],
  cartoes: CartaoConfig[],
  onAddTitular: (t: Omit<Titular, 'id'>) => void,
  onUpdateTitular: (id: number, t: Partial<Titular>) => void,
  onDeleteTitular: (id: number) => void,
  onAddCartao: (c: Omit<CartaoConfig, 'id'>) => void,
  onUpdateCartao: (id: number, c: Partial<CartaoConfig>) => void,
  onDeleteCartao: (id: number) => void,
  lembretes: {id: number, texto: string, concluido: boolean, data?: string}[],
  onAddLembrete: (texto: string, data?: string) => void,
  onToggleLembrete: (id: number) => void,
  onDeleteLembrete: (id: number) => void,
  avisosConfig: { vencidas: boolean, hoje: boolean, radar: boolean },
  onUpdateAvisosConfig: (key: 'vencidas' | 'hoje' | 'radar', value: boolean) => void
}) {
  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block settings-modal-custom" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
        <div className="modal-content border-0 shadow-2xl overflow-hidden rounded-[2rem] bg-card" style={{ height: '870px' }}>
          <SettingsView
            user={user}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            themeColor={themeColor}
            setThemeColor={setThemeColor}
            familyMembers={familyMembers}
            onInvite={onInvite}
            userType={userType}
            titulares={titulares}
            cartoes={cartoes}
            onAddTitular={onAddTitular}
            onUpdateTitular={onUpdateTitular}
            onDeleteTitular={onDeleteTitular}
            onAddCartao={onAddCartao}
            onUpdateCartao={onUpdateCartao}
            onDeleteCartao={onDeleteCartao}
            isMobile={false}
            lembretes={lembretes}
            onAddLembrete={onAddLembrete}
            onToggleLembrete={onToggleLembrete}
            onDeleteLembrete={onDeleteLembrete}
            avisosConfig={avisosConfig}
            onUpdateAvisosConfig={onUpdateAvisosConfig}
          />
          {/* Footer fixo para o Modal */}
          <div className="absolute bottom-0 right-0 p-6 z-50">
            <button type="button" className="px-10 py-3 rounded-pill btn btn-light border-0 fw-bold text-sm text-uppercase tracking-wide transition-colors" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
