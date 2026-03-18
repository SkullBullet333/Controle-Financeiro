'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  user: { nome: string; foto?: string };
  onLogout?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

export function Sidebar({ activeView, onViewChange, user, onLogout, onHoverChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-house' },
    { id: 'geral', label: 'Despesas Fixas', icon: 'fa-clipboard-list' },
    { id: 'cartoes', label: 'Cartões', icon: 'fa-credit-card' },
    { id: 'receitas', label: 'Receitas', icon: 'fa-money-bill-wave' },
    { id: 'radar', label: 'Radar Financeiro', icon: 'fa-wand-magic-sparkles' },
  ];

  return (
    <nav 
      className="sidebar"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <div className="logo mt-4 mb-2 d-flex align-items-center gap-3" style={{ paddingLeft: '5px' }}>
        {user.foto ? (
          <div className="relative w-12 h-12 shrink-0">
            <Image 
              src={user.foto} 
              alt={user.nome}
              fill
              className="sidebar-user-img"
              referrerPolicy="no-referrer"
              unoptimized
            />
          </div>
        ) : (
          <i className="fa-solid fa-money-bill-trend-up text-primary" style={{ fontSize: '1.8rem' }}></i>
        )}
        <span className="sidebar-user-name fw-bold fs-5">FinanceBox</span>
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

      <ul className="menu mt-auto mb-4">
        <li 
          className={cn(activeView === 'config' && "active")}
          onClick={() => onViewChange('config')}
          title="Configurações"
        >
          <i className="fa-solid fa-gear"></i>
          <span>Configurações</span>
        </li>
        <li 
          onClick={onLogout}
          title="Sair"
          style={{ color: 'var(--danger)' }}
        >
          <i className="fa-solid fa-right-from-bracket"></i>
          <span>Sair</span>
        </li>
      </ul>
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
        <div className="controls">
          <button onClick={() => onChangeMonth(-1)}><i className="fa-solid fa-chevron-left"></i></button>
          <div 
            className="date-display mx-3" 
            title="Clique para selecionar o período"
            onClick={onOpenPeriodModal}
          >
            <span id="lblMes">{months[month - 1]}</span> <span id="lblAno">{year}</span>
          </div>
          <button onClick={() => onChangeMonth(1)}><i className="fa-solid fa-chevron-right"></i></button>
        </div>
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
