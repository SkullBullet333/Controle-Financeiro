#requires -Version 7.0
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$projectRoot = Split-Path -Parent $PSScriptRoot
$migrationRoot = Join-Path $projectRoot 'supabase\migrations'
$testRoot = Join-Path $projectRoot 'supabase\tests'
$containerName = 'supabase_db_controle-financeiro'
$databaseName = 'radar_category_lot29'
$createdDatabase = $false

function Invoke-LocalSql {
  param([string]$Database, [string]$Sql, [string]$Stage)
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'docker'
  $startInfo.Arguments = "exec -i $containerName psql -U postgres -d $Database -X -q -A -t -v ON_ERROR_STOP=1"
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.CreateNoWindow = $true
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    [void]$process.Start()
    $process.StandardInput.Write($Sql)
    $process.StandardInput.Close()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
      # Este ensaio contém apenas schema e dados sintéticos, nunca o backup.
      throw "Falha na etapa '$Stage' do banco descartável: $($stderr.Trim())"
    }
    return $stdout.Trim()
  } finally {
    $process.Dispose()
  }
}

function Invoke-LocalSqlFile {
  param([string]$Database, [string]$Path, [string]$Stage)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Arquivo ausente em '$Stage'." }
  return Invoke-LocalSql -Database $Database -Sql ([System.IO.File]::ReadAllText($Path)) -Stage $Stage
}

try {
  $containerState = & docker inspect --format '{{.State.Status}}|{{.State.Health.Status}}' $containerName 2>$null
  if ($LASTEXITCODE -ne 0 -or $containerState -ne 'running|healthy') {
    throw 'O banco Supabase local não está saudável.'
  }
  $existing = Invoke-LocalSql -Database postgres -Stage 'verificar destino' -Sql "SELECT 1 FROM pg_database WHERE datname = '$databaseName';"
  if ($existing) { throw "O banco descartável '$databaseName' já existe; nenhuma alteração foi realizada." }

  [void](Invoke-LocalSql -Database postgres -Stage 'criar banco descartável' -Sql "CREATE DATABASE $databaseName TEMPLATE template0;")
  $createdDatabase = $true
  [void](Invoke-LocalSql -Database $databaseName -Stage 'preparar autenticação local' -Sql @'
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
$$;
'@)

  $migrations = @(
    '20260401000000_consolidated_schema.sql',
    '20260502000000_profile_theme_color.sql',
    '20260506000000_profile_theme_mode.sql',
    '20260508000000_contas_fixas_cartao_id.sql',
    '20260912000000_harden_family_rls.sql',
    '20260912010000_cartoes_config_canonical_fields.sql',
    '20260912020000_same_family_foreign_keys.sql',
    '20260912030000_atomic_linked_expenses.sql',
    '20260912040000_atomic_linked_revenues.sql',
    '20260912050000_idempotent_installment_creation.sql',
    '20260912060000_structural_card_invoices.sql',
    '20260913000000_restrict_admin_deletions.sql',
    '20260913010000_structural_card_recurrences.sql',
    '20260913020000_fixed_recurrence_lifecycle.sql',
    '20260913030000_recurrence_occurrence_commands.sql',
    '20260920000000_atomic_category_updates.sql',
    '20260921000000_explicit_authenticated_data_access.sql'
  )
  foreach ($migration in $migrations) {
    [void](Invoke-LocalSqlFile -Database $databaseName -Path (Join-Path $migrationRoot $migration) -Stage $migration)
  }
  # O projeto Supabase ativo recebe grants do bootstrap da plataforma; o banco
  # template0 isolado não. Conceda somente as permissões que este teste usa.
  [void](Invoke-LocalSql -Database $databaseName -Stage 'simular grants da plataforma' -Sql @'
GRANT SELECT, UPDATE ON public.despesas, public.contas_fixas, public.cartoes TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
'@)
  [void](Invoke-LocalSql -Database $databaseName -Stage 'carregar pgTAP' -Sql 'CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;')
  $tap = Invoke-LocalSqlFile -Database $databaseName -Path (Join-Path $testRoot 'atomic_category_updates.test.sql') -Stage 'pgTAP de categoria'
  $checks = @($tap -split "`r?`n" | Where-Object { $_ -match '^ok\b' }).Count
  if ($tap -match '(?m)^not ok\b|^Bail out!' -or $checks -lt 10) {
    Write-Output $tap
    throw "O ensaio pgTAP falhou ou não executou todos os cenários ($checks aprovações)."
  }
  Write-Output "Ensaio isolado aprovado: $checks verificações pgTAP. Nenhum dado real ou banco remoto foi usado."
} finally {
  if ($createdDatabase) {
    try {
      [void](Invoke-LocalSql -Database postgres -Stage 'encerrar conexões do banco descartável' -Sql @"
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = '$databaseName' AND pid <> pg_backend_pid();
"@)
      [void](Invoke-LocalSql -Database postgres -Stage 'remover banco descartável' -Sql "DROP DATABASE $databaseName;")
      Write-Output 'Banco descartável removido.'
    } catch {
      Write-Warning "Não foi possível remover '$databaseName'; remova somente esse banco local após conferência."
    }
  }
}
