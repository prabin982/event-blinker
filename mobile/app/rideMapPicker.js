import { useState, useEffect } from 'react'
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, Button, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

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
  console.warn('Mapbox native code not available. Map features disabled. Use development build for full functionality.')
  MAPBOX_AVAILABLE = false
}

export default function RideMapPicker() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const type = params.type || 'pickup'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [coordinate, setCoordinate] = useState(null) // [lng, lat]

  const search = async (q) => {
    if (!MAPBOX_TOKEN) {
      console.error("Mapbox token is missing")
      setResults([])
      return
    }
    if (!q) {
      setResults([])
      return
    }
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=5`
      const res = await fetch(url)
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Mapbox API error: ${res.status} - ${errorText}`)
      }
      const data = await res.json()
      setResults(data.features || [])
    } catch (e) {
      console.error('Geocode error', e)
      setResults([])
    }
  }

  const selectResult = (feature) => {
    const [lng, lat] = feature.center
    setCoordinate([lng, lat])
    setQuery(feature.place_name)
    setResults([])
  }

  const saveAndBack = async () => {
    // Convert back to object format for compatibility with other screens if needed, 
    // or keep separate. The backend expects separate lng/lat or geojson.
    // rides.js expects: { latitude, longitude } because it was built for google maps.
    // We should convert here to match rides.js expectation
    const locationObj = coordinate ? {
      longitude: coordinate[0],
      latitude: coordinate[1]
    } : null

    const payload = {
      type,
      address: query,
      location: locationObj,
    }
    await AsyncStorage.setItem('ride_map_picker_result', JSON.stringify(payload))
    router.back()
  }

  const onMapLongPress = (feature) => {
    const coords = feature.geometry.coordinates // [lng, lat]
    setCoordinate(coords)
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFF", "#F8F9FA"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{type === 'pickup' ? 'Set Pickup' : 'Set Destination'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#FF6B35" />
            <TextInput
              value={query}
              onChangeText={(t) => { setQuery(t); search(t) }}
              placeholder={type === 'pickup' ? 'Enter pickup address' : 'Enter where to go'}
              style={styles.searchInput}
              placeholderTextColor="#999"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]) }}>
                <Ionicons name="close-circle" size={18} color="#CCC" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultItem} onPress={() => selectResult(item)}>
                <View style={[styles.resultIcon, { backgroundColor: item.place_type?.includes('poi') ? '#E3F2FD' : '#F5F5F5' }]}>
                  <Ionicons
                    name={item.place_type?.includes('poi') ? "business-outline" : "location-outline"}
                    size={20}
                    color={item.place_type?.includes('poi') ? "#2196F3" : "#666"}
                  />
                </View>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{item.text}</Text>
                  <Text style={styles.resultSubtitle} numberOfLines={2}>{item.place_name}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : !coordinate ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name={type === 'pickup' ? "navigate" : "flag"} size={40} color="#FF6B35" />
            </View>
            <Text style={styles.emptyTitle}>{type === 'pickup' ? "Start your journey" : "Where are you heading?"}</Text>
            <Text style={styles.emptyDesc}>Search for an address or business to select it as your {type}.</Text>
          </View>
        ) : null}

        {coordinate && (
          <View style={styles.selectedLocationCard}>
            <View style={styles.selectionHeader}>
              <View style={styles.selectionDot} />
              <Text style={styles.selectionLabel}>SELECTED {type.toUpperCase()}</Text>
            </View>
            <View style={styles.pickerPreviewContainer}>
              <Image
                source={{ uri: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s-l+FF6B35(${coordinate[0]},${coordinate[1]})/${coordinate[0]},${coordinate[1]},15,0/400x200@2x?access_token=${MAPBOX_TOKEN}` }}
                style={styles.pickerPreviewImage}
              />
            </View>
            <Text style={styles.selectedAddress}>{query}</Text>

            <TouchableOpacity style={styles.confirmBtn} onPress={saveAndBack}>
              <Text style={styles.confirmBtnText}>CONFIRM {type.toUpperCase()}</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: '#F5F5F5' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#333' },
  searchContainer: { padding: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 55,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EEE'
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#333', fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  resultIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  resultTextContainer: { flex: 1, marginLeft: 15 },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  resultSubtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: -50 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF7F5', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#333', textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 10, lineHeight: 20 },
  selectedLocationCard: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 25,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  selectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35', marginRight: 8 },
  selectionLabel: { fontSize: 10, fontWeight: '900', color: '#999', letterSpacing: 1 },
  selectedAddress: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 20 },
  pickerPreviewContainer: { height: 120, borderRadius: 15, overflow: 'hidden', marginBottom: 15, backgroundColor: '#EEE' },
  pickerPreviewImage: { width: '100%', height: '100%' },
  confirmBtn: {
    backgroundColor: '#FF6B35',
    height: 55,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10
  },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 }
})
