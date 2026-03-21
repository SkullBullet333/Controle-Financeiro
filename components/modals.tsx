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
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 shadow-lg animate-in zoom-in-95 duration-200">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">{title}</h5>
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
  initialData 
}: { 
  onSubmit: (data: Omit<Titular, 'id'>) => void, 
  initialData?: Titular 
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
      <div className="col-12 mt-4">
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
  initialData 
}: { 
  onSubmit: (data: Omit<CartaoConfig, 'id'>) => void, 
  titulares: Titular[],
  initialData?: CartaoConfig 
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
      <div className="col-12 mt-4">
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
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 shadow-lg p-2">
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
  onAddTitular: () => void,
  onUpdateTitular: (t: Titular) => void,
  onDeleteTitular: (id: number) => void,
  onAddCartao: () => void,
  onUpdateCartao: (c: CartaoConfig) => void,
  onDeleteCartao: (id: number) => void
}) {
  const [activeTab, setActiveTab] = useState('geral');
  const [inviteEmail, setInviteEmail] = useState('');

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
          <div className="space-y-12 animate-in fade-in duration-500">
            <header className="mb-12">
              <h1 className="text-4xl font-headline font-bold text-foreground tracking-tighter mb-2">Geral</h1>
              <p className="text-muted-foreground text-lg">Personalize a sua experiência e segurança da conta.</p>
            </header>

            {/* Security Banner */}
            <div className="relative group mb-12 overflow-hidden rounded-2xl bg-primary/5 p-4 d-flex flex-column md:flex-row items-center justify-between border border-primary/10">
              <div className="d-flex align-items-center gap-6 relative z-10 w-100">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 d-flex align-items-center justify-content-center border border-primary/20" style={{ minWidth: '64px' }}>
                  <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
                </div>
                <div className="flex-grow-1">
                  <h3 className="text-xl fw-bold text-foreground mb-1">Torne a sua conta segura</h3>
                  <p className="text-muted small mb-0">Adicione uma camada extra de proteção ao configurar a autenticação de dois fatores.</p>
                </div>
                <button className="btn btn-primary text-white fw-bold text-sm tracking-wide text-uppercase rounded-pill px-5 shadow-lg border-0">
                  Configurar MFA
                </button>
              </div>
            </div>

            {/* Settings Grid */}
            <div className="space-y-12">
              {/* Aspeto */}
              <section className="row g-4 align-items-start">
                <div className="col-md-4">
                  <h4 className="text-foreground fw-bold text-sm text-uppercase tracking-widest mb-1">Aspeto</h4>
                  <p className="text-muted small">Escolha como o sistema deve aparecer no seu dispositivo.</p>
                </div>
                <div className="col-md-8">
                  <div className="position-relative">
                    <select 
                      className="form-select bg-muted border-0 text-foreground py-4 px-6 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer shadow-sm"
                      value={isDarkMode ? 'dark' : 'light'}
                      onChange={(e) => {
                        if ((e.target.value === 'dark' && !isDarkMode) || (e.target.value === 'light' && isDarkMode)) {
                          toggleDarkMode();
                        }
                      }}
                    >
                      <option value="system">Sistema</option>
                      <option value="dark">Modo Escuro</option>
                      <option value="light">Modo Claro</option>
                    </select>
                    <span className="material-symbols-outlined position-absolute end-0 top-50 translate-middle-y me-4 pointer-events-none text-muted">expand_more</span>
                  </div>
                </div>
              </section>

              {/* Cor de Destaque */}
              <section className="row g-4 align-items-start pt-5 border-top border-border">
                <div className="col-md-4">
                  <h4 className="text-foreground fw-bold text-sm text-uppercase tracking-widest mb-1">Cor de destaque</h4>
                  <p className="text-muted small">A cor principal usada em botões, links e estados ativos.</p>
                </div>
                <div className="col-md-8">
                  <div className="d-flex flex-wrap gap-4 p-2 bg-muted rounded-4 border border-border">
                    <button type="button" className="w-100 h-10 w-10 h-10 rounded-circle border-4 border-white bg-white transition-transform hover:scale-110 shadow-sm"></button>
                    <button type="button" className="w-10 h-10 rounded-circle border-2 border-transparent bg-primary transition-transform hover:scale-110 shadow-sm"></button>
                    <button type="button" className="w-10 h-10 rounded-circle border-2 border-transparent bg-info transition-transform hover:scale-110 shadow-sm"></button>
                    <button type="button" className="w-10 h-10 rounded-circle border-2 border-transparent bg-warning transition-transform hover:scale-110 shadow-sm"></button>
                    <button type="button" className="w-10 h-10 rounded-circle border-2 border-border bg-background transition-transform hover:scale-110 d-flex align-items-center justify-content-center">
                      <span className="material-symbols-outlined text-sm text-foreground">colorize</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      case 'titulares':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <header className="mb-12 d-flex justify-content-between align-items-end">
              <div>
                <h1 className="text-4xl font-headline font-bold text-foreground tracking-tighter mb-2">Titulares</h1>
                <p className="text-muted-foreground text-lg">Gerencie as pessoas que possuem contas e cartões nesta família.</p>
              </div>
              <button 
                onClick={onAddTitular}
                className="btn btn-primary rounded-pill px-6 py-3 fw-bold d-flex align-items-center gap-2 shadow-lg"
              >
                <span className="material-symbols-outlined">person_add</span>
                NOVO TITULAR
              </button>
            </header>

            <div className="row g-6">
              {titulares.map((t) => (
                <div key={t.id} className="col-md-6 mb-4">
                  <div className="bg-card p-6 rounded-2xl border border-border d-flex align-items-center justify-content-between transition-all shadow-sm hover:shadow-md">
                    <div className="d-flex align-items-center gap-6">
                      <div className="position-relative" style={{ width: '64px', height: '64px' }}>
                        <Image
                          src={t.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nome)}&background=random&color=fff&bold=true`}
                          fill
                          unoptimized
                          className="rounded-circle object-fit-cover ring-2 ring-primary/20"
                          alt={t.nome}
                        />
                      </div>
                      <div>
                        <div className="fw-bold text-foreground text-xl tracking-tight">{t.nome}</div>
                        <div className="text-muted text-sm opacity-60">ID: #{t.id}</div>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                       <button onClick={() => onUpdateTitular(t)} className="btn btn-icon btn-light rounded-circle"><i className="fa-solid fa-pen"></i></button>
                       <button onClick={() => onDeleteTitular(t.id)} className="btn btn-icon btn-light text-danger rounded-circle"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'cartoes':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <header className="mb-12 d-flex justify-content-between align-items-end">
              <div>
                <h1 className="text-4xl font-headline font-bold text-foreground tracking-tighter mb-2">Cartões</h1>
                <p className="text-muted-foreground text-lg">Configure os cartões de crédito da família.</p>
              </div>
              <button 
                onClick={onAddCartao}
                className="btn btn-primary rounded-pill px-6 py-3 fw-bold d-flex align-items-center gap-2 shadow-lg"
              >
                <span className="material-symbols-outlined">credit_card</span>
                NOVO CARTÃO
              </button>
            </header>

            <div className="row g-6">
              {cartoes.map((c) => {
                const titular = titulares.find(t => t.id === c.titular_id);
                return (
                  <div key={c.id} className="col-md-6 mb-4">
                    <div className="bg-card p-6 rounded-2xl border border-border d-flex align-items-center justify-content-between transition-all shadow-sm hover:shadow-md">
                      <div className="d-flex align-items-center gap-6">
                        <div className="w-16 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-focus d-flex align-items-center justify-content-center text-white">
                          <i className="fa-solid fa-credit-card fa-xl"></i>
                        </div>
                        <div>
                          <div className="fw-bold text-foreground text-xl tracking-tight">{c.nome_cartao}</div>
                          <div className="text-muted text-sm opacity-80">
                            {titular?.nome || 'Sem titular'} • Fechamento: {c.dia_fechamento} • Vencimento: {c.dia_vencimento}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                         <button onClick={() => onUpdateCartao(c)} className="btn btn-icon btn-light rounded-circle"><i className="fa-solid fa-pen"></i></button>
                         <button onClick={() => onDeleteCartao(c.id)} className="btn btn-icon btn-light text-danger rounded-circle"><i className="fa-solid fa-trash"></i></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'familia':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <header className="mb-12">
              <h1 className="text-4xl font-headline font-bold text-foreground tracking-tighter mb-2">Controlos de dados</h1>
              <p className="text-muted-foreground text-lg">Gerencie quem compartilha a conta com você e como os dados são acessados.</p>
            </header>

            {userType === 'titular' && (
              <div className="relative group mb-12 overflow-hidden rounded-2xl bg-muted p-6 border border-border shadow-sm">
                 <h4 className="text-foreground fw-bold text-sm text-uppercase tracking-widest mb-4">Convidar Membro</h4>
                 <div className="d-flex gap-3">
                   <input 
                      type="email" 
                      className="form-control bg-background border border-border text-foreground rounded-xl px-6 py-4" 
                      placeholder="E-mail da pessoa"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                   />
                   <button 
                      className="px-8 rounded-xl btn btn-primary fw-bold text-sm text-uppercase border-0 shadow-lg"
                      onClick={() => { onInvite(inviteEmail); setInviteEmail(''); }}
                   >
                     Enviar
                   </button>
                 </div>
              </div>
            )}

            <div className="row g-6">
              {familyMembers.map((member) => (
                <div key={member.id} className="col-md-6 mb-4">
                  <div className="bg-card p-6 rounded-2xl border border-border d-flex align-items-center justify-content-between transition-all shadow-sm">
                    <div className="d-flex align-items-center gap-6">
                      <div className="position-relative" style={{ width: '64px', height: '64px' }}>
                        <Image
                          src={member.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.nome)}&background=random&color=fff&bold=true`}
                          fill
                          unoptimized
                          className="rounded-circle object-fit-cover ring-2 ring-primary/20"
                          alt={member.nome}
                        />
                      </div>
                      <div>
                        <div className="fw-bold text-foreground text-xl tracking-tight">{member.nome}</div>
                        <div className="text-muted text-sm opacity-60">@{member.email.split('@')[0]}</div>
                      </div>
                    </div>
                    <span className={cn(
                      "badge rounded-pill shadow-sm px-4 py-2 border",
                      member.tipo === 'titular' ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border"
                    )} style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {member.tipo === 'titular' ? 'Titular' : 'Membro'}
                    </span>
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
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 2000 }} onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
        <div className="modal-content border-0 shadow-2xl overflow-hidden rounded-[2rem] bg-card" style={{ height: '870px' }}>
          <div className="d-flex h-100 flex-column flex-md-row">
            {/* SideNavBar Interna */}
            <aside className="w-100 w-md-72 bg-muted/30 border-end border-border d-flex flex-column h-full py-5">
              <div className="px-8 mb-10 mt-3">
                <h2 className="text-foreground fw-bold h3 m-0 tracking-tighter text-uppercase">Definições</h2>
                <p className="text-muted-foreground small m-0 tracking-widest text-uppercase mt-2" style={{ fontSize: '10px', fontWeight: 'bold' }}>Gerencie suas preferências</p>
              </div>

              <nav className="flex-fill space-y-1 px-4 overflow-auto mt-4">
                {tabs.map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    className={cn(
                      "w-100 d-flex align-items-center gap-4 px-5 py-4 border-0 transition-all duration-300 text-uppercase tracking-widest fw-bold",
                      activeTab === tab.id 
                        ? "bg-primary/10 text-primary border-start border-primary border-4" 
                        : "bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                    style={{ fontSize: '11px', textAlign: 'left' }}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                    <span className="font-label tracking-widest">{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="px-8 mt-auto pt-8 border-top border-border">
                <div className="d-flex align-items-center gap-4">
                  <div className="w-12 h-12 rounded-circle bg-primary/10 d-flex align-items-center justify-content-center border border-primary/20 shadow-sm" style={{ width: '40px', height: '40px' }}>
                    {user?.foto ? (
                      <Image src={user.foto} fill className="rounded-circle object-cover" unoptimized alt={user.nome} />
                    ) : (
                      <span className="material-symbols-outlined text-primary opacity-80">person</span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-foreground fw-bold small text-truncate">{user?.nome || 'Usuário'}</div>
                    <div className="text-muted-foreground text-uppercase tracking-widest" style={{ fontSize: '9px', fontWeight: 'bold' }}>
                      {user?.tipo === 'titular' ? 'Pro Member' : 'Family Member'}
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
