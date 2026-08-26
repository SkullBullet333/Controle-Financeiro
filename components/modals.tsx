'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Titular, Status, Despesa, Receita, CartaoConfig, Profile, Emprestimo, ContaFixaConfig } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { calcularCompetencia, calcularCompetenciaReceita, ajustarDataReceita, calcularCompetenciaCartao, calculatePresentValue, projetarProximoVencimento, getProximoFechamento } from '@/lib/finance-service';
import { parseISO, format, getDate, isLastDayOfMonth, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { categorizar } from '@/lib/categories-utils';
import { getCardLogo } from '@/lib/finance-service';

import { cn, formatCurrency, formatDate } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[1060] flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-xs" 
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 5 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-[640px] bg-card text-foreground rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 relative overflow-y-auto max-h-[92vh] md:max-h-[85vh] border border-border"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3.5 right-3.5 md:top-6 md:right-6 p-2 rounded-full hover:bg-white/10 transition-colors text-muted hover:text-foreground z-10"
              onClick={onClose}
            >
              <X size={18} className="md:w-5 md:h-5" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export function UniversalFinanceForm({
  initialType = 'despesa',
  initialData,
  titulares,
  cartoes,
  competencia,
  onClose,
  onSubmitFinance,
  onSubmitContaFixa,
  onSubmitEmprestimo,
  subType: initialSubType,
  isDarkMode = false
}: {
  initialType?: 'despesa' | 'receita' | 'emprestimo' | 'despesa_cartao',
  initialData?: any,
  titulares: Titular[],
  cartoes: CartaoConfig[],
  competencia: string,
  onClose: () => void,
  onSubmitFinance: (data: Omit<Despesa, 'id'> | Omit<Receita, 'id'>) => Promise<void> | void,
  onSubmitContaFixa?: (data: Omit<ContaFixaConfig, 'id' | 'user_id' | 'family_id'>) => Promise<void> | void,
  onSubmitEmprestimo: (data: Partial<Emprestimo>) => Promise<void> | void,
  subType?: 'cartao' | 'boleto' | 'fixa',
  isDarkMode?: boolean
}) {
  const [activeType, setActiveType] = useState<'despesa' | 'receita' | 'emprestimo' | 'despesa_cartao'>(initialType);
  const isEditing = !!initialData;

  // Se estiver editando, bloqueia o tipo conforme o dado inicial
  useEffect(() => {
    if (isEditing) {
      if ((initialData as any).taxa_mensal_percentual !== undefined) setActiveType('emprestimo');
      else if ((initialData as any).data_recebimento !== undefined || (initialData as any).tipo === 'receita') setActiveType('receita');
      else if ((initialData as any).cartao_id || (initialData as any).cartao_vencimento_id) setActiveType('despesa_cartao');
      else setActiveType('despesa');
    }
  }, [initialData, isEditing]);

  const typeColors = {
    despesa: activeType === 'despesa' ? 'var(--navy, #1e293b)' : '#1e293b',
    despesa_cartao: isDarkMode ? '#2ec4b6' : 'var(--sicoob-teal, #00AE9A)',
    receita: '#00995D',
    emprestimo: '#D97706'
  };

  const typeIcons = {
    despesa: 'payments',
    despesa_cartao: 'credit_card',
    receita: 'account_balance_wallet',
    emprestimo: 'account_balance'
  };

  const typeLabels = {
    despesa: 'DESPESA',
    despesa_cartao: 'CARTÃO',
    receita: 'RECEITA',
    emprestimo: 'EMPRÉSTIMO'
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* Unified Header */}
      <header className="mb-4 md:mb-8 pe-10">
        <div className="flex items-center gap-3 md:gap-4">
          <span
            className="material-symbols-outlined transition-all duration-300 text-[40px] md:text-[54px] leading-none"
            style={{
              fontVariationSettings: "'FILL' 1",
              color: typeColors[activeType]
            }}
          >
            {typeIcons[activeType]}
          </span>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-3xl font-headline font-black text-foreground tracking-tight leading-none mb-1">
              {isEditing ? 'Editar Registro' : 'Novo Registro'}
            </h1>
            <span
              className="font-headline font-bold uppercase tracking-[0.2em] text-[10px] md:text-[13px] transition-all duration-300 ml-0.5 leading-none"
              style={{ color: typeColors[activeType], opacity: 0.85 }}
            >
              {typeLabels[activeType]}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs Selector */}
      {!isEditing && (
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <div className="bg-muted/20 p-1 rounded-full flex w-full max-w-[560px] h-11 md:h-12 relative border border-border/50 shadow-inner overflow-hidden">
            {/* Sliding Pill Background - 4 options = 25% each */}
            <div
              className="absolute top-1 bottom-1 shadow-md transition-all duration-300 ease-out"
              style={{
                borderRadius: '9999px',
                backgroundColor: typeColors[activeType],
                left: activeType === 'despesa' ? '4px' :
                  activeType === 'despesa_cartao' ? 'calc(25% + 2px)' :
                    activeType === 'receita' ? 'calc(50% + 2px)' :
                      'calc(75% + 2px)',
                width: 'calc(25% - 6px)'
              }}
            />

            <button
              type="button"
              className={cn(
                "flex-1 relative z-10 text-[9px] md:text-[10px] font-bold md:font-black tracking-tight transition-all duration-300 flex items-center justify-center",
                activeType === 'despesa' ? "text-white" : "text-muted hover:text-foreground"
              )}
              onClick={() => setActiveType('despesa')}
            >
              <span className="md:hidden">DESP.</span>
              <span className="hidden md:inline">DESPESA</span>
            </button>

            <button
              type="button"
              className={cn(
                "flex-1 relative z-10 text-[9px] md:text-[10px] font-bold md:font-black tracking-tight transition-all duration-300 flex items-center justify-center",
                activeType === 'despesa_cartao' ? "text-white" : "text-muted hover:text-foreground"
              )}
              onClick={() => setActiveType('despesa_cartao')}
            >
              <span className="md:hidden">CART.</span>
              <span className="hidden md:inline">CARTÃO</span>
            </button>

            <button
              type="button"
              className={cn(
                "flex-1 relative z-10 text-[9px] md:text-[10px] font-bold md:font-black tracking-tight transition-all duration-300 flex items-center justify-center",
                activeType === 'receita' ? "text-white" : "text-muted hover:text-foreground"
              )}
              onClick={() => setActiveType('receita')}
            >
              <span className="md:hidden">REC.</span>
              <span className="hidden md:inline">RECEITA</span>
            </button>

            <button
              type="button"
              className={cn(
                "flex-1 relative z-10 text-[9px] md:text-[10px] font-bold md:font-black tracking-tight transition-all duration-300 flex items-center justify-center",
                activeType === 'emprestimo' ? "text-white" : "text-muted hover:text-foreground"
              )}
              onClick={() => setActiveType('emprestimo')}
            >
              <span className="md:hidden">EMP.</span>
              <span className="hidden md:inline">EMPRÉSTIMO</span>
            </button>
          </div>
        </div>
      )}

      {activeType === 'emprestimo' ? (
        <EmprestimoForm
          titulares={titulares}
          editingItem={initialData}
          onClose={onClose}
          onSubmit={onSubmitEmprestimo}
          hideHeader={true}
          themeColor={typeColors[activeType]}
        />
      ) : (
        <FinanceForm
          key={`${activeType}-${initialData ? (initialData as any).id : 'new'}`}
          type={activeType === 'receita' ? 'receita' : 'despesa'}
          subType={activeType === 'despesa_cartao' ? 'cartao' : (activeType === 'despesa' ? 'fixa' : initialSubType)}
          titulares={titulares}
          cartoes={cartoes}
          competencia={competencia}
          initialData={initialData}
          onClose={onClose}
          onSubmit={onSubmitFinance}
          onSubmitContaFixa={onSubmitContaFixa}
          hideHeader={true}
          themeColor={typeColors[activeType]}
        />
      )}
    </div>
  );
}


function CardSelectDropdown({ 
  value, 
  onChange, 
  cartoes 
}: { 
  value: string | number, 
  onChange: (id: string) => void, 
  cartoes: CartaoConfig[]
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCard = cartoes.find(c => c.id === Number(value));
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 md:py-2.5 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm text-on-surface flex items-center justify-between min-h-[44px]"
      >
        {selectedCard ? (
          <div className="flex items-center gap-3">
            <CardLogo name={selectedCard.nome_cartao} size="sm" />
            <span className="font-bold text-slate-900">{selectedCard.nome_cartao} <span className="text-slate-400 font-medium ml-1">— fecha em {getProximoFechamento(selectedCard)}</span></span>
          </div>
        ) : (
          <span className="text-slate-400 font-medium">Selecione um cartão</span>
        )}
        <span className="material-symbols-outlined text-slate-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-premium border border-slate-100 z-[1100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-[180px] overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {cartoes.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs italic">Nenhum cartão configurado</div>
            ) : (
              cartoes.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id.toString());
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg transition-all hover:bg-slate-50",
                    Number(value) === c.id ? "bg-slate-50 border border-slate-100" : "border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <CardLogo name={c.nome_cartao} size="xs" />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-900 leading-tight">{c.nome_cartao}</span>
                      <span className="text-[9px] text-slate-400 font-medium">Fecha: {getProximoFechamento(c)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-bold">Vence {c.dia_vencimento}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TitularSelectDropdown({ 
  value, 
  onChange, 
  titulares 
}: { 
  value: number, 
  onChange: (id: number) => void, 
  titulares: Titular[]
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedTitular = titulares.find(t => t.id === value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 md:py-2.5 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm text-on-surface flex items-center justify-between min-h-[44px]"
      >
        {selectedTitular ? (
          <div className="flex items-center gap-3">
            {selectedTitular.foto ? (
              <img src={selectedTitular.foto} alt={selectedTitular.nome} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                {selectedTitular.nome.charAt(0)}
              </div>
            )}
            <span className="font-bold text-slate-900">{selectedTitular.nome}</span>
          </div>
        ) : (
          <span className="text-slate-400 font-medium">Selecione um responsável</span>
        )}
        <span className="material-symbols-outlined text-slate-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-premium border border-slate-100 z-[1100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-[180px] overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {titulares.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onChange(t.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded-lg transition-all hover:bg-slate-50",
                  value === t.id ? "bg-slate-50 border border-slate-100" : "border border-transparent"
                )}
              >
                <div className="flex items-center gap-3 text-left">
                  {t.foto ? (
                    <img src={t.foto} alt={t.nome} className="w-7 h-7 rounded-full object-cover border border-slate-100" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                      {t.nome.charAt(0)}
                    </div>
                  )}
                  <span className="text-[13px] font-bold text-slate-900">{t.nome}</span>
                </div>
                {value === t.id && <span className="material-symbols-outlined text-navy text-sm">check</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FinanceForm({
  type,
  subType,
  onSubmit,
  initialData,
  titulares,
  cartoes,
  competencia,
  onClose,
  onSubmitContaFixa,
  hideHeader,
  themeColor = '#1e293b'
}: {
  type: 'despesa' | 'receita',
  subType?: 'cartao' | 'boleto' | 'fixa',
  onSubmit: (data: Omit<Despesa, 'id'> | Omit<Receita, 'id'>) => Promise<void> | void,
  initialData?: Despesa | Receita | ContaFixaConfig,
  titulares: Titular[],
  cartoes: CartaoConfig[],
  competencia: string,
  onClose: () => void,
  onSubmitContaFixa?: (data: Omit<ContaFixaConfig, 'id' | 'user_id' | 'family_id'>) => Promise<void> | void,
  hideHeader?: boolean,
  themeColor?: string
}) {
  const [formData, setFormData] = useState({
    descricao: initialData?.descricao || (initialData as any)?.estabelecimento || '',
    valor: (initialData as any)?.valor_mensal?.toString() || (initialData as any)?.valor?.toString() || '',
    titular_id: initialData?.titular_id || titulares[0]?.id,
    categoria: (initialData as any)?.categoria || '',
    vencimento: (initialData as any)?.vencimento || (initialData as any)?.data_recebimento || (initialData as any)?.data_inicio || (initialData as any)?.data_compra || format(new Date(), 'yyyy-MM-dd'),
    status: (initialData as any)?.status || 'Em aberto',
    parcela_atual: (initialData as any)?.parcela_atual || 1,
    parcela_total: (initialData as any)?.total_parcelas || (initialData as any)?.parcela_total || 1,
    cartao_vencimento_id: (initialData as any)?.cartao_vencimento_id || (initialData as any)?.cartao_id?.toString() || '',
  });

  const isRevenue = (type as string) === 'receita';
  const isExpense = (type as string) === 'despesa';

  const isMasterConfig = !!(initialData as any)?.data_inicio;
  const [isRecorrente, setIsRecorrente] = useState(isMasterConfig);
  const [isIndefinite, setIsIndefinite] = useState(isMasterConfig ? !(initialData as any).total_parcelas : true);

  const [paymentType, setPaymentType] = useState((initialData as any)?.parcela_total > 1 ? 'Parcelado' : 'A vista');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (validationError) {
      const timer = setTimeout(() => setValidationError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [validationError]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing(true);
    try {
      let finalDate = formData.vencimento;

    let titularId = formData.titular_id;
    if (type === 'despesa' && subType === 'cartao' && formData.cartao_vencimento_id) {
      const cartao = cartoes.find(c => c.id === parseInt(formData.cartao_vencimento_id as string));
      if (cartao) titularId = cartao.titular_id;
    }

    const data: Partial<Despesa> & Partial<Receita> = {
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      titular_id: titularId,
      competencia,
    };

    if (type === 'despesa') {
      data.categoria = formData.categoria || (subType === 'cartao' ? 'cartoes' : categorizar(formData.descricao));
      data.vencimento = finalDate;
      data.status = formData.status;
      data.parcela_atual = formData.parcela_atual;
      data.parcela_total = paymentType === 'A vista' ? 1 : (parseInt(formData.parcela_total as any) || (isRecorrente ? 12 : 2));
      data.cartao_vencimento_id = formData.cartao_vencimento_id ? parseInt(formData.cartao_vencimento_id as string) : undefined;

      if (!data.cartao_vencimento_id) {
        data.competencia = calcularCompetencia(parseISO(finalDate));
      } else {
        const cartao = cartoes.find(c => c.id === data.cartao_vencimento_id);
        if (cartao) {
          data.competencia = calcularCompetenciaCartao(parseISO(finalDate), cartao.dia_vencimento, cartao.dia_fechamento);
        }
      }
    } else {
      data.data_recebimento = finalDate;
      const dataAjustada = ajustarDataReceita(parseISO(finalDate));
      data.competencia = calcularCompetenciaReceita(dataAjustada);
      data.parcela_total = paymentType === 'A vista' ? 1 : (parseInt(formData.parcela_total as any) || (isRecorrente ? 12 : 2));
    }

    if ((type === 'despesa' && (subType === 'fixa' || subType === 'cartao') && isRecorrente) || (type === 'receita' && isRecorrente)) {
      if (onSubmitContaFixa) {
        await onSubmitContaFixa({
          descricao: formData.descricao,
          valor_mensal: parseFloat(formData.valor),
          total_parcelas: isIndefinite ? null : (parseInt(formData.parcela_total as any) || 12),
          parcela_atual: 1,
          data_inicio: finalDate,
          competencia_inicial: type === 'receita' 
            ? calcularCompetenciaReceita(ajustarDataReceita(parseISO(finalDate))) 
            : (subType === 'cartao' ? (data.competencia || competencia) : calcularCompetencia(parseISO(finalDate))),
          titular_id: titularId,
          categoria: subType === 'cartao' ? 'cartoes' : (formData.categoria || categorizar(formData.descricao)),
          cartao_id: subType === 'cartao' && formData.cartao_vencimento_id ? parseInt(formData.cartao_vencimento_id as string) : undefined,
          tipo: type as 'despesa' | 'receita'
        });
        return;
      }
    }

    await onSubmit(data as Omit<Despesa, 'id'> | Omit<Receita, 'id'>);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {!hideHeader && (
        <header className="mb-8 pe-10">
          <div className="flex items-center gap-4">
            <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-outline-variant/30 shadow-sm">
              <span className="material-symbols-outlined text-navy" style={{ fontVariationSettings: "'FILL' 1" }}>
                {type === 'despesa' ? 'payments' : 'account_balance_wallet'}
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-headline font-bold text-navy/50 uppercase tracking-[0.2em] text-[11px]">
                {subType === 'cartao' ? 'Cartão de Crédito' : type === 'despesa' ? 'Nova Despesa' : 'Nova Receita'}
              </span>
              <h1 className="text-4xl font-headline font-black text-slate-900 tracking-tight leading-tight">
                {type === 'despesa' ? 'Registro de Gasto' : 'Registro de Ganho'}
              </h1>
            </div>
          </div>
        </header>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
        <div className="relative group">
          <label className="text-[10px] md:label-md font-label text-muted mb-1 block ml-1 uppercase font-bold tracking-wider">Valor do Lançamento</label>
          <div className="flex items-center bg-muted/20 rounded-2xl px-4 py-2 md:py-3 focus-within:ring-2 focus-within:ring-primary/30 transition-all shadow-sm border border-border/50">
            <span className={cn(
              "text-lg md:text-xl font-headline font-bold transition-all mr-2 md:mr-3 mt-1",
              formData.valor ? "text-foreground" : "text-muted"
            )}>R$</span>
            <input
              required
              className={cn(
                "bg-transparent border-none focus:outline-none rounded-lg font-headline font-extrabold w-full p-0 transition-all px-1 text-xl md:text-2xl",
                formData.valor ? "text-foreground" : "text-muted"
              )}
              placeholder="0,00"
              type="number"
              step="0.01"
              value={formData.valor}
              onChange={e => setFormData({ ...formData, valor: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 md:gap-y-3">
          <div className="md:col-span-2">
            <label className="text-[10px] md:label-md font-label text-muted mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Descrição</label>
            <input
              required
              className="w-full bg-muted/20 border border-border/50 rounded-xl px-3.5 h-[44px] focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all font-body text-sm text-foreground"
              placeholder="Ex: Assinatura Mensal Software"
              type="text"
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
            />
          </div>

          {(type === 'receita' || subType !== 'cartao') && (
            <div className="md:col-span-2">
              <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Responsável</label>
              <TitularSelectDropdown
                value={formData.titular_id}
                onChange={id => setFormData({ ...formData, titular_id: id })}
                titulares={titulares}
              />
            </div>
          )}

          {type === 'despesa' && subType === 'cartao' && (
            <div className="md:col-span-2">
              <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Cartão / Vencimento</label>
              <CardSelectDropdown
                value={formData.cartao_vencimento_id}
                onChange={id => setFormData({ ...formData, cartao_vencimento_id: id })}
                cartoes={cartoes}
              />
            </div>
          )}

          {(isRevenue || (isExpense && (subType === 'fixa' || subType === 'cartao'))) && (
            <div className="md:col-span-2 flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-1">
              <div className="space-y-0.5">
                <span className="text-[10px] md:text-xs font-bold text-navy uppercase tracking-wider">
                  <span className="md:hidden">Tipo lancamento</span>
                  <span className="hidden md:inline">Modelo de Lançamento</span>
                </span>
                <p className="hidden md:block text-[10px] text-slate-500">
                  {isRevenue
                    ? 'Virtualizado permite ajustes em receitas variáveis como bônus'
                    : 'Virtualizado permite antecipações e ajustes mensais'}
                </p>
              </div>
              <div className="bg-[#F1F5F9] p-1 rounded-full flex w-48 h-10 relative border border-slate-200/50 shadow-inner overflow-hidden">
                {/* Sliding Pill Background */}
                <div
                  className={cn(
                    "absolute top-1 bottom-1 w-[calc(50%-4px)] shadow-md transition-all duration-300 ease-out",
                    isRecorrente ? "left-[calc(50%+2px)]" : "left-1"
                  )}
                  style={{
                    borderRadius: '9999px',
                    backgroundColor: themeColor
                  }}
                />

                <button
                  type="button"
                  className={cn(
                    "flex-1 relative z-10 text-[9px] md:text-[10px] font-black tracking-tight transition-all duration-300",
                    !isRecorrente ? "text-white" : "text-slate-400 hover:text-navy/40"
                  )}
                  onClick={() => setIsRecorrente(false)}
                > ÚNICO </button>

                <button
                  type="button"
                  className={cn(
                    "flex-1 relative z-10 text-[9px] md:text-[10px] font-black tracking-tight transition-all duration-300",
                    isRecorrente ? "text-white" : "text-slate-400 hover:text-navy/40"
                  )}
                  onClick={() => setIsRecorrente(true)}
                > VIRTUAL </button>
              </div>
            </div>
          )}

          {type === 'despesa' ? (
            <>
              <div className="md:col-span-2 grid grid-cols-2 gap-x-6 gap-y-3 items-start">
            <div>
              <div className="flex items-center justify-between mb-1 px-1 h-[26px]">
                <label className="text-[10px] md:label-md font-label text-on-surface-variant whitespace-nowrap uppercase font-bold tracking-wider">
                  {subType === 'cartao' ? 'Data da Compra' : 'Data de Vencimento'}
                </label>
              </div>
              <StyledDatePicker
                value={formData.vencimento}
                onChange={val => setFormData({ ...formData, vencimento: val })}
                className="w-100 h-[44px]"
              />
            </div>

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1 px-1 h-[26px]">
                  <label className="text-[10px] md:label-md font-label text-on-surface-variant whitespace-nowrap uppercase font-bold tracking-wider">
                    {isRecorrente
                      ? (isIndefinite ? 'Recorrência' : 'Duração')
                      : (isRevenue ? 'Tipo de Recebimento' : 'Tipo de Pagamento')}
                  </label>
                </div>

                <div className="bg-[#F1F5F9] p-[3px] rounded-full flex w-full h-[44px] relative border border-slate-200/50 shadow-inner">
                  {isRecorrente ? (
                    <>
                      <div
                        className={cn(
                          "absolute top-1 bottom-1 w-[calc(50%-4px)] shadow-md transition-all duration-300 ease-out",
                          !isIndefinite ? "left-[calc(50%+2px)]" : "left-1"
                        )}
                        style={{ 
                          borderRadius: '9999px', 
                          backgroundColor: themeColor 
                        }}
                      />
                      <button
                        type="button"
                        className={cn(
                          "flex-1 relative z-10 text-[9px] md:text-[11px] font-normal tracking-tight whitespace-nowrap leading-none px-1 transition-colors duration-200",
                          isIndefinite ? "text-white" : "text-slate-400"
                        )}
                        onClick={() => setIsIndefinite(true)}
                      >
                        <span className="md:hidden">S/ Prazo</span>
                        <span className="hidden md:inline">Sem Prazo</span>
                      </button>

                      {!isIndefinite ? (
                        <div className="flex-1 relative z-10 text-white flex items-center justify-center md:justify-between px-1.5 transition-all duration-300 h-full">
                          <button
                            type="button"
                            className="hidden md:flex w-6 h-6 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.max(1, (formData.parcela_total || 1) - 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="120"
                            className="w-full md:w-7 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                            value={formData.parcela_total}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData({ ...formData, parcela_total: val === '' ? '' as any : parseInt(val) });
                            }}
                          />
                          <button
                            type="button"
                            className="hidden md:flex w-6 h-6 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.min(120, (formData.parcela_total || 1) + 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={cn(
                            "flex-1 relative z-10 text-[9px] md:text-[11px] font-normal tracking-tight whitespace-nowrap leading-none px-1 transition-colors duration-200",
                            !isIndefinite ? "text-white" : "text-slate-400"
                          )}
                          onClick={() => {
                            setIsIndefinite(false);
                            if (!formData.parcela_total || formData.parcela_total === 1) {
                              setFormData({ ...formData, parcela_total: 12 });
                            }
                          }}
                        >
                          <span className="md:hidden">C/ Prazo</span>
                          <span className="hidden md:inline">Com Prazo</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className={cn(
                          "absolute top-1 bottom-1 w-[calc(50%-4px)] shadow-md transition-all duration-300 ease-out",
                          paymentType === 'Parcelado' ? "left-[calc(50%+2px)]" : "left-1"
                        )}
                        style={{ 
                          borderRadius: '9999px', 
                          backgroundColor: themeColor 
                        }}
                      />

                      <button
                        type="button"
                        className={cn(
                          "flex-1 relative z-10 text-[9px] md:text-[11px] font-normal tracking-tight whitespace-nowrap leading-none px-1",
                          paymentType === 'A vista' ? "text-white" : "text-slate-400 hover:text-navy/40"
                        )}
                        onClick={() => {
                          setPaymentType('A vista');
                          setFormData({ ...formData, parcela_total: 1 });
                        }}
                      >
                        À vista
                      </button>
                      {paymentType === 'Parcelado' ? (
                        <div
                          className="flex-1 relative z-10 flex items-center justify-center md:justify-between px-1.5 transition-all duration-300 h-full"
                        >
                          <button
                            type="button"
                            className="hidden md:flex w-6 h-6 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.max(2, (formData.parcela_total || 2) - 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                          </button>
                          <input
                            type="number"
                            min="2"
                            max="99"
                            className="w-full md:w-7 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                            value={formData.parcela_total}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData({ ...formData, parcela_total: val === '' ? '' as any : parseInt(val) });
                            }}
                          />
                          <button
                            type="button"
                            className="hidden md:flex w-6 h-6 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.min(99, (formData.parcela_total || 2) + 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={cn(
                            "flex-1 relative z-10 text-[9px] md:text-[11px] font-normal tracking-tight whitespace-nowrap leading-none px-1",
                            paymentType === 'Parcelado' ? "text-white" : "text-slate-400 hover:text-navy/40"
                          )}
                          onClick={() => {
                            setPaymentType('Parcelado');
                            setFormData({ ...formData, parcela_total: 2 });
                          }}
                        >
                          <span className="md:hidden">Parc.</span><span className="hidden md:inline">Parcelado</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
            <div className="md:col-span-2 grid grid-cols-2 gap-x-6 gap-y-3 items-start">
              <div>
                <div className="flex items-center justify-between mb-1 px-1 h-[26px]">
                  <label className="text-[10px] md:label-md font-label text-on-surface-variant whitespace-nowrap uppercase font-bold tracking-wider">
                    Data de Receber
                  </label>
                </div>
                <StyledDatePicker
                  value={formData.vencimento}
                  onChange={val => setFormData({ ...formData, vencimento: val })}
                  className="w-100 h-[44px]"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1 px-1 h-[26px]">
                  <label className="text-[10px] md:label-md font-label text-on-surface-variant whitespace-nowrap uppercase font-bold tracking-wider">
                    {isRecorrente
                      ? (isIndefinite ? 'Recorrência' : 'Duração')
                      : 'Tipo de Recebimento'}
                  </label>
                </div>

                <div className="bg-[#F1F5F9] p-[3px] rounded-full flex w-full h-[44px] relative border border-slate-200/50 shadow-inner">
                  {isRecorrente ? (
                    <>
                      <div
                        className={cn(
                          "absolute top-1 bottom-1 w-[calc(50%-4px)] shadow-md transition-all duration-300 ease-out",
                          !isIndefinite ? "left-[calc(50%+2px)]" : "left-1"
                        )}
                        style={{ 
                          borderRadius: '9999px', 
                          backgroundColor: '#00995D'
                        }}
                      />
                      <button
                        type="button"
                        className={cn(
                          "flex-1 relative z-10 text-[9px] md:text-[11px] font-normal tracking-tight whitespace-nowrap leading-none px-1 transition-colors duration-200",
                          isIndefinite ? "text-white" : "text-slate-400"
                        )}
                        onClick={() => setIsIndefinite(true)}
                      >
                        <span className="md:hidden">S/ Prazo</span>
                        <span className="hidden md:inline">Sem Prazo</span>
                      </button>

                      {!isIndefinite ? (
                        <div className="flex-1 relative z-10 text-white flex items-center justify-center md:justify-between px-1.5 transition-all duration-300 h-full">
                          <button
                            type="button"
                            className="hidden md:flex w-6 h-6 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.max(1, (formData.parcela_total || 1) - 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="120"
                            className="w-full md:w-7 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                            value={formData.parcela_total}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData({ ...formData, parcela_total: val === '' ? '' as any : parseInt(val) });
                            }}
                          />
                          <button
                            type="button"
                            className="hidden md:flex w-6 h-6 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.min(120, (formData.parcela_total || 1) + 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={cn(
                            "flex-1 relative z-10 text-[9px] md:text-[11px] font-normal tracking-tight whitespace-nowrap leading-none px-1 transition-colors duration-200",
                            !isIndefinite ? "text-white" : "text-slate-400"
                          )}
                          onClick={() => {
                            setIsIndefinite(false);
                            if (!formData.parcela_total || formData.parcela_total === 1) {
                              setFormData({ ...formData, parcela_total: 12 });
                            }
                          }}
                        >
                          <span className="md:hidden">C/ Prazo</span>
                          <span className="hidden md:inline">Com Prazo</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Sliding Pill Background - Hidden when <span className="md:hidden">Parc.</span><span className="hidden md:inline">Parcelado</span> is active to avoid overlap */}
                      <div
                        className={cn(
                          "absolute top-1 bottom-1 w-[calc(50%-4px)] shadow-md transition-all duration-300 ease-out",
                          paymentType === 'Parcelado' ? "left-[calc(50%+2px)]" : "left-1"
                        )}
                        style={{
                          borderRadius: '9999px',
                          backgroundColor: '#00995D'
                        }}
                      />

                      <button
                        type="button"
                        className={cn(
                          "flex-1 relative z-10 text-[9px] md:text-[11px] font-normal tracking-tight whitespace-nowrap leading-none px-1",
                          paymentType === 'A vista' ? "text-white" : "text-slate-400 hover:text-navy/40"
                        )}
                        onClick={() => {
                          setPaymentType('A vista');
                          setFormData({ ...formData, parcela_total: 1 });
                        }}
                      >
                        À vista
                      </button>
                      {paymentType === 'Parcelado' ? (
                        <div
                          className="flex-1 relative z-10 text-white flex items-center justify-center md:justify-between px-1.5 transition-all duration-300 h-full"
                        >
                          <button
                            type="button"
                            className="hidden md:flex w-6 h-6 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.max(2, (formData.parcela_total || 2) - 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                          </button>
                          <input
                            type="number"
                            min="2"
                            max="99"
                            className="w-full md:w-7 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                            value={formData.parcela_total}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData({ ...formData, parcela_total: val === '' ? '' as any : parseInt(val) });
                            }}
                          />
                          <button
                            type="button"
                            className="hidden md:flex w-6 h-6 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.min(99, (formData.parcela_total || 2) + 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={cn(
                            "flex-1 relative z-10 text-[9px] md:text-[11px] font-normal tracking-tight whitespace-nowrap leading-none px-1",
                            paymentType === 'Parcelado' ? "text-white" : "text-slate-400 hover:text-navy/40"
                          )}
                          onClick={() => {
                            setPaymentType('Parcelado');
                            setFormData({ ...formData, parcela_total: 2 });
                          }}
                        >
                          <span className="md:hidden">Parc.</span><span className="hidden md:inline">Parcelado</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>


        <div className="pt-2 md:pt-4 grid grid-cols-2 gap-x-4 md:gap-x-8 items-center">
          <button
            type="button"
            className="text-xs md:text-sm font-label font-semibold text-on-surface-variant hover:text-on-surface transition-colors text-left px-2"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={(e) => {
              if (isProcessing) return;
              
              if (!formData.descricao || formData.descricao.trim() === '') {
                setValidationError('Por favor, informe uma descrição.');
                return;
              }
              if (!formData.valor || isNaN(parseFloat(formData.valor)) || parseFloat(formData.valor) === 0) {
                setValidationError('Por favor, informe um valor válido (diferente de zero).');
                return;
              }
              if (type === 'despesa' && subType === 'cartao' && !formData.cartao_vencimento_id) {
                setValidationError('Por favor, selecione um cartão.');
                return;
              }
              
              handleSubmit(e as any);
            }}
            disabled={isProcessing}
            style={{ borderRadius: '9999px', backgroundColor: themeColor }}
            className="text-white h-[44px] md:h-[48px] font-label font-semibold text-xs md:text-sm shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all w-full flex items-center justify-center gap-2 opacity-90 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              <span className="material-symbols-outlined text-base md:text-lg">check_circle</span>
            )}
            {isProcessing ? 'Aguarde...' : (!!initialData ? 'Salvar' : 'Registrar')}
          </button>
        </div>
      </form>


      {/* Alerta de Validação Centralizado */}
      {validationError && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setValidationError(null)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative bg-white border-l-4 border-red-500 p-6 rounded-2xl shadow-2xl flex items-center gap-4 max-w-[90%] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <span className="material-symbols-outlined text-3xl">error</span>
            </div>
            <div className="flex-grow">
              <h4 className="font-bold text-navy mb-0.5">Atenção</h4>
              <p className="text-slate-500 text-sm mb-0">{validationError}</p>
            </div>
            <button
              onClick={() => setValidationError(null)}
              className="text-slate-300 hover:text-slate-500 transition-colors ml-4"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function TitularForm({
  onSubmit,
  initialData,
  onCancel,
  themeColor
}: {
  onSubmit: (data: Omit<Titular, 'id'>) => void,
  initialData?: Titular,
  onCancel?: () => void,
  themeColor?: string
}) {
  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    foto: initialData?.foto || ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setSizeError('Arquivo muito grande! O limite para a foto do titular é de 1MB.');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `titulares/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData({ ...formData, foto: publicUrl });
    } catch (error: any) {
      console.warn('Supabase Storage error (falling back to local):', error.message || error);

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData((prev: { nome: string; foto: string }) => ({ ...prev, foto: reader.result as string }));
          resolve();
        };
        reader.readAsDataURL(file);
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit({ ...formData, foto: formData.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.nome)}&background=random&color=fff&bold=true` }); }} className="row g-3">
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Nome do Titular</label>
        <input
          required
          type="text"
          className="form-control rounded-3"
          value={formData.nome}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nome: e.target.value })}
        />
      </div>
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Foto do Titular</label>
        <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 border">
          <div className="position-relative" style={{ width: '60px', height: '60px' }}>
            {formData.foto ? (
              <Image
                src={formData.foto}
                alt="Preview"
                fill
                className="rounded-circle object-cover border"
                unoptimized
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-100 h-100 rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center text-secondary">
                <i className="fa-solid fa-user fa-xl"></i>
              </div>
            )}
          </div>
          <div className="flex-grow-1">
            <input
              type="file"
              accept="image/*"
              className="d-none"
              id="foto-upload"
              onChange={handleFileChange}
            />
            <label
              htmlFor="foto-upload"
              className="btn btn-sm btn-outline-primary fw-bold text-uppercase"
            >
              {isUploading ? 'Processando...' : 'Escolher Foto'}
            </label>
            <p className="small text-muted mb-0 mt-1" style={{ fontSize: '10px' }}>PNG, JPG ou GIF (Máx. 1MB)</p>
          </div>
        </div>
      </div>
      <div className="col-12 mt-2 md:mt-4 d-flex gap-2 md:gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-outline-secondary w-100 py-2.5 md:py-3 fw-bold rounded-pill text-uppercase text-xs md:text-sm"
          >
            Cancelar
          </button>
        )}
        <button
          disabled={isUploading}
          className={cn(
            "btn w-100 py-2.5 md:py-3 fw-bold rounded-pill text-uppercase text-xs md:text-sm",
            !themeColor ? "btn-primary" : "text-white"
          )}
          style={{ backgroundColor: themeColor }}
        >
          <i className="fa-solid fa-check me-2"></i>Salvar Titular
        </button>
      </div>

      {sizeError && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-card p-4 rounded-4 shadow-lg text-center border border-border animate-in zoom-in-95" style={{ maxWidth: '320px' }}>
            <div className="mb-3 text-danger">
              <i className="fa-solid fa-circle-exclamation fa-3x"></i>
            </div>
            <h6 className="fw-bold mb-2">Ops! Arquivo muito grande</h6>
            <p className="small text-muted mb-4">{sizeError}</p>
            <button
              type="button"
              className="btn btn-primary rounded-pill px-4 fw-bold w-100"
              onClick={() => setSizeError(null)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export function CartaoForm({
  onSubmit,
  titulares,
  initialData,
  onCancel,
  themeColor
}: {
  onSubmit: (data: Omit<CartaoConfig, 'id'>) => void,
  titulares: Titular[],
  initialData?: CartaoConfig,
  onCancel?: () => void,
  themeColor?: string
}) {
  const resolveColor = (data?: CartaoConfig) => {
    if (data?.color && data.color.trim()) return data.color;
    if ((data as any)?.cor && (data as any).cor.trim()) return (data as any).cor;
    if (data?.nome_cartao) {
      const norm = data.nome_cartao.toLowerCase();
      if (norm.includes('nubank')) return '#820AD1';
      if (norm.includes('inter')) return '#FF5100';
      if (norm.includes('mercado pago')) return '#222A37';
      if (norm.includes('platinum')) return '#00353E';
      if (norm.includes('sicoob')) return '#00AE9A';
      if (norm.includes('itaú') || norm.includes('itau')) return '#EC7000';
      if (norm.includes('bradesco')) return '#CC092F';
      if (norm.includes('santander')) return '#EA1D2C';
      if (norm.includes('xp') || norm.includes('c6') || norm.includes('black')) return '#1A1A1A';
      if (norm.includes('caixa')) return '#005CA9';
      if (norm.includes('bb') || norm.includes('brasil')) return '#003882';
    }
    return '#00AE9A';
  };

  const resolveFinal = (data?: CartaoConfig) => {
    if (data?.final !== undefined && data?.final !== null && String(data.final).trim() !== '') return String(data.final);
    if ((data as any)?.final_cartao) return String((data as any).final_cartao);
    if ((data as any)?.ultimos_digitos) return String((data as any).ultimos_digitos);
    if (data?.nome_cartao) {
      const norm = data.nome_cartao.toLowerCase();
      if (norm.includes('7376')) return '7376';
      if (norm.includes('7262')) return '7262';
      if (norm.includes('4904')) return '4904';
      if (norm.includes('4321')) return '4321';
      if (norm.includes('1234')) return '1234';
    }
    return '';
  };

  const resolveIcone = (data?: CartaoConfig) => {
    if (data?.icone) return data.icone;
    if ((data as any)?.['ícone']) return (data as any)['ícone'];
    if ((data as any)?.icon) return (data as any).icon;
    return '';
  };

  const [formData, setFormData] = useState({
    nome_cartao: initialData?.nome_cartao || '',
    titular_id: initialData?.titular_id || titulares[0]?.id || 0,
    dia_vencimento: initialData?.dia_vencimento || 10,
    dia_fechamento: initialData?.dia_fechamento || 3,
    final: resolveFinal(initialData),
    color: resolveColor(initialData),
    icone: resolveIcone(initialData)
  });

  useEffect(() => {
    setFormData({
      nome_cartao: initialData?.nome_cartao || '',
      titular_id: initialData?.titular_id || titulares[0]?.id || 0,
      dia_vencimento: initialData?.dia_vencimento || 10,
      dia_fechamento: initialData?.dia_fechamento || 3,
      final: resolveFinal(initialData),
      color: resolveColor(initialData),
      icone: resolveIcone(initialData)
    });
  }, [initialData, titulares]);

  const [iconError, setIconError] = useState<string | null>(null);

  const PRESET_COLORS = [
    { name: 'Sicoob Verde', color: '#00AE9A' },
    { name: 'Sicoob Dark', color: '#00353E' },
    { name: 'Nubank Roxo', color: '#820AD1' },
    { name: 'Inter Laranja', color: '#FF5100' },
    { name: 'Mercado Pago', color: '#222A37' },
    { name: 'XP Black', color: '#1A1A1A' },
    { name: 'Itaú Laranja', color: '#EC7000' },
    { name: 'Bradesco', color: '#CC092F' },
    { name: 'Santander', color: '#EA1D2C' },
    { name: 'Azul Real', color: '#3b82f6' },
    { name: 'Emerald Teal', color: '#10b981' },
    { name: 'Neon Purple', color: '#8b5cf6' }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setIconError('O tamanho da imagem não pode ultrapassar 1MB.');
      return;
    }

    setIconError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setFormData(prev => ({ ...prev, icone: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => {
      const updates: any = { nome_cartao: name };
      // Se for novo cartão e a cor ainda estiver como default, sugere a cor do banco
      if (!initialData && prev.color === '#00AE9A') {
        const norm = name.toLowerCase();
        if (norm.includes('nubank')) updates.color = '#820AD1';
        else if (norm.includes('inter')) updates.color = '#FF5100';
        else if (norm.includes('mercado pago')) updates.color = '#222A37';
        else if (norm.includes('platinum')) updates.color = '#00353E';
        else if (norm.includes('itaú') || norm.includes('itau')) updates.color = '#EC7000';
        else if (norm.includes('bradesco')) updates.color = '#CC092F';
        else if (norm.includes('santander')) updates.color = '#EA1D2C';
        else if (norm.includes('xp') || norm.includes('c6')) updates.color = '#1A1A1A';
      }
      return { ...prev, ...updates };
    });
  };

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(formData); }} className="row g-3">
      {/* Nome do Cartão */}
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Nome do Cartão</label>
        <input
          required
          type="text"
          placeholder="Ex: Nubank Ultravioleta, Sicoob Black..."
          className="form-control rounded-3"
          value={formData.nome_cartao}
          onChange={e => handleNameChange(e.target.value)}
        />
      </div>

      {/* Titular e Final do Cartão */}
      <div className="col-md-7">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Titular</label>
        <select
          className="form-select rounded-3"
          value={formData.titular_id}
          onChange={e => setFormData({ ...formData, titular_id: parseInt(e.target.value) })}
        >
          {titulares.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>

      <div className="col-md-5">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Final do Cartão</label>
        <input
          type="text"
          maxLength={4}
          placeholder="Ex: 4904"
          className="form-control rounded-3"
          value={formData.final}
          onChange={e => setFormData({ ...formData, final: e.target.value.replace(/\D/g, '').slice(0, 4) })}
        />
      </div>

      {/* Cor do Cartão: Caixa organizada com tudo visível */}
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1.5 ml-1 block">
          Cor do Cartão
        </label>
        <div className="p-3 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
          {/* Grade de Cores Pré-definidas */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {PRESET_COLORS.map(p => {
              const isSelected = formData.color?.toLowerCase() === p.color.toLowerCase();
              return (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: p.color }))}
                  title={p.name}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all p-0 shadow-xs cursor-pointer relative d-flex align-items-center justify-content-center",
                    isSelected ? "border-white scale-110 shadow-md ring-2 ring-primary" : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                  )}
                  style={{ backgroundColor: p.color }}
                >
                  {isSelected && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                </button>
              );
            })}
          </div>

          {/* Seletor Customizado HEX Direto e Visível */}
          <div className="d-flex align-items-center justify-content-between gap-3 pt-2 border-t border-border/40">
            <div className="d-flex align-items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-xl border border-white/20 shadow-sm relative overflow-hidden flex-shrink-0 cursor-pointer"
                style={{ backgroundColor: formData.color || '#00AE9A' }}
              >
                <input
                  type="color"
                  value={formData.color?.startsWith('#') && formData.color.length === 7 ? formData.color : '#00AE9A'}
                  onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="position-absolute opacity-0 inset-0 w-100 h-100 cursor-pointer"
                  title="Clique para abrir o painel de cor"
                />
              </div>
              <div>
                <span className="text-[11px] font-bold text-foreground block leading-tight">Cor Personalizada</span>
                <span className="text-[10px] text-muted">Clique no quadrado ou digite o código HEX</span>
              </div>
            </div>

            <div className="d-flex align-items-center bg-card border border-border rounded-xl px-2.5 py-1" style={{ width: '115px' }}>
              <span className="text-xs text-muted font-mono me-1">#</span>
              <input
                type="text"
                maxLength={6}
                value={(formData.color || '').replace(/^#/, '')}
                onChange={e => {
                  const hexOnly = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                  setFormData(prev => ({ ...prev, color: '#' + hexOnly }));
                }}
                placeholder="00AE9A"
                className="form-control border-0 p-0 shadow-none bg-transparent text-xs font-mono font-bold text-foreground w-100 uppercase"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logotipo / Ícone do Cartão (Upload de até 1MB ou Link) */}
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">
          Ícone / Logotipo do Cartão (Opcional - até 1MB)
        </label>
        <div className="d-flex align-items-center gap-3">
          {formData.icone ? (
            <div className="position-relative flex-shrink-0" style={{ width: '48px', height: '48px' }}>
              <div className="w-100 h-100 rounded-2xl bg-muted/40 border border-border p-1 d-flex align-items-center justify-content-center overflow-hidden">
                <img src={formData.icone} alt="Prévia" className="w-100 h-100 object-contain" />
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, icone: '' })}
                className="position-absolute top-0 end-0 -translate-y-1 translate-x-1 btn btn-danger btn-sm p-0 rounded-circle d-flex align-items-center justify-content-center border-0"
                style={{ width: '18px', height: '18px', fontSize: '9px' }}
                title="Remover ícone"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-muted/20 border border-dashed border-border d-flex align-items-center justify-content-center text-muted flex-shrink-0">
              <i className="fa-solid fa-image text-sm opacity-50"></i>
            </div>
          )}

          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2">
              <label className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1.5 text-xs font-bold cursor-pointer m-0">
                <i className="fa-solid fa-upload me-1.5"></i>Carregar Imagem
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="d-none"
                />
              </label>
              <span className="text-[10px] text-muted">Máx 1MB</span>
            </div>
            {iconError && <div className="text-danger text-[11px] mt-1">{iconError}</div>}
          </div>
        </div>
      </div>

      {/* Datas de Vencimento e Fechamento */}
      <div className="col-md-6">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Dia Vencimento</label>
        <input
          required
          type="number"
          min="1" max="31"
          className="form-control rounded-3"
          value={formData.dia_vencimento || ''}
          onChange={e => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="col-md-6">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Dia Fechamento</label>
        <input
          required
          type="number"
          min="1" max="31"
          className="form-control rounded-3"
          value={formData.dia_fechamento || ''}
          onChange={e => setFormData({ ...formData, dia_fechamento: parseInt(e.target.value) || 0 })}
        />
      </div>

      {/* Botões de Ação */}
      <div className="col-12 mt-2 md:mt-4 d-flex gap-2 md:gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-outline-secondary w-100 py-2.5 md:py-3 fw-bold rounded-pill text-uppercase text-xs md:text-sm"
          >
            Cancelar
          </button>
        )}
        <button 
          className={cn(
            "btn w-100 py-2.5 md:py-3 fw-bold rounded-pill text-uppercase text-xs md:text-sm",
            !themeColor ? "btn-primary" : "text-white"
          )}
          style={{ backgroundColor: themeColor || 'var(--primary)' }}
        >
          <i className="fa-solid fa-credit-card me-2"></i>Salvar Cartão
        </button>
      </div>
    </form>
  );
}


// =========================================================
// NOVO: StyledDatePicker (Calendário Elegante e Estiloso)
// =========================================================
export function StyledDatePicker({
  value,
  onChange,
  placeholder = "Selecione a data",
  className,
  placement = 'auto',
  align = 'auto'
}: {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  placement?: 'top' | 'bottom' | 'auto';
  align?: 'left' | 'right' | 'auto';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [posStyle, setPosStyle] = useState<{
    top?: string;
    bottom?: string;
    left?: string | number;
    right?: string | number;
  }>({ top: 'calc(100% + 6px)', left: 0 });

  const parsedDate = useMemo(() => {
    try {
      return value ? parseISO(value) : new Date();
    } catch {
      return new Date();
    }
  }, [value]);

  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());

  useEffect(() => {
    if (value) {
      try {
        const d = parseISO(value);
        setViewMonth(d.getMonth());
        setViewYear(d.getFullYear());
      } catch {}
    }
  }, [value]);

  // Posicionamento inteligente para não alterar o tamanho de cards nem de modais
  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popoverHeight = 310;
    const popoverWidth = 270;

    let targetTop: string | undefined = undefined;
    let targetBottom: string | undefined = undefined;
    let targetLeft: string | number | undefined = 0;
    let targetRight: string | number | undefined = 'auto';

    if (placement === 'top' || (placement === 'auto' && spaceBelow < popoverHeight && spaceAbove > spaceBelow)) {
      targetBottom = 'calc(100% + 6px)';
    } else {
      targetTop = 'calc(100% + 6px)';
    }

    if (align === 'right' || (align === 'auto' && rect.left + popoverWidth > window.innerWidth - 16)) {
      targetLeft = 'auto';
      targetRight = 0;
    } else {
      targetLeft = 0;
      targetRight = 'auto';
    }

    setPosStyle({ top: targetTop, bottom: targetBottom, left: targetLeft, right: targetRight });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const onResize = () => updatePosition();
      window.addEventListener('resize', onResize);
      window.addEventListener('scroll', onResize, true);
      return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onResize, true);
      };
    }
  }, [isOpen, placement, align]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const daysOfWeek = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  // Calculate days for the month view
  const calendarDays = useMemo(() => {
    const firstDayDate = new Date(viewYear, viewMonth, 1);
    const startDay = getDay(firstDayDate);
    const daysInCurrentMonth = getDaysInMonth(firstDayDate);

    const prevMonthDate = subMonths(firstDayDate, 1);
    const daysInPrevMonth = getDaysInMonth(prevMonthDate);

    const days = [];

    // Previous month padding
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        dateStr: format(new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), daysInPrevMonth - i), 'yyyy-MM-dd')
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        dateStr: format(new Date(viewYear, viewMonth, i), 'yyyy-MM-dd')
      });
    }

    // Next month padding to fill grid to multiple of 7
    const remaining = (7 - (days.length % 7)) % 7;
    const nextMonthDate = addMonths(firstDayDate, 1);
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        dateStr: format(new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), i), 'yyyy-MM-dd')
      });
    }

    return days;
  }, [viewMonth, viewYear]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectToday = () => {
    const today = new Date();
    const str = format(today, 'yyyy-MM-dd');
    onChange(str);
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setIsOpen(false);
  };

  return (
    <div className={cn("position-relative", className ? "w-100" : "")} ref={containerRef} style={{ display: className ? 'block' : 'inline-block' }}>
      {/* Trigger: Input limpo com botão dedicado no ícone de calendário */}
      <div
        className={cn(
          "d-flex align-items-center justify-content-between gap-2 px-3 py-2 bg-muted/20 border border-border/50 rounded-xl transition-all h-[44px]",
          className
        )}
      >
        <span className="text-sm font-normal text-foreground select-none truncate">
          {value ? formatDate(value) : <span className="text-muted">{placeholder}</span>}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="btn btn-sm btn-icon p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/10 transition-all border-0 flex-shrink-0 cursor-pointer"
          title="Abrir calendário"
        >
          <i className={cn("fa-solid fa-calendar-days text-sm transition-colors", isOpen ? "text-foreground" : "text-muted")}></i>
        </button>
      </div>

      {/* Floating Popover Calendar (Never alters parent height/size) */}
      {isOpen && (
        <div 
          className="position-absolute bg-card border border-border p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          style={{
            ...posStyle,
            width: '270px',
            borderRadius: '18px',
            boxShadow: '0 16px 45px rgba(0, 0, 0, 0.75)',
            background: 'var(--card, #131620)',
            zIndex: 1200,
            pointerEvents: 'auto'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header with Month / Year Navigation */}
          <div className="d-flex align-items-center justify-content-between mb-2 px-1">
            <button
              type="button"
              className="btn btn-sm btn-icon rounded-full border-0 bg-muted/20 hover:bg-muted/40 text-muted hover:text-foreground p-1 cursor-pointer"
              style={{ width: '26px', height: '26px', borderRadius: '9999px' }}
              onClick={handlePrevMonth}
            >
              <i className="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
            <div className="text-xs font-semibold text-foreground tracking-tight">
              {monthNames[viewMonth]} <span className="text-muted font-medium ms-1">{viewYear}</span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-icon rounded-full border-0 bg-muted/20 hover:bg-muted/40 text-muted hover:text-foreground p-1 cursor-pointer"
              style={{ width: '26px', height: '26px', borderRadius: '9999px' }}
              onClick={handleNextMonth}
            >
              <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {daysOfWeek.map((d, i) => (
              <span key={i} className="text-[10px] font-normal text-muted opacity-60">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((item, idx) => {
              const isSelected = item.dateStr === value;
              const isToday = item.dateStr === format(new Date(), 'yyyy-MM-dd');

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(item.dateStr);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-7 h-7 d-flex align-items-center justify-content-center text-xs font-normal transition-all border-0 cursor-pointer",
                    isSelected
                      ? "bg-primary text-white font-bold shadow-sm"
                      : item.isCurrentMonth
                        ? "text-foreground hover:bg-muted/40"
                        : "text-muted opacity-30 hover:bg-muted/20",
                    isToday && !isSelected && "ring-1 ring-border text-foreground font-semibold"
                  )}
                  style={{
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'var(--primary)' : undefined,
                    color: isSelected ? '#ffffff' : undefined
                  }}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Quick Footer Action */}
          <div className="d-flex align-items-center justify-content-between pt-2 mt-2 border-t border-border/40">
            <button
              type="button"
              className="btn btn-link p-0 text-[11px] font-medium text-foreground hover:underline text-decoration-none"
              onClick={handleSelectToday}
            >
              <i className="fa-solid fa-bolt me-1 text-[10px] text-muted"></i>Hoje
            </button>
            <button
              type="button"
              className="btn btn-link p-0 text-[11px] font-medium text-muted hover:text-danger text-decoration-none"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MonthYearModal({
  isOpen,
  onClose,
  currentMonth,
  currentYear,
  onSelect
}: {
  isOpen: boolean,
  onClose: () => void,
  currentMonth: number,
  currentYear: number,
  onSelect: (month: number, year: number) => void
}) {
  const [viewYear, setViewYear] = useState(currentYear);
  const meses = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  useEffect(() => {
    if (isOpen) {
      setViewYear(currentYear);
    }
  }, [isOpen, currentYear]);

  if (!isOpen) return null;

  return (
    <>
      {/* Transparent Click-Outside Backdrop */}
      <div className="fixed inset-0 z-[2999]" onClick={onClose} />

      {/* Popover Limpo Flutuante (sem alterar o layout dos cards ou popups) */}
      <div 
        className="fixed z-[3000] animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: 'clamp(68px, 9vh, 82px)',
          right: 'clamp(12px, 3vw, 28px)',
          width: '260px',
          maxWidth: 'calc(100vw - 24px)'
        }}
      >
        <div
          className="bg-card border border-border rounded-3xl p-3.5 shadow-2xl"
          style={{
            background: 'var(--card, #12141c)',
            fontFamily: "'Plus Jakarta Sans', 'Outfit', 'Inter', -apple-system, sans-serif"
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header com Ano em destaque (fonte maior) e Setas de Navegação */}
          <div className="d-flex align-items-center justify-content-between px-2 mb-3">
            <button
              type="button"
              className="btn btn-sm btn-link p-1 text-muted hover:text-primary text-decoration-none border-0 transition-transform active:scale-90"
              onClick={() => setViewYear(prev => prev - 1)}
              title="Ano anterior"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            
            <span 
              className="font-bold text-foreground tracking-wide text-center"
              style={{
                fontSize: '1.15rem',
                letterSpacing: '0.03em'
              }}
            >
              {viewYear}
            </span>
            
            <button
              type="button"
              className="btn btn-sm btn-link p-1 text-muted hover:text-primary text-decoration-none border-0 transition-transform active:scale-90"
              onClick={() => setViewYear(prev => prev + 1)}
              title="Próximo ano"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          {/* Grid de 12 Meses: Sem negrito, tipografia elegante e formato de pílula na cor de destaque */}
          <div className="grid grid-cols-3 gap-2">
            {meses.map((mes, index) => {
              const monthNum = index + 1;
              const isSelected = monthNum === currentMonth && viewYear === currentYear;
              return (
                <button
                  key={mes}
                  type="button"
                  className={cn(
                    "py-1.5 px-1 text-center text-xs transition-all border-0 rounded-full",
                    isSelected
                      ? "text-white font-medium shadow-sm"
                      : "text-foreground font-normal hover:bg-muted/60"
                  )}
                  style={{ 
                    backgroundColor: isSelected ? 'var(--primary, #4361ee)' : 'transparent',
                    boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.2)' : undefined,
                    borderRadius: '9999px',
                    letterSpacing: '0.01em'
                  }}
                  onClick={() => {
                    onSelect(monthNum, viewYear);
                    onClose();
                  }}
                >
                  {mes}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}


export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  variant = 'danger'
}: {
  isOpen: boolean,
  onClose: () => void,
  onConfirm: () => Promise<void> | void,
  title: string,
  message: string,
  confirmLabel?: string,
  variant?: 'danger' | 'primary' | 'success'
}) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 3000 }} onClick={!isProcessing ? onClose : undefined}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px', zIndex: 3001 }} onClick={e => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 shadow-lg p-2 bg-card">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">{title}</h5>
            <button type="button" className="btn-close" onClick={!isProcessing ? onClose : undefined} disabled={isProcessing}></button>
          </div>
          <div className="modal-body py-4 text-center">
            <div className={`d-inline-flex p-3 rounded-circle bg-${variant} bg-opacity-10 text-${variant} mb-3`}>
              <i className={`fa-solid ${variant === 'danger' ? 'fa-trash-can' : 'fa-circle-question'} fa-2xl`}></i>
            </div>
            <p className="text-muted mb-0">{message}</p>
          </div>
          <div className="modal-footer border-0 pt-0 gap-2">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-bold flex-grow-1" onClick={onClose} disabled={isProcessing}>Cancelar</button>
            <button
              type="button"
              className={`btn btn-${variant} rounded-pill px-4 fw-bold flex-grow-1 d-flex justify-content-center align-items-center gap-2`}
              onClick={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
              {isProcessing ? 'Aguarde...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export function ProfileForm({
  onSubmit,
  initialData
}: {
  onSubmit: (data: Partial<Profile>) => void,
  initialData?: Profile | null
}) {
  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    foto: initialData?.foto || ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setSizeError('Arquivo muito grande! O limite para a foto de perfil é de 1MB.');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${initialData?.id || Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData({ ...formData, foto: publicUrl });
    } catch (error: any) {
      console.warn('Supabase Storage error (falling back to local):', error.message || error);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev: { nome: string; foto: string }) => ({ ...prev, foto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit(formData); }} className="row g-3">
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block whitespace-nowrap">Seu Nome</label>
        <input
          required
          type="text"
          className="form-control rounded-3"
          value={formData.nome}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nome: e.target.value })}
        />
      </div>
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block whitespace-nowrap">Sua Foto</label>
        <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 border">
          <div className="position-relative" style={{ width: '60px', height: '60px' }}>
            {formData.foto ? (
              <Image
                src={formData.foto}
                alt="Preview"
                fill
                className="rounded-circle object-cover border"
                unoptimized
              />
            ) : (
              <div className="w-100 h-100 rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center text-secondary">
                <i className="fa-solid fa-user fa-xl"></i>
              </div>
            )}
          </div>
          <div className="flex-grow-1">
            <input
              type="file"
              accept="image/*"
              className="d-none"
              id="profile-foto-upload"
              onChange={handleFileChange}
            />
            <label
              htmlFor="profile-foto-upload"
              className="btn btn-sm btn-outline-primary fw-bold text-uppercase"
            >
              {isUploading ? 'Processando...' : 'Trocar Foto'}
            </label>
            <p className="small text-muted mb-0 mt-1" style={{ fontSize: '10px' }}>PNG, JPG ou GIF (Máx. 1MB)</p>
          </div>
        </div>
      </div>
      {sizeError && <div className="col-12 mt-2 alert alert-danger small py-2">{sizeError}</div>}
      <div className="col-12 mt-4 d-flex gap-2">
        <button
          disabled={isUploading}
          className="btn btn-primary w-100 py-3 fw-bold rounded-pill text-uppercase text-xs md:text-sm"
        >
          <i className="fa-solid fa-check me-2"></i>Atualizar Perfil
        </button>
      </div>
    </form>
  );
}

import { CardLogo } from './card-ui';


// ==================== NOVOS: EMPRÉSTIMOS E QUITAÇÃO ====================

export function EmprestimoForm({
  onSubmit,
  titulares,
  onClose,
  editingItem,
  hideHeader,
  themeColor = '#1e293b'
}: {
  onSubmit: (data: Partial<Emprestimo>) => void,
  titulares: Titular[],
  onClose: () => void,
  editingItem?: Emprestimo | null,
  hideHeader?: boolean,
  themeColor?: string
}) {
  const [formData, setFormData] = useState({
    descricao: '',
    valor_parcela: '',
    taxa_mensal_percentual: '1.79', // Sugestão padrão do usuário
    total_parcelas: '12',
    data_primeiro_vencimento: format(new Date(), 'yyyy-MM-01'),
    competencia_inicial: format(new Date(), 'MM/yyyy'),
    titular_id: titulares[0]?.id || 0
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        descricao: editingItem.descricao || '',
        valor_parcela: String(editingItem.valor_parcela || ''),
        taxa_mensal_percentual: String(editingItem.taxa_mensal_percentual || ''),
        total_parcelas: String(editingItem.total_parcelas || ''),
        data_primeiro_vencimento: editingItem.data_primeiro_vencimento || '',
        competencia_inicial: editingItem.competencia_inicial || format(new Date(), 'MM/yyyy'),
        titular_id: editingItem.titular_id
      });
    }
  }, [editingItem]);

  // Atualizar competência inicial automaticamente quando a data mudar
  useEffect(() => {
    if (!editingItem && formData.data_primeiro_vencimento) {
      const date = parseISO(formData.data_primeiro_vencimento);
      if (!isNaN(date.getTime())) {
        const newComp = format(date, 'MM/yyyy');
        setFormData(prev => ({ ...prev, competencia_inicial: newComp }));
      }
    }
  }, [formData.data_primeiro_vencimento, editingItem]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      id: editingItem?.id,
      valor_parcela: parseFloat(formData.valor_parcela),
      taxa_mensal_percentual: parseFloat(formData.taxa_mensal_percentual),
      total_parcelas: parseInt(formData.total_parcelas)
    });
  };

  return (
    <>
      {!hideHeader && (
        <header className="mb-4 md:mb-8 pe-10">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="bg-[#FEF3C7] p-2 md:p-3 rounded-2xl border border-amber-200/30 shadow-sm">
              <span className="material-symbols-outlined text-amber-700 text-[32px] md:text-[54px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_balance
              </span>
            </div>
            <div className="space-y-0.5 md:space-y-1">
              <span className="font-headline font-bold text-amber-700/50 uppercase tracking-[0.2em] text-[9px] md:text-[11px]">
                Empréstimos e Financiamentos
              </span>
              <h1 className="text-xl md:text-4xl font-headline font-black text-slate-900 tracking-tight leading-tight">
                Novo Crédito
              </h1>
            </div>
          </div>
        </header>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {/* Linha 1: Descrição */}
          <div className="col-span-2">
            <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider mb-1 block ml-1 whitespace-nowrap">
              Descrição do Contrato
            </label>
            <input
              required
              className="w-full bg-muted/20 border border-border/50 rounded-xl px-3.5 h-[44px] focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all font-body text-sm text-foreground"
              placeholder="Ex: Financiamento Imobiliário Inter"
              type="text"
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
            />
          </div>

          {/* Linha 2: Responsável e Valor da Parcela */}
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider mb-1 block ml-1 whitespace-nowrap">
              Responsável
            </label>
            <select
              className="w-full bg-muted/20 border border-border/50 rounded-xl px-3.5 h-[44px] focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all font-body text-sm appearance-none text-foreground cursor-pointer"
              value={formData.titular_id}
              onChange={e => setFormData({ ...formData, titular_id: parseInt(e.target.value) })}
            >
              {titulares.map(t => <option key={t.id} value={t.id} className="bg-card text-foreground">{t.nome}</option>)}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider mb-1 block ml-1 whitespace-nowrap">
              Valor da Parcela (VF)
            </label>
            <div className="d-flex align-items-center bg-muted/20 border border-border/50 rounded-xl px-3.5 h-[44px] focus-within:ring-2 focus-within:ring-primary/30 transition-all">
              <span className="text-muted font-bold me-2 text-sm">R$</span>
              <input
                required
                className="bg-transparent border-0 focus:outline-none w-full font-bold text-foreground text-sm p-0"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.valor_parcela}
                onChange={e => setFormData({ ...formData, valor_parcela: e.target.value })}
              />
            </div>
          </div>

          {/* Linha 3: Taxa Mensal e Total Parcelas */}
          <div className="col-span-1">
            <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider mb-1 block ml-1 whitespace-nowrap">
              Taxa Mensal (%)
            </label>
            <div className="d-flex align-items-center bg-muted/20 border border-border/50 rounded-xl px-3.5 h-[44px] focus-within:ring-2 focus-within:ring-primary/30 transition-all">
              <input
                required
                className="bg-transparent border-0 focus:outline-none w-full font-bold text-foreground text-sm p-0"
                type="number"
                step="0.0001"
                placeholder="0.00"
                value={formData.taxa_mensal_percentual}
                onChange={e => setFormData({ ...formData, taxa_mensal_percentual: e.target.value })}
              />
              <span className="text-muted font-bold ms-2 text-sm">%</span>
            </div>
          </div>

          <div className="col-span-1">
            <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider mb-1 block ml-1 whitespace-nowrap">
              Total Parcelas
            </label>
            <input
              required
              className="w-full bg-muted/20 border border-border/50 rounded-xl px-3.5 h-[44px] focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all font-bold text-foreground text-sm"
              type="number"
              min="1"
              max="420"
              value={formData.total_parcelas}
              onChange={e => setFormData({ ...formData, total_parcelas: e.target.value })}
            />
          </div>

          {/* Linha 4: Data 1º Vencimento e Competência */}
          <div className="col-span-1">
            <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider mb-1 block ml-1 whitespace-nowrap">
              Data 1º Vencimento
            </label>
            <StyledDatePicker
              value={formData.data_primeiro_vencimento}
              onChange={val => setFormData({ ...formData, data_primeiro_vencimento: val })}
              className="w-100"
            />
          </div>

          <div className="col-span-1">
            <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider mb-1 block ml-1 whitespace-nowrap">
              Competência Início
            </label>
            <select
              className="w-full bg-muted/20 border border-border/50 rounded-xl px-3.5 h-[44px] focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all font-body text-sm appearance-none text-foreground cursor-pointer"
              value={formData.competencia_inicial}
              onChange={e => setFormData({ ...formData, competencia_inicial: e.target.value })}
            >
              {(() => {
                try {
                  const date = parseISO(formData.data_primeiro_vencimento);
                  if (isNaN(date.getTime())) return <option value={formData.competencia_inicial} className="bg-card text-foreground">{formData.competencia_inicial}</option>;

                  const c1 = format(date, 'MM/yyyy');
                  const c2 = format(addMonths(date, 1), 'MM/yyyy');

                  return (
                    <>
                      <option value={c1} className="bg-card text-foreground">{c1}</option>
                      <option value={c2} className="bg-card text-foreground">{c2}</option>
                    </>
                  );
                } catch {
                  return <option value={formData.competencia_inicial} className="bg-card text-foreground">{formData.competencia_inicial}</option>;
                }
              })()}
            </select>
          </div>
        </div>

        <div className="pt-3 grid grid-cols-2 gap-x-6 items-center">
          <button type="button" className="text-sm font-semibold text-muted hover:text-foreground transition-colors text-left" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            style={{ borderRadius: '9999px', backgroundColor: themeColor }}
            className="text-white h-[46px] font-bold text-sm shadow-md transition-all w-full hover:shadow-lg hover:scale-[1.01] active:scale-95 opacity-95 hover:opacity-100"
          >
            {editingItem ? 'Salvar Alterações' : 'Cadastrar Empréstimo'}
          </button>
        </div>
      </form>
    </>
  );
}

export function PayoffModal({
  loan,
  item,
  installments,
  onClose,
  onConfirmPayoff
}: {
  loan?: Emprestimo,
  item?: Despesa,
  installments: Despesa[],
  onClose: () => void,
  onConfirmPayoff: (parcelas: Despesa[]) => Promise<void>
}) {
  const [refDate, setRefDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [simulationMode, setSimulationMode] = useState<'budget' | 'manual'>('budget');
  const [budgetAmount, setBudgetAmount] = useState<string>('1000');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Projeção das parcelas futuras para a simulação de quitação
  const futureInstallments = useMemo(() => {
    const projected: Despesa[] = [];
    const isLoan = !!loan;
    const config = (loan || item) as any;
    if (!config) return [];

    const dataInicialStr = loan?.data_primeiro_vencimento || item?.vencimento;
    if (!dataInicialStr) return [];

    const dataInicial = parseISO(dataInicialStr);
    const diaOriginal = getDate(dataInicial);
    const isUltimoDia = isLastDayOfMonth(dataInicial);
    const totalParcelas = loan?.total_parcelas || item?.parcela_total || 1;
    const valorBase = loan?.valor_parcela || item?.valor || 0;
    const competenciaInicial = (loan as any)?.competencia_inicial || (item as any)?.competencia;

    for (let i = 1; i <= totalParcelas; i++) {
      const dataVenc = projetarProximoVencimento(dataInicial, i - 1, isUltimoDia, diaOriginal);
      const vencStr = format(dataVenc, 'yyyy-MM-dd');

      // Inclui se não estiver paga no banco
      const jaPaga = installments.find(inst =>
        Number(inst.parcela_atual) === Number(i) &&
        (inst.status === 'Pago' || inst.status === 'Recebido') &&
        (isLoan ? Number(inst.emprestimo_id) === Number(loan.id) : Number(inst.conta_fixa_id) === Number((item as any)?.conta_fixa_id))
      );

      if (!jaPaga) {
        let comp = '';
        if (competenciaInicial && i > 1) {
          const [m, y] = competenciaInicial.split('/').map(Number);
          const baseDate = new Date(y, m - 1, 1);
          comp = format(addMonths(baseDate, i - 1), 'MM/yyyy');
        } else {
          comp = calcularCompetencia(dataVenc);
        }

        projected.push({
          id: isLoan ? (-i - (loan.id * 2000)) : (-i - ((item as any)?.conta_fixa_id * 3000)),
          descricao: config.descricao,
          valor: valorBase,
          status: 'Em aberto',
          vencimento: vencStr,
          competencia: comp,
          parcela_atual: i,
          parcela_total: totalParcelas,
          emprestimo_id: isLoan ? loan.id : undefined,
          conta_fixa_id: !isLoan ? (item as any)?.conta_fixa_id : undefined,
          titular_id: config.titular_id
        } as Despesa);
      }
    }
    return projected;
  }, [loan, item, installments]);

  const simulation = useMemo(() => {
    const taxa = loan?.taxa_mensal_percentual || 1.15;
    return futureInstallments.map(i => {
      const { vp, discount } = (taxa > 0 && i.vencimento && i.vencimento !== '-')
        ? calculatePresentValue(i.valor, taxa, i.vencimento, parseISO(refDate))
        : { vp: i.valor, discount: 0 };

      return { ...i, vp, discount };
    });
  }, [futureInstallments, loan, refDate]);

  // Simulação automática de trás pra frente no modo "budget"
  useEffect(() => {
    if (simulationMode === 'budget') {
      const budgetNum = parseFloat(budgetAmount) || 0;
      if (budgetNum <= 0 || simulation.length === 0) {
        setSelectedIds([]);
        return;
      }

      // Ordena de trás para frente (maior parcela_atual primeiro)
      const reversed = [...simulation].sort((a, b) => b.parcela_atual - a.parcela_atual);
      let runningBudget = budgetNum;
      const matchedIds: number[] = [];

      for (const p of reversed) {
        if (runningBudget >= p.vp) {
          matchedIds.push(p.id);
          runningBudget -= p.vp;
        } else {
          break; // Sequencial de trás pra frente
        }
      }
      setSelectedIds(matchedIds);
    }
  }, [simulationMode, budgetAmount, simulation]);

  // Inicialização padrão para modo manual se vazio
  useEffect(() => {
    if (simulationMode === 'manual' && simulation.length > 0 && selectedIds.length === 0) {
      setSelectedIds(simulation.map(i => i.id));
    }
  }, [simulationMode, simulation]);

  const selectedParcelas = simulation.filter(i => selectedIds.includes(i.id));
  const sortedSelectedParcelas = useMemo(() => {
    return [...selectedParcelas].sort((a, b) => a.parcela_atual - b.parcela_atual);
  }, [selectedParcelas]);

  const totalNominal = selectedParcelas.reduce((acc, i) => acc + i.valor, 0);
  const totalVP = selectedParcelas.reduce((acc, i) => acc + i.vp, 0);
  const totalDiscount = Math.max(0, totalNominal - totalVP);
  const discountPercent = totalNominal > 0 ? (totalDiscount / totalNominal) * 100 : 0;
  const totalNominalAll = simulation.reduce((acc, i) => acc + i.valor, 0);
  const cheapestVP = simulation.length > 0 ? Math.min(...simulation.map(i => i.vp)) : 0;
  const budgetNum = parseFloat(budgetAmount) || 0;
  const leftoverBudget = Math.max(0, budgetNum - totalVP);

  const selectLastN = (n: number) => {
    const reversed = [...simulation].sort((a, b) => b.parcela_atual - a.parcela_atual);
    setSelectedIds(reversed.slice(0, n).map(i => i.id));
  };

  const handleConfirm = async () => {
    if (selectedParcelas.length === 0) return;
    setIsSubmitting(true);
    try {
      await onConfirmPayoff(selectedParcelas.map(p => ({ ...p, valor: p.vp } as any)));
      onClose();
    } catch (error) {
      alert('Erro ao confirmar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerTitle = loan?.descricao || item?.descricao || 'Contrato de Dívida';
  const taxaMensal = loan?.taxa_mensal_percentual || 1.15;

  return (
    <div className="space-y-3">
      {/* Header (Título + Taxa + Data de Referência) */}
      <div className="d-flex align-items-center justify-content-between gap-2 border-b border-border pb-2.5 pe-7">
        <div className="d-flex align-items-center gap-2.5 min-w-0">
          <div 
            className="d-flex align-items-center justify-content-center rounded-xl flex-shrink-0"
            style={{ 
              width: '36px', 
              height: '36px', 
              background: 'rgba(0, 174, 154, 0.15)', 
              color: 'var(--primary, #00AE9A)',
              border: '1px solid rgba(0, 174, 154, 0.25)' 
            }}
          >
            <i className="fa-solid fa-calculator text-sm"></i>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base md:text-lg font-black text-foreground m-0 leading-tight truncate">{headerTitle}</h2>
            <div className="text-[11px] text-muted font-medium">
              Taxa de Juros: <span className="font-bold text-foreground">{taxaMensal}% a.m.</span>
            </div>
          </div>
        </div>

        {/* Data de Referência no Header (Abre para baixo à esquerda) */}
        <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] font-bold text-muted d-none sm:inline">Data Ref:</span>
          <StyledDatePicker
            value={refDate}
            onChange={setRefDate}
            placement="bottom"
            align="right"
          />
        </div>
      </div>

      {/* Abas Estilo Pasta / Catálogo com canto superior direito bem arredondado */}
      <div className="d-flex align-items-end gap-2 px-1 border-b border-border pt-1.5">
        <button
          type="button"
          className={cn(
            "px-4 py-2 text-xs md:text-sm font-black transition-all border-t-2 border-x d-flex align-items-center gap-2 position-relative cursor-pointer select-none",
            simulationMode === 'budget'
              ? "bg-card border-t-primary border-x-border text-primary -mb-[1px] pb-2.5 z-10 shadow-sm"
              : "bg-surface-container-low/80 border-t-transparent border-x-transparent text-muted hover:text-foreground hover:bg-surface-container-high"
          )}
          style={{
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '18px',
            borderBottomLeftRadius: '0px',
            borderBottomRightRadius: '0px'
          }}
          onClick={() => setSimulationMode('budget')}
        >
          <i className={cn("fa-solid text-xs", simulationMode === 'budget' ? "fa-folder-open text-primary" : "fa-folder text-muted")}></i>
          <span>Valor</span>
        </button>

        <button
          type="button"
          className={cn(
            "px-4 py-2 text-xs md:text-sm font-black transition-all border-t-2 border-x d-flex align-items-center gap-2 position-relative cursor-pointer select-none",
            simulationMode === 'manual'
              ? "bg-card border-t-primary border-x-border text-primary -mb-[1px] pb-2.5 z-10 shadow-sm"
              : "bg-surface-container-low/80 border-t-transparent border-x-transparent text-muted hover:text-foreground hover:bg-surface-container-high"
          )}
          style={{
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '18px',
            borderBottomLeftRadius: '0px',
            borderBottomRightRadius: '0px'
          }}
          onClick={() => setSimulationMode('manual')}
        >
          <i className={cn("fa-solid text-xs", simulationMode === 'manual' ? "fa-book-open text-primary" : "fa-book text-muted")}></i>
          <span>Parcelas</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: SIMULAR POR VALOR DISPONÍVEL (Traz apenas as parcelas que abate)    */}
      {/* ========================================================================= */}
      {simulationMode === 'budget' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          {/* Caixa Integrada Padronizada */}
          <div className="bg-card border border-border rounded-2xl p-3 md:p-3.5 space-y-2.5">
            {/* Linha 1: Input com padding fixo + Atalhos */}
            <div className="d-flex align-items-center gap-2 min-h-[38px]">
              <div className="position-relative flex-grow-1">
                <span className="position-absolute start-3 top-1/2 -translate-y-1/2 font-black text-xs sm:text-sm text-primary pointer-events-none select-none">
                  R$
                </span>
                <input
                  type="number"
                  step="50"
                  min="0"
                  placeholder="Digite o valor disponível"
                  className="form-control rounded-xl py-2 pe-2 font-black text-sm md:text-base bg-surface-container-lowest border-border text-foreground"
                  style={{ paddingLeft: '40px' }}
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                />
              </div>
              <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                {[500, 1000, 2000].map(val => (
                  <button
                    key={`chip-${val}`}
                    type="button"
                    className={cn(
                      "badge-tag cursor-pointer border transition-all",
                      Number(budgetAmount) === val ? "badge-paid border-primary" : "badge-neutral border-border hover:border-primary/50"
                    )}
                    style={{ padding: '5px 8px', fontSize: '10px', fontWeight: 700 }}
                    onClick={() => setBudgetAmount(String(val))}
                  >
                    {val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-lg py-1 px-2.5 text-[10px] md:text-xs font-bold"
                  onClick={() => setBudgetAmount(String(Math.ceil(totalNominalAll)))}
                  title="Preencher com o total da dívida"
                >
                  Tudo
                </button>
              </div>
            </div>

            {/* Linha 2: 2 Mini Cards de Resumo */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <div className="bg-card border border-border rounded-xl p-2.5 md:p-3 text-center shadow-sm d-flex flex-column justify-content-between min-h-[75px] md:min-h-[85px]">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Parcelas Abatidas</div>
                <div className="text-sm md:text-lg font-black text-foreground my-0.5 truncate" title={formatCurrency(totalNominal)}>
                  {formatCurrency(totalNominal)}
                </div>
                <div className="text-[10px] md:text-xs font-bold text-muted truncate">
                  {selectedParcelas.length} de {simulation.length} itens
                </div>
              </div>

              <div 
                className="rounded-xl p-2.5 md:p-3 text-center shadow-sm d-flex flex-column justify-content-between min-h-[75px] md:min-h-[85px]"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(0, 174, 154, 0.15), rgba(0, 53, 62, 0.3))',
                  border: '1px solid rgba(0, 174, 154, 0.3)'
                }}
              >
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Valor a Pagar (VP)</div>
                <div className="text-sm md:text-lg font-black text-foreground my-0.5 truncate">
                  {formatCurrency(totalVP)}
                </div>
                <div className="text-[10px] md:text-xs font-bold text-success truncate">
                  {totalDiscount > 0 ? `Economia: - ${formatCurrency(totalDiscount)}` : 'Sem juros'}
                </div>
              </div>
            </div>
          </div>

          {/* Header Padronizado */}
          <div className="d-flex align-items-center justify-content-between px-1 h-[24px]">
            <span className="text-xs font-bold text-foreground d-flex align-items-center gap-1.5">
              <i className="fa-solid fa-layer-group text-primary"></i>
              <span>Parcelas que você abate:</span>
            </span>
          </div>

          {/* Mobile View: Altura Fixa Padronizada */}
          <div className="d-md-none space-y-1.5 h-[180px] overflow-y-auto custom-scrollbar p-0.5">
            {selectedParcelas.length === 0 ? (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-3 text-muted italic text-xs bg-card border border-border rounded-xl">
                <i className="fa-solid fa-coins fs-4 text-muted opacity-40 mb-1.5 d-block"></i>
                {budgetNum > 0 
                  ? `O valor de ${formatCurrency(budgetNum)} não é suficiente para abater a última parcela (${formatCurrency(cheapestVP)}).` 
                  : "Digite um valor acima para simular as parcelas abatidas de trás pra frente."
                }
              </div>
            ) : (
              sortedSelectedParcelas.map(i => (
                <div
                  key={`mob-budget-${i.id}`}
                  className="bg-card border border-primary/40 rounded-xl p-2 d-flex align-items-center justify-content-between gap-2 shadow-sm bg-primary/5"
                >
                  <div className="d-flex align-items-center gap-2 min-w-0">
                    <div className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle flex-shrink-0" style={{ width: '20px', height: '20px' }}>
                      <i className="fa-solid fa-check text-[9px]"></i>
                    </div>
                    <div className="min-w-0">
                      <div className="d-flex align-items-center gap-1.5">
                        <span className="badge-tag badge-paid text-[9px] py-0.5 px-1.5 font-bold">
                          {String(i.parcela_atual).padStart(2, '0')}/{String(i.parcela_total).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] font-semibold text-muted">
                          {i.vencimento && i.vencimento !== '-' ? formatDate(i.vencimento) : '-'}
                        </span>
                      </div>
                      <div className="text-[9px] text-muted">
                        Nominal: <span className="font-semibold text-foreground">{formatCurrency(i.valor)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-end flex-shrink-0">
                    <div className="font-black text-xs text-foreground">
                      {formatCurrency(i.vp)}
                    </div>
                    {i.discount > 0 ? (
                      <div className="text-[9px] font-bold text-success">
                        - {formatCurrency(i.discount)}
                      </div>
                    ) : (
                      <div className="text-[9px] text-muted">sem desc.</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View: Altura Fixa Padronizada */}
          <div className="border border-border rounded-xl overflow-hidden shadow-sm d-none d-md-block h-[280px]">
            <div className="custom-scrollbar h-100 overflow-y-auto">
              <table className="styled-table mb-0 w-100">
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card, #0f1016)' }}>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Parcela</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor Nominal</th>
                    <th style={{ textAlign: 'right' }}>Valor Presente (VP)</th>
                    <th style={{ textAlign: 'right' }}>Economia</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedParcelas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-muted italic text-xs">
                        Nenhuma parcela selecionada com o saldo atual.
                      </td>
                    </tr>
                  ) : (
                    sortedSelectedParcelas.map(i => (
                      <tr key={`desk-budget-${i.id}`}>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-tag badge-paid font-mono font-bold text-xs px-2.5 py-1 dark:text-emerald-300 dark:bg-emerald-500/20 shadow-sm" style={{ letterSpacing: '0.02em' }}>
                            {String(i.parcela_atual).padStart(2, '0')}/{String(i.parcela_total).padStart(2, '0')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }} className="text-xs text-muted whitespace-nowrap">
                          {i.vencimento && i.vencimento !== '-' ? formatDate(i.vencimento) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {formatCurrency(i.valor)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text)' }}>
                          {formatCurrency(i.vp)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                          {i.discount > 0 ? `- ${formatCurrency(i.discount)}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: SELEÇÃO MANUAL / CATÁLOGO (Permite escolher todas/quaisquer)        */}
      {/* ========================================================================= */}
      {simulationMode === 'manual' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          {/* Caixa Integrada Padronizada */}
          <div className="bg-card border border-border rounded-2xl p-3 md:p-3.5 space-y-2.5">
            {/* Linha 1: Atalhos de seleção com mesma altura */}
            <div className="d-flex align-items-center justify-content-between min-h-[38px] flex-wrap gap-1">
              <span className="text-[11px] font-bold text-muted ps-1">Atalhos de trás pra frente:</span>
              <div className="d-flex align-items-center gap-1.5 ms-auto">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 text-[10px] font-bold"
                  onClick={() => selectLastN(3)}
                >
                  Últimas 3
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 text-[10px] font-bold"
                  onClick={() => selectLastN(6)}
                >
                  Últimas 6
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 text-[10px] font-bold"
                  onClick={() => selectLastN(12)}
                >
                  Últimas 12
                </button>
              </div>
            </div>

            {/* Linha 2: Resumo Financeiro da Seleção */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-top border-border/40">
              <div className="bg-card border border-border rounded-xl p-2.5 md:p-3 text-center shadow-sm d-flex flex-column justify-content-between min-h-[75px] md:min-h-[85px]">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Selecionado</div>
                <div className="text-sm md:text-lg font-black text-foreground my-0.5 truncate" title={formatCurrency(totalNominal)}>
                  {formatCurrency(totalNominal)}
                </div>
                <div className="text-[10px] md:text-xs font-bold text-muted">{selectedParcelas.length} de {simulation.length} itens</div>
              </div>

              <div 
                className="rounded-xl p-2.5 md:p-3 text-center shadow-sm d-flex flex-column justify-content-between min-h-[75px] md:min-h-[85px]"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(0, 174, 154, 0.15), rgba(0, 53, 62, 0.3))',
                  border: '1px solid rgba(0, 174, 154, 0.3)'
                }}
              >
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Valor a Pagar (VP)</div>
                <div className="text-sm md:text-lg font-black text-foreground my-0.5 truncate" title={formatCurrency(totalVP)}>
                  {formatCurrency(totalVP)}
                </div>
                <div className="text-[10px] md:text-xs font-bold text-success truncate">
                  {totalDiscount > 0 ? `Economia: - ${formatCurrency(totalDiscount)}` : 'Sem desconto'}
                </div>
              </div>
            </div>
          </div>

          {/* Header Padronizado */}
          <div className="d-flex align-items-center justify-content-between px-1 h-[24px]">
            <span className="text-xs font-bold text-muted">Parcelas Futuras:</span>
            <button
              type="button"
              className="btn btn-sm btn-link p-0 text-xs font-bold text-primary text-decoration-none"
              onClick={() => {
                if (selectedIds.length === simulation.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(simulation.map(i => i.id));
                }
              }}
            >
              {selectedIds.length === simulation.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
            </button>
          </div>

          {/* Mobile View: Altura Fixa Padronizada */}
          <div className="d-md-none space-y-1.5 h-[180px] overflow-y-auto custom-scrollbar p-0.5">
            {simulation.length === 0 ? (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-3 text-muted italic text-xs">
                Nenhuma parcela futura encontrada.
              </div>
            ) : (
              simulation.map(i => {
                const isSelected = selectedIds.includes(i.id);
                return (
                  <div
                    key={`mob-manual-${i.id}`}
                    className={cn(
                      "bg-card border rounded-xl p-2 d-flex align-items-center justify-content-between gap-2 transition-all cursor-pointer shadow-sm",
                      isSelected ? "border-primary bg-primary/5" : "border-border opacity-70"
                    )}
                    onClick={() => {
                      setSelectedIds(prev => prev.includes(i.id) ? prev.filter(id => id !== i.id) : [...prev, i.id]);
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        className="form-check-input cursor-pointer flex-shrink-0 m-0"
                        checked={isSelected}
                        onChange={() => {}}
                      />
                      <div className="min-w-0">
                        <div className="d-flex align-items-center gap-1.5">
                          <span className="badge-tag badge-pending text-[9px] py-0.5 px-1.5 font-bold">
                            {String(i.parcela_atual).padStart(2, '0')}/{String(i.parcela_total).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] font-semibold text-muted">
                            {i.vencimento && i.vencimento !== '-' ? formatDate(i.vencimento) : '-'}
                          </span>
                        </div>
                        <div className="text-[9px] text-muted">
                          Nominal: <span className="font-semibold text-foreground">{formatCurrency(i.valor)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-end flex-shrink-0">
                      <div className="font-black text-xs text-foreground">
                        {formatCurrency(i.vp)}
                      </div>
                      {i.discount > 0 ? (
                        <div className="text-[9px] font-bold text-success">
                          - {formatCurrency(i.discount)}
                        </div>
                      ) : (
                        <div className="text-[9px] text-muted">sem desc.</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View: Altura Fixa Padronizada */}
          <div className="border border-border rounded-xl overflow-hidden shadow-sm d-none d-md-block h-[280px]">
            <div className="custom-scrollbar h-100 overflow-y-auto">
              <table className="styled-table mb-0 w-100">
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card, #0f1016)' }}>
                  <tr>
                    <th style={{ textAlign: 'center', width: '40px' }}></th>
                    <th style={{ textAlign: 'center' }}>Parcela</th>
                    <th style={{ textAlign: 'center' }}>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor Presente (VP)</th>
                    <th style={{ textAlign: 'right' }}>Economia</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-muted italic text-xs">
                        Nenhuma parcela futura encontrada.
                      </td>
                    </tr>
                  ) : (
                    simulation.map(i => {
                      const isSelected = selectedIds.includes(i.id);
                      return (
                        <tr
                          key={`desk-manual-${i.id}`}
                          className={cn("cursor-pointer transition-colors", isSelected && "bg-primary/5")}
                          onClick={() => {
                            setSelectedIds(prev => prev.includes(i.id) ? prev.filter(id => id !== i.id) : [...prev, i.id]);
                          }}
                        >
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="form-check-input cursor-pointer"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedIds(prev => prev.includes(i.id) ? prev.filter(id => id !== i.id) : [...prev, i.id]);
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge-tag badge-pending font-mono font-bold text-xs px-2.5 py-1 dark:text-amber-300 dark:bg-amber-500/20 shadow-sm" style={{ letterSpacing: '0.02em' }}>
                              {String(i.parcela_atual).padStart(2, '0')}/{String(i.parcela_total).padStart(2, '0')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }} className="text-xs text-muted whitespace-nowrap">
                            {i.vencimento && i.vencimento !== '-' ? formatDate(i.vencimento) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-foreground, #fff)' }}>
                            {formatCurrency(i.vp)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                            {i.discount > 0 ? `- ${formatCurrency(i.discount)}` : '-'}
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
      )}

      {/* Action Footer Buttons */}
      <div className="d-flex align-items-center justify-content-end gap-2 pt-2 border-t border-border mt-2">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-outline-secondary rounded-pill px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedIds.length === 0 || isSubmitting}
          className={cn(
            "btn rounded-pill px-5 py-2 text-xs font-black uppercase tracking-wider d-flex align-items-center gap-2 shadow-md transition-all",
            selectedIds.length === 0
              ? "btn-secondary opacity-50 cursor-not-allowed"
              : "btn-primary shadow-primary/20"
          )}
        >
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status"></span>
              <span>Processando...</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-check"></i>
              <span>Confirmar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
export function ExpenseSettingsModal({
  isOpen,
  onClose,
  emprestimos = [],
  contasFixas = [],
  despesas = [],
  onEditEmprestimo,
  onEditContaFixa,
  onSaveEmprestimo,
  onSaveContaFixa,
  onRenameCategory,
  onUpdateCategoryByDescription,
  onUpdateDespesa,
  onDeleteEmprestimo,
  onDeleteContaFixa,
  themeColor,
  themeMode,
  isDarkMode,
  initialTab = 'emprestimos'
}: {
  isOpen: boolean;
  onClose: () => void;
  emprestimos: Emprestimo[];
  contasFixas: ContaFixaConfig[];
  despesas?: Despesa[];
  onEditEmprestimo?: (loan: Emprestimo) => void;
  onEditContaFixa?: (config: ContaFixaConfig) => void;
  onSaveEmprestimo?: (loan: Partial<Emprestimo>) => Promise<any> | void;
  onSaveContaFixa?: (id: number, config: Partial<ContaFixaConfig>) => Promise<any> | void;
  onRenameCategory?: (oldCat: string, newCat: string) => Promise<any> | void;
  onUpdateCategoryByDescription?: (descricao: string, newCat: string) => Promise<any> | void;
  onUpdateDespesa?: (id: number, updates: Partial<Despesa>) => Promise<any> | void;
  onDeleteEmprestimo: (id: number) => void;
  onDeleteContaFixa: (id: number) => void;
  themeColor: string;
  themeMode: 'light' | 'dark' | 'black';
  isDarkMode: boolean;
  initialTab?: string;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [inlineEdit, setInlineEdit] = useState<{
    type: 'emprestimo' | 'conta_fixa';
    item: any;
  } | null>(null);
  const [inlineCategoryEdit, setInlineCategoryEdit] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);
  const [selectedCategoryForDetails, setSelectedCategoryForDetails] = useState<string | null>(null);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form state for inline editing
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState<number | string>('');
  const [editData, setEditData] = useState('');
  const [editTotalParcelas, setEditTotalParcelas] = useState<number | string>('');
  const [editParcelaAtual, setEditParcelaAtual] = useState<number | string>('');
  const [editTaxa, setEditTaxa] = useState<number | string>('');
  const [editCategoria, setEditCategoria] = useState('');

  // Category stats calculation
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};

    despesas.forEach(d => {
      const c = d.categoria?.trim();
      if (c) {
        counts[c] = (counts[c] || 0) + 1;
      }
    });

    contasFixas.forEach(f => {
      if (f.categoria) {
        const c = f.categoria.trim();
        if (c) {
          counts[c] = (counts[c] || 0) + 1;
        }
      }
    });

    if (Object.keys(counts).length === 0) {
      const defaults = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Compras', 'Mercado', 'Outros'];
      defaults.forEach(d => { counts[d] = 0; });
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [despesas, contasFixas]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setInlineEdit(null);
      setInlineCategoryEdit(null);
    }
  }, [isOpen, initialTab]);

  const handleStartEdit = (type: 'emprestimo' | 'conta_fixa', item: any) => {
    setInlineEdit({ type, item });
    setInlineCategoryEdit(null);
    if (type === 'emprestimo') {
      setEditDescricao(item.descricao || '');
      setEditValor(item.valor_parcela || '');
      setEditData(item.data_primeiro_vencimento || '');
      setEditTotalParcelas(item.total_parcelas || '');
      setEditParcelaAtual(item.parcela_atual || 1);
      setEditTaxa(item.taxa_mensal_percentual !== undefined ? item.taxa_mensal_percentual : '');
    } else {
      setEditDescricao(item.descricao || '');
      setEditValor(item.valor_mensal || '');
      setEditData(item.data_inicio || '');
      setEditCategoria(item.categoria || '');
      setEditTotalParcelas(item.total_parcelas || '');
      setEditParcelaAtual(item.parcela_atual || 1);
    }
  };

  const handleSaveInline = async () => {
    if (!inlineEdit) return;
    setIsSaving(true);
    try {
      if (inlineEdit.type === 'emprestimo') {
        const payload: Partial<Emprestimo> = {
          id: inlineEdit.item.id,
          descricao: editDescricao,
          valor_parcela: Number(editValor) || 0,
          total_parcelas: Number(editTotalParcelas) || 0,
          parcela_atual: Number(editParcelaAtual) || 1,
          taxa_mensal_percentual: editTaxa !== '' ? Number(editTaxa) : 0,
          ...(editData ? { data_primeiro_vencimento: editData } : {})
        };
        if (onSaveEmprestimo) {
          await onSaveEmprestimo(payload);
        } else if (onEditEmprestimo) {
          onEditEmprestimo({ ...inlineEdit.item, ...payload });
        }
      } else {
        const payload: Partial<ContaFixaConfig> = {
          descricao: editDescricao,
          valor_mensal: Number(editValor) || 0,
          categoria: editCategoria,
          total_parcelas: Number(editTotalParcelas) > 0 ? Number(editTotalParcelas) : null,
          parcela_atual: Number(editParcelaAtual) || 1,
          ...(editData ? { data_inicio: editData } : {})
        };
        if (onSaveContaFixa) {
          await onSaveContaFixa(inlineEdit.item.id, payload);
        } else if (onEditContaFixa) {
          onEditContaFixa({ ...inlineEdit.item, ...payload });
        }
      }
      setInlineEdit(null);
    } catch (err) {
      console.error('Erro ao salvar ajuste in-place:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Contagens por aba
  const countEmprestimos = emprestimos.length;
  const countParcelados = contasFixas.filter(c => (!c.tipo || c.tipo === 'despesa') && !c.cartao_id && (c.total_parcelas || 0) > 0).length;
  const countRecorrentes = contasFixas.filter(c => (!c.tipo || c.tipo === 'despesa') && !c.cartao_id && (!c.total_parcelas || c.total_parcelas === 0)).length;
  const countCartoesRec = contasFixas.filter(c => (!c.tipo || c.tipo === 'despesa') && !!c.cartao_id && (!c.total_parcelas || c.total_parcelas === 0)).length;
  const countCartoesParc = contasFixas.filter(c => (!c.tipo || c.tipo === 'despesa') && !!c.cartao_id && (c.total_parcelas || 0) > 0).length;
  const countRecRecorrentes = contasFixas.filter(c => c.tipo === 'receita' && (!c.total_parcelas || c.total_parcelas === 0)).length;
  const countRecParceladas = contasFixas.filter(c => c.tipo === 'receita' && (c.total_parcelas || 0) > 0).length;

  const activeThemeColor = themeColor || 'var(--primary, #00AE9A)';

  const sections = [
    {
      title: 'DESPESAS',
      tabs: [
        { id: 'emprestimos', label: 'Empréstimos', icon: 'fa-solid fa-landmark', count: countEmprestimos },
        { id: 'parcelados', label: 'Gastos Parcelados', icon: 'fa-solid fa-boxes-stacked', count: countParcelados },
        { id: 'recorrentes', label: 'Despesas Fixas', icon: 'fa-solid fa-repeat', count: countRecorrentes },
      ]
    },
    {
      title: 'CARTÕES DE CRÉDITO',
      tabs: [
        { id: 'cartoes_rec', label: 'Assinaturas Recorr.', icon: 'fa-solid fa-credit-card', count: countCartoesRec },
        { id: 'cartoes_parc', label: 'Compras Parceladas', icon: 'fa-solid fa-calendar-days', count: countCartoesParc },
      ]
    },
    {
      title: 'RECEITAS',
      tabs: [
        { id: 'rec_recorrentes', label: 'Receitas Fixas', icon: 'fa-solid fa-arrow-trend-up', count: countRecRecorrentes },
        { id: 'rec_parceladas', label: 'Receitas Parceladas', icon: 'fa-solid fa-layer-group', count: countRecParceladas },
      ]
    }
  ];

  const renderContent = () => {
    // ── MODO DE EDIÇÃO IN-LINE (NO MESMO POP-UP) ──
    if (inlineEdit) {
      const isLoan = inlineEdit.type === 'emprestimo';

      return (
        <div className="d-flex flex-column h-100 animate-in fade-in duration-200">
          {/* Header do Editor */}
          <header className="flex-shrink-0 px-6 py-4 border-b border-white/[0.03] bg-white/[0.01] d-flex align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <button
                type="button"
                onClick={() => setInlineEdit(null)}
                className="btn btn-sm btn-icon rounded-full border-0 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground transition-all p-2 cursor-pointer"
                title="Voltar para a lista"
                style={{ width: '32px', height: '32px', borderRadius: '9999px' }}
              >
                <i className="fa-solid fa-arrow-left text-xs"></i>
              </button>
              <div>
                <h3 className="text-sm md:text-base font-medium text-foreground m-0 leading-tight">
                  Editar {isLoan ? 'Contrato de Empréstimo' : 'Configuração Fixa'}
                </h3>
                <span className="text-xs text-muted block mt-0.5 font-normal">
                  Ajuste os valores e prazos diretamente aqui.
                </span>
              </div>
            </div>
          </header>

          {/* Formulário de Edição */}
          <div className="flex-grow-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="max-w-lg mx-auto space-y-4">
              {/* Descrição */}
              <div>
                <label className="block text-xs font-normal text-muted mb-1.5">Descrição / Identificação</label>
                <input
                  type="text"
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.04] text-foreground text-sm font-normal focus:outline-none transition-all border-0"
                  style={{ borderRadius: '14px' }}
                  placeholder="Ex: Empréstimo Caixa, Aluguel, Netflix..."
                />
              </div>

              {/* Grid 2 Colunas: Valor e Data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-normal text-muted mb-1.5">Valor Mensal (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editValor}
                    onChange={(e) => setEditValor(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/[0.04] text-foreground text-sm font-normal focus:outline-none transition-all border-0"
                    style={{ borderRadius: '14px' }}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-normal text-muted mb-1.5">Data / 1º Vencimento</label>
                  <StyledDatePicker
                    value={editData}
                    onChange={(val) => setEditData(val)}
                    placement="bottom"
                    className="w-full"
                    placeholder="Selecione a data"
                  />
                </div>
              </div>

              {/* Campos de Parcelamento */}
              {isLoan ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-normal text-muted mb-1.5">Total de Parcelas</label>
                      <input
                        type="number"
                        min="1"
                        value={editTotalParcelas}
                        onChange={(e) => setEditTotalParcelas(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/[0.04] text-foreground text-sm font-normal focus:outline-none transition-all border-0"
                        style={{ borderRadius: '14px' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-normal text-muted mb-1.5">Parcela Atual</label>
                      <input
                        type="number"
                        min="1"
                        value={editParcelaAtual}
                        onChange={(e) => setEditParcelaAtual(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/[0.04] text-foreground text-sm font-normal focus:outline-none transition-all border-0"
                        style={{ borderRadius: '14px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-normal text-muted mb-1.5">Taxa de Juros Mensal (% a.m.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editTaxa}
                      onChange={(e) => setEditTaxa(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/[0.04] text-foreground text-sm font-normal focus:outline-none transition-all border-0"
                      style={{ borderRadius: '14px' }}
                      placeholder="Ex: 1.99"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-normal text-muted mb-1.5">Categoria</label>
                    <input
                      type="text"
                      value={editCategoria}
                      onChange={(e) => setEditCategoria(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/[0.04] text-foreground text-sm font-normal focus:outline-none transition-all border-0"
                      style={{ borderRadius: '14px' }}
                      placeholder="Ex: Moradia, Assinaturas, Lazer..."
                    />
                  </div>

                  {Number(editTotalParcelas) > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-normal text-muted mb-1.5">Total de Parcelas</label>
                        <input
                          type="number"
                          min="1"
                          value={editTotalParcelas}
                          onChange={(e) => setEditTotalParcelas(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white/[0.04] text-foreground text-sm font-normal focus:outline-none transition-all border-0"
                          style={{ borderRadius: '14px' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-normal text-muted mb-1.5">Parcela Atual</label>
                        <input
                          type="number"
                          min="1"
                          value={editParcelaAtual}
                          onChange={(e) => setEditParcelaAtual(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white/[0.04] text-foreground text-sm font-normal focus:outline-none transition-all border-0"
                          style={{ borderRadius: '14px' }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Botões do Rodapé de Edição */}
          <footer className="flex-shrink-0 p-4 px-6 border-t border-white/[0.03] bg-white/[0.01] d-flex align-items-center justify-content-end gap-2.5">
            <button
              type="button"
              onClick={() => setInlineEdit(null)}
              className="px-4 py-2 border-0 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground text-xs font-normal transition-all cursor-pointer"
              style={{ borderRadius: '12px' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveInline}
              disabled={isSaving || !editDescricao}
              className="px-5 py-2 border-0 text-white text-xs font-medium transition-all shadow-sm cursor-pointer d-flex align-items-center gap-2"
              style={{ backgroundColor: activeThemeColor, borderRadius: '12px' }}
            >
              {isSaving ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check text-xs"></i>
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </footer>
        </div>
      );
    }

    switch (activeTab) {
      case 'emprestimos':
        return (
          <div className="d-flex flex-column h-100 animate-in fade-in duration-200">
            {/* Header da Seção */}
            <header className="flex-shrink-0 px-6 py-4 border-b border-white/[0.03] bg-white/[0.01] d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div className="d-flex align-items-center gap-3">
                <div 
                  className="w-10 h-10 d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
                  style={{ background: `${activeThemeColor}15`, color: activeThemeColor, borderRadius: '14px' }}
                >
                  <i className="fa-solid fa-landmark text-sm"></i>
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-medium text-foreground m-0 leading-tight">
                    Contratos de Empréstimo
                  </h3>
                  <span className="text-xs text-muted block mt-0.5 font-normal opacity-75">
                    Gerencie configurações mestre, taxas e cronogramas de amortização.
                  </span>
                </div>
              </div>
              <span 
                className="badge-tag rounded-full text-xs font-normal px-3 py-1 flex-shrink-0 border-0 text-muted"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '9999px' }}
              >
                {emprestimos.length} {emprestimos.length === 1 ? 'contrato' : 'contratos'}
              </span>
            </header>

            {/* Lista de Empréstimos */}
            <div className="flex-grow-1 overflow-y-auto p-5 md:p-6 custom-scrollbar space-y-2">
              {emprestimos.length === 0 ? (
                <div className="text-center py-16 px-6 rounded-3xl bg-white/[0.01] d-flex flex-column align-items-center justify-content-center">
                  <div 
                    className="w-12 h-12 d-flex align-items-center justify-content-center mb-3"
                    style={{ background: `${activeThemeColor}15`, color: activeThemeColor, borderRadius: '16px' }}
                  >
                    <i className="fa-solid fa-landmark text-xl"></i>
                  </div>
                  <h4 className="font-medium text-sm text-foreground mb-1">Nenhum empréstimo cadastrado</h4>
                  <p className="text-xs text-muted max-w-xs m-0 font-normal opacity-75">
                    Cadastre contratos para simulação de quitação e cálculo automático de VP no Radar Financeiro.
                  </p>
                </div>
              ) : (
                emprestimos.map((loan) => (
                  <div 
                    key={loan.id} 
                    className="py-3 px-4.5 bg-white/[0.02] hover:bg-white/[0.05] border-0 d-flex align-items-center justify-content-between transition-all shadow-xs gap-3.5"
                    style={{ borderRadius: '16px' }}
                  >
                    <div className="d-flex align-items-center gap-3.5 flex-grow-1 min-w-0">
                      <div 
                        className="w-10 h-10 d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs" 
                        style={{ background: `${activeThemeColor}15`, color: activeThemeColor, borderRadius: '12px' }}
                      >
                        <i className="fa-solid fa-hand-holding-dollar text-sm"></i>
                      </div>
                      <div className="min-w-0 flex-grow-1">
                        <div className="font-medium text-sm text-foreground truncate leading-tight">{loan.descricao}</div>
                        <div className="d-flex align-items-center gap-2 mt-1 flex-wrap font-normal">
                          <span className="text-xs font-normal text-foreground">
                            {formatCurrency(loan.valor_parcela)}/mês
                          </span>
                          <span 
                            className="badge-tag text-[10px] py-0.5 px-2.5 font-normal border-0 text-muted"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '9999px' }}
                          >
                            {loan.total_parcelas} parcelas
                          </span>
                          {loan.taxa_mensal_percentual !== undefined && (
                            <span 
                              className="badge-tag text-[10px] py-0.5 px-2.5 font-normal border-0"
                              style={{ backgroundColor: `${activeThemeColor}15`, color: activeThemeColor, borderRadius: '9999px' }}
                            >
                              {loan.taxa_mensal_percentual}% a.m.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                      <button 
                        type="button"
                        onClick={() => handleStartEdit('emprestimo', loan)} 
                        className="btn btn-sm btn-icon border-0 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground transition-all p-2 shadow-xs cursor-pointer"
                        title="Editar Contrato"
                        style={{ width: '32px', height: '32px', borderRadius: '9999px' }}
                      >
                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                      </button>
                      <button 
                        type="button"
                        onClick={() => onDeleteEmprestimo(loan.id)} 
                        className="btn btn-sm btn-icon border-0 bg-white/5 hover:bg-danger/20 hover:text-danger text-muted transition-all p-2 shadow-xs cursor-pointer"
                        title="Excluir Contrato"
                        style={{ width: '32px', height: '32px', borderRadius: '9999px' }}
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'parcelados':
      case 'recorrentes':
      case 'rec_recorrentes':
      case 'rec_parceladas':
      case 'cartoes_rec':
      case 'cartoes_parc':
        const isReceitaTab = activeTab.startsWith('rec_');
        const isCartaoTab = activeTab.startsWith('cartoes_');
        const isRecorrenteTab = activeTab === 'recorrentes' || activeTab === 'rec_recorrentes' || activeTab === 'cartoes_rec';

        const filtered = contasFixas.filter(c => {
          const typeMatch = isReceitaTab ? c.tipo === 'receita' : (!c.tipo || c.tipo === 'despesa');
          const cardMatch = isCartaoTab ? !!c.cartao_id : (isReceitaTab ? true : !c.cartao_id);
          const recurrenceMatch = isRecorrenteTab ? (!c.total_parcelas || c.total_parcelas === 0) : ((c.total_parcelas || 0) > 0);
          return typeMatch && cardMatch && recurrenceMatch;
        });

        const tabTitle = isReceitaTab
          ? (isRecorrenteTab ? 'Receitas Fixas Contínuas' : 'Receitas Parceladas')
          : isCartaoTab
            ? (isRecorrenteTab ? 'Assinaturas no Cartão' : 'Compras Parceladas no Cartão')
            : (isRecorrenteTab ? 'Despesas Fixas Contínuas' : 'Gastos Parcelados');

        const tabSubtitle = isReceitaTab
          ? (isRecorrenteTab ? 'Rendas fixas recorrentes mês a mês.' : 'Rendas com número definido de parcelas.')
          : isCartaoTab
            ? (isRecorrenteTab ? 'Serviços contínuos cobrados no cartão (ex: Netflix, Spotify).' : 'Compras parceladas diretamente em fatura.')
            : (isRecorrenteTab ? 'Gastos fixos contínuos sem prazo de término (ex: Aluguel, Luz).' : 'Despesas com parcelas pré-determinadas.');

        return (
          <div className="d-flex flex-column h-100 animate-in fade-in duration-200">
            {/* Header da Seção */}
            <header className="flex-shrink-0 px-6 py-4 border-b border-white/[0.03] bg-white/[0.01] d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div className="d-flex align-items-center gap-3">
                <div 
                  className="w-10 h-10 d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
                  style={{ background: `${activeThemeColor}15`, color: activeThemeColor, borderRadius: '14px' }}
                >
                  <i className={cn(isReceitaTab ? "fa-solid fa-arrow-trend-up" : isCartaoTab ? "fa-solid fa-credit-card" : "fa-solid fa-repeat", "text-sm")}></i>
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-medium text-foreground m-0 leading-tight">
                    {tabTitle}
                  </h3>
                  <span className="text-xs text-muted block mt-0.5 font-normal opacity-75">{tabSubtitle}</span>
                </div>
              </div>
              <span 
                className="badge-tag rounded-full text-xs font-normal px-3 py-1 flex-shrink-0 border-0 text-muted"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '9999px' }}
              >
                {filtered.length} {filtered.length === 1 ? 'item ativo' : 'itens ativos'}
              </span>
            </header>

            {/* Lista de Itens */}
            <div className="flex-grow-1 overflow-y-auto p-5 md:p-6 custom-scrollbar space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-16 px-6 rounded-3xl bg-white/[0.01] d-flex flex-column align-items-center justify-content-center">
                  <div 
                    className="w-12 h-12 d-flex align-items-center justify-content-center mb-3" 
                    style={{ background: `${activeThemeColor}15`, color: activeThemeColor, borderRadius: '16px' }}
                  >
                    <i className={cn(isReceitaTab ? "fa-solid fa-arrow-trend-up text-xl" : isCartaoTab ? "fa-solid fa-credit-card text-xl" : "fa-solid fa-repeat text-xl")}></i>
                  </div>
                  <h4 className="font-medium text-sm text-foreground mb-1">Nenhum registro encontrado</h4>
                  <p className="text-xs text-muted max-w-xs m-0 font-normal opacity-75">
                    Cadastre novos lançamentos recorrentes ou fixos no botão de adicionar transação.
                  </p>
                </div>
              ) : (
                filtered.map((config) => (
                  <div 
                    key={config.id} 
                    className="py-3 px-4.5 bg-white/[0.02] hover:bg-white/[0.05] border-0 d-flex align-items-center justify-content-between transition-all shadow-xs gap-3.5"
                    style={{ borderRadius: '16px' }}
                  >
                    <div className="d-flex align-items-center gap-3.5 flex-grow-1 min-w-0">
                      <div 
                        className="w-10 h-10 d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs" 
                        style={{ background: `${activeThemeColor}15`, color: activeThemeColor, borderRadius: '12px' }}
                      >
                        <i className={cn(isReceitaTab ? "fa-solid fa-arrow-up text-sm" : isCartaoTab ? "fa-solid fa-credit-card text-sm" : "fa-solid fa-arrows-rotate text-sm")}></i>
                      </div>
                      <div className="min-w-0 flex-grow-1">
                        <div className="font-medium text-sm text-foreground truncate leading-tight">{config.descricao}</div>
                        <div className="d-flex align-items-center gap-2 mt-1 flex-wrap font-normal">
                          <span className={cn("text-xs font-normal", isReceitaTab ? "text-success" : "text-foreground")}>
                            {isReceitaTab ? '+' : ''}{formatCurrency(config.valor_mensal)}/mês
                          </span>
                          {!isRecorrenteTab && config.total_parcelas && (
                            <span 
                              className="badge-tag text-[10px] py-0.5 px-2.5 font-normal border-0 text-muted"
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '9999px' }}
                            >
                              {config.total_parcelas} parcelas
                            </span>
                          )}
                          {config.categoria && (
                            <span 
                              className="badge-tag text-[10px] py-0.5 px-2.5 font-normal border-0 text-muted"
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '9999px' }}
                            >
                              {config.categoria}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                      <button 
                        type="button"
                        onClick={() => handleStartEdit('conta_fixa', config)} 
                        className="btn btn-sm btn-icon border-0 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground transition-all p-2 shadow-xs cursor-pointer"
                        title="Editar Configuração"
                        style={{ width: '32px', height: '32px', borderRadius: '9999px' }}
                      >
                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                      </button>
                      <button 
                        type="button"
                        onClick={() => onDeleteContaFixa(config.id)} 
                        className="btn btn-sm btn-icon border-0 bg-white/5 hover:bg-danger/20 hover:text-danger text-muted transition-all p-2 shadow-xs cursor-pointer"
                        title="Excluir Configuração"
                        style={{ width: '32px', height: '32px', borderRadius: '9999px' }}
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <>
      {/* ── MOBILE: bottom-sheet / full modal ── */}
      <div
        className="d-md-none modal fade show d-flex flex-column justify-content-end"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(20px)',
          position: 'fixed',
          inset: 0,
          zIndex: 2000
        }}
        onClick={onClose}
      >
        <div
          className="w-100 h-100"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div className="modal-content border-0 shadow-2xl overflow-hidden bg-card h-full d-flex flex-column rounded-0">
            {/* Header Mobile com título e botão de fechar */}
            <div className="px-4 py-3.5 border-b border-white/[0.03] d-flex align-items-center justify-content-between bg-card-elevated/40 flex-shrink-0">
              <div className="d-flex align-items-center gap-2.5">
                <div 
                  className="w-8 h-8 d-flex align-items-center justify-content-center shadow-xs"
                  style={{ background: `${activeThemeColor}15`, color: activeThemeColor, borderRadius: '10px' }}
                >
                  <i className="fa-solid fa-sliders text-sm"></i>
                </div>
                <span className="font-medium text-sm text-foreground">Ajustes & Contas Fixas</span>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="btn btn-sm btn-icon border-0 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground p-1.5 cursor-pointer"
                style={{ width: '30px', height: '30px', borderRadius: '9999px' }}
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Horizontal Scrollable Tabs em formato Pill sem bordas nos não-selecionados */}
            <aside className="border-b border-white/[0.03] d-flex flex-row overflow-x-auto p-3 gap-2 custom-scrollbar bg-card flex-shrink-0">
              {sections.map((section) =>
                section.tabs.map((tab) => {
                  const isActive = activeTab === tab.id && !inlineEdit;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setInlineEdit(null);
                      }}
                      className={cn(
                        "px-4 py-2 transition-all d-flex align-items-center gap-2 flex-shrink-0 text-xs whitespace-nowrap cursor-pointer font-normal border-0",
                        isActive 
                          ? "text-white font-medium shadow-sm" 
                          : "bg-transparent text-muted hover:text-foreground hover:bg-white/5"
                      )}
                      style={{
                        borderRadius: '14px',
                        ...(isActive ? { 
                          backgroundColor: activeThemeColor, 
                          boxShadow: `0 4px 14px ${activeThemeColor}40` 
                        } : {})
                      }}
                    >
                      <i className={cn(tab.icon, "text-xs", isActive ? "text-white" : "opacity-75")}></i>
                      <span>{tab.label}</span>
                      <span 
                        className={cn("badge-tag px-2 py-0.5 rounded-full text-[9px] font-normal border-0", isActive ? "text-white" : "text-muted")}
                        style={isActive ? { backgroundColor: 'rgba(255, 255, 255, 0.25)', borderRadius: '9999px' } : { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '9999px' }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })
              )}
            </aside>

            {/* Content */}
            <main className="flex-fill bg-card d-flex flex-column overflow-hidden">
              <div className="flex-fill overflow-hidden position-relative">
                {renderContent()}
              </div>
              <div className="p-4 bg-card-elevated/40 border-t border-white/[0.03] flex-shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn w-100 py-3 text-white font-medium text-xs shadow-md uppercase tracking-wider border-0"
                  style={{ backgroundColor: activeThemeColor, borderRadius: '14px' }}
                >
                  Concluir Ajustes
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: centered luxury dialog (Estilo 1prototype.html) ── */}
      <div
        className="d-none d-md-block modal fade show"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.85)', 
          backdropFilter: 'blur(20px)', 
          position: 'fixed', 
          inset: 0, 
          zIndex: 2000 
        }}
        onClick={onClose}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: '1020px' }}>
          <div 
            className="modal-content overflow-hidden bg-card border border-white/[0.04]"
            style={{ 
              height: '680px',
              borderRadius: '24px',
              boxShadow: '0 30px 70px rgba(0, 0, 0, 0.9)'
            }}
          >
            <div className="d-flex h-100">
              {/* Sidebar de Categorias */}
              <aside 
                className="border-r border-white/[0.03] d-flex flex-column overflow-y-auto py-5 px-3.5 gap-2.5 custom-scrollbar flex-shrink-0"
                style={{ width: '255px', background: 'var(--card-elevated, #131620)' }}
              >
                {/* Brand / Title Header */}
                <div className="px-2 pb-4 mb-2 border-b border-white/[0.03]">
                  <div className="d-flex align-items-center gap-3">
                    <div 
                      className="w-10 h-10 d-flex align-items-center justify-content-center text-white shadow-sm flex-shrink-0 border-0"
                      style={{ background: `linear-gradient(135deg, ${activeThemeColor}, #3b82f6)`, borderRadius: '14px' }}
                    >
                      <i className="fa-solid fa-sliders text-base"></i>
                    </div>
                    <div>
                      <span className="text-sm font-medium tracking-tight text-foreground block leading-tight">Configurações</span>
                      <span className="text-[10px] text-muted font-normal block uppercase tracking-wider mt-0.5 opacity-75">Contas & Fixos</span>
                    </div>
                  </div>
                </div>

                {/* Sections List */}
                <div className="flex-grow-1 d-flex flex-column gap-3.5">
                  {sections.map((section) => (
                    <div key={section.title} className="d-flex flex-column gap-1.5">
                      <div className="px-2 mb-0.5">
                        <span className="text-[9.5px] font-medium tracking-widest uppercase text-muted opacity-50">{section.title}</span>
                      </div>
                      <div className="d-flex flex-column gap-1">
                        {section.tabs.map((tab) => {
                          const isActive = activeTab === tab.id && !inlineEdit;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(tab.id);
                                setInlineEdit(null);
                              }}
                              className={cn(
                                "px-3.5 py-2.5 transition-all d-flex align-items-center justify-content-between text-start cursor-pointer font-normal border-0",
                                isActive 
                                  ? "text-white font-medium shadow-sm" 
                                  : "bg-transparent text-muted hover:bg-white/5 hover:text-foreground"
                              )}
                              style={{ 
                                fontSize: '11.5px',
                                borderRadius: '14px',
                                ...(isActive ? { 
                                  backgroundColor: activeThemeColor,
                                  boxShadow: `0 4px 14px ${activeThemeColor}40`
                                } : {})
                              }}
                            >
                              <div className="d-flex align-items-center gap-2.5">
                                <i className={cn(tab.icon, "text-xs", isActive ? "text-white" : "opacity-75")}></i>
                                <span>{tab.label}</span>
                              </div>
                              <span 
                                className={cn("badge-tag px-2 py-0.5 text-[9.5px] font-normal border-0", isActive ? "text-white" : "text-muted")}
                                style={isActive ? { backgroundColor: 'rgba(255, 255, 255, 0.25)', borderRadius: '9999px' } : { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '9999px' }}
                              >
                                {tab.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Footer Info */}
                <div className="mt-auto pt-3 border-t border-white/[0.03] text-center">
                  <span className="text-[10px] text-muted font-normal block opacity-50">Ajustes Automáticos & Radar</span>
                </div>
              </aside>

              {/* Área Principal de Conteúdo */}
              <main className="flex-fill d-flex flex-column overflow-hidden bg-card position-relative">
                {renderContent()}

                {/* Botão de Fechar no Topo Direito */}
                <button 
                  type="button" 
                  className="position-absolute top-0 end-0 m-3.5 z-50 d-flex align-items-center justify-content-center border-0 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground transition-all shadow-xs cursor-pointer"
                  style={{ width: '34px', height: '34px', borderRadius: '9999px' }}
                  onClick={onClose}
                  title="Fechar Ajustes"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </main>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
