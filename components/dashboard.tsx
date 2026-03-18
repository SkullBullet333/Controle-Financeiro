'use client';

import React from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Despesa, Titular, Categoria } from '@/lib/types';
import { cn } from '@/lib/utils';

interface KPICardsProps {
  stats: {
    totalReceitas: number;
    totalDespesas: number;
    totalPago: number;
    totalAberto: number;
    margem: number;
    totalVencido?: number;
  };
}

export function KPICards({ stats }: KPICardsProps) {
  const cards = [
    { label: 'Receitas do Mês', value: stats.totalReceitas, icon: 'fa-wallet', color: 'primary', variant: 'blue' },
    { label: 'Despesas do Mês', value: stats.totalDespesas, icon: 'fa-file-invoice-dollar', color: 'danger', variant: 'red' },
    { label: 'Saldo (Margem)', value: stats.margem, icon: 'fa-scale-balanced', color: stats.margem >= 0 ? 'success' : 'danger', variant: stats.margem >= 0 ? 'green' : 'red' },
    { label: 'Total em Aberto', value: stats.totalAberto, icon: 'fa-clock-rotate-left', color: 'faturas', variant: 'purple' },
  ];

  return (
    <div className="row g-4 mb-4">
      {cards.map((card) => (
        <div key={card.label} className="col-md-3">
          <div className={cn("kpi-card", `kpi-card-${card.variant}`, "h-100")}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className={cn("icon-circle", `bg-${card.color}`, "bg-opacity-10", `text-${card.color}`)}>
                <i className={cn("fa-solid", card.icon)}></i>
              </div>
            </div>
            <div className="text-muted small fw-bold text-uppercase mb-1">{card.label}</div>
            <div className={cn("h3 fw-bold mb-0", card.variant === 'red' && stats.totalDespesas > 0 ? "text-danger" : card.variant === 'green' ? "text-success" : "")}>
              {formatCurrency(card.value)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ExtratoTableProps {
  despesas: Despesa[];
  onEdit?: (item: Despesa) => void;
  categorias: Categoria[];
}

export function ExtratoTable({ despesas, onEdit, categorias }: ExtratoTableProps) {
  const getCategoriaLabel = (id: number | undefined) => {
    if (!id) return 'Outros';
    return categorias.find(c => c.id === id)?.label || 'Outros';
  };

  return (
    <div className="bg-card rounded-4 border border-border shadow-sm overflow-hidden flex flex-col h-100">
      <div className="p-4 border-b border-border d-flex justify-content-between align-items-center">
        <h5 className="fw-bold m-0"><i className="fa-solid fa-list-ul me-2 text-primary"></i>Extrato Detalhado</h5>
      </div>
      <div className="overflow-y-auto flex-1" style={{ maxHeight: '520px' }}>
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light sticky-top">
            <tr>
              <th className="px-4 py-3 text-uppercase small fw-bold text-muted border-0">Descrição / Categoria</th>
              <th className="px-4 py-3 text-uppercase small fw-bold text-muted border-0 text-end">Valor / Status</th>
            </tr>
          </thead>
          <tbody>
            {despesas.length === 0 ? (
              <tr>
                <td colSpan={2} className="p-5 text-center text-muted italic">Nenhuma movimentação identificada</td>
              </tr>
            ) : (
              despesas.map((d) => (
                <tr 
                  key={d.id} 
                  onDoubleClick={() => !d.isSummary && onEdit?.(d)}
                  className={cn("cursor-pointer", d.isSummary && "table-primary opacity-75")}
                >
                  <td className="px-4 py-3">
                    <div className="fw-bold text-dark">{d.descricao}</div>
                    <div className="text-muted small text-uppercase">
                      {getCategoriaLabel(d.categoria_id)} {d.vencimento !== '-' && ` • ${formatDate(d.vencimento)}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="fw-bold text-dark">{formatCurrency(d.valor)}</div>
                    <span className={cn(
                      "status-badge",
                      d.status === 'Pago' ? "status-pago" : "status-aberto"
                    )}>
                      {d.status}
                    </span>
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

export function DashboardCharts({ despesas, stats, titulares }: { despesas: Despesa[], stats: { totalReceitas: number; totalDespesas: number; totalPago: number; totalAberto: number; margem: number; totalVencido?: number }, titulares: Titular[] }) {
  const titularData = React.useMemo(() => {
    const data: Record<number, number> = {};
    despesas.forEach(d => {
      if (d.titular_id) {
        data[d.titular_id] = (data[d.titular_id] || 0) + d.valor;
      }
    });
    return Object.entries(data).map(([id, value]) => ({ 
      name: titulares.find(t => t.id === parseInt(id))?.nome || 'N/A', 
      value 
    }));
  }, [despesas, titulares]);

  const COLORS = ['#4361ee', '#2ec4b6', '#ff9f1c', '#e71d36', '#9b59b6'];

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <div className="bg-card rounded-4 border border-border p-4 shadow-sm h-100">
          <h6 className="fw-bold mb-4 text-center text-uppercase small text-muted">Gastos por Titular</h6>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={titularData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {titularData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="col-md-6">
        <div className="bg-card rounded-4 border border-border p-4 shadow-sm h-100 text-center flex flex-col justify-content-center">
            <h6 className="fw-bold mb-4 text-uppercase small text-muted">Status de Pagamento</h6>
            <div className="position-relative" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Pago', value: stats.totalPago },
                      { name: 'Em Aberto', value: stats.totalAberto },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="var(--success)" />
                    <Cell fill="var(--warning)" />
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="position-absolute top-50 start-50 translate-middle">
                <div className="h4 fw-bold mb-0">
                  {stats.totalDespesas > 0 ? Math.round((stats.totalPago / stats.totalDespesas) * 100) : 0}%
                </div>
                <div className="small text-muted fw-bold uppercase">Pago</div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
