#!/bin/bash
# Quick start script for WordPan Template
# This script starts all required services

set -e

echo "🚀 Starting WordPan Template..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   Windows: scoop install supabase"
    echo "   macOS: brew install supabase/tap/supabase"
    echo "   Or visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Start Supabase
echo "📦 Starting Supabase..."
supabase start

# Wait a bit for Supabase to be ready
echo "⏳ Waiting for Supabase to be ready..."
sleep 5

# Start Docker services
echo "🐳 Starting Docker services..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Checking service status..."
docker compose ps

echo ""
echo "✅ All services started!"
echo ""
echo "🌐 Services available at:"
echo "   - Web App: http://localhost:5173"
echo "   - AI Service: http://localhost:8000"
echo "   - Phoenix: http://localhost:6006"
echo "   - Supabase Studio: http://127.0.0.1:54323"
echo ""
echo "To stop all services, run: ./stop.sh"