'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Titular, Status, Despesa, Receita, CartaoConfig, Profile, Emprestimo, ContaFixaConfig } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { calcularCompetencia, calcularCompetenciaReceita, ajustarDataReceita, calcularCompetenciaCartao, calculatePresentValue, projetarProximoVencimento } from '@/lib/finance-service';
import { parseISO, format, getDate, isLastDayOfMonth, addMonths } from 'date-fns';
import { categorizar } from '@/lib/categories-utils';
import { useEffect } from 'react';
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
      else if ((initialData as any).data_recebimento !== undefined) setActiveType('receita');
      else setActiveType('despesa');
    }
  }, [initialData, isEditing]);

  const typeColors = {
    despesa: '#1e293b',
    despesa_cartao: '#00343d',
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
              style={{ color: `${typeColors[activeType]}bf` }}
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
    descricao: initialData?.descricao || '',
    valor: (initialData as any)?.valor_mensal?.toString() || (initialData as any)?.valor?.toString() || '',
    titular_id: initialData?.titular_id || titulares[0]?.id,
    categoria: (initialData as any)?.categoria || '',
    vencimento: (initialData as any)?.vencimento || (initialData as any)?.data_recebimento || (initialData as any)?.data_inicio || format(new Date(), 'yyyy-MM-dd'),
    status: (initialData as any)?.status || 'Em aberto',
    parcela_atual: (initialData as any)?.parcela_atual || 1,
    parcela_total: (initialData as any)?.total_parcelas || (initialData as any)?.parcela_total || 1,
    cartao_vencimento_id: (initialData as any)?.cartao_vencimento_id || '',
  });

  const isRevenue = (type as string) === 'receita';
  const isExpense = (type as string) === 'despesa';

  const [isRecorrente, setIsRecorrente] = useState(subType === 'fixa');
  const [isIndefinite, setIsIndefinite] = useState(!(initialData as any)?.parcela_total || (initialData as any)?.parcela_total === 0);

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
                    backgroundColor: isRevenue ? '#00995D' : '#1e293b'
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
              {subType === 'cartao' ? (
                <div className="md:col-span-2 grid grid-cols-2 gap-x-6 gap-y-4 items-start">
                  <div>
                    <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Cartão / Vencimento</label>
                    <select
                      className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-sm appearance-none text-on-surface"
                      value={formData.cartao_vencimento_id}
                      onChange={e => setFormData({ ...formData, cartao_vencimento_id: e.target.value })}
                    >
                      <option value="">Selecione um cartão</option>
                      {cartoes.map(c => (
                        <option key={c.id} value={c.id}>{c.nome_cartao} (Vence {c.dia_vencimento})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] md:label-md font-label text-on-surface-variant mb-1 block ml-1 uppercase font-bold tracking-wider whitespace-nowrap">Tipo de Gasto</label>
                    <div className="bg-[#F1F5F9] p-[3px] rounded-full flex w-full h-9 md:h-[44px] relative border border-slate-200/50 shadow-inner">
                      {/* Sliding Pill Background - Hidden when <span className="md:hidden">Parc.</span><span className="hidden md:inline">Parcelado</span> is active to avoid overlap */}
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
                          style={{ borderRadius: '9999px' }}
                          className="flex-1 rounded-full text-[9px] md:text-[11px] font-headline font-medium text-slate-500 hover:text-navy/60 transition-all duration-300"
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

                </div>
              ) : (
                <div className="md:col-span-2 grid grid-cols-2 gap-x-6 gap-y-3 items-start">
                  <div>
                    <div className="flex items-center h-[26px] mb-1 px-1">
                      <label className="text-[10px] md:label-md font-label text-on-surface-variant block whitespace-nowrap">
                        {isRevenue ? 'Data de Recebimento' : 'Data de Vencimento'}
                      </label>
                    </div>
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
                          <div className="flex-1 rounded-full bg-white/50 text-slate-400 flex items-center justify-center gap-2 transition-all duration-300 h-full w-full">
                            <span className="material-symbols-outlined text-lg">all_inclusive</span>
                            <span className="text-[8.5px] md:text-[11px] font-headline font-black uppercase tracking-tighter">Tempo Indeterminado</span>
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
                          {/* Sliding Pill Background - Hidden when Parcelado is active to avoid overlap */}
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
                      <div className="flex-1 rounded-full bg-white/50 text-slate-400 flex items-center justify-center gap-2 transition-all duration-300 h-full w-full">
                        <span className="material-symbols-outlined text-lg">all_inclusive</span>
                        <span className="text-[8.5px] md:text-[11px] font-headline font-black uppercase tracking-tighter">Tempo Indeterminado</span>
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
  onCancel
}: {
  onSubmit: (data: Omit<Titular, 'id'>) => void,
  initialData?: Titular,
  onCancel?: () => void
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
          className="btn btn-primary w-100 py-2.5 md:py-3 fw-bold rounded-pill text-uppercase text-xs md:text-sm"
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
  onCancel
}: {
  onSubmit: (data: Omit<CartaoConfig, 'id'>) => void,
  titulares: Titular[],
  initialData?: CartaoConfig,
  onCancel?: () => void
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
        <button className="btn btn-primary w-100 py-2.5 md:py-3 fw-bold rounded-pill text-uppercase text-xs md:text-sm">
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
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 md:p-4 backdrop-blur-md bg-black/40" onClick={onClose}>
      <div
        className={cn("w-full max-w-[420px] bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200", "modal-month-year")}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 md:p-6 pb-0 flex justify-between items-center">
          <h5 className="text-lg md:text-xl font-bold text-navy m-0">Selecionar Período</h5>
          <button type="button" className="p-2 hover:bg-slate-100 rounded-full transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>

        <div className="p-4 md:p-6 text-center">
          <div className="flex justify-between align-items-center mb-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center bg-white shadow-sm rounded-xl border border-slate-200 text-navy hover:bg-slate-50 transition-all"
              onClick={() => setViewYear((prev: number) => prev - 1)}
            >
              <i className="fa-solid fa-chevron-left small"></i>
            </button>
            <h4 className="font-black text-xl m-0 flex items-center">{viewYear}</h4>
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center bg-white shadow-sm rounded-xl border border-slate-200 text-navy hover:bg-slate-50 transition-all"
              onClick={() => setViewYear((prev: number) => prev + 1)}
            >
              <i className="fa-solid fa-chevron-right small"></i>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {meses.map((mes, index) => {
              const monthNum = index + 1;
              const isSelected = monthNum === currentMonth && viewYear === currentYear;
              return (
                <button
                  key={mes}
                  type="button"
                  className={cn(
                    "py-3 rounded-2xl font-bold transition-all text-xs md:text-sm border",
                    isSelected
                      ? "bg-navy text-white border-navy shadow-md"
                      : "bg-white text-slate-600 border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                  )}
                  onClick={() => {
                    onSelect(monthNum, viewYear);
                    onClose();
                  }}
                >
                  {mes.substring(0, 3).toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
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

const getCardLogo = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('nubank')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/rRRmcj5K/Nubank.png" alt="Nubank" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('inter')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/mFSsyhBj/inter.png" alt="Inter" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('itaú') || lowerName.includes('itau')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/twPnVb6h/itau.avif" alt="Itaú" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('bradesco')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/BH4v1bVJ/Bradesco.png" alt="Bradesco" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('santander')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/Pz3tF8yC/Santander.png" alt="Santander" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('caixa')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/yBk7gxR1/caixa.png" alt="Caixa" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('mercado pago')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/hFkY0VVQ/Mercado-Pago.webp" alt="Mercado Pago" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('sicoob platinum')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/p6knTbFb/Sicoob-Platinum.png" alt="Sicoob" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('sicoob clássico')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/m5wswjcc/Sicoob-Cl-ssico.jpg" alt="Sicoob" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('eucard')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/93nFRcXn/Eucard.jpg" alt="Eucard" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('cabal')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://i.ibb.co/fVNSC8Rs/Cabal.png" alt="Cabal" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('bb') || lowerName.includes('brasil')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://logo.clearbit.com/bb.com.br" alt="BB" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('xp')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://logo.clearbit.com/xpi.com.br" alt="XP" fill unoptimized className="object-cover" /></div>;
  if (lowerName.includes('btg')) return <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 relative"><Image src="https://logo.clearbit.com/btgpactual.com" alt="BTG" fill unoptimized className="object-cover" /></div>;

  return <div className="w-10 h-10 rounded-xl bg-slate-700 d-flex align-items-center justify-content-center text-white opacity-40 shadow-sm"><span className="material-symbols-outlined text-[20px]">credit_card</span></div>;
};

import { SettingsView } from './settings-view';

export function SettingsModal({
  isOpen,
  onClose,
  user,
  isDarkMode,
  toggleDarkMode,
  familyMembers,
  onInvite,
  userType,
  titulares,
  cartoes,
  onAddTitular,
  onUpdateTitular,
  onDeleteTitular,
  onAddCartao,
  onUpdateCartao,
  onDeleteCartao
}: {
  isOpen: boolean,
  onClose: () => void,
  user: Profile | null,
  isDarkMode: boolean,
  toggleDarkMode: () => void,
  familyMembers: Profile[],
  onInvite: (email: string) => void,
  userType: 'titular' | 'membro',
  titulares: Titular[],
  cartoes: CartaoConfig[],
  onAddTitular: (t: Omit<Titular, 'id'>) => void,
  onUpdateTitular: (id: number, t: Partial<Titular>) => void,
  onDeleteTitular: (id: number) => void,
  onAddCartao: (c: Omit<CartaoConfig, 'id'>) => void,
  onUpdateCartao: (id: number, c: Partial<CartaoConfig>) => void,
  onDeleteCartao: (id: number) => void
}) {
  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block settings-modal-custom" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
        <div className="modal-content border-0 shadow-2xl overflow-hidden rounded-[2rem] bg-card" style={{ height: '870px' }}>
          <SettingsView
            user={user}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            familyMembers={familyMembers}
            onInvite={onInvite}
            userType={userType}
            titulares={titulares}
            cartoes={cartoes}
            onAddTitular={onAddTitular}
            onUpdateTitular={onUpdateTitular}
            onDeleteTitular={onDeleteTitular}
            onAddCartao={onAddCartao}
            onUpdateCartao={onUpdateCartao}
            onDeleteCartao={onDeleteCartao}
            isMobile={false}
          />
          {/* Footer fixo para o Modal */}
          <div className="absolute bottom-0 right-0 p-6 z-50">
            <button type="button" className="px-10 py-3 rounded-pill btn btn-light border-0 fw-bold text-sm text-uppercase tracking-wide transition-colors" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
              className="w-full bg-transparent border-none ring-1 ring-outline-variant/30 rounded-lg px-2 md:px-4 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all font-body text-xs md:text-sm h-[44px]"
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
          inst.parcela_atual === i &&
          inst.status === 'Pago' &&
          (isLoan ? inst.emprestimo_id === loan.id : inst.conta_fixa_id === (item as any)?.conta_fixa_id)
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
  onDeleteContaFixa
}: {
  isOpen: boolean;
  onClose: () => void;
  emprestimos: Emprestimo[];
  contasFixas: ContaFixaConfig[];
  onEditEmprestimo: (loan: Emprestimo) => void;
  onEditContaFixa: (config: ContaFixaConfig) => void;
  onDeleteEmprestimo: (id: number) => void;
  onDeleteContaFixa: (id: number) => void;
}) {
  const [activeTab, setActiveTab] = useState('emprestimos');

  if (!isOpen) return null;

  const sections = [
    {
      title: 'DESPESAS',
      tabs: [
        { id: 'emprestimos', label: 'Empréstimos', icon: 'account_balance', color: '#ff9800' },
        { id: 'parcelados', label: 'Parcelados', icon: 'inventory_2', color: '#01579b' },
        { id: 'recorrentes', label: 'Recorrentes', icon: 'event_repeat', color: '#7b1fa2' },
      ]
    },
    {
      title: 'RECEITAS',
      tabs: [
        { id: 'rec_recorrentes', label: 'Recorrentes', icon: 'autorenew', color: '#00995D' },
        { id: 'rec_parceladas', label: 'Fixas / Parc.', icon: 'layers', color: '#00995D' },
      ]
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'emprestimos':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <header className="mb-8">
              <h3 className="text-xl font-bold text-foreground m-0">Contratos de Empréstimo</h3>
              <p className="text-muted-foreground small">Gerencie as configurações mestre de seus empréstimos ativos.</p>
            </header>

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
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 d-flex align-items-center justify-content-center">
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

        const themeColor = isReceitaTab ? '#00995D' : (activeTab === 'parcelados' ? '#01579b' : '#7b1fa2');

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <header className="mb-8">
              <h3 className="text-xl font-bold text-foreground m-0">
                {isReceitaTab
                  ? (isRecorrenteTab ? 'Receitas Recorrentes' : 'Receitas Fixas / Parceladas')
                  : (isRecorrenteTab ? 'Despesas Recorrentes' : 'Gastos <span className="md:hidden">Parc.</span><span className="hidden md:inline">Parcelado</span>s')}
              </h3>
              <p className="text-muted-foreground small">
                {isReceitaTab
                  ? (isRecorrenteTab ? 'Configurações de rendas fixas contínuas (ex: Salário).' : 'Configurações de rendas com prazo (ex: Bônus parcelado).')
                  : (isRecorrenteTab ? 'Configurações de gastos fixos contínuos (ex: Assinaturas).' : 'Configurações de gastos fixos com prazo (ex: Empréstimos pessoais).')}
              </p>
            </header>

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
                      <div className="w-12 h-12 rounded-xl d-flex align-items-center justify-content-center" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
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
        );
      default: return null;
    }
  };

  return (
    <div className="modal fade show d-block expense-settings-modal-custom" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
        <div className="modal-content border-0 shadow-2xl overflow-hidden rounded-[2rem] bg-card" style={{ height: '700px' }}>
          <div className="d-flex h-100 flex-column flex-md-row">
            {/* Sidebar */}
            <aside className="bg-muted/20 border-end border-border d-flex flex-row flex-md-column overflow-auto p-2 p-md-4 gap-1 no-scrollbar flex-shrink-0" style={{ width: '240px' }}>
              <div className="d-none d-md-flex flex-column align-items-start px-3 mb-6">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">Master Config</span>
                </div>
                <h4 className="text-lg font-bold text-foreground">Ajustes</h4>
              </div>

              <div className="flex-grow-1 d-flex flex-row flex-md-column gap-4">
                {sections.map((section) => (
                  <div key={section.title} className="d-flex flex-column gap-1">
                    <div className="px-4 d-none d-md-block">
                      <span className="text-[9px] font-black text-muted-foreground opacity-50 tracking-[.25em] uppercase">{section.title}</span>
                    </div>
                    <div className="d-flex flex-row flex-md-column gap-1">
                      {section.tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "flex-grow-1 flex-md-grow-0 px-5 py-3 rounded-full transition-all duration-300 d-flex align-items-center justify-content-center gap-3 border-0 mx-2",
                            activeTab === tab.id
                              ? "text-white"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                          style={{
                            fontSize: '10px',
                            background: activeTab === tab.id ? '#111827' : 'transparent',
                            borderRadius: '9999px',
                            boxShadow: 'none'
                          }}
                        >
                          <span className={cn(
                            "material-symbols-outlined text-[20px]",
                            activeTab === tab.id ? "text-white" : "text-muted-foreground"
                          )} style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : "" }}>
                            {tab.icon}
                          </span>
                          <span className="text-xs font-black uppercase tracking-widest d-none d-md-inline whitespace-nowrap">{tab.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="mt-md-auto text-start px-4 py-3 rounded-2xl text-muted-foreground hover:bg-danger/5 hover:text-danger transition-all d-flex align-items-center gap-3 border-0 bg-transparent"
                style={{ fontSize: '10px' }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
                <span className="text-xs font-black uppercase tracking-widest d-none d-md-inline">Fechar</span>
              </button>
            </aside>

            {/* Content Area */}
            <main className="flex-fill overflow-auto p-6 p-md-10 bg-card relative">
              {renderContent()}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
