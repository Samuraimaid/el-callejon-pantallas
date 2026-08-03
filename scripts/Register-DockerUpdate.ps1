#Requires -Version 5.1
<#
.SYNOPSIS
  Programa revision/actualizacion de Docker Desktop (default: todos los dias 16:00).

.DESCRIPTION
  Encaja con encendido 11:00 y apagado 17:00: a las 16:00 se actualiza Docker
  si hace falta, con tiempo de sobra antes del apagado.

.EXAMPLE
  .\scripts\Register-DockerUpdate.ps1
  .\scripts\Register-DockerUpdate.ps1 -Time "16:00"
  .\scripts\Register-DockerUpdate.ps1 -Unregister
#>
param(
    [string]$Time = "16:00",
    [switch]$Unregister,
    [switch]$NoElevate,
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not $NoElevate -and -not (Test-IsAdmin)) {
    $argList = @("-NoElevate")
    if ($Time) { $argList += "-Time"; $argList += $Time }
    if ($Unregister) { $argList += "-Unregister" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
$taskName = "ElCallejon-DockerUpdate"
$ps1 = Join-Path $Root "scripts\Update-DockerDesktop.ps1"

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Ok "Tarea eliminada: $taskName"
    exit 0
}

if (-not (Test-Path $ps1)) {
    Write-Fail "No existe $ps1"
    exit 1
}

$parts = $Time.Split(":")
$hour = [int]$parts[0]
$minute = if ($parts.Count -gt 1) { [int]$parts[1] } else { 0 }
$at = Get-Date -Hour $hour -Minute $minute -Second 0

$arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ps1`" -NoElevate -ProjectRoot `"$Root`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 5)
# SYSTEM puede actualizar con winget en muchos equipos; si falla, usar usuario interactivo
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

Write-Ok "Tarea registrada: $taskName"
Write-Host "  Cada dia a las $Time -> actualiza Docker Desktop si hay version nueva" -ForegroundColor DarkGray
Write-Host "  (detiene stack Callejon, winget upgrade, reinicia Docker + compose)" -ForegroundColor DarkGray
Write-Host "  Log: scripts\generated\docker-update.log" -ForegroundColor DarkGray
Write-Host "  Probar ahora: .\scripts\Update-DockerDesktop.ps1 -CheckOnly" -ForegroundColor Cyan
Write-Host "  Quitar: .\scripts\Register-DockerUpdate.ps1 -Unregister" -ForegroundColor DarkGray
