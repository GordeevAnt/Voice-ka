// src-tauri/src/db/mod.rs
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::OnceLock;

// Глобальный пул соединений (используем OnceLock вместо static mut)
static DB_POOL: OnceLock<PgPool> = OnceLock::new();

// Простая структура сообщения
#[derive(Debug, sqlx::FromRow)]
pub struct Message {
    pub id: i64,
    pub room_id: i32,
    pub user_id: i32,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// Инициализация БД (основная функция для миграций)
pub async fn init_database() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")?;
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    
    // Создаем таблицу если её нет
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS messages (
            id BIGSERIAL PRIMARY KEY,
            room_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(&pool)
    .await?;
    
    println!("✅ База данных готова!");
    
    DB_POOL.set(pool).unwrap();
    
    Ok(())
}

// Инициализация для приложения (краткая версия)
pub async fn init_db() -> Result<(), Box<dyn std::error::Error>> {
    init_database().await
}

// Получить pool
fn get_pool() -> &'static PgPool {
    DB_POOL.get().expect("База данных не инициализирована")
}

// ==== ПРОСТЫЕ CRUD ОПЕРАЦИИ ====

// 1. СОЗДАТЬ сообщение
pub async fn create_msg(room_id: i32, user_id: i32, content: String) -> Result<Message, Box<dyn std::error::Error>> {
    let pool = get_pool();
    
    let msg = sqlx::query_as::<_, Message>(
        "INSERT INTO messages (room_id, user_id, content) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(room_id)
    .bind(user_id)
    .bind(content)
    .fetch_one(pool)
    .await?;
    
    println!("✅ Сообщение {} создано", msg.id);
    Ok(msg)
}

// 2. ПОЛУЧИТЬ все сообщения из комнаты
pub async fn get_msgs(room_id: i32) -> Result<Vec<Message>, Box<dyn std::error::Error>> {
    let pool = get_pool();
    
    let msgs = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE room_id = $1 ORDER BY created_at DESC"
    )
    .bind(room_id)
    .fetch_all(pool)
    .await?;
    
    Ok(msgs)
}

// 3. ПОЛУЧИТЬ одно сообщение
pub async fn get_msg(id: i64) -> Result<Option<Message>, Box<dyn std::error::Error>> {
    let pool = get_pool();
    
    let msg = sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    
    Ok(msg)
}

// 4. ОБНОВИТЬ сообщение
pub async fn update_msg(id: i64, user_id: i32, new_content: String) -> Result<bool, Box<dyn std::error::Error>> {
    let pool = get_pool();
    
    let result = sqlx::query(
        "UPDATE messages SET content = $1 WHERE id = $2 AND user_id = $3"
    )
    .bind(new_content)
    .bind(id)
    .bind(user_id)
    .execute(pool)
    .await?;
    
    let updated = result.rows_affected() > 0;
    if updated {
        println!("✏️ Сообщение {} обновлено", id);
    }
    
    Ok(updated)
}

// 5. УДАЛИТЬ сообщение
pub async fn delete_msg(id: i64, user_id: i32) -> Result<bool, Box<dyn std::error::Error>> {
    let pool = get_pool();
    
    let result = sqlx::query("DELETE FROM messages WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(pool)
        .await?;
    
    let deleted = result.rows_affected() > 0;
    if deleted {
        println!("🗑️ Сообщение {} удалено", id);
    }
    
    Ok(deleted)
}

pub fn get_pool_for_test() -> &'static PgPool {
    get_pool()
}