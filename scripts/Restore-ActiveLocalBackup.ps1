#requires -Version 7.0
[CmdletBinding()]
param(
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $Apply) {
  throw 'Restauracao recusada. Use -Apply somente depois de validar o ensaio local.'
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$csvDirectory = Join-Path $repositoryRoot '.BaseCSV'
$sqlDirectory = Join-Path $repositoryRoot '.BaseSQL'
$migrationDirectory = Join-Path $repositoryRoot 'supabase\migrations'
$containerName = 'supabase_db_controle-financeiro'
$activeDatabase = 'postgres'
$localLoginEmail = 'local.restore@controle-financeiro.test'

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
  $startInfo.Arguments = "exec -i $containerName psql -U postgres -d $activeDatabase -X -q -A -t -v ON_ERROR_STOP=1"

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
        'referencia invalida detectada'
      } elseif ($standardError -match 'check constraint') {
        'regra de dominio violada'
      } else {
        'comando SQL recusado'
      }
      throw "Falha em '$Stage': $errorCategory. O detalhe foi omitido para proteger o backup."
    }
    return $standardOutput.Trim()
  } finally {
    $process.Dispose()
  }
}

function Invoke-SqlFile {
  param(
    [string]$Path,
    [string]$Stage
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Arquivo necessario nao encontrado na etapa '$Stage'."
  }
  [void](Invoke-LocalPsql -Sql ([System.IO.File]::ReadAllText($Path)) -Stage $Stage)
}

function Get-LocalStatus {
  $ErrorActionPreference = 'Continue'
  $lines = @(& npx supabase status -o env 2>&1)
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($exitCode -ne 0) { throw 'Supabase local indisponivel.' }

  $result = @{}
  foreach ($line in $lines) {
    if ([string]$line -match '^([A-Z][A-Z0-9_]+)=(.*)$') {
      $result[$matches[1]] = $matches[2].Trim().Trim('"')
    }
  }
  return $result
}

function New-TemporaryPassword {
  $bytes = New-Object byte[] 24
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return ([Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_') + 'Aa1!')
}

function Invoke-AdminDeleteUser {
  param(
    [string]$ApiUrl,
    [string]$AdminKey,
    [Guid]$UserId
  )

  try {
    [void](Invoke-RestMethod -Method Delete -Uri "$ApiUrl/auth/v1/admin/users/$UserId" -Headers @{
      apikey = $AdminKey
      Authorization = "Bearer $AdminKey"
    } -TimeoutSec 15)
  } catch {
    Write-Warning 'A conta local criada nesta execucao nao pode ser removida automaticamente.'
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker nao encontrado.'
}

Write-Output '1/8 Validando backups e ensaio isolado...'
& (Join-Path $PSScriptRoot 'Test-LocalBackup.ps1') -CsvDirectory $csvDirectory -SqlDirectory $sqlDirectory
& (Join-Path $PSScriptRoot 'Invoke-LocalRestoreRehearsal.ps1')

$containerState = (& docker inspect --format '{{.State.Status}}|{{.State.Health.Status}}' $containerName 2>$null)
if ($LASTEXITCODE -ne 0 -or $containerState -notmatch '^running\|healthy$') {
  throw "O Supabase local '$containerName' nao esta saudavel."
}

$localStatus = Get-LocalStatus
$apiUrl = [string]$localStatus['API_URL']
$databaseUrl = [string]$localStatus['DB_URL']
$publicKey = if ($localStatus['PUBLISHABLE_KEY']) { [string]$localStatus['PUBLISHABLE_KEY'] } else { [string]$localStatus['ANON_KEY'] }
$adminKey = if ($localStatus['SECRET_KEY']) { [string]$localStatus['SECRET_KEY'] } else { [string]$localStatus['SERVICE_ROLE_KEY'] }

$apiUri = [Uri]$apiUrl
$databaseUri = [Uri]$databaseUrl
$localHosts = @('127.0.0.1', 'localhost')
if (
  $apiUri.Scheme -ne 'http' -or
  $apiUri.Host -notin $localHosts -or
  $apiUri.Port -ne 54321 -or
  $databaseUri.Host -notin $localHosts -or
  $databaseUri.Port -ne 54322 -or
  -not $publicKey -or
  -not $adminKey
) {
  throw 'Destino recusado: a stack nao corresponde ao Supabase local esperado.'
}

Write-Output '2/8 Confirmando que o banco local ativo esta vazio...'
$existingRows = Invoke-LocalPsql -Stage 'verificar estado inicial' -Sql @'
SELECT
  (SELECT count(*) FROM auth.users)
  + (SELECT count(*) FROM public.profiles)
  + (SELECT count(*) FROM public.convites)
  + (SELECT count(*) FROM public.titulares)
  + (SELECT count(*) FROM public.cartoes_config)
  + (SELECT count(*) FROM public.emprestimos)
  + (SELECT count(*) FROM public.contas_fixas)
  + (SELECT count(*) FROM public.cartoes)
  + (SELECT count(*) FROM public.despesas)
  + (SELECT count(*) FROM public.receitas)
  + (SELECT count(*) FROM public.table_notas)
  + (SELECT count(*) FROM public.financial_operation_requests);
'@
if ([long]$existingRows -ne 0) {
  throw 'Restauracao recusada: o banco local ativo contem dados. Nenhuma linha foi alterada.'
}

$schemaReplacementStarted = $false
$viewerCreatedByRun = $false
$viewerId = [Guid]::Empty
$temporaryPassword = $null

try {
  Write-Output '3/8 Reconstruindo somente o schema publico da aplicacao...'
  $schemaReplacementStarted = $true
  [void](Invoke-LocalPsql -Stage 'remover schema publico vazio' -Sql @'
DROP TABLE IF EXISTS public.financial_operation_requests CASCADE;
DROP TABLE IF EXISTS public.contas_fixas_excecoes CASCADE;
DROP TABLE IF EXISTS public.receitas CASCADE;
DROP TABLE IF EXISTS public.despesas CASCADE;
DROP TABLE IF EXISTS public.cartoes CASCADE;
DROP TABLE IF EXISTS public.cartoes_config CASCADE;
DROP TABLE IF EXISTS public.emprestimos CASCADE;
DROP TABLE IF EXISTS public.contas_fixas CASCADE;
DROP TABLE IF EXISTS public.titulares CASCADE;
DROP TABLE IF EXISTS public.table_notas CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.convites CASCADE;
'@)

  foreach ($migrationName in $legacyMigrations) {
    Invoke-SqlFile -Path (Join-Path $migrationDirectory $migrationName) -Stage "migration legada $migrationName"
  }
  [void](Invoke-LocalPsql -Stage 'reproduzir campos legados de cartao' -Sql @'
ALTER TABLE public.cartoes_config
  ADD COLUMN "Final" TEXT,
  ADD COLUMN color TEXT,
  ADD COLUMN icone TEXT;
'@)

  Write-Output '4/8 Importando dados e preservando autores historicos...'
  $profilesSql = [System.IO.File]::ReadAllText((Join-Path $sqlDirectory 'profiles_rows.sql'))
  [void](Invoke-LocalPsql -Stage 'importar perfis e autores historicos' -Sql @"
BEGIN;
SET LOCAL session_replication_role = replica;
$profilesSql
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, raw_app_meta_data,
  raw_user_meta_data, is_super_admin, created_at, updated_at,
  is_sso_user, is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000'::UUID,
  id,
  'authenticated',
  'authenticated',
  'restored-' || row_number() OVER (ORDER BY id) || '@local.invalid',
  NULL,
  now(), '', '', '', '',
  '{"provider":"email","providers":["email"]}'::JSONB,
  '{"local_placeholder":true}'::JSONB,
  false,
  COALESCE(created_at, now()),
  now(),
  false,
  false
FROM public.profiles;
SET LOCAL session_replication_role = origin;
COMMIT;
"@)

  foreach ($tableName in $dataImportOrder) {
    Invoke-SqlFile -Path (Join-Path $sqlDirectory "${tableName}_rows.sql") -Stage "importar $tableName"
  }

  Write-Output '5/8 Aplicando migrations de seguranca e integridade...'
  foreach ($migrationName in $additiveMigrations) {
    Invoke-SqlFile -Path (Join-Path $migrationDirectory $migrationName) -Stage "migration aditiva $migrationName"
  }

  [void](Invoke-LocalPsql -Stage 'sincronizar sequencias' -Sql @'
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
NOTIFY pgrst, 'reload schema';
'@)

  $expectedCounts = @{}
  foreach ($tableName in @('profiles') + $dataImportOrder) {
    $expectedCounts[$tableName] = @(Import-Csv -LiteralPath (Join-Path $csvDirectory "${tableName}_rows.csv")).Count
  }
  $countChecks = foreach ($tableName in $expectedCounts.Keys | Sort-Object) {
    "IF (SELECT count(*) FROM public.$tableName) <> $($expectedCounts[$tableName]) THEN RAISE EXCEPTION 'count_$tableName'; END IF;"
  }
  [void](Invoke-LocalPsql -Stage 'validar contagens restauradas' -Sql @"
DO `$`$
BEGIN
  $($countChecks -join [Environment]::NewLine)
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
  IF
    (SELECT count(*) FROM public.despesas WHERE cartao_vencimento_id IS NOT NULL)
    <>
    (SELECT count(*) FROM public.despesas WHERE lower(left(btrim(descricao), 7)) = 'fatura ')
  THEN
    RAISE EXCEPTION 'invoice_backfill_incomplete';
  END IF;
END
`$`$;
"@)

  Write-Output '6/8 Descobrindo a unica familia com dados financeiros...'
  $familyOutput = Invoke-LocalPsql -Stage 'descobrir familia financeira' -Sql @'
WITH financial_families AS (
  SELECT family_id FROM public.despesas
  UNION ALL SELECT family_id FROM public.receitas
  UNION ALL SELECT family_id FROM public.cartoes
  UNION ALL SELECT family_id FROM public.contas_fixas
  UNION ALL SELECT family_id FROM public.emprestimos
  UNION ALL SELECT family_id FROM public.cartoes_config
)
SELECT family_id
FROM financial_families
WHERE family_id IS NOT NULL
GROUP BY family_id;
'@
  $familyRows = @($familyOutput -split "`r?`n" | Where-Object { $_ })
  if ($familyRows.Count -ne 1) {
    throw 'A restauracao encontrou zero ou mais de uma familia com dados; associacao automatica recusada.'
  }
  $targetFamilyId = [Guid]::Empty
  if (-not [Guid]::TryParse($familyRows[0], [ref]$targetFamilyId)) {
    throw 'Identificador da familia restaurada invalido.'
  }

  Write-Output '7/8 Criando acesso de login exclusivamente local...'
  $temporaryPassword = New-TemporaryPassword
  $createBody = @{
    email = $localLoginEmail
    password = $temporaryPassword
    email_confirm = $true
    user_metadata = @{
      display_name = 'Acesso local restaurado'
      local_only = $true
    }
  } | ConvertTo-Json -Depth 4 -Compress

  try {
    $createdUser = Invoke-RestMethod -Method Post -Uri "$apiUrl/auth/v1/admin/users" -Headers @{
      apikey = $adminKey
      Authorization = "Bearer $adminKey"
    } -ContentType 'application/json' -Body $createBody -TimeoutSec 20
  } catch {
    throw 'A API de autenticacao local recusou a criacao do usuario de teste.'
  }
  if (-not [Guid]::TryParse([string]$createdUser.id, [ref]$viewerId)) {
    throw 'A API local retornou um identificador de usuario invalido.'
  }
  $viewerCreatedByRun = $true

  [void](Invoke-LocalPsql -Stage 'associar acesso local a familia restaurada' -Sql @"
DO `$`$
DECLARE
  changed_rows INTEGER;
BEGIN
  UPDATE public.profiles
  SET family_id = '$targetFamilyId'::UUID,
      tipo = 'titular',
      nome = 'Acesso local restaurado'
  WHERE id = '$viewerId'::UUID;
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows <> 1 THEN
    RAISE EXCEPTION 'viewer_profile_not_updated';
  END IF;
END
`$`$;
"@)

  Write-Output '8/8 Validando login real e isolamento RLS...'
  $tokenBody = @{
    email = $localLoginEmail
    password = $temporaryPassword
  } | ConvertTo-Json -Compress
  try {
    $tokenResponse = Invoke-RestMethod -Method Post -Uri "$apiUrl/auth/v1/token?grant_type=password" -Headers @{
      apikey = $publicKey
    } -ContentType 'application/json' -Body $tokenBody -TimeoutSec 20
    if (-not $tokenResponse.access_token) { throw 'token ausente' }
    $visibleRows = @(Invoke-RestMethod -Method Get -Uri "$apiUrl/rest/v1/despesas?select=id&limit=1" -Headers @{
      apikey = $publicKey
      Authorization = "Bearer $($tokenResponse.access_token)"
    } -TimeoutSec 20)
    if ($visibleRows.Count -ne 1) { throw 'dados nao visiveis' }
    try {
      [void](Invoke-RestMethod -Method Post -Uri "$apiUrl/auth/v1/logout" -Headers @{
        apikey = $publicKey
        Authorization = "Bearer $($tokenResponse.access_token)"
      } -TimeoutSec 10)
    } catch {}
  } catch {
    if ($viewerCreatedByRun) {
      Invoke-AdminDeleteUser -ApiUrl $apiUrl -AdminKey $adminKey -UserId $viewerId
      $viewerCreatedByRun = $false
    }
    throw 'A validacao ponta a ponta do login local falhou.'
  }

  Write-Output 'Restauracao local concluida: 1132 registros historicos e acesso RLS validados.'
  Write-Output "LOGIN_LOCAL_EMAIL=$localLoginEmail"
  Write-Output "LOGIN_LOCAL_PASSWORD=$temporaryPassword"
  Write-Output 'Guarde a senha somente enquanto usar este ambiente local.'
  Write-Output 'Rollback completo: npm run supabase:reset'
} catch {
  if ($viewerCreatedByRun) {
    Invoke-AdminDeleteUser -ApiUrl $apiUrl -AdminKey $adminKey -UserId $viewerId
  }
  if ($schemaReplacementStarted) {
    Write-Warning 'A restauracao do schema local foi interrompida. Execute npm run supabase:reset para voltar ao banco local vazio.'
  }
  throw
} finally {
  $temporaryPassword = $null
  $adminKey = $null
  $publicKey = $null
}
