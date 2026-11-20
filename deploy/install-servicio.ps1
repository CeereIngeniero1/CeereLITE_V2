#Requires -Version 5.1
<#
.SYNOPSIS
  Build de CeereLITE + instalación como servicios Windows con NSSM.

.DESCRIPTION
  - Compila front (Vite) y back (Nest).
  - Instala/actualiza dos servicios NSSM:
      CeereLITE_API   -> node dist/main  (Nest producción)
      CeereLITE_Front -> vite preview     (SPA en el puerto del front)
  - No sobrescribe back/.env ni front/.env si ya existen.
  - Doble clic: usar install-servicio.bat (eleva a Administrador).

.PARAMETER SkipBuild
  Solo reinstala servicios (asume dist ya generado).

.PARAMETER Uninstall
  Detiene y elimina los servicios CeereLITE_*.

.PARAMETER NssmPath
  Ruta a nssm.exe. Si no se indica, busca en PATH, .\tools\nssm.exe o lo descarga.
#>
[CmdletBinding()]
param(
  [string]$RepoRoot = '',
  [string]$NssmPath = '',
  [string]$ServiceApi = 'CeereLITE_API',
  [string]$ServiceFront = 'CeereLITE_Front',
  [int]$ApiPort = 3001,
  [int]$FrontPort = 5173,
  [switch]$SkipBuild,
  [switch]$Uninstall,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Se requieren permisos de Administrador. Relanzando..." -ForegroundColor Yellow
    $args = @(
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', "`"$PSCommandPath`""
    )
    if ($SkipBuild) { $args += '-SkipBuild' }
    if ($Uninstall) { $args += '-Uninstall' }
    if ($NoPause) { $args += '-NoPause' }
    if ($RepoRoot) { $args += @('-RepoRoot', "`"$RepoRoot`"") }
    if ($NssmPath) { $args += @('-NssmPath', "`"$NssmPath`"") }
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $args | Out-Null
    exit 0
  }
}

function Resolve-RepoRoot {
  if ($RepoRoot -and (Test-Path $RepoRoot)) {
    return (Resolve-Path $RepoRoot).Path
  }
  $here = Split-Path -Parent $PSCommandPath
  $candidate = Split-Path -Parent $here
  if ((Test-Path (Join-Path $candidate 'back\package.json')) -and
      (Test-Path (Join-Path $candidate 'front\package.json'))) {
    return $candidate
  }
  throw "No se encontró la raíz del repo (back/ y front/). Use -RepoRoot."
}

function Get-NodeExe {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Node.js no está en PATH. Instale Node 18+ y vuelva a ejecutar."
  }
  return $cmd.Source
}

function Get-NpmCmd {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $cmd) { $cmd = Get-Command npm -ErrorAction SilentlyContinue }
  if (-not $cmd) { throw "npm no está en PATH." }
  return $cmd.Source
}

function Ensure-Nssm([string]$Preferred, [string]$ToolsDir) {
  if ($Preferred -and (Test-Path $Preferred)) {
    return (Resolve-Path $Preferred).Path
  }
  $inPath = Get-Command nssm -ErrorAction SilentlyContinue
  if ($inPath) { return $inPath.Source }

  $local = Join-Path $ToolsDir 'nssm.exe'
  if (Test-Path $local) { return (Resolve-Path $local).Path }

  Write-Step "NSSM no encontrado. Descargando win64 a tools\nssm.exe ..."
  New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
  $zip = Join-Path $env:TEMP ("nssm-" + [guid]::NewGuid().ToString('N') + ".zip")
  $url = 'https://nssm.cc/release/nssm-2.24.zip'
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  } catch {
    throw "No se pudo descargar NSSM ($url). Descárguelo manualmente y use -NssmPath. Detalle: $($_.Exception.Message)"
  }
  $extract = Join-Path $env:TEMP ("nssm-ex-" + [guid]::NewGuid().ToString('N'))
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $found = Get-ChildItem -Path $extract -Recurse -Filter nssm.exe |
    Where-Object { $_.FullName -match '\\win64\\nssm\.exe$' } |
    Select-Object -First 1
  if (-not $found) {
    $found = Get-ChildItem -Path $extract -Recurse -Filter nssm.exe | Select-Object -First 1
  }
  if (-not $found) { throw "El zip de NSSM no contiene nssm.exe" }
  Copy-Item -Force $found.FullName $local
  Remove-Item -Recurse -Force $extract -ErrorAction SilentlyContinue
  Remove-Item -Force $zip -ErrorAction SilentlyContinue
  return $local
}

function Invoke-Npm([string]$Npm, [string]$Dir, [string[]]$NpmArgs) {
  Push-Location $Dir
  try {
    Write-Host "  npm $($NpmArgs -join ' ')  ($Dir)" -ForegroundColor DarkGray
    & $Npm @NpmArgs
    if ($LASTEXITCODE -ne 0) {
      throw "npm falló ($($NpmArgs -join ' ')) en $Dir (exit $LASTEXITCODE)"
    }
  } finally {
    Pop-Location
  }
}

function Ensure-EnvFiles([string]$Root) {
  $backEnv = Join-Path $Root 'back\.env'
  $backEx = Join-Path $Root 'back\.env.example'
  $frontEnv = Join-Path $Root 'front\.env'
  $frontEx = Join-Path $Root 'front\.env.example'

  if (-not (Test-Path $backEnv)) {
    if (Test-Path $backEx) {
      Copy-Item $backEx $backEnv
      Write-Host "  Creado back\.env desde .env.example — EDITAR DB/JWT/CORS antes de producción." -ForegroundColor Yellow
    } else {
      throw "Falta back\.env (y no hay .env.example)."
    }
  } else {
    Write-Host "  back\.env OK (no se toca)" -ForegroundColor DarkGray
  }

  if (-not (Test-Path $frontEnv)) {
    if (Test-Path $frontEx) {
      Copy-Item $frontEx $frontEnv
      Write-Host "  Creado front\.env desde .env.example — revisar VITE_API_BASE_URL." -ForegroundColor Yellow
    } else {
      @"
VITE_API_BASE_URL=http://localhost:$ApiPort
"@ | Set-Content -Path $frontEnv -Encoding UTF8
      Write-Host "  Creado front\.env mínimo con VITE_API_BASE_URL." -ForegroundColor Yellow
    }
  } else {
    Write-Host "  front\.env OK (no se toca)" -ForegroundColor DarkGray
  }
}

function Stop-Remove-Service([string]$Nssm, [string]$Name) {
  $existing = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if (-not $existing) { return }
  Write-Host "  Quitando servicio $Name ..." -ForegroundColor DarkGray
  & $Nssm stop $Name confirm 2>$null | Out-Null
  Start-Sleep -Seconds 1
  & $Nssm remove $Name confirm 2>$null | Out-Null
}

function Install-ApiService(
  [string]$Nssm,
  [string]$Name,
  [string]$NodeExe,
  [string]$BackDir
) {
  $mainJs = Join-Path $BackDir 'dist\main.js'
  if (-not (Test-Path $mainJs)) {
    throw "No existe $mainJs. Ejecute el build del back primero."
  }
  Stop-Remove-Service $Nssm $Name
  Write-Step "Instalando servicio API: $Name"
  & $Nssm install $Name $NodeExe
  if ($LASTEXITCODE -ne 0) { throw "nssm install $Name falló" }
  & $Nssm set $Name AppParameters "`"$mainJs`""
  & $Nssm set $Name AppDirectory $BackDir
  & $Nssm set $Name DisplayName "CeereLITE API (Nest)"
  & $Nssm set $Name Description "API NestJS CeereLITE — node dist/main.js"
  & $Nssm set $Name Start SERVICE_AUTO_START
  & $Nssm set $Name AppStdout (Join-Path $BackDir 'logs\service-stdout.log')
  & $Nssm set $Name AppStderr (Join-Path $BackDir 'logs\service-stderr.log')
  & $Nssm set $Name AppRotateFiles 1
  & $Nssm set $Name AppRotateBytes 2097152
  New-Item -ItemType Directory -Force -Path (Join-Path $BackDir 'logs') | Out-Null
}

function Install-FrontService(
  [string]$Nssm,
  [string]$Name,
  [string]$NodeExe,
  [string]$FrontDir,
  [int]$Port
) {
  $dist = Join-Path $FrontDir 'dist'
  if (-not (Test-Path $dist)) {
    throw "No existe $dist. Ejecute el build del front primero."
  }
  $viteBin = Join-Path $FrontDir 'node_modules\vite\bin\vite.js'
  if (-not (Test-Path $viteBin)) {
    throw "No existe vite en node_modules. Corra npm install en front."
  }
  Stop-Remove-Service $Nssm $Name
  Write-Step "Instalando servicio Front: $Name"
  & $Nssm install $Name $NodeExe
  if ($LASTEXITCODE -ne 0) { throw "nssm install $Name falló" }
  & $Nssm set $Name AppParameters "`"$viteBin`" preview --host 0.0.0.0 --port $Port --strictPort"
  & $Nssm set $Name AppDirectory $FrontDir
  & $Nssm set $Name DisplayName "CeereLITE Front (Vite preview)"
  & $Nssm set $Name Description "SPA CeereLITE — vite preview puerto $Port"
  & $Nssm set $Name Start SERVICE_AUTO_START
  & $Nssm set $Name AppStdout (Join-Path $FrontDir 'logs\service-stdout.log')
  & $Nssm set $Name AppStderr (Join-Path $FrontDir 'logs\service-stderr.log')
  & $Nssm set $Name AppRotateFiles 1
  & $Nssm set $Name AppRotateBytes 2097152
  New-Item -ItemType Directory -Force -Path (Join-Path $FrontDir 'logs') | Out-Null
}

# --- main ---
Assert-Admin
$root = Resolve-RepoRoot
$back = Join-Path $root 'back'
$front = Join-Path $root 'front'
$tools = Join-Path $root 'deploy\tools'

Write-Host "CeereLITE — instalador de servicios" -ForegroundColor Green
Write-Host "Repo: $root"

try {
  $nssm = Ensure-Nssm -Preferred $NssmPath -ToolsDir $tools

  if ($Uninstall) {
    Write-Step "Desinstalando servicios"
    Stop-Remove-Service $nssm $ServiceFront
    Stop-Remove-Service $nssm $ServiceApi
    Write-Host "Listo. Servicios eliminados." -ForegroundColor Green
    if (-not $NoPause) { Read-Host "Enter para salir" | Out-Null }
    exit 0
  }

  $node = Get-NodeExe
  $npm = Get-NpmCmd
  Write-Host "Node: $node"
  Write-Host "npm:  $npm"
  Write-Host "NSSM: $nssm"

  Ensure-EnvFiles $root

  if (-not $SkipBuild) {
    Write-Step "Dependencias + build BACK"
    Invoke-Npm $npm $back @('install')
    Invoke-Npm $npm $back @('run', 'build')

    Write-Step "Dependencias + build FRONT"
    Invoke-Npm $npm $front @('install')
    Invoke-Npm $npm $front @('run', 'build')
  } else {
    Write-Step "SkipBuild: se omite npm install/build"
  }

  Install-ApiService -Nssm $nssm -Name $ServiceApi -NodeExe $node -BackDir $back
  Install-FrontService -Nssm $nssm -Name $ServiceFront -NodeExe $node -FrontDir $front -Port $FrontPort

  Write-Step "Iniciando servicios"
  & $nssm start $ServiceApi
  Start-Sleep -Seconds 2
  & $nssm start $ServiceFront

  Write-Host ""
  Write-Host "OK. Servicios instalados e iniciados:" -ForegroundColor Green
  Write-Host "  $ServiceApi   -> http://localhost:$ApiPort/health"
  Write-Host "  $ServiceFront -> http://localhost:$FrontPort/"
  Write-Host ""
  Write-Host "Recuerde:" -ForegroundColor Yellow
  Write-Host "  1) Revisar back\.env (DB, JWT, CORS_ORIGIN=http://SERVIDOR:$FrontPort, API_PUBLIC_BASE_URL)."
  Write-Host "  2) Revisar front\.env (VITE_API_BASE_URL) y volver a build/reinstalar si cambia."
  Write-Host "  3) Abrir puertos $ApiPort y $FrontPort en el firewall si hay acceso de red."
  Write-Host "  4) Ejecutar back\sql\instalar-actualizar.sql en SQL Server de la clínica."
  Write-Host ""
  Write-Host "Gestión: nssm edit $ServiceApi | services.msc | nssm restart $ServiceApi"
} catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  if (-not $NoPause) { Read-Host "Enter para salir" | Out-Null }
  exit 1
}

if (-not $NoPause) { Read-Host "Enter para salir" | Out-Null }
