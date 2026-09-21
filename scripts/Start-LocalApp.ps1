[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3001,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$ErrorActionPreference = 'Continue'
$statusOutput = @(& npx supabase status -o env 2>&1)
$statusExitCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($statusExitCode -ne 0) {
  throw 'O Supabase local não está disponível. Inicie o Docker Desktop e execute npm run supabase:start.'
}

function Get-LocalStatusValue {
  param([string]$Name)

  $line = $statusOutput | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return (($line -replace "^$Name=", '').Trim().Trim('"'))
}

$apiUrl = Get-LocalStatusValue -Name 'API_URL'
$anonKey = Get-LocalStatusValue -Name 'ANON_KEY'
if (-not $anonKey) { $anonKey = Get-LocalStatusValue -Name 'PUBLISHABLE_KEY' }

if (-not $apiUrl -or -not $anonKey) {
  throw 'A URL ou a chave pública do Supabase local não foi encontrada.'
}

$parsedUrl = [Uri]$apiUrl
$isLoopback = $parsedUrl.IsLoopback -and $parsedUrl.Port -eq 54321 -and $parsedUrl.Scheme -eq 'http'
if (-not $isLoopback) {
  throw 'Inicialização recusada: o Supabase retornado não aponta para http://127.0.0.1:54321.'
}

Write-Output "Supabase local confirmado em $($parsedUrl.GetLeftPart([UriPartial]::Authority))."
Write-Output 'A chave pública local foi encontrada e não será gravada nem exibida.'
if ($CheckOnly) { return }

$previousUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$previousAnonKey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$previousDistDirectory = $env:NEXT_DIST_DIR
try {
  $env:NEXT_PUBLIC_SUPABASE_URL = $apiUrl
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $anonKey
  $env:NEXT_DIST_DIR = '.next-local'
  Set-Location -LiteralPath $repositoryRoot
  Write-Output "Iniciando a aplicação local em http://localhost:$Port sem alterar os arquivos .env..."
  & npm run dev -- --port $Port
  if ($LASTEXITCODE -ne 0) { throw 'O servidor local encerrou com erro.' }
} finally {
  $env:NEXT_PUBLIC_SUPABASE_URL = $previousUrl
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $previousAnonKey
  $env:NEXT_DIST_DIR = $previousDistDirectory
}
