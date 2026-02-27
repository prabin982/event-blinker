"use client"

import { useState, useEffect, useRef } from "react"
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Animated, Platform } from "react-native"
import * as Location from "expo-location"
import { useRouter } from "expo-router"
import { useEventStore } from "../../lib/eventStore"
import { useAuthStore } from "../../lib/authStore"
import { useSocketStore } from "../../lib/socketStore"
import { Ionicons } from "@expo/vector-icons"

// Import Mapbox
let MapboxGL = null
try {
  MapboxGL = require("@rnmapbox/maps").default
  const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoicHJhYmlubm5ubiIsImEiOiJjbWl2dmh6eTcwczU1M2ZzYjU2Y2RmaGdvIn0.CRMu-jNZzOgNRz7cRNXXdg"
  if (MAPBOX_TOKEN) {
    MapboxGL.setAccessToken(MAPBOX_TOKEN)
  }
} catch (e) {
  console.warn("Mapbox not available in this environment")
}

// Blinking Marker Component
function BlinkingMarker({ coordinate, title, onPress }) {
  const blinkAnimation = useRef(new Animated.Value(1)).current
  const pulseScale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnimation, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(blinkAnimation, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    const pulse = Animated.loop(
      Animated.timing(pulseScale, { toValue: 1, duration: 1500, useNativeDriver: true })
    )
    blink.start()
    pulse.start()
    return () => {
      blink.stop()
      pulse.stop()
    }
  }, [])

  return (
    <MapboxGL.MarkerView coordinate={coordinate}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View style={styles.markerContainer}>
          <Animated.View
            style={[
              styles.pulse,
              {
                transform: [{ scale: pulseScale.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
                opacity: pulseScale.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
              },
            ]}
          />
          <Animated.View style={[styles.dot, { opacity: blinkAnimation }]} />
        </View>
      </TouchableOpacity>
    </MapboxGL.MarkerView>
  )
}

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState(null)
  const [camera, setCamera] = useState(null)
  const { nearbyEvents, fetchEvents, loading, addNewEvent } = useEventStore()
  const { connect, disconnect, newEvents, clearNewEvents } = useSocketStore()
  const router = useRouter()

  useEffect(() => {
    connect()
    getUserLocation()
    return () => disconnect()
  }, [])

  useEffect(() => {
    if (newEvents.length > 0) {
      newEvents.forEach(addNewEvent)
      if (userLocation) fetchEvents(userLocation[1], userLocation[0])
      clearNewEvents()
    }
  }, [newEvents, userLocation])

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        console.warn("Location permission denied")
        return
      }

      // Faster acquisition with timeout
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
      ]).catch(() => Location.getLastKnownPositionAsync())

      if (location) {
        const coords = [location.coords.longitude, location.coords.latitude]
        setUserLocation(coords)
        fetchEvents(coords[1], coords[0])
      }
    } catch (error) {
      console.error("Location error:", error)
    }
  }

  if (!MapboxGL) {
    return (
      <View style={styles.center}>
        <Text>Map service unavailable. Please use a development build.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map} styleURL={MapboxGL.StyleURL.Street} logoEnabled={false} attributionEnabled={false}>
        <MapboxGL.Camera
          zoomLevel={13}
          centerCoordinate={userLocation || [85.324, 27.7172]} // Default to Kathmandu
          animationMode="flyTo"
          animationDuration={2000}
        />

        {userLocation && (
          <MapboxGL.PointAnnotation id="user" coordinate={userLocation}>
            <View style={styles.userDot}>
              <View style={styles.userDotInner} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {(nearbyEvents || []).map((event) => {
          let lat, lng
          try {
            if (event.location_geojson) {
              const geo = typeof event.location_geojson === 'string' ? JSON.parse(event.location_geojson) : event.location_geojson
              lng = geo.coordinates[0]; lat = geo.coordinates[1]
            } else {
              lat = parseFloat(event.latitude); lng = parseFloat(event.longitude)
            }
            if (!lat || !lng) return null
            return (
              <BlinkingMarker
                key={event.id}
                coordinate={[lng, lat]}
                title={event.title}
                onPress={() => router.push(`/eventDetail?id=${event.id}`)}
              />
            )
          } catch (e) { return null }
        })}
      </MapboxGL.MapView>

      <TouchableOpacity style={styles.refreshButton} onPress={getUserLocation}>
        <Ionicons name="refresh" size={20} color="#fff" />
      </TouchableOpacity>

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  markerContainer: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  pulse: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: "#FF6B35" },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#FF6B35", borderWidth: 2, borderColor: "#FFF", elevation: 4 },
  userDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(33, 150, 243, 0.2)", justifyContent: "center", alignItems: "center" },
  userDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#2196F3", borderWidth: 2, borderColor: "#FFF" },
  refreshButton: { position: "absolute", bottom: 30, right: 20, backgroundColor: "#FF6B35", width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 5 },
  loader: { position: "absolute", top: 40, alignSelf: "center", backgroundColor: "#FFF", padding: 10, borderRadius: 20, elevation: 5 }
})
