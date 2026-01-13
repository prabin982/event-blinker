const express = require("express")
const db = require("../config/database")
const authMiddleware = require("../middleware/auth")

const router = express.Router()

// Get User Profile
router.get("/profile", authMiddleware, async (req, res) => {
    try {
        const user = await db.oneOrNone("SELECT id, name, email, phone, user_type, is_verified, bio, avatar_url FROM users WHERE id = $1", [req.user.id])
        if (!user) return res.status(404).json({ error: "User not found" })
        res.json(user)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Update User Profile (especially phone)
router.put("/profile", authMiddleware, async (req, res) => {
    try {
        const { name, phone, bio } = req.body

        // Validate phone if provided
        if (phone && phone.length < 10) {
            return res.status(400).json({ error: "Please provide a valid phone number" })
        }

        const updated = await db.one(
            `UPDATE users 
       SET name = COALESCE($1, name), 
           phone = COALESCE($2, phone),
           bio = COALESCE($3, bio),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, phone, user_type, bio`,
            [name, phone, bio, req.user.id]
        )

        res.json({ success: true, user: updated })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

module.exports = router
