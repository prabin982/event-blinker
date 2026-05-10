import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import axios from "axios"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.ADMIN_PORT || 3001
const API_BASE = process.env.API_URL || "https://event-blinker-1.onrender.com"

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const adminToken = req.headers["x-admin-token"]
  const expectedToken = process.env.ADMIN_SECRET_TOKEN || "prabin@1234"

  if (!adminToken || adminToken !== expectedToken) {
    return res.status(401).json({ error: "Unauthorized. Admin token required." })
  }
  next()
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "admin-portal" })
})

// Proxy /uploads for images
app.get("/uploads/*", async (req, res) => {
  try {
    const targetUrl = `${API_BASE}${req.originalUrl}`
    const response = await axios({
      method: "GET",
      url: targetUrl,
      responseType: "stream"
    })
    response.data.pipe(res)
  } catch (e) {
    res.status(404).send("Not found")
  }
})

// Proxy API routes
app.use("/api", adminAuth, async (req, res) => {
  try {
    const targetUrl = `${API_BASE}/api${req.url}`
    console.log(`� [Proxy] ${req.method} ${targetUrl}`)

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      params: req.query,
      headers: {
        "x-admin-token": req.headers["x-admin-token"],
        "Content-Type": "application/json"
      },
      validateStatus: () => true // Allow all statuses
    })

    res.status(response.status).json(response.data)
  } catch (error) {
    console.error(`❌ [Proxy Error] ${error.message}`)
    res.status(500).json({ error: "Portal Connection Failure", details: error.message })
  }
})

// Serve admin portal
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.listen(PORT, () => {
  console.log(`🔐 Admin Portal running on PORT ${PORT}`)
  console.log(`📝 Backend API: ${API_BASE}`)
})
