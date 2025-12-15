use bcrypt::{hash, DEFAULT_COST};

fn main() {
    // Default passwords for the test users
    let users_passwords = vec![
        ("admin", "admin123"),
        ("master", "master123"),
        ("diagnostician", "diag123"),
        ("storekeeper", "store123"),
        ("worker", "worker123"),
        ("worker2", "worker123"),
        ("worker3", "worker123"),
    ];

    println!("-- Generated bcrypt hashes for users:");
    for (login, password) in users_passwords {
        let hashed = hash(password, DEFAULT_COST).expect("Failed to hash password");
        println!("-- {}: {} -> {}", login, password, hashed);
        println!("UPDATE users SET password_hash = '{}' WHERE login = '{}';", hashed, login);
    }
    
    // Also generate a hash for a worker with PIN (for worker accounts)
    let worker_pin_hashed = hash("1234", DEFAULT_COST).expect("Failed to hash PIN");
    println!("-- Worker PIN '1234' hash: {}", worker_pin_hashed);
    println!("UPDATE users SET pin_code = '{}' WHERE role = 'Worker';", worker_pin_hashed);
}