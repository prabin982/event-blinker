import express from "express"
import fetch from "node-fetch"
import OpenAI from "openai"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

const PORT = process.env.PORT || 5100
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL // e.g., http://127.0.0.1:11434
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3"
const EVENTS_API_URL = process.env.EVENTS_API_URL // optional grounding source

if (!OPENAI_API_KEY && !OLLAMA_BASE_URL) {
  console.warn("⚠️  No OPENAI_API_KEY or OLLAMA_BASE_URL set. Configure one to enable AI replies.")
} else {
  if (OLLAMA_BASE_URL) {
    console.log(`✅ Using Ollama: ${OLLAMA_BASE_URL} with model: ${OLLAMA_MODEL}`)
  } else {
    console.log(`✅ Using OpenAI with model: ${OPENAI_MODEL}`)
  }
  if (EVENTS_API_URL) {
    console.log(`✅ Events API URL: ${EVENTS_API_URL}`)
  }
}

const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

const app = express()
app.use(cors())
app.use(express.json())

// Health
app.get("/health", (req, res) => {
  const aiProvider = OLLAMA_BASE_URL ? "Ollama" : (OPENAI_API_KEY ? "OpenAI" : "None")
  const model = OLLAMA_BASE_URL ? OLLAMA_MODEL : OPENAI_MODEL
  res.json({
    status: "ok",
    provider: aiProvider,
    model: model,
    hasKey: Boolean(OPENAI_API_KEY),
    ollamaUrl: OLLAMA_BASE_URL || null,
    eventsApiUrl: EVENTS_API_URL || null
  })
})

// Helper: fetch event detail for grounding (optional)
async function getEventContext(eventId) {
  if (!EVENTS_API_URL || !eventId) return null
  try {
    // Construct full URL - EVENTS_API_URL should be like http://localhost:5000/api/events
    const url = `${EVENTS_API_URL.replace(/\/$/, '')}/${eventId}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!resp.ok) {
      console.log(`Event context fetch failed: ${resp.status} ${resp.statusText}`)
      return null
    }
    const data = await resp.json()
    return data
  } catch (err) {
    console.error("Failed to fetch event context:", err.message)
    return null
  }
}

// POST /chat
app.post("/chat", async (req, res) => {
  console.log(`[AI SERVICE] Incoming chat request:`, req.body);
  const { message, event_id } = req.body || {}

  if (!message || typeof message !== "string") {
    console.log(`[AI SERVICE] Bad request: missing message`);
    return res.status(400).json({ error: "message is required" })
  }

  if (!client && !OLLAMA_BASE_URL) {
    console.warn("[AI SERVICE] AI provider not configured.");
    return res.json({ reply: "(AI not configured) I don't have access to an AI model right now. Please configure OPENAI_API_KEY or start Ollama and set OLLAMA_BASE_URL." })
  }

  try {
    const eventContext = await getEventContext(event_id)

    const systemPrompt = [
      "You are an event assistant. Be concise, friendly, and specific.",
      "If location/time/parking are known, include them briefly.",
      "If asked for directions/route, keep it short and actionable.",
      "If unsure, say you’re not certain and suggest contacting organizers.",
    ]

    if (eventContext) {
      const { title, description, location_name, start_time, price, capacity } = eventContext
      systemPrompt.push(
        `Event: ${title || "Unknown"}.`,
        location_name ? `Location: ${location_name}.` : "",
        start_time ? `Starts at: ${start_time}.` : "",
        price ? `Price: ${price}.` : "Price: free or not provided.",
        capacity ? `Capacity: ${capacity}.` : ""
      )
      if (description) systemPrompt.push(`Details: ${description.slice(0, 300)}`)
    }

    let reply = null

    if (OLLAMA_BASE_URL) {
      const ollamaResp = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          messages: [
            { role: "system", content: systemPrompt.filter(Boolean).join(" ") },
            { role: "user", content: message },
          ],
        }),
      })

      if (!ollamaResp.ok) {
        const errText = await ollamaResp.text()
        throw new Error(`Ollama error ${ollamaResp.status}: ${errText}`)
      }

      const ollamaJson = await ollamaResp.json()
      reply =
        ollamaJson?.message?.content?.trim() ||
        ollamaJson?.response?.trim() ||
        "Thanks for asking! Tell me more."
    } else {
      const response = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt.filter(Boolean).join(" ") },
          { role: "user", content: message },
        ],
        temperature: 0.5,
        max_tokens: 350,
      })
      reply = response.choices?.[0]?.message?.content?.trim() || "Thanks for asking! Tell me more."
    }

    res.json({ reply })
  } catch (err) {
    console.error("[AI SERVICE] Chat error:", err?.message || err)

    // Check for specific common errors
    let errorDetail = err?.message || "Internal error";
    if (errorDetail.includes("model") && errorDetail.includes("not found")) {
      errorDetail = "The AI model (Llama3) is not installed on the server. Please run 'ollama pull llama3'.";
    }

    // Return a 200 with a fallback message instead of an error status
    // This provides a better user experience on mobile
    res.json({
      reply: `(AI Helper Error) I'm having trouble connecting to my brain right now. Details: ${errorDetail}`,
      error: true,
      errorDetail
    })
  }
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ AI Assistant service running on http://0.0.0.0:${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
  console.log(`   Network access: http://192.168.254.10:${PORT}\n`)
})


