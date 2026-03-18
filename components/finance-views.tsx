'use client';

import Image from 'next/image';
import React from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
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
                  className={cn("cursor-pointer", (item as any).isSummary && "table-primary opacity-75")}
                >
                  {type === 'geral' && (
                    <>
                      <td className="px-4 py-3">
                        <span 
                          onClick={(e: React.MouseEvent) => { 
                            e.stopPropagation(); 
                            if (!(item as any).isSummary) {
                              onToggleStatus?.((item as any).id, (item as any).status);
                            }
                          }}
                          className={cn(
                            "status-badge",
                            (item as any).status === 'Pago' ? "status-pago" : "status-aberto",
                            !(item as any).isSummary && "cursor-pointer"
                          )}
                        >
                          {(item as any).status}
                        </span>
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
                      <button 
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete((item as any).id); }}
                        className="btn btn-sm btn-outline-danger border-0"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
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

export function FilterBar({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-4 gap-3">
      <div className="input-group" style={{ maxWidth: '400px' }}>
        <span className="input-group-text bg-white border-end-0 text-muted">
          <i className="fa-solid fa-magnifying-glass"></i>
        </span>
        <input 
          type="text" 
          className="form-control border-start-0 ps-0" 
          placeholder="O que você procura?" 
        />
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
  totalVencido 
}: { 
  type: 'geral' | 'cartoes' | 'receitas', 
  cartoes: CartaoConfig[], 
  titulares: Titular[],
  totalsByCard: Record<number, number>,
  totalsByTitular: Record<number, { despesas: number, receitas: number }>,
  totalVencido?: number
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

  return (
    <div className="row g-3 mb-4 overflow-x-auto flex-nowrap pb-2">
      {type === 'geral' && totalVencido !== undefined && totalVencido > 0 && (
        <div className="col-auto" style={{ minWidth: '220px' }}>
          <div className="bg-danger bg-opacity-10 p-3 rounded-4 border border-danger border-opacity-20 d-flex align-items-center gap-3">
            <div className="bg-danger text-white rounded-3 p-2 d-flex align-items-center justify-center" style={{ width: '45px', height: '45px' }}>
              <i className="fa-solid fa-triangle-exclamation fs-5"></i>
            </div>
            <div>
              <span className="d-block small text-danger fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>Vencido</span>
              <span className="h5 fw-bold text-danger m-0">{formatCurrency(totalVencido)}</span>
            </div>
          </div>
        </div>
      )}

      {(type === 'geral' || type === 'receitas') && titulares.map((t) => {
        const value = type === 'geral' ? totalsByTitular[t.id]?.despesas : totalsByTitular[t.id]?.receitas;
        if (!value || value === 0) return null;

        return (
          <div key={t.id} className="col-auto" style={{ minWidth: '220px' }}>
            <div className="bg-card p-3 rounded-4 border border-border d-flex align-items-center gap-3 hover-border-primary transition-all cursor-pointer">
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
                <span className="d-block small text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>{t.nome}</span>
                <span className={cn("h5 fw-bold m-0", type === 'receitas' && "text-success")}>{formatCurrency(value)}</span>
              </div>
            </div>
          </div>
        );
      })}

      {type === 'cartoes' && cartoes.map((c) => (
        <div key={c.id} className="col-auto" style={{ minWidth: '220px' }}>
          <div className="bg-card p-3 rounded-4 border border-border d-flex align-items-center gap-3 hover-border-primary transition-all cursor-pointer">
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
              <span className="d-block small text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>{c.nome_cartao}</span>
              <span className="h5 fw-bold m-0">{formatCurrency(totalsByCard[c.id] || 0)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
