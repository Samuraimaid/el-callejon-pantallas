#Requires -Version 5.1
<#
.SYNOPSIS
  Asegura que ambient_host_player (:8788) y el vigilante esten vivos.
  Seguro llamar cada 1-2 min desde Task Scheduler o al login.

.DESCRIPTION
  - Si :8788 no responde -> Start-AmbientHost (autoplay).
  - Si el Watch no esta en memoria -> lo lanza minimizado.
  - Nunca tumba el script del llamador (exit 0 en casi todos los casos).

.EXAMPLE
  .\scripts\Ensure-AmbientRunning.ps1
  .\scripts\Ensure-AmbientRunning.ps1 -ProjectRoot C:\EL_CALLEJON_POS -AutoPlay default
#>
param(
    [string]$ProjectRoot = "",
    [string]$AutoPlay = "off",
    [int]$Port = 8788
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
$logDir = Join-Path $Root "scripts\generated"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "ambient-ensure.log"
$startScript = Join-Path $ScriptDir "Start-AmbientHost.ps1"
$watchScript = Join-Path $ScriptDir "Watch-AmbientHost.ps1"

function ELog([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
    Add-Content -Path $log -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
}

function Test-AmbientHealth {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
        return ($r.ok -eq $true)
    } catch {
        return $false
    }
}

function Test-WatchRunning {
    try {
        $procs = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue
        foreach ($p in @($procs)) {
            $cl = [string]$p.CommandLine
            if ($cl -match 'Watch-AmbientHost\.ps1') { return $true }
        }
    } catch { }
    return $false
}

function Start-WatchMinimized {
    if (-not (Test-Path $watchScript)) {
        ELog "WARN: no existe $watchScript"
        return
    }
    if (Test-WatchRunning) {
        ELog "Watch ya en ejecucion"
        return
    }
    ELog "Lanzando Watch-AmbientHost minimizado..."
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-WindowStyle", "Minimized",
        "-File", $watchScript,
        "-ProjectRoot", $Root,
        "-AutoPlay", $AutoPlay,
        "-Port", "$Port"
    ) -WorkingDirectory $Root -WindowStyle Minimized
}

# --- main ---
ELog "=== Ensure-AmbientRunning (port=$Port autoplay=$AutoPlay) ==="

function Resolve-EnsureAutoPlay {
    $m = if ($AutoPlay) { $AutoPlay.ToLower() } else { "off" }
    if ($m -in @("auto", "config", "from-api", "from_api")) {
        try {
            $c = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/ambient/boot-autoplay" -TimeoutSec 3
            if ($c.autoplay_on_boot -or $c.enabled) { return "default" }
            return "off"
        } catch { return "off" }
    }
    if ($m -in @("default", "likes", "all_shuffle", "shuffle", "all", "1", "true", "yes", "on")) {
        return $m
    }
    return "off"
}

$playMode = Resolve-EnsureAutoPlay
ELog "Modo autoplay resuelto: $playMode (param=$AutoPlay)"

$up = Test-AmbientHealth
if ($up) {
    ELog "Host OK en :$Port (no se lanza otra instancia)"
    # Solo forzar musica si autoplay_on_boot / modo lo permiten
    if ($playMode -notin @("off", "0", "false", "no", "none", "")) {
        try {
            $st = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 3
            if (-not $st.playing -and -not $st.paused) {
                ELog "Host vivo sin musica - POST /ensure-play ($playMode)"
                $body = (@{ mode = $playMode } | ConvertTo-Json -Compress)
                Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ensure-play" -Method POST `
                    -ContentType "application/json" -Body $body -TimeoutSec 12 | Out-Null
            }
        } catch {
            ELog "WARN ensure-play: $_"
        }
    } else {
        ELog "Autoplay OFF - host vivo, no se inicia musica"
    }
} else {
    ELog "Host OFFLINE en :$Port - limpiar huerfanos + un Start (autoplay=$playMode)..."
    try {
        if (Get-Command Stop-AmbientOrphans -ErrorAction SilentlyContinue) {
            $c = Stop-AmbientOrphans -Port $Port -Force
            if ($c.killed) { ELog "Huerfanos: py=$($c.python) vlc=$($c.vlc)" }
        }
    } catch { }
    if (-not (Test-Path $startScript)) {
        ELog "ERROR: no existe $startScript"
        Start-WatchMinimized
        exit 1
    }
    try {
        & $startScript -ProjectRoot $Root -AutoPlay $playMode -Port $Port
        if (Test-AmbientHealth) {
            ELog "Host relanzado OK (instancia unica)"
        } else {
            ELog "WARN: Start-AmbientHost termino pero :$Port sigue sin responder"
        }
    } catch {
        ELog "ERROR Start-AmbientHost: $_"
    }
}

Start-WatchMinimized
ELog "Ensure listo"
exit 0
