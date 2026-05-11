# Contexto do Projeto: Radar Financeiro 🚀

Este documento serve como guia de contexto para assistentes de IA (como Antigravity) trabalharem de forma consistente neste repositório.

## 🛠️ Stack Tecnológica
- **Framework:** Next.js 15.1.x (App Router, 'use client' extensivo para painéis dinâmicos)
- **Estilização:** Tailwind CSS + Vanilla CSS.
    - **Temas:** Suporte a **Light**, **Dark** (Azul profundo) e **Midnight Black** (Preto absoluto).
    - **Cores:** Cores de destaque (`--primary`) são personalizáveis por usuário e sincronizadas via banco de dados.
- **Backend/Auth:** Supabase (PostgreSQL + RLS + Storage para avatares).
- **Estado Global/Lógica:** Hook customizado `hooks/use-finance.ts` centralizando CRUDs, autenticação e computação de dados derivados (faturas virtuais, projeções de contas fixas).
- **Ícones:** Material Symbols Outlined (Google) e Lucide-React.

## 📐 Arquitetura e Decisões de Design
### 1. Fluxo de Lançamento e Transações
- **Valores Negativos:** O sistema permite a entrada de valores negativos em transações de cartão de crédito para representar créditos ou estornos, refletindo corretamente nos totais da fatura.
- **Parcelamento:** Suporte a lançamentos parcelados com projeção automática de competências.
- **Estilo:** Design premium com bordas arredondadas (`2.5rem` em modais), sombras suaves e micro-interações.

### 2. Sincronização e Preferências
- **Profiles:** Preferências de tema, modo e cores são armazenadas na tabela `profiles` e vinculadas ao `user_id`.
- **Faturas Virtuais:** A lógica de fatura é gerada On-The-Fly para evitar duplicidade, consolidando transações reais e projeções de contas fixas no hook `useFinance`.
- **Antecipação:** Funcionalidade de antecipação de parcelas (Payoff) com cálculo automático de desconto baseado em Valor Presente (VP).

## 📁 Estrutura de Arquivos Crítica
- `components/modals.tsx`: Arquivo extremamente denso (**~2375 linhas**). Contém toda a lógica de formulários e modais de configuração. **Cuidado ao editar blocos grandes.**
- `app/page.tsx`: Layout principal do Dashboard (**~70KB**). Gerencia a montagem de todos os widgets e visões.
- `hooks/use-finance.ts`: O "cérebro" da aplicação, gerencia o estado global e a comunicação com o Supabase.
- `lib/finance-service.ts`: Utilitários de lógica financeira, cálculos de competência e persistência.

## ⚠️ Observações de Desenvolvimento
- **Performance:** Devido ao tamanho de `modals.tsx` e `page.tsx`, prefira edições cirúrgicas. Evite reescritas totais que possam quebrar estados de componentes controlados.
- **Configuração:** `.env` requer `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Z-Index:** Atenção ao empilhamento de modais (SettingsModal vs FinanceForm) definido via classes customizadas de Z-Index no `globals.css`.

---
*Última atualização: Maio de 2026*
