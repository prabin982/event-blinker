const express = require("express")
const https = require("https")
const http = require("http")
const db = require("../config/database")

const router = express.Router()

// OpenRouter config (Llama 3.3 70B free)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1"
const OPENAI_MODEL = process.env.OPENAI_MODEL || "meta-llama/llama-3.3-70b-instruct:free"

// ============ HEALTH CHECK ============
router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        provider: OPENAI_API_KEY ? "OpenRouter" : "None",
        model: OPENAI_MODEL,
        hasKey: Boolean(OPENAI_API_KEY),
    })
})

// ============ HELPER: Fetch event context ============
async function getEventContext(eventId) {
    if (!eventId) return null
    try {
        const event = await db.oneOrNone("SELECT id, title, description, location_name, start_time, price, capacity FROM events WHERE id = $1", [eventId])
        return event
    } catch (err) {
        console.error("Failed to fetch event context:", err.message)
        return null
    }
}

// ============ HELPER: Call OpenRouter ============
function callOpenRouter(messages, model) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${OPENAI_BASE_URL}/chat/completions`)
        const isHttps = url.protocol === "https:"
        const lib = isHttps ? https : http

        const body = JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.5,
            max_tokens: 400,
        })

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "HTTP-Referer": "https://event-blinker.onrender.com",
                "X-OpenRouter-Title": "Event Blinker AI",
                "Content-Length": Buffer.byteLength(body),
            },
        }

        const req = lib.request(options, (res) => {
            let data = ""
            res.on("data", (chunk) => { data += chunk })
            res.on("end", () => {
                try {
                    const json = JSON.parse(data)
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const reply = json.choices?.[0]?.message?.content?.trim()
                        resolve(reply || "Thanks for asking! Tell me more.")
                    } else {
                        console.error("[AI] OpenRouter error:", res.statusCode, data.substring(0, 500))
                        reject(new Error(`OpenRouter API error ${res.statusCode}: ${json.error?.message || "Unknown error"}`))
                    }
                } catch (e) {
                    reject(new Error("Failed to parse AI response"))
                }
            })
        })

        req.on("error", (e) => reject(e))
        req.setTimeout(25000, () => {
            req.destroy()
            reject(new Error("AI request timed out"))
        })

        req.write(body)
        req.end()
    })
}

// ============ POST /chat ============
router.post("/chat", async (req, res) => {
    console.log("[AI] Incoming chat request:", req.body)
    const { message, event_id } = req.body || {}

    if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" })
    }

    if (!OPENAI_API_KEY) {
        return res.json({
            reply: "🤖 AI is not configured yet. The administrator needs to set the OPENAI_API_KEY environment variable on the server.",
        })
    }

    try {
        const eventContext = await getEventContext(event_id)

        const systemPrompt = [
            "You are 'Blinker AI', the official AI assistant and virtual concierge for the Event Blinker platform in Nepal.",
            "Event Blinker is a complete digital ecosystem that combines event discovery, ticketing, and peer-to-peer ride-sharing all in one app.",

            "--- CORE PLATFORM KNOWLEDGE ---",
            "1. RIDE SHARING: Users can book rides directly to events (Car, SUV, or Motorcycle). Real-time tracking and verified drivers ensure safety. Tell users to go to the 'Ride Sharing' tab.",
            "2. EVENT CREATION: Event Organizers create events on the Web Portal. Events require Admin Approval before going live.",
            "3. TICKETING & ENTRY: Users buy tickets in the app and receive a digital QR code for check-in at venues.",
            "4. SAFETY & VERIFICATION: All Riders (drivers) must submit NID, billbook, and license for manual admin verification.",

            "--- BEHAVIOR & PERSONA ---",
            "- Tone: Professional, extremely helpful, friendly, and enthusiastically Nepali.",
            "- If a user asks a platform-specific question (e.g., 'How do I upload my license?'), give step-by-step instructions.",
            "- You cannot directly book a ride or buy a ticket FOR the user. Guide them to the correct tab/button.",
            "- If someone asks something outside your scope (math, code, etc.), politely decline and remind them you are Blinker AI.",
            "- Use emojis to make responses readable and fun. Be concise unless explaining a complex process.",
        ]

        if (eventContext) {
            const { title, description, location_name, start_time, price, capacity } = eventContext
            systemPrompt.push(
                "\n--- CURRENT EVENT CONTEXT ---",
                `Event Title: ${title || "Unknown"}.`,
                location_name ? `Location: ${location_name}.` : "",
                start_time ? `Starts at: ${start_time}.` : "",
                price ? `Price: NPR ${price}.` : "Price: free or not provided.",
                capacity ? `Capacity: ${capacity} people.` : ""
            )
            if (description) systemPrompt.push(`Details: ${description.slice(0, 500)}`)
        }

        const messages = [
            { role: "system", content: systemPrompt.filter(Boolean).join(" ") },
            { role: "user", content: message },
        ]

        const reply = await callOpenRouter(messages, OPENAI_MODEL)

        res.json({ reply })
    } catch (err) {
        console.error("[AI] Chat error:", err?.message || err)
        // Return 200 with error info for better mobile UX
        res.json({
            reply: `🤖 I'm having a brief hiccup connecting to my brain. Please try again in a moment! (${err?.message || "Unknown error"})`,
            error: true,
        })
    }
})

module.exports = router
