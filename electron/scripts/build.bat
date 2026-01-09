@echo off
setlocal

REM Options Scanner - Electron Build Script for Windows

echo ============================================
echo    Options Scanner - Electron Build
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "ROOT_DIR=%PROJECT_DIR%\.."

REM Parse arguments
set "PLATFORM=%~1"
if "%PLATFORM%"=="" set "PLATFORM=current"

REM Step 1: Check Node.js
echo [1/5] Checking Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js %%i

REM Step 2: Build frontend
echo.
echo [2/5] Building frontend...
cd /d "%ROOT_DIR%\frontend"

if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

call npm run build
echo [OK] Frontend built

REM Step 3: Install Electron dependencies
echo.
echo [3/5] Installing Electron dependencies...
cd /d "%PROJECT_DIR%"

if not exist "node_modules" (
    call npm install
)
echo [OK] Dependencies installed

REM Step 4: Check assets
echo.
echo [4/5] Checking assets...
if not exist "%PROJECT_DIR%\assets\icon.png" (
    echo [WARNING] Placeholder icons needed - see README for icon creation
)

REM Step 5: Build Electron app
echo.
echo [5/5] Building Electron app for: %PLATFORM%

if "%PLATFORM%"=="win" (
    call npm run build:win
) else if "%PLATFORM%"=="windows" (
    call npm run build:win
) else if "%PLATFORM%"=="mac" (
    call npm run build:mac
) else if "%PLATFORM%"=="macos" (
    call npm run build:mac
) else if "%PLATFORM%"=="linux" (
    call npm run build:linux
) else if "%PLATFORM%"=="all" (
    call npm run build:all
) else (
    call npm run build
)

echo.
echo ============================================
echo    Build Complete!
echo ============================================
echo.
echo Output directory: %PROJECT_DIR%\dist\
echo.

dir "%PROJECT_DIR%\dist\" 2>nul

pause
