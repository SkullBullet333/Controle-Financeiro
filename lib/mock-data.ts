import { Despesa, Receita, ConfigApp } from './types';

export const MOCK_CONFIG: ConfigApp = {
  titulares: [
    { id: 1, nome: "Noádia", foto: "https://images.icon-icons.com/2643/PNG/512/female_woman_person_people_avatar_icon_159366.png" },
    { id: 2, nome: "Pablo", foto: "https://images.icon-icons.com/2643/PNG/512/male_man_people_person_avatar_white_tone_icon_159363.png" },
    { id: 3, nome: "Casa", foto: "https://images.icon-icons.com/1483/PNG/512/wifihome_102155.png" }
  ],
  cartoes: [
    { id: 1, nome_cartao: "Nubank", titular_id: 2, dia_vencimento: 10, dia_fechamento: 7 },
    { id: 2, nome_cartao: "Inter", titular_id: 1, dia_vencimento: 15, dia_fechamento: 5 },
    { id: 3, nome_cartao: "Mercado Pago", titular_id: 2, dia_vencimento: 20, dia_fechamento: 10 }
  ],
  categorias: [
    { id: 1, label: "Mercado", keywords: "mercado,supermercado,feira" },
    { id: 2, label: "Transporte", keywords: "combustivel,gasolina,posto,carro,uber" },
    { id: 3, label: "Moradia", keywords: "aluguel,casa,condominio,luz,agua" },
    { id: 4, label: "Saúde", keywords: "farmacia,medico,unimed" },
    { id: 5, label: "Lazer", keywords: "ifood,restaurante,netflix,spotify" }
  ]
};

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();
const comp = `${String(currentMonth).padStart(2, '0')}/${currentYear}`;

export const MOCK_DESPESAS: Despesa[] = [
  {
    id: 1,
    descricao: "Aluguel",
    categoria_id: 3,
    valor: 1500,
    parcela_atual: 1,
    parcela_total: 1,
    vencimento: `${currentYear}-${String(currentMonth).padStart(2, '0')}-10`,
    competencia: comp,
    status: "Pago",
    titular_id: 3,
    simulada: false
  },
  {
    id: 2,
    descricao: "Supermercado",
    categoria_id: 1,
    valor: 850.50,
    parcela_atual: 1,
    parcela_total: 1,
    vencimento: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15`,
    competencia: comp,
    status: "Em aberto",
    titular_id: 3,
    simulada: false
  },
  {
    id: 3,
    descricao: "Internet",
    categoria_id: 3,
    valor: 120,
    parcela_atual: 1,
    parcela_total: 1,
    vencimento: `${currentYear}-${String(currentMonth).padStart(2, '0')}-05`,
    competencia: comp,
    status: "Pago",
    titular_id: 2,
    simulada: false
  }
];

export const MOCK_RECEITAS: Receita[] = [
  {
    id: 1,
    descricao: "Salário Pablo",
    valor: 5000,
    data_recebimento: `${currentYear}-${String(currentMonth).padStart(2, '0')}-05`,
    competencia: comp,
    titular_id: 2,
    simulada: false
  },
  {
    id: 2,
    descricao: "Freelance",
    valor: 1200,
    data_recebimento: `${currentYear}-${String(currentMonth).padStart(2, '0')}-20`,
    competencia: comp,
    titular_id: 1,
    simulada: false
  }
];
