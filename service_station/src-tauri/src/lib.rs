use tauri::{Manager, async_runtime::block_on};

mod database;
use database::Database;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn test_db_connection() -> Result<String, String> {
    match Database::new().await {
        Ok(_) => Ok("Database connected successfully!".to_string()),
        Err(e) => Err(format!("Database connection failed: {}", e)),
    }
}

#[tauri::command]
async fn login_user(username: String, password: String) -> Result<String, String> {
    // В реальном приложении здесь будет проверка в базе данных
    // Для демонстрации просто вернем успешный ответ
    if !username.is_empty() && !password.is_empty() {
        Ok("Успешный вход!".to_string())
    } else {
        Err("Неправильный логин или пароль".to_string())
    }
}

#[tauri::command]
async fn login_worker(pin: String) -> Result<String, String> {
    // В реальном приложении здесь будет проверка в базе данных
    // Для демонстрации просто вернем успешный ответ
    if pin.len() == 4 && pin.chars().all(|c| c.is_ascii_digit()) {
        Ok("Успешный вход через PIN!".to_string())
    } else {
        Err("Неправильный PIN-код".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize database connection synchronously
            let db = block_on(async {
                Database::new().await
            }).map_err(|e| format!("Failed to initialize database: {}", e))?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, test_db_connection, login_user, login_worker])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
