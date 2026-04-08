#[tauri::command]
pub fn login(login: String, password: String) -> bool {
    let pass_hash = password;
    let db_login = "alice@test.com";
    let db_password = "hash123";

    if login != db_login || pass_hash != db_password {
        return false;
    }

    return true
}