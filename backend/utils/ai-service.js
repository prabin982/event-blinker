const db = require("../config/database");

const API_KEY = process.env.OPENAI_API_KEY || "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";
const BASE_URL = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1";
const MODEL = process.env.OPENAI_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

async function getEventContext(eventId) {
    if (!eventId) return null;
    try {
        const event = await db.oneOrNone("SELECT id, title, description, location_name, start_time, price, capacity FROM events WHERE id = $1", [eventId]);
        return event;
    } catch (err) {
        console.error("[AI] Failed to fetch event context:", err.message);
        return null;
    }
}

async function getUpcomingEventsContext() {
    try {
        const events = await db.any(`
            SELECT id, title, start_time, location_name, price 
            FROM events 
            WHERE is_active = true AND is_approved = true AND start_time >= NOW()
            ORDER BY start_time ASC
            LIMIT 5
        `);
        return events;
    } catch (err) {
        console.error("[AI] Failed to fetch upcoming events:", err.message);
        return [];
    }
}

async function generateAIResponse(message, eventId) {
    if (!message || typeof message !== "string") {
        throw new Error("Message is required");
    }

    if (!API_KEY) {
        return "🤖 AI is not configured. Please set OPENAI_API_KEY in environment.";
    }

    // 1. DYNAMIC CONTEXT INJECTION (fetching fresh data from DB)
    const eventContext = await getEventContext(eventId);
    const upcomingEvents = await getUpcomingEventsContext();

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
    ];

    if (upcomingEvents && upcomingEvents.length > 0) {
        systemPrompt.push(
            "\n--- PLATFORM'S OVERALL ONGOING & UPCOMING EVENTS ---",
            "Here are the most recent upcoming events currently active on Event Blinker right now. If the user asks what events are happening today or soon, recommend these to them:",
            upcomingEvents.map(e => `- ${e.title} at ${e.location_name || 'TBD'} (Price: NPR ${e.price || 0})`).join("\n")
        );
    }

    if (eventContext) {
        const { title, description, location_name, start_time, price } = eventContext;
        // Injecting the db values directly into the LLM's brain!
        systemPrompt.push(
            "\n--- CURRENT CHATROOM EVENT DETAILS ---",
            "The user is currently viewing or chatting inside THIS specific event:",
            `Title: ${title}`,
            `Venue: ${location_name || 'Not specified'}`,
            `When: ${start_time}`,
            `Cost: NPR ${price || 'Free'}`,
            `About: ${description ? description.slice(0, 400) : 'No description available'}`
        );
    }

    // 2. 5-TIER CASCADING FALLBACK RECOVERY MECHANISM
    const models = [
        MODEL, // Primary: LLaMA 3.3
        "google/gemini-2.0-flash-exp:free", // Tier 2 Fallback
        "google/gemini-flash-1.5-8b", // Tier 3 Fallback
        "meta-llama/llama-3.1-8b-instruct:free", // Tier 4 Fallback
        "openrouter/free" // Tier 5 (Ultimate catch-all free model)
    ];

    let reply = null;
    let lastError = null;

    for (const targetModel of models) {
        try {
            console.log(`[AI] Attempting request with model: ${targetModel}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // Strict 12s Per-model timeout

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
                    temperature: 0.5,
                    max_tokens: 450
                })
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok) {
                console.warn(`[AI] Warn: Error with ${targetModel}:`, data.error?.message || response.status);
                lastError = data.error?.message || `API Error ${response.status}`;
                continue; // Instant switch to the next model!
            }

            reply = data.choices?.[0]?.message?.content?.trim();
            if (reply) {
                console.log(`[AI] ✨ Success with model: ${targetModel}`);
                break; // Break the loop, the AI answered!
            }
        } catch (err) {
            console.warn(`[AI] Warn: Exception with ${targetModel}:`, err.name === 'AbortError' ? 'Timeout' : err.message);
            lastError = err.name === 'AbortError' ? 'Connection timed out' : err.message;
            // Catch error or timeout, loop proceeds to the next API!
        }
    }

    if (!reply) {
        throw new Error(lastError || "All 5 AI models failed to respond");
    }

    return reply;
}

module.exports = {
    getEventContext,
    generateAIResponse,
    getModel: () => MODEL,
    hasApiKey: () => Boolean(API_KEY)
};
