const pgp = require("pg-promise")()
require("dotenv").config()

// Log connection attempt (without sensitive data)
const dbHost = process.env.DB_HOST || "localhost"
const dbName = process.env.DB_NAME || "event_blinker"
console.log(`[DB] Attempting connection to ${process.env.DATABASE_URL ? "DATABASE_URL" : `${dbHost}/${dbName}`}`)

const connection = process.env.DATABASE_URL || {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "event_blinker",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  max: 30,
  ssl: process.env.NODE_ENV === "production" || process.env.DATABASE_URL?.includes("render.com") 
    ? { rejectUnauthorized: false } 
    : false,
}

const db = pgp(connection)

module.exports = db
