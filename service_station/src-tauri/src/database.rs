use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;
use url::Url;
use dotenv::dotenv;

pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        // Load environment variables from .env file
        dotenv().ok();

        // Get database URL from environment variables
        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| {
                let mut url = Url::parse("postgresql://localhost:5432/cursat").expect("Invalid database URL");
                url.set_username("gisei").expect("Invalid username");
                url.set_password(Some("#R85}9an")).expect("Invalid password");
                url.to_string()
            });

        // Create connection pool
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await?;

        println!("Database connected successfully!");

        Ok(Self { pool })
    }
}