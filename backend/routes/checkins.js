const express = require("express")
const db = require("../config/database")
const authMiddleware = require("../middleware/auth")
const socketModule = require("../utils/socket")

const router = express.Router()

// Check in to event
router.post("/:event_id", authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude } = req.body
    const { event_id } = req.params

    const checkin = await db.one(
      `INSERT INTO check_ins (user_id, event_id, location_geom)
       VALUES ($1, $2, ST_SetSRID(ST_Point($3, $4), 4326))
       RETURNING *`,
      [req.user.id, event_id, longitude, latitude],
    )

    // Update attendance count
    await db.query(
      `UPDATE events SET current_attendance = current_attendance + 1
       WHERE id = $1`,
      [event_id],
    )

    // Broadcast check-in
    const io = socketModule.getIO()
    if (io) {
      io.emit("checkin:created", checkin)
    }

    res.status(201).json(checkin)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get user's check-ins
router.get("/my-checkins", authMiddleware, async (req, res) => {
  try {
    const checkins = await db.query(
      `SELECT e.*, ci.checked_in_at, ST_AsGeoJSON(e.location_geom) as location_geojson
       FROM check_ins ci
       JOIN events e ON ci.event_id = e.id
       WHERE ci.user_id = $1
       ORDER BY ci.checked_in_at DESC`,
      [req.user.id]
    )
    res.json(checkins)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get event check-ins
router.get("/:event_id", async (req, res) => {
  try {
    const checkins = await db.query("SELECT * FROM check_ins WHERE event_id = $1 ORDER BY checked_in_at DESC", [
      req.params.event_id,
    ])
    res.json(checkins)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
