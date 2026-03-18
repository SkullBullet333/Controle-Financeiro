'use client';

import Image from 'next/image';
import React from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { format } from 'date-fns';
import { Despesa, Receita, CartaoTransacao, CartaoConfig, Titular, Status, Categoria } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TableViewProps {
  data: any[]; // Voltar para any temporariamente ou usar union restrito
  type: 'geral' | 'cartoes' | 'receitas';
  onDelete: (id: number) => void;
  onToggleStatus?: (id: number, currentVal: any) => void;
  onEdit?: (item: any) => void;
  titulares: Titular[];
  categorias: Categoria[];
  cartoes: CartaoConfig[];
}

export function FinanceTable({ data, type, onDelete, onToggleStatus, onEdit, titulares, categorias, cartoes }: TableViewProps) {
  const headers = {
    geral: ['Status', 'Titular', 'Descrição', 'Categoria', 'Vencimento', 'Valor', 'Ações'],
    cartoes: ['Cartão', 'Titular', 'Estabel.', 'Categoria', 'Parc.', 'Valor', 'Ações'],
    receitas: ['Data', 'Titular', 'Descrição', 'Valor', 'Ações']
  };

  const currentHeaders = headers[type];

  const getTitularName = (id: number) => titulares.find(t => t.id === id)?.nome || 'N/A';
  const getCategoriaLabel = (id: number) => categorias.find(c => c.id === id)?.label || 'Outros';
  const getCartaoName = (id: number) => cartoes.find(c => c.id === id)?.nome_cartao || 'N/A';

  return (
    <div className="bg-card rounded-4 border border-border shadow-sm overflow-hidden">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              {currentHeaders.map(h => (
                <th key={h} className="px-4 py-3 text-uppercase small fw-bold text-muted border-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={currentHeaders.length} className="p-5 text-center text-muted italic">
                  Nenhum registro encontrado para este período.
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr 
                  key={(item as any).id} 
                  onDoubleClick={() => !(item as any).isSummary && onEdit?.(item)}
                  className={cn(
                    "cursor-pointer transition-all",
                    (item as any).isSummary && "table-primary opacity-75",
                    type === 'geral' && (item as any).status !== 'Pago' && (item as any).vencimento && (item as any).vencimento < format(new Date(), 'yyyy-MM-dd') && "row-vencido"
                  )}
                >
                  {type === 'geral' && (
                    <>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 fw-bold">{getTitularName((item as any).titular_id)}</td>
                      <td className={cn("px-4 py-3", (item as any).isSummary && "fw-bold")}>{(item as any).descricao}</td>
                      <td className="px-4 py-3"><span className="badge bg-light text-dark text-uppercase">{getCategoriaLabel((item as any).categoria_id)}</span></td>
                      <td className="px-4 py-3 text-muted">{formatDate((item as any).vencimento)}</td>
                      <td className="px-4 py-3 fw-bold">{formatCurrency((item as any).valor)}</td>
                    </>
                  )}

                  {type === 'cartoes' && (
                    <>
                      <td 
                        className="px-4 py-3 fw-bold text-primary cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); onToggleStatus?.((item as any).id, (item as any).simulada); }}
                      >
                        {getCartaoName((item as any).cartao_id)}
                        {(item as any).simulada && <span className="ms-2 badge bg-warning text-dark small">Simulada</span>}
                      </td>
                      <td className="px-4 py-3">{getTitularName((item as any).titular_id)}</td>
                      <td className="px-4 py-3">{(item as any).estabelecimento}</td>
                      <td className="px-4 py-3"><span className="badge bg-light text-dark text-uppercase">{getCategoriaLabel((item as any).categoria_id)}</span></td>
                      <td className="px-4 py-3 small text-muted">{(item as any).parcela_atual}/{(item as any).parcela_total}</td>
                      <td className="px-4 py-3 fw-bold">{formatCurrency((item as any).valor)}</td>
                    </>
                  )}

                  {type === 'receitas' && (
                    <>
                      <td className="px-4 py-3 text-muted">{formatDate((item as any).data_recebimento)}</td>
                      <td className="px-4 py-3 fw-bold">{getTitularName((item as any).titular_id)}</td>
                      <td className="px-4 py-3 text-success fw-bold">{(item as any).descricao}</td>
                      <td className="px-4 py-3 fw-bold">{formatCurrency((item as any).valor)}</td>
                    </>
                  )}

                  <td className="px-4 py-3">
                    {!(item as any).isSummary && (
                      <div className="d-flex align-items-center gap-1">
                        {type === 'geral' && (
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
                        )}
                        <button 
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete((item as any).id); }}
                          className="btn btn-sm btn-outline-danger border-0"
                          title="Excluir"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
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
  onClearFilter
}: { 
  onAdd: () => void, 
  searchTerm: string, 
  onSearchChange: (value: string) => void,
  activeFilterId?: number | null,
  onClearFilter?: () => void
}) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-4 gap-3">
      <div className="d-flex align-items-center gap-3 flex-1">
        <div className="input-group" style={{ maxWidth: '400px' }}>
          <span className="input-group-text bg-white border-end-0 text-muted">
            <i className="fa-solid fa-magnifying-glass"></i>
          </span>
          <input 
            type="text" 
            className="form-control border-start-0 ps-0 shadow-none border-end-0" 
            placeholder="O que você procura?" 
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button 
              className="btn bg-white border-start-0 text-muted border-end-0" 
              onClick={() => onSearchChange('')}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          <span className="input-group-text bg-white border-start-0"></span>
        </div>

        {activeFilterId !== null && onClearFilter && (
          <button 
            onClick={onClearFilter}
            className="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold d-flex align-items-center gap-2 border-2"
          >
            <i className="fa-solid fa-filter-circle-xmark"></i> Limpar Filtro
          </button>
        )}
      </div>

      <button 
        onClick={onAdd}
        className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
      >
        <i className="fa-solid fa-plus"></i> <span className="d-none d-md-inline">Novo Lançamento</span>
      </button>
    </div>
  );
}

export function SummaryCards({ 
  type, 
  cartoes, 
  titulares, 
  totalsByCard, 
  totalsByTitular, 
  totalVencido,
  activeFilterId,
  onFilterChange
}: { 
  type: 'geral' | 'cartoes' | 'receitas', 
  cartoes: any[], 
  titulares: any[], 
  totalsByCard: Record<number, number>, 
  totalsByTitular: Record<number, { despesas: number, receitas: number }>, 
  totalVencido?: number,
  activeFilterId: number | null,
  onFilterChange: (id: number | null) => void
}) {
  const getCardLogo = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('nubank')) return 'https://logo.clearbit.com/nubank.com.br';
    if (lowerName.includes('inter')) return 'https://logo.clearbit.com/bancointer.com.br';
    if (lowerName.includes('itau')) return 'https://logo.clearbit.com/itau.com.br';
    if (lowerName.includes('bradesco')) return 'https://logo.clearbit.com/bradesco.com.br';
    if (lowerName.includes('santander')) return 'https://logo.clearbit.com/santander.com.br';
    if (lowerName.includes('caixa')) return 'https://logo.clearbit.com/caixa.gov.br';
    if (lowerName.includes('bb') || lowerName.includes('brasil')) return 'https://logo.clearbit.com/bb.com.br';
    if (lowerName.includes('xp')) return 'https://logo.clearbit.com/xpi.com.br';
    if (lowerName.includes('btg')) return 'https://logo.clearbit.com/btgpactual.com';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&bold=true`;
  };

  const isSelected = (id: number | null) => activeFilterId === id;

  return (
    <div className="row g-3 mb-4 overflow-x-auto flex-nowrap pb-2">
      {type === 'geral' && totalVencido !== undefined && totalVencido > 0 && (
        <div className="col-auto" style={{ minWidth: '220px' }}>
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
        if (!value || value === 0) return null;

        return (
          <div key={t.id} className="col-auto" style={{ minWidth: '220px' }}>
            <div 
              onClick={() => onFilterChange(t.id)}
              className={cn(
                "card p-3 shadow-sm card-click card-segmento-filtro transition-all h-100",
                isSelected(t.id) ? "border-primary border-2 shadow-md bg-opacity-10 bg-primary" : "border-border"
              )}
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
                  <strong className={cn("h5 fw-bold m-0", type === 'receitas' && "text-success")}>{formatCurrency(value)}</strong>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {type === 'cartoes' && cartoes.map((c) => (
        <div key={c.id} className="col-auto" style={{ minWidth: '240px' }}>
          <div 
            onClick={() => onFilterChange(c.id)}
            className={cn(
              "card p-3 shadow-sm card-click card-segmento-filtro transition-all h-100",
              isSelected(c.id) ? "border-primary border-2 shadow-md bg-opacity-10 bg-primary" : "border-border"
            )}
          >
            <div className="d-flex align-items-center justify-content-start gap-2">
              <div className="position-relative rounded-3 overflow-hidden border border-border bg-white p-1" style={{ width: '45px', height: '45px' }}>
                <Image 
                  src={getCardLogo(c.nome_cartao)} 
                  alt={c.nome_cartao} 
                  fill 
                  unoptimized
                  className="object-contain" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>{c.nome_cartao}</small>
                <div className="text-muted small opacity-75" style={{ fontSize: '0.6rem', marginTop: '-2px' }}>
                  {titulares.find(t => t.id === c.titular_id)?.nome || 'Sem Titular'}
                </div>
                <strong className="h5 fw-bold m-0">{formatCurrency(totalsByCard[c.id] || 0)}</strong>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
