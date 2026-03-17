const express = require("express")
const db = require("../config/database")

const router = express.Router()

// OpenRouter config
const API_KEY = process.env.OPENAI_API_KEY || ""
const BASE_URL = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1"
const MODEL = process.env.OPENAI_MODEL || "meta-llama/llama-3.3-70b-instruct:free"

// ============ HEALTH CHECK ============
router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        provider: API_KEY ? "OpenRouter" : "None",
        model: MODEL,
        hasKey: Boolean(API_KEY),
    })
})

// ============ HELPER: Fetch event context ============
async function getEventContext(eventId) {
    if (!eventId) return null
    try {
        const event = await db.oneOrNone("SELECT id, title, description, location_name, start_time, price, capacity FROM events WHERE id = $1", [eventId])
        return event
    } catch (err) {
        console.error("[AI] Failed to fetch event context:", err.message)
        return null
    }
}

// ============ POST /chat ============
router.post("/chat", async (req, res) => {
    const { message, event_id } = req.body || {}

    if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" })
    }

    if (!API_KEY) {
        return res.json({
            reply: "🤖 AI is not configured. Please set OPENAI_API_KEY in Render environment.",
        })
    }

    try {
        const eventContext = await getEventContext(event_id)

        const systemPrompt = [
            "You are 'Blinker AI', the official AI assistant for the Event Blinker platform in Nepal.",
            "Event Blinker is a total ecosystem combining discovery, ticketing, and ride-sharing.",
            "--- CORE KNOWLEDGE ---",
            "1. RIDE SHARING: Users book rides (Car, SUV, Motorcycle) in the 'Ride Sharing' tab.",
            "2. EVENT CREATION: Organizers use the Web Portal. All events need Admin Approval.",
            "3. TICKETING: Users get digital QR codes in-app for entry.",
            "4. VERIFICATION: Riders must submit NID, billbook, and license for admin approval.",
            "--- PERSONA ---",
            "- Tone: Professional, friendly, helpful, and concisely Nepali. Use emojis! 🇳🇵",
            "- If asked for instructions, give step-by-step app navigation.",
            "- Guide users to the correct buttons; you cannot perform actions for them.",
        ]

        if (eventContext) {
            const { title, description, location_name, start_time, price } = eventContext
            systemPrompt.push(
                "\n--- EVENT CONTEXT ---",
                `Event: ${title}. Location: ${location_name}. Time: ${start_time}. Price: NPR ${price}.`,
                `Details: ${description?.slice(0, 500)}`
            )
        }

        const models = [MODEL, "google/gemini-2.0-flash-lite-preview-02-05:free"];
        let reply = null;
        let lastError = null;

        for (const targetModel of models) {
            try {
                const response = await fetch(`${BASE_URL}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${API_KEY}`,
                        "HTTP-Referer": "https://event-blinker.onrender.com",
                        "X-OpenRouter-Title": "Event Blinker AI"
                    },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: [
                            { role: "system", content: systemPrompt.join(" ") },
                            { role: "user", content: message }
                        ],
                        temperature: 0.7,
                        max_tokens: 500
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error(`[AI] Error with ${targetModel}:`, data);
                    lastError = data.error?.message || `API Error ${response.status}`;
                    continue; // Try next model
                }

                reply = data.choices?.[0]?.message?.content?.trim();
                if (reply) break;
            } catch (err) {
                console.error(`[AI] Exception with ${targetModel}:`, err.message);
                lastError = err.message;
            }
        }

        if (!reply) {
            throw new Error(lastError || "All AI models failed to respond");
        }

        res.json({ reply })

    } catch (err) {
        console.error("[AI] Chat error caught:", err.message)
        res.json({
            reply: `🤖 I'm having a brief hiccup connecting to my brain. Details: ${err.message}. Please check your OpenRouter credits or try again soon!`,
            error: true
        })
    }
})

module.exports = router
