#requires -Version 7.0
[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3003,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $repositoryRoot '.env.staging.local'
$expectedHost = 'bncwjnoluywiqxbjrbhc.supabase.co'

if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) {
  throw 'Arquivo .env.staging.local ausente. Copie .env.staging.example e informe os valores públicos do staging.'
}

$values = @{}
foreach ($line in [System.IO.File]::ReadAllLines($environmentFile)) {
  if ($line -match '^\s*(NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY))\s*=\s*(.*?)\s*$') {
    $values[$matches[1]] = $matches[2].Trim().Trim('"')
  }
}

$apiUrl = [string]$values['NEXT_PUBLIC_SUPABASE_URL']
$anonKey = [string]$values['NEXT_PUBLIC_SUPABASE_ANON_KEY']
if (-not $apiUrl -or -not $anonKey) {
  throw 'A URL ou a chave pública do staging não foi encontrada no arquivo local.'
}

$uri = [Uri]$apiUrl
if ($uri.Scheme -ne 'https' -or $uri.Host -ne $expectedHost) {
  throw 'Inicialização recusada: a URL não corresponde ao projeto de staging aprovado.'
}

Write-Output "Staging confirmado em $($uri.GetLeftPart([UriPartial]::Authority))."
Write-Output 'A chave pública foi encontrada e não será exibida nem gravada pelo script.'
if ($CheckOnly) { return }

$previousUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$previousAnonKey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$previousDistDirectory = $env:NEXT_DIST_DIR
try {
  $env:NEXT_PUBLIC_SUPABASE_URL = $apiUrl
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $anonKey
  $env:NEXT_DIST_DIR = '.next-staging'
  Set-Location -LiteralPath $repositoryRoot
  Write-Output "Iniciando a aplicação no staging em http://localhost:$Port sem alterar os arquivos .env..."
  & npm run dev -- --port $Port
  if ($LASTEXITCODE -ne 0) { throw 'O servidor de staging encerrou com erro.' }
} finally {
  $env:NEXT_PUBLIC_SUPABASE_URL = $previousUrl
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $previousAnonKey
  $env:NEXT_DIST_DIR = $previousDistDirectory
}
