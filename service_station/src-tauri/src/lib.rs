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

                        // Логируем успешный вход пользователя
                        let log_result = log_event(
                            Some(user.id),
                            "Login".to_string(),
                            format!("Успешный вход пользователя '{}' с ролью '{}'", user.full_name, user.role),
                            None, // IP-адрес пока не реализован
                            state.clone()
                        ).await;

                        if let Err(e) = log_result {
                            eprintln!("Error logging user login: {}", e);
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

        // Логируем успешный вход работника
        let log_result = log_event(
            Some(user.id),
            "Login".to_string(),
            format!("Успешный вход работника '{}' с ролью '{}'", user.full_name, user.role),
            None, // IP-адрес пока не реализован
            state.clone()
        ).await;

        if let Err(e) = log_result {
            eprintln!("Error logging worker login: {}", e);
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
    // Query all orders for the master from the database (excluding Closed and Cancelled)
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

    println!("Fetched {} orders for master", orders.len());
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
async fn get_orders_for_worker(worker_id: i32, state: tauri::State<'_, Database>) -> Result<Vec<Order>, String> {
    // Query to get orders assigned to a specific worker
    let query = "SELECT id, client_id, car_id, master_id, worker_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE worker_id = $1 AND status IN ('In_Work')";
    let rows = sqlx::query(query)
        .bind(worker_id)
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

    println!("Fetched {} orders for worker {}", orders.len(), worker_id);
    for order in &orders {
        println!("Order {} status: {}", order.id, order.status);
    }

    Ok(orders)
}

// Service-DefectType relationship functions
#[tauri::command]
async fn get_service_defect_types(service_id: i32, state: tauri::State<'_, Database>) -> Result<Vec<DefectType>, String> {
    let query = "SELECT dt.id, dt.node_id, dn.name as node_name, dt.name, dt.description
                 FROM defect_type_services dts
                 JOIN defect_types dt ON dts.defect_type_id = dt.id
                 JOIN defect_nodes dn ON dt.node_id = dn.id
                 WHERE dts.service_id = $1
                 ORDER BY dn.name, dt.name";
    let rows = sqlx::query(query)
        .bind(service_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut defect_types = Vec::new();
    for row in rows {
        defect_types.push(DefectType {
            id: row.get("id"),
            node_id: row.get("node_id"),
            node_name: row.get("node_name"),
            name: row.get("name"),
            description: row.get("description"),
        });
    }

    Ok(defect_types)
}

#[tauri::command]
async fn link_service_to_defect_type(
    service_id: i32,
    defect_type_ids: Vec<i32>,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    let mut tx = state.pool.begin().await.map_err(|e| format!("Database transaction error: {}", e))?;

    // Удаляем существующие связи для этой услуги
    let delete_query = "DELETE FROM defect_type_services WHERE service_id = $1";
    sqlx::query(delete_query)
        .bind(service_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Database error deleting old links: {}", e))?;

    // Создаем новые связи
    for defect_type_id in &defect_type_ids {
        let insert_query = "INSERT INTO defect_type_services (defect_type_id, service_id) VALUES ($1, $2)";
        sqlx::query(insert_query)
            .bind(defect_type_id)
            .bind(service_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Database error linking service to defect type: {}", e))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("Database transaction commit error: {}", e))?;

    Ok(format!("Услуга {} связана с {} типами неисправностей", service_id, defect_type_ids.len()))
}

#[tauri::command]
async fn get_all_defect_types_grouped(state: tauri::State<'_, Database>) -> Result<Vec<DefectNodeWithTypes>, String> {
    // Сначала получим все узлы
    let node_query = "SELECT id, name, description FROM defect_nodes ORDER BY name";
    let node_rows = sqlx::query(node_query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut nodes_with_types = Vec::new();
    for node_row in node_rows {
        let node_id: i32 = node_row.get("id");
        let node_name: String = node_row.get("name");
        let node_description: String = node_row.get("description");

        // Затем получим типы неисправностей для каждого узла
        let type_query = "SELECT id, name, description FROM defect_types WHERE node_id = $1 ORDER BY name";
        let type_rows = sqlx::query(type_query)
            .bind(node_id)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        let mut defect_types = Vec::new();
        for type_row in type_rows {
            defect_types.push(DefectType {
                id: type_row.get("id"),
                node_id,
                node_name: node_name.clone(), // Временно, будет перезаписан ниже, но нужен для типизации
                name: type_row.get("name"),
                description: type_row.get("description"),
            });
        }

        nodes_with_types.push(DefectNodeWithTypes {
            node_id,
            node_name,
            node_description,
            defect_types,
        });
    }

    Ok(nodes_with_types)
}

#[derive(Serialize, Deserialize, Clone)]
struct DefectNodeWithTypes {
    node_id: i32,
    node_name: String,
    node_description: String,
    defect_types: Vec<DefectType>,
}

#[tauri::command]
async fn get_archived_orders(
    status_filter: String,
    period_start: String,
    period_end: String,
    search_query: String,
    state: tauri::State<'_, Database>
) -> Result<Vec<Order>, String> {
    // Query archived orders based on filters
    let mut query_builder = sqlx::QueryBuilder::new("SELECT id, client_id, car_id, master_id, worker_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders");

    // Add initial WHERE clause based on status filter
    if status_filter != "All" {
        if status_filter == "Archived" {
            // Show only archived statuses ('Closed', 'Cancelled')
            query_builder.push(" WHERE status IN ('Closed', 'Cancelled') AND created_at BETWEEN ");
        } else {
            // Show only the selected status
            query_builder.push(" WHERE status = ");
            query_builder.push_bind(&status_filter);
            query_builder.push(" AND created_at BETWEEN ");
        }
    } else {
        // If showing all statuses, only use date filter
        query_builder.push(" WHERE created_at BETWEEN ");
    }
    query_builder.push_bind(&period_start);
    query_builder.push(" AND ");
    query_builder.push_bind(&period_end);

    // Add search filter if provided
    if !search_query.is_empty() {
        query_builder.push(" AND (");
        query_builder.push("LOWER(complaint) LIKE CONCAT('%', LOWER(");
        query_builder.push_bind(&search_query);
        query_builder.push("), '%') OR ");
        query_builder.push("LOWER(total_amount::text) LIKE CONCAT('%', LOWER(");
        query_builder.push_bind(&search_query);
        query_builder.push("), '%'))");
    }

    query_builder.push(" ORDER BY created_at DESC");

    let query_result = query_builder.build();
    let rows = query_result.fetch_all(&state.pool).await.map_err(|e| format!("Database error: {}", e))?;

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

    Ok(orders)
}

#[derive(Serialize, Deserialize, Clone)]
struct Service {
    id: i32,
    name: String,
    base_price: String, // DECIMAL as string
    norm_hours: String, // DECIMAL as string
}

#[tauri::command]
async fn get_all_services(state: tauri::State<'_, Database>) -> Result<Vec<Service>, String> {
    let query = "SELECT id, name, base_price::text, norm_hours::text FROM services_reference ORDER BY name";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut services = Vec::new();
    for row in rows {
        services.push(Service {
            id: row.get("id"),
            name: row.get("name"),
            base_price: row.get("base_price"),
            norm_hours: row.get("norm_hours"),
        });
    }

    Ok(services)
}

#[tauri::command]
async fn create_service(
    session_token: String,
    name: String,
    base_price: f64,
    norm_hours: f64,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Validate inputs
    if name.trim().is_empty() {
        return Err("Название услуги не может быть пустым".to_string());
    }

    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    // Insert the new service into the database
    let query = "INSERT INTO services_reference (name, base_price, norm_hours) VALUES ($1, $2::numeric, $3::numeric) RETURNING id";
    let row = sqlx::query(query)
        .bind(&name)
        .bind(base_price)
        .bind(norm_hours)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let new_id: i32 = row.get("id");

    // Логируем создание услуги
    let log_result = log_event(
        Some(user.id),
        "Service_Creation".to_string(),
        format!("Создана новая услуга '{}' с ID {}", name, new_id),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging service creation: {}", e);
    }

    Ok(format!("Услуга успешно создана с ID: {}", new_id))
}

#[tauri::command]
async fn update_service(
    session_token: String,
    service_id: i32,
    name: String,
    base_price: f64,
    norm_hours: f64,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Validate inputs
    if name.trim().is_empty() {
        return Err("Название услуги не может быть пустым".to_string());
    }

    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    // Get the existing service name for logging
    let existing_query = "SELECT name FROM services_reference WHERE id = $1";
    let existing_row = sqlx::query(existing_query)
        .bind(service_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if existing_row.is_none() {
        return Err(format!("Услуга с ID {} не найдена", service_id));
    }

    // Update the service in the database
    let query = "UPDATE services_reference SET name = $1, base_price = $2::numeric, norm_hours = $3::numeric WHERE id = $4";
    let result = sqlx::query(query)
        .bind(&name)
        .bind(base_price)
        .bind(norm_hours)
        .bind(service_id)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if result.rows_affected() == 0 {
        return Err(format!("Услуга с ID {} не найдена", service_id));
    }

    // Логируем изменение услуги
    let log_result = log_event(
        Some(user.id),
        "Service_Update".to_string(),
        format!("Обновлена услуга с ID {}: '{}' -> '{}'", service_id, existing_row.unwrap().get::<String, _>("name"), name),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging service update: {}", e);
    }

    Ok(format!("Услуга с ID {} успешно обновлена", service_id))
}

#[tauri::command]
async fn delete_service(session_token: String, service_id: i32, state: tauri::State<'_, Database>) -> Result<String, String> {
    // First, check if there are any order_works associated with this service
    let check_query = "SELECT COUNT(*) as count FROM order_works WHERE service_id = $1";
    let row = sqlx::query(check_query)
        .bind(service_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let associated_works_count: i64 = row.get("count");
    if associated_works_count > 0 {
        return Err("Невозможно удалить услугу, так как на неё ссылаются заказы".to_string());
    }

    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    // Get the existing service name for logging
    let existing_query = "SELECT name FROM services_reference WHERE id = $1";
    let existing_row = sqlx::query(existing_query)
        .bind(service_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if existing_row.is_none() {
        return Err(format!("Услуга с ID {} не найдена", service_id));
    }

    // Delete the service from the database
    let query = "DELETE FROM services_reference WHERE id = $1";
    let result = sqlx::query(query)
        .bind(service_id)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if result.rows_affected() == 0 {
        return Err(format!("Услуга с ID {} не найдена", service_id));
    }

    // Логируем удаление услуги
    let log_result = log_event(
        Some(user.id),
        "Service_Delete".to_string(),
        format!("Удалена услуга с ID {}: '{}'", service_id, existing_row.unwrap().get::<String, _>("name")),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging service deletion: {}", e);
    }

    Ok(format!("Услуга с ID {} успешно удалена", service_id))
}

#[tauri::command]
async fn get_order_details_for_worker(order_id: i32, worker_id: i32, state: tauri::State<'_, Database>) -> Result<(Order, Vec<OrderWork>, Vec<OrderPart>, Vec<OrderDefect>), String> {
    // Проверяем, что заказ назначен этому работнику
    let check_query = "SELECT worker_id FROM orders WHERE id = $1";
    let row = sqlx::query(check_query)
        .bind(order_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error checking order assignment: {}", e))?;

    let assigned_worker_id: Option<i32> = row.get("worker_id");
    if assigned_worker_id != Some(worker_id) {
        return Err(format!("Order {} is not assigned to worker {}", order_id, worker_id));
    }

    // Получаем информацию о заказе
    let order_query = "SELECT id, client_id, car_id, master_id, worker_id, status::text, complaint, current_mileage, prepayment::text, total_amount::text, created_at::text, completed_at::text FROM orders WHERE id = $1";
    let order_row = sqlx::query(order_query)
        .bind(order_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error fetching order: {}", e))?;

    let order = Order {
        id: order_row.get("id"),
        client_id: order_row.get("client_id"),
        car_id: order_row.get("car_id"),
        master_id: order_row.get("master_id"),
        worker_id: order_row.get("worker_id"),
        status: order_row.get("status"),
        complaint: order_row.get("complaint"),
        current_mileage: order_row.get("current_mileage"),
        prepayment: order_row.get("prepayment"),
        total_amount: order_row.get("total_amount"),
        created_at: order_row.get("created_at"),
        completed_at: order_row.get("completed_at"),
    };

    // Получаем работы по заказу
    let works = get_order_works_by_order_id(order_id, state.clone()).await?;

    // Получаем запчасти по заказу
    let parts = get_order_parts_by_order_id(order_id, state.clone()).await?;

    // Получаем неисправности для отчета диагностики
    let defects = get_diagnostic_results_by_order_id(order_id, state).await?;

    Ok((order, works, parts, defects))
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
async fn add_part_to_order(session_token: String, order_id: i32, part_name: String, brand: String, supplier: String, price: f64, _availability: String, _part_number: String, state: tauri::State<'_, Database>) -> Result<String, String> {
    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

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

    // Логируем добавление запчасти в заказ
    let log_result = log_event(
        Some(user.id),
        "Add_Part_To_Order".to_string(),
        format!("Добавлена запчасть '{}' (бренд: {}, поставщик: {}) в заказ {} за {} руб.",
                part_name, brand, supplier, order_id, price),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging part addition: {}", e);
    }

    Ok(format!("Part '{}' added to order {}", part_name, order_id))
}

#[derive(serde::Deserialize)]
struct AddWarehouseItemRequest {
    #[serde(rename = "sessionToken")]
    session_token: String,
    #[serde(rename = "name")]
    name: String,
    #[serde(rename = "brand")]
    brand: String,
    #[serde(rename = "article")]
    article: String,
    #[serde(rename = "locationCell")]
    location_cell: String,
    #[serde(rename = "quantity")]
    quantity: i32,
    #[serde(rename = "minQuantity")]
    min_quantity: i32,
    #[serde(rename = "purchasePrice")]
    purchase_price: f64,
    #[serde(rename = "sellingPrice")]
    selling_price: f64,
}

#[tauri::command]
async fn add_warehouse_item_with_json(
    request: AddWarehouseItemRequest,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    add_warehouse_item(
        request.session_token,
        request.name,
        request.brand,
        request.article,
        request.location_cell,
        request.quantity,
        request.min_quantity,
        request.purchase_price,
        request.selling_price,
        state
    ).await
}

#[tauri::command]
async fn add_warehouse_item(
    session_token: String,
    name: String,
    brand: String,
    article: String,
    location_cell: String,
    quantity: i32,
    min_quantity: i32,
    purchase_price: f64,
    selling_price: f64,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    // Добавляем новую позицию на склад
    let query = "INSERT INTO warehouse (name, brand, article, location_cell, quantity, min_quantity, purchase_price, selling_price) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric) RETURNING id";
    let row = sqlx::query(query)
        .bind(&name)
        .bind(&brand)
        .bind(&article)
        .bind(&location_cell)
        .bind(quantity)
        .bind(min_quantity)
        .bind(purchase_price)
        .bind(selling_price)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let new_id: i32 = row.get("id");

    // Логируем добавление новой позиции на склад
    let log_result = log_event(
        Some(user.id),
        "Add_Warehouse_Item".to_string(),
        format!("Добавлена новая позиция на склад: '{}' (бренд: {}, артикул: {}) с ID {}",
                name, brand, article, new_id),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging warehouse item addition: {}", e);
    }

    Ok(format!("Новая позиция добавлена на склад с ID: {}", new_id))
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
    session_token: String,
    order_id: i32,
    work_assignments: Vec<(i32, i32)>, // (work_id, worker_id) pairs
    main_worker_id: Option<i32>, // Optional main worker for the entire order
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

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

    // Логируем назначение работников к заказу
    let log_result = log_event(
        Some(user.id),
        "Assign_Workers".to_string(),
        format!("Назначены работники к заказу {}: {} работников, основной исполнитель: {:?}",
                order_id, work_assignments.len(), main_worker_id),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging worker assignment: {}", e);
    }

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
async fn create_order(session_token: String, client_id: i32, car_id: i32, complaint: Option<String>, current_mileage: Option<i32>, state: tauri::State<'_, Database>) -> Result<String, String> {
    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

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

    // Логируем создание заказа
    let log_result = log_event(
        Some(user.id),
        "Create_Order".to_string(),
        format!("Создан новый заказ с ID {} для клиента {} и автомобиля {}", order_id, client_id, car_id),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging order creation: {}", e);
    }

    Ok(format!("Order created successfully with ID: {}", order_id))
}

#[tauri::command]
async fn create_client(
    session_token: String,
    full_name: String,
    phone: String,
    address: Option<String>,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    // Проверяем, что обязательные поля заполнены
    if full_name.trim().is_empty() {
        return Err("ФИО клиента не может быть пустым".to_string());
    }

    if phone.trim().is_empty() {
        return Err("Телефон клиента не может быть пустым".to_string());
    }

    // Проверяем, существует ли уже клиент с таким телефоном
    let check_query = "SELECT id FROM clients WHERE phone = $1";
    let existing_client = sqlx::query(check_query)
        .bind(&phone)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error checking existing client: {}", e))?;

    if existing_client.is_some() {
        return Err("Клиент с таким телефоном уже существует".to_string());
    }

    // Вставляем нового клиента в базу данных
    let query = "INSERT INTO clients (full_name, phone, address) VALUES ($1, $2, $3) RETURNING id";
    let row = sqlx::query(query)
        .bind(&full_name)
        .bind(&phone)
        .bind(&address)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let client_id: i32 = row.get("id");

    // Логируем создание клиента
    let log_result = log_event(
        Some(user.id),
        "Create_Client".to_string(),
        format!("Создан новый клиент '{}' с ID {} и телефоном {}", full_name, client_id, phone),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging client creation: {}", e);
    }

    Ok(format!("Клиент успешно создан с ID: {}", client_id))
}

#[derive(serde::Deserialize)]
struct CreateCarRequest {
    #[serde(rename = "sessionToken")]
    session_token: String,
    #[serde(rename = "clientId")]
    client_id: Option<i32>,
    #[serde(rename = "vin")]
    vin: Option<String>,
    #[serde(rename = "licensePlate")]
    license_plate: Option<String>,
    #[serde(rename = "make")]
    make: String,
    #[serde(rename = "model")]
    model: String,
    #[serde(rename = "productionYear")]
    production_year: Option<i32>,
    #[serde(rename = "mileage")]
    mileage: i32,
}

#[tauri::command]
async fn create_car_with_json(
    request: CreateCarRequest,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    create_car(
        request.session_token,
        request.client_id,
        request.vin,
        request.license_plate,
        request.make,
        request.model,
        request.production_year,
        request.mileage,
        state
    ).await
}

#[derive(serde::Deserialize)]
struct CreateClientRequest {
    #[serde(rename = "sessionToken")]
    session_token: String,
    #[serde(rename = "fullName")]
    full_name: String,
    #[serde(rename = "phone")]
    phone: String,
    #[serde(rename = "address")]
    address: Option<String>,
}

#[tauri::command]
async fn create_client_with_json(
    request: CreateClientRequest,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    create_client(
        request.session_token,
        request.full_name,
        request.phone,
        request.address,
        state
    ).await
}

#[tauri::command]
async fn get_all_clients(state: tauri::State<'_, Database>) -> Result<Vec<Client>, String> {
    let query = "SELECT id, full_name, phone, address, created_at::text FROM clients ORDER BY full_name";
    let rows = sqlx::query(query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let mut clients = Vec::new();
    for row in rows {
        clients.push(Client {
            id: row.get("id"),
            full_name: row.get("full_name"),
            phone: row.get("phone"),
            address: row.get("address"),
            created_at: row.get("created_at"),
        });
    }

    Ok(clients)
}

#[tauri::command]
async fn create_car(
    session_token: String,
    client_id: Option<i32>,
    vin: Option<String>,
    license_plate: Option<String>,
    make: String,
    model: String,
    production_year: Option<i32>,
    mileage: i32,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    // Проверяем, что обязательные поля заполнены
    if make.trim().is_empty() {
        return Err("Марка автомобиля не может быть пустой".to_string());
    }

    if model.trim().is_empty() {
        return Err("Модель автомобиля не может быть пустой".to_string());
    }

    if license_plate.is_none() || license_plate.as_ref().unwrap().trim().is_empty() {
        return Err("Государственный номер не может быть пустым".to_string());
    }

    // Проверяем, существует ли уже автомобиль с таким VIN или госномером
    if let Some(ref vin_value) = vin {
        if !vin_value.is_empty() {
            let existing_car_query = "SELECT id FROM cars WHERE vin = $1";
            let existing_car = sqlx::query(existing_car_query)
                .bind(vin_value)
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| format!("Database error checking existing car by VIN: {}", e))?;

            if existing_car.is_some() {
                return Err("Автомобиль с таким VIN или госномером уже существует".to_string());
            }
        }
    }

    if let Some(ref plate_value) = license_plate {
        if !plate_value.is_empty() {
            let existing_car_query = "SELECT id FROM cars WHERE license_plate = $1";
            let existing_car = sqlx::query(existing_car_query)
                .bind(plate_value)
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| format!("Database error checking existing car by license plate: {}", e))?;

            if existing_car.is_some() {
                return Err("Автомобиль с таким VIN или госномером уже существует".to_string());
            }
        }
    }

    // Если указан ID клиента, проверим его существование
    if let Some(cid) = client_id {
        let client_check_query = "SELECT id FROM clients WHERE id = $1";
        let existing_client = sqlx::query(client_check_query)
            .bind(cid)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| format!("Database error checking client: {}", e))?;

        if existing_client.is_none() {
            return Err("Указанный клиент не существует".to_string());
        }
    };

    // Вставляем новый автомобиль в базу данных
    let insert_query = "INSERT INTO cars (client_id, vin, license_plate, make, model, production_year, mileage) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id";
    let row = sqlx::query(insert_query)
        .bind(client_id)
        .bind(&vin)
        .bind(&license_plate)
        .bind(&make)
        .bind(&model)
        .bind(&production_year)
        .bind(&mileage)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    let car_id: i32 = row.get("id");

    // Логируем создание автомобиля
    let log_result = log_event(
        Some(user.id),
        "Create_Car".to_string(),
        format!("Создан новый автомобиль '{}' '{}' с ID {}, госномер: {}, VIN: {}",
                make, model, car_id,
                license_plate.as_deref().unwrap_or("N/A"),
                vin.as_deref().unwrap_or("N/A")),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging car creation: {}", e);
    }

    Ok(format!("Автомобиль успешно создан с ID: {}", car_id))
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
async fn create_user(session_token: String, user_data: User, state: tauri::State<'_, Database>) -> Result<User, String> {
    use bcrypt::hash;

    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

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

    // Логируем создание пользователя
    let log_result = log_event(
        Some(user.id),
        "Create_User".to_string(),
        format!("Создан новый пользователь '{}' с ID {}", user_data.full_name, new_id),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging user creation: {}", e);
    }

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
async fn update_user(session_token: String, user_id: i32, user_data: User, state: tauri::State<'_, Database>) -> Result<String, String> {
    use bcrypt::hash;

    // Получаем информацию о пользователе из сессии
    let session_user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    // Получаем существующие данные пользователя для логирования
    let existing_user_query = "SELECT full_name FROM users WHERE id = $1";
    let existing_user_row = sqlx::query(existing_user_query)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if existing_user_row.is_none() {
        return Err(format!("Пользователь с ID {} не найден", user_id));
    }

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

    // Логируем изменение пользователя
    let log_result = log_event(
        Some(session_user.id),
        "Update_User".to_string(),
        format!("Изменен пользователь с ID {}: '{}' -> '{}'", user_id, existing_user_row.unwrap().get::<String, _>("full_name"), user_data.full_name),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging user update: {}", e);
    }

    Ok("User updated successfully".to_string())
}

#[tauri::command]
async fn delete_user(session_token: String, user_id: i32, state: tauri::State<'_, Database>) -> Result<String, String> {
    // Получаем информацию о пользователе из сессии
    let session_user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    // Получаем существующие данные пользователя для логирования
    let existing_user_query = "SELECT full_name FROM users WHERE id = $1";
    let existing_user_row = sqlx::query(existing_user_query)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if existing_user_row.is_none() {
        return Err(format!("Пользователь с ID {} не найден", user_id));
    }

    let query = "DELETE FROM users WHERE id=$1";
    sqlx::query(query)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    // Логируем удаление пользователя
    let log_result = log_event(
        Some(session_user.id),
        "Delete_User".to_string(),
        format!("Удален пользователь с ID {}: '{}'", user_id, existing_user_row.unwrap().get::<String, _>("full_name")),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging user deletion: {}", e);
    }

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
            let work_query = "INSERT INTO order_works (order_id, service_id, service_name_snapshot, price, norm_hours, is_confirmed) VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6) RETURNING id";
            let work_row = sqlx::query(work_query)
                .bind(order_id)
                .bind(service_id)
                .bind(service_name) // используем имя услуги как название работы
                .bind(base_price) // используем базовую цену из справочника
                .bind(norm_hours)
                .bind(false) // is_confirmed пока false
                .fetch_one(&state.pool)
                .await
                .map_err(|e| format!("Database error inserting work: {}", e))?;

            // Получаем ID созданной работы
            let work_id: i32 = work_row.get("id");

            // Создаем связь между работой и неисправностью в отдельной таблице
            let work_defect_query = "INSERT INTO order_works_defects (work_id, defect_id) VALUES ($1, $2)";
            sqlx::query(work_defect_query)
                .bind(work_id)
                .bind(defect_id)
                .execute(&state.pool)
                .await
                .map_err(|e| format!("Database error linking work to defect: {}", e))?;
        } else {
            // Если нет связанной услуги, создаем работу с базовыми параметрами
            let work_query = "INSERT INTO order_works (order_id, service_name_snapshot, price, norm_hours, is_confirmed) VALUES ($1, $2, $3::numeric, $4::numeric, $5) RETURNING id";
            let work_row = sqlx::query(work_query)
                .bind(order_id)
                .bind(format!("{}: {}", node_name, defect_name)) // используем узел/неисправность как название работы
                .bind(BigDecimal::from(0)) // базовая цена 0 до согласования
                .bind(BigDecimal::from(1)) // условная норма часов
                .bind(false) // is_confirmed пока false
                .fetch_one(&state.pool)
                .await
                .map_err(|e| format!("Database error inserting work: {}", e))?;

            // Получаем ID созданной работы
            let work_id: i32 = work_row.get("id");

            // Создаем связь между работой и неисправностью в отдельной таблице
            let work_defect_query = "INSERT INTO order_works_defects (work_id, defect_id) VALUES ($1, $2)";
            sqlx::query(work_defect_query)
                .bind(work_id)
                .bind(defect_id)
                .execute(&state.pool)
                .await
                .map_err(|e| format!("Database error linking work to defect: {}", e))?;
        }
    }
    Ok(format!("{} diagnostic results saved for order {}, with corresponding works", defects_count, order_id))
}

#[tauri::command]
async fn update_order_status(session_token: String, order_id: i32, new_status: String, state: tauri::State<'_, Database>) -> Result<String, String> {
    // Получаем информацию о пользователе из сессии
    let user = {
        let sessions = SESSIONS.lock().map_err(|_| "Session lock error")?;
        sessions.get(&session_token).cloned().ok_or("Invalid session token")?
    };

    println!("Updating order {} status to {}", order_id, new_status);

    // Проверим, существует ли заказ с указанным ID
    let check_query = "SELECT status::text, client_id, car_id FROM orders WHERE id = $1";
    let row = sqlx::query(check_query)
        .bind(order_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Database check error: {}", e))?;

    let (current_status, client_id, car_id) = match row {
        Some(row) => {
            let current_status: String = row.get("status");
            let client_id: i32 = row.get("client_id");
            let car_id: i32 = row.get("car_id");
            println!("Current status of order {}: {}", order_id, current_status);
            (current_status, client_id, car_id)
        },
        None => {
            return Err(format!("Order {} not found", order_id));
        }
    };

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

    // Логируем изменение статуса заказа
    let log_result = log_event(
        Some(user.id),
        "Update_Order_Status".to_string(),
        format!("Изменен статус заказа {} (клиент: {}, авто: {}) с '{}' на '{}'", order_id, client_id, car_id, current_status, updated_status),
        None, // IP-адрес пока не реализован
        state.clone()
    ).await;

    if let Err(e) = log_result {
        eprintln!("Error logging order status update: {}", e);
    }

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
async fn get_system_logs(filters: String, state: tauri::State<'_, Database>) -> Result<String, String> {
    use serde_json::Value;

    // Парсим фильтры из JSON строки
    let filter_json: Value = serde_json::from_str(&filters).map_err(|e| format!("Invalid filters JSON: {}", e))?;

    let mut query = "SELECT sl.id, sl.user_id, sl.event_type, sl.description, sl.ip_address, sl.created_at, u.full_name as user_name FROM system_logs sl LEFT JOIN users u ON sl.user_id = u.id".to_string();
    let mut conditions = Vec::new();
    let mut params = Vec::new();

    // Фильтр по типу события
    if let Some(event_filter) = filter_json.get("filter").and_then(|v| v.as_str()) {
        if event_filter != "Все события" {
            conditions.push("sl.event_type = $1");
            params.push(event_filter.to_string());
        }
    }

    // Поиск по описанию
    if let Some(search) = filter_json.get("search").and_then(|v| v.as_str()) {
        if !search.is_empty() {
            let search_pattern = format!("%{}%", search.to_lowercase());
            conditions.push("LOWER(sl.description) LIKE $2");
            params.push(search_pattern);
        }
    }

    // Добавляем условия к запросу
    if !conditions.is_empty() {
        query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    }

    // Сортируем по времени создания (новые первыми)
    query.push_str(" ORDER BY sl.created_at DESC LIMIT 100"); // Ограничим выборку для производительности

    let mut query_builder = sqlx::QueryBuilder::new(query);

    // Добавляем параметры
    for param in params.iter() {
        query_builder.push_bind(param);
    }

    let query_result = query_builder.build();
    let rows = query_result.fetch_all(&state.pool).await.map_err(|e| format!("Database error: {}", e))?;

    // Формируем результат в формате JSON
    let mut logs_json = Vec::new();
    for row in rows {
        let created_at: chrono::NaiveDateTime = row.get("created_at");
        let log_entry = serde_json::json!({
            "id": row.get::<i32, _>("id"),
            "user": row.get::<Option<String>, _>("user_name").unwrap_or_else(|| "System".to_string()),
            "event": row.get::<String, _>("event_type"),
            "details": row.get::<String, _>("description"),
            "timestamp": created_at.format("%Y-%m-%d %H:%M:%S").to_string(),  // Форматируем дату в строку
            "ip": row.get::<Option<String>, _>("ip_address").unwrap_or_else(|| "N/A".to_string())
        });
        logs_json.push(log_entry);
    }

    serde_json::to_string(&logs_json).map_err(|e| format!("JSON serialization error: {}", e))
}

#[tauri::command]
async fn log_event(
    user_id: Option<i32>,
    event_type: String,
    description: String,
    ip_address: Option<String>,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    let query = "INSERT INTO system_logs (user_id, event_type, description, ip_address) VALUES ($1, $2, $3, $4)";

    sqlx::query(query)
        .bind(user_id)
        .bind(&event_type)
        .bind(&description)
        .bind(&ip_address)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database error logging event: {}", e))?;

    Ok("Event logged successfully".to_string())
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
            create_client,
            create_car,
            create_client_with_json,
            create_car_with_json,
            get_all_clients,
            get_all_users,
            create_user,
            update_user,
            delete_user,
            get_system_settings,
            save_system_settings,
            get_system_logs,
            search_parts_by_vin,
            add_part_to_order,
            add_warehouse_item,
            add_warehouse_item_with_json,
            confirm_order_parts_and_works,
            get_available_workers,
            assign_workers_to_order,
            debug_order_status,
            check_database_triggers,
            get_defect_nodes,
            get_defect_types_by_node,
            get_all_defect_types,
            get_orders_for_worker,
            get_order_details_for_worker,
            get_archived_orders,
            get_all_services,
            create_service,
            update_service,
            delete_service,
            get_service_defect_types,
            link_service_to_defect_type,
            get_all_defect_types_grouped,
            create_user,
            update_user,
            delete_user,
            get_system_logs,
            log_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
