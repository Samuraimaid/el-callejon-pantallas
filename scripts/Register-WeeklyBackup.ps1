#Requires -Version 5.1
<#
.SYNOPSIS
  Registra tarea programada semanal (domingo 03:00) de snapshot limpio.

.EXAMPLE
  .\scripts\Register-WeeklyBackup.ps1
  .\scripts\Register-WeeklyBackup.ps1 -Destination "E:\CallejonWeekly"
  .\scripts\Register-WeeklyBackup.ps1 -Unregister
#>
param(
    [string]$Destination = "",
    [switch]$Unregister,
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not (Test-IsAdmin)) {
    Write-Host "Se requiere Administrador para Task Scheduler." -ForegroundColor Yellow
    $argList = @()
    if ($Destination) { $argList += "-Destination"; $argList += "`"$Destination`"" }
    if ($Unregister) { $argList += "-Unregister" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
$taskName = "ElCallejon-WeeklySnapshot"
$snapPs1 = Join-Path $Root "scripts\Snapshot-Callejon.ps1"

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Ok "Tarea eliminada: $taskName"
    exit 0
}

if (-not $Destination) {
    $Destination = Join-Path $Root "snapshots\weekly"
}
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

$destArg = $Destination.Replace('"', '')
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (
    "-NoProfile -ExecutionPolicy Bypass -File `"$snapPs1`" -NoElevate -Destination `"$destArg\SNAP_auto`" -ProjectRoot `"$Root`""
)
# Domingo 03:00
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3:00am
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Ok "Tarea registrada: $taskName"
Write-Host "  Cada domingo 03:00 -> snapshot limpio en:" -ForegroundColor DarkGray
Write-Host "  $Destination" -ForegroundColor Cyan
Write-Host "  Quitar: .\scripts\Register-WeeklyBackup.ps1 -Unregister" -ForegroundColor DarkGray
