#Requires -Version 5.1
<#
.SYNOPSIS
  Inicia ambient_host_player.py en segundo plano con autoplay.
  Seguro llamar varias veces: si ya responde en :8788, no duplica.

.EXAMPLE
  .\scripts\Start-AmbientHost.ps1
  .\scripts\Start-AmbientHost.ps1 -AutoPlay likes
#>
param(
    [string]$ProjectRoot = "",
    # off = no musica al arrancar (default). default|likes|all_shuffle = autoplay
    [string]$AutoPlay = "off",
    [int]$Port = 8788
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
$Music = Join-Path $Root "Music"
$scriptPy = Join-Path $Root "scripts\ambient_host_player.py"
$logDir = Join-Path $Root "scripts\generated"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "ambient.log"

function ALog([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m
    Add-Content -Path $log -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    Write-Host $line
}

function Test-AmbientUp {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
        return ($r.ok -eq $true)
    } catch {
        return $false
    }
}

function Get-AmbientStatusObj {
    try {
        return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 3
    } catch {
        return $null
    }
}

function Test-AmbientPlaying {
    $r = Get-AmbientStatusObj
    return [bool]($r -and $r.playing)
}

function Resolve-AutoPlayMode {
    param([string]$Requested)
    $m = if ($Requested) { $Requested.ToLower() } else { "off" }
    if ($m -in @("auto", "config", "from-api", "from_api")) {
        try {
            $c = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/ambient/boot-autoplay" -TimeoutSec 3
            if ($c.autoplay_on_boot -or $c.enabled) { return "default" }
            return "off"
        } catch {
            return "off"
        }
    }
    return $m
}

function Ensure-AutoPlay {
    $mode = Resolve-AutoPlayMode $AutoPlay
    if ($mode -in @("0", "off", "false", "no", "none", "")) {
        ALog "Autoplay desactivado (no se inicia musica sola)"
        return
    }
    $st = Get-AmbientStatusObj
    if ($st -and $st.playing) {
        ALog "Musica ya sonando"
        return
    }
    if ($st -and $st.paused) {
        ALog "Host en pausa (usuario) - no se fuerza autoplay"
        return
    }
    ALog "Forzando autoplay ($mode)..."
    try {
        # Endpoint unificado del player (si existe)
        try {
            $body = (@{ mode = $mode } | ConvertTo-Json -Compress)
            $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ensure-play" -Method POST `
                -ContentType "application/json" -Body $body -TimeoutSec 12
            if ($r -and $r.ok -ne $false) {
                ALog "Autoplay via /ensure-play"
                return
            }
        } catch { }

        $likes = @()
        try {
            $pl = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/playlists" -TimeoutSec 5
            $likes = @($pl.likes)
        } catch { }

        if ($mode -in @("default", "1", "true", "yes")) {
            if ($likes.Count -gt 0) {
                Invoke-RestMethod -Uri "http://127.0.0.1:$Port/playlist/play" -Method POST `
                    -ContentType "application/json" -Body '{"name":"likes","shuffle":true}' -TimeoutSec 10 | Out-Null
                ALog "Autoplay: Me gusta ($($likes.Count))"
            } else {
                Invoke-RestMethod -Uri "http://127.0.0.1:$Port/mode" -Method POST `
                    -ContentType "application/json" -Body '{"mode":"all_shuffle"}' -TimeoutSec 8 | Out-Null
                Invoke-RestMethod -Uri "http://127.0.0.1:$Port/play" -Method POST `
                    -ContentType "application/json" -Body '{"folder":""}' -TimeoutSec 8 | Out-Null
                ALog "Autoplay: shuffle todas"
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
    } catch {
        ALog "WARN autoplay: $_"
    }
}

# Ya esta el servicio sano? -> NO lanzar otra ventana python
if (Test-AmbientUp) {
    ALog "ambient_host ya responde en :$Port (instancia unica - no se lanza otro)"
    Ensure-AutoPlay
    exit 0
}

if (-not (Test-Path $scriptPy)) {
    ALog "ERROR: no existe $scriptPy"
    exit 1
}
if (-not (Test-Path $Music)) {
    New-Item -ItemType Directory -Force -Path $Music | Out-Null
}

# Puerto/API caidos pero VLC o python viejo siguen: limpiar antes de un solo relanzamiento
try {
    if (Get-Command Stop-AmbientOrphans -ErrorAction SilentlyContinue) {
        $clean = Stop-AmbientOrphans -Port $Port
        if ($clean.killed) {
            ALog "Limpieza huerfanos: python=$($clean.python) vlc=$($clean.vlc)"
        }
    }
} catch {
    ALog "WARN limpieza huerfanos: $_"
}

# Tras limpiar, si otro proceso ya levanto el host, no duplicar
Start-Sleep -Milliseconds 500
if (Test-AmbientUp) {
    ALog "ambient_host volvio tras limpieza - no se duplica"
    Ensure-AutoPlay
    exit 0
}

$py = $null
try {
    if (Get-Command Ensure-Python -ErrorAction SilentlyContinue) {
        $py = Ensure-Python -Quiet
    }
} catch { }
if (-not $py) {
    try { $py = Get-PythonExe } catch { $py = $null }
}
if (-not $py) {
    ALog "ERROR: Python no encontrado. Instale Python 3 y reintente (o ejecute INSTALLAR.bat)."
    exit 1
}

# mutagen = ID3 + caratula embebida al normalizar MP3 (scan)
try {
    if ($py -eq "py") {
        & py -3 -c "import mutagen" 2>$null
    } elseif ($py -eq "python") {
        & python -c "import mutagen" 2>$null
    } else {
        & $py -c "import mutagen" 2>$null
    }
    if ($LASTEXITCODE -ne 0) {
        ALog "Instalando mutagen (metadatos/caratulas MP3)..."
        if ($py -eq "py") { & py -3 -m pip install --user mutagen -q }
        elseif ($py -eq "python") { & python -m pip install --user mutagen -q }
        else { & $py -m pip install --user mutagen -q }
    } else {
        ALog "mutagen OK"
    }
} catch {
    ALog "WARN: no se pudo verificar mutagen: $_"
}

$bootMode = Resolve-AutoPlayMode $AutoPlay
ALog "Iniciando UN solo ambient_host_player.py (python=$py autoplay=$bootMode)"

# Lanzar proceso persistente (ventana minimizada; el propio .py evita duplicados)
$argList = @(
    $scriptPy,
    "--music", $Music,
    "--port", "$Port",
    "--autoplay", $bootMode
)

if ($py -eq "py") {
    Start-Process -FilePath "py" -ArgumentList (@("-3") + $argList) `
        -WorkingDirectory $Root -WindowStyle Minimized
} elseif ($py -eq "python") {
    Start-Process -FilePath "python" -ArgumentList $argList `
        -WorkingDirectory $Root -WindowStyle Minimized
} else {
    Start-Process -FilePath $py -ArgumentList $argList `
        -WorkingDirectory $Root -WindowStyle Minimized
}

# Esperar a que levante API (hasta 45s)
$ok = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    if (Test-AmbientUp) {
        $ok = $true
        break
    }
}

if ($ok) {
    ALog "ambient_host LISTO en :$Port"
    Start-Sleep -Seconds 1
    Ensure-AutoPlay
    exit 0
}

ALog "ERROR: ambient_host no respondio en 45s (ver $log)"
exit 1
