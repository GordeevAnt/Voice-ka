use sqlx::postgres::PgPoolOptions;
use chrono::Utc;

#[tauri::command]
pub async fn logout(user_id: i32, session_id: Option<String>) -> Result<bool, String> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect("postgresql://gbilly_sysadmin:BillyJinn228@localhost/Voice-ka_Local")
        .await
        .map_err(|e| e.to_string())?;
    
    // Начинаем транзакцию для атомарности операций
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Ошибка начала транзакции: {}", e))?;
    
    // 1. Обновляем статус пользователя на 'offline' и время последнего визита
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
    
    // 2. Если есть активная голосовая сессия - закрываем её
    sqlx::query(
        "UPDATE voice_states 
         SET left_at = $1,
             joined_at = CASE 
                 WHEN left_at IS NULL THEN joined_at 
                 ELSE joined_at 
             END
         WHERE user_id = $2 AND left_at IS NULL"
    )
    .bind(Utc::now())
    .bind(user_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка обновления голосового состояния: {}", e))?;
    
    // 3. Если передан ID сессии вебсокета - закрываем её
    if let Some(session_id_str) = session_id {
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
    
    // Фиксируем транзакцию
    transaction
        .commit()
        .await
        .map_err(|e| format!("Ошибка сохранения изменений: {}", e))?;
    
    println!("Пользователь с ID {} успешно вышел из системы", user_id);
    
    Ok(true)
}