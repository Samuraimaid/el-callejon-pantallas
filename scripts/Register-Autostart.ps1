#Requires -Version 5.1
<#
.SYNOPSIS
  Arranque automatico a prueba de fallos: musica + stack Docker.

.DESCRIPTION
  Capas (redundantes a proposito):
  1) Tarea ElCallejon-Ambient     - al login T+5s  -> Watch-AmbientHost (keep-alive)
  2) Tarea ElCallejon-AmbientPulse - cada 2 min   -> Ensure-AmbientRunning
  3) Tarea ElCallejon-Boot        - al login T+20s -> Docker + hub
  4) Carpeta Inicio de Windows    - .cmd al login  -> Ensure + Watch (si falla Task Scheduler)

.EXAMPLE
  .\scripts\Register-Autostart.ps1 -StartNow
  .\scripts\Register-Autostart.ps1 -Unregister
#>
param(
    [switch]$Unregister,
    [string]$ProjectRoot = "",
    [switch]$NoBrowser,
    [switch]$StartNow,
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not (Test-IsAdmin)) {
    Write-Host "Se requiere Administrador para Task Scheduler." -ForegroundColor Yellow
    $argList = @()
    if ($Unregister) { $argList += "-Unregister" }
    if ($NoBrowser) { $argList += "-NoBrowser" }
    if ($StartNow) { $argList += "-StartNow" }
    if ($NoPrompt) { $argList += "-NoPrompt" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot.TrimEnd('\', '/') } else { Get-ProjectRoot }
$taskBoot = "ElCallejon-Boot"
$taskAmbient = "ElCallejon-Ambient"
$taskPulse = "ElCallejon-AmbientPulse"
$bootPs1 = Join-Path $Root "scripts\Start-CallejonBoot.ps1"
$ambientPs1 = Join-Path $Root "scripts\Start-AmbientHost.ps1"
$watchPs1 = Join-Path $Root "scripts\Watch-AmbientHost.ps1"
$ensurePs1 = Join-Path $Root "scripts\Ensure-AmbientRunning.ps1"
$startupDir = [Environment]::GetFolderPath("Startup")
$startupCmd = Join-Path $startupDir "ElCallejon-Ambient.cmd"
$startupLnk = Join-Path $startupDir "ElCallejon-Ambient.lnk"
$startupBootLnk = Join-Path $startupDir "ElCallejon-Boot.lnk"

function Register-TaskAtLogon {
    param(
        [string]$Name,
        [string]$Argument,
        [string]$Delay,
        [TimeSpan]$ExecutionTimeLimit = ([TimeSpan]::Zero)
    )
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $Argument -WorkingDirectory $Root
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    try { $trigger.Delay = $Delay } catch { }
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit $ExecutionTimeLimit `
        -RestartCount 5 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
}

function Register-TaskPulse {
    param(
        [string]$Name,
        [string]$Argument
    )
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $Argument -WorkingDirectory $Root
    # Cada 2 minutos, sin fin practico (3 anios)
    $start = (Get-Date).AddMinutes(1)
    $trigger = New-ScheduledTaskTrigger -Once -At $start `
        -RepetitionInterval (New-TimeSpan -Minutes 2) `
        -RepetitionDuration (New-TimeSpan -Days 1095)
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
        -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
}

function Install-StartupShortcut {
    # .cmd en Inicio: no depende de Task Scheduler (a prueba de politicas)
    $cmdBody = @"
@echo off
rem El Callejon - arranque musica (carpeta Inicio de Windows)
cd /d "$Root"
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "$ensurePs1" -ProjectRoot "$Root" -AutoPlay auto
ping -n 4 127.0.0.1 >nul
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "$watchPs1" -ProjectRoot "$Root" -AutoPlay auto
"@
    Set-Content -Path $startupCmd -Value $cmdBody -Encoding ASCII
    Write-Ok "Inicio Windows: $startupCmd"

    # Atajo .lnk adicional (algunos entornos solo leen .lnk)
    try {
        $wsh = New-Object -ComObject WScript.Shell
        $lnk = $wsh.CreateShortcut($startupLnk)
        $lnk.TargetPath = "powershell.exe"
        $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$ensurePs1`" -ProjectRoot `"$Root`" -AutoPlay auto"
        $lnk.WorkingDirectory = $Root
        $lnk.WindowStyle = 7
        $lnk.Description = "El Callejon - musica ambiente"
        $lnk.Save()
        Write-Ok "Inicio Windows: $startupLnk"
    } catch {
        Write-Warn "No se pudo crear .lnk en Inicio: $_"
    }
}

function Remove-StartupItems {
    foreach ($p in @($startupCmd, $startupLnk, $startupBootLnk)) {
        if (Test-Path $p) {
            Remove-Item $p -Force -ErrorAction SilentlyContinue
        }
    }
}

function Start-AmbientNow {
    Write-Step "Asegurando host ambiente + vigilante (respeta autoplay_on_boot)..."
    try {
        if (Test-Path $ensurePs1) {
            & $ensurePs1 -ProjectRoot $Root -AutoPlay "auto"
        } else {
            & $ambientPs1 -ProjectRoot $Root -AutoPlay "auto"
            Start-Process -FilePath "powershell.exe" -ArgumentList @(
                "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Minimized",
                "-File", $watchPs1, "-ProjectRoot", $Root, "-AutoPlay", "auto"
            ) -WindowStyle Minimized -WorkingDirectory $Root
        }
        Start-Sleep -Seconds 2
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:8788/health" -TimeoutSec 3
            if ($h.ok) { Write-Ok "Host ambiente responde en :8788" }
            else { Write-Warn "Health sin ok - revise ambient.log" }
        } catch {
            Write-Warn "Host aun no responde en :8788 (Python? logs en scripts\generated\)"
        }
    } catch {
        Write-Warn "Start ahora: $_"
    }
}

if ($Unregister) {
    foreach ($t in @($taskBoot, $taskAmbient, $taskPulse)) {
        Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue
    }
    Remove-StartupItems
    Write-Ok "Arranque automatico desactivado ($taskAmbient + $taskPulse + $taskBoot + Inicio)"
    exit 0
}

if (-not (Test-Path $bootPs1)) {
    Write-Fail "No existe $bootPs1"
    exit 1
}
if (-not (Test-Path $ambientPs1)) {
    Write-Fail "No existe $ambientPs1"
    exit 1
}
if (-not (Test-Path $watchPs1)) {
    Write-Warn "No existe Watch-AmbientHost.ps1 - se usara Start-AmbientHost"
    $watchPs1 = $ambientPs1
}
if (-not (Test-Path $ensurePs1)) {
    Write-Warn "No existe Ensure-AmbientRunning.ps1 - pulse usara Start-AmbientHost"
    $ensurePs1 = $ambientPs1
}

Write-Step "Registrando arranque El Callejon (Root=$Root)"

# 1) Vigilante al login (T+5s)
$argAmbient = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$watchPs1`" -ProjectRoot `"$Root`" -AutoPlay auto"
Register-TaskAtLogon -Name $taskAmbient -Argument $argAmbient -Delay "PT5S" -ExecutionTimeLimit ([TimeSpan]::Zero)
Write-Ok "$taskAmbient (login +5s, Watch permanente)"

# 2) Pulso cada 2 min (si el watch murio o nunca arranco)
$argPulse = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ensurePs1`" -ProjectRoot `"$Root`" -AutoPlay auto"
try {
    Register-TaskPulse -Name $taskPulse -Argument $argPulse
    Write-Ok "$taskPulse (cada 2 min: Ensure-AmbientRunning)"
} catch {
    Write-Warn "Pulse task: $_ - se intentara via schtasks"
    $tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ensurePs1`" -ProjectRoot `"$Root`" -AutoPlay auto"
    $null = schtasks /Create /TN $taskPulse /TR $tr /SC MINUTE /MO 2 /RL HIGHEST /F /IT 2>&1
}

# 3) Boot Docker
$nb = if ($NoBrowser) { " -NoBrowser" } else { "" }
$argBoot = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$bootPs1`" -NoElevate -ProjectRoot `"$Root`"$nb"
Register-TaskAtLogon -Name $taskBoot -Argument $argBoot -Delay "PT20S" -ExecutionTimeLimit (New-TimeSpan -Hours 4)
Write-Ok "$taskBoot (login +20s, Docker + hub)"

# 4) Carpeta Inicio (backup)
try {
    Install-StartupShortcut
} catch {
    Write-Warn "Carpeta Inicio: $_"
}

Write-Host ""
Write-Ok "Capas de arranque de musica:"
Write-Host "  1. Task Scheduler $taskAmbient (al iniciar sesion)" -ForegroundColor Green
Write-Host "  2. Task Scheduler $taskPulse (cada 2 minutos)" -ForegroundColor Green
Write-Host "  3. Carpeta Inicio: ElCallejon-Ambient.cmd" -ForegroundColor Green
Write-Host "  4. Al instalar/registrar: arranque inmediato con -StartNow" -ForegroundColor Green
Write-Host ""
Write-Host "  Manual:  INICIAR_MUSICA.bat  (doble clic en la carpeta del proyecto)" -ForegroundColor Cyan
Write-Host "  Quitar:  .\scripts\Register-Autostart.ps1 -Unregister" -ForegroundColor Cyan
Write-Host "  Logs:    scripts\generated\ambient*.log  boot.log" -ForegroundColor Cyan
Write-Host ""
Write-Host "  NOTA: hace falta iniciar sesion en Windows (o auto-login)." -ForegroundColor DarkYellow
Write-Host "  Sin sesion interactiva no hay audio al amplificador." -ForegroundColor DarkYellow

$doStart = $StartNow -or $NoPrompt
if (-not $doStart -and -not $NoPrompt) {
    Write-Host ""
    Write-Host "Iniciar musica y vigilante AHORA? (S/N)  [S]" -ForegroundColor Yellow
    $ans = Read-Host
    if ([string]::IsNullOrWhiteSpace($ans) -or $ans -match '^[sSyY]') {
        $doStart = $true
    }
}

if ($doStart) {
    Start-AmbientNow
}
