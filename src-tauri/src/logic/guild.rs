// src-tauri/src/logic/guild.rs

use serde::{Serialize, Deserialize};
use tauri::command;
use crate::db::get_db_pool; // Добавьте этот импорт

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
    let pool = get_db_pool(); // Берем глобальный пул
    
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
