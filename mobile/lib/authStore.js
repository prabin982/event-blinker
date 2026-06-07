import { create } from "zustand"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://event-blinker.onrender.com/api"

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    try {
      set({ loading: true, error: null })
      console.log("[v0] Attempting login with email:", email)
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      })
      const { token, user } = response.data
      console.log("[v0] Login successful, user:", user)
      await AsyncStorage.setItem("token", token)
      await AsyncStorage.setItem("user", JSON.stringify(user))
      set({ user, loading: false })
      return { success: true }
    } catch (error) {
      console.log("[v0] Login error:", error.response?.data || error.message)
      const message = error.response?.data?.error || error.response?.data?.message || "Login failed"
      set({ error: message, loading: false })
      return { success: false, error: message }
    }
  },

  register: async (name, email, password) => {
    try {
      set({ loading: true, error: null })
      console.log("[v0] Attempting registration with email:", email)
      const response = await axios.post(`${API_URL}/auth/register`, {
        name,
        email,
        password,
      })
      const { token, user } = response.data
      console.log("[v0] Registration successful, user:", user)
      await AsyncStorage.setItem("token", token)
      await AsyncStorage.setItem("user", JSON.stringify(user))
      set({ user, loading: false })
      return { success: true }
    } catch (error) {
      console.log("[v0] Registration error:", error.response?.data || error.message)
      const message = error.response?.data?.error || error.response?.data?.message || "Registration failed"
      set({ error: message, loading: false })
      return { success: false, error: message }
    }
  },

  loadUser: async () => {
    try {
      set({ loading: true })
      const token = await AsyncStorage.getItem("token")
      const userStr = await AsyncStorage.getItem("user")
      if (token && userStr) {
        const user = JSON.parse(userStr)
        console.log("[v0] Loaded user from storage:", user)
        set({ user, loading: false })
      } else {
        console.log("[v0] No user in storage")
        set({ user: null, loading: false })
      }
    } catch (error) {
      console.log("[v0] Load user error:", error.message)
      set({ user: null, loading: false, error: error.message })
    }
  },

  logout: async () => {
    try {
      console.log("[v0] Logging out user")
      await AsyncStorage.removeItem("token")
      await AsyncStorage.removeItem("user")
      set({ user: null })
    } catch (error) {
      console.log("[v0] Logout error:", error.message)
      set({ error: error.message })
    }
  },

  refreshUser: async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      if (!token) return
      const response = await axios.get(`${API_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const user = response.data
      await AsyncStorage.setItem("user", JSON.stringify(user))
      set({ user })
      return user
    } catch (error) {
      console.error("Refresh user error:", error)
    }
  }
}))
