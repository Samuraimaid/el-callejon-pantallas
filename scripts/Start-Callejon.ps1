#Requires -Version 5.1
<#
.SYNOPSIS
  Arranca el stack El Callejon y abre el hub con codigos QR.

.EXAMPLE
  .\scripts\Start-Callejon.ps1
  .\scripts\Start-Callejon.ps1 -NoBrowser
  .\scripts\Start-Callejon.ps1 -NoCompose
#>
param(
    [switch]$NoBrowser,
    [switch]$NoCompose,
    [switch]$NoElevate,
    [switch]$StartAmbient,
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not $NoElevate -and -not (Test-IsAdmin)) {
    $argList = @("-NoElevate")
    if ($NoBrowser) { $argList += "-NoBrowser" }
    if ($NoCompose) { $argList += "-NoCompose" }
    if ($StartAmbient) { $argList += "-StartAmbient" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }
Set-Location $Root

$lan = Get-LanIPv4
if (-not $lan) { $lan = "127.0.0.1" }

if (-not $NoCompose) {
    Write-Step "Iniciando Docker Compose"
    if (-not (Ensure-DockerDesktop)) {
        Write-Fail "Docker no disponible"
        exit 1
    }
    $lanForEnv = if ($lan -ne "127.0.0.1") { $lan } else { $null }
    Ensure-EnvFile -Root $Root -LanIp $lanForEnv
    Push-Location $Root
    try {
        docker compose up -d
        if ($LASTEXITCODE -ne 0) { throw "docker compose up fallo" }
    } finally {
        Pop-Location
    }
    Write-Step "Esperando servicios..."
    $null = Wait-HttpOk -Url "http://127.0.0.1:8000/health" -TimeoutSec 120
    $null = Wait-HttpOk -Url "http://127.0.0.1:5173/" -TimeoutSec 90
    Write-Ok "Stack arriba"
}

if ($StartAmbient) {
    $bat = Join-Path $Root "scripts\start_ambient_player.bat"
    if (Test-Path $bat) {
        Start-Process -FilePath $bat -WorkingDirectory $Root
        Write-Ok "Ambient player"
    }
}

Write-Step "Generando hub HTML con QR"
$hubDir = Join-Path $Root "scripts\generated"
New-Item -ItemType Directory -Force -Path $hubDir | Out-Null
$hubHtml = Join-Path $hubDir "hub.html"
$tpl = Join-Path $ScriptDir "assets\hub-template.html"
if (-not (Test-Path $tpl)) {
    Write-Fail "Falta hub-template.html"
    exit 1
}

$hubTv = "http://${lan}:5173"
$hubAdmin = "http://${lan}:5173/login"
$apiUrl = "http://${lan}:8000"
$ambient = "http://127.0.0.1:8788"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm"

$html = Get-Content $tpl -Raw -Encoding UTF8
$html = $html.Replace("__LAN_IP__", $lan)
$html = $html.Replace("__HUB_TV__", $hubTv)
$html = $html.Replace("__HUB_ADMIN__", $hubAdmin)
$html = $html.Replace("__API_URL__", $apiUrl)
$html = $html.Replace("__AMBIENT__", $ambient)
$html = $html.Replace("__TS__", $ts)

[System.IO.File]::WriteAllText($hubHtml, $html, [System.Text.UTF8Encoding]::new($false))
Write-Ok "Hub generado: $hubHtml"

Write-Host ""
Write-Host "  -----------------------------------------" -ForegroundColor DarkYellow
Write-Host "  PANTALLAS (Smart TVs)  ->  $hubTv" -ForegroundColor Green
Write-Host "  CONTROL (solo staff)   ->  $hubAdmin" -ForegroundColor Yellow
Write-Host "  CONTROL (solo este PC) ->  http://127.0.0.1:5173/login" -ForegroundColor DarkYellow
Write-Host "  -----------------------------------------" -ForegroundColor DarkYellow
Write-Host "  El lobby de TVs NO enlaza al Centro de Control." -ForegroundColor DarkGray
Write-Host ""

if (-not $NoBrowser) {
    Start-Process $hubHtml
    Start-Process $hubTv
}

Write-Ok "Listo"
