// src-server/src/handlers/auth.rs
use crate::db::get_db_pool;
use crate::ws::manager::ConnectionInfo;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

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
}

pub async fn handle_login(data: LoginData) -> Result<LoginResponse, String> {
    let pool = get_db_pool();

    // Получаем пользователя
    let user = sqlx::query!(
        "SELECT id, username, password_hash FROM users WHERE username = $1 OR email = $1",
        data.login
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let (user_id, username, stored_hash) = match user {
        Some(u) => (u.id, u.username, u.password_hash),
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

    // 🔧 ИСПРАВЛЕНО: используем query вместо query! для Option типов
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
        // 🔧 ИСПРАВЛЕНО: используем query вместо query! для динамических значений
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

    println!("✅ User {} (ID: {}) logged in", username, user_id);

    Ok(LoginResponse {
        success: true,
        user_id,
        session_token,
        username,
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

    // Создаем роль @everyone
    let role_id: i32 = sqlx::query_scalar!(
        "INSERT INTO roles (guild_id, name, position, created_at, updated_at)
         VALUES ($1, '@everyone', 0, $2, $2)
         RETURNING id",
        guild_id,
        Utc::now()
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Назначаем роль
    sqlx::query!(
        "INSERT INTO member_roles (user_id, role_id, guild_id)
         VALUES ($1, $2, $3)",
        user_id,
        role_id,
        guild_id
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Создаем текстовую комнату
    sqlx::query!(
        "INSERT INTO rooms (name, type, guild_id, position, created_at, updated_at)
         VALUES ('general', 'text', $1, 0, $2, $2)",
        guild_id,
        Utc::now()
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| e.to_string())?;

    // Создаем голосовую комнату
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

    // 🔧 ИСПРАВЛЕНО: используем query вместо query! для динамических значений
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

pub async fn handle_logout(user_id: i32, session_token: Option<String>) -> Result<bool, String> {
    let pool = get_db_pool();

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

    Ok(true)
}