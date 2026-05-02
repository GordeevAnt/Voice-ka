// src-server/src/handlers/message.rs
use crate::db::get_db_pool;
use crate::ws::manager::SubscriptionManager;
use crate::ws::messages::WsMessage;
use std::sync::Arc;
use serde_json::json;

pub async fn handle_get_room_messages(room_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    let messages = sqlx::query!(
        "SELECT m.id, m.room_id, m.user_id, m.content, m.attachments,
                m.reply_to_id, m.edited_at, m.deleted_at, m.created_at,
                u.username as author_name
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.room_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC",
        room_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get messages: {}", e))?;

    Ok(messages.into_iter().map(|m| {
        json!({
            "id": m.id,
            "room_id": m.room_id,
            "user_id": m.user_id,
            "content": m.content,
            "attachments": m.attachments,
            "reply_to_id": m.reply_to_id,
            "edited_at": m.edited_at.map(|d| d.to_rfc3339()),
            "deleted_at": m.deleted_at.map(|d| d.to_rfc3339()),
            "created_at": m.created_at.to_rfc3339(),
            "author_name": m.author_name
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

    let msg = sqlx::query!(
        "INSERT INTO messages (room_id, user_id, content, attachments)
            VALUES ($1, $2, $3, '[]'::jsonb)
            RETURNING id, room_id, user_id, content, created_at",
        room_id,
        user_id,
        content
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to save message: {}", e))?;

    let message_data = json!({
        "id": msg.id,
        "room_id": msg.room_id,
        "user_id": msg.user_id,
        "content": msg.content,
        "author_name": username,
        "created_at": msg.created_at.to_rfc3339(),
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