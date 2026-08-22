'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

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
  onOpenModal
}: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-house' },
    { id: 'cartoes', label: 'Meus Cartões', icon: 'fa-credit-card' },
    { id: 'extrato', label: 'Despesas & Receitas', icon: 'fa-list-check' },
    { id: 'radar', label: 'Radar Financeiro', icon: 'fa-wand-magic-sparkles' },
    { id: 'config', label: 'Definições', icon: 'fa-gear' },
  ];

  if (!user) return null;

  return (
    <aside 
      className="sidebar d-none d-md-flex"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      {/* Brand Logo conforme completo_prototype.html */}
      <div className="brand-logo">
        <div className="brand-icon">
          <i className="fa-solid fa-chart-pie"></i>
        </div>
        <span className="brand-title">Radar Financeiro</span>
      </div>
      
      {/* Nav Menu */}
      <ul className="nav-menu">
        {menuItems.map((item) => (
          <li 
            key={item.id}
            className={cn("nav-item", activeView === item.id && "active")}
            onClick={() => onViewChange(item.id)}
            title={item.label}
          >
            <i className={cn("fa-solid", item.icon)}></i>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {/* Sidebar Footer com Perfil Direto e Botão Sair */}
      <div className="sidebar-footer">
        <div 
          className="user-profile"
          onClick={() => onOpenModal('profile')}
          title="Clique para editar seu perfil"
        >
          {user.foto ? (
            <div className="position-relative flex-shrink-0" style={{ width: '38px', height: '38px' }}>
              <Image
                src={user.foto}
                fill
                unoptimized
                className="rounded-circle object-fit-cover shadow-sm"
                alt={user.nome}
              />
            </div>
          ) : (
            <div className="avatar">
              {user.nome ? user.nome.slice(0, 2).toUpperCase() : 'EU'}
            </div>
          )}
          <div className="user-info">
            <span className="user-name">{user.nome || 'Usuário'}</span>
            <span className="user-badge">{user.tipo === 'titular' ? 'Titular' : 'Membro'}</span>
          </div>
        </div>

        <button 
          type="button"
          className="btn-icon" 
          title="Sair da Conta"
          onClick={onLogout}
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
        </button>
      </div>
    </aside>
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
  user: Profile | null;
  themeColor?: string;
  themeMode?: 'light' | 'dark' | 'black';
  toggleDarkMode?: () => void;
  alertas?: { vencidas: Despesa[], vencendoHoje: Despesa[] };
  onOpenModal?: (type: 'profile' | 'settings' | 'titular' | 'cartao' | 'emprestimo' | 'despesa') => void;
  isHidden?: boolean;
  onToggleVisibility?: () => void;
}

export function Topbar({ 
  title, month, year, onChangeMonth, onLogout, onOpenPeriodModal, onBack, 
  showBackButton, user, themeColor, themeMode = 'black', toggleDarkMode, alertas, onOpenModal,
  isHidden = false, onToggleVisibility
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const totalAlertas = (alertas?.vencidas?.length || 0) + (alertas?.vencendoHoje?.length || 0);
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const getTitle = () => {
    switch (title) {
      case 'dashboard': return 'Dashboard Financeiro';
      case 'extrato':
      case 'geral':
      case 'receitas': return 'Despesas & Receitas';
      case 'cartoes': return 'Meus Cartões de Crédito';
      case 'radar': return 'Radar Financeiro';
      case 'config': return 'Definições & Configurações';
      default: return title;
    }
  };

  const getTitleIcon = () => {
    switch (title) {
      case 'dashboard': return 'fa-house';
      case 'extrato':
      case 'geral':
      case 'receitas': return 'fa-list-check';
      case 'cartoes': return 'fa-credit-card';
      case 'radar': return 'fa-wand-magic-sparkles';
      case 'config': return 'fa-gear';
      default: return 'fa-chart-pie';
    }
  };

  return (
    <>
      {/* Sicoob Premium Mobile Header - Only visible on small screens */}
      <div 
        className="d-md-none sicoob-mobile-header" 
        style={themeColor ? { backgroundColor: themeColor } : {}}
      >
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <h2 className="fw-bold m-0 fs-5 text-white d-flex align-items-center gap-2" id="page-title">
              <i className={cn("fa-solid", getTitleIcon(), "opacity-80")} style={{ fontSize: '1.1rem' }}></i>
              <span>{getTitle()}</span>
            </h2>
          </div>
          
          <div className="d-flex align-items-center gap-1">
            {/* Mobile Eye Toggle */}
            {onToggleVisibility && (
              <button 
                type="button"
                className="btn btn-link text-white p-2"
                title={isHidden ? "Exibir valores" : "Ocultar valores"}
                onClick={onToggleVisibility}
              >
                <i className={cn("fa-regular fs-5", isHidden ? "fa-eye-slash" : "fa-eye")}></i>
              </button>
            )}

            {/* Mobile theme toggle */}
            <button 
              type="button"
              className="btn btn-link text-white p-2"
              title="Alternar Tema"
              onClick={toggleDarkMode}
            >
              <i className={cn("fa-solid fs-5", themeMode === 'light' ? "fa-sun" : themeMode === 'dark' ? "fa-cloud-moon" : "fa-moon")}></i>
            </button>

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
            
            <div 
              className="position-relative"
              ref={userMenuRef}
            >
              <div 
                className="cursor-pointer active:scale-95 transition-transform" 
                style={{ width: '36px', height: '36px' }}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <Image
                  src={user?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nome || 'Usuário')}&background=4361ee&color=fff&bold=true`}
                  fill
                  unoptimized
                  className="rounded-circle object-fit-cover ring-2 ring-white/20 shadow-sm"
                  alt={user?.nome || 'User'}
                />
              </div>

              {showUserMenu && (
                <div 
                  className="position-absolute end-0 top-100 mt-2 bg-card border border-border rounded-2xl shadow-2xl p-2 z-[10000] animate-in fade-in zoom-in-95 duration-200" 
                  style={{ width: '190px' }}
                >
                  <button 
                    className="w-100 text-start px-3 py-2 rounded-xl hover:bg-muted transition-colors d-flex align-items-center gap-3 border-0 bg-transparent text-foreground"
                    onClick={() => { setShowUserMenu(false); onOpenModal?.('profile'); }}
                  >
                    <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: '20px' }}>person</span>
                    <span className="small font-medium">Meu Perfil</span>
                  </button>

                  <button 
                    className="w-100 text-start px-3 py-2 rounded-xl hover:bg-muted transition-colors d-flex align-items-center gap-3 border-0 bg-transparent text-foreground"
                    onClick={() => { setShowUserMenu(false); onOpenModal?.('settings'); }}
                  >
                    <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: '20px' }}>settings</span>
                    <span className="small font-medium">Configurações</span>
                  </button>

                  <div className="h-[1px] bg-border my-1 opacity-30"></div>
                  <button 
                    className="w-100 text-start px-3 py-2 text-danger hover:bg-danger/10 rounded-xl transition-colors d-flex align-items-center gap-3 border-0 bg-transparent"
                    onClick={() => { setShowUserMenu(false); onLogout?.(); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                    <span className="small font-medium">Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Notification Bottom Sheet */}
      {showNotifications && (
        <>
          <div className="d-md-none fixed inset-0 bg-black/20 backdrop-blur-sm" style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowNotifications(false)}></div>
          <div className="d-md-none" style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 9999, maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: '2rem 2rem 0 0', boxShadow: '0 -4px 40px rgba(0,0,0,0.18)' }}>
            <div className="p-4 border-b border-border d-flex align-items-center justify-content-between">
              <h5 className="m-0 font-bold text-sm d-flex align-items-center gap-2 text-foreground">
                <i className="fa-regular fa-bell text-primary"></i> Central de Notificações
              </h5>
              <button onClick={() => setShowNotifications(false)} className="btn-icon p-1 hover:bg-muted rounded-full">
                <span className="material-symbols-outlined text-muted-foreground">close</span>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {totalAlertas === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <i className="fa-regular fa-circle-check text-success fs-3 mb-2 d-block"></i>
                  <p className="small font-bold">Tudo em dia! Nenhuma notificação pendente.</p>
                </div>
              ) : (
                <>
                  {alertas?.vencidas?.map(d => (
                    <div 
                      key={`mob-venc-${d.id}`}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #ef4444',
                        padding: '14px',
                        borderRadius: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                          <i className="fa-solid fa-circle-exclamation me-1"></i> Conta Vencida
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                          {d.vencimento ? formatDate(d.vencimento) : 'Vencida'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', marginTop: '4px', marginBottom: 0, color: 'var(--text, #fff)' }}>
                        <strong>{d.descricao}</strong> ({formatCurrency(d.valor)}) venceu em {d.vencimento ? formatDate(d.vencimento) : 'data anterior'}.
                      </p>
                    </div>
                  ))}

                  {alertas?.vencendoHoje?.map(d => (
                    <div 
                      key={`mob-hoje-${d.id}`}
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #f59e0b',
                        padding: '14px',
                        borderRadius: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
                          <i className="fa-solid fa-clock me-1"></i> Vence Hoje
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>Hoje</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', marginTop: '4px', marginBottom: 0, color: 'var(--text, #fff)' }}>
                        <strong>{d.descricao}</strong> ({formatCurrency(d.valor)}) tem vencimento hoje.
                      </p>
                    </div>
                  ))}
                </>
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

      {/* Standard Desktop Topbar (Conforme completo_prototype.html) */}
      <header className="topbar mb-4 d-none d-md-flex">
        <div className="page-header-title">
          <i className={cn("fa-solid", getTitleIcon(), "text-primary")}></i>
          <span id="page-title">{getTitle()}</span>
        </div>

        <div className="topbar-actions">
          {/* Eye Toggle Button (Ocultar / Exibir Valores ao lado do tema) */}
          {onToggleVisibility && (
            <button 
              type="button"
              className="btn-icon" 
              title={isHidden ? "Exibir valores" : "Ocultar valores"} 
              onClick={onToggleVisibility}
            >
              <i className={cn(
                "fa-regular transition-all",
                isHidden ? "fa-eye-slash text-muted" : "fa-eye text-primary"
              )}></i>
            </button>
          )}

          {/* Theme Switcher (Apenas Ícone) */}
          <button 
            type="button"
            className="btn-icon" 
            title={`Tema atual: ${themeMode === 'black' ? 'Midnight Black' : themeMode === 'dark' ? 'Dark Deep' : 'Light Mode'}. Clique para alternar.`} 
            onClick={toggleDarkMode}
          >
            <i className={cn(
              "fa-solid transition-all",
              themeMode === 'light' ? "fa-sun text-warning" : themeMode === 'dark' ? "fa-cloud-moon text-primary" : "fa-moon"
            )}></i>
          </button>

          {/* Notification Bell */}
          <div className="position-relative">
            <button 
              type="button"
              className={cn("btn-icon transition-all", showNotifications && "border-primary text-foreground bg-muted")}
              title="Notificações"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <i className={cn("fa-regular fa-bell transition-all", showNotifications && "fa-solid fa-bell text-primary")}></i>
              {totalAlertas > 0 && (
                <span className="badge-dot"></span>
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-[2999]" onClick={() => setShowNotifications(false)}></div>
                <div 
                  className="absolute right-0 top-full mt-3 w-[360px] rounded-2xl shadow-2xl z-[3000] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                  style={{
                    background: 'var(--card, #0f1016)',
                    border: '1px solid var(--border, rgba(255,255,255,0.08))',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.8)'
                  }}
                >
                  <div 
                    className="p-4 border-b d-flex align-items-center justify-content-between"
                    style={{
                      borderColor: 'var(--border, rgba(255,255,255,0.08))',
                      background: 'var(--card-hover, #151720)'
                    }}
                  >
                    <h5 className="m-0 font-bold text-sm d-flex align-items-center gap-2" style={{ color: 'var(--text, #fff)' }}>
                      <i className="fa-regular fa-bell text-primary"></i>
                      <span>Central de Notificações</span>
                    </h5>
                    <button 
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="border-0 bg-transparent cursor-pointer p-0"
                      style={{ fontSize: '1.3rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1 }}
                    >
                      &times;
                    </button>
                  </div>
                  
                  <div 
                    className="max-h-[460px] overflow-y-auto p-3.5 custom-scrollbar" 
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    {totalAlertas === 0 ? (
                      <div className="py-8 text-center" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                        <i className="fa-regular fa-circle-check text-success fs-3 mb-2 d-block"></i>
                        <p className="small m-0 font-medium">Tudo em dia! Nenhuma pendência para este período.</p>
                      </div>
                    ) : (
                      <>
                        {alertas?.vencidas && alertas.vencidas.length > 0 && (
                          alertas.vencidas.map(d => (
                            <div 
                              key={`desk-venc-${d.id}`}
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid #ef4444',
                                padding: '14px',
                                borderRadius: '14px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                                  <i className="fa-solid fa-circle-exclamation me-1"></i> Conta Vencida
                                </strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                                  {d.vencimento ? formatDate(d.vencimento) : 'Vencida'}
                                </span>
                              </div>
                              <p style={{ fontSize: '0.85rem', marginTop: '4px', marginBottom: 0, color: 'var(--text, #fff)' }}>
                                <strong>{d.descricao}</strong> ({formatCurrency(d.valor)}) venceu em {d.vencimento ? formatDate(d.vencimento) : 'data anterior'}.
                              </p>
                            </div>
                          ))
                        )}

                        {alertas?.vencendoHoje && alertas.vencendoHoje.length > 0 && (
                          alertas.vencendoHoje.map(d => (
                            <div 
                              key={`desk-hoje-${d.id}`}
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid #f59e0b',
                                padding: '14px',
                                borderRadius: '14px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
                                  <i className="fa-solid fa-clock me-1"></i> Vence Hoje
                                </strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>Hoje</span>
                              </div>
                              <p style={{ fontSize: '0.85rem', marginTop: '4px', marginBottom: 0, color: 'var(--text, #fff)' }}>
                                <strong>{d.descricao}</strong> ({formatCurrency(d.valor)}) tem vencimento hoje.
                              </p>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Month / Year Navigator (No lugar do Novo Lançamento) */}
          {title !== 'config' && (
            <div className="period-navigator">
              <button 
                type="button"
                className="period-btn" 
                onClick={() => onChangeMonth(-1)}
                title="Mês anterior"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              
              <div 
                className="period-display" 
                onClick={onOpenPeriodModal}
                title="Clique para selecionar o período"
              >
                <i className="fa-regular fa-calendar text-primary"></i>
                <span>{months[month - 1]} {year}</span>
              </div>
              
              <button 
                type="button"
                className="period-btn" 
                onClick={() => onChangeMonth(1)}
                title="Próximo mês"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}

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

        {/* SLOT 2: EXTRATO (Despesas e Receitas) */}
        {navItem('extrato', 'fa-list-check', 'Extrato')}

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
            title="Novo Registro"
          >
            <i className="fa-solid fa-plus" style={{ fontSize: '1.5rem' }}></i>
          </button>
        </div>

        {/* SLOT 4: CARTOES */}
        {navItem('cartoes', 'fa-credit-card', 'Cartões')}

        {/* SLOT 5: RADAR */}
        {navItem('radar', 'fa-wand-magic-sparkles', 'Radar')}
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
