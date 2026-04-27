use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use argon2::{
    password_hash::{PasswordHash, PasswordVerifier},
    Argon2
};
use chrono::Utc;
use uuid::Uuid;

#[tauri::command]
pub async fn login(login: String, password: String, ip_address: Option<String>, user_agent: Option<String>) -> Result<(bool, i32, String), String> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect("postgresql://gbilly_sysadmin:BillyJinn228@localhost:5433/Voice-ka_Local")
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
                    // Начинаем транзакцию
                    let mut transaction = pool
                        .begin()
                        .await
                        .map_err(|e| format!("Ошибка начала транзакции: {}", e))?;
                    
                    // Закрываем все старые активные сессии этого пользователя
                    sqlx::query(
                        "UPDATE websocket_sessions 
                        SET status = 'closed', 
                            disconnected_at = $1
                        WHERE user_id = $2 AND status = 'active'"
                    )
                    .bind(Utc::now())
                    .bind(user_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| format!("Ошибка закрытия старых сессий: {}", e))?;
                    
                    // Обновляем статус пользователя
                    sqlx::query(
                        "UPDATE users SET status = 'online', last_seen = $1, updated_at = $1 WHERE id = $2"
                    )
                    .bind(Utc::now())
                    .bind(user_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| format!("Ошибка обновления статуса: {}", e))?;
                    
                    // Создаем новую сессию с полными данными
                    let session_id = Uuid::new_v4().to_string();
                    let connection_id = session_id.clone();
                    let now = Utc::now();
                    
                    sqlx::query(
                        "INSERT INTO websocket_sessions 
                        (user_id, connection_id, status, ip_address, user_agent, last_heartbeat, connected_at)
                        VALUES ($1, $2, 'active', $3::inet, $4, $5, $5)"
                    )
                    .bind(user_id)
                    .bind(&connection_id)  // Сохраняем правильный connection_id
                    .bind(ip_address)
                    .bind(user_agent)
                    .bind(now)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| format!("Ошибка создания сессии: {}", e))?;
                    
                    // Получаем личный сервер пользователя (первый созданный)
                    let user_guild_id: Option<i32> = sqlx::query_scalar(
                        "SELECT id FROM guilds WHERE owner_id = $1 LIMIT 1"
                    )
                    .bind(user_id)
                    .fetch_optional(&mut *transaction)
                    .await
                    .map_err(|e| format!("Ошибка получения сервера пользователя: {}", e))?;

                    let guild_id = user_guild_id.ok_or_else(|| "Не найден сервер пользователя".to_string())?;

                    // Аудит-лог с правильным guild_id
                    sqlx::query(
                        "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
                        VALUES ($1, $2, 'USER_LOGIN', $3, $4::jsonb, $5)"
                    )
                    .bind(guild_id)
                    .bind(user_id)
                    .bind(user_id)
                    .bind(json!({ "login": login }).to_string())
                    .bind(now)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| format!("Ошибка создания аудит-лога: {}", e))?;
                    
                    // Фиксируем транзакцию
                    transaction
                        .commit()
                        .await
                        .map_err(|e| format!("Ошибка сохранения данных: {}", e))?;
                    
                    println!("Пользователь {} (ID: {}) успешно вошел в систему", login, user_id);
                    Ok((true, user_id, session_id))
                },
                Err(_) => Ok((false, 0, "".to_string()))
            }
        }
        None => Ok((false, 0, "".to_string()))
    }
}