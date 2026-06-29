@echo off
title Iaydo Trainer

echo.
echo  ==========================================
echo   Iaydo Trainer
echo  ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found.
    echo.
    echo  Install Python 3.10+ from: https://www.python.org/downloads/
    echo  IMPORTANT: check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)

echo  Installing dependencies...
pip install -r requirements.txt --quiet

echo  Starting server...
echo.
echo  Opening browser: http://localhost:5000
echo  If browser shows error - wait 3 sec and press F5
echo  To stop: close this window or press Ctrl+C
echo.

start "" /b cmd /c "timeout /t 4 >nul && start http://localhost:5000"

python server.py

pause
