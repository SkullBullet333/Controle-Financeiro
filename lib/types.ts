export type Status = 'Pago' | 'Em aberto' | 'Vencida' | 'Hoje';

export interface Titular {
  id: number;
  nome: string;
  foto?: string;
}

export interface Categoria {
  id: number;
  label: string;
  keywords: string;
}

export interface CartaoConfig {
  id: number;
  nome_cartao: string;
  titular_id: number;
  dia_vencimento: number;
  dia_fechamento: number;
}

export interface CartaoTransacao {
  id: number;
  user_id: string;
  cartao_id: number;
  data_compra: string;
  estabelecimento: string;
  valor: number;
  parcela_atual: number;
  parcela_total: number;
  competencia: string;
  simulada: boolean;
  titular_id: number;
  categoria?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Despesa {
  id: number;
  descricao: string;
  categoria?: string;
  valor: number;
  parcela_atual: number;
  parcela_total: number;
  vencimento: string;
  status: Status;
  titular_id: number;
  competencia: string;
  simulada: boolean;
  isSummary?: boolean;
  cartao_vencimento_id?: number;
}

export interface Receita {
  id: number;
  descricao: string;
  valor: number;
  data_recebimento: string;
  titular_id: number;
  competencia: string;
  simulada: boolean;
}

export interface Nota {
  user_id: string;
  conteudo: string;
}

export interface ConfigApp {
  titulares: Titular[];
  cartoes: CartaoConfig[];
}
