# Quick start script for WordPan Template (PowerShell)
# This script starts all required services

Write-Host "🚀 Starting WordPan Template..." -ForegroundColor Green

# Check if Supabase CLI is installed
$supabasePath = "C:\Users\user\scoop\shims\supabase.exe"
if (-not (Test-Path $supabasePath)) {
    Write-Host "❌ Supabase CLI not found at $supabasePath" -ForegroundColor Red
    Write-Host "Please install Supabase CLI first:" -ForegroundColor Yellow
    Write-Host "   scoop install supabase" -ForegroundColor Yellow
    Write-Host "   Or visit: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

# Start Supabase
Write-Host "📦 Starting Supabase..." -ForegroundColor Cyan
& $supabasePath start

# Wait a bit for Supabase to be ready
Write-Host "⏳ Waiting for Supabase to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start Docker services
Write-Host "🐳 Starting Docker services..." -ForegroundColor Cyan
docker compose up -d

# Wait for services to be healthy
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host "📊 Checking service status..." -ForegroundColor Cyan
docker compose ps

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Services available at:" -ForegroundColor Cyan
Write-Host "   - Web App: http://localhost:5173"
Write-Host "   - AI Service: http://localhost:8000"
Write-Host "   - Phoenix: http://localhost:6006"
Write-Host "   - Supabase Studio: http://127.0.0.1:54323"
Write-Host ""
Write-Host "To stop all services, run: .\stop.ps1" -ForegroundColor Yellow