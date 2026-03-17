import { Despesa, Receita, ConfigApp } from './types';

export const MOCK_CONFIG: ConfigApp = {
  titulares: [
    { linha: 1, nome: "Noádia", foto: "https://images.icon-icons.com/2643/PNG/512/female_woman_person_people_avatar_icon_159366.png" },
    { linha: 2, nome: "Pablo", foto: "https://images.icon-icons.com/2643/PNG/512/male_man_people_person_avatar_white_tone_icon_159363.png" },
    { linha: 3, nome: "Casa", foto: "https://images.icon-icons.com/1483/PNG/512/wifihome_102155.png" }
  ],
  cartoes: [
    { linha: 1, nome: "Nubank", titular: "Pablo", diaVencimento: 10, diaFechamento: 7 },
    { linha: 2, nome: "Inter", titular: "Noádia", diaVencimento: 15, diaFechamento: 5 },
    { linha: 3, nome: "Mercado Pago", titular: "Pablo", diaVencimento: 20, diaFechamento: 10 }
  ],
  categorias: [
    { linha: 1, label: "Mercado", keywords: "mercado,supermercado,feira" },
    { linha: 2, label: "Transporte", keywords: "combustivel,gasolina,posto,carro,uber" },
    { linha: 3, label: "Moradia", keywords: "aluguel,casa,condominio,luz,agua" },
    { linha: 4, label: "Saúde", keywords: "farmacia,medico,unimed" },
    { linha: 5, label: "Lazer", keywords: "ifood,restaurante,netflix,spotify" }
  ]
};

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();
const comp = `${String(currentMonth).padStart(2, '0')}/${currentYear}`;

export const MOCK_DESPESAS: Despesa[] = [
  {
    linha: 1,
    descricao: "Aluguel",
    categoria: "Moradia",
    valor: 1500,
    parcela: "1/1",
    vencimento: `10/${comp}`,
    vencimentoIso: `${currentYear}-${String(currentMonth).padStart(2, '0')}-10`,
    competencia: comp,
    status: "Pago",
    titular: "Casa",
    simulada: false
  },
  {
    linha: 2,
    descricao: "Supermercado",
    categoria: "Mercado",
    valor: 850.50,
    parcela: "1/1",
    vencimento: `15/${comp}`,
    vencimentoIso: `${currentYear}-${String(currentMonth).padStart(2, '0')}-15`,
    competencia: comp,
    status: "Em aberto",
    titular: "Casa",
    simulada: false
  },
  {
    linha: 3,
    descricao: "Internet",
    categoria: "Moradia",
    valor: 120,
    parcela: "1/1",
    vencimento: `05/${comp}`,
    vencimentoIso: `${currentYear}-${String(currentMonth).padStart(2, '0')}-05`,
    competencia: comp,
    status: "Pago",
    titular: "Pablo",
    simulada: false
  }
];

export const MOCK_RECEITAS: Receita[] = [
  {
    linha: 1,
    descricao: "Salário Pablo",
    valor: 5000,
    parcelas: "1/1",
    recebimento: `05/${comp}`,
    competencia: comp,
    titular: "Pablo",
    simulada: false
  },
  {
    linha: 2,
    descricao: "Freelance",
    valor: 1200,
    parcelas: "1/1",
    recebimento: `20/${comp}`,
    competencia: comp,
    titular: "Noádia",
    simulada: false
  }
];
