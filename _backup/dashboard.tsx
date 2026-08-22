'use client';

import React from 'react';
import { motion } from 'motion/react';
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
  onViewChange?: (view: string) => void;
  month?: number;
  year?: number;
  onOpenPeriodModal?: () => void;
}

const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function KPICards({ stats, onViewChange, month, year, onOpenPeriodModal }: KPICardsProps) {
  const [showBalance, setShowBalance] = React.useState(true);

  const cards = [
    { label: 'Receitas do Mês', value: stats.totalReceitas, icon: 'fa-wallet', color: 'success', variant: 'green' },
    { label: 'Despesas do Mês', value: stats.totalDespesas, icon: 'fa-file-invoice-dollar', color: 'danger', variant: 'red' },
    { label: 'Saldo (Margem)', value: stats.margem, icon: 'fa-scale-balanced', color: stats.margem >= 0 ? 'success' : 'danger', variant: stats.margem >= 0 ? 'green' : 'red' },
    { label: 'Total em Aberto', value: stats.totalAberto, icon: 'fa-clock-rotate-left', color: 'faturas', variant: 'purple' },
  ];

  return (
    <>
      {/* Sicoob Premium Mobile Balance & Quick Actions - Only visible on small screens */}
      <div className="d-md-none">
        {/* New Mobile Period Selector Pill */}
        {month && year && onOpenPeriodModal && (
          <div className="d-flex gap-2 mb-2">
            <div className="bg-primary/10 text-primary rounded-pill px-2.5 py-1.5 d-flex align-items-center gap-1.5 flex-grow-1 border border-primary/20">
              <i className="fa-regular fa-calendar-check text-sm opacity-70"></i>
              <span className="font-black text-[9px] tracking-widest text-uppercase text-foreground">Este Mês: {months[month-1]} {year}</span>
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

        <div className="bg-card border border-border rounded-xl p-4 mb-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden relative" style={{ minHeight: '180px' }}>
          {/* Subtle background decoration */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>
          
          <div className="d-flex justify-content-between align-items-center mb-1 relative z-10">
            <span className="text-muted font-black text-[10px] tracking-widest text-uppercase">Saldo do Mês</span>
            <div className="d-flex gap-2">
              <button 
                 className="btn btn-link p-0 text-muted transition-all active:scale-90"
                 onClick={() => setShowBalance(!showBalance)}
              >
                <i className={`fa-solid ${showBalance ? 'fa-eye' : 'fa-eye-slash'} fs-6`}></i>
              </button>
            </div>
          </div>
          <div className="h2 fw-bold mb-3 text-foreground tracking-tight relative z-10">
            {showBalance ? formatCurrency(stats.margem) : 'R$ •••••'}
          </div>
          
          <div className="row g-2 mt-2 pt-3 border-top border-border/60 relative z-10">
            <div className="col-6">
              <div className="text-muted font-black text-[9px] tracking-widest text-uppercase">Receitas</div>
              <div className="fw-bold text-success text-sm">{showBalance ? formatCurrency(stats.totalReceitas) : 'R$ ••'}</div>
            </div>
            <div className="col-6 text-end">
              <div className="text-muted font-black text-[9px] tracking-widest text-uppercase">Despesas</div>
              <div className="fw-bold text-danger text-sm">{showBalance ? formatCurrency(stats.totalDespesas) : 'R$ ••'}</div>
            </div>
          </div>
        </div>

        {/* Quick Summary Grid */}
        <div className="row g-2 mb-3">
          <div className="col-6">
            <div className="bg-card border border-border rounded-xl p-3 shadow-sm h-100 d-flex flex-column justify-content-center" style={{ minHeight: '80px' }}>
              <div className="text-muted font-black text-[8px] tracking-widest text-uppercase mb-1">Em Aberto</div>
              <div className="fw-bold text-primary fs-5">{formatCurrency(stats.totalAberto)}</div>
            </div>
          </div>
          <div className="col-6">
            <div className="bg-card border border-border rounded-xl p-3 shadow-sm h-100 d-flex flex-column justify-content-center" style={{ minHeight: '80px' }}>
              <div className="text-muted font-black text-[8px] tracking-widest text-uppercase mb-1">Pago</div>
              <div className="fw-bold text-success fs-5">{formatCurrency(stats.totalPago)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Standard Desktop KPI Cards - Hidden on small screens */}
      <div className="row g-3 mb-4 d-none d-md-flex">
        {cards.map((card, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
            key={card.label} 
            className="col-md-3"
          >
            <div className={cn("kpi-card", `kpi-card-${card.variant}`, "h-100 rounded-2xl border border-border shadow-sm")}>
              <small className="text-muted d-block text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                {card.label}
              </small>
              <div className={cn("centered-value h3 fw-bold mb-0", 
                card.variant === 'red' ? "text-danger" : 
                card.variant === 'green' ? "text-success" : 
                card.variant === 'blue' ? "text-primary" : 
                card.variant === 'purple' ? "text-faturas" : ""
              )}>
                {formatCurrency(card.value)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}

interface ExtratoTableProps {
  despesas: Despesa[];
  onEdit?: (item: Despesa) => void;
}

export function ExtratoTable({ despesas, onEdit }: ExtratoTableProps) {

  return (
    <div className="bg-card rounded-4 border border-border shadow-sm overflow-hidden flex flex-col h-100">
      <div className="p-3 p-md-4 border-b border-border d-flex justify-content-between align-items-center bg-muted/5">
        <h5 className="fw-bold m-0 fs-6 fs-md-5"><i className="fa-solid fa-list-ul me-2 text-primary"></i>Extrato Detalhado</h5>
      </div>
      <div className="overflow-y-auto flex-1" style={{ maxHeight: '560px' }}>


        {despesas.length === 0 ? (
          <div className="p-5 text-center text-muted italic">Nenhuma movimentação identificada</div>
        ) : (
          <>
            {/* Mobile View - Sicoob Style */}
            <div className="p-1 p-md-0 d-md-none">
              {despesas.map((d) => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const isVencido = d.status !== 'Pago' && d.vencimento && d.vencimento < todayStr;
                
                const isReceita = (d as any).data_recebimento || d.valor > 0 && d.status === 'Recebido'; // Simplificação
                const iconClass = isReceita ? "fa-arrow-down text-success" : "fa-arrow-up text-danger";
                const iconBg = isReceita ? "bg-success bg-opacity-10" : "bg-danger bg-opacity-10";

                return (
                  <div
                    key={d.id}
                    onClick={() => !d.isSummary && onEdit?.(d)}
                    className="sicoob-list-item cursor-pointer hover:bg-muted/30 transition-all active:scale-[0.98]"
                  >
                    <div className={cn("sicoob-list-icon shadow-sm", iconBg)}>
                      <i className={cn("fa-solid", iconClass, "text-xs")}></i>
                    </div>
                    
                    <div className="sicoob-list-content">
                      <div className="fw-bold text-foreground text-truncate leading-tight" style={{ fontSize: '0.85rem' }}>
                        {d.descricao}
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-0.5">
                        {d.vencimento !== '-' && (
                          <span className={cn("text-[10px] font-medium", isVencido ? "text-danger fw-bold" : "text-muted-foreground")}>
                            {isVencido 
                              ? `Atrasado ${formatDate(d.vencimento)}` 
                              : formatDate(d.vencimento)
                            }
                          </span>
                        )}
                        <span className="text-muted-foreground/30 text-[8px]">●</span>
                        <span className={cn(
                          "font-black text-[8px] tracking-tighter uppercase",
                          d.status === 'Pago' ? "text-success" : "text-warning"
                        )}>
                          {d.status === 'Pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="sicoob-list-value">
                      <div className="fw-black text-foreground text-sm tracking-tight">
                        {formatCurrency(d.valor)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View - Original Table-like List */}
            <div className="list-group list-group-flush d-none d-md-block">
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
          </>
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
