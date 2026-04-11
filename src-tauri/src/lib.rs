#[path = "auth/login.rs"]
mod login;
pub use login::login;
#[path = "auth/register.rs"]
mod register;
pub use register::register;
#[path = "auth/logout.rs"]
mod logout;
pub use logout::logout;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// Запуск приложения
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            login,
            logout,
            register
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}