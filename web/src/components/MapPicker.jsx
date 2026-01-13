import { useState, useCallback, useRef } from "react"
import Map, { Marker, NavigationControl } from "react-map-gl"
import "mapbox-gl/dist/mapbox-gl.css"

// Get Mapbox token from environment or use a public demo token
// For production, get your own free token from https://account.mapbox.com/
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw"

// Check if token is valid (basic validation)
const isValidToken = MAPBOX_TOKEN && MAPBOX_TOKEN.length > 20

export default function MapPicker({ latitude, longitude, onLocationSelect, height = "400px" }) {
  const [viewState, setViewState] = useState({
    longitude: longitude || 85.324,
    latitude: latitude || 27.7172,
    zoom: 13,
  })

  const [selectedLocation, setSelectedLocation] = useState(
    latitude && longitude ? { latitude, longitude } : null
  )

  const mapRef = useRef(null)

  const handleMapClick = useCallback(
    (event) => {
      const { lng, lat } = event.lngLat
      const location = { latitude: lat, longitude: lng }
      setSelectedLocation(location)
      if (onLocationSelect) {
        onLocationSelect(location)
      }
    },
    [onLocationSelect]
  )

  const handleMarkerDrag = useCallback(
    (event) => {
      const { lng, lat } = event.lngLat
      const location = { latitude: lat, longitude: lng }
      setSelectedLocation(location)
      if (onLocationSelect) {
        onLocationSelect(location)
      }
    },
    [onLocationSelect]
  )

  if (!isValidToken) {
    return (
      <div className="w-full rounded-lg overflow-hidden border border-gray-300 bg-gray-100" style={{ height }}>
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Map Loading Issue</h3>
          <p className="text-sm text-gray-600 mb-4">
            Map tiles require a valid Mapbox token. The location marker is working (coordinates shown below).
          </p>
          <div className="bg-white p-4 rounded-lg border border-gray-300 mb-4">
            <p className="text-xs text-gray-500 mb-2">Current Coordinates:</p>
            <p className="text-sm font-mono text-gray-800">
              {selectedLocation 
                ? `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
                : `${viewState.latitude.toFixed(6)}, ${viewState.longitude.toFixed(6)}`}
            </p>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>✅ Location selection is working</p>
            <p>⚠️ Map tiles need Mapbox token</p>
            <p className="mt-3">
              <a 
                href="https://account.mapbox.com/access-tokens/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Get free Mapbox token →
              </a>
            </p>
            <p className="text-xs mt-2">
              Or create <code className="bg-gray-200 px-1 rounded">web/.env</code> with:<br/>
              <code className="bg-gray-200 px-1 rounded">VITE_MAPBOX_TOKEN=your_token_here</code>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg overflow-hidden border border-gray-300" style={{ height }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        <NavigationControl position="top-right" />
        {selectedLocation && (
          <Marker
            longitude={selectedLocation.longitude}
            latitude={selectedLocation.latitude}
            draggable
            onDrag={handleMarkerDrag}
            anchor="bottom"
          >
            <div className="relative">
              <div className="w-8 h-8 bg-red-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-600"></div>
            </div>
          </Marker>
        )}
      </Map>
      <div className="bg-white p-3 border-t border-gray-300">
        <p className="text-sm text-gray-600">
          {selectedLocation
            ? `Selected: ${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
            : "Click on the map to select event location"}
        </p>
      </div>
    </div>
  )
}
