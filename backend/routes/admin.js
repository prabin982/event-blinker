const express = require("express")
const db = require("../config/database")
const authMiddleware = require("../middleware/auth")
const router = express.Router()

// Helper: build a safe SELECT fragment for user name fields based on actual columns
async function getUserNameSelect(alias = 'u', asPrefix = '') {
  try {
    const cols = await db.any(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('first_name','last_name','name')"
    )
    const colNames = cols.map(c => c.column_name)

    const parts = []
    const firstAlias = asPrefix ? `${asPrefix}_first_name` : 'first_name'
    const lastAlias = asPrefix ? `${asPrefix}_last_name` : 'last_name'
    const nameAlias = asPrefix ? `${asPrefix}_name` : 'name'

    if (colNames.includes('first_name') || colNames.includes('last_name')) {
      if (colNames.includes('first_name')) {
        parts.push(`${alias}.first_name as ${firstAlias}`)
      } else if (colNames.includes('name')) {
        parts.push(`SPLIT_PART(${alias}.name, ' ', 1) as ${firstAlias}`)
      } else {
        parts.push(`'' as ${firstAlias}`)
      }

      if (colNames.includes('last_name')) {
        parts.push(`${alias}.last_name as ${lastAlias}`)
      } else if (colNames.includes('name')) {
        parts.push(`SPLIT_PART(${alias}.name, ' ', 2) as ${lastAlias}`)
      } else {
        parts.push(`'' as ${lastAlias}`)
      }
    } else if (colNames.includes('name')) {
      parts.push(`SPLIT_PART(${alias}.name, ' ', 1) as ${firstAlias}`)
      parts.push(`SPLIT_PART(${alias}.name, ' ', 2) as ${lastAlias}`)
    } else {
      parts.push(`'' as ${firstAlias}`)
      parts.push(`'' as ${lastAlias}`)
    }

    if (colNames.includes('name')) {
      parts.push(`${alias}.name as ${nameAlias}`)
    } else if (colNames.includes('first_name') || colNames.includes('last_name')) {
      parts.push(`CONCAT(COALESCE(${alias}.first_name, ''), ' ', COALESCE(${alias}.last_name, '')) as ${nameAlias}`)
    } else {
      parts.push(`'' as ${nameAlias}`)
    }

    return parts.join(', ')
  } catch (err) {
    return "'' as first_name, '' as last_name, '' as name"
  }
}

// Middleware to check if user is admin/organizer (for authenticated users)
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await db.oneOrNone("SELECT user_type FROM users WHERE id = $1", [req.user.id])
    if (!user || (user.user_type !== "organizer" && user.user_type !== "admin")) {
      return res.status(403).json({ error: "Admin access required" })
    }
    next()
  } catch (error) {
    res.status(500).json({ error: "Failed to verify admin access" })
  }
}

// Middleware to check admin token (for admin portal)
const adminTokenMiddleware = (req, res, next) => {
  const adminToken = req.headers["x-admin-token"]
  const expectedToken = process.env.ADMIN_SECRET_TOKEN || "prabin@1234"

  console.log(`🔐 Admin token check:`)
  console.log(`   Received: ${adminToken ? adminToken.substring(0, 5) + '***' : 'NONE'}`)
  console.log(`   Expected: ${expectedToken.substring(0, 5) + '***'}`)

  if (!adminToken) {
    console.warn(`   ❌ No token provided`)
    return res.status(401).json({ error: "Unauthorized. Admin token is required." })
  }

  if (adminToken !== expectedToken) {
    console.warn(`   ❌ Token mismatch`)
    return res.status(401).json({ error: "Unauthorized. Invalid admin token." })
  }

  console.log(`   ✅ Token valid`)
  next()
}

// Get pending organizer registrations
router.get("/organizers/pending", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const organizers = await db.any(
      `SELECT 
         u.*
       FROM users u
       WHERE u.user_type = 'organizer' 
         AND u.is_verified = false
       ORDER BY u.created_at DESC`
    )

    res.json({ organizers })
  } catch (error) {
    console.error("Get pending organizers error:", error)
    res.status(500).json({ error: error.message || "Failed to get pending organizers" })
  }
})

// Approve organizer
router.post("/organizers/:id/approve", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const organizerId = req.params.id
    const adminId = req.user.id

    const organizer = await db.oneOrNone("SELECT * FROM users WHERE id = $1 AND user_type = 'organizer'", [organizerId])

    if (!organizer) {
      return res.status(404).json({ error: "Organizer not found" })
    }

    if (organizer.is_verified) {
      return res.status(400).json({ error: "Organizer is already verified" })
    }

    await db.none(
      `UPDATE users 
       SET is_verified = true, updated_at = NOW()
       WHERE id = $1`,
      [organizerId]
    )

    res.json({ success: true, message: "Organizer approved" })
  } catch (error) {
    console.error("Approve organizer error:", error)
    res.status(500).json({ error: error.message || "Failed to approve organizer" })
  }
})

// Reject organizer
router.post("/organizers/:id/reject", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const organizerId = req.params.id
    const { rejection_reason } = req.body

    const organizer = await db.oneOrNone("SELECT * FROM users WHERE id = $1 AND user_type = 'organizer'", [organizerId])
    if (!organizer) {
      return res.status(404).json({ error: "Organizer not found" })
    }

    // Optionally delete or mark as rejected
    await db.none(
      `UPDATE users 
       SET user_type = 'user', updated_at = NOW()
       WHERE id = $1`,
      [organizerId]
    )

    res.json({ success: true, message: "Organizer registration rejected" })
  } catch (error) {
    console.error("Reject organizer error:", error)
    res.status(500).json({ error: error.message || "Failed to reject organizer" })
  }
})

// Get pending event approvals
router.get("/events/pending", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const events = await db.any(
      `SELECT 
         e.*,
         u.name as organizer_name,
         u.email as organizer_email
       FROM events e
       JOIN users u ON e.organizer_id = u.id
       WHERE e.is_approved = false
       ORDER BY e.created_at DESC`
    )

    res.json({ events })
  } catch (error) {
    console.error("Get pending events error:", error)
    res.status(500).json({ error: error.message || "Failed to get pending events" })
  }
})

// Approve event
router.post("/events/:id/approve", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const eventId = req.params.id

    const event = await db.oneOrNone("SELECT * FROM events WHERE id = $1", [eventId])
    if (!event) {
      return res.status(404).json({ error: "Event not found" })
    }

    await db.none(
      `UPDATE events 
       SET is_approved = true, updated_at = NOW()
       WHERE id = $1`,
      [eventId]
    )

    res.json({ success: true, message: "Event approved" })
  } catch (error) {
    console.error("Approve event error:", error)
    res.status(500).json({ error: error.message || "Failed to approve event" })
  }
})

// Reject event
router.post("/events/:id/reject", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const eventId = req.params.id
    const { rejection_reason } = req.body

    const event = await db.oneOrNone("SELECT * FROM events WHERE id = $1", [eventId])
    if (!event) {
      return res.status(404).json({ error: "Event not found" })
    }

    await db.none(
      `UPDATE events 
       SET is_approved = false, is_active = false, updated_at = NOW()
       WHERE id = $1`,
      [eventId]
    )

    res.json({ success: true, message: "Event rejected" })
  } catch (error) {
    console.error("Reject event error:", error)
    res.status(500).json({ error: error.message || "Failed to reject event" })
  }
})

// Get all riders (for admin dashboard)
router.get("/riders/all", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.query

    let query = `SELECT 
      r.*,
      u.email, 
      ${await getUserNameSelect('u', '')}, u.phone,
      v.make, v.model, v.year, v.license_plate,
      dl.license_number, dl.verification_status
    FROM riders r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
    LEFT JOIN driver_licenses dl ON r.license_id = dl.id`

    const params = []
    if (status) {
      query += " WHERE r.registration_status = $1"
      params.push(status)
    }

    query += " ORDER BY r.created_at DESC"

    const riders = await db.any(query, params)

    res.json({ riders })
  } catch (error) {
    console.error("Get all riders error:", error)
    res.status(500).json({ error: error.message || "Failed to get riders" })
  }
})

// Get pending rider registrations
router.get("/riders/pending", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const riders = await db.any(
      `SELECT 
         r.*,
         u.email, 
         ${await getUserNameSelect('u', '')}, u.phone,
         v.make, v.model, v.year, v.color, v.license_plate, v.vehicle_type,
         dl.license_number, dl.license_photo_url, dl.expiry_date, dl.issued_date, dl.issuing_authority
       FROM riders r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN driver_licenses dl ON r.license_id = dl.id
       WHERE r.registration_status = 'pending'
       ORDER BY r.created_at DESC`
    )

    res.json({ riders })
  } catch (error) {
    console.error("Get pending riders error:", error)
    res.status(500).json({ error: error.message || "Failed to get pending riders" })
  }
})

// Approve rider registration
router.post("/riders/:id/approve", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const riderId = req.params.id
    const adminId = req.user.id

    const rider = await db.oneOrNone(
      `SELECT r.*, dl.verification_status 
       FROM riders r
       LEFT JOIN driver_licenses dl ON r.license_id = dl.id
       WHERE r.id = $1`,
      [riderId]
    )

    if (!rider) {
      return res.status(404).json({ error: "Rider not found" })
    }

    if (rider.registration_status !== "pending") {
      return res.status(400).json({ error: "Rider is not pending approval" })
    }

    await db.none(
      `UPDATE riders 
       SET registration_status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [adminId, riderId]
    )

    if (rider.license_id && rider.verification_status === "pending") {
      await db.none(
        `UPDATE driver_licenses 
         SET verification_status = 'approved', verified_by = $1, verified_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [adminId, rider.license_id]
      )
    }

    res.json({ success: true, message: "Rider approved" })
  } catch (error) {
    console.error("Approve rider error:", error)
    res.status(500).json({ error: error.message || "Failed to approve rider" })
  }
})

// Reject rider registration
router.post("/riders/:id/reject", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const riderId = req.params.id
    const adminId = req.user.id
    const { rejection_reason } = req.body

    if (!rejection_reason) {
      return res.status(400).json({ error: "Rejection reason is required" })
    }

    const rider = await db.oneOrNone("SELECT * FROM riders WHERE id = $1", [riderId])
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" })
    }

    await db.none(
      `UPDATE riders 
       SET registration_status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2`,
      [rejection_reason, riderId]
    )

    res.json({ success: true, message: "Rider rejected" })
  } catch (error) {
    console.error("Reject rider error:", error)
    res.status(500).json({ error: error.message || "Failed to reject rider" })
  }
})

// Get pending license verifications
router.get("/licenses/pending", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const licenses = await db.any(
      `SELECT 
         dl.*,
         u.email, 
         ${await getUserNameSelect('u', '')}, u.phone,
         r.registration_status
       FROM driver_licenses dl
       JOIN users u ON dl.rider_id = u.id
       LEFT JOIN riders r ON r.user_id = u.id
       WHERE dl.verification_status = 'pending'
       ORDER BY dl.created_at DESC`
    )

    res.json({ licenses })
  } catch (error) {
    console.error("Get pending licenses error:", error)
    res.status(500).json({ error: error.message || "Failed to get pending licenses" })
  }
})

// Approve license
router.post("/licenses/:id/approve", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const licenseId = req.params.id
    const adminId = req.user.id

    const license = await db.oneOrNone("SELECT * FROM driver_licenses WHERE id = $1", [licenseId])
    if (!license) {
      return res.status(404).json({ error: "License not found" })
    }

    await db.none(
      `UPDATE driver_licenses 
       SET verification_status = 'approved', verified_by = $1, verified_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [adminId, licenseId]
    )

    res.json({ success: true, message: "License approved" })
  } catch (error) {
    console.error("Approve license error:", error)
    res.status(500).json({ error: error.message || "Failed to approve license" })
  }
})

// Reject license
router.post("/licenses/:id/reject", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const licenseId = req.params.id
    const adminId = req.user.id
    const { rejection_reason } = req.body

    if (!rejection_reason) {
      return res.status(400).json({ error: "Rejection reason is required" })
    }

    const license = await db.oneOrNone("SELECT * FROM driver_licenses WHERE id = $1", [licenseId])
    if (!license) {
      return res.status(404).json({ error: "License not found" })
    }

    await db.none(
      `UPDATE driver_licenses 
       SET verification_status = 'rejected', rejection_reason = $1, verified_by = $2, verified_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [rejection_reason, adminId, licenseId]
    )

    res.json({ success: true, message: "License rejected" })
  } catch (error) {
    console.error("Reject license error:", error)
    res.status(500).json({ error: error.message || "Failed to reject license" })
  }
})


// ============ ADMIN PORTAL ROUTES (Token-based Authentication) ============

// Get pending riders (for admin portal)
router.get("/portal/riders/pending", adminTokenMiddleware, async (req, res) => {
  try {
    console.log(`📋 Fetching pending riders...`)
    const riders = await db.any(
      `SELECT 
         r.id,
         r.registration_status,
         r.profile_photo_url,
         r.emergency_contact,
         r.bank_name,
         r.account_number,
         u.email, 
         ${await getUserNameSelect('u', '')}, u.phone,
         v.make, v.model, v.year, v.color, v.license_plate, v.vehicle_type, v.registration_document_url, v.billbook_photo_url,
         dl.license_number, dl.license_photo_url, dl.expiry_date, dl.issued_date, dl.issuing_authority
       FROM riders r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN vehicles v ON v.rider_id = r.user_id
       LEFT JOIN driver_licenses dl ON r.license_id = dl.id
       WHERE r.registration_status = 'pending'
       ORDER BY r.created_at DESC`
    )

    console.log(`✅ Found ${riders.length} pending riders`)
    res.json({ riders })
  } catch (error) {
    console.error("❌ Get pending riders error:", error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get pending licenses (for admin portal)
router.get("/portal/licenses/pending", adminTokenMiddleware, async (req, res) => {
  try {
    console.log(`📋 Fetching pending licenses...`)
    const licenses = await db.any(
      `SELECT 
         dl.id,
         dl.verification_status,
         u.email, 
         ${await getUserNameSelect('u', '')}, u.phone,
         dl.license_number, dl.license_photo_url, dl.expiry_date, dl.issued_date, dl.issuing_authority
       FROM driver_licenses dl
       JOIN users u ON dl.rider_id = u.id
       WHERE dl.verification_status = 'pending'
       ORDER BY dl.created_at DESC`
    )

    console.log(`✅ Found ${licenses.length} pending licenses`)
    res.json({ licenses })
  } catch (error) {
    console.error("❌ Get pending licenses error:", error.message)
    res.status(500).json({ error: error.message })
  }
})

// Approve rider (for admin portal)
router.post("/portal/riders/:id/approve", adminTokenMiddleware, async (req, res) => {
  try {
    const riderId = req.params.id
    const rider = await db.oneOrNone("SELECT * FROM riders WHERE id = $1", [riderId])
    if (!rider) return res.status(404).json({ error: "Rider not found" })

    await db.none("UPDATE riders SET registration_status = 'approved', approved_at = NOW(), updated_at = NOW() WHERE id = $1", [riderId])

    if (rider.license_id) {
      await db.none("UPDATE driver_licenses SET verification_status = 'approved', verified_at = NOW() WHERE id = $1", [rider.license_id])
    }

    res.json({ success: true, message: "Rider approved" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reject rider (for admin portal)
router.post("/portal/riders/:id/reject", adminTokenMiddleware, async (req, res) => {
  try {
    const riderId = req.params.id
    const { rejection_reason } = req.body
    await db.none("UPDATE riders SET registration_status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2", [rejection_reason, riderId])
    res.json({ success: true, message: "Rider rejected" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Approve license (for admin portal)
router.post("/portal/licenses/:id/approve", adminTokenMiddleware, async (req, res) => {
  try {
    await db.none("UPDATE driver_licenses SET verification_status = 'approved', verified_at = NOW() WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "License approved" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reject license (for admin portal)
router.post("/portal/licenses/:id/reject", adminTokenMiddleware, async (req, res) => {
  try {
    const { rejection_reason } = req.body
    await db.none("UPDATE driver_licenses SET verification_status = 'rejected', rejection_reason = $1, verified_at = NOW() WHERE id = $2", [rejection_reason, req.params.id])
    res.json({ success: true, message: "License rejected" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get pending organizers (for admin portal)
router.get("/portal/organizers/pending", adminTokenMiddleware, async (req, res) => {
  try {
    const organizers = await db.any(
      `SELECT u.* FROM users u WHERE u.user_type = 'organizer' AND u.is_verified = false ORDER BY u.created_at DESC`
    )
    res.json({ organizers })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Approve organizer (for admin portal)
router.post("/portal/organizers/:id/approve", adminTokenMiddleware, async (req, res) => {
  try {
    await db.none("UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Organizer approved" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reject organizer (for admin portal)
router.post("/portal/organizers/:id/reject", adminTokenMiddleware, async (req, res) => {
  try {
    await db.none("UPDATE users SET user_type = 'user', updated_at = NOW() WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Organizer rejected" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get pending events (for admin portal)
router.get("/portal/events/pending", adminTokenMiddleware, async (req, res) => {
  try {
    const events = await db.any(
      `SELECT e.*, u.name as organizer_name, u.email as organizer_email
       FROM events e JOIN users u ON e.organizer_id = u.id
       WHERE e.is_approved = false ORDER BY e.created_at DESC`
    )
    res.json({ events })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get approved/live events (for admin portal)
router.get("/portal/events/approved", adminTokenMiddleware, async (req, res) => {
  try {
    const events = await db.any(
      `SELECT e.*, u.name as organizer_name, u.email as organizer_email
       FROM events e JOIN users u ON e.organizer_id = u.id
       WHERE e.is_approved = true ORDER BY e.created_at DESC`
    )
    res.json({ events })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Approve event (for admin portal)
router.post("/portal/events/:id/approve", adminTokenMiddleware, async (req, res) => {
  try {
    await db.none("UPDATE events SET is_approved = true, updated_at = NOW() WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Event approved" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reject/Deactivate event (for admin portal)
router.post("/portal/events/:id/reject", adminTokenMiddleware, async (req, res) => {
  try {
    await db.none("UPDATE events SET is_approved = false, updated_at = NOW() WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Event moved to pending/rejected" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Permanently delete event (for admin portal)
router.post("/portal/events/:id/delete", adminTokenMiddleware, async (req, res) => {
  try {
    await db.none("DELETE FROM events WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Event permanently deleted" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})


// Get all riders with reviews (for admin portal)
router.get("/portal/riders/all", adminTokenMiddleware, async (req, res) => {
  try {
    const riders = await db.any(
      `SELECT 
         r.id,
         r.registration_status,
         r.is_online,
         u.email, 
         ${await getUserNameSelect('u', '')}, u.phone,
         v.make, v.model, v.license_plate,
         COALESCE(AVG(rr.rating), 0) as avg_rating,
         COUNT(rr.id) as review_count
       FROM riders r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN ride_reviews rr ON rr.rider_id = r.id
       GROUP BY r.id, u.id, v.id
       ORDER BY r.created_at DESC`
    )
    res.json({ riders })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
