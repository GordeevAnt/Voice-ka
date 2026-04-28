// src/lib.rs
pub mod db;
pub mod ws;

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
use ws::{SubscriptionManager, server::start_websocket_server};
use std::sync::Arc;
use tauri::Manager;

pub mod logic;
use logic::{
    get_room_messages,
    send_message,
    get_user_guilds,
    get_guild_rooms,
    get_guild_members,
    find_guild_by_id,
    join_guild_by_id,
    get_user_rooms,
    get_room_by_id,
    create_room,
    update_room,
    delete_room,
    create_dm_room,
    get_current_user,
    get_current_user_simple,
    get_online_guild_members,
    get_user_stats,
    update_user_profile,
    get_user_guilds_with_role,
    create_guild,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Инициализируем WebSocket менеджер
            let ws_manager = Arc::new(SubscriptionManager::new());
            
            // Сохраняем менеджер в состоянии приложения
            app.manage(ws_manager.clone());
            
            // Инициализируем базу данных
            tauri::async_runtime::spawn(async {
                match init_database().await {
                    Ok(()) => println!("✅ База данных готова к работе"),
                    Err(e) => eprintln!("❌ Ошибка инициализации базы данных: {}", e),
                }
            });
            
            // Запускаем WebSocket сервер на фиксированном порту
            let ws_manager_clone = ws_manager.clone();
            tauri::async_runtime::spawn(async move {
                match start_websocket_server(ws_manager_clone, 9001).await {
                    Ok(port) => println!("✅ WebSocket сервер запущен на порту {}", port),
                    Err(e) => eprintln!("❌ Ошибка запуска WebSocket сервера: {}", e),
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            logout,
            register,
            get_room_messages,
            send_message,
            get_user_guilds,
            get_guild_rooms,
            get_guild_members,
            find_guild_by_id,
            join_guild_by_id,
            get_user_rooms,
            get_room_by_id,
            create_room,
            update_room,
            delete_room,
            create_dm_room,
            get_current_user,
            get_current_user_simple,
            get_online_guild_members,
            get_user_stats,
            update_user_profile,
            get_user_guilds_with_role,
            create_guild,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}