// src-tauri/src/logic/user.rs
use serde::{Serialize, Deserialize};
use tauri::command;
use crate::db::get_db_pool;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub avatar: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserStats {
    pub total_messages: i64,
    pub total_voice_time: i64,
    pub total_guilds: i64,
    pub registration_date: chrono::DateTime<chrono::Utc>,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

#[command]
pub async fn get_current_user(session_id: Option<String>) -> Result<User, String> {
    let pool = get_db_pool();
    
    // Временное решение для разработки: берем первого пользователя
    if let Some(sid) = session_id {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT u.id, u.username, u.email, u.avatar, u.status
            FROM users u
            INNER JOIN websocket_sessions ws ON u.id = ws.user_id
            WHERE ws.connection_id = $1 AND ws.status = 'active'
            "#
        )
        .bind(sid)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Ошибка получения пользователя: {}", e))?;
        
        if let Some(u) = user {
            return Ok(u);
        }
    }
    
    // Если сессия не найдена, берем первого пользователя (для разработки)
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, email, avatar, status FROM users LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка получения пользователя: {}", e))?;
    
    match user {
        Some(u) => Ok(u),
        None => Err("Пользователь не найден".to_string()),
    }
}

#[command]
pub async fn get_current_user_simple() -> Result<User, String> {
    get_current_user(None).await
}

#[command]
pub async fn get_user_stats(user_id: i32) -> Result<UserStats, String> {
    let pool = get_db_pool();
    
    // Получаем количество сообщений
    let total_messages: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM messages WHERE user_id = $1 AND deleted_at IS NULL"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка подсчета сообщений: {}", e))?;
    
    // Получаем общее время в голосовых каналах
    let total_voice_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(duration_seconds), 0) FROM voice_activity_logs WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка подсчета времени: {}", e))?;
    
    // Получаем количество каналов (гильдий), в которых состоит пользователь
    let total_guilds: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM guild_members WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка подсчета каналов: {}", e))?;
    
    // Получаем информацию о пользователе для дат
    let user_info: User = sqlx::query_as::<_, User>(
        "SELECT id, username, email, avatar, status FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения информации о пользователе: {}", e))?;
    
    // Получаем дату регистрации и последнего визита
    let registration_date: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
        "SELECT created_at FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения даты регистрации: {}", e))?;
    
    let last_seen: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
        "SELECT COALESCE(last_seen, created_at) FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения последнего визита: {}", e))?;
    
    Ok(UserStats {
        total_messages,
        total_voice_time,
        total_guilds,
        registration_date,
        last_seen,
    })
}

#[command]
pub async fn update_user_profile(
    user_id: i32,
    username: String,
    email: String,
    current_password: Option<String>,
    new_password: Option<String>,
) -> Result<String, String> {
    let pool = get_db_pool();
    
    // Проверяем существование пользователя
    let user_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка проверки пользователя: {}", e))?;
    
    if !user_exists {
        return Err("Пользователь не найден".to_string());
    }
    
    // Если есть новый пароль, проверяем текущий
    if let (Some(current_pw), Some(new_pw)) = (current_password, new_password) {
        if !new_pw.is_empty() {
            // Здесь должна быть проверка текущего пароля
            // Для разработки пропускаем проверку
            println!("Смена пароля для пользователя {} с {} на {}", user_id, current_pw, new_pw);
            
            // Обновляем пароль (в реальном приложении нужно хешировать)
            sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
                .bind(format!("hashed_{}", new_pw)) // Временное решение
                .bind(user_id)
                .execute(pool)
                .await
                .map_err(|e| format!("Ошибка обновления пароля: {}", e))?;
        }
    }
    
    // Обновляем основную информацию
    sqlx::query(
        "UPDATE users SET username = $1, email = $2, updated_at = NOW() WHERE id = $3"
    )
    .bind(username)
    .bind(email)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Ошибка обновления профиля: {}", e))?;
    
    Ok("Профиль успешно обновлен".to_string())
}

#[command]
pub async fn get_user_guilds_with_role(user_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();
    
    let guilds = sqlx::query_as::<_, (i32, String, Option<String>, String)>(
        r#"
        SELECT 
            g.id,
            g.name,
            g.icon,
            COALESCE(r.name, 'member') as role
        FROM guild_members gm
        JOIN guilds g ON gm.guild_id = g.id
        LEFT JOIN member_roles mr ON mr.user_id = gm.user_id AND mr.guild_id = gm.guild_id
        LEFT JOIN roles r ON mr.role_id = r.id
        WHERE gm.user_id = $1
        ORDER BY g.name
        "#
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка получения каналов пользователя: {}", e))?;
    
    let result: Vec<serde_json::Value> = guilds
        .into_iter()
        .map(|(id, name, icon, role)| {
            serde_json::json!({
                "id": id,
                "name": name,
                "icon": icon,
                "role": role
            })
        })
        .collect();
    
    Ok(result)
}