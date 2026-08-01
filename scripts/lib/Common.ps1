# Utilidades compartidas - instalador El Callejon
# Requiere PowerShell 5.1+

$ErrorActionPreference = "Stop"

function Get-ProjectRoot {
    if ($PSScriptRoot) {
        return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    }
    return (Get-Location).Path
}

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-AdminElevation {
    param([string[]]$ArgumentList = @())
    if (Test-IsAdmin) { return $true }
    Write-Host "Solicitando permisos de administrador..." -ForegroundColor Yellow
    $script = $MyInvocation.PSCommandPath
    if (-not $script) { $script = $PSCommandPath }
    $argLine = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$script`"") + $ArgumentList
    try {
        Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argLine -Wait
        exit 0
    } catch {
        Write-Host "No se pudo elevar a administrador: $_" -ForegroundColor Red
        return $false
    }
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  [X] $Message" -ForegroundColor Red
}

function Get-LanIPv4 {
    $candidates = @()
    try {
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -notlike "127.*" -and
                $_.PrefixOrigin -ne "WellKnown" -and
                (
                    $_.IPAddress -like "192.168.*" -or
                    $_.IPAddress -like "10.*" -or
                    ($_.IPAddress -match '^172\.(1[6-9]|2\d|3[0-1])\.')
                )
            } |
            ForEach-Object { $candidates += $_.IPAddress }
    } catch { }

    if (-not $candidates.Count) {
        try {
            $cfg = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
                Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" }
            foreach ($c in $cfg) {
                $ip = $c.IPv4Address.IPAddress
                if ($ip -and $ip -notlike "127.*") { $candidates += $ip }
            }
        } catch { }
    }

    $sorted = $candidates | Sort-Object {
        if ($_ -like "192.168.*") { 0 }
        elseif ($_ -like "10.*") { 1 }
        else { 2 }
    }, { $_ }

    if ($sorted) { return @($sorted)[0] }
    return $null
}

function Get-SystemSpecs {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $disk = Get-PSDrive -Name C -ErrorAction SilentlyContinue
    $ramGb = [math]::Round(($cs.TotalPhysicalMemory / 1GB), 1)
    $freeGb = if ($disk) { [math]::Round($disk.Free / 1GB, 1) } else { 0 }
    return [pscustomobject]@{
        ComputerName = $env:COMPUTERNAME
        OS           = "$($os.Caption) $($os.Version)"
        Arch         = $env:PROCESSOR_ARCHITECTURE
        CPU          = $cpu.Name
        Cores        = $cpu.NumberOfLogicalProcessors
        RAM_GB       = $ramGb
        DiskFree_GB  = $freeGb
        Is64Bit      = [Environment]::Is64BitOperatingSystem
    }
}

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-WingetPath {
    if (Test-CommandExists "winget") { return "winget" }
    $p = "$env:LocalAppData\Microsoft\WindowsApps\winget.exe"
    if (Test-Path $p) { return $p }
    return $null
}

function Install-WingetPackage {
    param(
        [string]$Id,
        [string]$Name
    )
    $winget = Get-WingetPath
    if (-not $winget) {
        Write-Warn "winget no disponible; instale $Name manualmente"
        return $false
    }
    Write-Step "Instalando $Name ($Id) con winget..."
    & $winget install --id $Id -e --accept-package-agreements --accept-source-agreements --silent
    return $true
}

function Ensure-DockerDesktop {
    if (Test-CommandExists "docker") {
        try {
            docker info 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Ok "Docker en ejecucion"
                return $true
            }
        } catch { }
    }

    $dockerUi = $null
    $tryPaths = @(
        "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
    )
    foreach ($tp in $tryPaths) {
        if (Test-Path $tp) { $dockerUi = $tp; break }
    }

    if (-not $dockerUi -and -not (Test-CommandExists "docker")) {
        Write-Step "Docker Desktop no encontrado - instalando..."
        $ok = Install-WingetPackage -Id "Docker.DockerDesktop" -Name "Docker Desktop"
        if (-not $ok) {
            Write-Fail "Instale Docker Desktop desde https://www.docker.com/products/docker-desktop/"
            return $false
        }
        $dockerUi = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
    }

    if ($dockerUi -and (Test-Path $dockerUi)) {
        Write-Step "Iniciando Docker Desktop..."
        Start-Process $dockerUi
    }

    Write-Step "Esperando motor Docker (hasta 3 min)..."
    $deadline = (Get-Date).AddMinutes(3)
    while ((Get-Date) -lt $deadline) {
        try {
            docker info 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Ok "Docker listo"
                return $true
            }
        } catch { }
        Start-Sleep -Seconds 5
    }
    Write-Fail "Docker no respondio a tiempo. Abralo manualmente y reintente."
    return $false
}

function Ensure-EnvFile {
    param(
        [string]$Root,
        [string]$LanIp
    )
    $envPath = Join-Path $Root ".env"
    $example = Join-Path $Root ".env.example"
    if (-not (Test-Path $envPath)) {
        if (Test-Path $example) {
            Copy-Item $example $envPath
            Write-Ok "Creado .env desde .env.example"
        } else {
            $secret = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
            @(
                "POSTGRES_USER=callejon",
                "POSTGRES_PASSWORD=callejon_dev_2026",
                "POSTGRES_DB=el_callejon_pos",
                "POSTGRES_PORT=5432",
                "BACKEND_PORT=8000",
                "DATABASE_URL=postgresql+asyncpg://callejon:callejon_dev_2026@db:5432/el_callejon_pos",
                "CORS_ORIGINS=*",
                "JWT_SECRET=$secret",
                "JWT_EXPIRE_MINUTES=720",
                "FRONTEND_PORT=5173",
                "VITE_API_URL=auto",
                "VITE_WS_URL=auto",
                "LAN_IP=",
                "AMBIENT_HOST_URL=http://host.docker.internal:8788"
            ) | Set-Content -Path $envPath -Encoding UTF8
            Write-Ok "Creado .env por defecto"
        }
    }

    if ($LanIp) {
        $content = Get-Content $envPath -Raw
        if ($content -match '(?m)^LAN_IP=') {
            $content = $content -replace '(?m)^LAN_IP=.*$', "LAN_IP=$LanIp"
        } else {
            $content = $content.TrimEnd() + "`r`nLAN_IP=$LanIp`r`n"
        }
        if ($content -match 'JWT_SECRET=cambiar-en-produccion' -or $content -match 'JWT_SECRET=el-callejon-pos-dev') {
            $secret = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
            $content = $content -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$secret"
            Write-Ok "JWT_SECRET regenerado"
        }
        Set-Content -Path $envPath -Value $content -Encoding UTF8 -NoNewline
        Write-Ok "LAN_IP=$LanIp en .env"
    }
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 180
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Get-PythonExe {
    $paths = @(
        "$env:USERPROFILE\.local\bin\python3.14.exe",
        "$env:LocalAppData\Programs\Python\Python312\python.exe",
        "$env:LocalAppData\Programs\Python\Python311\python.exe",
        "$env:ProgramFiles\Python312\python.exe"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }
    if (Test-CommandExists "python") {
        $v = & python -c "import sys; print(sys.version)" 2>$null
        if ($v -and $v -notmatch "Microsoft Store") { return "python" }
    }
    if (Test-CommandExists "py") { return "py" }
    return $null
}
