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
          className="fixed inset-0 z-[1060] flex items-center justify-center p-3 md:p-4 bg-black/50" 
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 5 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-[640px] bg-surface-container-lowest rounded-2xl shadow-premium p-4 sm:p-6 md:p-8 relative overflow-y-auto max-h-[92vh] md:max-h-[85vh] border border-border"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3.5 right-3.5 md:top-6 md:right-6 p-2 rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant z-10"
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
    despesa: activeType === 'despesa' ? 'var(--navy)' : '#1e293b',
    despesa_cartao: isDarkMode ? '#2ec4b6' : 'var(--sicoob-teal)',
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
            <h1 className="text-xl md:text-3xl font-headline font-black text-slate-900 tracking-tight leading-none mb-1">
              {isEditing ? 'Editar Registro' : 'Novo Registro'}
            </h1>
            <span
              className="font-headline font-bold uppercase tracking-[0.2em] text-[10px] md:text-[13px] transition-all duration-300 ml-0.5 leading-none"
              style={{ color: typeColors[activeType], opacity: 0.75 }}
            >
              {typeLabels[activeType]}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs Selector */}
      {!isEditing && (
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <div className="bg-[#F1F5F9] p-1 rounded-full flex w-full max-w-[560px] h-11 md:h-12 relative border border-slate-200/50 shadow-inner overflow-hidden">
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
                activeType === 'despesa' ? "text-white" : "text-slate-400 hover:text-navy/40"
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
                activeType === 'despesa_cartao' ? "text-white" : "text-slate-400 hover:text-navy/40"
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
                activeType === 'receita' ? "text-white" : "text-slate-400 hover:text-navy/40"
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
                activeType === 'emprestimo' ? "text-white" : "text-slate-400 hover:text-navy/40"
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
      data.parcela_total = parseInt(formData.parcela_total as any) || (isRecorrente ? 12 : 2);
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
          <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider">Valor do Lançamento</label>
          <div className="flex items-center bg-[#F8FAFC] rounded-2xl px-4 py-2 md:py-3 focus-within:ring-2 focus-within:ring-slate-200 group-focus-within:bg-white transition-all shadow-sm border border-outline-variant/30">
            <span className={cn(
              "text-lg md:text-xl font-headline font-bold transition-all mr-2 md:mr-3 mt-1",
              formData.valor ? "text-navy" : "text-navy/20"
            )}>R$</span>
            <input
              required
              className={cn(
                "bg-transparent border-none focus:outline-none rounded-lg font-headline font-extrabold w-full p-0 transition-all px-1 text-xl md:text-2xl",
                formData.valor ? "text-slate-900" : "text-slate-900/20"
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
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Descrição</label>
            <input
              required
              className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 md:py-2.5 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm text-on-surface"
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
  const [formData, setFormData] = useState({
    nome_cartao: initialData?.nome_cartao || '',
    titular_id: initialData?.titular_id || titulares[0]?.id || 0,
    dia_vencimento: initialData?.dia_vencimento || 10,
    dia_fechamento: initialData?.dia_fechamento || 10
  });

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(formData); }} className="row g-3">
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Nome do Cartão</label>
        <input
          required
          type="text"
          className="form-control rounded-3"
          value={formData.nome_cartao}
          onChange={e => setFormData({ ...formData, nome_cartao: e.target.value })}
        />
      </div>
      <div className="col-12">
        <label className="text-[10px] md:text-sm fw-bold text-muted text-uppercase mb-1 ml-1 block">Titular</label>
        <select
          className="form-select rounded-3"
          value={formData.titular_id}
          onChange={e => setFormData({ ...formData, titular_id: parseInt(e.target.value) })}
        >
          {titulares.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
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
          style={{ backgroundColor: themeColor }}
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
  placement = 'top',
  align = 'left'
}: {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  placement?: 'top' | 'bottom';
  align?: 'left' | 'right';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      {/* Trigger Button with Extra Rounded Corners */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "btn btn-sm d-flex align-items-center justify-content-between gap-2 px-3.5 py-2 border border-border bg-card transition-all shadow-sm hover:border-primary text-start",
          className || "min-w-[135px]"
        )}
        style={{ borderRadius: '18px' }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-calendar-days text-primary text-xs"></i>
          <span className="text-xs font-bold text-foreground">
            {value ? formatDate(value) : placeholder}
          </span>
        </div>
        <i className={cn("fa-solid fa-chevron-down text-[10px] text-muted transition-transform ms-auto", isOpen && "rotate-180")}></i>
      </button>

      {/* Floating Popover Calendar */}
      {isOpen && (
        <div 
          className="position-absolute bg-card border border-border rounded-3xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{
            bottom: placement === 'bottom' ? undefined : 'calc(100% + 8px)',
            top: placement === 'bottom' ? 'calc(100% + 8px)' : undefined,
            left: align === 'right' ? 'auto' : 0,
            right: align === 'right' ? 0 : 'auto',
            width: '275px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
            background: 'var(--card, #12141c)',
            zIndex: 1050
          }}
        >
          {/* Header with Month / Year Navigation */}
          <div className="d-flex align-items-center justify-content-between mb-2.5 px-1">
            <button
              type="button"
              className="btn btn-sm btn-link p-1 text-muted hover:text-primary"
              onClick={handlePrevMonth}
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <div className="text-xs font-black text-foreground">
              {monthNames[viewMonth]} <span className="text-primary">{viewYear}</span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link p-1 text-muted hover:text-primary"
              onClick={handleNextMonth}
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {daysOfWeek.map((d, i) => (
              <span key={i} className="text-[10px] font-black text-muted uppercase">
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
                    "w-8 h-8 rounded-xl d-flex align-items-center justify-content-center text-xs font-bold transition-all border-0",
                    isSelected
                      ? "bg-primary text-white shadow-sm shadow-primary/30"
                      : item.isCurrentMonth
                        ? "text-foreground hover:bg-muted"
                        : "text-muted opacity-30 hover:bg-muted/50",
                    isToday && !isSelected && "ring-1 ring-primary/40 text-primary font-black"
                  )}
                  style={{
                    backgroundColor: isSelected ? 'var(--primary)' : undefined
                  }}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Quick Footer Action */}
          <div className="d-flex align-items-center justify-content-between pt-2.5 mt-2 border-t border-border">
            <button
              type="button"
              className="btn btn-link p-0 text-[11px] font-bold text-primary hover:underline"
              onClick={handleSelectToday}
            >
              <i className="fa-solid fa-bolt me-1"></i>Hoje
            </button>
            <button
              type="button"
              className="btn btn-link p-0 text-[11px] font-bold text-muted hover:text-danger"
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
    'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
    'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'
  ];

  useEffect(() => {
    if (isOpen) {
      setViewYear(currentYear);
    }
  }, [isOpen, currentYear]);

  if (!isOpen) return null;

  return (
    <>
      {/* Transparent Click-Outside Backdrop (Sem desfoque) */}
      <div className="fixed inset-0 z-[2999]" onClick={onClose} />

      {/* Popover Limpo Abaixo do Botão (Sem sombra, sem cobrir o botão) */}
      <div 
        className="fixed z-[3000] animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: '82px',
          right: '28px',
          width: '250px'
        }}
      >
        <div
          className="bg-card border border-border rounded-3xl p-3"
          style={{
            background: 'var(--card, #12141c)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header com Ano e Setas Sem Margem / Espaçamento justo */}
          <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
            <button
              type="button"
              className="btn btn-sm btn-link p-1 text-muted hover:text-primary text-decoration-none border-0"
              onClick={() => setViewYear(prev => prev - 1)}
              title="Ano anterior"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            
            <span className="text-sm font-black text-foreground tracking-tight px-1">{viewYear}</span>
            
            <button
              type="button"
              className="btn btn-sm btn-link p-1 text-muted hover:text-primary text-decoration-none border-0"
              onClick={() => setViewYear(prev => prev + 1)}
              title="Próximo ano"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          {/* Grid Compacto de 12 Meses */}
          <div className="grid grid-cols-3 gap-1.5">
            {meses.map((mes, index) => {
              const monthNum = index + 1;
              const isSelected = monthNum === currentMonth && viewYear === currentYear;
              return (
                <button
                  key={mes}
                  type="button"
                  className={cn(
                    "py-1.5 px-1 text-center font-black text-[11px] rounded-xl transition-all border-0",
                    isSelected
                      ? "bg-primary text-white font-black"
                      : "text-foreground hover:bg-muted/70"
                  )}
                  style={{ 
                    backgroundColor: isSelected ? 'var(--primary, #00AE9A)' : undefined
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:gap-y-3">
          <div className="col-span-2">
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Descrição do Contrato</label>
            <input
              required
              className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 md:py-2.5 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm text-on-surface"
              placeholder="Ex: Financiamento Imobiliário Inter"
              type="text"
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Valor da Parcela (VF)</label>
            <div className="flex items-center bg-[#F8FAFC] rounded-lg px-4 py-2 md:py-2.5 ring-1 ring-outline-variant/30">
              <span className="text-navy/40 font-bold mr-2 text-sm md:text-base">R$</span>
              <input
                required
                className="bg-transparent border-none focus:outline-none w-full font-bold text-navy text-sm md:text-base"
                type="number" step="0.01"
                value={formData.valor_parcela}
                onChange={e => setFormData({ ...formData, valor_parcela: e.target.value })}
              />
            </div>
          </div>

          <div className="col-span-1">
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Taxa Mensal (%)</label>
            <div className="flex items-center bg-[#F8FAFC] rounded-lg px-4 py-2 md:py-2.5 ring-1 ring-outline-variant/30">
              <input
                required
                className="bg-transparent border-none focus:outline-none w-full font-bold text-navy text-sm md:text-base"
                type="number" step="0.0001"
                value={formData.taxa_mensal_percentual}
                onChange={e => setFormData({ ...formData, taxa_mensal_percentual: e.target.value })}
              />
              <span className="text-navy/40 font-bold ml-2 text-sm md:text-base">%</span>
            </div>
          </div>

          <div className="col-span-1">
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Total Parcelas</label>
            <input
              required
              className="w-full bg-[#F8FAFC] border-none ring-1 ring-outline-variant/30 rounded-lg px-4 h-[44px] md:h-[48px] focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-bold text-navy text-sm"
              type="number"
              value={formData.total_parcelas}
              onChange={e => setFormData({ ...formData, total_parcelas: e.target.value })}
            />
          </div>

          <div className="col-span-1">
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Data 1º Vencimento</label>
            <StyledDatePicker
              value={formData.data_primeiro_vencimento}
              onChange={val => setFormData({ ...formData, data_primeiro_vencimento: val })}
              className="w-100 h-[44px]"
            />
          </div>

          <div className="col-span-1">
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Competência de Início</label>
            <select
              className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 h-[44px] focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm appearance-none text-on-surface"
              value={formData.competencia_inicial}
              onChange={e => setFormData({ ...formData, competencia_inicial: e.target.value })}
            >
              {(() => {
                try {
                  const date = parseISO(formData.data_primeiro_vencimento);
                  if (isNaN(date.getTime())) return <option value={formData.competencia_inicial}>{formData.competencia_inicial}</option>;

                  const c1 = format(date, 'MM/yyyy');
                  const c2 = format(addMonths(date, 1), 'MM/yyyy');

                  return (
                    <>
                      <option value={c1}>{c1}</option>
                      <option value={c2}>{c2}</option>
                    </>
                  );
                } catch {
                  return <option value={formData.competencia_inicial}>{formData.competencia_inicial}</option>;
                }
              })()}
            </select>
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Responsável</label>
            <select
              className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm appearance-none text-on-surface"
              value={formData.titular_id}
              onChange={e => setFormData({ ...formData, titular_id: parseInt(e.target.value) })}
            >
              {titulares.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="pt-4 grid grid-cols-2 gap-x-8 items-center">
          <button type="button" className="text-sm font-label font-semibold text-slate-500 hover:text-navy transition-colors text-left" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            style={{ borderRadius: '9999px', backgroundColor: themeColor }}
            className="text-white h-[48px] font-label font-semibold text-sm shadow-md transition-all w-full hover:shadow-lg hover:scale-[1.02] active:scale-95 opacity-90 hover:opacity-100"
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
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider">Valor a Pagar (VP)</div>
                <div className="text-sm md:text-lg font-black text-primary my-0.5 truncate">
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
                    <div className="font-black text-xs text-primary">
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
                    <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Parcela</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor Nominal</th>
                    <th style={{ textAlign: 'right' }}>V. Presente (VP)</th>
                    <th style={{ textAlign: 'right' }}>Desconto</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedParcelas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted italic text-sm">
                        <i className="fa-solid fa-coins fs-3 text-muted opacity-40 mb-2 d-block"></i>
                        {budgetNum > 0 
                          ? `O valor de ${formatCurrency(budgetNum)} não é suficiente para abater a última parcela (${formatCurrency(cheapestVP)}).` 
                          : "Digite um valor acima para simular quantas parcelas serão abatidas."
                        }
                      </td>
                    </tr>
                  ) : (
                    sortedSelectedParcelas.map((i, index) => (
                      <tr key={i.id} className="bg-primary/5">
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge bg-primary text-white rounded-circle p-1" style={{ width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
                            {index + 1}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-tag badge-paid" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                            {String(i.parcela_atual).padStart(2, '0')}/{String(i.parcela_total).padStart(2, '0')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }} className="text-xs text-muted whitespace-nowrap">
                          {i.vencimento && i.vencimento !== '-' ? formatDate(i.vencimento) : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }} className="text-muted font-medium text-xs">
                          {formatCurrency(i.valor)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
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
                  3 Últimas
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 text-[10px] font-bold"
                  onClick={() => selectLastN(6)}
                >
                  6 Últimas
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 text-[10px] font-bold"
                  onClick={() => setSelectedIds(simulation.map(i => i.id))}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-muted hover:text-danger p-1 text-[10px] font-bold"
                  onClick={() => setSelectedIds([])}
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Linha 2: 2 Mini Cards de Resumo */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
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
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider">Valor a Pagar (VP)</div>
                <div className="text-sm md:text-lg font-black text-primary my-0.5 truncate" title={formatCurrency(totalVP)}>
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
                      <div className="font-black text-xs text-primary">
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
                    <th style={{ width: '38px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="form-check-input cursor-pointer"
                        checked={simulation.length > 0 && selectedIds.length === simulation.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(simulation.map(i => i.id));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Parcela</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>V. Presente</th>
                    <th style={{ textAlign: 'right' }}>Desconto</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted italic text-sm">
                        Nenhuma parcela futura encontrada para quitação.
                      </td>
                    </tr>
                  ) : (
                    simulation.map(i => {
                      const isSelected = selectedIds.includes(i.id);
                      return (
                        <tr
                          key={i.id}
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
                            <span className="badge-tag badge-pending" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                              {String(i.parcela_atual).padStart(2, '0')}/{String(i.parcela_total).padStart(2, '0')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }} className="text-xs text-muted whitespace-nowrap">
                            {i.vencimento && i.vencimento !== '-' ? formatDate(i.vencimento) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
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
// NOVO: ExpenseSettingsModal
// ---------------------------------------------------------

export function ExpenseSettingsModal({
  isOpen,
  onClose,
  emprestimos,
  contasFixas,
  onEditEmprestimo,
  onEditContaFixa,
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
  onEditEmprestimo: (loan: Emprestimo) => void;
  onEditContaFixa: (config: ContaFixaConfig) => void;
  onDeleteEmprestimo: (id: number) => void;
  onDeleteContaFixa: (id: number) => void;
  themeColor: string;
  themeMode: 'light' | 'dark' | 'black';
  isDarkMode: boolean;
  initialTab?: string;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const sections = [
    {
      title: 'DESPESAS',
      tabs: [
        { id: 'emprestimos', label: 'Empréstimos', icon: 'account_balance' },
        { id: 'parcelados', label: 'Parcelados', icon: 'inventory_2' },
        { id: 'recorrentes', label: 'Recorrentes', icon: 'event_repeat' },
      ]
    },
    {
      title: 'CARTÕES',
      tabs: [
        { id: 'cartoes_rec', label: 'Recorrentes', icon: 'credit_card' },
        { id: 'cartoes_parc', label: 'Parcelados', icon: 'calendar_month' },
      ]
    },
    {
      title: 'RECEITAS',
      tabs: [
        { id: 'rec_recorrentes', label: 'Recorrentes', icon: 'autorenew' },
        { id: 'rec_parceladas', label: 'Fixas / Parc.', icon: 'layers' },
      ]
    }
  ];

  const renderContent = () => {
    // Modo específico para as cores e fontes (Light, Dark/Azul, Black/Preto)
    const isLight = themeMode === 'light';
    const isBlack = themeMode === 'black';

    const cardBgClass = isLight 
      ? "bg-slate-50/70 border border-slate-200/60 shadow-sm" 
      : (isBlack 
          ? "bg-neutral-900/50 border border-neutral-850/80 shadow-md" 
          : "bg-slate-800/30 border border-slate-800/80 shadow-md");

    const cardHoverClass = isLight 
      ? "hover:bg-slate-100/70 hover:shadow-md" 
      : (isBlack 
          ? "hover:bg-neutral-900/80 hover:shadow-md" 
          : "hover:bg-slate-800/60 hover:shadow-md");
          
    const cardTitleClass = isLight 
      ? "text-slate-800 font-bold text-sm tracking-tight leading-tight" 
      : "text-slate-100 font-bold text-sm tracking-tight leading-tight";

    const cardMetaClass = isLight 
      ? "text-[11px] text-slate-600 font-bold uppercase tracking-tighter opacity-90" 
      : "text-[11px] text-slate-400 font-bold uppercase tracking-tighter opacity-80";

    const headerTitleClass = isLight 
      ? "text-xl font-headline font-black text-slate-800 m-0" 
      : "text-xl font-headline font-black text-slate-100 m-0";

    const headerSubtitleClass = isLight 
      ? "hidden md:block text-slate-500 text-xs m-0 mt-1" 
      : "hidden md:block text-muted-foreground text-xs m-0 mt-1";

    const emptyStateClass = isLight 
      ? "py-24 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 d-flex flex-column align-items-center justify-content-center" 
      : (isBlack 
          ? "py-24 text-center border-2 border-dashed border-neutral-800 rounded-[2rem] bg-neutral-950/20 d-flex flex-column align-items-center justify-content-center" 
          : "py-24 text-center border-2 border-dashed border-slate-800/60 rounded-[2rem] bg-slate-900/10 d-flex flex-column align-items-center justify-content-center");

    const emptyTextClass = isLight 
      ? "font-headline font-bold text-slate-400 text-uppercase tracking-widest text-[10px] mt-2" 
      : "font-headline font-bold text-muted-foreground text-uppercase tracking-widest text-[10px] mt-2";

    const categoryBadgeClass = isLight
      ? "text-slate-700 bg-slate-200/70 border border-slate-300/30"
      : "text-slate-400 bg-slate-800/40 border border-slate-700/20";

    switch (activeTab) {
      case 'emprestimos':
        return (
          <div className="d-flex flex-column h-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <header className="flex-shrink-0 px-6 md:px-10 pt-6 md:pt-10 pb-5 bg-card border-bottom border-border/30">
              <h3 className={headerTitleClass}>Contratos de Empréstimo</h3>
              <p className={headerSubtitleClass}>Gerencie as configurações mestre e taxas de juros de seus empréstimos ativos.</p>
            </header>

            <div className="flex-grow-1 overflow-y-auto p-6 md:p-10 pt-6 custom-scrollbar">
              <div className="grid gap-4">
                {emprestimos.length === 0 ? (
                  <div className={emptyStateClass}>
                    <span className="material-symbols-outlined text-[54px] text-slate-400/60 dark:text-muted-foreground/40" style={{ fontVariationSettings: "'wght' 300" }}>account_balance</span>
                    <p className={emptyTextClass}>Nenhum empréstimo cadastrado</p>
                  </div>
                ) : (
                  emprestimos.map((loan) => (
                    <div 
                      key={loan.id} 
                      className={cn("p-4 rounded-2xl d-flex align-items-center justify-content-between hover:-translate-y-0.5 transition-all duration-300", cardBgClass, cardHoverClass)}
                      style={{ borderLeft: '4px solid #D97706' }}
                    >
                      <div className="d-flex align-items-center gap-4 flex-grow-1">
                        <div className="w-12 h-12 rounded-2xl d-flex align-items-center justify-content-center shadow-sm" style={{ background: isDarkMode ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.08)', color: '#D97706' }}>
                          <span className="material-symbols-outlined font-semibold text-lg">payments</span>
                        </div>
                        <div>
                          <div className={cardTitleClass}>{loan.descricao}</div>
                          <div className="d-flex align-items-center gap-2.5 mt-1.5 flex-wrap">
                            <span className={cardMetaClass}>
                              Parcela: {formatCurrency(loan.valor_parcela)}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20">
                              {loan.taxa_mensal_percentual}% juros
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <button 
                          onClick={() => onEditEmprestimo(loan)} 
                          className="bg-transparent border-0 p-1.5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 active:scale-95 transition-all d-flex align-items-center justify-content-center"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button 
                          onClick={() => onDeleteEmprestimo(loan.id)} 
                          className="bg-transparent border-0 p-1.5 text-rose-500 hover:text-rose-600 dark:hover:text-rose-450 hover:scale-110 active:scale-95 transition-all d-flex align-items-center justify-content-center"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
          const recurrenceMatch = isRecorrenteTab ? (!c.total_parcelas || c.total_parcelas === 0) : (c.total_parcelas && c.total_parcelas > 0);
          return typeMatch && cardMatch && recurrenceMatch;
        });

        const activeThemeColor = themeColor;

        return (
          <div className="d-flex flex-column h-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <header className="flex-shrink-0 px-6 md:px-10 pt-6 md:pt-10 pb-5 bg-card border-bottom border-border/30">
              <h3 className={headerTitleClass}>
                {isReceitaTab
                  ? (isRecorrenteTab ? 'Receitas Recorrentes' : 'Receitas Fixas / Parceladas')
                  : (isRecorrenteTab ? 'Despesas Recorrentes' : <>Gastos <span className="md:hidden">Parc.</span><span className="hidden md:inline">Parcelados</span></>)}
              </h3>
              <p className={headerSubtitleClass}>
                {isReceitaTab
                  ? (isRecorrenteTab ? 'Configurações de rendas fixas contínuas (ex: Salário).' : 'Configurações de rendas com prazo determinado (ex: Bônus parcelado).')
                  : (isRecorrenteTab ? 'Configurações de gastos fixos contínuos (ex: Assinaturas).' : 'Configurações de gastos fixos com prazo determinado (ex: Financiamento).')}
              </p>
            </header>

            <div className="flex-grow-1 overflow-y-auto p-6 md:p-10 pt-6 custom-scrollbar">
              <div className="grid gap-4">
                {filtered.length === 0 ? (
                  <div className={emptyStateClass}>
                    <span className="material-symbols-outlined text-[54px] text-slate-400/60 dark:text-muted-foreground/40" style={{ fontVariationSettings: "'wght' 300" }}>
                      {isRecorrenteTab ? 'event_repeat' : 'inventory_2'}
                    </span>
                    <p className={emptyTextClass}>Nenhum registro encontrado</p>
                  </div>
                ) : (
                  filtered.map((config) => {
                    const cardColor = isReceitaTab ? '#00995D' : activeThemeColor;
                    return (
                      <div 
                        key={config.id} 
                        className={cn("p-4 rounded-2xl d-flex align-items-center justify-content-between hover:-translate-y-0.5 transition-all duration-300", cardBgClass, cardHoverClass)}
                        style={{ borderLeft: `4px solid ${cardColor}` }}
                      >
                        <div className="d-flex align-items-center gap-4 flex-grow-1">
                          <div className="w-12 h-12 rounded-2xl d-flex align-items-center justify-content-center shadow-sm" style={{ background: isDarkMode ? `${cardColor}25` : `${cardColor}10`, color: cardColor }}>
                            <span className="material-symbols-outlined font-semibold text-lg">{isRecorrenteTab ? 'autorenew' : 'layers'}</span>
                          </div>
                          <div>
                            <div className={cardTitleClass}>{config.descricao}</div>
                            <div className="d-flex align-items-center gap-2.5 mt-1.5 flex-wrap">
                              <span className={cardMetaClass}>
                                {formatCurrency(config.valor_mensal)} /mês
                              </span>
                              {!isRecorrenteTab && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-bold border border-border/40">
                                  {config.total_parcelas} parcelas
                                </span>
                              )}
                              {config.categoria && (
                                <span className={cn("text-[9px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded-md", categoryBadgeClass)}>{config.categoria}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <button 
                            onClick={() => onEditContaFixa(config)} 
                            className="bg-transparent border-0 p-1.5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 active:scale-95 transition-all d-flex align-items-center justify-content-center"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button 
                            onClick={() => onDeleteContaFixa(config.id)} 
                            className="bg-transparent border-0 p-1.5 text-rose-500 hover:text-rose-600 dark:hover:text-rose-450 hover:scale-110 active:scale-95 transition-all d-flex align-items-center justify-content-center"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <>
      {/* ── MOBILE: bottom-sheet ── */}
      <div
        className="d-md-none modal fade show d-flex flex-column justify-content-end expense-settings-modal-custom"
        style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
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

            {/* Horizontal Tab Bar */}
            <aside className={cn("border-bottom border-border d-flex flex-row overflow-auto p-2 gap-1 no-scrollbar flex-shrink-0", themeMode === 'light' ? "bg-slate-50" : (themeMode === 'dark' ? "bg-slate-900/60" : "bg-neutral-950"))}>
              <div className="d-flex flex-row gap-1 px-1 w-100">
                {sections.map((section) =>
                  section.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex-grow-1 px-1 py-2 rounded-2xl transition-all duration-300 d-flex flex-column align-items-center justify-content-center border-0",
                        activeTab === tab.id ? "text-white shadow-lg" : "text-muted-foreground"
                      )}
                      style={{
                        background: activeTab === tab.id ? themeColor : 'transparent',
                        boxShadow: activeTab === tab.id ? `0 4px 12px ${themeColor}40` : 'none',
                        borderRadius: '16px'
                      }}
                    >
                      <span
                        className={cn("material-symbols-outlined text-[20px] md:text-[18px]", activeTab === tab.id ? "text-white" : (isDarkMode ? "text-white/60" : "text-muted-foreground"))}
                        style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : "" }}
                      >
                        {tab.icon}
                      </span>
                      <span className="md:hidden text-[7px] font-black uppercase tracking-tighter whitespace-nowrap opacity-80 mt-0.5">
                        {section.title === 'DESPESAS' ? 'Despesas' : 'Receitas'}
                      </span>
                      <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest whitespace-nowrap ml-2">{tab.label}</span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            {/* Content */}
            <main className="flex-fill bg-card d-flex flex-column overflow-hidden">
              <div className="flex-fill overflow-hidden position-relative">
                {renderContent()}
              </div>
              <div className="p-4 bg-card border-top border-border/10 flex-shrink-0">
                <button
                  onClick={onClose}
                  className="btn w-100 py-3 rounded-2xl fw-black text-white text-uppercase tracking-widest transition-all active:scale-95 shadow-lg border-0"
                  style={{ backgroundColor: themeColor, fontSize: '12px' }}
                >
                  Fechar Ajustes
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: original centered modal ── */}
      <div
        className="d-none d-md-block modal fade show expense-settings-modal-custom"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
          <div className={cn("modal-content border-0 shadow-2xl overflow-hidden rounded-[2.5rem] border", themeMode === 'light' ? "bg-white border-slate-200" : (themeMode === 'black' ? "bg-[#000000] border-neutral-800" : "bg-card border-border/30"))} style={{ height: '700px' }}>
            <div className="d-flex h-100">
              {/* Sidebar */}
              <aside className={cn("border-end d-flex flex-column overflow-auto py-6 px-3 gap-2 no-scrollbar flex-shrink-0", themeMode === 'light' ? "bg-slate-50/90 border-slate-200/80" : (themeMode === 'black' ? "bg-neutral-950 border-neutral-800/80" : "bg-slate-900/60 border-border/40"))} style={{ width: '230px' }}>
                <div className="px-3 mb-6">
                  <div className="d-flex align-items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl d-flex align-items-center justify-content-center text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}>
                      <span className="material-symbols-outlined text-lg leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                    </div>
                    <span className={cn("text-lg font-headline font-black tracking-wider uppercase", themeMode === 'light' ? "text-slate-800" : "text-slate-100")}>Ajustes</span>
                  </div>
                </div>

                <div className="flex-grow-1 d-flex flex-column gap-4">
                  {sections.map((section) => (
                    <div key={section.title} className="d-flex flex-column gap-1">
                      <div className="px-3 mb-2">
                        <span className={cn("text-[9.5px] font-black tracking-[.25em] uppercase", themeMode === 'light' ? "text-slate-500" : "text-slate-400/70")}>{section.title}</span>
                      </div>
                      <div className="d-flex flex-column gap-1">
                        {section.tabs.map((tab) => {
                          const isActive = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={cn(
                                "px-3.5 py-3 rounded-2xl transition-all duration-300 d-flex align-items-center gap-3 border-0",
                                isActive 
                                  ? "text-white shadow-md font-bold" 
                                  : (themeMode === 'light' 
                                      ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900" 
                                      : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-100")
                              )}
                              style={{
                                fontSize: '11px',
                                background: isActive 
                                  ? `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` 
                                  : 'transparent',
                                boxShadow: isActive ? `0 6px 15px ${themeColor}30` : 'none',
                                borderRadius: '14px',
                                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                              }}
                            >
                              <span
                                className={cn("material-symbols-outlined text-[18px]", isActive ? "text-white" : (isDarkMode ? "text-white/60" : "text-slate-500"))}
                                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "" }}
                              >
                                {tab.icon}
                              </span>
                              <span className="font-headline font-bold uppercase tracking-widest text-[9.5px] whitespace-nowrap">{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto"></div>
              </aside>

              {/* Content Area */}
              <main className="flex-fill d-flex flex-column overflow-hidden bg-card">
                {renderContent()}
              </main>
            </div>
            
            {/* Botão de Fechar no topo direito com micro-animação */}
            <button 
              type="button" 
              className={cn(
                "position-absolute top-0 end-0 m-6 z-50 d-flex align-items-center justify-content-center transition-all rounded-full hover:rotate-90 active:scale-90 border",
                themeMode === 'light' 
                  ? "bg-slate-100 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 border-slate-200/50" 
                  : "bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-white border-border/20 bg-card/40 backdrop-blur-sm"
              )}
              style={{ width: '42px', height: '42px' }}
              onClick={onClose}
            >
              <span className="material-symbols-outlined font-semibold text-lg">close</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
