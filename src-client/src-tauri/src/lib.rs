// src-tauri/src/lib.rs - УПРОЩЕННАЯ ВЕРСИЯ
// Клиент больше не содержит бизнес-логику и БД

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|_app| {
            println!("🚀 Tauri client started");
            println!("💡 WebSocket server must be running on ws://127.0.0.1:9001");
            Ok(())
        })
        // 👇 НИ ОДНОЙ КОМАНДЫ! Все через WebSocket
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}