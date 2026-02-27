import { useState, useRef } from 'react'
import { View, TextInput, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || ''

let MapboxGL = null
try {
  MapboxGL = require('@rnmapbox/maps').default
  if (MAPBOX_TOKEN && MapboxGL) {
    MapboxGL.setAccessToken(MAPBOX_TOKEN)
  }
} catch (e) { }

export default function RideMapPicker() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const type = params.type || 'pickup'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [coordinate, setCoordinate] = useState(null) // [lng, lat]
  const [loading, setLoading] = useState(false)
  const cameraRef = useRef(null)

  const search = async (q) => {
    if (!MAPBOX_TOKEN || !q) {
      setResults([])
      return
    }
    try {
      setLoading(true)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=5`
      const res = await fetch(url)
      const data = await res.json()
      setResults(data.features || [])
    } catch (e) {
      console.error('Geocode error', e)
    } finally {
      setLoading(false)
    }
  }

  const selectResult = (feature) => {
    const coords = feature.center
    setCoordinate(coords)
    setQuery(feature.text)
    setResults([])
    cameraRef.current?.flyTo(coords, 1000)
  }

  const saveAndBack = async () => {
    const payload = {
      type,
      address: query || "Selected Location",
      location: coordinate ? { longitude: coordinate[0], latitude: coordinate[1] } : null,
    }
    await AsyncStorage.setItem('ride_map_picker_result', JSON.stringify(payload))
    router.back()
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
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
              placeholder={type === 'pickup' ? 'Search pickup...' : 'Search where to go...'}
              style={styles.input}
              placeholderTextColor="#999"
            />
            {loading && <ActivityIndicator size="small" color="#FF6B35" />}
          </View>

          {results.length > 0 && (
            <View style={styles.resultsDropdown}>
              {results.map((item) => (
                <TouchableOpacity key={item.id} style={styles.resultItem} onPress={() => selectResult(item)}>
                  <Ionicons name="location" size={18} color="#FF6B35" />
                  <Text style={styles.resultText} numberOfLines={1}>{item.place_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>

      <View style={styles.mapWrap}>
        {MapboxGL && (
          <MapboxGL.MapView
            style={styles.map}
            styleURL={MapboxGL.StyleURL.Street}
            onPress={(e) => {
              const coords = e.geometry.coordinates
              setCoordinate(coords)
              setQuery(`Point: ${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`)
            }}
          >
            <MapboxGL.Camera
              ref={cameraRef}
              zoomLevel={12}
              centerCoordinate={coordinate || [85.324, 27.7172]}
            />
            {coordinate && (
              <MapboxGL.PointAnnotation id="selection" coordinate={coordinate}>
                <View style={styles.pin}>
                  <Ionicons name="location" size={30} color="#FF6B35" />
                </View>
              </MapboxGL.PointAnnotation>
            )}
          </MapboxGL.MapView>
        )}
      </View>

      {coordinate && (
        <View style={styles.footer}>
          <Text style={styles.addressText} numberOfLines={2}>{query}</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={saveAndBack}>
            <Text style={styles.confirmText}>Confirm {type}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  safe: { zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 50 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#333' },
  searchContainer: { padding: 15 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#EEE' },
  input: { flex: 1, marginLeft: 10, fontSize: 15, color: '#333' },
  resultsDropdown: { backgroundColor: '#FFF', borderRadius: 15, marginTop: 5, elevation: 5, padding: 5 },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  resultText: { marginLeft: 10, fontSize: 13, color: '#666', flex: 1 },
  mapWrap: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  map: { flex: 1 },
  pin: { marginTop: -30 },
  footer: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 10, zIndex: 20 },
  addressText: { fontSize: 14, color: '#333', fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  confirmBtn: { backgroundColor: '#FF6B35', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  confirmText: { color: '#FFF', fontSize: 16, fontWeight: '800', textTransform: 'uppercase' }
})
