const express = require("express")
const db = require("../config/database")
const authMiddleware = require("../middleware/auth")

const router = express.Router()

// Get organizer's events
router.get("/my-events", authMiddleware, async (req, res) => {
  try {
    const events = await db.query(`SELECT * FROM events WHERE organizer_id = $1 ORDER BY created_at DESC`, [
      req.user.id,
    ])
    res.json(events)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get event analytics
router.get("/analytics/:event_id", authMiddleware, async (req, res) => {
  try {
    const analytics = await db.one(
      `SELECT
        e.id,
        e.title,
        COUNT(DISTINCT ul.id) as like_count,
        COUNT(DISTINCT ci.id) as checkin_count,
        e.current_attendance,
        COUNT(DISTINCT CASE WHEN cm.id IS NOT NULL THEN cm.user_id END) as unique_chat_users,
        COUNT(cm.id) as total_messages
       FROM events e
       LEFT JOIN user_likes ul ON e.id = ul.event_id
       LEFT JOIN check_ins ci ON e.id = ci.event_id
       LEFT JOIN chat_messages cm ON e.id = cm.event_id
       WHERE e.id = $1 AND e.organizer_id = $2
       GROUP BY e.id`,
      [req.params.event_id, req.user.id],
    )
    res.json(analytics)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
