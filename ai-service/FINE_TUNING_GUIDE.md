# 🤖 Event Blinker AI Fine-Tuning Guide

## Overview

This guide explains how to fine-tune the Event Blinker AI assistant for better, more contextual responses.

---

## Option 1: Quick Setup (Use Pre-trained Llama3)

### 1. Install Ollama Model (Windows/Mac/Linux)
```bash
# Download Llama3 (4.7GB)
ollama pull llama3

# Or smaller model (2GB)
ollama pull llama3:8b-instruct-q4_K_M

# Or even smaller (1.4GB)  
ollama pull gemma:2b
```

### 2. Configure AI Service
Update `ai-service/.env`:
```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3
EVENTS_API_URL=http://localhost:5000/api/events
PORT=5100
```

### 3. Start AI Service
```bash
cd ai-service
npm start
```

---

## Option 2: Fine-Tune Your Own Model (Google Colab)

### Why Fine-Tune?
- **Better accuracy** for event-specific questions
- **Consistent tone** matching your brand
- **Smaller model size** with focused knowledge
- **Faster responses** (less general knowledge = faster inference)

### Steps to Fine-Tune:

#### 1. Open Google Colab
Go to [Google Colab](https://colab.research.google.com)

#### 2. Upload the Notebook
Upload `Event_Blinker_AI_FineTuning.ipynb` from this folder

#### 3. Enable GPU
- Click **Runtime** > **Change runtime type**
- Select **T4 GPU** (free) or **A100** (Colab Pro)

#### 4. Run All Cells
Click **Runtime** > **Run all**

#### 5. Download the Model
After training, download `event_blinker_ollama_model.zip`

#### 6. Install in Ollama
```bash
# Unzip the downloaded file
unzip event_blinker_ollama_model.zip

# Create the custom model
ollama create event-blinker -f Modelfile

# Test it
ollama run event-blinker "What time does the event start?"
```

#### 7. Update AI Service
```env
OLLAMA_MODEL=event-blinker
```

---

## Fine-Tuning Data Guidelines

### Categories to Include:

1. **Event Information** (40%)
   - Start/end times
   - Location details
   - Pricing and tickets
   - Capacity and availability

2. **Navigation** (20%)
   - Directions
   - Parking info
   - Public transport
   - Accessibility

3. **Registration** (15%)
   - How to book
   - Refund policies
   - Group bookings

4. **Ride Sharing** (10%)
   - Finding rides
   - Offering rides
   - Communication

5. **General** (15%)
   - Dress code
   - What to bring
   - Food/drinks
   - Weather considerations

### Data Format:
```json
{
  "instruction": "User's question",
  "context": "Event details and context",
  "response": "Your ideal response"
}
```

### Example:
```json
{
  "instruction": "Is there parking available?",
  "context": "Event: Tech Conference. Location: Convention Center, 500 Main St.",
  "response": "Yes! The Convention Center at 500 Main St has a parking garage with 2000 spots. Rate is $15/day. There's also street parking nearby, but it fills up quickly."
}
```

---

## Recommended Training Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Learning Rate | 2e-4 | Standard for LoRA fine-tuning |
| Epochs | 3-5 | More for smaller datasets |
| LoRA Rank | 16 | Balance of quality/speed |
| Batch Size | 2-4 | Based on GPU memory |
| Max Steps | 60-200 | Higher = more training |

---

## Troubleshooting

### Model not responding?
```bash
# Check if Ollama is running
ollama list

# Restart Ollama
# Windows: Restart from system tray
# Mac/Linux: ollama serve
```

### Out of memory on Colab?
- Use smaller model: `unsloth/gemma-2b-bnb-4bit`
- Reduce batch size to 1
- Use T4 instead of free GPU

### Slow responses?
- Use smaller quantization: `q4_k_m`
- Use fewer training examples
- Run Ollama with GPU: `OLLAMA_GPU_LAYERS=35 ollama run model`

---

## Model Comparison

| Model | Size | Speed | Quality | Memory |
|-------|------|-------|---------|--------|
| Llama3 8B | 4.7GB | Fast | Excellent | 8GB |
| Mistral 7B | 4.1GB | Faster | Great | 6GB |
| Gemma 2B | 1.4GB | Fastest | Good | 4GB |
| Fine-tuned | ~2-4GB | Fast | Best for your use | 4-8GB |

---

## Support

- Check AI service health: `http://localhost:5100/health`
- View logs in terminal where AI service runs
- Test with: `curl -X POST http://localhost:5100/chat -H "Content-Type: application/json" -d '{"message": "Hello!"}'`
