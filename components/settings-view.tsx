'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Profile, Titular, CartaoConfig, Despesa, ContaFixaConfig } from '@/lib/types';
import { Modal, TitularForm, CartaoForm, StyledDatePicker } from './modals';
import { CardLogo } from './card-ui';

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
  despesas?: Despesa[];
  contasFixas?: ContaFixaConfig[];
  onAddTitular: (t: Omit<Titular, 'id'>) => void;
  onUpdateTitular: (id: number, t: Partial<Titular>) => void;
  onDeleteTitular: (id: number) => void;
  onAddCartao: (c: Omit<CartaoConfig, 'id'>) => void;
  onUpdateCartao: (id: number, c: Partial<CartaoConfig>) => void;
  onDeleteCartao: (id: number) => void;
  onRenameCategory?: (oldCat: string, newCat: string) => Promise<any> | void;
  onUpdateCategoryByDescription?: (descricao: string, newCat: string) => Promise<any> | void;
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
  titulares = [],
  cartoes = [],
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
  lembretes = [],
  onAddLembrete,
  onToggleLembrete,
  onDeleteLembrete,
  avisosConfig = { vencidas: true, hoje: true, radar: false },
  onUpdateAvisosConfig
}: SettingsViewProps) {
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

  // Category stats calculation
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const defaults = ['MERCADO', 'TRANSPORTE', 'ALIMENTAÇÃO', 'MORADIA', 'SAÚDE', 'LAZER', 'EDUCAÇÃO', 'COMPRAS', 'OUTROS'];
    defaults.forEach(d => { counts[d] = 0; });

    despesas.forEach(d => {
      const c = d.categoria?.trim() || 'OUTROS';
      counts[c] = (counts[c] || 0) + 1;
    });

    contasFixas.forEach(f => {
      if (f.categoria) {
        const c = f.categoria.trim();
        counts[c] = (counts[c] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [despesas, contasFixas]);

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
    try {
      if (onRenameCategory) {
        await onRenameCategory(renamingCategory.oldName, renamingCategory.newName.trim().toUpperCase());
      }
      setRenamingCategory(null);
    } catch (err) {
      console.error('Erro ao renomear categoria:', err);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="panel-header mb-2">
        <div>
          <h2 className="panel-title text-xl md:text-2xl font-black d-flex align-items-center gap-2">
            <i className="fa-solid fa-gear text-primary"></i>
            <span>Definições e Preferências</span>
          </h2>
          <span className="panel-subtitle text-xs md:text-sm text-muted">
            Personalize a identidade visual, membros da família, categorias, titulares e integrações do sistema
          </span>
        </div>
      </div>

      {/* Grid Principal com Bordas Suaves e Sem Destaques Excessivos no Modo Dark */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        
        {/* =========================================================
            CARD 1: TEMA E IDENTIDADE VISUAL
            ========================================================= */}
        <div className="bg-card border border-slate-200/70 dark:border-white/[0.04] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 m-0">
            <i className="fa-solid fa-palette text-primary"></i>
            <span>Tema e Identidade Visual</span>
          </h3>

          <div className="space-y-4 pt-1">
            {/* Tema Principal */}
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Tema Principal
              </label>
              <select
                className="w-full bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-xl text-xs font-bold p-2.5 text-foreground cursor-pointer focus:ring-1 focus:ring-primary/40 focus:outline-none"
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value as any)}
              >
                <option value="black" className="bg-card text-foreground">Midnight Black (Preto Absoluto OLED)</option>
                <option value="dark" className="bg-card text-foreground">Dark Deep (Azul Noturno Sofisticado)</option>
                <option value="light" className="bg-card text-foreground">Light Mode (Claro Minimalista)</option>
              </select>
            </div>

            {/* Cor de Destaque */}
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Cor de Destaque (--primary)
              </label>
              <div className="p-3 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl space-y-3">
                {/* Grade de Cores */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {primaryColors.map((c) => {
                    const isSelected = themeColor?.toLowerCase() === c.color.toLowerCase();
                    return (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setThemeColor?.(c.color)}
                        className={cn(
                          "rounded-full transition-all cursor-pointer relative d-flex align-items-center justify-content-center",
                          isSelected ? "scale-110 ring-2 ring-white/80 shadow-md" : "hover:scale-105 opacity-85 hover:opacity-100"
                        )}
                        style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: c.color,
                          border: '2px solid rgba(255,255,255,0.15)'
                        }}
                        title={c.name}
                      >
                        {isSelected && <i className="fa-solid fa-check text-white text-xs"></i>}
                      </button>
                    );
                  })}
                </div>

                {/* Seletor Customizado HEX */}
                <div className="d-flex align-items-center justify-content-between gap-3 pt-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                  <div className="d-flex align-items-center gap-2.5">
                    <div 
                      className="w-8 h-8 rounded-xl border border-slate-200/60 dark:border-white/[0.06] shadow-xs relative overflow-hidden flex-shrink-0 cursor-pointer"
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
                      <span className="text-xs font-bold text-foreground block leading-tight">Cor Personalizada</span>
                      <span className="text-[10px] text-muted">Clique no quadrado ou digite o código HEX</span>
                    </div>
                  </div>

                  <div className="d-flex align-items-center bg-card border border-slate-200/70 dark:border-white/[0.05] rounded-xl px-2.5 py-1" style={{ width: '115px' }}>
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
          </div>
        </div>

        {/* =========================================================
            CARD 2: MEMBROS & COMPARTILHAMENTO FAMILIAR
            ========================================================= */}
        <div className="bg-card border border-slate-200/70 dark:border-white/[0.04] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 m-0">
            <i className="fa-solid fa-users text-primary"></i>
            <span>Membros & Compartilhamento</span>
          </h3>

          <div className="space-y-3 pt-1">
            {/* Lista de Membros */}
            <div className="space-y-2">
              {/* Usuário Logado */}
              <div className="d-flex align-items-center justify-content-between p-2.5 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl">
                <div className="d-flex align-items-center gap-3">
                  <div 
                    className="avatar d-flex align-items-center justify-content-center rounded-full text-white font-bold text-xs"
                    style={{ width: '36px', height: '36px', background: themeColor || '#00AE9A' }}
                  >
                    {user?.nome ? user.nome.slice(0, 2).toUpperCase() : 'EU'}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-foreground">{user?.nome || 'Usuário Atual'}</div>
                    <div className="text-[10px] text-muted">{user?.email || 'email@exemplo.com'}</div>
                  </div>
                </div>
                <span className="badge-tag badge-paid text-[10px]">Titular</span>
              </div>

              {/* Membros Adicionais */}
              {familyMembers.map((m) => (
                <div key={m.id} className="d-flex align-items-center justify-content-between p-2.5 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl">
                  <div className="d-flex align-items-center gap-3">
                    <div 
                      className="avatar d-flex align-items-center justify-content-center rounded-full text-white font-bold text-xs"
                      style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
                    >
                      {m.nome ? m.nome.slice(0, 2).toUpperCase() : 'MB'}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">{m.nome}</div>
                      <div className="text-[10px] text-muted">{m.email}</div>
                    </div>
                  </div>
                  <span className="badge-tag badge-pending text-[10px]">Membro</span>
                </div>
              ))}
            </div>

            {/* Convidar Novo Membro */}
            <form onSubmit={handleSendInvite} className="pt-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">
                Convidar por E-mail
              </label>
              <div className="d-flex gap-2">
                <input
                  type="email"
                  placeholder="novo.membro@email.com"
                  className="w-full bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-xl text-xs px-3 py-2 text-foreground focus:ring-1 focus:ring-primary/40 focus:outline-none"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!inviteEmail.trim()}
                  className="btn btn-sm btn-primary rounded-xl px-3.5 font-bold text-xs text-nowrap flex-shrink-0"
                >
                  <i className="fa-solid fa-paper-plane me-1.5"></i>Convidar
                </button>
              </div>
              {inviteSuccess && (
                <div className="text-[11px] font-bold text-success mt-1.5 animate-in fade-in">
                  <i className="fa-solid fa-check me-1"></i>Convite enviado com sucesso!
                </div>
              )}
            </form>
          </div>
        </div>

        {/* =========================================================
            CARD 3: GESTÃO DE TITULARES
            ========================================================= */}
        <div className="bg-card border border-slate-200/70 dark:border-white/[0.04] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="d-flex align-items-center justify-content-between">
            <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 m-0">
              <i className="fa-solid fa-id-badge text-primary"></i>
              <span>Titulares Cadastrados</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingTitular(null);
                setIsTitularModalOpen(true);
              }}
              className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 text-xs font-bold"
            >
              <i className="fa-solid fa-plus me-1"></i>Novo
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {titulares.length === 0 ? (
              <div className="text-center py-4 text-muted text-xs italic">
                Nenhum titular cadastrado ainda.
              </div>
            ) : (
              titulares.map((t) => (
                <div
                  key={t.id}
                  className="d-flex align-items-center justify-content-between p-2.5 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl hover:border-primary/40 transition-colors"
                >
                  <div className="d-flex align-items-center gap-2.5">
                    <div
                      className="rounded-full d-flex align-items-center justify-content-center text-white font-bold text-[10px]"
                      style={{
                        width: '28px',
                        height: '28px',
                        backgroundColor: 'var(--primary, #00AE9A)'
                      }}
                    >
                      {t.nome.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-foreground">{t.nome}</span>
                  </div>

                  <div className="d-flex align-items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-1 text-muted hover:text-foreground"
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
                      className="btn btn-sm btn-link p-1 text-muted hover:text-danger"
                      onClick={() => {
                        if (confirm(`Deseja realmente excluir o titular "${t.nome}"?`)) {
                          onDeleteTitular(t.id);
                        }
                      }}
                      title="Excluir Titular"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* =========================================================
            CARD 4: CARTÕES DE CRÉDITO CONFIGURADOS
            ========================================================= */}
        <div className="bg-card border border-slate-200/70 dark:border-white/[0.04] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="d-flex align-items-center justify-content-between">
            <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 m-0">
              <i className="fa-solid fa-credit-card text-primary"></i>
              <span>Meus Cartões & Faturas</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingCartao(null);
                setIsCartaoModalOpen(true);
              }}
              className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 text-xs font-bold"
            >
              <i className="fa-solid fa-plus me-1"></i>Novo
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {cartoes.length === 0 ? (
              <div className="text-center py-4 text-muted text-xs italic">
                Nenhum cartão de crédito cadastrado.
              </div>
            ) : (
              cartoes.map((c) => (
                <div
                  key={c.id}
                  className="d-flex align-items-center justify-content-between p-2.5 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl hover:border-primary/40 transition-colors"
                >
                  <div className="d-flex align-items-center gap-2.5">
                    <CardLogo name={c.nome_cartao} customIcon={c.icone} size="sm" />
                    <div>
                      <div className="text-xs font-black text-foreground">{c.nome_cartao}</div>
                      <div className="text-[10px] text-muted">
                        Fecha dia {c.dia_fechamento} • Vence dia {c.dia_vencimento}
                        {c.final && <span className="ms-1.5 opacity-80">•••• {c.final}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-1 text-muted hover:text-foreground"
                      onClick={() => {
                        setEditingCartao(c);
                        setIsCartaoModalOpen(true);
                      }}
                      title="Editar Cartão"
                    >
                      <i className="fa-solid fa-pen-to-square text-xs"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-1 text-muted hover:text-danger"
                      onClick={() => {
                        if (confirm(`Deseja realmente excluir o cartão "${c.nome_cartao}"?`)) {
                          onDeleteCartao(c.id);
                        }
                      }}
                      title="Excluir Cartão"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* =========================================================
            CARD 5: GERENCIAMENTO DE CATEGORIAS (MIGRADO DO POPUP)
            ========================================================= */}
        <div className="bg-card border border-slate-200/70 dark:border-white/[0.04] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4 md:col-span-2">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 m-0">
                <i className="fa-solid fa-tags text-primary"></i>
                <span>Gerenciamento de Categorias</span>
              </h3>
              <span className="text-xs text-muted block mt-0.5">
                Organize e renomeie categorias em lote ou ajuste todos os lançamentos por descrição
              </span>
            </div>

            {selectedCategoryForDetails ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryForDetails(null);
                  setCategorySearchTerm('');
                }}
                className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 text-xs font-bold d-flex align-items-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-left text-xs"></i>
                <span>Voltar para Todas</span>
              </button>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <span className="badge-tag rounded-full text-xs font-normal px-3 py-1 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] text-muted">
                  {categoryStats.length} categorias
                </span>
              </div>
            )}
          </div>

          {/* Subview: Detalhes da Categoria Selecionada (Descrições em Lote) */}
          {selectedCategoryForDetails ? (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-3 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <span className="text-[10px] text-muted uppercase tracking-wider block font-bold">Categoria em visualização:</span>
                  <div className="text-sm font-bold text-foreground d-flex align-items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
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
                    className="w-full bg-card border border-slate-200/70 dark:border-white/[0.05] ps-8 pe-3 py-1.5 text-xs text-foreground rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Lista de Descrições da Categoria */}
              <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                {groupedDescriptions.length === 0 ? (
                  <div className="text-center py-8 text-muted text-xs italic bg-slate-50/50 dark:bg-white/[0.01] rounded-2xl border border-slate-200/40 dark:border-white/[0.03]">
                    Nenhuma descrição encontrada nesta categoria.
                  </div>
                ) : (
                  groupedDescriptions.map((item) => (
                    <div
                      key={item.desc}
                      className="p-3 bg-slate-50/70 hover:bg-slate-100/70 dark:bg-white/[0.02] dark:hover:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl d-flex align-items-center justify-content-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 flex-grow-1">
                        <div className="font-bold text-xs text-foreground truncate">{item.desc}</div>
                        <div className="text-[10px] text-muted mt-0.5">
                          {item.count} {item.count === 1 ? 'lançamento vinculado' : 'lançamentos vinculados'}
                        </div>
                      </div>

                      {/* Seletor Rápido para Mudar a Categoria em Lote */}
                      <div className="flex-shrink-0 d-flex align-items-center gap-2">
                        <span className="text-[11px] text-muted font-normal d-none sm:inline opacity-70">Mover para:</span>
                        <select
                          value={selectedCategoryForDetails || 'OUTROS'}
                          onChange={async (e) => {
                            const newCat = e.target.value;
                            if (onUpdateCategoryByDescription) {
                              await onUpdateCategoryByDescription(item.desc, newCat);
                            }
                          }}
                          className="bg-card border border-slate-200/70 dark:border-white/[0.05] text-foreground text-xs font-semibold py-1.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
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
            /* Visualização Geral de Categorias */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {categoryStats.map((cat) => (
                  <div
                    key={cat.name}
                    className="p-3 bg-slate-50/70 hover:bg-slate-100/70 dark:bg-white/[0.02] dark:hover:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl d-flex align-items-center justify-content-between gap-2 transition-all"
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
                        className="btn btn-sm btn-link p-1 text-muted hover:text-foreground"
                        title="Ver lançamentos agrupados"
                      >
                        <i className="fa-solid fa-list-ul text-xs"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingCategory({ oldName: cat.name, newName: cat.name })}
                        className="btn btn-sm btn-link p-1 text-muted hover:text-primary"
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

        {/* =========================================================
            CARD 6: AVISOS, ALERTAS & LEMBRETES
            ========================================================= */}
        <div className="bg-card border border-slate-200/70 dark:border-white/[0.04] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4 md:col-span-2">
          <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 m-0">
            <i className="fa-solid fa-bell text-primary"></i>
            <span>Central de Avisos & Lembretes Rápidos</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            {/* Alertas Automáticos */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                Notificações Automáticas
              </label>

              <div className="d-flex align-items-center justify-content-between p-2.5 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-foreground">Contas Vencidas</div>
                  <div className="text-[10px] text-muted">Avisar sobre despesas que ultrapassaram o vencimento</div>
                </div>
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    checked={avisosConfig?.vencidas ?? true}
                    onChange={(e) => onUpdateAvisosConfig?.('vencidas', e.target.checked)}
                  />
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between p-2.5 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-foreground">Vencendo Hoje</div>
                  <div className="text-[10px] text-muted">Alertar contas com vencimento na data atual</div>
                </div>
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    checked={avisosConfig?.hoje ?? true}
                    onChange={(e) => onUpdateAvisosConfig?.('hoje', e.target.checked)}
                  />
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between p-2.5 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-foreground">Dicas do Radar Financeiro</div>
                  <div className="text-[10px] text-muted">Projeções e oportunidades de antecipação com desconto</div>
                </div>
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    checked={avisosConfig?.radar ?? false}
                    onChange={(e) => onUpdateAvisosConfig?.('radar', e.target.checked)}
                  />
                </div>
              </div>
            </div>

            {/* Lembretes Rápidos */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                Lembretes & Tarefas Rápidas
              </label>

              {/* Form Lembrete */}
              <form onSubmit={handleAddReminder} className="d-flex gap-2">
                <input
                  type="text"
                  placeholder="Novo lembrete (ex: Pagar IPVA)"
                  className="w-full bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-xl text-xs px-3 py-2 text-foreground focus:ring-1 focus:ring-primary/40 focus:outline-none flex-grow"
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

              {/* Lista Lembretes */}
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                {lembretes.length === 0 ? (
                  <div className="text-center py-3 text-muted text-xs italic">
                    Nenhum lembrete pendente.
                  </div>
                ) : (
                  lembretes.map((l) => (
                    <div
                      key={l.id}
                      className={cn(
                        "d-flex align-items-center justify-content-between p-2 rounded-xl border border-slate-200/60 dark:border-white/[0.04] transition-all",
                        l.concluido ? "bg-muted/10 opacity-60" : "bg-slate-50/70 dark:bg-white/[0.02]"
                      )}
                    >
                      <div
                        className="d-flex align-items-center gap-2 cursor-pointer flex-grow"
                        onClick={() => onToggleLembrete?.(l.id)}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded d-flex align-items-center justify-content-center text-[10px]",
                            l.concluido ? "bg-success text-white" : "border border-slate-300 dark:border-white/20"
                          )}
                        >
                          {l.concluido && <i className="fa-solid fa-check"></i>}
                        </div>
                        <span className={cn("text-xs font-medium text-foreground", l.concluido && "line-through text-muted")}>
                          {l.texto}
                        </span>
                        {l.data && (
                          <span className="badge rounded-pill bg-muted/30 text-[9px] text-muted px-1.5 py-0.5">
                            {l.data}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-muted hover:text-danger"
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

      </div>

      {/* Modal de Renomear Categoria em Lote */}
      <Modal
        isOpen={!!renamingCategory}
        onClose={() => setRenamingCategory(null)}
        title="Renomear Categoria em Lote"
      >
        {renamingCategory && (
          <form onSubmit={handleRenameCategorySubmit} className="space-y-4">
            <div className="p-3 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl">
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
                placeholder="Ex: MORADIA, ALIMENTAÇÃO..."
                className="w-full bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-xl px-3.5 h-[44px] text-sm font-bold text-foreground uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <span className="text-[11px] text-muted block mt-1.5 opacity-70">
                Todos os lançamentos com o nome antigo serão atualizados para este novo nome.
              </span>
            </div>

            <div className="d-flex align-items-center justify-content-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-white/[0.04]">
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
          onSubmit={(data) => {
            if (editingTitular) {
              onUpdateTitular(editingTitular.id, data);
            } else {
              onAddTitular(data);
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
          onSubmit={(data) => {
            if (editingCartao) {
              onUpdateCartao(editingCartao.id, data);
            } else {
              onAddCartao(data);
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
        <div className="modal-content border border-slate-200/70 dark:border-white/[0.04] shadow-2xl overflow-hidden rounded-[2rem] bg-card p-6 relative">
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
