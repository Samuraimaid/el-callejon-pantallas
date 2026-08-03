#Requires -Version 5.1
<#
.SYNOPSIS
  Registra respaldo diario (default 15:30) + worker de peticiones API.

.EXAMPLE
  .\scripts\Register-DailyBackup.ps1
  .\scripts\Register-DailyBackup.ps1 -FromConfig
  .\scripts\Register-DailyBackup.ps1 -Unregister
#>
param(
    [string]$Time = "",
    [string]$Destination = "",
    [switch]$FromConfig,
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
    if ($Destination) { $argList += "-Destination"; $argList += "`"$Destination`"" }
    if ($FromConfig) { $argList += "-FromConfig" }
    if ($Unregister) { $argList += "-Unregister" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
$taskDaily = "ElCallejon-DailyBackup"
$taskWorker = "ElCallejon-BackupWorker"
$bakPs1 = Join-Path $Root "scripts\Backup-Callejon.ps1"
$configPath = Join-Path $Root "backend\app\data\backup_config.json"

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $taskDaily -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskWorker -Confirm:$false -ErrorAction SilentlyContinue
    Write-Ok "Tareas eliminadas: $taskDaily + $taskWorker"
    exit 0
}

if (-not (Test-Path $bakPs1)) {
    Write-Fail "No existe $bakPs1"
    exit 1
}

# Leer config
$timeStr = "15:30"
$dest = Join-Path $Root "snapshots\daily"
if ($FromConfig -or (Test-Path $configPath)) {
    try {
        $cfg = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($cfg.time) { $timeStr = [string]$cfg.time }
        if ($cfg.destination) { $dest = [string]$cfg.destination }
    } catch { }
}
if ($Time) { $timeStr = $Time }
if ($Destination) { $dest = $Destination }

# Parse HH:mm
$parts = $timeStr.Split(":")
$hour = [int]$parts[0]
$minute = if ($parts.Count -gt 1) { [int]$parts[1] } else { 0 }
$at = Get-Date -Hour $hour -Minute $minute -Second 0

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$argDaily = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$bakPs1`" -NoElevate -FromConfig -ProjectRoot `"$Root`""
$actionDaily = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argDaily -WorkingDirectory $Root
$triggerDaily = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskDaily -Action $actionDaily -Trigger $triggerDaily `
    -Settings $settings -Principal $principal -Force | Out-Null

# Worker: cada 5 min procesa /api/backup/run y flags de re-schedule
$argWorker = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$bakPs1`" -NoElevate -ProcessPendingOnly -ProjectRoot `"$Root`""
$actionWorker = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argWorker -WorkingDirectory $Root
$start = (Get-Date).AddMinutes(2)
$triggerWorker = New-ScheduledTaskTrigger -Once -At $start `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 1095)
$settingsW = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskWorker -Action $actionWorker -Trigger $triggerWorker `
    -Settings $settingsW -Principal $principal -Force | Out-Null

Write-Ok "Tarea diaria: $taskDaily a las $timeStr -> $dest"
Write-Ok "Worker API: $taskWorker cada 5 min (POST /api/backup/run)"
Write-Host "  Modos: content (sin software) | full (con software) | migrate (instalador)" -ForegroundColor DarkGray
Write-Host "  Quitar: .\scripts\Register-DailyBackup.ps1 -Unregister" -ForegroundColor DarkGray
