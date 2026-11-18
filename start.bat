@echo off
chcp 65001 > nul
title Family Meds Tracker [Port 8018]
echo ========================================================
echo   FAMILY MEDS TRACKER [PORT 8018]
echo ========================================================

if exist "C:\Python313\python.exe" (
    set "PY=C:\Python313\python.exe"
) else (
    set "PY=python"
)

echo [INFO] Проверка и освобождение порта 8018...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8018" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo [INFO] Запуск веб-сервера на http://localhost:8018 ...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8018"

cd /d "%~dp0"
"%PY%" -m uvicorn main:app --host 127.0.0.1 --port 8018
pause
