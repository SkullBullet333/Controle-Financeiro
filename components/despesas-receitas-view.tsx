'use client';

import React, { useState, useMemo } from 'react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Despesa, Receita, Titular, CartaoConfig, ContaFixaConfig, Emprestimo } from '@/lib/types';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Search, 
  SlidersHorizontal, 
  Plus, 
  Settings, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MoreVertical,
  Edit2,
  Trash2,
  Filter
} from 'lucide-react';

interface DespesasReceitasViewProps {
  despesas: Despesa[];
  receitas: Receita[];
  titulares: Titular[];
  cartoes: CartaoConfig[];
  contasFixas?: ContaFixaConfig[];
  emprestimos?: Emprestimo[];
  onAdd: (defaultType?: 'despesa' | 'receita') => void;
  onOpenExpenseSettings: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: number, type: 'despesa' | 'receita') => void;
  onToggleStatus: (id: number, type: 'despesa' | 'receita', currentVal: string) => void;
  onPayoff?: (itemId: number) => void;
  isHidden?: boolean;
}

export function DespesasReceitasView({
  despesas = [],
  receitas = [],
  titulares = [],
  cartoes = [],
  contasFixas = [],
  emprestimos = [],
  onAdd,
  onOpenExpenseSettings,
  onEdit,
  onDelete,
  onToggleStatus,
  onPayoff,
  isHidden = false
}: DespesasReceitasViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'despesa' | 'receita'>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'aberto' | 'vencido'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = (typeFilter !== 'all' ? 1 : 0) + (memberFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const todayStr = new Date().toISOString().split('T')[0];

  // Map and combine transactions
  const allTransactions = useMemo(() => {
    const exp = despesas.map((d) => {
      const isCard = d.isSummary || !!d.cartao_vencimento_id || d.descricao?.startsWith('Fatura ');
      const isOverdue = d.status !== 'Pago' && d.vencimento && d.vencimento < todayStr && d.vencimento !== '-';
      const titularNome = titulares.find((t) => t.id === d.titular_id)?.nome || 'Família';
      const cartaoNome = cartoes.find((c) => c.id === d.cartao_vencimento_id)?.nome_cartao;
      const cat = d.categoria || (isCard ? 'Cartão' : 'Despesas');
      const sortDate = d.vencimento && d.vencimento !== '-' ? d.vencimento : (d.competencia ? `${d.competencia.split('/')[1]}-${d.competencia.split('/')[0]}-01` : '0000-00-00');

      return {
        id: d.id,
        raw: d,
        desc: d.descricao,
        cat,
        titularId: d.titular_id,
        titular: cartaoNome ? `Cartão ${cartaoNome}` : titularNome,
        vencimento: d.vencimento && d.vencimento !== '-' ? formatDate(d.vencimento) : 'Mensal',
        rawVencimento: d.vencimento,
        status: d.status || 'Em aberto',
        isOverdue,
        isIncome: false,
        amount: Number(d.valor || 0),
        parcela: d.parcela_atual ? `${d.parcela_atual}/${d.parcela_total || 1}` : null,
        isVirtual: d.id < 0,
        sortDate
      };
    });

    const inc = receitas.map((r) => {
      const titularNome = titulares.find((t) => t.id === r.titular_id)?.nome || 'Família';
      const sortDate = r.data_recebimento ? r.data_recebimento : (r.competencia ? `${r.competencia.split('/')[1]}-${r.competencia.split('/')[0]}-01` : '0000-00-00');

      return {
        id: r.id,
        raw: r as any,
        desc: r.descricao,
        cat: r.categoria || 'Recursos',
        titularId: r.titular_id,
        titular: titularNome,
        vencimento: r.data_recebimento ? formatDate(r.data_recebimento) : 'Mensal',
        rawVencimento: r.data_recebimento,
        status: r.status || 'Recebido',
        isOverdue: false,
        isIncome: true,
        amount: Number(r.valor || 0),
        parcela: null,
        isVirtual: r.id < 0,
        sortDate
      };
    });

    return [...exp, ...inc].sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return b.sortDate.localeCompare(a.sortDate);
    });
  }, [despesas, receitas, titulares, cartoes, todayStr]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      // Type filter
      if (typeFilter === 'despesa' && tx.isIncome) return false;
      if (typeFilter === 'receita' && !tx.isIncome) return false;

      // Member filter
      if (memberFilter !== 'all' && Number(tx.titularId) !== Number(memberFilter)) return false;

      // Status filter
      if (statusFilter === 'pago') {
        if (tx.status !== 'Pago' && tx.status !== 'Recebido') return false;
      } else if (statusFilter === 'aberto') {
        if (tx.status === 'Pago' || tx.status === 'Recebido' || tx.isOverdue) return false;
      } else if (statusFilter === 'vencido') {
        if (!tx.isOverdue) return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesDesc = tx.desc?.toLowerCase().includes(term);
        const matchesCat = tx.cat?.toLowerCase().includes(term);
        const matchesTitular = tx.titular?.toLowerCase().includes(term);
        if (!matchesDesc && !matchesCat && !matchesTitular) return false;
      }

      return true;
    });
  }, [allTransactions, typeFilter, memberFilter, statusFilter, searchTerm]);

  // Totals calculations
  const totalReceitas = useMemo(() => {
    return receitas.reduce((sum, r) => sum + Number(r.valor || 0), 0);
  }, [receitas]);

  const totalDespesas = useMemo(() => {
    return despesas.reduce((sum, d) => sum + Number(d.valor || 0), 0);
  }, [despesas]);

  const saldoLiquido = totalReceitas - totalDespesas;

  return (
    <div className="space-y-4">
      {/* 1. Desktop Toolbar (Horizontal) */}
      <div className="d-none d-md-flex align-items-center justify-content-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
        <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
          <div className="d-flex align-items-center bg-muted/40 border border-border rounded-xl px-3 py-2" style={{ minWidth: '220px', maxWidth: '320px' }}>
            <Search className="w-4 h-4 text-muted me-2" />
            <input
              type="text"
              placeholder="Buscar lançamento..."
              className="form-control border-0 p-0 shadow-none bg-transparent text-sm font-medium"
              style={{ fontSize: '0.85rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="border-0 bg-transparent text-muted hover:text-foreground cursor-pointer p-0"
                onClick={() => setSearchTerm('')}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          <select
            className="form-select text-sm font-medium border-border rounded-xl bg-card"
            style={{ width: 'auto', minWidth: '150px', padding: '8px 12px' }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="all">Todos os Tipos</option>
            <option value="despesa">Apenas Despesas</option>
            <option value="receita">Apenas Receitas</option>
          </select>

          <select
            className="form-select text-sm font-medium border-border rounded-xl bg-card"
            style={{ width: 'auto', minWidth: '160px', padding: '8px 12px' }}
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
          >
            <option value="all">Todos os Titulares</option>
            {titulares.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>

          <select
            className="form-select text-sm font-medium border-border rounded-xl bg-card"
            style={{ width: 'auto', minWidth: '150px', padding: '8px 12px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">Todos os Status</option>
            <option value="pago">Pago / Recebido</option>
            <option value="aberto">Em Aberto</option>
            <option value="vencido">Vencidos</option>
          </select>

          {(searchTerm || typeFilter !== 'all' || memberFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              className="btn btn-link text-danger font-bold text-xs text-decoration-none p-0 ms-1"
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('all');
                setMemberFilter('all');
                setStatusFilter('all');
              }}
            >
              <i className="fa-solid fa-filter-circle-xmark me-1"></i> Limpar
            </button>
          )}
        </div>

        <div className="d-flex align-items-center gap-2 ms-auto">
          <button
            type="button"
            className="btn-secondary d-flex align-items-center gap-2 text-xs py-2 px-3"
            onClick={onOpenExpenseSettings}
            title="Gerenciar Contas Fixas, Recorrentes e Projeções"
          >
            <Settings className="w-4 h-4 text-muted" />
            <span className="d-none d-sm-inline">Contas Fixas</span>
          </button>

          <button
            type="button"
            className="btn-primary d-flex align-items-center gap-2 shadow-sm text-xs py-2 px-3"
            onClick={() => onAdd('despesa')}
          >
            <Plus className="w-4 h-4" />
            <span>Novo Registro</span>
          </button>
        </div>
      </div>

      {/* 2. Mobile Toolbar (Com ícone de ocultar/mostrar segmentações verticais) */}
      <div className="d-md-none space-y-2.5 bg-card p-3 rounded-2xl border border-border shadow-sm">
        <div className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center bg-muted/40 border border-border rounded-xl px-3 py-2 flex-grow-1">
            <Search className="w-4 h-4 text-muted me-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              className="form-control border-0 p-0 shadow-none bg-transparent text-sm font-medium"
              style={{ fontSize: '0.85rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className={cn(
              "btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 rounded-xl border font-bold text-xs transition-all shadow-sm flex-shrink-0",
              showFilters || activeFiltersCount > 0 
                ? "bg-primary text-white border-primary" 
                : "bg-card-hover border-border text-foreground"
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="badge rounded-pill bg-white text-dark px-1.5 py-0.5 text-[9px] font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="pt-2 border-top border-border/40 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Tipo</label>
              <select className="form-select text-xs font-medium border-border rounded-xl bg-card w-100" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                <option value="all">Todos os Tipos</option>
                <option value="despesa">Apenas Despesas</option>
                <option value="receita">Apenas Receitas</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Titular</label>
              <select className="form-select text-xs font-medium border-border rounded-xl bg-card w-100" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
                <option value="all">Todos os Titulares</option>
                {titulares.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Status</label>
              <select className="form-select text-xs font-medium border-border rounded-xl bg-card w-100" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">Todos os Status</option>
                <option value="pago">Pago / Recebido</option>
                <option value="aberto">Em Aberto</option>
                <option value="vencido">Vencidos</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 4. Table Card Panel */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">
              <i className="fa-solid fa-table-list text-primary"></i>
              <span>Lançamentos Consolidados</span>
            </h3>
            <span className="panel-subtitle">
              Exibindo {filteredTransactions.length} de {allTransactions.length} registros no período
            </span>
          </div>
        </div>

        {/* Mobile View: Lista de Cards Nativos (Sem rolagem horizontal e sem quebra de texto) */}
        <div className="d-md-none space-y-2 max-h-[580px] overflow-y-auto custom-scrollbar p-1">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <i className="fa-regular fa-folder-open fs-2 mb-2 d-block opacity-40"></i>
              Nenhum lançamento encontrado.
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isPaid = tx.status === 'Pago' || tx.status === 'Recebido';

              return (
                <div
                  key={`mob-${tx.isIncome ? 'inc' : 'exp'}-${tx.id}`}
                  className={cn(
                    "bg-card border border-border rounded-2xl p-3 d-flex align-items-center justify-content-between gap-2.5 transition-all shadow-sm",
                    isPaid && "opacity-90"
                  )}
                >
                  {/* Checkbox + Info */}
                  <div className="d-flex align-items-center gap-2.5 flex-grow min-w-0">
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0 border-0 shadow-none flex-shrink-0"
                      onClick={() => onToggleStatus(tx.id, tx.isIncome ? 'receita' : 'despesa', tx.status)}
                      title={isPaid ? "Marcado como concluído" : "Marcar como concluído"}
                    >
                      <div
                        className={cn(
                          "rounded-md d-flex align-items-center justify-content-center transition-all",
                          isPaid ? "text-white shadow-sm" : "border border-border bg-card text-transparent"
                        )}
                        style={{
                          width: '24px',
                          height: '24px',
                          backgroundColor: isPaid ? '#10b981' : 'transparent',
                          borderColor: isPaid ? '#10b981' : undefined
                        }}
                      >
                        <i className="fa-solid fa-check text-xs font-black"></i>
                      </div>
                    </button>

                    <div className="min-w-0 flex-grow" onClick={() => onEdit(tx.raw)}>
                      <div className="d-flex align-items-center gap-1.5 mb-0.5">
                        <span className={cn("font-bold text-xs text-foreground truncate", isPaid && "line-through text-muted-foreground")}>
                          {tx.desc}
                        </span>
                        {tx.isVirtual && (
                          <span className="badge bg-muted text-muted-foreground text-[8px] px-1 py-0.5 rounded flex-shrink-0">
                            Virtual
                          </span>
                        )}
                      </div>

                      <div className="d-flex align-items-center gap-1.5 text-[10px] text-muted flex-nowrap overflow-hidden">
                        <span className="flex-shrink-0">{tx.vencimento}</span>
                        <span className="flex-shrink-0">•</span>
                        <span
                          className="badge-tag truncate flex-shrink-0"
                          style={{
                            padding: '1px 5px',
                            fontSize: '9px',
                            maxWidth: '90px',
                            display: 'inline-block'
                          }}
                          title={tx.cat}
                        >
                          {tx.cat}
                        </span>
                        {tx.titular && (
                          <>
                            <span className="flex-shrink-0">•</span>
                            <span className="text-muted-foreground truncate" style={{ maxWidth: '85px' }}>{tx.titular}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Valor & Ações */}
                  <div className="d-flex flex-column align-items-end flex-shrink-0">
                    <span 
                      className="font-bold text-xs"
                      style={{ color: tx.isIncome ? '#10b981' : '#ef4444' }}
                    >
                      {isHidden ? '••••••' : `${tx.isIncome ? '+' : '-'} ${formatCurrency(tx.amount)}`}
                    </span>

                    <div className="d-flex align-items-center gap-1 mt-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0.5 text-muted hover:text-primary"
                        onClick={() => onEdit(tx.raw)}
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0.5 text-muted hover:text-danger"
                        onClick={() => onDelete(tx.id, tx.isIncome ? 'receita' : 'despesa')}
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Tabela Completa */}
        <div className="table-responsive custom-scrollbar d-none d-md-block" style={{ maxHeight: '560px', overflowY: 'auto' }}>
          <table className="styled-table" style={{ position: 'relative' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card, #0f1016)' }}>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}></th>
                <th>Data/Venc.</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Titular</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted">
                    <i className="fa-regular fa-folder-open fs-2 mb-2 d-block opacity-40"></i>
                    Nenhum lançamento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isPaid = tx.status === 'Pago' || tx.status === 'Recebido';

                  return (
                    <tr key={`${tx.isIncome ? 'inc' : 'exp'}-${tx.id}`} className={cn("transition-colors", isPaid && "opacity-95")}>
                      {/* Caixa de Seleção / Status Checkbox Verde */}
                      <td style={{ textAlign: 'center', width: '40px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 border-0 shadow-none"
                          onClick={() => onToggleStatus(tx.id, tx.isIncome ? 'receita' : 'despesa', tx.status)}
                          title={isPaid ? (tx.isIncome ? "Recebido (clique para reabrir)" : "Pago (clique para reabrir)") : (tx.isIncome ? "Marcar como Recebido" : "Marcar como Pago")}
                        >
                          <div
                            className={cn(
                              "rounded-md d-flex align-items-center justify-content-center transition-all cursor-pointer",
                              isPaid
                                ? "text-white shadow-sm"
                                : "border border-border bg-card text-transparent hover:border-primary"
                            )}
                            style={{
                              width: '22px',
                              height: '22px',
                              backgroundColor: isPaid ? '#10b981' : 'transparent',
                              borderColor: isPaid ? '#10b981' : undefined
                            }}
                          >
                            <i className="fa-solid fa-check text-[11px] font-black"></i>
                          </div>
                        </button>
                      </td>

                      {/* Data */}
                      <td className="font-semibold text-xs whitespace-nowrap text-foreground">
                        {tx.vencimento}
                      </td>

                      {/* Tipo */}
                      <td>
                        <span className={cn(
                          "badge-tag",
                          tx.isIncome ? "badge-paid" : "badge-pending"
                        )} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                          {tx.isIncome ? 'Receita' : 'Despesa'}
                        </span>
                      </td>

                      {/* Descrição */}
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: tx.isIncome ? '#10b981' : tx.isOverdue ? '#ef4444' : '#3b82f6',
                              display: 'inline-block',
                              flexShrink: 0
                            }}
                          />
                          <span className={cn("font-bold text-sm text-foreground", isPaid && "text-muted-foreground line-through opacity-80")}>
                            {tx.desc}
                          </span>
                          {tx.isVirtual && (
                            <span 
                              className="badge rounded-pill bg-muted text-muted-foreground border border-border" 
                              style={{ fontSize: '9px', padding: '1px 5px' }}
                              title="Lançamento Projetado/Recorrente"
                            >
                              Virtual
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Categoria */}
                      <td>
                        <span className="badge-tag" style={{ background: 'var(--card-hover)', color: 'var(--text-muted)' }}>
                          {tx.cat}
                        </span>
                      </td>

                      {/* Titular */}
                      <td className="text-sm font-medium text-muted-foreground">
                        {tx.titular}
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={cn(
                            'badge-tag',
                            tx.isOverdue ? 'badge-danger' : isPaid ? 'badge-paid' : 'badge-pending'
                          )}
                          style={{ cursor: 'pointer' }}
                          onClick={() => onToggleStatus(tx.id, tx.isIncome ? 'receita' : 'despesa', tx.status)}
                          title="Clique para alternar status"
                        >
                          {tx.isOverdue ? 'Vencido' : isPaid ? (tx.isIncome ? 'Recebido' : 'Pago') : 'Em aberto'}
                        </span>
                      </td>

                      {/* Valor */}
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: tx.isIncome ? '#10b981' : '#ef4444',
                          fontSize: '0.92rem'
                        }}
                      >
                        {isHidden
                          ? '••••••••'
                          : `${tx.isIncome ? '+' : '-'} ${formatCurrency(tx.amount)}`}
                      </td>

                      {/* Ações */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="d-flex align-items-center justify-content-center gap-1">
                          {/* Edit */}
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 text-muted hover:text-primary"
                            onClick={() => onEdit(tx.raw)}
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 text-muted hover:text-danger"
                            onClick={() => onDelete(tx.id, tx.isIncome ? 'receita' : 'despesa')}
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
