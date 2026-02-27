import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import Navigation from "../components/Navigation"

const API_URL = import.meta.env.VITE_API_URL || "https://event-blinker.onrender.com"

export default function EventsPage({ user, onLogout }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("token")

      const response = await fetch(`${API_URL}/api/organizer/my-events`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (error) {
      console.error("Error fetching events:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation user={user} onLogout={onLogout} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation user={user} onLogout={onLogout} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Events</h1>
            <p className="text-gray-600 mt-2">Manage all your events in Nepal</p>
          </div>
          <Link to="/events/create" className="bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-blue-700 font-semibold shadow-lg">
            Create New Event
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow overflow-hidden">
              {event.image_url && (
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = 'https://via.placeholder.com/400x200?text=Event+Image'
                  }}
                />
              )}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{event.description}</p>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Date:</span> {new Date(event.start_time).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Location:</span> {event.location_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Attendance:</span> {event.current_attendance}/{event.capacity}
                  </p>
                </div>
                <Link
                  to={`/events/${event.id}/analytics`}
                  className="block text-center bg-gradient-to-r from-red-600 to-blue-600 text-white py-2 rounded-lg hover:from-red-700 hover:to-blue-700 shadow-md"
                >
                  View Analytics
                </Link>
              </div>
            </div>
          ))}
        </div>

        {events.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No events yet. Create your first event!</p>
            <Link to="/events/create" className="bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-blue-700 font-semibold inline-block shadow-lg">
              Create New Event
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

