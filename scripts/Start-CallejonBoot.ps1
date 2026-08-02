#Requires -Version 5.1
<#
.SYNOPSIS
  Arranque autonomo al encender el PC servidor.

.DESCRIPTION
  ORDEN pensado para no retrasar la musica:
  1) ambient_host_player.py YA (no espera Docker)
  2) Docker + contenedores (en paralelo a la musica)
  3) Hub QR + navegador admin

.EXAMPLE
  .\scripts\Start-CallejonBoot.ps1
#>
param(
    [switch]$NoBrowser,
    [switch]$NoElevate,
    [string]$ProjectRoot = "",
    [int]$DockerWaitMin = 5
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
$logDir = Join-Path $Root "scripts\generated"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "boot.log"

function Log([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    Write-Host $line
}

if (-not $NoElevate -and -not (Test-IsAdmin)) {
    $argList = @("-NoElevate")
    if ($NoBrowser) { $argList += "-NoBrowser" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

Set-Location $Root
Log "=== Boot autonomo El Callejon ==="
Log "Root: $Root"

# ---------------------------------------------------------------------------
# 1) MUSICA PRIMERO (no depende de Docker) — evita retraso de reproduccion
# ---------------------------------------------------------------------------
Log ">>> Arrancando ambient_host_player (prioridad musica + autoplay)..."
try {
    & (Join-Path $ScriptDir "Start-AmbientHost.ps1") -ProjectRoot $Root -AutoPlay "auto"
    Log "Ambient host: OK"
} catch {
    Log "WARN ambient: $_"
}

# Vigilante en segundo plano (relanza player si cae; una sola instancia)
$watchPs1 = Join-Path $ScriptDir "Watch-AmbientHost.ps1"
if (Test-Path $watchPs1) {
    try {
        Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Minimized",
            "-File", $watchPs1,
            "-ProjectRoot", $Root,
            "-AutoPlay", "default"
        ) -WindowStyle Minimized
        Log "Ambient watch: lanzado (keep-alive)"
    } catch {
        Log "WARN ambient watch: $_"
    }
}

# ---------------------------------------------------------------------------
# 2) Docker en paralelo (musica ya puede estar sonando)
# ---------------------------------------------------------------------------
Log "Esperando Docker Desktop..."
$dockerOk = $false
$deadline = (Get-Date).AddMinutes($DockerWaitMin)

$dockerUi = @(
    "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($dockerUi) {
    $dd = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    if (-not $dd) {
        Log "Iniciando Docker Desktop..."
        Start-Process $dockerUi
    }
}

while ((Get-Date) -lt $deadline) {
    try {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $dockerOk = $true
            break
        }
    } catch { }
    Start-Sleep -Seconds 5
}

if (-not $dockerOk) {
    Log "ERROR: Docker no disponible en $DockerWaitMin min"
} else {
    Log "Docker OK"
}

$lan = Get-LanIPv4
if (-not $lan) { $lan = "127.0.0.1" }
Log "LAN IP: $lan"
try {
    Ensure-EnvFile -Root $Root -LanIp $(if ($lan -ne "127.0.0.1") { $lan } else { $null })
} catch {
    Log "WARN env: $_"
}

if ($dockerOk) {
    Log "docker compose up -d"
    Push-Location $Root
    try {
        docker compose up -d 2>&1 | ForEach-Object { Log "  $_" }
    } finally {
        Pop-Location
    }
    Log "Esperando backend /health..."
    if (Wait-HttpOk -Url "http://127.0.0.1:8000/health" -TimeoutSec 180) {
        Log "Backend healthy"
    } else {
        Log "WARN: backend lento o caido"
    }
    if (Wait-HttpOk -Url "http://127.0.0.1:5173/" -TimeoutSec 90) {
        Log "Frontend OK"
    } else {
        Log "WARN: frontend lento"
    }
}

# Reconfirmar musica (por si el host cayo o no autoplay)
Log "Reconfirmando musica ambiente..."
try {
    & (Join-Path $ScriptDir "Start-AmbientHost.ps1") -ProjectRoot $Root -AutoPlay "auto"
} catch {
    Log "WARN ambient recheck: $_"
}

# ---------------------------------------------------------------------------
# 3) Hub QR + navegador
# ---------------------------------------------------------------------------
Log "Generando hub QR..."
try {
    & (Join-Path $ScriptDir "Start-Callejon.ps1") -NoCompose -NoElevate -NoBrowser -ProjectRoot $Root
} catch {
    Log "WARN hub: $_"
}

$hubHtml = Join-Path $logDir "hub.html"
$hubAdmin = "http://${lan}:5173/login"
$hubTv = "http://${lan}:5173/"

if (-not $NoBrowser) {
    Log "Abriendo navegador (QR admin)"
    if (Test-Path $hubHtml) {
        Start-Process $hubHtml
    }
    Start-Process $hubAdmin
}

Log "=== Boot listo ==="
Log "Admin: $hubAdmin"
Log "TVs:   $hubTv"
Log "Ambient log: scripts\generated\ambient.log"
Log "Boot log:    $logFile"
