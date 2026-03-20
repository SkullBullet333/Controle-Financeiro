'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Titular, Status, Despesa, Receita, CartaoConfig } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { calcularCompetencia, calcularCompetenciaReceita, ajustarDataReceita, calcularCompetenciaCartao } from '@/lib/finance-service';
import { parseISO, format, getDate } from 'date-fns';
import { categorizar } from '@/lib/categories-utils';
import { useEffect } from 'react';

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
