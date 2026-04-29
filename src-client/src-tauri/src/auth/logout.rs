// logout.rs - с WebSocket уведомлениями
use sqlx::postgres::PgPoolOptions;
use chrono::Utc;
use serde_json::json;
use crate::ws::{SubscriptionManager, WsMessage};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn logout(
    user_id: i32, 
    session_id: Option<String>,
    ws_manager: State<'_, Arc<SubscriptionManager>>
) -> Result<bool, String> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect("postgresql://gbilly_sysadmin:BillyJinn228@localhost:5433/Voice-ka_Local")
        .await
        .map_err(|e| e.to_string())?;
    
    // Получаем гильдии пользователя ДО выхода для отправки уведомлений
    let user_guilds: Vec<i32> = sqlx::query_scalar(
        "SELECT guild_id FROM guild_members WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    
    // Получаем данные пользователя для уведомления
    let user_data = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT username, avatar FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    // Начинаем транзакцию для атомарности операций
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Ошибка начала транзакции: {}", e))?;
    
    // 1. Закрываем WebSocket сессию(и)
    if let Some(session_id_str) = &session_id {
        sqlx::query(
            "UPDATE websocket_sessions 
            SET status = 'closed', 
                disconnected_at = $1
            WHERE user_id = $2 AND connection_id = $3 AND status = 'active'"
        )
        .bind(Utc::now())
        .bind(user_id)
        .bind(session_id_str)
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Ошибка закрытия сессии: {}", e))?;
    } else {
        // Закрываем все активные сессии пользователя
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
        .map_err(|e| format!("Ошибка закрытия сессий: {}", e))?;
    }
    
    // 2. Проверяем, есть ли у пользователя другие активные сессии
    let active_sessions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM websocket_sessions 
        WHERE user_id = $1 AND status = 'active'"
    )
    .bind(user_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка проверки активных сессий: {}", e))?;
    
    // 3. Обновляем статус пользователя только если нет других активных сессий
    if active_sessions == 0 {
        sqlx::query(
            "UPDATE users 
            SET status = 'offline', 
                last_seen = $1,
                updated_at = $1
            WHERE id = $2"
        )
        .bind(Utc::now())
        .bind(user_id)
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Ошибка обновления статуса пользователя: {}", e))?;
        
        println!("Пользователь с ID {} переведен в статус offline (нет активных сессий)", user_id);
    } else {
        println!("Пользователь с ID {} остался online (активных сессий: {})", user_id, active_sessions);
    }
    
    // Фиксируем транзакцию
    transaction
        .commit()
        .await
        .map_err(|e| format!("Ошибка сохранения изменений: {}", e))?;
    
    // Отправляем уведомление о выходе пользователя во все его гильдии
    if active_sessions == 0 {
        if let Some((username, avatar)) = user_data {
            let user_status = json!({
                "user_id": user_id,
                "username": username,
                "avatar": avatar,
                "status": "offline"
            });
            
            let ws_message = WsMessage::new(
                "user_status_changed",
                user_status
            );
            
            // Отправляем уведомление во все гильдии пользователя
            for guild_id in &user_guilds {
                println!("📤 Отправка уведомления о выходе в гильдию {}", guild_id);
                ws_manager.broadcast_to_guild(*guild_id, ws_message.clone()).await;
            }
        }
    }
    
    println!("Пользователь с ID {} успешно выполнил выход из системы", user_id);
    
    Ok(true)
}