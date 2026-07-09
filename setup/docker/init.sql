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

-- Выполнение миграции (создание таблиц)
\i /docker-entrypoint-initdb.d/02-schema.sql

-- Передаём владение всеми таблицами от postgres к gbilly_sysadmin
-- (т.к. миграция выполняется от postgres, таблицы создаются с владельцем postgres)
SELECT format('ALTER TABLE %I.%I OWNER TO gbilly_sysadmin;', schemaname, tablename)
FROM pg_tables
WHERE schemaname = 'public'
\gexec

-- Передаём владение всеми последовательностями
SELECT format('ALTER SEQUENCE %I.%I OWNER TO gbilly_sysadmin;', sequence_schema, sequence_name)
FROM information_schema.sequences
WHERE sequence_schema = 'public'
\gexec