# Setup and verify: Supabase (migrations), Docker, health checks.
# Run from repo root: .\scripts\setup-and-verify.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$root\supabase")) { $root = (Get-Location).Path }
Set-Location $root

Write-Host "=== 1. Supabase (local) ===" -ForegroundColor Cyan
# Apply migrations (Supabase must be running: run 'supabase start' once if needed)
Write-Host "Applying migrations (supabase migration up)..." -ForegroundColor Yellow
$out = cmd /c "supabase migration up 2>&1"
$out | Where-Object { $_ -notmatch "new version of Supabase CLI" -and $_ -notmatch "We recommend updating" } | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Host "If Supabase is not running, start it first: supabase start" -ForegroundColor Yellow
    throw "supabase migration up failed"
}
Write-Host "Supabase migrations OK" -ForegroundColor Green

Write-Host "`n=== 2. Docker Compose ===" -ForegroundColor Cyan
& docker compose up -d --wait
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose up failed" }
Write-Host "Containers OK" -ForegroundColor Green

Write-Host "`n=== 3. Health checks ===" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -ErrorAction SilentlyContinue
if ($health.status -eq "healthy") { Write-Host "AI backend (8000): OK" -ForegroundColor Green } else { Write-Host "AI backend: FAIL" -ForegroundColor Red }
$web = Invoke-WebRequest -Uri "http://localhost:5173/" -Method Get -UseBasicParsing -ErrorAction SilentlyContinue
if ($web.StatusCode -eq 200) { Write-Host "Web (5173): OK" -ForegroundColor Green } else { Write-Host "Web: FAIL" -ForegroundColor Red }
try {
    $chat = Invoke-WebRequest -Uri "http://localhost:5173/api/chat" -Method Post -Body '{"message":"x"}' -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    Write-Host "API /api/chat: got $($chat.StatusCode) (expected 401 without auth)" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) { Write-Host "API /api/chat (401 without auth): OK" -ForegroundColor Green }
    else { Write-Host "API /api/chat: $($_.Exception.Message)" -ForegroundColor Yellow }
}

Write-Host "`nDone. Open http://localhost:5173 and log in. Chat: http://localhost:5173/chat" -ForegroundColor Cyan
