'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface ProjecaoMes {
  competencia: string;
  receitas: number;
  despesas: number;
  faturas: number;
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
          <Calendar className="text-primary" /> Análise de Projeção
        </h5>

      </div>

      <div className="overflow-x-auto no-scrollbar">
        <div className="d-flex flex-nowrap p-3 p-md-4 gap-2">
          {projecao.map((mes, idx) => (
            <div
              key={mes.competencia}
              className={cn(
                "flex-fill rounded-4 p-2 p-md-3 border transition-all hover:scale-105",
                idx === 0 ? "border-blue-300 bg-primary bg-opacity-10 shadow-sm" : "border-border bg-transparent"
              )}
              style={{ minWidth: '130px', flexBasis: '0', borderColor: idx === 0 ? '#738cff' : undefined }}
            >
              <div className="text-center mb-2">
                <span className={cn(
                  "fw-bold uppercase tracking-widest",
                  idx === 0 ? "text-blue-400" : "text-dark"
                )} style={{ fontSize: '0.9rem', fontWeight: 800, color: idx === 0 ? '#738cff' : undefined }}>
                  {getMonthName(mes.competencia)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-muted" style={{ fontSize: '0.65rem' }}>Receitas</span>
                  <span className="fw-bold text-success" style={{ fontSize: '0.75rem' }}>{formatCurrency(mes.receitas)}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-muted" style={{ fontSize: '0.65rem' }}>Faturas</span>
                  <span className="fw-bold text-danger" style={{ fontSize: '0.75rem' }}>{formatCurrency(mes.faturas)}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-muted" style={{ fontSize: '0.65rem' }}>Despesas</span>
                  <span className="fw-bold text-danger" style={{ fontSize: '0.75rem' }}>{formatCurrency(mes.despesas)}</span>
                </div>
                <hr className="my-1 border-border opacity-50" />
                <div className="text-center">
                  <div className="small text-muted mb-0" style={{ fontSize: '0.65rem' }}>Saldo Previsto</div>
                  <div className={cn(
                    "fw-black mb-0 d-flex align-items-center justify-content-center gap-1",
                    mes.saldo >= 0 ? "text-success" : "text-danger"
                  )}>
                    {mes.saldo >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span style={{ fontSize: '1.1rem' }}>{formatCurrency(mes.saldo)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  );
}
