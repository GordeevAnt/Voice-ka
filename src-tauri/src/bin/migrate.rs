// src-tauri/bin/migrate.rs
use voice_ka_lib::db::init_database;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_database().await?;
    println!("✅ Миграция завершена успешно!");
    Ok(())
}