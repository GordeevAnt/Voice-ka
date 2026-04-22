#!/bin/bash

echo "🚀 Voice-ka - Setup Development Environment"
echo "==========================================="
echo ""

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found! Please install Docker first."
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Запуск PostgreSQL
echo "📦 Starting PostgreSQL..."
cd "$(dirname "$0")"
docker compose up -d

# Ожидание готовности БД
echo "⏳ Waiting for PostgreSQL..."
sleep 5

# Проверка
echo "🔌 Checking connection..."
docker exec pp-gordeev-voice-ka-postgres pg_isready -U postgres

# Создание .env в корне проекта
cd ../..
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
DATABASE_URL=postgres://gbilly_sysadmin:BillyJinn228@localhost:5432/Voice-ka_Local
EOF
    echo "✅ .env created"
fi

# Установка зависимостей
echo "📦 Installing dependencies..."
npm install

# Запуск миграций
echo "🔄 Running migrations..."
cargo run --bin migrate

echo ""
echo "✅ Setup complete!"
echo "   Run: npm run tauri dev"