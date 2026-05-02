-- Таблица Пользователи
CREATE TABLE IF NOT EXISTS users
(
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(512),
    status VARCHAR(20) DEFAULT 'offline',
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    audio_settings JSONB DEFAULT '{}',
    video_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ADD CONSTRAINT users_status_check 
    CHECK (status IN ('online', 'idle', 'dnd', 'offline'));

-- Таблица Каталог прав
CREATE TABLE IF NOT EXISTS permissions_catalog
(
    id INTEGER PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL
);
ALTER TABLE permissions_catalog ADD CONSTRAINT permissions_catalog_category_check 
    CHECK (category IN ('general', 'text', 'voice', 'video', 'admin'));

-- Таблица Каналы
CREATE TABLE IF NOT EXISTS guilds
(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(512),
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Пользователи канала
CREATE TABLE IF NOT EXISTS guild_members
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    nickname VARCHAR(32),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, guild_id)
);

-- Таблица Роли
CREATE TABLE IF NOT EXISTS roles
(
    id SERIAL PRIMARY KEY,
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#99AAB5',
    position INTEGER DEFAULT 0,
    hoist BOOLEAN DEFAULT FALSE,
    permissions BIGINT DEFAULT 0,
    is_mentionable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Роли пользователя
CREATE TABLE IF NOT EXISTS member_roles
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id, guild_id)
);

-- Таблица Комнаты
CREATE TABLE IF NOT EXISTS rooms
(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    guild_id INTEGER REFERENCES guilds(id) ON DELETE CASCADE,
    topic TEXT,
    position INTEGER DEFAULT 0,
    bitrate INTEGER DEFAULT 64000,
    user_limit INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rooms ADD CONSTRAINT rooms_type_check 
    CHECK (type IN ('text', 'voice', 'video', 'dm'));

-- Таблица Права внутри комнаты
CREATE TABLE IF NOT EXISTS role_room_overrides
(
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    allow_permissions BIGINT DEFAULT 0,
    deny_permissions BIGINT DEFAULT 0,
    UNIQUE(role_id, room_id)
);

-- Таблица Личные сообщения
CREATE TABLE IF NOT EXISTS dm_participants
(
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(room_id, user_id)
);

-- Таблица Пресеты голоса
CREATE TABLE IF NOT EXISTS voice_presets
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    effects JSONB NOT NULL,
    is_global BOOLEAN DEFAULT FALSE,
    guild_id INTEGER REFERENCES guilds(id) ON DELETE CASCADE,
    icon VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Состояния голоса
CREATE TABLE IF NOT EXISTS voice_states
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    session_id UUID NOT NULL DEFAULT gen_random_uuid(),
    active_preset_id INTEGER REFERENCES voice_presets(id) ON DELETE SET NULL,
    custom_effects JSONB DEFAULT '{}',
    is_muted BOOLEAN DEFAULT FALSE,
    is_deafened BOOLEAN DEFAULT FALSE,
    is_streaming BOOLEAN DEFAULT FALSE,
    is_video_enabled BOOLEAN DEFAULT FALSE,
    bitrate INTEGER DEFAULT 64000,
    audio_energy REAL DEFAULT 0.0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Сообщения
CREATE TABLE IF NOT EXISTS messages
(
    id BIGSERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Таблица Логи голосовой активности
CREATE TABLE IF NOT EXISTS voice_activity_logs
(
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (left_at - joined_at))) STORED,
    packets_sent BIGINT DEFAULT 0,
    packets_lost BIGINT DEFAULT 0,
    avg_bitrate INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Плейлисты
CREATE TABLE IF NOT EXISTS playlists
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    guild_id INTEGER REFERENCES guilds(id) ON DELETE CASCADE,
    cover_art VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Треки плейлиста
CREATE TABLE IF NOT EXISTS playlist_tracks
(
    id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_name VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    file_url VARCHAR(512) NOT NULL,
    duration INTEGER,
    position INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Музыкальные боты
CREATE TABLE IF NOT EXISTS music_bots
(
    id SERIAL PRIMARY KEY,
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    current_playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
    current_track_id INTEGER REFERENCES playlist_tracks(id) ON DELETE SET NULL,
    current_position INTEGER DEFAULT 0,
    is_playing BOOLEAN DEFAULT FALSE,
    is_paused BOOLEAN DEFAULT FALSE,
    volume REAL DEFAULT 1.0,
    loop_mode VARCHAR(20) DEFAULT 'none',
    shuffle BOOLEAN DEFAULT FALSE,
    queue JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE music_bots ADD CONSTRAINT music_bots_loop_mode_check 
    CHECK (loop_mode IN ('none', 'track', 'playlist'));

-- Таблица Звуки уведомлений
CREATE TABLE IF NOT EXISTS notification_sounds
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id INTEGER REFERENCES guilds(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    sound_file VARCHAR(512),
    volume REAL DEFAULT 1.0,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, guild_id, event_type)
);
ALTER TABLE notification_sounds ADD CONSTRAINT notification_sounds_event_type_check 
    CHECK (event_type IN ('message', 'mention', 'join', 'leave', 'call'));

-- Таблица Сессии вебсокет
CREATE TABLE IF NOT EXISTS websocket_sessions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    ip_address INET,
    user_agent TEXT,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    UNIQUE(user_id, connection_id)
);
ALTER TABLE websocket_sessions ADD CONSTRAINT websocket_sessions_status_check 
    CHECK (status IN ('active', 'closing', 'closed'));

-- Таблица Аудит-логи
CREATE TABLE IF NOT EXISTS audit_logs
(
    id BIGSERIAL PRIMARY KEY,
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    target_id INTEGER,
    changes JSONB DEFAULT '{}',
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Приглашения
CREATE TABLE IF NOT EXISTS invites
(
    id SERIAL PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_uses INTEGER DEFAULT 0,
    uses INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);