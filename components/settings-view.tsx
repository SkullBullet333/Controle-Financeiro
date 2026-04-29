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
}

const getCardLogo = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('inter')) return <div className="w-10 h-10 rounded-lg bg-orange-500 d-flex align-items-center justify-content-center text-white fw-bold">I</div>;
  if (n.includes('nubank')) return <div className="w-10 h-10 rounded-lg bg-purple-600 d-flex align-items-center justify-content-center text-white fw-bold">N</div>;
  if (n.includes('itaú') || n.includes('itau')) return <div className="w-10 h-10 rounded-lg bg-blue-800 d-flex align-items-center justify-content-center text-white fw-bold">It</div>;
  return <div className="w-10 h-10 rounded-lg bg-slate-400 d-flex align-items-center justify-content-center text-white fw-bold"><i className="fa-solid fa-credit-card"></i></div>;
};

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
  onCloseSettings
}: SettingsViewProps) {
  const [internalTab, setInternalTab] = useState('geral');
  const activeTab = controlledTab || internalTab;
  const setActiveTab = onControlledTabChange || setInternalTab;
  const [inviteEmail, setInviteEmail] = useState('');
  const [internalView, setInternalView] = useState<'list' | 'add' | 'edit'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    setInternalView('list');
    setEditingItem(null);
  }, [activeTab]);

  const tabs = [
    { id: 'geral', label: 'Geral', icon: 'settings' },
    { id: 'titulares', label: 'Titulares', icon: 'person_add' },
    { id: 'cartoes', label: 'Cartões', icon: 'credit_card' },
    { id: 'familia', label: 'Dados', icon: 'database' },
    { id: 'notificacoes', label: 'Avisos', icon: 'notifications' },
    { id: 'personalizacao', label: 'Visual', icon: 'palette' },
  ];
  
  const renderHub = () => {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-5 duration-500 overflow-y-auto overflow-x-hidden custom-scrollbar h-100 flex flex-col">
        <header className="mb-8 pt-4">
          <div className="d-flex align-items-center justify-content-between mb-2 px-1">
            <div className="d-flex align-items-center gap-3">
              <button 
                onClick={onCloseSettings}
                className="btn-icon p-2 hover:bg-muted rounded-full bg-muted/20 d-flex align-items-center justify-content-center"
              >
                <span className="material-symbols-outlined text-foreground">arrow_back_ios_new</span>
              </button>
              <h1 className="text-2xl font-bold text-foreground tracking-tighter m-0">CONFIGURAÇÕES</h1>
            </div>
          </div>
          <p className="text-muted-foreground small ps-1 mt-1">Gerencie suas preferências e dados do sistema.</p>
        </header>

        <div className="row g-3 mx-0 flex-1 pb-10">
          {tabs.map((tab) => (
            <div key={tab.id} className="col-6">
              <div
                onClick={() => setActiveTab(tab.id)}
                className="bg-card border border-border rounded-3xl p-4 h-100 d-flex flex-column align-items-center justify-content-center text-center transition-all active:scale-95 shadow-sm hover:shadow-md cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 d-flex align-items-center justify-content-center mb-3">
                  <span className="material-symbols-outlined text-primary text-3xl">{tab.icon}</span>
                </div>
                <div className="font-bold text-foreground text-sm tracking-tight">{tab.label}</div>
              </div>
            </div>
          ))}
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
                {['#4361ee', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6'].map((color) => (
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
                          {getCardLogo(c.nome_cartao)}
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
      default:
        return <div className="py-20 text-center text-muted">Em breve</div>;
    }
  };
  
  const getTabLabel = (id: string) => tabs.find(t => t.id === id)?.label || 'Ajustes';

  return (
    <div className={cn("SettingsView d-flex flex-column flex-md-row h-100", !isMobile ? "rounded-[2rem] overflow-hidden" : "bg-background")}>
      {/* Mobile Top Navigation (only if not in HUB) */}
      {isMobile && activeTab !== 'menu' && (
        <header className="p-4 border-b border-border bg-card/10 sticky-top">
          <div className="d-flex align-items-center justify-content-between">
            <button 
              onClick={() => setActiveTab('menu')}
              className="btn-icon p-2 hover:bg-muted rounded-full"
            >
              <span className="material-symbols-outlined text-foreground">arrow_back_ios_new</span>
            </button>
            <h2 className="m-0 font-bold text-lg tracking-tighter uppercase">{getTabLabel(activeTab)}</h2>
            <div className="w-10"></div> 
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

      <main className={cn("flex-fill overflow-y-auto overflow-x-hidden bg-background custom-scrollbar", isMobile ? "px-3 pt-2 pb-20" : "p-5 p-md-10")}>
        <div className="max-w-4xl mx-auto h-100 d-flex flex-column">
          <div className="flex-fill">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
