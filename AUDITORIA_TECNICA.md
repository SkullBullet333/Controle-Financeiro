# Auditoria técnica — Radar Financeiro

**Data:** 20/09/2026  
**Status:** diagnóstico inicial e trinta lotes locais concluídos; Supabase local configurado com cópia restaurada, login e smoke visual validados. Backup real novamente ensaiado em banco temporário com a migration de categorias, produção inspecionada em modo somente leitura e caminho de adoção protegido. Um staging sintético separado recebeu as migrations e a validação de RLS/interface; a produção permanece sem alteração. Não há autorização para publicação direta em produção.  
**Prioridade adotada:** integridade financeira → cálculos → segurança → performance → arquitetura → manutenção → UX.

## Resumo executivo

O projeto é uma aplicação Next.js 15 de página única, executada quase integralmente no navegador. Autenticação, persistência e isolamento familiar usam Supabase (PostgreSQL, Auth, RLS e Storage). O hook `hooks/use-finance.ts` concentra sessão, cache, dez consultas iniciais, CRUD, projeções, alertas e agregações; `lib/finance-service.ts` reúne parte das regras de data, competência, parcelamento e persistência. Dashboard, radar e cartões também recalculam regras financeiras por conta própria.

O build de produção e a verificação TypeScript passam. O lote 1 adicionou uma suíte inicial de testes e corrigiu o lint para analisar os arquivos TypeScript/TSX. O lote 4 instalou o ambiente Supabase local e endureceu as políticas RLS; o lote 5 reconciliou campos de cartões e impediu referências entre famílias; o lote 6 comparou o schema remoto e protegeu o bootstrap contra execução acidental em banco existente; o lote 7 tornou atômicas e idempotentes as materializações e quitações de despesas/receitas vinculadas; o lote 8 protegeu a criação parcelada contra retries e deu identidade estrutural às faturas de cartão; o lote 9 ensaiou o backup real em banco temporário; o lote 10 restaurou a cópia no banco local ativo, criou acesso local e separou os bundles das portas 3000/3002; o lote 11 validou visualmente os módulos principais com os dados restaurados; o lote 12 removeu valores financeiros fictícios dos estados vazios e fallbacks visuais; o lote 13 tornou confiáveis os formulários administrativos de perfil, titulares e cartões; o lote 14 impediu que a exclusão desses cadastros apague ou desassocie o histórico financeiro; o lote 15 deu identidade estrutural às ocorrências recorrentes de cartão; o lote 16 substituiu a exclusão destrutiva de séries pelo encerramento auditável; o lote 17 adicionou comandos não destrutivos por ocorrência; o lote 18 substituiu o corte móvel de seis meses por carregamento paginado a partir do período selecionado e cache por janela; o lote 19 padronizou a aritmética monetária em centavos inteiros e o arredondamento nas fronteiras de leitura, cálculo e persistência; o lote 20 extraiu a projeção mensal de fluxo para uma fonte compartilhada pelo painel e pelo radar; o lote 21 consolidou totais e projeções de cartões por competência com identificação estrutural de faturas; o lote 22 removeu o módulo de visões financeiras sem consumidores e isolou o backup histórico da compilação; o lote 23 centralizou resumo, saldo, totais por titular e dívida em aberto em seletores puros; o lote 24 alinhou previsto, realizado, a pagar e vencido, retirou o score sem base e eliminou a reserva fictícia do Radar. `npm audit` não encontrou vulnerabilidades conhecidas nas 616 dependências instaladas após as atualizações compatíveis de segurança.

Foram identificados riscos que impedem tratar a versão atual como um livro-caixa confiável em produção:

1. o service worker pode armazenar respostas autenticadas do Supabase sem separação por usuário;
2. as políticas RLS permitem autoelevação de privilégio e troca indevida de família por alteração do próprio perfil;
3. operações financeiras compostas não são transacionais nem protegidas por constraints de idempotência;
4. uma leitura de dados pode excluir configurações de recorrência automaticamente;
5. a competência de receitas é calculada de forma diferente na criação e na edição;
6. telas diferentes mantêm fórmulas próprias e chegam a exibir projeções fictícias;
7. contas bancárias e transferências não existem no modelo atual, portanto o “saldo” exibido é margem mensal, não patrimônio ou saldo bancário.

## Escopo examinado

- Todos os arquivos Markdown do repositório: `README.md` e `CONTEXTO_IA.md`.
- Estrutura completa versionada, configurações, dependências e artefatos legados.
- Quinze migrations Supabase, schema, RLS, FKs, constraints, índices e RPCs financeiras.
- Hook global, serviço financeiro, tipos, cache, cliente Supabase e utilitários.
- Fluxos de despesas, receitas, contas fixas, parcelas, cartões, faturas virtuais, empréstimos, antecipação, dashboard, extrato, filtros, radar, alertas e configurações.
- Build, TypeScript, lint, histórico de secrets e auditoria de dependências.

Não houve acesso ao banco de produção nem a métricas reais de consultas. Portanto, conclusões sobre código e schema versionado têm confiança alta; seletividade de índices e volume real de dados exigem `EXPLAIN (ANALYZE, BUFFERS)` e telemetria em um ambiente seguro antes da implementação.

## Arquitetura atual

```text
Navegador / PWA
  └─ Next.js App Router (uma página cliente)
      ├─ app/page.tsx: navegação, modais e orquestração
      ├─ components/*: dashboard, extrato, cartões, radar e configurações
      └─ hooks/use-finance.ts
          ├─ autenticação e perfil
          ├─ estado global e cache temporário em memória
          ├─ consultas e CRUD Supabase
          ├─ projeções virtuais e faturas
          └─ KPIs, alertas e projeções de 12 meses
              └─ lib/finance-service.ts
                  ├─ datas/competências/parcelas/VP
                  └─ persistência direta e RPCs transacionais via supabase-js
                      └─ Supabase: Auth + PostgreSQL/RLS + Storage
```

### Tecnologias e serviços

- Next.js 15.5.12, React 19, TypeScript estrito e App Router.
- Tailwind CSS 4, CSS global, Bootstrap e três conjuntos de fontes/ícones carregados por CDN.
- Supabase JS, PostgreSQL, Auth, RLS e bucket público de avatares.
- date-fns para datas, Recharts para gráficos e Motion para animações.
- Não há API Routes, Server Actions, servidor de aplicação próprio, jobs agendados ou filas.
- `@google/genai`, `@hookform/resolvers` e `class-variance-authority` não possuem uso encontrado no código-fonte.

### Modelo funcional observado

- **Despesas e receitas:** registros físicos em tabelas distintas; parcelamentos comuns geram várias linhas em lote.
- **Contas fixas:** existe um registro mestre; as ocorrências são projetadas no cliente e só viram registros físicos quando alteradas/pagas.
- **Empréstimos:** contrato mestre com parcelas projetadas no cliente; pagamento materializa uma despesa.
- **Cartões:** compras físicas ficam em `cartoes`; faturas abertas são agregados virtuais e faturas materializadas possuem vínculo estrutural com cartão e competência. O texto é apenas apresentação.
- **Antecipação:** calcula valor presente por `dias / 30` e grava cada parcela selecionada sequencialmente.
- **Dashboard/radar/relatórios:** agregações são feitas em memória, com fórmulas parcialmente duplicadas.
- **Contas bancárias/transferências/patrimônio:** não implementados no schema nem na interface. Não existe razão de débito/crédito ou ledger de dupla entrada.

## Achados críticos

### C1 — Cache PWA pode misturar ou reter respostas financeiras autenticadas

**Situação após o lote 1:** corrigido no código e coberto por testes; requer publicação para substituir o service worker instalado nos clientes.

- **Arquivo/função:** `public/sw.js`, handler de `fetch`.
- **Causa:** toda requisição que não seja a raiz usa stale-while-revalidate e é gravada no Cache Storage, sem restringir origem, método, destino, resposta privada ou cabeçalho de autenticação.
- **Impacto:** respostas REST do Supabase podem persistir e ser reutilizadas após troca de conta no mesmo navegador. Também podem ser exibidos dados obsoletos em operações financeiras.
- **Solução recomendada:** nunca interceptar Supabase/API; limitar cache a GETs `same-origin` de assets estáticos explícitos; invalidar a versão atual do cache; adicionar teste de troca de sessão e cabeçalhos `Cache-Control` adequados.
- **Risco da alteração:** baixo; o modo offline parcial pode diminuir, mas a confidencialidade e a correção melhoram.
- **Esforço:** 0,5–1 dia.
- **Confiança:** alta.

### C2 — Usuário pode alterar a própria família e o próprio papel

**Situação após o lote 4:** corrigido e coberto por testes no ambiente local; ainda não aplicado ao projeto remoto.

- **Arquivo/função:** migration consolidada, policies de `profiles`; `updateProfile`.
- **Causa:** a policy de UPDATE permite atualizar qualquer coluna do próprio perfil. `family_id` e `tipo` não são imutáveis nem protegidos por função privilegiada.
- **Impacto:** conhecendo/obtendo outro `family_id`, um usuário pode entrar em outra família; também pode se promover a `titular`. Como todas as tabelas usam `get_my_family_id()`, isso abre acesso aos dados e operações daquela família.
- **Solução recomendada:** revogar UPDATE direto dos campos sensíveis, expor RPCs específicas para nome/foto/tema, modelar membership/roles separadamente e administrar entrada/saída por funções transacionais validadas.
- **Risco da alteração:** médio; exige migration compatível e teste de sessões existentes.
- **Esforço:** 2–4 dias.
- **Confiança:** alta.

### C3 — Qualquer membro da família recebe escrita e exclusão total

**Situação após o lote 4:** corrigido e coberto por matriz titular/membro/externo no ambiente local; ainda não aplicado ao projeto remoto.

- **Arquivo/função:** migration consolidada, policy genérica `Acesso por Família`; tabela `convites`.
- **Causa:** a mesma policy `FOR ALL` é aplicada a membros e titulares. A restrição de convite existe apenas na interface e é contornável por acesso direto ao Supabase.
- **Impacto:** um membro pode convidar terceiros, alterar ou apagar todos os dados financeiros da família. A autoelevação de C2 agrava o problema.
- **Solução recomendada:** separar políticas por SELECT/INSERT/UPDATE/DELETE e por papel; proteger convites e exclusões administrativas com RPCs; testar matriz titular/membro/não membro.
- **Risco da alteração:** médio.
- **Esforço:** 2–3 dias em conjunto com C2.
- **Confiança:** alta.

### C4 — Parcelas, quitações e exclusões compostas não são atômicas nem idempotentes

**Situação após os lotes 8, 15, 17 e 29:** parcialmente corrigido. Materializações e quitações vinculadas usam RPCs transacionais com identidades naturais. A criação normal de despesas, receitas e compras parceladas registra uma intenção UUID imutável, aceita replay idêntico e rejeita reutilização com conteúdo diferente. Faturas e ocorrências recorrentes de cartão possuem identidades estruturais; ignorar uma ocorrência e encerrar daquele ponto em diante usam RPCs transacionais e auditáveis. A exclusão de empréstimo passou a um `DELETE` único apoiado na FK `ON DELETE SET NULL`, que preserva o histórico na mesma transação. As alterações em lote de categorias são atômicas onde a nova migration está aplicada; o remoto ainda usa o fallback sequencial até sua adoção. O fallback de schema de cartão usa uma única gravação completa por tentativa e só repete com o formato legado quando falta a coluna canônica.

- **Arquivo/função:** `salvarDespesa`, `salvarReceita`, `lancarParcelas`, `quitarParcelas`, `deletarEmprestimo`, `deletarContaFixaConfig`.
- **Causa:** sequências de SELECT→INSERT/UPDATE e vários `await` são executadas pelo cliente, sem transação de banco. A prevenção de duplicidade é apenas “consultar antes de inserir”, sem unique constraint.
- **Impacto:** cliques concorrentes, duas abas, retry de rede ou falha intermediária podem criar duplicidade, quitação parcial, histórico desvinculado ou mestre excluído antes de todas as parcelas serem gravadas.
- **Solução recomendada:** funções PostgreSQL/RPC transacionais com chave de idempotência; unique constraints parciais para parcela de empréstimo/conta fixa; upsert apoiado por constraint; operação única para quitação e encerramento.
- **Risco da alteração:** médio-alto; requer migration e compatibilidade com duplicidades existentes.
- **Esforço:** 4–7 dias, incluindo saneamento e testes.
- **Confiança:** alta.

### C5 — Leitura de dados executa exclusão automática de recorrências

**Situação após os lotes 2 e 16:** corrigido localmente. Carregamento, pagamento final e quitação em lote não removem o mestre. A ação explícita agora encerra a série por RPC, preserva os vínculos históricos e bloqueia novas materializações; estados terminais continuam visíveis para auditoria.

- **Arquivo/função:** `fetchData`, bloco `finishedContaFixaIds`; `updateDespesa` e `updateReceita`.
- **Causa:** ao detectar a última parcela paga/recebida, o carregamento dispara `deletarContaFixaConfig` em segundo plano. Essa função primeiro remove os vínculos históricos e depois apaga o mestre.
- **Impacto:** uma simples abertura/atualização da tela muda dados permanentemente; não há rollback conjunto, auditoria nem possibilidade segura de reabrir a última parcela. A remoção do vínculo prejudica rastreabilidade e prevenção futura de duplicidade.
- **Solução recomendada:** nunca mutar no fetch; manter o mestre com estado `ativo/concluido/cancelado`; encerrar por RPC transacional explícita e preservar FKs históricas.
- **Risco da alteração:** médio, pois muda o ciclo de vida das recorrências.
- **Esforço:** 2–4 dias.
- **Confiança:** alta.

### C6 — Relacionamentos não garantem que pai e filho pertençam à mesma família

**Situação após os lotes 5–6:** corrigido e testado localmente. A consulta somente leitura no remoto encontrou zero inconsistências nos onze relacionamentos cobertos, portanto a migration está apta ao ensaio em staging.

- **Arquivo/função:** FKs de titulares, cartões, despesas, receitas, empréstimos e contas fixas.
- **Causa:** chaves estrangeiras usam apenas IDs seriais/globais; RLS valida o `family_id` da linha filha, mas não o da linha referenciada.
- **Impacto:** uma linha de uma família pode referenciar um titular/cartão de outra. Cascades do outro tenant podem apagar dados da família atual, além de corromper agregações e joins.
- **Solução recomendada:** chaves únicas compostas `(family_id, id)` nos pais e FKs compostas nos filhos; validar dados existentes antes de ativar constraints.
- **Risco da alteração:** médio-alto devido a possíveis inconsistências já existentes.
- **Esforço:** 3–5 dias.
- **Confiança:** alta para a possibilidade estrutural; ocorrência em produção não verificada.

### C7 — A competência de receita muda entre criação e edição

**Situação após os lotes 1–2:** corrigido no código e coberto por testes. Todos os cálculos encontrados no serviço, formulário, estado otimista, projeção e radar usam a função canônica.

- **Arquivo/função:** `lancarParcelas`, `salvarReceita` e `FinanceForm`.
- **Causa:** a criação calcula a competência antes de ajustar fim de semana; a edição e o formulário calculam depois do ajuste.
- **Impacto:** uma receita prevista para sábado/domingo no fim do mês pode entrar em uma competência ao criar e migrar para outra apenas ao editar. Dashboard e relatórios mensais ficam inconsistentes.
- **Solução recomendada:** definir formalmente a regra, criar função pura única que retorne data efetiva + competência e usá-la em todos os fluxos; cobrir dias 28–31, fins de semana, fevereiro e virada de ano.
- **Risco da alteração:** médio; pode exigir correção de dados históricos.
- **Esforço:** 1–2 dias para código/testes, mais eventual migração de dados.
- **Confiança:** alta.

### C8 — Migration inicial destrói todo o schema financeiro

**Situação após o lote 6:** mitigado. Um bloqueio executado antes do primeiro `DROP TABLE` recusa a migration quando qualquer tabela do produto já existe; um teste estático protege a ordem desse bloqueio. O remoto ainda precisa adotar as versões legadas no histórico antes de qualquer publicação.

- **Arquivo/função:** `20260401000000_consolidated_schema.sql`, início da migration.
- **Causa:** executa `DROP TABLE ... CASCADE` para todas as tabelas antes de recriá-las.
- **Impacto:** se aplicada como migration pendente a um ambiente com dados, causa perda total e irreversível sem backup.
- **Solução recomendada:** retirar o comportamento destrutivo do caminho de migrations de produção; manter bootstrap limpo separado; exigir backup, dry-run e migrations aditivas/reversíveis.
- **Risco da alteração:** baixo para ambientes novos; exige conferir o histórico aplicado antes de renomear/substituir migrations.
- **Esforço:** 1 dia, mais validação de ambiente.
- **Confiança:** alta.

## Achados altos

### A1 — Schema versionado e código estão divergentes

**Situação após os lotes 5–6:** reconciliado. A inspeção remota confirmou as dez tabelas e a coluna legada `cartoes_config."Final"`; a migration aditiva cria `final`, preserva o legado e mantém `color` e `icone` compatíveis.

- **Arquivo/função:** `lib/types.ts`, cadastro de cartões, projections e migrations.
- **Causa:** o código usa `cartoes_config.final/color/icone/limite` e `cartoes.conta_fixa_id/updated_at`, mas as migrations não criam vários desses campos. Há tentativas sequenciais de aliases que silenciam falhas.
- **Impacto:** aparência/limite podem não persistir; recorrências de cartão não têm identidade confiável; ambientes novos não reproduzem o ambiente real.
- **Solução recomendada:** introspectar o schema real, gerar tipos Supabase, criar migration aditiva explícita e remover fallbacks por aliases após migração.
- **Risco:** médio. **Esforço:** 2–3 dias. **Confiança:** alta; schema remoto comparado em modo somente leitura.

### A2 — Não existe fonte única de verdade para projeções e totais

**Situação após o lote 23:** corrigido no núcleo cliente. Projeções de fluxo e cartões, resumo por status, saldo, totais por cartão/titular e dívida em aberto possuem funções puras compartilhadas. Componentes mantêm apenas transformações próprias de apresentação, como agrupamento de categorias e rótulos de gráficos.

- **Arquivo/função:** `use-finance.ts`, `radar-view.tsx`, `cards-view.tsx`, `dashboard.tsx`, `modals.tsx`.
- **Causa:** cada tela reimplementa loops de recorrências, empréstimos, faturas e valor presente.
- **Impacto:** KPIs divergem; correções em uma tela não corrigem as demais; custo cresce com meses × contratos × lançamentos.
- **Solução recomendada:** domínio puro compartilhado (`money`, `calendar`, `installments`, `invoices`, `cashflow`) e seletores memoizados que consumam uma projeção canônica.
- **Risco:** médio-alto se feito de uma vez; deve ser migrado por regra, com testes de caracterização. **Esforço:** 7–12 dias.
- **Confiança:** alta.

### A3 — Valores fictícios e heurísticos aparecem como informação financeira

**Situação após o lote 12:** corrigido no dashboard e nas visões de cartões. Estados sem dados agora são explícitos; limites ausentes aparecem como não informados; projeções e quitações não recebem valores artificiais. Os presets restantes definem somente aparência por bandeira/instituição.

- **Arquivo/função:** simulação e gráfico de cartões; presets de dashboard/cartões.
- **Causa:** ausência de dados gera valores hardcoded de quitação, cartões/limites fictícios e projeção futura por decaimento percentual.
- **Impacto:** o usuário pode tomar decisão com números que não vieram de seus registros.
- **Solução recomendada:** estados vazios explícitos; separar “simulação ilustrativa” de dados reais; projeções apenas com premissas visíveis e auditáveis.
- **Risco:** baixo. **Esforço:** 1–2 dias. **Confiança:** alta.

### A4 — Histórico comum anterior a seis meses fica incompleto

**Situação após o lote 18:** corrigido no cliente. A janela de leitura começa na competência selecionada e cobre os seis meses usados pelas telas e projeções. Todas as páginas são consumidas, o cache é isolado por janela e uma consulta própria preserva os alertas de despesas vencidas anteriores. Respostas de uma navegação antiga não podem sobrescrever o período mais recente.

- **Arquivo/função:** `fetchData`.
- **Causa:** despesas, receitas e cartões são buscados por janela fixa de seis meses; somente despesas ligadas a empréstimo/conta fixa são recuperadas integralmente.
- **Impacto:** navegação para meses/anos anteriores, relatórios anuais e auditoria mostram totais incompletos sem aviso.
- **Solução recomendada:** consultas por período selecionado + endpoints/agregações de relatório; paginação para extrato; cache por período, não snapshot parcial global.
- **Risco:** baixo-médio. **Esforço:** 3–5 dias. **Confiança:** alta.

### A5 — Dinheiro é calculado com `number`/ponto flutuante

**Situação após o lote 19:** corrigido no domínio cliente. Valores monetários são normalizados em centavos inteiros nas fronteiras de leitura e persistência; somas, subtrações, multiplicações e valor presente usam uma regra única de arredondamento de meio centavo para longe de zero. As taxas permanecem com precisão separada. O schema já usa escalas monetárias de duas casas e a cópia local não contém valores fora dessa escala, portanto não foi necessária migration.

- **Arquivo/função:** tipos, formulários, todos os reducers e valor presente.
- **Causa:** PostgreSQL usa `NUMERIC`, mas o domínio converte tudo para `number`, soma sem normalização de centavos e grava resultados de VP sem arredondamento monetário explícito.
- **Impacto:** diferenças de centavos acumuladas e resultados distintos entre telas/gravações.
- **Solução recomendada:** representar valores persistidos em centavos inteiros ou decimal exato; definir regra de arredondamento e aplicá-la nas fronteiras; manter taxa com precisão separada.
- **Risco:** médio-alto por compatibilidade. **Esforço:** 4–7 dias. **Confiança:** alta.

### A6 — Falhas de gravação são silenciosas e o modal fecha cedo

**Situação após os lotes 3 e 13:** corrigido nos formulários financeiros, contas fixas, empréstimos, alteração rápida de status, perfil, titulares e cartões. Os formulários aguardam o comando, bloqueiam duplicidade, permanecem abertos em falhas e exibem mensagem segura; a edição otimista de cartão também possui rollback.

- **Arquivo/função:** callbacks em `app/page.tsx` e CRUDs em `use-finance.ts`.
- **Causa:** callbacks não retornam/aguardam as Promises; vários CRUDs capturam exceções e apenas escrevem no console.
- **Impacto:** a interface sinaliza conclusão/fecha enquanto a operação ainda pode falhar; rollback otimista acontece sem explicação ao usuário.
- **Solução recomendada:** contrato `Result`/exceção consistente, aguardar operações, manter modal aberto, toast acessível com retry e correlation ID.
- **Risco:** baixo. **Esforço:** 2–4 dias. **Confiança:** alta.

### A7 — Exclusões por cascade e por descrição podem apagar histórico

**Situação após os lotes 8 e 14:** corrigido e testado localmente. Faturas usam vínculo estrutural; todas as oito relações de titulares/cartões passaram a `ON DELETE RESTRICT`. Cadastros em uso são preservados e a interface informa o motivo. A migration ainda não foi publicada no projeto remoto.

- **Arquivo/função:** FKs `ON DELETE CASCADE`; `consolidarFaturas`.
- **Causa:** apagar titular/cartão apaga compras/despesas/receitas; consolidação apaga despesas abertas cujo texto começa com `Fatura `, sem chave estrutural confiável.
- **Impacto:** perda financeira por ação administrativa ou colisão de descrição.
- **Solução recomendada:** soft delete/inativação de cadastros usados; `RESTRICT`/`SET NULL` conforme regra; modelar fatura por FK/ID, nunca por prefixo textual.
- **Risco:** médio. **Esforço:** 3–5 dias. **Confiança:** alta.

### A8 — “Saldo” não representa contas ou patrimônio

- **Arquivo/função:** `stats` e projeções; ausência de tabelas correspondentes.
- **Causa:** saldo é simplesmente receitas − despesas da competência. Não há contas bancárias, saldo inicial, conciliação ou transferência.
- **Impacto:** não é possível garantir a regra “transferência não altera patrimônio”; o produto não calcula saldo bancário real.
- **Solução recomendada:** antes de implementar, decidir se o produto é orçamento por competência ou ledger. Para ledger, modelar contas e lançamentos balanceados, com transferência transacional de duas pernas e invariantes.
- **Risco:** alto se misturado ao modelo atual. **Esforço:** épico separado, estimado em 2–4 semanas. **Confiança:** alta.

### A9 — Ausência total de testes para regras financeiras

**Situação após o lote 29:** suíte implementada: 107 testes Vitest e 195 testes pgTAP passaram localmente. O ensaio de restauração dos 1.132 registros públicos também passou com a nova migration de categorias.

- **Arquivo/função:** configuração do projeto e todo o domínio.
- **Causa:** não há runner, scripts ou arquivos de teste.
- **Impacto:** qualquer correção de competência, parcela, fatura ou arredondamento pode introduzir regressão invisível.
- **Solução recomendada:** Vitest para domínio puro + testes de integração PostgreSQL/Supabase local + poucos fluxos E2E críticos. Criar testes de caracterização antes das correções.
- **Risco:** baixo. **Esforço inicial:** 2–3 dias; suíte prioritária 5–8 dias. **Confiança:** alta.

### A10 — Recorrência de cartão não tem identidade persistida completa

**Situação após os lotes 15 e 17:** corrigido localmente. `cartoes` identifica a origem e a ocorrência por `(family_id, conta_fixa_id, conta_fixa_parcela)`, com unicidade, FK restritiva e identidade imutável. A edição de uma ocorrência virtual a materializa por RPC sem duplicar. A exclusão oferece comandos distintos para ignorar somente a ocorrência ou encerrar a série daquele ponto em diante; ambos preservam o mestre e o histórico já materializado.

- **Arquivo/função:** projeção `allProjectedCartaoTransacoes`, schema `cartoes`, exclusão de transação virtual.
- **Causa:** a projeção não carrega de forma consistente `conta_fixa_id`, e o schema versionado de `cartoes` não possui esse campo.
- **Impacto:** excluir/encerrar uma ocorrência virtual pode não funcionar ou pode exigir apagar o mestre inteiro; correspondência por cartão + descrição + competência colide com compras homônimas.
- **Solução recomendada:** FK `conta_fixa_id`, número da ocorrência e constraint única; comandos distintos para “esta ocorrência”, “esta e futuras” e “toda a série”.
- **Risco:** médio. **Esforço:** 3–5 dias. **Confiança:** alta.

## Achados médios

### M1 — Carregamento inicial excessivo e repetido

- **Situação após o lote 28:** a carga inicial usa 11 leituras na primeira página; as despesas têm três consultas (janela, vínculos e vencidas). Antes eram 12 leituras e quatro consultas de despesas. Perfil, exclusão de titular e exclusão de cartão deixaram de chamar `fetchData` completo nos casos comuns. Latência real não foi medida, pois o serviço local não respondeu neste lote.
- **Impacto remanescente:** ainda há `select('*')` e outros comandos CRUD que recarregam todas as coleções; tráfego e CPU crescem com o histórico.
- **Solução:** selecionar colunas, carregar por período, combinar consultas/Views/RPC, atualizar cache pontualmente e medir antes/depois.
- **Risco:** baixo-médio. **Esforço:** 3–5 dias.

### M2 — Índices não correspondem às consultas multi-tenant

- Índices isolados em `family_id`, data e status não cobrem bem RLS + intervalo + ordenação.
- Candidatos, somente após medir: `(family_id, vencimento, id)`, `(family_id, data_recebimento, id)`, `(family_id, data_compra, id)` e índices parciais para FKs de parcelas não nulas.
- **Risco:** baixo, mas há custo de escrita/armazenamento. **Esforço:** 1–2 dias com análise real.

### M3 — Bundle inicial pesado e tudo é carregado de uma vez

- **Situação após o lote 26:** a rota `/` caiu de 299 kB próprios/401 kB iniciais para 276 kB próprios/379 kB iniciais no mesmo build isolado. Lançamentos, Cartões, Radar e Definições são carregados sob demanda; formulários e modais ainda estão no pacote inicial.
- **Causa:** toda a aplicação é cliente e importa dashboard, radar, gráficos, configurações e modais de forma eager.
- **Solução:** dynamic imports por visão/modal, reduzir wrappers/ícones, considerar componentes de servidor apenas para shell estático.
- **Risco:** baixo. **Esforço:** 2–4 dias.

### M4 — Cache local síncrono de dados sensíveis

- **Situação após o lote 27:** corrigido no cliente. O cache financeiro fica apenas em memória, com limite de seis janelas, separação por usuário e descarte na saída/troca de conta. A inicialização remove somente chaves persistentes antigas `fin_cache_`, sem ler os valores. A compressão síncrona e a dependência `fflate` foram removidas. Isso não altera o armazenamento da sessão gerido pelo Supabase nem transforma o aplicativo em offline.
- **Causa original:** `deflateSync`/`inflateSync` rodavam na thread principal e o snapshot financeiro ficava no `localStorage` apenas comprimido, não criptografado.
- **Impacto:** travamentos com volume crescente e persistência após fechamento/queda; qualquer XSS na origem lê os dados.
- **Solução:** remover dados financeiros do armazenamento persistente ou usar cache mínimo com TTL e limpeza confiável; nunca tratar compressão como proteção; avaliar IndexedDB/worker apenas se o offline for requisito.
- **Risco:** baixo-médio. **Esforço:** 1–3 dias.

### M5 — Datas e competência carecem de contrato formal

- Dia de vencimento 31 pode normalizar para outro mês em meses curtos; “dia útil” ignora feriados; competência é `TEXT MM/yyyy`; projeções indefinidas usam limites arbitrários de 24 ou 36 meses.
- **Solução:** calendário puro com clamp no último dia, política explícita de feriados/timezone, competência como `DATE` do primeiro dia e horizonte fornecido pelo consumidor.
- **Risco:** médio. **Esforço:** 3–5 dias.

### M6 — Status e totais possuem semântica inconsistente

- **Situação após o lote 24:** os totais do painel são explicitamente previstos; recebido e pago são separados por status; toda despesa não paga entra em “a pagar”, com vencidas identificadas pela data; totais por titular incluem vencidas; o Radar usa a projeção canônica filtrada e não apresenta score sem receita prevista. A reserva de emergência não é calculada sem saldo cadastrado. “Disponível” bancário permanece fora do escopo do modelo atual.
- **Solução:** definir métricas (`previsto`, `realizado`, `vencido`, `disponível`) e reutilizar seletores canônicos com rótulos correspondentes.
- **Risco:** médio. **Esforço:** 2–4 dias.

### M7 — Observabilidade e auditoria são insuficientes

- Não existe trilha imutável de quem criou/alterou/pagou/excluiu, correlation ID, monitoramento ou captura estruturada de erro.
- **Solução:** tabela/eventos de auditoria sem valores desnecessários, actor/timestamp/operação/idempotency key, logs sanitizados e monitoramento de falhas.
- **Risco:** baixo-médio. **Esforço:** 3–5 dias.

### M8 — Configuração de Storage não é reproduzível

- A interface usa bucket público `avatars`, mas não há migration/policy de Storage no repositório; extensão de arquivo vem do nome e só há limite de tamanho no cliente.
- **Solução:** versionar bucket/policies, validar MIME e assinatura, caminho por usuário/família e limites no backend.
- **Risco:** médio. **Esforço:** 1–2 dias.

### M9 — Supply chain do frontend sem política explícita

- Bootstrap, Font Awesome e fontes são carregados por CDN sem SRI; não há Content Security Policy.
- **Solução:** preferir assets empacotados ou fixar integridade/crossorigin; implantar CSP progressiva compatível com Supabase e imagens.
- **Risco:** médio pela compatibilidade visual. **Esforço:** 1–3 dias.

### M10 — Lint está efetivamente quebrado

- `eslint.config.mjs` não configura TypeScript/React/Next e `eslint .` varre `.next`; resultado observado: 3.283 warnings em artefatos gerados e nenhum diagnóstico útil do fonte.
- **Solução:** usar configuração flat oficial do Next, ignorar `.next`, backups e protótipos, e ativar checks gradualmente.
- **Risco:** baixo. **Esforço:** 0,5–1 dia.

## Achados baixos

### B1 — Código e artefatos legados versionados

- `_backup/`, três protótipos HTML e `tsconfig.tsbuildinfo` estão no Git; `lib/mock-data.ts` não tem referência.
- **Impacto:** busca, lint, review e manutenção mais ruidosos.
- **Solução:** confirmar valor histórico e mover para documentação/arquivo externo ou remover em mudança separada; ignorar `*.tsbuildinfo`.
- **Risco:** baixo. **Esforço:** 0,5 dia.

### B2 — Imports e wrappers sem uso

**Situação após o lote 22:** parcialmente corrigido. A importação órfã de `app/page.tsx` e o módulo `components/finance-views.tsx` foram removidos após confirmação de que seus quatro componentes não possuíam consumidores ativos. O backup histórico que ainda os referenciava foi preservado, mas excluído da compilação.

- `app/page.tsx` importa componentes/ícones/utilitários antigos sem referência; há wrappers de compatibilidade aparentemente inativos.
- **Solução:** habilitar `noUnusedLocals`, confirmar árvore de referências e limpar incrementalmente.
- **Risco:** baixo. **Esforço:** 0,5–1 dia.

### B3 — Documentação de execução está desatualizada

- README pede `GEMINI_API_KEY`, mas a aplicação usa apenas variáveis Supabase; `CONTEXTO_IA.md` cita Next 15.1 e tamanhos antigos.
- **Solução:** documentar setup, migrations, modelo financeiro, segurança, testes e processo de deploy reais.
- **Risco:** baixo. **Esforço:** 0,5–1 dia.

## Plano de implementação proposto

### Fase 0 — Salvaguardas e caracterização

1. Confirmar schema remoto versus migrations e gerar tipos.
2. Fazer backup/export do banco e definir ambiente Supabase local/staging.
3. Instalar/configurar testes e lint corretos.
4. Criar testes de caracterização para competências, parcelas, recorrências, faturas, quitação e RLS.

**Critério de saída:** comportamento atual reproduzível e rollback de dados validado.

### Fase 1 — Segurança e integridade crítica

1. Corrigir service worker e expurgar caches antigos.
2. Fechar alteração de `family_id`/papel e separar permissões titular/membro.
3. Validar relações dentro da mesma família.
4. Criar constraints de parcelas/idempotência e RPCs transacionais.
5. remover mutações do `fetchData`; substituir exclusão de mestres por estados.
6. Tornar exclusões não destrutivas e auditáveis.

**Critério de saída:** concorrência/retry não duplica parcelas; membro não eleva privilégio; troca de conta não reutiliza dados.

### Fase 2 — Correção financeira e fonte única de verdade

1. Unificar calendário e competência de receitas/despesas/cartões.
2. Formalizar arredondamento e representação monetária.
3. Criar projeção canônica e seletores de previsto/realizado/vencido.
4. Migrar dashboard, extrato, cartões, radar e quitação para esses seletores.
5. Remover números fictícios ou identificá-los claramente como demonstração.

**Critério de saída:** o mesmo conjunto de dados produz o mesmo total em todas as telas.

### Fase 3 — Performance e banco

1. Carregar por período/página e selecionar apenas colunas usadas.
2. Eliminar consultas duplicadas e refetch completo após cada CRUD.
3. Medir consultas reais e criar apenas índices comprovados.
4. Mover agregações volumosas para views/RPCs quando vantajoso.
5. Particionar/reduzir cache e remover compressão síncrona do caminho crítico.

**Critério de saída:** métricas de carga, requests e tempo de interação antes/depois documentadas.

### Fase 4 — Arquitetura e frontend

1. Dividir `use-finance` em sessão, repositórios, comandos, domínio e seletores.
2. Dividir modais por fluxo e lazy-load de visões pesadas.
3. Padronizar estados de loading/erro/sucesso e impedir fechamento prematuro.
4. Preservar acessibilidade, responsividade e temas.

### Fase 5 — Qualidade, observabilidade e documentação

1. Matriz de testes financeira, RLS e E2E crítico.
2. Auditoria de operações, logs sanitizados e monitoramento.
3. Limpeza de dependências/artefatos após confirmação de referências.
4. Atualizar README, contexto técnico, decisões e runbook de migrations/rollback.

## Ordem recomendada para o primeiro lote

O primeiro lote deve ser pequeno, de alto impacto e baixo risco:

1. corrigir o service worker e invalidar `financeiro-v2`;
2. configurar testes/lint sem tocar em regras;
3. adicionar testes que reproduzem a divergência de competência de receita;
4. centralizar e corrigir somente essa regra;
5. preparar, em staging, a migration de RLS e constraints com auditoria dos dados existentes.

Mudanças de RLS, FKs, dinheiro e modelo de recorrência não devem ser aplicadas diretamente em produção sem backup, staging e plano de rollback.

## Validações executadas

- `npx tsc --noEmit`: passou.
- `npm run build`: passou após o lote 1; rota `/` com 396 kB no primeiro carregamento.
- `npm audit --json`: zero vulnerabilidades conhecidas reportadas nas 616 dependências instaladas.
- `npm run lint`: passou sem erros e agora ignora também o bundle local isolado; há avisos legados a reduzir incrementalmente.
- `npm test`: 41 testes passaram, cobrindo calendário/competência, serialização financeira, idempotência, PWA, contratos arquiteturais, estados vazios honestos, resiliência de formulários administrativos e recorrências estruturais.
- Suíte SQL local: 121 testes pgTAP passaram, cobrindo RLS, compatibilidade de schema, referências entre famílias, operações atômicas, idempotência, faturas, recorrências estruturais e exclusões protegidas.
- `npm run supabase:lint`: nenhum erro de schema encontrado.

## Implementação realizada — lote 1

1. **Cache seguro:** o service worker foi atualizado para `financeiro-v3`, remove caches antigos, ignora qualquer requisição externa ou não-GET e limita o armazenamento ao shell e a arquivos estáticos locais.
2. **Regra única de receita:** `resolverAgendamentoReceita` passou a calcular, em conjunto, a data bancária de recebimento e a competência derivada da data contratual. Criação, edição, parcelamento e estado otimista usam a mesma função.
3. **Testes de caracterização:** foram cobertos dia útil comum, fim de semana na virada de competência, primeiro dia do mês, último dia do ano e ano bissexto. A política do service worker também foi testada contra cache de APIs externas, endpoints locais, mutações, arquivos estáticos e navegação offline.
4. **Qualidade:** ESLint foi migrado para a configuração compatível com Next.js/TypeScript e Vitest foi incorporado aos scripts do projeto.
5. **Documentação:** README e contexto técnico foram alinhados à stack, às variáveis Supabase e às verificações atuais.

As mudanças de RLS e constraints estão preparadas localmente e tiveram compatibilidade remota verificada; continuam pendentes de backup, adoção do histórico, ensaio em staging e janela de publicação. Transações e modelo monetário permanecem para lotes futuros.

## Implementação realizada — lote 2

1. **Leitura sem efeitos destrutivos:** `fetchData` deixou de apagar ou desvincular contas fixas concluídas ao abrir ou atualizar a aplicação.
2. **Preservação do histórico:** marcar a última parcela como paga/recebida e quitar parcelas em lote não exclui mais o mestre recorrente. Contratos finitos deixam naturalmente de projetar após `total_parcelas`.
3. **Regra canônica em todas as telas:** projeções mensais, semestrais e radar passaram a usar `resolverAgendamentoReceita`.
4. **Teste de arquitetura:** uma proteção automatizada impede a reintrodução de exclusões de banco dentro de `fetchData`.

Ainda falta modelar formalmente os estados `ativo`, `concluido` e `cancelado` no banco. Até essa migration segura existir, mestres concluídos permanecem preservados e podem ser removidos apenas por uma ação explícita do usuário.

## Implementação realizada — lote 3

1. **Gravações aguardadas:** criação e edição de despesas, receitas, contas fixas e empréstimos agora são aguardadas antes do fechamento do modal.
2. **Rollback comunicado:** os comandos financeiros propagam falhas depois de restaurar o estado otimista, permitindo que a interface reconheça o erro.
3. **Dados do formulário preservados:** em caso de falha, o modal permanece aberto e exibe uma mensagem segura, sem expor detalhes internos do banco.
4. **Proteção contra envio duplicado:** formulários de lançamentos e empréstimos desabilitam ações enquanto a gravação está em andamento.
5. **Status confiável:** alterações rápidas de pago/recebido aguardam o banco e avisam o usuário quando falham.

## Backups inspecionados e Supabase local

Os diretórios `.BaseCSV/` e `.BaseSQL/` contêm exportações de dados das mesmas nove tabelas. Eles não incluem definição de schema, policies, funções, triggers, histórico de migrations nem usuários do `auth`, portanto não substituem um dump estrutural ou `db pull`.

Validações agregadas, sem expor conteúdo pessoal ou financeiro:

- 743 compras de cartão, 300 despesas, 52 receitas, 18 contas fixas, 6 cartões, 6 empréstimos, 3 titulares, 3 perfis e 1 registro de notas;
- nenhum ID primário duplicado;
- nenhuma referência órfã entre lançamentos, titulares, cartões, empréstimos e contas fixas;
- nenhum relacionamento detectado entre famílias diferentes;
- formatos de competência e valores de status compatíveis com o domínio atual;
- duas famílias aparecem nos perfis, mas os dados financeiros exportados pertencem a uma única família;
- o aparente grupo duplicado de receitas é uma recorrência sem prazo: oito competências distintas compartilham `parcela_atual = 1`. Portanto, uma futura constraint não pode assumir unicidade apenas por `(conta_fixa_id, parcela_atual)`; competência deve participar da identidade da ocorrência.

A CLI Supabase 2.117.0 foi fixada como dependência de desenvolvimento, `supabase/config.toml` foi inicializado e um seed vazio/seguro foi criado. Os backups foram adicionados ao `.gitignore`. WSL 2, Docker Desktop e a stack Supabase local estão operacionais; todas as migrations foram aplicadas com sucesso em um reset local completo.

Antes de considerar publicação no projeto remoto, ainda é necessário:

1. confirmar a versão major do PostgreSQL remoto antes de manter `db.major_version = 17`;
2. autenticar a CLI e adotar as quatro versões legadas no histórico, sem executá-las novamente;
3. ensaiar as migrations aditivas em staging com cópia sanitizada/backup e plano de rollback;
4. validar na interface os fluxos reais de titular e membro contra o staging;
5. somente depois aprovar uma janela de publicação.

## Implementação realizada — lote 4

1. **Ambiente reproduzível:** WSL 2, Docker Desktop e Supabase local foram instalados e validados; um reset completo aplicou todas as migrations em banco vazio.
2. **Proteção de identidade:** `family_id`, `tipo`, `email` e `id` do perfil não podem mais ser alterados diretamente por um usuário autenticado.
3. **Papéis no banco:** titulares administram cadastros e dados da família; membros leem o livro familiar, mas só criam, alteram e excluem lançamentos próprios. Convites ficaram restritos ao titular e notas continuam colaborativas.
4. **Matriz RLS:** 17 testes pgTAP verificam isolamento entre famílias, autoelevação, troca de família, convites, lançamentos próprios/alheios e administração pelo titular.
5. **Dependências:** Next.js/ESLint foram atualizados para 15.5.25; dependências transitivas e substituições compatíveis de PostCSS/Sharp eliminaram 14 alertas recém-publicados sem migração para Next 16.

Esta migration existe apenas no repositório e no banco local. Nenhum comando de vínculo, push ou alteração remota foi executado.

## Implementação realizada — lote 5

1. **Reconciliação por export:** os cabeçalhos das nove tabelas exportadas foram comparados com as migrations, sem leitura de valores pessoais. A divergência encontrada ficou restrita a `cartoes_config`.
2. **Campos canônicos de cartão:** `final`, `color` e `icone` agora fazem parte do schema versionado; a migration copia `"Final"` para `final` quando a coluna legada existir e a preserva para rollback.
3. **Compatibilidade imediata:** a gravação granular do frontend também reconhece `"Final"` enquanto a migration ainda não tiver sido publicada.
4. **Relações da mesma família:** FKs compostas por `(family_id, id)` impedem que cartões, contas fixas, empréstimos, despesas ou receitas apontem para cadastros de outra família.
5. **Testes naquele lote:** a matriz do banco cresceu então para 28 testes, incluindo sete tentativas de referência cruzada e quatro verificações de compatibilidade dos cartões.

A sessão autenticada do painel foi usada somente para inspeção. Nenhuma credencial foi copiada para a CLI e nenhuma alteração remota foi executada.

## Implementação realizada — lote 6

1. **Schema remoto confirmado:** as dez tabelas públicas foram inspecionadas pela definição SQL do painel e correspondem ao baseline versionado; `cartoes_config` ainda contém `"Final"` e não contém o campo canônico `final`.
2. **RLS remoto confirmado:** permanecem ativas 13 policies antigas, incluindo `Acesso por Família` como `FOR ALL` para `public` e as quatro policies permissivas de perfil. Isso confirma a necessidade da migration de endurecimento.
3. **Integridade atual:** uma consulta agregada retornou zero inconsistências em onze relações entre cartões, titulares, contas fixas, empréstimos, despesas e receitas.
4. **Histórico ausente:** `supabase_migrations.schema_migrations` não existe no projeto remoto. O runbook exige adoção explícita das quatro versões legadas antes de qualquer dry-run ou push.
5. **Freio contra perda de dados:** a migration consolidada agora recusa bancos que já contenham qualquer tabela do produto antes de alcançar os comandos `DROP TABLE`; um teste Vitest garante que o bloqueio permaneça antes do primeiro DROP.
6. **Operação documentada:** `supabase/REMOTE_DEPLOYMENT.md` descreve backup, staging, reparo do histórico, dry-run e validação pós-migration.

## Implementação realizada — lote 9

1. **Validação sem vazamento:** `backup:validate` confere arquivos esperados, colunas, IDs, referências e identidades naturais sem imprimir conteúdo financeiro ou pessoal.
2. **Restauração isolada:** `backup:rehearse` cria o banco temporário fixo `radar_restore_rehearsal` somente no contêiner local, reproduz o schema remoto legado e cria identidades sintéticas para suprir a ausência de `auth.users`.
3. **Migração com dados reais:** os 1.132 registros públicos foram importados e as sete migrations aditivas passaram sobre eles, incluindo preflights, backfill estrutural de faturas, FKs entre famílias e constraints de idempotência.
4. **Limpeza garantida:** o banco temporário é removido ao final ou após falha; uma consulta posterior confirmou que não permaneceu nenhuma cópia no PostgreSQL local.
5. **Frontend sem troca de segredo:** `dev:local` injeta URL e chave pública apenas no processo, recusa qualquer URL fora de `127.0.0.1:54321` e preserva o `.env` remoto. A instância local foi validada na porta 3002.
6. **Limite do backup documentado:** Auth e Storage não estão incluídos, portanto a exportação atual valida dados/migrations, mas não constitui recuperação integral de produção.

Nenhum comando linked, push ou escrita no projeto Supabase remoto foi executado neste lote.

## Implementação realizada — lote 10

1. **Restauração ativa protegida:** o novo comando recusa qualquer banco local não vazio, exige explicitamente `127.0.0.1:54321/54322` e repete o ensaio descartável antes de substituir o schema público.
2. **Autoria histórica preservada:** três identidades locais não autenticáveis mantêm os UUIDs usados pelas FKs; um quarto usuário é criado pela API oficial do Auth somente para login local.
3. **Família escolhida sem heurística pessoal:** a associação só ocorre quando exatamente uma família possui dados financeiros. O acesso local recebe papel de titular nessa família e a operação aborta em qualquer ambiguidade.
4. **Dados restaurados:** permaneceram 743 compras, 300 despesas, 52 receitas, 18 contas fixas, 6 cartões, 6 empréstimos, 3 titulares, 3 perfis históricos e 1 nota; as 41 faturas antigas receberam vínculo estrutural.
5. **Validação ponta a ponta:** login por senha, visibilidade via RLS, 30 testes Vitest, 92 testes pgTAP e lint do schema passaram sobre o banco restaurado.
6. **Bundles separados:** após detectar interferência entre dois processos Next no mesmo `.next`, `NEXT_DIST_DIR=.next-local` passou a isolar a porta local. A porta 3000 foi confirmada com o host remoto e a 3002 somente com `127.0.0.1:54321`.

O estado anterior do banco local era comprovadamente vazio; `npm run supabase:reset` é o rollback completo e reproduzível. Nenhuma escrita remota ocorreu.

## Implementação realizada — lote 11

1. **Sessão e RLS na interface:** o acesso local autenticado carregou perfil e dados da família restaurada. Um token inicialmente recusado por diferença transitória de relógio passou após o tempo normal de tolerância e novo carregamento; não houve recorrência.
2. **Dashboard:** indicadores, gráfico, categorias, faturas e extrato recente renderizaram lançamentos do período selecionado.
3. **Cartões:** os seis cartões foram carregados, com faturas, projeção e detalhamento de compras parceladas.
4. **Despesas e receitas:** filtros, titulares e lançamentos consolidados apareceram sem erros de coluna, RLS ou referências.
5. **Radar:** contratos, parcelas pendentes, valor presente e projeções foram calculados sobre os dados restaurados.
6. **Correção visual:** o wrapper imediato do avatar do cabeçalho passou a ter posicionamento relativo, eliminando o aviso do `next/image` com `fill`.
7. **Isolamento confirmado:** nenhuma nova chamada ou erro apontou para o Supabase remoto; a porta 3002 permaneceu ligada apenas ao endpoint local.

O smoke foi somente leitura: nenhum lançamento, status, perfil ou configuração financeira foi modificado.

## Implementação realizada — lote 12

1. **Gráfico honesto:** a evolução mensal não usa mais uma série fixa de receitas e despesas quando não há projeção; a tela apresenta um estado vazio explicativo.
2. **Cartões reais:** dashboard e visão de cartões deixaram de criar cartões demonstrativos quando o cadastro está vazio.
3. **Sem dados pessoais de fallback:** nomes de titulares e finais de cartão pré-definidos foram removidos dos presets visuais; apenas cores e estilos institucionais permanecem.
4. **Limite desconhecido preservado:** cartão sem limite cadastrado mostra “Não informado”, em vez de assumir R$ 10 mil ou converter ausência em zero.
5. **Projeções rastreáveis:** a projeção futura não aplica mais decaimento heurístico sobre a fatura atual; usa apenas faturas e parcelas encontradas nos registros.
6. **Quitação sem exemplo oculto:** a simulação vazia retorna zero, sem totais nominais, descontos ou valores presentes pré-fabricados.
7. **Proteção automatizada:** três testes estáticos impedem a reintrodução dos fallbacks financeiros removidos.

O lote foi validado com dados restaurados no navegador e permaneceu somente leitura. Nenhuma escrita foi feita no Supabase local ou remoto.

## Implementação realizada — lote 13

1. **Contrato assíncrono:** perfil, titulares e cartões agora aguardam a conclusão real do comando antes de fechar o modal.
2. **Falhas propagadas:** os comandos administrativos deixam de ocultar erros de gravação; sessão ausente e respostas incompletas também são tratadas como falha.
3. **Dados preservados:** cada formulário permanece aberto após erro e mostra uma mensagem segura, sem expor detalhes internos do banco.
4. **Envio único:** botões de confirmação ficam bloqueados durante upload ou gravação e exibem o estado “Salvando...”.
5. **Rollback de cartão:** uma edição otimista que falhar restaura a configuração anterior.
6. **Sincronizações complementares:** falha ao copiar foto entre perfil e titular não transforma uma gravação principal já concluída em falso fracasso.
7. **Proteção automatizada:** cinco testes adicionais cobrem espera, mensagens de erro, propagação de falhas e rollback.
8. **Validação visual:** os formulários de titular, cartão e perfil foram abertos e fechados sem submissão; o console permaneceu sem erros.

O teste visual foi deliberadamente somente leitura. Nenhum cadastro ou dado financeiro foi criado, alterado ou removido no Supabase local ou remoto.

## Implementação realizada — lote 14

1. **Histórico preservado no banco:** oito chaves estrangeiras de titulares e cartões usam `ON DELETE RESTRICT`; nenhuma exclusão administrativa pode mais apagar lançamentos em cascata ou remover sua atribuição.
2. **Exclusão ainda disponível:** titulares e cartões sem qualquer uso continuam podendo ser removidos normalmente.
3. **Falha segura na interface:** a confirmação avisa a regra antes da ação; se o cadastro estiver em uso, o estado otimista é restaurado, o modal permanece aberto e uma mensagem segura explica a preservação.
4. **Confirmação única:** confirmações nativas duplicadas nas definições foram removidas em favor do modal acessível da aplicação.
5. **Compatibilidade com o backup:** a migration passou sobre todos os registros restaurados no banco temporário, com contagens finais idênticas e limpeza automática da cópia de ensaio.
6. **Proteção automatizada:** doze novos testes pgTAP verificam as oito relações e os fluxos de exclusão; um teste Vitest impede a reintrodução da confirmação duplicada ou do fechamento prematuro.
7. **Validação visual:** o aviso de preservação foi aberto no ambiente local e cancelado; o navegador não registrou erros e a contagem confirmou que nenhum titular foi removido.

A migration foi aplicada e registrada apenas no Supabase local. O projeto Supabase remoto permaneceu sem alterações.

## Implementação realizada — lote 15

1. **Identidade persistida:** compras materializadas de uma recorrência de cartão agora armazenam o mestre e o número da ocorrência.
2. **Backfill conservador:** os vínculos históricos compatíveis foram migrados somente após validar cartão, descrição, valor, parcela, competência, ausência de ambiguidade e ausência de duplicidade.
3. **Unicidade e imutabilidade:** o banco impede duas compras para a mesma ocorrência e impede alterar sua identidade depois da criação.
4. **Materialização segura:** editar uma ocorrência virtual chama uma RPC transacional e idempotente por identidade natural; retries atualizam a mesma linha.
5. **Série preservada:** excluir uma ocorrência virtual não remove mais o cadastro recorrente inteiro e orienta o usuário a administrar a série nas definições.
6. **Compatibilidade gradual:** o fallback textual só é usado enquanto o schema remoto antigo não expuser as colunas estruturais; após a migration, a projeção usa exclusivamente IDs.
7. **Validação:** o ensaio do backup preservou todas as contagens; não ficaram vínculos órfãos nem ocorrências duplicadas. Passaram 41 testes Vitest, 121 testes pgTAP, TypeScript e lint sem erros.

A migration foi aplicada e registrada somente no Supabase local. Nenhuma leitura adicional ou escrita foi feita no projeto remoto.

## Implementação realizada — lote 16

1. **Encerramento em vez de exclusão:** o comando das definições agora chama `encerrar_conta_fixa` e registra `cancelado`, instante e responsável, sem apagar o mestre.
2. **Histórico preservado:** despesas, receitas e compras de cartão mantêm seus vínculos; as FKs de despesas e receitas passaram de `SET NULL` para `RESTRICT`.
3. **Estados formais:** `contas_fixas` possui os estados `ativo`, `concluido` e `cancelado`, com constraints que impedem combinações de auditoria inválidas.
4. **Transições protegidas:** alterações diretas ou exclusões do mestre por usuários autenticados são recusadas; repetir o mesmo encerramento é idempotente e trocar um estado terminal é proibido.
5. **Sem novas ocorrências:** triggers comuns a despesas, receitas e cartões impedem materializar lançamentos vinculados a uma série encerrada.
6. **Projeções coerentes:** dashboard, alertas, receitas, cartões, visão semestral e radar projetam somente séries ativas; ambientes ainda sem a coluna tratam registros legados como ativos.
7. **Interface auditável:** séries encerradas permanecem nas definições com indicação visual e ações desabilitadas; o comando foi renomeado para “Encerrar série”.
8. **Validação:** o ensaio do backup preservou todas as contagens, 42 testes Vitest e 145 testes pgTAP passaram, assim como TypeScript e lint. A verificação visual local confirmou o novo comando sem executar nenhuma alteração de dados.

A migration foi aplicada e registrada somente no Supabase local. O projeto Supabase remoto permaneceu intocado.

## Implementação realizada — lote 17

1. **Exceção não destrutiva:** “Ignorar ocorrência” registra a identidade da ocorrência em `contas_fixas_excecoes`, sem apagar lançamentos históricos nem o mestre da recorrência.
2. **Encerramento parcial:** “Encerrar daqui em diante” grava o primeiro número de ocorrência bloqueado e mantém válidas todas as ocorrências anteriores.
3. **Banco como autoridade:** triggers recusam novas despesas, receitas e compras de cartão para ocorrências ignoradas ou posteriores ao ponto de corte, inclusive quando a escrita tenta contornar a interface.
4. **Permissões mínimas:** clientes autenticados podem consultar as exceções da própria família, mas inserções e mudanças passam somente pelas RPCs protegidas e auditadas.
5. **Projeções coerentes:** despesas, receitas, cartões e radar usam a mesma regra de corte e removem das projeções as ocorrências ignoradas.
6. **Compatibilidade gradual:** a leitura da tabela de exceções é opcional enquanto o remoto ainda não recebeu a migration; configurações legadas sem ponto de corte continuam ativas.
7. **Interface explícita:** ao excluir uma ocorrência recorrente, o usuário escolhe entre ignorar só aquela ocorrência ou encerrar dali em diante; o comando de encerrar a série inteira continua disponível nas definições.
8. **Validação:** passaram 46 testes Vitest, 178 testes pgTAP, TypeScript e lint. O ensaio restaurou e conferiu os 1.132 registros públicos do backup, e a interface local exibiu as duas opções sem executar nenhuma delas.

A migration foi aplicada e registrada somente no Supabase local. O projeto Supabase remoto permaneceu intocado.

## Implementação realizada — lote 18

1. **Período como referência:** despesas, receitas e compras de cartão são buscadas pelas seis competências iniciadas no mês escolhido, e não por uma data relativa ao dia atual.
2. **Histórico sem truncamento:** cada consulta financeira consome páginas de 500 registros até a última página, evitando o limite implícito do servidor.
3. **Alertas preservados:** despesas antigas ainda em aberto são carregadas por uma consulta separada, mesmo fora da janela visível.
4. **Vínculos completos:** despesas ligadas a empréstimos e contas fixas continuam disponíveis integralmente para quitação, deduplicação e auditoria.
5. **Cache por janela:** cada intervalo possui uma chave própria; navegar para um período antigo nunca reaproveita o snapshot parcial de outro mês.
6. **Concorrência segura:** um identificador crescente descarta respostas atrasadas quando o usuário muda de período rapidamente.
7. **Validação automatizada:** 53 testes Vitest passaram, incluindo virada de ano, paginação, falhas de página, cache por janela e contrato de consulta; TypeScript e lint também passaram.
8. **Validação visual:** fevereiro de 2026, fora do antigo corte, exibiu 28 lançamentos acionáveis no ambiente local. O período atual foi restaurado em seguida e nenhuma gravação foi executada.

Este lote não possui migration. O Supabase local foi usado somente para leitura durante a validação, e o projeto remoto permaneceu intocado.

## Implementação realizada — lote 19

1. **Regra monetária única:** `lib/money.ts` converte os valores para centavos inteiros antes de somar, subtrair ou multiplicar e aplica arredondamento de meio centavo para longe de zero.
2. **Fronteiras protegidas:** valores vindos do banco, formulários, edições rápidas, recorrências, parcelamentos, empréstimos e RPCs são normalizados antes de entrar no estado ou serem persistidos.
3. **Totais coerentes:** dashboard, cartões, despesas/receitas, radar, projeções, limites e quitações usam as mesmas operações canônicas, inclusive para créditos e estornos negativos.
4. **Valor presente explícito:** cada parcela simulada é arredondada a centavos antes da soma; a taxa percentual mantém sua precisão própria e o desconto usa subtração monetária canônica.
5. **Compatibilidade verificada:** as colunas monetárias do schema já possuem escala de duas casas e uma leitura da cópia local encontrou zero valores fora dessa escala; nenhuma migration foi necessária.
6. **Validação automatizada:** passaram 62 testes Vitest, incluindo casos clássicos de ponto flutuante, formatos monetários, arredondamento positivo e negativo e valor presente; TypeScript, lint e build de produção também passaram.
7. **Validação visual:** a aplicação local continuou exibindo o período, cartões e totais sem `NaN` ou `Infinity`, sem executar comandos de gravação.

Este lote não possui migration. O Supabase local foi usado somente para leitura de compatibilidade, e o projeto remoto permaneceu intocado.

## Implementação realizada — lote 20

1. **Projeção canônica:** `lib/cashflow-projection.ts` passou a calcular a sequência mensal de receitas, despesas regulares, faturas, saída total e saldo.
2. **Mesma regra em duas telas:** o painel semestral e o radar deixaram de manter cópias independentes dos loops de recorrências, contas fixas, empréstimos e faturas.
3. **Filtro integral por titular:** receitas, despesas, contratos, cartões e transações respeitam o mesmo filtro opcional em toda a projeção.
4. **Recorrências consistentes:** séries encerradas, ocorrências ignoradas e parcelas já materializadas são tratadas por uma única regra compartilhada.
5. **Faturas estruturais:** o radar deixou de procurar faturas por trechos do nome do cartão; agora usa o vínculo estrutural e apenas o fallback legado exato já adotado pelo painel.
6. **Detalhamento preservado:** a projeção canônica mantém despesas regulares e faturas separadas, além do total consolidado, permitindo que cada gráfico apresente o detalhamento necessário sem recalcular o domínio.
7. **Validação:** passaram 67 testes Vitest, TypeScript, lint e build de produção. Após recarregar o ambiente local, o radar exibiu a projeção de 12 meses sem `NaN`, `Infinity` ou novos erros no console.

Este lote não possui migration. A validação visual foi somente de leitura e o projeto Supabase remoto permaneceu intocado.

## Implementação realizada — lote 21

1. **Domínio de cartões:** `lib/card-projection.ts` centraliza os totais por cartão, o valor efetivo de cada fatura e a projeção mensal.
2. **Competências reais:** o gráfico de seis meses consome todas as transações reais e virtuais já projetadas, em vez de extrapolar o mês atual pelo número de parcelas restantes.
3. **Faturas coerentes:** faturas pagas preservam o valor registrado; faturas abertas usam as transações da competência e mantêm o valor persistido como fallback.
4. **Identidade segura:** a resolução usa `cartao_vencimento_id` e somente o fallback legado exato. Categoria, prefixo e trechos do nome deixaram de decidir a associação.
5. **Créditos preservados:** competências com total negativo por estorno ou crédito permanecem na projeção e nos totais.
6. **Integração compartilhada:** o fluxo de caixa e `totalsByCard` passaram a reutilizar as mesmas funções puras da tela de cartões.
7. **Validação:** passaram 72 testes Vitest, TypeScript, lint e build de produção. A tela local exibiu o gráfico de seis meses sem `NaN`, `Infinity` ou novos erros no console.

Este lote não possui migration. A validação visual foi somente de leitura e o projeto Supabase remoto permaneceu intocado.

## Implementação realizada — lote 22

1. **Árvore de referências conferida:** `FinanceTable`, `FilterBar`, `SummaryCards` e `CardProjectionChart` não eram renderizados nem importados por nenhum módulo ativo.
2. **Código morto removido:** `components/finance-views.tsx` e sua importação órfã em `app/page.tsx` saíram do bundle e da manutenção futura.
3. **Histórico preservado:** `_backup/` não foi apagado; passou a ficar explicitamente fora da compilação TypeScript ativa.
4. **Regressão bloqueada:** um teste arquitetural impede restaurar o import ou o módulo legado sem uma decisão consciente.
5. **Validação:** passaram 73 testes Vitest, TypeScript, lint e build de produção. Após recarregar a aplicação, a visão de cartões e seu gráfico continuaram presentes, sem `NaN`, `Infinity` ou novos erros no console.

Este lote não possui migration. A validação visual foi somente de leitura e o projeto Supabase remoto permaneceu intocado.

## Implementação realizada — lote 23

1. **Seletores canônicos:** `lib/finance-selectors.ts` centraliza total de receitas, despesas, saldo, resumo por status, vencidos, totais por titular e dívida em aberto.
2. **Hook simplificado:** `useFinance` deixou de calcular essas agregações diretamente e passou a expor resultados dos seletores puros.
3. **Receitas virtuais sem convenção de ID:** totais por titular usam toda a coleção consolidada uma única vez, sem depender de IDs negativos para incluir projeções.
4. **Filtro coerente:** competência e titular são tratados dentro do seletor; o score mensal do Radar agora acompanha o titular selecionado em vez de continuar usando a família inteira.
5. **Tela de lançamentos alinhada:** receitas, despesas e saldo exibidos na visão detalhada usam a mesma aritmética do resumo principal.
6. **Contrato arquitetural:** testes impedem que hook, Radar e tela de lançamentos voltem a implementar somas financeiras próprias.
7. **Validação:** passaram 78 testes Vitest, TypeScript, lint e build de produção. O filtro de titular foi ativado e restaurado no Radar local, mantendo a projeção sem `NaN`, `Infinity` ou novos erros no console.

Este lote não possui migration. A validação visual foi somente de leitura e o projeto Supabase remoto permaneceu intocado.

## Implementação realizada — lote 24

1. **Indicadores explícitos:** o painel identifica receitas, despesas, margem e saldo do gráfico como valores previstos, sem sugerir disponibilidade bancária.
2. **Status coerentes:** receitas recebidas e pendentes são separadas; uma receita recorrente apenas projetada não vira “recebida” por ter passado da data. Despesas pagas e não pagas compõem grupos complementares, e vencidas são um subconjunto das não pagas.
3. **Titulares alinhados:** despesas vencidas continuam no total da competência do titular, como já ocorria no total global.
4. **Radar sem número inventado:** o score usa a projeção canônica do mês e o filtro de titular; sem receita prevista, exibe ausência de base em vez de um número fixo.
5. **Reserva honesta:** a indicação fixa de meses de emergência foi removida, pois o produto ainda não registra o saldo dessa reserva.
6. **Validação:** 81 testes Vitest, TypeScript, lint e build de produção passaram. O novo rótulo do Radar foi visto na instância local no início do lote, sem `NaN`, `Infinity` ou erros novos; após a parada do serviço local, a conferência visual final ficou pendente.

Este lote não possui migration. A validação visual foi somente de leitura e o projeto Supabase remoto permaneceu intocado.

## Implementação realizada — lote 25

1. **Projeção mais leve:** receitas recorrentes, contas fixas e empréstimos agora consultam índices em memória de parcelas já materializadas, criados uma única vez por projeção, em vez de varrer todos os lançamentos para cada ocorrência de cada mês.
2. **Filtro antecipado:** contas e cartões do titular selecionado são filtrados uma vez, fora do loop mensal.
3. **Compatibilidade preservada:** as duas formas legadas de reconhecer uma receita recorrente materializada — competência ou número de parcela — continuam válidas.
4. **Escopo limitado:** o formato e os valores da projeção não mudaram; esta melhoria não substitui medições reais de consulta nem resolve o carregamento inicial excessivo descrito em M1.
5. **Validação:** 82 testes Vitest, TypeScript, lint e build de produção passaram.

Este lote não possui migration nem alteração de dados. O Supabase remoto permaneceu intocado.

## Implementação realizada — lote 26

1. **Telas sob demanda:** Lançamentos, Cartões, Radar e Definições passaram a usar carregamento dinâmico; o Dashboard permanece disponível no carregamento inicial.
2. **Transição acessível:** a primeira abertura de cada tela apresenta um estado de carregamento com `role="status"`.
3. **Medição de build:** a rota principal passou de 299 kB próprios/401 kB no primeiro carregamento para 276 kB próprios/379 kB, redução de 22 kB na carga inicial reportada pelo Next.
4. **Regressão:** um teste impede a volta dos imports estáticos; passaram 83 testes Vitest, TypeScript, lint e build de produção.

Este lote não possui migration nem alteração de dados. O Supabase remoto permaneceu intocado.

## Implementação realizada — lote 27

1. **Cache efêmero:** snapshots financeiros agora vivem apenas na memória da aba, separados por usuário/janela e limitados a seis entradas; o banco permanece a fonte de verdade.
2. **Troca de sessão:** saída ou mudança de conta limpa estado e cache financeiros e invalida respostas antigas, inclusive a leitura de perfil que ainda estivesse pendente.
3. **Legado:** ao iniciar, o cliente remove somente as chaves `fin_cache_` persistidas por versões antigas, sem ler/descompactar dados nem apagar preferências de tema. Essa limpeza ocorrerá no próximo acesso do navegador à versão atualizada.
4. **Remoção da compressão:** o módulo antigo e a dependência `fflate` saíram do caminho crítico. O build final isolado mediu 271 kB próprios/374 kB iniciais na rota `/`, ante 276 kB/379 kB no lote 26.
5. **Regressão:** 88 testes Vitest, TypeScript, lint e build de produção passaram; a verificação visual local ficou pendente porque a aplicação não estava disponível no navegador durante este lote.

Não houve migration nem alteração no Supabase remoto. O cache de sessão gerido pela biblioteca de autenticação não foi modificado.

## Implementação realizada — lote 28

1. **Leituras vinculadas:** as duas consultas completas de despesas ligadas a empréstimos e contas fixas foram reunidas com `OR`, preservando paginação, ordenação, RLS e deduplicação. Na primeira página, `fetchData` passa de 12 para 11 solicitações de leitura; páginas adicionais dependem do volume de dados.
2. **Cadastros sem vínculos:** exclusão de titular ou cartão deixa de recarregar o histórico inteiro após a exclusão bem-sucedida; a interface reaplica a remoção local, invalida respostas pendentes e esvazia snapshots temporários. A proteção por FK e o rollback em caso de erro permanecem.
3. **Perfil:** a alteração da foto atualiza o titular correspondente localmente após confirmação do banco. Uma mudança de família ainda força recarga integral, pois altera o escopo dos dados.
4. **Medição:** pelo plano de consultas, cada uma dessas três ações comuns evita até 11 solicitações de leitura na primeira página, além das páginas adicionais. Isso mede chamadas evitadas, não latência real. O serviço local na porta 3002 não respondeu durante este lote, portanto o tempo de interação e o comportamento visual ainda precisam de medição integrada.
5. **Regressão:** 90 testes Vitest, TypeScript, lint e build de produção passaram; a rota inicial permaneceu em 271 kB próprios/374 kB iniciais no build isolado.

Não houve migration nem alteração no Supabase remoto.

## Lote 29 — concluído localmente

1. **Exclusão de empréstimo:** o cliente deixou de fazer `UPDATE` seguido de `DELETE`; a FK existente desvincula despesas históricas na mesma transação da exclusão. Falhas agora retornam ao chamador após restaurar a interface.
2. **Categorias:** duas RPCs transacionais renomeiam e reclassificam em todas as tabelas aplicáveis, com escopo familiar e RLS. Uma falha reverte a operação inteira no banco migrado; o cliente interrompe a sequência, recarrega o estado salvo e mostra aviso. No remoto ainda não migrado, mantém o fallback sequencial, cujas falhas podem deixar alterações parciais visíveis.
3. **Registros operacionais:** fluxos financeiros centrais e uploads de avatar registram somente nome fixo da operação e código validado; mensagens e objetos de erro, que poderiam conter dados privados, não entram nesses logs.
4. **Atomicidade ensaiada:** `supabase/migrations/20260920000000_atomic_category_updates.sql` foi testada em banco isolado, aplicada somente ao Supabase local e ensaiada sobre o backup restaurado. Os 17 testes pgTAP novos verificam reversão após falha na última tabela e isolamento familiar. O cliente chama as RPCs primeiro e só retorna ao fluxo legado se a função ainda não existir. Compras usam `estabelecimento`, não `descricao`.
5. **Fallback de cartão:** `sendCartaoInsert` e `sendCartaoUpdate` fazem uma única gravação completa por tentativa. Só repetem com o payload legado (`"Final"`) quando falta a coluna canônica; falhas restantes são propagadas, sem sucesso falso ou gravações opcionais parciais. O cabeçalho do backup confirmou a coluna legada, sem leitura de valores.
6. **Validação:** 107 testes Vitest, 195 pgTAP, TypeScript, lint e build de produção passaram (271 kB próprios/374 kB iniciais). O ensaio do backup conferiu 1.132 registros públicos após todas as migrations aditivas e removeu o banco temporário. A porta 3002 e os fluxos interativos alterados ainda precisam de regressão visual no lote 30.

A migration de categorias foi aplicada somente ao Supabase local; o projeto remoto permaneceu intocado.

## Lote 30 — regressão integrada e pacote local

1. **Gravação de cartões:** a escolha entre payload canônico e legado foi extraída para uma função testável. Quatro novos testes cobrem sucesso direto, retry único com payload completo, erro de permissão sem retry e falha da tentativa legada sem sucesso falso.
2. **Interface:** a aplicação local respondeu na porta 3002. Painel e cartões carregaram com a cópia restaurada, e o formulário de novo lançamento abriu e fechou sem gravação; não apareceram erros de console. A UI não foi usada para criar, alterar ou excluir registros do histórico restaurado.
3. **Regressão:** 115 testes Vitest, 195 pgTAP, TypeScript, lint e build de produção passaram. A restauração isolada conferiu 1.132 registros públicos, aplicou todas as migrations aditivas e removeu o banco temporário.
4. **Restaurador local:** o comando protegido de restauração foi alinhado à mesma sequência completa de migrations do ensaio, inclusive exceções de recorrência e RPCs de categorias. Ele continua recusando o banco ativo com dados e requer confirmação explícita.
5. **Staging:** um projeto Supabase separado foi criado, sem backup ou dado de produção. A CLI foi vinculada, o dry-run confirmou as 17 migrations e elas foram aplicadas somente nele. A Data API permanece ligada, mas a exposição automática de tabelas foi desativada; a migration de permissões explícitas concede o mínimo necessário a `authenticated` e revoga acesso de `anon` às tabelas financeiras.
6. **Validação no staging sintético:** três contas sintéticas validaram titular, membro e usuário externo. O membro herdou a família via convite; o externo não leu a família alheia; e uma escrita de despesa autenticada do titular foi confirmada e revertida na mesma transação, sem persistir dado financeiro de teste. O titular entrou pela interface conectada ao staging, navegou por painel, cartões, lançamentos e radar, e completou criação, edição e exclusão de um titular, cartão e despesa sintéticos. A limpeza dos três cadastros foi confirmada e não houve erros no console.
7. **Entrega:** documentação de adoção remota e checklist local atualizados. Backups e arquivos de ambiente continuam fora do Git. A produção não foi modificada. Escritas interativas persistentes em staging ainda são condição de publicação, não parte da validação sobre a cópia pessoal restaurada.

Essa é uma estimativa, não autorização para publicar. Adoção de migrations e implantação no Supabase remoto exigem backup recente, staging e decisão separada. Contas bancárias/ledger continuam fora desta etapa.

## Pontos que exigem confirmação antes de migrations de alto impacto

1. Versão major do PostgreSQL e funções/triggers efetivamente ativos no Supabase remoto.
2. Duplicidades exigidas pelas futuras constraints de idempotência; relações cross-family atuais já foram verificadas e estão limpas.
3. Definição de competência de receita quando a data cai em fim de semana/feriado.
4. Se “valor do lançamento parcelado” significa valor de cada parcela ou valor total da compra.
5. Se o produto deve permanecer orçamento por competência ou evoluir para contas bancárias/ledger.
6. Regras brasileiras de feriados e timezone oficial do domínio.
