#Requires -Version 5.1
<#
.SYNOPSIS
  Vigilante permanente del reproductor ambiente.

.DESCRIPTION
  - Si ambient_host_player no responde en :8788, lo relanza.
  - Si responde pero no suena (y no esta en pausa del usuario), arranca autoplay.
  - Pensado para correr minimizado al iniciar sesion (Task Scheduler).
  - Idempotente: una sola instancia (mutex).

.EXAMPLE
  .\scripts\Watch-AmbientHost.ps1
  .\scripts\Watch-AmbientHost.ps1 -IntervalSec 12 -AutoPlay default
#>
param(
    [string]$ProjectRoot = "",
    [string]$AutoPlay = "off",
    [int]$Port = 8788,
    [int]$IntervalSec = 12
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
$logDir = Join-Path $Root "scripts\generated"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "ambient-watch.log"
$startScript = Join-Path $ScriptDir "Start-AmbientHost.ps1"

# Una sola instancia
$mutexName = "Global\ElCallejonAmbientWatch"
$created = $false
try {
    $mutex = New-Object System.Threading.Mutex($false, $mutexName, [ref]$created)
} catch {
    $mutex = $null
    $created = $true
}
if ($mutex -and -not $mutex.WaitOne(0)) {
    Add-Content -Path $log -Value ("[{0}] Otra instancia del watch ya corre; saliendo." -f (Get-Date -Format "HH:mm:ss")) -Encoding UTF8
    exit 0
}

function WLog([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
    Add-Content -Path $log -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    Write-Host $line
}

function Get-AmbientStatus {
    try {
        return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 3
    } catch {
        return $null
    }
}

function Test-AmbientHealth {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
        return ($r.ok -eq $true)
    } catch {
        return $false
    }
}

function Resolve-WatchAutoPlay {
    $m = if ($AutoPlay) { $AutoPlay.ToLower() } else { "off" }
    if ($m -in @("auto", "config", "from-api", "from_api")) {
        try {
            $c = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/ambient/boot-autoplay" -TimeoutSec 3
            if ($c.autoplay_on_boot -or $c.enabled) { return "default" }
            return "off"
        } catch { return "off" }
    }
    return $m
}

function Invoke-EnsurePlay {
    $mode = Resolve-WatchAutoPlay
    if ($mode -in @("0", "off", "false", "no", "none", "")) {
        WLog "Autoplay off - no se fuerza musica"
        return @{ ok = $true; skipped = $true }
    }
    # Preferir endpoint del host; fallback a logica local
    try {
        $body = @{ mode = $mode } | ConvertTo-Json -Compress
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ensure-play" -Method POST `
            -ContentType "application/json" -Body $body -TimeoutSec 12
        return $r
    } catch {
        # Fallback: mismos POST que Start-AmbientHost
        try {
            $pl = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/playlists" -TimeoutSec 5
            $likes = @($pl.likes)
            if ($mode -in @("default", "1", "true", "yes")) {
                if ($likes.Count -gt 0) {
                    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/playlist/play" -Method POST `
                        -ContentType "application/json" -Body '{"name":"likes","shuffle":true}' -TimeoutSec 10 | Out-Null
                } else {
                    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/mode" -Method POST `
                        -ContentType "application/json" -Body '{"mode":"all_shuffle"}' -TimeoutSec 8 | Out-Null
                    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/play" -Method POST `
                        -ContentType "application/json" -Body '{"folder":""}' -TimeoutSec 8 | Out-Null
                }
            } elseif ($mode -in @("likes", "me_gusta")) {
                Invoke-RestMethod -Uri "http://127.0.0.1:$Port/playlist/play" -Method POST `
                    -ContentType "application/json" -Body '{"name":"likes","shuffle":true}' -TimeoutSec 10 | Out-Null
            } else {
                Invoke-RestMethod -Uri "http://127.0.0.1:$Port/mode" -Method POST `
                    -ContentType "application/json" -Body '{"mode":"all_shuffle"}' -TimeoutSec 8 | Out-Null
                Invoke-RestMethod -Uri "http://127.0.0.1:$Port/play" -Method POST `
                    -ContentType "application/json" -Body '{"folder":""}' -TimeoutSec 8 | Out-Null
            }
            return @{ ok = $true }
        } catch {
            return $null
        }
    }
}

WLog "=== Watch AmbientHost (intervalo ${IntervalSec}s, autoplay=$AutoPlay) ==="
WLog "Root: $Root"

$failStreak = 0
$lastRestart = [datetime]::MinValue
# Tras un caido o al primer ciclo online: pedir autoplay una vez (no pelea con Stop del usuario)
$needAutoplayOnce = $true
# Cooldown largo: evita 3 ventanas python seguidas
$restartCooldownSec = 45

try {
    while ($true) {
        try {
            if (-not (Test-AmbientHealth)) {
                $failStreak++
                $needAutoplayOnce = $true
                $since = (Get-Date) - $lastRestart
                # Evitar reinicios en bucle / multi-instancia
                if ($since.TotalSeconds -lt $restartCooldownSec -and $lastRestart -ne [datetime]::MinValue) {
                    WLog "Host caido (racha $failStreak); cooldown ${restartCooldownSec}s (no relanzar otra vez)..."
                } else {
                    WLog "Host offline en :$Port - limpiar huerfanos + un solo relanzamiento..."
                    try {
                        if (Get-Command Stop-AmbientOrphans -ErrorAction SilentlyContinue) {
                            $c = Stop-AmbientOrphans -Port $Port -Force
                            if ($c.killed) { WLog "Huerfanos: py=$($c.python) vlc=$($c.vlc)" }
                        }
                        # Start-AmbientHost sale al instante si ya hay health
                        $ap = Resolve-WatchAutoPlay
                        & $startScript -ProjectRoot $Root -AutoPlay $ap -Port $Port
                        $lastRestart = Get-Date
                        $failStreak = 0
                        $needAutoplayOnce = $true
                        if (Test-AmbientHealth) {
                            WLog "Relanzado OK (una instancia)"
                        } else {
                            WLog "WARN: tras relanzar, :$Port aun no responde"
                        }
                    } catch {
                        WLog "ERROR al relanzar: $_"
                        $lastRestart = Get-Date
                    }
                }
            } else {
                $failStreak = 0
                $st = Get-AmbientStatus
                if ($null -eq $st) {
                    # health ok pero status fallo: reintentar en el siguiente ciclo
                } elseif ($st.playing) {
                    $needAutoplayOnce = $false
                } elseif ($st.paused) {
                    # Usuario pauso: no forzar y no reintentar en bucle
                    $needAutoplayOnce = $false
                } elseif ($needAutoplayOnce) {
                    # Primer online / recuperacion: poner musica sin intervencion
                    WLog "Host vivo sin musica - ensure-play ($AutoPlay)..."
                    $r = Invoke-EnsurePlay
                    if ($r -and $r.ok -ne $false) {
                        WLog "Autoplay solicitado"
                    } else {
                        WLog "WARN: no se pudo ensure-play"
                    }
                    $needAutoplayOnce = $false
                }
            }
        } catch {
            WLog "WARN ciclo: $_"
        }
        Start-Sleep -Seconds ([Math]::Max(5, $IntervalSec))
    }
} finally {
    if ($mutex) {
        try { $mutex.ReleaseMutex() } catch { }
        try { $mutex.Dispose() } catch { }
    }
}
