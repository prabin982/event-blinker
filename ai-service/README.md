# AI Service for Event Blinker

This service provides AI-powered chat assistance for event-related questions.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file with:
   ```env
   PORT=5100
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   # OR use Ollama (local AI):
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=llama3
   EVENTS_API_URL=http://localhost:5000/api/events
   ```

3. **Start the service:**
   ```bash
   npm start
   # or for development:
   npm run dev
   ```

## Usage

The AI service is automatically integrated with the chat system. When users ask questions in event chat rooms, the AI service will:

1. Detect if the message is a question
2. Fetch event context from the backend
3. Generate a helpful response
4. Post the response as a bot message in the chat

## API Endpoints

### POST /chat
Generate AI response for a chat message.

**Request:**
```json
{
  "message": "What time does the event start?",
  "event_id": "123"
}
```

**Response:**
```json
{
  "reply": "The event starts at 7:00 PM on December 25th."
}
```

### GET /health
Check service health.

**Response:**
```json
{
  "status": "ok",
  "model": "gpt-4o-mini",
  "hasKey": true
}
```

## Integration

The backend automatically calls this service when:
- A user sends a message in an event chat
- The message appears to be a question (contains "?", or starts with what/when/where/how/why/is/can/does)
- The AI_SERVICE_URL environment variable is set in the backend

## Configuration Options

- **OpenAI**: Requires API key, paid service, high quality responses
- **Ollama**: Free, local AI, requires Ollama installed locally

Choose one based on your needs and budget.
