'use client';

import React, { useState, useMemo } from 'react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { CartaoConfig, Titular, CartaoTransacao, Despesa } from '@/lib/types';
import { calculatePresentValue } from '@/lib/finance-service';
import {
  CreditCard as CardIcon,
  Calculator,
  Plus,
  Receipt,
  Zap,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  TrendingDown,
  ShieldCheck,
  Calendar,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid
} from 'recharts';

interface CartoesViewProps {
  cartoes: CartaoConfig[];
  titulares: Titular[];
  transacoes: CartaoTransacao[];
  despesas?: Despesa[];
  totalsByCard: Record<number, number>;
  competencia?: string;
  currentMonth?: number;
  currentYear?: number;
  onAdd: () => void;
  onEdit: (item: CartaoTransacao) => void;
  onDelete: (id: number) => void;
  onOpenPayoffModal: () => void;
  onOpenExpenseSettings?: () => void;
  isHidden?: boolean;
}

const PRESET_CARDS_STYLE = [
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

export function CartoesView({
  cartoes = [],
  titulares = [],
  transacoes = [],
  despesas = [],
  totalsByCard = {},
  competencia,
  currentMonth,
  currentYear,
  onAdd,
  onEdit,
  onDelete,
  onOpenPayoffModal,
  onOpenExpenseSettings,
  isHidden = false
}: CartoesViewProps) {
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [discountRate, setDiscountRate] = useState<number>(1.15); // 1.15% a.m.

  // Build enhanced cards list from registered cartoes
  const cardsList = useMemo(() => {
    if (!cartoes || cartoes.length === 0) {
      return PRESET_CARDS_STYLE.map((preset, idx) => ({
        id: (idx + 1) * 1000,
        realId: null,
        brand: preset.name,
        holder: preset.defaultHolder,
        number: `•••• •••• •••• ${preset.last4}`,
        fatura: 0,
        limite: 10000,
        limiteDisponivel: 10000,
        diaVencimento: 10,
        diaFechamento: 3,
        gradientClass: preset.gradientClass,
        color: preset.color,
        icone: undefined
      }));
    }

    return cartoes.map((card) => {
      const normCard = (card.nome_cartao || '').toLowerCase();
      const matchedPreset = PRESET_CARDS_STYLE.find((p) => {
        const normPreset = p.name.toLowerCase();
        return normCard.includes(normPreset) || normPreset.includes(normCard);
      });

      const holder = (card.titular_id ? titulares.find((t) => t.id === card.titular_id)?.nome : null) || matchedPreset?.defaultHolder || 'Titular';
      const fatura = totalsByCard[card.id] || 0;
      const limite = (card as any).limite || 10000;
      const limiteDisponivel = Math.max(0, limite - fatura);
      const finalDigits = card.final || matchedPreset?.last4 || '0000';
      const cardColor = card.color || matchedPreset?.color || '#00AE9A';
      const cardGradientClass = !card.color && matchedPreset?.gradientClass ? matchedPreset.gradientClass : '';

      return {
        id: card.id,
        realId: card.id,
        brand: card.nome_cartao,
        holder,
        number: `•••• •••• •••• ${finalDigits}`,
        final: finalDigits,
        fatura,
        limite,
        limiteDisponivel,
        diaVencimento: card.dia_vencimento || 10,
        diaFechamento: card.dia_fechamento || 3,
        gradientClass: cardGradientClass,
        color: cardColor,
        icone: card.icone
      };
    });
  }, [cartoes, titulares, transacoes, totalsByCard]);

  // Selected card details
  const activeCard = useMemo(() => {
    if (!selectedCardId) return null;
    return cardsList.find((c) => c.id === selectedCardId || c.realId === selectedCardId) || null;
  }, [selectedCardId, cardsList]);

  // Filtered transactions for the selected card
  const cardTransactions = useMemo(() => {
    return transacoes.filter((t) => {
      if (selectedCardId && activeCard?.realId) {
        if (Number(t.cartao_id) !== Number(activeCard.realId)) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesEstab = t.estabelecimento?.toLowerCase().includes(term);
        const matchesCat = t.categoria?.toLowerCase().includes(term);
        if (!matchesEstab && !matchesCat) return false;
      }
      return true;
    });
  }, [transacoes, selectedCardId, activeCard, searchTerm]);

  // Future installments for intelligent payoff simulation
  const futureInstallments = useMemo(() => {
    return transacoes
      .filter((t) => (t.parcela_total || 1) > 1 && (t.parcela_atual || 1) < (t.parcela_total || 1))
      .slice(0, 8);
  }, [transacoes]);

  // Simulation calculations
  const simulationTotals = useMemo(() => {
    const selectedItems = futureInstallments.slice(0, 4);
    const nominalTotal = selectedItems.reduce((sum, item) => {
      const remainingInstallments = (item.parcela_total || 1) - (item.parcela_atual || 1);
      return sum + (Number(item.valor || 0) * remainingInstallments);
    }, 0);

    const vpTotal = selectedItems.reduce((sum, item) => {
      const remainingInstallments = (item.parcela_total || 1) - (item.parcela_atual || 1);
      let itemVp = 0;
      for (let i = 1; i <= remainingInstallments; i++) {
        const factor = Math.pow(1 + (discountRate / 100), i);
        itemVp += Number(item.valor || 0) / factor;
      }
      return sum + itemVp;
    }, 0);

    const discount = Math.max(0, nominalTotal - vpTotal);

    return {
      count: selectedItems.length,
      nominalTotal: nominalTotal || 4550.00,
      discount: discount || 214.35,
      quittanceValue: (nominalTotal ? vpTotal : 4335.65)
    };
  }, [futureInstallments, discountRate]);

  // Active/Filtered KPIs
  const currentCardFatura = useMemo(() => {
    if (activeCard) return activeCard.fatura;
    return Object.values(totalsByCard).reduce((sum, v) => sum + Number(v || 0), 0) ||
      cardsList.reduce((sum, c) => sum + c.fatura, 0);
  }, [activeCard, totalsByCard, cardsList]);

  const currentCardLimiteLivre = useMemo(() => {
    if (activeCard) return activeCard.limiteDisponivel;
    return cardsList.reduce((sum, c) => sum + c.limiteDisponivel, 0);
  }, [activeCard, cardsList]);

  // Projeção dos Próximos 6 Meses de Fatura (Obedece estritamente a competência selecionada e o cartão ativo)
  const faturas6MesesData = useMemo(() => {
    const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    let startM = currentMonth;
    let startY = currentYear;

    if (!startM || !startY) {
      if (competencia && competencia.includes('/')) {
        const [m, y] = competencia.split('/').map(Number);
        startM = m;
        startY = y < 100 ? 2000 + y : y;
      } else {
        const now = new Date();
        startM = now.getMonth() + 1;
        startY = now.getFullYear();
      }
    }

    const data = [];
    let tempM = startM;
    let tempY = startY;

    for (let i = 0; i < 6; i++) {
      const comp = `${String(tempM).padStart(2, '0')}/${tempY}`;
      const label = `${monthsShort[tempM - 1]}`;

      let totalComp = 0;

      // 1. Verificar despesas consolidadas de cartão nessa competência (filtrado por cartão se selecionado)
      if (despesas && despesas.length > 0) {
        const cardExpenses = despesas.filter((d) => {
          if (d.competencia !== comp) return false;
          const isCard = d.isSummary || !!d.cartao_vencimento_id || (d.categoria || '').toLowerCase().includes('cartão') || d.descricao?.startsWith('Fatura ');
          if (!isCard) return false;
          if (activeCard && activeCard.realId) {
            const dCardId = (d as any).cartao_id || d.cartao_vencimento_id;
            if (dCardId && Number(dCardId) !== Number(activeCard.realId)) return false;
            if (d.descricao && d.descricao.startsWith('Fatura ') && !d.descricao.toLowerCase().includes(activeCard.brand.toLowerCase())) return false;
          }
          return true;
        });
        totalComp += cardExpenses.reduce((sum, d) => sum + Number(d.valor || 0), 0);
      }

      // 2. Mês atual se zero
      if (i === 0 && totalComp === 0) {
        totalComp = currentCardFatura;
      }

      // 3. Meses futuros com parcelas pendentes (filtrado por cartão se selecionado)
      if (i > 0 && totalComp === 0 && transacoes && transacoes.length > 0) {
        const futureTransTotal = transacoes.filter((t) => {
          if (activeCard && activeCard.realId) {
            if (Number(t.cartao_id) !== Number(activeCard.realId)) return false;
          }
          const rem = (t.parcela_total || 1) - (t.parcela_atual || 1);
          return rem >= i;
        }).reduce((sum, t) => sum + Number(t.valor || 0), 0);

        totalComp = futureTransTotal || (currentCardFatura * Math.max(0.3, 1 - i * 0.15));
      }

      data.push({
        comp,
        monthName: label,
        total: Math.round(totalComp)
      });

      tempM++;
      if (tempM > 12) {
        tempM = 1;
        tempY++;
      }
    }

    return data;
  }, [despesas, transacoes, currentCardFatura, activeCard, currentMonth, currentYear, competencia]);

  return (
    <div className="d-flex flex-column" style={{ gap: '16px' }}>
      {/* 2. Interactive Cards Slider (Compacto e sem corte de bordas) */}
      <div className="card-panel py-3 px-3.5" style={{ overflow: 'visible', marginBottom: 0 }}>
        <div className="panel-header flex-wrap gap-2 mb-1">
          <div>
            <h3 className="panel-title text-sm">
              <CardIcon className="w-4 h-4 text-primary" />
              <span>Meus Cartões & Faturas</span>
            </h3>
          </div>

          <div className="d-flex align-items-center gap-2 ms-auto">
            {selectedCardId && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-0.5 fw-bold text-xs"
                onClick={() => setSelectedCardId(null)}
              >
                Exibir Todos
              </button>
            )}

            {/* Nova Compra (apenas Desktop, no mobile usa o +) */}
            <button
              type="button"
              className="btn-primary d-none d-md-flex align-items-center gap-1.5 shadow-sm text-xs py-1.5 px-3 rounded-xl"
              onClick={onAdd}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Compra</span>
            </button>
          </div>
        </div>

        <div className="card-slider" style={{ marginTop: '-2px' }}>
          {cardsList.map((c) => {
            const isSelected = selectedCardId === c.id || (c.realId && selectedCardId === c.realId);

            return (
              <div
                key={c.id}
                className={cn(
                  'credit-card-ui cursor-pointer transition-all duration-300',
                  c.gradientClass,
                  isSelected ? 'card-selected' : 'opacity-90 hover:opacity-100'
                )}
                style={{
                  background: c.color ? (c.color.startsWith('linear') ? c.color : `linear-gradient(135deg, ${c.color} 0%, ${c.color}cc 100%)`) : undefined
                }}
                onClick={() => setSelectedCardId(isSelected ? null : c.id)}
                title={`Clique para selecionar ${c.brand}`}
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
            );
          })}
        </div>
      </div>

      {/* 3. Grid 2 Colunas no Desktop: Detalhamento da Fatura (Esquerda) + Consolidado & Gráfico 6 Meses (Direita) */}
      <div className="grid-2col" style={{ gap: '14px' }}>
        {/* Coluna 1: Detalhamento da Fatura */}
        <div className="card-panel py-3 px-3.5 mb-0 d-flex flex-column justify-content-between order-2 md:order-1 order-md-1">
          <div>
            <div className="panel-header flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <div>
                <h3 className="panel-title text-sm m-0">
                  <Receipt className="w-4 h-4 text-primary" />
                  <span>Detalhamento da Fatura {activeCard ? `- ${activeCard.brand}` : ''}</span>
                </h3>
                <span className="panel-subtitle text-[11px]">
                  {cardTransactions.length} lançamentos no período
                </span>
              </div>

              {/* Search bar no cabeçalho ao lado do título */}
              <div className="ms-auto d-flex align-items-center">
                {/* Desktop: Barra de busca com campo de texto */}
                <div className="d-none d-md-flex align-items-center bg-muted/40 border border-border rounded-xl px-2.5 py-1" style={{ minWidth: '170px', maxWidth: '230px' }}>
                  <Search className="w-3.5 h-3.5 text-muted me-1.5 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar compra..."
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
                      <i className="fa-solid fa-xmark" style={{ fontSize: '11px' }}></i>
                    </button>
                  )}
                </div>

                {/* Mobile: Apenas o ícone de lupa */}
                <div className="d-md-none">
                  {!isMobileSearchOpen && !searchTerm ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-icon bg-muted/30 border border-border rounded-xl p-1.5 text-muted hover:text-foreground d-flex align-items-center justify-content-center"
                      onClick={() => setIsMobileSearchOpen(true)}
                      title="Buscar compras"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Search className="w-4 h-4 text-muted" />
                    </button>
                  ) : (
                    <div className="d-flex align-items-center bg-muted/40 border border-border rounded-xl px-2 py-1 gap-1.5 animate-in fade-in zoom-in-95 duration-150" style={{ width: '150px' }}>
                      <Search className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Buscar..."
                        className="form-control border-0 p-0 shadow-none bg-transparent text-xs font-medium w-100"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <button
                        type="button"
                        className="border-0 bg-transparent text-muted cursor-pointer p-0"
                        onClick={() => {
                          setSearchTerm('');
                          setIsMobileSearchOpen(false);
                        }}
                      >
                        <i className="fa-solid fa-xmark" style={{ fontSize: '11px' }}></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile View: Lista de Compras do Cartão em Cards (Sem rolagem horizontal) */}
            <div className="d-md-none space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar p-1">
              {cardTransactions.length === 0 ? (
                <div className="text-center py-4 text-muted small italic">
                  Nenhuma compra encontrada para este cartão no período.
                </div>
              ) : (
                cardTransactions.map((t) => {
                  const cardObj = cartoes.find((c) => c.id === t.cartao_id);
                  const matchedPreset = PRESET_CARDS_STYLE.find((p) =>
                    (cardObj?.nome_cartao || '').toLowerCase().includes(p.name.toLowerCase())
                  );
                  const cardColor = matchedPreset?.color || '#00AE9A';

                  return (
                    <div
                      key={`mob-card-tx-${t.id}`}
                      className="bg-card border border-border rounded-2xl p-2.5 d-flex align-items-center justify-content-between gap-2 transition-all shadow-sm"
                    >
                      <div className="d-flex align-items-center gap-2 min-w-0 flex-grow" onClick={() => onEdit(t)}>
                        <div
                          className="d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                          style={{
                            width: '22px',
                            height: '15px',
                            backgroundColor: cardColor,
                            borderRadius: '4px',
                            color: '#ffffff'
                          }}
                        >
                          <i className="fa-solid fa-credit-card" style={{ fontSize: '8px' }}></i>
                        </div>

                        <div className="min-w-0 flex-grow">
                          <div className="font-bold text-xs text-foreground truncate">
                            {t.estabelecimento}
                          </div>
                          <div className="text-[10px] text-muted truncate">
                            {t.categoria || 'Geral'} • {t.data_compra ? formatDate(t.data_compra) : '-'}
                          </div>
                        </div>
                      </div>

                      <div className="text-end flex-shrink-0">
                        <span className="font-bold text-xs text-foreground">
                          {isHidden ? '••••••' : formatCurrency(t.valor)}
                        </span>

                        <div className="d-flex align-items-center gap-1 mt-0.5 justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0.5 text-muted hover:text-primary"
                            onClick={() => onEdit(t)}
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0.5 text-muted hover:text-danger"
                            onClick={() => onDelete(t.id)}
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop View: Tabela com altura ampliada e confortável */}
            <div className="table-responsive custom-scrollbar d-none d-md-block" style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <table className="styled-table text-xs" style={{ position: 'relative' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card, #0f1016)' }}>
                  <tr>
                    <th style={{ padding: '8px 10px' }}>Compra</th>
                    <th style={{ padding: '8px 10px' }}>Parcela</th>
                    <th style={{ padding: '8px 10px' }}>Data</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>Valor</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cardTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-muted">
                        Nenhuma compra encontrada para este cartão no período.
                      </td>
                    </tr>
                  ) : (
                    cardTransactions.map((t) => {
                      const cardObj = cartoes.find((c) => c.id === t.cartao_id);
                      const matchedPreset = PRESET_CARDS_STYLE.find((p) =>
                        (cardObj?.nome_cartao || '').toLowerCase().includes(p.name.toLowerCase())
                      );
                      const cardColor = matchedPreset?.color || '#00AE9A';

                      return (
                        <tr key={t.id}>
                          <td style={{ padding: '8px 10px' }}>
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                                style={{
                                  width: '22px',
                                  height: '15px',
                                  backgroundColor: cardColor,
                                  borderRadius: '3px',
                                  color: '#ffffff'
                                }}
                                title={cardObj?.nome_cartao || 'Cartão'}
                              >
                                <i className="fa-solid fa-credit-card" style={{ fontSize: '8px' }}></i>
                              </div>
                              <div>
                                <div className="font-bold text-xs text-foreground leading-tight">
                                  {t.estabelecimento}
                                </div>
                                <div className="text-[10px] text-muted">
                                  {t.categoria || 'Geral'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span className="badge-tag badge-neutral font-mono font-bold text-[10px] py-0.5 px-2 dark:text-slate-200 dark:bg-white/10">
                              {t.parcela_atual || 1}/{t.parcela_total || 1}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px' }} className="text-muted text-[11px]">
                            {t.data_compra ? formatDate(t.data_compra) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px 10px' }} className="font-bold text-foreground">
                            {isHidden ? '••••••' : formatCurrency(t.valor)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0.5 text-muted hover:text-primary"
                                onClick={() => onEdit(t)}
                                title="Editar compra"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0.5 text-muted hover:text-danger"
                                onClick={() => onDelete(t.id)}
                                title="Excluir compra"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Coluna 2: Card Consolidado com Total de Faturas + Gráfico de Linha dos Próximos 6 Meses */}
        <div className="card-panel py-3 px-3.5 mb-0 d-flex flex-column justify-content-between order-1 md:order-2 order-md-2">
          <div>
            <div className="panel-header mb-2">
              <div>
                <h3 className="panel-title text-sm d-flex align-items-center gap-1.5 m-0">
                  <CardIcon className="w-4 h-4 text-primary" />
                  <span>{activeCard ? `Fatura - ${activeCard.brand}` : 'Consolidado de Faturas'}</span>
                </h3>
                <span className="panel-subtitle text-[11px]">
                  {activeCard ? `Projeção exclusiva para o ${activeCard.brand}` : 'Visão geral e projeção de faturas futuras'}
                </span>
              </div>
              <span className="badge-tag badge-paid text-[10px] py-0.5 px-2">
                {activeCard ? activeCard.brand : `${cardsList.length} Cartões`}
              </span>
            </div>

            {/* Total de Faturas (Filtrado por Cartão ou Geral) */}
            <div
              className="p-3 rounded-2xl border mb-3 space-y-1.5"
              style={{ background: 'var(--bg-surface, #0a0a0f)', borderColor: 'var(--border, rgba(255,255,255,0.08))' }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                  {activeCard ? `Fatura Atual (${activeCard.brand})` : 'Total de Todas as Faturas (Mês)'}
                </span>
                <span className="badge-tag badge-pending text-[10px] py-0.5 px-2">
                  Fatura Atual
                </span>
              </div>
              <div
                className={cn('text-2xl font-black tracking-tight text-purple', isHidden && 'hidden-amount')}
                style={{ color: 'var(--purple, #8b5cf6)' }}
              >
                {isHidden ? 'R$ •••••' : formatCurrency(currentCardFatura)}
              </div>
              <div className="d-flex justify-content-between text-[11px] text-muted pt-1 border-top border-border/30">
                <span>{activeCard ? 'Limite Disponível:' : 'Limite Livre Total:'}</span>
                <strong className="text-foreground">{isHidden ? '••••••' : formatCurrency(currentCardLimiteLivre)}</strong>
              </div>
            </div>

            {/* Gráfico de Linha: Próximos 6 Meses de Fatura (Obedece a segmentação do cartão) */}
            <div>
              <div className="d-flex justify-content-between align-items-center mb-1.5">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                  {activeCard ? `Projeção 6 Meses (${activeCard.brand})` : 'Projeção dos Próximos 6 Meses'}
                </span>
                <span className="text-[10px] text-muted font-medium">
                  {faturas6MesesData[0]?.monthName} - {faturas6MesesData[faturas6MesesData.length - 1]?.monthName}
                </span>
              </div>

              <div className="chart-container w-100" style={{ height: '240px', minHeight: '240px', maxHeight: '240px', minWidth: 0, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={faturas6MesesData} margin={{ top: 8, right: 12, left: 6, bottom: 22 }}>
                    <defs>
                      <linearGradient id="faturaCardGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeCard?.color || '#ef4444'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={activeCard?.color || '#ef4444'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, rgba(148, 163, 184, 0.15))" />
                    <XAxis
                      dataKey="monthName"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fill: 'var(--text-muted, #64748b)', fontSize: 11, fontWeight: 600 }}
                      dy={8}
                    />
                    <YAxis
                      domain={[0, (dataMax: number) => {
                        if (!dataMax || dataMax <= 0) return 1000;
                        const target = dataMax * 1.08;
                        const step = target > 5000 ? 500 : 250;
                        return Math.ceil(target / step) * step;
                      }]}
                      axisLine={false}
                      tickLine={false}
                      width={58}
                      tick={{ fill: 'var(--text-muted, #64748b)', fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(1)}k`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-elevated, #151720)',
                        borderColor: 'var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--text)'
                      }}
                      formatter={(val: any) => [isHidden ? 'R$ •••••' : formatCurrency(Number(val)), `Fatura ${activeCard ? activeCard.brand : 'Prevista'}`]}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Fatura Prevista"
                      stroke={activeCard?.color || '#ef4444'}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#faturaCardGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
