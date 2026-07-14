@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo    NEON CLASH - BUILD FOR PRODUCTION
echo ============================================
echo.

if not exist "node_modules" (
    echo.
    echo [ERROR] node_modules folder not found.
    echo Please run INSTALL.bat first.
    echo.
    pause
    exit /b 1
)

echo Running npm run build...
echo.

call npm run build

set BUILD_STATUS=%errorlevel%

echo.
echo ============================================
if %BUILD_STATUS% NEQ 0 (
    echo   [FAIL] Build returned error code %BUILD_STATUS%
) else (
    echo   [OK] Build complete.
    echo   Output folder: dist\
    echo   To test: double-click dist\index.html
    echo   To deploy: copy the whole dist\ folder.
)
echo ============================================
echo.
pause
