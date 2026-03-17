'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Titular, Categoria, Status } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function FinanceForm({ 
  type, 
  onSubmit, 
  titulares, 
  categorias,
  cartoes,
  competencia,
  initialData
}: { 
  type: 'despesa' | 'receita', 
  onSubmit: (data: any) => void,
  titulares: Titular[],
  categorias: Categoria[],
  cartoes: any[],
  competencia: string,
  initialData?: any
}) {
  const [formData, setFormData] = useState({
    descricao: initialData?.descricao || '',
    valor: initialData?.valor?.toString() || '',
    titular_id: (initialData?.titular_id !== undefined && !isNaN(initialData.titular_id)) ? initialData.titular_id : (titulares[0]?.id || 0),
    categoria_id: (initialData?.categoria_id !== undefined && !isNaN(initialData.categoria_id)) ? initialData.categoria_id : (categorias[0]?.id || 0),
    vencimento: initialData?.vencimento || initialData?.data_recebimento || new Date().toISOString().split('T')[0],
    status: initialData?.status || ('Em aberto' as Status),
    parcela_atual: (initialData?.parcela_atual !== undefined && !isNaN(initialData.parcela_atual)) ? initialData.parcela_atual : 1,
    parcela_total: (initialData?.parcela_total !== undefined && !isNaN(initialData.parcela_total)) ? initialData.parcela_total : 1,
    cartao_vencimento_id: initialData?.cartao_vencimento_id || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const valor = parseFloat(formData.valor);
    if (isNaN(valor)) {
      alert('Por favor, insira um valor válido.');
      return;
    }

    const data: any = {
      descricao: formData.descricao,
      valor: valor,
      titular_id: formData.titular_id && formData.titular_id !== 0 ? formData.titular_id : null,
      competencia,
      simulada: false,
    };

    if (type === 'despesa') {
      data.categoria_id = formData.categoria_id && formData.categoria_id !== 0 ? formData.categoria_id : null;
      data.vencimento = formData.vencimento;
      data.status = formData.status;
      data.parcela_atual = parseInt(formData.parcela_atual.toString()) || 1;
      data.parcela_total = parseInt(formData.parcela_total.toString()) || 1;
      data.cartao_vencimento_id = formData.cartao_vencimento_id ? parseInt(formData.cartao_vencimento_id as string) : null;
    } else {
      data.data_recebimento = formData.vencimento;
    }

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Descrição</label>
        <input 
          required
          type="text" 
          className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
          value={formData.descricao}
          onChange={e => setFormData({...formData, descricao: e.target.value})}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Valor</label>
          <input 
            required
            type="number" 
            step="0.01"
            className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
            value={formData.valor}
            onChange={e => setFormData({...formData, valor: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Titular</label>
          <select 
            className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
            value={formData.titular_id}
            onChange={e => setFormData({...formData, titular_id: parseInt(e.target.value)})}
          >
            {titulares.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
      </div>
      {type === 'despesa' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Categoria</label>
              <select 
                className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
                value={formData.categoria_id}
                onChange={e => setFormData({...formData, categoria_id: parseInt(e.target.value)})}
              >
                {categorias.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Cartão (Opcional)</label>
              <select 
                className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
                value={formData.cartao_vencimento_id}
                onChange={e => setFormData({...formData, cartao_vencimento_id: e.target.value})}
              >
                <option value="">Nenhum</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome_cartao}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Vencimento</label>
              <input 
                type="date" 
                className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
                value={formData.vencimento}
                onChange={e => setFormData({...formData, vencimento: e.target.value})}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  checked={formData.status === 'Pago'}
                  onChange={e => setFormData({...formData, status: e.target.checked ? 'Pago' : 'Em aberto'})}
                />
                <span className="text-xs font-bold text-gray uppercase tracking-widest">Já está pago?</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Parcela Atual</label>
              <input 
                type="number" 
                className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
                value={formData.parcela_atual}
                onChange={e => setFormData({...formData, parcela_atual: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Total Parcelas</label>
              <input 
                type="number" 
                className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
                value={formData.parcela_total}
                onChange={e => setFormData({...formData, parcela_total: parseInt(e.target.value)})}
              />
            </div>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Data Recebimento</label>
          <input 
            type="date" 
            className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
            value={formData.vencimento}
            onChange={e => setFormData({...formData, vencimento: e.target.value})}
          />
        </div>
      )}
      <button className="w-full bg-primary text-white py-4 rounded-xl font-black shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all active:scale-95 mt-4">
        Salvar Lançamento
      </button>
    </form>
  );
}

export function TitularForm({ 
  onSubmit, 
  initialData 
}: { 
  onSubmit: (data: any) => void, 
  initialData?: any 
}) {
  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    foto: initialData?.foto || ''
  });
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      
      // Fallback to base64 with Promise to ensure loading state is handled correctly
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, foto: reader.result as string }));
          resolve();
        };
        reader.readAsDataURL(file);
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...formData, foto: formData.foto || `https://i.pravatar.cc/150?u=${formData.nome}` }); }} className="space-y-4">
      <div>
        <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Nome do Titular</label>
        <input 
          required
          type="text" 
          className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
          value={formData.nome}
          onChange={e => setFormData({ ...formData, nome: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Foto do Titular</label>
        <div className="flex items-center gap-4 p-3 bg-bg border border-border rounded-xl">
          <div className="relative w-12 h-12 bg-gray-100 rounded-full overflow-hidden border border-border flex-shrink-0">
            {formData.foto ? (
              <Image 
                src={formData.foto} 
                alt="Preview" 
                fill 
                className="object-cover" 
                unoptimized
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <X size={20} />
              </div>
            )}
          </div>
          <div className="flex-1">
            <input 
              type="file" 
              accept="image/*"
              className="hidden" 
              id="foto-upload"
              onChange={handleFileChange}
            />
            <label 
              htmlFor="foto-upload"
              className="inline-block px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-lg cursor-pointer hover:bg-primary/20 transition-all"
            >
              {isUploading ? 'Processando...' : 'Escolher Foto'}
            </label>
            <p className="text-[10px] text-gray mt-1">PNG, JPG ou GIF (Máx. 1MB)</p>
          </div>
        </div>
      </div>
      <button 
        disabled={isUploading}
        className="w-full bg-primary text-white py-4 rounded-xl font-black shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all active:scale-95 mt-4 disabled:opacity-50"
      >
        Salvar Titular
      </button>
    </form>
  );
}

export function CartaoForm({ 
  onSubmit, 
  titulares,
  initialData 
}: { 
  onSubmit: (data: any) => void, 
  titulares: Titular[],
  initialData?: any 
}) {
  const [formData, setFormData] = useState({
    nome_cartao: initialData?.nome_cartao || '',
    titular_id: (initialData?.titular_id !== undefined && !isNaN(initialData.titular_id)) ? initialData.titular_id : (titulares[0]?.id || 0),
    dia_vencimento: (initialData?.dia_vencimento !== undefined && !isNaN(initialData.dia_vencimento)) ? initialData.dia_vencimento : 10,
    dia_fechamento: (initialData?.dia_fechamento !== undefined && !isNaN(initialData.dia_fechamento)) ? initialData.dia_fechamento : 10
  });

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
      <div>
        <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Nome do Cartão</label>
        <input 
          required
          type="text" 
          className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
          value={formData.nome_cartao}
          onChange={e => setFormData({...formData, nome_cartao: e.target.value})}
        />
      </div>
      <div>
        <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Titular</label>
        <select 
          className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
          value={formData.titular_id}
          onChange={e => setFormData({...formData, titular_id: parseInt(e.target.value)})}
        >
          {titulares.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Dia Vencimento</label>
          <input 
            required
            type="number" 
            min="1" max="31"
            className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
            value={formData.dia_vencimento}
            onChange={e => setFormData({...formData, dia_vencimento: parseInt(e.target.value)})}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Dias p/ Fechamento</label>
          <input 
            required
            type="number" 
            min="1" max="31"
            className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
            value={formData.dia_fechamento}
            onChange={e => setFormData({...formData, dia_fechamento: parseInt(e.target.value)})}
          />
        </div>
      </div>
      <button className="w-full bg-primary text-white py-4 rounded-xl font-black shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all active:scale-95 mt-4">
        Salvar Cartão
      </button>
    </form>
  );
}

export function CategoriaForm({ 
  onSubmit, 
  initialData 
}: { 
  onSubmit: (data: any) => void, 
  initialData?: any 
}) {
  const [formData, setFormData] = useState({
    label: initialData?.label || '',
    keywords: initialData?.keywords || ''
  });

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
      <div>
        <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Nome da Categoria</label>
        <input 
          required
          type="text" 
          className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
          value={formData.label}
          onChange={e => setFormData({...formData, label: e.target.value})}
        />
      </div>
      <div>
        <label className="block text-[10px] font-black text-gray uppercase tracking-widest mb-1">Palavras-chave (separadas por vírgula)</label>
        <input 
          required
          type="text" 
          className="w-full p-3 bg-bg border border-border rounded-xl focus:border-primary focus:outline-none font-bold"
          value={formData.keywords}
          onChange={e => setFormData({...formData, keywords: e.target.value})}
        />
      </div>
      <button className="w-full bg-primary text-white py-4 rounded-xl font-black shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all active:scale-95 mt-4">
        Salvar Categoria
      </button>
    </form>
  );
}
