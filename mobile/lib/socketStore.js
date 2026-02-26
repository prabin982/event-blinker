import { io } from "socket.io-client"
import { create } from "zustand"

const SOCKET_URL = "https://event-blinker.onrender.com"

export const useSocketStore = create((set, get) => {
  let socket = null

  return {
    socket: null,
    connected: false,
    newEvents: [],

    connect: () => {
      if (socket?.connected) return

      console.log("Attempting to connect to socket:", SOCKET_URL)

      socket = io(SOCKET_URL, {
        transports: ["polling", "websocket"], // Try polling first, then websocket
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Keep trying to reconnect
        timeout: 20000,
        forceNew: false,
        autoConnect: true,
      })

      socket.on("connect", () => {
        console.log("✓ Socket connected successfully:", socket.id)
        set({ connected: true, socket })
        socket.emit("subscribe:events")
      })

      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason)
        set({ connected: false })
      })

      socket.on("reconnect", (attemptNumber) => {
        console.log("Socket reconnected after", attemptNumber, "attempts")
        set({ connected: true, socket })
        socket.emit("subscribe:events")
      })

      socket.on("reconnect_attempt", (attemptNumber) => {
        console.log("Reconnection attempt", attemptNumber)
      })

      socket.on("reconnect_error", (error) => {
        console.error("Reconnection error:", error)
      })

      socket.on("reconnect_failed", () => {
        console.error("Socket reconnection failed after all attempts")
      })

      socket.on("event:new", (event) => {
        console.log("New event received:", event.id)
        set((state) => ({
          newEvents: [...state.newEvents, event],
        }))
      })

      socket.on("event:updated", (event) => {
        console.log("Event updated:", event.id)
        // Trigger re-fetch or update local state
      })

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message || error)
        set({ connected: false })
        // Don't throw - let reconnection handle it
      })
    },

    disconnect: () => {
      if (socket) {
        socket.emit("unsubscribe:events")
        socket.disconnect()
        set({ connected: false, socket: null })
      }
    },

    clearNewEvents: () => {
      set({ newEvents: [] })
    },
  }
})
