@echo off
title Options Scanner
echo.
echo ============================================
echo    Starting Options Scanner
echo ============================================
echo.

cd /d "%~dp0"

:: Check if Docker is running
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Docker is not running.
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.
echo Starting containers...

docker-compose up -d

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Failed to start containers.
    echo Please check Docker logs for details.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    Options Scanner Started!
echo ============================================
echo.
echo The application is starting up...
echo Please wait 10-30 seconds for full initialization.
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak >nul

start http://localhost:8000

echo.
echo Application URL: http://localhost:8000
echo.
echo To stop the application, run: stop-options-scanner.bat
echo Or close this window (containers will keep running)
echo.
echo Press any key to exit (application will continue running)...
pause >nul
