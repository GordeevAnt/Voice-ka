# Voice-ka Reset Database Script for Windows

Write-Host "🗑️ Voice-ka - Reset Database" -ForegroundColor Red
Write-Host "============================" -ForegroundColor Red
Write-Host ""

$response = Read-Host "⚠️  This will DELETE ALL DATA! Are you sure? (y/N)"
if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit 0
}

Set-Location $PSScriptRoot

Write-Host "🗑️  Stopping and removing container..." -ForegroundColor Yellow
docker compose down -v

Write-Host "🔨 Starting fresh..." -ForegroundColor Yellow
docker compose up -d

Write-Host "⏳ Waiting for PostgreSQL..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "✅ Database reset complete!" -ForegroundColor Green
Write-Host "   Run migrations: cargo run --bin migrate" -ForegroundColor Cyan