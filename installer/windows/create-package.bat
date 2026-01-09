@echo off
setlocal

echo ============================================
echo    Creating Options Scanner Package
echo ============================================
echo.

set "PACKAGE_NAME=OptionsScanner-Windows"
set "OUTPUT_DIR=%~dp0dist"

:: Create output directory
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

:: Create package directory
set "PACKAGE_DIR=%OUTPUT_DIR%\%PACKAGE_NAME%"
if exist "%PACKAGE_DIR%" rmdir /s /q "%PACKAGE_DIR%"
mkdir "%PACKAGE_DIR%"

echo Copying files...

:: Copy backend
xcopy /E /I /Y "%~dp0..\..\backend" "%PACKAGE_DIR%\backend" >nul

:: Copy frontend (exclude node_modules)
xcopy /E /I /Y "%~dp0..\..\frontend" "%PACKAGE_DIR%\frontend" /EXCLUDE:%~dp0exclude.txt >nul 2>nul
if not exist "%PACKAGE_DIR%\frontend" xcopy /E /I /Y "%~dp0..\..\frontend" "%PACKAGE_DIR%\frontend" >nul

:: Copy Docker files
copy /Y "%~dp0..\..\Dockerfile" "%PACKAGE_DIR%\" >nul
copy /Y "%~dp0..\..\docker-compose.yml" "%PACKAGE_DIR%\" >nul
copy /Y "%~dp0..\..\docker-compose.dev.yml" "%PACKAGE_DIR%\" >nul

:: Copy startup scripts
copy /Y "%~dp0..\..\start-options-scanner.bat" "%PACKAGE_DIR%\" >nul
copy /Y "%~dp0..\..\stop-options-scanner.bat" "%PACKAGE_DIR%\" >nul
copy /Y "%~dp0..\..\view-logs.bat" "%PACKAGE_DIR%\" >nul

:: Copy installer
mkdir "%PACKAGE_DIR%\installer\windows"
copy /Y "%~dp0install.bat" "%PACKAGE_DIR%\installer\windows\" >nul
copy /Y "%~dp0install.ps1" "%PACKAGE_DIR%\installer\windows\" >nul
copy /Y "%~dp0README.md" "%PACKAGE_DIR%\installer\windows\" >nul
copy /Y "%~dp0options-scanner.iss" "%PACKAGE_DIR%\installer\windows\" >nul

:: Copy documentation
copy /Y "%~dp0..\..\*.md" "%PACKAGE_DIR%\" >nul 2>nul

echo.
echo Package created at: %PACKAGE_DIR%
echo.
echo To create a ZIP file:
echo   1. Right-click the folder: %PACKAGE_DIR%
echo   2. Select "Send to" ^> "Compressed (zipped) folder"
echo.
echo Or use PowerShell:
echo   Compress-Archive -Path "%PACKAGE_DIR%\*" -DestinationPath "%OUTPUT_DIR%\%PACKAGE_NAME%.zip"
echo.

pause
