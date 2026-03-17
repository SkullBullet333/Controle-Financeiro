'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  LayoutDashboard, 
  ClipboardList, 
  CreditCard, 
  HandCoins, 
  Sparkles, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Wallet,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  user: { nome: string; foto?: string };
  onLogout?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

export function Sidebar({ activeView, onViewChange, user, onLogout, onHoverChange }: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleHover = (hovered: boolean) => {
    setIsHovered(hovered);
    onHoverChange?.(hovered);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'geral', label: 'Despesas Fixas', icon: ClipboardList },
    { id: 'cartoes', label: 'Cartões', icon: CreditCard },
    { id: 'receitas', label: 'Receitas', icon: HandCoins },
    { id: 'radar', label: 'Radar Financeiro', icon: Sparkles },
  ];

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-border z-50 transition-all duration-300 ease-in-out flex flex-col",
        isHovered ? "w-64 shadow-2xl" : "w-20"
      )}
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
    >
      {/* User Profile Section */}
      <div className="p-4 mb-4 flex items-center gap-3 overflow-hidden">
        <div className="relative w-12 h-12 shrink-0">
          <Image 
            src={user.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome)}&background=random&color=fff&bold=true`} 
            alt={user.nome}
            fill
            className="rounded-full border-2 border-primary/20 object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className={cn(
          "transition-opacity duration-200 whitespace-nowrap",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <p className="text-xs text-gray-500 font-medium">Olá,</p>
          <p className="font-black text-text text-lg">{user.nome}!</p>
        </div>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200",
                  activeView === item.id 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-gray-400 hover:bg-gray-50 hover:text-text"
                )}
              >
                <item.icon className={cn("w-6 h-6 shrink-0", activeView === item.id ? "text-white" : "text-gray-400")} />
                <span className={cn(
                  "font-bold text-sm transition-opacity duration-200 whitespace-nowrap",
                  isHovered ? "opacity-100" : "opacity-0"
                )}>
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 space-y-1">
        <button
          onClick={() => onViewChange('config')}
          className={cn(
            "w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200",
            activeView === 'config' 
              ? "bg-primary text-white shadow-lg shadow-primary/20" 
              : "text-gray-400 hover:bg-gray-50 hover:text-text"
          )}
        >
          <Settings className={cn("w-6 h-6 shrink-0", activeView === 'config' ? "text-white" : "text-gray-400")} />
          <span className={cn(
            "font-bold text-sm transition-opacity duration-200 whitespace-nowrap",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            Configurações
          </span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 text-danger hover:bg-danger/10"
        >
          <LogOut className="w-6 h-6 shrink-0" />
          <span className={cn(
            "font-bold text-sm transition-opacity duration-200 whitespace-nowrap",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            Sair
          </span>
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
}

export function Topbar({ title, month, year, onChangeMonth, onSetMonth, onSetYear }: TopbarProps & { onSetMonth?: (m: number) => void, onSetYear?: (y: number) => void }) {
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <h1 className="text-2xl md:text-3xl font-black text-text flex items-center gap-3">
        {title === 'dashboard' && <LayoutDashboard className="text-primary w-8 h-8" />}
        {title === 'geral' && <ClipboardList className="text-primary w-8 h-8" />}
        {title === 'cartoes' && <CreditCard className="text-primary w-8 h-8" />}
        {title === 'receitas' && <HandCoins className="text-primary w-8 h-8" />}
        {title === 'radar' && <Sparkles className="text-primary w-8 h-8" />}
        {title === 'config' && <Settings className="text-primary w-8 h-8" />}
        {title === 'geral' ? 'Despesas Fixas' : title === 'cartoes' ? 'Meus Cartões' : title === 'receitas' ? 'Minhas Receitas' : title === 'dashboard' ? 'Dashboard Financeiro' : title}
      </h1>
      
      <div className="flex items-center gap-2 bg-white border border-border rounded-2xl p-1 shadow-sm relative">
        <button 
          onClick={() => onChangeMonth(-1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div 
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          className="px-4 py-2 flex items-center gap-3 font-black text-text cursor-pointer hover:bg-gray-50 rounded-xl transition-all"
        >
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm uppercase tracking-widest">{months[month - 1]} {year}</span>
        </div>

        {isPickerOpen && (
          <div className="absolute top-full right-0 mt-2 bg-white border border-border rounded-3xl shadow-2xl p-6 z-[100] w-80 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={(e) => { e.stopPropagation(); onSetYear?.(year - 1); }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-black text-xl text-text">{year}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onSetYear?.(year + 1); }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {months.map((m, idx) => (
                <button
                  key={m}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetMonth?.(idx + 1);
                    setIsPickerOpen(false);
                  }}
                  className={cn(
                    "p-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-transparent",
                    month === idx + 1 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "hover:bg-gray-50 text-gray-600 hover:border-border"
                  )}
                >
                  {m.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}

        <button 
          onClick={() => onChangeMonth(1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
