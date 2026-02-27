"use client"

import { useState, useEffect } from "react"
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Linking,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useEventStore } from "../lib/eventStore"
import { useAuthStore } from "../lib/authStore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Location from "expo-location"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://event-blinker.onrender.com/api"

export default function EventDetailScreen() {
  const { id: eventId } = useLocalSearchParams()
  const router = useRouter()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [routing, setRouting] = useState(false)
  const { fetchEventDetails, likeEvent } = useEventStore()
  const { user } = useAuthStore()

  useEffect(() => {
    if (eventId) {
      loadEventDetails()
    }
  }, [eventId])

  const loadEventDetails = async () => {
    try {
      setLoading(true)
      const eventData = await fetchEventDetails(eventId)
      if (eventData) {
        // Parse location if it's GeoJSON
        if (eventData.location_geojson) {
          try {
            const geoJson = typeof eventData.location_geojson === 'string'
              ? JSON.parse(eventData.location_geojson)
              : eventData.location_geojson
            if (geoJson.coordinates) {
              eventData.longitude = geoJson.coordinates[0]
              eventData.latitude = geoJson.coordinates[1]
            }
          } catch (e) {
            console.warn("Location parse warning:", e.message)
          }
        }

        // Ensure image URL is solid
        if (eventData.image_url && !eventData.image_url.startsWith('http')) {
          const base = API_URL.replace('/api', '')
          eventData.image_url = `${base}${eventData.image_url.startsWith('/') ? '' : '/'}${eventData.image_url}`
        }

        setEvent(eventData)
      } else {
        console.error("No event data returned for ID:", eventId)
      }
    } catch (error) {
      console.error("Error loading event:", error)
      Alert.alert("Connection Error", "Could not reach the server. Please check your internet.")
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async () => {
    if (!isLiked) {
      await likeEvent(eventId)
      setIsLiked(true)
    }
  }

  const handleCheckIn = async () => {
    if (!user) {
      Alert.alert("Login Required", "Please login to check in to events")
      router.push("/auth/login")
      return
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to check in")
        return
      }

      const location = await Location.getCurrentPositionAsync()
      const token = await AsyncStorage.getItem("token")

      const response = await fetch(`${API_URL}/checkin/${eventId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
      })

      if (response.ok) {
        Alert.alert("Success", "You have checked in to the event!")
        loadEventDetails() // Refresh event data
      } else {
        const error = await response.json()
        Alert.alert("Error", error.error || "Failed to check in")
      }
    } catch (error) {
      console.error("Check-in error:", error)
      Alert.alert("Error", "Failed to check in to event")
    }
  }

  const handleNavigate = async () => {
    if (!event?.latitude || !event?.longitude) {
      Alert.alert("Route unavailable", "Event location is missing.")
      return
    }

    try {
      setRouting(true)
      let origin = ""

      // Best-effort origin for shortest route suggestion
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === "granted") {
        const current = await Location.getCurrentPositionAsync()
        origin = `${current.coords.latitude},${current.coords.longitude}`
      }

      const destination = `${event.latitude},${event.longitude}`
      const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        destination
      )}&travelmode=driving${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`
      const appleUrl = `http://maps.apple.com/?daddr=${encodeURIComponent(
        destination
      )}${origin ? `&saddr=${encodeURIComponent(origin)}` : ""}&dirflg=d`

      const urlToOpen = Platform.select({
        ios: appleUrl,
        default: googleUrl,
      })

      const supported = await Linking.canOpenURL(urlToOpen)
      if (supported) {
        await Linking.openURL(urlToOpen)
      } else {
        Alert.alert("Navigation unavailable", "No maps app found to open the route.")
      }
    } catch (error) {
      console.error("Navigation error:", error)
      Alert.alert("Error", "Could not launch directions.")
    } finally {
      setRouting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    )
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color="#ddd" />
          <Text style={styles.errorText}>Event not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonIcon}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#FF6B35" : "#333"} />
          </TouchableOpacity>
        </View>

        {event.image_url && (
          <Image
            source={{ uri: event.image_url }}
            style={styles.eventImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          <Text style={styles.eventTitle}>{event.title}</Text>

          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>
              {event.price ? `NPR ${event.price}` : "Free"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color="#FF6B35" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Date & Time</Text>
              <Text style={styles.infoValue}>{new Date(event.start_time).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#FF6B35" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{event.location_name}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.routeButton} onPress={handleNavigate} disabled={routing}>
            <Ionicons name="star" size={20} color="#fff" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.routeButtonText}>{routing ? "Finding route..." : "Best Route"}</Text>
              <Text style={styles.routeButtonSubText}>Fastest turn-by-turn directions</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <Ionicons name="people" size={20} color="#FF6B35" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Attendees</Text>
              <Text style={styles.infoValue}>
                {event.current_attendance || event.checkin_count || 0}/{event.capacity || "Unlimited"}
              </Text>
            </View>
          </View>

          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>About Event</Text>
            <Text style={styles.description}>{event.description || "No description available"}</Text>
          </View>

          <TouchableOpacity style={styles.checkInButton} onPress={handleCheckIn}>
            <Ionicons name="location" size={20} color="#fff" />
            <Text style={styles.checkInButtonText}>Check In to Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bookRideButton}
            onPress={async () => {
              try {
                const result = {
                  type: 'dropoff',
                  address: event.location_name,
                  location: {
                    latitude: event.latitude,
                    longitude: event.longitude
                  }
                }
                await AsyncStorage.setItem('ride_map_picker_result', JSON.stringify(result))
                router.push('/(tabs)/rides')
              } catch (e) {
                console.error("Book ride error:", e)
              }
            }}
          >
            <Ionicons name="car" size={22} color="#fff" />
            <Text style={styles.bookRideButtonText}>Book a Ride to Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => {
              router.push(`/(tabs)/chat?eventId=${eventId}`)
            }}
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.chatButtonText}>Chat with Organizer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonIcon: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  likeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  eventImage: {
    width: "100%",
    height: 300,
    backgroundColor: "#e0e0e0",
  },
  content: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFE8DC",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 14,
    color: "#666",
  },
  priceValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#999",
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    marginTop: 4,
  },
  descriptionSection: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
  },
  routeButton: {
    flexDirection: "row",
    backgroundColor: "#F7A600",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    shadowColor: "#F7A600",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  routeButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },
  routeButtonSubText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
  },
  checkInButton: {
    flexDirection: "row",
    backgroundColor: "#FF6B35",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  checkInButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  messageSection: {
    marginVertical: 16,
    marginBottom: 32,
  },
  messageInput: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
    maxHeight: 100,
    color: "#333",
  },
  sendButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  chatButton: {
    flexDirection: "row",
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  chatButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  bookRideButton: {
    flexDirection: "row",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  bookRideButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  }
})
