const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const db = require("../config/database")

const router = express.Router()

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, user_type } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Check if user exists
    const existing = await db.oneOrNone("SELECT * FROM users WHERE email = $1", [email])
    if (existing) {
      return res.status(400).json({ error: "User already exists" })
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10)

    // Create user - organizers need admin verification
    const finalUserType = user_type || "user"
    const isVerified = finalUserType === "organizer" ? false : true

    const user = await db.one(
      `INSERT INTO users (email, password_hash, name, user_type, is_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, user_type, is_verified`,
      [email, password_hash, name, finalUserType, isVerified],
    )

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY,
    })

    // If organizer, return message about pending verification
    if (finalUserType === "organizer") {
      return res.status(201).json({ 
        user: { ...user, is_verified: false }, 
        token,
        message: "Registration successful. Please wait for admin approval before creating events."
      })
    }

    

    res.status(201).json({ user, token })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" })
    }

    // Find user
    const user = await db.oneOrNone("SELECT * FROM users WHERE email = $1", [email])
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY,
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.user_type,
        is_verified: user.is_verified || false,
      },
      token,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
