@echo off
chcp 65001 >nul
echo Voice-ka - Setup Development Environment
echo ===========================================
echo.

echo Starting PostgreSQL...
docker compose up -d

echo Waiting for PostgreSQL...
timeout /t 5 /nobreak >nul

echo Checking connection...
docker exec pp-gordeev-voice-ka-postgres pg_isready -U postgres

echo Creating .env file...
cd ..
if not exist .env (
    echo DATABASE_URL=postgres://gbilly_sysadmin:BillyJinn228@localhost:5433/Voice-ka_Local > .env
    echo .env created
)

echo Installing dependencies...
call npm install

echo.
echo Setup complete!
echo Run: npm run tauri dev
echo.
echo Note: Database migrations will run automatically when the app starts.
pause