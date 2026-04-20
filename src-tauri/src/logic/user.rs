// src-tauri/src/logic/user.rs
use serde::{Serialize, Deserialize};
use tauri::command;
use crate::db::get_db_pool;

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub avatar: Option<String>,
    pub status: String,
}

#[command]
pub async fn get_current_user(session_id: String) -> Result<User, String> {
    let pool = get_db_pool();
    
    let user = sqlx::query!(
        r#"
        SELECT u.id, u.username, u.email, u.avatar, u.status
        FROM users u
        INNER JOIN websocket_sessions ws ON u.id = ws.user_id
        WHERE ws.connection_id = $1 AND ws.status = 'active'
        "#,
        session_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка получения пользователя: {}", e))?;
    
    match user {
        Some(u) => Ok(User {
            id: u.id,
            username: u.username,
            email: u.email,
            avatar: u.avatar,
            status: u.status,
        }),
        None => Err("Сессия не найдена или истекла".to_string()),
    }
}