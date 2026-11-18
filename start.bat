@echo off
chcp 65001 > nul
title Family Meds Tracker [Port 8018]
echo ========================================================
echo   FAMILY MEDS & HEALTH TRACKER // 24/7 WELLNESS HUB
echo ========================================================
echo [INFO] Проверка и установка зависимостей...
python -m pip install -r requirements.txt --quiet
echo [INFO] Запуск FastAPI веб-сервера на http://localhost:8018 ...
start http://localhost:8018
python -m uvicorn main:app --host 0.0.0.0 --port 8018
pause
