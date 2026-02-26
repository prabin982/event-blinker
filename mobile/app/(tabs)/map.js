"use client"

import { useState, useEffect, useRef } from "react"
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Animated, Platform } from "react-native"
import MapView, { Marker, Circle } from "react-native-maps"
import * as Location from "expo-location"
import { useRouter } from "expo-router"
import { useEventStore } from "../../lib/eventStore"
import { useAuthStore } from "../../lib/authStore"
import { useSocketStore } from "../../lib/socketStore"
import { Ionicons } from "@expo/vector-icons"

// Blinking Marker Component (pulsing + glow for higher attention)
function BlinkingMarker({ coordinate, title, description, onPress, eventId }) {
  const blinkAnimation = useRef(new Animated.Value(1)).current
  const pulseScale = useRef(new Animated.Value(0)).current
  const haloOpacity = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnimation, {
          toValue: 0.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    )

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    )

    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloOpacity, {
          toValue: 0.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(haloOpacity, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    )

    blinkLoop.start()
    pulseLoop.start()
    haloLoop.start()

    return () => {
      blinkLoop.stop()
      pulseLoop.stop()
      haloLoop.stop()
    }
  }, [blinkAnimation, pulseScale, haloOpacity])

  return (
    <Marker
      coordinate={coordinate}
      title={title}
      description={description}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <Animated.View
        style={{
          opacity: blinkAnimation,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* outer pulse ring */}
        <Animated.View
          style={{
            position: "absolute",
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: "#FF6B3520",
            transform: [
              {
                scale: pulseScale.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1.4],
                }),
              },
            ],
            opacity: haloOpacity,
          }}
        />
        {/* glowing center */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#FF6B35",
            borderWidth: 3,
            borderColor: "#fff",
            shadowColor: "#FF6B35",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
            elevation: 8,
          }}
        />
        {/* soft halo */}
        <View
          style={{
            position: "absolute",
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: "#FF6B3535",
          }}
        />
      </Animated.View>
    </Marker>
  )
}

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState(null)
  const [mapRef, setMapRef] = useState(null)
  const { nearbyEvents, fetchEvents, loading, events, addNewEvent } = useEventStore()
  const { user } = useAuthStore()
  const { connect, disconnect, newEvents, clearNewEvents } = useSocketStore()
  const router = useRouter()

  // Connect to socket for real-time updates
  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [])

  // Handle new events from socket
  useEffect(() => {
    if (newEvents.length > 0) {
      // Add new events to store
      newEvents.forEach((event) => {
        if (addNewEvent) {
          addNewEvent(event)
        }
      })
      // Refresh to get updated list
      if (userLocation) {
        fetchEvents(userLocation.latitude, userLocation.longitude)
      } else {
        fetchEvents(null, null)
      }
      clearNewEvents()
    }
  }, [newEvents, addNewEvent, fetchEvents, userLocation, clearNewEvents])

  useEffect(() => {
    getUserLocation()
  }, [])

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        alert("Permission to access location was denied")
        return
      }

      const location = await Location.getCurrentPositionAsync()
      const { latitude, longitude } = location.coords

      setUserLocation({ latitude, longitude })
      fetchEvents(latitude, longitude)

      if (mapRef) {
        mapRef.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        })
      }
    } catch (error) {
      console.error("Error getting location:", error)
    }
  }

  return (
    <View style={styles.container}>
      {userLocation && (
        <MapView
          ref={setMapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? undefined : undefined} // Uses default (Apple Maps on iOS, can configure for Android)
          mapType="standard"
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <Marker coordinate={userLocation} title="Your Location" pinColor="blue" />

          <Circle center={userLocation} radius={5000} strokeColor="#FF6B3540" fillColor="#FF6B3520" />

          {(nearbyEvents || []).map((event) => {
            // Parse location - handle both GeoJSON and direct coordinate formats
            let lat, lng
            try {
              if (event.location_geojson) {
                const geoJson = typeof event.location_geojson === 'string' 
                  ? JSON.parse(event.location_geojson) 
                  : event.location_geojson
                const coords = geoJson.coordinates || geoJson.coords
                lng = coords[0]
                lat = coords[1]
              } else if (event.location?.coordinates) {
                lat = event.location.coordinates[1]
                lng = event.location.coordinates[0]
              } else if (event.latitude && event.longitude) {
                lat = parseFloat(event.latitude)
                lng = parseFloat(event.longitude)
              } else {
                return null
              }

              if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                return null
              }

              return (
                <BlinkingMarker
                  key={event.id}
                  eventId={event.id}
                  coordinate={{ latitude: lat, longitude: lng }}
                  title={event.title}
                  description={event.location_name || "Event Location"}
                  onPress={() => {
                    router.push(`/eventDetail?id=${event.id}`)
                  }}
                />
              )
            } catch (error) {
              console.error("Error parsing event location:", error, event)
              return null
            }
          })}
        </MapView>
      )}

      <TouchableOpacity style={styles.refreshButton} onPress={getUserLocation}>
        <Text style={styles.refreshButtonText}>
          <Ionicons name="refresh" size={16} color="#fff" /> Refresh
        </Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    flex: 1,
  },
  refreshButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#FF6B35",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 5,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  loadingContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -30,
    marginTop: -30,
  },
})
