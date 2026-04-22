#!/bin/bash

echo "🗑️ Voice-ka - Reset Database"
echo "============================"
echo ""

read -p "⚠️  This will DELETE ALL DATA! Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

cd "$(dirname "$0")"

echo "🗑️  Stopping and removing container..."
docker compose down -v

echo "🔨 Starting fresh..."
docker compose up -d

echo "⏳ Waiting for PostgreSQL..."
sleep 5

echo "✅ Database reset complete!"
echo "   Run migrations: cargo run --bin migrate"