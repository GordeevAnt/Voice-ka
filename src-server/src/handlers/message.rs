// src-server/src/handlers/message.rs
use crate::db::get_db_pool;
use crate::ws::manager::SubscriptionManager;
use crate::ws::messages::WsMessage;
use std::sync::Arc;
use serde_json::json;
use sqlx::Row;

pub async fn handle_get_room_messages(room_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    let messages = sqlx::query(
        "SELECT m.id, m.room_id, m.user_id, m.content, m.attachments,
                m.reply_to_id, m.edited_at, m.deleted_at, m.created_at,
                u.username as author_name
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.room_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC"
    )
    .bind(room_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get messages: {}", e))?;

    Ok(messages.into_iter().map(|m| {
        let id: i64 = m.get(0);
        let msg_room_id: i32 = m.get(1);
        let user_id: i32 = m.get(2);
        let content: String = m.get(3);
        let attachments: serde_json::Value = m.get(4);
        let reply_to_id: Option<i64> = m.get(5);
        let edited_at: Option<chrono::DateTime<chrono::Utc>> = m.get(6);
        let deleted_at: Option<chrono::DateTime<chrono::Utc>> = m.get(7);
        let created_at: chrono::DateTime<chrono::Utc> = m.get(8);
        let author_name: String = m.get(9);

        json!({
            "id": id,
            "room_id": msg_room_id,
            "user_id": user_id,
            "content": content,
            "attachments": attachments,
            "reply_to_id": reply_to_id,
            "edited_at": edited_at.map(|d| d.to_rfc3339()),
            "deleted_at": deleted_at.map(|d| d.to_rfc3339()),
            "created_at": created_at.to_rfc3339(),
            "author_name": author_name
        })
    }).collect())
}

pub async fn handle_send_message(
    user_id: i32,
    username: &str,
    room_id: i32,
    content: &str,
    manager: Arc<SubscriptionManager>,
) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    let msg = sqlx::query(
        "INSERT INTO messages (room_id, user_id, content, attachments)
            VALUES ($1, $2, $3, '[]'::jsonb)
            RETURNING id, room_id, user_id, content, created_at"
    )
    .bind(room_id)
    .bind(user_id)
    .bind(content)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to save message: {}", e))?;

    let msg_id: i64 = msg.get(0);
    let msg_room_id: i32 = msg.get(1);
    let msg_user_id: i32 = msg.get(2);
    let msg_content: String = msg.get(3);
    let msg_created_at: chrono::DateTime<chrono::Utc> = msg.get(4);

    let message_data = json!({
        "id": msg_id,
        "room_id": msg_room_id,
        "user_id": msg_user_id,
        "content": msg_content,
        "author_name": username,
        "created_at": msg_created_at.to_rfc3339(),
        "attachments": [],
        "reply_to_id": null,
        "edited_at": null,
        "deleted_at": null
    });

    // Отправляем всем в комнате
    let ws_msg = WsMessage::new("new_message", message_data.clone())
        .with_room(room_id);

    manager.broadcast_to_room(room_id, ws_msg).await;

    Ok(message_data)
}