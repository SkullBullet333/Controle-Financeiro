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
  onOpenModal: (type: 'titular' | 'cartao' | 'profile') => void;
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

      <div className="sidebar-footer mt-auto mb-4 px-3 position-relative">
        {showPopup && (
          <div className="user-profile-popup shadow-lg border border-border rounded-4 p-3 mb-2" ref={popupRef}>
            <div className="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom border-light">
              <div className="position-relative" style={{ width: '48px', height: '48px' }}>
                <Image
                  src={user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome)}&background=4361ee&color=fff&bold=true`}
                  fill
                  unoptimized
                  className="rounded-circle object-fit-cover shadow-sm"
                  alt={user.nome}
                />
              </div>
              <div className="overflow-hidden">
                <div className="fw-bold text-truncate">{user.nome}</div>
                <div className="small text-muted text-truncate">{user.email}</div>
              </div>
            </div>

            <div className="popup-menu space-y-1">
              <button 
                className="w-100 text-start p-2 rounded-3 hover:bg-light transition-colors d-flex align-items-center gap-3 border-0 bg-transparent"
                onClick={() => onOpenModal('profile')}
              >
                <i className="fa-solid fa-user-gear text-primary w-4"></i>
                <span className="small fw-bold">Perfil</span>
              </button>

              <div className="w-100 p-2 rounded-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <i className="fa-solid fa-moon text-primary w-4"></i>
                  <span className="small fw-bold">Definições</span>
                </div>
                <div className="form-check form-switch m-0">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    checked={isDarkMode} 
                    onChange={toggleDarkMode}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div className="pt-2 pb-1">
                <span className="text-[10px] text-muted fw-bold text-uppercase px-2">Cadastros</span>
              </div>
              
              <button 
                className="w-100 text-start p-2 rounded-3 hover:bg-light transition-colors d-flex align-items-center gap-3 border-0 bg-transparent"
                onClick={() => onOpenModal('titular')}
              >
                <i className="fa-solid fa-user-plus text-muted w-4"></i>
                <span className="small">Titular</span>
              </button>
              
              <button 
                className="w-100 text-start p-2 rounded-3 hover:bg-light transition-colors d-flex align-items-center gap-3 border-0 bg-transparent"
                onClick={() => onOpenModal('cartao')}
              >
                <i className="fa-solid fa-credit-card text-muted w-4"></i>
                <span className="small">Cartões</span>
              </button>

              <div className="pt-2 pb-1 d-flex align-items-center justify-content-between px-2">
                <span className="text-[10px] text-muted fw-bold text-uppercase">Minha Família</span>
              </div>

              <div className="family-list mb-3 px-1" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {familyMembers.map((member) => (
                  <div key={member.id} className="d-flex align-items-center justify-content-between py-2 border-bottom border-light last:border-0">
                    <div className="d-flex align-items-center gap-2">
                      <div className="position-relative" style={{ width: '24px', height: '24px' }}>
                        <Image
                          src={member.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.nome)}&background=random&color=fff&bold=true`}
                          fill
                          unoptimized
                          className="rounded-circle object-fit-cover"
                          alt={member.nome}
                        />
                      </div>
                      <div className="small fw-bold text-truncate" style={{ maxWidth: '80px' }}>{member.nome}</div>
                    </div>
                    <span className={cn(
                      "badge rounded-pill",
                      member.tipo === 'titular' ? "bg-primary-subtle text-primary border border-primary-subtle" : "bg-light text-muted border border-light"
                    )} style={{ fontSize: '9px' }}>
                      {member.tipo === 'titular' ? 'Titular' : 'Membro'}
                    </span>
                  </div>
                ))}
              </div>

              {user.tipo === 'titular' && (
                <div className="input-group input-group-sm mb-2 shadow-sm border rounded-3 overflow-hidden">
                  <input 
                    type="email" 
                    className="form-control border-0 bg-light" 
                    placeholder="Convidar e-mail..."
                    style={{ fontSize: '11px' }}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <button 
                    className="btn btn-primary border-0 p-1 px-2"
                    onClick={() => { onInvite(inviteEmail); setInviteEmail(''); }}
                  >
                    <i className="fa-solid fa-paper-plane" style={{ fontSize: '10px' }}></i>
                  </button>
                </div>
              )}

              <button 
                className="w-100 text-start p-2 rounded-3 hover:bg-danger-subtle text-danger transition-colors d-flex align-items-center gap-3 border-0 bg-transparent mt-2 pt-3 border-top border-light"
                onClick={onLogout}
              >
                <i className="fa-solid fa-right-from-bracket w-4"></i>
                <span className="small fw-bold">Sair da Conta</span>
              </button>
            </div>
          </div>
        )}

        <div 
          className="user-profile-btn d-flex align-items-center gap-3 p-2 rounded-4 cursor-pointer hover:bg-light transition-all"
          onClick={() => setShowPopup(!showPopup)}
        >
          <div className="position-relative" style={{ width: '40px', height: '40px' }}>
            <Image
              src={user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome)}&background=4361ee&color=fff&bold=true`}
              fill
              unoptimized
              className="rounded-circle object-fit-cover shadow-sm"
              alt={user.nome}
            />
            <div className="online-indicator position-absolute bottom-0 end-0 bg-success rounded-circle border border-white" style={{ width: '10px', height: '10px' }}></div>
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
