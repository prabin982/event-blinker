import { create } from "zustand"
import axios from "axios"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://event-blinker.onrender.com/api"

export const useEventStore = create((set) => ({
  events: [],
  nearbyEvents: [],
  selectedEvent: null,
  loading: false,
  error: null,

  fetchEvents: async (lat, lng, radius = 5) => {
    try {
      set({ loading: true, error: null })
      const params = {}
      if (lat && lng) {
        params.lat = lat
        params.lon = lng
        params.radius = radius
      }
      const url = `${API_URL}/events`
      console.log("Fetching events from:", url, params)
      const response = await axios.get(url, { params })
      const eventsData = Array.isArray(response.data) ? response.data : []
      set({ events: eventsData, nearbyEvents: eventsData, loading: false })
    } catch (error) {
      console.error("Error fetching events:", error)
      set({ error: error.message, loading: false, events: [], nearbyEvents: [] })
    }
  },

  addNewEvent: (event) => {
    set((state) => {
      const exists = state.events.some((e) => e.id === event.id)
      if (!exists) {
        return {
          events: [event, ...state.events],
          nearbyEvents: [event, ...state.nearbyEvents],
        }
      }
      return state
    })
  },

  fetchEventDetails: async (eventId) => {
    try {
      const response = await axios.get(`${API_URL}/events/${eventId}`)
      set({ selectedEvent: response.data })
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },

  likeEvent: async (eventId, token) => {
    try {
      await axios.post(`${API_URL}/likes/${eventId}`, {}, { headers: { Authorization: `Bearer ${token}` } })
      set((state) => ({
        events: state.events.map((e) => (e.id === eventId ? { ...e, like_count: (e.like_count || 0) + 1 } : e)),
      }))
    } catch (error) {
      set({ error: error.message })
    }
  },

  searchEvents: async (query) => {
    try {
      const response = await axios.get(`${API_URL}/events`, {
        params: { category: query },
      })
      set({ events: response.data })
    } catch (error) {
      set({ error: error.message })
    }
  },
}))
