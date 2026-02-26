"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useAuthStore } from "../../lib/authStore"
import { useSocketStore } from "../../lib/socketStore"
import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.254.10:5000/api"

// Helper function to deduplicate messages
const deduplicateMessages = (messages) => {
  const seen = new Set()
  return messages.filter((msg) => {
    // Create a unique identifier for each message
    let key
    if (msg.id) {
      key = `id-${msg.id}`
    } else {
      // Use content + user + timestamp as key
      const timestamp = msg.created_at ? new Date(msg.created_at).getTime() : 0
      key = `content-${msg.user_id}-${timestamp}-${msg.message?.substring(0, 20)}`
    }
    
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export default function ChatScreen() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [events, setEvents] = useState([])
  const [messageText, setMessageText] = useState("")
  const [sending, setSending] = useState(false)
  const [chatMode, setChatMode] = useState("organizer") // "organizer" | "ai"
  const [aiMessages, setAiMessages] = useState([])
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiSending, setAiSending] = useState(false)
  // Resolve AI chat URL: prefer env var, otherwise derive from API_URL host (port 5100)
  const AI_CHAT_URL =
    process.env.EXPO_PUBLIC_AI_CHAT_URL ||
    (() => {
      try {
        const parsed = new URL(API_URL)
        const host = parsed.hostname
        return `${parsed.protocol}//${host}:5100/chat`
      } catch (e) {
        return "http://192.168.254.10:5100/chat"
      }
    })()
  console.log("Resolved AI_CHAT_URL:", AI_CHAT_URL)
  const { user } = useAuthStore()
  const { socket, connected, connect } = useSocketStore()
  const router = useRouter()
  const flatListRef = useRef(null)
  
  const params = useLocalSearchParams()
  const paramEventId = params?.eventId || params?.event_id
  
  // Check for eventId from navigation params
  useEffect(() => {
    if (paramEventId) {
      const eventIdNum = typeof paramEventId === 'string' ? parseInt(paramEventId) : paramEventId
      setSelectedEvent(eventIdNum)
      fetchChatMessages(eventIdNum)
    }
  }, [paramEventId])

  useEffect(() => {
    fetchUserEvents()
    if (!connected) {
      connect()
    }
    return () => {
      // Don't disconnect - keep connection for other tabs
    }
  }, [])

  useEffect(() => {
    if (selectedEvent && socket && connected) {
      // Join event chat room
      socket.emit("join:event", { event_id: selectedEvent, user_id: user?.id })
      
      // Listen for new messages
      const handleNewMessage = (message) => {
        if (message.event_id === selectedEvent || message.event_id?.toString() === selectedEvent?.toString()) {
          setMessages((prev) => {
            // Avoid duplicates - check by id
            const exists = prev.some((m) => {
              // Match by id if available
              if (m.id && message.id) {
                return m.id === message.id || m.id.toString() === message.id.toString()
              }
              // Match by content and timestamp if no id
              return m.message === message.message && 
                     m.user_id === message.user_id &&
                     Math.abs(new Date(m.created_at) - new Date(message.created_at || message.timestamp)) < 1000
            })
            if (exists) return prev
            // Ensure message has all required fields
            const completeMessage = {
              ...message,
              event_id: message.event_id || selectedEvent,
              created_at: message.created_at || message.timestamp || new Date().toISOString(),
            }
            const updated = [completeMessage, ...prev]
            // Deduplicate before setting
            return deduplicateMessages(updated)
          })
          // Scroll to show new message
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
          }, 100)
        }
      }
      
      socket.on("message:new", handleNewMessage)

      return () => {
        socket.emit("leave:event", { event_id: selectedEvent, user_id: user?.id })
        socket.off("message:new", handleNewMessage)
      }
    }
  }, [selectedEvent, socket, user, connected])

  const handleSendAi = async () => {
    if (!aiPrompt.trim()) return

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: aiPrompt.trim(),
      created_at: new Date().toISOString(),
    }
    setAiMessages((prev) => [...prev, userMessage])
    setAiPrompt("")
    setAiSending(true)

    try {
      if (!AI_CHAT_URL) {
        throw new Error("AI endpoint is not configured")
      }

      console.log("Calling AI endpoint:", AI_CHAT_URL)
      // Quick health check (best-effort) to provide faster diagnostics for device testing
      try {
        const aiBase = new URL(AI_CHAT_URL).origin
        console.log("Checking AI health at:", `${aiBase}/health`)
        await axios.get(`${aiBase}/health`, { timeout: 3000 }).catch((e) => {
          console.warn("AI health check failed:", e?.message || e)
        })
      } catch (e) {
        // ignore malformed URL or other errors
        console.warn("AI health check skipped:", e?.message || e)
      }

      const response = await axios.post(
        AI_CHAT_URL,
        {
          message: userMessage.text,
          event_id: selectedEvent || paramEventId,
        },
        { timeout: 15000 }
      )

      const aiReply =
        response.data?.reply ||
        response.data?.message ||
        "Thanks for asking! Tell me more about what you need at this event."

      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: aiReply,
        created_at: new Date().toISOString(),
      }
      setAiMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      // Improved error logging and user guidance for device testing
      try {
        console.error("AI request failed:", error)
        // axios network errors often surface as 'Network Error' with little detail
        const code = error.code || (error.response && error.response.status) || "unknown"
        const respData = error.response?.data || null
        const messageParts = []
        if (error.message) messageParts.push(error.message)
        if (code) messageParts.push(`code: ${code}`)
        if (respData && typeof respData === "object") messageParts.push(JSON.stringify(respData))

        // Helpful guidance when running on a physical device: localhost is not reachable
        const guidance = (() => {
          const url = AI_CHAT_URL || ""
          if (url.includes("localhost") || url.includes("127.0.0.1") || url.includes("0.0.0.0")) {
            return (
              "If you're running the app on a phone, replace 'localhost' with your machine's LAN IP " +
              "(e.g. 192.168.x.x) or enable the Expo tunnel. Also ensure your dev machine's firewall allows incoming connections."
            )
          }
          return "Check that the AI service is running and reachable from your device."
        })()

        const fallbackText =
          error.message === "AI endpoint is not configured"
            ? "AI endpoint not set. Add EXPO_PUBLIC_AI_CHAT_URL to point at your model API."
            : `Unable to reach AI service. ${messageParts.join(" | ")}. ${guidance}`

        setAiMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "ai",
            text: fallbackText,
            created_at: new Date().toISOString(),
            isError: true,
          },
        ])
      } catch (inner) {
        console.error("Error handling AI failure:", inner)
      }
    } finally {
      setAiSending(false)
    }
  }

  const renderModeToggle = () => (
    <View style={styles.modeToggle}>
      <TouchableOpacity
        style={[styles.toggleButton, chatMode === "organizer" && styles.toggleButtonActive]}
        onPress={() => setChatMode("organizer")}
      >
        <Ionicons name="people" size={18} color={chatMode === "organizer" ? "#fff" : "#FF6B35"} />
        <Text style={[styles.toggleLabel, chatMode === "organizer" && styles.toggleLabelActive]}>Organizers</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleButton, chatMode === "ai" && styles.toggleButtonActive]}
        onPress={() => {
          setChatMode("ai")
          setSelectedEvent(null)
        }}
      >
        <Ionicons name="sparkles" size={18} color={chatMode === "ai" ? "#fff" : "#FF6B35"} />
        <Text style={[styles.toggleLabel, chatMode === "ai" && styles.toggleLabelActive]}>AI Assistant</Text>
      </TouchableOpacity>
    </View>
  )

  const fetchUserEvents = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_URL}/events`)
      setEvents(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error("Error fetching events:", error)
      Alert.alert("Error", "Failed to load events. Please try again.")
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const fetchChatMessages = async (eventId) => {
    try {
      setLoading(true)
      const token = await AsyncStorage.getItem("token")
      const response = await axios.get(`${API_URL}/chat/${eventId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const messagesData = Array.isArray(response.data) ? response.data : []
      // Remove duplicates and ensure all have unique IDs
      // Create unique IDs for messages without IDs
      const messagesWithIds = messagesData.map((msg, index) => ({
        ...msg,
        id: msg.id || `msg-${eventId}-${index}-${msg.created_at || Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        event_id: msg.event_id || eventId,
      }))
      
      // Remove duplicates - keep first occurrence
      const uniqueMessages = messagesWithIds.filter((msg, index, self) => {
        const firstIndex = self.findIndex((m) => {
          // Match by id if both have ids
          if (m.id && msg.id) {
            return m.id.toString() === msg.id.toString()
          }
          // Match by content, user, and timestamp (within 1 second)
          const timeDiff = Math.abs(
            new Date(m.created_at || 0).getTime() - 
            new Date(msg.created_at || 0).getTime()
          )
          return m.message === msg.message && 
                 m.user_id === msg.user_id &&
                 timeDiff < 1000
        })
        return index === firstIndex
      })
      // Reverse to show newest at bottom (since FlatList is inverted)
      const reversed = uniqueMessages.reverse()
      // Final deduplication pass
      const finalMessages = deduplicateMessages(reversed)
      setMessages(finalMessages)
    } catch (error) {
      console.error("Error fetching chat:", error)
      if (error.response?.status !== 404) {
        Alert.alert("Error", "Failed to load messages. Please try again.")
      }
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedEvent) return
    if (!user) {
      Alert.alert("Login Required", "Please login to send messages")
      router.push("/auth/login")
      return
    }

    try {
      setSending(true)
      const token = await AsyncStorage.getItem("token")
      if (!token) {
        Alert.alert("Error", "Authentication required. Please login again.")
        router.push("/auth/login")
        return
      }

      // Send via REST API (this saves to database and broadcasts)
      const response = await axios.post(
        `${API_URL}/chat/${selectedEvent}`,
        { message: messageText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Add message to local state immediately
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newMessage = {
        id: response.data.id || tempId,
        message: messageText.trim(),
        user_id: user.id,
        sender_id: user.id,
        user_name: user.name || response.data.user_name || "User",
        created_at: response.data.created_at || new Date().toISOString(),
        sender_type: response.data.sender_type || "user",
        event_id: selectedEvent,
      }
      setMessages((prev) => {
        // Avoid duplicates - check if message with same id already exists
        const exists = prev.some((m) => {
          if (m.id && newMessage.id) {
            return m.id.toString() === newMessage.id.toString()
          }
          // Also check by content and timestamp
          return m.message === newMessage.message && 
                 m.user_id === newMessage.user_id &&
                 Math.abs(new Date(m.created_at) - new Date(newMessage.created_at)) < 2000
        })
        if (exists) return prev
        const updated = [newMessage, ...prev]
        // Deduplicate before setting
        return deduplicateMessages(updated)
      })
      setMessageText("")
      
      // Scroll to show new message
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
      }, 100)
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMsg = error.response?.data?.error || error.message || "Failed to send message"
      Alert.alert("Error", errorMsg)
    } finally {
      setSending(false)
    }
  }

  if (chatMode === "ai") {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        {renderModeToggle()}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Event Assistant</Text>
        </View>

        <View style={styles.aiTip}>
          <Text style={styles.aiTipText}>
            Ask about schedules, directions, dress code, parking, or anything related to the event.
          </Text>
        </View>

        <FlatList
          data={aiMessages}
          renderItem={({ item }) => {
            const isUser = item.role === "user"
            return (
              <View
                style={[
                  styles.messageBubble,
                  isUser ? styles.sentMessage : styles.aiMessage,
                  item.isError && styles.aiMessageError,
                ]}
              >
                <Text style={[styles.messageText, isUser && styles.sentMessageText]}>{item.text}</Text>
                <Text style={[styles.messageTime, isUser && styles.sentMessageTime]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            )
          }}
          keyExtractor={(item, index) => `ai-${item.id || index}`}
          contentContainerStyle={styles.messagesList}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask AI about this event..."
            placeholderTextColor="#999"
            value={aiPrompt}
            onChangeText={setAiPrompt}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, aiSending && styles.sendButtonDisabled]}
            onPress={handleSendAi}
            disabled={aiSending || !aiPrompt.trim()}
          >
            {aiSending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  if (!selectedEvent) {
    return (
      <View style={styles.container}>
        {renderModeToggle()}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Event Chat</Text>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
          </View>
        ) : events.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No events to chat about</Text>
          </View>
        ) : (
          <FlatList
            data={events}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.eventItem}
                onPress={() => {
                  setSelectedEvent(item.id)
                  fetchChatMessages(item.id)
                }}
              >
                <View style={styles.eventItemContent}>
                  <Text style={styles.eventItemTitle}>{item.title}</Text>
                  <Text style={styles.eventItemSubtitle}>{item.location_name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
              </TouchableOpacity>
            )}
            keyExtractor={(item, index) => `event-${item.id || index}`}
          />
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      {renderModeToggle()}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedEvent(null)}>
          <Ionicons name="chevron-back" size={24} color="#FF6B35" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Chat</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={({ item }) => {
              const isSent = item.user_id === user?.id || item.sender_id === user?.id
              const isOrganizer = item.sender_type === "organizer"
              const senderName = isOrganizer 
                ? "Organizer" 
                : (item.user_name || (isSent ? "You" : "User"))
              
              return (
                <View style={[styles.messageBubble, isSent && styles.sentMessage, isOrganizer && styles.organizerMessage]}>
                  {!isSent && (
                    <Text style={styles.senderName}>
                      {senderName}
                    </Text>
                  )}
                  <Text style={[styles.messageText, isSent && styles.sentMessageText]}>
                    {item.message}
                  </Text>
                  <Text style={[styles.messageTime, isSent && styles.sentMessageTime]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )
            }}
            keyExtractor={(item, index) => {
              // Always include index to ensure uniqueness
              if (item.id) {
                const idStr = String(item.id).replace(/[^a-zA-Z0-9]/g, '-')
                return `msg-${idStr}-idx${index}`
              }
              // Fallback: use multiple fields for uniqueness
              const timestamp = item.created_at ? new Date(item.created_at).getTime() : Date.now()
              const userPart = item.user_id ? String(item.user_id) : 'u'
              const msgPart = item.message ? String(item.message).substring(0, 5).replace(/[^a-zA-Z0-9]/g, '') : 'm'
              return `msg-idx${index}-u${userPart}-t${timestamp}-${msgPart}`
            }}
            contentContainerStyle={styles.messagesList}
            inverted
            onContentSizeChange={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor="#999"
              value={messageText}
              onChangeText={setMessageText}
            />
            <TouchableOpacity 
              style={[styles.sendButton, sending && styles.sendButtonDisabled]} 
              onPress={handleSendMessage}
              disabled={sending || !messageText.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modeToggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: "#fff7f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE1D2",
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  toggleButtonActive: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
  },
  toggleLabel: {
    color: "#FF6B35",
    fontWeight: "600",
  },
  toggleLabelActive: {
    color: "#fff",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },
  eventItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  eventItemContent: {
    flex: 1,
  },
  eventItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  eventItemSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  messagesList: {
    padding: 12,
  },
  messageBubble: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 12,
    maxWidth: "80%",
  },
  sentMessage: {
    backgroundColor: "#FF6B35",
    alignSelf: "flex-end",
  },
  organizerMessage: {
    backgroundColor: "#E3F2FD",
    borderLeftWidth: 3,
    borderLeftColor: "#2196F3",
  },
  aiMessage: {
    backgroundColor: "#F1EAFF",
    borderLeftWidth: 3,
    borderLeftColor: "#7E57C2",
  },
  aiMessageError: {
    backgroundColor: "#FFF3F0",
    borderLeftColor: "#E64A19",
  },
  senderName: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
    fontWeight: "600",
  },
  messageText: {
    fontSize: 14,
    color: "#333",
  },
  sentMessageText: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  sentMessageTime: {
    color: "rgba(255,255,255,0.8)",
  },
  aiTip: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#EEF7FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D6E9FF",
  },
  aiTipText: {
    color: "#3A4A5A",
    fontSize: 13,
    lineHeight: 18,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },
  sendButton: {
    backgroundColor: "#FF6B35",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
})
