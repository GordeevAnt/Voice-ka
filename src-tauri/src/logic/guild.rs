// src-tauri/src/logic/guild.rs

use serde::{Serialize, Deserialize};
use tauri::command;
use crate::db::get_db_pool;

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
pub async fn join_guild_by_id(user_id: i32, guild_id: i32) -> Result<bool, String> {
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
    
    Ok(true)
}