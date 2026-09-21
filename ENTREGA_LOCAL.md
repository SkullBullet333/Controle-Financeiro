# Entrega local — Radar Financeiro

Estado em 20/09/2026: os 30 lotes locais da auditoria foram implementados e validados. Este pacote está pronto para ensaio em staging, **não** para publicação direta no Supabase de produção.

## Validação concluída

- 115 testes Vitest e 195 testes pgTAP passaram.
- TypeScript, lint e build de produção passaram.
- O backup foi restaurado em banco descartável, todas as migrations aditivas foram aplicadas e as contagens finais conferiram. O banco descartável foi removido.
- A aplicação local carregou painel e cartões; o formulário de lançamento abriu e fechou sem gravação e não houve erros no console.
- O projeto Supabase remoto não foi alterado. Nenhum registro financeiro restaurado foi modificado para os testes de interface.

## Limites desta entrega

- As RPCs atômicas de categorias foram aplicadas somente ao Supabase local. Até sua adoção remota, o cliente usa o fluxo legado sequencial apenas quando a função ainda não existe.
- Os testes automatizados cobrem a gravação de cartões e as operações de banco, mas não substituem um ensaio interativo de criação, edição e exclusão em staging.
- As pastas `.BaseCSV/` e `.BaseSQL/` contêm backup sensível e permanecem ignoradas pelo Git; não devem entrar em commits ou pacotes públicos.
- `npm run backup:restore:local` é intencionalmente recusado quando o banco local contém dados. Ele foi alinhado a todas as migrations aditivas e deve ser usado somente após o ensaio isolado.
- A migration `20260921000000_explicit_authenticated_data_access.sql` torna explícito o acesso da Data API para usuários autenticados e mantém `anon` sem privilégio sobre as tabelas financeiras. Ela permite usar staging sem a opção global de expor tabelas automaticamente.

## Staging criado

O projeto `controle-financeiro-staging` foi criado em 20/09/2026 separado da produção, com Data API habilitada e exposição automática de novas tabelas desabilitada. A CLI local foi vinculada; o dry-run em banco vazio confirmou as 17 migrations e elas foram aplicadas somente nesse projeto.

O histórico do staging corresponde ao repositório. Foram criadas três contas sintéticas: titular, membro da mesma família e usuário externo. Consultas de RLS confirmaram a família compartilhada, o bloqueio do externo e uma escrita de despesa temporária como titular; a escrita foi revertida e não há dados financeiros de teste persistidos. O titular também entrou pela interface de staging: dashboard, cartões, lançamentos e radar exibiram os estados vazios esperados. O ensaio interativo criou, editou e excluiu um titular, um cartão e uma despesa sintéticos; a limpeza foi confirmada na interface e o console não apresentou erros.

Para testar pela interface, use `.env.staging.local` a partir de `.env.staging.example` e `npm run dev:staging`. O arquivo local não é versionado e o script recusa URL de qualquer projeto diferente do staging.

## Próximo marco: adoção no staging

1. Fazer backup recente de produção e restaurá-lo em um projeto de staging.
2. Seguir, na ordem, o procedimento em `supabase/REMOTE_DEPLOYMENT.md`; confirmar o dry-run antes de aplicar migrations.
3. No staging com cópia restaurada da produção, validar novamente os papéis titular, membro e usuário externo, além de renomear/reclassificar categorias e conferir rollback de falhas.
4. Planejar janela e rollback. Publicação em produção requer decisão e autorização separadas.
