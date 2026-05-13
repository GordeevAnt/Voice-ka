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

pub async fn handle_notify_user_status_change(
    manager: &Arc<SubscriptionManager>,
    user_id: i32,
    username: &str,
    avatar: &Option<String>,
    status: &str,
    guild_ids: &[i32],
) {
    let status_data = json!({
        "user_id": user_id,
        "username": username,
        "avatar": avatar,
        "status": status
    });
    
    for guild_id in guild_ids {
        let ws_message = WsMessage::new("user_status_changed", status_data.clone())
            .with_guild(*guild_id);
        manager.broadcast_to_guild(*guild_id, ws_message).await;
    }
}

pub async fn get_user_guilds_ids(user_id: i32) -> Result<Vec<i32>, String> {
    let pool = get_db_pool();
    
    let guilds = sqlx::query_scalar(
        "SELECT guild_id FROM guild_members WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get user guilds: {}", e))?;
    
    Ok(guilds)
}

pub async fn handle_create_guild(
    user_id: i32,
    data: CreateGuildData,
    manager: Arc<SubscriptionManager>,
) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;

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
    let admin_role = sqlx::query(
        "INSERT INTO roles (guild_id, name, position, permissions, created_at, updated_at)
            VALUES ($1, 'Admin', 0, -1, $2, $2)
            RETURNING id"
    )
    .bind(guild_id)
    .bind(now)
    .bind(now)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;
    
    let admin_role_id: i32 = admin_role.get(0);

    // 👇 ИСПРАВЛЕНО: убраны created_at и updated_at (их нет в таблице member_roles)
    sqlx::query(
        "INSERT INTO member_roles (user_id, guild_id, role_id)
            VALUES ($1, $2, $3)"
    )
    .bind(user_id)
    .bind(guild_id)
    .bind(admin_role_id)
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
    let ws_message = WsMessage::new("guild_created", result.clone());
    manager.send_to_user_by_user_id(user_id, ws_message).await;

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

    // Получаем информацию о пользователе
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

    // Уведомляем всех в гильдии о присоединении
    let user_joined_data = json!({
        "user_id": user_id,
        "username": username,
        "avatar": avatar,
        "status": status,
        "guild_id": guild_id,
    });

    let ws_joined_msg = WsMessage::new("user_joined_guild", user_joined_data)
        .with_guild(guild_id);
    manager.broadcast_to_guild(guild_id, ws_joined_msg).await;

    // Также уведомляем об изменении статуса (если пользователь онлайн)
    if status == "online" {
        handle_notify_user_status_change(
            &manager,
            user_id,
            &username,
            &avatar,
            &status,
            &[guild_id],
        ).await;
    }

    Ok(true)
}

pub async fn handle_leave_guild(
    user_id: i32,
    guild_id: i32,
    manager: Arc<SubscriptionManager>,
) -> Result<bool, String> {
    let pool = get_db_pool();

    // Проверяем, существует ли гильдия
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

    // Проверяем, состоит ли пользователь в гильдии
    let is_member: Option<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM guild_members WHERE user_id = $1 AND guild_id = $2)"
    )
    .bind(user_id)
    .bind(guild_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let is_member = is_member.unwrap_or(false);
    if !is_member {
        return Err("You are not a member of this guild".to_string());
    }

    // Проверяем, является ли пользователь владельцем
    let is_owner: Option<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM guilds WHERE id = $1 AND owner_id = $2)"
    )
    .bind(guild_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let is_owner = is_owner.unwrap_or(false);
    if is_owner {
        return Err("You are the owner of this guild. Transfer ownership or delete the guild first".to_string());
    }

    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;

    // 1. Удаляем роли пользователя в этой гильдии
    sqlx::query(
        "DELETE FROM member_roles WHERE user_id = $1 AND guild_id = $2"
    )
    .bind(user_id)
    .bind(guild_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Удаляем голосовые состояния пользователя в комнатах этой гильдии
    sqlx::query(
        "DELETE FROM voice_states WHERE user_id = $1 AND room_id IN (SELECT id FROM rooms WHERE guild_id = $2)"
    )
    .bind(user_id)
    .bind(guild_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 3. Удаляем участника из гильдии
    sqlx::query(
        "DELETE FROM guild_members WHERE user_id = $1 AND guild_id = $2"
    )
    .bind(user_id)
    .bind(guild_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 4. Аудит-лог
    let now = Utc::now();
    let changes_str = json!({ "user_id": user_id }).to_string();

    sqlx::query(
        "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
        VALUES ($1, $2, 'MEMBER_LEFT', $3, $4::jsonb, $5)"
    )
    .bind(guild_id)
    .bind(user_id)
    .bind(user_id)
    .bind(changes_str)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    transaction.commit()
        .await
        .map_err(|e| e.to_string())?;

    // Получаем информацию о пользователе для уведомления
    let user_row = sqlx::query(
        "SELECT username, avatar FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let username: String = user_row.get(0);
    let avatar: Option<String> = user_row.get(1);

    // Уведомляем всех в гильдии о выходе участника
    let user_left_data = json!({
        "user_id": user_id,
        "username": username,
        "avatar": avatar,
        "guild_id": guild_id
    });

    let ws_msg = WsMessage::new("user_left_guild", user_left_data)
        .with_guild(guild_id);
    manager.broadcast_to_guild(guild_id, ws_msg).await;

    // Уведомляем самого пользователя, что он покинул гильдию
    let left_confirmation = WsMessage::new("guild_left", json!({
        "guild_id": guild_id,
        "success": true
    }));
    
    // Отправляем пользователю личное сообщение
    manager.send_to_user_by_user_id(user_id, left_confirmation).await;

    println!("👋 User {} (ID: {}) left guild {}", username, user_id, guild_id);

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

pub use get_user_guilds_ids as handle_get_user_guilds_ids;

pub async fn handle_get_user_roles_in_guild(
    user_id: i32, 
    guild_id: i32
) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    let roles = sqlx::query(
        "SELECT r.id, r.name, r.permissions, r.color, r.position
        FROM roles r
        INNER JOIN member_roles mr ON r.id = mr.role_id
        WHERE mr.user_id = $1 AND mr.guild_id = $2
        ORDER BY r.position ASC"
    )
    .bind(user_id)
    .bind(guild_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get user roles: {}", e))?;

    Ok(roles.into_iter().map(|row| {
        let id: i32 = row.get(0);
        let name: String = row.get(1);
        let permissions: i64 = row.get(2);
        let color: Option<String> = row.get(3);
        let position: i32 = row.get(4);
        
        json!({
            "id": id,
            "name": name,
            "permissions": permissions,
            "color": color,
            "position": position
        })
    }).collect())
}

pub async fn handle_get_user_permissions_in_guild(
    user_id: i32, 
    guild_id: i32
) -> Result<i64, String> {
    let pool = get_db_pool();

    // Исправлено: fetch_one возвращает i64, а не Option<i64>
    let permissions: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(BIT_OR(r.permissions), 0) as total_permissions
        FROM roles r
        INNER JOIN member_roles mr ON r.id = mr.role_id
        WHERE mr.user_id = $1 AND mr.guild_id = $2"
    )
    .bind(user_id)
    .bind(guild_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to get user permissions: {}", e))?;

    Ok(permissions)
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateGuildData {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
}

pub async fn handle_update_guild(
    user_id: i32,
    guild_id: i32,
    data: UpdateGuildData,
    manager: Arc<SubscriptionManager>,
) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    // Проверяем права пользователя
    let permissions = handle_get_user_permissions_in_guild(user_id, guild_id).await?;
    let has_edit_guild = (permissions & 2) != 0; // EDIT_GUILD = 2

    if !has_edit_guild {
        return Err("You don't have permission to edit this guild".to_string());
    }

    let now = Utc::now();

    let guild_row = sqlx::query(
        "UPDATE guilds 
         SET name = $1, description = $2, icon = $3, updated_at = $4
         WHERE id = $5
         RETURNING id, name, icon, owner_id, description"
    )
    .bind(&data.name)
    .bind(&data.description)
    .bind(&data.icon)
    .bind(now)
    .bind(guild_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to update guild: {}", e))?;

    match guild_row {
        Some(row) => {
            let id: i32 = row.get(0);
            let name: String = row.get(1);
            let icon: Option<String> = row.get(2);
            let owner_id: i32 = row.get(3);
            let description: Option<String> = row.get(4);
            
            let result = json!({
                "id": id,
                "name": name,
                "icon": icon,
                "owner_id": owner_id,
                "description": description
            });

            // Уведомляем всех в гильдии об обновлении
            let ws_msg = WsMessage::new("guild_updated", result.clone())
                .with_guild(guild_id);
            manager.broadcast_to_guild(guild_id, ws_msg).await;

            Ok(result)
        }
        None => Err("Guild not found".to_string())
    }
}

pub async fn handle_get_guild_roles(guild_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    let roles = sqlx::query(
        "SELECT id, name, permissions, color, position 
         FROM roles 
         WHERE guild_id = $1 
         ORDER BY position ASC"
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get guild roles: {}", e))?;

    Ok(roles.into_iter().map(|row| {
        let id: i32 = row.get(0);
        let name: String = row.get(1);
        let permissions: i64 = row.get(2);
        let color: Option<String> = row.get(3);
        let position: i32 = row.get(4);
        
        json!({
            "id": id,
            "name": name,
            "permissions": permissions,
            "color": color,
            "position": position
        })
    }).collect())
}

pub async fn handle_update_user_roles(
    requester_id: i32,
    guild_id: i32,
    target_user_id: i32,
    role_ids: Vec<i32>,
    manager: Arc<SubscriptionManager>,
) -> Result<bool, String> {
    let pool = get_db_pool();

    // Проверяем права запрашивающего (должен быть владельцем)
    let is_owner: Option<bool> = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM guilds WHERE id = $1 AND owner_id = $2)"
    )
    .bind(guild_id)
    .bind(requester_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let is_owner = is_owner.unwrap_or(false);
    if !is_owner {
        return Err("Only guild owner can manage roles".to_string());
    }

    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;

    // Удаляем все текущие роли пользователя в этой гильдии (кроме @everyone)
    sqlx::query(
        "DELETE FROM member_roles 
        WHERE user_id = $1 AND guild_id = $2 
        AND role_id NOT IN (SELECT id FROM roles WHERE guild_id = $2 AND name = '@everyone')"
    )
    .bind(target_user_id)
    .bind(guild_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Добавляем новые роли
    for &role_id in &role_ids {  // Используем &role_id вместо role_id
        // Проверяем, что роль принадлежит этой гильдии
        let role_exists: Option<bool> = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM roles WHERE id = $1 AND guild_id = $2)"
        )
        .bind(role_id)  // Теперь role_id - i32, а не ссылка
        .bind(guild_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;

        if role_exists.unwrap_or(false) {
            sqlx::query(
                "INSERT INTO member_roles (user_id, role_id, guild_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, role_id, guild_id) DO NOTHING"
            )
            .bind(target_user_id)
            .bind(role_id)
            .bind(guild_id)
            .execute(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    // Аудит-лог
    let now = Utc::now();
    let changes_str = json!({ 
        "action": "update_roles", 
        "user_id": target_user_id, 
        "role_ids": role_ids 
    }).to_string();

    sqlx::query(
        "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
         VALUES ($1, $2, 'UPDATE_ROLES', $3, $4::jsonb, $5)"
    )
    .bind(guild_id)
    .bind(requester_id)
    .bind(target_user_id)
    .bind(changes_str)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    transaction.commit()
        .await
        .map_err(|e| e.to_string())?;

    // Получаем обновленные права пользователя
    let new_permissions = handle_get_user_permissions_in_guild(target_user_id, guild_id).await?;
    
    // Получаем информацию о пользователе
    let user_row = sqlx::query(
        "SELECT username, avatar, status FROM users WHERE id = $1"
    )
    .bind(target_user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let username: String = user_row.get(0);
    let avatar: Option<String> = user_row.get(1);
    let status: String = user_row.get(2);

    // Уведомляем пользователя об изменении его прав
    let permissions_data = json!({
        "guild_id": guild_id,
        "permissions": new_permissions,
        "user_id": target_user_id,
        "username": username,
        "avatar": avatar,
        "status": status
    });

    let ws_message = WsMessage::new("user_permissions_updated", permissions_data);
    manager.send_to_user_by_user_id(target_user_id, ws_message).await;

    // Уведомляем всех в гильдии, что у пользователя обновились права (для обновления UI)
    let roles_updated_data = json!({
        "guild_id": guild_id,
        "user_id": target_user_id,
        "username": username
    });
    
    let broadcast_msg = WsMessage::new("user_roles_updated", roles_updated_data)
        .with_guild(guild_id);
    manager.broadcast_to_guild(guild_id, broadcast_msg).await;

    println!("📝 Updated roles for user {} (ID: {}) in guild {}", username, target_user_id, guild_id);

    Ok(true)
}