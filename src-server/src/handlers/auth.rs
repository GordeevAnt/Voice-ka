use std::sync::Arc;

use crate::db::get_db_pool;
use crate::ws::manager::{ConnectionInfo, SubscriptionManager};
use crate::ws::messages::WsMessage;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::Utc;
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

// Импортируем функции из guild
use crate::handlers::guild::get_user_guilds_ids;
use crate::handlers::guild::handle_notify_user_status_change;

#[derive(Debug, serde::Deserialize)]
pub struct LoginData {
    pub login: String,
    pub password: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub user_id: i32,
    pub session_token: String,
    pub username: String,
    pub avatar: Option<String>,
}

pub async fn handle_login(
    data: LoginData, 
    manager: Arc<SubscriptionManager>
) -> Result<LoginResponse, String> {
    let pool = get_db_pool();

    // Получаем пользователя
    let user = sqlx::query!(
        "SELECT id, username, avatar, password_hash FROM users WHERE username = $1 OR email = $1",
        data.login
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (user_id, username, avatar, stored_hash) = match user {
        Some(u) => (u.id, u.username, u.avatar, u.password_hash),
        None => return Err("Invalid credentials".to_string()),
    };

    // Проверяем пароль
    let argon2 = Argon2::default();
    let parsed_hash = PasswordHash::new(&stored_hash)
        .map_err(|e| format!("Hash error: {}", e))?;

    argon2.verify_password(data.password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid password".to_string())?;

    // Начинаем транзакцию
    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;

    // Закрываем старые сессии
    sqlx::query!(
        "UPDATE websocket_sessions 
        SET status = 'closed', disconnected_at = $1 
        WHERE user_id = $2 AND status = 'active'",
        Utc::now(),
        user_id
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Обновляем статус пользователя
    sqlx::query!(
        "UPDATE users SET status = 'online', last_seen = $1, updated_at = $1 WHERE id = $2",
        Utc::now(),
        user_id
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Создаем новую сессию
    let session_token = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO websocket_sessions (user_id, connection_id, status, ip_address, user_agent, last_heartbeat, connected_at)
        VALUES ($1, $2, 'active', $3::inet, $4, $5, $5)"
    )
    .bind(user_id)
    .bind(&session_token)
    .bind(data.ip_address.as_deref().unwrap_or("0.0.0.0"))
    .bind(&data.user_agent)
    .bind(now)
    .bind(now)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Аудит-лог
    let user_guild_id: Option<i32> = sqlx::query_scalar!(
        "SELECT id FROM guilds WHERE owner_id = $1 LIMIT 1",
        user_id
    )
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(guild_id) = user_guild_id {
        let changes_str = json!({ "login": data.login }).to_string();
        
        sqlx::query(
            "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
            VALUES ($1, $2, 'USER_LOGIN', $3, $4::jsonb, $5)"
        )
        .bind(guild_id)
        .bind(user_id)
        .bind(user_id)
        .bind(changes_str)
        .bind(now)
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    }

    transaction.commit()
        .await
        .map_err(|e| e.to_string())?;

    // После коммита - уведомляем пользователей
    let user_guilds = get_user_guilds_ids(user_id).await?;
    
    handle_notify_user_status_change(
        &manager,
        user_id,
        &username,
        &None,
        "online",
        &user_guilds,
    ).await;

    println!("✅ User {} (ID: {}) logged in", username, user_id);

    Ok(LoginResponse {
        success: true,
        user_id,
        session_token,
        username,
        avatar,
    })
}


#[derive(Debug, serde::Deserialize)]
pub struct RegisterData {
    pub login: String,
    pub email: String,
    pub password: String,
    pub confirm_password: String,
}

pub async fn handle_register(data: RegisterData) -> Result<(bool, i32), String> {
    // Валидация
    if data.password != data.confirm_password {
        return Err("Passwords do not match".to_string());
    }
    if data.password.len() < 6 {
        return Err("Password must be at least 6 characters".to_string());
    }
    if data.login.len() < 3 {
        return Err("Login must be at least 3 characters".to_string());
    }
    if !data.email.contains('@') || !data.email.contains('.') {
        return Err("Invalid email".to_string());
    }

    let pool = get_db_pool();

    // Проверка существования пользователя
    let existing = sqlx::query!(
        "SELECT username, email FROM users WHERE username = $1 OR email = $2",
        data.login,
        data.email
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(user) = existing {
        if user.username == data.login {
            return Err("Username already exists".to_string());
        }
        if user.email == data.email {
            return Err("Email already exists".to_string());
        }
    }

    // Хеширование пароля
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(data.password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    // Начинаем транзакцию
    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;

    // Создаем пользователя
    let user_id: i32 = sqlx::query_scalar!(
        "INSERT INTO users (username, email, password_hash, status, created_at, updated_at) 
         VALUES ($1, $2, $3, 'offline', $4, $4)
         RETURNING id",
        data.login,
        data.email,
        password_hash,
        Utc::now()
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Registration error: {}", e))?;

    // Создаем личный сервер
    let guild_name = format!("{}'s Server", data.login);
    let guild_id: i32 = sqlx::query_scalar!(
        "INSERT INTO guilds (name, owner_id, description, created_at, updated_at)
         VALUES ($1, $2, 'Personal server', $3, $3)
         RETURNING id",
        guild_name,
        user_id,
        Utc::now()
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Guild creation error: {}", e))?;

    // Добавляем пользователя в члены
    sqlx::query!(
        "INSERT INTO guild_members (user_id, guild_id, joined_at)
         VALUES ($1, $2, $3)",
        user_id,
        guild_id,
        Utc::now()
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 👇 СОЗДАЕМ РОЛИ С ПРАВИЛЬНЫМИ ПРАВАМИ

    // 1. Создаем роль Admin с ВСЕМИ правами (126 = все права)
    let admin_role_id: i32 = sqlx::query_scalar!(
        "INSERT INTO roles (guild_id, name, position, permissions, created_at, updated_at)
         VALUES ($1, 'Admin', 100, 126, $2, $2)
         RETURNING id",
        guild_id,
        Utc::now()
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Создаем роль @everyone с правом отправки сообщений (64)
    let everyone_role_id: i32 = sqlx::query_scalar!(
        "INSERT INTO roles (guild_id, name, position, permissions, created_at, updated_at)
         VALUES ($1, '@everyone', 0, 64, $2, $2)
         RETURNING id",
        guild_id,
        Utc::now()
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 3. Назначаем владельцу роль Admin (ВСЕ права)
    sqlx::query!(
        "INSERT INTO member_roles (user_id, role_id, guild_id)
         VALUES ($1, $2, $3)",
        user_id,
        admin_role_id,
        guild_id
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 4. Также назначаем владельцу роль @everyone (для базовых прав)
    sqlx::query!(
        "INSERT INTO member_roles (user_id, role_id, guild_id)
         VALUES ($1, $2, $3)",
        user_id,
        everyone_role_id,
        guild_id
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 5. Создаем текстовую комнату
    sqlx::query!(
        "INSERT INTO rooms (name, type, guild_id, position, created_at, updated_at)
         VALUES ('general', 'text', $1, 0, $2, $2)",
        guild_id,
        Utc::now()
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // 6. Создаем голосовую комнату
    sqlx::query!(
        "INSERT INTO rooms (name, type, guild_id, position, bitrate, created_at, updated_at)
         VALUES ('General Voice', 'voice', $1, 1, 64000, $2, $2)",
        guild_id,
        Utc::now()
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Аудит-лог
    let audit_data = json!({
        "username": data.login,
        "email": data.email
    });

    let audit_str = audit_data.to_string();

    sqlx::query(
        "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
        VALUES ($1, $2, 'USER_REGISTER', $3, $4::jsonb, $5)"
    )
    .bind(guild_id)
    .bind(user_id)
    .bind(user_id)
    .bind(audit_str)
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    transaction.commit()
        .await
        .map_err(|e| e.to_string())?;

    println!("✅ User {} (ID: {}) registered with guild {}", data.login, user_id, guild_id);
    println!("   - Admin role created with all permissions (126)");
    println!("   - @everyone role created with SEND_MESSAGES permission (64)");
    println!("   - User assigned both Admin and @everyone roles");

    Ok((true, user_id))
}

pub async fn validate_session(session_token: &str) -> Option<ConnectionInfo> {
    let pool = get_db_pool();

    let result = sqlx::query!(
        "SELECT u.id, u.username FROM users u
        INNER JOIN websocket_sessions ws ON u.id = ws.user_id
        WHERE ws.connection_id = $1 AND ws.status = 'active'",
        session_token
    )
    .fetch_optional(pool)
    .await
    .ok()?;

    result.map(|r| ConnectionInfo {
        user_id: r.id,
        username: r.username,
        session_token: session_token.to_string(),
    })
}

pub async fn handle_logout(
    user_id: i32, 
    session_token: Option<String>,
    manager: Arc<SubscriptionManager>
) -> Result<bool, String> {
    let pool = get_db_pool();
    
    // Получаем гильдии пользователя ДО того как он станет оффлайн
    let user_guilds = get_user_guilds_ids(user_id).await?;
    
    // Получаем информацию о пользователе
    let user_info = sqlx::query!(
        "SELECT username, avatar FROM users WHERE id = $1",
        user_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;
    
    // Закрываем сессию
    if let Some(token) = session_token {
        sqlx::query!(
            "UPDATE websocket_sessions SET status = 'closed', disconnected_at = $1
                WHERE user_id = $2 AND connection_id = $3 AND status = 'active'",
            Utc::now(),
            user_id,
            token
        )
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    } else {
        sqlx::query!(
            "UPDATE websocket_sessions SET status = 'closed', disconnected_at = $1
                WHERE user_id = $2 AND status = 'active'",
            Utc::now(),
            user_id
        )
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    }
    
    // Проверяем другие активные сессии
    let active_sessions: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM websocket_sessions WHERE user_id = $1 AND status = 'active'",
        user_id
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?
    .unwrap_or(0);
    
    // Обновляем статус только если нет других сессий
    if active_sessions == 0 {
        sqlx::query!(
            "UPDATE users SET status = 'offline', last_seen = $1, updated_at = $1 WHERE id = $2",
            Utc::now(),
            user_id
        )
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    }
    
    transaction.commit()
        .await
        .map_err(|e| e.to_string())?;
    
    // Если нет других активных сессий, уведомляем об оффлайн статусе
    if active_sessions == 0 {
        if let Some(user) = user_info {
            handle_notify_user_status_change(
                &manager,
                user_id,
                &user.username,
                &user.avatar,
                "offline",
                &user_guilds,
            ).await;
        }
    }
    
    Ok(true)
}

pub async fn handle_get_current_user(session_token: &str) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    // Используем query вместо query! для Option типов
    let user = sqlx::query(
        "SELECT u.id, u.username, u.email, u.avatar, u.status, u.last_seen
        FROM users u
        INNER JOIN websocket_sessions ws ON u.id = ws.user_id
        WHERE ws.connection_id = $1 AND ws.status = 'active'"
    )
    .bind(session_token)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    match user {
        Some(row) => {
            let id: i32 = row.get(0);
            let username: String = row.get(1);
            let email: String = row.get(2);
            let avatar: Option<String> = row.get(3);
            let status: String = row.get(4);
            let last_seen: chrono::DateTime<chrono::Utc> = row.get(5);
            
            Ok(json!({
                "id": id,
                "username": username,
                "email": email,
                "avatar": avatar,
                "status": status,
                "last_seen": last_seen.to_rfc3339()
            }))
        }
        None => Err("User not found".to_string())
    }
}

pub async fn handle_get_user_stats(user_id: i32) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    // Получаем количество сообщений
    let total_messages: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM messages WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // Получаем общее время в голосовых каналах
    let total_voice_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (left_at - joined_at))), 0)::bigint 
         FROM voice_activity_logs WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // Получаем количество гильдий
    let total_guilds: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM guild_members WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // Получаем информацию о пользователе
    let user = sqlx::query(
        "SELECT created_at, last_seen FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    match user {
        Some(row) => {
            let created_at: chrono::DateTime<chrono::Utc> = row.get(0);
            let last_seen: chrono::DateTime<chrono::Utc> = row.get(1);
            
            Ok(json!({
                "total_messages": total_messages,
                "total_voice_time": total_voice_time,
                "total_guilds": total_guilds,
                "registration_date": created_at.to_rfc3339(),
                "last_seen": last_seen.to_rfc3339()
            }))
        }
        None => Err("User not found".to_string())
    }
}

pub async fn handle_update_user_profile(
    user_id: i32, 
    data: serde_json::Value,
    manager: Arc<SubscriptionManager>,
) -> Result<bool, String> {
    let pool = get_db_pool();
    
    let username = data.get("username").and_then(|v| v.as_str());
    let email = data.get("email").and_then(|v| v.as_str());
    let avatar = data.get("avatar").and_then(|v| v.as_str());
    let current_password = data.get("currentPassword").and_then(|v| v.as_str());
    let new_password = data.get("newPassword").and_then(|v| v.as_str());
    
    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;
    
    let mut updated = false;
    
    // Если меняется пароль, проверяем текущий
    if let (Some(current), Some(new)) = (current_password, new_password) {
        if !new.is_empty() {
            // Получаем текущий хеш пароля
            let stored_hash: Option<String> = sqlx::query_scalar(
                "SELECT password_hash FROM users WHERE id = $1"
            )
            .bind(user_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;
            
            if let Some(hash) = stored_hash {
                let argon2 = Argon2::default();
                let parsed_hash = PasswordHash::new(&hash)
                    .map_err(|e| format!("Hash error: {}", e))?;
                
                argon2.verify_password(current.as_bytes(), &parsed_hash)
                    .map_err(|_| "Invalid current password".to_string())?;
                
                // Хешируем новый пароль
                let salt = SaltString::generate(&mut OsRng);
                let new_hash = argon2
                    .hash_password(new.as_bytes(), &salt)
                    .map_err(|e| format!("Hash error: {}", e))?
                    .to_string();
                
                sqlx::query(
                    "UPDATE users SET password_hash = $1 WHERE id = $2"
                )
                .bind(&new_hash)
                .bind(user_id)
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;
                updated = true;
            }
        }
    }
    
    // Обновляем username
    if let Some(uname) = username {
        if !uname.is_empty() && uname.len() >= 3 {
            sqlx::query(
                "UPDATE users SET username = $1, updated_at = $2 WHERE id = $3"
            )
            .bind(uname)
            .bind(Utc::now())
            .bind(user_id)
            .execute(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;
            updated = true;
        }
    }
    
    // Обновляем email
    if let Some(em) = email {
        if !em.is_empty() && em.contains('@') {
            sqlx::query(
                "UPDATE users SET email = $1, updated_at = $2 WHERE id = $3"
            )
            .bind(em)
            .bind(Utc::now())
            .bind(user_id)
            .execute(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;
            updated = true;
        }
    }
    
    // Обновляем avatar
    if let Some(av) = avatar {
        sqlx::query(
            "UPDATE users SET avatar = $1, updated_at = $2 WHERE id = $3"
        )
            .bind(av)
            .bind(Utc::now())
            .bind(user_id)
            .execute(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;
        updated = true;
    }
    
    transaction.commit()
        .await
        .map_err(|e| e.to_string())?;
    
    // Если были изменения, уведомляем об обновлении профиля
    if updated {
        // Получаем обновленные данные пользователя
        let user_row = sqlx::query(
            "SELECT username, avatar, status FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if let Some(row) = user_row {
            let username: String = row.get(0);
            let avatar: Option<String> = row.get(1);
            let status: String = row.get(2);
            
            // Получаем гильдии пользователя
            let guild_ids = crate::handlers::guild::get_user_guilds_ids(user_id).await?;
            
            // Уведомляем всех в гильдиях об обновлении профиля
            let profile_data = json!({
                "user_id": user_id,
                "username": username,
                "avatar": avatar,
                "status": status
            });
            
            for guild_id in guild_ids {
                let ws_msg = WsMessage::new("user_profile_updated", profile_data.clone())
                    .with_guild(guild_id);
                manager.broadcast_to_guild(guild_id, ws_msg).await;
            }
        }
    }
    
    Ok(true)
}