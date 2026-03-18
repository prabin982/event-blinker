const pgp = require("pg-promise")()
require("dotenv").config()

// Log connection attempt (without sensitive data)
const dbHost = process.env.DB_HOST || "localhost"
const dbName = process.env.DB_NAME || "event_blinker"
const isProduction = process.env.NODE_ENV === "production" || !!process.env.DATABASE_URL

console.log(`[DB] Attempting connection to ${process.env.DATABASE_URL ? "DATABASE_URL" : `${dbHost}/${dbName}`}`)
console.log(`[DB] SSL mode: ${isProduction ? "enabled (rejectUnauthorized: false)" : "disabled"}`)

let connection

if (process.env.DATABASE_URL) {
  // Render injects DATABASE_URL as an internal connection string.
  // We must pass SSL settings via the pg client options, not the URL.
  connection = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 30,
  }
} else {
  // Local development — use individual DB_* variables
  connection = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "event_blinker",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    max: 30,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  }
}

const db = pgp(connection)

module.exports = db

