-- Создание пользователя приложения
CREATE USER gbilly_sysadmin WITH PASSWORD 'BillyJinn228' CREATEDB;

-- Создание базы данных
CREATE DATABASE "Voice-ka_Local" OWNER gbilly_sysadmin;

-- Настройка прав
GRANT ALL PRIVILEGES ON DATABASE "Voice-ka_Local" TO gbilly_sysadmin;

-- Подключение к базе и настройка схемы
\c "Voice-ka_Local"
GRANT ALL ON SCHEMA public TO gbilly_sysadmin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gbilly_sysadmin;