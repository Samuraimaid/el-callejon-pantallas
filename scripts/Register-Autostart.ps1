#Requires -Version 5.1
<#
.SYNOPSIS
  Registra arranque automatico al iniciar sesion de Windows.

.DESCRIPTION
  Dos tareas:
  - ElCallejon-Ambient : delay 10s  -> musica YA (ambient_host_player)
  - ElCallejon-Boot    : delay 20s  -> Docker + hub QR + reconfirma musica

.EXAMPLE
  .\scripts\Register-Autostart.ps1
  .\scripts\Register-Autostart.ps1 -Unregister
#>
param(
    [switch]$Unregister,
    [string]$ProjectRoot = "",
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not (Test-IsAdmin)) {
    Write-Host "Se requiere Administrador para Task Scheduler." -ForegroundColor Yellow
    $argList = @()
    if ($Unregister) { $argList += "-Unregister" }
    if ($NoBrowser) { $argList += "-NoBrowser" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
$taskBoot = "ElCallejon-Boot"
$taskAmbient = "ElCallejon-Ambient"
$bootPs1 = Join-Path $Root "scripts\Start-CallejonBoot.ps1"
$ambientPs1 = Join-Path $Root "scripts\Start-AmbientHost.ps1"

function Register-TaskAtLogon {
    param(
        [string]$Name,
        [string]$Argument,
        [string]$Delay
    )
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $Argument -WorkingDirectory $Root
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $trigger.Delay = $Delay
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
}

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $taskBoot -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskAmbient -Confirm:$false -ErrorAction SilentlyContinue
    $startup = [Environment]::GetFolderPath("Startup")
    $lnk = Join-Path $startup "ElCallejon-Boot.lnk"
    if (Test-Path $lnk) { Remove-Item $lnk -Force }
    Write-Ok "Arranque automatico desactivado ($taskAmbient + $taskBoot)"
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

# 1) Musica lo antes posible (10s tras login) — no espera Docker
$argAmbient = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$ambientPs1`" -ProjectRoot `"$Root`" -AutoPlay default"
Register-TaskAtLogon -Name $taskAmbient -Argument $argAmbient -Delay "PT10S"

# 2) Stack + QR (20s) — reconfirma musica al final
$nb = if ($NoBrowser) { " -NoBrowser" } else { "" }
$argBoot = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$bootPs1`" -NoElevate -ProjectRoot `"$Root`"$nb"
Register-TaskAtLogon -Name $taskBoot -Argument $argBoot -Delay "PT20S"

Write-Ok "Tareas registradas:"
Write-Host "  $taskAmbient  (T+10s)  ambient_host_player + autoplay" -ForegroundColor Green
Write-Host "  $taskBoot     (T+20s)  Docker + hub QR + reconfirma musica" -ForegroundColor Green
Write-Host ""
Write-Host "  Al encender el PC / iniciar sesion:" -ForegroundColor DarkGray
Write-Host "    1. Musica (Me gusta o shuffle todas)  <- no espera Docker" -ForegroundColor DarkGray
Write-Host "    2. Contenedores del sistema" -ForegroundColor DarkGray
Write-Host "    3. Navegador con QR de administracion" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Probar musica ya:  .\scripts\Start-AmbientHost.ps1" -ForegroundColor Cyan
Write-Host "  Probar boot completo: .\scripts\Start-CallejonBoot.ps1" -ForegroundColor Cyan
Write-Host "  Quitar:  .\scripts\Register-Autostart.ps1 -Unregister" -ForegroundColor Cyan
Write-Host "  Logs: scripts\generated\ambient.log  y  boot.log" -ForegroundColor Cyan

# Arrancar musica ya (no esperar al reinicio)
Write-Host ""
Write-Host "Iniciar musica ahora? (S/N)" -ForegroundColor Yellow
$ans = Read-Host
if ($ans -match '^[sSyY]') {
    & $ambientPs1 -ProjectRoot $Root -AutoPlay "default"
}
