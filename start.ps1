Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       DATAGRAPH AI - FULL STACK LAUNCHER" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

Write-Host "[1/3] Starting FastAPI Backend on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\venv\Scripts\activate; python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

Write-Host "[2/3] Starting React Vite Frontend on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend-app'; npm run dev"

Start-Sleep -Seconds 3

Write-Host "[3/3] Opening dashboard in browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "DataGraph AI is now live at http://localhost:5173" -ForegroundColor Green
Write-Host "FastAPI Documentation is at http://127.0.0.1:8000/docs" -ForegroundColor Cyan
