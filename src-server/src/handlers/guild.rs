// src-server/src/handlers/guild.rs
use crate::db::get_db_pool;
use crate::ws::manager::SubscriptionManager;
use crate::ws::messages::WsMessage;
use std::sync::Arc;
use chrono::Utc;
use serde_json::json;
use sqlx::Row;

#[derive(Debug, serde::Deserialize)]
pub struct CreateGuildData {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
}

pub async fn handle_get_user_guilds(user_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    // ✅ ИСПРАВЛЕНО: используем query вместо query! для Option типов
    let guilds = sqlx::query(
        "SELECT g.id, g.name, g.icon, g.owner_id, g.description
        FROM guilds g
        INNER JOIN guild_members gm ON g.id = gm.guild_id
        WHERE gm.user_id = $1
        ORDER BY g.name"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get guilds: {}", e))?;

    Ok(guilds.into_iter().map(|row| {
        let id: i32 = row.get(0);
        let name: String = row.get(1);
        let icon: Option<String> = row.get(2);
        let owner_id: i32 = row.get(3);
        let description: Option<String> = row.get(4);
        
        json!({
            "id": id,
            "name": name,
            "icon": icon,
            "owner_id": owner_id,
            "description": description
        })
    }).collect())
}

pub async fn handle_create_guild(
    user_id: i32,
    data: CreateGuildData,
    _manager: Arc<SubscriptionManager>,
) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;

    // ✅ ИСПРАВЛЕНО: используем query вместо query! для Option типов
    let now = Utc::now();
    
    let guild_row = sqlx::query(
        "INSERT INTO guilds (name, description, owner_id, icon, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING id, name, icon, owner_id, description"
    )
    .bind(&data.name)
    .bind(&data.description)
    .bind(user_id)
    .bind(&data.icon)
    .bind(now)
    .bind(now)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Failed to create guild: {}", e))?;

    let guild_id: i32 = guild_row.get(0);
    let guild_name: String = guild_row.get(1);
    let guild_icon: Option<String> = guild_row.get(2);
    let guild_owner_id: i32 = guild_row.get(3);
    let guild_description: Option<String> = guild_row.get(4);

    // Добавляем владельца в участники
    sqlx::query(
        "INSERT INTO guild_members (user_id, guild_id, joined_at)
            VALUES ($1, $2, $3)"
    )
    .bind(user_id)
    .bind(guild_id)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Создаем роль Admin
    sqlx::query(
        "INSERT INTO roles (guild_id, name, position, permissions, created_at, updated_at)
            VALUES ($1, 'Admin', 0, -1, $2, $2)"
    )
    .bind(guild_id)
    .bind(now)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Создаем роль @everyone
    sqlx::query(
        "INSERT INTO roles (guild_id, name, position, permissions, created_at, updated_at)
            VALUES ($1, '@everyone', 1, 0, $2, $2)"
    )
    .bind(guild_id)
    .bind(now)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Создаем текстовую комнату
    sqlx::query(
        "INSERT INTO rooms (name, type, guild_id, position, created_at, updated_at)
            VALUES ('general', 'text', $1, 0, $2, $2)"
    )
    .bind(guild_id)
    .bind(now)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Создаем голосовую комнату
    sqlx::query(
        "INSERT INTO rooms (name, type, guild_id, position, bitrate, created_at, updated_at)
            VALUES ('General', 'voice', $1, 1, 64000, $2, $2)"
    )
    .bind(guild_id)
    .bind(now)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    transaction.commit()
        .await
        .map_err(|e| e.to_string())?;

    let result = json!({
        "id": guild_id,
        "name": guild_name,
        "icon": guild_icon,
        "owner_id": guild_owner_id,
        "description": guild_description
    });

    // Уведомляем пользователя о создании гильдии
    // let ws_message = WsMessage::new("guild_created", result.clone());
    // manager.send_to_user_by_user_id(user_id, ws_message).await;

    Ok(result)
}

pub async fn handle_join_guild(
    user_id: i32,
    guild_id: i32,
    manager: Arc<SubscriptionManager>,
) -> Result<bool, String> {
    let pool = get_db_pool();

    // Проверяем существование гильдии
    let guild_exists: Option<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM guilds WHERE id = $1)"
    )
    .bind(guild_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let guild_exists = guild_exists.unwrap_or(false);

    if !guild_exists {
        return Err("Guild not found".to_string());
    }

    // Проверяем, не состоит ли уже
    let already_member: Option<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM guild_members WHERE user_id = $1 AND guild_id = $2)"
    )
    .bind(user_id)
    .bind(guild_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let already_member = already_member.unwrap_or(false);

    if already_member {
        return Err("Already a member".to_string());
    }

    // Добавляем в гильдию
    sqlx::query(
        "INSERT INTO guild_members (user_id, guild_id, joined_at)
            VALUES ($1, $2, $3)"
    )
    .bind(user_id)
    .bind(guild_id)
    .bind(Utc::now())
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // ✅ ИСПРАВЛЕНО: используем query вместо query! для Option типов
    let user_row = sqlx::query(
        "SELECT username, avatar, status FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let username: String = user_row.get(0);
    let avatar: Option<String> = user_row.get(1);
    let status: String = user_row.get(2);

    // Уведомляем всех в гильдии
    let user_status = json!({
        "user_id": user_id,
        "username": username,
        "avatar": avatar,
        "status": status
    });

    let ws_message = WsMessage::new("user_joined_guild", user_status)
        .with_guild(guild_id);

    manager.broadcast_to_guild(guild_id, ws_message).await;

    Ok(true)
}

pub async fn handle_get_guild_members(guild_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    // ✅ ИСПРАВЛЕНО: используем query вместо query! для Option типов
    let members = sqlx::query(
        "SELECT u.id, u.username, u.avatar, gm.nickname, gm.joined_at
        FROM guild_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.guild_id = $1
        ORDER BY gm.joined_at ASC"
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get members: {}", e))?;

    Ok(members.into_iter().map(|row| {
        let user_id: i32 = row.get(0);
        let username: String = row.get(1);
        let avatar: Option<String> = row.get(2);
        let nickname: Option<String> = row.get(3);
        let joined_at: chrono::DateTime<chrono::Utc> = row.get(4);
        
        json!({
            "user_id": user_id,
            "username": username,
            "avatar": avatar,
            "nickname": nickname,
            "joined_at": joined_at.to_rfc3339()
        })
    }).collect())
}

pub async fn handle_find_guild_by_id(guild_id: i32) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    let guild = sqlx::query(
        "SELECT id, name, icon, owner_id, description FROM guilds WHERE id = $1"
    )
    .bind(guild_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to find guild: {}", e))?;

    match guild {
        Some(row) => {
            let id: i32 = row.get(0);
            let name: String = row.get(1);
            let icon: Option<String> = row.get(2);
            let owner_id: i32 = row.get(3);
            let description: Option<String> = row.get(4);
            
            Ok(json!({
                "id": id,
                "name": name,
                "icon": icon,
                "owner_id": owner_id,
                "description": description
            }))
        }
        None => Err("Guild not found".to_string())
    }
}

pub async fn handle_get_online_guild_members(guild_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    let members = sqlx::query(
        "SELECT u.id, u.username, u.avatar, u.status
        FROM guild_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.guild_id = $1 AND u.status != 'offline'
        ORDER BY u.username"
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get online members: {}", e))?;

    Ok(members.into_iter().map(|row| {
        let user_id: i32 = row.get(0);
        let username: String = row.get(1);
        let avatar: Option<String> = row.get(2);
        let status: String = row.get(3);
        
        json!({
            "user_id": user_id,
            "username": username,
            "avatar": avatar,
            "status": status
        })
    }).collect())
}

pub async fn handle_get_user_guilds_with_role(user_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    let guilds = sqlx::query(
        "SELECT g.id, g.name, g.icon, r.name as role_name
        FROM guilds g
        INNER JOIN guild_members gm ON g.id = gm.guild_id
        LEFT JOIN member_roles mr ON mr.user_id = gm.user_id AND mr.guild_id = g.id
        LEFT JOIN roles r ON r.id = mr.role_id
        WHERE gm.user_id = $1
        ORDER BY g.name"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get user guilds: {}", e))?;

    Ok(guilds.into_iter().map(|row| {
        let id: i32 = row.get(0);
        let name: String = row.get(1);
        let icon: Option<String> = row.get(2);
        let role: Option<String> = row.get(3);
        
        json!({
            "id": id,
            "name": name,
            "icon": icon,
            "role": role.unwrap_or("member".to_string())
        })
    }).collect())
}