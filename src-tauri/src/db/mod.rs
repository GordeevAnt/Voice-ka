// src-tauri/src/db/mod.rs
use sqlx::postgres::{PgPoolOptions};
use sqlx::{PgPool, Executor};
use std::sync::OnceLock;

// Глобальный пул соединений
static DB_POOL: OnceLock<PgPool> = OnceLock::new();

/// Выполняет миграции из SQL-файла
async fn run_migration_script(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Читаем SQL-файл миграции
    let migration_sql = include_str!("../../../migrations/001_initial_schema.sql");
    
    println!("🔄 Выполнение миграций базы данных...");
    
    // Разбиваем SQL на отдельные statements
    let statements: Vec<&str> = migration_sql
        .split(';')
        .filter(|s| !s.trim().is_empty())
        .collect();
    
    let mut success_count = 0;
    let mut error_count = 0;
    
    for statement in statements {
        let trimmed = statement.trim();
        if trimmed.is_empty() {
            continue;
        }
        
        // Добавляем точку с запятой обратно для выполнения
        let stmt_with_semicolon = format!("{};", trimmed);
        
        match pool.execute(stmt_with_semicolon.as_str()).await {
            Ok(result) => {
                success_count += 1;
                if result.rows_affected() > 0 {
                    println!("  ✓ Выполнен запрос (затронуто {} строк)", result.rows_affected());
                }
            }
            Err(e) => {
                let error_msg = e.to_string();
                // Пропускаем различные типы ошибок "already exists"
                if error_msg.contains("already exists") 
                    || error_msg.contains("duplicate") 
                    || error_msg.contains("already defined")
                    || (error_msg.contains("relation") && error_msg.contains("already exists")) { // ИСПРАВЛЕНО: добавлены скобки
                    println!("  ⚠️ Пропущен дублирующий объект: {}", error_msg);
                    error_count += 1;
                } else {
                    println!("  ✗ Ошибка: {}", error_msg);
                    return Err(Box::new(e));
                }
            }
        }
    }
    
    println!("✅ Миграции выполнены (успешно: {}, пропущено: {})", success_count, error_count);
    
    Ok(())
}

/// Проверяет, нужно ли очищать таблицы (по умолчанию да, можно отключить через env)
async fn should_clear_data() -> bool {
    std::env::var("SKIP_DB_CLEAR")
        .ok()
        .map(|v| v.to_lowercase() != "true")
        .unwrap_or(true)
}

/// Проверяет, нужно ли заполнять тестовыми данными
async fn should_seed_data() -> bool {
    std::env::var("SKIP_DB_SEED")
        .ok()
        .map(|v| v.to_lowercase() != "true")
        .unwrap_or(true)
}

/// Очищает все таблицы от существующих данных
async fn clear_all_tables(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    if !should_clear_data().await {
        println!("⏭️ Пропуск очистки данных (SKIP_DB_CLEAR=true)");
        return Ok(());
    }
    
    println!("🧹 Очистка существующих данных из таблиц...");
    
    // Получаем все таблицы в правильном порядке (сначала зависимые)
    let tables = vec![
        "websocket_sessions",
        "voice_activity_logs",
        "voice_states",
        "member_roles",
        "role_room_overrides",
        "dm_participants",
        "messages",
        "playlist_tracks",
        "music_bots",
        "notification_sounds",
        "audit_logs",
        "invites",
        "voice_presets",
        "playlists",
        "guild_members",
        "roles",
        "rooms",
        "guilds",
        "permissions_catalog",
        "users",
    ];
    
    // Отключаем проверку внешних ключей
    sqlx::query("SET CONSTRAINTS ALL DEFERRED")
        .execute(pool)
        .await?;
    
    for table in tables {
        let delete_query = format!("DELETE FROM {}", table);
        match sqlx::query(delete_query.as_str()).execute(pool).await {
            Ok(result) => {
                println!("  → Очищена таблица {} (удалено {} записей)", table, result.rows_affected());
            }
            Err(e) => {
                println!("  ⚠️ Не удалось очистить таблицу {}: {}", table, e);
            }
        }
    }
    
    // Сброс всех последовательностей (sequences)
    println!("  → Сброс последовательностей...");
    let sequences_query = "
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    ";
    
    let sequences: Vec<(String,)> = sqlx::query_as(sequences_query)
        .fetch_all(pool)
        .await?;
    
    for (sequence_name,) in sequences {
        let reset_query = format!("ALTER SEQUENCE {} RESTART WITH 1", sequence_name);
        if let Err(e) = sqlx::query(reset_query.as_str()).execute(pool).await {
            println!("  ⚠️ Не удалось сбросить последовательность {}: {}", sequence_name, e);
        }
    }
    
    println!("✅ Все таблицы очищены, последовательности сброшены");
    
    Ok(())
}

/// Заполняет базу данных тестовыми данными
async fn seed_database(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    if !should_seed_data().await {
        println!("⏭️ Пропуск заполнения тестовыми данными (SKIP_DB_SEED=true)");
        return Ok(());
    }
    
    // Проверяем, есть ли уже данные
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    
    if user_count.0 > 0 {
        println!("ℹ️ В базе уже есть данные (пользователей: {}), пропускаем заполнение", user_count.0);
        return Ok(());
    }
    
    println!("🌱 Заполнение базы данных тестовыми данными...");
    
    // 1. Пользователи
    println!("  → Добавление пользователей...");
    sqlx::query(
        r#"
        INSERT INTO users (id, username, email, password_hash, avatar, status, last_seen, audio_settings, video_settings, created_at, updated_at)
        VALUES 
            (1, 'alex_kot', 'alex@example.com', '$argon2id$v=19$m=19456,t=2,p=1$dcDIVhmutBhzylxDzxLh9A$bCXJcw/9gQPyn8qsEcbwscCgbiBwWip58/xCM2IS+Zw', '/avatars/1.jpg', 'offline', '2025-04-17 10:30:00+00', '{"input_device": "Microphone", "noise_suppression": true}'::jsonb, '{"camera": "HD", "fps": 30}'::jsonb, '2024-01-15 12:00:00+00', '2025-04-17 10:30:00+00'),
            (2, 'dj_max', 'max@example.com', '$argon2id$v=19$m=19456,t=2,p=1$VDLoFeT9CEM++wPPlxrdDw$ZBJMvIxmbLORR+c0u4Qdh2xhiKlWikQX3tJp29/bE8U', '/avatars/2.jpg', 'offline', '2025-04-17 09:15:00+00', '{"output_device": "Speakers", "volume": 0.8}'::jsonb, '{"camera": "4K", "fps": 60}'::jsonb, '2024-02-20 14:30:00+00', '2025-04-17 09:15:00+00'),
            (3, 'lena_voise', 'lena@example.com', '$argon2id$v=19$m=19456,t=2,p=1$17z1g6Z4jkK3mv1EYoFwcQ$6E6pz2oAaK3067c21gaDK2lmQo8oaogpWfdL+aEEAQU', '/avatars/3.jpg', 'offline', '2025-04-17 11:00:00+00', '{"input_device": "Headset", "echo_cancellation": true}'::jsonb, '{"camera": "1080p", "fps": 30}'::jsonb, '2024-03-10 09:00:00+00', '2025-04-17 11:00:00+00'),
            (4, 'admin_serg', 'serg@example.com', '$argon2id$v=19$m=19456,t=2,p=1$6hhQbAtYB6MiboyKWPtwgQ$jf3XYBMXvXlKMmv9bMV6737cdpchwYkEl4evESsxp5A', '/avatars/4.jpg', 'offline', '2025-04-16 22:00:00+00', '{"input_device": "USB Mic"}'::jsonb, '{"camera": "Logitech C920"}'::jsonb, '2024-01-05 16:20:00+00', '2025-04-16 22:00:00+00'),
            (5, 'guest_oleg', 'oleg@example.com', '$argon2id$v=19$m=19456,t=2,p=1$UTIsjnqh4OvKSg+tazItiA$GC/O2mWk+zF61+v4mjety1PljjyIekynA9r3yGTIbVY', NULL, 'offline', '2025-04-15 18:45:00+00', '{}'::jsonb, '{}'::jsonb, '2024-04-12 10:10:00+00', '2025-04-15 18:45:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 2. Серверы
    println!("  → Добавление серверов...");
    sqlx::query(
        r#"
        INSERT INTO guilds (id, name, icon, owner_id, description, created_at, updated_at)
        VALUES 
            (1, 'Voice-ka', NULL, 1, 'Начальный сервер', '2024-01-20 12:00:00+00', '2025-04-10 15:00:00+00'),
            (2, 'Music Hub', NULL, 2, 'Музыкальный сервер', '2024-02-25 18:30:00+00', '2025-04-12 20:00:00+00'),
            (3, 'Ale', NULL, 3, 'ALE Barmale', '2024-02-25 18:30:00+00', '2025-04-12 20:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 3. Участники серверов
    println!("  → Добавление участников серверов...");
    sqlx::query(
        r#"
        INSERT INTO guild_members (id, user_id, guild_id, nickname, joined_at)
        VALUES 
            (1, 1, 1, 'AlexPro', '2024-01-20 12:05:00+00'),
            (2, 2, 2, 'DJ_Max', '2024-02-25 18:35:00+00'),
            (3, 3, 1, 'LenaVoice', '2024-03-01 09:00:00+00'),
            (4, 4, 1, 'SergAdmin', '2024-01-20 12:10:00+00'),
            (5, 5, 2, 'OlegListener', '2024-04-15 20:00:00+00'),
            (6, 1, 2, 'AlexPro', '2024-01-20 12:05:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 4. Роли
    println!("  → Добавление ролей...");
    sqlx::query(
        r#"
        INSERT INTO roles (id, guild_id, name, color, position, permissions, hoist, is_mentionable, created_at, updated_at)
        VALUES 
            (1, 1, 'Admin', '#FF0000', 100, 2147483647, true, true, '2024-01-20 12:00:00+00', '2024-01-20 12:00:00+00'),
            (2, 1, 'Moderator', '#00FF00', 50, 268435456, true, true, '2024-01-20 12:00:00+00', '2024-01-20 12:00:00+00'),
            (3, 2, 'VIP', '#FFD700', 30, 0, true, true, '2024-02-25 18:30:00+00', '2024-02-25 18:30:00+00'),
            (4, 2, '@everyone', '#99AAB5', 0, 0, false, false, '2024-02-25 18:30:00+00', '2024-02-25 18:30:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 5. Назначение ролей
    println!("  → Назначение ролей пользователям...");
    sqlx::query(
        r#"
        INSERT INTO member_roles (id, user_id, role_id, guild_id)
        VALUES 
            (1, 4, 1, 1),
            (2, 1, 2, 1),
            (3, 3, 2, 1),
            (4, 2, 3, 2),
            (5, 5, 4, 2)
        "#
    )
    .execute(pool)
    .await?;

    // 6. Комнаты
    println!("  → Добавление комнат...");
    sqlx::query(
        r#"
        INSERT INTO rooms (id, name, type, guild_id, topic, position, bitrate, user_limit, created_at, updated_at)
        VALUES 
            (1, 'General Chat', 'text', 1, 'Общий чат', 10, NULL, 0, '2024-01-20 12:00:00+00', '2024-01-20 12:00:00+00'),
            (2, 'Voice Lounge', 'voice', 1, 'Голосовой чат', 20, 96000, 10, '2024-01-20 12:00:00+00', '2024-01-20 12:00:00+00'),
            (3, 'Music Room', 'voice', 2, 'Музыкальный бот', 5, 128000, 20, '2024-02-25 18:30:00+00', '2024-02-25 18:30:00+00'),
            (4, 'Video Studio', 'video', 1, 'Стримы и видео', 30, 256000, 5, '2024-03-10 14:00:00+00', '2024-03-10 14:00:00+00'),
            (5, 'DM Alex-Lena', 'dm', NULL, 'Личный чат', 0, NULL, 0, '2024-04-01 10:00:00+00', '2024-04-01 10:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 7. Переопределение прав в комнатах
    println!("  → Добавление переопределений прав...");
    sqlx::query(
        r#"
        INSERT INTO role_room_overrides (id, role_id, room_id, allow_permissions, deny_permissions)
        VALUES 
            (1, 1, 2, 8, 0),
            (2, 2, 4, 16, 0),
            (3, 3, 3, 4, 0),
            (4, 4, 3, 0, 4),
            (5, 2, 1, 2, 0)
        "#
    )
    .execute(pool)
    .await?;

    // 8. Участники DM
    println!("  → Добавление участников DM...");
    sqlx::query(
        r#"
        INSERT INTO dm_participants (id, room_id, user_id)
        VALUES 
            (1, 5, 1),
            (2, 5, 3),
            (3, 1, 1),
            (4, 1, 2),
            (5, 2, 3)
        "#
    )
    .execute(pool)
    .await?;

    // 9. Голосовые пресеты
    println!("  → Добавление голосовых пресетов...");
    sqlx::query(
        r#"
        INSERT INTO voice_presets (id, user_id, name, effects, is_global, guild_id, icon, created_at, updated_at)
        VALUES 
            (1, 1, 'Robot', '{"pitch": 1.5, "distortion": 0.8}'::jsonb, true, 1, '/presets/1.png', '2024-05-01 10:00:00+00', '2024-05-01 10:00:00+00'),
            (2, 2, 'Bass Boost', '{"bass": 1.2, "treble": 0.5}'::jsonb, false, NULL, NULL, '2024-05-02 11:00:00+00', '2024-05-02 11:00:00+00'),
            (3, 3, 'Echo', '{"echo": 0.7, "delay": 0.3}'::jsonb, true, 2, '/presets/3.png', '2024-05-03 12:00:00+00', '2024-05-03 12:00:00+00'),
            (4, 4, 'Chipmunk', '{"pitch": 2.0, "formant": 1.2}'::jsonb, true, 1, '/presets/4.png', '2024-05-04 13:00:00+00', '2024-05-04 13:00:00+00'),
            (5, 5, 'Deep Voice', '{"pitch": 0.7, "reverb": 0.4}'::jsonb, false, NULL, NULL, '2024-05-05 14:00:00+00', '2024-05-05 14:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 10. Голосовые состояния
    println!("  → Добавление голосовых состояний...");
    sqlx::query(
        r#"
        INSERT INTO voice_states (id, user_id, room_id, session_id, active_preset_id, custom_effects, is_muted, is_deafened, is_streaming, is_video_enabled, bitrate, audio_energy, joined_at, created_at)
        VALUES 
            (1, 1, 2, '11111111-1111-1111-1111-111111111111', 1, '{}'::jsonb, false, false, false, false, 96000, 0.75, '2025-04-17 10:00:00+00', '2025-04-17 10:00:00+00'),
            (2, 3, 2, '22222222-2222-2222-2222-222222222222', NULL, '{"pitch":1.1}'::jsonb, true, false, false, false, 96000, 0.00, '2025-04-17 09:30:00+00', '2025-04-17 09:30:00+00'),
            (3, 2, 3, '33333333-3333-3333-3333-333333333333', 2, '{}'::jsonb, false, false, true, false, 128000, 0.90, '2025-04-17 10:15:00+00', '2025-04-17 10:15:00+00'),
            (4, 4, 4, '44444444-4444-4444-4444-444444444444', 4, '{}'::jsonb, false, false, true, true, 256000, 0.85, '2025-04-17 09:00:00+00', '2025-04-17 09:00:00+00'),
            (5, 5, 3, '55555555-5555-5555-5555-555555555555', NULL, '{}'::jsonb, true, true, false, false, 64000, 0.00, '2025-04-16 20:00:00+00', '2025-04-16 20:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 11. Сообщения
    println!("  → Добавление сообщений...");
    sqlx::query(
        r#"
        INSERT INTO messages (id, room_id, user_id, content, attachments, reply_to_id, created_at)
        VALUES 
            (1, 1, 1, 'Всем привет!', '[]'::jsonb, NULL, '2025-04-17 10:05:00+00'),
            (2, 1, 3, 'Привет, как дела?', '[]'::jsonb, 1, '2025-04-17 10:06:00+00'),
            (3, 3, 2, 'Сейчас поставлю трек', '[{"url":"/music/track1.mp3","type":"audio"}]'::jsonb, NULL, '2025-04-17 10:20:00+00'),
            (4, 4, 4, 'Начинаем стрим!', '[{"url":"/video/stream1.m3u8","type":"hls"}]'::jsonb, NULL, '2025-04-17 09:05:00+00'),
            (5, 5, 1, 'Личное сообщение', '[]'::jsonb, NULL, '2025-04-17 11:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 12. Логи голосовой активности
    println!("  → Добавление логов голосовой активности...");
    sqlx::query(
        r#"
        INSERT INTO voice_activity_logs (id, user_id, room_id, session_id, joined_at, left_at, packets_sent, packets_lost, avg_bitrate, created_at)
        VALUES 
            (1, 1, 2, '11111111-1111-1111-1111-111111111111', '2025-04-16 20:00:00+00', '2025-04-16 21:30:00+00', 324000, 1200, 95000, '2025-04-16 21:35:00+00'),
            (2, 3, 2, '22222222-2222-2222-2222-222222222222', '2025-04-16 19:00:00+00', '2025-04-16 20:15:00+00', 270000, 800, 94000, '2025-04-16 20:20:00+00'),
            (3, 2, 3, '33333333-3333-3333-3333-333333333333', '2025-04-16 21:00:00+00', '2025-04-16 22:00:00+00', 216000, 500, 127000, '2025-04-16 22:05:00+00'),
            (4, 4, 4, '44444444-4444-4444-4444-444444444444', '2025-04-16 18:00:00+00', '2025-04-16 19:30:00+00', 324000, 1500, 255000, '2025-04-16 19:35:00+00'),
            (5, 5, 3, '55555555-5555-5555-5555-555555555555', '2025-04-16 20:00:00+00', '2025-04-16 20:45:00+00', 162000, 300, 63000, '2025-04-16 20:50:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 13. Плейлисты
    println!("  → Добавление плейлистов...");
    sqlx::query(
        r#"
        INSERT INTO playlists (id, user_id, name, description, is_public, guild_id, cover_art, created_at, updated_at)
        VALUES 
            (1, 1, 'Gaming Mix', 'Для игр', true, 1, '/covers/1.jpg', '2024-05-10 12:00:00+00', '2024-05-10 12:00:00+00'),
            (2, 2, 'Top Hits', 'Популярные треки', true, 2, '/covers/2.jpg', '2024-05-11 13:00:00+00', '2024-05-11 13:00:00+00'),
            (3, 3, 'Chill', 'Релакс', false, NULL, '/covers/3.jpg', '2024-05-12 14:00:00+00', '2024-05-12 14:00:00+00'),
            (4, 4, 'Rock Classic', 'Рок хиты', true, 1, '/covers/4.jpg', '2024-05-13 15:00:00+00', '2024-05-13 15:00:00+00'),
            (5, 5, 'My Favorites', 'Личное', false, NULL, NULL, '2024-05-14 16:00:00+00', '2024-05-14 16:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 14. Треки плейлистов
    println!("  → Добавление треков...");
    sqlx::query(
        r#"
        INSERT INTO playlist_tracks (id, playlist_id, track_name, artist, file_url, duration, position, metadata, created_at)
        VALUES 
            (1, 1, 'Cyberpunk 2077', 'P.T. Adamczyk', '/music/cyberpunk.mp3', 240, 1, '{"album": "Cyberpunk 2077", "year": 2020}'::jsonb, '2024-05-10 12:05:00+00'),
            (2, 1, 'The Witcher 3', 'Marcin Przybyłowicz', '/music/witcher.mp3', 210, 2, '{"album": "The Witcher 3"}'::jsonb, '2024-05-10 12:06:00+00'),
            (3, 2, 'Blinding Lights', 'The Weeknd', '/music/blinding.mp3', 200, 1, '{"album": "After Hours"}'::jsonb, '2024-05-11 13:05:00+00'),
            (4, 3, 'Weightless', 'Marconi Union', '/music/weightless.mp3', 480, 1, '{"album": "Weightless"}'::jsonb, '2024-05-12 14:05:00+00'),
            (5, 4, 'Bohemian Rhapsody', 'Queen', '/music/bohemian.mp3', 355, 1, '{"album": "A Night at the Opera"}'::jsonb, '2024-05-13 15:05:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 15. Музыкальные боты
    println!("  → Добавление музыкальных ботов...");
    sqlx::query(
        r#"
        INSERT INTO music_bots (id, guild_id, room_id, current_playlist_id, current_track_id, current_position, is_playing, is_paused, volume, loop_mode, shuffle, queue, created_at, updated_at)
        VALUES 
            (1, 1, 2, 1, 1, 120, true, false, 1.0, 'none', false, '[]'::jsonb, '2024-06-01 10:00:00+00', '2025-04-17 10:30:00+00'),
            (2, 2, 3, 2, 3, 45, true, false, 0.8, 'track', false, '[]'::jsonb, '2024-06-02 11:00:00+00', '2025-04-17 10:20:00+00'),
            (3, 1, 4, 4, 5, 0, false, false, 1.2, 'none', true, '[{"id":2,"name":"The Witcher 3"}]'::jsonb, '2024-06-03 12:00:00+00', '2025-04-16 18:00:00+00'),
            (4, 1, 1, NULL, NULL, 0, false, false, 1.0, 'none', false, '[]'::jsonb, '2024-06-04 13:00:00+00', '2024-06-04 13:00:00+00'),
            (5, 2, 2, NULL, NULL, 0, false, false, 1.0, 'none', false, '[]'::jsonb, '2024-06-05 14:00:00+00', '2024-06-05 14:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 16. Звуковые уведомления
    println!("  → Добавление звуковых уведомлений...");
    sqlx::query(
        r#"
        INSERT INTO notification_sounds (id, user_id, guild_id, event_type, sound_file, volume, is_enabled, created_at, updated_at)
        VALUES 
            (1, 1, 1, 'message', '/sounds/ping.wav', 1.0, true, '2024-07-01 10:00:00+00', '2024-07-01 10:00:00+00'),
            (2, 1, 1, 'mention', '/sounds/ding.wav', 1.5, true, '2024-07-01 10:00:00+00', '2024-07-01 10:00:00+00'),
            (3, 2, NULL, 'call', '/sounds/ring.wav', 0.8, true, '2024-07-02 11:00:00+00', '2024-07-02 11:00:00+00'),
            (4, 3, 2, 'join', NULL, 1.0, false, '2024-07-03 12:00:00+00', '2024-07-03 12:00:00+00'),
            (5, 4, 1, 'leave', '/sounds/bye.wav', 0.7, true, '2024-07-04 13:00:00+00', '2024-07-04 13:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 17. WebSocket сессии
    println!("  → Добавление WebSocket сессий...");
    sqlx::query(
        r#"
        INSERT INTO websocket_sessions (id, user_id, connection_id, status, ip_address, user_agent, last_heartbeat, connected_at, disconnected_at)
        VALUES 
            ('aaa11111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'conn_1_abc', 'active', '192.168.1.10', 'Mozilla/5.0 (Windows)', '2025-04-17 10:30:00+00', '2025-04-17 08:00:00+00', NULL),
            ('bbb22222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 'conn_2_def', 'active', '192.168.1.20', 'Mozilla/5.0 (Macintosh)', '2025-04-17 10:29:00+00', '2025-04-17 09:00:00+00', NULL),
            ('ccc33333-cccc-cccc-cccc-cccccccccccc', 3, 'conn_3_ghi', 'active', '192.168.1.30', 'DiscordClient/1.0', '2025-04-17 10:28:00+00', '2025-04-17 07:30:00+00', NULL),
            ('ddd44444-dddd-dddd-dddd-dddddddddddd', 4, 'conn_4_jkl', 'closing', '192.168.1.40', 'Mozilla/5.0 (Linux)', '2025-04-17 09:00:00+00', '2025-04-17 06:00:00+00', NULL),
            ('eee55555-eeee-eeee-eeee-eeeeeeeeeeee', 5, 'conn_5_mno', 'closed', '192.168.1.50', 'CustomApp/2.0', '2025-04-16 22:00:00+00', '2025-04-16 18:00:00+00', '2025-04-16 22:30:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 18. Справочник прав
    println!("  → Добавление справочника прав...");
    sqlx::query(
        r#"
        INSERT INTO permissions_catalog (id, code, name, description, category)
        VALUES 
            (1, 'CREATE_INSTANT_INVITE', 'Создание приглашений', 'Пользователь может создавать приглашения', 'general'),
            (2, 'KICK_MEMBERS', 'Кик участников', 'Исключение участников с сервера', 'admin'),
            (3, 'MUTE_MEMBERS', 'Отключение микрофона', 'Отключать микрофон другим', 'voice'),
            (4, 'DEAFEN_MEMBERS', 'Отключение звука', 'Отключать звук другим', 'voice'),
            (5, 'MOVE_MEMBERS', 'Перемещать участников', 'Перемещать участников между комнатами', 'voice')
        "#
    )
    .execute(pool)
    .await?;

    // 19. Аудит-логи
    println!("  → Добавление аудит-логов...");
    sqlx::query(
        r#"
        INSERT INTO audit_logs (id, guild_id, user_id, action_type, target_id, changes, reason, created_at)
        VALUES 
            (1, 1, 4, 'MEMBER_KICK', 5, '{"before":{"role":"@everyone"},"after":null}'::jsonb, 'Нарушение правил', '2025-04-10 12:00:00+00'),
            (2, 1, 4, 'ROLE_CREATE', 2, '{"name":"Moderator","permissions":268435456}'::jsonb, 'Нужна модерация', '2024-01-20 12:05:00+00'),
            (3, 2, 2, 'CHANNEL_CREATE', 3, '{"name":"Music Room","type":"voice"}'::jsonb, 'Для музыки', '2024-02-25 18:30:00+00'),
            (4, 1, 4, 'MEMBER_MUTE', 3, '{"before":false,"after":true}'::jsonb, 'Спам в голосовом', '2025-04-15 15:00:00+00'),
            (5, 2, 2, 'PLAYLIST_ADD', 2, '{"playlist_name":"Top Hits"}'::jsonb, 'Добавлен плейлист', '2024-05-11 13:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    // 20. Приглашения
    println!("  → Добавление приглашений...");
    sqlx::query(
        r#"
        INSERT INTO invites (id, code, guild_id, room_id, inviter_id, max_uses, uses, expires_at, created_at)
        VALUES 
            (1, 'abc123xyz', 1, 1, 4, 10, 3, '2025-12-31 23:59:59+00', '2025-01-01 00:00:00+00'),
            (2, 'def456uvw', 2, 3, 2, 0, 5, NULL, '2025-02-01 00:00:00+00'),
            (3, 'ghi789rst', 1, 2, 1, 1, 1, '2025-06-01 00:00:00+00', '2025-03-01 00:00:00+00'),
            (4, 'jkl012mno', 2, 2, 2, 5, 0, '2025-07-01 00:00:00+00', '2025-04-01 00:00:00+00'),
            (5, 'pqr345stu', 1, 4, 4, 20, 2, '2025-08-01 00:00:00+00', '2025-04-15 00:00:00+00')
        "#
    )
    .execute(pool)
    .await?;

    println!("  → Обновление последовательностей...");
    // Обновляем последовательность для users (максимальный ID + 1)
    sqlx::query("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('guilds_id_seq', COALESCE((SELECT MAX(id) FROM guilds), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('guild_members_id_seq', COALESCE((SELECT MAX(id) FROM guild_members), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id) FROM roles), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('member_roles_id_seq', COALESCE((SELECT MAX(id) FROM member_roles), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('rooms_id_seq', COALESCE((SELECT MAX(id) FROM rooms), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('role_room_overrides_id_seq', COALESCE((SELECT MAX(id) FROM role_room_overrides), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('dm_participants_id_seq', COALESCE((SELECT MAX(id) FROM dm_participants), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('voice_presets_id_seq', COALESCE((SELECT MAX(id) FROM voice_presets), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('voice_states_id_seq', COALESCE((SELECT MAX(id) FROM voice_states), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('messages_id_seq', COALESCE((SELECT MAX(id) FROM messages), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('voice_activity_logs_id_seq', COALESCE((SELECT MAX(id) FROM voice_activity_logs), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('playlists_id_seq', COALESCE((SELECT MAX(id) FROM playlists), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('playlist_tracks_id_seq', COALESCE((SELECT MAX(id) FROM playlist_tracks), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('music_bots_id_seq', COALESCE((SELECT MAX(id) FROM music_bots), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('notification_sounds_id_seq', COALESCE((SELECT MAX(id) FROM notification_sounds), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs), 1))")
        .execute(pool)
        .await?;
    sqlx::query("SELECT setval('invites_id_seq', COALESCE((SELECT MAX(id) FROM invites), 1))")
        .execute(pool)
        .await?;

    println!("✅ База данных успешно заполнена тестовыми данными!");
    
    Ok(())
}

/// Инициализация базы данных с миграциями и тестовыми данными
pub async fn init_database() -> Result<(), Box<dyn std::error::Error>> {
    // Загружаем .env из правильного места
    let _ = dotenvy::from_filename("../.env");
    let _ = dotenvy::dotenv();
    
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL не установлена в .env файле");
    
    println!("🚀 Инициализация базы данных...");
    println!("📋 URL: {}", database_url);
    
    // ПРОСТО ПОДКЛЮЧАЕМСЯ - без создания пользователя
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .map_err(|e| {
            println!("❌ Не удалось подключиться к базе данных!");
            println!("💡 Убедитесь что Docker контейнер запущен:");
            println!("   cd setup && docker compose up -d");
            println!("");
            println!("Оригинальная ошибка: {}", e);
            e
        })?;
    
    println!("🔌 Подключение к базе данных установлено");
    
    // Создаем расширение UUID если его нет
    sqlx::query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
        .execute(&pool)
        .await?;
    
    // Выполняем миграции
    run_migration_script(&pool).await?;
    
    // Очищаем существующие данные (опционально)
    clear_all_tables(&pool).await?;
    
    // Заполняем тестовыми данными
    seed_database(&pool).await?;
    
    println!("🎉 База данных успешно инициализирована!");
    
    // Сохраняем пул в глобальной переменной
    DB_POOL.set(pool).unwrap();
    
    Ok(())
}

/// Получить глобальный пул соединений
pub fn get_db_pool() -> &'static PgPool {
    DB_POOL.get().expect("База данных не инициализирована")
}