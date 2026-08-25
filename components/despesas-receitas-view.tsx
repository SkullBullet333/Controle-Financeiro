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
  const [typeFilter, setTypeFilter] = useState<'despesa' | 'receita'>('despesa');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'aberto' | 'vencido'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = (memberFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

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
        parcela: r.parcela_atual ? `${r.parcela_atual}/${r.parcela_total || 1}` : null,
        isVirtual: r.id < 0,
        sortDate
      };
    });

    return [...exp, ...inc].sort((a, b) => {
      // 1. Grupo de Status (0: Vencidos no topo, 1: Em aberto no meio, 2: Pagos/Recebidos no final)
      const getStatusPrio = (tx: any) => {
        if (tx.isOverdue) return 0;
        if (tx.status !== 'Pago' && tx.status !== 'Recebido') return 1;
        return 2;
      };

      const prioA = getStatusPrio(a);
      const prioB = getStatusPrio(b);
      if (prioA !== prioB) return prioA - prioB;

      // 2. Tipo de Lançamento (Receitas primeiro, depois Despesas)
      if (a.isIncome !== b.isIncome) {
        return a.isIncome ? -1 : 1;
      }

      // 3. Data de Vencimento/Recebimento (Próximos vencimentos para cima - Ordem Crescente)
      return a.sortDate.localeCompare(b.sortDate);
    });
  }, [despesas, receitas, titulares, cartoes, todayStr]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      // Type filter (Apenas Despesa ou Apenas Receita)
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
    <div className="space-y-3">
      {/* 1. Desktop Toolbar (Forçar flex-direction: row para manter rigorosamente na mesma linha) */}
      <div
        className="card-panel py-2 px-3.5 mb-3 d-none d-md-flex flex-row align-items-center justify-content-between w-100"
        style={{ flexDirection: 'row', gap: '10px', flexWrap: 'nowrap' }}
      >
        <div className="d-flex flex-row align-items-center gap-2 flex-nowrap flex-shrink-0 me-auto">
          {/* Busca */}
          <div className="d-flex align-items-center bg-muted/40 border border-border rounded-xl px-2.5 flex-shrink-0" style={{ width: '160px', height: '34px' }}>
            <Search className="w-3.5 h-3.5 text-muted me-1.5 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              className="form-control border-0 p-0 shadow-none bg-transparent text-xs font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="border-0 bg-transparent text-muted hover:text-foreground cursor-pointer p-0"
                onClick={() => setSearchTerm('')}
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
          </div>

          {/* Segmentação de Tipo: Apenas Receitas ou Despesas */}
          <div className="range-presets flex-shrink-0">
            <button
              type="button"
              className={cn("range-preset-btn", typeFilter === 'receita' && "active")}
              onClick={() => setTypeFilter('receita')}
            >
              <i className="fa-solid fa-arrow-down text-success text-[10px]"></i>
              <span>Receitas</span>
            </button>
            <button
              type="button"
              className={cn("range-preset-btn", typeFilter === 'despesa' && "active")}
              onClick={() => setTypeFilter('despesa')}
            >
              <i className="fa-solid fa-arrow-up text-danger text-[10px]"></i>
              <span>Despesas</span>
            </button>
          </div>

          {/* Segmentação de Status por Botões Pills */}
          <div className="range-presets flex-shrink-0">
            <button
              type="button"
              className={cn("range-preset-btn", statusFilter === 'all' && "active")}
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </button>
            <button
              type="button"
              className={cn("range-preset-btn", statusFilter === 'aberto' && "active")}
              onClick={() => setStatusFilter('aberto')}
            >
              Em Aberto
            </button>
            <button
              type="button"
              className={cn("range-preset-btn", statusFilter === 'vencido' && "active")}
              onClick={() => setStatusFilter('vencido')}
            >
              Vencidos
            </button>
            <button
              type="button"
              className={cn("range-preset-btn", statusFilter === 'pago' && "active")}
              onClick={() => setStatusFilter('pago')}
            >
              {typeFilter === 'receita' ? 'Recebidos' : 'Pagos'}
            </button>
          </div>

          {/* Segmentação de Titular por Botões Pills */}
          <div className="range-presets flex-shrink-0">
            <button
              type="button"
              className={cn("range-preset-btn", memberFilter === 'all' && "active")}
              onClick={() => setMemberFilter('all')}
            >
              Todos
            </button>
            {titulares.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn("range-preset-btn", memberFilter === String(t.id) && "active")}
                onClick={() => setMemberFilter(String(t.id))}
              >
                {t.nome}
              </button>
            ))}
          </div>

          {(searchTerm || memberFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              className="btn btn-link text-danger font-bold text-xs text-decoration-none p-0 ms-1 flex-shrink-0 whitespace-nowrap d-flex align-items-center"
              style={{ height: '34px' }}
              onClick={() => {
                setSearchTerm('');
                setMemberFilter('all');
                setStatusFilter('all');
              }}
            >
              <i className="fa-solid fa-filter-circle-xmark me-1"></i> Limpar
            </button>
          )}
        </div>

        {/* Ações estritamente alinhadas à DIREITA com altura padrão 34px */}
        <div className="d-flex align-items-center gap-2 ms-auto flex-shrink-0 flex-nowrap">
          <button
            type="button"
            className="btn-secondary d-flex align-items-center gap-1.5 text-xs px-3 rounded-xl whitespace-nowrap"
            style={{ height: '34px' }}
            onClick={onOpenExpenseSettings}
            title="Gerenciar Contas Fixas, Recorrentes e Projeções"
          >
            <Settings className="w-3.5 h-3.5 text-muted" />
            <span>Contas Fixas</span>
          </button>

          <button
            type="button"
            className="btn-primary d-flex align-items-center gap-1.5 shadow-sm text-xs px-3 rounded-xl whitespace-nowrap"
            style={{ height: '34px' }}
            onClick={() => onAdd(typeFilter)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Registro</span>
          </button>
        </div>
      </div>

      {/* 2. Mobile Toolbar (Padrão card-panel com segmentações em botões pills) */}
      <div className="card-panel py-2.5 px-3 mb-3 d-md-none space-y-2">
        <div className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center bg-muted/40 border border-border rounded-xl px-3 py-1.5 flex-grow-1">
            <Search className="w-4 h-4 text-muted me-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              className="form-control border-0 p-0 shadow-none bg-transparent text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className={cn(
              "btn btn-sm d-flex align-items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-bold text-xs transition-all shadow-sm flex-shrink-0",
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

        {/* Tipo rápido no Mobile (Receitas / Despesas) */}
        <div className="range-presets w-100 justify-content-between">
          <button
            type="button"
            className={cn("range-preset-btn flex-grow-1 justify-content-center", typeFilter === 'receita' && "active")}
            onClick={() => setTypeFilter('receita')}
          >
            <i className="fa-solid fa-arrow-down text-success text-[10px]"></i> Receitas
          </button>
          <button
            type="button"
            className={cn("range-preset-btn flex-grow-1 justify-content-center", typeFilter === 'despesa' && "active")}
            onClick={() => setTypeFilter('despesa')}
          >
            <i className="fa-solid fa-arrow-up text-danger text-[10px]"></i> Despesas
          </button>
        </div>

        {showFilters && (
          <div className="pt-2 border-top border-border/40 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Status</label>
              <div className="range-presets w-100 justify-content-between flex-wrap gap-1">
                <button type="button" className={cn("range-preset-btn flex-grow-1 text-center justify-content-center", statusFilter === 'all' && "active")} onClick={() => setStatusFilter('all')}>Todos</button>
                <button type="button" className={cn("range-preset-btn flex-grow-1 text-center justify-content-center", statusFilter === 'aberto' && "active")} onClick={() => setStatusFilter('aberto')}>Em Aberto</button>
                <button type="button" className={cn("range-preset-btn flex-grow-1 text-center justify-content-center", statusFilter === 'vencido' && "active")} onClick={() => setStatusFilter('vencido')}>Vencidos</button>
                <button type="button" className={cn("range-preset-btn flex-grow-1 text-center justify-content-center", statusFilter === 'pago' && "active")} onClick={() => setStatusFilter('pago')}>{typeFilter === 'receita' ? 'Recebidos' : 'Pagos'}</button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Titular</label>
              <div className="range-presets w-100 justify-content-between flex-wrap gap-1">
                <button type="button" className={cn("range-preset-btn flex-grow-1 text-center justify-content-center", memberFilter === 'all' && "active")} onClick={() => setMemberFilter('all')}>Todos</button>
                {titulares.map((t) => (
                  <button key={t.id} type="button" className={cn("range-preset-btn flex-grow-1 text-center justify-content-center", memberFilter === String(t.id) && "active")} onClick={() => setMemberFilter(String(t.id))}>{t.nome}</button>
                ))}
              </div>
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
                        {tx.parcela && (
                          <>
                            <span className="flex-shrink-0">•</span>
                            <span
                              className="badge-tag flex-shrink-0"
                              style={{
                                padding: '1px 5px',
                                fontSize: '9px',
                                background: 'var(--card-hover)',
                                fontWeight: 700,
                                color: 'var(--foreground)'
                              }}
                            >
                              {tx.parcela}
                            </span>
                          </>
                        )}
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
                        {tx.isOverdue && (
                          <>
                            <span className="flex-shrink-0">•</span>
                            <span className="badge-overdue text-[8px] px-1.5 py-0.5 rounded flex-shrink-0 font-bold">
                              Vencido
                            </span>
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
                <th style={{ textAlign: 'center', width: '75px' }}>Parc.</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-muted">
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
                              backgroundColor: tx.isIncome ? '#10b981' : tx.isOverdue ? '#ef4444' : 'var(--primary)',
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

                      {/* Parcela */}
                      <td style={{ textAlign: 'center' }} className="whitespace-nowrap">
                        {tx.parcela ? (
                          <span
                            className="badge-tag"
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              background: 'var(--card-hover)',
                              fontWeight: 700,
                              color: 'var(--foreground)'
                            }}
                          >
                            {tx.parcela}
                          </span>
                        ) : (
                          <span className="text-muted opacity-30 text-xs">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={cn(
                            'badge-tag',
                            tx.isOverdue ? 'badge-overdue' : isPaid ? 'badge-paid' : 'badge-pending'
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
