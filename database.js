
const { Pool } = require("pg");
require("dotenv").config();

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initDb() {
    try {
        const client = await db.connect();

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS app_data (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                data_key VARCHAR(255) NOT NULL,
                data_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (username, data_key)
            )
        `);

        client.release();
        console.log("Supabase (PostgreSQL) tables verified/initialized.");
    } catch (err) {
        console.error("CRITICAL: Supabase initialization failed:", err.message);
    }
}

initDb();

module.exports = db;
