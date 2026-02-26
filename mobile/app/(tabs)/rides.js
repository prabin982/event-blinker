"use client"

import { useState, useEffect } from "react"
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Image,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppState } from 'react-native'
import { useRouter, useNavigation } from "expo-router"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { useAuthStore } from "../../lib/authStore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"
import { LinearGradient } from "expo-linear-gradient"
import * as Location from 'expo-location'

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://event-blinker.onrender.com/api"
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || ""

export default function RidesScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState("book") // 'book' or 'rider'
  const [mode, setMode] = useState("passenger") // 'passenger' or 'rider'
  const [loading, setLoading] = useState(false)
  const [riderProfile, setRiderProfile] = useState(null)
  const [myRides, setMyRides] = useState([])

  useEffect(() => {
    if (user) {
      checkRiderStatus()
      loadMyRides()
    }
  }, [user])

  const checkRiderStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      const response = await axios.get(`${API_URL}/rides/rider/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setRiderProfile(response.data)
    } catch (error) {
      setRiderProfile(null)
    }
  }

  const loadMyRides = async () => {
    try {
      setLoading(true)
      const token = await AsyncStorage.getItem("token")
      if (!token) {
        setMyRides([])
        return
      }
      const response = await axios.get(`${API_URL}/rides/my-rides`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setMyRides(response.data.rides || [])
    } catch (error) {
      console.error("Load rides error:", error)
      setMyRides([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>{mode === "rider" ? "Rider Portal" : "Ride Sharing"}</Text>
          {riderProfile?.registration_status === "approved" && (
            <TouchableOpacity
              style={[styles.modeToggle, mode === "rider" && styles.modeToggleRider]}
              onPress={() => setMode(mode === "passenger" ? "rider" : "passenger")}
            >
              <Ionicons name={mode === "rider" ? "person-outline" : "car-outline"} size={16} color="#FFF" />
              <Text style={styles.modeToggleText}>Switch to {mode === "rider" ? "Passenger" : "Rider"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {mode === "passenger" ? (
        <>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "book" && styles.activeTab]}
              onPress={() => setActiveTab("book")}
            >
              <Text style={[styles.tabText, activeTab === "book" && styles.activeTabText]}>Book Ride</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "rider" && styles.activeTab]}
              onPress={() => setActiveTab("rider")}
            >
              <Text style={[styles.tabText, activeTab === "rider" && styles.activeTabText]}>Become Rider</Text>
            </TouchableOpacity>
          </View>

          {activeTab === "book" ? (
            <BookRideView router={router} user={user} myRides={myRides} onRefresh={loadMyRides} loading={loading} />
          ) : (
            <RiderRegistrationView
              router={router}
              user={user}
              riderProfile={riderProfile}
              onRegistrationComplete={checkRiderStatus}
            />
          )}
        </>
      ) : (
        <RiderPortalView
          router={router}
          user={user}
          riderProfile={riderProfile}
          onUpdateProfile={checkRiderStatus}
        />
      )}
    </SafeAreaView>
  )
}

function RiderPortalView({ router, user, riderProfile, onUpdateProfile }) {
  const [isOnline, setIsOnline] = useState(riderProfile?.is_online || false)
  const [requests, setRequests] = useState([])
  const [earnings, setEarnings] = useState({ today: 0, this_week: 0, total: 0, completed_count: 0 })
  const [activeSegment, setActiveSegment] = useState("requests") // 'requests' or 'history'
  const [history, setHistory] = useState([])
  const [activeRides, setActiveRides] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchEarnings()
    fetchActiveRides()
    if (activeSegment === "requests") {
      fetchNearbyRequests()
    } else {
      fetchHistory()
    }
  }, [activeSegment])

  const fetchActiveRides = async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      const response = await axios.get(`${API_URL}/rides/rider/active`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setActiveRides(response.data.rides || [])
    } catch (error) {
      console.error("Fetch active rides error:", error)
    }
  }

  const fetchEarnings = async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      const response = await axios.get(`${API_URL}/rides/rider/earnings`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setEarnings(response.data)
    } catch (error) {
      console.error("Fetch earnings error:", error)
    }
  }

  const fetchHistory = async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      const response = await axios.get(`${API_URL}/rides/rider/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setHistory(response.data.history || [])
    } catch (error) {
      console.error("Fetch history error:", error)
    }
  }

  const toggleStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("token")
      const newStatus = !isOnline

      let loc = null
      if (newStatus) {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const l = await Location.getCurrentPositionAsync({})
          loc = { latitude: l.coords.latitude, longitude: l.coords.longitude }
        }
      }

      await axios.put(`${API_URL}/rides/rider/status`, {
        is_online: newStatus,
        current_location: loc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setIsOnline(newStatus)
      if (newStatus) {
        fetchNearbyRequests()
        fetchActiveRides()
      }
    } catch (error) {
      console.error("Update status error:", error.response?.data || error.message)
      Alert.alert("Error", error.response?.data?.error || "Failed to update status")
    }
  }

  const fetchNearbyRequests = async () => {
    try {
      const token = await AsyncStorage.getItem("token")

      // Get current location for accuracy
      const { status } = await Location.requestForegroundPermissionsAsync()
      let lat = 27.7172, lng = 85.3240 // Defaults

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({})
        lat = loc.coords.latitude
        lng = loc.coords.longitude
      }

      const response = await axios.get(`${API_URL}/rides/requests/nearby?latitude=${lat}&longitude=${lng}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRequests(response.data.requests || [])
    } catch (error) {
      console.error("Fetch requests error:", error)
    }
  }

  const handleAccept = async (rideId) => {
    try {
      setLoading(true)
      const token = await AsyncStorage.getItem("token")
      await axios.post(`${API_URL}/rides/request/${rideId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      Alert.alert("Ride Accepted!", "Go to the pickup location now.")
      router.push(`/rideDetail?id=${rideId}`)
      fetchNearbyRequests()
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Failed to accept ride")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.riderHero}>
        <LinearGradient colors={["#4CAF50", "#2E7D32"]} style={styles.riderHeroBg} />
        <View style={styles.riderControls}>
          <View>
            <Text style={styles.heroGreeting}>Hello, {user?.name?.split(' ')[0]}!</Text>
            <Text style={styles.heroStatusText}>Status: {isOnline ? "Looking for passengers" : "Currently offline"}</Text>
          </View>
          <TouchableOpacity
            style={[styles.statusToggle, isOnline ? styles.statusOnline : styles.statusOffline]}
            onPress={toggleStatus}
          >
            <Text style={styles.statusToggleText}>{isOnline ? "GO OFFLINE" : "GO ONLINE"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <MaterialCommunityIcons name="check-circle" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={styles.statVal}>{earnings.completed_count || 0}</Text>
            <Text style={styles.statLab}>Rides</Text>
          </View>
          <View style={[styles.statBox, styles.statBorder]}>
            <MaterialCommunityIcons name="currency-usd" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={styles.statVal}>NPR {earnings.today || 0}</Text>
            <Text style={styles.statLab}>Today</Text>
          </View>
          <View style={styles.statBox}>
            <MaterialCommunityIcons name="trending-up" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={styles.statVal}>NPR {earnings.this_week || 0}</Text>
            <Text style={styles.statLab}>Weekly</Text>
          </View>
        </View>
      </View>

      <View style={styles.segmentPicker}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "requests" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("requests")}
        >
          <Text style={[styles.segmentText, activeSegment === "requests" && styles.segmentTextActive]}>Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "history" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("history")}
        >
          <Text style={[styles.segmentText, activeSegment === "history" && styles.segmentTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {activeRides.length > 0 && activeSegment === "requests" && (
        <View style={styles.activeSection}>
          <Text style={styles.sectionTitle}>Current Assignments</Text>
          {activeRides.map(ride => (
            <TouchableOpacity
              key={ride.id}
              style={styles.activeCard}
              onPress={() => router.push(`/rideDetail?id=${ride.id}`)}
            >
              <LinearGradient colors={['#FF6B35', '#E55E2B']} style={styles.activeCardBg} />
              <View style={styles.activeCardContent}>
                <View style={styles.activeCardHeader}>
                  <View style={styles.activePassenger}>
                    {ride.passenger_photo ? (
                      <Image source={{ uri: ride.passenger_photo }} style={styles.avatarSmall} />
                    ) : (
                      <Ionicons name="person-circle" size={30} color="#FFF" />
                    )}
                    <View>
                      <Text style={styles.activePassengerName}>{ride.passenger_name}</Text>
                      <Text style={styles.activeStatus}>{ride.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FFF" />
                </View>
                <View style={styles.activeCardPath}>
                  <Text style={styles.activePathText} numberOfLines={1}>To: {ride.dropoff_address}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.requestSection}>
        {activeSegment === "requests" ? (
          <>
            <View style={styles.requestHeader}>
              <Text style={styles.sectionTitle}>Nearest Requests</Text>
              {isOnline && <ActivityIndicator color="#FF6B35" size="small" />}
            </View>

            {!isOnline ? (
              <View style={styles.offlinePlaceholder}>
                <Ionicons name="cloud-offline-outline" size={60} color="#CCC" />
                <Text style={styles.placeholderText}>You are currently offline</Text>
                <Text style={styles.placeholderSubText}>Go online to see ride requests in your area.</Text>
              </View>
            ) : requests.length === 0 ? (
              <View style={styles.emptyRequests}>
                <Ionicons name="map-outline" size={50} color="#EEE" />
                <Text style={styles.placeholderSubText}>Searching for rides nearby...</Text>
              </View>
            ) : (
              requests.map(req => (
                <View key={req.id} style={styles.reqCard}>
                  <View style={styles.reqCardHead}>
                    <View style={styles.passengerInfo}>
                      {req.avatar ? (
                        <Image source={{ uri: req.avatar }} style={styles.avatarMiniImg} />
                      ) : (
                        <View style={styles.avatarMini}><Text style={styles.avatarTxt}>{req.name?.[0]}</Text></View>
                      )}
                      <View>
                        <Text style={styles.passengerName}>{req.name}</Text>
                        <View style={styles.reqMetaRow}>
                          <MaterialCommunityIcons
                            name={req.vehicle_type === 'motorcycle' ? 'motorbike' : 'car'}
                            size={14}
                            color="#999"
                          />
                          <Text style={styles.reqDistance}>{req.distance_km} km • {req.vehicle_type?.toUpperCase() || 'SEDAN'}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.reqPrice}>NPR {req.estimated_price}</Text>
                  </View>

                  <View style={styles.pathLine}>
                    <View style={styles.dotPickup} />
                    <View style={styles.connector} />
                    <View style={styles.dotDropoff} />
                    <View style={styles.pathTexts}>
                      <Text style={styles.pathAddr} numberOfLines={1}>{req.pickup_address}</Text>
                      <Text style={styles.pathAddr} numberOfLines={1}>{req.dropoff_address}</Text>
                    </View>
                  </View>

                  <View style={styles.reqActions}>
                    <TouchableOpacity
                      style={styles.btnAccept}
                      onPress={() => handleAccept(req.id)}
                      disabled={loading}
                    >
                      <Text style={styles.btnAcceptText}>ACCEPT RIDE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.requestHeader}>
              <Text style={styles.sectionTitle}>Ride History</Text>
              <TouchableOpacity onPress={fetchHistory}>
                <Ionicons name="refresh" size={18} color="#FF6B35" />
              </TouchableOpacity>
            </View>

            {history.length === 0 ? (
              <Text style={styles.emptyText}>No rides completed yet</Text>
            ) : (
              history.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  onPress={() => router.push(`/rideDetail?id=${item.id}`)}
                >
                  <View style={styles.historyRow}>
                    <View>
                      <Text style={styles.historyName}>{item.passenger_name}</Text>
                      <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[styles.historyStatus, styles[`status${item.status}`]]}>{item.status.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.historyPrice}>NPR {item.requested_price || item.estimated_price}</Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}

function BookRideView({ router, user, myRides, onRefresh, loading }) {
  const navigation = useNavigation()
  const [pickupAddress, setPickupAddress] = useState("")
  const [dropoffAddress, setDropoffAddress] = useState("")
  const [pickupLocation, setPickupLocation] = useState(null)
  const [dropoffLocation, setDropoffLocation] = useState(null)
  const [requesting, setRequesting] = useState(false)
  const [vehicleType, setVehicleType] = useState("sedan")
  const [estimatedPrice, setEstimatedPrice] = useState(0)
  const [distance, setDistance] = useState(0)

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      checkMapResult()
    })

    // Auto-detect location if pickup is empty
    if (!pickupLocation) {
      trySetCurrentLocation()
    }

    return unsubscribe
  }, [navigation])

  const trySetCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      const loc = await Location.getCurrentPositionAsync({})
      if (!pickupLocation) {
        setPickupLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        })
        setPickupAddress("Current Location")
      }
    } catch (e) {
      console.log("Auto-location error:", e)
    }
  }

  const checkMapResult = async () => {
    try {
      const json = await AsyncStorage.getItem('ride_map_picker_result')
      if (json) {
        const obj = JSON.parse(json)
        if (obj.type === 'pickup') {
          setPickupAddress(obj.address || '')
          setPickupLocation(obj.location || null)
        } else if (obj.type === 'dropoff') {
          setDropoffAddress(obj.address || '')
          setDropoffLocation(obj.location || null)
        }
        await AsyncStorage.removeItem('ride_map_picker_result')
      }
    } catch (e) {
      console.error("Map result error:", e)
    }
  }

  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      calculateEstimate()
    }
  }, [pickupLocation, dropoffLocation, vehicleType])

  const calculateEstimate = () => {
    const R = 6371
    const dLat = (dropoffLocation.latitude - pickupLocation.latitude) * Math.PI / 180
    const dLon = (dropoffLocation.longitude - pickupLocation.longitude) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(pickupLocation.latitude * Math.PI / 180) * Math.cos(dropoffLocation.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const dist = Math.round(R * c * 100) / 100
    setDistance(dist)

    const baseRates = { motorcycle: 15, sedan: 25, suv: 35 }
    const rate = baseRates[vehicleType] || 25
    let price = 50 + dist * rate
    if (dist > 10) price *= 0.95
    setEstimatedPrice(Math.ceil(price / 5) * 5)
  }

  const getMapPreview = () => {
    if (!pickupLocation || !dropoffLocation || !MAPBOX_TOKEN) return null
    const p1 = `${pickupLocation.longitude},${pickupLocation.latitude}`
    const p2 = `${dropoffLocation.longitude},${dropoffLocation.latitude}`
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s-a+FF6B35(${p1}),pin-s-b+4CAF50(${p2})/auto/600x300@2x?access_token=${MAPBOX_TOKEN}&padding=40,40,40,40`
  }

  const handleRequestRide = async () => {
    if (!user) {
      Alert.alert("Login Required", "Please login to book a ride")
      router.push("/auth/login")
      return
    }

    if (!pickupLocation || !dropoffLocation) {
      Alert.alert("Selection Required", "Please tap on pickup and dropoff to select locations from the map.")
      return
    }

    try {
      setRequesting(true)
      const token = await AsyncStorage.getItem("token")
      await axios.post(
        `${API_URL}/rides/request`,
        {
          pickup_address: pickupAddress,
          dropoff_address: dropoffAddress,
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          vehicle_type: vehicleType,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      Alert.alert("Ride Requested", "Searching for nearby riders...")
      setPickupAddress("")
      setDropoffAddress("")
      setPickupLocation(null)
      setDropoffLocation(null)
      setEstimatedPrice(0)
      onRefresh()
    } catch (error) {
      console.error("Request ride error:", error)
      Alert.alert("Booking Failed", error.response?.data?.error || "Check your internet connection and profile details.")
    } finally {
      setRequesting(false)
    }
  }

  const vehicles = [
    { id: 'motorcycle', name: 'Moto', icon: 'motorbike', rate: 'Economical' },
    { id: 'sedan', name: 'Sedan', icon: 'car', rate: 'Comfort' },
    { id: 'suv', name: 'SUV', icon: 'car-side', rate: 'Premium' },
  ]

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.bookingCard}>
        {!user?.phone && (
          <TouchableOpacity style={styles.phoneWarning} onPress={() => router.push("/profile")}>
            <Ionicons name="alert-circle" size={18} color="#FF6B35" />
            <Text style={styles.phoneWarningText}>Add a phone number in your profile to book rides.</Text>
          </TouchableOpacity>
        )}

        {pickupLocation && dropoffLocation && (
          <View style={styles.mapPreviewContainer}>
            <Image
              source={{ uri: getMapPreview() }}
              style={styles.mapPreviewImage}
              resizeMode="cover"
            />
            <View style={styles.mapOverlay}>
              <View style={styles.distBadge}>
                <Text style={styles.distBadgeText}>{distance} km</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.locationContainer}>
          <View style={styles.locationLeft}>
            <View style={styles.dotStart} />
            <View style={styles.lineConnector} />
            <View style={styles.dotEnd} />
          </View>
          <View style={styles.locationRight}>
            <TouchableOpacity style={styles.locationItem} onPress={() => router.push("/rideMapPicker?type=pickup")}>
              <Text style={styles.locationLabel}>PICKUP LOCATION</Text>
              <Text style={[styles.locationValue, !pickupAddress && styles.locationPlaceholder]} numberOfLines={1}>
                {pickupAddress || "Enter current location"}
              </Text>
            </TouchableOpacity>
            <View style={styles.hDivider} />
            <TouchableOpacity style={styles.locationItem} onPress={() => router.push("/rideMapPicker?type=dropoff")}>
              <Text style={styles.locationLabel}>WHERE TO?</Text>
              <Text style={[styles.locationValue, !dropoffAddress && styles.locationPlaceholder]} numberOfLines={1}>
                {dropoffAddress || "Enter destination"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.subHeader}>Select Vehicle</Text>
        <View style={styles.vehicleRow}>
          {vehicles.map(v => (
            <TouchableOpacity
              key={v.id}
              style={[styles.vehicleBtn, vehicleType === v.id && styles.vehicleBtnActive]}
              onPress={() => setVehicleType(v.id)}
            >
              <MaterialCommunityIcons
                name={v.icon}
                size={34}
                color={vehicleType === v.id ? "#FF6B35" : "#666"}
              />
              <Text style={[styles.vehicleName, vehicleType === v.id && styles.vehicleNameActive]}>{v.name}</Text>
              <Text style={styles.vehicleRate}>{v.rate}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {estimatedPrice > 0 && (
          <View style={styles.estimateBox}>
            <View>
              <Text style={styles.estLabel}>ESTIMATED FARE</Text>
              <Text style={styles.estValue}>NPR {estimatedPrice}</Text>
            </View>
            <View style={styles.estMeta}>
              <Text style={styles.estMetaText}>{distance} km</Text>
              <Text style={styles.estMetaText}>~ {Math.ceil(distance * 2)} mins</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.mainBookBtn, requesting && styles.mainBookBtnDisabled]}
          onPress={handleRequestRide}
          disabled={requesting}
        >
          {requesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.mainBookBtnText}>BOOK NOW</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.myRidesSection}>
        <Text style={styles.subHeader}>Recent Journeys</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#FF6B35" style={{ marginTop: 20 }} />
        ) : myRides.length === 0 ? (
          <View style={styles.emptyRecent}>
            <Ionicons name="map-outline" size={48} color="#EEE" />
            <Text style={styles.emptyText}>No recent rides found</Text>
          </View>
        ) : (
          myRides.map((ride) => (
            <TouchableOpacity
              key={ride.id}
              style={styles.historyCard}
              onPress={() => router.push(`/rideDetail?id=${ride.id}`)}
            >
              <View style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName} numberOfLines={1}>{ride.dropoff_address}</Text>
                  <Text style={styles.historyDate}>{new Date(ride.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.historyStatus, styles[`status${ride.status}`]]}>
                    {ride.status.toUpperCase()}
                  </Text>
                  <Text style={[styles.historyPrice, { marginTop: 5 }]}>NPR {ride.requested_price || ride.estimated_price}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function RiderRegistrationView({ router, user, riderProfile, onRegistrationComplete }) {
  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <LinearGradient colors={["#FFE8DC", "#FFF"]} style={styles.promoGradient} />
        <Ionicons name="person-circle-outline" size={80} color="#FF6B35" />
        <Text style={styles.loginPromptTitle}>Join the Community</Text>
        <Text style={styles.loginPromptText}>Login to start your journey as a rider and earn for every mile.</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push("/auth/login")}>
          <Text style={styles.loginButtonText}>Login Now</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (riderProfile) {
    const status = riderProfile.registration_status
    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={[styles.statusIconContainer, status === 'approved' && styles.iconApproved]}>
            <Ionicons
              name={status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time'}
              size={60}
              color={status === 'approved' ? '#4CAF50' : status === 'rejected' ? '#F44336' : '#FF6B35'}
            />
          </View>
          <Text style={styles.statusTitle}>
            {status === 'approved' ? 'You are a Rider!' : status === 'rejected' ? 'Registration Rejected' : 'Verification Pending'}
          </Text>
          <Text style={styles.statusDescription}>
            {status === 'approved' ? 'Your account is fully verified. You can now start accepting rides and earning.' :
              status === 'rejected' ? 'Unfortunately, your application was not approved at this time.' :
                'We are currently reviewing your documents. This usually takes 24-48 hours. We will notify you once approved.'}
          </Text>

          {status === 'rejected' && riderProfile.rejection_reason && (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionReason}>Reason: {riderProfile.rejection_reason}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => router.push("/riderRegister")}>
                <Text style={styles.retryBtnText}>Re-submit Documents</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'approved' && (
            <TouchableOpacity style={styles.dashboardBtn} onPress={() => onRegistrationComplete()}>
              <Text style={styles.dashboardBtnText}>Go to Rider Portal</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Rider Benefits</Text>
          <View style={styles.benefitItem}>
            <Ionicons name="wallet-outline" size={24} color="#FF6B35" />
            <View>
              <Text style={styles.benefitTextTitle}>Weekly Payouts</Text>
              <Text style={styles.benefitTextSub}>Get your earnings directly in your bank.</Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="time-outline" size={24} color="#FF6B35" />
            <View>
              <Text style={styles.benefitTextTitle}>Flexible Hours</Text>
              <Text style={styles.benefitTextSub}>Work whenever you want, no strings attached.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.content}>
      <View style={styles.promoCard}>
        <LinearGradient colors={["#FF6B35", "#FF8C5D"]} style={styles.promoCardBg} />
        <View style={styles.promoTextContainer}>
          <Text style={styles.promoTitle}>Drive & Earn{"\n"}Money</Text>
          <Text style={styles.promoSubtitle}>Join thousands of riders and start earning today.</Text>
          <TouchableOpacity style={styles.registerStartBtn} onPress={() => router.push("/riderRegister")}>
            <Text style={styles.registerStartBtnText}>Register Now</Text>
            <Ionicons name="chevron-forward" size={14} color="#FF6B35" />
          </TouchableOpacity>
        </View>
        <Ionicons name="car-sport" size={120} color="rgba(255,255,255,0.2)" style={styles.promoIcon} />
      </View>

      <View style={styles.stepsSection}>
        <Text style={styles.stepsTitle}>How it works</Text>
        <View style={styles.stepItem}>
          <View style={styles.stepNumberContainer}><Text style={styles.stepNumber}>1</Text></View>
          <View style={styles.stepContent}>
            <Text style={styles.stepItemTitle}>Submit Documents</Text>
            <Text style={styles.stepItemDesc}>Upload your license, bluebook, and vehicle photos.</Text>
          </View>
        </View>
        <View style={styles.stepItem}>
          <View style={styles.stepNumberContainer}><Text style={styles.stepNumber}>2</Text></View>
          <View style={styles.stepContent}>
            <Text style={styles.stepItemTitle}>Wait for Approval</Text>
            <Text style={styles.stepItemDesc}>Our team will verify your information within 24 hours.</Text>
          </View>
        </View>
        <View style={styles.stepItem}>
          <View style={styles.stepNumberContainer}><Text style={styles.stepNumber}>3</Text></View>
          <View style={styles.stepContent}>
            <Text style={styles.stepItemTitle}>Start Earning</Text>
            <Text style={styles.stepItemDesc}>Once approved, go online and start accepting ride requests.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#333" },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF6B35', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  modeToggleRider: { backgroundColor: '#4CAF50' },
  modeToggleText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  tabContainer: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: "#FF6B35" },
  tabText: { fontSize: 16, color: "#999" },
  activeTabText: { color: "#FF6B35", fontWeight: "600" },
  content: { flex: 1 },
  sectionTitle: { fontSize: 20, fontWeight: "bold", color: "#333", marginBottom: 16 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  loginButton: { backgroundColor: "#FF6B35", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 16 },
  loginButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  riderHero: { margin: 16, padding: 20, borderRadius: 25, overflow: 'hidden', position: 'relative' },
  riderHeroBg: { ...StyleSheet.absoluteFillObject },
  riderControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, zIndex: 1 },
  heroGreeting: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  heroStatusText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statusToggle: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 15, backgroundColor: '#FFF' },
  statusToggleText: { fontSize: 13, fontWeight: '900', color: '#4CAF50' },
  statusOffline: { backgroundColor: '#F44336' },
  statusOnline: { backgroundColor: '#FFF' },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 15, zIndex: 1 },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statVal: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  statLab: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  requestSection: { padding: 20 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  offlinePlaceholder: { alignItems: 'center', marginTop: 40 },
  placeholderText: { fontSize: 18, fontWeight: '700', color: '#666', marginTop: 15 },
  placeholderSubText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
  emptyRequests: { alignItems: 'center', marginTop: 40, opacity: 0.5 },
  reqCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#EEE', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  reqCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  passengerInfo: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#FFF', fontWeight: '800' },
  passengerName: { fontSize: 16, fontWeight: '700', color: '#333' },
  reqMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  reqDistance: { fontSize: 11, color: '#999' },
  reqPrice: { fontSize: 18, fontWeight: '800', color: '#4CAF50' },
  pathLine: { flexDirection: 'row', marginVertical: 15, height: 45, paddingLeft: 5 },
  dotPickup: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35', position: 'absolute', top: 0 },
  dotDropoff: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', position: 'absolute', bottom: 0 },
  connector: { width: 2, height: 30, backgroundColor: '#EEE', position: 'absolute', top: 8, left: 3 },
  pathTexts: { marginLeft: 20, justifyContent: 'space-between' },
  pathAddr: { fontSize: 13, color: '#666', width: Dimensions.get('window').width * 0.7 },
  reqActions: { marginTop: 5 },
  btnAccept: { backgroundColor: '#4CAF50', paddingVertical: 14, borderRadius: 15, alignItems: 'center' },
  btnAcceptText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  segmentPicker: { flexDirection: 'row', backgroundColor: '#F0F0F0', marginHorizontal: 20, borderRadius: 15, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  segmentBtnActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#666' },
  segmentTextActive: { color: '#333', fontWeight: '800' },
  historyCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyName: { fontSize: 16, fontWeight: '700', color: '#333' },
  historyDate: { fontSize: 12, color: '#999', marginTop: 2 },
  historyStatus: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  statuscompleted: { backgroundColor: '#E8F5E9', color: '#4CAF50' },
  statuscancelled: { backgroundColor: '#FFEBEE', color: '#F44336' },
  statusin_progress: { backgroundColor: '#FFF3E0', color: '#FF9800' },
  historyPrice: { fontSize: 14, fontWeight: '800', color: '#333', marginTop: 10 },
  promoGradient: { ...StyleSheet.absoluteFillObject },
  bookingCard: { backgroundColor: '#FFF', margin: 16, borderRadius: 25, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  locationContainer: { flexDirection: 'row', backgroundColor: '#F8F9FA', borderRadius: 20, padding: 15, marginBottom: 20 },
  locationLeft: { alignItems: 'center', justifyContent: 'center', width: 20 },
  dotStart: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B35' },
  dotEnd: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50' },
  lineConnector: { width: 2, flex: 1, backgroundColor: '#DDD', marginVertical: 4 },
  locationRight: { flex: 1, marginLeft: 15 },
  locationItem: { paddingVertical: 8 },
  locationLabel: { fontSize: 10, fontWeight: '800', color: '#999', letterSpacing: 1 },
  locationValue: { fontSize: 15, fontWeight: '700', color: '#333', marginTop: 4 },
  locationPlaceholder: { color: '#BBB', fontWeight: '500' },
  hDivider: { height: 1, backgroundColor: '#EEE', marginVertical: 8 },
  subHeader: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 15 },
  vehicleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  vehicleBtn: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 20, padding: 15, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  vehicleBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF7F5' },
  vehicleName: { fontSize: 13, fontWeight: '800', color: '#666', marginTop: 8 },
  vehicleNameActive: { color: '#333' },
  vehicleRate: { fontSize: 9, color: '#999', marginTop: 2 },
  estimateBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF7F5', padding: 15, borderRadius: 15, marginBottom: 20 },
  estLabel: { fontSize: 10, fontWeight: '800', color: '#FF6B35' },
  estValue: { fontSize: 20, fontWeight: '900', color: '#333' },
  estMeta: { alignItems: 'flex-end' },
  estMetaText: { fontSize: 12, fontWeight: '700', color: '#666' },
  mainBookBtn: { backgroundColor: '#FF6B35', flexDirection: 'row', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 10, shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  mainBookBtnDisabled: { backgroundColor: '#CCC' },
  mainBookBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  mapPreviewContainer: { height: 160, marginHorizontal: -20, marginTop: -20, marginBottom: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: 'hidden', backgroundColor: '#F0F0F0' },
  mapPreviewImage: { width: '100%', height: '100%' },
  mapOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 10 },
  distBadge: { backgroundColor: '#FFF', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  distBadgeText: { fontSize: 12, fontWeight: '800', color: '#333' },
  loginPromptTitle: { fontSize: 22, fontWeight: "800", color: "#333", marginTop: 20 },
  loginPromptText: { fontSize: 14, color: "#666", textAlign: 'center', marginTop: 10, paddingHorizontal: 40 },
  statusCard: { margin: 20, padding: 30, backgroundColor: "#FFF", borderRadius: 30, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  statusIconContainer: { padding: 20, backgroundColor: "#FFF7F5", borderRadius: 40, marginBottom: 20 },
  iconApproved: { backgroundColor: "#E8F5E9" },
  statusTitle: { fontSize: 24, fontWeight: "800", color: "#333" },
  statusDescription: { fontSize: 15, color: "#666", textAlign: 'center', marginTop: 10, lineHeight: 22 },
  dashboardBtn: { flexDirection: "row", alignItems: 'center', gap: 10, backgroundColor: "#FF6B35", paddingVertical: 15, paddingHorizontal: 25, borderRadius: 20, marginTop: 25 },
  dashboardBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  rejectionBox: { marginTop: 20, alignItems: 'center' },
  rejectionReason: { color: "#F44336", fontSize: 14, fontWeight: "600", textAlign: 'center' },
  retryBtn: { marginTop: 15, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: "#FF6B35", borderRadius: 12 },
  retryBtnText: { color: "#FF6B35", fontWeight: "700" },
  benefitsSection: { padding: 20 },
  benefitsTitle: { fontSize: 18, fontWeight: "800", color: "#333", marginBottom: 15 },
  benefitItem: { flexDirection: "row", gap: 15, alignItems: 'center', marginBottom: 20, backgroundColor: "#FAFAFA", padding: 15, borderRadius: 20 },
  benefitTextTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
  benefitTextSub: { fontSize: 13, color: "#777" },
  promoCard: { margin: 16, borderRadius: 30, overflow: 'hidden', height: 200, justifyContent: 'center', padding: 25, position: 'relative' },
  promoCardBg: { ...StyleSheet.absoluteFillObject },
  promoTextContainer: { zIndex: 1, width: "70%" },
  promoTitle: { fontSize: 24, fontWeight: "800", color: "#FFF", lineHeight: 28 },
  promoSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 8 },
  registerStartBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: "#FFF", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start', marginTop: 15 },
  registerStartBtnText: { color: "#FF6B35", fontWeight: "800", fontSize: 14 },
  promoIcon: { position: 'absolute', right: -20, bottom: -10 },
  stepsSection: { padding: 16 },
  stepsTitle: { fontSize: 18, fontWeight: "800", color: "#333", marginBottom: 20, marginLeft: 10 },
  stepItem: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  stepNumberContainer: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FF6B35", justifyContent: 'center', alignItems: 'center' },
  stepNumber: { color: "#FFF", fontWeight: "800" },
  stepContent: { flex: 1 },
  stepItemTitle: { fontSize: 16, fontWeight: "800", color: "#333" },
  stepItemDesc: { fontSize: 14, color: "#777", marginTop: 4 },

  phoneWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7F5', padding: 12, borderRadius: 15, marginBottom: 15, gap: 8, borderWidth: 1, borderColor: '#FFE8DC' },
  phoneWarningText: { flex: 1, fontSize: 13, color: '#333', fontWeight: '600' },

  activeSection: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  activeCard: {
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  activeCardBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  activeCardContent: {
    padding: 15,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activePassenger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activePassengerName: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  activeStatus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  activeCardPath: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  activePathText: {
    color: '#FFF',
    fontSize: 13,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: '#FFF'
  },
  avatarMiniImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEE'
  }
})
