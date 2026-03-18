'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Scale, CreditCard } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Despesa, Status, Titular, Categoria } from '@/lib/types';

interface KPICardsProps {
  stats: {
    totalReceitas: number;
    totalDespesas: number;
    totalPago: number;
    totalAberto: number;
    margem: number;
  };
}

export function KPICards({ stats }: KPICardsProps) {
  const cards = [
    { label: 'RECEITAS', value: stats.totalReceitas, icon: TrendingUp, color: 'text-success', border: 'border-l-success' },
    { label: 'DESPESAS', value: stats.totalDespesas, icon: TrendingDown, color: 'text-danger', border: 'border-l-danger' },
    { label: 'MARGEM', value: stats.margem, icon: Scale, color: stats.margem >= 0 ? 'text-success' : 'text-danger', border: stats.margem >= 0 ? 'border-l-success' : 'border-l-danger' },
    { label: 'FATURAS', value: stats.totalAberto, icon: CreditCard, color: 'text-primary', border: 'border-l-primary' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div key={card.label} className={`kpi-card border-l-4 ${card.border} flex flex-col justify-center`}>
          <div className="flex items-center gap-2 mb-1">
            <card.icon className={`w-4 h-4 ${card.color}`} />
            <span className="text-[10px] font-bold text-gray uppercase tracking-wider">{card.label}</span>
          </div>
          <div className={`text-xl md:text-2xl font-extrabold ${card.color}`}>
            {formatCurrency(card.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ExtratoTableProps {
  despesas: Despesa[];
  onEdit?: (item: any) => void;
  categorias: Categoria[];
}

export function ExtratoTable({ despesas, onEdit, categorias }: ExtratoTableProps) {
  const getCategoriaLabel = (id: number | undefined) => {
    if (!id) return 'Outros';
    return categorias.find(c => c.id === id)?.label || 'Outros';
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <h3 className="font-bold text-lg">📋 Extrato Detalhado</h3>
      </div>
      <div className="overflow-y-auto flex-1 max-h-[500px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="p-4 text-[10px] font-bold text-gray uppercase tracking-wider">Descrição</th>
              <th className="p-4 text-[10px] font-bold text-gray uppercase tracking-wider text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {despesas.length === 0 ? (
              <tr>
                <td colSpan={2} className="p-8 text-center text-gray italic">Nenhuma despesa este mês</td>
              </tr>
            ) : (
              despesas.map((d) => (
                <tr 
                  key={d.id} 
                  onDoubleClick={() => !d.isSummary && onEdit?.(d)}
                  className={`border-b border-border hover:bg-gray-50 transition-colors cursor-pointer ${d.isSummary ? 'bg-primary/5' : ''}`}
                >
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className={`font-bold text-sm ${d.isSummary ? 'text-primary' : ''}`}>{d.descricao}</span>
                      <span className="text-[10px] text-gray uppercase">{getCategoriaLabel(d.categoria_id)} {d.vencimento !== '-' && `• ${formatDate(d.vencimento)}`}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-sm">{formatCurrency(d.valor)}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                        d.status === 'Pago' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>
                        {d.status}
                      </span>
                    </div>
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

export function DashboardCharts({ despesas, stats, titulares }: { despesas: Despesa[], stats: any, titulares: Titular[] }) {
  const titularData = React.useMemo(() => {
    const data: Record<number, number> = {};
    despesas.forEach(d => {
      data[d.titular_id] = (data[d.titular_id] || 0) + d.valor;
    });
    return Object.entries(data).map(([id, value]) => ({ 
      name: titulares.find(t => t.id === parseInt(id))?.nome || 'N/A', 
      value 
    }));
  }, [despesas, titulares]);

  const statusData = [
    { name: 'Pago', value: stats.totalPago },
    { name: 'Em Aberto', value: stats.totalAberto },
  ];

  const COLORS = ['#4361ee', '#2ec4b6', '#ff9f1c', '#e71d36'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm h-[350px] flex flex-col">
        <h3 className="text-center font-bold text-gray text-xs uppercase tracking-widest mb-4">📊 Por Titular</h3>
        <div className="flex-1">
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
              <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm h-[350px] flex flex-col">
        <h3 className="text-center font-bold text-gray text-xs uppercase tracking-widest mb-4">✅ Status</h3>
        <div className="flex-1 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                <Cell fill="#2ec4b6" />
                <Cell fill="#ff9f1c" />
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <span className="block text-2xl font-black text-text">
              {stats.totalDespesas > 0 ? Math.round((stats.totalPago / stats.totalDespesas) * 100) : 0}%
            </span>
            <span className="block text-[10px] font-bold text-gray uppercase">Pago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
