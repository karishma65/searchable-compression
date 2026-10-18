@echo off
title Searchable K8s Log Compression - Launcher
echo ======================================================================
echo  Searchable Compression of Cloud/Kubernetes Logs Using LZ78 + Huffman
echo  Starting FastAPI Backend (Port 8000) and Angular Frontend (Port 4200)
echo ======================================================================

cd /d "%~dp0"

echo [1/3] Ensuring ports 8000 and 4200 are free...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000, 4200 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; exit 0" >nul 2>&1

echo [2/3] Launching Python FastAPI Backend...
start "K8s Log Compression - FastAPI Backend" cmd /k "cd /d ""%~dp0"" && (if exist "".venv\Scripts\activate.bat"" call "".venv\Scripts\activate.bat"") && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [3/3] Launching Angular Frontend...
start "K8s Log Compression - Angular Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm start"

echo.
echo Both services are booting up!
echo   - Backend API:  http://127.0.0.1:8000
echo   - Swagger Docs: http://127.0.0.1:8000/docs
echo   - Frontend UI:  http://localhost:4200
echo ======================================================================
pause
