'use client';

import React, { useState, useMemo, useRef } from 'react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Titular, CartaoConfig, Despesa, Receita, Emprestimo, ContaFixaConfig, CartaoTransacao } from '@/lib/types';
import { calculatePresentValue, projetarProximoVencimento } from '@/lib/finance-service';
import { 
  Wand2, 
  ShieldCheck, 
  AlertTriangle, 
  PiggyBank, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Search, 
  Sparkles, 
  Calculator, 
  ArrowDownRight,
  Layers,
  RotateCcw,
  Percent,
  Banknote,
  Filter
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  Line, 
  ComposedChart 
} from 'recharts';
import { parseISO, format, getDate, isLastDayOfMonth, differenceInMonths, addMonths } from 'date-fns';

interface RadarFinanceiroViewProps {
  despesas: Despesa[];
  receitas: Receita[];
  cartoes: CartaoConfig[];
  titulares: Titular[];
  emprestimos: Emprestimo[];
  contasFixas: ContaFixaConfig[];
  allProjectedCartaoTransacoes: CartaoTransacao[];
  currentMonth: number;
  currentYear: number;
  activeFilterId: number | null;
  onFilterChange: (titularId: number | null) => void;
  onPayoff?: (itemId: number, emprestimoId?: number) => void;
  isHidden?: boolean;
}

export function RadarFinanceiroView({
  despesas = [],
  receitas = [],
  cartoes = [],
  titulares = [],
  emprestimos = [],
  contasFixas = [],
  allProjectedCartaoTransacoes = [],
  currentMonth,
  currentYear,
  activeFilterId,
  onFilterChange,
  onPayoff,
  isHidden = false
}: RadarFinanceiroViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<number | 'all'>('all');
  const [showLoanFilters, setShowLoanFilters] = useState(false);

  const competenciaAtual = `${String(currentMonth).padStart(2, '0')}/${currentYear}`;
  const currentCompSortable = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 1. Projeção de Empréstimos Virtuais (Parcelas futuras completas)
  const projectedLoans = useMemo(() => {
    return emprestimos.reduce((acc, loan) => {
      const matchTitular = activeFilterId ? Number(loan.titular_id) === Number(activeFilterId) : true;
      if (!matchTitular) return acc;

      const dataIni = parseISO(loan.data_primeiro_vencimento);
      const diaOriginal = getDate(dataIni);
      const isUltimoDia = isLastDayOfMonth(dataIni);

      for (let i = 1; i <= loan.total_parcelas; i++) {
        const dataVenc = projetarProximoVencimento(dataIni, i - 1, isUltimoDia, diaOriginal);
        const vStr = format(dataVenc, 'yyyy-MM-dd');
        
        const exists = despesas.find(
          (d) => Number(d.emprestimo_id) === Number(loan.id) && Number(d.parcela_atual) === Number(i)
        );
        
        let comp = '';
        if (loan.competencia_inicial) {
          const [m, y] = loan.competencia_inicial.split('/').map(Number);
          comp = format(addMonths(new Date(y, m - 1, 1), i - 1), 'MM/yyyy');
        } else {
          comp = format(dataVenc, 'MM/yyyy');
        }

        if (!exists) {
          acc.push({
            id: (loan.id * -2000) - i,
            descricao: loan.descricao,
            valor: loan.valor_parcela,
            status: 'Em aberto',
            vencimento: vStr,
            competencia: comp,
            emprestimo_id: loan.id,
            titular_id: loan.titular_id,
            parcela_atual: i,
            parcela_total: loan.total_parcelas,
            categoria: 'Empréstimos e Financiamentos'
          } as Despesa);
        } else if (exists) {
          acc.push({
            ...exists,
            categoria: 'Empréstimos e Financiamentos'
          });
        }
      }
      return acc;
    }, [] as Despesa[]);
  }, [emprestimos, despesas, activeFilterId]);

  // Grouped loans summary: each row is one single debt/contract
  const loanContractsSummary = useMemo(() => {
    return emprestimos
      .filter((loan) => {
        if (activeFilterId && Number(loan.titular_id) !== Number(activeFilterId)) return false;
        if (selectedLoanId !== 'all' && Number(loan.id) !== Number(selectedLoanId)) return false;
        if (searchTerm && !loan.descricao?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      })
      .map((loan) => {
        const titularNome = titulares.find((t) => t.id === loan.titular_id)?.nome || 'Família';
        const taxa = loan.taxa_mensal_percentual || 1.15;

        // Find all installments for this loan
        const loanInstallments = projectedLoans.filter((d) => Number(d.emprestimo_id) === Number(loan.id));
        
        // Find which installments are already paid
        const paidInstallments = despesas.filter(
          (d) => Number(d.emprestimo_id) === Number(loan.id) && (d.status === 'Pago' || d.status === 'Recebido')
        );
        const paidNumbers = new Set(paidInstallments.map((d) => Number(d.parcela_atual)));

        // Unpaid installments
        const openInsts = loanInstallments.filter((d) => !paidNumbers.has(Number(d.parcela_atual)));
        
        // Current open parcel (e.g. 5) vs total (e.g. 10)
        const nextParcela = openInsts.length > 0 ? Math.min(...openInsts.map((d) => Number(d.parcela_atual))) : loan.total_parcelas;
        const parcelaDisplay = `${String(nextParcela).padStart(2, '0')}/${String(loan.total_parcelas).padStart(2, '0')}`;

        // End date (vencimento of the last installment)
        const lastInst = loanInstallments[loanInstallments.length - 1];
        const dataFim = lastInst?.vencimento && lastInst.vencimento !== '-' ? formatDate(lastInst.vencimento) : 'Final';

        // Sum of all remaining open parcels
        const totalNominal = openInsts.reduce((sum, d) => sum + Number(d.valor || 0), 0);

        // Sum of VP for all remaining open parcels
        const totalVP = openInsts.reduce((sum, d) => {
          const { vp } = (taxa > 0 && d.vencimento && d.vencimento !== '-')
            ? calculatePresentValue(Number(d.valor || 0), taxa, d.vencimento, new Date())
            : { vp: Number(d.valor || 0) };
          return sum + vp;
        }, 0);

        const totalDiscount = Math.max(0, totalNominal - totalVP);

        return {
          id: loan.id,
          loan,
          titularNome,
          descricao: loan.descricao,
          taxa,
          parcelaDisplay,
          dataFim,
          totalNominal,
          totalDiscount,
          totalVP,
          openCount: openInsts.length,
          totalParcelas: loan.total_parcelas
        };
      });
  }, [emprestimos, projectedLoans, despesas, titulares, activeFilterId, selectedLoanId, searchTerm]);

  // Debt & Present Value Calculations
  const debtStats = useMemo(() => {
    const totalDivida = loanContractsSummary.reduce((sum, c) => sum + c.totalNominal, 0);
    const totalVP = loanContractsSummary.reduce((sum, c) => sum + c.totalVP, 0);
    const totalDiscount = loanContractsSummary.reduce((sum, c) => sum + c.totalDiscount, 0);
    const qtdParcelas = loanContractsSummary.reduce((sum, c) => sum + c.openCount, 0);
    const discountPercent = totalDivida > 0 ? (totalDiscount / totalDivida) * 100 : 0;

    return { totalDivida, totalVP, totalDiscount, qtdParcelas, discountPercent };
  }, [loanContractsSummary]);

  // Monthly totals for health score
  const totalDespesasMesAtual = useMemo(() => {
    return despesas
      .filter((d) => d.competencia === competenciaAtual)
      .reduce((sum, d) => sum + Number(d.valor || 0), 0);
  }, [despesas, competenciaAtual]);

  const totalReceitasMesAtual = useMemo(() => {
    return receitas
      .filter((r) => r.competencia === competenciaAtual)
      .reduce((sum, r) => sum + Number(r.valor || 0), 0);
  }, [receitas, competenciaAtual]);

  const healthScore = useMemo(() => {
    if (totalReceitasMesAtual <= 0) return 72;
    const ratio = totalDespesasMesAtual / totalReceitasMesAtual;
    const score = Math.round(Math.max(10, Math.min(100, (1 - ratio * 0.7) * 100)));
    return score;
  }, [totalDespesasMesAtual, totalReceitasMesAtual]);

  // 8-Month Projection Chart Data
  const projectionChartData = useMemo(() => {
    const data = [];
    let tempMonth = currentMonth;
    let tempYear = currentYear;

    for (let i = 0; i < 8; i++) {
      const comp = `${String(tempMonth).padStart(2, '0')}/${tempYear}`;
      const [mStr] = comp.split('/');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const label = `${monthNames[Number(mStr) - 1]}/${String(tempYear).slice(2)}`;

      // Standard revenues
      const totalRec = receitas
        .filter((r) => r.competencia === comp)
        .reduce((s, r) => s + Number(r.valor || 0), 0);

      // Despesas fixas e empréstimos
      const totalDesp = despesas
        .filter((d) => d.competencia === comp && !d.isSummary && !d.descricao?.startsWith('Fatura '))
        .reduce((s, d) => s + Number(d.valor || 0), 0);

      // Faturas de cartão
      const cardFats = allProjectedCartaoTransacoes
        .filter((c) => {
          const matchTitular = activeFilterId ? Number(c.titular_id) === Number(activeFilterId) : true;
          return matchTitular && c.competencia === comp;
        })
        .reduce((s, c) => s + Number(c.valor || 0), 0);

      const totalOutflow = totalDesp + cardFats;
      const saldo = totalRec - totalOutflow;

      data.push({
        comp,
        label,
        receitas: totalRec,
        despesas: totalDesp,
        faturas: cardFats,
        totalDespesas: totalOutflow,
        saldo
      });

      tempMonth++;
      if (tempMonth > 12) {
        tempMonth = 1;
        tempYear++;
      }
    }
    return data;
  }, [currentMonth, currentYear, receitas, despesas, allProjectedCartaoTransacoes, activeFilterId]);

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
        <div className="d-flex align-items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm text-foreground">Radar de Inteligência & Amortização</span>
        </div>

        <div className="d-flex align-items-center gap-2 ms-auto w-100 w-md-auto">
          {/* Member Filter */}
          <select
            className="form-select text-xs font-medium border-border rounded-xl bg-card w-100"
            style={{ padding: '8px 12px' }}
            value={activeFilterId || 'all'}
            onChange={(e) => {
              const val = e.target.value;
              onFilterChange(val === 'all' ? null : Number(val));
            }}
          >
            <option value="all">Família Completa</option>
            {titulares.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Top 4 KPI Cards (Estrutura e layout idênticos ao Dashboard) */}
      <div className="kpi-grid">
        {/* Dívida Nominal Acumulada */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Dívida Nominal Futura</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--expense, #ef4444)' }}>
              <TrendingDown className="w-4 h-4 text-danger" />
            </div>
          </div>
          <div className={cn('kpi-val text-danger sensitive-val', isHidden && 'hidden-amount')}>
            {isHidden ? 'R$ •••••' : formatCurrency(debtStats.totalDivida)}
          </div>
          <div className="kpi-footer">
            <span className="badge-tag badge-danger">{debtStats.qtdParcelas} parcelas pendentes</span>
          </div>
        </div>

        {/* Valor Presente Hoje */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Quitação Hoje (VP)</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(0, 174, 154, 0.15)', color: 'var(--primary, #00AE9A)' }}>
              <Calculator className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className={cn('kpi-val text-primary sensitive-val', isHidden && 'hidden-amount')}>
            {isHidden ? 'R$ •••••' : formatCurrency(debtStats.totalVP)}
          </div>
          <div className="kpi-footer">
            <span className="badge-tag badge-neutral">Valor presente líquido</span>
          </div>
        </div>

        {/* Desconto Obtido (VP) */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Economia com VP</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--income, #10b981)' }}>
              <ArrowDownRight className="w-4 h-4 text-success" />
            </div>
          </div>
          <div className={cn('kpi-val text-success sensitive-val', isHidden && 'hidden-amount')} style={{ color: '#10b981' }}>
            {isHidden ? 'R$ •••••' : formatCurrency(debtStats.totalDiscount)}
          </div>
          <div className="kpi-footer">
            <span className="badge-tag badge-paid">Desconto de {debtStats.discountPercent.toFixed(1)}%</span>
          </div>
        </div>

        {/* Score de Saúde Financeira */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Score de Saúde</span>
            <div 
              className="kpi-icon-wrap"
              style={{
                background: healthScore >= 75 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: healthScore >= 75 ? 'var(--income, #10b981)' : 'var(--warning, #f59e0b)'
              }}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className={cn('kpi-val sensitive-val', healthScore >= 75 ? 'text-success' : 'text-warning')} style={{ color: healthScore >= 75 ? '#10b981' : '#f59e0b' }}>
            {healthScore}/100
          </div>
          <div className="kpi-footer">
            <span className={cn('badge-tag', healthScore >= 75 ? 'badge-paid' : 'badge-pending')}>
              {healthScore >= 75 ? 'Excelente Solvência' : 'Atenção ao Orçamento'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Cards de Inteligência & Metas (Lado a lado em 3 colunas) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Reserva de Emergência */}
        <div className="radar-card">
          <div className="radar-icon-box" style={{ background: 'var(--success-glow, rgba(16, 185, 129, 0.2))', color: 'var(--success, #10b981)' }}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-grow-1">
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '4px' }}>Reserva de Emergência</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              6.4 meses de despesas cobertas (Meta familiar: 6 meses).
            </p>
            <div style={{ height: '6px', width: '100%', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', background: 'var(--success, #10b981)' }}></div>
            </div>
          </div>
        </div>

        {/* Alerta de Contratos & Financiamentos */}
        <div className="radar-card">
          <div className="radar-icon-box" style={{ background: 'var(--warning-glow, rgba(245, 158, 11, 0.2))', color: 'var(--warning, #f59e0b)' }}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-grow-1">
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '4px' }}>Contratos & Financiamentos</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {emprestimos.length} contratos ativos somando {formatCurrency(emprestimos.reduce((s, e) => s + Number(e.valor_parcela || 0), 0))}/mês.
            </p>
            <span className="badge-tag badge-pending" style={{ fontSize: '0.72rem' }}>Amortização Disponível</span>
          </div>
        </div>

        {/* Metas Familiares & VP */}
        <div className="radar-card">
          <div className="radar-icon-box" style={{ background: 'var(--primary-glow, rgba(0, 174, 154, 0.25))', color: 'var(--primary, #00AE9A)' }}>
            <PiggyBank className="w-5 h-5" />
          </div>
          <div className="flex-grow-1">
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '4px' }}>Potencial de Economia</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {formatCurrency(debtStats.totalDiscount)} de juros poupados ao antecipar parcelas.
            </p>
            <div style={{ height: '6px', width: '100%', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(15, debtStats.discountPercent * 4))}%`, height: '100%', background: 'var(--primary, #00AE9A)' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Projeção de Fluxo de Caixa (Próximos 8 Meses) */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Projeção de Fluxo de Caixa (Próximos 8 Meses)</span>
            </h3>
            <span className="panel-subtitle">
              Receitas previstas vs. despesas projetadas e faturas de cartões
            </span>
          </div>
        </div>

        <div style={{ height: '260px', minHeight: '260px', maxHeight: '260px', width: '100%', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={projectionChartData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="var(--text-muted)" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="var(--text-muted)" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card-elevated, #151720)',
                  borderColor: 'var(--border)',
                  borderRadius: '16px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
                  color: 'var(--text)'
                }}
                formatter={(val: any) => [formatCurrency(Number(val)), '']}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                formatter={(value) => <span style={{ color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600 }}>{value}</span>}
              />
              <Bar dataKey="receitas" name="Receitas Previstas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="totalDespesas" name="Despesas + Cartões" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="saldo" name="Saldo Líquido Projetado" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Tabela Exclusiva: Empréstimos e Financiamentos (Simulação & Amortização de Juros) */}
      <div className="card-panel">
        <div className="panel-header flex-wrap gap-2">
          <div>
            <h3 className="panel-title">
              <Layers className="w-5 h-5 text-primary" />
              <span>Simulação & Amortização de Dívidas (Empréstimos e Financiamentos)</span>
            </h3>
            <span className="panel-subtitle">
              Resumo por contrato de dívida com cálculo de quitação antecipada e desconto de juros
            </span>
          </div>

          {/* Desktop Filter by Specific Loan Contract */}
          {emprestimos.length > 1 && (
            <div className="ms-auto d-none d-md-block">
              <select
                className="form-select text-xs font-medium border-border rounded-xl bg-card"
                style={{ width: 'auto', padding: '6px 12px' }}
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">Todos os Contratos</option>
                {emprestimos.map((e) => (
                  <option key={e.id} value={e.id}>{e.descricao}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Desktop Search bar */}
        <div className="mb-3 d-none d-md-block">
          <div className="d-flex align-items-center bg-muted/40 border border-border rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted me-2" />
            <input
              type="text"
              placeholder="Buscar contrato de empréstimo ou financiamento..."
              className="form-control border-0 p-0 shadow-none bg-transparent text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="border-0 bg-transparent text-muted cursor-pointer"
                onClick={() => setSearchTerm('')}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filter Toolbar (Com botão de alternar segmentações verticais) */}
        <div className="d-md-none mb-3 space-y-2">
          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center bg-muted/40 border border-border rounded-xl px-3 py-2 flex-grow-1">
              <Search className="w-4 h-4 text-muted me-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar contrato..."
                className="form-control border-0 p-0 shadow-none bg-transparent text-xs font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="border-0 bg-transparent text-muted cursor-pointer p-0"
                  onClick={() => setSearchTerm('')}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {emprestimos.length > 1 && (
              <button
                type="button"
                className={cn(
                  "btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 rounded-xl border font-bold text-xs transition-all shadow-sm flex-shrink-0",
                  showLoanFilters || selectedLoanId !== 'all'
                    ? "bg-primary text-white border-primary"
                    : "bg-card-hover border-border text-foreground"
                )}
                onClick={() => setShowLoanFilters(!showLoanFilters)}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtros</span>
              </button>
            )}
          </div>

          {/* Segmentação Vertical no Mobile */}
          {showLoanFilters && emprestimos.length > 1 && (
            <div className="pt-2 border-top border-border/40 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                Contrato / Empréstimo
              </label>
              <select
                className="form-select text-xs font-medium border-border rounded-xl bg-card w-100 mb-1"
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">Todos os Contratos</option>
                {emprestimos.map((e) => (
                  <option key={e.id} value={e.id}>{e.descricao}</option>
                ))}
              </select>

              {selectedLoanId !== 'all' && (
                <div className="text-end pt-1">
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-danger font-bold text-xs p-0 text-decoration-none"
                    onClick={() => setSelectedLoanId('all')}
                  >
                    <i className="fa-solid fa-filter-circle-xmark me-1"></i> Limpar Filtro
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loans Table */}
        {/* Mobile View: Lista de Contratos em Cards (Sem rolagem horizontal) */}
        <div className="d-md-none space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar p-1">
          {loanContractsSummary.length === 0 ? (
            <div className="text-center py-6 text-muted small italic">
              Nenhum contrato de empréstimo ou financiamento encontrado.
            </div>
          ) : (
            loanContractsSummary.map((c) => (
              <div
                key={`mob-loan-${c.id}`}
                className="bg-card border border-border rounded-2xl p-3.5 space-y-2.5 shadow-sm"
              >
                <div className="d-flex align-items-start justify-content-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                      {c.titularNome}
                    </span>
                    <h4 className="font-black text-sm text-foreground m-0 leading-snug">{c.descricao}</h4>
                    <span className="text-[11px] text-muted block mt-0.5">
                      Taxa: {c.taxa}% a.m. • {c.openCount} parcelas a vencer
                    </span>
                  </div>
                  <span className="badge-tag badge-pending flex-shrink-0" style={{ fontSize: '10px', padding: '2px 8px' }}>
                    {c.parcelaDisplay}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-top border-border/40 text-xs">
                  <div>
                    <span className="text-[10px] text-muted block">Quitação Término:</span>
                    <strong className="text-foreground">{c.dataFim}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block">Valor Nominal:</span>
                    <span className="font-semibold text-muted-foreground">{isHidden ? '••••••' : formatCurrency(c.totalNominal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block">Desconto VP:</span>
                    <strong className="text-success">{isHidden ? '••••••' : c.totalDiscount > 0 ? `- ${formatCurrency(c.totalDiscount)}` : '-'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block">Quitar Hoje (VP):</span>
                    <strong className="text-primary font-black">{isHidden ? '••••••' : formatCurrency(c.totalVP)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-primary w-100 rounded-xl py-2 font-bold text-xs d-flex align-items-center justify-content-center gap-1.5 shadow-sm"
                  onClick={() => onPayoff?.(0, c.id)}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Simular Antecipação</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Loans Table */}
        <div className="table-responsive custom-scrollbar d-none d-md-block" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table className="styled-table" style={{ position: 'relative' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card, #0f1016)' }}>
              <tr>
                <th>Titular</th>
                <th>Contrato / Descrição</th>
                <th style={{ textAlign: 'center' }}>Parcela</th>
                <th style={{ textAlign: 'center' }}>Término / Quitação</th>
                <th style={{ textAlign: 'right' }}>Valor Nominal</th>
                <th style={{ textAlign: 'right' }}>Desconto VP</th>
                <th style={{ textAlign: 'right' }}>Valor Presente (Quitação Hoje)</th>
                <th style={{ textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {loanContractsSummary.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted">
                    Nenhum contrato de empréstimo ou financiamento encontrado.
                  </td>
                </tr>
              ) : (
                loanContractsSummary.map((c) => (
                  <tr key={c.id}>
                    <td className="text-sm font-semibold text-primary">{c.titularNome}</td>
                    <td>
                      <div className="font-bold text-sm text-foreground">{c.descricao}</div>
                      <div className="text-xs text-muted">Taxa: {c.taxa}% a.m. • {c.openCount} parcelas a vencer</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge-tag badge-pending" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                        {c.parcelaDisplay}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }} className="text-xs text-muted whitespace-nowrap">
                      {c.dataFim}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isHidden ? '••••••••' : formatCurrency(c.totalNominal)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      {isHidden ? '••••••••' : c.totalDiscount > 0 ? `- ${formatCurrency(c.totalDiscount)}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                      {isHidden ? '••••••••' : formatCurrency(c.totalVP)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary rounded-pill px-3 py-1 text-xs fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                        onClick={() => onPayoff?.(0, c.id)}
                        title="Simular antecipação de parcelas e desconto de juros"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Simular Antecipação</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
