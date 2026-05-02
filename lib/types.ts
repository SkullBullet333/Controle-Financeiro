export type Status = 'Pago' | 'Em aberto' | 'Vencida' | 'Hoje' | 'Recebido' | 'Pendente';

export interface Titular {
  id: number;
  nome: string;
  foto?: string;
}

export interface Profile {
  id: string;
  email: string;
  nome: string;
  tipo: 'titular' | 'membro';
  foto?: string;
  family_id: string;
  theme_color?: string;
  dark_mode?: boolean;
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
  isSummary?: boolean;
  cartao_vencimento_id?: number;
  emprestimo_id?: number;
  conta_fixa_id?: number;
}

export interface Receita {
  id: number;
  descricao: string;
  categoria?: string;
  valor: number;
  parcela_atual: number;
  parcela_total: number;
  data_recebimento: string;
  status: Status;
  titular_id: number;
  competencia: string;
  conta_fixa_id?: number;
}

export interface Nota {
  user_id: string;
  conteudo: string;
}

export interface ConfigApp {
  titulares: Titular[];
  cartoes: CartaoConfig[];
}

export interface Emprestimo {
  id: number;
  user_id: string;
  family_id: string;
  descricao: string;
  valor_total?: number;
  valor_parcela: number;
  taxa_mensal_percentual: number;
  total_parcelas: number;
  parcela_atual: number;
  data_primeiro_vencimento: string;
  competencia_inicial: string;
  titular_id: number;
  created_at?: string;
}

export interface ContaFixaConfig {
  id: number;
  user_id: string;
  family_id: string;
  descricao: string;
  valor_mensal: number;
  total_parcelas: number;
  parcela_atual: number;
  data_inicio: string;
  competencia_inicial: string;
  titular_id: number;
  categoria?: string;
  tipo: 'despesa' | 'receita';
  created_at?: string;
}
