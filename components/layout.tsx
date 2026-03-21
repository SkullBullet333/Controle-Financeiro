'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Vault } from 'lucide-react';

import { Profile } from '@/lib/types';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  user: Profile | null;
  familyMembers: Profile[];
  onLogout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onInvite: (email: string) => void;
  onUpdateProfile: (updates: Partial<Profile>) => void;
  onOpenModal: (type: 'titular' | 'cartao' | 'profile') => void;
}

const menuItems: { id: string, label: string, icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'despesas', label: 'Despesas Fixas', icon: 'payments' },
  { id: 'receitas', label: 'Minhas Receitas', icon: 'account_balance_wallet' },
  { id: 'cartoes', label: 'Cartões', icon: 'credit_card' },
  { id: 'periodo', label: 'Análise 8 Meses', icon: 'calendar_month' },
];

export function Sidebar({ 
  activeView, 
  onViewChange, 
  user, 
  familyMembers,
  onLogout,
  isDarkMode,
  toggleDarkMode,
  onInvite,
  onUpdateProfile,
  onOpenModal
}: SidebarProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <aside className="sidebar fixed left-0 top-0 h-full flex flex-col py-8 bg-surface-container-low w-64 z-50 transform -translate-x-full md:translate-x-0 transition-transform duration-300">
      <div className="px-8 mb-10">
        <span className="text-xl font-bold text-white tracking-tighter">FINANCEIRO</span>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id as any)}
            className={cn(
              "w-100 flex items-center gap-3 px-4 py-3 transition-all rounded-md border-0 bg-transparent text-start",
              activeView === item.id 
                ? "bg-surface-container-highest text-white border-l-2 border-white" 
                : "text-on-surface-variant hover:bg-surface-container/50"
            )}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="fw-semibold small">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer mt-auto mb-4 px-3 position-relative">
        {showPopup && (
          <div className="user-profile-popup shadow-2xl rounded-2xl p-4 mb-3 border border-outline-variant/10" ref={popupRef}>
            {/* Profile Header */}
            <div className="d-flex align-items-center gap-3 mb-4 p-2">
              <div className="position-relative" style={{ width: '48px', height: '48px' }}>
                <Image
                  src={user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome)}&background=454747&color=fff&bold=true`}
                  fill
                  unoptimized
                  className="rounded-circle object-fit-cover ring-2 ring-white/10"
                  alt={user.nome}
                />
              </div>
              <div className="overflow-hidden flex-1">
                <div className="fw-bold text-white text-truncate" style={{ fontSize: '14px' }}>{user.nome}</div>
                <div className="text-on-surface-variant text-truncate" style={{ fontSize: '11px' }}>{user.email}</div>
              </div>
            </div>

            {/* Premium CTA */}
            <button className="w-100 d-flex align-items-center justify-content-between gap-3 px-3 py-2 bg-gradient-to-r from-primary-container to-surface-container-highest text-black rounded-xl mb-4 border-0 transition-transform active:scale-95 group">
              <span className="fw-bold" style={{ fontSize: '12px' }}>Atualizar plano</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </button>

            {/* Menu Links */}
            <div className="popup-menu space-y-1">
              <button 
                className="w-100 text-start px-3 py-2 rounded-lg hover:bg-white/10 transition-colors d-flex align-items-center gap-3 border-0 bg-transparent text-on-surface group"
                onClick={() => onOpenModal('profile')}
              >
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-white" style={{ fontSize: '20px' }}>person</span>
                <span className="small fw-medium">Meu Perfil</span>
              </button>

              <div className="w-100 px-3 py-2 rounded-lg d-flex align-items-center justify-content-between text-on-surface hover:bg-white/10 transition-colors group">
                <div className="d-flex align-items-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-white" style={{ fontSize: '20px' }}>palette</span>
                  <span className="small fw-medium">Definições</span>
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

              <div className="pt-2 pb-1 px-3">
                <span className="fw-bold text-on-surface-variant" style={{ fontSize: '9px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cadastros</span>
              </div>
              
              <button 
                className="w-100 text-start px-3 py-2 rounded-lg hover:bg-white/10 transition-colors d-flex align-items-center gap-3 border-0 bg-transparent text-on-surface group"
                onClick={() => onOpenModal('titular')}
              >
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-white" style={{ fontSize: '20px' }}>person_add</span>
                <span className="small fw-medium">Titular</span>
              </button>
              
              <button 
                className="w-100 text-start px-3 py-2 rounded-lg hover:bg-white/10 transition-colors d-flex align-items-center gap-3 border-0 bg-transparent text-on-surface group"
                onClick={() => onOpenModal('cartao')}
              >
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-white" style={{ fontSize: '20px' }}>credit_card</span>
                <span className="small fw-medium">Cartões</span>
              </button>

              <div className="pt-2 pb-1 px-3 d-flex align-items-center justify-content-between">
                <span className="fw-bold text-on-surface-variant" style={{ fontSize: '9px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Minha Família</span>
              </div>

              <div className="family-list mb-3 px-1" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                {familyMembers.map((member) => (
                  <div key={member.id} className="d-flex align-items-center justify-content-between py-2 px-2 rounded-lg hover:bg-white/5 transition-colors">
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
                      <div className="text-white fw-bold text-truncate" style={{ maxWidth: '80px', fontSize: '11px' }}>{member.nome}</div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-bold",
                      member.tipo === 'titular' ? "bg-white text-black" : "bg-surface-container-highest text-on-surface-variant"
                    )} style={{ fontSize: '8px', textTransform: 'uppercase' }}>
                      {member.tipo === 'titular' ? 'Titular' : 'Membro'}
                    </span>
                  </div>
                ))}
              </div>

              {user.tipo === 'titular' && (
                <div className="input-group input-group-sm mb-2 p-1 bg-surface-container-high rounded-xl border border-outline-variant/20">
                  <input 
                    type="email" 
                    className="form-control border-0 bg-transparent text-white" 
                    placeholder="Convidar e-mail..."
                    style={{ fontSize: '11px' }}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <button 
                    className="btn btn-white text-black rounded-lg p-0 flex items-center justify-center"
                    style={{ width: '28px', height: '28px' }}
                    onClick={() => { onInvite(inviteEmail); setInviteEmail(''); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                  </button>
                </div>
              )}

              <div className="h-[1px] bg-outline-variant/20 my-3 mx-1"></div>

              <button 
                className="w-100 text-start px-3 py-2 rounded-lg hover:bg-error/10 text-error transition-colors d-flex align-items-center gap-3 border-0 bg-transparent group"
                onClick={onLogout}
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="small fw-bold">Sair da Conta</span>
              </button>
            </div>
          </div>
        )}

        <div 
          className="user-profile-btn flex items-center gap-3 p-3 bg-surface-container-high rounded-xl cursor-pointer hover:bg-surface-container-highest transition-all group border border-outline-variant/10 shadow-lg"
          onClick={() => setShowPopup(!showPopup)}
        >
          <div className="position-relative" style={{ width: '40px', height: '40px' }}>
            <Image
              src={user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome)}&background=454747&color=fff&bold=true`}
              fill
              unoptimized
              className="rounded-circle object-fit-cover shadow-sm ring-1 ring-white/10"
              alt={user.nome}
            />
            <div className="online-indicator position-absolute bottom-0 end-0 bg-success rounded-circle border-2 border-surface-container-high" style={{ width: '12px', height: '12px' }}></div>
          </div>
          <div className="sidebar-user-info overflow-hidden flex-1">
            <div className="fw-bold text-white text-truncate" style={{ fontSize: '14px' }}>{user.nome}</div>
            <div className="text-on-surface-variant text-truncate" style={{ fontSize: '11px' }}>
              {user.tipo === 'titular' ? 'Titular' : 'Membro'}
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-white transition-colors">unfold_more</span>
        </div>
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
  onOpenProfile?: () => void;
}

export function Topbar({ title, month, year, onChangeMonth, onOpenPeriodModal, onLogout }: TopbarProps) {
  const getTitle = () => {
    switch (title) {
      case 'dashboard': return 'Dashboard';
      case 'despesas': return 'Despesas Fixas';
      case 'receitas': return 'Receitas';
      case 'cartoes': return 'Cartões';
      case 'periodo': return 'Análise';
      default: return title;
    }
  };

  return (
    <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 bg-[#131313]/80 backdrop-blur-xl z-40 shadow-2xl shadow-black/40 border-b border-outline-variant/10">
      <div className="flex items-center gap-4">
        <button className="hover:bg-[#353535] rounded-full p-2 transition-all border-0 bg-transparent text-white flex items-center justify-center">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="font-['Inter'] text-sm tracking-widest uppercase font-medium text-white m-0">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant/20">
        <button 
          className="p-1 hover:bg-white/10 rounded-full transition-all border-0 bg-transparent text-on-surface-variant hover:text-white flex items-center"
          onClick={() => onChangeMonth(-1)}
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        
        <div 
          className="px-3 font-bold text-white uppercase cursor-pointer hover:text-primary transition-colors flex items-center gap-2" 
          style={{ fontSize: '11px' }}
          onClick={onOpenPeriodModal}
        >
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_month</span>
          {format(new Date(year, month - 1), 'MMMM yyyy', { locale: ptBR })}
        </div>

        <button 
          className="p-1 hover:bg-white/10 rounded-full transition-all border-0 bg-transparent text-on-surface-variant hover:text-white flex items-center"
          onClick={() => onChangeMonth(1)}
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
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
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'despesas', label: 'Fixas', icon: 'payments' },
    { id: 'cartoes', label: 'Cartões', icon: 'credit_card' },
    { id: 'receitas', label: 'Receitas', icon: 'account_balance_wallet' },
    { id: 'periodo', label: 'Análise', icon: 'calendar_month' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-surface-container-low/95 backdrop-blur-xl border-t border-outline-variant/10 px-4 py-2 flex justify-around items-center z-50">
      {navItems.map((item) => (
        <button 
          key={item.id}
          className={cn(
            "flex flex-col items-center gap-1 border-0 bg-transparent transition-all",
            activeView === item.id ? "text-white" : "text-on-surface-variant"
          )}
          onClick={() => onViewChange(item.id)}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeView === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
