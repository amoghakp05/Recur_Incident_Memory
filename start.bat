@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo Starting Recur - Incident Memory Assistant
echo Link: http://localhost:8000
echo ===================================================

rem Ensure frontend build exists
if not exist "frontend\dist\index.html" (
    echo Building frontend assets...
    cd frontend
    if not exist "node_modules" call npm install
    call npm run build
    cd ..
)

rem Launch unified service hosting both Frontend UI and Backend API
start "Recur Service" cmd /k "cd /d "%~dp0" && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

rem Wait for server initialization, then automatically open in browser
timeout /t 2 >nul
start http://localhost:8000

echo Application launched!
pause
