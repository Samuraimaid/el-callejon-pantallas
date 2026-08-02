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

function Update-SessionPath {
    # Recarga PATH de Machine+User en la sesion actual (tras winget/instaladores)
    try {
        $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
        if ($machine -or $user) {
            $env:Path = @($machine, $user) -join ";"
        }
    } catch { }
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
        [string]$Name,
        [string[]]$ExtraArgs = @()
    )
    $winget = Get-WingetPath
    if (-not $winget) {
        Write-Warn "winget no disponible; instale $Name manualmente"
        return $false
    }
    Write-Step "Instalando $Name ($Id) con winget..."
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $args = @(
            "install", "--id", $Id, "-e",
            "--accept-package-agreements", "--accept-source-agreements",
            "--silent"
        ) + $ExtraArgs
        & $winget @args
        $code = $LASTEXITCODE
        # 0 = OK; -1978335189 / 0x8A15002B = ya instalado
        if ($null -eq $code -or $code -eq 0 -or $code -eq -1978335189 -or $code -eq -1978335212) {
            Update-SessionPath
            return $true
        }
        Write-Warn "winget devolvio codigo $code para $Name (se reintentara o continuara)"
        Update-SessionPath
        return $false
    } catch {
        Write-Warn "winget fallo instalando $Name : $_"
        return $false
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

function Ensure-DockerDesktop {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
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
            Update-SessionPath
            if (-not $ok) {
                # Aun puede haberse instalado parcialmente
                if (-not (Test-Path "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe")) {
                    Write-Fail "Instale Docker Desktop desde https://www.docker.com/products/docker-desktop/"
                    return $false
                }
            }
            $dockerUi = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
        }

        if ($dockerUi -and (Test-Path $dockerUi)) {
            Write-Step "Iniciando Docker Desktop..."
            try { Start-Process $dockerUi } catch { Write-Warn "No se pudo iniciar Docker UI: $_" }
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
    } finally {
        $ErrorActionPreference = $prevEap
    }
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

function Test-RealPythonExe {
    <#
    .SYNOPSIS
      True si $Exe es un Python real (no stub de Microsoft Store).
      Nunca lanza excepcion (seguro con $ErrorActionPreference = Stop).
    #>
    param([string]$Exe)
    if ([string]::IsNullOrWhiteSpace($Exe)) { return $false }
    if ($Exe -match '(?i)WindowsApps') { return $false }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        # Ruta absoluta: debe existir y no ser el alias de Store
        if ($Exe -match '[\\/]' -or $Exe -match '\.exe$') {
            if (-not (Test-Path -LiteralPath $Exe)) { return $false }
        }

        $out = & $Exe -c "import sys; print(sys.version)" 2>&1
        $text = ($out | Out-String)
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { return $false }
        if ($text -match '(?i)Microsoft Store|was not found|Python was not found') { return $false }
        if ($text -match '^\s*3\.\d+') { return $true }
        # Algunos builds solo imprimen version larga
        if ($text -match '(?i)Python') { return $true }
        return $false
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

function Get-PythonExe {
    <#
    .SYNOPSIS
      Localiza un interprete Python usable. Nunca lanza (ignora stub Store).
    #>
    $candidates = @()

    # Rutas tipicas de instalacion (oficial / all-users / user)
    $versionDirs = @("Python314", "Python313", "Python312", "Python311", "Python310")
    foreach ($ver in $versionDirs) {
        $candidates += "$env:LocalAppData\Programs\Python\$ver\python.exe"
        $candidates += "$env:ProgramFiles\Python\$ver\python.exe"
        $candidates += "${env:ProgramFiles}\$ver\python.exe"
        $candidates += "${env:ProgramFiles(x86)}\$ver\python.exe"
    }
    $candidates += "$env:USERPROFILE\.local\bin\python3.14.exe"
    $candidates += "$env:ProgramFiles\Python312\python.exe"
    $candidates += "$env:ProgramFiles\Python311\python.exe"

    # Busqueda adicional bajo LocalAppData\Programs\Python
    try {
        $base = Join-Path $env:LocalAppData "Programs\Python"
        if (Test-Path $base) {
            Get-ChildItem -Path $base -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue |
                Select-Object -First 8 |
                ForEach-Object { $candidates += $_.FullName }
        }
    } catch { }

    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p) -and (Test-RealPythonExe $p)) {
            return $p
        }
    }

    # py / python en PATH (Continue: el stub de Store no debe tumbar el script)
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $pyCmd = Get-Command py -ErrorAction SilentlyContinue
        if ($pyCmd -and $pyCmd.Source -and $pyCmd.Source -notmatch '(?i)WindowsApps') {
            $out = & py -3 -c "import sys; print(sys.executable)" 2>&1
            if ($LASTEXITCODE -eq 0) {
                $exe = (($out | Select-Object -First 1) | Out-String).Trim()
                if ($exe -and (Test-RealPythonExe $exe)) {
                    return $exe
                }
                if (Test-RealPythonExe "py") {
                    return "py"
                }
            }
        }

        $cmd = Get-Command python -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source -and $cmd.Source -notmatch '(?i)WindowsApps') {
            if (Test-RealPythonExe $cmd.Source) {
                return $cmd.Source
            }
        }
    } catch {
        # ignore Store stub / NativeCommandError
    } finally {
        $ErrorActionPreference = $prevEap
    }

    return $null
}

function Ensure-Python {
    <#
    .SYNOPSIS
      Devuelve un Python usable; si falta, lo instala con winget (a prueba de fallos).
    #>
    param(
        [switch]$Quiet
    )

    Update-SessionPath
    $py = Get-PythonExe
    if ($py) {
        if (-not $Quiet) { Write-Ok "Python ya disponible: $py" }
        return $py
    }

    if (-not $Quiet) {
        Write-Host "  Python no encontrado (o solo alias de Microsoft Store)." -ForegroundColor Yellow
        Write-Host "  Instalando Python 3.12 automaticamente..." -ForegroundColor Yellow
    }

    $winget = Get-WingetPath
    if (-not $winget) {
        Write-Warn "winget no disponible. Instale Python 3.12 desde https://www.python.org/downloads/ y marque 'Add to PATH'."
        return $null
    }

    # 1) Intento all-users + PATH + launcher
    $ok = Install-WingetPackage -Id "Python.Python.3.12" -Name "Python 3.12" -ExtraArgs @(
        "--scope", "machine",
        "--override", "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0 Include_launcher=1 SimpleInstall=1"
    )
    Update-SessionPath
    Start-Sleep -Seconds 2
    $py = Get-PythonExe
    if ($py) { return $py }

    # 2) Reintento user-scope (por si machine requiere mas privilegios o fallo el override)
    if (-not $ok) {
        Write-Warn "Reintento instalacion Python (ambito usuario)..."
    } else {
        Write-Warn "Python instalado pero no visible aun; reintento user + refresco PATH..."
    }
    $null = Install-WingetPackage -Id "Python.Python.3.12" -Name "Python 3.12 (user)" -ExtraArgs @(
        "--scope", "user",
        "--override", "/quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_launcher=1 SimpleInstall=1"
    )
    Update-SessionPath
    Start-Sleep -Seconds 2
    $py = Get-PythonExe
    if ($py) { return $py }

    # 3) Ultimo intento sin override (defaults de winget)
    $null = Install-WingetPackage -Id "Python.Python.3.12" -Name "Python 3.12 (default)"
    Update-SessionPath
    Start-Sleep -Seconds 3
    $py = Get-PythonExe
    if ($py) { return $py }

    Write-Warn "No se pudo localizar Python tras la instalacion. Cierre y abra de nuevo INSTALLAR.bat (PATH nuevo)."
    return $null
}

function Install-PythonPackage {
    <#
    .SYNOPSIS
      pip install --user seguro (no tumba el instalador).
    #>
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Package
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        if ($PythonExe -eq "py") {
            & py -3 -m pip install --user $Package -q 2>$null
        } elseif ($PythonExe -eq "python") {
            & python -m pip install --user $Package -q 2>$null
        } else {
            & $PythonExe -m pip install --user $Package -q 2>$null
        }
        return ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE)
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

function Test-AmbientHostHealth {
    param([int]$Port = 8788)
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
        return ($r.ok -eq $true)
    } catch {
        return $false
    }
}

function Stop-AmbientOrphans {
    <#
    .SYNOPSIS
      Una sola instancia: mata python ambient_host_player huerfanos y VLC residual.
      Si -KeepIfHealthy y :port responde, NO mata nada (evita cortar la musica).
    #>
    param(
        [int]$Port = 8788,
        [switch]$KeepIfHealthy,
        [switch]$Force
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        if ($KeepIfHealthy -and -not $Force) {
            if (Test-AmbientHostHealth -Port $Port) {
                return @{ killed = $false; reason = "healthy" }
            }
        }

        $killedPy = 0
        try {
            $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.Name -match '^(python|pythonw|py)\.exe$' -and
                    $_.CommandLine -and
                    ($_.CommandLine -match 'ambient_host_player')
                }
            foreach ($p in @($procs)) {
                try {
                    & taskkill.exe /F /T /PID $p.ProcessId 2>$null | Out-Null
                    $killedPy++
                } catch {
                    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch { }
                }
            }
        } catch { }

        $killedVlc = $false
        try {
            $vlc = Get-Process -Name "vlc" -ErrorAction SilentlyContinue
            if ($vlc) {
                & taskkill.exe /F /IM vlc.exe /T 2>$null | Out-Null
                $killedVlc = $true
            }
        } catch { }

        Start-Sleep -Milliseconds 400
        return @{
            killed   = ($killedPy -gt 0 -or $killedVlc)
            python   = $killedPy
            vlc      = $killedVlc
            reason   = "cleaned"
        }
    } finally {
        $ErrorActionPreference = $prevEap
    }
}
