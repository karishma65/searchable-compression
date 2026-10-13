@echo off
cd /d "%~dp0"
title Searchable Compression of Cloud/Kubernetes Logs
echo ======================================================================
echo Launching Research Environment: Searchable Cloud/Kubernetes Log Compression
echo ======================================================================

echo.
echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "FastAPI Backend" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo.
echo Starting Angular Frontend on http://localhost:4200 ...
start "Angular Frontend" cmd /k "cd frontend && npm start"

echo.
echo Both servers initiated!
echo Backend API Docs: http://127.0.0.1:8000/docs
echo Frontend Application: http://localhost:4200
echo.
pause
