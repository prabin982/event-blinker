const pgp = require("pg-promise")()
require("dotenv").config()

const db = pgp({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "event_blinker",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  max: 30,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

module.exports = db
