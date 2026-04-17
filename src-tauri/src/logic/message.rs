// src/logic/message.rs
use serde::{Deserialize, Serialize};
use tauri::command;
use chrono::{DateTime, Utc};
use crate::db::get_db_pool;

#[derive(Debug, Serialize, Deserialize, Clone)]
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
    let pool = get_db_pool();
    
    let messages = sqlx::query!(
        r#"
        SELECT 
            m.id,
            m.room_id,
            m.user_id,
            m.content,
            m.attachments as "attachments: serde_json::Value",
            m.reply_to_id,
            m.edited_at,
            m.deleted_at,
            m.created_at,
            u.username as author_name
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.room_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC
        "#,
        room_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки сообщений: {}", e))?
    .into_iter()
    .map(|row| MessageData {
        id: row.id,
        room_id: row.room_id,
        user_id: row.user_id,
        content: row.content,
        attachments: row.attachments.unwrap_or(serde_json::json!([])),
        reply_to_id: row.reply_to_id,
        edited_at: row.edited_at,
        deleted_at: row.deleted_at,
        created_at: row.created_at,
        author_name: row.author_name,
    })
    .collect();
    
    Ok(messages)
}