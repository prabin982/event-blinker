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
          source={{
            uri: item.image_url.startsWith('http')
              ? item.image_url
              : `${API_URL.replace('/api', '')}${item.image_url.startsWith('/') ? '' : '/'}${item.image_url}`
          }}
          style={styles.eventImage}
          resizeMode="cover"
        />
      )}

      <View style={styles.eventContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.eventMeta}>
          <Ionicons name="calendar" size={14} color="#8892B0" />
          <Text style={styles.eventMetaText}>{new Date(item.start_time).toLocaleDateString()}</Text>
        </View>

        <View style={styles.eventMeta}>
          <Ionicons name="location" size={14} color="#8892B0" />
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
              size={22}
              color={likedEvents.includes(item.id) ? "#FF6B35" : "#6B7599"}
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
              <Ionicons name="calendar-outline" size={48} color="#2A3050" />
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
    backgroundColor: "#0B0F1A",
  },
  listContent: {
    padding: 16,
  },
  eventCard: {
    backgroundColor: "#151A2D",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  eventImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#1C2240",
  },
  eventContent: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#F0F2F8",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  eventMetaText: {
    fontSize: 13,
    color: "#8892B0",
    marginLeft: 8,
    flex: 1,
  },
  eventFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  eventPrice: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FF6B35",
  },
  likeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: "#4D5675",
    marginTop: 12,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#0D1120",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    borderRadius: 8,
  },
  activeTab: {
    borderBottomColor: "#FF6B35",
    backgroundColor: "rgba(255,107,53,0.06)",
  },
  tabText: {
    fontSize: 14,
    color: "#4D5675",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#FF6B35",
    fontWeight: "700",
  },
})
