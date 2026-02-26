"use client"

import { useState, useEffect } from "react"
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native"
import { useRouter } from "expo-router"
import * as Location from "expo-location"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEventStore } from "../../lib/eventStore"
import { useAuthStore } from "../../lib/authStore"
import { useSocketStore } from "../../lib/socketStore"
import axios from "axios"
import { Ionicons } from "@expo/vector-icons"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://event-blinker.onrender.com/api"

export default function EventsScreen() {
  const { events, fetchEvents, loading, likeEvent } = useEventStore()
  const [refreshing, setRefreshing] = useState(false)
  const [likedEvents, setLikedEvents] = useState([])
  const [myInvolvedEvents, setMyInvolvedEvents] = useState([])
  const [activeTab, setActiveTab] = useState("all") // "all", "liked", "checked-in"
  const { user } = useAuthStore()
  const { connect, disconnect, newEvents } = useSocketStore()
  const router = useRouter()

  useEffect(() => {
    loadEvents()
    connect()
    return () => disconnect()
  }, [])

  useEffect(() => {
    if (newEvents.length > 0) {
      loadEvents()
    }
  }, [newEvents])

  useEffect(() => {
    if (user && activeTab !== "all") {
      loadInvolvedEvents()
    }
  }, [activeTab, user])

  const loadEvents = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync()
        const { latitude, longitude } = location.coords
        await fetchEvents(latitude, longitude)
      } else {
        await fetchEvents(null, null)
      }
      await loadLikedEvents()
    } catch (error) {
      console.error("Error loading events:", error)
      await fetchEvents(null, null)
    }
  }

  const loadLikedEvents = async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      if (!token) return

      const response = await axios.get(`${API_URL}/likes/user/likes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setLikedEvents(response.data || [])
    } catch (error) {
      console.error("Error loading liked events:", error)
    }
  }

  const loadInvolvedEvents = async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      if (!token) return

      setRefreshing(true)
      if (activeTab === "liked") {
        const response = await axios.get(`${API_URL}/likes/my-likes`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setMyInvolvedEvents(response.data || [])
      } else if (activeTab === "checked-in") {
        const response = await axios.get(`${API_URL}/checkin/my-checkins`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setMyInvolvedEvents(response.data || [])
      }
    } catch (error) {
      console.error("Error loading involved events:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadEvents()
    setRefreshing(false)
  }

  const handleLikePress = async (eventId) => {
    if (!user) {
      router.push("/auth/login")
      return
    }

    const token = await AsyncStorage.getItem("token")
    if (likedEvents.includes(eventId)) {
      setLikedEvents(likedEvents.filter((id) => id !== eventId))
    } else {
      setLikedEvents([...likedEvents, eventId])
    }
    await likeEvent(eventId, token)
  }

  const getDisplayEvents = () => {
    if (activeTab === "all") return events
    return myInvolvedEvents
  }

  const renderEventCard = ({ item }) => (
    <TouchableOpacity style={styles.eventCard} onPress={() => router.push(`/eventDetail?id=${item.id}`)}>
      {item.image_url && (
        <Image
          source={{ uri: item.image_url.startsWith('http') ? item.image_url : `${API_URL.replace('/api', '')}${item.image_url}` }}
          style={styles.eventImage}
          resizeMode="cover"
        />
      )}

      <View style={styles.eventContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.eventMeta}>
          <Ionicons name="calendar" size={14} color="#666" />
          <Text style={styles.eventMetaText}>{new Date(item.start_time).toLocaleDateString()}</Text>
        </View>

        <View style={styles.eventMeta}>
          <Ionicons name="location" size={14} color="#666" />
          <Text style={styles.eventMetaText} numberOfLines={1}>
            {item.location_name}
          </Text>
        </View>

        <View style={styles.eventFooter}>
          <Text style={styles.eventPrice}>
            {item.price ? `NPR ${item.price}` : "Free"}
          </Text>
          <TouchableOpacity style={styles.likeButton} onPress={() => handleLikePress(item.id)}>
            <Ionicons
              name={likedEvents.includes(item.id) ? "heart" : "heart-outline"}
              size={20}
              color={likedEvents.includes(item.id) ? "#FF6B35" : "#666"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {user && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "all" && styles.activeTab]}
            onPress={() => setActiveTab("all")}
          >
            <Text style={[styles.tabText, activeTab === "all" && styles.activeTabText]}>All Events</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "liked" && styles.activeTab]}
            onPress={() => setActiveTab("liked")}
          >
            <Text style={[styles.tabText, activeTab === "liked" && styles.activeTabText]}>Liked</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "checked-in" && styles.activeTab]}
            onPress={() => setActiveTab("checked-in")}
          >
            <Text style={[styles.tabText, activeTab === "checked-in" && styles.activeTabText]}>Check-ins</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={getDisplayEvents()}
          renderItem={renderEventCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ddd" />
              <Text style={styles.emptyText}>
                {activeTab === "all"
                  ? "No events available"
                  : activeTab === "liked"
                    ? "No liked events"
                    : "No check-ins yet"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listContent: {
    padding: 12,
  },
  eventCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  eventImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#e0e0e0",
  },
  eventContent: {
    padding: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  eventMetaText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 6,
    flex: 1,
  },
  eventFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  eventPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  likeButton: {
    padding: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#FF6B35",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#FF6B35",
    fontWeight: "bold",
  },
})
