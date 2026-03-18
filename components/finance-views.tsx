'use client';

import Image from 'next/image';
import React from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Despesa, Receita, CartaoConfig, Titular, Status, Categoria } from '@/lib/types';
import { Trash2, CheckCircle2, Circle, Plus, Search, AlertCircle, User, CreditCard as CardIcon } from 'lucide-react';

interface TableViewProps {
  data: any[];
  type: 'geral' | 'cartoes' | 'receitas';
  onDelete: (id: number) => void;
  onToggleStatus?: (id: number, currentStatus: Status) => void;
  onEdit?: (item: any) => void;
  titulares: Titular[];
  categorias: Categoria[];
  cartoes: CartaoConfig[];
}

export function FinanceTable({ data, type, onDelete, onToggleStatus, onEdit, titulares, categorias, cartoes }: TableViewProps) {
  const headers = {
    geral: ['Status', 'Titular', 'Descrição', 'Categoria', 'Venc.', 'Valor', 'Ações'],
    cartoes: ['Cartão', 'Titular', 'Item', 'Categoria', 'Parc.', 'Valor', 'Ações'],
    receitas: ['Recebimento', 'Titular', 'Descrição', 'Valor', 'Ações']
  };

  const currentHeaders = headers[type];

  const getTitularName = (id: number) => titulares.find(t => t.id === id)?.nome || 'N/A';
  const getCategoriaLabel = (id: number) => categorias.find(c => c.id === id)?.label || 'Outros';
  const getCartaoName = (id: number) => cartoes.find(c => c.id === id)?.nome_cartao || 'N/A';

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              {currentHeaders.map(h => (
                <th key={h} className="p-4 text-[10px] font-black text-gray uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={currentHeaders.length} className="p-12 text-center text-gray italic">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr 
                  key={item.id} 
                  onDoubleClick={() => !item.isSummary && onEdit?.(item)}
                  className={`border-b border-border hover:bg-gray-50/50 transition-colors group cursor-pointer ${item.isSummary ? 'bg-primary/5' : ''}`}
                >
                  {type === 'geral' && (
                    <>
                      <td className="p-4">
                        <button 
                          onClick={() => !item.isSummary && onToggleStatus?.(item.id, item.status)}
                          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                            item.status === 'Pago' 
                              ? 'bg-success/10 text-success' 
                              : (item.vencimento && new Date(item.vencimento) < new Date() && item.status === 'Em aberto')
                                ? 'bg-danger/10 text-danger'
                                : 'bg-warning/10 text-warning'
                          } ${item.isSummary ? 'cursor-default' : ''}`}
                        >
                          {item.status === 'Pago' ? <CheckCircle2 size={12} /> : (item.vencimento && new Date(item.vencimento) < new Date() && item.status === 'Em aberto') ? <AlertCircle size={12} /> : <Circle size={12} />}
                          {item.status === 'Pago' ? 'Pago' : (item.vencimento && new Date(item.vencimento) < new Date() && item.status === 'Em aberto') ? 'Vencido' : 'Em aberto'}
                        </button>
                      </td>
                      <td className="p-4 font-medium text-sm">{getTitularName(item.titular_id)}</td>
                      <td className={`p-4 font-bold text-sm ${item.isSummary ? 'text-primary' : ''}`}>{item.descricao}</td>
                      <td className="p-4"><span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded uppercase text-gray-600">{getCategoriaLabel(item.categoria_id)}</span></td>
                      <td className="p-4 text-sm text-gray">{formatDate(item.vencimento)}</td>
                      <td className="p-4 font-black text-sm">{formatCurrency(item.valor)}</td>
                    </>
                  )}

                  {type === 'cartoes' && (
                    <>
                      <td className="p-4 font-bold text-sm text-primary">{getCartaoName(item.cartao_id)}</td>
                      <td className="p-4 text-sm">{getTitularName(item.titular_id)}</td>
                      <td className="p-4 font-bold text-sm">{item.estabelecimento}</td>
                      <td className="p-4"><span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded uppercase text-gray-600">{getCategoriaLabel(item.categoria_id)}</span></td>
                      <td className="p-4 text-sm">{item.parcela_atual}/{item.parcela_total}</td>
                      <td className="p-4 font-black text-sm">{formatCurrency(item.valor)}</td>
                    </>
                  )}

                  {type === 'receitas' && (
                    <>
                      <td className="p-4 text-sm text-gray">{formatDate(item.data_recebimento)}</td>
                      <td className="p-4 font-medium text-sm">{getTitularName(item.titular_id)}</td>
                      <td className="p-4 font-bold text-sm text-success">{item.descricao}</td>
                      <td className="p-4 font-black text-sm">{formatCurrency(item.valor)}</td>
                    </>
                  )}

                  <td className="p-4">
                    {!item.isSummary && (
                      <button 
                        onClick={() => onDelete(item.id)}
                        className="p-2 text-gray hover:text-danger hover:bg-danger/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
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
    <div className="flex items-center gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray w-4 h-4" />
        <input 
          type="text" 
          placeholder="O que você procura?" 
          className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl focus:border-primary focus:outline-none transition-all text-sm font-medium"
        />
      </div>
      <button 
        onClick={onAdd}
        className="bg-primary text-white p-3 rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all active:scale-95"
      >
        <Plus size={24} />
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
    <div className="flex flex-wrap gap-4 mb-6 w-full">
      {/* Overdue Card for Geral */}
      {type === 'geral' && totalVencido !== undefined && totalVencido > 0 && (
        <div className="flex-1 min-w-[200px] bg-danger/5 p-4 rounded-2xl border border-danger/20 shadow-sm flex items-center gap-4 hover:bg-danger/10 transition-all cursor-pointer group">
          <div className="w-12 h-12 rounded-xl bg-danger text-white flex items-center justify-center shrink-0 shadow-lg shadow-danger/20">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[10px] font-black text-danger uppercase tracking-widest truncate">Contas Vencidas</span>
            <span className="block font-black text-lg text-danger truncate">{formatCurrency(totalVencido)}</span>
          </div>
        </div>
      )}

      {/* Titular Cards for Geral and Receitas */}
      {(type === 'geral' || type === 'receitas') && titulares.map((t) => {
        const value = type === 'geral' ? totalsByTitular[t.id]?.despesas : totalsByTitular[t.id]?.receitas;
        if (!value || value === 0) return null;

        return (
          <div key={t.id} className="flex-1 min-w-[200px] bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4 hover:border-primary transition-all cursor-pointer group">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border group-hover:border-primary transition-all bg-white flex-shrink-0">
              <Image 
                src={t.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nome)}&background=random&color=fff&bold=true`} 
                alt={t.nome} 
                fill 
                unoptimized
                className="object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[10px] font-bold text-gray uppercase tracking-widest truncate">{t.nome}</span>
              <span className={`block font-black text-lg truncate ${type === 'receitas' ? 'text-success' : ''}`}>{formatCurrency(value)}</span>
            </div>
          </div>
        );
      })}

      {/* Card Invoices for Cartoes */}
      {type === 'cartoes' && cartoes.map((c) => (
        <div key={c.id} className="flex-1 min-w-[200px] bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4 hover:border-primary transition-all cursor-pointer group">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border group-hover:border-primary transition-all bg-white p-1 flex-shrink-0">
            <Image 
              src={getCardLogo(c.nome_cartao)} 
              alt={c.nome_cartao} 
              fill 
              unoptimized
              className="object-contain" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[10px] font-bold text-gray uppercase tracking-widest truncate">{c.nome_cartao}</span>
            <span className="block font-black text-lg truncate">{formatCurrency(totalsByCard[c.id] || 0)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
