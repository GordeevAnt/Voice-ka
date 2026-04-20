// src-tauri/src/logic/guild.rs

use serde::{Serialize, Deserialize};
use tauri::command;
use crate::db::get_db_pool;

/// Структура канала (гильдии) для передачи на фронтенд
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Guild {
    pub id: i32,
    pub name: String,
    pub icon: Option<String>,
    pub owner_id: i32,
    pub description: Option<String>,
}

/// Получение всех каналов (гильдий), в которых состоит пользователь
#[command]
pub async fn get_user_guilds(user_id: i32) -> Result<Vec<Guild>, String> {
    let pool = get_db_pool();
    
    let guilds = sqlx::query!(
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
        ORDER BY g.name ASC
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка получения каналов: {}", e))?
    .into_iter()
    .map(|g| Guild {
        id: g.id,
        name: g.name,
        icon: g.icon,
        owner_id: g.owner_id,
        description: g.description,
    })
    .collect();
    
    Ok(guilds)
}

/// Поиск канала по ID
#[command]
pub async fn find_guild_by_id(guild_id: i32) -> Result<Option<Guild>, String> {
    let pool = get_db_pool();
    
    let guild = sqlx::query!(
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
        guild_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка поиска канала: {}", e))?
    .map(|g| Guild {
        id: g.id,
        name: g.name,
        icon: g.icon,
        owner_id: g.owner_id,
        description: g.description,
    });
    
    Ok(guild)
}

/// Присоединение к каналу по ID
#[command]
pub async fn join_guild_by_id(user_id: i32, guild_id: i32) -> Result<bool, String> {
    let pool = get_db_pool();
    
    // Проверяем, существует ли канал
    let guild_exists = sqlx::query!(
        "SELECT id FROM guilds WHERE id = $1",
        guild_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка проверки канала: {}", e))?
    .is_some();
    
    if !guild_exists {
        return Err("Канал не найден".to_string());
    }
    
    // Проверяем, не состоит ли уже пользователь в канале
    let already_member = sqlx::query!(
        "SELECT id FROM guild_members WHERE user_id = $1 AND guild_id = $2",
        user_id,
        guild_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка проверки членства: {}", e))?
    .is_some();
    
    if already_member {
        return Err("Вы уже состоите в этом канале".to_string());
    }
    
    // Добавляем пользователя в канал
    sqlx::query!(
        r#"
        INSERT INTO guild_members (user_id, guild_id, joined_at)
        VALUES ($1, $2, NOW())
        "#,
        user_id,
        guild_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Ошибка присоединения к каналу: {}", e))?;
    
    Ok(true)
}