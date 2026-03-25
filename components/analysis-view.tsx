'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface ProjecaoMes {
  competencia: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface AnalysisPlanProps {
  projecao: ProjecaoMes[];
}

export function AnalysisPlan({ projecao }: AnalysisPlanProps) {
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

  const getMonthName = (comp: string) => {
    const [m, y] = comp.split('/');
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="bg-card rounded-4 border border-border shadow-sm overflow-hidden mb-4">
      <div className="p-4 border-b border-border d-flex justify-content-between align-items-center bg-light bg-opacity-30">
        <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
          <Calendar className="text-primary" /> Análise de Projeção (8 Meses)
        </h5>
        <span className="badge bg-primary rounded-pill px-3 py-2 small fw-bold uppercase tracking-wider">Simulado</span>
      </div>
      
      <div className="overflow-x-auto">
        <div className="d-flex p-4 gap-3 min-w-max" style={{ minWidth: 'fit-content' }}>
          {projecao.map((mes, idx) => (
            <div 
              key={mes.competencia} 
              className={cn(
                "flex-shrink-0 rounded-4 p-3 border transition-all hover:scale-105",
                idx === 0 ? "border-primary bg-primary bg-opacity-10 shadow-sm" : "border-border bg-transparent"
              )}
              style={{ width: '200px' }}
            >
              <div className="text-center mb-2">
                <span className={cn(
                  "small fw-black uppercase tracking-widest",
                  idx === 0 ? "text-primary" : "text-muted"
                )}>
                  {getMonthName(mes.competencia)}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-muted" style={{ fontSize: '0.75rem' }}>Receitas</span>
                  <span className="fw-bold text-success" style={{ fontSize: '0.85rem' }}>{formatCurrency(mes.receitas)}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-muted" style={{ fontSize: '0.75rem' }}>Despesas</span>
                  <span className="fw-bold text-danger" style={{ fontSize: '0.85rem' }}>{formatCurrency(mes.despesas)}</span>
                </div>
                <hr className="my-2 border-border opacity-50" />
                <div className="text-center">
                  <div className="small text-muted mb-1" style={{ fontSize: '0.75rem' }}>Saldo Previsto</div>
                  <div className={cn(
                    "h3 fw-black mb-0 d-flex align-items-center justify-content-center gap-1",
                    mes.saldo >= 0 ? "text-success" : "text-danger"
                  )}>
                    {mes.saldo >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    <span style={{ fontSize: '1.2rem' }}>{formatCurrency(mes.saldo)}</span>
                  </div>
                </div>
              </div>
              
              {/* Removed Mês Atual badge */}
            </div>
          ))}
        </div>
      </div>
      
      <div className="px-4 py-3 bg-light bg-opacity-30 border-t border-border">
        <p className="text-muted small italic m-0">
          * A projeção considera receitas e despesas fixas recorrentes e faturas de cartão já lançadas para os próximos períodos.
        </p>
      </div>
    </div>
  );
}
