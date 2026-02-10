# Stop script for WordPan Template (PowerShell)

Write-Host "🛑 Stopping WordPan Template services..." -ForegroundColor Yellow

# Stop Docker services
Write-Host "🐳 Stopping Docker services..." -ForegroundColor Cyan
docker compose down

# Stop Supabase (optional - comment out if you want to keep it running)
$supabasePath = "C:\Users\user\scoop\shims\supabase.exe"
if (Test-Path $supabasePath) {
    Write-Host "📦 Stopping Supabase..." -ForegroundColor Cyan
    & $supabasePath stop
}

Write-Host ""
Write-Host "✅ All services stopped!" -ForegroundColor Green