const express = require("express")
const db = require("../config/database")
const authMiddleware = require("../middleware/auth")
const socketModule = require("../utils/socket")

const router = express.Router()

// Toggle like
router.post("/:event_id", authMiddleware, async (req, res) => {
  try {
    const { event_id } = req.params
    const user_id = req.user.id

    const existing = await db.oneOrNone("SELECT * FROM user_likes WHERE user_id = $1 AND event_id = $2", [
      user_id,
      event_id,
    ])

    const io = socketModule.getIO()

    if (existing) {
      await db.query("DELETE FROM user_likes WHERE user_id = $1 AND event_id = $2", [user_id, event_id])
      if (io) {
        io.emit("event:liked", { event_id, user_id, liked: false })
      }
      res.json({ liked: false, message: "Unliked" })
    } else {
      await db.query("INSERT INTO user_likes (user_id, event_id) VALUES ($1, $2)", [user_id, event_id])
      if (io) {
        io.emit("event:liked", { event_id, user_id, liked: true })
      }
      res.json({ liked: true, message: "Liked" })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get user likes
router.get("/user/likes", authMiddleware, async (req, res) => {
  try {
    const likes = await db.query("SELECT event_id FROM user_likes WHERE user_id = $1", [req.user.id])
    res.json(likes.map((l) => l.event_id))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get user's liked events with details
router.get("/my-likes", authMiddleware, async (req, res) => {
  try {
    const likes = await db.query(
      `SELECT e.*, ST_AsGeoJSON(e.location_geom) as location_geojson
       FROM user_likes ul
       JOIN events e ON ul.event_id = e.id
       WHERE ul.user_id = $1
       ORDER BY ul.created_at DESC`,
      [req.user.id]
    )
    res.json(likes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
