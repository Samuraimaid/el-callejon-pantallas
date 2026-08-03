#Requires -Version 5.1
<#
.SYNOPSIS
  Revisa e instala actualizaciones de Docker Desktop (winget) de forma segura.

.DESCRIPTION
  Pensado para correr a las 16:00 (antes del apagado automatico del PC a las 17:00):
  1) docker compose stop (si el proyecto existe)
  2) winget upgrade Docker.DockerDesktop si hay version nueva
  3) reinicia Docker Desktop y el stack del proyecto si es posible
  4) log en scripts/generated/docker-update.log

.EXAMPLE
  .\scripts\Update-DockerDesktop.ps1
  .\scripts\Update-DockerDesktop.ps1 -SkipStackStop
  .\scripts\Update-DockerDesktop.ps1 -CheckOnly
#>
param(
    [switch]$CheckOnly,
    [switch]$SkipStackStop,
    [switch]$NoElevate,
    [string]$ProjectRoot = "",
    [int]$DockerWaitMin = 4
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not $NoElevate -and -not (Test-IsAdmin)) {
    $argList = @("-NoElevate")
    if ($CheckOnly) { $argList += "-CheckOnly" }
    if ($SkipStackStop) { $argList += "-SkipStackStop" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    if ($DockerWaitMin) { $argList += "-DockerWaitMin"; $argList += "$DockerWaitMin" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot.TrimEnd('\', '/') } else { Get-ProjectRoot }
$logDir = Join-Path $Root "scripts\generated"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "docker-update.log"

function DLog([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
    Add-Content -Path $log -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    Write-Host $line
}

function Get-DockerUpgradeAvailable {
    $winget = Get-WingetPath
    if (-not $winget) {
        return @{ available = $false; reason = "winget_no_disponible" }
    }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        # Lista upgrades; busca Docker Desktop
        $out = & $winget upgrade --id Docker.DockerDesktop -e 2>&1 | Out-String
        $text = $out
        # Codigos: 0 = hay upgrade o OK; -1978335189 = no hay actualizacion a veces
        # Mensajes tipicos: "No applicable update found" / "No available upgrade"
        function _clip([string]$s, [int]$n = 200) {
            if (-not $s) { return "" }
            $t = $s.Trim()
            if ($t.Length -le $n) { return $t }
            return $t.Substring(0, $n)
        }
        if ($text -match '(?i)No applicable update|No available upgrade|No newer package|ya est. instalada|is already installed|No updates found') {
            return @{ available = $false; reason = "al_dia"; detail = (_clip $text) }
        }
        # winget list muestra "Available" si hay upgrade
        $list = & $winget list --id Docker.DockerDesktop -e 2>&1 | Out-String
        if ($list -match '(?i)Docker' -and $list -match '(?i)\bAvailable\b|\bDisponible\b') {
            return @{ available = $true; reason = "update_available"; detail = (_clip $list 300) }
        }
        # Lista global de upgrades
        $up = & $winget upgrade 2>&1 | Out-String
        if ($up -match 'Docker\.DockerDesktop') {
            return @{ available = $true; reason = "en_lista_upgrade"; detail = "Docker.DockerDesktop en winget upgrade" }
        }
        # Si Docker no esta instalado via winget, no forzar
        if ($list -notmatch '(?i)Docker') {
            return @{ available = $false; reason = "no_detectado_winget"; detail = (_clip $list) }
        }
        return @{ available = $false; reason = "al_dia"; detail = (_clip ($list + " | " + $up) 250) }
    } catch {
        return @{ available = $false; reason = "error"; detail = "$_" }
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Stop-CallejonStack {
    if (-not (Test-Path (Join-Path $Root "docker-compose.yml"))) {
        DLog "No hay docker-compose en $Root"
        return
    }
    DLog "Deteniendo contenedores El Callejon..."
    Push-Location $Root
    try {
        docker compose stop 2>&1 | ForEach-Object { DLog "  $_" }
    } finally {
        Pop-Location
    }
}

function Start-CallejonStack {
    if (-not (Test-Path (Join-Path $Root "docker-compose.yml"))) { return }
    DLog "Levantando contenedores..."
    Push-Location $Root
    try {
        docker compose up -d 2>&1 | ForEach-Object { DLog "  $_" }
    } finally {
        Pop-Location
    }
    if (Get-Command Wait-HttpOk -ErrorAction SilentlyContinue) {
        if (Wait-HttpOk -Url "http://127.0.0.1:8000/health" -TimeoutSec 120) {
            DLog "Backend healthy"
        } else {
            DLog "WARN: backend no respondio a tiempo"
        }
    }
}

function Start-DockerDesktopUi {
    $paths = @(
        "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) {
            DLog "Iniciando Docker Desktop UI..."
            try { Start-Process $p } catch { DLog "WARN start UI: $_" }
            return
        }
    }
}

function Wait-DockerEngine([int]$minutes) {
    $deadline = (Get-Date).AddMinutes($minutes)
    while ((Get-Date) -lt $deadline) {
        try {
            docker info 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                DLog "Motor Docker listo"
                return $true
            }
        } catch { }
        Start-Sleep -Seconds 8
    }
    DLog "WARN: Docker no respondio en $minutes min"
    return $false
}

# ——— main ———
DLog "=== Update-DockerDesktop (CheckOnly=$CheckOnly) ==="
DLog "Root: $Root"

$winget = Get-WingetPath
if (-not $winget) {
    DLog "ERROR: winget no disponible"
    exit 1
}

$check = Get-DockerUpgradeAvailable
DLog ("Revision: available={0} reason={1}" -f $check.available, $check.reason)
if ($check.detail) {
    $d = ($check.detail -replace '\s+', ' ').Trim()
    if ($d.Length -gt 180) { $d = $d.Substring(0, 180) }
    DLog ("  detail: {0}" -f $d)
}

if ($CheckOnly) {
    if ($check.available) {
        Write-Host "  Hay actualizacion de Docker Desktop disponible." -ForegroundColor Yellow
        exit 0
    }
    Write-Host "  Docker Desktop al dia (o no se detecto update)." -ForegroundColor Green
    exit 0
}

if (-not $check.available) {
    DLog "Nada que instalar. Fin."
    exit 0
}

# Hay update: detener stack, actualizar, reiniciar
if (-not $SkipStackStop) {
    Stop-CallejonStack
    Start-Sleep -Seconds 3
}

DLog "Ejecutando winget upgrade Docker.DockerDesktop..."
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & $winget upgrade --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements --silent 2>&1 |
        ForEach-Object { DLog "  winget: $_" }
    $code = $LASTEXITCODE
    DLog "winget exit=$code"
    # 0 ok; -1978335189 ya instalado / no update
    if ($code -eq -1978335189 -or $code -eq -1978335212) {
        DLog "winget: sin cambios (ya al dia)"
    }
} catch {
    DLog "ERROR winget upgrade: $_"
} finally {
    $ErrorActionPreference = $prev
}

Update-SessionPath
Start-Sleep -Seconds 5
Start-DockerDesktopUi
$null = Wait-DockerEngine $DockerWaitMin

if (-not $SkipStackStop) {
    Start-CallejonStack
}

DLog "=== Fin update Docker ==="
exit 0
