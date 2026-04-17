// src/logic/room.rs
use serde::{Deserialize, Serialize};
use tauri::command;
use chrono::{DateTime, Utc};
use crate::db::get_db_pool;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoomData {
    pub id: i32,
    pub name: String,
    pub room_type: String,
    pub guild_id: Option<i32>,
    pub topic: Option<String>,
    pub position: Option<i32>,
    pub bitrate: Option<i32>,
    pub user_limit: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub member_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateRoomData {
    pub name: String,
    pub room_type: String,
    pub guild_id: i32,
    pub topic: Option<String>,
    pub bitrate: Option<i32>,
    pub user_limit: Option<i32>,
    pub creator_id: i32,
}

#[command]
pub async fn get_guild_rooms(guild_id: i32) -> Result<Vec<RoomData>, String> {
    let pool = get_db_pool();
    
    let rooms = sqlx::query!(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type as "room_type",
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm.user_id) as "member_count"
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.guild_id = $1
        GROUP BY r.id
        ORDER BY r.position ASC, r.created_at ASC
        "#,
        guild_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки комнат: {}", e))?
    .into_iter()
    .map(|row| RoomData {
        id: row.id,
        name: row.name,
        room_type: row.room_type,
        guild_id: row.guild_id,
        topic: row.topic,
        position: row.position,
        bitrate: row.bitrate,
        user_limit: row.user_limit,
        created_at: row.created_at.unwrap_or_else(Utc::now),
        updated_at: row.updated_at.unwrap_or_else(Utc::now),
        member_count: row.member_count,
    })
    .collect();
    
    Ok(rooms)
}

#[command]
pub async fn get_user_rooms(user_id: i32) -> Result<Vec<RoomData>, String> {
    let pool = get_db_pool();
    
    let rooms = sqlx::query!(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type as "room_type",
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm2.user_id) as "member_count"
        FROM rooms r
        JOIN guild_members gm ON r.guild_id = gm.guild_id
        LEFT JOIN guild_members gm2 ON r.guild_id = gm2.guild_id
        WHERE gm.user_id = $1
        GROUP BY r.id
        ORDER BY r.guild_id, r.position ASC
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки комнат пользователя: {}", e))?
    .into_iter()
    .map(|row| RoomData {
        id: row.id,
        name: row.name,
        room_type: row.room_type,
        guild_id: row.guild_id,
        topic: row.topic,
        position: row.position,
        bitrate: row.bitrate,
        user_limit: row.user_limit,
        created_at: row.created_at.unwrap_or_else(Utc::now),
        updated_at: row.updated_at.unwrap_or_else(Utc::now),
        member_count: row.member_count,
    })
    .collect();
    
    Ok(rooms)
}

#[command]
pub async fn get_room_by_id(room_id: i32) -> Result<Option<RoomData>, String> {
    let pool = get_db_pool();
    
    let room = sqlx::query!(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type as "room_type",
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm.user_id) as "member_count"
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.id = $1
        GROUP BY r.id
        "#,
        room_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки комнаты: {}", e))?
    .map(|row| RoomData {
        id: row.id,
        name: row.name,
        room_type: row.room_type,
        guild_id: row.guild_id,
        topic: row.topic,
        position: row.position,
        bitrate: row.bitrate,
        user_limit: row.user_limit,
        created_at: row.created_at.unwrap_or_else(Utc::now),
        updated_at: row.updated_at.unwrap_or_else(Utc::now),
        member_count: row.member_count,
    });
    
    Ok(room)
}

#[command]
pub async fn create_room(room_data: CreateRoomData) -> Result<RoomData, String> {
    let pool = get_db_pool();
    
    // Проверяем, является ли пользователь участником гильдии
    let is_member = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM guild_members 
            WHERE guild_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        room_data.guild_id,
        room_data.creator_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка проверки прав: {}", e))?;
    
    if !is_member.exists {
        return Err("Вы не являетесь участником этого канала".to_string());
    }
    
    // Создаём комнату
    let room = sqlx::query!(
        r#"
        INSERT INTO rooms (name, type, guild_id, topic, bitrate, user_limit)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
            id,
            name,
            type as "room_type",
            guild_id,
            topic,
            position,
            bitrate,
            user_limit,
            created_at,
            updated_at
        "#,
        room_data.name,
        room_data.room_type,
        room_data.guild_id,
        room_data.topic,
        room_data.bitrate,
        room_data.user_limit
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка создания комнаты: {}", e))?;
    
    // Получаем актуальные данные с количеством участников
    let room_with_count = sqlx::query!(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type as "room_type",
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm.user_id) as "member_count"
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.id = $1
        GROUP BY r.id
        "#,
        room.id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения данных комнаты: {}", e))?;
    
    Ok(RoomData {
        id: room_with_count.id,
        name: room_with_count.name,
        room_type: room_with_count.room_type,
        guild_id: room_with_count.guild_id,
        topic: room_with_count.topic,
        position: room_with_count.position,
        bitrate: room_with_count.bitrate,
        user_limit: room_with_count.user_limit,
        created_at: room_with_count.created_at.unwrap_or_else(Utc::now),
        updated_at: room_with_count.updated_at.unwrap_or_else(Utc::now),
        member_count: room_with_count.member_count,
    })
}

#[command]
pub async fn update_room(
    room_id: i32,
    name: Option<String>,
    topic: Option<String>,
    bitrate: Option<i32>,
    user_limit: Option<i32>,
    user_id: i32,
) -> Result<RoomData, String> {
    let pool = get_db_pool();
    
    // Проверяем права (нужно быть участником гильдии)
    let has_permission = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM rooms r
            JOIN guild_members gm ON r.guild_id = gm.guild_id
            WHERE r.id = $1 AND gm.user_id = $2
        ) as "exists!"
        "#,
        room_id,
        user_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка проверки прав: {}", e))?;
    
    if !has_permission.exists {
        return Err("У вас нет прав для изменения этой комнаты".to_string());
    }
    
    // Обновляем комнату
    let room = sqlx::query!(
        r#"
        UPDATE rooms 
        SET 
            name = COALESCE($1, name),
            topic = COALESCE($2, topic),
            bitrate = COALESCE($3, bitrate),
            user_limit = COALESCE($4, user_limit),
            updated_at = NOW()
        WHERE id = $5
        RETURNING 
            id,
            name,
            type as "room_type",
            guild_id,
            topic,
            position,
            bitrate,
            user_limit,
            created_at,
            updated_at
        "#,
        name,
        topic,
        bitrate,
        user_limit,
        room_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка обновления комнаты: {}", e))?;
    
    // Получаем актуальные данные с количеством участников
    let room_with_count = sqlx::query!(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type as "room_type",
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm.user_id) as "member_count"
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.id = $1
        GROUP BY r.id
        "#,
        room.id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения данных комнаты: {}", e))?;
    
    Ok(RoomData {
        id: room_with_count.id,
        name: room_with_count.name,
        room_type: room_with_count.room_type,
        guild_id: room_with_count.guild_id,
        topic: room_with_count.topic,
        position: room_with_count.position,
        bitrate: room_with_count.bitrate,
        user_limit: room_with_count.user_limit,
        created_at: room_with_count.created_at.unwrap_or_else(Utc::now),
        updated_at: room_with_count.updated_at.unwrap_or_else(Utc::now),
        member_count: room_with_count.member_count,
    })
}

#[command]
pub async fn delete_room(room_id: i32, user_id: i32) -> Result<(), String> {
    let pool = get_db_pool();
    
    // Проверяем права (нужно быть создателем гильдии или иметь специальные права)
    let is_owner = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM rooms r
            JOIN guilds g ON r.guild_id = g.id
            WHERE r.id = $1 AND g.owner_id = $2
        ) as "exists!"
        "#,
        room_id,
        user_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка проверки прав: {}", e))?;
    
    if !is_owner.exists {
        return Err("Только владелец канала может удалять комнаты".to_string());
    }
    
    // Удаляем комнату
    sqlx::query!(
        r#"
        DELETE FROM rooms
        WHERE id = $1
        "#,
        room_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Ошибка удаления комнаты: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn create_dm_room(user_id1: i32, user_id2: i32) -> Result<RoomData, String> {
    let pool = get_db_pool();
    
    // Проверяем, существует ли уже DM между этими пользователями
    let existing_dm = sqlx::query!(
        r#"
        SELECT r.id
        FROM rooms r
        JOIN dm_participants dp1 ON r.id = dp1.room_id
        JOIN dm_participants dp2 ON r.id = dp2.room_id
        WHERE r.type = 'dm' 
          AND dp1.user_id = $1 
          AND dp2.user_id = $2
        "#,
        user_id1,
        user_id2
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка проверки DM: {}", e))?;
    
    if let Some(dm) = existing_dm {
        // Возвращаем существующую DM комнату
        let room = sqlx::query!(
            r#"
            SELECT 
                r.id,
                r.name,
                r.type as "room_type",
                r.guild_id,
                r.topic,
                r.position,
                r.bitrate,
                r.user_limit,
                r.created_at,
                r.updated_at,
                COUNT(DISTINCT dp.user_id) as "member_count"
            FROM rooms r
            LEFT JOIN dm_participants dp ON r.id = dp.room_id
            WHERE r.id = $1
            GROUP BY r.id
            "#,
            dm.id
        )
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Ошибка получения данных комнаты: {}", e))?;
        
        return Ok(RoomData {
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            guild_id: room.guild_id,
            topic: room.topic,
            position: room.position,
            bitrate: room.bitrate,
            user_limit: room.user_limit,
            created_at: room.created_at.unwrap_or_else(Utc::now),
            updated_at: room.updated_at.unwrap_or_else(Utc::now),
            member_count: room.member_count,
        });
    }
    
    // Создаём новую DM комнату
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Ошибка начала транзакции: {}", e))?;
    
    let room = sqlx::query!(
        r#"
        INSERT INTO rooms (name, type)
        VALUES ($1, 'dm')
        RETURNING 
            id,
            name,
            type as "room_type",
            guild_id,
            topic,
            position,
            bitrate,
            user_limit,
            created_at,
            updated_at
        "#,
        format!("DM_{}_{}", user_id1, user_id2)
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания DM комнаты: {}", e))?;
    
    // Добавляем участников
    sqlx::query!(
        r#"
        INSERT INTO dm_participants (room_id, user_id)
        VALUES ($1, $2), ($1, $3)
        "#,
        room.id,
        user_id1,
        user_id2
    )
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка добавления участников DM: {}", e))?;
    
    transaction
        .commit()
        .await
        .map_err(|e| format!("Ошибка фиксации транзакции: {}", e))?;
    
    let room_with_count = sqlx::query!(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type as "room_type",
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT dp.user_id) as "member_count"
        FROM rooms r
        LEFT JOIN dm_participants dp ON r.id = dp.room_id
        WHERE r.id = $1
        GROUP BY r.id
        "#,
        room.id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения данных комнаты: {}", e))?;
    
    Ok(RoomData {
        id: room_with_count.id,
        name: room_with_count.name,
        room_type: room_with_count.room_type,
        guild_id: room_with_count.guild_id,
        topic: room_with_count.topic,
        position: room_with_count.position,
        bitrate: room_with_count.bitrate,
        user_limit: room_with_count.user_limit,
        created_at: room_with_count.created_at.unwrap_or_else(Utc::now),
        updated_at: room_with_count.updated_at.unwrap_or_else(Utc::now),
        member_count: room_with_count.member_count,
    })
}