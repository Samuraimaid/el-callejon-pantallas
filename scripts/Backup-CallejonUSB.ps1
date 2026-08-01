#Requires -Version 5.1
<#
.SYNOPSIS
  Respalda el proyecto completo (código + multimedia + DB + música) a una USB.

.DESCRIPTION
  Incluye:
  - Código fuente y scripts
  - frontend/public (imágenes, videos de campañas, audio eventos)
  - Music/ (biblioteca ambiente MP3)
  - data/postgres (base de datos)
  - data/u2net (modelos)
  - .env (configuración local — trátelo como secreto)
  Excluye: caches de Docker build, .git opcional, temporales

.EXAMPLE
  .\scripts\Backup-CallejonUSB.ps1
  .\scripts\Backup-CallejonUSB.ps1 -Destination "E:\Respaldos\Callejon"
  .\scripts\Backup-CallejonUSB.ps1 -IncludeGit
#>
param(
    [string]$Destination = "",
    [switch]$IncludeGit,
    [switch]$NoElevate,
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not $NoElevate -and -not (Test-IsAdmin)) {
    $argList = @("-NoElevate")
    if ($Destination) { $argList += "-Destination"; $argList += "`"$Destination`"" }
    if ($IncludeGit) { $argList += "-IncludeGit" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot } else { Get-ProjectRoot }

Write-Host ""
Write-Host "  El Callejón · Respaldo a USB / disco externo" -ForegroundColor Cyan
Write-Host "  Origen: $Root" -ForegroundColor DarkGray

# Elegir destino
if (-not $Destination) {
    Write-Step "Unidades removibles detectadas"
    $removable = Get-CimInstance Win32_LogicalDisk | Where-Object {
        $_.DriveType -eq 2 -or ($_.DriveType -eq 3 -and $_.DeviceID -ne "C:")
    }
    $i = 1
    $map = @{}
    foreach ($d in $removable) {
        $free = if ($d.FreeSpace) { [math]::Round($d.FreeSpace / 1GB, 1) } else { "?" }
        $label = if ($d.VolumeName) { $d.VolumeName } else { "Disco" }
        Write-Host "  [$i] $($d.DeviceID)  $label  (${free} GB libres)"
        $map[$i] = $d.DeviceID
        $i++
    }
    if ($map.Count -eq 0) {
        Write-Fail "No hay USB detectada. Conéctela o use -Destination 'E:\ruta'"
        exit 1
    }
    $choice = Read-Host "Elija número de unidad (o escriba ruta completa)"
    if ($map.ContainsKey([int]$choice)) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmm"
        $Destination = Join-Path $map[[int]$choice] "EL_CALLEJON_BACKUP_$stamp"
    } else {
        $Destination = $choice
    }
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
Write-Ok "Destino: $Destination"

# Estimar tamaño multimedia
Write-Step "Calculando tamaño (aprox.)"
$paths = @(
    (Join-Path $Root "frontend\public"),
    (Join-Path $Root "Music"),
    (Join-Path $Root "data"),
    (Join-Path $Root "backend"),
    (Join-Path $Root "db"),
    (Join-Path $Root "scripts")
)
$total = 0L
foreach ($p in $paths) {
    if (Test-Path $p) {
        $s = (Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum
        if ($s) { $total += $s }
    }
}
Write-Host ("  ~{0:N1} GB a copiar" -f ($total / 1GB)) -ForegroundColor DarkGray

# Exclusiones robocopy
$xd = @(
    "node_modules",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    "htmlcov",
    ".coverage",
    "pg_stat_tmp"
)
if (-not $IncludeGit) { $xd += ".git" }

$xf = @("*.pyc", "Thumbs.db", "desktop.ini", "postmaster.pid")

Write-Step "Copiando con robocopy (puede tardar si hay muchos videos/MP3)..."
Write-Warn "Si Postgres está en uso, detenga el stack antes para un backup más limpio:"
Write-Warn "  docker compose stop"

$log = Join-Path $Destination "_backup-log.txt"
$xdArgs = @()
foreach ($d in $xd) { $xdArgs += "/XD"; $xdArgs += $d }
$xfArgs = @()
foreach ($f in $xf) { $xfArgs += "/XF"; $xfArgs += $f }

# robocopy root → destination
$rcArgs = @(
    $Root, $Destination,
    "/E", "/COPY:DAT", "/R:2", "/W:3", "/MT:8",
    "/NFL", "/NDL", "/NP",
    "/LOG:$log"
) + $xdArgs + $xfArgs

& robocopy @rcArgs
# robocopy codes 0-7 are success-ish
if ($LASTEXITCODE -ge 8) {
    Write-Fail "robocopy falló (código $LASTEXITCODE). Ver $log"
    exit 1
}

# Manifiesto del backup
$manifest = @{
    created_at   = (Get-Date).ToString("o")
    source       = $Root
    destination  = $Destination
    computer     = $env:COMPUTERNAME
    user         = $env:USERNAME
    include_git  = [bool]$IncludeGit
    includes     = @(
        "código fuente",
        "frontend/public (fotos, videos campañas, audio eventos)",
        "Music/ (música ambiente)",
        "data/postgres (base de datos)",
        "data/u2net",
        ".env (secretos locales)",
        "scripts de instalación"
    )
    restore_hint = "En el PC nuevo: copiar carpeta a C:\EL_CALLEJON_POS y ejecutar scripts\Install-Callejon.ps1"
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $Destination "BACKUP_MANIFEST.json") -Encoding UTF8

# README restauración
@"
# Restaurar El Callejón desde este respaldo

1. Copie esta carpeta completa a ``C:\EL_CALLEJON_POS`` (o USB → disco del PC nuevo).
2. Abra PowerShell **como Administrador**:

``````powershell
cd C:\EL_CALLEJON_POS
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\Install-Callejon.ps1
``````

3. El instalador:
   - verifica hardware/software
   - instala Docker si falta
   - levanta contenedores
   - abre el hub con QR (pantallas + control)

4. Contraseñas: están en ``.env`` y en la base ``data/postgres``.
   Cambie JWT_SECRET y la clave de admin en el primer uso.

5. Música ambiente: ``scripts\start_ambient_player.bat``

Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm')
"@ | Set-Content (Join-Path $Destination "LEAME_RESTAURAR.txt") -Encoding UTF8

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Respaldo listo: $Destination" -ForegroundColor Green
Write-Host "  LEAME_RESTAURAR.txt + BACKUP_MANIFEST.json" -ForegroundColor Green
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
