export type Status = 'Pago' | 'Em aberto' | 'Vencida' | 'Hoje';

export interface Titular {
  linha: number;
  nome: string;
  foto?: string;
}

export interface Categoria {
  linha: number;
  label: string;
  keywords: string;
}

export interface CartaoConfig {
  linha: number;
  nome: string;
  titular: string;
  diaVencimento: number;
  diaFechamento: number;
}

export interface Despesa {
  linha: number;
  descricao: string;
  categoria: string;
  valor: number;
  parcela: string;
  vencimento: string;
  vencimentoIso: string;
  competencia: string;
  status: Status;
  titular: string;
  cartao?: string;
  simulada: boolean;
  isSummary?: boolean;
}

export interface Receita {
  linha: number;
  descricao: string;
  valor: number;
  parcelas: string;
  recebimento: string;
  competencia: string;
  titular: string;
  simulada: boolean;
}

export interface ConfigApp {
  titulares: Titular[];
  cartoes: CartaoConfig[];
  categorias: Categoria[];
}
