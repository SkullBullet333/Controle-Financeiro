'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  ArrowDown,
  ArrowUp,
  Clock,
  Wallet,
  Receipt,
  Scale,
  CreditCard as CardIcon,
  PieChart as PieIcon,
  LineChart as ChartLineIcon,
  ChevronRight,
  ListFilter,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  Zap,
  Briefcase,
  Car,
  HeartPulse,
  Home,
  Utensils
} from 'lucide-react';
import { Despesa, Receita, Titular, CartaoConfig } from '@/lib/types';

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
  isHidden?: boolean;
  onToggleVisibility?: () => void;
  pendingCount?: number;
}

const monthsShort = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// ============================================================================
// 1. KPI CARDS & MOBILE HERO CARD (Conforme completo_prototype.html)
// ============================================================================
export function KPICards({
  stats,
  month,
  year,
  onOpenPeriodModal,
  isHidden: externalHidden,
  onToggleVisibility,
  pendingCount = 0
}: KPICardsProps) {
  const [internalHidden, setInternalHidden] = useState(false);
  const isHidden = externalHidden !== undefined ? externalHidden : internalHidden;
  const toggleVisibility = onToggleVisibility || (() => setInternalHidden(!internalHidden));

  const formatHidden = (val: number) => {
    if (isHidden) return 'R$ •••••';
    return formatCurrency(val);
  };

  const marginPercentage = stats.totalReceitas > 0
    ? ((stats.margem / stats.totalReceitas) * 100).toFixed(1)
    : '0.0';

  return (
    <>
      {/* Mobile Hero Card: Um único card consolidado com todas as informações */}
      <div className="d-md-none bg-card border border-border rounded-3xl p-3.5 shadow-md mb-2">
        {month && year && onOpenPeriodModal && (
          <div className="d-flex justify-content-between align-items-center gap-2 mb-2.5">
            <div className="bg-primary/10 text-primary rounded-pill px-3 py-1 d-flex align-items-center gap-1.5 border border-primary/20">
              <span className="font-bold text-[10px] tracking-widest text-uppercase">
                {monthsShort[month - 1]} {year}
              </span>
            </div>
            <button
              onClick={onOpenPeriodModal}
              className="bg-card-hover border border-border text-foreground rounded-pill px-3 py-1 d-flex align-items-center gap-1 transition-all active:scale-95 shadow-sm"
            >
              <span className="font-bold text-[10px] tracking-wider uppercase">Período</span>
              <ChevronRight className="w-3 h-3 opacity-50" />
            </button>
          </div>
        )}

        <div className="text-center py-1.5">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-0.5">
            Saldo Disponível / Margem
          </span>
          <div
            className={cn('text-2xl font-black tracking-tight sensitive-val', stats.margem < 0 ? 'text-danger' : 'text-success', isHidden && 'hidden-amount')}
            style={{ color: stats.margem < 0 ? '#ef4444' : '#10b981' }}
          >
            {formatHidden(stats.margem)}
          </div>
          <span className={cn('badge-tag text-[10px] mt-1 inline-block', stats.margem < 0 ? 'badge-overdue' : 'badge-paid')}>
            {marginPercentage}% de Margem Livre
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2 border-top border-border/40">
          <div className="bg-muted/20 border border-border/40 rounded-2xl p-2">
            <span className="text-[10px] font-bold text-muted d-flex align-items-center gap-1 mb-0.5">
              <ArrowDown className="w-3 h-3 text-success" /> Entradas
            </span>
            <span className={cn('text-xs font-black text-success block', isHidden && 'hidden-amount')}>
              {formatHidden(stats.totalReceitas)}
            </span>
          </div>

          <div className="bg-muted/20 border border-border/40 rounded-2xl p-2">
            <span className="text-[10px] font-bold text-muted d-flex align-items-center gap-1 mb-0.5">
              <ArrowUp className="w-3 h-3 text-danger" /> Saídas
            </span>
            <span className={cn('text-xs font-black text-danger block', isHidden && 'hidden-amount')}>
              {formatHidden(stats.totalDespesas)}
            </span>
          </div>

          <div className="bg-muted/20 border border-border/40 rounded-2xl p-2">
            <span className="text-[10px] font-bold text-muted block mb-0.5">
              Pago no Mês
            </span>
            <span className={cn('text-[11px] font-bold text-foreground block', isHidden && 'hidden-amount')}>
              {formatHidden(stats.totalPago)}
            </span>
          </div>

          <div className="bg-muted/20 border border-border/40 rounded-2xl p-2">
            <span className="text-[10px] font-bold block mb-0.5" style={{ color: 'var(--purple, #8b5cf6)' }}>
              Em Aberto ({pendingCount})
            </span>
            <span className={cn('text-[11px] font-bold block', isHidden && 'hidden-amount')} style={{ color: 'var(--purple, #8b5cf6)' }}>
              {formatHidden(stats.totalAberto)}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Grid Desktop (4 Cards conforme completo_prototype.html) */}
      {/* KPI Grid Desktop (4 Cards conforme completo_prototype.html) */}
      <div className="kpi-grid d-none d-md-grid">
        {/* Card 1: Receitas Totais */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Receitas Totais</span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--success-glow, rgba(16, 185, 129, 0.2))', color: 'var(--success, #10b981)' }}>
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className={cn('kpi-val text-success sensitive-val', isHidden && 'hidden-amount')}>
            {formatHidden(stats.totalReceitas)}
          </div>
          <div className="kpi-footer">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
            <span>Mês em andamento</span>
          </div>
        </div>

        {/* Card 2: Despesas Totais */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Despesas Totais</span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--danger-glow, rgba(239, 68, 68, 0.2))', color: 'var(--danger, #ef4444)' }}>
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className={cn('kpi-val text-danger sensitive-val', isHidden && 'hidden-amount')}>
            {formatHidden(stats.totalDespesas)}
          </div>
          <div className="kpi-footer">
            <TrendingDown className="w-3.5 h-3.5 text-danger" />
            <span>Pago: {formatHidden(stats.totalPago)}</span>
          </div>
        </div>

        {/* Card 3: Saldo Líquido */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Saldo Líquido</span>
            <div 
              className="kpi-icon-wrap" 
              style={{ 
                background: stats.margem < 0 ? 'var(--danger-glow, rgba(239, 68, 68, 0.2))' : 'var(--success-glow, rgba(16, 185, 129, 0.2))', 
                color: stats.margem < 0 ? 'var(--danger, #ef4444)' : 'var(--success, #10b981)'
              }}
            >
              <Scale className={cn('w-4 h-4', stats.margem < 0 ? 'text-danger' : 'text-success')} />
            </div>
          </div>
          <div
            className={cn('kpi-val sensitive-val', stats.margem < 0 ? 'text-danger' : 'text-success', isHidden && 'hidden-amount')}
          >
            {formatHidden(stats.margem)}
          </div>
          <div className="kpi-footer">
            <span className={cn('badge-tag', stats.margem < 0 ? 'badge-overdue' : 'badge-paid')}>
              {marginPercentage}% de Margem
            </span>
          </div>
        </div>

        {/* Card 4: Total em Aberto */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total em Aberto</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--purple, #8b5cf6)' }}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className={cn('kpi-val text-purple sensitive-val', isHidden && 'hidden-amount')}>
            {formatHidden(stats.totalAberto)}
          </div>
          <div className="kpi-footer">
            <span className="badge-tag badge-pending">
              {pendingCount > 0 ? `${pendingCount} pendentes` : 'Em aberto'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// 2. GRÁFICO DE EVOLUÇÃO MENSAL (Line / Area Chart com Eixo Agrupado de Ano)
// ============================================================================
interface EvolucaoMensalChartProps {
  projecaoSemestral?: any[];
  isHidden?: boolean;
}

export function EvolucaoMensalChart({ projecaoSemestral = [], isHidden = false }: EvolucaoMensalChartProps) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Dados mensais: 12 meses para PC / Desktop e 8 meses para Celular
  const chartData = useMemo(() => {
    let rawList: any[] = [];

    if (!projecaoSemestral || projecaoSemestral.length === 0) {
      rawList = [
        { monthName: 'Jan', receitas: 18000, despesas: 12000, ano: currentYear },
        { monthName: 'Fev', receitas: 19500, despesas: 11000, ano: currentYear },
        { monthName: 'Mar', receitas: 18000, despesas: 13500, ano: currentYear },
        { monthName: 'Abr', receitas: 21000, despesas: 10000, ano: currentYear },
        { monthName: 'Mai', receitas: 20500, despesas: 14000, ano: currentYear },
        { monthName: 'Jun', receitas: 22000, despesas: 9000, ano: currentYear },
        { monthName: 'Jul', receitas: 22400, despesas: 7810, ano: currentYear },
        { monthName: 'Ago', receitas: 21500, despesas: 8400, ano: currentYear },
        { monthName: 'Set', receitas: 23000, despesas: 9200, ano: currentYear },
        { monthName: 'Out', receitas: 22800, despesas: 8900, ano: currentYear },
        { monthName: 'Nov', receitas: 24500, despesas: 11200, ano: currentYear },
        { monthName: 'Dez', receitas: 28000, despesas: 14500, ano: currentYear }
      ];
    } else {
      rawList = projecaoSemestral.map((item) => {
        let label = item.competencia;
        let anoItem = currentYear;
        if (typeof item.competencia === 'string' && item.competencia.includes('/')) {
          const [m, y] = item.competencia.split('/').map(Number);
          if (m >= 1 && m <= 12) label = monthsShort[m - 1];
          if (y) anoItem = y < 100 ? 2000 + y : y;
        }
        return {
          monthName: label,
          receitas: Number(item.receitas || 0),
          despesas: Number((item.despesas || 0) + (item.faturas || 0)),
          ano: anoItem
        };
      });
    }

    // Aplica o limite: 8 meses no celular e 12 meses no PC
    const limit = isMobile ? 8 : 12;
    const effectiveList = rawList.slice(0, limit);

    // Identificar grupos contíguos de cada ano e calcular o índice central
    const yearGroups: { ano: number; startIndex: number; count: number }[] = [];
    effectiveList.forEach((item, idx) => {
      const last = yearGroups[yearGroups.length - 1];
      if (!last || last.ano !== item.ano) {
        yearGroups.push({ ano: item.ano, startIndex: idx, count: 1 });
      } else {
        last.count += 1;
      }
    });

    const midIndices = new Set<number>();
    yearGroups.forEach((g) => {
      const mid = g.startIndex + Math.floor((g.count - 1) / 2);
      midIndices.add(mid);
    });

    return effectiveList.map((item, idx) => ({
      ...item,
      showYearInMiddle: midIndices.has(idx),
      isNewYearBoundary: idx > 0 && item.ano !== effectiveList[idx - 1].ano
    }));
  }, [projecaoSemestral, currentYear, isMobile]);

  const CustomGroupedTick = (props: any) => {
    const { x, y, index, width } = props;
    const item = chartData[index];
    if (!item) return null;

    // Calcular o meio exato entre o mês anterior e o mês atual
    const halfStep = width && chartData.length > 1
      ? Math.round(width / (chartData.length * 2))
      : 24;

    return (
      <g transform={`translate(${x},${y})`}>
        {/* Linha vertical separadora no eixo, exatamente no meio entre Dez e Jan */}
        {item.isNewYearBoundary && (
          <line
            x1={-halfStep}
            y1={0}
            x2={-halfStep}
            y2={24}
            stroke="var(--text-muted, #94a3b8)"
            strokeWidth={1.5}
            strokeDasharray="2 2"
            opacity={0.6}
          />
        )}

        {/* Nome do Mês */}
        <text
          x={0}
          y={0}
          dy={8}
          textAnchor="middle"
          fill="var(--text-muted, #94a3b8)"
          fontSize={11}
          fontWeight={500}
        >
          {item.monthName}
        </text>

        {/* Ano centralizado no grupo de meses com a mesma cor do mês */}
        {item.showYearInMiddle && (
          <text
            x={0}
            y={0}
            dy={22}
            textAnchor="middle"
            fill="var(--text-muted, #94a3b8)"
            fontSize={10}
            fontWeight={600}
          >
            {item.ano}
          </text>
        )}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload || {};
      const receitas = typeof data.receitas === 'number' ? data.receitas : (payload.find((p: any) => p.dataKey === 'receitas')?.value || 0);
      const despesas = typeof data.despesas === 'number' ? data.despesas : (payload.find((p: any) => p.dataKey === 'despesas')?.value || 0);
      const saldoLiquido = receitas - despesas;
      const anoItem = data.ano || currentYear;

      return (
        <div
          className="p-3 rounded-xl shadow-2xl border border-border"
          style={{
            background: 'var(--card, #131d31)',
            color: 'var(--text, #fff)',
            backdropFilter: 'blur(10px)',
            fontSize: '13px',
            minWidth: '190px'
          }}
        >
          <div className="font-bold text-foreground mb-2">
            {label} / {anoItem}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="d-flex align-items-center justify-content-between gap-3 mb-1.5">
              <div className="d-flex align-items-center gap-2">
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: entry.color || entry.stroke
                  }}
                />
                <span className="text-muted">{entry.name}:</span>
              </div>
              <span className="font-bold">
                {isHidden ? 'R$ •••••' : formatCurrency(entry.value)}
              </span>
            </div>
          ))}

          {/* Saldo Líquido no Tooltip */}
          <div
            className="d-flex align-items-center justify-content-between gap-3 pt-2 mt-2 border-top border-border"
          >
            <div className="d-flex align-items-center gap-2">
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: saldoLiquido >= 0 ? '#10b981' : '#ef4444'
                }}
              />
              <span className="text-foreground font-semibold">Saldo Líquido:</span>
            </div>
            <span
              className="font-bold"
              style={{ color: saldoLiquido >= 0 ? '#10b981' : '#ef4444' }}
            >
              {isHidden ? 'R$ •••••' : formatCurrency(saldoLiquido)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card-panel h-100 flex flex-col">
      <div className="panel-header mb-2">
        <div>
          <h3 className="panel-title">
            <ChartLineIcon className="w-5 h-5 text-primary" />
            <span>Evolução Mensal</span>
          </h3>
          <span className="panel-subtitle">Entradas vs. Saídas no período</span>
        </div>
        <div className="badge-tag badge-paid text-[10px] py-0.5 px-2">
          {chartData[0]?.ano || currentYear}
        </div>
      </div>

      <div className="chart-container chart-height-dashboard w-100">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 6, bottom: 12 }}
          >
            <defs>
              <linearGradient id="recGradCompleto" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="despGradCompleto" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.16} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, rgba(148, 163, 184, 0.15))" />
            <XAxis
              dataKey="monthName"
              axisLine={false}
              tickLine={false}
              tick={<CustomGroupedTick />}
              interval={0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={55}
              tick={{ fill: 'var(--text-muted, #64748b)', fontSize: 11, fontWeight: 600 }}
              tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="receitas"
              name="Receitas"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#recGradCompleto)"
            />
            <Area
              type="monotone"
              dataKey="despesas"
              name="Despesas"
              stroke="#ef4444"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#despGradCompleto)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// 3. GRÁFICO DE DESPESAS POR CATEGORIA (Enhanced Modern Bar Chart)
// ============================================================================
interface DespesasCategoriaChartProps {
  despesas: Despesa[];
  receitas?: Receita[];
  isHidden?: boolean;
}

const CATEGORY_COLORS = [
  '#8b5cf6', // Roxo
  '#ec4899', // Rosa
  '#f59e0b', // Âmbar
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#06b6d4', // Ciano
  '#f43f5e', // Vermelho Coral
  '#64748b'  // Cinza
];

export function DespesasCategoriaChart({ despesas, isHidden = false }: DespesasCategoriaChartProps) {
  const { categoryData, totalGasto } = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;

    const incomeCategories = ['salário', 'salario', 'rendimento', 'rendimentos', 'receita', 'receitas', 'proventos', 'salários', 'salarios', 'renda'];

    despesas.forEach((d) => {
      const catRaw = (d.categoria || '').trim();
      const catLower = catRaw.toLowerCase();

      // Ignora receitas ou categorias salariais
      if ((d as any).isIncome || (d as any).tipo === 'receita' || incomeCategories.includes(catLower)) {
        return;
      }

      // Agrupa despesas de cartão/faturas sob 'Cartões'
      let cat = catRaw;
      if (
        d.isSummary ||
        d.descricao?.startsWith('Fatura ') ||
        d.cartao_vencimento_id ||
        catLower === 'cartao' ||
        catLower === 'cartão' ||
        catLower === 'cartões' ||
        catLower === 'cartoes' ||
        catLower.includes('fatura')
      ) {
        cat = 'Cartões';
      } else if (!cat) {
        cat = 'Outros';
      }

      const val = Number(d.valor || 0);
      if (val > 0) {
        map[cat] = (map[cat] || 0) + val;
        total += val;
      }
    });

    if (total === 0 || Object.keys(map).length === 0) {
      return {
        totalGasto: 0,
        categoryData: []
      };
    }

    const items = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, val]) => ({
        name,
        valor: val,
        percent: total > 0 ? Math.round((val / total) * 100) : 0
      }));

    return {
      totalGasto: total,
      categoryData: items
    };
  }, [despesas]);

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload || {};
      return (
        <div
          className="p-3 rounded-xl shadow-2xl border border-border"
          style={{
            background: 'rgba(15, 15, 20, 0.95)',
            color: '#fff',
            backdropFilter: 'blur(10px)',
            fontSize: '13px',
            minWidth: '180px'
          }}
        >
          <div className="font-bold text-gray-200 mb-1.5 d-flex justify-content-between align-items-center">
            <span>{data.name}</span>
            <span className="badge-tag badge-pending text-[10px] py-0.5 px-1.5">{data.percent}%</span>
          </div>
          <div className="d-flex justify-content-between gap-4">
            <span className="text-gray-400">Total Gasto:</span>
            <span className="font-bold" style={{ color: payload[0]?.fill || '#8b5cf6' }}>
              {isHidden ? 'R$ •••••' : formatCurrency(data.valor)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card-panel h-100 flex flex-col">
      <div className="panel-header mb-2 flex-wrap gap-2 align-items-center justify-content-between">
        <div>
          <h3 className="panel-title">
            <PieIcon className="w-5 h-5 text-primary" />
            <span>Despesas por Categoria</span>
          </h3>
          <span className="panel-subtitle">Distribuição e ranking de gastos do mês</span>
        </div>
        <span className="badge-tag badge-pending text-[11px] py-1 px-2.5 font-bold">
          Total: {isHidden ? '••••••' : formatCurrency(totalGasto)}
        </span>
      </div>

      <div className="chart-container chart-height-dashboard w-100 d-flex align-items-center justify-content-center">
        {categoryData.length === 0 ? (
          <div className="text-center py-8 text-muted text-xs">
            <i className="fa-regular fa-folder-open fs-3 mb-2 d-block opacity-40"></i>
            Nenhuma despesa encontrada para este período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categoryData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 10, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle, rgba(148, 163, 184, 0.15))" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted, #64748b)', fontSize: 10, fontWeight: 600 }}
                tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text, #334155)', fontSize: 11, fontWeight: 700 }}
                width={90}
              />
              <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="valor" name="Valor" radius={[0, 8, 8, 0]} maxBarSize={20}>
                {categoryData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 4. CARTÕES DE CRÉDITO & FATURAS WIDGET (Slider conforme completo_prototype.html)
// ============================================================================
interface CreditCardsWidgetProps {
  cartoes?: CartaoConfig[];
  titulares?: Titular[];
  despesas?: Despesa[];
  onViewAllCards?: () => void;
  isHidden?: boolean;
}

const PRESET_CARDS_CONFIG = [
  {
    name: 'Sicoob Clássico',
    color: '#00AE9A',
    gradientClass: 'card-sicoob-classico',
    last4: '7376',
    defaultHolder: 'Rodrigo Rocha'
  },
  {
    name: 'Sicoob Platinum',
    color: '#00353E',
    gradientClass: 'card-sicoob-platinum',
    last4: '7262',
    defaultHolder: 'Mariana Rocha'
  },
  {
    name: 'Mercado Pago',
    color: '#222A37',
    gradientClass: 'card-mercado-pago',
    last4: '4904',
    defaultHolder: 'Rodrigo Rocha'
  },
  {
    name: 'Inter',
    color: '#FF5100',
    gradientClass: 'card-inter',
    last4: '1234',
    defaultHolder: 'Mariana Rocha'
  },
  {
    name: 'Nubank',
    color: '#6834AE',
    gradientClass: 'card-nubank',
    last4: '4321',
    defaultHolder: 'Rodrigo Rocha'
  }
];

export function CreditCardsWidget({
  cartoes = [],
  titulares = [],
  despesas = [],
  onViewAllCards,
  isHidden = false
}: CreditCardsWidgetProps) {
  const cardsList = useMemo(() => {
    if (!cartoes || cartoes.length === 0) {
      return PRESET_CARDS_CONFIG.map((preset, idx) => ({
        id: idx + 1,
        brand: preset.name,
        holder: preset.defaultHolder,
        number: `•••• •••• •••• ${preset.last4}`,
        fatura: 0,
        gradientClass: preset.gradientClass,
        color: preset.color,
        icone: undefined
      }));
    }

    return cartoes.map((card) => {
      const normCard = (card.nome_cartao || '').toLowerCase();
      const matchedPreset = PRESET_CARDS_CONFIG.find((p) => {
        const normPreset = p.name.toLowerCase();
        return normCard.includes(normPreset) || normPreset.includes(normCard);
      });

      const holder = (card.titular_id ? titulares.find((t) => t.id === card.titular_id)?.nome : null) || matchedPreset?.defaultHolder || 'Titular';
      const finalDigits = card.final || matchedPreset?.last4 || '0000';
      const cardColor = card.color || matchedPreset?.color || '#00AE9A';
      const cardGradientClass = !card.color && matchedPreset?.gradientClass ? matchedPreset.gradientClass : '';

      // Calculate invoice from despesas
      const cardFatura = despesas
        .filter((d) => {
          if (d.cartao_vencimento_id === card.id) return true;
          const desc = (d.descricao || '').toLowerCase();
          return desc.includes(normCard) || (card.final && desc.includes(card.final));
        })
        .reduce((sum, d) => sum + Number(d.valor || 0), 0);

      return {
        id: card.id,
        brand: card.nome_cartao,
        holder,
        number: `•••• •••• •••• ${finalDigits}`,
        fatura: cardFatura,
        gradientClass: cardGradientClass,
        color: cardColor,
        icone: card.icone
      };
    });
  }, [cartoes, titulares, despesas]);

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">
            <CardIcon className="w-5 h-5 text-primary" />
            <span>Cartões de Crédito & Faturas</span>
          </h3>
          <span className="panel-subtitle">Acompanhamento de fechamento e limites</span>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={onViewAllCards}
        >
          Ver Todos
        </button>
      </div>

      <div className="card-slider">
        {cardsList.map((c) => (
          <div
            key={c.id}
            className={cn('credit-card-ui cursor-pointer transition-all duration-300', c.gradientClass)}
            style={{
              background: c.color ? (c.color.startsWith('linear') ? c.color : `linear-gradient(135deg, ${c.color} 0%, ${c.color}cc 100%)`) : undefined
            }}
            onClick={onViewAllCards}
          >
            <div className="cc-top">
              <div className="cc-chip"></div>
              <div className="d-flex align-items-center gap-1.5 min-w-0">
                {c.icone ? (
                  <div className="relative w-5 h-5 rounded overflow-hidden bg-white/20 p-0.5 flex-shrink-0">
                    <img src={c.icone} alt={c.brand} className="w-full h-full object-contain" />
                  </div>
                ) : null}
                <span className="cc-brand truncate">{c.brand}</span>
              </div>
            </div>
            <div className="cc-middle">
              <div className="cc-number">{c.number}</div>
            </div>
            <div className="cc-bottom">
              <div className="cc-holder truncate">{c.holder}</div>
              <div className="cc-balance-preview">
                <div className="cc-balance-label">Fatura Atual</div>
                <div className={cn('cc-balance-val sensitive-val', isHidden && 'hidden-amount')}>
                  {isHidden ? 'R$ •••••' : formatCurrency(c.fatura)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 5. EXTRATO DE LANÇAMENTOS RECENTES (Table View conforme completo_prototype.html)
// ============================================================================
interface ExtratoTableWidgetProps {
  despesas: Despesa[];
  receitas?: Receita[];
  cartoes?: CartaoConfig[];
  titulares?: Titular[];
  onViewAll?: () => void;
  onEdit?: (item: Despesa) => void;
  isHidden?: boolean;
}

export function ExtratoTableWidget({
  despesas,
  receitas = [],
  cartoes = [],
  titulares = [],
  onViewAll,
  onEdit,
  isHidden = false
}: ExtratoTableWidgetProps) {
  const transactions = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const exp = despesas.map((d) => {
      const isCard = d.isSummary || !!d.cartao_vencimento_id || d.descricao.startsWith('Fatura ');
      const isOverdue = d.status !== 'Pago' && d.vencimento && d.vencimento < todayStr && d.vencimento !== '-';
      const titularNome = titulares.find((t) => t.id === d.titular_id)?.nome || 'Família';
      const cartaoNome = cartoes.find((c) => c.id === d.cartao_vencimento_id)?.nome_cartao;
      const cat = d.categoria || (isCard ? 'Cartão' : 'Despesa');
      // Sort key: vencimento or competencia date
      const sortDate = d.vencimento && d.vencimento !== '-' ? d.vencimento : (d.competencia ? `${d.competencia.split('/')[1]}-${d.competencia.split('/')[0]}-01` : '0000-00-00');

      return {
        id: d.id,
        raw: d,
        desc: d.descricao,
        cat,
        titular: cartaoNome ? `Cartão ${cartaoNome}` : titularNome,
        vencimento: d.vencimento && d.vencimento !== '-' ? formatDate(d.vencimento) : 'Mensal',
        status: d.status || 'Em aberto',
        isOverdue,
        isIncome: false,
        amount: d.valor,
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
        cat: r.categoria || 'Receita',
        titular: titularNome,
        vencimento: r.data_recebimento ? formatDate(r.data_recebimento) : 'Mensal',
        status: r.status || 'Recebido',
        isOverdue: false,
        isIncome: true,
        amount: r.valor,
        sortDate
      };
    });

    // Merge and sort: overdue first, then closest upcoming dates (ascending)
    return [...exp, ...inc].sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.sortDate.localeCompare(b.sortDate);
    });
  }, [despesas, receitas, cartoes, titulares]);

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">
            <ListFilter className="w-5 h-5 text-primary" />
            <span>Extrato de Lançamentos Recentes</span>
          </h3>
          <span className="panel-subtitle">
            {despesas.length} despesas e {receitas.length} receitas
          </span>
        </div>
      </div>

      {/* Mobile View: Lista de Transações em Cards (Sem rolagem horizontal) */}
      <div className="d-md-none space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar p-1">
        {transactions.length === 0 ? (
          <div className="text-center py-6 text-muted small italic">
            Nenhuma movimentação identificada neste período
          </div>
        ) : (
          transactions.map((tx) => {
            const isPaid = tx.status === 'Pago' || tx.status === 'Recebido';

            return (
              <div
                key={`mob-dash-${tx.isIncome ? 'inc' : 'exp'}-${tx.id}`}
                className={cn(
                  "bg-card border border-border rounded-2xl p-3 d-flex align-items-center justify-content-between gap-2.5 transition-all shadow-sm cursor-pointer",
                  isPaid && "opacity-90"
                )}
                onClick={() => onEdit?.(tx.raw)}
              >
                <div className="d-flex align-items-center gap-2.5 min-w-0 flex-grow">
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: tx.isIncome ? '#10b981' : tx.isOverdue ? '#ef4444' : 'var(--primary)',
                      display: 'inline-block',
                      flexShrink: 0
                    }}
                  />
                  <div className="min-w-0 flex-grow">
                    <div className="font-bold text-xs text-foreground truncate">
                      {tx.desc}
                    </div>
                    <div className="d-flex align-items-center gap-1.5 text-[10px] text-muted flex-nowrap overflow-hidden mt-0.5">
                      <span className="flex-shrink-0">{tx.vencimento}</span>
                      {tx.titular && (
                        <>
                          <span className="flex-shrink-0">•</span>
                          <span className="truncate" style={{ maxWidth: '120px' }}>{tx.titular}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-column align-items-end flex-shrink-0">
                  <span
                    className={cn(
                      'font-bold text-xs',
                      tx.isIncome ? 'text-success' : 'text-danger',
                      isHidden && 'hidden-amount'
                    )}
                    style={{
                      color: tx.isIncome ? 'var(--income, #10b981)' : 'var(--expense, #ef4444)',
                      fontWeight: 700
                    }}
                  >
                    {tx.isIncome ? `+ ${formatCurrency(tx.amount)}` : `- ${formatCurrency(tx.amount)}`}
                  </span>
                  <span
                    className={cn(
                      'badge-tag mt-1',
                      isPaid ? 'badge-paid' : tx.isOverdue ? 'badge-overdue' : 'badge-pending'
                    )}
                    style={{ fontSize: '9px', padding: '1px 6px' }}
                  >
                    {tx.isOverdue ? 'Atrasado' : isPaid ? (tx.isIncome ? 'Recebido' : 'Pago') : 'Em Aberto'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop View: Tabela */}
      <div className="table-responsive custom-scrollbar d-none d-md-block" style={{ maxHeight: '380px', overflowY: 'auto' }}>
        <table className="styled-table" style={{ position: 'relative' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card, #0f1016)' }}>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Titular</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-5 text-muted">
                  Nenhuma movimentação identificada neste período
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isPaid = tx.status === 'Pago' || tx.status === 'Recebido';

                return (
                  <tr key={`${tx.isIncome ? 'inc' : 'exp'}-${tx.id}`} onClick={() => onEdit?.(tx.raw)}>
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
                        <span className="font-semibold text-sm">
                          {tx.desc}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge-tag" style={{ background: 'var(--card-hover)', color: 'var(--text-muted)' }}>
                        {tx.cat}
                      </span>
                    </td>
                    <td className="text-muted text-sm font-medium">
                      {tx.titular}
                    </td>
                    <td className="text-muted text-sm whitespace-nowrap">
                      {tx.vencimento}
                    </td>
                    <td>
                      <span
                        className={cn(
                          'badge-tag',
                          isPaid ? 'badge-paid' : tx.isOverdue ? 'badge-overdue' : 'badge-pending'
                        )}
                      >
                        {tx.isOverdue ? 'Atrasado' : isPaid ? (tx.isIncome ? 'Recebido' : 'Pago') : 'Em Aberto'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        className={cn(
                          'font-bold',
                          tx.isIncome ? 'text-success' : 'text-danger',
                          isHidden && 'hidden-amount'
                        )}
                        style={{
                          color: tx.isIncome ? 'var(--income, #10b981)' : 'var(--expense, #ef4444)',
                          fontWeight: 700
                        }}
                      >
                        {tx.isIncome ? `+ ${formatCurrency(tx.amount)}` : `- ${formatCurrency(tx.amount)}`}
                      </span>
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

// Backward compatibility wrapper for old ExtratoTable export
export function ExtratoTable({ despesas, onEdit }: { despesas: Despesa[]; onEdit?: (item: Despesa) => void }) {
  return <ExtratoTableWidget despesas={despesas} onEdit={onEdit} />;
}

// Backward compatibility wrapper for TitularChart
export function TitularChart({ despesas, titulares }: { despesas: Despesa[]; titulares: Titular[] }) {
  return <DespesasCategoriaChart despesas={despesas} />;
}

// Backward compatibility wrapper for PaymentStatusChart
export function PaymentStatusChart({ stats }: { stats: { totalReceitas: number; totalDespesas: number; totalPago: number; totalAberto: number; margem: number; totalVencido?: number } }) {
  return (
    <div className="card-panel text-center flex flex-col justify-content-center h-100">
      <div className="panel-title mb-4">Status de Pagamento</div>
      <div className="position-relative w-100" style={{ height: '220px', minHeight: '220px', maxHeight: '220px', minWidth: 0, overflow: 'hidden' }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={[
                { name: 'Pago', value: stats.totalPago },
                { name: 'Em Aberto', value: stats.totalAberto }
              ]}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={4}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              <Cell fill="var(--income, #10b981)" />
              <Cell fill="#f59e0b" />
            </Pie>
            <RechartsTooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
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

// ============================================================================
// 6. DASHBOARD VIEW (Layout Completo conforme completo_prototype.html)
// ============================================================================
export interface DashboardViewProps {
  stats: {
    totalReceitas: number;
    totalDespesas: number;
    totalPago: number;
    totalAberto: number;
    margem: number;
    totalVencido?: number;
  };
  despesas: Despesa[];
  receitas?: Receita[];
  cartoes?: CartaoConfig[];
  titulares?: Titular[];
  projecaoSemestral?: any[];
  currentMonth?: number;
  currentYear?: number;
  onViewChange?: (view: string) => void;
  onOpenPeriodModal?: () => void;
  onEditDespesa?: (item: Despesa) => void;
  onEditReceita?: (item: Receita) => void;
  isHidden?: boolean;
  onToggleVisibility?: () => void;
}

export function DashboardView({
  stats,
  despesas,
  receitas = [],
  cartoes = [],
  titulares = [],
  projecaoSemestral = [],
  currentMonth,
  currentYear,
  onViewChange,
  onOpenPeriodModal,
  onEditDespesa,
  onEditReceita,
  isHidden: externalHidden,
  onToggleVisibility: externalToggle
}: DashboardViewProps) {
  const [internalHidden, setInternalHidden] = useState(false);
  const isHidden = externalHidden !== undefined ? externalHidden : internalHidden;
  const toggleVisibility = externalToggle || (() => setInternalHidden(!internalHidden));

  const pendingCount = useMemo(() => {
    return despesas.filter((d) => d.status !== 'Pago').length;
  }, [despesas]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* 1. KPIs Section (Cards no Topo) */}
      <KPICards
        stats={stats}
        onViewChange={onViewChange}
        month={currentMonth}
        year={currentYear}
        onOpenPeriodModal={onOpenPeriodModal}
        isHidden={isHidden}
        onToggleVisibility={toggleVisibility}
        pendingCount={pendingCount}
      />

      {/* 2. Charts Section (Evolução Mensal 1.6fr + Despesas por Categoria 1fr) */}
      <div className="grid-2col">
        <EvolucaoMensalChart
          projecaoSemestral={projecaoSemestral}
          isHidden={isHidden}
        />
        <DespesasCategoriaChart
          despesas={despesas}
          isHidden={isHidden}
        />
      </div>

      {/* 3. Cartões de Crédito & Faturas Slider */}
      <CreditCardsWidget
        cartoes={cartoes}
        titulares={titulares}
        despesas={despesas}
        onViewAllCards={() => onViewChange?.('cartoes')}
        isHidden={isHidden}
      />

      {/* 4. Extrato de Lançamentos Recentes */}
      <ExtratoTableWidget
        despesas={despesas}
        receitas={receitas}
        cartoes={cartoes}
        titulares={titulares}
        onViewAll={() => onViewChange?.('geral')}
        onEdit={onEditDespesa}
        isHidden={isHidden}
      />
    </motion.div>
  );
}

export default DashboardView;
