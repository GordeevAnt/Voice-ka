// src/logic/message.rs
use serde::{Deserialize, Serialize};
use tauri::command;
use chrono::{DateTime, Utc};
use crate::db::get_db_pool;
use crate::logic::user::get_current_user;
use crate::ws::{SubscriptionManager, messages::WsMessage};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct MessageData {
    pub id: i64,
    pub room_id: i32,
    pub user_id: i32,
    pub content: String,
    pub attachments: serde_json::Value,
    pub reply_to_id: Option<i64>,
    pub edited_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub author_name: String,
}

#[command]
pub async fn get_room_messages(room_id: i32) -> Result<Vec<MessageData>, String> {
    let pool = get_db_pool().ok_or("База данных не подключена")?;
    
    let messages = sqlx::query_as::<_, MessageData>(
        r#"
        SELECT 
            m.id,
            m.room_id,
            m.user_id,
            m.content,
            COALESCE(m.attachments, '[]'::jsonb) as attachments,
            m.reply_to_id,
            m.edited_at,
            m.deleted_at,
            m.created_at,
            u.username as author_name
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.room_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC
        "#
    )
    .bind(room_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки сообщений: {}", e))?;
    
    Ok(messages)
}

#[command]
pub async fn send_message(
    room_id: i32, 
    content: String, 
    session_id: Option<String>,
    ws_manager: tauri::State<'_, Arc<SubscriptionManager>>
) -> Result<MessageData, String> {
    let pool = get_db_pool().ok_or("База данных не подключена")?;
    
    let current_user = get_current_user(session_id)
        .await
        .map_err(|e| format!("Ошибка получения пользователя: {}", e))?;
    
    let user_id = current_user.id;
    
    let message = sqlx::query_as::<_, MessageData>(
        r#"
        INSERT INTO messages (room_id, user_id, content, attachments)
        VALUES ($1, $2, $3, '[]'::jsonb)
        RETURNING 
            id, 
            room_id, 
            user_id, 
            content,
            attachments,
            reply_to_id, 
            edited_at, 
            deleted_at, 
            created_at,
            (SELECT username FROM users WHERE id = $2) as author_name
        "#
    )
    .bind(room_id)
    .bind(user_id)
    .bind(content)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка отправки сообщения: {}", e))?;
    
    // Отправляем через WebSocket всем в комнате
    let ws_message = WsMessage::new(
        "new_message",
        serde_json::to_value(&message).unwrap()
    ).with_room(room_id);
    
    ws_manager.broadcast_to_room(room_id, ws_message).await;
    
    Ok(message)
}