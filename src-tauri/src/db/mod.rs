// src-tauri/src/db/mod.rs
use sqlx::postgres::PgPoolOptions;
use sqlx::migrate;
use std::path::PathBuf;

pub async fn init_database() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set in .env file");
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    
    println!("✅ Подключено! Применяем миграции...");
    
    // Строим путь от CARGO_MANIFEST_DIR (src-tauri)
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")?;
    let migrations_path = PathBuf::from(&manifest_dir)
        .parent()  // поднимаемся из src-tauri в voice-ka
        .ok_or("Не удалось найти корень проекта")?
        .join("migrations");
    
    println!("📁 Путь к миграциям: {:?}", migrations_path);
    
    if !migrations_path.exists() {
        panic!("Папка migrations не найдена по пути: {:?}", migrations_path);
    }
    
    migrate::Migrator::new(migrations_path)
        .await?
        .run(&pool)
        .await?;
    
    println!("✅ Миграции успешно применены!");
    
    // Проверка
    let tables: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
    )
    .fetch_one(&pool)
    .await?;
    
    println!("📊 В базе данных {} таблиц", tables.0);
    
    Ok(())
}