use tauri::{Manager, async_runtime::block_on};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use sqlx::types::BigDecimal;

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
    worker_id: Option<i32>, // Main worker assigned to the entire order
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

#[derive(Serialize, Deserialize, Clone)]
struct OrderWork {
    id: i32,
    order_id: i32,
    service_id: Option<i32>, // Может быть null
    service_name_snapshot: String,
    price: String, // Decimal as string for compatibility
    worker_id: Option<i32>, // Может быть null
    status: String, // Статус работы (Pending, In_Progress, Done)
    is_confirmed: bool, // Подтверждено ли клиентом
}

#[derive(Serialize, Deserialize, Clone)]
struct OrderPart {
    id: i32,
    order_id: i32,
    warehouse_item_id: Option<i32>, // Может быть null (если не со склада)
    part_name_snapshot: String,
    brand: String,
    price_per_unit: String, // Decimal as string for compatibility
    quantity: i32,
    is_confirmed: bool, // Подтверждено ли клиентом
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
    let query = "SELECT id, client_id, car_id, master_id, worker_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE status != 'Closed' AND status != 'Cancelled' ORDER BY created_at DESC";
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
            worker_id: row.get("worker_id"),
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
    let order_query = "SELECT id, client_id, car_id, master_id, worker_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE id::text LIKE $1";
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
            worker_id: row.get("worker_id"),
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
async fn get_order_works_by_order_id(order_id: i32, state: tauri::State<'_, Database>) -> Result<Vec<OrderWork>, String> {
    // Запрос для получения работ по ID заказа
    let query = "SELECT id, order_id, service_id, service_name_snapshot, price::text, worker_id, status::text as status, is_confirmed FROM order_works WHERE order_id = $1";
    let rows = sqlx::query(query)
        .bind(order_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut works = Vec::new();
    for row in rows {
        works.push(OrderWork {
            id: row.get("id"),
            order_id: row.get("order_id"),
            service_id: row.get("service_id"),
            service_name_snapshot: row.get("service_name_snapshot"),
            price: row.get("price"),
            worker_id: row.get("worker_id"),
            status: row.get("status"),
            is_confirmed: row.get("is_confirmed"),
        });
    }

    Ok(works)
}

#[tauri::command]
async fn get_order_parts_by_order_id(order_id: i32, state: tauri::State<'_, Database>) -> Result<Vec<OrderPart>, String> {
    // Запрос для получения запчастей по ID заказа
    let query = "SELECT id, order_id, warehouse_item_id, part_name_snapshot, brand, price_per_unit::text, quantity, is_confirmed FROM order_parts WHERE order_id = $1";
    let rows = sqlx::query(query)
        .bind(order_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut parts = Vec::new();
    for row in rows {
        parts.push(OrderPart {
            id: row.get("id"),
            order_id: row.get("order_id"),
            warehouse_item_id: row.get("warehouse_item_id"),
            part_name_snapshot: row.get("part_name_snapshot"),
            brand: row.get("brand"),
            price_per_unit: row.get("price_per_unit"),
            quantity: row.get("quantity"),
            is_confirmed: row.get("is_confirmed"),
        });
    }

    Ok(parts)
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
    let query = "SELECT id, client_id, car_id, master_id, worker_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE status IN ('Parts_Selection', 'Approval', 'In_Work')";
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
            worker_id: row.get("worker_id"),
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
    let query = "SELECT id, client_id, car_id, master_id, worker_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE status = 'Diagnostics'";
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
            worker_id: row.get("worker_id"),
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
async fn add_part_to_order(order_id: i32, part_name: String, brand: String, supplier: String, price: f64, _availability: String, _part_number: String, state: tauri::State<'_, Database>) -> Result<String, String> {
    // Добавляем запчасть в таблицу order_parts
    let query = "INSERT INTO order_parts (order_id, part_name_snapshot, brand, supplier, price_per_unit, source_type) VALUES ($1, $2, $3, $4, $5::numeric, 'Supplier')";
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
async fn confirm_order_parts_and_works(
    order_id: i32,
    confirmed_works: Vec<i32>,
    confirmed_parts: Vec<i32>,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Обновляем статус у работ в заказе
    for work_id in &confirmed_works {
        let query = "UPDATE order_works SET is_confirmed = true WHERE id = $1 AND order_id = $2";
        sqlx::query(query)
            .bind(work_id)
            .bind(order_id)
            .execute(&state.pool)
            .await
            .map_err(|e| format!("Database error updating work: {}", e))?;
    }

    // Обновляем статус у запчастей в заказе
    for part_id in &confirmed_parts {
        let query = "UPDATE order_parts SET is_confirmed = true WHERE id = $1 AND order_id = $2";
        sqlx::query(query)
            .bind(part_id)
            .bind(order_id)
            .execute(&state.pool)
            .await
            .map_err(|e| format!("Database error updating part: {}", e))?;
    }

    // Независимо от того, есть ли подтвержденные работы или запчасти,
    // заказ остается в статусе "Approval", чтобы дать возможность назначить работников
    // Статус изменится на "In_Work" только при назначении работников через assign_workers_to_order
    println!("Order {} has confirmed works: {}, parts: {}, remains in Approval status for worker assignment",
             order_id, confirmed_works.len(), confirmed_parts.len());

    Ok(format!("Order {} confirmed with {} works and {} parts", order_id, confirmed_works.len(), confirmed_parts.len()))
}

#[tauri::command]
async fn get_available_workers(state: tauri::State<'_, Database>) -> Result<Vec<User>, String> {
    let query = "SELECT id, full_name, role::text, login, password_hash, pin_code, status::text FROM users WHERE role = 'Worker' AND status = 'Active'";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut workers = Vec::new();
    for row in rows {
        workers.push(User {
            id: row.get("id"),
            full_name: row.get("full_name"),
            role: row.get("role"),
            login: row.get("login"),
            password_hash: row.get("password_hash"),
            pin_code: row.get("pin_code"),
            status: row.get("status"),
        });
    }

    Ok(workers)
}

#[tauri::command]
async fn check_database_triggers(state: tauri::State<'_, Database>) -> Result<String, String> {
    let query = "
        SELECT 
            t.tgname as trigger_name,
            c.relname as table_name,
            p.proname as function_name,
            CASE t.tgtype & 66
                WHEN 2 THEN 'BEFORE'
                WHEN 64 THEN 'INSTEAD OF'
                ELSE 'AFTER'
            END as trigger_timing,
            CASE t.tgtype & 28
                WHEN 4 THEN 'INSERT'
                WHEN 8 THEN 'DELETE'
                WHEN 16 THEN 'UPDATE'
                WHEN 12 THEN 'INSERT OR DELETE'
                WHEN 20 THEN 'INSERT OR UPDATE'
                WHEN 24 THEN 'DELETE OR UPDATE'
                WHEN 28 THEN 'INSERT OR DELETE OR UPDATE'
            END as trigger_events
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE c.relname IN ('orders', 'order_works', 'order_parts', 'order_defects')
        AND NOT t.tgisinternal
        ORDER BY c.relname, t.tgname
    ";

    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut result = String::new();
    result.push_str("=== DATABASE TRIGGERS ===\n");
    
    if rows.is_empty() {
        result.push_str("No custom triggers found in the database.\n");
    } else {
        for row in rows {
            let trigger_name: String = row.get("trigger_name");
            let table_name: String = row.get("table_name");
            let function_name: String = row.get("function_name");
            let trigger_timing: String = row.get("trigger_timing");
            let trigger_events: String = row.get("trigger_events");
            
            result.push_str(&format!(
                "Table: {} | Trigger: {} | Function: {} | Timing: {} | Events: {}\n",
                table_name, trigger_name, function_name, trigger_timing, trigger_events
            ));
        }
    }

    Ok(result)
}

#[tauri::command]
async fn debug_order_status(order_id: i32, state: tauri::State<'_, Database>) -> Result<String, String> {
    // Получаем информацию о заказе
    let order_query = "SELECT id, worker_id, status::text FROM orders WHERE id = $1";
    let order_row = sqlx::query(order_query)
        .bind(order_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut debug_info = String::new();
    
    if let Some(row) = order_row {
        let status: String = row.get("status");
        debug_info.push_str(&format!("Order {} status: {}\n", order_id, status));
    } else {
        return Err(format!("Order {} not found", order_id));
    }

    // Получаем информацию о работах
    let works_query = "SELECT id, service_name_snapshot, is_confirmed, worker_id FROM order_works WHERE order_id = $1";
    let works_rows = sqlx::query(works_query)
        .bind(order_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    debug_info.push_str(&format!("Works count: {}\n", works_rows.len()));
    for row in works_rows {
        let work_id: i32 = row.get("id");
        let service_name: String = row.get("service_name_snapshot");
        let is_confirmed: bool = row.get("is_confirmed");
        let worker_id: Option<i32> = row.get("worker_id");
        debug_info.push_str(&format!("  Work {}: {} - confirmed: {} - worker: {:?}\n", 
            work_id, service_name, is_confirmed, worker_id));
    }

    Ok(debug_info)
}

#[tauri::command]
async fn assign_workers_to_order(
    order_id: i32,
    work_assignments: Vec<(i32, i32)>, // (work_id, worker_id) pairs
    main_worker_id: Option<i32>, // Optional main worker for the entire order
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Назначаем работников на работы
    for (work_id, worker_id) in &work_assignments {
        let query = "UPDATE order_works SET worker_id = $1, status = 'Pending' WHERE id = $2 AND order_id = $3";
        sqlx::query(query)
            .bind(worker_id)
            .bind(work_id)
            .bind(order_id)
            .execute(&state.pool)
            .await
            .map_err(|e| format!("Database error assigning worker: {}", e))?;
    }

    // Обновляем статус заказа и назначаем основного исполнителя
    let mut tx = state.pool.begin().await.map_err(|e| format!("Database transaction error: {}", e))?;

    // Сначала обновляем статус заказа
    let status_query = "UPDATE orders SET status = $1::order_status WHERE id = $2";
    sqlx::query(status_query)
        .bind("In_Work")
        .bind(order_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Database error updating order status: {}", e))?;

    // Затем, если указан основной исполнитель, назначаем его
    if let Some(worker_id) = main_worker_id {
        let worker_query = "UPDATE orders SET worker_id = $1 WHERE id = $2";
        sqlx::query(worker_query)
            .bind(worker_id)
            .bind(order_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Database error assigning main worker: {}", e))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("Database transaction commit error: {}", e))?;

    Ok(format!("Workers assigned to order {} for {} works{}",
        order_id,
        work_assignments.len(),
        if let Some(worker_id) = main_worker_id {
            format!(", main worker assigned: {}", worker_id)
        } else {
            ", no main worker assigned".to_string()
        }))
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
async fn search_parts_by_vin(_vin: String, _query: String, _state: tauri::State<'_, Database>) -> Result<Vec<Part>, String> {
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

// Defect catalog management
#[derive(Serialize, Deserialize, Clone)]
struct DefectNode {
    id: i32,
    name: String,
    description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct DefectType {
    id: i32,
    node_id: i32,
    node_name: String, // Include node name for easier UI display
    name: String,
    description: Option<String>,
}

#[tauri::command]
async fn get_defect_nodes(state: tauri::State<'_, Database>) -> Result<Vec<DefectNode>, String> {
    let query = "SELECT id, name, description FROM defect_nodes ORDER BY name";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut nodes = Vec::new();
    for row in rows {
        nodes.push(DefectNode {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
        });
    }

    Ok(nodes)
}

#[tauri::command]
async fn get_defect_types_by_node(node_id: i32, state: tauri::State<'_, Database>) -> Result<Vec<DefectType>, String> {
    let query = "SELECT dt.id, dt.node_id, dn.name as node_name, dt.name, dt.description
                 FROM defect_types dt
                 JOIN defect_nodes dn ON dt.node_id = dn.id
                 WHERE dt.node_id = $1
                 ORDER BY dt.name";
    let rows = sqlx::query(query)
        .bind(node_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut types = Vec::new();
    for row in rows {
        types.push(DefectType {
            id: row.get("id"),
            node_id: row.get("node_id"),
            node_name: row.get("node_name"),
            name: row.get("name"),
            description: row.get("description"),
        });
    }

    Ok(types)
}

#[tauri::command]
async fn get_all_defect_types(state: tauri::State<'_, Database>) -> Result<Vec<DefectType>, String> {
    let query = "SELECT dt.id, dt.node_id, dn.name as node_name, dt.name, dt.description
                 FROM defect_types dt
                 JOIN defect_nodes dn ON dt.node_id = dn.id
                 ORDER BY dn.name, dt.name";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut types = Vec::new();
    for row in rows {
        types.push(DefectType {
            id: row.get("id"),
            node_id: row.get("node_id"),
            node_name: row.get("node_name"),
            name: row.get("name"),
            description: row.get("description"),
        });
    }

    Ok(types)
}

#[tauri::command]
async fn save_diagnostic_results(order_id: i32, diagnostician_id: i32, defect_type_ids: Vec<i32>, state: tauri::State<'_, Database>) -> Result<String, String> {
    let defects_count = defect_type_ids.len();
    for defect_type_id in &defect_type_ids {
        // Получаем информацию о типе неисправности
        let defect_type_query = "SELECT dt.name, dt.description, dn.name as node_name
                                 FROM defect_types dt
                                 JOIN defect_nodes dn ON dt.node_id = dn.id
                                 WHERE dt.id = $1";
        let defect_type_row = sqlx::query(defect_type_query)
            .bind(defect_type_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| format!("Database error fetching defect type: {}", e))?;

        let defect_name: String = defect_type_row.get("name");
        let defect_description: String = defect_type_row.get("description");
        let node_name: String = defect_type_row.get("node_name");

        // Вставляем неисправность, связанную с типом неисправности
        let defect_query = "INSERT INTO order_defects (order_id, diagnostician_id, defect_description, diagnostician_comment, is_confirmed, defect_type_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id";
        let defect_row = sqlx::query(defect_query)
            .bind(order_id)
            .bind(diagnostician_id)
            .bind(format!("{}: {}", node_name, defect_name)) // формируем полное описание узел/неисправность
            .bind(defect_description) // подробное описание
            .bind(false) // is_confirmed пока false
            .bind(defect_type_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| format!("Database error inserting defect: {}", e))?;

        let defect_id: i32 = defect_row.get("id");

        // Находим связанную услугу для этого типа неисправности
        let service_query = "SELECT s.id, s.name, s.base_price, s.norm_hours
                             FROM defect_type_services dts
                             JOIN services_reference s ON dts.service_id = s.id
                             WHERE dts.defect_type_id = $1
                             LIMIT 1";
        let service_row = sqlx::query(service_query)
            .bind(defect_type_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| format!("Database error fetching service for defect: {}", e))?;

        // Если найдена связанная услуга, создаем работу на основе этой услуги
        if let Some(service_row) = service_row {
            let service_id: i32 = service_row.get("id");
            let service_name: String = service_row.get("name");
            let base_price: BigDecimal = service_row.get("base_price");
            let norm_hours: BigDecimal = service_row.get("norm_hours");

            // Создаем работу, связанную с этой услугой
            let work_query = "INSERT INTO order_works (order_id, service_id, service_name_snapshot, price, norm_hours, defect_id, is_confirmed) VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6, $7)";
            sqlx::query(work_query)
                .bind(order_id)
                .bind(service_id)
                .bind(service_name) // используем имя услуги как название работы
                .bind(base_price) // используем базовую цену из справочника
                .bind(norm_hours)
                .bind(defect_id)
                .bind(false) // is_confirmed пока false
                .execute(&state.pool)
                .await
                .map_err(|e| format!("Database error inserting work: {}", e))?;
        } else {
            // Если нет связанной услуги, создаем работу с базовыми параметрами
            let work_query = "INSERT INTO order_works (order_id, service_name_snapshot, price, norm_hours, defect_id, is_confirmed) VALUES ($1, $2, $3::numeric, $4::numeric, $5, $6)";
            sqlx::query(work_query)
                .bind(order_id)
                .bind(format!("{}: {}", node_name, defect_name)) // используем узел/неисправность как название работы
                .bind(BigDecimal::from(0)) // базовая цена 0 до согласования
                .bind(BigDecimal::from(1)) // условная норма часов
                .bind(defect_id)
                .bind(false) // is_confirmed пока false
                .execute(&state.pool)
                .await
                .map_err(|e| format!("Database error inserting work: {}", e))?;
        }
    }
    Ok(format!("{} diagnostic results saved for order {}, with corresponding works", defects_count, order_id))
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
            get_order_works_by_order_id,
            get_order_parts_by_order_id,
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
            add_part_to_order,
            confirm_order_parts_and_works,
            get_available_workers,
            assign_workers_to_order,
            debug_order_status,
            check_database_triggers,
            get_defect_nodes,
            get_defect_types_by_node,
            get_all_defect_types
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
