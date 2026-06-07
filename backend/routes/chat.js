const express = require("express")
const db = require("../config/database")
const authMiddleware = require("../middleware/auth")
const socketModule = require("../utils/socket")
const aiService = require("../utils/ai-service")

const router = express.Router()


// Get messages for event
router.get("/:event_id", async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query
    const event_id = req.params.event_id

    const messages = await db.query(
      `SELECT 
        cm.id,
        cm.user_id,
        cm.event_id,
        cm.message,
        cm.sender_type,
        cm.created_at,
        CASE 
          WHEN cm.sender_type = 'bot' THEN 'Event Assistant'
          ELSE u.name
        END as user_name,
        u.avatar_url
       FROM chat_messages cm
       LEFT JOIN users u ON cm.user_id = u.id
       WHERE cm.event_id = $1
       ORDER BY cm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [event_id, parseInt(limit), parseInt(offset)],
    )

    // Reverse to show oldest first (since we're using inverted FlatList)
    res.json(messages.reverse())
  } catch (error) {
    console.error("Error fetching messages:", error)
    res.status(500).json({ error: error.message || "Failed to fetch messages" })
  }
})

// Send message
router.post("/:event_id", authMiddleware, async (req, res) => {
  try {
    const { message } = req.body
    const { event_id } = req.params

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" })
    }

    // Get user type to determine sender_type
    const userData = await db.oneOrNone("SELECT user_type, name FROM users WHERE id = $1", [req.user.id])
    const senderType = userData?.user_type === "organizer" ? "organizer" : "user"

    const msg = await db.one(
      `INSERT INTO chat_messages (user_id, event_id, message, sender_type)
       VALUES ($1, $2, $3, $4)
       RETURNING 
         id,
         user_id,
         event_id,
         message,
         sender_type,
         created_at`,
      [req.user.id, event_id, message.trim(), senderType],
    )

    // Get user name
    msg.user_name = userData?.name || "User"

    // Broadcast message via WebSocket
    const io = socketModule.getIO()
    if (io) {
      io.to(`event:${event_id}`).emit("message:new", {
        id: msg.id,
        user_id: msg.user_id,
        event_id: msg.event_id,
        message: msg.message,
        sender_type: msg.sender_type,
        user_name: msg.user_name,
        created_at: msg.created_at,
      })
    }

    // Check if message is a question and trigger AI response (async, non-blocking)
    const messageLower = message.trim().toLowerCase()
    const isQuestion = messageLower.includes("?") ||
      messageLower.startsWith("what") ||
      messageLower.startsWith("when") ||
      messageLower.startsWith("where") ||
      messageLower.startsWith("how") ||
      messageLower.startsWith("why") ||
      messageLower.startsWith("is") ||
      messageLower.startsWith("can") ||
      messageLower.startsWith("does")

    // Trigger AI response if it's a question (fire and forget)
    if (isQuestion) {
      aiService.generateAIResponse(message.trim(), event_id)
        .then(async (reply) => {
          if (reply && typeof reply === 'string') {
            // Save AI response as a bot message
            const aiMessage = await db.one(
              `INSERT INTO chat_messages (user_id, event_id, message, sender_type)
                 VALUES (NULL, $1, $2, 'bot')
                 RETURNING 
                   id,
                   user_id,
                   event_id,
                   message,
                   sender_type,
                   created_at`,
              [event_id, reply]
            ).catch((err) => {
              // If user_id cannot be NULL, try with a system user ID or skip
              console.log("Could not save AI message:", err.message)
              return null
            })

            if (!aiMessage) return

            aiMessage.user_name = "Event Assistant"

            // Broadcast AI response
            const io = socketModule.getIO()
            if (io) {
              io.to(`event:${event_id}`).emit("message:new", {
                id: aiMessage.id,
                user_id: null,
                event_id: aiMessage.event_id,
                message: aiMessage.message,
                sender_type: "bot",
                user_name: "Event Assistant",
                created_at: aiMessage.created_at,
              })
            }
          }
        })
        .catch((err) => {
          // Silently fail - AI is optional
          console.log("[AI Context Hook] Service not available or error:", err.message)
        })
    }

    res.status(201).json(msg)
  } catch (error) {
    console.error("Chat error:", error)
    res.status(500).json({ error: error.message || "Failed to send message" })
  }
})

module.exports = router
