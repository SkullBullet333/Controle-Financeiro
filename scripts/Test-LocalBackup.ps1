[CmdletBinding()]
param(
  [string]$CsvDirectory,
  [string]$SqlDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not $CsvDirectory) { $CsvDirectory = Join-Path $repositoryRoot '.BaseCSV' }
if (-not $SqlDirectory) { $SqlDirectory = Join-Path $repositoryRoot '.BaseSQL' }

$expectedTables = @(
  'profiles',
  'titulares',
  'cartoes_config',
  'emprestimos',
  'contas_fixas',
  'cartoes',
  'despesas',
  'receitas',
  'table_notas'
)

function Assert-BackupCondition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw "Backup inválido: $Message"
  }
}

function Get-RowKey {
  param(
    [psobject]$Row,
    [string[]]$Columns
  )

  return (($Columns | ForEach-Object { [string]$Row.$_ }) -join '|')
}

function Test-UniqueRows {
  param(
    [object[]]$Rows,
    [string[]]$Columns,
    [string]$CheckName,
    [switch]$IgnoreWhenAnyEmpty
  )

  $keys = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($row in $Rows) {
    if ($IgnoreWhenAnyEmpty) {
      $hasEmpty = $false
      foreach ($column in $Columns) {
        if ([string]::IsNullOrWhiteSpace([string]$row.$column)) {
          $hasEmpty = $true
          break
        }
      }
      if ($hasEmpty) { continue }
    }

    $key = Get-RowKey -Row $row -Columns $Columns
    Assert-BackupCondition -Condition ($keys.Add($key)) -Message "$CheckName contém duplicidade"
  }
}

function Assert-Reference {
  param(
    [object[]]$Rows,
    [string]$Column,
    [System.Collections.Generic.HashSet[string]]$TargetIds,
    [string]$CheckName
  )

  $missingCount = @($Rows | Where-Object {
    $value = [string]$_.$Column
    -not [string]::IsNullOrWhiteSpace($value) -and -not $TargetIds.Contains($value)
  }).Count

  Assert-BackupCondition -Condition ($missingCount -eq 0) -Message "$CheckName possui $missingCount referência(s) ausente(s)"
}

Assert-BackupCondition -Condition (Test-Path -LiteralPath $CsvDirectory -PathType Container) -Message 'a pasta .BaseCSV não foi encontrada'
Assert-BackupCondition -Condition (Test-Path -LiteralPath $SqlDirectory -PathType Container) -Message 'a pasta .BaseSQL não foi encontrada'

$tables = @{}
$summary = @()

foreach ($tableName in $expectedTables) {
  $csvPath = Join-Path $CsvDirectory "${tableName}_rows.csv"
  $sqlPath = Join-Path $SqlDirectory "${tableName}_rows.sql"

  Assert-BackupCondition -Condition (Test-Path -LiteralPath $csvPath -PathType Leaf) -Message "arquivo CSV ausente para $tableName"
  Assert-BackupCondition -Condition (Test-Path -LiteralPath $sqlPath -PathType Leaf) -Message "arquivo SQL ausente para $tableName"

  $rows = @(Import-Csv -LiteralPath $csvPath)
  Assert-BackupCondition -Condition ($rows.Count -gt 0) -Message "arquivo CSV vazio para $tableName"

  $csvColumns = @($rows[0].PSObject.Properties.Name)
  $sqlText = [System.IO.File]::ReadAllText($sqlPath)
  $insertMatch = [regex]::Match(
    $sqlText,
    '^\s*INSERT\s+INTO\s+"public"\."(?<table>[^"]+)"\s*\((?<columns>.*?)\)\s*VALUES',
    [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  Assert-BackupCondition -Condition $insertMatch.Success -Message "formato SQL não reconhecido para $tableName"
  Assert-BackupCondition -Condition ($insertMatch.Groups['table'].Value -ceq $tableName) -Message "a tabela declarada no SQL de $tableName não corresponde ao arquivo"

  $sqlColumns = @([regex]::Matches($insertMatch.Groups['columns'].Value, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
  Assert-BackupCondition -Condition ($sqlColumns.Count -eq $csvColumns.Count) -Message "CSV e SQL de $tableName têm quantidades diferentes de colunas"
  for ($index = 0; $index -lt $csvColumns.Count; $index++) {
    Assert-BackupCondition -Condition ($csvColumns[$index] -ceq $sqlColumns[$index]) -Message "CSV e SQL de $tableName divergem nas colunas"
  }

  $tables[$tableName] = $rows
  $summary += [pscustomobject]@{
    Tabela = $tableName
    Registros = $rows.Count
    Colunas = $csvColumns.Count
  }
}

$idSets = @{}
foreach ($tableName in @('profiles', 'titulares', 'cartoes_config', 'emprestimos', 'contas_fixas')) {
  Test-UniqueRows -Rows $tables[$tableName] -Columns @('id') -CheckName "$tableName.id"
  $set = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($row in $tables[$tableName]) { [void]$set.Add([string]$row.id) }
  $idSets[$tableName] = $set
}

foreach ($tableName in $expectedTables) {
  $rows = @($tables[$tableName])
  $columns = @($rows[0].PSObject.Properties.Name)
  if ($columns -contains 'user_id') {
    Assert-Reference -Rows $rows -Column 'user_id' -TargetIds $idSets['profiles'] -CheckName "$tableName.user_id"
  }
  if ($columns -contains 'titular_id') {
    Assert-Reference -Rows $rows -Column 'titular_id' -TargetIds $idSets['titulares'] -CheckName "$tableName.titular_id"
  }
  if ($columns -contains 'cartao_id') {
    Assert-Reference -Rows $rows -Column 'cartao_id' -TargetIds $idSets['cartoes_config'] -CheckName "$tableName.cartao_id"
  }
  if ($columns -contains 'emprestimo_id') {
    Assert-Reference -Rows $rows -Column 'emprestimo_id' -TargetIds $idSets['emprestimos'] -CheckName "$tableName.emprestimo_id"
  }
  if ($columns -contains 'conta_fixa_id') {
    Assert-Reference -Rows $rows -Column 'conta_fixa_id' -TargetIds $idSets['contas_fixas'] -CheckName "$tableName.conta_fixa_id"
  }
}

Test-UniqueRows -Rows $tables['despesas'] -Columns @('family_id', 'emprestimo_id', 'parcela_atual') -CheckName 'parcelas de empréstimos' -IgnoreWhenAnyEmpty
Test-UniqueRows -Rows $tables['despesas'] -Columns @('family_id', 'conta_fixa_id', 'parcela_atual') -CheckName 'parcelas de contas fixas' -IgnoreWhenAnyEmpty
Test-UniqueRows -Rows $tables['receitas'] -Columns @('family_id', 'conta_fixa_id', 'competencia') -CheckName 'receitas fixas por competência' -IgnoreWhenAnyEmpty

$invalidClosingDays = @($tables['cartoes_config'] | Where-Object {
  $parsed = 0
  -not [int]::TryParse([string]$_.dia_fechamento, [ref]$parsed) -or $parsed -lt 0 -or $parsed -gt 31
}).Count
Assert-BackupCondition -Condition ($invalidClosingDays -eq 0) -Message 'há cartões com intervalo de fechamento inválido'

$familyIds = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($row in $tables['profiles']) { [void]$familyIds.Add([string]$row.family_id) }
foreach ($tableName in $expectedTables) {
  $rows = @($tables[$tableName])
  if (@($rows[0].PSObject.Properties.Name) -contains 'family_id') {
    Assert-Reference -Rows $rows -Column 'family_id' -TargetIds $familyIds -CheckName "$tableName.family_id"
  }
}

$profileUsers = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($tableName in $expectedTables) {
  foreach ($row in @($tables[$tableName])) {
    if (@($row.PSObject.Properties.Name) -contains 'user_id' -and -not [string]::IsNullOrWhiteSpace([string]$row.user_id)) {
      [void]$profileUsers.Add([string]$row.user_id)
    }
  }
}

Write-Output 'Backup local validado sem exibir conteúdo financeiro ou pessoal.'
$summary | Format-Table -AutoSize
Write-Output ("Total de registros públicos: {0}" -f (($summary | Measure-Object -Property Registros -Sum).Sum))
Write-Output ("Famílias distintas: {0}" -f $familyIds.Count)
Write-Output ("Usuários referenciados: {0}" -f $profileUsers.Count)
Write-Output 'Observação: auth.users e arquivos do Storage não fazem parte deste backup.'
