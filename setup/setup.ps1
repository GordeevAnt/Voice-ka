# Voice-ka Setup Script for Windows

Write-Host "🚀 Voice-ka - Setup Development Environment" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker
$dockerCheck = docker --version 2>$null
if (-not $dockerCheck) {
    Write-Host "❌ Docker not found! Please install Docker Desktop first." -ForegroundColor Red
    Write-Host "   https://docs.docker.com/desktop/install/windows/" -ForegroundColor Yellow
    exit 1
}

# Start PostgreSQL
Write-Host "📦 Starting PostgreSQL..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose up -d

# Wait for DB
Write-Host "⏳ Waiting for PostgreSQL..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check connection
Write-Host "🔌 Checking connection..." -ForegroundColor Yellow
docker exec pp-gordeev-voice-ka-postgres pg_isready -U postgres

# Create .env in project root
Set-Location ../..
if (-not (Test-Path .env)) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    @"
DATABASE_URL=postgres://gbilly_sysadmin:BillyJinn228@localhost:5432/Voice-ka_Local
"@ | Out-File -FilePath .env -Encoding UTF8
    Write-Host "✅ .env created" -ForegroundColor Green
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Run migrations
Write-Host "🔄 Running migrations..." -ForegroundColor Yellow
cargo run --bin migrate

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host "   Run: npm run tauri dev" -ForegroundColor Cyan