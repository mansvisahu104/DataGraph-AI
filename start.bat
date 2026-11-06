@echo off
title DataGraph AI - Full Stack Launcher
echo ========================================================
echo        DATAGRAPH AI - STARTING FULL STACK STUDIO
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "DataGraph AI - Backend" cmd /k "cd backend && venv\Scripts\activate && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [2/3] Starting React Vite Frontend on http://localhost:5173 ...
start "DataGraph AI - Frontend" cmd /k "cd frontend-app && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser...
start http://localhost:5173

echo.
echo ========================================================
echo    DataGraph AI is running!
echo    - Frontend UI:  http://localhost:5173
echo    - FastAPI Docs: http://127.0.0.1:8000/docs
echo ========================================================
echo.
pause
