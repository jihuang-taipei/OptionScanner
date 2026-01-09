@echo off
title Stop Options Scanner
echo.
echo ============================================
echo    Stopping Options Scanner
echo ============================================
echo.

cd /d "%~dp0"

echo Stopping containers...
docker-compose down

echo.
echo ============================================
echo    Options Scanner Stopped
echo ============================================
echo.
echo All containers have been stopped.
echo Your data is preserved and will be available next time you start.
echo.
pause
