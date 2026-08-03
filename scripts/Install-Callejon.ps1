#Requires -Version 5.1
<#
.SYNOPSIS
  Instalador de produccion - PC servidor El Callejon.

.DESCRIPTION
  - Administrador (auto-eleva)
  - Hardware + software (Docker, Python, mutagen, winget)
  - Firewall LAN
  - .env con LAN_IP + ADMIN_PIN
  - docker compose up --build
  - Migraciones SQL
  - ambient_host_player con autoplay
  - Hub QR en navegador
  - Arranque automatico al encender PC
  - Backup semanal programado

.EXAMPLE
  Doble clic: INSTALLAR.bat
  O: .\scripts\Install-Callejon.ps1
#>
param(
    [switch]$SkipDockerInstall,
    [switch]$NoBrowser,
    [switch]$NoBuild,
    [switch]$StartAmbient,
    [switch]$SkipAutostart,
    [switch]$SkipWeeklyBackup,
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not (Test-IsAdmin)) {
    Write-Host "Elevando a Administrador..." -ForegroundColor Yellow
    $argList = @()
    if ($SkipDockerInstall) { $argList += "-SkipDockerInstall" }
    if ($NoBrowser) { $argList += "-NoBrowser" }
    if ($NoBuild) { $argList += "-NoBuild" }
    if ($StartAmbient) { $argList += "-StartAmbient" }
    if ($SkipAutostart) { $argList += "-SkipAutostart" }
    if ($SkipWeeklyBackup) { $argList += "-SkipWeeklyBackup" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
Set-Location $Root
$StartAmbient = $true  # siempre en instalacion de servidor

Write-Host ""
Write-Host "====================================================" -ForegroundColor DarkYellow
Write-Host "  El Callejon - INSTALADOR PC SERVIDOR" -ForegroundColor DarkYellow
Write-Host "  Carteleria digital + musica ambiente" -ForegroundColor DarkYellow
Write-Host "====================================================" -ForegroundColor DarkYellow
Write-Host "  Carpeta: $Root"
Write-Host "  Usuario: $env:USERNAME (Administrador)"
Write-Host "  Fecha:   $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

# ---------- 1. Hardware ----------
Write-Step "1/9 Especificaciones del sistema"
$spec = Get-SystemSpecs
Write-Host ("  PC:     {0}" -f $spec.ComputerName)
Write-Host ("  OS:     {0}" -f $spec.OS)
Write-Host ("  CPU:    {0} ({1} hilos)" -f $spec.CPU, $spec.Cores)
Write-Host ("  RAM:    {0} GB" -f $spec.RAM_GB)
Write-Host ("  Disco:  {0} GB libres en C:" -f $spec.DiskFree_GB)

if (-not $spec.Is64Bit) {
    Write-Fail "Se requiere Windows 64-bit"
    exit 1
}
Write-Ok "Windows 64-bit"
if ($spec.RAM_GB -lt 4) {
    Write-Warn "RAM baja ($($spec.RAM_GB) GB). Recomendado 8 GB+"
} else { Write-Ok "RAM $($spec.RAM_GB) GB" }
if ($spec.DiskFree_GB -lt 15) {
    Write-Warn "Poco espacio libre ($($spec.DiskFree_GB) GB). Recomendado 40 GB+"
} else { Write-Ok "Disco $($spec.DiskFree_GB) GB libres" }

# ---------- 2. Software ----------
Write-Step "2/9 Software instalado"
function Show-Dep([string]$name, [bool]$ok, [string]$detail) {
    if ($ok) { Write-Ok "$name - $detail" } else { Write-Warn "$name - $detail" }
}
Show-Dep "PowerShell" $true $PSVersionTable.PSVersion.ToString()
$wingetOk = [bool](Get-WingetPath)
Show-Dep "winget" $wingetOk $(if ($wingetOk) { "OK" } else { "no encontrado (necesario para autoinstalar deps)" })

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    if (Test-CommandExists "docker") {
        $dv = (docker --version 2>$null | Out-String).Trim()
        if (-not $dv) { $dv = "detectado" }
        Show-Dep "Docker" $true $dv
        docker compose version 2>$null | Out-Null
        Show-Dep "Compose" ($LASTEXITCODE -eq 0) $(if ($LASTEXITCODE -eq 0) { "plugin OK" } else { "falta" })
    } else {
        Show-Dep "Docker" $false "no instalado (se instalara)"
    }
} catch {
    Show-Dep "Docker" $false "error al detectar: $_"
} finally {
    $ErrorActionPreference = $prevEap
}

# Deteccion segura: el alias de Microsoft Store ya no tumba el instalador
$pyProbe = $null
try { $pyProbe = Get-PythonExe } catch { $pyProbe = $null }
Show-Dep "Python" ([bool]$pyProbe) $(if ($pyProbe) { "$pyProbe" } else { "se instalara automaticamente" })

# ---------- 3. Instalar Python si falta (a prueba de fallos) ----------
Write-Step "3/9 Python + mutagen (musica / ID3)"
$py = $null
try {
    $py = Ensure-Python
} catch {
    Write-Warn "Ensure-Python: $_"
    try { $py = Get-PythonExe } catch { $py = $null }
}

if ($py) {
    Write-Ok "Python: $py"
    try {
        if (Install-PythonPackage -PythonExe $py -Package "mutagen") {
            Write-Ok "mutagen (metadatos MP3 + caratulas)"
        } else {
            Write-Warn "mutagen no se pudo instalar (Scan+normalizar puede quedar limitado)"
        }
    } catch {
        Write-Warn "mutagen: $_ (Scan+normalizar puede quedar limitado)"
    }
} else {
    Write-Warn "Sin Python: la musica ambiente no arrancara hasta instalarlo."
    Write-Warn "El resto de la instalacion (Docker/POS) CONTINUA."
}

# ---------- 4. Docker ----------
Write-Step "4/9 Docker Desktop"
if (-not $SkipDockerInstall) {
    $dockerPresent = $false
    try { $dockerPresent = Test-CommandExists "docker" } catch { $dockerPresent = $false }
    if (-not $dockerPresent) {
        Write-Host "  Instalando Docker Desktop (puede pedir reinicio)..."
        try {
            $null = Install-WingetPackage -Id "Docker.DockerDesktop" -Name "Docker Desktop"
        } catch {
            Write-Warn "Instalacion Docker: $_"
        }
        Update-SessionPath
        Write-Warn "Si Docker se instalo ahora: complete WSL2, REINICIE Windows"
        Write-Warn "Luego ejecute de nuevo INSTALLAR.bat"
    }
    if (-not (Ensure-DockerDesktop)) {
        Write-Fail "Docker no disponible. Abortando."
        exit 1
    }
} else {
    if (-not (Ensure-DockerDesktop)) {
        Write-Fail "Docker no listo."
        exit 1
    }
}

# ---------- 5. Firewall ----------
Write-Step "5/9 Firewall LAN (5173, 8000, 8788)"
foreach ($port in @(5173, 8000, 8788, 5432)) {
    $rule = "ElCallejon-Port-$port"
    try {
        if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP `
                -LocalPort $port -Action Allow -Profile Private,Domain | Out-Null
            Write-Ok "TCP $port abierto (red privada)"
        } else {
            Write-Ok "TCP $port ya permitido"
        }
    } catch {
        Write-Warn "Firewall $port : $_"
    }
}

# ---------- 6. .env ----------
Write-Step "6/9 Configuracion .env y red"
$lan = Get-LanIPv4
if ($lan) { Write-Ok "IP LAN: $lan" } else { Write-Warn "IP LAN no detectada - edite LAN_IP en .env" }
Ensure-EnvFile -Root $Root -LanIp $lan

# Asegurar ADMIN_PIN en .env
$envPath = Join-Path $Root ".env"
if (Test-Path $envPath) {
    $ec = Get-Content $envPath -Raw
    if ($ec -notmatch '(?m)^ADMIN_PIN=') {
        Add-Content -Path $envPath -Value "`r`nADMIN_PIN=2580`r`n" -Encoding UTF8
        Write-Ok "ADMIN_PIN=2580 anadido a .env (cambielo luego)"
    } else {
        Write-Ok "ADMIN_PIN presente en .env"
    }
    if ($ec -notmatch '(?m)^AMBIENT_HOST_URL=') {
        Add-Content -Path $envPath -Value "AMBIENT_HOST_URL=http://host.docker.internal:8788`r`n" -Encoding UTF8
    }
}

# Carpetas multimedia
foreach ($d in @("Music", "frontend\public\images", "frontend\public\images\covers", "data\postgres", "snapshots")) {
    $p = Join-Path $Root $d
    if (-not (Test-Path $p)) {
        New-Item -ItemType Directory -Force -Path $p | Out-Null
        Write-Ok "Creada carpeta $d"
    }
}

# ---------- 7. Musica YA (antes/paralelo a Docker build) ----------
Write-Step "7/9 Reproductor ambiente (musica host)"
$ensurePs1Install = Join-Path $ScriptDir "Ensure-AmbientRunning.ps1"
try {
    if (Test-Path $ensurePs1Install) {
        & $ensurePs1Install -ProjectRoot $Root -AutoPlay "auto"
    } else {
        & (Join-Path $ScriptDir "Start-AmbientHost.ps1") -ProjectRoot $Root -AutoPlay "auto"
    }
    Write-Ok "ambient_host ensure ejecutado (:8788 + watch)"
} catch {
    Write-Warn "Ambient: $_ (Register-Autostart / INICIAR_MUSICA.bat al final)"
}

# ---------- 8. Stack Docker ----------
Write-Step "8/9 Contenedores (db + backend + frontend)"
Push-Location $Root
$composeOk = $false
$prevComposeEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    if ($NoBuild) {
        docker compose up -d
    } else {
        docker compose up -d --build
    }
    if ($LASTEXITCODE -eq 0) {
        $composeOk = $true
    } else {
        Write-Fail "docker compose fallo (codigo $LASTEXITCODE)"
        Write-Host "  Revise: docker compose logs" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Fail "docker compose error: $_"
    Write-Host "  Revise: docker compose logs" -ForegroundColor Yellow
    exit 1
} finally {
    $ErrorActionPreference = $prevComposeEap
    Pop-Location
}
if (-not $composeOk) { exit 1 }

Write-Step "Esperando salud de servicios..."
if (Wait-HttpOk -Url "http://127.0.0.1:8000/health" -TimeoutSec 300) {
    Write-Ok "Backend healthy :8000"
} else {
    Write-Warn "Backend no respondio a tiempo - docker compose logs backend"
}
if (Wait-HttpOk -Url "http://127.0.0.1:5173/" -TimeoutSec 120) {
    Write-Ok "Frontend :5173"
} else {
    Write-Warn "Frontend lento - docker compose logs frontend"
}

Write-Step "Migraciones SQL"
$migDir = Join-Path $Root "db\migrations"
if (Test-Path $migDir) {
    Get-ChildItem $migDir -Filter "*.sql" | Sort-Object Name | ForEach-Object {
        Write-Host ("  -> {0}" -f $_.Name) -ForegroundColor DarkGray
        Get-Content $_.FullName -Raw | docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos 2>$null | Out-Null
    }
    Write-Ok "Migraciones aplicadas"
}

# Reconfirmar musica
try {
    & (Join-Path $ScriptDir "Start-AmbientHost.ps1") -ProjectRoot $Root -AutoPlay "auto"
} catch { }

# ---------- 9. Hub + autostart + backup ----------
Write-Step "9/9 Hub QR, arranque automatico y backup semanal"
try {
    $startArgs = @{
        NoCompose   = $true
        NoElevate   = $true
        ProjectRoot = $Root
    }
    if ($NoBrowser) { $startArgs["NoBrowser"] = $true }
    & (Join-Path $ScriptDir "Start-Callejon.ps1") @startArgs
} catch {
    Write-Warn "Hub: $_"
}

if (-not $SkipAutostart) {
    Write-Host "  Registrando arranque al encender el PC (musica a prueba de fallos)..."
    try {
        $regPs1 = Join-Path $ScriptDir "Register-Autostart.ps1"
        $regArgs = @{
            ProjectRoot = $Root
            StartNow    = $true
            NoPrompt    = $true
        }
        if ($NoBrowser) { $regArgs["NoBrowser"] = $true }
        & $regPs1 @regArgs
        Write-Ok "Autostart: Watch + pulso 2 min + carpeta Inicio + Boot Docker"
    } catch {
        Write-Warn "Autostart: $_ - ejecute INICIAR_MUSICA.bat o Register-Autostart.bat"
    }
}

# Docker Desktop auto-update 16:00 (antes del apagado tipico 17:00)
try {
    $regDock = Join-Path $Root "scripts\Register-DockerUpdate.ps1"
    if (Test-Path $regDock) {
        & $regDock -NoElevate -ProjectRoot $Root -Time "16:00"
        Write-Ok "Docker Desktop: revision/actualizacion diaria 16:00"
    }
} catch {
    Write-Warn "Docker update schedule: $_"
}

if (-not $SkipWeeklyBackup) {
    try {
        # Diario 15:30 (configurable en panel Respaldos /api/backup/config)
        $regDaily = Join-Path $Root "scripts\Register-DailyBackup.ps1"
        if (Test-Path $regDaily) {
            & $regDaily -NoElevate -ProjectRoot $Root -FromConfig
            Write-Ok "Backup diario + worker API (default 15:30, panel Respaldos)"
        }
        # Snapshot limpio semanal (opcional, domingo 03:00)
        $snapPs1 = Join-Path $Root "scripts\Snapshot-Callejon.ps1"
        $dest = Join-Path $Root "snapshots\weekly"
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
        $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$snapPs1`" -NoElevate -Destination `"$dest\SNAP_auto`" -ProjectRoot `"$Root`""
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg
        $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3:00am
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        Register-ScheduledTask -TaskName "ElCallejon-WeeklySnapshot" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Write-Ok "Snapshot semanal limpio: domingo 03:00 -> snapshots\weekly"
    } catch {
        Write-Warn "Backup: $_"
    }
}

# Resumen final
$hubHtml = Join-Path $Root "scripts\generated\hub.html"
Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  INSTALACION COMPLETADA - El Callejon" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
if ($lan) {
    Write-Host "  PANTALLAS (Smart TVs):" -ForegroundColor Cyan
    Write-Host "    http://${lan}:5173/" -ForegroundColor White
    Write-Host "    http://${lan}:5173/tv/1  ...  /tv/6" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  CONTROL (solo personal / tablet):" -ForegroundColor Yellow
    Write-Host "    http://${lan}:5173/login" -ForegroundColor White
    Write-Host "    PIN por defecto: 2580  (cambielo en Ambiente)" -ForegroundColor DarkYellow
} else {
    Write-Host "  Local: http://127.0.0.1:5173/  y  /login" -ForegroundColor White
}
Write-Host ""
Write-Host "  Musica: ambient :8788 (autoplay Me gusta o shuffle)" -ForegroundColor DarkGray
Write-Host "  Hub QR: $hubHtml" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Al ENCENDER el PC se inicia solo (tareas programadas)." -ForegroundColor Cyan
Write-Host "  Probar boot:  scripts\Start-CallejonBoot.bat" -ForegroundColor DarkGray
Write-Host "  Logs:         scripts\generated\boot.log , ambient.log" -ForegroundColor DarkGray
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""

if (-not $NoBrowser) {
    if (Test-Path $hubHtml) { Start-Process $hubHtml }
    if ($lan) {
        Start-Process "http://${lan}:5173/login"
    } else {
        Start-Process "http://127.0.0.1:5173/login"
    }
}

Write-Ok "Listo. El restaurante puede conectar TVs al hub y el tablet al PIN."
