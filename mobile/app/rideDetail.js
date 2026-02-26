"use client"

import { useState, useEffect } from "react"
import {
    View,
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Image,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "../lib/authStore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://event-blinker.onrender.com/api"
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || ''

// Try to import Mapbox, but handle if native code isn't available
let MapboxGL = null
let MAPBOX_AVAILABLE = false

try {
    MapboxGL = require('@rnmapbox/maps').default
    if (MAPBOX_TOKEN && MapboxGL) {
        MapboxGL.setAccessToken(MAPBOX_TOKEN)
        MAPBOX_AVAILABLE = true
    }
} catch (error) {
    console.warn('Mapbox native code not available. Map features disabled.')
    MAPBOX_AVAILABLE = false
}

export default function RideDetailScreen() {
    const { id } = useLocalSearchParams()
    const router = useRouter()
    const [ride, setRide] = useState(null)
    const [loading, setLoading] = useState(true)
    const user = useAuthStore((state) => state.user)

    useEffect(() => {
        if (id) {
            loadRideDetails()
        }
    }, [id])

    const loadRideDetails = async () => {
        try {
            setLoading(true)
            const token = await AsyncStorage.getItem("token")
            const response = await axios.get(`${API_URL}/rides/request/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            setRide(response.data)
        } catch (error) {
            console.error("Error loading ride:", error)
            Alert.alert("Error", "Failed to load ride details")
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = async () => {
        try {
            setLoading(true)
            const token = await AsyncStorage.getItem("token")
            await axios.post(
                `${API_URL}/rides/request/${id}/cancel`,
                { reason: "User cancelled" },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            Alert.alert("Success", "Ride cancelled")
            loadRideDetails()
        } catch (error) {
            Alert.alert("Error", error.response?.data?.error || "Failed to cancel ride")
        } finally {
            setLoading(false)
        }
    }

    const handleCall = (phoneNumber) => {
        if (!phoneNumber) {
            Alert.alert("Error", "Phone number not available")
            return
        }
        Linking.openURL(`tel:${phoneNumber}`)
    }

    const handleNavigateTo = (lat, lng, label) => {
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' })
        const latLng = `${lat},${lng}`
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        })
        const googleUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

        Alert.alert(
            "Navigate",
            "Choose a maps application:",
            [
                { text: "Google Maps", onPress: () => Linking.openURL(googleUrl) },
                { text: "Default Maps", onPress: () => Linking.openURL(url) },
                { text: "Cancel", style: "cancel" }
            ]
        )
    }

    const handleStart = async () => {
        try {
            setLoading(true)
            const token = await AsyncStorage.getItem("token")
            await axios.post(`${API_URL}/rides/request/${id}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            })
            Alert.alert("Ride Started", "You are now on your way to the destination.")
            loadRideDetails()
        } catch (error) {
            Alert.alert("Error", error.response?.data?.error || "Failed to start ride")
        } finally {
            setLoading(false)
        }
    }

    const handleComplete = async () => {
        try {
            setLoading(true)
            const token = await AsyncStorage.getItem("token")
            await axios.post(`${API_URL}/rides/request/${id}/complete`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            })
            Alert.alert("Ride Completed", "Payment has been recorded to your earnings.")
            router.back()
        } catch (error) {
            Alert.alert("Error", error.response?.data?.error || "Failed to complete ride")
        } finally {
            setLoading(false)
        }
    }

    const isRider = ride?.rider_id && ride?.rider_profile_id === ride?.rider_id && user?.id !== ride?.user_id
    // Simple check: if I'm NOT the user who requested, and there IS a rider assigned, am I that rider?
    // Actually, backend returns rider_profile_id. If current user's rider profile matches this, then I'm the rider.
    const isCurrentUserRider = ride?.rider_phone_number && ride?.rider_phone_number === user?.phone

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6B35" />
            </View>
        )
    }

    if (!ride) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Ride not found</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        )
    }

    // Prepare route line feature
    const routeFeature = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: [
                [ride.pickup_lng, ride.pickup_lat],
                [ride.dropoff_lng, ride.dropoff_lat]
            ]
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="chevron-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ride Details</Text>
                <View style={styles.headerButton} />
            </View>

            <View style={styles.mapContainer}>
                {!MAPBOX_AVAILABLE ? (
                    <View style={styles.mapFallback}>
                        <Image
                            source={{ uri: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s-a+4CAF50(${ride.pickup_lng},${ride.pickup_lat}),pin-s-b+FF6B35(${ride.dropoff_lng},${ride.dropoff_lat})/auto/600x300@2x?access_token=${MAPBOX_TOKEN}&padding=50,50,50,50` }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                        />
                        <View style={styles.mapBadge}>
                            <Text style={styles.mapBadgeText}>Live Map Preview</Text>
                        </View>
                    </View>
                ) : (
                    <MapboxGL.MapView style={styles.map}>
                        <MapboxGL.Camera
                            defaultSettings={{
                                centerCoordinate: [ride.pickup_lng, ride.pickup_lat],
                                zoomLevel: 11
                            }}
                            bounds={{
                                ne: [Math.max(ride.pickup_lng, ride.dropoff_lng), Math.max(ride.pickup_lat, ride.dropoff_lat)],
                                sw: [Math.min(ride.pickup_lng, ride.dropoff_lng), Math.min(ride.pickup_lat, ride.dropoff_lat)],
                                paddingTop: 50,
                                paddingBottom: 50,
                                paddingLeft: 50,
                                paddingRight: 50
                            }}
                        />

                        {/* Pickup Marker */}
                        <MapboxGL.PointAnnotation id="pickup" coordinate={[ride.pickup_lng, ride.pickup_lat]}>
                            <View style={[styles.marker, { backgroundColor: '#4CAF50' }]}>
                                <Ionicons name="location" size={16} color="white" />
                            </View>
                        </MapboxGL.PointAnnotation>

                        {/* Dropoff Marker */}
                        <MapboxGL.PointAnnotation id="dropoff" coordinate={[ride.dropoff_lng, ride.dropoff_lat]}>
                            <View style={[styles.marker, { backgroundColor: '#FF6B35' }]}>
                                <Ionicons name="flag" size={16} color="white" />
                            </View>
                        </MapboxGL.PointAnnotation>

                        {/* Route Line (Straight line for now, real routing would need API) */}
                        <MapboxGL.ShapeSource id="routeSource" shape={routeFeature}>
                            <MapboxGL.LineLayer id="routeFill" style={{ lineColor: '#FF6B35', lineWidth: 3, lineDasharray: [2, 2] }} />
                        </MapboxGL.ShapeSource>
                    </MapboxGL.MapView>
                )}
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.statusCard}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <Text style={[
                        styles.statusValue,
                        ride.status === 'completed' ? styles.statusSuccess :
                            (ride.status === 'cancelled' || ride.status === 'passenger_cancelled' || ride.status === 'rider_cancelled') ? styles.statusError : styles.statusPending
                    ]}>
                        {ride.status.replace('_', ' ').toUpperCase()}
                    </Text>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.row}>
                        <Ionicons name="location" size={20} color="#4CAF50" style={styles.icon} />
                        <View>
                            <Text style={styles.label}>Pickup</Text>
                            <Text style={styles.value}>{ride.pickup_address}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <Ionicons name="flag" size={20} color="#FF6B35" style={styles.icon} />
                        <View>
                            <Text style={styles.label}>Dropoff</Text>
                            <Text style={styles.value}>{ride.dropoff_address}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.row}>
                        <Ionicons name="cash" size={20} color="#333" style={styles.icon} />
                        <View>
                            <Text style={styles.label}>Price</Text>
                            <Text style={styles.value}>NPR {ride.requested_price || ride.estimated_price}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <Ionicons name="speedometer" size={20} color="#333" style={styles.icon} />
                        <View>
                            <Text style={styles.label}>Distance</Text>
                            <Text style={styles.value}>{ride.distance_km} km</Text>
                        </View>
                    </View>
                </View>

                {!isCurrentUserRider && ride.rider_id && (
                    <View style={styles.infoCard}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.cardTitle}>Rider Info</Text>
                            <Image
                                source={ride.rider_photo ? { uri: ride.rider_photo } : { uri: "https://via.placeholder.com/100" }}
                                style={styles.avatarLarge}
                            />
                        </View>

                        <View style={styles.row}>
                            <Ionicons name="person" size={20} color="#333" style={styles.icon} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Name</Text>
                                <Text style={styles.value}>{ride.rider_name || "Unknown"}</Text>
                            </View>
                        </View>

                        {ride.model && (
                            <View style={styles.row}>
                                <Ionicons name="car" size={20} color="#333" style={styles.icon} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Vehicle</Text>
                                    <Text style={styles.value}>{ride.color} {ride.make} {ride.model}</Text>
                                    <Text style={[styles.subValue, { color: '#FF6B35', fontWeight: 'bold', fontSize: 13 }]}>{ride.license_plate}</Text>
                                </View>
                            </View>
                        )}
                        <TouchableOpacity style={styles.callRow} onPress={() => handleCall(ride.rider_phone_number || ride.rider_phone)}>
                            <Ionicons name="call" size={20} color="#4CAF50" style={styles.icon} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Phone (Tap to Call)</Text>
                                <Text style={[styles.value, { color: '#4CAF50' }]}>{ride.rider_phone_number || ride.rider_phone || "Contact via App"}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#CCC" />
                        </TouchableOpacity>
                    </View>
                )}

                {isCurrentUserRider && (
                    <View style={styles.infoCard}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.cardTitle}>Passenger Info</Text>
                            <Image
                                source={ride.passenger_photo ? { uri: ride.passenger_photo } : { uri: "https://via.placeholder.com/100" }}
                                style={styles.avatarLarge}
                            />
                        </View>
                        <View style={styles.row}>
                            <Ionicons name="person" size={20} color="#333" style={styles.icon} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Name</Text>
                                <Text style={styles.value}>{ride.user_name || "Passenger"}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.callRow} onPress={() => handleCall(ride.passenger_phone || ride.user_phone)}>
                            <Ionicons name="call" size={20} color="#4CAF50" style={styles.icon} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Phone (Tap to Call)</Text>
                                <Text style={[styles.value, { color: '#4CAF50' }]}>{ride.passenger_phone || ride.user_phone}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#CCC" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Actions */}
                {!isCurrentUserRider && (ride.status === 'pending' || ride.status === 'accepted') && (
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={loading}>
                        <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                    </TouchableOpacity>
                )}

                {isCurrentUserRider && ride.status === 'accepted' && (
                    <View style={styles.riderActions}>
                        <TouchableOpacity
                            style={styles.navigateBtn}
                            onPress={() => handleNavigateTo(ride.pickup_lat, ride.pickup_lng, "Pickup Location")}
                        >
                            <Ionicons name="navigate-outline" size={20} color="#FFF" />
                            <Text style={styles.navigateBtnText}>NAVIGATE TO PICKUP</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.primaryButton} onPress={handleStart} disabled={loading}>
                            <Text style={styles.primaryButtonText}>START RIDE</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={loading}>
                            <Text style={styles.cancelButtonText}>Cancel (Can't make it)</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isCurrentUserRider && (ride.status === 'started' || ride.status === 'in_progress') && (
                    <View style={styles.riderActions}>
                        <TouchableOpacity
                            style={styles.navigateBtn}
                            onPress={() => handleNavigateTo(ride.dropoff_lat, ride.dropoff_lng, "Destination")}
                        >
                            <Ionicons name="location-outline" size={20} color="#FFF" />
                            <Text style={styles.navigateBtnText}>NAVIGATE TO DROPOFF</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.completeButton} onPress={handleComplete} disabled={loading}>
                            <Text style={styles.completeButtonText}>MARK AS COMPLETED</Text>
                        </TouchableOpacity>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f5f5f5" },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "white" },
    headerTitle: { fontSize: 18, fontWeight: "bold" },
    headerButton: { width: 40 },
    errorContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    errorText: { fontSize: 16, marginBottom: 16 },
    backButton: { padding: 10, backgroundColor: "#FF6B35", borderRadius: 5 },
    backButtonText: { color: "white" },
    mapContainer: { height: 250, width: '100%' },
    map: { flex: 1 },
    content: { flex: 1, padding: 16 },
    statusCard: { backgroundColor: "white", padding: 16, borderRadius: 10, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusLabel: { fontSize: 16, color: '#666' },
    statusValue: { fontSize: 16, fontWeight: 'bold' },
    statusSuccess: { color: '#4CAF50' },
    statusError: { color: '#F44336' },
    statusPending: { color: '#FF9800' },
    infoCard: { backgroundColor: "white", padding: 16, borderRadius: 10, marginBottom: 16 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    icon: { marginRight: 16, width: 24 },
    label: { fontSize: 12, color: '#999' },
    value: { fontSize: 16, color: '#333', fontWeight: '500' },
    subValue: { fontSize: 14, color: '#666' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 4 },
    marker: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
    cancelButton: { backgroundColor: '#FFEBEE', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 32 },
    cancelButtonText: { color: '#D32F2F', fontWeight: 'bold', fontSize: 16 },
    primaryButton: { backgroundColor: '#FF6B35', padding: 18, borderRadius: 15, alignItems: 'center', marginBottom: 10, shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    primaryButtonText: { color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    completeButton: { backgroundColor: '#4CAF50', padding: 18, borderRadius: 15, alignItems: 'center', marginBottom: 32, shadowColor: '#4CAF50', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    completeButtonText: { color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    mapFallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        overflow: 'hidden'
    },
    mapBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12
    },
    mapBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    },
    callRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#F1F8E9',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginTop: 8
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15
    },
    avatarLarge: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#EEE',
        borderWidth: 2,
        borderColor: '#FF6B35'
    },
    navigateBtn: {
        flexDirection: 'row',
        backgroundColor: '#1A73E8',
        padding: 16,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        gap: 10
    },
    navigateBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    }
})
