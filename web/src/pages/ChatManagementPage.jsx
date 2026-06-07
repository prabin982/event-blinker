import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Navigation from "../components/Navigation"
import axios from "axios"
import { io } from "socket.io-client"

const API_URL = import.meta.env.VITE_API_URL || "https://event-blinker.onrender.com"
const SOCKET_URL = API_URL

export default function ChatManagementPage({ user, onLogout }) {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [event, setEvent] = useState(null)
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (eventId) {
      fetchEventDetails()
      fetchMessages()

      // Set up WebSocket connection
      const token = localStorage.getItem("token")
      socketRef.current = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        query: { token },
      })

      socketRef.current.on("connect", () => {
        console.log("Socket connected for chat")
        socketRef.current.emit("join:event", { event_id: eventId, user_id: user?.id })
      })

      socketRef.current.on("message:new", (message) => {
        if (message.event_id === eventId || message.event_id?.toString() === eventId?.toString()) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === message.id)) return prev
            return [...prev, message]
          })
          // Scroll to bottom
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          }, 100)
        }
      })

      socketRef.current.on("connect_error", (error) => {
        console.error("Socket connection error:", error)
      })

      return () => {
        if (socketRef.current) {
          socketRef.current.emit("leave:event", { event_id: eventId, user_id: user?.id })
          socketRef.current.disconnect()
        }
      }
    }
  }, [eventId, user])

  const fetchEventDetails = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await axios.get(`${API_URL}/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setEvent(response.data)
    } catch (error) {
      console.error("Error fetching event:", error)
    }
  }

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await axios.get(`${API_URL}/api/chat/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setMessages(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim()) return

    try {
      setSending(true)
      const token = localStorage.getItem("token")
      const response = await axios.post(
        `${API_URL}/api/chat/${eventId}`,
        { message: messageText },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      // Message will be added via WebSocket, but add locally for immediate feedback
      const newMessage = {
        ...response.data,
        user_name: user?.name || "You",
        sender_type: "organizer",
      }
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === newMessage.id)) return prev
        return [...prev, newMessage]
      })
      setMessageText("")

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    } catch (error) {
      console.error("Error sending message:", error)
      alert(error.response?.data?.error || "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation user={user} onLogout={onLogout} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Chat Management - {event?.title || "Event"}
          </h1>
          <p className="text-gray-600 mt-2">Manage messages from users for this event</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg flex flex-col" style={{ height: "calc(100vh - 250px)" }}>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No messages yet. Users can send messages about this event.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOrganizer = msg.sender_type === "organizer" || msg.user_id === user?.id
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOrganizer ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isOrganizer
                          ? "bg-gradient-to-r from-red-600 to-blue-600 text-white"
                          : "bg-gray-100 text-gray-900"
                        }`}
                    >
                      {!isOrganizer && (
                        <p className="text-xs font-semibold mb-1 opacity-80">
                          {msg.user_name || "User"}
                        </p>
                      )}
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${isOrganizer ? "text-white opacity-80" : "text-gray-500"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !sending && handleSendMessage()}
                placeholder="Type your response..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                disabled={sending}
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !messageText.trim()}
                className="bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-2 rounded-lg hover:from-red-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
