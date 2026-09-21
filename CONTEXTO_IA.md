# Contexto do Projeto: Radar Financeiro 🚀

Este documento serve como guia de contexto para assistentes de IA (como Antigravity) trabalharem de forma consistente neste repositório.

## 🛠️ Stack Tecnológica
- **Framework:** Next.js 15.5.x (App Router, `use client` extensivo para painéis dinâmicos)
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
- `lib/money.ts`: Fonte única para normalização e aritmética de valores monetários em centavos inteiros.
- `lib/cashflow-projection.ts`: Fonte canônica da projeção mensal de receitas, despesas, empréstimos e faturas usada pelo painel e pelo radar.
- `lib/card-projection.ts`: Fonte canônica para totais por cartão, projeção de faturas por competência e resolução de fatura persistida.
- `lib/finance-selectors.ts`: Seletores puros para resumo financeiro, fluxo, totais por titular e dívida em aberto.
- `lib/finance-service.test.ts`: Testes de caracterização das regras financeiras críticas.

## ⚠️ Observações de Desenvolvimento
- **Performance:** Devido ao tamanho de `modals.tsx` e `page.tsx`, prefira edições cirúrgicas. Evite reescritas totais que possam quebrar estados de componentes controlados.
- **Visões sob demanda:** `app/page.tsx` mantém o Dashboard inicial, mas carrega Lançamentos, Cartões, Radar e Definições via `next/dynamic`. Preserve o estado de carregamento e evite voltar a importá-las estaticamente. Os modais ainda são carregados no pacote inicial e podem ser separados em etapa própria.
- **Configuração:** `.env` requer `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Qualidade:** rode `npm run lint`, `npm test`, `npx tsc --noEmit` e `npm run build` antes de entregar alterações.
- **Código histórico:** `_backup/` é preservado apenas como referência e fica fora da compilação ativa. Não restaure imports de `components/finance-views.tsx`; esse módulo não possuía consumidores e foi removido.
- **Erros de gravação:** comandos financeiros devem propagar falhas após rollback; formulários devem aguardar a Promise, permanecer abertos e preservar os dados quando a gravação falhar.
- **Receitas:** use `resolverAgendamentoReceita` como fonte única para data bancária e competência; a competência deriva da data contratual antes do ajuste de fim de semana.
- **Recorrências:** carregamentos e quitações nunca devem excluir automaticamente o mestre de `contas_fixas`; preserve o histórico e limite projeções por `total_parcelas`.
- **PWA:** nunca inclua respostas de APIs externas ou dados financeiros autenticados no Cache Storage.
- **Supabase local:** Docker/WSL e a stack local estão operacionais. A CLI está fixada no projeto e `supabase/config.toml` está versionado. O remoto foi inspecionado em modo somente leitura e não possui histórico em `supabase_migrations`; use somente comandos `--local` até concluir `supabase/REMOTE_DEPLOYMENT.md`.
- **RLS:** `20260912000000_harden_family_rls.sql` protege família/papel, separa administração do titular e restringe lançamentos de membros aos próprios registros. Preserve a matriz pgTAP antes de mudar policies.
- **Compatibilidade:** `20260912010000_cartoes_config_canonical_fields.sql` versiona `final`, `color` e `icone`, migrando valores da coluna remota legada `"Final"` sem removê-la.
- **Integridade familiar:** `20260912020000_same_family_foreign_keys.sql` usa FKs compostas para impedir referências entre famílias em titulares, cartões, contas fixas, empréstimos, despesas e receitas.
- **Quitação/materialização:** `20260912030000_atomic_linked_expenses.sql` cria unicidade por origem/parcela e a RPC `materializar_despesas_vinculadas`. Uma chamada grava todo o lote ou reverte tudo; retries não duplicam ocorrências e o mestre é preservado.
- **Receitas recorrentes:** `20260912040000_atomic_linked_revenues.sql` usa `(family_id, conta_fixa_id, competencia)` como identidade, pois o legado pode reutilizar `parcela_atual`. A RPC correspondente preserva RLS, autor e mestre.
- **Criação parcelada:** `20260912050000_idempotent_installment_creation.sql` registra uma chave UUID por intenção e vincula as parcelas à operação. O formulário reutiliza a chave em retry sem edição; a RPC recusa a mesma chave com conteúdo diferente e não confunde operações legítimas visualmente iguais.
- **Faturas de cartão:** `20260912060000_structural_card_invoices.sql` substitui identificação por texto pelo vínculo `(family_id, cartao_vencimento_id, competencia)`. O backfill histórico só ocorre com correspondência inequívoca; qualquer ambiguidade aborta a migration. Até a publicação remota, existe fallback exato somente de leitura para renderizar faturas antigas; gravações e exclusões nunca dependem do texto.
- **Exclusões administrativas:** `20260913000000_restrict_admin_deletions.sql` impede apagar titulares ou cartões em uso. A interface mantém o modal aberto e explica que o cadastro foi preservado.
- **Recorrências de cartão:** `20260913010000_structural_card_recurrences.sql` identifica cada ocorrência por `(family_id, conta_fixa_id, conta_fixa_parcela)`. Edições materializam por RPC; uma ocorrência virtual jamais deve chamar `deletarContaFixaConfig`.
- **Ciclo de vida das recorrências:** `20260913020000_fixed_recurrence_lifecycle.sql` substitui exclusão por `encerrar_conta_fixa`, registra estado/instante/responsável, preserva FKs históricas e impede novas materializações. Projeções devem sempre usar `contaFixaEstaAtiva`; ausência da coluna no remoto legado equivale temporariamente a `ativo`.
- **Comandos por ocorrência:** `20260913030000_recurrence_occurrence_commands.sql` registra exceções não destrutivas para “ignorar ocorrência” e um ponto de corte para “encerrar daqui em diante”. Ocorrências anteriores e lançamentos já materializados permanecem preservados; projeções e novas materializações respeitam exceções e corte. A tabela de exceções é somente leitura para clientes autenticados e só pode ser alterada pelas RPCs protegidas.
- **Histórico por período:** `fetchData` usa a janela de seis competências iniciada no mês selecionado, pagina os lançamentos em blocos de 500 e mantém cache em memória separado por usuário/janela (até seis janelas). Não volte a usar um corte relativo à data atual nem persista snapshots financeiros no `localStorage`; chaves antigas `fin_cache_` são expurgadas ao iniciar o hook, sem ler seu conteúdo. Saída/troca de conta descarta o estado financeiro e invalida respostas pendentes. Despesas vinculadas a empréstimos ou contas fixas são buscadas numa consulta combinada; despesas antigas em aberto continuam separadas para os alertas. Exclusões administrativas sem vínculos atualizam o cadastro local e invalidam snapshots sem recarregar todo o histórico. Respostas atrasadas de navegação são descartadas.
- **Falhas e operações compostas:** use `reportOperationFailure` para registrar apenas operação e código validado, nunca objetos de erro com mensagem/detalhes financeiros. A exclusão de empréstimo deve ser um único `DELETE`: as FKs `ON DELETE SET NULL` preservam e desvinculam as despesas na mesma transação. Renomeação e reclassificação de categorias usam as RPCs transacionais de `20260920000000_atomic_category_updates.sql`; o cliente mantém a sequência legada apenas enquanto o projeto remoto não tiver essas funções (`PGRST202`/`42883`). Cada falha interrompe a operação, recarrega o estado salvo e é apresentada ao usuário. `cartoes` possui `estabelecimento`, não `descricao`. O fallback de schema de `cartoes_config` deve reenviar um payload completo, uma gravação por tentativa, somente quando faltar a coluna canônica; nunca salvar campos opcionais em gravações parciais.
- **Precisão monetária:** valores persistidos e exibidos devem ser normalizados por `lib/money.ts`. Somas, subtrações e multiplicações financeiras acumulam centavos inteiros, com arredondamento de meio centavo para longe de zero. Não use reducers com `acc + item.valor` nem arredonde para unidade inteira. Taxas percentuais mantêm precisão separada; cada valor presente é arredondado a centavos antes da soma.
- **Projeção de fluxo:** painel e radar devem consumir `projetarFluxoCaixa`; não replique loops de receitas recorrentes, contas fixas, empréstimos ou faturas nos componentes. A função retorna despesas regulares, faturas e total de saída separadamente e aplica o filtro opcional de titular a todas as fontes.
- **Índices da projeção:** a identificação de receitas, despesas fixas e parcelas de empréstimos já materializadas usa conjuntos construídos uma vez por projeção. Preserve as duas regras legadas de receita (mesma competência ou mesma parcela da conta fixa) ao otimizar esse trecho; não volte a varrer toda a coleção para cada ocorrência.
- **Projeção de cartões:** use `calcularTotaisPorCartao`, `calcularValorFaturaCartao` e `projetarFaturasCartao`. A tela recebe `allProjectedCartaoTransacoes` para os meses futuros; não extrapole parcelas a partir apenas do mês atual e não identifique faturas por categoria, prefixo ou nome parcial.
- **Seletores financeiros:** use `calcularTotaisFluxo`, `calcularResumoFinanceiro`, `calcularTotaisPorTitular` e `calcularDividaAberta`. Filtros por competência e titular devem ser aplicados dentro desses seletores; componentes podem manter somente agregações próprias de apresentação, como categorias e séries gráficas.
- **Semântica dos indicadores:** receitas e despesas totais são previstas para a competência, não saldos bancários. Receita realizada usa status `Recebido`/`Pago` em lançamento materializado; uma receita recorrente virtual permanece `Pendente` mesmo depois da data prevista. Despesa paga usa `Pago`; qualquer despesa não paga entra em “a pagar”, inclusive vencida. Vencido é um subconjunto de “a pagar” determinado pela data. O score orçamentário usa o primeiro mês de `projetarFluxoCaixa` e fica indisponível sem receita prevista. Não exiba meses de reserva sem um saldo de reserva cadastrado.
- **Banco:** rode `npm run supabase:reset`, `npm run supabase:lint` e `npm run test:db` para validar migrations em banco vazio.
- **Produção:** nunca publique a migration-base como pendente. Ela possui um bloqueio preventivo antes dos `DROP TABLE`, e as quatro versões legadas devem ser adotadas no histórico antes do dry-run das migrations aditivas.
- **Backups:** `.BaseCSV/` e `.BaseSQL/` contêm dados reais, ficam fora do Git e jamais devem virar seed ou aparecer em logs/testes.
- **Ensaio de restauração:** `npm run backup:validate` confere estrutura e referências sem imprimir valores; `npm run backup:rehearse` restaura em `radar_restore_rehearsal`, aplica as migrations sobre os 1.132 registros e remove a cópia temporária ao final. O backup não inclui Auth nem Storage.
- **Frontend local isolado:** `npm run dev:local` obtém a URL/chave pública da CLI, recusa hosts não locais e inicia na porta 3001 sem alterar `.env`. Use `npm run dev:local -- -Port 3002` quando a porta padrão estiver ocupada.
- **Banco local com dados:** `npm run backup:restore:local` somente aceita banco sem usuários/lançamentos, repete o ensaio, restaura o legado, aplica as migrations, cria acesso via Auth local e valida login/RLS. O rollback para o estado vazio é `npm run supabase:reset`.
- **Isolamento do Next:** a instância local usa `NEXT_DIST_DIR=.next-local`. Nunca remova essa separação enquanto a porta 3000 e uma porta local estiverem ativas em paralelo, pois `NEXT_PUBLIC_*` é embutido nos bundles.
- **Z-Index:** Atenção ao empilhamento de modais (SettingsModal vs FinanceForm) definido via classes customizadas de Z-Index no `globals.css`.

---
*Última atualização: Setembro de 2026*
