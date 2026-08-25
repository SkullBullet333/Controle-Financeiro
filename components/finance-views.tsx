'use client';

import Image from 'next/image';
import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { addMonths, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { CardLogo } from './card-ui';
import { Despesa, Receita, CartaoTransacao, CartaoConfig, Titular, Status, Categoria } from '@/lib/types';

interface TableViewProps {
  data: any[]; // Voltar para any temporariamente ou usar union restrito
  type: 'geral' | 'cartoes' | 'receitas';
  onDelete: (id: number) => void;
  onToggleStatus?: (id: number, currentVal: any) => void;
  onEdit?: (item: any) => void;
  onInlineUpdate?: (id: number, updates: any) => void;
  titulares: Titular[];
  cartoes: CartaoConfig[];
  onPayoff?: (loanId: number) => void;
}

export function FinanceTable({ 
  data = [], 
  type, 
  onDelete, 
  onToggleStatus, 
  onEdit, 
  onInlineUpdate,
  titulares = [], 
  cartoes = [], 
  onPayoff 
}: TableViewProps) {
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editValues, setEditValues] = React.useState<any>({});
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());

  // Listener para ESC e clique fora
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    const handleClickOutside = (e: MouseEvent) => {
      // Se clicar no botão de fechar do modal ou outros elementos de UI, não limpa
      const target = e.target as HTMLElement;
      if (target.closest('.modal') || target.closest('.btn-close')) return;
      
      setSelectedIds(new Set());
    };
    
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const headers = {
    geral: ['Status', 'Titular', 'Descrição', 'Categoria', 'Vencimento', 'Parc.', 'Valor', 'Ações'],
    cartoes: ['Cartão', 'Titular', 'Estabel.', 'Categoria', 'Parc.', 'Valor', 'Ações'],
    receitas: ['Status', 'Data', 'Titular', 'Descrição', 'Valor', 'Ações']
  };

  const currentHeaders = headers[type];

  const getTitularName = (id: number) => titulares.find(t => t.id === id)?.nome || 'N/A';
  const getCartaoName = (id: number) => cartoes.find(c => c.id === id)?.nome_cartao || 'N/A';

  return (
    <div className="bg-card rounded-4 border border-border shadow-sm overflow-hidden">
      <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        
        {/* Mobile List View - Sicoob Style */}
        <div className="d-md-none p-1">
          {(data || []).length === 0 ? (
            <div className="p-5 text-center text-muted italic">Nenhum registro encontrado.</div>
          ) : (
            data.map((item) => {
              if (!item) return null;
              const itemId = (item as any).id;
              const isReceita = type === 'receitas';
              const isCartao = type === 'cartoes';
              const isSummary = (item as any).isSummary;
              
              const title = (item as any).descricao || (item as any).estabelecimento || 'Resumo';
              const status = (item as any).status;
              const valor = (item as any).valor;
              const date = (item as any).vencimento || (item as any).data_recebimento || (item as any).data_compra || '-';
              
              // Icon definition
              let iconContent = null;
              if (isCartao && !isSummary) {
                 const cartaoName = getCartaoName((item as any).cartao_id);
                 iconContent = <CardLogo name={cartaoName} size="sm" />;
              } else {
                 const iconClass = isReceita ? "fa-arrow-down text-success" : (isSummary ? "fa-chart-pie text-primary" : "fa-arrow-up text-danger");
                 iconContent = <i className={cn("fa-solid", iconClass)}></i>;
              }
              const iconBg = isCartao ? "" : (isReceita ? "bg-success bg-opacity-10" : (isSummary ? "bg-primary bg-opacity-10" : "bg-danger bg-opacity-10"));

              return (
                <div 
                  key={itemId}
                  className="sicoob-list-item cursor-pointer mb-2 hover:bg-muted/30 transition-all active:scale-[0.98]"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSummary) return;

                    const isPayable = ((item as any).emprestimo_id || ((item as any).conta_fixa_id && (item as any).parcela_total > 0)) && (item as any).status !== 'Pago';
                    
                    if (isPayable && onPayoff) {
                      onPayoff(itemId);
                    } else {
                      onEdit?.(item);
                    }
                  }}
                >
                  <div className={cn("sicoob-list-icon shadow-sm", iconBg, isCartao ? "p-0 bg-transparent border-0" : "")}>
                    {isCartao && !isSummary ? (
                       <CardLogo name={getCartaoName((item as any).cartao_id)} size="sm" />
                    ) : (
                       <i className={cn("fa-solid", isReceita ? "fa-arrow-down text-success" : (isSummary ? "fa-chart-pie text-primary" : "fa-arrow-up text-danger"), "text-xs")}></i>
                    )}
                  </div>
                  <div className="sicoob-list-content">
                    <div className={cn("fw-bold text-foreground text-truncate leading-tight", isSummary ? "text-primary" : "")} style={{ fontSize: '0.85rem' }}>
                      {title}
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-0.5">
                      {date !== '-' && (
                        <span className="text-[10px] font-medium text-muted-foreground">{formatDate(date)}</span>
                      )}
                      {!isSummary && status && (
                        <>
                          <span className="text-muted-foreground/30 text-[8px]">●</span>
                          <span className={cn(
                            "font-black text-[8px] tracking-tighter uppercase",
                            status === 'Pago' || status === 'Recebido' ? "text-success" : "text-warning"
                          )}>
                            {status}
                          </span>
                        </>
                      )}
                      {!isSummary && isCartao && (item as any).parcela_total > 1 && (
                        <span className="text-[8px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          {(item as any).parcela_atual}/{(item as any).parcela_total}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="sicoob-list-value d-flex align-items-center gap-2">
                    <div className={cn("fw-black text-sm tracking-tight", isReceita ? "text-success" : "text-foreground")}>
                      {isReceita ? '+' : ''}{formatCurrency(valor)}
                    </div>
                    {(type === 'geral' || (type === 'cartoes' && isSummary)) && !isReceita && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStatus?.(itemId, status);
                        }}
                        className={cn(
                          "btn btn-sm p-1 border-0 shadow-none",
                          status === 'Pago' ? "text-success" : "text-muted-foreground opacity-30"
                        )}
                      >
                        <i className={cn("fa-solid", status === 'Pago' ? "fa-circle-check" : "fa-circle", "fs-5")}></i>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Standard Desktop Table */}
        <table className="table table-hover align-middle mb-0 d-none d-md-table">

          <thead className="table-light">
            <tr>
              {currentHeaders.map(h => (
                <th 
                  key={h} 
                  className={cn(
                    "px-2 px-md-4 py-3 text-uppercase small fw-bold text-muted border-0",
                    h === 'Ações' && "text-center",
                    (h === 'Titular' || h === 'Categoria' || h === 'Parc.' || h === 'Data') && "d-none d-md-table-cell"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data || []).length === 0 ? (
              <tr>
                <td colSpan={currentHeaders?.length || 8} className="p-5 text-center text-muted italic">
                  Nenhum registro encontrado para este período.
                </td>
              </tr>
            ) : (
              data.map((item) => {
                if (!item) return null;
                const itemId = (item as any).id;
                const isSelected = selectedIds.has(itemId);

                return (
                  <tr
                    key={itemId}
                    className={cn(
                      "cursor-pointer transition-all",
                      isSelected && "table-primary-subtle border-primary-subtle",
                      (item as any).isSummary && "fw-bold",
                      type === 'geral' && (item as any).status !== 'Pago' && (item as any).vencimento && (item as any).vencimento < format(new Date(), 'yyyy-MM-dd') && "row-vencido"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(itemId)) next.delete(itemId);
                        else next.add(itemId);
                        return next;
                      });
                    }}
                    onDoubleClick={() => {
                      if ((item as any).isSummary) return;
                      // Apenas permite edição em linha para registros físicos (id > 0)
                      if ((type === 'cartoes' || type === 'geral' || type === 'receitas') && onInlineUpdate && itemId > 0) {
                        setEditingId(itemId);
                        setEditValues({
                          descricao: (item as any).descricao || (item as any).estabelecimento,
                          valor: (item as any).valor
                        });
                      } else {
                        onEdit?.(item);
                      }
                    }}
                  >
                    {type === 'geral' && (
                      <>
                        <td className="px-2 px-md-4 py-3">
                          {(() => {
                            if (item.status === 'Pago') return <span className="status-pago">Pago</span>;

                            const todayStr = format(new Date(), 'yyyy-MM-dd');
                            if (item.vencimento && item.vencimento !== '-') {
                              if (item.vencimento < todayStr) return <span className="status-vencida">Vencida</span>;
                              if (item.vencimento === todayStr) return <span className="status-hoje">Hoje</span>;
                            }

                            return <span className="status-aberto">Em aberto</span>;
                          })()}
                        </td>
                        <td className="px-2 px-md-4 py-3 fw-bold d-none d-md-table-cell">{getTitularName((item as any).titular_id)}</td>
                        <td className={cn("px-2 px-md-4 py-3", (item as any).isSummary && "fw-bold")}>
                          {editingId === (item as any).id ? (
                            <input
                              autoFocus
                              className="form-control form-control-sm"
                              value={editValues.descricao}
                              onChange={e => setEditValues({ ...editValues, descricao: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onInlineUpdate?.((item as any).id, editValues);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          ) : (
                            (item as any).descricao
                          )}
                        </td>
                        <td className="px-2 px-md-4 py-3 d-none d-md-table-cell"><span className="badge bg-light text-dark text-uppercase">{(item as any).categoria || 'OUTROS'}</span></td>
                        <td className="px-2 px-md-4 py-3 text-muted">{formatDate((item as any).vencimento)}</td>
                        <td className="px-2 px-md-4 py-3 small text-muted d-none d-md-table-cell">{(item as any).parcela_atual}/{(item as any).parcela_total}</td>
                        <td className="px-2 px-md-4 py-3 fw-bold">
                          {editingId === (item as any).id ? (
                            <input
                              type="number"
                              className="form-control form-control-sm fw-bold"
                              value={editValues.valor}
                              onChange={e => setEditValues({ ...editValues, valor: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onInlineUpdate?.((item as any).id, editValues);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          ) : (
                            formatCurrency((item as any).valor)
                          )}
                        </td>
                      </>
                    )}

                    {type === 'cartoes' && (
                      <>
                        <td className="px-4 py-3 fw-bold text-primary">
                          <div className="d-flex align-items-center gap-2">
                            <CardLogo name={getCartaoName((item as any).cartao_id)} size="sm" />
                            <span>{getCartaoName((item as any).cartao_id)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getTitularName((item as any).titular_id)}</td>
                        <td className="px-4 py-3">
                          {editingId === (item as any).id ? (
                            <input
                              autoFocus
                              className="form-control form-control-sm"
                              value={editValues.descricao}
                              onChange={e => setEditValues({ ...editValues, descricao: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onInlineUpdate?.((item as any).id, editValues);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          ) : (
                            (item as any).estabelecimento
                          )}
                        </td>
                        <td className="px-4 py-3"><span className="badge bg-light text-dark text-uppercase">{(item as any).categoria || 'OUTROS'}</span></td>
                        <td className="px-4 py-3 small text-muted">{(item as any).parcela_atual}/{(item as any).parcela_total}</td>
                        <td className="px-4 py-3 fw-bold">
                          {editingId === (item as any).id ? (
                            <input
                              type="number"
                              className="form-control form-control-sm fw-bold"
                              value={editValues.valor}
                              onChange={e => setEditValues({ ...editValues, valor: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onInlineUpdate?.((item as any).id, editValues);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          ) : (
                            formatCurrency((item as any).valor)
                          )}
                        </td>
                      </>
                    )}

                    {type === 'receitas' && (
                      <>
                        <td className="px-2 px-md-4 py-3">
                          <span className={cn(
                            (item as any).status === 'Recebido' ? "status-pago" : "status-aberto"
                          )}>
                            {(item as any).status || 'Recebido'}
                          </span>
                        </td>
                        <td className="px-2 px-md-4 py-3 text-muted d-none d-md-table-cell">{formatDate((item as any).data_recebimento)}</td>
                        <td className="px-2 px-md-4 py-3 fw-bold d-none d-md-table-cell">{getTitularName((item as any).titular_id)}</td>
                        <td className="px-2 px-md-4 py-3 text-success fw-bold">
                          {editingId === (item as any).id ? (
                            <input
                              autoFocus
                              className="form-control form-control-sm"
                              value={editValues.descricao}
                              onChange={e => setEditValues({ ...editValues, descricao: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onInlineUpdate?.((item as any).id, editValues);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          ) : (
                            (item as any).descricao
                          )}
                        </td>
                        <td className="px-2 px-md-4 py-3 fw-bold">
                          {editingId === (item as any).id ? (
                            <input
                              type="number"
                              className="form-control form-control-sm fw-bold"
                              value={editValues.valor}
                              onChange={e => setEditValues({ ...editValues, valor: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onInlineUpdate?.((item as any).id, editValues);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          ) : (
                            formatCurrency((item as any).valor)
                          )}
                        </td>
                      </>
                    )}

                    <td className="px-4 py-3 text-center">
                      <div className="d-flex align-items-center justify-content-center gap-1">
                        {editingId === (item as any).id ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onInlineUpdate?.((item as any).id, editValues);
                                setEditingId(null);
                              }}
                              className="btn btn-sm btn-success border-0"
                              title="Salvar"
                            >
                              <i className="fa-solid fa-check"></i>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(null);
                              }}
                              className="btn btn-sm btn-light border-0"
                              title="Cancelar"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </>
                        ) : (
                          <>
                            {type === 'geral' && (
                          <>
                            <button
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                onToggleStatus?.((item as any).id, (item as any).status);
                              }}
                              className={cn(
                                "btn btn-sm border-0",
                                (item as any).status === 'Pago' ? "text-success" : "text-muted"
                              )}
                              title={(item as any).status === 'Pago' ? "Marcar como Aberto" : "Marcar como Pago"}
                            >
                              <i className={cn("fa-solid", (item as any).status === 'Pago' ? "fa-circle-check" : "fa-circle")}></i>
                            </button>
                            
                            {((item as any).emprestimo_id || ((item as any).conta_fixa_id && (item as any).parcela_total > 0)) && (item as any).status !== 'Pago' && (
                              <button
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  onPayoff?.((item as any).id);
                                }}
                                className="btn btn-sm text-amber-600 hover:text-amber-700 border-0"
                                title="Simular Quitação / Antecipação"
                              >
                                <i className="fa-solid fa-hand-holding-dollar"></i>
                              </button>
                            )}
                          </>
                        )}
                        {type === 'receitas' && (
                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              onToggleStatus?.((item as any).id, (item as any).status);
                            }}
                            className={cn(
                              "btn btn-sm border-0",
                              (item as any).status === 'Recebido' ? "text-success" : "text-muted"
                            )}
                            title={(item as any).status === 'Recebido' ? "Marcar como Pendente" : "Marcar como Recebido"}
                          >
                            <i className={cn("fa-solid", (item as any).status === 'Recebido' ? "fa-circle-check" : "fa-circle")}></i>
                          </button>
                        )}
                        {!(item as any).isSummary && (
                          <>
                            <button
                              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete((item as any).id); }}
                              className="btn btn-sm btn-outline-danger border-0"
                              title="Excluir"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </>
                        )}
                      </>
                    )}
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
  );
}

export function FilterBar({
  onAdd,
  searchTerm,
  onSearchChange,
  activeFilterId,
  onClearFilter,
  type,
  hideAdd,
  hideSearch,
  onFocus,
  onBlur,
  onAction,
  onOpenExpenseSettings,
  actionLabel,
  actionIcon
}: {
  onAdd: () => void,
  searchTerm: string,
  onSearchChange: (value: string) => void,
  activeFilterId?: number | null,
  onClearFilter?: () => void,
  type?: 'geral' | 'cartoes' | 'receitas',
  hideAdd?: boolean,
  hideSearch?: boolean,
  onFocus?: () => void,
  onBlur?: () => void,
  onAction?: () => void,
  onOpenExpenseSettings?: () => void,
  actionLabel?: string,
  actionIcon?: string
}) {
  return (
    <div className="d-flex align-items-center justify-content-between mb-4 gap-2">
      <div className="d-flex align-items-center gap-2 flex-grow-1">
        {!hideSearch && (
          <div className="d-flex align-items-center bg-card border border-border rounded-4 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary flex-grow-1" style={{ maxWidth: '400px' }}>
            <div className="px-3 text-muted">
              <i className="fa-solid fa-magnifying-glass fs-6"></i>
            </div>
            <input
              type="text"
              className="form-control border-0 px-0 shadow-none bg-transparent h-100 py-2 font-medium"
              style={{ boxShadow: 'none', fontSize: '0.85rem' }}
              placeholder="O que você procura?"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
            />
            <div 
              className={cn("px-3 text-muted", searchTerm ? "cursor-pointer hover:text-danger transition-colors" : "")}
              onClick={() => searchTerm && onSearchChange('')}
            >
              {searchTerm && <i className="fa-solid fa-xmark"></i>}
            </div>
          </div>
        )}

        {activeFilterId !== null && onClearFilter && (
          <button
            onClick={onClearFilter}
            className="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-2 border-2"
          >
            <i className="fa-solid fa-filter-circle-xmark"></i> {hideSearch ? 'Filtrado por Titular' : 'Limpar Filtro'}
          </button>
        )}
      </div>

      <div className="d-flex align-items-center gap-2 ms-2">
        {onOpenExpenseSettings && (type === 'geral' || type === 'receitas' || type === 'cartoes') && (
          <button
            onClick={onOpenExpenseSettings}
            className="btn btn-outline-secondary rounded-4 p-0 d-flex align-items-center justify-content-center shadow-sm bg-card"
            style={{ width: '42px', height: '42px', border: '1px solid var(--border)' }}
            title="Configurações"
          >
            <i className="fa-solid fa-gear text-muted fs-5"></i>
          </button>
        )}
        {!hideAdd && (
          <button
            onClick={onAdd}
            className="btn btn-primary rounded-4 p-0 d-none d-md-flex align-items-center justify-content-center shadow-lg hover:scale-110 active:scale-95 transition-all border-0"
            style={{ width: '42px', height: '42px' }}
            title="Novo Lançamento"
          >
            <i className="fa-solid fa-plus fs-5"></i>
          </button>
        )}
      </div>
    </div>
  );
}

export function CardProjectionChart({ 
  cardId, 
  allTransacoes, 
  currentMonth, 
  currentYear,
  inline = false
}: { 
  cardId: number | null, 
  allTransacoes: CartaoTransacao[],
  currentMonth: number,
  currentYear: number,
  inline?: boolean
}) {
  const data = React.useMemo(() => {
    const projection = [];
    let tMonth = currentMonth;
    let tYear = currentYear;

    for (let i = 0; i < 8; i++) {
      const comp = `${String(tMonth).padStart(2, '0')}/${tYear}`;
      const total = allTransacoes
        .filter(c => (cardId === null || Number(c.cartao_id) === Number(cardId)) && c.competencia === comp)
        .reduce((acc, c) => acc + Number(c.valor), 0);
      
      const date = new Date(tYear, tMonth - 1, 1);
      projection.push({
        mes: format(date, 'MMM', { locale: ptBR }),
        valor: total
      });

      tMonth++;
      if (tMonth > 12) {
        tMonth = 1;
        tYear++;
      }
    }
    return projection;
  }, [cardId, allTransacoes, currentMonth, currentYear]);

  return (
    <div className={cn(
      "bg-card border border-border shadow-2xl rounded-2xl p-4",
      inline ? "w-100 shadow-sm border-border mb-3" : "w-[500px] h-[260px]"
    )}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="text-xs font-bold text-slate-500 uppercase tracking-wider m-0">Projeção de Fatura (8 Meses)</h6>
        <span className="text-[10px] bg-primary bg-opacity-10 text-primary px-2 py-0.5 rounded-full font-bold">Estimado</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 25, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
          <XAxis 
            dataKey="mes" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: 'var(--gray)', fontWeight: 600 }}
          />
          <YAxis hide />
          <RechartsTooltip 
            formatter={(value: number) => [formatCurrency(value), 'Fatura']}
            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px', fontSize: '11px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]} barSize={40}>
            <LabelList 
              dataKey="valor" 
              position="top" 
              fontSize={9} 
              fontWeight={700}
              formatter={(val: number) => val > 0 ? formatCurrency(val).replace('R$', '').trim() : ''} 
              fill="var(--text)"
            />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'var(--border)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SummaryCards({
  type,
  cartoes,
  titulares,
  totalsByCard,
  totalsByTitular,
  radarTotalsByTitular,
  totalVencido,
  activeFilterId,
  onFilterChange,
  allCartaoTransacoes = [],
  currentMonth = new Date().getMonth() + 1,
  currentYear = new Date().getFullYear(),
  onOpenPeriodModal
}: {
  type: 'geral' | 'cartoes' | 'receitas' | 'radar',
  cartoes: any[],
  titulares: any[],
  totalsByCard: Record<number, number>,
  totalsByTitular: Record<number, { despesas: number, receitas: number }>,
  radarTotalsByTitular?: Record<number, { cards: number, others: number, total: number }>,
  totalVencido?: number,
  activeFilterId: number | null,
  onFilterChange: (id: number | null) => void,
  allCartaoTransacoes?: CartaoTransacao[],
  currentMonth?: number,
  currentYear?: number,
  onOpenPeriodModal?: () => void
}) {
  const [hoveredCardId, setHoveredCardId] = React.useState<number | null>(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

  const isSelected = (id: number | null) => activeFilterId === id;

  const totalGeral = React.useMemo(() => {
    if (type === 'cartoes') {
      return Object.values(totalsByCard).reduce((acc, val) => acc + val, 0);
    }
    return Object.values(totalsByTitular).reduce((acc, val) => acc + (type === 'geral' ? val.despesas : val.receitas), 0);
  }, [type, totalsByCard, totalsByTitular]);

  return (
    <div className="flex flex-col gap-2 mb-3">
      {/* Mobile Period Selector Pill - Fallback for non-dashboard views */}
      {currentMonth && currentYear && onOpenPeriodModal && (
        <div className="d-md-none d-flex gap-2 mb-2">
          <div className="bg-primary/10 text-primary rounded-pill px-2.5 py-1.5 d-flex align-items-center gap-1.5 flex-grow-1 border border-primary/20">
            <i className="fa-regular fa-calendar-check text-sm opacity-70"></i>
            <span className="font-black text-[9px] tracking-widest text-uppercase text-foreground">Este Mês: {months[currentMonth-1]} {currentYear}</span>
          </div>
          <button 
            onClick={onOpenPeriodModal}
            className="bg-card border border-border text-muted-foreground rounded-pill px-2.5 py-1.5 d-flex align-items-center gap-1.5 transition-all active:scale-95 shadow-sm"
          >
            <span className="font-black text-[9px] tracking-widest text-uppercase">Escolha Mês</span>
            <i className="fa-solid fa-chevron-down text-[8px] opacity-50"></i>
          </button>
        </div>
      )}

      <div className="row g-2">
      {/* Card de Total Geral - Apenas para Receitas conforme solicitado */}
      {type === 'receitas' && (
        <div className="col-6 col-sm-6 col-md">
          <div
            onClick={() => onFilterChange(null)}
            className={cn(
              "card p-3 shadow-sm card-click card-segmento-filtro transition-all h-100",
              isSelected(null) ? "border-primary border-2 shadow-md" : "border-border"
            )}
          >
            <div className="d-flex align-items-center justify-content-start gap-2">
              <div className="bg-success bg-opacity-10 text-success rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px' }}>
                <i className="fa-solid fs-4 fa-money-bill-trend-up"></i>
              </div>
              <div>
                <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Total Receitas</small>
                <strong className="h5 fw-bold m-0 text-success">{formatCurrency(totalGeral)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}


      {type === 'geral' && totalVencido !== undefined && totalVencido > 0 && (
        <div className="col-6 col-sm-6 col-md">
          <div className="card p-3 shadow-sm card-click card-segmento-filtro h-100" style={{ borderLeft: '5px solid var(--danger)' }}>
            <div className="d-flex align-items-center justify-content-start gap-2">
              <div className="bg-danger bg-opacity-10 text-danger rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px' }}>
                <i className="fa-solid fa-triangle-exclamation fs-4"></i>
              </div>
              <div>
                <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Vencido</small>
                <strong className="text-danger h5 fw-bold m-0">{formatCurrency(totalVencido)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {(type === 'geral' || type === 'receitas') && titulares.map((t) => {
        const value = type === 'geral' ? totalsByTitular[t.id]?.despesas : totalsByTitular[t.id]?.receitas;

        return (
          <div key={t.id} className="col-6 col-sm-6 col-md">
            <div
              onClick={() => onFilterChange(t.id)}
              className={cn(
                "card p-3 shadow-sm card-click card-segmento-filtro transition-all h-100 d-flex flex-column justify-content-center",
                isSelected(t.id) ? "border-primary border-2 shadow-md" : "border-border"
              )}
              style={{ minHeight: '90px' }}
            >
              <div className="d-flex align-items-center justify-content-start gap-2">
                <div className="position-relative rounded-3 overflow-hidden border border-border" style={{ width: '45px', height: '45px' }}>
                  <Image
                    src={t.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nome)}&background=random&color=fff&bold=true`}
                    alt={t.nome}
                    fill
                    unoptimized
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>{t.nome}</small>
                  <strong className={cn(
                    "h5 fw-bold m-0", 
                    type === 'receitas' && "text-success",
                    type === 'geral' && value > 0 && "text-primary"
                  )}>{formatCurrency(value || 0)}</strong>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {type === 'cartoes' && cartoes.map((c) => (
        <div key={c.id} className="col-6 col-sm-6 col-md relative">
          <div
            onClick={() => onFilterChange(c.id)}
            onMouseEnter={() => setHoveredCardId(c.id)}
            onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHoveredCardId(null)}
            className={cn(
              "card p-3 shadow-sm card-click card-segmento-filtro transition-all h-100",
              isSelected(c.id) ? "border-primary border-2 shadow-md" : "border-border"
            )}
          >
            <div className="d-flex align-items-center justify-content-start gap-2">
              <CardLogo name={c.nome_cartao} />
              <div>
                <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>{c.nome_cartao}</small>
                <div className="text-muted small opacity-75" style={{ fontSize: '0.6rem', marginTop: '-2px' }}>
                  {titulares.find(t => t.id === c.titular_id)?.nome || 'Sem Titular'}
                </div>
                <strong className="h5 fw-bold m-0">{formatCurrency(totalsByCard[c.id] || 0)}</strong>
              </div>
            </div>
          </div>

          {/* Tooltip Projeção - Oculto no Mobile */}
          {hoveredCardId === c.id && (
            <div 
              className="d-none d-md-block fixed z-50 pointer-events-none transition-opacity"
              style={{ 
                left: mousePos.x + 520 > (typeof window !== 'undefined' ? window.innerWidth : 1000) 
                  ? `${mousePos.x - 515}px` 
                  : `${mousePos.x + 15}px`, 
                top: `${mousePos.y + 15}px`,
                display: 'block'
              }}
            >
              <CardProjectionChart 
                cardId={c.id} 
                allTransacoes={allCartaoTransacoes} 
                currentMonth={currentMonth}
                currentYear={currentYear}
              />
            </div>
          )}
        </div>
      ))}

      {type === 'radar' && titulares.map((t) => {
        const stats = radarTotalsByTitular?.[t.id] || { cards: 0, others: 0, total: 0 };
        
        return (
          <div key={t.id} className="col-12 col-sm-6 col-md">
            <div
              onClick={() => onFilterChange(t.id)}
              className={cn(
                "card p-3 shadow-sm card-click card-segmento-filtro transition-all h-100",
                isSelected(t.id) ? "border-primary border-2 shadow-md" : "border-border"
              )}
            >
              <div className="d-flex align-items-center gap-3 mb-2">
                <div className="position-relative rounded-3 overflow-hidden border border-border" style={{ width: '40px', height: '40px' }}>
                  <Image
                    src={t.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nome)}&background=random&color=fff&bold=true`}
                    alt={t.nome}
                    fill
                    unoptimized
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <strong className="h6 fw-bold m-0">{t.nome}</strong>
              </div>
              
              <div className="space-y-1">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted small">Fatura dos cartões:</span>
                  <span className="small fw-bold">{formatCurrency(stats.cards)}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted small">Demais despesas:</span>
                  <span className="small fw-bold">{formatCurrency(stats.others)}</span>
                </div>
                <div className="border-top mt-1 pt-1 d-flex justify-content-between align-items-center">
                  <span className="fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>Total de despesas:</span>
                  <span className="fw-bold text-primary">{formatCurrency(stats.total)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      </div>

      {/* Gráfico de Projeção Direto no Mobile para Cartões */}
      {type === 'cartoes' && (
        <div className="d-md-none mt-3">
          <CardProjectionChart 
            cardId={activeFilterId} 
            allTransacoes={allCartaoTransacoes} 
            currentMonth={currentMonth}
            currentYear={currentYear}
            inline={true}
          />
        </div>
      )}
    </div>
  );
}
