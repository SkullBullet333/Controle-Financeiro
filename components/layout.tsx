'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

import { Profile, Despesa } from '@/lib/types';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  user: Profile | null;
  familyMembers: Profile[];
  onLogout: () => void;
  onHoverChange?: (hovered: boolean) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onInvite: (email: string) => void;
  onUpdateProfile: (updates: Partial<Profile>) => void;
  onOpenModal: (type: 'titular' | 'cartao' | 'profile' | 'settings' | 'emprestimo') => void;
}

export function Sidebar({ 
  activeView, 
  onViewChange, 
  user, 
  onLogout, 
  onHoverChange,
  familyMembers,
  isDarkMode,
  toggleDarkMode,
  onInvite,
  onUpdateProfile,
  onOpenModal
}: SidebarProps) {
  const [showPopup, setShowPopup] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const popupRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-house' },
    { id: 'geral', label: 'Despesas Fixas', icon: 'fa-clipboard-list' },
    { id: 'cartoes', label: 'Cartões', icon: 'fa-credit-card' },
    { id: 'receitas', label: 'Receitas', icon: 'fa-money-bill-wave' },
    { id: 'radar', label: 'Radar Financeiro', icon: 'fa-wand-magic-sparkles' },
  ];

  if (!user) return null;

  return (
    <nav 
      className="sidebar"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <div className="logo mt-4 mb-2 px-0 w-100 d-flex justify-content-center">
        <i className="fa-solid fa-chart-pie text-primary flex-shrink-0" style={{ fontSize: '1.8rem' }}></i>
        <span className="fw-bold sidebar-text">Financeiro</span>
      </div>
      
      <ul className="menu">
        {menuItems.map((item) => (
          <li 
            key={item.id}
            className={cn(activeView === item.id && "active")}
            onClick={() => onViewChange(item.id)}
            title={item.label}
          >
            <i className={cn("fa-solid", item.icon)}></i>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer mt-auto mb-4 px-1 px-md-2 position-relative" style={{ overflow: 'visible' }}>
        {showPopup && (
          <div className="user-profile-popup shadow-2xl border border-border rounded-xl p-4" ref={popupRef} style={{ width: '288px', left: '10px', bottom: '85px' }}>
            {/* Profile Header */}
            <div className="d-flex align-items-center gap-3 mb-4 p-2">
              <div className="position-relative flex-shrink-0" style={{ width: '48px', height: '48px' }}>
                <Image
                  src={user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome)}&background=4361ee&color=fff&bold=true`}
                  fill
                  unoptimized
                  className="rounded-circle object-fit-cover ring-2 ring-primary/20"
                  alt={user.nome}
                />
              </div>
              <div className="flex-fill overflow-hidden text-start">
                <div className="fw-bold text-truncate small" style={{ color: 'var(--text)' }}>
                  {user.nome || 'Usuário'}
                </div>
                <div className="text-muted text-truncate" style={{ fontSize: '11px', color: 'var(--gray)' }}>@{user.email.split('@')[0]}</div>
              </div>
            </div>

            <div className="popup-menu space-y-1">
              {/* Profile */}
              <button 
                className="w-100 text-start px-3 py-2 rounded-lg hover:bg-muted transition-colors d-flex align-items-center gap-3 border-0 bg-transparent text-foreground"
                onClick={() => { setShowPopup(false); onOpenModal('profile'); }}
              >
                <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: '20px' }}>person</span>
                <span className="small font-medium">Perfil</span>
              </button>

              {/* Definições */}
              <button 
                className="w-100 text-start px-3 py-2 rounded-lg hover:bg-muted transition-colors d-flex align-items-center gap-3 border-0 bg-transparent text-foreground"
                onClick={() => { setShowPopup(false); onOpenModal('settings'); }}
              >
                <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: '20px' }}>settings</span>
                <span className="small font-medium">Definições</span>
              </button>

              <div className="h-[1px] bg-border my-2 opacity-30"></div>

              {/* Sign Out */}
              <button 
                className="w-100 text-start px-3 py-2 text-danger hover:bg-danger/10 rounded-lg transition-colors d-flex align-items-center gap-3 border-0 bg-transparent"
                onClick={onLogout}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                <span className="small font-medium">Terminar sessão</span>
              </button>
            </div>
          </div>
        )}

        <div 
          className="user-profile-btn rounded-4 cursor-pointer hover:bg-light transition-all d-flex justify-content-center"
          onClick={() => setShowPopup(!showPopup)}
        >
          <div className="position-relative flex-shrink-0 mx-auto" style={{ width: '40px', height: '40px', minWidth: '40px' }}>
            <Image
              src={user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome)}&background=4361ee&color=fff&bold=true`}
              fill
              unoptimized
              className="rounded-circle object-fit-cover shadow-sm"
              alt={user.nome}
            />
            <div className="online-indicator position-absolute bottom-0 end-0 bg-success rounded-circle border-2 border-white" style={{ width: '12px', height: '12px' }}></div>
          </div>
          <div className="sidebar-user-info overflow-hidden">
            <div className="fw-bold text-truncate" style={{ fontSize: '14px' }}>{user.nome}</div>
            <div className={cn(
              "badge rounded-pill",
              user.tipo === 'titular' ? "bg-primary-subtle text-primary" : "bg-light text-muted"
            )} style={{ fontSize: '10px' }}>
              {user.tipo === 'titular' ? 'Titular' : 'Membro'}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

interface TopbarProps {
  title: string;
  month: number;
  year: number;
  onChangeMonth: (delta: number) => void;
  onLogout?: () => void;
  onOpenPeriodModal: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  user?: Profile | null;
  themeColor?: string;
  alertas?: { vencidas: Despesa[], vencendoHoje: Despesa[] };
}

export function Topbar({ 
  title, month, year, onChangeMonth, onLogout, onOpenPeriodModal, onBack, 
  showBackButton, user, themeColor, alertas 
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const totalAlertas = (alertas?.vencidas?.length || 0) + (alertas?.vencendoHoje?.length || 0);
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  
  const getTitle = () => {
    switch (title) {
      case 'dashboard': return 'Dashboard Financeiro';
      case 'geral': return 'Despesas Fixas';
      case 'cartoes': return 'Meus Cartões';
      case 'receitas': return 'Minhas Receitas';
      case 'radar': return 'Radar Financeiro';
      case 'config': return 'Configurações';
      default: return title;
    }
  };

  return (
    <>
      {/* Sicoob Premium Mobile Header - Only visible on small screens */}
      <div 
        className="d-md-none sicoob-mobile-header" 
        style={themeColor ? { backgroundColor: themeColor } : {}}
      >
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center gap-3">
            <div className="position-relative" style={{ width: '45px', height: '45px' }}>
              <Image
                src={user?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nome || 'Usuário')}&background=4361ee&color=fff&bold=true`}
                fill
                unoptimized
                className="rounded-circle object-fit-cover ring-2 ring-white/20"
                alt={user?.nome || 'User'}
              />
            </div>
            <div>
              <div className="text-white/80" style={{ fontSize: '0.75rem' }}>Olá,</div>
              <div className="user-greeting text-white leading-none">{user?.nome?.split(' ')[0] || 'Usuário'}</div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <div className="position-relative">
              <button 
                className="btn btn-link text-white p-2"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <i className="fa-regular fa-bell fs-5"></i>
                {totalAlertas > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-2 border-white" style={{ fontSize: '10px', padding: '2px 5px', transform: 'translate(-12px, 8px) !important' }}>
                    {totalAlertas}
                  </span>
                )}
              </button>

            </div>
          </div>
        </div>
        
        {/* Desktop Title & Date Display (Moved into mobile header to save space) */}
        <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-white/10">
           <div className="d-flex align-items-center gap-2">
            {showBackButton && (
              <button onClick={onBack} className="btn btn-link text-white p-0 me-2" title="Voltar">
                <i className="fa-solid fa-arrow-left"></i>
              </button>
            )}
            <h2 className="fw-bold m-0 fs-5 text-white" id="page-title">{getTitle()}</h2>
           </div>
           
           {title !== 'config' && (
             <div className="controls rounded-pill px-2 py-1 d-flex align-items-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
               <button onClick={() => onChangeMonth(-1)} className="btn btn-link text-white p-1" style={{ width: '24px', height: '24px' }}>
                 <i className="fa-solid fa-chevron-left" style={{ fontSize: '0.7rem' }}></i>
               </button>
               <div 
                 className="date-display text-white fw-bold px-2 cursor-pointer" 
                 onClick={onOpenPeriodModal}
                 style={{ fontSize: '0.8rem' }}
               >
                 <span>{months[month - 1]}</span> <span className="opacity-75">{year}</span>
               </div>
               <button onClick={() => onChangeMonth(1)} className="btn btn-link text-white p-1" style={{ width: '24px', height: '24px' }}>
                 <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.7rem' }}></i>
               </button>
             </div>
           )}
        </div>
      </div>

      {/* Mobile Notification Bottom Sheet - Outside header to avoid stacking context issues */}
      {showNotifications && (
        <>
          <div className="d-md-none fixed inset-0 bg-black/20 backdrop-blur-sm" style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowNotifications(false)}></div>
          <div className="d-md-none" style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 9999, maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: '2rem 2rem 0 0', boxShadow: '0 -4px 40px rgba(0,0,0,0.18)' }}>
            <div className="p-4 border-b border-border d-flex align-items-center justify-content-between">
              <h5 className="m-0 font-black text-xs tracking-widest text-uppercase text-muted-foreground">Notificações</h5>
              <button onClick={() => setShowNotifications(false)} className="btn-icon p-1 hover:bg-muted rounded-full">
                <span className="material-symbols-outlined text-muted-foreground">close</span>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {totalAlertas === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <span className="material-symbols-outlined text-5xl opacity-20 mb-3">notifications_off</span>
                  <p className="small font-bold">Nenhum aviso no momento.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {alertas?.vencidas && alertas.vencidas.length > 0 && (
                    <section>
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>
                        <h6 className="m-0 text-danger font-black text-[10px] tracking-widest text-uppercase">Despesas Vencidas</h6>
                      </div>
                      <div className="space-y-2">
                        {alertas.vencidas.map(d => (
                          <div key={d.id} className="bg-muted/30 p-3 rounded-2xl border border-danger/10 d-flex align-items-center justify-content-between">
                            <div>
                              <div className="fw-bold text-sm text-foreground">{d.descricao}</div>
                              <div className="text-[10px] text-danger font-bold opacity-80">Venceu em: {d.vencimento}</div>
                            </div>
                            <div className="text-sm font-black text-foreground">R$ {Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {alertas?.vencendoHoje && alertas.vencendoHoje.length > 0 && (
                    <section>
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                        <h6 className="m-0 text-warning font-black text-[10px] tracking-widest text-uppercase">Vence Hoje</h6>
                      </div>
                      <div className="space-y-2">
                        {alertas.vencendoHoje.map(d => (
                          <div key={d.id} className="bg-muted/30 p-3 rounded-2xl border border-warning/10 d-flex align-items-center justify-content-between">
                            <div>
                              <div className="fw-bold text-sm text-foreground">{d.descricao}</div>
                              <div className="text-[10px] text-warning font-bold opacity-80">Vencimento: HOJE</div>
                            </div>
                            <div className="text-sm font-black text-foreground">R$ {Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border" style={{ background: 'var(--card)' }}>
              <button onClick={() => setShowNotifications(false)} className="btn w-100 py-3 rounded-xl fw-black text-xs text-uppercase tracking-widest bg-card border-border shadow-sm">
                Fechar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Standard Desktop Topbar - Hidden on small screens */}
      <header className="topbar mb-4 d-none d-md-flex">
        <div className="topbar-brand d-flex align-items-center gap-2">
          {showBackButton && (
            <button onClick={onBack} className="btn-back-mobile d-md-none" title="Voltar para Home">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          )}
          <h2 className="fw-bold m-0" id="page-title">{getTitle()}</h2>
        </div>
          <div className="topbar-controls d-flex align-items-center gap-3">
            {title !== 'config' && (
              <div className="controls">
                <button onClick={() => onChangeMonth(-1)}><i className="fa-solid fa-chevron-left"></i></button>
                <div 
                  className="date-display" 
                  title="Clique para selecionar o período"
                  onClick={onOpenPeriodModal}
                >
                  <i className="fa-regular fa-calendar-check text-primary opacity-75"></i>
                  <span id="lblMes">{months[month - 1]}</span> 
                  <span id="lblAno">{year}</span>
                </div>
                <button onClick={() => onChangeMonth(1)}><i className="fa-solid fa-chevron-right"></i></button>
              </div>
            )}

            <div className="position-relative">
              <button 
                className={cn("btn-icon p-2 rounded-xl transition-all", showNotifications ? "bg-primary/10 shadow-sm" : "hover:bg-muted text-muted-foreground")}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <i className={cn("fs-5 transition-all", showNotifications ? "fa-solid fa-bell text-primary scale-110" : "fa-regular fa-bell")}></i>
                {totalAlertas > 0 && (
                  <span className="position-absolute top-1 right-1 w-2 h-2 bg-danger rounded-full border-2 border-background"></span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-[2999]" onClick={() => setShowNotifications(false)}></div>
                  <div className="absolute right-0 top-full mt-3 w-[350px] bg-card rounded-2xl shadow-2xl border border-border z-[3000] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-4 border-b border-border d-flex align-items-center justify-content-between bg-muted/10">
                    <h5 className="m-0 font-black text-[10px] tracking-widest text-uppercase text-muted-foreground">Notificações</h5>
                    {totalAlertas > 0 && <span className="bg-danger/10 text-danger text-[9px] font-black px-2 py-0.5 rounded-full">{totalAlertas} AVISOS</span>}
                  </div>
                  
                  <div className="max-h-[450px] overflow-y-auto p-4 custom-scrollbar space-y-5">
                    {totalAlertas === 0 ? (
                      <div className="py-10 text-center">
                        <span className="material-symbols-outlined text-4xl text-muted-foreground opacity-20 mb-3">notifications_off</span>
                        <p className="small text-muted-foreground font-medium">Você está em dia! Nenhuma notificação.</p>
                      </div>
                    ) : (
                      <>
                        {alertas?.vencidas && alertas.vencidas.length > 0 && (
                          <section>
                            <h6 className="text-danger font-black text-[9px] tracking-widest text-uppercase mb-3 d-flex align-items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>
                              Despesas Vencidas
                            </h6>
                            <div className="space-y-2">
                              {alertas.vencidas.map(d => (
                                <div key={d.id} className="p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors d-flex align-items-center justify-content-between gap-3">
                                  <div>
                                    <div className="fw-bold text-xs text-foreground">{d.descricao}</div>
                                    <div className="text-[10px] text-danger font-bold">Venceu em: {d.vencimento}</div>
                                  </div>
                                  <div className="text-xs font-black text-foreground whitespace-nowrap">R$ {Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        {alertas?.vencendoHoje && alertas.vencendoHoje.length > 0 && (
                          <section>
                            <h6 className="text-warning font-black text-[9px] tracking-widest text-uppercase mb-3 d-flex align-items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                              Vence Hoje
                            </h6>
                            <div className="space-y-2">
                              {alertas.vencendoHoje.map(d => (
                                <div key={d.id} className="p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors d-flex align-items-center justify-content-between gap-3">
                                  <div>
                                    <div className="fw-bold text-xs text-foreground">{d.descricao}</div>
                                    <div className="text-[10px] text-warning font-bold">Vencimento: HOJE</div>
                                  </div>
                                  <div className="text-xs font-black text-foreground whitespace-nowrap">R$ {Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
      </header>
    </>
  );
}

interface MobileNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onLaunch: () => void;
  activeSettingsTab: string;
  onSettingsTabChange: (tab: string) => void;
  themeColor?: string;
  onBack?: () => void;
}

export function MobileNav({ 
  activeView, 
  onViewChange, 
  onLaunch,
  activeSettingsTab,
  onSettingsTabChange,
  themeColor,
  onBack
}: MobileNavProps) {
  const [showViewsMenu, setShowViewsMenu] = React.useState(false);
  const viewsMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewsMenuRef.current && !viewsMenuRef.current.contains(event.target as Node)) {
        setShowViewsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItem = (id: string, icon: string, label: string) => (
    <div 
      className={cn("mobile-nav-item", activeView === id && !showViewsMenu && "active")}
      onClick={() => {
        setShowViewsMenu(false);
        onViewChange(id);
      }}
    >
      <i className={cn("fa-solid", icon)}></i>
      <span>{label}</span>
    </div>
  );

  return (
    <nav className="mobile-nav-container">
      {/* Floating Views Menu */}
      {/* Floating Views Menu moved to end */}

      <div 
        className="mobile-nav d-flex"
        style={themeColor ? { backgroundColor: themeColor } : {}}
      >
        {/* SLOT 1: HOME */}
        {navItem('dashboard', 'fa-house', 'Início')}

        {/* SLOT 2: MENU (Views) */}
        <div 
          className={cn("mobile-nav-item", (activeView === 'geral' || activeView === 'receitas' || activeView === 'cartoes') && !showViewsMenu && "active")}
          onClick={() => {
            setShowViewsMenu(!showViewsMenu);
          }}
        >
          <i className="fa-solid fa-list-ul"></i>
          <span>Extrato</span>
        </div>

        {/* SLOT 3: CENTER FAB (+) */}
        <div className="mobile-nav-fab-container d-flex justify-content-center">
          <div className="mobile-nav-bump">
            <svg viewBox="0 0 160 40" preserveAspectRatio="none">
              <path d="M 0 40 C 40 40 40 0 80 0 C 120 0 120 40 160 40 Z" style={{ fill: themeColor || 'var(--sicoob-teal)' }} />
            </svg>
          </div>
          <button 
            className="mobile-fab shadow-lg"
            onClick={onLaunch}
            title="Lançamento Rápido"
          >
            <i className="fa-solid fa-plus" style={{ fontSize: '1.5rem' }}></i>
          </button>
        </div>

        {/* SLOT 4: RADAR */}
        {navItem('radar', 'fa-chart-pie', 'Radar')}

        {/* SLOT 5: MENU CONFIG */}
        <div 
          className={cn("mobile-nav-item", activeView === 'config' && "active")}
          onClick={() => {
            setShowViewsMenu(false);
            onSettingsTabChange('menu');
            onViewChange('config');
          }}
        >
          <i className="fa-solid fa-ellipsis"></i>
          <span>Menu</span>
        </div>
      </div>

      {/* Bottom Sheet Views Menu - Positioned at end for stacking */}
      {showViewsMenu && (
        <>
          <div 
            className="bottom-sheet-backdrop animate-in fade-in duration-300"
            onClick={() => setShowViewsMenu(false)}
          ></div>
          
          <div 
            className="mobile-views-menu animate-in slide-in-from-bottom-full duration-400" 
            ref={viewsMenuRef}
            style={themeColor ? { backgroundColor: themeColor } : {}}
          >
            <div className="bottom-sheet-handle-container" style={{ borderBottomColor: 'rgba(255,255,255,0.1)' }}>
              <div className="bottom-sheet-handle" style={{ background: 'rgba(255,255,255,0.3)' }}></div>
              <h4 className="m-0 text-center font-black text-xs tracking-widest text-white uppercase py-2">Extrato</h4>
            </div>

            <div className="d-flex flex-column p-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(85vh - 120px)' }}>
              {[
                { id: 'geral', label: 'Despesas Fixas', icon: 'fa-clipboard-list' },
                { id: 'receitas', label: 'Minhas Receitas', icon: 'fa-money-bill-wave' },
                { id: 'cartoes', label: 'Faturas de Cartão', icon: 'fa-credit-card' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    setShowViewsMenu(false);
                  }}
                  className={cn(
                    "btn-view-option d-flex align-items-center gap-4 transition-all duration-300 relative overflow-hidden",
                    activeView === item.id && "active-selection-pop"
                  )}
                  style={{ 
                    color: activeView === item.id ? '#E5E7EB' : '#FFFFFF',
                    backgroundColor: activeView === item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    transform: activeView === item.id ? 'translateX(4px)' : 'none'
                  }}
                >
                  {/* Indicator Bar */}
                  {activeView === item.id && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full"></div>
                  )}

                  <div 
                    className="w-10 h-10 rounded-xl d-flex align-items-center justify-content-center transition-all" 
                    style={{ background: activeView === item.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }}
                  >
                    <i className={cn("fa-solid", item.icon)}></i>
                  </div>
                  <span className="font-bold" style={{ color: 'inherit' }}>{item.label}</span>
                  <div className="ms-auto">
                    {activeView === item.id ? (
                      <i className="fa-solid fa-check text-xs"></i>
                    ) : (
                      <i className="fa-solid fa-chevron-right opacity-30 text-xs" style={{ color: 'inherit' }}></i>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Back Button at Bottom */}
            <div className="p-3 mt-auto border-top" style={{ borderTopColor: 'rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => setShowViewsMenu(false)}
                className="btn w-100 py-3 rounded-xl fw-black text-white text-uppercase tracking-widest transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.1)', fontSize: '11px' }}
              >
                Voltar
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
