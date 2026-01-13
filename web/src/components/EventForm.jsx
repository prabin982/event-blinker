import { useState } from "react"
import MapPicker from "./MapPicker"

const API_URL = import.meta.env.VITE_API_URL || "http://192.168.254.10:5000"

export default function EventForm({ onEventCreated }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "music",
    start_time: "",
    end_time: "",
    price: "",
    location_name: "",
    latitude: 27.7172,
    longitude: 85.324,
    capacity: "",
    image_url: "",
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file")
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB")
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)

    // Upload image
    setUploadingImage(true)
    setError("")
    try {
      const token = localStorage.getItem("token")
      const uploadFormData = new FormData()
      uploadFormData.append("image", file)

      const uploadResponse = await fetch(`${API_URL}/api/upload/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to upload image: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }

      const uploadData = await uploadResponse.json()
      // Construct full URL for the image
      const fullImageUrl = uploadData.imageUrl.startsWith('http') 
        ? uploadData.imageUrl 
        : `${API_URL}${uploadData.imageUrl}`
      
      setFormData((prev) => ({
        ...prev,
        image_url: fullImageUrl,
      }))
    } catch (err) {
      setError(err.message || "Failed to upload image")
      setImagePreview(null)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      latitude: location.latitude,
      longitude: location.longitude,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Validate image is uploaded
    if (!formData.image_url) {
      setError("Please upload an event image")
      setLoading(false)
      return
    }

    // Validate location is selected
    if (!formData.latitude || !formData.longitude) {
      setError("Please select a location on the map")
      setLoading(false)
      return
    }

    try {
      const token = localStorage.getItem("token")

      const response = await fetch(`${API_URL}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to create event")
      }

      alert("Event created successfully!")
      onEventCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8">
      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Event Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Kathmandu Music Festival"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Category *</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="music">Music</option>
            <option value="sports">Sports</option>
            <option value="food">Food & Festival</option>
            <option value="arts">Arts & Culture</option>
            <option value="tech">Technology</option>
            <option value="religious">Religious</option>
            <option value="community">Community</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Start Date & Time *</label>
          <input
            type="datetime-local"
            name="start_time"
            value={formData.start_time}
            onChange={handleChange}
            required
            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">End Date & Time *</label>
          <input
            type="datetime-local"
            name="end_time"
            value={formData.end_time}
            onChange={handleChange}
            required
            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Event Location *</label>
          <div className="space-y-2">
            <input
              type="text"
              name="location_name"
              value={formData.location_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Kathmandu, Nepal"
            />
            <button
              type="button"
              onClick={() => setShowMapPicker(!showMapPicker)}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              {showMapPicker ? "Hide Map" : "Select Location on Map"}
            </button>
            {showMapPicker && (
              <div className="mt-2">
                <MapPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onLocationSelect={handleLocationSelect}
                  height="400px"
                />
                {formData.latitude && formData.longitude && (
                  <p className="mt-2 text-sm text-gray-600">
                    Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Price (NPR)</label>
          <input
            type="number"
            step="0.01"
            name="price"
            value={formData.price}
            onChange={handleChange}
            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="0 for free"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Capacity</label>
          <input
            type="number"
            name="capacity"
            value={formData.capacity}
            onChange={handleChange}
            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Max attendees"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Event Image *</label>
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={uploadingImage}
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
              />
              {uploadingImage && (
                <p className="mt-2 text-sm text-gray-600">Uploading image...</p>
              )}
            </div>
            {imagePreview && (
              <div className="mt-4">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-full h-48 object-cover rounded-lg border border-gray-300"
                  onError={(e) => {
                    e.target.onerror = null
                    setError("Failed to display image preview")
                  }}
                />
                {formData.image_url && (
                  <p className="mt-2 text-sm text-green-600">✓ Image uploaded successfully</p>
                )}
              </div>
            )}
            {formData.image_url && !imagePreview && (
              <div className="mt-4">
                <img
                  src={formData.image_url}
                  alt="Event"
                  className="max-w-full h-48 object-cover rounded-lg border border-gray-300"
                  onError={(e) => {
                    e.target.onerror = null
                    setError("Failed to load image. Please try uploading again.")
                    setFormData((prev) => ({ ...prev, image_url: "" }))
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700">Description *</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          rows="4"
            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          placeholder="Describe your event..."
        />
      </div>

      <div className="mt-8 flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-red-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-red-700 hover:to-blue-700 disabled:opacity-50 shadow-lg"
        >
          {loading ? "Creating..." : "Create Event"}
        </button>
      </div>
    </form>
  )
}
