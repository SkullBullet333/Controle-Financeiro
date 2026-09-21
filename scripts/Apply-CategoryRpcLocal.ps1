#requires -Version 7.0
[CmdletBinding()]
param([switch]$Apply)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$containerName = 'supabase_db_controle-financeiro'
$databaseName = 'postgres'
$migration = Join-Path (Split-Path -Parent $PSScriptRoot) 'supabase\migrations\20260920000000_atomic_category_updates.sql'

if (-not $Apply) {
  Write-Output 'Somente prévia. Use -Apply para criar as RPCs no Supabase local.'
  return
}
if (-not (Test-Path -LiteralPath $migration -PathType Leaf)) { throw 'Migration local não encontrada.' }

$state = & docker inspect --format '{{.State.Status}}|{{.State.Health.Status}}' $containerName 2>$null
if ($LASTEXITCODE -ne 0 -or $state -ne 'running|healthy') {
  throw 'O contêiner Supabase local não está saudável.'
}

function Invoke-LocalPsql {
  param([string]$Sql)
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'docker'
  $startInfo.Arguments = "exec -i $containerName psql -U postgres -d $databaseName -X -q -A -t -v ON_ERROR_STOP=1"
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
  $startInfo.CreateNoWindow = $true
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    [void]$process.Start()
    $process.StandardInput.Write($Sql)
    $process.StandardInput.Close()
    $stdout = $process.StandardOutput.ReadToEnd()
    [void]$process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'O banco local recusou a migration; transação revertida.' }
    return $stdout.Trim()
  } finally {
    $process.Dispose()
  }
}

$schemaReady = Invoke-LocalPsql -Sql @'
SELECT CASE WHEN
  to_regclass('public.despesas') IS NOT NULL
  AND to_regclass('public.contas_fixas') IS NOT NULL
  AND to_regclass('public.cartoes') IS NOT NULL
  AND to_regprocedure('public.get_my_family_id()') IS NOT NULL
THEN 'ready' ELSE 'missing' END;
'@
if ($schemaReady -ne 'ready') { throw 'O schema local não tem as tabelas e funções esperadas.' }

[void](Invoke-LocalPsql -Sql ([System.IO.File]::ReadAllText($migration)))
$installed = Invoke-LocalPsql -Sql @'
SELECT CASE WHEN
  to_regprocedure('public.renomear_categoria_em_lote(text,text)') IS NOT NULL
  AND to_regprocedure('public.atualizar_categoria_por_descricao(text,text)') IS NOT NULL
THEN 'ready' ELSE 'missing' END;
'@
if ($installed -ne 'ready') { throw 'Não foi possível confirmar as RPCs no banco local.' }
Write-Output 'As duas RPCs de categoria foram instaladas somente no Supabase local. Nenhum lançamento foi alterado.'
