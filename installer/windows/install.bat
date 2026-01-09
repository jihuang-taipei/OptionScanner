@echo off
setlocal enabledelayedexpansion

echo ============================================
echo    Options Scanner - Windows Installer
echo ============================================
echo.

:: Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Not running as Administrator. Some features may not work.
    echo.
)

:: Set installation directory
set "INSTALL_DIR=%USERPROFILE%\OptionsScanner"
set "APP_NAME=Options Scanner"

echo [1/6] Checking prerequisites...
echo.

:: Check if Docker is installed
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo.
    echo Please install Docker Desktop for Windows first:
    echo   https://www.docker.com/products/docker-desktop/
    echo.
    echo After installing Docker Desktop:
    echo   1. Start Docker Desktop
    echo   2. Wait for it to fully start (whale icon in system tray)
    echo   3. Run this installer again
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is installed
docker --version

:: Check if Docker is running
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Docker is not running.
    echo Please start Docker Desktop and wait for it to fully initialize.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

echo [2/6] Creating installation directory...
if exist "%INSTALL_DIR%" (
    echo [INFO] Installation directory already exists.
    choice /C YN /M "Do you want to overwrite the existing installation"
    if !errorlevel! equ 2 (
        echo Installation cancelled.
        pause
        exit /b 0
    )
    rmdir /s /q "%INSTALL_DIR%" 2>nul
)

mkdir "%INSTALL_DIR%"
mkdir "%INSTALL_DIR%\backend"
mkdir "%INSTALL_DIR%\backend\models"
mkdir "%INSTALL_DIR%\backend\routes"
mkdir "%INSTALL_DIR%\backend\services"
mkdir "%INSTALL_DIR%\frontend"
mkdir "%INSTALL_DIR%\data"
echo [OK] Created %INSTALL_DIR%
echo.

echo [3/6] Copying application files...

:: Copy this installer's directory contents
xcopy /E /I /Y "%~dp0..\..\backend" "%INSTALL_DIR%\backend" >nul
xcopy /E /I /Y "%~dp0..\..\frontend" "%INSTALL_DIR%\frontend" >nul
copy /Y "%~dp0..\..\Dockerfile" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0..\..\docker-compose.yml" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0..\..\docker-compose.dev.yml" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0..\..\*.md" "%INSTALL_DIR%\" >nul 2>nul

echo [OK] Application files copied
echo.

echo [4/6] Creating startup scripts...

:: Create start script
(
echo @echo off
echo echo Starting Options Scanner...
echo echo.
echo cd /d "%INSTALL_DIR%"
echo docker-compose up -d
echo echo.
echo echo Options Scanner is starting...
echo echo Please wait about 30-60 seconds for the application to fully initialize.
echo echo.
echo timeout /t 5 /nobreak ^>nul
echo echo Opening browser...
echo start http://localhost:8000
echo echo.
echo echo Application is running at: http://localhost:8000
echo echo.
echo echo To stop the application, run: stop-options-scanner.bat
echo echo Or use: docker-compose down
echo echo.
echo pause
) > "%INSTALL_DIR%\start-options-scanner.bat"

:: Create stop script
(
echo @echo off
echo echo Stopping Options Scanner...
echo cd /d "%INSTALL_DIR%"
echo docker-compose down
echo echo.
echo echo Options Scanner has been stopped.
echo pause
) > "%INSTALL_DIR%\stop-options-scanner.bat"

:: Create status script
(
echo @echo off
echo echo Options Scanner Status:
echo echo.
echo cd /d "%INSTALL_DIR%"
echo docker-compose ps
echo echo.
echo pause
) > "%INSTALL_DIR%\status-options-scanner.bat"

:: Create logs script
(
echo @echo off
echo echo Options Scanner Logs:
echo echo.
echo cd /d "%INSTALL_DIR%"
echo docker-compose logs -f --tail=100
) > "%INSTALL_DIR%\view-logs.bat"

:: Create uninstall script
(
echo @echo off
echo echo ============================================
echo echo    Options Scanner - Uninstaller
echo echo ============================================
echo echo.
echo choice /C YN /M "Are you sure you want to uninstall Options Scanner"
echo if %%errorlevel%% equ 2 exit /b 0
echo echo.
echo echo Stopping containers...
echo cd /d "%INSTALL_DIR%"
echo docker-compose down -v 2^>nul
echo echo.
echo echo Removing Docker images...
echo docker rmi options-scanner_option-scanner 2^>nul
echo docker rmi optionsscanner_option-scanner 2^>nul
echo echo.
echo echo Removing installation directory...
echo cd /d "%%USERPROFILE%%"
echo rmdir /s /q "%INSTALL_DIR%"
echo echo.
echo echo Removing desktop shortcut...
echo del "%%USERPROFILE%%\Desktop\Options Scanner.lnk" 2^>nul
echo del "%%USERPROFILE%%\Desktop\Stop Options Scanner.lnk" 2^>nul
echo echo.
echo echo Options Scanner has been uninstalled.
echo pause
) > "%INSTALL_DIR%\uninstall.bat"

echo [OK] Startup scripts created
echo.

echo [5/6] Creating desktop shortcuts...

:: Create VBS script to create shortcuts
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = oWS.ExpandEnvironmentStrings^("%%USERPROFILE%%"^) ^& "\Desktop\Options Scanner.lnk"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "%INSTALL_DIR%\start-options-scanner.bat"
echo oLink.WorkingDirectory = "%INSTALL_DIR%"
echo oLink.Description = "Start Options Scanner"
echo oLink.IconLocation = "%%SystemRoot%%\System32\shell32.dll,21"
echo oLink.Save
) > "%TEMP%\create_shortcut.vbs"
cscript //nologo "%TEMP%\create_shortcut.vbs"
del "%TEMP%\create_shortcut.vbs"

:: Create stop shortcut
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = oWS.ExpandEnvironmentStrings^("%%USERPROFILE%%"^) ^& "\Desktop\Stop Options Scanner.lnk"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "%INSTALL_DIR%\stop-options-scanner.bat"
echo oLink.WorkingDirectory = "%INSTALL_DIR%"
echo oLink.Description = "Stop Options Scanner"
echo oLink.IconLocation = "%%SystemRoot%%\System32\shell32.dll,27"
echo oLink.Save
) > "%TEMP%\create_shortcut2.vbs"
cscript //nologo "%TEMP%\create_shortcut2.vbs"
del "%TEMP%\create_shortcut2.vbs"

echo [OK] Desktop shortcuts created
echo.

echo [6/6] Building Docker images (this may take a few minutes)...
echo.
cd /d "%INSTALL_DIR%"
docker-compose build

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Failed to build Docker images.
    echo Please check Docker is running correctly and try again.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    Installation Complete!
echo ============================================
echo.
echo Options Scanner has been installed to:
echo   %INSTALL_DIR%
echo.
echo Desktop shortcuts have been created:
echo   - "Options Scanner" - Start the application
echo   - "Stop Options Scanner" - Stop the application
echo.
echo To start the application:
echo   1. Double-click "Options Scanner" on your desktop
echo   2. Or run: %INSTALL_DIR%\start-options-scanner.bat
echo.
echo The application will be available at:
echo   http://localhost:8000
echo.
echo Would you like to start Options Scanner now?
choice /C YN /M "Start Options Scanner"
if %errorLevel% equ 1 (
    echo.
    echo Starting Options Scanner...
    call "%INSTALL_DIR%\start-options-scanner.bat"
)

pause
exit /b 0
