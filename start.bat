@echo off
title DataGraph AI - Full Stack Launcher
cls
echo ========================================================
echo        DATAGRAPH AI - STARTING FULL STACK STUDIO
echo ========================================================
echo.

:: Automatically detect if running from outer or inner folder
if exist "%~dp0DataGraph-AI\backend\venv\Scripts\python.exe" (
    set "PROJECT_DIR=%~dp0DataGraph-AI"
) else if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PROJECT_DIR=%~dp0"
) else (
    set "PROJECT_DIR=C:\Users\mansv\OneDrive\Desktop\Ai DataGraph\DataGraph-AI"
)

set "PYTHON_BIN=%PROJECT_DIR%\backend\venv\Scripts\python.exe"

echo [1/3] Backend directory:  %PROJECT_DIR%\backend
echo [2/3] Frontend directory: %PROJECT_DIR%\frontend-app
echo.

echo Starting FastAPI Backend (Port 8000)...
start "DataGraph AI - Backend" cmd /k ""%PYTHON_BIN%" -m uvicorn main:app --app-dir "%PROJECT_DIR%\backend" --reload --host 127.0.0.1 --port 8000"

echo Starting React Vite Frontend (Port 5173)...
start "DataGraph AI - Frontend" cmd /k "cd /d "%PROJECT_DIR%\frontend-app" && npm run dev"

echo.
echo Waiting 4 seconds for servers to initialize...
timeout /t 4 /nobreak >nul

echo Launching browser to http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo    DataGraph AI is LIVE!
echo    - Web UI:       http://localhost:5173
echo    - FastAPI Docs: http://127.0.0.1:8000/docs
echo ========================================================
echo.
pause
