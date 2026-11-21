@echo off
echo ========================================================
echo Starting Smart Canteen Flask Backend Server (Port 5000)...
echo ========================================================
cd /d "%~dp0"
python -m backend.app
pause
