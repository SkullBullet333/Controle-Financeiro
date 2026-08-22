'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Profile, Titular, CartaoConfig } from '@/lib/types';
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
  onAddTitular: (t: Omit<Titular, 'id'>) => void;
  onUpdateTitular: (id: number, t: Partial<Titular>) => void;
  onDeleteTitular: (id: number) => void;
  onAddCartao: (c: Omit<CartaoConfig, 'id'>) => void;
  onUpdateCartao: (id: number, c: Partial<CartaoConfig>) => void;
  onDeleteCartao: (id: number) => void;
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
  onAddTitular,
  onUpdateTitular,
  onDeleteTitular,
  onAddCartao,
  onUpdateCartao,
  onDeleteCartao,
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
            Personalize a identidade visual, membros da família, titulares e integrações do sistema
          </span>
        </div>
      </div>

      {/* Grid de 2 Colunas conforme completo_prototype.html */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        
        {/* =========================================================
            CARD 1: TEMA E IDENTIDADE VISUAL
            ========================================================= */}
        <div className="card-panel shadow-sm">
          <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 mb-4">
            <i className="fa-solid fa-palette text-primary"></i>
            <span>Tema e Identidade Visual</span>
          </h3>

          <div className="space-y-4">
            {/* Tema Principal */}
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Tema Principal
              </label>
              <select
                className="form-select bg-card border-border rounded-xl text-xs font-bold p-2.5 w-100 text-foreground cursor-pointer"
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value as any)}
              >
                <option value="black">Midnight Black (Preto Absoluto OLED)</option>
                <option value="dark">Dark Deep (Azul Noturno Sofisticado)</option>
                <option value="light">Light Mode (Claro Minimalista)</option>
              </select>
            </div>

            {/* Cor de Destaque */}
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Cor de Destaque (--primary)
              </label>
              <div className="d-flex align-items-center gap-2.5 flex-wrap pt-1">
                {primaryColors.map((c) => {
                  const isSelected = themeColor === c.color;
                  return (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setThemeColor?.(c.color)}
                      className={cn(
                        "rounded-full transition-all cursor-pointer relative d-flex align-items-center justify-content-center",
                        isSelected ? "scale-110 ring-2 ring-white shadow-lg" : "hover:scale-105 opacity-80 hover:opacity-100"
                      )}
                      style={{
                        width: '36px',
                        height: '36px',
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
            </div>
          </div>
        </div>

        {/* =========================================================
            CARD 2: MEMBROS & COMPARTILHAMENTO FAMILIAR
            ========================================================= */}
        <div className="card-panel shadow-sm">
          <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 mb-4">
            <i className="fa-solid fa-users text-primary"></i>
            <span>Membros & Compartilhamento Familiar</span>
          </h3>

          <div className="space-y-3">
            {/* Lista de Membros */}
            <div className="space-y-2">
              {/* Usuário Logado */}
              <div className="d-flex align-items-center justify-content-between p-2.5 bg-muted/30 border border-border/50 rounded-2xl">
                <div className="d-flex align-items-center gap-3">
                  <div 
                    className="avatar d-flex align-items-center justify-content-center rounded-full text-white font-bold text-xs"
                    style={{ width: '38px', height: '38px', background: themeColor || '#00AE9A' }}
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
                <div key={m.id} className="d-flex align-items-center justify-content-between p-2.5 bg-muted/30 border border-border/50 rounded-2xl">
                  <div className="d-flex align-items-center gap-3">
                    <div 
                      className="avatar d-flex align-items-center justify-content-center rounded-full text-white font-bold text-xs"
                      style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
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
                  className="form-control form-control-sm bg-card border-border rounded-xl text-xs px-3 py-2 text-foreground"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!inviteEmail.trim()}
                  className="btn btn-sm btn-primary rounded-xl px-3 font-bold text-xs text-nowrap"
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
        <div className="card-panel shadow-sm">
          <div className="d-flex align-items-center justify-content-between mb-4">
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

          <div className="space-y-2">
            {titulares.length === 0 ? (
              <div className="text-center py-4 text-muted text-xs italic">
                Nenhum titular cadastrado ainda.
              </div>
            ) : (
              titulares.map((t) => (
                <div
                  key={t.id}
                  className="d-flex align-items-center justify-content-between p-2.5 bg-muted/20 border border-border/40 rounded-2xl hover:border-primary/40 transition-colors"
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
                      className="btn btn-sm btn-link p-1 text-muted hover:text-primary"
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
        <div className="card-panel shadow-sm">
          <div className="d-flex align-items-center justify-content-between mb-4">
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

          <div className="space-y-2">
            {cartoes.length === 0 ? (
              <div className="text-center py-4 text-muted text-xs italic">
                Nenhum cartão de crédito cadastrado.
              </div>
            ) : (
              cartoes.map((c) => (
                <div
                  key={c.id}
                  className="d-flex align-items-center justify-content-between p-2.5 bg-muted/20 border border-border/40 rounded-2xl hover:border-primary/40 transition-colors"
                >
                  <div className="d-flex align-items-center gap-2.5">
                    <CardLogo name={c.nome_cartao} size="sm" />
                    <div>
                      <div className="text-xs font-black text-foreground">{c.nome_cartao}</div>
                      <div className="text-[10px] text-muted">
                        Fecha dia {c.dia_fechamento} • Vence dia {c.dia_vencimento}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-1 text-muted hover:text-primary"
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
            CARD 5: AVISOS, ALERTAS & LEMBRETES
            ========================================================= */}
        <div className="card-panel shadow-sm md:col-span-2">
          <h3 className="panel-title text-base font-black d-flex align-items-center gap-2 mb-4">
            <i className="fa-solid fa-bell text-primary"></i>
            <span>Central de Avisos & Lembretes Rápidos</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Alertas Automáticos */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                Notificações Automáticas
              </label>

              <div className="d-flex align-items-center justify-content-between p-2.5 bg-muted/20 border border-border/40 rounded-2xl">
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

              <div className="d-flex align-items-center justify-content-between p-2.5 bg-muted/20 border border-border/40 rounded-2xl">
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

              <div className="d-flex align-items-center justify-content-between p-2.5 bg-muted/20 border border-border/40 rounded-2xl">
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
                  className="form-control form-control-sm bg-card border-border rounded-xl text-xs px-3 py-2 text-foreground flex-grow"
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
                  className="btn btn-sm btn-primary rounded-xl px-3 font-bold text-xs text-nowrap"
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </form>

              {/* Lista Lembretes */}
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
                {lembretes.length === 0 ? (
                  <div className="text-center py-3 text-muted text-xs italic">
                    Nenhum lembrete pendente.
                  </div>
                ) : (
                  lembretes.map((l) => (
                    <div
                      key={l.id}
                      className={cn(
                        "d-flex align-items-center justify-content-between p-2 rounded-xl border border-border/40 transition-all",
                        l.concluido ? "bg-muted/10 opacity-60" : "bg-muted/20"
                      )}
                    >
                      <div
                        className="d-flex align-items-center gap-2 cursor-pointer flex-grow"
                        onClick={() => onToggleLembrete?.(l.id)}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded d-flex align-items-center justify-content-center text-[10px]",
                            l.concluido ? "bg-success text-white" : "border border-border"
                          )}
                        >
                          {l.concluido && <i className="fa-solid fa-check"></i>}
                        </div>
                        <span className={cn("text-xs font-medium", l.concluido && "line-through text-muted")}>
                          {l.texto}
                        </span>
                        {l.data && (
                          <span className="badge rounded-pill bg-muted text-[9px] text-muted px-1.5 py-0.5">
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
  user,
  isDarkMode,
  themeMode,
  setThemeMode,
  toggleDarkMode,
  themeColor,
  setThemeColor,
  familyMembers,
  onInvite,
  userType,
  titulares,
  cartoes,
  onAddTitular,
  onUpdateTitular,
  onDeleteTitular,
  onAddCartao,
  onUpdateCartao,
  onDeleteCartao,
  lembretes,
  onAddLembrete,
  onToggleLembrete,
  onDeleteLembrete,
  avisosConfig,
  onUpdateAvisosConfig
}: {
  isOpen: boolean;
  onClose: () => void;
  user: Profile | null;
  isDarkMode: boolean;
  themeMode: 'light' | 'dark' | 'black';
  toggleDarkMode: () => void;
  setThemeMode: (mode: 'light' | 'dark' | 'black') => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  familyMembers: Profile[];
  onInvite: (email: string) => void;
  userType: 'titular' | 'membro';
  titulares: Titular[];
  cartoes: CartaoConfig[];
  onAddTitular: (t: Omit<Titular, 'id'>) => void;
  onUpdateTitular: (id: number, t: Partial<Titular>) => void;
  onDeleteTitular: (id: number) => void;
  onAddCartao: (c: Omit<CartaoConfig, 'id'>) => void;
  onUpdateCartao: (id: number, c: Partial<CartaoConfig>) => void;
  onDeleteCartao: (id: number) => void;
  lembretes: { id: number; texto: string; concluido: boolean; data?: string }[];
  onAddLembrete: (texto: string, data?: string) => void;
  onToggleLembrete: (id: number) => void;
  onDeleteLembrete: (id: number) => void;
  avisosConfig: { vencidas: boolean; hoje: boolean; radar: boolean };
  onUpdateAvisosConfig: (key: 'vencidas' | 'hoje' | 'radar', value: boolean) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 2000 }} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
        <div className="modal-content border-0 shadow-2xl overflow-hidden rounded-[2rem] bg-card p-6 relative">
          <SettingsView
            user={user}
            isDarkMode={isDarkMode}
            themeMode={themeMode}
            toggleDarkMode={toggleDarkMode}
            setThemeMode={setThemeMode}
            themeColor={themeColor}
            setThemeColor={setThemeColor}
            familyMembers={familyMembers}
            onInvite={onInvite}
            userType={userType}
            titulares={titulares}
            cartoes={cartoes}
            onAddTitular={onAddTitular}
            onUpdateTitular={onUpdateTitular}
            onDeleteTitular={onDeleteTitular}
            onAddCartao={onAddCartao}
            onUpdateCartao={onUpdateCartao}
            onDeleteCartao={onDeleteCartao}
            lembretes={lembretes}
            onAddLembrete={onAddLembrete}
            onToggleLembrete={onToggleLembrete}
            onDeleteLembrete={onDeleteLembrete}
            avisosConfig={avisosConfig}
            onUpdateAvisosConfig={onUpdateAvisosConfig}
          />
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
