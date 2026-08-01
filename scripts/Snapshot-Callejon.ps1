#Requires -Version 5.1
<#
.SYNOPSIS
  Snapshot limpio del sistema (detiene stack, copia, reinicia).

.DESCRIPTION
  1) docker compose stop
  2) robocopy proyecto -> snapshots/SNAP_yyyyMMdd-HHmm (o -Destination)
  3) docker compose start
  Incluye multimedia, Music, data/postgres, .env

.EXAMPLE
  .\scripts\Snapshot-Callejon.ps1
  .\scripts\Snapshot-Callejon.ps1 -Destination "D:\Backups\Callejon"
#>
param(
    [string]$Destination = "",
    [switch]$NoElevate,
    [string]$ProjectRoot = "",
    [switch]$SkipStop
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not $NoElevate -and -not (Test-IsAdmin)) {
    $argList = @("-NoElevate")
    if ($Destination) { $argList += "-Destination"; $argList += "`"$Destination`"" }
    if ($SkipStop) { $argList += "-SkipStop" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
Set-Location $Root

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
if (-not $Destination) {
    $snapRoot = Join-Path $Root "snapshots"
    New-Item -ItemType Directory -Force -Path $snapRoot | Out-Null
    $Destination = Join-Path $snapRoot "SNAP_$stamp"
}

Write-Step "Snapshot limpio -> $Destination"

if (-not $SkipStop) {
    Write-Step "Deteniendo contenedores (Postgres quieto)..."
    Push-Location $Root
    try {
        docker compose stop 2>$null
    } finally {
        Pop-Location
    }
    Start-Sleep -Seconds 2
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null

$xd = @("node_modules", ".venv", "__pycache__", "snapshots", "scripts\generated")
$xf = @("*.pyc", "Thumbs.db", "postmaster.pid", "desktop.ini")
$xdArgs = @(); foreach ($d in $xd) { $xdArgs += "/XD"; $xdArgs += $d }
$xfArgs = @(); foreach ($f in $xf) { $xfArgs += "/XF"; $xfArgs += $f }

$log = Join-Path $Destination "_snapshot-log.txt"
$rcArgs = @(
    $Root, $Destination,
    "/E", "/COPY:DAT", "/R:2", "/W:2", "/MT:8",
    "/NFL", "/NDL", "/NP", "/LOG:$log"
) + $xdArgs + $xfArgs

Write-Step "Copiando archivos..."
& robocopy @rcArgs
if ($LASTEXITCODE -ge 8) {
    Write-Fail "robocopy fallo ($LASTEXITCODE)"
} else {
    Write-Ok "Copia terminada"
}

@{
    type = "clean_snapshot"
    created_at = (Get-Date).ToString("o")
    source = $Root
    destination = $Destination
    computer = $env:COMPUTERNAME
} | ConvertTo-Json | Set-Content (Join-Path $Destination "SNAPSHOT.json") -Encoding UTF8

if (-not $SkipStop) {
    Write-Step "Reiniciando contenedores..."
    Push-Location $Root
    try {
        docker compose start
        if ($LASTEXITCODE -ne 0) { docker compose up -d }
    } finally {
        Pop-Location
    }
    $null = Wait-HttpOk -Url "http://127.0.0.1:8000/health" -TimeoutSec 90
    Write-Ok "Stack de nuevo en linea"
}

Write-Host ""
Write-Host "  Snapshot listo: $Destination" -ForegroundColor Green
Write-Host ""
