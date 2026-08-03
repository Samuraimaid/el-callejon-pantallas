#Requires -Version 5.1
<#
.SYNOPSIS
  Respaldo personalizable: content (sin software) | full (con software) | migrate.

.DESCRIPTION
  - Incremental: espejo robocopy (solo escribe cambios) + journal diario de cambios.
  - content: Music, imagenes/videos, dump Postgres, .env, configs usuario.
  - full: content + codigo + scripts + docker-compose.
  - migrate: full + carpeta MIGRATE_* lista para otro PC (instalador).

.EXAMPLE
  .\scripts\Backup-Callejon.ps1
  .\scripts\Backup-Callejon.ps1 -Mode content
  .\scripts\Backup-Callejon.ps1 -Mode migrate -Destination "E:\Callejon"
  .\scripts\Backup-Callejon.ps1 -FromConfig
#>
param(
    [ValidateSet("content", "full", "migrate", "auto")]
    [string]$Mode = "auto",
    [string]$Destination = "",
    [switch]$NoIncremental,
    [switch]$FromConfig,
    [switch]$NoElevate,
    [string]$ProjectRoot = "",
    [switch]$ProcessPendingOnly
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib\Common.ps1")

if (-not $NoElevate -and -not (Test-IsAdmin)) {
    $argList = @("-NoElevate")
    if ($Mode) { $argList += "-Mode"; $argList += $Mode }
    if ($Destination) { $argList += "-Destination"; $argList += "`"$Destination`"" }
    if ($NoIncremental) { $argList += "-NoIncremental" }
    if ($FromConfig) { $argList += "-FromConfig" }
    if ($ProcessPendingOnly) { $argList += "-ProcessPendingOnly" }
    if ($ProjectRoot) { $argList += "-ProjectRoot"; $argList += "`"$ProjectRoot`"" }
    $null = Request-AdminElevation -ArgumentList $argList
    exit 0
}

$Root = if ($ProjectRoot) { $ProjectRoot.TrimEnd('\', '/') } else { Get-ProjectRoot }
Set-Location $Root

$configPath = Join-Path $Root "backend\app\data\backup_config.json"
$requestPath = Join-Path $Root "backend\app\data\backup_run_request.json"
$logDir = Join-Path $Root "scripts\generated"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$runLog = Join-Path $logDir "backup.log"

function BLog([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
    Add-Content -Path $runLog -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    Write-Host $line
}

function Read-JsonFile([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    try {
        return (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json)
    } catch { return $null }
}

function Write-JsonFile([string]$path, $obj) {
    $obj | ConvertTo-Json -Depth 8 | Set-Content -Path $path -Encoding UTF8
}

function Get-BackupConfig {
    $c = Read-JsonFile $configPath
    if (-not $c) {
        return [pscustomobject]@{
            enabled      = $true
            time         = "15:30"
            days         = @(0, 1, 2, 3, 4, 5, 6)
            destination  = ""
            mode         = "content"
            incremental  = $true
            keep_days    = 14
            keep_full_count = 3
            include      = [pscustomobject]@{
                music = $true; images = $true; videos = $true; postgres = $true
                env = $true; config = $true; source_code = $false
                installer = $false; docker_compose = $false
            }
            migrate_bundle = $false
        }
    }
    return $c
}

function Update-ConfigLastRun([string]$status, [string]$path, [string]$err = $null) {
    $c = Get-BackupConfig
    $ht = @{}
    $c.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
    $epoch = [int][double]((Get-Date).ToUniversalTime() - [datetime]'1970-01-01').TotalSeconds
    $ht["last_run"] = $epoch
    $ht["last_status"] = $status
    $ht["last_path"] = $path
    $ht["last_error"] = $err
    $ht["updated_at"] = $epoch
    Write-JsonFile $configPath $ht
}

function Invoke-Robo([string]$src, [string]$dst, [string[]]$extraXd = @(), [switch]$Mirror) {
    if (-not (Test-Path $src)) {
        BLog "  skip (no existe): $src"
        return 0
    }
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    $xd = @("node_modules", ".venv", "__pycache__", ".git", "pg_stat_tmp", "htmlcov") + $extraXd
    $xf = @("*.pyc", "Thumbs.db", "desktop.ini", "postmaster.pid", "*.log")
    $args = @($src, $dst, "/E", "/COPY:DAT", "/DCOPY:T", "/R:2", "/W:2", "/MT:8", "/NFL", "/NDL", "/NP", "/FFT")
    if ($Mirror) { $args += "/XO" }  # no sobrescribir dest mas nuevo; solo actualiza viejos/faltantes
    foreach ($d in $xd) { $args += "/XD"; $args += $d }
    foreach ($f in $xf) { $args += "/XF"; $args += $f }
    & robocopy @args | Out-Null
    $code = $LASTEXITCODE
    if ($code -ge 8) {
        BLog "  WARN robocopy $code : $src -> $dst"
    }
    return $code
}

function Export-PostgresDump([string]$destDir) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    $out = Join-Path $destDir ("el_callejon_{0}.sql" -f (Get-Date -Format "yyyyMMdd-HHmm"))
    try {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        docker exec el_callejon_db pg_dump -U callejon -d el_callejon_pos --no-owner --clean --if-exists 2>$null |
            Out-File -FilePath $out -Encoding utf8
        $ErrorActionPreference = $prev
        if ((Test-Path $out) -and ((Get-Item $out).Length -gt 100)) {
            BLog "  Postgres dump: $out"
            return $out
        }
    } catch {
        BLog "  WARN pg_dump: $_"
    }
    # Fallback: copiar data/postgres (puede estar en uso)
    $pg = Join-Path $Root "data\postgres"
    if (Test-Path $pg) {
        Invoke-Robo $pg (Join-Path $destDir "postgres_data") -Mirror
        BLog "  Postgres data dir copiado (fallback)"
    }
    return $null
}

function Remove-OldBackups([string]$baseDest, [int]$keepDays, [int]$keepFull) {
    try {
        $journal = Join-Path $baseDest "journal"
        if (Test-Path $journal) {
            Get-ChildItem $journal -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$keepDays) } |
                ForEach-Object {
                    BLog "  purga journal: $($_.Name)"
                    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
                }
        }
        $full = Join-Path $baseDest "full"
        if (Test-Path $full) {
            $dirs = Get-ChildItem $full -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
            $i = 0
            foreach ($d in $dirs) {
                $i++
                if ($i -gt $keepFull) {
                    BLog "  purga full: $($d.Name)"
                    Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
                }
            }
        }
        $mig = Join-Path $baseDest "migrate"
        if (Test-Path $mig) {
            $dirs = Get-ChildItem $mig -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
            $i = 0
            foreach ($d in $dirs) {
                $i++
                if ($i -gt $keepFull) {
                    Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {
        BLog "  WARN purga: $_"
    }
}

function Invoke-CallejonBackup {
    param(
        [string]$Mode,
        [string]$DestRoot,
        [bool]$Incremental,
        [object]$Include,
        [bool]$MigrateBundle
    )

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $day = Get-Date -Format "yyyy-MM-dd"
    BLog "=== Backup mode=$Mode incremental=$Incremental dest=$DestRoot ==="

    $mirror = Join-Path $DestRoot "mirror"
    $journalDay = Join-Path $DestRoot "journal\$day"
    New-Item -ItemType Directory -Force -Path $mirror | Out-Null
    New-Item -ItemType Directory -Force -Path $journalDay | Out-Null

    $inc = $Include
    if (-not $inc) {
        $inc = [pscustomobject]@{
            music = $true; images = $true; videos = $true; postgres = $true
            env = $true; config = $true; source_code = $false
            installer = $false; docker_compose = $false
        }
    }

    # Modo define paquetes
    if ($Mode -eq "full" -or $Mode -eq "migrate") {
        $inc | Add-Member -NotePropertyName source_code -NotePropertyValue $true -Force
        $inc | Add-Member -NotePropertyName installer -NotePropertyValue $true -Force
        $inc | Add-Member -NotePropertyName docker_compose -NotePropertyValue $true -Force
    }

    $copied = @()

    # —— Contenido (siempre en content/full/migrate) ——
    if ($inc.music -ne $false) {
        $s = Join-Path $Root "Music"
        $d = Join-Path $mirror "Music"
        Invoke-Robo $s $d -Mirror | Out-Null
        $copied += "Music"
        if ($Incremental) {
            # Journal: solo archivos tocados hoy (aprox. por fecha)
            $j = Join-Path $journalDay "Music"
            if (Test-Path $s) {
                New-Item -ItemType Directory -Force -Path $j | Out-Null
                $args = @($s, $j, "/E", "/MAXAGE:1", "/R:1", "/W:1", "/NFL", "/NDL", "/NP", "/XO")
                & robocopy @args | Out-Null
            }
        }
    }

    if ($inc.images -ne $false -or $inc.videos -ne $false) {
        $s = Join-Path $Root "frontend\public"
        $d = Join-Path $mirror "frontend\public"
        Invoke-Robo $s $d -Mirror | Out-Null
        $copied += "frontend/public"
        if ($Incremental -and (Test-Path $s)) {
            $j = Join-Path $journalDay "frontend\public"
            New-Item -ItemType Directory -Force -Path $j | Out-Null
            $args = @($s, $j, "/E", "/MAXAGE:1", "/R:1", "/W:1", "/NFL", "/NDL", "/NP", "/XO")
            & robocopy @args | Out-Null
        }
    }

    if ($inc.config -ne $false) {
        $s = Join-Path $Root "backend\app\data"
        $d = Join-Path $mirror "backend\app\data"
        Invoke-Robo $s $d -Mirror | Out-Null
        $copied += "backend/app/data"
    }

    if ($inc.env -ne $false) {
        $envSrc = Join-Path $Root ".env"
        if (Test-Path $envSrc) {
            New-Item -ItemType Directory -Force -Path $mirror | Out-Null
            Copy-Item $envSrc (Join-Path $mirror ".env") -Force
            $copied += ".env"
        }
        $ex = Join-Path $Root ".env.example"
        if (Test-Path $ex) { Copy-Item $ex (Join-Path $mirror ".env.example") -Force }
    }

    if ($inc.postgres -ne $false) {
        $pgDir = Join-Path $mirror "db_dump"
        Export-PostgresDump $pgDir | Out-Null
        $copied += "postgres"
    }

    # —— Software ——
    if ($inc.source_code -eq $true) {
        foreach ($pair in @(
            @("backend\app", "backend\app"),
            @("backend\requirements.txt", "backend\requirements.txt"),
            @("backend\Dockerfile", "backend\Dockerfile"),
            @("frontend\src", "frontend\src"),
            @("frontend\package.json", "frontend\package.json"),
            @("frontend\package-lock.json", "frontend\package-lock.json"),
            @("frontend\Dockerfile", "frontend\Dockerfile"),
            @("frontend\vite.config.js", "frontend\vite.config.js"),
            @("frontend\index.html", "frontend\index.html"),
            @("db", "db")
        )) {
            $s = Join-Path $Root $pair[0]
            $d = Join-Path $mirror $pair[1]
            if (Test-Path $s -PathType Leaf) {
                New-Item -ItemType Directory -Force -Path (Split-Path $d -Parent) | Out-Null
                Copy-Item $s $d -Force
            } elseif (Test-Path $s) {
                Invoke-Robo $s $d -Mirror | Out-Null
            }
        }
        $copied += "source_code"
    }

    if ($inc.docker_compose -eq $true) {
        foreach ($f in @("docker-compose.yml", "docker-compose.yaml", ".dockerignore")) {
            $s = Join-Path $Root $f
            if (Test-Path $s) { Copy-Item $s (Join-Path $mirror $f) -Force }
        }
        $copied += "docker_compose"
    }

    if ($inc.installer -eq $true) {
        $s = Join-Path $Root "scripts"
        $d = Join-Path $mirror "scripts"
        Invoke-Robo $s $d -Mirror | Out-Null
        foreach ($f in @("INSTALLAR.bat", "INICIAR_MUSICA.bat", "README.md")) {
            $sf = Join-Path $Root $f
            if (Test-Path $sf) { Copy-Item $sf (Join-Path $mirror $f) -Force }
        }
        $copied += "installer_scripts"
    }

    # Manifiesto del espejo
    $manifest = @{
        type          = "mirror"
        mode          = $Mode
        incremental   = $Incremental
        created_at    = (Get-Date).ToString("o")
        source        = $Root
        destination   = $mirror
        computer      = $env:COMPUTERNAME
        includes      = $copied
        note          = "Espejo incremental: robocopy solo escribe archivos nuevos o modificados."
    }
    Write-JsonFile (Join-Path $mirror "BACKUP_MANIFEST.json") $manifest
    Write-JsonFile (Join-Path $journalDay "JOURNAL.json") @{
        day = $day
        at  = (Get-Date).ToString("o")
        mode = $Mode
        note = "Archivos tocados ~ultimas 24h (MAXAGE:1) bajo journal/$day"
    }

    $resultPath = $mirror

    # Copia full fechada (opcional no-incremental o full/migrate)
    if ((-not $Incremental) -or $Mode -eq "full" -or $Mode -eq "migrate") {
        $fullDir = Join-Path $DestRoot ("full\FULL_{0}" -f $stamp)
        New-Item -ItemType Directory -Force -Path $fullDir | Out-Null
        Invoke-Robo $mirror $fullDir | Out-Null
        Write-JsonFile (Join-Path $fullDir "BACKUP_MANIFEST.json") (@{
            type = "full_snapshot"
            mode = $Mode
            created_at = (Get-Date).ToString("o")
            from_mirror = $mirror
        })
        $resultPath = $fullDir
        BLog "Full snapshot: $fullDir"
    }

    # Paquete migracion
    if ($Mode -eq "migrate" -or $MigrateBundle) {
        $migDir = Join-Path $DestRoot ("migrate\MIGRATE_{0}" -f $stamp)
        New-Item -ItemType Directory -Force -Path $migDir | Out-Null
        Invoke-Robo $mirror $migDir | Out-Null
        # Asegurar instalador
        foreach ($f in @("INSTALLAR.bat", "INICIAR_MUSICA.bat")) {
            $sf = Join-Path $Root $f
            if (Test-Path $sf) { Copy-Item $sf (Join-Path $migDir $f) -Force }
        }
        $migMd = Join-Path $Root "scripts\MIGRAR_E_INSTALAR.md"
        if (Test-Path $migMd) {
            New-Item -ItemType Directory -Force -Path (Join-Path $migDir "scripts") | Out-Null
            Copy-Item $migMd (Join-Path $migDir "scripts\MIGRAR_E_INSTALAR.md") -Force
        }
        @"
# Migrar El Callejon a otro PC

1. Copie esta carpeta completa a C:\EL_CALLEJON_POS en el PC nuevo.
2. Instale Docker Desktop si falta.
3. Ejecute INSTALLAR.bat como Administrador.
4. Si hay dump SQL: docker compose up -d db; luego:
   Get-Content db_dump\*.sql | docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos
5. Abra las TVs a http://IP:5173/tv/1 ... /tv/6

Generado: $(Get-Date -Format o)
Equipo origen: $env:COMPUTERNAME
"@ | Set-Content (Join-Path $migDir "LEEME_MIGRAR.txt") -Encoding UTF8
        Write-JsonFile (Join-Path $migDir "BACKUP_MANIFEST.json") @{
            type = "migrate_bundle"
            mode = "migrate"
            created_at = (Get-Date).ToString("o")
            includes = $copied
            restore = "INSTALLAR.bat en PC nuevo"
        }
        $resultPath = $migDir
        BLog "Paquete migracion: $migDir"
    }

    return $resultPath
}

# ——— main ———
$cfg = Get-BackupConfig

if ($ProcessPendingOnly) {
    $req = Read-JsonFile $requestPath
    if (-not $req -or $req.status -ne "pending") {
        # solo re-schedule flag?
        $flag = Join-Path $Root "backend\app\data\backup_schedule_reload.flag"
        if (Test-Path $flag) {
            BLog "Flag schedule reload detectado"
            try {
                & (Join-Path $ScriptDir "Register-DailyBackup.ps1") -NoElevate -ProjectRoot $Root -FromConfig
            } catch { BLog "WARN re-register: $_" }
            Remove-Item $flag -Force -ErrorAction SilentlyContinue
        }
        exit 0
    }
    BLog "Procesando peticion pendiente API..."
    $Mode = if ($req.mode) { $req.mode } else { "content" }
    $Destination = if ($req.destination) { $req.destination } else { "" }
    $incFlag = if ($null -ne $req.incremental) { [bool]$req.incremental } else { $true }
    $NoIncremental = -not $incFlag
    $FromConfig = $false
    $includeObj = $req.include
    $migrate = [bool]$req.migrate_bundle
} else {
    if ($FromConfig -or $Mode -eq "auto") {
        if (-not $cfg.enabled -and -not $ProcessPendingOnly) {
            BLog "Backup deshabilitado en config (enabled=false)"
            exit 0
        }
        # Respetar dias configurados (0=dom … 6=sab, como JS getDay)
        try {
            $jsDay = [int](Get-Date).DayOfWeek  # .NET: 0=Sunday … 6=Saturday
            $cfgDays = @()
            if ($cfg.days) {
                foreach ($d in @($cfg.days)) { $cfgDays += [int]$d }
            }
            if ($cfgDays.Count -gt 0 -and ($cfgDays -notcontains $jsDay)) {
                BLog "Hoy (day=$jsDay) no esta en days=[$($cfgDays -join ',')]; se omite backup programado"
                exit 0
            }
        } catch {
            BLog "WARN al evaluar days: $_"
        }
        $Mode = if ($Mode -eq "auto") { [string]$cfg.mode } else { $Mode }
        if (-not $Destination -and $cfg.destination) { $Destination = [string]$cfg.destination }
        if ($cfg.incremental -eq $false) { $NoIncremental = $true }
    }
    $includeObj = $cfg.include
    $migrate = [bool]$cfg.migrate_bundle
}

if ($Mode -eq "auto") { $Mode = "content" }

$destRoot = if ($Destination) { $Destination } else {
    if ($cfg.destination) { [string]$cfg.destination } else { Join-Path $Root "snapshots\daily" }
}
New-Item -ItemType Directory -Force -Path $destRoot | Out-Null

$incremental = -not $NoIncremental
if ($Mode -eq "migrate") { $migrate = $true }

try {
    $path = Invoke-CallejonBackup -Mode $Mode -DestRoot $destRoot -Incremental $incremental `
        -Include $includeObj -MigrateBundle $migrate
    $keepDays = 14
    $keepFull = 3
    try { $keepDays = [int]$cfg.keep_days } catch { }
    try { $keepFull = [int]$cfg.keep_full_count } catch { }
    Remove-OldBackups $destRoot $keepDays $keepFull
    Update-ConfigLastRun "ok" $path $null
    if (Test-Path $requestPath) {
        $req = Read-JsonFile $requestPath
        if ($req) {
            $req | Add-Member -NotePropertyName status -NotePropertyValue "done" -Force
            $req | Add-Member -NotePropertyName finished_at -NotePropertyValue (Get-Date).ToString("o") -Force
            $req | Add-Member -NotePropertyName result_path -NotePropertyValue $path -Force
            Write-JsonFile $requestPath $req
            Start-Sleep -Seconds 1
            Remove-Item $requestPath -Force -ErrorAction SilentlyContinue
        }
    }
    BLog "OK -> $path"
    Write-Host ""
    Write-Host "  Respaldo listo: $path" -ForegroundColor Green
    Write-Host "  Espejo incremental: $(Join-Path $destRoot 'mirror')" -ForegroundColor DarkGray
    exit 0
} catch {
    BLog "ERROR: $_"
    Update-ConfigLastRun "error" $null "$_"
    if (Test-Path $requestPath) {
        try {
            $req = Read-JsonFile $requestPath
            if ($req) {
                $req | Add-Member -NotePropertyName status -NotePropertyValue "error" -Force
                $req | Add-Member -NotePropertyName error -NotePropertyValue "$_" -Force
                Write-JsonFile $requestPath $req
            }
        } catch { }
    }
    Write-Host "  ERROR: $_" -ForegroundColor Red
    exit 1
}
