'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Titular, Status, Despesa, Receita, CartaoConfig, Profile, Emprestimo, ContaFixaConfig } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { calcularCompetencia, calcularCompetenciaReceita, ajustarDataReceita, calcularCompetenciaCartao, calculatePresentValue, projetarProximoVencimento, getProximoFechamento } from '@/lib/finance-service';
import { parseISO, format, getDate, isLastDayOfMonth, addMonths } from 'date-fns';
import { categorizar } from '@/lib/categories-utils';
import { getCardLogo } from '@/lib/finance-service';

import { cn, formatCurrency } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1060] flex items-center justify-center p-3 md:p-4 backdrop-blur-sm bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[640px] bg-surface-container-lowest rounded-[1.5rem] md:rounded-[2.5rem] shadow-premium p-6 md:p-10 relative overflow-y-auto max-h-[95vh] md:max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-4 right-4 md:top-8 md:right-8 p-2 rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant z-10"
          onClick={onClose}
        >
          <X size={20} className="md:w-6 md:h-6" />
        </button>
        {children}
      </div>
    </div>
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
  subType: initialSubType
}: {
  initialType?: 'despesa' | 'receita' | 'emprestimo' | 'despesa_cartao',
  initialData?: any,
  titulares: Titular[],
  cartoes: CartaoConfig[],
  competencia: string,
  onClose: () => void,
  onSubmitFinance: (data: Omit<Despesa, 'id'> | Omit<Receita, 'id'>) => void,
  onSubmitContaFixa?: (data: Omit<ContaFixaConfig, 'id' | 'user_id' | 'family_id'>) => void,
  onSubmitEmprestimo: (data: Partial<Emprestimo>) => void,
  subType?: 'cartao' | 'boleto' | 'fixa'
}) {
  const [activeType, setActiveType] = useState<'despesa' | 'receita' | 'emprestimo' | 'despesa_cartao'>(initialType);
  const isEditing = !!initialData;

  // Se estiver editando, bloqueia o tipo conforme o dado inicial
  useEffect(() => {
    if (isEditing) {
      if ((initialData as any).taxa_mensal_percentual !== undefined) setActiveType('emprestimo');
      else if ((initialData as any).data_recebimento !== undefined || (initialData as any).tipo === 'receita') setActiveType('receita');
      else setActiveType('despesa');
    }
  }, [initialData, isEditing]);

  const typeColors = {
    despesa: activeType === 'despesa' ? 'var(--navy)' : '#1e293b',
    despesa_cartao: 'var(--sicoob-teal)',
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-premium border border-slate-100 z-[1100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
            {cartoes.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">Nenhum cartão configurado</div>
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
                    "w-full flex items-center justify-between p-2.5 rounded-xl transition-all hover:bg-slate-50",
                    Number(value) === c.id ? "bg-slate-50 border border-slate-200" : "border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3 text-left">
                      <div className="flex items-center gap-3">
                    <CardLogo name={c.nome_cartao} size="sm" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{c.nome_cartao}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Próximo fechamento: {getProximoFechamento(c)}</span>
                    </div>
                  </div>
 </div>
                  <div className="text-right">
                     <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-black uppercase">Vence {c.dia_vencimento}</span>
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
  onSubmit: (data: Omit<Despesa, 'id'> | Omit<Receita, 'id'>) => void,
  initialData?: Despesa | Receita | ContaFixaConfig,
  titulares: Titular[],
  cartoes: CartaoConfig[],
  competencia: string,
  onClose: () => void,
  onSubmitContaFixa?: (data: Omit<ContaFixaConfig, 'id' | 'user_id' | 'family_id'>) => void,
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
    cartao_vencimento_id: (initialData as any)?.cartao_vencimento_id || '',
  });

  const isRevenue = (type as string) === 'receita';
  const isExpense = (type as string) === 'despesa';

  const isMasterConfig = !!(initialData as any)?.data_inicio;
  const [isRecorrente, setIsRecorrente] = useState(isMasterConfig || (subType === 'fixa' && !initialData));
  const [isIndefinite, setIsIndefinite] = useState(isMasterConfig ? !(initialData as any).total_parcelas : true);

  const [paymentType, setPaymentType] = useState((initialData as any)?.parcela_total > 1 ? 'Parcelado' : 'A vista');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (validationError) {
      const timer = setTimeout(() => setValidationError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [validationError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
      data.categoria = formData.categoria || categorizar(formData.descricao);
      data.vencimento = finalDate;
      data.status = formData.status;
      data.parcela_atual = formData.parcela_atual;
      data.parcela_total = paymentType === 'A vista' ? 1 : formData.parcela_total;
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
      data.parcela_total = formData.parcela_total;
    }

    if ((type === 'despesa' && subType === 'fixa' && isRecorrente) || (type === 'receita' && isRecorrente)) {
      if (onSubmitContaFixa) {
        onSubmitContaFixa({
          descricao: formData.descricao,
          valor_mensal: parseFloat(formData.valor),
          total_parcelas: isIndefinite ? null : formData.parcela_total,
          parcela_atual: formData.parcela_atual,
          data_inicio: finalDate,
          competencia_inicial: type === 'receita' ? calcularCompetenciaReceita(parseISO(finalDate)) : calcularCompetencia(parseISO(finalDate)),
          titular_id: titularId,
          categoria: formData.categoria || categorizar(formData.descricao),
          tipo: type
        });
        return;
      }
    }

    onSubmit(data as Omit<Despesa, 'id'> | Omit<Receita, 'id'>);
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

          {type === 'despesa' && subType === 'cartao' ? (
            <div className="md:col-span-2">
              <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Cartão / Vencimento</label>
              <CardSelectDropdown
                value={formData.cartao_vencimento_id}
                onChange={id => setFormData({ ...formData, cartao_vencimento_id: id })}
                cartoes={cartoes}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Responsável</label>
                <select
                  className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 md:py-2.5 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm appearance-none text-on-surface"
                  value={formData.titular_id}
                  onChange={e => setFormData({ ...formData, titular_id: parseInt(e.target.value) })}
                >
                  {titulares.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Categoria</label>
                <input
                  className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 md:py-2.5 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm text-on-surface"
                  placeholder="Ex: Mercado, Saúde..."
                  type="text"
                  value={formData.categoria}
                  onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                />
              </div>
            </>
          )}

          {(isRevenue || (isExpense && subType === 'fixa')) && (
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
                    backgroundColor: isRevenue ? '#00995D' : 'var(--navy)'
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
              <div className="flex items-center h-[26px] mb-1 px-1">
                <label className="text-[10px] md:label-md font-label text-on-surface-variant block whitespace-nowrap">
                  {subType === 'cartao' ? 'Data da Compra' : (isRevenue ? 'Data de Recebimento' : 'Data de Vencimento')}
                </label>
              </div>
              <input
                type="date"
                className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-2 md:px-4 h-[44px] focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-xs md:text-sm text-on-surface"
                value={formData.vencimento}
                onChange={e => setFormData({ ...formData, vencimento: e.target.value })}
              />
            </div>

            {type === 'despesa' && subType === 'cartao' ? (
              <div>
                <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Categoria</label>
                <input
                  className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 md:py-2.5 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm text-on-surface"
                  placeholder="Ex: Mercado, Saúde..."
                  type="text"
                  value={formData.categoria}
                  onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                />
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1 px-1 h-[26px]">
                  <label className="text-[10px] md:label-md font-label text-on-surface-variant whitespace-nowrap uppercase font-bold tracking-wider">
                    {isRecorrente
                      ? (isIndefinite ? 'Recorrência' : 'Duração')
                      : (isRevenue ? 'Tipo de Recebimento' : 'Tipo de Pagamento')}
                  </label>
                  {isRecorrente && (
                    <button
                      type="button"
                      onClick={() => setIsIndefinite(!isIndefinite)}
                      style={{ borderRadius: '9999px' }}
                      className={cn(
                        "text-[9px] md:text-[10px] font-black uppercase tracking-tighter px-2 md:px-3 py-1 border transition-all -mt-[1px] whitespace-nowrap",
                        isIndefinite
                          ? "bg-navy/10 text-navy border-navy/20"
                          : "bg-slate-50 text-slate-400 border-slate-200 hover:text-navy hover:border-navy/30"
                      )}
                    >
                      {isIndefinite ? 'Sem prazo' : 'Com prazo'}
                    </button>
                  )}
                </div>

                <div className="bg-[#F1F5F9] p-[3px] rounded-full flex w-full h-9 md:h-[44px] relative border border-slate-200/50 shadow-inner">
                  {isRecorrente ? (
                    isIndefinite ? (
                      <div className="flex-1 rounded-full bg-white/20 text-muted-foreground flex items-center justify-center gap-2 transition-all duration-300 h-full w-full">
                        <span className="material-symbols-outlined text-lg">all_inclusive</span>
                        <span className="text-[8.5px] md:text-[11px] font-headline font-black uppercase tracking-tighter text-foreground">Indeterminado</span>
                      </div>
                    ) : (
                      <div className="flex-1 rounded-full bg-navy text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10 flex items-center justify-between px-1.5 transition-all duration-300 h-full w-full">
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                          onClick={() => setFormData({ ...formData, parcela_total: Math.max(1, (formData.parcela_total || 1) - 1) })}
                        >
                          <span className="material-symbols-outlined text-[18px]">remove</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="120"
                            className="w-10 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                            value={formData.parcela_total}
                            onChange={e => setFormData({ ...formData, parcela_total: parseInt(e.target.value) || 12 })}
                          />
                          <span className="text-[10px] font-black text-white/60 uppercase">Meses</span>
                        </div>
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                          onClick={() => setFormData({ ...formData, parcela_total: Math.min(120, (formData.parcela_total || 1) + 1) })}
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <>
                      <div
                        className={cn(
                          "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-navy shadow-md transition-all duration-300 ease-out",
                          paymentType === 'Parcelado' ? "hidden opacity-0" : "left-1 opacity-100"
                        )}
                        style={{ borderRadius: '9999px' }}
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
                          className="flex-1 relative z-10 rounded-full bg-navy text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10 flex items-center justify-between px-1.5 transition-all duration-300 h-full"
                        >
                          <button
                            type="button"
                            className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.max(2, (formData.parcela_total || 2) - 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                          </button>
                          <input
                            type="number"
                            min="2"
                            max="99"
                            className="w-7 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                            value={formData.parcela_total}
                            onChange={e => setFormData({ ...formData, parcela_total: parseInt(e.target.value) || 2 })}
                          />
                          <button
                            type="button"
                            className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
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
            )}
          </div>

          {type === 'despesa' && subType === 'cartao' && (
            <div className="md:col-span-2">
              <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Tipo de Gasto</label>
              <div className="bg-[#F1F5F9] p-[3px] rounded-full flex w-full h-9 md:h-[44px] relative border border-slate-200/50 shadow-inner">
                <div
                  className={cn(
                    "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-navy shadow-md transition-all duration-300 ease-out",
                    paymentType === 'Parcelado' ? "hidden opacity-0" : "left-1 opacity-100"
                  )}
                  style={{ borderRadius: '9999px' }}
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
                    className="flex-1 relative z-10 rounded-full bg-navy text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10 flex items-center justify-between px-1.5 transition-all duration-300 h-full"
                  >
                    <button
                      type="button"
                      className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                      onClick={() => setFormData({ ...formData, parcela_total: Math.max(2, (formData.parcela_total || 2) - 1) })}
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <input
                      type="number"
                      min="2"
                      max="99"
                      className="w-7 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                      value={formData.parcela_total}
                      onChange={e => setFormData({ ...formData, parcela_total: parseInt(e.target.value) || 2 })}
                    />
                    <button
                      type="button"
                      className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
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
                </div>
              </div>
            )}
          </>
        ) : (
            <div className="md:col-span-2 grid grid-cols-2 gap-x-6 gap-y-4 items-start">
              <div>
                <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Data de Receber</label>
                <input
                  type="date"
                  className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-2 md:px-4 h-[44px] focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-xs md:text-sm text-on-surface"
                  value={formData.vencimento}
                  onChange={e => setFormData({ ...formData, vencimento: e.target.value })}
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1 px-1 h-[26px]">
                  <label className="text-[10px] md:label-md font-label text-on-surface-variant whitespace-nowrap uppercase font-bold tracking-wider">
                    {isRecorrente
                      ? (isIndefinite ? 'Recorrência' : 'Duração')
                      : 'Tipo de Recebimento'}
                  </label>
                  {isRecorrente && (
                    <button
                      type="button"
                      onClick={() => setIsIndefinite(!isIndefinite)}
                      style={{ borderRadius: '9999px' }}
                      className={cn(
                        "text-[9px] md:text-[10px] font-black uppercase tracking-tighter px-2 md:px-3 py-1 border transition-all -mt-[1px] whitespace-nowrap",
                        isIndefinite
                          ? "bg-[#00995D]/10 text-[#00995D] border-[#00995D]/20"
                          : "bg-slate-50 text-slate-400 border-slate-200 hover:text-[#00995D] hover:border-[#00995D]/30"
                      )}
                    >
                      {isIndefinite ? 'Sem prazo' : 'Com prazo'}
                    </button>
                  )}
                </div>

                <div className="bg-[#F1F5F9] p-[3px] rounded-full flex w-full h-[44px] relative border border-slate-200/50 shadow-inner">
                  {isRecorrente ? (
                    isIndefinite ? (
                      <div className="flex-1 rounded-full bg-white/20 text-muted-foreground flex items-center justify-center gap-2 transition-all duration-300 h-full w-full">
                        <span className="material-symbols-outlined text-lg">all_inclusive</span>
                        <span className="text-[8.5px] md:text-[11px] font-headline font-black uppercase tracking-tighter text-foreground">Indeterminado</span>
                      </div>
                    ) : (
                      <div
                        className="flex-1 rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10 flex items-center justify-between px-1.5 transition-all duration-300 h-full w-full"
                        style={{ backgroundColor: '#00995D' }}
                      >
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                          onClick={() => setFormData({ ...formData, parcela_total: Math.max(1, (formData.parcela_total || 1) - 1) })}
                        >
                          <span className="material-symbols-outlined text-[18px]">remove</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="120"
                            className="w-10 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                            value={formData.parcela_total}
                            onChange={e => setFormData({ ...formData, parcela_total: parseInt(e.target.value) || 12 })}
                          />
                          <span className="text-[10px] font-black text-white/60 uppercase">Meses</span>
                        </div>
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                          onClick={() => setFormData({ ...formData, parcela_total: Math.min(120, (formData.parcela_total || 1) + 1) })}
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <>
                      {/* Sliding Pill Background - Hidden when <span className="md:hidden">Parc.</span><span className="hidden md:inline">Parcelado</span> is active to avoid overlap */}
                      <div
                        className={cn(
                          "absolute top-1 bottom-1 w-[calc(50%-4px)] shadow-md transition-all duration-300 ease-out",
                          paymentType === 'Parcelado' ? "hidden opacity-0" : "left-1 opacity-100"
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
                          className="flex-1 relative z-10 rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10 flex items-center justify-between px-1.5 transition-all duration-300 h-full"
                          style={{ backgroundColor: '#00995D' }}
                        >
                          <button
                            type="button"
                            className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                            onClick={() => setFormData({ ...formData, parcela_total: Math.max(2, (formData.parcela_total || 2) - 1) })}
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                          </button>
                          <input
                            type="number"
                            min="2"
                            max="99"
                            className="w-7 bg-transparent border-none text-center focus:outline-none focus:ring-0 font-headline font-bold text-sm text-white p-0"
                            value={formData.parcela_total}
                            onChange={e => setFormData({ ...formData, parcela_total: parseInt(e.target.value) || 2 })}
                          />
                          <button
                            type="button"
                            className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
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
              if (!formData.valor || parseFloat(formData.valor) <= 0) {
                setValidationError('Por favor, informe um valor válido para o lançamento.');
                return;
              }
              handleSubmit(e as any);
            }}
            style={{ borderRadius: '9999px', backgroundColor: themeColor }}
            className="text-white h-[44px] md:h-[48px] font-label font-semibold text-xs md:text-sm shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all w-full flex items-center justify-center gap-2 opacity-90 hover:opacity-100"
          >
            <span className="material-symbols-outlined text-base md:text-lg">check_circle</span>
            {!!initialData ? 'Salvar' : 'Registrar'}
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 backdrop-blur-md bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[380px] bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-10 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header com Ano */}
        <div className="flex justify-between items-center mb-8 px-2">
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all"
            onClick={() => setViewYear((prev: number) => prev - 1)}
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
          
          <h2 className="text-2xl font-black text-foreground m-0">{viewYear}</h2>
          
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all"
            onClick={() => setViewYear((prev: number) => prev + 1)}
          >
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>

        {/* Grid de Meses */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {meses.map((mes, index) => {
            const monthNum = index + 1;
            const isSelected = monthNum === currentMonth && viewYear === currentYear;
            return (
              <button
                key={mes}
                type="button"
                className={cn(
                  "py-3.5 px-4 flex items-center justify-center font-black text-xs tracking-tight transition-all border",
                  isSelected
                    ? "text-white shadow-lg shadow-primary/20"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
                style={{ 
                  borderRadius: '20px',
                  backgroundColor: isSelected ? 'var(--primary)' : undefined,
                  borderColor: isSelected ? 'var(--primary)' : undefined
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

        {/* Botão Fechar */}
        <button
          type="button"
          className="w-100 py-3.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-base transition-all border border-transparent active:scale-95"
          style={{ borderRadius: '20px' }}
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </div>
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
  onConfirm: () => void,
  title: string,
  message: string,
  confirmLabel?: string,
  variant?: 'danger' | 'primary' | 'success'
}) {
  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 3000 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px', zIndex: 3001 }} onClick={e => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 shadow-lg p-2 bg-card">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body py-4 text-center">
            <div className={`d-inline-flex p-3 rounded-circle bg-${variant} bg-opacity-10 text-${variant} mb-3`}>
              <i className={`fa-solid ${variant === 'danger' ? 'fa-trash-can' : 'fa-circle-question'} fa-2xl`}></i>
            </div>
            <p className="text-muted mb-0">{message}</p>
          </div>
          <div className="modal-footer border-0 pt-0 gap-2">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-bold flex-grow-1" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className={`btn btn-${variant} rounded-pill px-4 fw-bold flex-grow-1`}
              onClick={() => { onConfirm(); onClose(); }}
            >
              {confirmLabel}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 md:gap-y-3">
          <div className="md:col-span-2">
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

          <div>
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

          <div>
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

          <div>
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Total de Parcelas</label>
            <input
              required
              className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 md:py-2.5 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm"
              type="number"
              value={formData.total_parcelas}
              onChange={e => setFormData({ ...formData, total_parcelas: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Data 1º Vencimento</label>
            <input
              required
              type="date"
              className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-2 md:px-4 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-xs md:text-sm h-[44px] text-on-surface"
              value={formData.data_primeiro_vencimento}
              onChange={e => setFormData({ ...formData, data_primeiro_vencimento: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Competência de Início</label>
            <select
              className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm appearance-none text-on-surface"
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
                      <option value={c1}>Mês do vencimento</option>
                      <option value={c2}>Mês seguinte ao vencimento</option>
                    </>
                  );
                } catch {
                  return <option value={formData.competencia_inicial}>{formData.competencia_inicial}</option>;
                }
              })()}
            </select>
          </div>

          <div>
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // No novo sistema virtual, precisamos PROJETAR as parcelas para a simulação, 
  // pois elas não existem mais no banco de dados se não estiverem pagas.
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

      // Só incluímos se for posterior à data de referência E não estiver paga no banco
      if (vencStr > refDate) {
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
    }
    return projected;
  }, [loan, item, installments, refDate]);

  const simulation = futureInstallments.map(i => {
    // Se for empréstimo, calcula VP com a taxa. Se for fixa, VP = Valor Nominal (desconto 0)
    const taxa = loan?.taxa_mensal_percentual || 0;

    const { vp, discount } = taxa > 0
      ? calculatePresentValue(i.valor, taxa, i.vencimento, parseISO(refDate))
      : { vp: i.valor, discount: 0 };

    return { ...i, vp, discount };
  });

  const selectedParcelas = simulation.filter(i => selectedIds.includes(i.id));
  const totalNominal = selectedParcelas.reduce((acc, i) => acc + i.valor, 0);
  const totalVP = selectedParcelas.reduce((acc, i) => acc + i.vp, 0);
  const totalDiscount = totalNominal - totalVP;

  const handleConfirm = async () => {
    if (selectedParcelas.length === 0) return;
    setIsSubmitting(true);
    try {
      // Passamos as parcelas com o valor ATUALIZADO pelo desconto (VP)
      await onConfirmPayoff(selectedParcelas.map(p => ({ ...p, valor: p.vp } as any)));
      onClose();
    } catch (error) {
      alert('Erro ao confirmar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerTitle = loan?.descricao || item?.descricao || 'Antecipação';

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-success/10 p-2 rounded-xl text-success">
            <span className="material-symbols-outlined">calculate</span>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Planejamento de Quitação</span>
            <h1 className="text-2xl font-black text-navy leading-none">{headerTitle}</h1>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
          <label className="text-[11px] font-bold uppercase text-primary mb-2 block">Referência de hoje</label>
          <input
            type="date"
            className="w-full bg-white border-none ring-1 ring-primary/20 rounded-xl px-4 py-2 font-bold text-navy focus:ring-primary focus:outline-none"
            value={refDate}
            onChange={e => setRefDate(e.target.value)}
          />
          {loan && (
            <p className="text-[10px] text-muted mt-2 leading-relaxed">
              * O cálculo utiliza a taxa mensal de <strong>{loan.taxa_mensal_percentual}%</strong> com capitalização composta baseada em dias corridos (base 30).
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] font-bold text-muted uppercase">Selecionado (Nominal)</div>
            <div className="text-lg font-black text-navy">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalNominal)}</div>
            <div className="text-[9px] text-muted">{selectedParcelas.length} parcelas selecionadas</div>
          </div>
          <div className="bg-navy rounded-xl p-3 text-center text-white shadow-lg">
            <div className="text-[10px] font-bold text-white/60 uppercase">Valor a Pagar</div>
            <div className="text-lg font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVP)}</div>
            {totalDiscount > 0 && <div className="text-[9px] text-success font-bold">Economia de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDiscount)}</div>}
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar border rounded-xl overflow-hidden">
          <table className="table table-hover align-middle mb-0">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b">
                <th style={{ width: '40px' }} className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={simulation.length > 0 && selectedIds.length === simulation.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(simulation.map(i => i.id));
                      else setSelectedIds([]);
                    }}
                  />
                </th>
                <th className="text-[9px] font-black uppercase text-muted text-center">Parc.</th>
                <th className="text-[9px] font-black uppercase text-muted text-center">Venc. Original</th>
                <th className="text-[9px] font-black uppercase text-muted text-center">Comp.</th>
                <th className="text-[9px] font-black uppercase text-muted text-end">V. Presente</th>
                <th className="text-[9px] font-black uppercase text-muted text-end">Desconto</th>
              </tr>
            </thead>
            <tbody>
              {simulation.map(i => (
                <tr
                  key={i.id}
                  className={cn("cursor-pointer", selectedIds.includes(i.id) && "bg-primary/5")}
                  onClick={() => {
                    setSelectedIds(prev => prev.includes(i.id) ? prev.filter(id => id !== i.id) : [...prev, i.id]);
                  }}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="form-check-input mt-0"
                      checked={selectedIds.includes(i.id)}
                      readOnly
                    />
                  </td>
                  <td className="py-2 text-[11px] font-bold text-navy text-center">{i.parcela_atual}/{i.parcela_total}</td>
                  <td className="py-2 text-[11px] text-muted text-center">{i.vencimento.split('-').reverse().join('/')}</td>
                  <td className="py-2 text-[11px] text-muted text-center">{i.competencia}</td>
                  <td className="py-2 text-[11px] font-black text-navy text-end">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(i.vp)}</td>
                  <td className="py-2 text-[10px] font-bold text-success text-end">-{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(i.discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {simulation.length === 0 && (
            <div className="text-center py-8 text-muted italic text-sm">Nenhuma parcela futura encontrada para este contrato.</div>
          )}
        </div>

        <div className="pt-2 space-y-3">
          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0 || isSubmitting}
            className={cn(
              "w-full h-[64px] font-black rounded-xl transition-all flex items-center justify-center gap-2",
              selectedIds.length === 0
                ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                : "bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20"
            )}
          >
            {isSubmitting ? (
              <span className="spinner-border spinner-border-sm"></span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                CONFIRMAR PAGAMENTO AGORA
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-3 rounded-xl transition-colors text-sm"
          >
            Sair sem Pagar
          </button>
        </div>
      </div>
    </>
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
  isDarkMode
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
  isDarkMode: boolean;
}) {
  const [activeTab, setActiveTab] = useState('emprestimos');

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
      title: 'RECEITAS',
      tabs: [
        { id: 'rec_recorrentes', label: 'Recorrentes', icon: 'autorenew' },
        { id: 'rec_parceladas', label: 'Fixas / Parc.', icon: 'layers' },
      ]
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'emprestimos':
        return (
          <div className="d-flex flex-column h-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <header className="flex-shrink-0 px-6 md:px-10 pt-2 md:pt-10 pb-4 bg-card border-bottom border-border/40">
              <h3 className="text-xl font-bold text-foreground m-0">Contratos de Empréstimo</h3>
              <p className="hidden md:block text-muted-foreground small m-0">Gerencie as configurações mestre de seus empréstimos ativos.</p>
            </header>

            <div className="flex-grow-1 overflow-y-auto p-10 pt-6 custom-scrollbar">
              <div className="grid gap-4">
                {emprestimos.length === 0 ? (
                  <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl opacity-40">
                    <span className="material-symbols-outlined text-[48px] mb-4 text-muted-foreground">account_balance</span>
                    <p className="fw-bold text-uppercase tracking-widest text-xs">Nenhum empréstimo cadastrado</p>
                  </div>
                ) : (
                  emprestimos.map((loan) => (
                    <div key={loan.id} className="bg-card p-4 rounded-2xl border border-border d-flex align-items-center justify-content-between hover:bg-muted/30 transition-all group">
                      <div className="d-flex align-items-center gap-4 flex-grow-1">
                        <div className="w-12 h-12 rounded-xl d-flex align-items-center justify-content-center" style={{ backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(217, 119, 6, 0.1)', color: isDarkMode ? '#fbbf24' : '#d97706' }}>
                          <span className="material-symbols-outlined">payments</span>
                        </div>
                        <div>
                          <div className="fw-bold text-foreground text-sm tracking-tight">{loan.descricao}</div>
                          <div className="d-flex align-items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground font-black uppercase tracking-tighter opacity-70">
                              Parcela: {formatCurrency(loan.valor_parcela)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-bold">
                              {loan.taxa_mensal_percentual}% juros
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <button onClick={() => onEditEmprestimo(loan)} className="btn-icon rounded-xl hover:bg-primary/10 transition-colors"><span className="material-symbols-outlined text-[20px] text-edit-blue">edit</span></button>
                        <button onClick={() => onDeleteEmprestimo(loan.id)} className="btn-icon rounded-xl hover:bg-danger/10 transition-colors"><span className="material-symbols-outlined text-[20px] text-delete-red">delete</span></button>
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
        const isReceitaTab = activeTab.startsWith('rec_');
        const isRecorrenteTab = activeTab === 'recorrentes' || activeTab === 'rec_recorrentes';

        const filtered = contasFixas.filter(c => {
          const typeMatch = isReceitaTab ? c.tipo === 'receita' : (!c.tipo || c.tipo === 'despesa');
          const recurrenceMatch = isRecorrenteTab ? c.total_parcelas === null : c.total_parcelas !== null;
          return typeMatch && recurrenceMatch;
        });

        const activeThemeColor = themeColor;

        return (
          <div className="d-flex flex-column h-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <header className="flex-shrink-0 px-6 md:px-10 pt-2 md:pt-10 pb-4 bg-card border-bottom border-border/40">
              <h3 className="text-xl font-bold text-foreground m-0">
                {isReceitaTab
                  ? (isRecorrenteTab ? 'Receitas Recorrentes' : 'Receitas Fixas / Parceladas')
                  : (isRecorrenteTab ? 'Despesas Recorrentes' : <>Gastos <span className="md:hidden">Parc.</span><span className="hidden md:inline">Parcelado</span>s</>)}
              </h3>
              <p className="hidden md:block text-muted-foreground small m-0">
                {isReceitaTab
                  ? (isRecorrenteTab ? 'Configurações de rendas fixas contínuas (ex: Salário).' : 'Configurações de rendas com prazo (ex: Bônus parcelado).')
                  : (isRecorrenteTab ? 'Configurações de gastos fixos contínuos (ex: Assinaturas).' : 'Configurações de gastos fixos com prazo (ex: Empréstimos pessoais).')}
              </p>
            </header>

            <div className="flex-grow-1 overflow-y-auto p-10 pt-6 custom-scrollbar">
            <div className="grid gap-4">
              {filtered.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl opacity-40">
                  <span className="material-symbols-outlined text-[48px] mb-4 text-muted-foreground">
                    {isRecorrenteTab ? 'event_repeat' : 'inventory_2'}
                  </span>
                  <p className="fw-bold text-uppercase tracking-widest text-xs">Nenhum registro encontrado</p>
                </div>
              ) : (
                filtered.map((config) => (
                  <div key={config.id} className="bg-card p-4 rounded-2xl border border-border d-flex align-items-center justify-content-between hover:bg-muted/30 transition-all group">
                    <div className="d-flex align-items-center gap-4 flex-grow-1">
                      <div className="w-12 h-12 rounded-xl d-flex align-items-center justify-content-center" style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : `${activeThemeColor}15`, color: isDarkMode ? 'var(--text)' : activeThemeColor }}>
                        <span className="material-symbols-outlined">{isRecorrenteTab ? 'autorenew' : 'layers'}</span>
                      </div>
                      <div>
                        <div className="fw-bold text-foreground text-sm tracking-tight">{config.descricao}</div>
                        <div className="d-flex align-items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground font-black uppercase tracking-tighter opacity-70">
                            {formatCurrency(config.valor_mensal)} /mês
                          </span>
                          {!isRecorrenteTab && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-bold">
                              {config.total_parcelas} parcelas
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground uppercase font-black opacity-50 tracking-widest">{config.categoria}</span>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button onClick={() => onEditContaFixa(config)} className="btn-icon rounded-xl hover:bg-primary/10 transition-colors"><span className="material-symbols-outlined text-[20px] text-edit-blue">edit</span></button>
                      <button onClick={() => onDeleteContaFixa(config.id)} className="btn-icon rounded-xl hover:bg-danger/10 transition-colors"><span className="material-symbols-outlined text-[20px] text-delete-red">delete</span></button>
                    </div>
                  </div>
                ))
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
            <aside className="bg-muted/10 border-bottom border-border d-flex flex-row overflow-auto p-2 gap-1 no-scrollbar flex-shrink-0">
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
              <div className="flex-grow-1 overflow-y-auto p-4 custom-scrollbar">
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
          <div className="modal-content border-0 shadow-2xl overflow-hidden rounded-[2rem] bg-card" style={{ height: '700px' }}>
            <div className="d-flex h-100">
              {/* Sidebar */}
              <aside className="bg-muted/20 border-end border-border d-flex flex-column overflow-auto py-4 px-2 gap-1 no-scrollbar flex-shrink-0" style={{ width: '220px' }}>
                <div className="d-flex flex-column align-items-start px-3 mb-8">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", color: isDarkMode ? '#f8fafc' : themeColor }}>receipt_long</span>
                    <span className="text-[25px] font-black uppercase tracking-widest" style={{ color: isDarkMode ? '#f8fafc' : themeColor }}>Ajustes</span>
                  </div>
                </div>

                <div className="flex-grow-1 d-flex flex-column gap-4">
                  {sections.map((section) => (
                    <div key={section.title} className="d-flex flex-column gap-1">
                      <div className="px-3 mb-2">
                        <span className="text-[9px] font-black text-muted-foreground opacity-50 tracking-[.25em] uppercase">{section.title}</span>
                      </div>
                      <div className="d-flex flex-column gap-1">
                        {section.tabs.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                              "px-4 py-3 rounded-2xl transition-all duration-300 d-flex align-items-center gap-3 border-0",
                              activeTab === tab.id ? "text-white" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                            style={{
                              fontSize: '10px',
                              background: activeTab === tab.id ? themeColor : 'transparent',
                              boxShadow: activeTab === tab.id ? `0 4px 12px ${themeColor}40` : 'none',
                              borderRadius: '16px'
                            }}
                          >
                            <span
                              className={cn("material-symbols-outlined text-[20px]", activeTab === tab.id ? "text-white" : (isDarkMode ? "text-white/60" : "text-muted-foreground"))}
                              style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : "" }}
                            >
                              {tab.icon}
                            </span>
                            <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
                          </button>
                        ))}
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
            {/* Botão de Fechar no topo direito */}
            <button 
              type="button" 
              className="btn-icon position-absolute top-0 end-0 m-4 z-50 d-flex align-items-center justify-content-center transition-all hover:bg-muted/20 rounded-circle border-0 bg-transparent text-foreground"
              style={{ width: '40px', height: '40px' }}
              onClick={onClose}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
