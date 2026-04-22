@echo off
chcp 65001 >nul
echo ===========================================
echo Voice-ka - Database Reset
echo ===========================================
echo.

echo WARNING! This will DELETE ALL database data!
set /p confirm="Are you sure? (y/N): "

if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Stopping and removing container...
docker compose down -v

echo Starting fresh...
docker compose up -d

echo Waiting for PostgreSQL...
timeout /t 5 /nobreak >nul

echo.
echo ===========================================
echo Database reset complete!
echo ===========================================
echo.
echo The database is ready.
echo Migrations will run automatically when you start the app.
echo.
echo Run: npm run tauri dev
pause