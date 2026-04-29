// src-tauri/src/logic/guild.rs

use std::sync::Arc;

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use tauri::{State, command};
use crate::{db::get_db_pool, ws::{SubscriptionManager, WsMessage}};

/// Структура канала (гильдии) для передачи на фронтенд
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Guild {
    pub id: i32,
    pub name: String,
    pub icon: Option<String>,
    pub owner_id: i32,
    pub description: Option<String>,
}

/// Структура для результата запроса проверки существования
#[derive(sqlx::FromRow)]
struct ExistsResult {
    exists: Option<bool>,
}

/// Получение всех каналов (гильдий), в которых состоит пользователь
#[command]
pub async fn get_user_guilds(user_id: i32) -> Result<Vec<Guild>, String> {
    let pool = get_db_pool();
    
    let guilds = sqlx::query_as::<_, Guild>(
        r#"
        SELECT 
            g.id,
            g.name,
            g.icon,
            g.owner_id,
            g.description
        FROM guilds g
        INNER JOIN guild_members gm ON g.id = gm.guild_id
        WHERE gm.user_id = $1
        ORDER BY g.name DESC
        "#
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка получения каналов: {}", e))?;
    
    Ok(guilds)
}

/// Поиск канала по ID
#[command]
pub async fn find_guild_by_id(guild_id: i32) -> Result<Option<Guild>, String> {
    let pool = get_db_pool();
    
    let guild = sqlx::query_as::<_, Guild>(
        r#"
        SELECT 
            g.id,
            g.name,
            g.icon,
            g.owner_id,
            g.description
        FROM guilds g
        WHERE g.id = $1
        "#,
    )
    .bind(guild_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка поиска канала: {}", e))?;
    
    Ok(guild)
}

/// Присоединение к каналу по ID
#[command]
pub async fn join_guild_by_id(
    user_id: i32, 
    guild_id: i32,
    ws_manager: State<'_, Arc<SubscriptionManager>>  // Добавьте этот параметр
) -> Result<bool, String> {
    let pool = get_db_pool();
    
    // Проверяем, существует ли канал
    let guild_exists = sqlx::query_as::<_, ExistsResult>(
        "SELECT EXISTS(SELECT 1 FROM guilds WHERE id = $1) as exists"
    )
    .bind(guild_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка проверки канала: {}", e))?
    .and_then(|r| r.exists)
    .unwrap_or(false);
    
    if !guild_exists {
        return Err("Канал не найден".to_string());
    }
    
    // Проверяем, не состоит ли уже пользователь в канале
    let already_member = sqlx::query_as::<_, ExistsResult>(
        "SELECT EXISTS(SELECT 1 FROM guild_members WHERE user_id = $1 AND guild_id = $2) as exists"
    )
    .bind(user_id)
    .bind(guild_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка проверки членства: {}", e))?
    .and_then(|r| r.exists)
    .unwrap_or(false);
    
    if already_member {
        return Err("Вы уже состоите в этом канале".to_string());
    }
    
    // Добавляем пользователя в канал
    sqlx::query(
        r#"
        INSERT INTO guild_members (user_id, guild_id, joined_at)
        VALUES ($1, $2, NOW())
        "#
    )
    .bind(user_id)
    .bind(guild_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Ошибка присоединения к каналу: {}", e))?;
    
    // Отправляем уведомление о новом участнике
    let user = sqlx::query_as::<_, (String, Option<String>, String)>(
        "SELECT username, avatar, status FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка получения данных пользователя: {}", e))?
    .ok_or("Пользователь не найден")?;
    
    let user_status = serde_json::json!({
        "user_id": user_id,
        "username": user.0,
        "avatar": user.1,
        "status": user.2
    });
    
    let ws_message = WsMessage::new(
        "user_status_changed",
        user_status
    ).with_guild(guild_id);
    
    ws_manager.broadcast_to_guild(guild_id, ws_message).await;
    
    Ok(true)
}

/// Структура для создания новой гильдии
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateGuildData {
    pub name: String,
    pub description: Option<String>,
    pub owner_id: i32,
    pub icon: Option<String>,
}

/// Создание новой гильдии (канала)
#[command]
pub async fn create_guild(guild_data: CreateGuildData) -> Result<Guild, String> {
    let pool = get_db_pool();
    
    // Проверяем, существует ли пользователь
    let user_exists = sqlx::query_as::<_, ExistsResult>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1) as exists"
    )
    .bind(guild_data.owner_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка проверки пользователя: {}", e))?
    .exists
    .unwrap_or(false);
    
    if !user_exists {
        return Err("Пользователь не найден".to_string());
    }
    
    // Начинаем транзакцию
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Ошибка начала транзакции: {}", e))?;
    
    // Создаём гильдию
    let guild = sqlx::query_as::<_, Guild>(
        r#"
        INSERT INTO guilds (name, description, owner_id, icon)
        VALUES ($1, $2, $3, $4)
        RETURNING 
            id,
            name,
            icon,
            owner_id,
            description
        "#
    )
    .bind(&guild_data.name)
    .bind(&guild_data.description)
    .bind(guild_data.owner_id)
    .bind(&guild_data.icon)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания канала: {}", e))?;
    
    // Добавляем владельца в участники
    sqlx::query(
        r#"
        INSERT INTO guild_members (user_id, guild_id, joined_at)
        VALUES ($1, $2, NOW())
        "#
    )
    .bind(guild_data.owner_id)
    .bind(guild.id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка добавления владельца в канал: {}", e))?;
    
    // Создаём роль по умолчанию (администратор)
    sqlx::query(
        r#"
        INSERT INTO roles (guild_id, name, position, permissions)
        VALUES ($1, 'Admin', 0, -1)
        "#
    )
    .bind(guild.id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания роли администратора: {}", e))?;
    
    // Создаём роль @everyone
    sqlx::query(
        r#"
        INSERT INTO roles (guild_id, name, position, permissions)
        VALUES ($1, '@everyone', 1, 0)
        "#
    )
    .bind(guild.id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания роли @everyone: {}", e))?;
    
    // Создаём текстовую комнату по умолчанию
    sqlx::query(
        r#"
        INSERT INTO rooms (name, type, guild_id, position)
        VALUES ('general', 'text', $1, 0)
        "#
    )
    .bind(guild.id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания комнаты по умолчанию: {}", e))?;
    
    // Создаём голосовую комнату по умолчанию
    sqlx::query(
        r#"
        INSERT INTO rooms (name, type, guild_id, position)
        VALUES ('General', 'voice', $1, 1)
        "#
    )
    .bind(guild.id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания голосовой комнаты: {}", e))?;
    
    // Фиксируем транзакцию
    transaction
        .commit()
        .await
        .map_err(|e| format!("Ошибка фиксации транзакции: {}", e))?;
    
    Ok(guild)
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GuildMember {
    pub user_id: i32,
    pub username: String,
    pub avatar: Option<String>,
    pub nickname: Option<String>,
    pub joined_at: DateTime<Utc>,
}

#[command]
pub async fn get_guild_members(guild_id: i32) -> Result<Vec<GuildMember>, String> {
    let pool = get_db_pool();
    
    let members = sqlx::query_as::<_, GuildMember>(
        r#"
        SELECT 
            u.id as user_id,
            u.username,
            u.avatar,
            gm.nickname,
            gm.joined_at
        FROM guild_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.guild_id = $1
        ORDER BY gm.joined_at ASC
        "#
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки участников: {}", e))?;
    
    Ok(members)
}