use tauri::{Manager, async_runtime::block_on};
use serde::{Deserialize, Serialize};
use sqlx::Row;

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

#[derive(Serialize, Deserialize, Clone)]
struct OrderDefect {
    id: i32,
    order_id: i32,
    diagnostician_id: i32,
    defect_description: String,
    diagnostician_comment: Option<String>, // Может быть пустым
    is_confirmed: bool,
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
        let stored_hash: Option<String> = row.get("password_hash");

        // Check if the user has a password hash and if it matches
        if let Some(hash) = stored_hash {
            // Verify the provided password against the stored hash
            match bcrypt::verify(&password, &hash) {
                Ok(valid) => {
                    if valid {
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
                }
                Err(_) => Err("Ошибка при проверке пароля".to_string()),
            }
        } else {
            // If no password hash exists for the user
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
async fn get_orders_for_master(state: tauri::State<'_, Database>) -> Result<Vec<Order>, String> {
    // Query all orders for the master from the database
    let query = "SELECT id, client_id, car_id, master_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE status != 'Closed' AND status != 'Cancelled' ORDER BY created_at DESC";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut orders = Vec::new();
    for row in rows {
        orders.push(Order {
            id: row.get("id"),
            client_id: row.get("client_id"),
            car_id: row.get("car_id"),
            master_id: row.get("master_id"),
            status: row.get("status"),
            complaint: row.get("complaint"),
            current_mileage: row.get("current_mileage"),
            prepayment: row.get("prepayment"),
            total_amount: row.get("total_amount"),
            created_at: row.get("created_at"),
            completed_at: row.get("completed_at"),
        });
    }

    println!("Fetched {} orders for diagnostician", orders.len());
    for order in &orders {
        println!("Order {} status: {}", order.id, order.status);
    }

    Ok(orders)
}

#[tauri::command]
async fn get_client_by_id(client_id: i32, state: tauri::State<'_, Database>) -> Result<Option<Client>, String> {
    let query = "SELECT id, full_name, phone, address, created_at::text FROM clients WHERE id = $1";
    let row = sqlx::query(query)
        .bind(client_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if let Some(row) = row {
        Ok(Some(Client {
            id: row.get("id"),
            full_name: row.get("full_name"),
            phone: row.get("phone"),
            address: row.get("address"),
            created_at: row.get("created_at"),
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn get_car_by_id(car_id: i32, state: tauri::State<'_, Database>) -> Result<Option<Car>, String> {
    let query = "SELECT id, client_id, vin, license_plate, make, model, production_year, mileage, last_visit_date::text, created_at::text FROM cars WHERE id = $1";
    let row = sqlx::query(query)
        .bind(car_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if let Some(row) = row {
        Ok(Some(Car {
            id: row.get("id"),
            client_id: row.get("client_id"),
            vin: row.get("vin"),
            license_plate: row.get("license_plate"),
            make: row.get("make"),
            model: row.get("model"),
            production_year: row.get("production_year"),
            mileage: row.get("mileage"),
            last_visit_date: row.get("last_visit_date"),
            created_at: row.get("created_at"),
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn search_orders_clients_cars(query: String, state: tauri::State<'_, Database>) -> Result<(Vec<Order>, Vec<Client>, Vec<Car>), String> {
    let query_lower = format!("%{}%", query.to_lowercase());

    // Search for orders by ID
    let order_query = "SELECT id, client_id, car_id, master_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE id::text LIKE $1";
    let order_results = sqlx::query(order_query)
        .bind(&query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error during order search: {}", e))?;

    let mut orders = Vec::new();
    for row in order_results {
        orders.push(Order {
            id: row.get("id"),
            client_id: row.get("client_id"),
            car_id: row.get("car_id"),
            master_id: row.get("master_id"),
            status: row.get("status"),
            complaint: row.get("complaint"),
            current_mileage: row.get("current_mileage"),
            prepayment: row.get("prepayment"),
            total_amount: row.get("total_amount"),
            created_at: row.get("created_at"),
            completed_at: row.get("completed_at"),
        });
    }

    // Search for clients by full name, phone or address
    let client_query = "SELECT id, full_name, phone, address, created_at::text FROM clients WHERE LOWER(full_name) LIKE $1 OR LOWER(phone) LIKE $1 OR (address IS NOT NULL AND LOWER(address) LIKE $1)";
    let client_results = sqlx::query(client_query)
        .bind(&query_lower)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error during client search: {}", e))?;

    let mut clients = Vec::new();
    for row in client_results {
        clients.push(Client {
            id: row.get("id"),
            full_name: row.get("full_name"),
            phone: row.get("phone"),
            address: row.get("address"),
            created_at: row.get("created_at"),
        });
    }

    // Search for cars by license plate, make, model, or VIN
    let car_query = "SELECT id, client_id, vin, license_plate, make, model, production_year, mileage, last_visit_date::text, created_at::text FROM cars WHERE LOWER(license_plate) LIKE $1 OR LOWER(make) LIKE $1 OR LOWER(model) LIKE $1 OR (vin IS NOT NULL AND LOWER(vin) LIKE $1)";
    let car_results = sqlx::query(car_query)
        .bind(&query_lower)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error during car search: {}", e))?;

    let mut cars = Vec::new();
    for row in car_results {
        cars.push(Car {
            id: row.get("id"),
            client_id: row.get("client_id"),
            vin: row.get("vin"),
            license_plate: row.get("license_plate"),
            make: row.get("make"),
            model: row.get("model"),
            production_year: row.get("production_year"),
            mileage: row.get("mileage"),
            last_visit_date: row.get("last_visit_date"),
            created_at: row.get("created_at"),
        });
    }

    Ok((orders, clients, cars))
}

#[tauri::command]
async fn get_cars_by_client_id(client_id: i32, state: tauri::State<'_, Database>) -> Result<Vec<Car>, String> {
    let query = "SELECT id, client_id, vin, license_plate, make, model, production_year, mileage, last_visit_date::text, created_at::text FROM cars WHERE client_id=$1";
    let rows = sqlx::query(query)
        .bind(client_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut cars = Vec::new();
    for row in rows {
        cars.push(Car {
            id: row.get("id"),
            client_id: row.get("client_id"),
            vin: row.get("vin"),
            license_plate: row.get("license_plate"),
            make: row.get("make"),
            model: row.get("model"),
            production_year: row.get("production_year"),
            mileage: row.get("mileage"),
            last_visit_date: row.get("last_visit_date"),
            created_at: row.get("created_at"),
        });
    }

    Ok(cars)
}

#[tauri::command]
async fn get_orders_for_storekeeper(state: tauri::State<'_, Database>) -> Result<Vec<Order>, String> {
    // In a real application, this would query the database for orders that need storekeeper attention
    // For now, returning hardcoded data for testing purposes
    let query = "SELECT id, client_id, car_id, master_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE status IN ('Parts_Selection', 'Approval', 'In_Work')";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut orders = Vec::new();
    for row in rows {
        orders.push(Order {
            id: row.get("id"),
            client_id: row.get("client_id"),
            car_id: row.get("car_id"),
            master_id: row.get("master_id"),
            status: row.get("status"),
            complaint: row.get("complaint"),
            current_mileage: row.get("current_mileage"),
            prepayment: row.get("prepayment"),
            total_amount: row.get("total_amount"),
            created_at: row.get("created_at"),
            completed_at: row.get("completed_at"),
        });
    }

    println!("Fetched {} orders for storekeeper", orders.len());
    for order in &orders {
        println!("Order {} status: {}", order.id, order.status);
    }

    Ok(orders)
}

#[tauri::command]
async fn get_orders_for_diagnostician(state: tauri::State<'_, Database>) -> Result<Vec<Order>, String> {
    // Query to get orders that need diagnostics from the database
    let query = "SELECT id, client_id, car_id, master_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE status = 'Diagnostics'";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut orders = Vec::new();
    for row in rows {
        orders.push(Order {
            id: row.get("id"),
            client_id: row.get("client_id"),
            car_id: row.get("car_id"),
            master_id: row.get("master_id"),
            status: row.get("status"),
            complaint: row.get("complaint"),
            current_mileage: row.get("current_mileage"),
            prepayment: row.get("prepayment"),
            total_amount: row.get("total_amount"),
            created_at: row.get("created_at"),
            completed_at: row.get("completed_at"),
        });
    }

    println!("Fetched {} orders for diagnostician", orders.len());
    for order in &orders {
        println!("Order {} status: {}", order.id, order.status);
    }

    Ok(orders)
}

#[tauri::command]
async fn add_part_to_order(order_id: i32, part_name: String, brand: String, supplier: String, price: f64, availability: String, part_number: String, state: tauri::State<'_, Database>) -> Result<String, String> {
    // Добавляем запчасть в таблицу order_parts
    let query = "INSERT INTO order_parts (order_id, part_name_snapshot, brand, supplier, price_per_unit, source_type) VALUES ($1, $2, $3, $4, $5, 'Supplier')";
    sqlx::query(query)
        .bind(order_id)
        .bind(&part_name)
        .bind(&brand)
        .bind(&supplier)
        .bind(price)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(format!("Part '{}' added to order {}", part_name, order_id))
}

#[tauri::command]
async fn create_order(client_id: i32, car_id: i32, complaint: Option<String>, current_mileage: Option<i32>, state: tauri::State<'_, Database>) -> Result<String, String> {
    // Insert a new order into the database with status 'Diagnostics'
    let query = "INSERT INTO orders (client_id, car_id, master_id, status, complaint, current_mileage, prepayment, total_amount, created_at) VALUES ($1, $2, NULL, 'Diagnostics', $3, $4, 0, 0, NOW()) RETURNING id";
    let row = sqlx::query(query)
        .bind(client_id)
        .bind(car_id)
        .bind(&complaint)
        .bind(current_mileage)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let order_id: i32 = row.get("id");
    Ok(format!("Order created successfully with ID: {}", order_id))
}

#[tauri::command]
async fn get_diagnostic_results_by_order_id(order_id: i32, state: tauri::State<'_, Database>) -> Result<Vec<OrderDefect>, String> {
    // Query to get diagnostic results for a specific order from the correct table
    let query = "SELECT id, order_id, diagnostician_id, defect_description, diagnostician_comment, is_confirmed FROM order_defects WHERE order_id = $1";
    let rows = sqlx::query(query)
        .bind(order_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut results = Vec::new();
    for row in rows {
        results.push(OrderDefect {
            id: row.get("id"),
            order_id: row.get("order_id"),
            diagnostician_id: row.get("diagnostician_id"),
            defect_description: row.get("defect_description"),
            diagnostician_comment: row.get("diagnostician_comment"),
            is_confirmed: row.get("is_confirmed"),
        });
    }

    Ok(results)
}

#[derive(Serialize, Deserialize, Clone)]
struct Part {
    id: i32,
    name: String,
    brand: String,
    supplier: String,
    article: String,
    price: f64,
    availability: String, // Срок поставки
}

#[tauri::command]
async fn search_parts_by_vin(vin: String, query: String, state: tauri::State<'_, Database>) -> Result<Vec<Part>, String> {
    // В реальном приложении поиск будет происходить по внешним API и внутреннему складу
    // Для демонстрации возвращаем фиктивные данные
    let parts = vec![
        Part {
            id: 1,
            name: "Рычаг передний левый".to_string(),
            brand: "Lemforder".to_string(),
            supplier: "Склад СТО".to_string(),
            article: "30333 01".to_string(),
            price: 250.00,
            availability: "В наличии".to_string(),
        },
        Part {
            id: 2,
            name: "Рычаг передний левый".to_string(),
            brand: "TRW".to_string(),
            supplier: "Армтек".to_string(),
            article: "JTC1001".to_string(),
            price: 240.00,
            availability: "1 дн.".to_string(),
        },
        Part {
            id: 3,
            name: "Рычаг передний левый".to_string(),
            brand: "Patron".to_string(),
            supplier: "Шате-М".to_string(),
            article: "PS5005".to_string(),
            price: 120.00,
            availability: "1 дн.".to_string(),
        },
        Part {
            id: 4,
            name: "Рычаг передний левый".to_string(),
            brand: "Stellox".to_string(),
            supplier: "Мотекс".to_string(),
            article: "57-0001".to_string(),
            price: 110.00,
            availability: "2 дн.".to_string(),
        },
    ];

    Ok(parts)
}

// User management
#[tauri::command]
async fn get_all_users(state: tauri::State<'_, Database>) -> Result<Vec<User>, String> {
    let query = "SELECT id, full_name, role::text, login, password_hash, pin_code, status::text FROM users";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut users = Vec::new();
    for row in rows {
        users.push(User {
            id: row.get("id"),
            full_name: row.get("full_name"),
            role: row.get("role"),
            login: row.get("login"),
            password_hash: row.get("password_hash"),
            pin_code: row.get("pin_code"),
            status: row.get("status"),
        });
    }

    Ok(users)
}

#[tauri::command]
async fn create_user(user_data: User, state: tauri::State<'_, Database>) -> Result<User, String> {
    use bcrypt::hash;

    // Hash the password if it exists
    let password_hash = if let Some(password) = &user_data.password_hash {
        if !password.is_empty() {
            Some(hash(password, 12).map_err(|e| format!("Password hash error: {}", e))?)
        } else {
            None
        }
    } else {
        None
    };

    let query = "INSERT INTO users (full_name, role, login, password_hash, pin_code, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id";
    let row = sqlx::query(query)
        .bind(&user_data.full_name)
        .bind(&user_data.role)
        .bind(&user_data.login)
        .bind(&password_hash)
        .bind(&user_data.pin_code)
        .bind(&user_data.status)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let new_id: i32 = row.get("id");

    // Return the created user
    Ok(User {
        id: new_id,
        full_name: user_data.full_name,
        role: user_data.role,
        login: user_data.login,
        password_hash,
        pin_code: user_data.pin_code,
        status: user_data.status,
    })
}

#[tauri::command]
async fn update_user(user_id: i32, user_data: User, state: tauri::State<'_, Database>) -> Result<String, String> {
    use bcrypt::hash;

    // Hash the password if it exists
    let password_hash = if let Some(password) = &user_data.password_hash {
        if !password.is_empty() {
            Some(hash(password, 12).map_err(|e| format!("Password hash error: {}", e))?)
        } else {
            None
        }
    } else {
        None
    };

    let query = "UPDATE users SET full_name=$1, role=$2, login=$3, password_hash=$4, pin_code=$5, status=$6 WHERE id=$7";
    sqlx::query(query)
        .bind(&user_data.full_name)
        .bind(&user_data.role)
        .bind(&user_data.login)
        .bind(&password_hash)
        .bind(&user_data.pin_code)
        .bind(&user_data.status)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok("User updated successfully".to_string())
}

#[tauri::command]
async fn delete_user(user_id: i32, state: tauri::State<'_, Database>) -> Result<String, String> {
    let query = "DELETE FROM users WHERE id=$1";
    sqlx::query(query)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok("User deleted successfully".to_string())
}

#[tauri::command]
async fn save_diagnostic_results(order_id: i32, diagnostician_id: i32, defects: Vec<String>, state: tauri::State<'_, Database>) -> Result<String, String> {
    let defects_count = defects.len();
    for defect_description in &defects {
        let query = "INSERT INTO order_defects (order_id, diagnostician_id, defect_description, diagnostician_comment, is_confirmed) VALUES ($1, $2, $3, $4, $5)";
        sqlx::query(query)
            .bind(order_id)
            .bind(diagnostician_id)
            .bind(defect_description)
            .bind("") // diagnostician_comment пока пустой
            .bind(false) // is_confirmed пока false
            .execute(&state.pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;
    }
    Ok(format!("{} diagnostic results saved for order {}", defects_count, order_id))
}

#[tauri::command]
async fn update_order_status(order_id: i32, new_status: String, state: tauri::State<'_, Database>) -> Result<String, String> {
    println!("Updating order {} status to {}", order_id, new_status);

    // Проверим, существует ли заказ с указанным ID
    let check_query = "SELECT status::text FROM orders WHERE id = $1";
    let row = sqlx::query(check_query)
        .bind(order_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database check error: {}", e))?;

    match row {
        Some(row) => {
            let current_status: String = row.get("status");
            println!("Current status of order {}: {}", order_id, current_status);
        },
        None => {
            return Err(format!("Order {} not found", order_id));
        }
    }

    // Update the order status in the database
    println!("About to execute update query with status: {} for order: {}", new_status, order_id);
    let query = "UPDATE orders SET status = $1::order_status WHERE id = $2";
    let result = sqlx::query(query)
        .bind(&new_status)
        .bind(order_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(updated) => {
            println!("Order {} status updated to {}, rows affected: {}", order_id, new_status, updated.rows_affected());
        },
        Err(e) => {
            println!("Error during update: {}", e);
            return Err(format!("Database error: {}", e));
        }
    }

    // Проверим, действительно ли статус изменился
    let verify_query = "SELECT status::text FROM orders WHERE id = $1";
    let verify_row = sqlx::query(verify_query)
        .bind(order_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database verify error: {}", e))?;

    let updated_status: String = verify_row.get("status");
    println!("Verified status of order {}: {}", order_id, updated_status);

    Ok(format!("Order {} status updated to {}", order_id, updated_status))
}

// System settings
#[tauri::command]
async fn get_system_settings(_state: tauri::State<'_, Database>) -> Result<String, String> {
    // For now, return a placeholder JSON string
    // In a real implementation, this would retrieve actual system settings from the database
    Ok(r#"{
        "company_name": "ООО 'АвтоСервис Про'",
        "address": "г. Минск, ул. Ленина, 1",
        "phone": "+375 () ___-__-__",
        "diagnostics_cost": 500,
        "work_schedule": {
            "mon_to_fri": "09:00 - 18:00",
            "saturday": "10:00 - 15:00",
            "sunday": "Выходной"
        }
    }"#.to_string())
}

#[tauri::command]
async fn save_system_settings(_settings: String, _state: tauri::State<'_, Database>) -> Result<String, String> {
    // For now, just return success
    // In a real implementation, this would save the settings to the database
    Ok("System settings saved successfully".to_string())
}

// Event logs
#[tauri::command]
async fn get_system_logs(_filters: String, _state: tauri::State<'_, Database>) -> Result<String, String> {
    // For now, return placeholder log entries as JSON
    // In a real implementation, this would query the actual logs from the database based on filters
    Ok(r#"[
        {"timestamp": "30.11.2025 10:15", "user": "admin", "event": "Вход", "details": "Успешный вход"},
        {"timestamp": "30.11.2025 10:20", "user": "master", "event": "Создание", "details": "Заказ #105"},
        {"timestamp": "30.11.2025 11:00", "user": "admin", "event": "Удаление", "details": "User: worker2"}
    ]"#.to_string())
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
            get_orders_for_storekeeper,
            get_orders_for_diagnostician,
            save_diagnostic_results,
            update_order_status,
            get_client_by_id,
            get_car_by_id,
            get_cars_by_client_id,
            get_diagnostic_results_by_order_id,
            search_orders_clients_cars,
            create_order,
            get_all_users,
            create_user,
            update_user,
            delete_user,
            get_system_settings,
            save_system_settings,
            get_system_logs,
            search_parts_by_vin,
            add_part_to_order
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
