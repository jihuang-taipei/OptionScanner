# Options Scanner - PowerShell Installer
# Run: powershell -ExecutionPolicy Bypass -File install.ps1

param(
    [string]$InstallDir = "$env:USERPROFILE\OptionsScanner",
    [switch]$NoShortcuts,
    [switch]$NoStart
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Banner
Write-Host @"

============================================
   Options Scanner - Windows Installer
============================================

"@ -ForegroundColor White

# Check prerequisites
Write-Step "Checking prerequisites..."

# Check Docker
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker not found" }
    Write-Success "Docker installed: $dockerVersion"
} catch {
    Write-Error "Docker is not installed or not in PATH."
    Write-Host @"

Please install Docker Desktop for Windows:
  https://www.docker.com/products/docker-desktop/

After installing:
  1. Start Docker Desktop
  2. Wait for it to fully start (whale icon in system tray)
  3. Run this installer again

"@ -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
    Write-Success "Docker is running"
} catch {
    Write-Error "Docker is not running."
    Write-Host "Please start Docker Desktop and wait for it to fully initialize." -ForegroundColor Yellow
    exit 1
}

# Create installation directory
Write-Step "Creating installation directory..."

if (Test-Path $InstallDir) {
    $response = Read-Host "Installation directory exists. Overwrite? (Y/N)"
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Installation cancelled."
        exit 0
    }
    Remove-Item -Recurse -Force $InstallDir -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\data" -Force | Out-Null
Write-Success "Created $InstallDir"

# Copy files
Write-Step "Copying application files..."

$sourceDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path "$sourceDir\Dockerfile")) {
    $sourceDir = Split-Path -Parent $PSScriptRoot
}
if (-not (Test-Path "$sourceDir\Dockerfile")) {
    $sourceDir = $PSScriptRoot
    # Look for files in parent directories
    for ($i = 0; $i -lt 3; $i++) {
        $sourceDir = Split-Path -Parent $sourceDir
        if (Test-Path "$sourceDir\Dockerfile") { break }
    }
}

if (Test-Path "$sourceDir\backend") {
    Copy-Item -Recurse -Force "$sourceDir\backend" "$InstallDir\"
    Copy-Item -Recurse -Force "$sourceDir\frontend" "$InstallDir\"
    Copy-Item -Force "$sourceDir\Dockerfile" "$InstallDir\"
    Copy-Item -Force "$sourceDir\docker-compose.yml" "$InstallDir\"
    Copy-Item -Force "$sourceDir\docker-compose.dev.yml" "$InstallDir\" -ErrorAction SilentlyContinue
    Copy-Item -Force "$sourceDir\*.md" "$InstallDir\" -ErrorAction SilentlyContinue
    Write-Success "Application files copied"
} else {
    Write-Error "Could not find application files. Please run from the correct directory."
    exit 1
}

# Create startup scripts
Write-Step "Creating startup scripts..."

# Start script
@"
@echo off
echo Starting Options Scanner...
cd /d "$InstallDir"
docker-compose up -d
echo.
echo Options Scanner is starting...
timeout /t 5 /nobreak >nul
start http://localhost:8000
echo Application running at: http://localhost:8000
echo To stop: run stop-options-scanner.bat
pause
"@ | Out-File -FilePath "$InstallDir\start-options-scanner.bat" -Encoding ASCII

# Stop script
@"
@echo off
echo Stopping Options Scanner...
cd /d "$InstallDir"
docker-compose down
echo Options Scanner stopped.
pause
"@ | Out-File -FilePath "$InstallDir\stop-options-scanner.bat" -Encoding ASCII

# Status script
@"
@echo off
echo Options Scanner Status:
cd /d "$InstallDir"
docker-compose ps
pause
"@ | Out-File -FilePath "$InstallDir\status-options-scanner.bat" -Encoding ASCII

# Logs script
@"
@echo off
cd /d "$InstallDir"
docker-compose logs -f --tail=100
"@ | Out-File -FilePath "$InstallDir\view-logs.bat" -Encoding ASCII

# Uninstall script
@"
@echo off
echo ============================================
echo    Options Scanner - Uninstaller
echo ============================================
choice /C YN /M "Uninstall Options Scanner"
if %errorlevel% equ 2 exit /b 0
cd /d "$InstallDir"
docker-compose down -v 2>nul
docker rmi optionsscanner-option-scanner 2>nul
cd /d "%USERPROFILE%"
rmdir /s /q "$InstallDir"
del "%USERPROFILE%\Desktop\Options Scanner.lnk" 2>nul
del "%USERPROFILE%\Desktop\Stop Options Scanner.lnk" 2>nul
echo Uninstalled successfully.
pause
"@ | Out-File -FilePath "$InstallDir\uninstall.bat" -Encoding ASCII

Write-Success "Startup scripts created"

# Create desktop shortcuts
if (-not $NoShortcuts) {
    Write-Step "Creating desktop shortcuts..."
    
    $WshShell = New-Object -ComObject WScript.Shell
    
    # Start shortcut
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Options Scanner.lnk")
    $Shortcut.TargetPath = "$InstallDir\start-options-scanner.bat"
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Start Options Scanner"
    $Shortcut.IconLocation = "%SystemRoot%\System32\shell32.dll,21"
    $Shortcut.Save()
    
    # Stop shortcut
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Stop Options Scanner.lnk")
    $Shortcut.TargetPath = "$InstallDir\stop-options-scanner.bat"
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Stop Options Scanner"
    $Shortcut.IconLocation = "%SystemRoot%\System32\shell32.dll,27"
    $Shortcut.Save()
    
    Write-Success "Desktop shortcuts created"
}

# Build Docker images
Write-Step "Building Docker images (this may take several minutes)..."
Write-Host "Please wait..." -ForegroundColor Gray

Set-Location $InstallDir
docker-compose build 2>&1 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build Docker images."
    Write-Host "Please check Docker is running correctly and try again." -ForegroundColor Yellow
    exit 1
}

Write-Success "Docker images built successfully"

# Installation complete
Write-Host @"

============================================
   Installation Complete!
============================================

Options Scanner installed to:
  $InstallDir

Desktop shortcuts created:
  - "Options Scanner" - Start the application
  - "Stop Options Scanner" - Stop the application

To start manually:
  $InstallDir\start-options-scanner.bat

Application URL:
  http://localhost:8000

"@ -ForegroundColor Green

# Start application
if (-not $NoStart) {
    $response = Read-Host "Start Options Scanner now? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host "`nStarting Options Scanner..." -ForegroundColor Cyan
        & "$InstallDir\start-options-scanner.bat"
    }
}

Write-Host "`nInstallation complete. Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
