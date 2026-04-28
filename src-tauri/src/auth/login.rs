// login.rs - исправленная версия
use serde_json::json;
use argon2::{
    password_hash::{PasswordHash, PasswordVerifier},
    Argon2
};
use chrono::Utc;
use uuid::Uuid;
use crate::db::get_db_pool;
use crate::ws::{SubscriptionManager, messages::WsMessage};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn login(
    login: String, 
    password: String, 
    ip_address: Option<String>, 
    user_agent: Option<String>,
    ws_manager: State<'_, Arc<SubscriptionManager>>
) -> Result<(bool, i32, String), String> {
    let pool = get_db_pool();
    
    // Получаем данные пользователя
    let user: Option<(i32, String)> = sqlx::query_as(
        "SELECT id, password_hash FROM users WHERE username = $1 OR email = $1"
    )
    .bind(&login)
    .fetch_optional(pool)
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
                    
                    // Создаем новую сессию
                    let session_id = Uuid::new_v4().to_string();
                    let now = Utc::now();
                    
                    sqlx::query(
                        "INSERT INTO websocket_sessions 
                        (user_id, connection_id, status, ip_address, user_agent, last_heartbeat, connected_at)
                        VALUES ($1, $2, 'active', $3::inet, $4, $5, $5)"
                    )
                    .bind(user_id)
                    .bind(&session_id)
                    .bind(&ip_address)
                    .bind(&user_agent)
                    .bind(now)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| format!("Ошибка создания сессии: {}", e))?;
                    
                    // Получаем личный сервер пользователя для аудит-лога
                    let user_guild_id: Option<i32> = sqlx::query_scalar(
                        "SELECT id FROM guilds WHERE owner_id = $1 LIMIT 1"
                    )
                    .bind(user_id)
                    .fetch_optional(&mut *transaction)
                    .await
                    .map_err(|e| format!("Ошибка получения сервера пользователя: {}", e))?;

                    if let Some(guild_id) = user_guild_id {
                        // Аудит-лог
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
                    }
                    
                    // Фиксируем транзакцию
                    transaction
                        .commit()
                        .await
                        .map_err(|e| format!("Ошибка сохранения данных: {}", e))?;
                    
                    let user_guilds: Vec<i32> = sqlx::query_scalar(
                        "SELECT guild_id FROM guild_members WHERE user_id = $1"
                    )
                    .bind(user_id)
                    .fetch_all(pool)
                    .await
                    .unwrap_or_default();

                    // Отправляем уведомление о входе пользователя во все его гильдии
                    let user_status = serde_json::json!({
                        "user_id": user_id,
                        "username": login,
                        "avatar": serde_json::Value::Null,
                        "status": "online"
                    });

                    let ws_message = WsMessage::new(
                        "user_status_changed",
                        user_status
                    );

                    for guild_id in user_guilds {
                        ws_manager.broadcast_to_guild(guild_id, ws_message.clone()).await;
                    }

                    println!("Пользователь {} (ID: {}) успешно вошел в систему", login, user_id);
                    Ok((true, user_id, session_id))
                },
                Err(_) => {
                    println!("❌ Неверный пароль для пользователя {}", login);
                    Ok((false, 0, String::new()))
                }
            }
        }
        None => {
            println!("❌ Пользователь {} не найден", login);
            Ok((false, 0, String::new()))
        }
    }
}