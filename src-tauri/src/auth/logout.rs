use sqlx::postgres::PgPoolOptions;
use chrono::Utc;
use serde_json::json;

#[tauri::command]
pub async fn logout(user_id: i32, session_id: Option<String>) -> Result<bool, String> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect("postgresql://gbilly_sysadmin:BillyJinn228@localhost:5433/Voice-ka_Local")
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
    
    // 3. Если есть активная голосовая сессия - закрываем её и создаем лог
    let voice_session = sqlx::query_as::<_, (i32, uuid::Uuid, chrono::DateTime<Utc>)>(
        "UPDATE voice_states 
        SET left_at = $1
        WHERE user_id = $2 AND left_at IS NULL
        RETURNING room_id, session_id, joined_at"
    )
    .bind(Utc::now())
    .bind(user_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка обновления голосового состояния: {}", e))?;
    
    // Создаем запись в voice_activity_logs, если была активная голосовая сессия
    if let Some((room_id, session_uuid, joined_at)) = voice_session {
        sqlx::query(
            "INSERT INTO voice_activity_logs 
            (user_id, room_id, session_id, joined_at, left_at, packets_sent, packets_lost, created_at)
            VALUES ($1, $2, $3, $4, $5, 0, 0, $6)"
        )
        .bind(user_id)
        .bind(room_id)
        .bind(session_uuid)
        .bind(joined_at)
        .bind(Utc::now())
        .bind(Utc::now())
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Ошибка создания лога голосовой активности: {}", e))?;
    }
    
    // 4. Обновляем статус пользователя только если нет других активных сессий
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
    
    // Получаем личный сервер пользователя
    let user_guild_id: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM guilds WHERE owner_id = $1 LIMIT 1"
    )
    .bind(user_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка получения сервера пользователя: {}", e))?;

    let guild_id = user_guild_id.ok_or_else(|| "Не найден сервер пользователя".to_string())?;

    // Аудит-лог
    sqlx::query(
        "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
        VALUES ($1, $2, 'USER_LOGOUT', $3, $4::jsonb, $5)"
    )
    .bind(guild_id)
    .bind(user_id)
    .bind(user_id)
    .bind(json!({"session_id": session_id, "active_sessions_remaining": active_sessions}).to_string())
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания аудит-лога: {}", e))?;
    
    // Фиксируем транзакцию
    transaction
        .commit()
        .await
        .map_err(|e| format!("Ошибка сохранения изменений: {}", e))?;
    
    println!("Пользователь с ID {} успешно выполнил выход из системы", user_id);
    
    Ok(true)
}