'use client';

import React, { useMemo } from 'react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Titular, CartaoConfig, Despesa, Receita, Emprestimo, ContaFixaConfig, CartaoTransacao } from '@/lib/types';
import { calculatePresentValue, projetarProximoVencimento, calcularCompetencia, calcularCompetenciaReceita } from '@/lib/finance-service';
import {
  Wand2,
  ShieldCheck,
  AlertTriangle,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Calculator,
  ArrowDownRight,
  Layers
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
  currentMonth = new Date().getMonth() + 1,
  currentYear = new Date().getFullYear(),
  activeFilterId = null,
  onFilterChange,
  onPayoff,
  isHidden = false
}: RadarFinanceiroViewProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
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

  // Contratos calculados e filtrados para EXCLUIR quitados (VP <= 0 ou sem parcelas a vencer)
  const loanContractsSummary = useMemo(() => {
    return emprestimos
      .filter((loan) => {
        if (activeFilterId && Number(loan.titular_id) !== Number(activeFilterId)) return false;
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
          totalParcelas: loan.total_parcelas,
          isQuitado: openInsts.length === 0 || totalNominal <= 0 || totalVP <= 0
        };
      })
      // Não exibir empréstimos quitados (VP <= 0 ou 0 parcelas em aberto)
      .filter((c) => !c.isQuitado && c.totalVP > 0 && c.openCount > 0);
  }, [emprestimos, projectedLoans, despesas, titulares, activeFilterId]);

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

  // Projeção de Fluxo de Caixa (12 Meses no PC / 8 Meses no Celular)
  const projectionChartData = useMemo(() => {
    const data = [];
    let tempMonth = currentMonth;
    let tempYear = currentYear;
    const monthsLimit = isMobile ? 8 : 12;

    for (let i = 0; i < monthsLimit; i++) {
      const comp = `${String(tempMonth).padStart(2, '0')}/${tempYear}`;
      const [mStr] = comp.split('/');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const label = `${monthNames[Number(mStr) - 1]}/${String(tempYear).slice(2)}`;

      // 1. RECEITAS
      // 1.1 Receitas físicas
      const baseRec = receitas
        .filter((r) => {
          const matchTitular = activeFilterId ? Number(r.titular_id) === Number(activeFilterId) : true;
          return matchTitular && r.competencia === comp;
        })
        .reduce((sum, r) => sum + Number(r.valor || 0), 0);

      // 1.2 Receitas virtuais recorrentes (contasFixas com tipo 'receita')
      let virtualRec = 0;
      contasFixas
        .filter((c) => c.tipo === 'receita' && (activeFilterId ? Number(c.titular_id) === Number(activeFilterId) : true))
        .forEach((cfg) => {
          const dataInicial = parseISO(cfg.data_inicio);
          const diaOriginal = getDate(dataInicial);
          const isUltimoDia = isLastDayOfMonth(dataInicial);
          const limit = cfg.total_parcelas || 36;

          for (let p = 1; p <= limit; p++) {
            let dataVenc = projetarProximoVencimento(dataInicial, p - 1, isUltimoDia, diaOriginal, false);
            let cComp = '';
            if (cfg.competencia_inicial) {
              const [m, y] = cfg.competencia_inicial.split('/').map(Number);
              const baseDate = new Date(y, m - 1, 1);
              cComp = format(addMonths(baseDate, p - 1), 'MM/yyyy');
            } else {
              cComp = calcularCompetenciaReceita(dataVenc);
            }

            if (cComp === comp) {
              const existeNoBanco = receitas.find(
                (r) => Number(r.conta_fixa_id) === Number(cfg.id) && (r.competencia === comp || Number(r.parcela_atual) === Number(p))
              );
              if (!existeNoBanco) {
                virtualRec += Number(cfg.valor_mensal || 0);
              }
            }
          }
        });

      const totalRec = baseRec + virtualRec;

      // 2. DESPESAS FIXAS E REGULARES
      // 2.1 Despesas físicas regulares (não faturas de cartão)
      const baseDesp = despesas
        .filter((d) => {
          const matchTitular = activeFilterId ? Number(d.titular_id) === Number(activeFilterId) : true;
          return matchTitular && d.competencia === comp && !d.isSummary && !d.descricao?.startsWith('Fatura ');
        })
        .reduce((sum, d) => sum + Number(d.valor || 0), 0);

      // 2.2 Despesas virtuais recorrentes (contasFixas de despesa não cartão)
      let virtualFixed = 0;
      contasFixas
        .filter((c) => (!c.tipo || c.tipo === 'despesa') && !c.cartao_id && (activeFilterId ? Number(c.titular_id) === Number(activeFilterId) : true))
        .forEach((cfg) => {
          const dataInicial = parseISO(cfg.data_inicio);
          const diaOriginal = getDate(dataInicial);
          const isUltimoDia = isLastDayOfMonth(dataInicial);
          const limit = cfg.total_parcelas || 36;

          for (let p = 1; p <= limit; p++) {
            const dataVenc = projetarProximoVencimento(dataInicial, p - 1, isUltimoDia, diaOriginal);
            let fComp = '';
            if (cfg.competencia_inicial) {
              const [m, y] = cfg.competencia_inicial.split('/').map(Number);
              const baseDate = new Date(y, m - 1, 1);
              fComp = format(addMonths(baseDate, p - 1), 'MM/yyyy');
            } else {
              fComp = calcularCompetencia(dataVenc);
            }

            if (fComp === comp) {
              const existeNoBanco = despesas.find(
                (d) => Number(d.conta_fixa_id) === Number(cfg.id) && Number(d.parcela_atual) === Number(p)
              );
              if (!existeNoBanco) {
                virtualFixed += Number(cfg.valor_mensal || 0);
              }
            }
          }
        });

      // 2.3 Parcelas virtuais de empréstimos
      let virtualLoans = 0;
      emprestimos
        .filter((loan) => (activeFilterId ? Number(loan.titular_id) === Number(activeFilterId) : true))
        .forEach((loan) => {
          const dataInicial = parseISO(loan.data_primeiro_vencimento);
          const diaOriginal = getDate(dataInicial);
          const isUltimoDia = isLastDayOfMonth(dataInicial);

          for (let p = 1; p <= loan.total_parcelas; p++) {
            const dataVenc = projetarProximoVencimento(dataInicial, p - 1, isUltimoDia, diaOriginal);
            let lComp = '';
            if (loan.competencia_inicial) {
              const [m, y] = loan.competencia_inicial.split('/').map(Number);
              const baseDate = new Date(y, m - 1, 1);
              lComp = format(addMonths(baseDate, p - 1), 'MM/yyyy');
            } else {
              lComp = calcularCompetencia(dataVenc);
            }

            if (lComp === comp) {
              const existeNoBanco = despesas.find(
                (d) => Number(d.emprestimo_id) === Number(loan.id) && Number(d.parcela_atual) === Number(p)
              );
              if (!existeNoBanco) {
                virtualLoans += Number(loan.valor_parcela || 0);
              }
            }
          }
        });

      const totalDesp = baseDesp + virtualFixed + virtualLoans;

      // 3. FATURAS DE CARTÃO (Projetadas & Físicas)
      let cardFats = 0;
      cartoes
        .filter((card) => (activeFilterId ? Number(card.titular_id) === Number(activeFilterId) : true))
        .forEach((card) => {
          const cardTransactionsTotal = allProjectedCartaoTransacoes
            .filter((ct) => {
              const matchTitular = activeFilterId ? Number(ct.titular_id) === Number(activeFilterId) : true;
              return matchTitular && ct.cartao_id === card.id && ct.competencia === comp;
            })
            .reduce((sum, ct) => sum + Number(ct.valor || 0), 0);

          const existingInDB = despesas.find(
            (f) =>
              f.competencia === comp &&
              (f.isSummary || f.descricao?.startsWith('Fatura ')) &&
              (f.cartao_vencimento_id === card.id || f.descricao?.includes(card.nome_cartao))
          );

          if (existingInDB) {
            cardFats += existingInDB.status === 'Pago'
              ? Number(existingInDB.valor || 0)
              : (cardTransactionsTotal || Number(existingInDB.valor || 0));
          } else if (cardTransactionsTotal > 0) {
            cardFats += cardTransactionsTotal;
          }
        });

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
  }, [currentMonth, currentYear, receitas, despesas, allProjectedCartaoTransacoes, contasFixas, emprestimos, cartoes, activeFilterId, isMobile]);

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar (Segmentações em botões pills idênticas à aba Despesas & Receitas) */}
      <div
        className="card-panel py-2 px-3.5 mb-3 d-none d-md-flex flex-row align-items-center justify-content-between w-100"
        style={{ flexDirection: 'row', gap: '10px', flexWrap: 'nowrap' }}
      >
        <div className="d-flex flex-row align-items-center gap-2 flex-nowrap flex-shrink-0 me-auto">
          {/* Segmentação de Titular por Botões Pills */}
          <div className="range-presets flex-shrink-0">
            <button
              type="button"
              className={cn("range-preset-btn", !activeFilterId && "active")}
              onClick={() => onFilterChange(null)}
            >
              Família Completa
            </button>
            {titulares.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn("range-preset-btn", activeFilterId === t.id && "active")}
                onClick={() => onFilterChange(t.id)}
              >
                {t.nome}
              </button>
            ))}
          </div>

          {activeFilterId && (
            <button
              type="button"
              className="btn btn-link text-danger font-bold text-xs text-decoration-none p-0 ms-1 flex-shrink-0 whitespace-nowrap d-flex align-items-center"
              style={{ height: '34px' }}
              onClick={() => onFilterChange(null)}
            >
              <i className="fa-solid fa-filter-circle-xmark me-1"></i> Limpar Filtro
            </button>
          )}
        </div>

        {/* Badge Informativo à Direita */}
        <div className="d-flex align-items-center gap-2 ms-auto flex-shrink-0 flex-nowrap">
          <div className="badge-tag badge-paid py-1.5 px-3 rounded-xl text-xs font-bold d-flex align-items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-primary" />
            <span>Radar Ativo</span>
          </div>
        </div>
      </div>

      {/* 1.1 Mobile Toolbar */}
      <div className="card-panel py-2.5 px-3 mb-3 d-md-none space-y-2">
        {/* Titular Pills no Mobile */}
        <div className="range-presets w-100 justify-content-between flex-wrap gap-1">
          <button
            type="button"
            className={cn("range-preset-btn flex-grow-1 text-center justify-content-center", !activeFilterId && "active")}
            onClick={() => onFilterChange(null)}
          >
            Família
          </button>
          {titulares.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn("range-preset-btn flex-grow-1 text-center justify-content-center", activeFilterId === t.id && "active")}
              onClick={() => onFilterChange(t.id)}
            >
              {t.nome}
            </button>
          ))}
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
            <div className="kpi-icon-wrap" style={{ background: 'var(--primary-subtle, rgba(0, 174, 154, 0.15))', color: 'var(--primary, #00AE9A)' }}>
              <Calculator className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className={cn('kpi-val text-foreground sensitive-val', isHidden && 'hidden-amount')}>
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

      {/* 3. Cards de Inteligência & Metas com Plano de Fundo Premium e Fronteira Visual Padronizada */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Reserva de Emergência */}
        <div
          className="card-panel py-3.5 px-4"
          style={{
            background: 'linear-gradient(135deg, var(--card) 0%, var(--card-elevated, #181d2c) 100%)',
            border: '1px solid var(--border)',
            borderRadius: '20px'
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div className="kpi-icon-wrap" style={{ background: 'var(--success-glow, rgba(16, 185, 129, 0.2))', color: 'var(--success, #10b981)', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        </div>

        {/* Alerta de Contratos & Financiamentos */}
        <div
          className="card-panel py-3.5 px-4"
          style={{
            background: 'linear-gradient(135deg, var(--card) 0%, var(--card-elevated, #181d2c) 100%)',
            border: '1px solid var(--border)',
            borderRadius: '20px'
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div className="kpi-icon-wrap" style={{ background: 'var(--warning-glow, rgba(245, 158, 11, 0.2))', color: 'var(--warning, #f59e0b)', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-grow-1">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '4px' }}>Contratos & Financiamentos</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {loanContractsSummary.length} contratos ativos somando {formatCurrency(loanContractsSummary.reduce((s: number, c: any) => s + Number(c.loan?.valor_parcela || 0), 0))}/mês.
              </p>
              <span className="badge-tag badge-pending" style={{ fontSize: '0.72rem' }}>Amortização Disponível</span>
            </div>
          </div>
        </div>

        {/* Metas Familiares & VP / Potencial de Economia */}
        <div
          className="card-panel py-3.5 px-4"
          style={{
            background: 'linear-gradient(135deg, var(--card) 0%, var(--card-elevated, #181d2c) 100%)',
            border: '1px solid var(--border)',
            borderRadius: '20px'
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div className="kpi-icon-wrap" style={{ background: 'var(--primary-glow, rgba(0, 174, 154, 0.25))', color: 'var(--primary, #00AE9A)', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      </div>

      {/* 4. Projeção de Fluxo de Caixa (12 Meses PC / 8 Meses Celular) */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Projeção de Fluxo de Caixa</span>
            </h3>
            <span className="panel-subtitle">
              {isMobile ? 'Próximos 8 meses' : 'Próximos 12 meses'} • Receitas vs. despesas projetadas
            </span>
          </div>
        </div>

        <div style={{ height: '270px', minHeight: '270px', maxHeight: '270px', width: '100%', minWidth: 0, position: 'relative' }}>
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart data={projectionChartData} margin={{ top: 15, right: 15, bottom: 20, left: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, rgba(148, 163, 184, 0.15))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted, #64748b)', fontSize: 11, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                dy={6}
              />
              <YAxis
                width={58}
                tick={{ fill: 'var(--text-muted, #64748b)', fontSize: 11, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `R$ ${(val / 1000).toFixed(1)}k`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div
                        className="p-3 rounded-2xl border border-border shadow-2xl space-y-1.5"
                        style={{
                          background: 'var(--card-elevated, #151720)',
                          backdropFilter: 'blur(16px)',
                          minWidth: '220px'
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between border-b border-border/50 pb-1 mb-1.5">
                          <span className="font-bold text-xs text-foreground">Competência {data.comp}</span>
                          <span className="badge-tag badge-neutral text-[10px] py-0 px-1.5">{data.label}</span>
                        </div>

                        <div className="d-flex align-items-center justify-content-between text-xs">
                          <span className="text-muted d-flex align-items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }}></span>
                            Receitas:
                          </span>
                          <strong className="text-success">{formatCurrency(data.receitas)}</strong>
                        </div>

                        <div className="d-flex align-items-center justify-content-between text-xs">
                          <span className="text-muted d-flex align-items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }}></span>
                            Despesas Fixas:
                          </span>
                          <strong className="text-danger">{formatCurrency(data.despesas)}</strong>
                        </div>

                        {data.faturas > 0 && (
                          <div className="d-flex align-items-center justify-content-between text-xs">
                            <span className="text-muted d-flex align-items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }}></span>
                              Cartões:
                            </span>
                            <strong style={{ color: '#f59e0b' }}>{formatCurrency(data.faturas)}</strong>
                          </div>
                        )}

                        <div className="d-flex align-items-center justify-content-between text-xs pt-1 border-t border-border/40">
                          <span className="font-semibold text-foreground">Total Saídas:</span>
                          <strong className="text-danger">{formatCurrency(data.totalDespesas)}</strong>
                        </div>

                        <div className="d-flex align-items-center justify-content-between text-xs pt-1 border-t border-border/40">
                          <span className="font-bold text-foreground">Saldo Líquido:</span>
                          <strong className={cn("font-black", data.saldo >= 0 ? "text-success" : "text-danger")} style={{ color: data.saldo >= 0 ? '#10b981' : '#ef4444' }}>
                            {data.saldo >= 0 ? '+' : ''}{formatCurrency(data.saldo)}
                          </strong>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => <span style={{ color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600 }}>{value}</span>}
              />
              <Bar dataKey="receitas" name="Receitas Previstas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="totalDespesas" name="Despesas  Previstas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="saldo" name="Saldo Líquido" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Tabela Exclusiva: Empréstimos e Financiamentos (Simulação & Amortização de Juros) */}
      <div className="card-panel">
        <div className="panel-header flex-wrap gap-2 mb-3">
          <div>
            <h3 className="panel-title">
              <Layers className="w-5 h-5 text-primary" />
              <span>Simulação & Amortização de Dívidas</span>
            </h3>
            <span className="panel-subtitle">
              Cálculo de quitação antecipada e desconto de juros
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 ms-auto flex-shrink-0">
            <span className="badge-tag badge-neutral text-xs font-semibold">
              {loanContractsSummary.length} {loanContractsSummary.length === 1 ? 'contrato ativo' : 'contratos ativos'}
            </span>
          </div>
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
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
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
                    <strong className="text-foreground font-black">{isHidden ? '••••••' : formatCurrency(c.totalVP)}</strong>
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
                <th>Contrato</th>
                <th style={{ textAlign: 'center' }}>Parcela</th>
                <th style={{ textAlign: 'center' }}>Vencimento</th>
                <th style={{ textAlign: 'right' }}>Valor Nominal</th>
                <th style={{ textAlign: 'right' }}>Desconto VP</th>
                <th style={{ textAlign: 'right' }}>Valor Presente</th>
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
                    <td className="text-sm font-semibold text-foreground">{c.titularNome}</td>
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
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text)', fontSize: '0.95rem' }}>
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
                        <span>Simular</span>
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
