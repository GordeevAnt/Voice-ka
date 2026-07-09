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
    let user = sqlx::query(
        "SELECT id, username, avatar, password_hash FROM users WHERE username = $1 OR email = $1"
    )
    .bind(&data.login)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (user_id, username, avatar, stored_hash) = match user {
        Some(u) => (
            u.get::<i32, _>(0),
            u.get::<String, _>(1),
            u.get::<Option<String>, _>(2),
            u.get::<String, _>(3),
        ),
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
    sqlx::query(
        "UPDATE websocket_sessions 
        SET status = 'closed', disconnected_at = $1 
        WHERE user_id = $2 AND status = 'active'"
    )
    .bind(Utc::now())
    .bind(user_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Обновляем статус пользователя
    sqlx::query(
        "UPDATE users SET status = 'online', last_seen = $1, updated_at = $1 WHERE id = $2"
    )
    .bind(Utc::now())
    .bind(user_id)
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
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Аудит-лог
    let user_guild_id: Option<i32> = sqlx::query(
        "SELECT id FROM guilds WHERE owner_id = $1 LIMIT 1"
    )
    .bind(user_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?
    .map(|row| row.get::<i32, _>(0));

    if let Some(guild_id) = user_guild_id {
        let changes_str = json!({ "login": data.login }).to_string();
        
        sqlx::query(
            "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
            VALUES ($1, $2, 'USER_LOGIN', $3, $4::jsonb, $5)"
        )
        .bind(guild_id)
        .bind(user_id)
        .bind(user_id)
        .bind(&changes_str)
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
    let existing = sqlx::query(
        "SELECT username, email FROM users WHERE username = $1 OR email = $2"
    )
    .bind(&data.login)
    .bind(&data.email)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(user) = existing {
        let db_username: String = user.get(0);
        let db_email: String = user.get(1);
        if db_username == data.login {
            return Err("Username already exists".to_string());
        }
        if db_email == data.email {
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
    let user_id: i32 = sqlx::query(
        "INSERT INTO users (username, email, password_hash, status, created_at, updated_at) 
         VALUES ($1, $2, $3, 'offline', $4, $4)
         RETURNING id"
    )
    .bind(&data.login)
    .bind(&data.email)
    .bind(&password_hash)
    .bind(Utc::now())
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Registration error: {}", e))?
    .get::<i32, _>(0);

    // 👇 ПРИСОЕДИНЯЕМ ПОЛЬЗОВАТЕЛЯ К СУЩЕСТВУЮЩЕМУ СЕРВЕРУ (ID = 1)
    let main_guild_id = 1;

    // Проверяем, существует ли сервер с id=1
    let guild_exists: bool = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM guilds WHERE id = $1)"
    )
    .bind(main_guild_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?
    .get::<bool, _>(0);

    if !guild_exists {
        // Если сервера с id=1 нет, создаем его
        sqlx::query(
            "INSERT INTO guilds (id, name, owner_id, description, created_at, updated_at)
             VALUES ($1, $2, $3, 'Main server', $4, $4)"
        )
        .bind(main_guild_id)
        .bind("Voice-ka")
        .bind(user_id) // Владелец - первый зарегистрированный пользователь
        .bind(Utc::now())
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Guild creation error: {}", e))?;

        // Создаем роли для сервера
        // 1. Admin роль с ВСЕМИ правами
        sqlx::query(
            "INSERT INTO roles (guild_id, name, position, permissions, created_at, updated_at)
             VALUES ($1, 'Admin', 100, 126, $2, $2)"
        )
        .bind(main_guild_id)
        .bind(Utc::now())
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;

        // 2. @everyone роль с правом отправки сообщений
        sqlx::query(
            "INSERT INTO roles (guild_id, name, position, permissions, created_at, updated_at)
             VALUES ($1, '@everyone', 0, 64, $2, $2)"
        )
        .bind(main_guild_id)
        .bind(Utc::now())
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;

        // 3. Создаем текстовую комнату
        sqlx::query(
            "INSERT INTO rooms (name, type, guild_id, position, created_at, updated_at)
             VALUES ('general', 'text', $1, 0, $2, $2)"
        )
        .bind(main_guild_id)
        .bind(Utc::now())
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;

        // 4. Создаем голосовую комнату (Voice-ka)
        sqlx::query(
            "INSERT INTO rooms (name, type, guild_id, position, bitrate, created_at, updated_at)
             VALUES ('Voice-ka', 'voice', $1, 1, 64000, $2, $2)"
        )
        .bind(main_guild_id)
        .bind(Utc::now())
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Добавляем пользователя в члены сервера
    sqlx::query(
        "INSERT INTO guild_members (user_id, guild_id, joined_at)
         VALUES ($1, $2, $3)"
    )
    .bind(user_id)
    .bind(main_guild_id)
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Получаем роль @everyone для этого сервера
    let everyone_role_id: Option<i32> = sqlx::query(
        "SELECT id FROM roles WHERE guild_id = $1 AND name = '@everyone'"
    )
    .bind(main_guild_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?
    .map(|row| row.get::<i32, _>(0));

    if let Some(role_id) = everyone_role_id {
        // Назначаем роль @everyone новому пользователю
        sqlx::query(
            "INSERT INTO member_roles (user_id, role_id, guild_id)
             VALUES ($1, $2, $3)"
        )
        .bind(user_id)
        .bind(role_id)
        .bind(main_guild_id)
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Проверяем, является ли пользователь первым (владельцем)
    let is_first_user: bool = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM guilds WHERE id = $1 AND owner_id = $2)"
    )
    .bind(main_guild_id)
    .bind(user_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?
    .get::<bool, _>(0);

    // Если пользователь - владелец, назначаем ему роль Admin
    if is_first_user {
        let admin_role_id: Option<i32> = sqlx::query(
            "SELECT id FROM roles WHERE guild_id = $1 AND name = 'Admin'"
        )
        .bind(main_guild_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?
        .map(|row| row.get::<i32, _>(0));

        if let Some(role_id) = admin_role_id {
            sqlx::query(
                "INSERT INTO member_roles (user_id, role_id, guild_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, role_id, guild_id) DO NOTHING"
            )
            .bind(user_id)
            .bind(role_id)
            .bind(main_guild_id)
            .execute(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    // Аудит-лог
    let audit_data = json!({
        "username": data.login,
        "email": data.email,
        "action": "registered_and_joined_main_server"
    });

    let audit_str = audit_data.to_string();

    sqlx::query(
        "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
        VALUES ($1, $2, 'USER_REGISTER', $3, $4::jsonb, $5)"
    )
    .bind(main_guild_id)
    .bind(user_id)
    .bind(user_id)
    .bind(&audit_str)
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    transaction.commit()
        .await
        .map_err(|e| e.to_string())?;

    println!("✅ User {} (ID: {}) registered and joined main server (ID: {})", 
             data.login, user_id, main_guild_id);

    Ok((true, user_id))
}

pub async fn validate_session(session_token: &str) -> Option<ConnectionInfo> {
    let pool = get_db_pool();

    let result = sqlx::query(
        "SELECT u.id, u.username FROM users u
        INNER JOIN websocket_sessions ws ON u.id = ws.user_id
        WHERE ws.connection_id = $1 AND ws.status = 'active'"
    )
    .bind(session_token)
    .fetch_optional(pool)
    .await
    .ok()?;

    result.map(|r| ConnectionInfo {
        user_id: r.get::<i32, _>(0),
        username: r.get::<String, _>(1),
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
    let user_info = sqlx::query(
        "SELECT username, avatar FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    let mut transaction = pool.begin()
        .await
        .map_err(|e| e.to_string())?;
    
    // Закрываем сессию
    if let Some(token) = session_token {
        sqlx::query(
            "UPDATE websocket_sessions SET status = 'closed', disconnected_at = $1
                WHERE user_id = $2 AND connection_id = $3 AND status = 'active'"
        )
        .bind(Utc::now())
        .bind(user_id)
        .bind(&token)
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    } else {
        sqlx::query(
            "UPDATE websocket_sessions SET status = 'closed', disconnected_at = $1
                WHERE user_id = $2 AND status = 'active'"
        )
        .bind(Utc::now())
        .bind(user_id)
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    }
    
    // Проверяем другие активные сессии
    let active_sessions: i64 = sqlx::query(
        "SELECT COUNT(*) FROM websocket_sessions WHERE user_id = $1 AND status = 'active'"
    )
    .bind(user_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?
    .get::<i64, _>(0);
    
    // Обновляем статус только если нет других сессий
    if active_sessions == 0 {
        sqlx::query(
            "UPDATE users SET status = 'offline', last_seen = $1, updated_at = $1 WHERE id = $2"
        )
        .bind(Utc::now())
        .bind(user_id)
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
            let username: String = user.get(0);
            let avatar: Option<String> = user.get(1);
            
            handle_notify_user_status_change(
                &manager,
                user_id,
                &username,
                &avatar,
                "offline",
                &user_guilds,
            ).await;
        }
    }
    
    Ok(true)
}

pub async fn handle_get_current_user(session_token: &str) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

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
    let total_messages: i64 = sqlx::query(
        "SELECT COUNT(*) FROM messages WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map(|row| row.get::<i64, _>(0))
    .unwrap_or(0);

    // Получаем общее время в голосовых каналах
    let total_voice_time: i64 = sqlx::query(
        "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (left_at - joined_at))), 0)::bigint 
         FROM voice_activity_logs WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map(|row| row.get::<i64, _>(0))
    .unwrap_or(0);

    // Получаем количество гильдий
    let total_guilds: i64 = sqlx::query(
        "SELECT COUNT(*) FROM guild_members WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map(|row| row.get::<i64, _>(0))
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
            let stored_hash: Option<String> = sqlx::query(
                "SELECT password_hash FROM users WHERE id = $1"
            )
            .bind(user_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?
            .get::<Option<String>, _>(0);
            
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