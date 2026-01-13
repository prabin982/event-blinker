const db = require("../config/database")

const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log("✓ User connected:", socket.id, "from:", socket.handshake.address)
    console.log("  Headers:", socket.handshake.headers)
    console.log("  Origin:", socket.handshake.headers.origin || "none (mobile app)")

    // Join event room
    socket.on("join:event", (data) => {
      const { event_id, user_id } = data
      socket.join(`event:${event_id}`)
      console.log(`User ${user_id} joined event ${event_id}`)

      // Notify others
      io.to(`event:${event_id}`).emit("user:joined", {
        user_id,
        timestamp: new Date(),
      })
    })

    // Leave event room
    socket.on("leave:event", (data) => {
      const { event_id, user_id } = data
      socket.leave(`event:${event_id}`)
      io.to(`event:${event_id}`).emit("user:left", { user_id })
    })

    // Real-time message
    socket.on("message:send", async (data) => {
      try {
        const { user_id, event_id, message, sender_type = "user" } = data

        // Save to database
        const msg = await db.one(
          `INSERT INTO chat_messages (user_id, event_id, message, sender_type)
           VALUES ($1, $2, $3, $4)
           RETURNING id, created_at`,
          [user_id, event_id, message, sender_type],
        )

        io.to(`event:${event_id}`).emit("message:new", {
          id: msg.id,
          user_id,
          message,
          sender_type,
          timestamp: msg.created_at,
        })
      } catch (error) {
        console.error("Message error:", error)
        socket.emit("error", { message: "Failed to send message" })
      }
    })

    // Real-time event update
    socket.on("event:update-status", async (data) => {
      try {
        const { event_id, status, current_attendance } = data

        await db.query(
          `UPDATE events SET status = $1, current_attendance = $2, updated_at = NOW()
           WHERE id = $3`,
          [status, current_attendance, event_id],
        )

        io.to(`event:${event_id}`).emit("event:status-changed", {
          event_id,
          status,
          current_attendance,
          timestamp: new Date(),
        })
      } catch (error) {
        console.error("Status update error:", error)
      }
    })

    // Subscribe to all events for real-time updates
    socket.on("subscribe:events", () => {
      socket.join("events:all")
      console.log(`Socket ${socket.id} subscribed to all events`)
    })

    // Unsubscribe from all events
    socket.on("unsubscribe:events", () => {
      socket.leave("events:all")
      console.log(`Socket ${socket.id} unsubscribed from all events`)
    })

    // Ride sharing socket handlers
    socket.on("rider:online", async (data) => {
      const { rider_id } = data
      socket.join(`rider:${rider_id}`)
      console.log(`Rider ${rider_id} is online`)
    })

    socket.on("rider:offline", (data) => {
      const { rider_id } = data
      socket.leave(`rider:${rider_id}`)
      console.log(`Rider ${rider_id} is offline`)
    })

    socket.on("subscribe:rides", (data) => {
      const { rider_id } = data
      if (rider_id) {
        socket.join(`rider:${rider_id}`)
        socket.join("rides:all")
        console.log(`Rider ${rider_id} subscribed to ride notifications`)
      }
    })

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id)
    })
  })
}

// Function to broadcast new event to all subscribers
const broadcastNewEvent = (io, event) => {
  if (io) {
    io.to("events:all").emit("event:new", event)
    console.log(`Broadcasted new event: ${event.id}`)
  }
}

// Function to broadcast event update
const broadcastEventUpdate = (io, event) => {
  if (io) {
    io.to("events:all").emit("event:updated", event)
    io.to(`event:${event.id}`).emit("event:updated", event)
    console.log(`Broadcasted event update: ${event.id}`)
  }
}

module.exports = { setupSocketHandlers, broadcastNewEvent, broadcastEventUpdate }
