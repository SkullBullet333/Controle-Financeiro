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
  onOpenModal: (type: 'titular' | 'cartao' | 'profile' | 'settings') => void;
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
      <div className="logo mt-4 mb-2 d-flex align-items-center gap-3" style={{ paddingLeft: '5px' }}>
        <i className="fa-solid fa-chart-pie text-primary" style={{ fontSize: '1.8rem' }}></i>
        <span className="fw-bold fs-5">Financeiro</span>
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
              {/* Definições / Perfil */}
              <button 
                className="w-100 text-start px-3 py-2 rounded-lg hover:bg-light transition-colors d-flex align-items-center gap-3 border-0 bg-transparent"
                style={{ color: 'var(--text)' }}
                onClick={() => { setShowPopup(false); onOpenModal('settings'); }}
              >
                <i className="fa-solid fa-gear" style={{ color: 'var(--gray)', width: '20px' }}></i>
                <span className="small font-medium">Definições</span>
              </button>

              <button 
                className="w-100 text-start px-3 py-2 rounded-lg hover:bg-light transition-colors d-flex align-items-center gap-3 border-0 bg-transparent"
                style={{ color: 'var(--text)' }}
                onClick={() => { setShowPopup(false); onOpenModal('profile'); }}
              >
                <i className="fa-solid fa-user" style={{ color: 'var(--gray)', width: '20px' }}></i>
                <span className="small font-medium">Perfil</span>
              </button>

              <div className="h-[1px] bg-border my-2 opacity-50"></div>

              {/* Minha Família */}
              <div className="px-3 py-1 fw-bold text-uppercase d-flex justify-content-between align-items-center" style={{ fontSize: '10px', color: 'var(--gray)' }}>
                <span>Minha Família</span>
                {user.tipo === 'titular' && (
                  <button 
                    className="border-0 bg-transparent text-primary p-0 d-flex align-items-center gap-1 hover:underline shadow-none"
                    style={{ fontSize: '10px' }}
                    onClick={() => { setShowPopup(false); onOpenModal('settings'); }}
                  >
                    <i className="fa-solid fa-plus-circle"></i> Gerenciar
                  </button>
                )}
              </div>
              
              <div className="family-list max-h-32 overflow-y-auto mt-1 px-1 custom-scrollbar">
                {familyMembers.map((member) => (
                  <div key={member.id} className="d-flex align-items-center gap-3 p-2 rounded-lg bg-light/5 border border-border/10 mb-1">
                    <div className="position-relative flex-shrink-0" style={{ width: '24px', height: '24px' }}>
                      <Image
                        src={member.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.nome)}&background=random&color=fff&bold=true`}
                        fill
                        unoptimized
                        className="rounded-circle object-fit-cover"
                        alt={member.nome}
                      />
                    </div>
                    <div className="flex-fill overflow-hidden text-start">
                      <div className="text-truncate fw-bold" style={{ fontSize: '10px', color: 'var(--text)' }}>{member.nome}</div>
                      <div className="text-muted text-truncate" style={{ fontSize: '8px', color: 'var(--gray)' }}>{member.tipo === 'titular' ? 'Titular' : 'Membro'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-[1px] bg-border my-3 mx-2 opacity-50"></div>

            {/* Sign Out */}
            <button 
              className="w-100 text-start px-3 py-2 text-danger hover:bg-danger/10 rounded-lg transition-colors d-flex align-items-center gap-3 border-0 bg-transparent"
              onClick={onLogout}
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              <span className="small font-medium">Terminar sessão</span>
            </button>
          </div>
        )}

        <div 
          className="user-profile-btn d-flex align-items-center gap-3 p-2 rounded-4 cursor-pointer hover:bg-light transition-all"
          onClick={() => setShowPopup(!showPopup)}
        >
          <div className="position-relative flex-shrink-0" style={{ width: '40px', height: '40px', minWidth: '40px' }}>
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
}

export function Topbar({ title, month, year, onChangeMonth, onLogout, onOpenPeriodModal }: TopbarProps) {
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
      <div className="topbar-brand">
        <h2 className="fw-bold m-0" id="page-title">{getTitle()}</h2>
        <div className="d-flex align-items-center gap-2">
          <div className="mobile-date-btn d-md-none" onClick={onOpenPeriodModal}>
            <i className="fa-solid fa-calendar-days"></i>
          </div>
          <div 
            className="mobile-date-btn d-md-none" 
            style={{ color: 'var(--danger)', background: 'rgba(231, 29, 54, 0.1)' }}
            onClick={onLogout}
          >
            <i className="fa-solid fa-right-from-bracket"></i>
          </div>
        </div>
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
}

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'fa-house' },
    { id: 'geral', label: 'Fixas', icon: 'fa-clipboard-list' },
    { id: 'cartoes', label: 'Cartões', icon: 'fa-credit-card' },
    { id: 'receitas', label: 'Receitas', icon: 'fa-money-bill-wave' },
    { id: 'radar', label: 'Radar', icon: 'fa-wand-magic-sparkles' },
    { id: 'config', label: 'Config', icon: 'fa-gear' },
  ];

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <div 
          key={item.id}
          className={cn("mobile-nav-item", activeView === item.id && "active")}
          onClick={() => onViewChange(item.id)}
        >
          <i className={cn("fa-solid", item.icon)}></i>
          <span>{item.label}</span>
        </div>
      ))}
    </nav>
  );
}
