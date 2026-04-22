// src/logic/room.rs
use serde::{Deserialize, Serialize};
use tauri::command;
use chrono::{DateTime, Utc};
use crate::db::get_db_pool;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct RoomData {
    pub id: i32,
    pub name: String,
    #[sqlx(rename = "type")]
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

/// Структура для проверки существования
#[derive(sqlx::FromRow)]
struct ExistsResult {
    exists: Option<bool>,
}

/// Структура для ID результата
#[derive(sqlx::FromRow)]
struct IdResult {
    id: i32,
}

#[command]
pub async fn get_guild_rooms(guild_id: i32) -> Result<Vec<RoomData>, String> {
    let pool = get_db_pool();
    
    let rooms = sqlx::query_as::<_, RoomData>(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type,
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm.user_id) as member_count
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.guild_id = $1
        GROUP BY r.id
        ORDER BY r.position ASC, r.created_at ASC
        "#
    )
    .bind(guild_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки комнат: {}", e))?;
    
    Ok(rooms)
}

#[command]
pub async fn get_user_rooms(user_id: i32) -> Result<Vec<RoomData>, String> {
    let pool = get_db_pool();
    
    let rooms = sqlx::query_as::<_, RoomData>(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type,
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm2.user_id) as member_count
        FROM rooms r
        JOIN guild_members gm ON r.guild_id = gm.guild_id
        LEFT JOIN guild_members gm2 ON r.guild_id = gm2.guild_id
        WHERE gm.user_id = $1
        GROUP BY r.id
        ORDER BY r.guild_id, r.position ASC
        "#
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки комнат пользователя: {}", e))?;
    
    Ok(rooms)
}

#[command]
pub async fn get_room_by_id(room_id: i32) -> Result<Option<RoomData>, String> {
    let pool = get_db_pool();
    
    let room = sqlx::query_as::<_, RoomData>(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type,
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm.user_id) as member_count
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.id = $1
        GROUP BY r.id
        "#
    )
    .bind(room_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка загрузки комнаты: {}", e))?;
    
    Ok(room)
}

#[command]
pub async fn create_room(room_data: CreateRoomData) -> Result<RoomData, String> {
    let pool = get_db_pool();
    
    // Проверяем, является ли пользователь участником гильдии
    let is_member = sqlx::query_as::<_, ExistsResult>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM guild_members 
            WHERE guild_id = $1 AND user_id = $2
        ) as exists
        "#
    )
    .bind(room_data.guild_id)
    .bind(room_data.creator_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка проверки прав: {}", e))?
    .exists
    .unwrap_or(false);
    
    if !is_member {
        return Err("Вы не являетесь участником этого канала".to_string());
    }
    
    // Создаём комнату
    let room = sqlx::query_as::<_, RoomData>(
        r#"
        INSERT INTO rooms (name, type, guild_id, topic, bitrate, user_limit)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
            id,
            name,
            type,
            guild_id,
            topic,
            position,
            bitrate,
            user_limit,
            created_at,
            updated_at,
            NULL::bigint as member_count
        "#
    )
    .bind(&room_data.name)
    .bind(&room_data.room_type)
    .bind(room_data.guild_id)
    .bind(&room_data.topic)
    .bind(room_data.bitrate)
    .bind(room_data.user_limit)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка создания комнаты: {}", e))?;
    
    // Получаем актуальные данные с количеством участников
    let room_with_count = sqlx::query_as::<_, RoomData>(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type,
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm.user_id) as member_count
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.id = $1
        GROUP BY r.id
        "#
    )
    .bind(room.id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения данных комнаты: {}", e))?;
    
    Ok(room_with_count)
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
    let has_permission = sqlx::query_as::<_, ExistsResult>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM rooms r
            JOIN guild_members gm ON r.guild_id = gm.guild_id
            WHERE r.id = $1 AND gm.user_id = $2
        ) as exists
        "#
    )
    .bind(room_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка проверки прав: {}", e))?
    .exists
    .unwrap_or(false);
    
    if !has_permission {
        return Err("У вас нет прав для изменения этой комнаты".to_string());
    }
    
    // Обновляем комнату
    let room = sqlx::query_as::<_, RoomData>(
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
            type,
            guild_id,
            topic,
            position,
            bitrate,
            user_limit,
            created_at,
            updated_at,
            NULL::bigint as member_count
        "#
    )
    .bind(name)
    .bind(topic)
    .bind(bitrate)
    .bind(user_limit)
    .bind(room_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка обновления комнаты: {}", e))?;
    
    // Получаем актуальные данные с количеством участников
    let room_with_count = sqlx::query_as::<_, RoomData>(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type,
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT gm.user_id) as member_count
        FROM rooms r
        LEFT JOIN guild_members gm ON r.guild_id = gm.guild_id
        WHERE r.id = $1
        GROUP BY r.id
        "#
    )
    .bind(room.id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения данных комнаты: {}", e))?;
    
    Ok(room_with_count)
}

#[command]
pub async fn delete_room(room_id: i32, user_id: i32) -> Result<(), String> {
    let pool = get_db_pool();
    
    // Проверяем права (нужно быть создателем гильдии или иметь специальные права)
    let is_owner = sqlx::query_as::<_, ExistsResult>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM rooms r
            JOIN guilds g ON r.guild_id = g.id
            WHERE r.id = $1 AND g.owner_id = $2
        ) as exists
        "#
    )
    .bind(room_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка проверки прав: {}", e))?
    .exists
    .unwrap_or(false);
    
    if !is_owner {
        return Err("Только владелец канала может удалять комнаты".to_string());
    }
    
    // Удаляем комнату
    sqlx::query("DELETE FROM rooms WHERE id = $1")
        .bind(room_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Ошибка удаления комнаты: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn create_dm_room(user_id1: i32, user_id2: i32) -> Result<RoomData, String> {
    let pool = get_db_pool();
    
    // Проверяем, существует ли уже DM между этими пользователями
    let existing_dm = sqlx::query_as::<_, IdResult>(
        r#"
        SELECT r.id
        FROM rooms r
        JOIN dm_participants dp1 ON r.id = dp1.room_id
        JOIN dm_participants dp2 ON r.id = dp2.room_id
        WHERE r.type = 'dm' 
          AND dp1.user_id = $1 
          AND dp2.user_id = $2
        "#
    )
    .bind(user_id1)
    .bind(user_id2)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Ошибка проверки DM: {}", e))?;
    
    if let Some(dm) = existing_dm {
        // Возвращаем существующую DM комнату
        let room = sqlx::query_as::<_, RoomData>(
            r#"
            SELECT 
                r.id,
                r.name,
                r.type,
                r.guild_id,
                r.topic,
                r.position,
                r.bitrate,
                r.user_limit,
                r.created_at,
                r.updated_at,
                COUNT(DISTINCT dp.user_id) as member_count
            FROM rooms r
            LEFT JOIN dm_participants dp ON r.id = dp.room_id
            WHERE r.id = $1
            GROUP BY r.id
            "#
        )
        .bind(dm.id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Ошибка получения данных комнаты: {}", e))?;
        
        return Ok(room);
    }
    
    // Создаём новую DM комнату
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Ошибка начала транзакции: {}", e))?;
    
    let room = sqlx::query_as::<_, RoomData>(
        r#"
        INSERT INTO rooms (name, type)
        VALUES ($1, 'dm')
        RETURNING 
            id,
            name,
            type,
            guild_id,
            topic,
            position,
            bitrate,
            user_limit,
            created_at,
            updated_at,
            NULL::bigint as member_count
        "#
    )
    .bind(format!("DM_{}_{}", user_id1, user_id2))
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания DM комнаты: {}", e))?;
    
    // Добавляем участников
    sqlx::query(
        r#"
        INSERT INTO dm_participants (room_id, user_id)
        VALUES ($1, $2), ($1, $3)
        "#
    )
    .bind(room.id)
    .bind(user_id1)
    .bind(user_id2)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка добавления участников DM: {}", e))?;
    
    transaction
        .commit()
        .await
        .map_err(|e| format!("Ошибка фиксации транзакции: {}", e))?;
    
    let room_with_count = sqlx::query_as::<_, RoomData>(
        r#"
        SELECT 
            r.id,
            r.name,
            r.type,
            r.guild_id,
            r.topic,
            r.position,
            r.bitrate,
            r.user_limit,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT dp.user_id) as member_count
        FROM rooms r
        LEFT JOIN dm_participants dp ON r.id = dp.room_id
        WHERE r.id = $1
        GROUP BY r.id
        "#
    )
    .bind(room.id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Ошибка получения данных комнаты: {}", e))?;
    
    Ok(room_with_count)
}