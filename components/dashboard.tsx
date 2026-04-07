'use client';

import React from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Despesa, Titular } from '@/lib/types';
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
    <div className="row g-3 mb-4 kpi-grid-mobile">
      {cards.map((card) => (
        <div key={card.label} className="col-md-3 col-6">
          <div className={cn("kpi-card", `kpi-card-${card.variant}`, "h-100")}>
            <small className="text-muted d-block text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem', opacity: 0.8 }}>
              {card.label}
            </small>
            <div className={cn("centered-value h3 fw-bold mb-0", card.variant === 'red' ? "text-danger" : card.variant === 'green' ? "text-success" : card.variant === 'blue' ? "text-primary" : "")}>
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
}

export function ExtratoTable({ despesas, onEdit }: ExtratoTableProps) {

  return (
    <div className="bg-card rounded-4 border border-border shadow-sm overflow-hidden flex flex-col h-100">
      <div className="p-3 p-md-4 border-b border-border d-flex justify-content-between align-items-center">
        <h5 className="fw-bold m-0 fs-6 fs-md-5"><i className="fa-solid fa-list-ul me-2 text-primary"></i>Extrato Detalhado</h5>
      </div>
      <div className="overflow-y-auto flex-1" style={{ maxHeight: '560px' }}>


        {despesas.length === 0 ? (
          <div className="p-5 text-center text-muted italic">Nenhuma movimentação identificada</div>
        ) : (
          <div className="list-group list-group-flush">
            {despesas.map((d) => {
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              const isVencido = d.status !== 'Pago' && d.vencimento && d.vencimento < todayStr;

              return (
                <div
                  key={d.id}
                  onDoubleClick={() => !d.isSummary && onEdit?.(d)}
                  className="list-group-item list-group-item-action border-0 border-bottom border-border px-3 px-md-4 py-2 cursor-pointer bg-transparent"
                >
                  <div className="d-flex justify-content-between align-items-start mb-0">
                    <div className="fw-bold text-dark text-truncate pr-2" style={{ maxWidth: '65%' }}>
                      {d.descricao}
                    </div>
                    <div className="fw-bold text-dark whitespace-nowrap">
                      {formatCurrency(d.valor)}
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-end">
                    <div className="small text-muted flex-column d-flex">
                      {d.vencimento !== '-' && (
                        <span className={cn(isVencido ? "text-danger fw-bold" : "text-muted")}>
                          {isVencido 
                            ? `Venceu em ${formatDate(d.vencimento)}` 
                            : `Dia ${parseInt(d.vencimento.split('-')[2] || '0')}`
                          }
                        </span>
                      )}
                    </div>
                    <div>
                      <span className={cn(
                        d.status === 'Pago' ? "status-pago" : "status-aberto"
                      )}>
                        {d.status === 'Pago' ? 'Pago' : 'Em aberto'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function TitularChart({ despesas, titulares }: { despesas: Despesa[], titulares: Titular[] }) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    <div className="bg-card rounded-4 border border-border p-4 shadow-sm h-100">
      <h6 className="fw-bold mb-4 text-center text-uppercase small text-muted">Gastos por Titular</h6>
      <div style={{ height: '280px' }}>


        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={titularData}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? "50%" : 60}
              outerRadius={isMobile ? "80%" : 90}
              paddingAngle={5}
              dataKey="value"
            >
              {titularData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PaymentStatusChart({ stats }: { stats: { totalReceitas: number; totalDespesas: number; totalPago: number; totalAberto: number; margem: number; totalVencido?: number } }) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="bg-card rounded-4 border border-border p-4 shadow-sm text-center flex flex-col justify-content-center h-100">
      <h6 className="fw-bold mb-4 text-uppercase small text-muted">Status de Pagamento</h6>
      <div className="position-relative" style={{ height: '280px' }}>



        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: 'Pago', value: stats.totalPago },
                { name: 'Em Aberto', value: stats.totalAberto },
              ]}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? "50%" : 60}
              outerRadius={isMobile ? "80%" : 90}
              paddingAngle={5}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              <Cell fill="var(--success)" />
              <Cell fill="var(--warning)" />
            </Pie>
            <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
        <div className="position-absolute top-50 start-50 translate-middle" style={{ marginTop: '-18px' }}>
          <div className="display-6 fw-bold text-dark mb-0 font-sans">
            {stats.totalDespesas > 0 ? Math.round((stats.totalPago / stats.totalDespesas) * 100) : 0}%
          </div>
          <div className="text-[10px] text-muted fw-bold uppercase tracking-widest">PAGO</div>
        </div>
      </div>
    </div>
  );
}

export function DashboardCharts({ despesas, stats, titulares }: { despesas: Despesa[], stats: { totalReceitas: number; totalDespesas: number; totalPago: number; totalAberto: number; margem: number; totalVencido?: number }, titulares: Titular[] }) {
  return (
    <div className="flex flex-col gap-4">
      <TitularChart despesas={despesas} titulares={titulares} />
      <PaymentStatusChart stats={stats} />
    </div>
  );
}
