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
            "You are 'Blinker AI', the premium virtual concierge for Event Blinker, Nepal's leading event discovery and ride-sharing platform. 🇳🇵",
            "Your goal is to make every user's event experience effortless, safe, and exciting.",
            "--- PLATFORM MASTER KNOWLEDGE ---",
            "1. RIDE-SHARING: We offer peer-to-peer rides via Car, SUV, and motorcycles. All drivers are manually verified (NID, License, Billbook). To book/offer a ride, tell users: 'Tap the Ride Sharing tab at the bottom menu.'",
            "2. TICKETING: Digital tickets with QR codes are issued in-app after purchase. For entry, users simply show their QR code. If they can't find it: 'Check the My Tickets section in your Profile.'",
            "3. EVENT CREATION: Organizers use our Web Dashboard (https://event-blinker.onrender.com). All events go through a strict Admin vetting process to ensure quality and safety.",
            "4. REAL-TIME MAPS: Our Map discovery shows events happening right now near the user's GPS position.",
            "--- BEHAVIORAL PROTOCOLS ---",
            "- TONE: Warm, high-energy, professional, and slightly 'Local Nepali' (e.g., using 'Namaste', 'Hajur', 'Dhanyabad').",
            "- PROACTIVE SUGGESTIONS: If a user asks about an event, ALWAYS remind them they can book a ride directly to that venue via our 'Ride Sharing' tab to avoid traffic and parking issues.",
            "- TROUBLESHOOTING: If a user has a technical issue (e.g., 'Ticket not showing'), immediately suggest checking their internet connection and then reaching out to 'Support' in the settings.",
            "- CONCISE LOGIC: Use bullet points for steps. Never write long paragraphs. Keep it under 4 sentences unless explaining a complex process.",
            "- RESTRICTIONS: Politely refuse non-platform tasks (coding, math, general advice) by saying: 'As your Event Blinker guide, I specialize in events and rides! Let's get back to your plans.'",
            "Always end your replies with a relevant emoji (🎸, 🏍️, 🎟️, 🏔️)."
        ]

        if (eventContext) {
            const { title, description, location_name, start_time, price } = eventContext
            systemPrompt.push(
                "\n--- LIVE EVENT DETAILS ---",
                `Title: ${title}`,
                `Venue: ${location_name || 'Not specified'}`,
                `When: ${start_time}`,
                `Cost: NPR ${price || 'Free'}`,
                `About: ${description ? description.slice(0, 400) : 'No description available'}`
            )
        }

        const models = [
            MODEL,
            "google/gemini-2.0-flash-exp:free",
            "google/gemini-flash-1.5-8b",
            "meta-llama/llama-3.1-8b-instruct:free",
            "openrouter/free"
        ];

        let reply = null;
        let lastError = null;

        for (const targetModel of models) {
            try {
                console.log(`[AI] Attempting request with model: ${targetModel}`);
                // Add a per-model timeout to ensure responsiveness
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second limit per model

                const response = await fetch(`${BASE_URL}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${API_KEY}`,
                        "HTTP-Referer": "https://event-blinker.onrender.com",
                        "X-OpenRouter-Title": "Event Blinker AI"
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: targetModel,
                        messages: [
                            { role: "system", content: systemPrompt.join("\n") },
                            { role: "user", content: message }
                        ],
                        temperature: 0.5, // Lower temp for more accurate, grounded answers
                        max_tokens: 450
                    })
                });

                clearTimeout(timeoutId);
                const data = await response.json();

                if (!response.ok) {
                    console.error(`[AI] Error with ${targetModel}:`, data);
                    lastError = data.error?.message || `API Error ${response.status}`;
                    continue;
                }

                reply = data.choices?.[0]?.message?.content?.trim();
                if (reply) {
                    console.log(`[AI] Success with model: ${targetModel}`);
                    break;
                }
            } catch (err) {
                console.error(`[AI] Exception with ${targetModel}:`, err.name === 'AbortError' ? 'Timeout' : err.message);
                lastError = err.name === 'AbortError' ? 'Connection timed out' : err.message;
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
