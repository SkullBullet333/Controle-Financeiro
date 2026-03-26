# Contexto do Projeto: Radar Financeiro 🚀

Este documento serve como guia de contexto para assistentes de IA (como Antigravity) trabalharem de forma consistente neste repositório.

## 🛠️ Stack Tecnológica
- **Framework:** Next.js 15.1.x (App Router, 'use client' extensivo para painéis dinâmicos)
- **Estilização:** Tailwind CSS (moderno, dark mode nativo) + Vanilla CSS/Estilos Inline em componentes críticos para evitar conflitos de Bootstrap legados.
- **Backend/Auth:** Supabase (PostgreSQL + RLS + Storage para avatares)
- **Estado Global/Lógica:** Hooks customizados (`hooks/use-finance.ts`) centralizando a computação de dados derivados (competência, totais, faturas virtuais).
- **Ícones:** Material Symbols Outlined (Google) e Lucide-React.

## 📐 Arquitetura e Decisões de Design
### 1. Fluxo de Lançamento (Redesign Premium)
O modal de "Nova Despesa" foi redesenhado para ser ultra-clean e eficiente:
- **Passo 1:** Preenchimento de dados básicos (valor, descrição, data, responsável, categoria).
- **Passo 2:** Escolha de pagamento (À Vista ou Parcelado) com cards interativos.
- **Estilo:** Bordas arredondadas de `1.5rem` nos cards internos e `2.5rem` no modal externo. O valor principal e o ícone do cabeçalho compartilham o fundo suave `#F8FAFC` e a cor `text-navy` para uma experiência visual coesa e premium.
- **Cores:** Paleta de azuis profundos (`#1E40AF`) para ações positivas e vermelho suave para ações neutras/voltar.

### 2. Sincronização de Dados
- Toda a lógica de "fatura virtual" de cartões é gerada On-The-Fly no hook `useFinance` para evitar duplicidade no banco, consolidando transações reais em entradas de extrato.
- **Competência:** O sistema usa um modelo de competência `MM/YYYY` para filtrar gastos, independentemente da data de vencimento.

## 📁 Estrutura de Arquivos Crítica
- `components/modals.tsx`: Contém todos os modais de interação (FinanceForm, SettingsModal, etc). Arquivo denso (>1400 linhas).
- `hooks/use-finance.ts`: O "cérebro" da aplicação, gerencia CRUDs, autenticação e agregação de dados.
- `lib/supabase.ts`: Configuração do cliente Supabase. Requer `.env` local.
- `app/page.tsx`: Layout principal do Dashboard.

## ⚠️ Observações de Desenvolvimento
- **Configuração:** O arquivo `.env` deve conter `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **CSS:** Evite adicionar classes globais que possam quebrar o layout de "Cards" do Dashboard. Prefira utilitários Tailwind ou estilos isolados no componente.
- **Sintaxe JSX:** O arquivo `modals.tsx` é complexo; ao editar, garanta que as tags de fechamento do `Backdrop` e `Modal` estejam integradas ao controle de estado `{step === 'confirm' && (...)}`.

---
*Última atualização: Março de 2026*
