require("dotenv").config()
const express = require("express")
const cors = require("cors")
const http = require("http")
const socketio = require("socket.io")
const path = require("path")
const db = require("./config/database")
const { setupSocketHandlers } = require("./utils/socket-handler")
const socketModule = require("./utils/socket")

// Import routes
const authRoutes = require("./routes/auth")
const eventRoutes = require("./routes/events")
const likeRoutes = require("./routes/likes")
const checkinRoutes = require("./routes/checkins")
const chatRoutes = require("./routes/chat")
const organizerRoutes = require("./routes/organizer")
const uploadRoutes = require("./routes/upload")
const rideRoutes = require("./routes/rides")
const adminRoutes = require("./routes/admin")

const app = express()
const server = http.createServer(app)

// Configure Socket.io with permissive CORS for mobile apps
// Mobile apps don't have traditional browser origins, so we need to be permissive
const allowedOrigins = process.env.SOCKET_IO_CORS?.split(",").filter(Boolean) || [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://192.168.254.10:5000",
  "http://192.168.254.10:3000",
]

const io = socketio(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, native apps, etc.)
      if (!origin) {
        console.log("Socket connection from mobile/native app (no origin)")
        return callback(null, true)
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        console.log("Socket connection from allowed origin:", origin)
        return callback(null, true)
      }

      // Allow local network IPs (common for mobile development)
      if (origin.includes("192.168.") || origin.includes("10.0.") || origin.includes("172.")) {
        console.log("Socket connection from local network:", origin)
        return callback(null, true)
      }

      // Default: allow (permissive for development)
      console.log("Socket connection from:", origin, "(allowed by default)")
      callback(null, true)
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowEIO3: true, // Support older Engine.IO clients
  },
  transports: ["polling", "websocket"], // Try polling first (more reliable for mobile)
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Make io instance available to routes
socketModule.setIO(io)

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded images statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// Request logging
app.use((req, res, next) => {
  console.log(`[BACKEND] ${req.method} ${req.originalUrl}`)
  next()
})

// ============ ROUTES ============
app.use("/api/auth", authRoutes)
app.use("/api/events", eventRoutes)
app.use("/api/likes", likeRoutes)
app.use("/api/checkin", checkinRoutes)
app.use("/api/chat", chatRoutes)
app.use("/api/organizer", organizerRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/rides", rideRoutes)
app.use("/api/users", require("./routes/users"))
app.use("/api/admin", adminRoutes)

// ============ DIAGNOSTICS & ROOT ============

// Database health check
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1")
    res.json({ status: "ok", database: "connected" })
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message })
  }
})

// Database diagnostic (for debugging)
app.get("/api/admin/debug/database", (req, res) => {
  res.json({
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    status: "Database configuration loaded"
  })
})

app.get("/api/admin/debug/tables", async (req, res) => {
  try {
    const tables = await db.any(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )
    res.json({
      tables: tables.map(t => t.table_name),
      count: tables.length
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SOCKET.IO REAL-TIME EVENTS ============
setupSocketHandlers(io)

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message })
})

// ============ START SERVER ============

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`\n✓ Event Blinker API running on http://localhost:${PORT}`)
  console.log(`✓ WebSocket server ready for real-time events`)
  console.log(`✓ Check health: http://localhost:${PORT}/health\n`)
})

module.exports = { app, io }
