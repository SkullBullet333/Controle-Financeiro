'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

import { Profile } from '@/lib/types';

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
}

export function Topbar({ title, month, year, onChangeMonth, onLogout, onOpenPeriodModal, onBack, showBackButton }: TopbarProps) {
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
    <header className="topbar mb-4">
      <div className="topbar-brand d-flex align-items-center gap-2">
        {showBackButton && (
          <button 
            onClick={onBack}
            className="btn-back-mobile d-md-none"
            title="Voltar para Home"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
        )}
        <h2 className="fw-bold m-0" id="page-title">{getTitle()}</h2>
      </div>
      <div className="topbar-controls">
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
      </div>
    </header>
  );
}

interface MobileNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onLaunch: () => void;
  activeSettingsTab: string;
  onSettingsTabChange: (tab: string) => void;
}

export function MobileNav({ 
  activeView, 
  onViewChange, 
  onLaunch,
  activeSettingsTab,
  onSettingsTabChange
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
      {showViewsMenu && (
        <div className="mobile-views-menu animate-in fade-in slide-in-from-bottom-5 duration-300" ref={viewsMenuRef}>
          <div className="d-flex flex-column gap-2 p-2">
            {[
              { id: 'geral', label: 'Fixas', icon: 'fa-clipboard-list' },
              { id: 'receitas', label: 'Receitas', icon: 'fa-money-bill-wave' },
              { id: 'cartoes', label: 'Cartões', icon: 'fa-credit-card' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  setShowViewsMenu(false);
                }}
                className={cn(
                  "btn-view-option d-flex align-items-center gap-3",
                  activeView === item.id && "active"
                )}
              >
                <i className={cn("fa-solid", item.icon)}></i>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mobile-nav-content">
        {/* SLOT 1: HOME */}
        {navItem('dashboard', 'fa-house', 'Home')}

        {/* SLOT 2: MENU (Views) */}
        <div 
          className={cn("mobile-nav-item", (activeView === 'geral' || activeView === 'receitas' || activeView === 'cartoes') && !showViewsMenu && "active")}
          onClick={() => {
            setShowViewsMenu(!showViewsMenu);
          }}
        >
          <i className="fa-solid fa-layer-group"></i>
          <span>Vistas</span>
        </div>

        {/* SLOT 3: CENTER FAB (+) */}
        <div className="mobile-nav-fab-container">
          <button 
            className="mobile-fab"
            onClick={onLaunch}
            title="Lançamento Rápido"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>

        {/* SLOT 4: RADAR */}
        {navItem('radar', 'fa-wand-magic-sparkles', 'Radar')}

        {/* SLOT 5: CONFIG */}
        <div 
          className={cn("mobile-nav-item", activeView === 'config' && "active")}
          onClick={() => {
            setShowViewsMenu(false);
            onSettingsTabChange('menu');
            onViewChange('config');
          }}
        >
          <i className="fa-solid fa-gear"></i>
          <span>Config</span>
        </div>
      </div>
    </nav>
  );
}
