const express = require("express")
const db = require("../config/database")
const authMiddleware = require("../middleware/auth")
const { calculateDistance, calculateRidePrice, estimateDuration } = require("../utils/distanceCalculator")
const { getIO } = require("../utils/socket")
const router = express.Router()

// Helper: build a safe SELECT fragment for user name fields based on actual columns
async function getUserNameSelect(alias = 'u', asPrefix = '') {
  try {
    const cols = await db.any(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('first_name','last_name','name')"
    )
    const colNames = cols.map(c => c.column_name)

    const parts = []

    // rider_first_name / rider_last_name / rider_name style with prefix
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
      // build name from parts
      parts.push(`CONCAT(COALESCE(${alias}.first_name, ''), ' ', COALESCE(${alias}.last_name, '')) as ${nameAlias}`)
    } else {
      parts.push(`'' as ${nameAlias}`)
    }

    return parts.join(', ')
  } catch (err) {
    return "'' as first_name, '' as last_name, '' as name"
  }
}

// Register as rider (step 0: personal info)
router.post("/rider/register/personal", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { profile_photo_url, emergency_contact, nid_number, bank_name, account_number, account_holder_name, terms_accepted } = req.body

    if (!profile_photo_url || !emergency_contact) {
      return res.status(400).json({ error: "Profile photo and emergency contact are required" })
    }

    const rider = await db.one(
      `INSERT INTO riders (user_id, profile_photo_url, emergency_contact, nid_number, bank_name, account_number, account_holder_name, terms_accepted, registration_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       ON CONFLICT (user_id) DO UPDATE SET 
         profile_photo_url = EXCLUDED.profile_photo_url,
         emergency_contact = EXCLUDED.emergency_contact,
         nid_number = EXCLUDED.nid_number,
         bank_name = EXCLUDED.bank_name,
         account_number = EXCLUDED.account_number,
         account_holder_name = EXCLUDED.account_holder_name,
         terms_accepted = EXCLUDED.terms_accepted
       RETURNING *`,
      [userId, profile_photo_url, emergency_contact, nid_number || null, bank_name || null, account_number || null, account_holder_name || null, terms_accepted || false]
    )

    res.json({ success: true, rider })
  } catch (error) {
    console.error("Personal registration error:", error)
    res.status(500).json({ error: error.message || "Failed to register personal info" })
  }
})

// Register as rider (step 1: vehicle info)
router.post("/rider/register/vehicle", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { make, model, year, color, license_plate, vehicle_type, seats_available, registration_document_url, billbook_photo_url } = req.body

    if (!make || !model || !year || !license_plate) {
      return res.status(400).json({ error: "Make, model, year, and license plate are required" })
    }

    // Create vehicle - use user_id directly
    const vehicle = await db.one(
      `INSERT INTO vehicles (rider_id, make, model, year, color, license_plate, vehicle_type, seats_available, registration_document_url, billbook_photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (license_plate) DO UPDATE SET
         make = EXCLUDED.make,
         model = EXCLUDED.model,
         year = EXCLUDED.year,
         color = EXCLUDED.color,
         vehicle_type = EXCLUDED.vehicle_type,
         seats_available = EXCLUDED.seats_available,
         registration_document_url = EXCLUDED.registration_document_url,
         billbook_photo_url = EXCLUDED.billbook_photo_url
       RETURNING *`,
      [userId, make, model, year, color || null, license_plate, vehicle_type || "sedan", seats_available || 4, registration_document_url || null, billbook_photo_url || null]
    )

    res.json({ success: true, vehicle })
  } catch (error) {
    console.error("Vehicle registration error:", error)
    res.status(500).json({ error: error.message || "Failed to register vehicle" })
  }
})

// Register as rider (step 2: license info)
router.post("/rider/register/license", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { license_number, license_photo_url, expiry_date, issued_date, issuing_authority, license_holder_name, date_of_birth } = req.body

    if (!license_number || !license_photo_url || !expiry_date) {
      return res.status(400).json({ error: "License number, photo, and expiry date are required" })
    }

    // Check if license already exists
    const existingLicense = await db.oneOrNone(
      "SELECT id FROM driver_licenses WHERE license_number = $1",
      [license_number]
    )
    if (existingLicense) {
      return res.status(400).json({ error: "License number already registered" })
    }

    // Create license - use user_id (schema uses rider_id which references users.id)
    const license = await db.one(
      `INSERT INTO driver_licenses (rider_id, license_number, license_photo_url, expiry_date, issued_date, issuing_authority, license_holder_name, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, license_number, license_photo_url, expiry_date, issued_date || null, issuing_authority || null, license_holder_name || null, date_of_birth || null]
    ).catch(async (err) => {
      // If table doesn't exist
      if (err.message && err.message.includes("does not exist")) {
        throw new Error("Ride sharing tables not set up. Please run database migration.")
      }
      // Try with user_id if rider_id doesn't work
      if (err.message && err.message.includes("rider_id")) {
        return await db.one(
          `INSERT INTO driver_licenses (user_id, license_number, license_photo_url, expiry_date, issued_date, issuing_authority, license_holder_name, date_of_birth)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [userId, license_number, license_photo_url, expiry_date, issued_date || null, issuing_authority || null, license_holder_name || null, date_of_birth || null]
        )
      }
      throw err
    })

    res.json({ success: true, license })
  } catch (error) {
    console.error("License registration error:", error)
    if (error.code === "23505") {
      return res.status(400).json({ error: "License number already registered" })
    }
    res.status(500).json({ error: error.message || "Failed to register license" })
  }
})

// Complete rider registration
router.post("/rider/register/complete", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    // Get vehicle and license
    const vehicle = await db.oneOrNone("SELECT id FROM vehicles WHERE rider_id = $1", [userId])
    const license = await db.oneOrNone("SELECT id FROM driver_licenses WHERE rider_id = $1", [userId])

    if (!vehicle || !license) {
      return res.status(400).json({ error: "Please complete vehicle and license registration first" })
    }

    // Create rider profile
    const rider = await db.one(
      `INSERT INTO riders (user_id, vehicle_id, license_id, registration_status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (user_id) DO UPDATE SET vehicle_id = $2, license_id = $3
       RETURNING *`,
      [userId, vehicle.id, license.id]
    )

    res.json({
      success: true,
      message: "Registration submitted for verification",
      rider,
    })
  } catch (error) {
    console.error("Rider registration error:", error)
    res.status(500).json({ error: error.message || "Failed to complete registration" })
  }
})

// Get rider profile
router.get("/rider/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const rider = await db.oneOrNone(
      `SELECT r.*, v.*, dl.*, u.phone, 
       ${await getUserNameSelect('u', '')}, u.email
       FROM riders r
       LEFT JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN driver_licenses dl ON r.license_id = dl.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.user_id = $1`,
      [userId]
    )

    if (!rider) {
      return res.status(404).json({ error: "Rider profile not found" })
    }

    res.json(rider)
  } catch (error) {
    console.error("Get rider profile error:", error)
    res.status(500).json({ error: error.message || "Failed to get rider profile" })
  }
})

// Update rider online status
router.put("/rider/status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { is_online, current_location } = req.body

    const rider = await db.oneOrNone("SELECT id, registration_status FROM riders WHERE user_id = $1", [userId])
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" })
    }

    if (rider.registration_status !== 'approved') {
      return res.status(403).json({ error: "Your rider account is pending verification. Please wait for admin approval." })
    }

    let updateQuery = "UPDATE riders SET is_online = $1"
    const params = [is_online !== undefined ? is_online : false]
    let paramIndex = 2

    if (current_location && current_location.latitude && current_location.longitude) {
      updateQuery += `, current_location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)`
      params.push(current_location.longitude, current_location.latitude)
      paramIndex += 2
    }

    updateQuery += `, updated_at = NOW() WHERE user_id = $${paramIndex} RETURNING *`
    params.push(userId)

    const updated = await db.one(updateQuery, params)

    res.json({ success: true, rider: updated })
  } catch (error) {
    console.error("Update rider status error:", error)
    res.status(500).json({ error: error.message || "Failed to update status" })
  }
})

// ============ RIDE REQUESTS ============

// Create ride request
router.post("/request", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { pickup_location, pickup_address, dropoff_location, dropoff_address, notes, vehicle_type } = req.body

    if (!pickup_location || !dropoff_location || !pickup_address || !dropoff_address) {
      return res.status(400).json({ error: "Pickup and dropoff locations are required" })
    }

    // Calculate distance
    const distance = calculateDistance(
      pickup_location.latitude,
      pickup_location.longitude,
      dropoff_location.latitude,
      dropoff_location.longitude
    )

    // Get user phone
    const user = await db.oneOrNone("SELECT phone FROM users WHERE id = $1", [userId])
    if (!user || !user.phone) {
      return res.status(400).json({ error: "Please update your profile with a phone number to request rides" })
    }

    // Calculate estimated price based on vehicle type
    const vType = vehicle_type || "sedan"
    const estimatedPrice = calculateRidePrice(distance, vType)

    // Create ride request
    const rideRequest = await db.one(
      `INSERT INTO ride_requests 
       (user_id, pickup_location, pickup_address, dropoff_location, dropoff_address, 
        distance_km, estimated_price, user_phone, notes, status, vehicle_type)
       VALUES (
         $1, 
         ST_SetSRID(ST_MakePoint($2, $3), 4326), 
         $4, 
         ST_SetSRID(ST_MakePoint($5, $6), 4326), 
         $7, 
         $8, $9, $10, $11, 'pending', $12
       )
       RETURNING *`,
      [
        userId,
        pickup_location.longitude,
        pickup_location.latitude,
        pickup_address,
        dropoff_location.longitude,
        dropoff_location.latitude,
        dropoff_address,
        distance,
        estimatedPrice,
        user.phone,
        notes || null,
        vType
      ]
    )

    // Notify nearby riders via socket
    const io = getIO()
    if (io) {
      io.emit("ride:new", {
        ride_request_id: rideRequest.id,
        pickup_location: pickup_location,
        dropoff_location: dropoff_location,
        distance_km: distance,
        estimated_price: estimatedPrice,
        pickup_address,
        dropoff_address,
      })
    }

    res.json({ success: true, ride_request: rideRequest })
  } catch (error) {
    console.error("Create ride request error:", error)
    res.status(500).json({ error: error.message || "Failed to create ride request" })
  }
})

// Get nearby ride requests (for riders)
router.get("/requests/nearby", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { latitude, longitude, radius_km = 10 } = req.query

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Current location is required" })
    }

    // Check if user is an approved rider
    const rider = await db.oneOrNone(
      "SELECT id FROM riders WHERE user_id = $1 AND registration_status = 'approved' AND is_active = true",
      [userId]
    )

    if (!rider) {
      return res.status(403).json({ error: "You must be an approved rider to view ride requests" })
    }

    // Find nearby pending ride requests
    const requests = await db.any(
      `SELECT 
         rr.*,
         ST_X(rr.pickup_location::geometry) as pickup_lng,
         ST_Y(rr.pickup_location::geometry) as pickup_lat,
         ST_X(rr.dropoff_location::geometry) as dropoff_lng,
         ST_Y(rr.dropoff_location::geometry) as dropoff_lat,
         ${await getUserNameSelect('u', '')},
         u.avatar_url as avatar
       FROM ride_requests rr
       JOIN users u ON rr.user_id = u.id
       WHERE rr.status = 'pending'
         AND ST_DWithin(
           rr.pickup_location::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3 * 1000
         )
       ORDER BY ST_Distance(
         rr.pickup_location::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       )
       LIMIT 20`,
      [parseFloat(longitude), parseFloat(latitude), parseFloat(radius_km)]
    )

    res.json({ requests })
  } catch (error) {
    console.error("Get nearby requests error:", error)
    res.status(500).json({ error: error.message || "Failed to get nearby requests" })
  }
})

// Accept ride request (rider accepts at estimated price)
router.post("/request/:id/accept", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const rideRequestId = req.params.id

    // Get rider
    const rider = await db.oneOrNone(
      "SELECT id FROM riders WHERE user_id = $1 AND registration_status = 'approved'",
      [userId]
    )
    if (!rider) {
      return res.status(403).json({ error: "You must be an approved rider" })
    }

    // Get ride request
    const rideRequest = await db.oneOrNone("SELECT * FROM ride_requests WHERE id = $1 AND status = 'pending'", [
      rideRequestId,
    ])
    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found or already accepted" })
    }

    // Get rider phone
    const riderUser = await db.oneOrNone("SELECT phone FROM users WHERE id = $1", [userId])
    if (!riderUser || !riderUser.phone) {
      return res.status(400).json({ error: "Rider phone number not found" })
    }

    // Accept ride
    const updated = await db.one(
      `UPDATE ride_requests 
       SET rider_id = $1, status = 'accepted', accepted_at = NOW(), rider_phone = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [rider.id, riderUser.phone, rideRequestId]
    )

    // Notify user via socket
    const io = getIO()
    if (io) {
      io.emit("ride:accepted", {
        ride_request_id: rideRequestId,
        rider_id: rider.id,
        rider_phone: riderUser.phone,
      })
    }

    res.json({ success: true, ride_request: updated })
  } catch (error) {
    console.error("Accept ride error:", error)
    res.status(500).json({ error: error.message || "Failed to accept ride" })
  }
})

// Offer custom price for ride
router.post("/request/:id/offer", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const rideRequestId = req.params.id
    const { offered_price } = req.body

    if (!offered_price || offered_price <= 0) {
      return res.status(400).json({ error: "Valid offered price is required" })
    }

    // Get rider
    const rider = await db.oneOrNone(
      "SELECT id FROM riders WHERE user_id = $1 AND registration_status = 'approved'",
      [userId]
    )
    if (!rider) {
      return res.status(403).json({ error: "You must be an approved rider" })
    }

    // Get ride request
    const rideRequest = await db.oneOrNone("SELECT * FROM ride_requests WHERE id = $1 AND status = 'pending'", [
      rideRequestId,
    ])
    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found" })
    }

    // Create offer
    const offer = await db.one(
      `INSERT INTO ride_offers (ride_request_id, rider_id, offered_price, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [rideRequestId, rider.id, offered_price]
    )

    // Notify user via socket
    const io = getIO()
    if (io) {
      io.emit("ride:offer", {
        ride_request_id: rideRequestId,
        offer_id: offer.id,
        rider_id: rider.id,
        offered_price: offered_price,
      })
    }

    res.json({ success: true, offer })
  } catch (error) {
    console.error("Create offer error:", error)
    res.status(500).json({ error: error.message || "Failed to create offer" })
  }
})

// User accepts rider's offer
router.post("/offer/:id/accept", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const offerId = req.params.id

    // Get offer
    const offer = await db.oneOrNone(
      `SELECT ro.*, rr.user_id as request_user_id 
       FROM ride_offers ro
       JOIN ride_requests rr ON ro.ride_request_id = rr.id
       WHERE ro.id = $1 AND ro.status = 'pending'`,
      [offerId]
    )

    if (!offer) {
      return res.status(404).json({ error: "Offer not found" })
    }

    if (offer.request_user_id !== userId) {
      return res.status(403).json({ error: "You can only accept offers for your own ride requests" })
    }

    // Get rider phone
    const riderUser = await db.oneOrNone("SELECT phone FROM users WHERE id = (SELECT user_id FROM riders WHERE id = $1)", [
      offer.rider_id,
    ])
    if (!riderUser || !riderUser.phone) {
      return res.status(400).json({ error: "Rider phone number not found. Please contact support." })
    }

    // Accept offer and update ride request
    await db.none(
      `UPDATE ride_requests 
       SET rider_id = $1, status = 'accepted', accepted_at = NOW(), 
           rider_phone = $2, requested_price = $3, updated_at = NOW()
       WHERE id = $4`,
      [offer.rider_id, riderUser.phone, offer.offered_price, offer.ride_request_id]
    )

    await db.none("UPDATE ride_offers SET status = 'accepted', updated_at = NOW() WHERE id = $1", [offerId])

    // Notify rider via socket
    const io = getIO()
    if (io) {
      io.emit("ride:accepted", {
        ride_request_id: offer.ride_request_id,
        rider_id: offer.rider_id,
        rider_phone: riderUser.phone,
      })
    }

    res.json({ success: true, message: "Offer accepted" })
  } catch (error) {
    console.error("Accept offer error:", error)
    res.status(500).json({ error: error.message || "Failed to accept offer" })
  }
})

// Get user's ride requests
router.get("/my-rides", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { status } = req.query

    // Check if ride_requests table exists
    const tableExists = await db.oneOrNone(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ride_requests'
      )`
    )

    if (!tableExists || !tableExists.exists) {
      // Tables don't exist yet - return empty array
      return res.json({ rides: [] })
    }

    let query = `SELECT 
      rr.*,
      ST_X(rr.pickup_location::geometry) as pickup_lng,
      ST_Y(rr.pickup_location::geometry) as pickup_lat,
      ST_X(rr.dropoff_location::geometry) as dropoff_lng,
      ST_Y(rr.dropoff_location::geometry) as dropoff_lat,
      r.id as rider_profile_id,
      v.make, v.model, v.color,
      ${await getUserNameSelect('u', 'rider')}
    FROM ride_requests rr
    LEFT JOIN riders r ON rr.rider_id = r.id
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE rr.user_id = $1`

    const params = [userId]

    if (status) {
      query += " AND rr.status = $2"
      params.push(status)
    }

    query += " ORDER BY rr.created_at DESC"

    const rides = await db.any(query, params)

    res.json({ rides })
  } catch (error) {
    console.error("Get my rides error:", error)
    // If it's a relation doesn't exist error, return empty array
    if (error.message && error.message.includes("does not exist")) {
      return res.json({ rides: [] })
    }
    res.status(500).json({ error: error.message || "Failed to get rides" })
  }
})

// Get single ride request details
router.get("/request/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const rideRequestId = req.params.id

    const ride = await db.one(
      `SELECT 
         rr.*,
         ST_X(rr.pickup_location::geometry) as pickup_lng,
         ST_Y(rr.pickup_location::geometry) as pickup_lat,
         ST_X(rr.dropoff_location::geometry) as dropoff_lng,
         ST_Y(rr.dropoff_location::geometry) as dropoff_lat,
         r.id as rider_profile_id,
         v.make, v.model, v.color, v.license_plate, v.vehicle_type,
         ${await getUserNameSelect('r_u', 'rider')},
         ${await getUserNameSelect('p_u', 'user')},
         r_u.phone as rider_phone_number,
         p_u.phone as passenger_phone,
         r.profile_photo_url as rider_photo,
         p_u.avatar_url as passenger_photo
       FROM ride_requests rr
       LEFT JOIN riders r ON rr.rider_id = r.id
       LEFT JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN users r_u ON r.user_id = r_u.id
       LEFT JOIN users p_u ON rr.user_id = p_u.id
       WHERE rr.id = $1 AND (rr.user_id = $2 OR rr.rider_id = (SELECT id FROM riders WHERE user_id = $2))`,
      [rideRequestId, userId]
    ).catch(() => null)

    if (!ride) {
      return res.status(404).json({ error: "Ride request not found or access denied" })
    }

    res.json(ride)
  } catch (error) {
    console.error("Get ride detail error:", error)
    res.status(500).json({ error: error.message || "Failed to get ride details" })
  }
})

// Cancel ride request (handles both passenger and rider)
router.post("/request/:id/cancel", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const rideRequestId = req.params.id
    const { reason } = req.body

    const rideRequest = await db.oneOrNone(
      `SELECT rr.*, r.user_id as rider_user_id 
       FROM ride_requests rr 
       LEFT JOIN riders r ON rr.rider_id = r.id 
       WHERE rr.id = $1`,
      [rideRequestId]
    )

    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found" })
    }

    const isPassenger = rideRequest.user_id === userId
    const isRider = rideRequest.rider_user_id === userId

    if (!isPassenger && !isRider) {
      return res.status(403).json({ error: "Unauthorized to cancel this ride" })
    }

    if (rideRequest.status === "completed" || rideRequest.status === "cancelled") {
      return res.status(400).json({ error: `Cannot cancel ride in ${rideRequest.status} status` })
    }

    const newStatus = 'cancelled'
    const cancelledBy = isPassenger ? 'passenger' : 'rider'

    await db.none(
      `UPDATE ride_requests 
       SET status = $1, cancelled_at = NOW(), cancellation_reason = $2, updated_at = NOW()
       WHERE id = $3`,
      [`${cancelledBy}_cancelled`, reason || null, rideRequestId]
    )

    // Notify the other party
    const io = getIO()
    if (io) {
      if (isPassenger && rideRequest.rider_id) {
        io.emit("ride:cancelled", { ride_request_id: rideRequestId, by: 'passenger' })
      } else if (isRider) {
        io.emit("ride:cancelled", { ride_request_id: rideRequestId, by: 'rider' })
      }
    }

    res.json({ success: true, message: `Ride cancelled by ${cancelledBy}` })
  } catch (error) {
    console.error("Cancel ride error:", error)
    res.status(500).json({ error: error.message || "Failed to cancel ride" })
  }
})

// Get user's ride history
router.get("/my-rides", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const rides = await db.any(
      `SELECT 
         rr.*,
         ST_X(rr.pickup_location::geometry) as pickup_lng,
         ST_Y(rr.pickup_location::geometry) as pickup_lat,
         ST_X(rr.dropoff_location::geometry) as dropoff_lng,
         ST_Y(rr.dropoff_location::geometry) as dropoff_lat,
         ${await getUserNameSelect('rider_user', 'rider')}
       FROM ride_requests rr
       LEFT JOIN riders r ON rr.rider_id = r.id
       LEFT JOIN users rider_user ON r.user_id = rider_user.id
       WHERE rr.user_id = $1
       ORDER BY rr.created_at DESC
       LIMIT 50`,
      [userId]
    )

    res.json({ rides })
  } catch (error) {
    console.error("Get my rides error:", error)
    res.status(500).json({ error: error.message || "Failed to load rides" })
  }
})

// Start ride (rider marks trip as in-progress)
router.post("/request/:id/start", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const rideRequestId = req.params.id

    // Check if user is the rider for this ride
    const ride = await db.oneOrNone(
      `SELECT rr.* FROM ride_requests rr 
       JOIN riders r ON rr.rider_id = r.id 
       WHERE rr.id = $1 AND r.user_id = $2`,
      [rideRequestId, userId]
    )

    if (!ride) {
      return res.status(403).json({ error: "Access denied or ride not found" })
    }

    if (ride.status !== 'accepted') {
      return res.status(400).json({ error: "Ride must be accepted before starting" })
    }

    const updated = await db.one(
      `UPDATE ride_requests SET status = 'in_progress', started_at = NOW(), updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [rideRequestId]
    )

    // Notify user
    const io = getIO()
    if (io) {
      io.emit("ride:started", { ride_request_id: rideRequestId })
    }

    res.json({ success: true, ride: updated })
  } catch (error) {
    console.error("Start ride error:", error)
    res.status(500).json({ error: error.message || "Failed to start ride" })
  }
})

// Complete ride (rider marks trip as finished)
router.post("/request/:id/complete", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const rideRequestId = req.params.id

    // Check rider and get fare info
    const ride = await db.oneOrNone(
      `SELECT rr.*, r.id as rider_prof_id FROM ride_requests rr 
       JOIN riders r ON rr.rider_id = r.id 
       WHERE rr.id = $1 AND r.user_id = $2`,
      [rideRequestId, userId]
    )

    if (!ride) {
      return res.status(403).json({ error: "Access denied or ride not found" })
    }

    if (ride.status !== 'in_progress') {
      return res.status(400).json({ error: "Only in-progress rides can be completed" })
    }

    const price = ride.requested_price || ride.estimated_price

    // Transaction to update ride and rider stats
    await db.tx(async t => {
      await t.none(
        "UPDATE ride_requests SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
        [rideRequestId]
      )
      await t.none(
        "UPDATE riders SET total_rides = total_rides + 1, total_earnings = total_earnings + $1 WHERE id = $2",
        [price, ride.rider_prof_id]
      )
    })

    // Notify user
    const io = getIO()
    if (io) {
      io.emit("ride:completed", { ride_request_id: rideRequestId, fare: price })
    }

    res.json({ success: true, message: "Ride completed successfully" })
  } catch (error) {
    console.error("Complete ride error:", error)
    res.status(500).json({ error: error.message || "Failed to complete ride" })
  }
})

// Get active/accepted rides for a rider
router.get("/rider/active", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    // Get rider
    const rider = await db.oneOrNone("SELECT id FROM riders WHERE user_id = $1", [userId])
    if (!rider) return res.json({ rides: [] })

    const rides = await db.any(
      `SELECT 
         rr.*,
         ${await getUserNameSelect('p_u', 'passenger')},
         p_u.avatar_url as passenger_photo
       FROM ride_requests rr
       JOIN users p_u ON rr.user_id = p_u.id
       WHERE rr.rider_id = $1 AND rr.status IN ('accepted', 'in_progress', 'started')
       ORDER BY rr.updated_at DESC`,
      [rider.id]
    )

    res.json({ rides })
  } catch (error) {
    console.error("Get active rider rides error:", error)
    res.status(500).json({ error: "Failed to fetch active rides" })
  }
})

// Get rider's ride history
router.get("/rider/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const rides = await db.any(
      `SELECT rr.*, ${await getUserNameSelect('u', 'passenger')} 
       FROM ride_requests rr
       JOIN riders r ON rr.rider_id = r.id
       JOIN users u ON rr.user_id = u.id
       WHERE r.user_id = $1
       ORDER BY rr.created_at DESC`,
      [userId]
    )
    res.json({ rides })
  } catch (error) {
    console.error("Rider history error:", error)
    res.status(500).json({ error: error.message || "Failed to load history" })
  }
})

// Get rider's earning stats
router.get("/rider/earnings", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const stats = await db.oneOrNone(
      `SELECT 
         COALESCE(SUM(CASE WHEN completed_at::date = CURRENT_DATE THEN COALESCE(requested_price, estimated_price) ELSE 0 END), 0) as today,
         COALESCE(SUM(CASE WHEN completed_at >= date_trunc('week', CURRENT_DATE) THEN COALESCE(requested_price, estimated_price) ELSE 0 END), 0) as this_week,
         COALESCE(SUM(COALESCE(requested_price, estimated_price)), 0) as total_life,
         COUNT(id) filter (where status = 'completed') as completed_count
       FROM ride_requests 
       WHERE rider_id = (SELECT id FROM riders WHERE user_id = $1) AND status = 'completed'`,
      [userId]
    )
    res.json(stats)
  } catch (error) {
    console.error("Earnings error:", error)
    res.status(500).json({ error: error.message || "Failed to load earnings" })
  }
})

module.exports = router


