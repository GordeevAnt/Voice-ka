use voice_ka_lib::db::init_database;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Запуск миграции базы данных...");
    init_database().await?;
    println!("✅ Миграция успешно завершена!");
    Ok(())
}