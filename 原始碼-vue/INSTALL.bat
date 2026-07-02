@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo    NEON CLASH - INSTALL DEPENDENCIES
echo ============================================
echo.
echo Current folder:
echo   %CD%
echo.

echo [Step 1/3] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js not found on PATH.
    echo Please install Node.js LTS from https://nodejs.org
    echo Then close this window and try again.
    echo.
    pause
    exit /b 1
)
node --version

echo.
echo [Step 2/3] Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] npm not found.
    echo Node.js might be installed incorrectly. Reinstall it.
    echo.
    pause
    exit /b 1
)
call npm --version

echo.
echo [Step 3/3] Running npm install...
echo (first time may take 1-3 minutes)
echo.

call npm install

set INSTALL_STATUS=%errorlevel%

echo.
echo ============================================
if %INSTALL_STATUS% NEQ 0 (
    echo   [FAIL] npm install returned error code %INSTALL_STATUS%
    echo   See the messages above for details.
) else (
    echo   [OK] Install complete.
    echo   Next: double-click START.bat to run dev server.
)
echo ============================================
echo.
pause
