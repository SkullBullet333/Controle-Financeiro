'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Profile, Titular, CartaoConfig, CartaoTransacao, Despesa, ContaFixaConfig } from '@/lib/types';
import { Modal, TitularForm, CartaoForm, StyledDatePicker } from './modals';
import { CardLogo } from './card-ui';

const PRESET_CARDS_STYLE = [
  { name: 'Sicoob Clássico', color: '#00AE9A' },
  { name: 'Sicoob Platinum', color: '#00353E' },
  { name: 'Mercado Pago', color: '#222A37' },
  { name: 'Inter', color: '#FF5100' },
  { name: 'Nubank', color: '#6834AE' }
];

interface SettingsViewProps {
  user: Profile | null;
  isDarkMode: boolean;
  themeMode: 'light' | 'dark' | 'black';
  toggleDarkMode: () => void;
  setThemeMode: (mode: 'light' | 'dark' | 'black') => void;
  themeColor?: string;
  setThemeColor?: (color: string) => void;
  familyMembers: Profile[];
  onInvite: (email: string) => void;
  userType: 'titular' | 'membro';
  titulares: Titular[];
  cartoes: CartaoConfig[];
  cartaoTransacoes?: CartaoTransacao[];
  despesas?: Despesa[];
  contasFixas?: ContaFixaConfig[];
  onAddTitular: (t: Omit<Titular, 'id'>) => Promise<void> | void;
  onUpdateTitular: (id: number, t: Partial<Titular>) => Promise<void> | void;
  onDeleteTitular: (id: number) => void;
  onAddCartao: (c: Omit<CartaoConfig, 'id'>) => Promise<void> | void;
  onUpdateCartao: (id: number, c: Partial<CartaoConfig>) => Promise<void> | void;
  onDeleteCartao: (id: number) => void;
  onRenameCategory?: (oldCat: string, newCat: string) => Promise<any> | void;
  onUpdateCategoryByDescription?: (descricao: string, newCat: string) => Promise<any> | void;
  onUpdateCardCategoryByEstablishment?: (estabelecimento: string, newCat: string) => Promise<any> | void;
  isMobile?: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onCloseSettings?: () => void;
  lembretes?: { id: number; texto: string; concluido: boolean; data?: string }[];
  onAddLembrete?: (texto: string, data?: string) => void;
  onToggleLembrete?: (id: number) => void;
  onDeleteLembrete?: (id: number) => void;
  avisosConfig?: { vencidas: boolean; hoje: boolean; radar: boolean };
  onUpdateAvisosConfig?: (key: 'vencidas' | 'hoje' | 'radar', value: boolean) => void;
}

export function SettingsView({
  user,
  themeMode = 'black',
  setThemeMode,
  themeColor = '#00AE9A',
  setThemeColor,
  familyMembers = [],
  onInvite,
  userType,
  titulares = [],
  cartoes = [],
  cartaoTransacoes = [],
  despesas = [],
  contasFixas = [],
  onAddTitular,
  onUpdateTitular,
  onDeleteTitular,
  onAddCartao,
  onUpdateCartao,
  onDeleteCartao,
  onRenameCategory,
  onUpdateCategoryByDescription,
  onUpdateCardCategoryByEstablishment,
  lembretes = [],
  onAddLembrete,
  onToggleLembrete,
  onDeleteLembrete,
  avisosConfig = { vencidas: true, hoje: true, radar: false },
  onUpdateAvisosConfig
}: SettingsViewProps) {
  const canManageSharedSettings = userType === 'titular';
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Sub-modal states for Titular & Cartão
  const [isTitularModalOpen, setIsTitularModalOpen] = useState(false);
  const [editingTitular, setEditingTitular] = useState<Titular | null>(null);

  const [isCartaoModalOpen, setIsCartaoModalOpen] = useState(false);
  const [editingCartao, setEditingCartao] = useState<CartaoConfig | null>(null);

  // Reminder input states
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');

  // Category Management states
  const [selectedCategoryForDetails, setSelectedCategoryForDetails] = useState<string | null>(null);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [renamingCategory, setRenamingCategory] = useState<{ oldName: string; newName: string } | null>(null);
  const [isRenamingSaving, setIsRenamingSaving] = useState(false);
  const [categoryOperationError, setCategoryOperationError] = useState<string | null>(null);
  const [categorySource, setCategorySource] = useState<'despesas' | 'cartoes'>('despesas');
  const [creatingCardCategoryFor, setCreatingCardCategoryFor] = useState<string | null>(null);
  const [newCardCategoryName, setNewCardCategoryName] = useState('');

  // Category stats calculation
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};

    if (categorySource === 'cartoes') {
      cartaoTransacoes.forEach(transaction => {
        const category = transaction.categoria?.trim() || 'Outros';
        counts[category] = (counts[category] || 0) + 1;
      });
    } else {
      despesas.forEach(d => {
        const c = d.categoria?.trim();
        if (c) {
          counts[c] = (counts[c] || 0) + 1;
        }
      });

      contasFixas.forEach(f => {
        if (f.categoria) {
          const c = f.categoria.trim();
          if (c) {
            counts[c] = (counts[c] || 0) + 1;
          }
        }
      });
    }

    if (Object.keys(counts).length === 0) {
      const defaults = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Compras', 'Mercado', 'Outros'];
      defaults.forEach(d => { counts[d] = 0; });
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [despesas, contasFixas, cartaoTransacoes, categorySource]);

  // Grouped descriptions for selected category
  const groupedDescriptions = useMemo(() => {
    if (!selectedCategoryForDetails) return [];
    const descMap = new Map<string, { desc: string; count: number; currentCat: string }>();

    despesas.forEach(d => {
      const catName = d.categoria?.trim() || 'OUTROS';
      const matchCat = catName.toUpperCase() === selectedCategoryForDetails.toUpperCase() || catName === selectedCategoryForDetails;
      if (matchCat && d.descricao?.trim()) {
        const desc = d.descricao.trim();
        const key = desc.toLowerCase();
        const existing = descMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          descMap.set(key, { desc, count: 1, currentCat: d.categoria || selectedCategoryForDetails });
        }
      }
    });

    contasFixas.forEach(f => {
      const catName = f.categoria?.trim() || 'OUTROS';
      const matchCat = catName.toUpperCase() === selectedCategoryForDetails.toUpperCase() || catName === selectedCategoryForDetails;
      if (matchCat && f.descricao?.trim()) {
        const desc = f.descricao.trim();
        const key = desc.toLowerCase();
        const existing = descMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          descMap.set(key, { desc, count: 1, currentCat: f.categoria || selectedCategoryForDetails });
        }
      }
    });

    return Array.from(descMap.values())
      .filter(item => {
        if (!categorySearchTerm) return true;
        return item.desc.toLowerCase().includes(categorySearchTerm.toLowerCase());
      })
      .sort((a, b) => b.count - a.count || a.desc.localeCompare(b.desc));
  }, [selectedCategoryForDetails, despesas, contasFixas, categorySearchTerm]);

  const groupedCardTransactions = useMemo(() => {
    if (!selectedCategoryForDetails || categorySource !== 'cartoes') return [];
    const matching = cartaoTransacoes
      .filter(transaction => {
        const category = transaction.categoria?.trim() || 'Outros';
        const matchesCategory = category.toUpperCase() === selectedCategoryForDetails.toUpperCase();
        const matchesSearch = !categorySearchTerm || (transaction.estabelecimento || '').toLowerCase().includes(categorySearchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      });
    const grouped = new Map<string, { estabelecimento: string; count: number; total: number; latestDate: string; categories: Set<string> }>();
    matching.forEach(transaction => {
      const establishment = transaction.estabelecimento?.trim() || 'Sem estabelecimento';
      const key = establishment.toLocaleLowerCase('pt-BR');
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        existing.total += Number(transaction.valor) || 0;
        if (transaction.data_compra > existing.latestDate) existing.latestDate = transaction.data_compra;
        existing.categories.add(transaction.categoria?.trim() || 'Outros');
      } else {
        grouped.set(key, {
          estabelecimento: establishment,
          count: 1,
          total: Number(transaction.valor) || 0,
          latestDate: transaction.data_compra,
          categories: new Set([transaction.categoria?.trim() || 'Outros'])
        });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => a.estabelecimento.localeCompare(b.estabelecimento));
  }, [selectedCategoryForDetails, cartaoTransacoes, categorySearchTerm, categorySource]);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      onInvite(inviteEmail.trim());
      setInviteEmail('');
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    }
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newReminderText.trim()) {
      onAddLembrete?.(newReminderText.trim(), newReminderDate || undefined);
      setNewReminderText('');
      setNewReminderDate('');
    }
  };

  const handleRenameCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingCategory || !renamingCategory.newName.trim()) return;
    setIsRenamingSaving(true);
    setCategoryOperationError(null);
    try {
      if (onRenameCategory) {
        await onRenameCategory(renamingCategory.oldName, renamingCategory.newName.trim());
      }
      setRenamingCategory(null);
    } catch {
      setCategoryOperationError('Não foi possível concluir a alteração. Confira os dados exibidos e tente novamente.');
    } finally {
      setIsRenamingSaving(false);
    }
  };

  const primaryColors = [
    { name: 'Emerald Teal', color: '#10b981' },
    { name: 'Sicoob Teal', color: '#00AE9A' },
    { name: 'Neon Purple', color: '#8b5cf6' },
    { name: 'Royal Blue', color: '#3b82f6' },
    { name: 'Amber Gold', color: '#f59e0b' },
    { name: 'Coral Pink', color: '#ec4899' },
    { name: 'Cyan Blue', color: '#06b6d4' },
    { name: 'Navy Blue', color: '#4361ee' }
  ];

  type SectionId = 'tema' | 'membros' | 'titulares' | 'cartoes' | 'categorias' | 'avisos';
  const [activeSection, setActiveSection] = useState<SectionId>('tema');

  const SECTIONS = useMemo(() => [
    {
      id: 'tema' as SectionId,
      label: 'Tema e Identidade Visual',
      icon: 'fa-palette',
      color: 'text-amber-500 bg-amber-500/10'
    },
    {
      id: 'membros' as SectionId,
      label: 'Membros & Compartilhamento',
      icon: 'fa-users',
      color: 'text-pink-500 bg-pink-500/10'
    },
    {
      id: 'titulares' as SectionId,
      label: 'Titulares Cadastrados',
      icon: 'fa-id-badge',
      color: 'text-cyan-500 bg-cyan-500/10'
    },
    {
      id: 'cartoes' as SectionId,
      label: 'Meus Cartões & Faturas',
      icon: 'fa-credit-card',
      color: 'text-purple-500 bg-purple-500/10'
    },
    {
      id: 'categorias' as SectionId,
      label: 'Gerenciamento de Categorias',
      icon: 'fa-tags',
      color: 'text-emerald-500 bg-emerald-500/10'
    },
    {
      id: 'avisos' as SectionId,
      label: 'Avisos & Lembretes',
      icon: 'fa-bell',
      color: 'text-orange-500 bg-orange-500/10'
    },
  ], []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Layout Master-Detail: Lista de Categorias à Esquerda e Formulário Dedicado à Direita */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Menu Lateral Unificado e Arredondado */}
        <div 
          className="w-full lg:w-80 flex-shrink-0 bg-card border border-border rounded-3xl p-3 space-y-1.5 shadow-xs"
          style={{ borderRadius: '24px' }}
        >
          <div className="px-3 pt-2 pb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-foreground opacity-90">
              Categorias de Ajustes
            </span>
          </div>

          {SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  "w-full text-left p-3 rounded-2xl transition-all d-flex align-items-center justify-content-between gap-3 cursor-pointer group border-0",
                  isActive
                    ? "text-white shadow-md font-bold scale-[1.01]"
                    : "bg-transparent hover:bg-[var(--card-hover)] text-foreground/80 hover:text-foreground"
                )}
                style={{
                  borderRadius: '16px',
                  backgroundColor: isActive ? (themeColor || '#00AE9A') : undefined,
                  boxShadow: isActive ? `0 4px 14px -2px ${themeColor || '#00AE9A'}60` : undefined
                }}
              >
                <div className="d-flex align-items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-9 h-9 rounded-xl d-flex align-items-center justify-content-center flex-shrink-0 transition-transform group-hover:scale-105",
                    isActive ? "bg-white/20 text-white" : "bg-transparent text-muted group-hover:text-foreground"
                  )}>
                    <i className={cn("fa-solid text-sm", sec.icon)}></i>
                  </div>
                  <span className={cn(
                    "text-xs truncate transition-colors",
                    isActive ? "text-white font-black" : "text-foreground font-bold group-hover:text-primary"
                  )}>
                    {sec.label}
                  </span>
                </div>

                <i className={cn(
                  "fa-solid fa-chevron-right text-xs transition-transform flex-shrink-0",
                  isActive ? "text-white translate-x-0.5" : "text-muted/40 group-hover:text-muted"
                )}></i>
              </button>
            );
          })}
        </div>

        {/* Painel Central: Exibição Individual da Seção Selecionada com Bordas Nítidas e Multicolunas */}
        <div className="w-full flex-1 min-w-0">
          
          {/* =========================================================
              CARD 1: TEMA E IDENTIDADE VISUAL
              ========================================================= */}
          {activeSection === 'tema' && (
            <div 
              className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-200"
              style={{ borderRadius: '24px' }}
            >
              <div className="border-b border-border pb-4">
                <h3 className="panel-title text-lg font-black d-flex align-items-center gap-2.5 m-0">
                  <i className="fa-solid fa-palette text-amber-500"></i>
                  <span>Tema e Identidade Visual</span>
                </h3>
                <span className="text-xs text-muted block mt-1">
                  Personalize o esquema de cores e o modo de exibição preferido da sua aplicação
                </span>
              </div>

              {/* Modo de Exibição em Grade com Pré-visualizações Visuais Suaves */}
              <div className="space-y-4">
                <div className="d-flex align-items-center justify-content-between">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    Modo de Exibição (Tema)
                  </label>
                  <span className="text-[11px] text-primary font-bold">
                    {themeMode === 'black' ? 'Midnight Black Ativo' : themeMode === 'dark' ? 'Dark Deep Ativo' : 'Light Mode Ativo'}
                  </span>
                </div>

                {/* Grade de 3 Cards com Pré-visualização Real */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  
                  {/* Card 1: Midnight Black (OLED) */}
                  <div
                    onClick={() => setThemeMode('black')}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between group",
                      themeMode === 'black'
                        ? "bg-[var(--card-hover)] border-primary ring-2 ring-primary/40 shadow-md"
                        : "bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border-border hover:border-primary/40"
                    )}
                  >
                    {/* Mini tela simulada OLED */}
                    <div className="rounded-xl p-2.5 mb-3" style={{ backgroundColor: '#030305', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor || '#00AE9A' }}></div>
                          <div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                        </div>
                        <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                      </div>
                      <div className="rounded-lg p-2 mb-1.5" style={{ backgroundColor: '#0f1016', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="w-10 h-1.5 rounded mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}></div>
                        <div className="text-[10px] font-mono font-black" style={{ color: themeColor || '#00AE9A' }}>R$ 14.850</div>
                      </div>
                      <div className="d-flex gap-1">
                        <div className="flex-1 h-1.5 rounded-full bg-emerald-500/40"></div>
                        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="font-black text-xs text-foreground">Midnight Black</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full border d-flex align-items-center justify-content-center text-[10px]",
                          themeMode === 'black' ? "bg-primary border-primary text-white" : "border-border"
                        )}>
                          {themeMode === 'black' && <i className="fa-solid fa-check"></i>}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted block mt-0.5 leading-tight">Preto absoluto OLED de alto contraste</span>
                    </div>
                  </div>

                  {/* Card 2: Dark Deep (Azul Noturno) */}
                  <div
                    onClick={() => setThemeMode('dark')}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between group",
                      themeMode === 'dark'
                        ? "bg-[var(--card-hover)] border-primary ring-2 ring-primary/40 shadow-md"
                        : "bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border-border hover:border-primary/40"
                    )}
                  >
                    {/* Mini tela simulada Dark Deep */}
                    <div className="rounded-xl p-2.5 mb-3" style={{ backgroundColor: '#0b0f19', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor || '#00AE9A' }}></div>
                          <div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                        </div>
                        <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                      </div>
                      <div className="rounded-lg p-2 mb-1.5" style={{ backgroundColor: '#131d31', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="w-10 h-1.5 rounded mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}></div>
                        <div className="text-[10px] font-mono font-black" style={{ color: themeColor || '#00AE9A' }}>R$ 14.850</div>
                      </div>
                      <div className="d-flex gap-1">
                        <div className="flex-1 h-1.5 rounded-full bg-blue-500/40"></div>
                        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="font-black text-xs text-foreground">Dark Deep</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full border d-flex align-items-center justify-content-center text-[10px]",
                          themeMode === 'dark' ? "bg-primary border-primary text-white" : "border-border"
                        )}>
                          {themeMode === 'dark' && <i className="fa-solid fa-check"></i>}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted block mt-0.5 leading-tight">Azul noturno elegante e suave</span>
                    </div>
                  </div>

                  {/* Card 3: Light Mode (Claro) */}
                  <div
                    onClick={() => setThemeMode('light')}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between group",
                      themeMode === 'light'
                        ? "bg-[var(--card-hover)] border-primary ring-2 ring-primary/40 shadow-md"
                        : "bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border-border hover:border-primary/40"
                    )}
                  >
                    {/* Mini tela simulada Light Mode */}
                    <div className="rounded-xl p-2.5 mb-3" style={{ backgroundColor: '#f1f5f9', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor || '#00AE9A' }}></div>
                          <div className="w-8 h-1.5 rounded-full bg-slate-300"></div>
                        </div>
                        <div className="w-3 h-1.5 rounded-full bg-slate-200"></div>
                      </div>
                      <div className="rounded-lg p-2 mb-1.5" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}>
                        <div className="w-10 h-1.5 rounded bg-slate-200 mb-1"></div>
                        <div className="text-[10px] font-mono font-black text-slate-800">R$ 14.850</div>
                      </div>
                      <div className="d-flex gap-1">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-300"></div>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200"></div>
                      </div>
                    </div>

                    <div>
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="font-black text-xs text-foreground">Light Mode</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full border d-flex align-items-center justify-content-center text-[10px]",
                          themeMode === 'light' ? "bg-primary border-primary text-white" : "border-border"
                        )}>
                          {themeMode === 'light' && <i className="fa-solid fa-check"></i>}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted block mt-0.5 leading-tight">Claro minimalista e moderno</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Seção Cor de Destaque */}
              <div className="p-4 bg-[var(--card-hover)] border border-border rounded-2xl space-y-4">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Cor Primária de Destaque
                </label>

                {/* Grade de Cores Rápidas */}
                <div className="d-flex align-items-center gap-2.5 flex-wrap">
                  {primaryColors.map((c) => {
                    const isSelected = themeColor?.toLowerCase() === c.color.toLowerCase();
                    return (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setThemeColor?.(c.color)}
                        className={cn(
                          "rounded-full transition-all cursor-pointer relative d-flex align-items-center justify-content-center",
                          isSelected ? "scale-110 ring-2 ring-white shadow-md" : "hover:scale-105 opacity-85 hover:opacity-100"
                        )}
                        style={{
                          width: '34px',
                          height: '34px',
                          backgroundColor: c.color,
                          border: '2px solid rgba(255,255,255,0.25)'
                        }}
                        title={c.name}
                      >
                        {isSelected && <i className="fa-solid fa-check text-white text-xs"></i>}
                      </button>
                    );
                  })}
                </div>

                {/* Seletor Customizado HEX */}
                <div className="d-flex align-items-center justify-content-between gap-3 pt-3 border-t border-border">
                  <div className="d-flex align-items-center gap-2.5">
                    <div 
                      className="w-9 h-9 rounded-xl border border-border shadow-xs relative overflow-hidden flex-shrink-0 cursor-pointer"
                      style={{ backgroundColor: themeColor || '#00AE9A' }}
                    >
                      <input
                        type="color"
                        value={themeColor?.startsWith('#') && themeColor.length === 7 ? themeColor : '#00AE9A'}
                        onChange={(e) => setThemeColor?.(e.target.value)}
                        className="position-absolute opacity-0 inset-0 w-100 h-100 cursor-pointer"
                        title="Clique para abrir o seletor de cor"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block leading-tight">HEX Personalizado</span>
                      <span className="text-[10px] text-muted">Clique no quadrado ou digite o código</span>
                    </div>
                  </div>

                  <div className="d-flex align-items-center bg-card border border-border rounded-xl px-2.5 py-1.5" style={{ width: '115px' }}>
                    <span className="text-xs text-muted font-mono me-1">#</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={(themeColor || '').replace(/^#/, '')}
                      onChange={(e) => {
                        const hexOnly = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                        setThemeColor?.('#' + hexOnly);
                      }}
                      placeholder="00AE9A"
                      className="form-control border-0 p-0 shadow-none bg-transparent text-xs font-mono font-bold text-foreground w-100 uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              CARD 2: MEMBROS & COMPARTILHAMENTO FAMILIAR
              ========================================================= */}
          {activeSection === 'membros' && (
            <div 
              className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-200"
              style={{ borderRadius: '24px' }}
            >
              <div className="border-b border-border pb-4">
                <h3 className="panel-title text-lg font-black d-flex align-items-center gap-2.5 m-0">
                  <i className="fa-solid fa-users text-pink-500"></i>
                  <span>Membros & Compartilhamento Familiar</span>
                </h3>
                <span className="text-xs text-muted block mt-1">
                  Gerencie as pessoas que possuem acesso conjunto a este ambiente financeiro
                </span>
              </div>

              <div className="space-y-4">
                {/* Lista de Membros em Grid Multicolunas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Usuário Logado */}
                  <div className="d-flex align-items-center justify-content-between p-3.5 bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border border-border rounded-2xl transition-all">
                    <div className="d-flex align-items-center gap-3 min-w-0">
                      <div 
                        className="avatar d-flex align-items-center justify-content-center rounded-full text-white font-bold text-xs flex-shrink-0"
                        style={{ width: '38px', height: '38px', background: themeColor || '#00AE9A' }}
                      >
                        {user?.nome ? user.nome.slice(0, 2).toUpperCase() : 'EU'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">{user?.nome || 'Usuário Atual'}</div>
                        <div className="text-[10px] text-muted truncate">{user?.email || 'email@exemplo.com'}</div>
                      </div>
                    </div>
                    <span className="badge-tag badge-paid text-[10px] flex-shrink-0 ms-2">Titular</span>
                  </div>

                  {/* Membros Adicionais */}
                  {familyMembers.map((m) => (
                    <div key={m.id} className="d-flex align-items-center justify-content-between p-3.5 bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border border-border rounded-2xl transition-all">
                      <div className="d-flex align-items-center gap-3 min-w-0">
                        <div 
                          className="avatar d-flex align-items-center justify-content-center rounded-full text-white font-bold text-xs flex-shrink-0"
                          style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
                        >
                          {m.nome ? m.nome.slice(0, 2).toUpperCase() : 'MB'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-foreground truncate">{m.nome}</div>
                          <div className="text-[10px] text-muted truncate">{m.email}</div>
                        </div>
                      </div>
                      <span className="badge-tag badge-pending text-[10px] flex-shrink-0 ms-2">Membro</span>
                    </div>
                  ))}
                </div>

                {/* Convidar Novo Membro */}
                <form onSubmit={handleSendInvite} className="pt-4 border-t border-border">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
                    Convidar Novo Membro por E-mail
                  </label>
                  <div className="d-flex gap-2.5 max-w-xl">
                    <input
                      type="email"
                      placeholder="digite.email@exemplo.com"
                      className="w-full bg-card border border-border rounded-xl text-xs px-3.5 py-2.5 text-foreground focus:ring-2 focus:ring-primary/40 focus:outline-none"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!inviteEmail.trim()}
                      className="btn btn-sm btn-primary rounded-xl px-4 font-bold text-xs text-nowrap flex-shrink-0"
                    >
                      <i className="fa-solid fa-paper-plane me-1.5"></i>Convidar
                    </button>
                  </div>
                  {inviteSuccess && (
                    <div className="text-[11px] font-bold text-success mt-2 animate-in fade-in">
                      <i className="fa-solid fa-check me-1"></i>Convite enviado com sucesso!
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* =========================================================
              CARD 3: GESTÃO DE TITULARES
              ========================================================= */}
          {activeSection === 'titulares' && (
            <div 
              className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-200"
              style={{ borderRadius: '24px' }}
            >
              <div className="d-flex align-items-center justify-content-between border-b border-border pb-4">
                <div>
                  <h3 className="panel-title text-lg font-black d-flex align-items-center gap-2.5 m-0">
                    <i className="fa-solid fa-id-badge text-cyan-500"></i>
                    <span>Titulares Cadastrados</span>
                  </h3>
                  <span className="text-xs text-muted block mt-1">
                    Pessoas responsáveis por despesas, faturas e contas
                  </span>
                </div>
                {canManageSharedSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTitular(null);
                      setIsTitularModalOpen(true);
                    }}
                    className="btn btn-sm btn-outline-primary rounded-pill px-3.5 py-1.5 text-xs font-bold d-flex align-items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus text-xs"></i>
                    <span>Novo Titular</span>
                  </button>
                )}
              </div>

              {/* Titulares em Grid Multicolunas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {titulares.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted text-xs italic bg-[var(--card-hover)] rounded-2xl border border-border">
                    {canManageSharedSettings
                      ? 'Nenhum titular cadastrado ainda. Clique em "Novo Titular" para adicionar.'
                      : 'Nenhum titular cadastrado nesta família.'}
                  </div>
                ) : (
                  titulares.map((t) => (
                    <div
                      key={t.id}
                      className="d-flex align-items-center justify-content-between p-3.5 bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border border-border rounded-2xl transition-all"
                    >
                      <div className="d-flex align-items-center gap-3 min-w-0">
                        <div
                          className="rounded-full d-flex align-items-center justify-content-center text-white font-bold text-xs flex-shrink-0"
                          style={{
                            width: '34px',
                            height: '34px',
                            backgroundColor: 'var(--primary, #00AE9A)'
                          }}
                        >
                          {t.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-foreground truncate">{t.nome}</span>
                      </div>

                      {canManageSharedSettings && (
                        <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-1.5 text-muted hover:text-foreground"
                          onClick={() => {
                            setEditingTitular(t);
                            setIsTitularModalOpen(true);
                          }}
                          title="Editar Titular"
                        >
                          <i className="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-1.5 text-muted hover:text-danger"
                          onClick={() => onDeleteTitular(t.id)}
                          title="Excluir Titular"
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              CARD 4: CARTÕES DE CRÉDITO CONFIGURADOS (FORMATO DE CARTÃO FÍSICO REAL)
              ========================================================= */}
          {activeSection === 'cartoes' && (
            <div 
              className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-200 overflow-hidden"
              style={{ borderRadius: '24px' }}
            >
              <div className="d-flex align-items-center justify-content-between border-b border-border pb-4">
                <div>
                  <h3 className="panel-title text-lg font-black d-flex align-items-center gap-2.5 m-0">
                    <i className="fa-solid fa-credit-card text-purple-500"></i>
                    <span>Meus Cartões de Crédito & Faturas</span>
                  </h3>
                  <span className="text-xs text-muted block mt-1">
                    Configure os dias de fechamento e vencimento de cada cartão cadastrado
                  </span>
                </div>
                {canManageSharedSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCartao(null);
                      setIsCartaoModalOpen(true);
                    }}
                    className="btn btn-sm btn-outline-primary rounded-pill px-3.5 py-1.5 text-xs font-bold d-flex align-items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus text-xs"></i>
                    <span>Novo Cartão</span>
                  </button>
                )}
              </div>

              {/* Grade de Cartões Idênticos à Aba de Cartões */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {cartoes.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-muted text-xs italic bg-[var(--card-hover)] rounded-2xl border border-border">
                    {canManageSharedSettings
                      ? 'Nenhum cartão de crédito cadastrado ainda. Clique em "Novo Cartão" para adicionar.'
                      : 'Nenhum cartão de crédito cadastrado nesta família.'}
                  </div>
                ) : (
                  cartoes.map((c) => {
                    const normCard = (c.nome_cartao || '').toLowerCase();
                    const matchedPreset = PRESET_CARDS_STYLE.find((p) => {
                      const normPreset = p.name.toLowerCase();
                      return normCard.includes(normPreset) || normPreset.includes(normCard);
                    });
                    const titularNome = (c.titular_id ? titulares.find((t) => t.id === c.titular_id)?.nome : null) || user?.nome || 'Titular';
                    const cardColor = c.color || matchedPreset?.color || '#00AE9A';
                    const finalDigits = c.final || '••••';
                    const cardBg = cardColor.startsWith('linear') ? cardColor : `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}cc 100%)`;

                    return (
                      <div key={c.id} className="flex flex-col gap-2 w-full max-w-[340px]">
                        <div className="d-flex align-items-center justify-content-between px-1">
                          <span className="text-xs font-bold text-foreground truncate">{c.nome_cartao}</span>
                          {canManageSharedSettings && (
                            <div className="d-flex align-items-center gap-1">
                              <button type="button" className="btn btn-sm btn-link p-1 text-muted hover:text-primary transition-colors" onClick={() => { setEditingCartao(c); setIsCartaoModalOpen(true); }} title="Editar Cartão">
                                <i className="fa-solid fa-pen-to-square text-xs"></i>
                              </button>
                              <button type="button" className="btn btn-sm btn-link p-1 text-muted hover:text-danger transition-colors" onClick={() => onDeleteCartao(c.id)} title="Excluir Cartão">
                                <i className="fa-solid fa-trash text-xs"></i>
                              </button>
                            </div>
                          )}
                        </div>
                        <div
                          className={`credit-card-ui transition-all duration-300 shadow-md${canManageSharedSettings ? ' cursor-pointer hover:scale-[1.02]' : ''}`}
                          style={{ background: cardBg }}
                          onClick={canManageSharedSettings ? () => { setEditingCartao(c); setIsCartaoModalOpen(true); } : undefined}
                          title={canManageSharedSettings ? `Clique para editar ${c.nome_cartao}` : undefined}
                        >
                          <div className="cc-top">
                            <div className="cc-chip"></div>
                            <span className="cc-brand truncate">{c.nome_cartao}</span>
                          </div>
                          <div className="cc-middle">
                            <div className="cc-number">•••• •••• •••• {finalDigits}</div>
                          </div>
                          <div className="cc-bottom">
                            <div className="cc-holder truncate">{titularNome}</div>
                            <div className="cc-balance-preview">
                              <div className="cc-balance-label">Fech. / Venc.</div>
                              <div className="cc-balance-val text-xs">Dia {c.dia_fechamento} / {c.dia_vencimento}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              CARD 5: GERENCIAMENTO DE CATEGORIAS
              ========================================================= */}
          {activeSection === 'categorias' && (
            <div 
              className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-200"
              style={{ borderRadius: '24px' }}
            >
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 border-b border-border pb-4">
                <div>
                  <h3 className="panel-title text-lg font-black d-flex align-items-center gap-2.5 m-0">
                    <i className="fa-solid fa-tags text-emerald-500"></i>
                    <span>Gerenciamento de Categorias</span>
                  </h3>
                  <span className="text-xs text-muted block mt-1">
                    Organize, renomeie categorias em lote ou reclassifique lançamentos por descrição
                  </span>
                </div>

                <div className="d-flex align-items-center gap-1 p-1 bg-muted/30 border border-border rounded-pill">
                  <button
                    type="button"
                    onClick={() => { setCategorySource('despesas'); setSelectedCategoryForDetails(null); setCategorySearchTerm(''); }}
                    className={cn('btn btn-sm rounded-pill px-3 py-1 text-xs fw-bold border-0', categorySource === 'despesas' ? 'bg-primary text-white shadow-sm' : 'bg-transparent text-muted')}
                  >
                    Despesas
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCategorySource('cartoes'); setSelectedCategoryForDetails(null); setCategorySearchTerm(''); }}
                    className={cn('btn btn-sm rounded-pill px-3 py-1 text-xs fw-bold border-0', categorySource === 'cartoes' ? 'bg-primary text-white shadow-sm' : 'bg-transparent text-muted')}
                  >
                    Compras no cartão
                  </button>
                </div>

                {selectedCategoryForDetails ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryForDetails(null);
                      setCategorySearchTerm('');
                    }}
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3.5 py-1 text-xs font-bold d-flex align-items-center gap-1.5"
                  >
                    <i className="fa-solid fa-arrow-left text-xs"></i>
                    <span>Voltar para Todas</span>
                  </button>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge-tag rounded-full text-xs font-bold px-3 py-1 bg-card border border-border text-muted">
                      {categoryStats.length} {categoryStats.length === 1 ? 'categoria' : 'categorias'}
                    </span>
                  </div>
                )}
              </div>

              {categoryOperationError && (
                <div className="alert alert-danger text-xs" role="alert">{categoryOperationError}</div>
              )}

              {/* Subview: Detalhes da Categoria Selecionada (Descrições em Lote) */}
              {selectedCategoryForDetails ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-3.5 bg-[var(--card-hover)] border border-border rounded-2xl d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider block font-bold">Categoria em visualização:</span>
                      <div className="text-sm font-bold text-foreground d-flex align-items-center gap-2 mt-0.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                        {selectedCategoryForDetails}
                      </div>
                    </div>
                    <div className="position-relative" style={{ minWidth: '220px' }}>
                      <i className="fa-solid fa-magnifying-glass position-absolute text-xs text-muted top-50 start-0 translate-middle-y ms-3 opacity-60"></i>
                      <input
                        type="text"
                        value={categorySearchTerm}
                        onChange={(e) => setCategorySearchTerm(e.target.value)}
                        placeholder="Filtrar lançamentos..."
                        className="w-full bg-card border border-border ps-8 pe-3 py-1.5 text-xs text-foreground rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  {/* Lista de Descrições da Categoria em Grid Multicolunas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                    {categorySource === 'cartoes' ? (
                      groupedCardTransactions.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-muted text-xs italic bg-[var(--card-hover)] rounded-2xl border border-border">
                          Nenhuma compra encontrada nesta categoria.
                        </div>
                      ) : groupedCardTransactions.map((group) => (
                        <div key={group.estabelecimento.toLocaleLowerCase('pt-BR')} className="p-3.5 bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border border-border rounded-2xl d-flex align-items-center justify-content-between gap-3 transition-colors">
                          <div className="min-w-0 flex-grow-1">
                            <div className="font-bold text-xs text-foreground truncate">{group.estabelecimento}</div>
                            <div className="text-[10px] text-muted mt-0.5">
                              {group.count} {group.count === 1 ? 'compra' : 'compras'} · R$ {group.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="d-flex flex-column gap-1 flex-shrink-0">
                            <select
                              value={group.categories.size === 1 ? Array.from(group.categories)[0] : '__mixed__'}
                              onChange={async (event) => {
                                if (!onUpdateCardCategoryByEstablishment) return;
                                setCategoryOperationError(null);
                                try {
                                  await onUpdateCardCategoryByEstablishment(group.estabelecimento, event.target.value);
                                } catch {
                                  setCategoryOperationError('Não foi possível alterar a categoria das compras deste estabelecimento. Tente novamente.');
                                }
                              }}
                              className="bg-card border border-border text-foreground text-xs font-semibold py-1 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                            >
                              {group.categories.size > 1 && <option value="__mixed__" disabled>Categorias variadas</option>}
                              {categoryStats.map(category => <option key={category.name} value={category.name} className="bg-card text-foreground">{category.name}</option>)}
                            </select>
                            {creatingCardCategoryFor === group.estabelecimento.toLocaleLowerCase('pt-BR') ? (
                              <div className="d-flex align-items-center gap-1">
                                <input
                                  autoFocus
                                  value={newCardCategoryName}
                                  onChange={(event) => setNewCardCategoryName(event.target.value)}
                                  onKeyDown={async (event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      const newCategory = newCardCategoryName.trim();
                                      if (!newCategory || !onUpdateCardCategoryByEstablishment) return;
                                      setCategoryOperationError(null);
                                      try {
                                        await onUpdateCardCategoryByEstablishment(group.estabelecimento, newCategory);
                                        setCreatingCardCategoryFor(null);
                                        setNewCardCategoryName('');
                                      } catch {
                                        setCategoryOperationError('Não foi possível salvar a nova categoria. Tente novamente.');
                                      }
                                    }
                                  }}
                                  placeholder="Nova categoria"
                                  className="bg-card border border-border text-foreground text-xs py-1 px-2 rounded-lg min-w-0"
                                />
                                <button
                                  type="button"
                                  disabled={!newCardCategoryName.trim()}
                                  onClick={async () => {
                                    if (!onUpdateCardCategoryByEstablishment || !newCardCategoryName.trim()) return;
                                    setCategoryOperationError(null);
                                    try {
                                      await onUpdateCardCategoryByEstablishment(group.estabelecimento, newCardCategoryName.trim());
                                      setCreatingCardCategoryFor(null);
                                      setNewCardCategoryName('');
                                    } catch {
                                      setCategoryOperationError('Não foi possível salvar a nova categoria. Tente novamente.');
                                    }
                                  }}
                                  className="btn btn-sm btn-primary px-2 py-1 text-[10px]"
                                >
                                  Salvar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setCreatingCardCategoryFor(group.estabelecimento.toLocaleLowerCase('pt-BR'));
                                  setNewCardCategoryName('');
                                }}
                                className="btn btn-sm btn-link p-0 text-[10px] text-primary text-start"
                              >
                                + Nova categoria
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : groupedDescriptions.length === 0 ? (
                      <div className="col-span-full text-center py-8 text-muted text-xs italic bg-[var(--card-hover)] rounded-2xl border border-border">
                        Nenhuma descrição encontrada nesta categoria.
                      </div>
                    ) : (
                      groupedDescriptions.map((item) => (
                        <div
                          key={item.desc}
                          className="p-3.5 bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border border-border rounded-2xl d-flex align-items-center justify-content-between gap-3 transition-colors"
                        >
                          <div className="min-w-0 flex-grow-1">
                            <div className="font-bold text-xs text-foreground truncate">{item.desc}</div>
                            <div className="text-[10px] text-muted mt-0.5">
                              {item.count} {item.count === 1 ? 'lançamento vinculado' : 'lançamentos vinculados'}
                            </div>
                          </div>

                          {/* Seletor Rápido para Mudar a Categoria em Lote */}
                          <div className="flex-shrink-0 d-flex align-items-center gap-1.5">
                            <select
                              value={selectedCategoryForDetails || 'Outros'}
                              onChange={async (e) => {
                                const newCat = e.target.value;
                                if (onUpdateCategoryByDescription) {
                                  setCategoryOperationError(null);
                                  try {
                                    await onUpdateCategoryByDescription(item.desc, newCat);
                                  } catch {
                                    setCategoryOperationError('Não foi possível concluir a reclassificação. Confira os dados exibidos e tente novamente.');
                                  }
                                }
                              }}
                              className="bg-card border border-border text-foreground text-xs font-semibold py-1 px-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                            >
                              {categoryStats.map((c) => (
                                <option key={c.name} value={c.name} className="bg-card text-foreground">
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Visualização Geral de Categorias em Grid Multicolunas */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
                    {categoryStats.map((cat) => (
                      <div
                        key={cat.name}
                        className="p-3.5 bg-[var(--card-hover)] hover:bg-[var(--card-elevated)] border border-border rounded-2xl d-flex align-items-center justify-content-between gap-2 transition-all"
                      >
                        <div
                          className="min-w-0 flex-grow-1 cursor-pointer"
                          onClick={() => setSelectedCategoryForDetails(cat.name)}
                          title="Clique para ver os lançamentos desta categoria"
                        >
                          <div className="font-bold text-xs text-foreground truncate hover:text-primary transition-colors">
                            {cat.name}
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">
                            {cat.count} {cat.count === 1 ? 'lançamento' : 'lançamentos'}
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedCategoryForDetails(cat.name)}
                            className="btn btn-sm btn-link p-1.5 text-muted hover:text-foreground"
                            title="Ver lançamentos agrupados"
                          >
                            <i className="fa-solid fa-list-ul text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingCategory({ oldName: cat.name, newName: cat.name })}
                            className="btn btn-sm btn-link p-1.5 text-muted hover:text-primary"
                            title="Renomear em lote"
                          >
                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              CARD 6: AVISOS, ALERTAS & LEMBRETES
              ========================================================= */}
          {activeSection === 'avisos' && (
            <div 
              className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-200"
              style={{ borderRadius: '24px' }}
            >
              <div className="border-b border-border pb-4">
                <h3 className="panel-title text-lg font-black d-flex align-items-center gap-2.5 m-0">
                  <i className="fa-solid fa-bell text-orange-500"></i>
                  <span>Central de Avisos & Lembretes Rápidos</span>
                </h3>
                <span className="text-xs text-muted block mt-1">
                  Configure as notificações automáticas do sistema e anote tarefas rápidas
                </span>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Notificações Automáticas em Grid */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    Notificações Automáticas
                  </label>

                  <div className="space-y-2.5">
                    <div className="d-flex align-items-center justify-content-between p-3.5 bg-[var(--card-hover)] border border-border rounded-2xl">
                      <div>
                        <div className="text-xs font-bold text-foreground">Contas Vencidas</div>
                        <div className="text-[10px] text-muted">Avisar sobre despesas que ultrapassaram o vencimento</div>
                      </div>
                      <div className="form-check form-switch m-0 ms-2">
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          checked={avisosConfig?.vencidas ?? true}
                          onChange={(e) => onUpdateAvisosConfig?.('vencidas', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="d-flex align-items-center justify-content-between p-3.5 bg-[var(--card-hover)] border border-border rounded-2xl">
                      <div>
                        <div className="text-xs font-bold text-foreground">Vencendo Hoje</div>
                        <div className="text-[10px] text-muted">Alertar contas com vencimento na data atual</div>
                      </div>
                      <div className="form-check form-switch m-0 ms-2">
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          checked={avisosConfig?.hoje ?? true}
                          onChange={(e) => onUpdateAvisosConfig?.('hoje', e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="d-flex align-items-center justify-content-between p-3.5 bg-[var(--card-hover)] border border-border rounded-2xl">
                      <div>
                        <div className="text-xs font-bold text-foreground">Dicas do Radar Financeiro</div>
                        <div className="text-[10px] text-muted">Projeções e oportunidades de antecipação com desconto</div>
                      </div>
                      <div className="form-check form-switch m-0 ms-2">
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          checked={avisosConfig?.radar ?? false}
                          onChange={(e) => onUpdateAvisosConfig?.('radar', e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lembretes Rápidos com Grid Multicolunas */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    Lembretes & Tarefas Rápidas
                  </label>

                  {/* Form Lembrete */}
                  <form onSubmit={handleAddReminder} className="d-flex gap-2">
                    <input
                      type="text"
                      placeholder="Novo lembrete (ex: Pagar IPVA)"
                      className="w-full bg-card border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/40 focus:outline-none flex-grow"
                      value={newReminderText}
                      onChange={(e) => setNewReminderText(e.target.value)}
                    />
                    <StyledDatePicker
                      value={newReminderDate}
                      onChange={setNewReminderDate}
                      placeholder="Data"
                    />
                    <button
                      type="submit"
                      disabled={!newReminderText.trim()}
                      className="btn btn-sm btn-primary rounded-xl px-3 font-bold text-xs text-nowrap flex-shrink-0"
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </form>

                  {/* Lista Lembretes em Grid Multicolunas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {lembretes.length === 0 ? (
                      <div className="col-span-full text-center py-6 text-muted text-xs italic bg-[var(--card-hover)] rounded-2xl border border-border">
                        Nenhum lembrete pendente.
                      </div>
                    ) : (
                      lembretes.map((l) => (
                        <div
                          key={l.id}
                          className={cn(
                            "d-flex align-items-center justify-content-between p-2.5 rounded-xl border border-border transition-all",
                            l.concluido ? "bg-muted/10 opacity-60" : "bg-[var(--card-hover)]"
                          )}
                        >
                          <div
                            className="d-flex align-items-center gap-2 cursor-pointer flex-grow min-w-0"
                            onClick={() => onToggleLembrete?.(l.id)}
                          >
                            <div
                              className={cn(
                                "w-4 h-4 rounded d-flex align-items-center justify-content-center text-[10px] flex-shrink-0",
                                l.concluido ? "bg-success text-white" : "border border-border"
                              )}
                            >
                              {l.concluido && <i className="fa-solid fa-check"></i>}
                            </div>
                            <span className={cn("text-xs font-medium text-foreground truncate", l.concluido && "line-through text-muted")}>
                              {l.texto}
                            </span>
                            {l.data && (
                              <span className="badge rounded-pill bg-muted/30 text-[9px] text-muted px-1.5 py-0.5 flex-shrink-0">
                                {l.data}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 text-muted hover:text-danger ms-2"
                            onClick={() => onDeleteLembrete?.(l.id)}
                          >
                            <i className="fa-solid fa-xmark text-xs"></i>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal de Renomear Categoria em Lote */}
      <Modal
        isOpen={!!renamingCategory}
        onClose={() => setRenamingCategory(null)}
        title="Renomear Categoria em Lote"
      >
        {renamingCategory && (
          <form onSubmit={handleRenameCategorySubmit} className="space-y-4">
            <div className="p-3 bg-[var(--card-hover)] border border-border rounded-2xl">
              <span className="text-[10px] text-muted uppercase tracking-wider block font-bold">Categoria Atual</span>
              <div className="text-sm font-bold text-foreground mt-0.5">{renamingCategory.oldName}</div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                Novo Nome da Categoria
              </label>
              <input
                type="text"
                required
                value={renamingCategory.newName}
                onChange={(e) => setRenamingCategory({ ...renamingCategory, newName: e.target.value })}
                placeholder="Ex: Moradia, Alimentação, Lazer..."
                className="w-full bg-[var(--card-hover)] border border-border rounded-xl px-3.5 h-[44px] text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <span className="text-[11px] text-muted block mt-1.5 opacity-70">
                Todos os lançamentos com o nome antigo serão atualizados para este novo nome.
              </span>
            </div>

            {categoryOperationError && (
              <div className="alert alert-danger text-xs" role="alert">{categoryOperationError}</div>
            )}

            <div className="d-flex align-items-center justify-content-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setRenamingCategory(null)}
                className="btn btn-sm btn-link text-muted hover:text-foreground text-xs font-bold text-decoration-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isRenamingSaving || !renamingCategory.newName.trim()}
                className="btn btn-sm btn-primary rounded-pill px-4 py-2 text-xs font-bold shadow-sm"
              >
                {isRenamingSaving ? 'Salvando...' : 'Salvar Alteração'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal de Titular */}
      <Modal
        isOpen={isTitularModalOpen}
        onClose={() => {
          setIsTitularModalOpen(false);
          setEditingTitular(null);
        }}
        title={editingTitular ? "Editar Titular" : "Novo Titular"}
      >
        <TitularForm
          initialData={editingTitular || undefined}
          onCancel={() => {
            setIsTitularModalOpen(false);
            setEditingTitular(null);
          }}
          onSubmit={async (data) => {
            if (editingTitular) {
              await onUpdateTitular(editingTitular.id, data);
            } else {
              await onAddTitular(data);
            }
            setIsTitularModalOpen(false);
            setEditingTitular(null);
          }}
        />
      </Modal>

      {/* Modal de Cartão */}
      <Modal
        isOpen={isCartaoModalOpen}
        onClose={() => {
          setIsCartaoModalOpen(false);
          setEditingCartao(null);
        }}
        title={editingCartao ? "Editar Cartão de Crédito" : "Novo Cartão de Crédito"}
      >
        <CartaoForm
          key={editingCartao ? `edit-${editingCartao.id}` : 'new'}
          initialData={editingCartao || undefined}
          titulares={titulares}
          onCancel={() => {
            setIsCartaoModalOpen(false);
            setEditingCartao(null);
          }}
          onSubmit={async (data) => {
            if (editingCartao) {
              await onUpdateCartao(editingCartao.id, data);
            } else {
              await onAddCartao(data);
            }
            setIsCartaoModalOpen(false);
            setEditingCartao(null);
          }}
        />
      </Modal>
    </div>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  ...props
}: any) {
  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 2000 }} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
        <div className="modal-content border border-border shadow-2xl overflow-hidden rounded-[2rem] bg-card p-6 relative">
          <SettingsView {...props} />
          <button 
            type="button" 
            className="btn-icon position-absolute top-4 end-4 d-flex align-items-center justify-content-center transition-all hover:bg-muted/20 rounded-circle border-0 bg-transparent text-foreground cursor-pointer"
            style={{ width: '36px', height: '36px' }}
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
