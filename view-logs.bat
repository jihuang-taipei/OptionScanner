@echo off
title Options Scanner Logs
echo.
echo ============================================
echo    Options Scanner - Live Logs
echo ============================================
echo.
echo Press Ctrl+C to stop viewing logs
echo.

cd /d "%~dp0"
docker-compose logs -f --tail=100
