use sqlx::postgres::PgPoolOptions;
use sqlx::types::Json;  // Добавьте этот импорт
use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHasher
};
use chrono::Utc;
use serde_json::json;

#[tauri::command]
pub async fn register(login: String, email: String, password: String, confirm_password: String) -> Result<(bool, i32), String> {
    // Проверки
    if password != confirm_password {
        return Err("Пароли не совпадают".to_string());
    }
    
    if password.len() < 6 {
        return Err("Пароль должен содержать минимум 6 символов".to_string());
    }
    
    if login.len() < 3 {
        return Err("Логин должен содержать минимум 3 символа".to_string());
    }
    
    if !email.contains('@') || !email.contains('.') {
        return Err("Некорректный email".to_string());
    }
    
    let pool = crate::db::get_db_pool()
        .ok_or("База данных не подключена")?;
    
    // Проверка существования пользователя
    let existing_user: Option<(String, String)> = sqlx::query_as(
        "SELECT username, email FROM users WHERE username = $1 OR email = $2"
    )
    .bind(&login)
    .bind(&email)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    if let Some((existing_username, existing_email)) = existing_user {
        if existing_username == login {
            return Err("Пользователь с таким логином уже существует".to_string());
        }
        if existing_email == email {
            return Err("Пользователь с таким email уже существует".to_string());
        }
    }
    
    // Хеширование пароля
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Ошибка хеширования пароля: {}", e))?
        .to_string();
    
    // Начинаем транзакцию
    let mut transaction = pool
        .begin()
        .await
        .map_err(|e| format!("Ошибка начала транзакции: {}", e))?;
    
    // Создаем пользователя
    let user_id: i32 = sqlx::query_scalar(
        "INSERT INTO users (username, email, password_hash, status, created_at, updated_at) 
        VALUES ($1, $2, $3, 'offline', $4, $4)
        RETURNING id"
    )
    .bind(&login)
    .bind(&email)
    .bind(&password_hash)
    .bind(Utc::now())
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка при регистрации пользователя: {}", e))?;
    
    // Создаем дефолтный канал (гильдию) для пользователя
    let guild_name = format!("{}'s Server", login);
    let guild_id: i32 = sqlx::query_scalar(
        "INSERT INTO guilds (name, owner_id, description, created_at, updated_at)
        VALUES ($1, $2, 'Личный сервер пользователя', $3, $3)
        RETURNING id"
    )
    .bind(&guild_name)
    .bind(user_id)
    .bind(Utc::now())
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания канала: {}", e))?;
    
    // Добавляем пользователя в члены канала
    sqlx::query(
        "INSERT INTO guild_members (user_id, guild_id, joined_at)
        VALUES ($1, $2, $3)"
    )
    .bind(user_id)
    .bind(guild_id)
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка добавления в члены канала: {}", e))?;
    
    // Создаем дефолтную роль для пользователя
    let role_id: i32 = sqlx::query_scalar(
        "INSERT INTO roles (guild_id, name, position, created_at, updated_at)
        VALUES ($1, '@everyone', 0, $2, $2)
        RETURNING id"
    )
    .bind(guild_id)
    .bind(Utc::now())
    .fetch_one(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания роли: {}", e))?;
    
    // Назначаем роль пользователю
    sqlx::query(
        "INSERT INTO member_roles (user_id, role_id, guild_id)
        VALUES ($1, $2, $3)"
    )
    .bind(user_id)
    .bind(role_id)
    .bind(guild_id)
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка назначения роли: {}", e))?;
    
    // Создаем текстовую комнату
    sqlx::query(
        "INSERT INTO rooms (name, type, guild_id, position, created_at, updated_at)
        VALUES ('general', 'text', $1, 0, $2, $2)"
    )
    .bind(guild_id)
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания текстовой комнаты: {}", e))?;
    
    // Создаем голосовую комнату
    sqlx::query(
        "INSERT INTO rooms (name, type, guild_id, position, bitrate, created_at, updated_at)
        VALUES ('General Voice', 'voice', $1, 1, 64000, $2, $2)"
    )
    .bind(guild_id)
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания голосовой комнаты: {}", e))?;
    
    // Создаем дефолтные звуковые уведомления
    for event_type in &["message", "mention", "join", "leave", "call"] {
        sqlx::query(
            "INSERT INTO notification_sounds (user_id, event_type, is_enabled, volume, created_at, updated_at)
            VALUES ($1, $2, true, 1.0, $3, $3)"
        )
        .bind(user_id)
        .bind(event_type)
        .bind(Utc::now())
        .execute(&mut *transaction)
        .await
        .map_err(|e| format!("Ошибка создания уведомления для {}: {}", event_type, e))?;
    }
    
    // Создаем дефолтный голосовой пресет
    let default_effects = json!({
        "noise_suppression": true,
        "echo_cancel": true,
        "auto_gain": true
    });
    
    sqlx::query(
        "INSERT INTO voice_presets (user_id, name, effects, is_global, guild_id, created_at, updated_at)
        VALUES ($1, $2, $3, false, NULL, $4, $4)"
    )
    .bind(user_id)
    .bind("Чистый голос")
    .bind(Json(&default_effects))  // Используем Json тип
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания голосового пресета: {}", e))?;
    
    // Создаем данные для аудит-лога
    let audit_data = json!({
        "username": login,
        "email": email
    });
    
    // Добавляем запись в аудит-лог
    sqlx::query(
        "INSERT INTO audit_logs (guild_id, user_id, action_type, target_id, changes, created_at)
        VALUES ($1, $2, 'USER_REGISTER', $3, $4, $5)"
    )
    .bind(guild_id)
    .bind(user_id)
    .bind(user_id)
    .bind(Json(&audit_data))  // Используем Json тип
    .bind(Utc::now())
    .execute(&mut *transaction)
    .await
    .map_err(|e| format!("Ошибка создания аудит-лога: {}", e))?;
    
    // Фиксируем транзакцию
    transaction
        .commit()
        .await
        .map_err(|e| format!("Ошибка сохранения данных: {}", e))?;
    
    println!("Пользователь {} (ID: {}) успешно зарегистрирован с каналом ID: {}", login, user_id, guild_id);
    
    Ok((true, user_id))
}