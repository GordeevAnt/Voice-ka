// src-tauri/src/lib.rs
pub mod db;

use db::{create_msg, get_msgs, get_msg, update_msg, delete_msg};

// Простая команда для примера
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// ==== КОМАНДЫ ДЛЯ РАБОТЫ С СООБЩЕНИЯМИ ====

#[tauri::command]
async fn create_message(room_id: i32, user_id: i32, content: String) -> Result<String, String> {
    match create_msg(room_id, user_id, content).await {
        Ok(msg) => Ok(format!("✅ Сообщение {} создано", msg.id)),
        Err(e) => Err(format!("Ошибка: {}", e)),
    }
}

#[tauri::command]
async fn get_messages(room_id: i32) -> Result<String, String> {
    match get_msgs(room_id).await {
        Ok(msgs) => {
            if msgs.is_empty() {
                Ok("📭 Нет сообщений".to_string())
            } else {
                let mut result = format!("📨 {} сообщений:\n", msgs.len());
                for msg in msgs {
                    result.push_str(&format!("[{}] {}: {}\n", msg.id, msg.user_id, msg.content));
                }
                Ok(result)
            }
        }
        Err(e) => Err(format!("Ошибка: {}", e)),
    }
}

#[tauri::command]
async fn get_message(id: i64) -> Result<String, String> {
    match get_msg(id).await {
        Ok(Some(msg)) => Ok(format!("📝 Сообщение {}: {}", msg.id, msg.content)),
        Ok(None) => Ok("❌ Сообщение не найдено".to_string()),
        Err(e) => Err(format!("Ошибка: {}", e)),
    }
}

#[tauri::command]
async fn update_message(id: i64, user_id: i32, new_content: String) -> Result<String, String> {
    match update_msg(id, user_id, new_content).await {
        Ok(true) => Ok("✏️ Сообщение обновлено".to_string()),
        Ok(false) => Ok("❌ Не найдено или нет прав".to_string()),
        Err(e) => Err(format!("Ошибка: {}", e)),
    }
}

#[tauri::command]
async fn delete_message(id: i64, user_id: i32) -> Result<String, String> {
    match delete_msg(id, user_id).await {
        Ok(true) => Ok("🗑️ Сообщение удалено".to_string()),
        Ok(false) => Ok("❌ Не найдено или нет прав".to_string()),
        Err(e) => Err(format!("Ошибка: {}", e)),
    }
}

// Запуск приложения
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Запускаем БД в отдельном потоке
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            if let Err(e) = db::init_db().await {
                eprintln!("❌ Ошибка БД: {}", e);
            }
        });
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            create_message,
            get_messages,
            get_message,
            update_message,
            delete_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}