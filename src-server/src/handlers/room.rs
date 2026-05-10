// src-server/src/handlers/room.rs
use crate::db::get_db_pool;
use crate::ws::manager::SubscriptionManager;
use crate::ws::messages::WsMessage;
use std::sync::Arc;
use chrono::Utc;
use serde_json::json;
use sqlx::Row;  // 👈 Добавить импорт

#[derive(Debug, serde::Deserialize)]
pub struct CreateRoomData {
    pub name: String,
    pub room_type: String,  // должно быть room_type, не type
    pub topic: Option<String>,
    pub bitrate: Option<i32>,
    pub user_limit: Option<i32>,
}

pub async fn handle_get_guild_rooms(guild_id: i32) -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool();

    // ✅ ИСПРАВЛЕНО: используем query вместо query!
    let rooms = sqlx::query(
        "SELECT r.id, r.name, r.type, r.topic, r.position, r.bitrate, r.user_limit,
                r.created_at, r.updated_at,
                COUNT(DISTINCT gm.user_id) as member_count
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.guild_id = $1
        GROUP BY r.id
        ORDER BY r.position ASC"
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get rooms: {}", e))?;

    Ok(rooms.into_iter().map(|row| {
        let id: i32 = row.get(0);
        let name: String = row.get(1);
        let room_type: String = row.get(2);
        let topic: Option<String> = row.get(3);
        let position: Option<i32> = row.get(4);
        let bitrate: Option<i32> = row.get(5);
        let user_limit: Option<i32> = row.get(6);
        let created_at: chrono::DateTime<chrono::Utc> = row.get(7);
        let updated_at: chrono::DateTime<chrono::Utc> = row.get(8);
        let member_count: i64 = row.get(9);
        
        json!({
            "id": id,
            "name": name,
            "type": room_type,
            "topic": topic,
            "position": position,
            "bitrate": bitrate,
            "user_limit": user_limit,
            "created_at": created_at.to_rfc3339(),
            "updated_at": updated_at.to_rfc3339(),
            "member_count": member_count
        })
    }).collect())
}

    pub async fn handle_create_room(
        guild_id: i32,
        creator_id: i32,
        data: CreateRoomData,
        manager: Arc<SubscriptionManager>,
    ) -> Result<serde_json::Value, String> {
        println!("📝 [SERVER] handle_create_room called");
        println!("  guild_id: {}", guild_id);
        println!("  creator_id: {}", creator_id);
        println!("  data: {:?}", data);
        
        let pool = get_db_pool();

        let is_member: Option<bool> = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2)"
        )
        .bind(guild_id)
        .bind(creator_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let is_member = is_member.unwrap_or(false);
        println!("  is_member: {}", is_member);

        if !is_member {
            return Err("You are not a member of this guild".to_string());
        }

        let max_position: Option<i32> = sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), -1) FROM rooms WHERE guild_id = $1"
        )
        .bind(guild_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let max_position = max_position.unwrap_or(-1);
        let now = Utc::now();

        let room_row = sqlx::query(
            "INSERT INTO rooms (name, type, guild_id, topic, position, bitrate, user_limit, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            RETURNING id, name, type, topic, position, bitrate, user_limit, created_at, updated_at"
        )
        .bind(&data.name)
        .bind(&data.room_type)
        .bind(guild_id)
        .bind(&data.topic)
        .bind(max_position + 1)
        .bind(data.bitrate)
        .bind(data.user_limit)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to create room: {}", e))?;

        let id: i32 = room_row.get(0);
        let name: String = room_row.get(1);
        let room_type: String = room_row.get(2);
        let topic: Option<String> = room_row.get(3);
        let position: i32 = room_row.get(4);
        let bitrate: Option<i32> = room_row.get(5);
        let user_limit: Option<i32> = room_row.get(6);
        let created_at: chrono::DateTime<chrono::Utc> = room_row.get(7);
        let updated_at: chrono::DateTime<chrono::Utc> = room_row.get(8);

        let room_data = json!({
            "id": id,
            "name": name,
            "type": room_type,
            "guild_id": guild_id,
            "topic": topic,
            "position": position,
            "bitrate": bitrate,
            "user_limit": user_limit,
            "created_at": created_at.to_rfc3339(),
            "updated_at": updated_at.to_rfc3339(),
            "member_count": 0
        });

        println!("✅ [SERVER] Room created: {:?}", room_data);
        println!("📡 [SERVER] Broadcasting to guild {}", guild_id);

        let ws_msg = WsMessage::new("room_created", room_data.clone())
            .with_guild(guild_id);

        manager.broadcast_to_guild(guild_id, ws_msg).await;
        
        println!("✅ [SERVER] Broadcast sent");

        Ok(room_data)
    }

pub async fn handle_get_room_by_id(room_id: i32) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    let room = sqlx::query(
        "SELECT r.id, r.name, r.type, r.guild_id, r.topic, r.position, r.bitrate, r.user_limit,
                r.created_at, r.updated_at
        FROM rooms r
        WHERE r.id = $1"
    )
    .bind(room_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to get room: {}", e))?;

    match room {
        Some(row) => {
            let id: i32 = row.get(0);
            let name: String = row.get(1);
            let room_type: String = row.get(2);
            let guild_id: Option<i32> = row.get(3);
            let topic: Option<String> = row.get(4);
            let position: Option<i32> = row.get(5);
            let bitrate: Option<i32> = row.get(6);
            let user_limit: Option<i32> = row.get(7);
            let created_at: chrono::DateTime<chrono::Utc> = row.get(8);
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(9);
            
            // Получаем количество участников в комнате (для голосовых комнат)
            let member_count: i64 = if room_type == "voice" {
                sqlx::query_scalar(
                    "SELECT COUNT(*) FROM voice_states WHERE room_id = $1"
                )
                .bind(room_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0)
            } else {
                0
            };
            
            Ok(json!({
                "id": id,
                "name": name,
                "room_type": room_type,
                "guild_id": guild_id,
                "topic": topic,
                "position": position,
                "bitrate": bitrate,
                "user_limit": user_limit,
                "created_at": created_at.to_rfc3339(),
                "updated_at": updated_at.to_rfc3339(),
                "member_count": member_count
            }))
        }
        None => Err("Room not found".to_string())
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateRoomData {
    pub name: String,
    pub topic: Option<String>,
    pub bitrate: Option<i32>,
    pub user_limit: Option<i32>,
}

pub async fn handle_update_room(
    user_id: i32,
    room_id: i32,
    data: UpdateRoomData,
    manager: Arc<SubscriptionManager>,
) -> Result<serde_json::Value, String> {
    let pool = get_db_pool();

    // Получаем guild_id комнаты
    let guild_id: Option<i32> = sqlx::query_scalar(
        "SELECT guild_id FROM rooms WHERE id = $1"
    )
    .bind(room_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to get room: {}", e))?;

    let guild_id = match guild_id {
        Some(id) => id,
        None => return Err("Room not found".to_string()),
    };

    // Проверяем права пользователя
    let permissions = crate::handlers::guild::handle_get_user_permissions_in_guild(user_id, guild_id).await?;
    let has_edit_rooms = (permissions & 8) != 0; // EDIT_ROOMS = 8

    if !has_edit_rooms {
        return Err("You don't have permission to edit this room".to_string());
    }

    let now = Utc::now();

    let room_row = sqlx::query(
        "UPDATE rooms 
         SET name = $1, topic = $2, bitrate = $3, user_limit = $4, updated_at = $5
         WHERE id = $6
         RETURNING id, name, type, topic, position, bitrate, user_limit, created_at, updated_at"
    )
    .bind(&data.name)
    .bind(&data.topic)
    .bind(data.bitrate)
    .bind(data.user_limit)
    .bind(now)
    .bind(room_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to update room: {}", e))?;

    match room_row {
        Some(row) => {
            let id: i32 = row.get(0);
            let name: String = row.get(1);
            let room_type: String = row.get(2);
            let topic: Option<String> = row.get(3);
            let position: i32 = row.get(4);
            let bitrate: Option<i32> = row.get(5);
            let user_limit: Option<i32> = row.get(6);
            let created_at: chrono::DateTime<chrono::Utc> = row.get(7);
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(8);
            
            let result = json!({
                "id": id,
                "name": name,
                "type": room_type,
                "guild_id": guild_id,
                "topic": topic,
                "position": position,
                "bitrate": bitrate,
                "user_limit": user_limit,
                "created_at": created_at.to_rfc3339(),
                "updated_at": updated_at.to_rfc3339(),
                "member_count": 0
            });

            // Уведомляем всех в гильдии об обновлении комнаты
            let ws_msg = WsMessage::new("room_updated", result.clone())
                .with_guild(guild_id);
            manager.broadcast_to_guild(guild_id, ws_msg).await;

            Ok(result)
        }
        None => Err("Room not found".to_string())
    }
}