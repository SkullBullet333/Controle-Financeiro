# Radar Financeiro

Aplicação web para planejamento financeiro familiar, com despesas, receitas, contas recorrentes, cartões, empréstimos, projeções e relatórios. O frontend usa Next.js e os dados são persistidos no Supabase com autenticação e RLS.

Estado da auditoria e próximos passos de publicação: [ENTREGA_LOCAL.md](ENTREGA_LOCAL.md). A implantação remota tem procedimento separado em [supabase/REMOTE_DEPLOYMENT.md](supabase/REMOTE_DEPLOYMENT.md).

## Requisitos

- Node.js 20.19+ ou 22.12+
- Um projeto Supabase com as migrations deste repositório aplicadas
- Docker Desktop ou outro runtime compatível com a API do Docker, para executar o Supabase local
- PowerShell 7 (`pwsh`) no Windows para o ensaio isolado do backup

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie `.env.local` a partir de `.env.example` e preencha:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

Para abrir a aplicação conectada ao staging, copie `.env.staging.example` para `.env.staging.local`, informe a URL e a chave pública exibidas no botão **Connect** do projeto de staging e execute `npm run dev:staging`. O script aceita apenas o host do staging aprovado e mantém as credenciais apenas no processo em execução.

3. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

## Verificações

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

O lint cobre os arquivos TypeScript/TSX do projeto. A suíte possui 115 testes Vitest para regras de calendário, precisão monetária em centavos, seletores e projeções financeiras canônicas, semântica de status, serialização financeira, idempotência, recorrências, paginação histórica, privacidade do cache, registros operacionais sem dados sensíveis, PWA, contratos arquiteturais e travas do ambiente local.

## Estrutura principal

- `app/`: entrada e layout da aplicação; telas secundárias são carregadas sob demanda.
- `components/`: dashboard, visões e formulários.
- `hooks/use-finance.ts`: sessão, carregamento, comandos e dados derivados.
- `lib/finance-service.ts`: regras financeiras e persistência.
- `lib/money.ts`: normalização, soma, subtração e multiplicação monetárias em centavos inteiros.
- `lib/cashflow-projection.ts`: projeção mensal compartilhada pelo painel e pelo radar, com índices em memória para identificar parcelas já materializadas.
- `lib/card-projection.ts`: totais e projeção de faturas por competência, com identificação estrutural.
- `lib/finance-selectors.ts`: resumo previsto/realizado, status de pagamento, totais por titular, dívida em aberto e score orçamentário.
- `supabase/migrations/`: evolução versionada do banco.
- `supabase/REMOTE_DEPLOYMENT.md`: adoção segura do banco remoto e publicação.
- `AUDITORIA_TECNICA.md`: diagnóstico, riscos e plano incremental de evolução.

## PWA e dados sensíveis

O service worker só armazena o shell local e arquivos estáticos da interface. Requisições externas — inclusive respostas autenticadas do Supabase — não são interceptadas nem gravadas no Cache Storage.

Antes de aplicar migrations de segurança ou integridade em produção, faça backup, valide o schema remoto e ensaie a alteração em staging.

## Supabase local

A CLI oficial está fixada no projeto. Depois de instalar e iniciar o Docker Desktop:

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:reset
npm run supabase:lint
npm run test:db
```

`supabase:reset` atua explicitamente apenas no banco local. A configuração fica em `supabase/config.toml`; o seed versionado é propositalmente vazio para impedir a inclusão de dados reais. Os 195 testes pgTAP em `supabase/tests/` validam isolamento entre famílias, permissões de titular/membro, compatibilidade do schema, relações pertencentes à mesma família, materialização transacional, criação parcelada idempotente, identidades estruturais de faturas/recorrências, encerramento auditável de séries, comandos por ocorrência e alterações atômicas de categorias. Os comandos de backup usam PowerShell 7 e a restauração local reconstrói todas as migrations aditivas antes de importar os dados. A Data API concede acesso às tabelas explicitamente a usuários autenticados, sem depender da opção global de expor tabelas novas.

As pastas `.BaseCSV/` e `.BaseSQL/` são backups locais sensíveis e estão ignoradas pelo Git. Não copie seu conteúdo para `supabase/seed.sql`.

Antes de qualquer publicação, valide e ensaie o backup no PostgreSQL local:

```bash
npm run backup:validate
npm run backup:rehearse
```

O ensaio cria o banco temporário `radar_restore_rehearsal` dentro do contêiner local, reproduz o schema legado, cria identidades sintéticas apenas para satisfazer as referências ausentes de `auth.users`, importa os dados, aplica todas as migrations aditivas e confere as contagens. Ao terminar, o banco temporário é removido, inclusive em caso de falha. O processo usa somente o contêiner `supabase_db_controle-financeiro` e não lê as variáveis do projeto remoto.

Esse backup não inclui credenciais de autenticação nem arquivos do Storage. Ele serve para validar dados e migrations; a recuperação integral de produção ainda exige backups separados de Auth e Storage.

Para abrir a aplicação contra o Supabase local, sem substituir o `.env` que aponta para o projeto remoto, use:

```bash
npm run dev:local
```

O iniciador aceita somente `http://127.0.0.1:54321`, obtém a chave pública diretamente da CLI, mantém a chave fora dos arquivos e usa a pasta isolada `.next-local` para não misturar bundles nem variáveis com a instância padrão. A porta inicial é `3001`; use `npm run dev:local -- -Port 3002` quando ela estiver ocupada.

Depois que o ensaio passar, um banco local vazio pode receber a cópia validada:

```bash
npm run backup:restore:local
```

O comando recusa bancos que já contenham qualquer usuário ou lançamento, repete o ensaio isolado, restaura os dados no banco local ativo e cria um acesso temporário pela API Auth local. A senha aparece uma única vez e não é salva. Se for necessário voltar ao estado vazio, use `npm run supabase:reset`. A restauração nunca aceita URL fora das portas locais `54321`/`54322`.

> **Atenção:** o projeto remoto foi inspecionado em modo somente leitura e não possui a tabela de histórico `supabase_migrations.schema_migrations`. Não execute `supabase db push` nem `db reset --linked` antes de seguir [o procedimento de adoção](supabase/REMOTE_DEPLOYMENT.md). A migration inicial agora aborta antes do primeiro `DROP TABLE` quando encontra um banco existente, mas não substitui a reconciliação do histórico.

As migrations de RLS, compatibilidade dos cartões, integridade entre famílias, materialização atômica, idempotência, faturas, exclusões protegidas, recorrências estruturais, ciclo de vida auditável e comandos por ocorrência foram validadas no Supabase local. Uma ocorrência recorrente pode ser ignorada sem apagar o registro histórico, e a série pode ser encerrada a partir de um ponto sem afetar ocorrências anteriores. Em 12/09/2026, a estrutura e as policies remotas foram comparadas pelo painel: as dez tabelas correspondem ao baseline, as policies amplas antigas ainda estão ativas e os onze vínculos familiares verificados não apresentam inconsistências. A publicação continua condicionada a backup recente, adoção do histórico e ensaio em staging.

O carregamento financeiro acompanha o período selecionado: despesas, receitas e compras de cartão são buscadas em páginas para doze competências consecutivas, o mesmo intervalo do gráfico de evolução mensal. Cada janela possui cache temporário em memória, isolado por usuário, e a navegação entre meses preserva o último resultado enquanto atualiza a próxima janela em segundo plano. O cache é descartado ao sair ou trocar de conta e não oferece acesso offline aos dados financeiros. Ao abrir a aplicação, snapshots financeiros persistidos por versões antigas são removidos do navegador, sem apagar outras preferências. Pendências vencidas continuam sendo carregadas separadamente para os alertas, mesmo quando pertencem a um período anterior.
