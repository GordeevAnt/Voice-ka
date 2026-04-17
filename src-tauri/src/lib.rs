pub mod db;

#[path = "auth/login.rs"]
mod login;
pub use login::login;

#[path = "auth/register.rs"]
mod register;
pub use register::register;

#[path = "auth/logout.rs"]
mod logout;
pub use logout::logout;

use db::init_database;

// Запуск приложения с инициализацией БД
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            // Инициализируем базу данных в фоне
            tauri::async_runtime::spawn(async {
                match init_database().await {
                    Ok(()) => println!("✅ База данных готова к работе"),
                    Err(e) => eprintln!("❌ Ошибка инициализации базы данных: {}", e),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            logout,
            register
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}