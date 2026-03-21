'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Titular, Status, Despesa, Receita, CartaoConfig, Profile } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { calcularCompetencia, calcularCompetenciaReceita, ajustarDataReceita, calcularCompetenciaCartao } from '@/lib/finance-service';
import { parseISO, format, getDate } from 'date-fns';
import { categorizar } from '@/lib/categories-utils';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block modal-standard-custom" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered px-3" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 shadow-lg animate-in zoom-in-95 duration-200 bg-card">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold text-foreground">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinanceForm({ 
  type, 
  subType,
  onSubmit, 
  titulares, 
  cartoes,
  competencia,
  initialData
}: { 
  type: 'despesa' | 'receita', 
  subType?: 'fixa' | 'cartao',
  onSubmit: (data: Omit<Despesa, 'id'> | Omit<Receita, 'id'>) => void,
  titulares: Titular[],
  cartoes: CartaoConfig[],
  competencia: string,
  initialData?: Despesa | Receita
}) {
  const [formData, setFormData] = useState({
    descricao: (initialData as any)?.descricao || '',
    valor: (initialData as any)?.valor?.toString() || '',
    titular_id: (initialData as any)?.titular_id || titulares[0]?.id || 0,
    categoria: (initialData as any)?.categoria || '',
    vencimento: (initialData as any)?.vencimento || (initialData as any)?.data_recebimento || new Date().toISOString().split('T')[0],
    status: (initialData as any)?.status || ('Em aberto' as Status),
    parcela_atual: (initialData as any)?.parcela_atual || 1,
    parcela_total: (initialData as any)?.parcela_total || 1,
    cartao_vencimento_id: (initialData as any)?.cartao_vencimento_id || '',
    simulada: (initialData as any)?.simulada || false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const [mes, ano] = competencia.split('/').map(Number);
    let finalDate = formData.vencimento;

    if (formData.vencimento.length <= 2) {
      const dia = parseInt(formData.vencimento);
      const date = new Date(ano, mes - 1, dia);
      finalDate = format(date, 'yyyy-MM-dd');
    }

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
      simulada: formData.simulada,
    };

    if (type === 'despesa') {
      data.categoria = formData.categoria || categorizar(formData.descricao);
      data.vencimento = finalDate;
      data.status = formData.status;
      data.parcela_atual = formData.parcela_atual;
      data.parcela_total = formData.parcela_total;
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
    }

    onSubmit(data as Omit<Despesa, 'id'> | Omit<Receita, 'id'>);
  };

  if (type === 'despesa' && subType === 'cartao') {
    return (
      <form onSubmit={handleSubmit} className="row g-3">
        <div className="col-12 mb-2 d-flex align-items-center gap-2 text-primary border-bottom pb-2 mb-4">
          <i className="fa-solid fa-credit-card fs-5"></i>
          <h5 className="fw-bold m-0">Novo Gasto no Cartão</h5>
        </div>

        <div className="col-12">
          <label className="form-label small fw-bold text-muted text-uppercase mb-1">Descrição</label>
          <input 
            required
            type="text" 
            className="form-control rounded-3" 
            placeholder="O que você comprou?"
            value={formData.descricao}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, descricao: e.target.value})}
          />
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted text-uppercase mb-1">Categoria</label>
          <input 
            type="text" 
            className="form-control rounded-3" 
            placeholder="Ex: Mercado, Saúde..."
            value={formData.categoria}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, categoria: e.target.value})}
          />
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted text-uppercase mb-1">Nome Cartão</label>
          <select 
            required
            className="form-select rounded-3"
            value={formData.cartao_vencimento_id}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, cartao_vencimento_id: e.target.value})}
          >
            <option value="">Selecione um Cartão</option>
            {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome_cartao}</option>)}
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted text-uppercase mb-1">Valor</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0">R$</span>
            <input 
              required
              type="number" 
              step="0.01"
              className="form-control border-start-0 rounded-end-3" 
              value={formData.valor}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, valor: e.target.value})}
            />
          </div>
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted text-uppercase mb-1">Parcelas</label>
          <input 
            type="number" 
            min="1"
            className="form-control rounded-3"
            value={formData.parcela_total}
            onChange={e => setFormData({...formData, parcela_total: parseInt(e.target.value)})}
          />
        </div>

        <div className="col-12 mt-3">
          <div className="form-check">
            <input 
              type="checkbox" 
              className="form-check-input"
              id="checkSimulacaoCartao"
              checked={formData.simulada}
              onChange={e => setFormData({...formData, simulada: e.target.checked})}
            />
            <label className="form-check-label small fw-bold text-muted text-uppercase" htmlFor="checkSimulacaoCartao">Simulação?</label>
          </div>
        </div>

        <div className="col-12 mt-4">
          <button className="btn btn-primary w-100 py-3 fw-bold rounded-pill text-uppercase">
            <i className="fa-solid fa-cloud-arrow-up me-2"></i>Salvar Lançamento
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="row g-3">
      <div className="col-12">
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">
          {type === 'receita' ? 'Descrição da Receita' : 'Descrição'}
        </label>
        <input 
          required
          type="text" 
          className="form-control rounded-3" 
          value={formData.descricao}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, descricao: e.target.value})}
        />
      </div>
      
      <div className="col-md-6">
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Valor</label>
        <div className="input-group">
          <span className="input-group-text bg-light border-end-0">R$</span>
          <input 
            required
            type="number" 
            step="0.01"
            className="form-control border-start-0 rounded-end-3" 
            value={formData.valor}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, valor: e.target.value})}
          />
        </div>
      </div>

      <div className="col-md-6">
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Titular</label>
        <select 
          className="form-select rounded-3"
          value={formData.titular_id}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, titular_id: parseInt(e.target.value)})}
        >
          {titulares.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>

      {type === 'despesa' ? (
        <>
          <div className="col-md-6">
            <label className="form-label small fw-bold text-muted text-uppercase mb-1">Categoria</label>
            <input 
              type="text" 
              className="form-control rounded-3" 
              placeholder="Ex: Mercado, Saúde..."
              value={formData.categoria}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, categoria: e.target.value})}
            />
          </div>

          {subType === 'cartao' ? (
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted text-uppercase mb-1">Nome Cartão</label>
              <select 
                className="form-select rounded-3"
                value={formData.cartao_vencimento_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, cartao_vencimento_id: e.target.value})}
              >
                <option value="">Selecione um Cartão</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome_cartao}</option>)}
              </select>
            </div>
          ) : (
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted text-uppercase mb-1">Dia Vencimento</label>
              <input 
                type="number" 
                min="1" max="31"
                className="form-control rounded-3"
                value={formData.vencimento.includes('-') ? getDate(parseISO(formData.vencimento)) : formData.vencimento}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, vencimento: e.target.value})}
              />
            </div>
          )}

          <div className="col-md-6">
            <label className="form-label small fw-bold text-muted text-uppercase mb-1">
              {subType === 'cartao' ? 'Número de Parcelas' : 'Parcela'}
            </label>
            <div className="input-group">
                {subType !== 'cartao' && (
                    <input 
                        type="number" 
                        className="form-control"
                        value={formData.parcela_atual}
                        onChange={e => setFormData({...formData, parcela_atual: parseInt(e.target.value)})}
                    />
                )}
                {subType !== 'cartao' && <span className="input-group-text">de</span>}
                <input 
                    type="number" 
                    className="form-control"
                    value={formData.parcela_total}
                    onChange={e => setFormData({...formData, parcela_total: parseInt(e.target.value)})}
                />
            </div>
          </div>

          {subType !== 'cartao' && (
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted text-uppercase mb-1">Status</label>
              <select 
                className="form-select rounded-3"
                value={formData.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, status: e.target.value as Status})}
              >
                <option value="Em aberto">Em aberto</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
          )}

          <div className="col-md-6 d-flex align-items-end">
            <div className="form-check mb-2">
              <input 
                type="checkbox" 
                className="form-check-input"
                id="checkSimulacao"
                checked={formData.simulada}
                onChange={e => setFormData({...formData, simulada: e.target.checked})}
              />
              <label className="form-check-label small fw-bold text-muted text-uppercase" htmlFor="checkSimulacao">Simulação?</label>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="col-md-6">
            <label className="form-label small fw-bold text-muted text-uppercase mb-1">Dia de Receber</label>
            <input 
              type="number" 
              min="1" max="31"
              className="form-control rounded-3"
              value={formData.vencimento.includes('-') ? getDate(parseISO(formData.vencimento)) : formData.vencimento}
              onChange={e => setFormData({...formData, vencimento: e.target.value})}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-bold text-muted text-uppercase mb-1">Recorrência</label>
            <div className="input-group">
                <input 
                    type="number" 
                    className="form-control"
                    value={formData.parcela_total}
                    onChange={e => setFormData({...formData, parcela_total: parseInt(e.target.value)})}
                />
                <span className="input-group-text">Meses</span>
            </div>
          </div>
          <div className="col-12 mt-3">
             <div className="form-check">
              <input 
                type="checkbox" 
                className="form-check-input"
                id="checkSimulacaoReceita"
                checked={formData.simulada}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, simulada: e.target.checked})}
              />
              <label className="form-check-label small fw-bold text-muted text-uppercase" htmlFor="checkSimulacaoReceita">Simulação?</label>
            </div>
          </div>
        </>
      )}

      <div className="col-12 mt-4">
        <button className="btn btn-primary w-100 py-3 fw-bold rounded-pill text-uppercase">
          <i className="fa-solid fa-cloud-arrow-up me-2"></i>Salvar Lançamento
        </button>
      </div>
    </form>
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
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Nome do Titular</label>
        <input 
          required
          type="text" 
          className="form-control rounded-3"
          value={formData.nome}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nome: e.target.value })}
        />
      </div>
      <div className="col-12">
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Foto do Titular</label>
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
      <div className="col-12 mt-4 d-flex gap-3">
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            className="btn btn-outline-secondary w-100 py-3 fw-bold rounded-pill text-uppercase"
          >
            Cancelar
          </button>
        )}
        <button 
            disabled={isUploading}
            className="btn btn-primary w-100 py-3 fw-bold rounded-pill text-uppercase"
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
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Nome do Cartão</label>
        <input 
          required
          type="text" 
          className="form-control rounded-3"
          value={formData.nome_cartao}
          onChange={e => setFormData({...formData, nome_cartao: e.target.value})}
        />
      </div>
      <div className="col-12">
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Titular</label>
        <select 
          className="form-select rounded-3"
          value={formData.titular_id}
          onChange={e => setFormData({...formData, titular_id: parseInt(e.target.value)})}
        >
          {titulares.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
      <div className="col-md-6">
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Dia Vencimento</label>
        <input 
          required
          type="number" 
          min="1" max="31"
          className="form-control rounded-3"
          value={formData.dia_vencimento}
          onChange={e => setFormData({...formData, dia_vencimento: parseInt(e.target.value)})}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Dia Fechamento</label>
        <input 
          required
          type="number" 
          min="1" max="31"
          className="form-control rounded-3"
          value={formData.dia_fechamento}
          onChange={e => setFormData({...formData, dia_fechamento: parseInt(e.target.value)})}
        />
      </div>
      <div className="col-12 mt-4 d-flex gap-3">
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            className="btn btn-outline-secondary w-100 py-3 fw-bold rounded-pill text-uppercase"
          >
            Cancelar
          </button>
        )}
        <button className="btn btn-primary w-100 py-3 fw-bold rounded-pill text-uppercase">
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
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">Selecionar Período</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 text-center">
            <div className="d-flex justify-content-between align-items-center mb-4 bg-light p-2 rounded-3">
              <button 
                type="button"
                className="btn btn-sm btn-white shadow-sm rounded-3 border-0 bg-white" 
                onClick={() => setViewYear((prev: number) => prev - 1)}
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <h4 className="fw-bold m-0">{viewYear}</h4>
              <button 
                type="button"
                className="btn btn-sm btn-white shadow-sm rounded-3 border-0 bg-white" 
                onClick={() => setViewYear((prev: number) => prev + 1)}
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
            <div className="row g-2">
              {meses.map((mes, index) => {
                const monthNum = index + 1;
                const isSelected = monthNum === currentMonth && viewYear === currentYear;
                return (
                  <div key={mes} className="col-4">
                    <button 
                      type="button"
                      className={`btn w-100 py-3 rounded-3 fw-bold transition-all ${isSelected ? 'btn-primary' : 'btn-light'}`}
                      style={{ border: isSelected ? 'none' : '1px solid #eee' }}
                      onClick={() => {
                        onSelect(monthNum, viewYear);
                        onClose();
                      }}
                    >
                      {mes.substring(0, 3)}
                    </button>
                  </div>
                );
              })}
            </div>
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
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Seu Nome</label>
        <input 
          required
          type="text" 
          className="form-control rounded-3"
          value={formData.nome}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nome: e.target.value })}
        />
      </div>
      <div className="col-12">
        <label className="form-label small fw-bold text-muted text-uppercase mb-1">Sua Foto</label>
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
      <div className="col-12 mt-4">
        <button 
            disabled={isUploading}
            className="btn btn-primary w-100 py-3 fw-bold rounded-pill text-uppercase"
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
  const [activeTab, setActiveTab] = useState('geral');
  const [inviteEmail, setInviteEmail] = useState('');
  const [internalView, setInternalView] = useState<'list' | 'add' | 'edit'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);

  // Handle Esc to go back to list if in edit/add mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && internalView !== 'list') {
        e.stopPropagation();
        setInternalView('list');
        setEditingItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [internalView]);

  // Reset internal view when changing tabs
  useEffect(() => {
    setInternalView('list');
    setEditingItem(null);
  }, [activeTab]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'geral', label: 'Geral', icon: 'settings' },
    { id: 'titulares', label: 'Titulares', icon: 'person_add' },
    { id: 'cartoes', label: 'Cartões', icon: 'credit_card' },
    { id: 'familia', label: 'Controle de Dados', icon: 'database' },
    { id: 'notificacoes', label: 'Notificações', icon: 'notifications' },
    { id: 'personalizacao', label: 'Personalização', icon: 'palette' },
    { id: 'billing', label: 'Assinatura', icon: 'payments' },
  ];

    const renderContent = () => {
    switch (activeTab) {
      case 'geral':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <div className="d-flex align-items-center gap-3 mb-2">
                <div className="w-2 h-8 bg-primary rounded-full"></div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight m-0">Geral</h1>
              </div>
              <p className="text-muted-foreground">Personalize a sua experiência e segurança da conta.</p>
            </header>

            {/* Configurações de Tema */}
            <section className="space-y-6">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Aparência do Sistema</h3>
                  <p className="text-muted-foreground small mb-0">Escolha como o sistema deve aparecer no seu dispositivo.</p>
                </div>
              </div>
              
              <div className="row g-4">
                <div className="col-md-6">
                  <div 
                    onClick={() => isDarkMode && toggleDarkMode()}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 p-1 transition-all duration-300 hover:scale-[1.02]",
                      !isDarkMode ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card/50"
                    )}
                  >
                    <div className="aspect-[16/9] rounded-xl bg-slate-100 mb-3 overflow-hidden border border-border/50 relative">
                       {/* Mockup Light Mode */}
                       <div className="absolute inset-0 p-3">
                         <div className="w-full h-4 bg-white rounded shadow-sm mb-2"></div>
                         <div className="row g-2">
                           <div className="col-4"><div className="h-20 bg-white rounded shadow-sm"></div></div>
                           <div className="col-8"><div className="h-20 bg-white rounded shadow-sm"></div></div>
                         </div>
                       </div>
                    </div>
                    <div className="px-3 pb-2 d-flex align-items-center justify-content-between">
                      <span className="font-bold text-sm">Modo Claro</span>
                      {!isDarkMode && <span className="material-symbols-outlined text-primary text-lg">check_circle</span>}
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div 
                    onClick={() => !isDarkMode && toggleDarkMode()}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 p-1 transition-all duration-300 hover:scale-[1.02]",
                      isDarkMode ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card/50"
                    )}
                  >
                    <div className="aspect-[16/9] rounded-xl bg-slate-900 mb-3 overflow-hidden border border-border/50 relative">
                       {/* Mockup Dark Mode */}
                       <div className="absolute inset-0 p-3">
                         <div className="w-full h-4 bg-slate-800 rounded shadow-sm mb-2"></div>
                         <div className="row g-2">
                           <div className="col-4"><div className="h-20 bg-slate-800 rounded shadow-sm"></div></div>
                           <div className="col-8"><div className="h-20 bg-slate-800 rounded shadow-sm"></div></div>
                         </div>
                       </div>
                    </div>
                    <div className="px-3 pb-2 d-flex align-items-center justify-content-between">
                      <span className="font-bold text-sm">Modo Escuro</span>
                      {isDarkMode && <span className="material-symbols-outlined text-primary text-lg">check_circle</span>}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Cor de Destaque */}
            <section className="pt-8 border-top border-border">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground mb-1">Cor de Destaque</h3>
                <p className="text-muted-foreground small mb-0">Personalize a identidade visual do seu painel.</p>
              </div>

              <div className="d-flex align-items-center gap-4 flex-wrap">
                {[
                  { id: 'default', color: '#4361ee', name: 'Indigo' },
                  { id: 'emerald', color: '#10b981', name: 'Emerald' },
                  { id: 'rose', color: '#f43f5e', name: 'Rose' },
                  { id: 'amber', color: '#f59e0b', name: 'Amber' },
                  { id: 'violet', color: '#8b5cf6', name: 'Violet' },
                ].map((c) => (
                  <button 
                    key={c.id}
                    className="group relative d-flex flex-column align-items-center gap-2 border-0 bg-transparent p-0"
                  >
                    <div 
                      className="w-12 h-12 rounded-2xl transition-all duration-300 group-hover:scale-110 shadow-sm border-2"
                      style={{ backgroundColor: c.color, borderColor: c.id === 'default' ? 'var(--primary)' : 'transparent' }}
                    ></div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.name}
                    </span>
                  </button>
                ))}
                
                <button className="w-12 h-12 rounded-2xl bg-muted border border-dashed border-border d-flex align-items-center justify-content-center text-muted-foreground hover:bg-primary/5 hover:border-primary hover:text-primary transition-all">
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </section>

            {/* Security Quick Link */}
            <section className="pt-10">
              <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 d-flex align-items-center justify-content-between overflow-hidden relative">
                <div className="flex-grow-1 relative z-10">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                    <span className="text-xs font-black text-primary uppercase tracking-widest">Segurança Pro</span>
                  </div>
                  <h4 className="text-xl font-bold text-foreground mb-1">Proteja seus dados financeiros</h4>
                  <p className="text-muted-foreground small mb-0 max-w-sm">Ative o 2FA para garantir que só você tenha acesso às suas movimentações bancárias.</p>
                </div>
                <button className="btn btn-primary rounded-pill px-6 py-2 fw-bold text-sm relative z-10 shadow-lg border-0">
                  Configurar MFA
                </button>
                <div className="absolute end-[-20px] bottom-[-20px] opacity-[0.03] rotate-12">
                  <span className="material-symbols-outlined" style={{ fontSize: '180px' }}>shield</span>
                </div>
              </div>
            </section>
          </div>
        );
      case 'titulares':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10 d-flex justify-content-between align-items-center">
              <div>
                <div className="d-flex align-items-center gap-3 mb-2">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h1 className="text-3xl font-bold text-foreground tracking-tight m-0">
                    {internalView === 'list' ? 'Titulares' : internalView === 'add' ? 'Novo Titular' : 'Editar Titular'}
                  </h1>
                </div>
                <p className="text-muted-foreground m-0">
                  {internalView === 'list' ? 'Gerencie as pessoas que possuem contas nesta família.' : 'Preencha os dados abaixo.'}
                </p>
              </div>
              {internalView === 'list' ? (
                <button 
                  onClick={() => { setEditingItem(null); setInternalView('add'); }}
                  className="btn btn-primary rounded-2xl px-6 py-3 fw-bold d-flex align-items-center gap-2 shadow-lg border-0"
                >
                  <span className="material-symbols-outlined">add</span>
                  NOVO
                </button>
              ) : (
                <button 
                  onClick={() => { setInternalView('list'); setEditingItem(null); }}
                  className="btn btn-outline-secondary rounded-2xl px-6 py-3 fw-bold d-flex align-items-center gap-2"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                  VOLTAR
                </button>
              )}
            </header>

            {internalView === 'list' ? (
              <div className="grid gap-4">
                {titulares.map((t) => (
                  <div key={t.id} className="group bg-card hover:bg-muted/30 p-4 rounded-2xl border border-border d-flex align-items-center justify-content-between transition-all duration-300">
                    <div className="d-flex align-items-center gap-4">
                      <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-border shadow-sm">
                        <Image
                          src={t.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nome)}&background=random&color=fff&bold=true`}
                          fill
                          unoptimized
                          className="object-fit-cover"
                          alt={t.nome}
                        />
                      </div>
                      <div>
                        <div className="fw-bold text-foreground text-lg tracking-tight leading-tight">{t.nome}</div>
                        <div className="d-flex align-items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary fw-bold text-[10px] uppercase tracking-wider">Titular Principal</span>
                          <span className="text-muted-foreground text-[10px] opacity-60 uppercase font-bold tracking-tighter">ID: #{t.id}</span>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                       <button onClick={() => { setEditingItem(t); setInternalView('edit'); }} className="btn-icon rounded-xl hover:bg-primary/10 transition-colors"><span className="material-symbols-outlined text-[20px] text-edit-blue">edit</span></button>
                       <button onClick={() => onDeleteTitular(t.id)} className="btn-icon rounded-xl hover:bg-danger/10 transition-colors"><span className="material-symbols-outlined text-[20px] text-delete-red">delete</span></button>
                    </div>
                  </div>
                ))}
                
                {titulares.length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl opacity-40">
                    <span className="material-symbols-outlined text-[48px] mb-4">person_off</span>
                    <p className="fw-bold text-uppercase tracking-widest text-sm">Nenhum titular cadastrado</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card p-6 rounded-3xl border border-border shadow-sm border-dashed">
                <TitularForm 
                  initialData={editingItem} 
                  onCancel={() => { setInternalView('list'); setEditingItem(null); }}
                  onSubmit={(data) => {
                    if (editingItem) onUpdateTitular(editingItem.id, data);
                    else onAddTitular(data);
                    setInternalView('list');
                    setEditingItem(null);
                  }} 
                />
              </div>
            )}
          </div>
        );
      case 'cartoes':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10 d-flex justify-content-between align-items-center">
              <div>
                <div className="d-flex align-items-center gap-3 mb-2">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h1 className="text-3xl font-bold text-foreground tracking-tight m-0">
                    {internalView === 'list' ? 'Cartões' : internalView === 'add' ? 'Novo Cartão' : 'Editar Cartão'}
                  </h1>
                </div>
                <p className="text-muted-foreground m-0">
                  {internalView === 'list' ? 'Configure e gerencie seus cartões de crédito.' : 'Preencha os dados abaixo.'}
                </p>
              </div>
              {internalView === 'list' ? (
                <button 
                  onClick={() => { setEditingItem(null); setInternalView('add'); }}
                  className="btn btn-primary rounded-2xl px-6 py-3 fw-bold d-flex align-items-center gap-2 shadow-lg border-0"
                >
                  <span className="material-symbols-outlined">add_card</span>
                  NOVO
                </button>
              ) : (
                <button 
                  onClick={() => { setInternalView('list'); setEditingItem(null); }}
                  className="btn btn-outline-secondary rounded-2xl px-6 py-3 fw-bold d-flex align-items-center gap-2"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                  VOLTAR
                </button>
              )}
            </header>

            {internalView === 'list' ? (
              <div className="row g-4 overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: '600px' }}>
                {cartoes.map((c) => {
                  const titular = titulares.find(t => t.id === c.titular_id);
                  return (
                    <div key={c.id} className="col-md-6 mb-2">
                      <div className="group bg-card hover:bg-muted/30 p-5 rounded-[1.5rem] border border-border transition-all duration-300 relative overflow-hidden">
                        <div className="d-flex justify-content-between align-items-start relative z-10">
                          <div className="d-flex align-items-center gap-4">
                            {getCardLogo(c.nome_cartao)}
                            <div className="overflow-hidden">
                              <div className="fw-bold text-foreground tracking-tight m-0 text-truncate">{c.nome_cartao}</div>
                              <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">
                                {titular?.nome || 'Personal'}
                              </div>
                            </div>
                          </div>
                          <div className="d-flex gap-1">
                            <button onClick={() => { setEditingItem(c); setInternalView('edit'); }} className="btn-icon rounded-lg hover:bg-primary/10 transition-colors"><span className="material-symbols-outlined text-[18px] text-edit-blue">edit</span></button>
                            <button onClick={() => onDeleteCartao(c.id)} className="btn-icon rounded-lg hover:bg-danger/10 transition-colors"><span className="material-symbols-outlined text-[18px] text-delete-red">delete</span></button>
                          </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-top border-border/50 d-flex gap-4 relative z-10">
                        <div>
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0 opacity-50">Vencimento</p>
                          <p className="text-xs font-bold text-foreground m-0">Dia {c.dia_vencimento}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0 opacity-50">Fechamento</p>
                          <p className="text-xs font-bold text-foreground m-0">Dia {c.dia_fechamento}</p>
                        </div>
                      </div>

                      {/* Decoração sutil de cartão */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              <div className="bg-card p-6 rounded-3xl border border-border shadow-sm border-dashed">
                <CartaoForm 
                  initialData={editingItem} 
                  titulares={titulares}
                  onCancel={() => { setInternalView('list'); setEditingItem(null); }}
                  onSubmit={(data) => {
                    if (editingItem) onUpdateCartao(editingItem.id, data);
                    else onAddCartao(data);
                    setInternalView('list');
                    setEditingItem(null);
                  }} 
                />
              </div>
            )}
          </div>
        );
      case 'familia':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <div className="d-flex align-items-center gap-3 mb-2">
                <div className="w-2 h-8 bg-primary rounded-full"></div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight m-0">Família</h1>
              </div>
              <p className="text-muted-foreground">Gerencie os membros que compartilham este painel com você.</p>
            </header>

            {userType === 'titular' && (
              <section className="bg-primary/5 border border-primary/20 rounded-3xl p-6 relative overflow-hidden mb-10">
                 <div className="relative z-10 w-100">
                   <h4 className="text-foreground font-bold text-lg mb-1">Convidar por E-mail</h4>
                   <p className="text-muted-foreground small mb-4">Envie um convite para um novo membro se juntar à sua família.</p>
                   <div className="d-flex gap-2">
                     <div className="flex-grow-1 position-relative">
                       <input 
                          type="email" 
                          className="form-control bg-card border border-border text-foreground rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                          placeholder="exemplo@email.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                       />
                       <span className="material-symbols-outlined position-absolute end-0 top-50 translate-middle-y me-4 text-muted opacity-30">mail</span>
                     </div>
                     <button 
                        className="px-8 rounded-2xl btn btn-primary fw-bold text-sm text-uppercase border-0 shadow-lg"
                        onClick={() => { onInvite(inviteEmail); setInviteEmail(''); }}
                     >
                       Convidar
                     </button>
                   </div>
                 </div>
                 <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
              </section>
            )}

            <div className="grid gap-3">
              {familyMembers.map((member) => (
                <div key={member.id} className="bg-card p-4 rounded-2xl border border-border d-flex align-items-center justify-content-between transition-all hover:bg-muted/20">
                  <div className="d-flex align-items-center gap-4">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm">
                      <Image
                        src={member.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.nome)}&background=random&color=fff&bold=true`}
                        fill
                        unoptimized
                        className="object-fit-cover"
                        alt={member.nome}
                      />
                    </div>
                    <div>
                      <div className="fw-bold text-foreground text-base tracking-tight leading-tight">{member.nome}</div>
                      <div className="text-muted-foreground text-xs opacity-60">@{member.email.split('@')[0]}</div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      member.tipo === 'titular' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {member.tipo === 'titular' ? 'Admin' : 'Membro'}
                    </span>
                    {userType === 'titular' && member.email !== user?.email && (
                      <button className="btn-icon rounded-xl hover:bg-danger/10 hover:text-danger text-muted-foreground transition-all">
                        <span className="material-symbols-outlined text-[18px]">person_remove</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center opacity-30 text-foreground">
            <span className="material-symbols-outlined text-[120px] mb-8">construction</span>
            <h3 className="fw-bold h2 tracking-tighter">Em breve</h3>
            <p className="fs-5 tracking-widest text-uppercase">Esta seção está sendo preparada.</p>
          </div>
        );
    }
  };

  return (
    <div className="modal fade show d-block settings-modal-custom" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
        <div className="modal-content border-0 shadow-2xl overflow-hidden rounded-[2rem] bg-card" style={{ height: '870px' }}>
          <div className="d-flex h-100 flex-column flex-md-row">
            {/* SideNavBar Interna */}
            <aside className="bg-muted/20 border-end border-border d-flex flex-column h-full py-6 flex-shrink-0" style={{ width: '240px' }}>
              <div className="px-6 mb-8 mt-2">
                <h2 className="text-foreground fw-bold h4 m-0 tracking-tighter text-uppercase">Definições</h2>
                <p className="text-muted-foreground m-0 tracking-widest text-uppercase mt-1" style={{ fontSize: '9px', fontWeight: 'bold' }}>Preferências</p>
              </div>

              <nav className="flex-fill space-y-1 px-4 overflow-auto mt-2">
                {tabs.map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    className={cn(
                      "w-100 d-flex align-items-center gap-3 px-4 py-3 border-0 transition-all duration-300 rounded-xl mb-1",
                      activeTab === tab.id 
                        ? "bg-primary text-white shadow-lg shadow-primary/20" 
                        : "bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                    style={{ fontSize: '10px', textAlign: 'left' }}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                    <span className="font-bold tracking-widest text-uppercase">{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="px-6 mt-auto pt-6 border-top border-border">
                <div className="d-flex align-items-center gap-3">
                  <div className="w-10 h-10 rounded-circle bg-primary/10 d-flex align-items-center justify-content-center border border-primary/20 shadow-sm flex-shrink-0">
                    {user?.foto ? (
                      <Image src={user.foto} width={40} height={40} className="rounded-circle object-cover" unoptimized alt={user.nome} />
                    ) : (
                      <span className="material-symbols-outlined text-primary opacity-80" style={{ fontSize: '18px' }}>person</span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-foreground fw-bold extra-small text-truncate" style={{ fontSize: '12px' }}>{user?.nome || 'Usuário'}</div>
                    <div className="text-muted-foreground text-uppercase tracking-widest" style={{ fontSize: '8px', fontWeight: 'bold' }}>
                      {user?.tipo === 'titular' ? 'Admin' : 'Membro'}
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-fill overflow-auto p-5 p-md-10 bg-background custom-scrollbar">
              <div className="max-w-4xl h-100 d-flex flex-column">
                <div className="flex-fill">
                  {renderContent()}
                </div>
                
                <footer className="mt-16 pt-8 border-top border-border d-flex justify-content-end gap-6 pb-6">
                  <button type="button" className="px-10 py-3 rounded-pill btn btn-light border-0 fw-bold text-sm text-uppercase tracking-wide transition-colors" onClick={onClose}>
                    Fechar
                  </button>
                </footer>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
