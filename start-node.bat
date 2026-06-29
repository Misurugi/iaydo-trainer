@echo off
title Iaydo Trainer

echo.
echo  ==========================================
echo   Iaydo Trainer
echo  ==========================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found.
    echo.
    echo  Install Node.js LTS from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] npm not found.
    echo.
    pause
    exit /b 1
)

echo  Installing dependencies...
npm install --silent

echo  Starting server...
echo.
echo  Opening browser: http://localhost:5000
echo  If browser shows error - wait 3 sec and press F5
echo  To stop: close this window or press Ctrl+C
echo.

start "" /b cmd /c "timeout /t 4 >nul && start http://localhost:5000"

node server.js

pause
