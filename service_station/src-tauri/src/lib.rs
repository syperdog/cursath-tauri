use tauri::{Manager, async_runtime::block_on};
use serde::{Deserialize, Serialize};

mod database;
use database::Database;

// Define data structures
#[derive(Serialize, Deserialize, Clone)]
struct User {
    id: i32,
    full_name: String,
    role: String,
    login: Option<String>,
    password_hash: Option<String>,
    pin_code: Option<String>,
    status: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct Order {
    id: i32,
    client_id: i32,
    car_id: i32,
    master_id: Option<i32>,
    status: String, // We keep as String for compatibility with frontend
    complaint: Option<String>,
    current_mileage: Option<i32>,
    prepayment: Option<String>, // Decimal as string
    total_amount: Option<String>, // Decimal as string
    created_at: String,
    completed_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Client {
    id: i32,
    full_name: String,
    phone: String,
    address: Option<String>,
    created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct Car {
    id: i32,
    client_id: i32,
    vin: Option<String>,
    license_plate: Option<String>,
    make: String,
    model: String,
    production_year: Option<i32>,
    mileage: i32,
    last_visit_date: Option<String>,
    created_at: String,
}


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
async fn login_user(username: String, password: String, state: tauri::State<'_, Database>) -> Result<(User, String), String> {
    use sqlx::Row;

    // Query the database for the user with matching login and active status
    let query = "SELECT id, full_name, role::text, login, password_hash, pin_code, status::text FROM users WHERE login = $1 AND status = 'Active'";
    let row = sqlx::query(query)
        .bind(&username)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if let Some(row) = row {
        // In a real application, you would hash the input password and compare it with the stored hash
        // For now, we'll just check if password is provided (a real implementation would properly hash and compare)
        if !password.is_empty() {
            let user = User {
                id: row.get("id"),
                full_name: row.get("full_name"),
                role: row.get("role"),
                login: row.get("login"),
                password_hash: row.get("password_hash"),
                pin_code: row.get("pin_code"),
                status: row.get("status"),
            };

            // Create a session token
            let session_token = Uuid::new_v4().to_string();
            {
                let mut sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
                sessions.insert(session_token.clone(), user.clone());
            }

            // Return both user and session token
            Ok((user, session_token))
        } else {
            Err("Неправильный логин или пароль".to_string())
        }
    } else {
        Err("Неправильный логин или пароль".to_string())
    }
}

#[tauri::command]
async fn login_worker(pin: String, state: tauri::State<'_, Database>) -> Result<(User, String), String> {
    use sqlx::Row;

    // Query the database for the worker with matching pin_code
    let query = "SELECT id, full_name, role::text, login, password_hash, pin_code, status::text FROM users WHERE pin_code = $1 AND role = 'Worker' AND status = 'Active'";
    let row = sqlx::query(query)
        .bind(&pin)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if let Some(row) = row {
        let user = User {
            id: row.get("id"),
            full_name: row.get("full_name"),
            role: row.get("role"),
            login: row.get("login"),
            password_hash: row.get("password_hash"),
            pin_code: row.get("pin_code"),
            status: row.get("status"),
        };

        // Create a session token
        let session_token = Uuid::new_v4().to_string();
        {
            let mut sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
            sessions.insert(session_token.clone(), user.clone());
        }

        Ok((user, session_token))
    } else {
        Err("Неправильный PIN-код".to_string())
    }
}

// In-memory session storage (in a real application, you'd use a proper session store)
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

// Simple session store - in a real application, use a more secure approach
static SESSIONS: once_cell::sync::Lazy<Mutex<HashMap<String, User>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));


#[tauri::command]
async fn get_user_session(session_token: Option<String>) -> Result<Option<User>, String> {
    if let Some(token) = session_token {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        Ok(sessions.get(&token).cloned())
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn logout_user(session_token: String) -> Result<String, String> {
    let mut sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
    sessions.remove(&session_token);
    Ok("User logged out successfully".to_string())
}

// Order management
#[tauri::command]
async fn get_orders_for_master() -> Result<Vec<Order>, String> {
    // In a real application, this would query the database for orders
    // For now, returning hardcoded data for testing purposes
    Ok(vec![
        Order {
            id: 105,
            client_id: 1,
            car_id: 1,
            master_id: Some(1),
            status: "In_Work".to_string(),
            complaint: Some("Стук в подвеске".to_string()),
            current_mileage: Some(155000),
            prepayment: Some("3000".to_string()),
            total_amount: Some("9000".to_string()),
            created_at: "2025-11-25T10:00:00".to_string(),
            completed_at: None,
        },
        Order {
            id: 106,
            client_id: 2,
            car_id: 2,
            master_id: Some(1),
            status: "Ready".to_string(),
            complaint: Some("Проблемы с двигателем".to_string()),
            current_mileage: Some(145000),
            prepayment: Some("1000".to_string()),
            total_amount: Some("3500".to_string()),
            created_at: "2025-11-26T11:00:00".to_string(),
            completed_at: None,
        },
        Order {
            id: 107,
            client_id: 3,
            car_id: 3,
            master_id: Some(1),
            status: "Diagnostics".to_string(),
            complaint: Some("Замена масла".to_string()),
            current_mileage: Some(120000),
            prepayment: None,
            total_amount: None,
            created_at: "2025-11-27T12:00:00".to_string(),
            completed_at: None,
        },
    ])
}

#[tauri::command]
async fn get_client_by_id(client_id: i32) -> Result<Option<Client>, String> {
    // In a real application, this would query the database
    match client_id {
        1 => Ok(Some(Client {
            id: 1,
            full_name: "Петров П.П.".to_string(),
            phone: "+375 (29) 111-22-33".to_string(),
            address: Some("г. Минск, ул. Ленина, 1".to_string()),
            created_at: "2024-01-01T00:00:00".to_string(),
        })),
        2 => Ok(Some(Client {
            id: 2,
            full_name: "Сидоров А.А.".to_string(),
            phone: "+375 (29) 444-55-66".to_string(),
            address: Some("г. Минск, ул. Победы, 10".to_string()),
            created_at: "2024-01-02T00:00:00".to_string(),
        })),
        3 => Ok(Some(Client {
            id: 3,
            full_name: "Иванов И.И.".to_string(),
            phone: "+375 (33) 777-88-99".to_string(),
            address: Some("г. Гомель, ул. Строителей, 5".to_string()),
            created_at: "2024-01-03T00:00:00".to_string(),
        })),
        _ => Ok(None),
    }
}

#[tauri::command]
async fn get_car_by_id(car_id: i32) -> Result<Option<Car>, String> {
    // In a real application, this would query the database
    match car_id {
        1 => Ok(Some(Car {
            id: 1,
            client_id: 1,
            vin: Some("WBA1234567890ABCD".to_string()),
            license_plate: Some("A 123 AA 77".to_string()),
            make: "Toyota".to_string(),
            model: "Camry".to_string(),
            production_year: Some(2015),
            mileage: 155000,
            last_visit_date: Some("2025-10-10T00:00:00".to_string()),
            created_at: "2024-01-01T00:00:00".to_string(),
        })),
        2 => Ok(Some(Car {
            id: 2,
            client_id: 2,
            vin: Some("WBA9876543210XYZ".to_string()),
            license_plate: Some("E 555 KX 99".to_string()),
            make: "Ford".to_string(),
            model: "Focus".to_string(),
            production_year: Some(2018),
            mileage: 145000,
            last_visit_date: Some("2025-10-15T00:00:00".to_string()),
            created_at: "2024-01-02T00:00:00".to_string(),
        })),
        3 => Ok(Some(Car {
            id: 3,
            client_id: 3,
            vin: Some("WBY111222333444555".to_string()),
            license_plate: Some("Т 888 ТТ 77".to_string()),
            make: "BMW".to_string(),
            model: "X5".to_string(),
            production_year: Some(2020),
            mileage: 120000,
            last_visit_date: Some("2025-10-20T00:00:00".to_string()),
            created_at: "2024-01-03T00:00:00".to_string(),
        })),
        _ => Ok(None),
    }
}

#[tauri::command]
async fn search_orders_clients_cars(query: String) -> Result<(Vec<Order>, Vec<Client>, Vec<Car>), String> {
    // In a real application, this would perform a database search
    // For now, returning hardcoded results based on query
    let query_lower = query.to_lowercase();

    let orders = if query_lower.contains("105") || query_lower.contains("toyota") || query_lower.contains("camry") {
        vec![Order {
            id: 105,
            client_id: 1,
            car_id: 1,
            master_id: Some(1),
            status: "In_Work".to_string(),
            complaint: Some("Стук в подвеске".to_string()),
            current_mileage: Some(155000),
            prepayment: Some("3000".to_string()),
            total_amount: Some("9000".to_string()),
            created_at: "2025-11-25T10:00:00".to_string(),
            completed_at: None,
        }]
    } else if query_lower.contains("106") || query_lower.contains("ford") || query_lower.contains("focus") {
        vec![Order {
            id: 106,
            client_id: 2,
            car_id: 2,
            master_id: Some(1),
            status: "Ready".to_string(),
            complaint: Some("Проблемы с двигателем".to_string()),
            current_mileage: Some(145000),
            prepayment: Some("1000".to_string()),
            total_amount: Some("3500".to_string()),
            created_at: "2025-11-26T11:00:00".to_string(),
            completed_at: None,
        }]
    } else {
        vec![]
    };

    let clients = if query_lower.contains("петров") || query_lower.contains("petrov") {
        vec![Client {
            id: 1,
            full_name: "Петров П.П.".to_string(),
            phone: "+375 (29) 111-22-33".to_string(),
            address: Some("г. Минск, ул. Ленина, 1".to_string()),
            created_at: "2024-01-01T00:00:00".to_string(),
        }]
    } else if query_lower.contains("сидоров") || query_lower.contains("sidorov") {
        vec![Client {
            id: 2,
            full_name: "Сидоров А.А.".to_string(),
            phone: "+375 (29) 444-55-66".to_string(),
            address: Some("г. Минск, ул. Победы, 10".to_string()),
            created_at: "2024-01-02T00:00:00".to_string(),
        }]
    } else if query_lower.contains("иванов") || query_lower.contains("ivanov") {
        vec![Client {
            id: 3,
            full_name: "Иванов И.И.".to_string(),
            phone: "+375 (33) 777-88-99".to_string(),
            address: Some("г. Гомель, ул. Строителей, 5".to_string()),
            created_at: "2024-01-03T00:00:00".to_string(),
        }]
    } else {
        vec![]
    };

    let cars = if query_lower.contains("toyota") || query_lower.contains("camry") || query_lower.contains("a 123 aa") {
        vec![Car {
            id: 1,
            client_id: 1,
            vin: Some("WBA1234567890ABCD".to_string()),
            license_plate: Some("A 123 AA 77".to_string()),
            make: "Toyota".to_string(),
            model: "Camry".to_string(),
            production_year: Some(2015),
            mileage: 155000,
            last_visit_date: Some("2025-10-10T00:00:00".to_string()),
            created_at: "2024-01-01T00:00:00".to_string(),
        }]
    } else if query_lower.contains("ford") || query_lower.contains("focus") || query_lower.contains("e 555 kx") {
        vec![Car {
            id: 2,
            client_id: 2,
            vin: Some("WBA9876543210XYZ".to_string()),
            license_plate: Some("E 555 KX 99".to_string()),
            make: "Ford".to_string(),
            model: "Focus".to_string(),
            production_year: Some(2018),
            mileage: 145000,
            last_visit_date: Some("2025-10-15T00:00:00".to_string()),
            created_at: "2024-01-02T00:00:00".to_string(),
        }]
    } else if query_lower.contains("bmw") || query_lower.contains("x5") || query_lower.contains("т 888 тт") {
        vec![Car {
            id: 3,
            client_id: 3,
            vin: Some("WBY111222333444555".to_string()),
            license_plate: Some("Т 888 ТТ 77".to_string()),
            make: "BMW".to_string(),
            model: "X5".to_string(),
            production_year: Some(2020),
            mileage: 120000,
            last_visit_date: Some("2025-10-20T00:00:00".to_string()),
            created_at: "2024-01-03T00:00:00".to_string(),
        }]
    } else {
        vec![]
    };

    Ok((orders, clients, cars))
}

#[tauri::command]
async fn create_order(client_id: i32, car_id: i32, _complaint: Option<String>, _current_mileage: Option<i32>) -> Result<String, String> {
    // In a real application, this would insert a new order into the database
    // For now, returning a success message
    Ok(format!("Order created successfully for client {} and car {}", client_id, car_id))
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
        .invoke_handler(tauri::generate_handler![
            greet,
            test_db_connection,
            login_user,
            login_worker,
            get_user_session,
            logout_user,
            get_orders_for_master,
            get_client_by_id,
            get_car_by_id,
            search_orders_clients_cars,
            create_order
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
