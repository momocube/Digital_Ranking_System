@echo off
setlocal
cd /d "%~dp0"

echo.
echo ================================================
echo    NEON CLASH - PUSH TO GITHUB
echo    Target: momocube/Digital_Ranking_System
echo ================================================
echo.

REM ---- Check git ----
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] git command not found on PATH.
    echo Install Git for Windows: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

REM ---- Initialize repo if needed ----
if not exist ".git\" (
    echo [Setup 1/3] Initializing git repository...
    git init
    if errorlevel 1 goto :die
    git branch -M main
    echo.
)

REM ---- Set default user for commit (only if empty) ----
git config user.name >nul 2>&1
if errorlevel 1 (
    echo [Setup 2/3] Setting default git user...
    git config user.name "momocube"
    git config user.email "momocube@users.noreply.github.com"
)

REM ---- Set remote ----
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [Setup 3/3] Adding remote origin...
    git remote add origin https://github.com/momocube/Digital_Ranking_System.git
    echo.
)

REM ---- Show current status ----
echo Files changed:
git status --short
echo.

REM ---- Ask for commit message ----
set /p COMMIT_MSG="Commit message (or press Enter for default): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update project

REM ---- Stage ----
echo.
echo [1/3] Staging files...
git add .

REM ---- Commit ----
echo [2/3] Creating commit...
git commit -m "%COMMIT_MSG%"

REM ---- Push ----
echo.
echo [3/3] Pushing to GitHub...
echo.
echo ------------------------------------------------
echo   When git asks for credentials:
echo     Username: momocube
echo     Password: paste your Personal Access Token
echo              (NOT your GitHub login password)
echo.
echo   No token yet?
echo     1. Open https://github.com/settings/tokens
echo     2. "Generate new token (classic)"
echo     3. Tick the "repo" scope
echo     4. Copy the token and paste it as password here
echo ------------------------------------------------
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo ================================================
    echo [FAIL] Push failed. Common causes:
    echo.
    echo   1) Wrong username/token - just re-run this script
    echo.
    echo   2) Remote has existing content (e.g. an initial README):
    echo         git pull origin main --allow-unrelated-histories
    echo      then re-run this script
    echo.
    echo   3) No network / GitHub down - check your connection
    echo ================================================
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   [OK] Push complete!
echo   Visit: https://github.com/momocube/Digital_Ranking_System
echo ================================================
echo.
pause
exit /b 0

:die
echo.
echo [ERROR] Setup step failed. See messages above.
pause
exit /b 1
