const express = require("express")
const db = require("../config/database")
const authMiddleware = require("../middleware/auth")
const socketModule = require("../utils/socket")
const { broadcastNewEvent, broadcastEventUpdate } = require("../utils/socket-handler")

const router = express.Router()

// Get events with filters
router.get("/", async (req, res) => {
  try {
    const { lat, lon, radius = 5, category, status, limit = 20, offset = 0 } = req.query

    let query = `
      SELECT 
        e.*,
        COUNT(DISTINCT ul.id) as like_count,
        COUNT(DISTINCT ci.id) as checkin_count,
        ST_AsGeoJSON(e.location_geom) as location_geojson
      FROM events e
      LEFT JOIN user_likes ul ON e.id = ul.event_id
      LEFT JOIN check_ins ci ON e.id = ci.event_id
      WHERE e.is_active = true AND e.is_approved = true
    `
    const params = []

    if (lat && lon) {
      params.push(lon, lat, radius)
      query += ` AND ST_DWithin(
        e.location_geom,
        ST_SetSRID(ST_Point($1, $2), 4326),
        $3 * 1000
      )`
    }

    if (category) {
      params.push(category)
      query += ` AND e.category = $${params.length}`
    }

    if (status) {
      params.push(status)
      query += ` AND e.status = $${params.length}`
    }

    query += ` GROUP BY e.id
      ORDER BY e.start_time ASC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`

    const events = await db.query(query, params)
    
    // Convert relative image URLs to absolute URLs
    const baseUrl = `${req.protocol}://${req.get("host")}`
    const eventsWithFullUrls = events.map(event => ({
      ...event,
      image_url: event.image_url && !event.image_url.startsWith('http') 
        ? `${baseUrl}${event.image_url.startsWith('/') ? '' : '/'}${event.image_url}`
        : event.image_url
    }))
    
    res.json(eventsWithFullUrls)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get event by ID
router.get("/:id", async (req, res) => {
  try {
    const event = await db.oneOrNone(
      `SELECT 
        e.*,
        COUNT(DISTINCT ul.id) as like_count,
        COUNT(DISTINCT ci.id) as checkin_count,
        ST_AsGeoJSON(e.location_geom) as location_geojson
      FROM events e
      LEFT JOIN user_likes ul ON e.id = ul.event_id
      LEFT JOIN check_ins ci ON e.id = ci.event_id
      WHERE e.id = $1
      GROUP BY e.id`,
      [req.params.id],
    )
    if (!event) return res.status(404).json({ error: "Event not found" })
    
    // Convert relative image URL to absolute URL
    const baseUrl = `${req.protocol}://${req.get("host")}`
    const eventWithFullUrl = {
      ...event,
      image_url: event.image_url && !event.image_url.startsWith('http') 
        ? `${baseUrl}${event.image_url.startsWith('/') ? '' : '/'}${event.image_url}`
        : event.image_url
    }
    
    res.json(eventWithFullUrl)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get trending events
router.get("/trending", async (req, res) => {
  try {
    const events = await db.query(`
      SELECT 
        e.*,
        COUNT(DISTINCT ul.id) as like_count,
        COUNT(DISTINCT ci.id) as checkin_count
      FROM events e
      LEFT JOIN user_likes ul ON e.id = ul.event_id
      LEFT JOIN check_ins ci ON e.id = ci.event_id
      WHERE e.is_active = true AND e.is_approved = true AND e.start_time > NOW()
      GROUP BY e.id
      ORDER BY like_count DESC, checkin_count DESC
      LIMIT 10
    `)
    
    // Convert relative image URLs to absolute URLs
    const baseUrl = `${req.protocol}://${req.get("host")}`
    const eventsWithFullUrls = events.map(event => ({
      ...event,
      image_url: event.image_url && !event.image_url.startsWith('http') 
        ? `${baseUrl}${event.image_url.startsWith('/') ? '' : '/'}${event.image_url}`
        : event.image_url
    }))
    
    res.json(eventsWithFullUrls)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create event (requires auth)
router.post("/", authMiddleware, async (req, res) => {
  try {
    // Check if user is verified organizer
    const user = await db.oneOrNone("SELECT user_type, is_verified FROM users WHERE id = $1", [req.user.id])
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }
    
    if (user.user_type === "organizer" && !user.is_verified) {
      return res.status(403).json({ 
        error: "Your organizer account is pending admin approval. Please wait for verification before creating events." 
      })
    }

    const {
      title,
      description,
      category,
      start_time,
      end_time,
      price,
      location_name,
      latitude,
      longitude,
      capacity,
      image_url,
    } = req.body

    // Events need admin approval before being visible
    const event = await db.one(
      `INSERT INTO events (
        organizer_id, title, description, category, start_time, end_time,
        price, location_name, location_geom, capacity, image_url, is_approved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                ST_SetSRID(ST_Point($9, $10), 4326), $11, $12, false)
      RETURNING *`,
      [
        req.user.id,
        title,
        description,
        category,
        start_time,
        end_time,
        price,
        location_name,
        longitude,
        latitude,
        capacity,
        image_url,
      ],
    )

    // Don't broadcast until approved - events need admin approval
    // The io = socketModule.getIO()
    // if (io) {
    //   const eventWithLocation = {
    //     ...event,
    //     location_geojson: event.location_geojson || null,
    //   }
    //   broadcastNewEvent(io, eventWithLocation)
    // }

    res.status(201).json({
      ...event,
      message: "Event created successfully. It will be visible to users after admin approval."
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update event
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { title, description, status, current_attendance, end_time } = req.body

    const event = await db.one(
      `UPDATE events
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           current_attendance = COALESCE($4, current_attendance),
           end_time = COALESCE($5, end_time),
           updated_at = NOW()
       WHERE id = $6 AND organizer_id = $7
       RETURNING *`,
      [title, description, status, current_attendance, end_time, req.params.id, req.user.id],
    )

    // Broadcast update for real-time map updates
    const io = socketModule.getIO()
    if (io) {
      broadcastEventUpdate(io, event)
    }

    res.json(event)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete event
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await db.query("DELETE FROM events WHERE id = $1 AND organizer_id = $2", [req.params.id, req.user.id])
    res.json({ message: "Event deleted" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
