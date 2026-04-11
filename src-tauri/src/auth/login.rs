use sqlx::postgres::PgPoolOptions;
use argon2::{
    password_hash::{PasswordHash, PasswordVerifier},
    Argon2
};
use chrono::Utc;

#[tauri::command]
pub async fn login(login: String, password: String) -> Result<(bool, i32, String), String> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect("postgresql://gbilly_sysadmin:BillyJinn228@localhost/Voice-ka_Local")
        .await
        .map_err(|e| e.to_string())?;
    
    // Получаем данные пользователя
    let user: Option<(i32, String)> = sqlx::query_as(
        "SELECT id, password_hash FROM users WHERE username = $1 OR email = $1"
    )
    .bind(&login)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    match user {
        Some((user_id, stored_hash)) => {
            let argon2 = Argon2::default();
            
            let parsed_hash = PasswordHash::new(&stored_hash)
                .map_err(|e| format!("Неверный формат хеша: {}", e))?;
            
            match argon2.verify_password(password.as_bytes(), &parsed_hash) {
                Ok(_) => {
                    // Обновляем статус пользователя
                    sqlx::query(
                        "UPDATE users SET status = 'online', last_seen = $1, updated_at = $1 WHERE id = $2"
                    )
                    .bind(Utc::now())
                    .bind(user_id)
                    .execute(&pool)
                    .await
                    .map_err(|e| format!("Ошибка обновления статуса: {}", e))?;
                    
                    // Создаем новую сессию
                    let session_id = uuid::Uuid::new_v4().to_string();
                    sqlx::query(
                        "INSERT INTO websocket_sessions (user_id, connection_id, status, connected_at)
                        VALUES ($1, $2, 'active', $3)"
                    )
                    .bind(user_id)
                    .bind(&session_id)
                    .bind(Utc::now())
                    .execute(&pool)
                    .await
                    .map_err(|e| format!("Ошибка создания сессии: {}", e))?;
                    
                    println!("Пользователь {} (ID: {}) успешно вошел в систему", login, user_id);
                    Ok((true, user_id, session_id))
                },
                Err(_) => Ok((false, 0, "".to_string()))
            }
        }
        None => Ok((false, 0, "".to_string()))
    }
}