import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('segurança da migration de bootstrap', () => {
  it('recusa banco existente antes do primeiro DROP TABLE', () => {
    const source = readFileSync(
      new URL('./migrations/20260401000000_consolidated_schema.sql', import.meta.url),
      'utf8',
    );

    const guardPosition = source.indexOf("MESSAGE = 'Bootstrap recusado:");
    const firstDropPosition = source.indexOf('DROP TABLE');

    expect(guardPosition).toBeGreaterThanOrEqual(0);
    expect(firstDropPosition).toBeGreaterThan(guardPosition);
    expect(source.slice(0, firstDropPosition)).toContain(
      "table_schema = 'public'",
    );
  });
});

describe('proteção do histórico ao excluir cadastros administrativos', () => {
  it('restringe todas as relações de titulares e cartões', () => {
    const source = readFileSync(
      new URL('./migrations/20260913000000_restrict_admin_deletions.sql', import.meta.url),
      'utf8',
    );

    const protectedConstraints = [
      'cartoes_config_family_titular_fkey',
      'emprestimos_family_titular_fkey',
      'contas_fixas_family_titular_fkey',
      'contas_fixas_family_cartao_fkey',
      'cartoes_family_cartao_fkey',
      'cartoes_family_titular_fkey',
      'despesas_family_titular_fkey',
      'receitas_family_titular_fkey',
    ];

    protectedConstraints.forEach((constraint) => {
      expect(source).toContain(`ADD CONSTRAINT ${constraint}`);
    });
    expect(source.match(/ON DELETE RESTRICT/g)).toHaveLength(protectedConstraints.length);
    expect(source).not.toContain('ON DELETE CASCADE');
    expect(source).not.toContain('ON DELETE SET NULL');
  });
});

describe('segurança do ensaio de restauração', () => {
  it('é limitado ao contêiner e ao banco temporário locais', () => {
    const source = readFileSync(
      new URL('../scripts/Invoke-LocalRestoreRehearsal.ps1', import.meta.url),
      'utf8',
    );

    expect(source).toContain("$containerName = 'supabase_db_controle-financeiro'");
    expect(source).toContain("$rehearsalDatabase = 'radar_restore_rehearsal'");
    expect(source).toContain('CREATE DATABASE $rehearsalDatabase TEMPLATE template0');
    expect(source).toContain('DROP DATABASE IF EXISTS $rehearsalDatabase');
    expect(source).not.toContain('--linked');
    expect(source).not.toContain('DB_URL');
  });

  it('inicia o frontend somente com a URL local aprovada', () => {
    const source = readFileSync(
      new URL('../scripts/Start-LocalApp.ps1', import.meta.url),
      'utf8',
    );

    expect(source).toContain('$parsedUrl.IsLoopback');
    expect(source).toContain('$parsedUrl.Port -eq 54321');
    expect(source).toContain("$parsedUrl.Scheme -eq 'http'");
    expect(source).toContain("$env:NEXT_DIST_DIR = '.next-local'");
    expect(source).not.toContain('SERVICE_ROLE_KEY');
    expect(source).not.toContain('--linked');
  });

  it('inicia o frontend de staging somente para o projeto aprovado', () => {
    const source = readFileSync(
      new URL('../scripts/Start-StagingApp.ps1', import.meta.url),
      'utf8',
    );

    expect(source).toContain("$expectedHost = 'bncwjnoluywiqxbjrbhc.supabase.co'");
    expect(source).toContain("$uri.Scheme -ne 'https'");
    expect(source).toContain("$env:NEXT_DIST_DIR = '.next-staging'");
    expect(source).not.toContain('SERVICE_ROLE_KEY');
    expect(source).not.toContain('--linked');
  });

  it('restaura o banco ativo somente quando vazio e com confirmação explícita', () => {
    const source = readFileSync(
      new URL('../scripts/Restore-ActiveLocalBackup.ps1', import.meta.url),
      'utf8',
    );

    expect(source).toContain("$containerName = 'supabase_db_controle-financeiro'");
    expect(source).toContain("$activeDatabase = 'postgres'");
    expect(source).toContain("if (-not $Apply)");
    expect(source).toContain("if ([long]$existingRows -ne 0)");
    expect(source).toContain("$apiUri.Port -ne 54321");
    expect(source).toContain("$databaseUri.Port -ne 54322");
    expect(source).not.toContain('--linked');
    expect(source).not.toContain('--db-url');
  });

  it('restaura todas as migrations aditivas que já foram ensaiadas', () => {
    const source = readFileSync(
      new URL('../scripts/Restore-ActiveLocalBackup.ps1', import.meta.url),
      'utf8',
    );

    [
      '20260913000000_restrict_admin_deletions.sql',
      '20260913010000_structural_card_recurrences.sql',
      '20260913020000_fixed_recurrence_lifecycle.sql',
      '20260913030000_recurrence_occurrence_commands.sql',
      '20260920000000_atomic_category_updates.sql',
      '20260921000000_explicit_authenticated_data_access.sql',
    ].forEach((migration) => expect(source).toContain(migration));
    expect(source).toContain('DROP TABLE IF EXISTS public.contas_fixas_excecoes CASCADE;');
    expect(source).toContain('#requires -Version 7.0');
  });

  it('concede acesso à Data API somente a usuários autenticados', () => {
    const source = readFileSync(
      new URL('./migrations/20260921000000_explicit_authenticated_data_access.sql', import.meta.url),
      'utf8',
    );

    expect(source).toContain('FROM anon;');
    expect(source).toContain('TO authenticated;');
    expect(source).toContain('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;');
    expect(source).not.toContain('TO anon;');
  });
});
