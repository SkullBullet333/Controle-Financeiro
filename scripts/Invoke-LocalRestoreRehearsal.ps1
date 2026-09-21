#requires -Version 7.0
[CmdletBinding()]
param(
  [switch]$KeepDatabase
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$csvDirectory = Join-Path $repositoryRoot '.BaseCSV'
$sqlDirectory = Join-Path $repositoryRoot '.BaseSQL'
$migrationDirectory = Join-Path $repositoryRoot 'supabase\migrations'
$containerName = 'supabase_db_controle-financeiro'
$rehearsalDatabase = 'radar_restore_rehearsal'

$legacyMigrations = @(
  '20260401000000_consolidated_schema.sql',
  '20260502000000_profile_theme_color.sql',
  '20260506000000_profile_theme_mode.sql',
  '20260508000000_contas_fixas_cartao_id.sql'
)

$additiveMigrations = @(
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

$dataImportOrder = @(
  'titulares',
  'cartoes_config',
  'emprestimos',
  'contas_fixas',
  'cartoes',
  'despesas',
  'receitas',
  'table_notas'
)

function Invoke-LocalPsql {
  param(
    [string]$Database,
    [string]$Sql,
    [string]$Stage
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'docker'
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.CreateNoWindow = $true
  # Windows PowerShell 5.1 does not expose ProcessStartInfo.ArgumentList.
  # Every value interpolated here is a fixed, repository-controlled identifier.
  $startInfo.Arguments = "exec -i $containerName psql -U postgres -d $Database -X -q -A -t -v ON_ERROR_STOP=1"

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    [void]$process.Start()
    $process.StandardInput.Write($Sql)
    $process.StandardInput.Close()
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
      $errorCategory = if ($standardError -match 'duplicate key') {
        'duplicidade detectada'
      } elseif ($standardError -match 'foreign key') {
        'referência inválida detectada'
      } elseif ($standardError -match 'check constraint') {
        'regra de domínio violada'
      } else {
        'comando SQL recusado'
      }
      throw "Falha em '$Stage': $errorCategory. O detalhe foi omitido para não expor o backup."
    }

    return $standardOutput.Trim()
  } finally {
    $process.Dispose()
  }
}

function Invoke-SqlFile {
  param(
    [string]$Database,
    [string]$Path,
    [string]$Stage
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Arquivo necessário não encontrado na etapa '$Stage'."
  }
  $sql = [System.IO.File]::ReadAllText($Path)
  [void](Invoke-LocalPsql -Database $Database -Sql $sql -Stage $Stage)
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker não encontrado. Inicie o Docker Desktop e tente novamente.'
}

Write-Output '1/6 Validando a estrutura dos backups...'
& (Join-Path $PSScriptRoot 'Test-LocalBackup.ps1') -CsvDirectory $csvDirectory -SqlDirectory $sqlDirectory

$containerState = (& docker inspect --format '{{.State.Status}}|{{.State.Health.Status}}' $containerName 2>$null)
if ($LASTEXITCODE -ne 0 -or $containerState -notmatch '^running\|healthy$') {
  throw "O Supabase local '$containerName' não está saudável. Execute npm run supabase:start antes do ensaio."
}

$createdDatabase = $false
try {
  Write-Output '2/6 Criando banco temporário isolado...'
  [void](Invoke-LocalPsql -Database 'postgres' -Stage 'encerrar conexões antigas do ensaio' -Sql @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$rehearsalDatabase'
  AND pid <> pg_backend_pid();
"@)
  [void](Invoke-LocalPsql -Database 'postgres' -Stage 'remover ensaio anterior' -Sql "DROP DATABASE IF EXISTS $rehearsalDatabase;")
  [void](Invoke-LocalPsql -Database 'postgres' -Stage 'criar banco de ensaio' -Sql "CREATE DATABASE $rehearsalDatabase TEMPLATE template0;")
  $createdDatabase = $true

  [void](Invoke-LocalPsql -Database $rehearsalDatabase -Stage 'preparar autenticação mínima local' -Sql @'
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
CREATE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
$$;
'@)

  Write-Output '3/6 Montando o schema legado...'
  foreach ($migrationName in $legacyMigrations) {
    Invoke-SqlFile -Database $rehearsalDatabase -Path (Join-Path $migrationDirectory $migrationName) -Stage "migration legada $migrationName"
  }

  # Estes campos existiam no banco remoto antes de serem formalizados nas migrations.
  [void](Invoke-LocalPsql -Database $rehearsalDatabase -Stage 'reproduzir campos legados de cartão' -Sql @'
ALTER TABLE public.cartoes_config
  ADD COLUMN "Final" TEXT,
  ADD COLUMN color TEXT,
  ADD COLUMN icone TEXT;
'@)

  Write-Output '4/6 Carregando a cópia dos dados no banco temporário...'
  $profilesSql = [System.IO.File]::ReadAllText((Join-Path $sqlDirectory 'profiles_rows.sql'))
  $profileImportSql = @"
BEGIN;
SET LOCAL session_replication_role = replica;
$profilesSql
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
SELECT
  id,
  'restored-' || row_number() OVER (ORDER BY id) || '@local.invalid',
  '{}'::JSONB,
  COALESCE(created_at, now()),
  now()
FROM public.profiles;
SET LOCAL session_replication_role = origin;
COMMIT;
"@
  [void](Invoke-LocalPsql -Database $rehearsalDatabase -Sql $profileImportSql -Stage 'importar perfis e identidades sintéticas')

  foreach ($tableName in $dataImportOrder) {
    Invoke-SqlFile -Database $rehearsalDatabase -Path (Join-Path $sqlDirectory "${tableName}_rows.sql") -Stage "importar $tableName"
  }

  Write-Output '5/6 Aplicando as migrations aditivas sobre os dados restaurados...'
  foreach ($migrationName in $additiveMigrations) {
    Invoke-SqlFile -Database $rehearsalDatabase -Path (Join-Path $migrationDirectory $migrationName) -Stage "migration aditiva $migrationName"
  }

  [void](Invoke-LocalPsql -Database $rehearsalDatabase -Stage 'sincronizar sequências locais' -Sql @'
DO $$
DECLARE
  item RECORD;
  sequence_name TEXT;
  last_identifier BIGINT;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('convites'), ('titulares'), ('cartoes_config'), ('emprestimos'),
      ('contas_fixas'), ('cartoes'), ('despesas'), ('receitas')
    ) AS tables(table_name)
  LOOP
    sequence_name := pg_get_serial_sequence('public.' || item.table_name, 'id');
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('SELECT max(id) FROM public.%I', item.table_name) INTO last_identifier;
      IF last_identifier IS NULL THEN
        PERFORM setval(sequence_name, 1, false);
      ELSE
        PERFORM setval(sequence_name, last_identifier, true);
      END IF;
    END IF;
  END LOOP;
END
$$;
'@)

  $expectedCounts = @{}
  foreach ($tableName in @('profiles') + $dataImportOrder) {
    $expectedCounts[$tableName] = @(Import-Csv -LiteralPath (Join-Path $csvDirectory "${tableName}_rows.csv")).Count
  }

  $countChecks = foreach ($tableName in $expectedCounts.Keys | Sort-Object) {
    "SELECT '$tableName=' || count(*) FROM public.$tableName HAVING count(*) <> $($expectedCounts[$tableName]);"
  }
  $validationSql = @"
DO `$`$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL) THEN
    RAISE EXCEPTION 'profiles_auth_orphan';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype IN ('c', 'f')
      AND NOT convalidated
  ) THEN
    RAISE EXCEPTION 'unvalidated_constraint';
  END IF;
END
`$`$;
$($countChecks -join [Environment]::NewLine)
SELECT 'total=' || sum(row_count)
FROM (
$((($expectedCounts.Keys | Sort-Object) | ForEach-Object { "  SELECT count(*)::BIGINT AS row_count FROM public.$_" }) -join "`n  UNION ALL`n")
) AS restored;
"@

  Write-Output '6/6 Conferindo contagens e integridade final...'
  $validationOutput = Invoke-LocalPsql -Database $rehearsalDatabase -Sql $validationSql -Stage 'validar resultado final'
  $unexpectedCount = @($validationOutput -split "`r?`n" | Where-Object { $_ -match '^[a-z_]+=' -and $_ -notmatch '^total=' })
  if ($unexpectedCount.Count -gt 0) {
    throw 'As contagens restauradas não correspondem aos arquivos CSV.'
  }
  $totalLine = @($validationOutput -split "`r?`n" | Where-Object { $_ -match '^total=' }) | Select-Object -First 1
  Write-Output "Ensaio concluído com sucesso ($totalLine registros públicos conferidos)."
  Write-Output 'Nenhuma conexão com o Supabase remoto foi usada.'
} finally {
  if ($createdDatabase -and -not $KeepDatabase) {
    Write-Output 'Removendo o banco temporário e a cópia sensível dos dados...'
    try {
      [void](Invoke-LocalPsql -Database 'postgres' -Stage 'encerrar conexões do ensaio' -Sql @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$rehearsalDatabase'
  AND pid <> pg_backend_pid();
"@)
      [void](Invoke-LocalPsql -Database 'postgres' -Stage 'remover banco de ensaio' -Sql "DROP DATABASE IF EXISTS $rehearsalDatabase;")
    } catch {
      Write-Warning "Não foi possível remover automaticamente o banco temporário '$rehearsalDatabase'."
    }
  } elseif ($createdDatabase) {
    Write-Warning "O banco '$rehearsalDatabase' foi mantido e contém uma cópia sensível do backup."
  }
}
