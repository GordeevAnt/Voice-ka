#!/bin/bash

echo "🚀 Настройка окружения разработки Voice-ka"

# Запуск Docker контейнера с PostgreSQL
echo "📦 Запуск PostgreSQL в Docker..."
docker-compose up -d

# Ожидание запуска
echo "⏳ Ожидание запуска PostgreSQL..."
sleep 5

# Проверка подключения
echo "🔌 Проверка подключения..."
docker exec voice-ka-postgres pg_isready -U postgres

# Создание .env файла если не существует
if [ ! -f .env ]; then
    echo "📝 Создание .env файла..."
    cat > .env << EOF
DATABASE_URL=postgres://gbilly_sysadmin:BillyJinn228@localhost:5432/Voice-ka_Local
ADMIN_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
EOF
fi

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install

# Запуск миграций
echo "🔄 Запуск миграций..."
cargo run --bin migrate

echo "✅ Готово! Запустите npm run tauri dev"