@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo    NEON CLASH - DEV SERVER
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

echo Starting Vite dev server...
echo Browser will open http://localhost:5173/
echo Press Ctrl+C twice to stop.
echo.

call npm run dev

echo.
echo Dev server stopped.
pause
