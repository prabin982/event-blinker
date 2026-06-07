const express = require("express")
const aiService = require("../utils/ai-service")

const router = express.Router()

// ============ HEALTH CHECK ============
router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        provider: aiService.hasApiKey() ? "OpenRouter" : "None",
        model: aiService.getModel(),
        hasKey: aiService.hasApiKey(),
    })
})

// ============ POST /chat (Direct Endpoint Access) ============
router.post("/chat", async (req, res) => {
    const { message, event_id } = req.body || {}

    try {
        const reply = await aiService.generateAIResponse(message, event_id);
        res.json({ reply });
    } catch (err) {
        console.error("[AI] Chat endpoint error caught:", err.message);
        res.json({
            reply: `🤖 I'm having a brief hiccup connecting to my brain. Details: ${err.message}. Please check your connection or try again soon!`,
            error: true
        });
    }
})

module.exports = router;
