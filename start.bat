@echo off
echo Starting VolleyOps...

REM Find node path
set NODE=C:\Program Files\nodejs\node.exe

REM Start backend
echo Starting backend on port 3001...
start "VolleyOps Backend" cmd /k "cd /d "%~dp0backend" && "%NODE%" server.js"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start frontend
echo Starting frontend on port 3000...
start "VolleyOps Frontend" cmd /k "cd /d "%~dp0frontend" && "%NODE%" node_modules\vite\bin\vite.js"

echo.
echo VolleyOps is starting up!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo.
echo Default admin account:
echo   Email:    admin@volleyops.com
echo   Password: Admin123!
echo.
pause
