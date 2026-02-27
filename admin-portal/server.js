import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.ADMIN_PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const adminToken = req.headers["x-admin-token"]
  const expectedToken = process.env.ADMIN_SECRET_TOKEN || "prabin@1234"

  console.log(`🔐 Admin Auth Check (Portal):`)
  console.log(`   Token received: ${adminToken ? adminToken.substring(0, 8) : 'NONE'}`)
  console.log(`   Token expected: ${expectedToken.substring(0, 8)}`)
  console.log(`   Match: ${adminToken === expectedToken}`)

  if (!adminToken || adminToken !== expectedToken) {
    console.warn(`   ❌ Auth failed`)
    return res.status(401).json({ error: "Unauthorized. Admin token required." })
  }
  console.log(`   ✅ Auth passed`)
  next()
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "admin-portal" })
})

// API health check (for proxy compatibility)
app.get("/api/health", adminAuth, (req, res) => {
  res.json({ status: "ok", service: "admin-portal-api" })
})

// Proxy API routes (protected)
app.use("/api", adminAuth, async (req, res) => {
  try {
    const API_BASE = process.env.API_URL || "https://event-blinker.onrender.com"
    const targetUrl = `${API_BASE}/api${req.url}`

    console.log(`🔀 Proxying: ${req.method} ${req.originalUrl} → ${targetUrl}`)

    const axios = (await import("axios")).default
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        "x-admin-token": req.headers["x-admin-token"],
        "Content-Type": "application/json",
      },
      data: req.body,
      params: req.query,
    })

    res.json(response.data)
  } catch (error) {
    console.error(`❌ Proxy error: ${error.message}`)
    res.status(error.response?.status || 500).json({
      error: "Proxy error",
      details: error.response?.data || error.message
    })
  }
})

// Proxy /uploads for images
app.use("/uploads/*", async (req, res) => {
  try {
    const API_URL = process.env.API_URL || "https://event-blinker.onrender.com"
    const targetUrl = `${API_URL}${req.originalUrl}`
    const axios = (await import("axios")).default

    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'stream'
    })

    response.data.pipe(res)
  } catch (e) {
    console.error("Image proxy error:", e.message)
    res.status(404).send('Not found')
  }
})

// Serve admin portal
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.listen(PORT, () => {
  const adminToken = process.env.ADMIN_SECRET_TOKEN || "prabin@1234"
  console.log(`\n🔐 Admin Portal running on http://localhost:${PORT}`)
  console.log(`📝 Admin Token: ${adminToken}`)
  console.log(`📝 Backend API: ${process.env.API_URL || "https://event-blinker.onrender.com/api"}`)
  console.log(`⚠️  Keep this token secret!\n`)
})

