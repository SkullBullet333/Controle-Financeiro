# Adoção segura do Supabase remoto

Este projeto remoto já existia antes do versionamento local e, em 12/09/2026, não possuía `supabase_migrations.schema_migrations`. As quatro primeiras migrations representam mudanças que já estão presentes no banco. Elas precisam ser registradas como aplicadas, e não executadas novamente.

Nenhum passo abaixo deve ser feito sem backup recente e ensaio prévio em um projeto de staging. Nunca use `db reset --linked`.

## Estado remoto verificado

- dez tabelas públicas correspondem ao baseline local;
- `cartoes_config` possui a coluna legada `"Final"`, além de `color` e `icone`;
- treze policies antigas e amplas continuam ativas;
- onze relações entre famílias foram verificadas e todas retornaram zero inconsistências;
- o histórico de migrations está ausente;
- nenhuma alteração remota foi feita durante a inspeção.

## Staging atual

Em 20/09/2026 foi criado um projeto de staging vazio e separado, sem backup ou dados de produção. A CLI local foi vinculada, o dry-run confirmou as 17 migrations e elas foram aplicadas somente nesse ambiente. A Data API está habilitada e a exposição automática de tabelas está desabilitada; `20260921000000_explicit_authenticated_data_access.sql` estabelece as permissões necessárias de maneira versionada. Três contas sintéticas validaram os papéis de titular, membro e externo; a escrita financeira de verificação foi revertida. Pela interface, um titular, cartão e despesa sintéticos foram criados, editados e excluídos, com limpeza confirmada. A produção continua sem alterações.

## Procedimento

1. Gere um novo backup de schema e dados e confirme que ele pode ser restaurado.
2. Crie um projeto de staging a partir desse backup.
3. Faça login na CLI local e vincule primeiro o staging.
4. Confira novamente `supabase migration list --linked`.
5. Depois de confirmar a equivalência do schema, adote as versões legadas no histórico do staging:

   ```bash
   supabase migration repair --linked --status applied 20260401000000 20260502000000 20260506000000 20260508000000
   ```

6. Execute somente a simulação:

   ```bash
   npm run supabase:push:dry
   ```

   O resultado esperado deve listar apenas:

   - `20260912000000_harden_family_rls.sql`
   - `20260912010000_cartoes_config_canonical_fields.sql`
   - `20260912020000_same_family_foreign_keys.sql`
   - `20260912030000_atomic_linked_expenses.sql`
   - `20260912040000_atomic_linked_revenues.sql`
   - `20260912050000_idempotent_installment_creation.sql`
   - `20260912060000_structural_card_invoices.sql`
   - `20260913000000_restrict_admin_deletions.sql`
   - `20260913010000_structural_card_recurrences.sql`
   - `20260913020000_fixed_recurrence_lifecycle.sql`
   - `20260913030000_recurrence_occurrence_commands.sql`
   - `20260920000000_atomic_category_updates.sql`
   - `20260921000000_explicit_authenticated_data_access.sql`

   Se a migration `20260401000000_consolidated_schema.sql` aparecer, pare. Não publique.

7. No staging restaurado a partir da produção, aplique as treze migrations aditivas após adotar o baseline, valide os 195 testes de banco localmente e teste na aplicação os papéis de titular, membro e usuário externo, incluindo renomeação e reclassificação de categorias. A última migration concede acesso à Data API somente para usuários autenticados; não reative a exposição automática de tabelas para compensar permissões ausentes.
8. Verifique no staging que `final` recebeu os valores de `"Final"`, que as novas policies estão ativas, que todas as constraints compostas foram validadas, que retries não duplicam quitações ou parcelamentos, que exclusões administrativas preservam o histórico, que faturas/recorrências receberam vínculos estruturais únicos, que encerrar uma série mantém o histórico sem novas projeções e que os comandos de ignorar uma ocorrência ou encerrar dali em diante preservam as ocorrências anteriores.
9. Planeje rollback e janela de manutenção. Repita a adoção do histórico em produção somente após aprovação explícita e refaça o dry-run antes do push.

## Proteção adicional

A migration-base contém um bloqueio antes do primeiro `DROP TABLE`. Se encontrar qualquer tabela do Radar Financeiro, ela encerra com erro sem remover dados. Essa barreira reduz o risco de erro humano, mas não autoriza publicação sem staging, backup e revisão do dry-run.
