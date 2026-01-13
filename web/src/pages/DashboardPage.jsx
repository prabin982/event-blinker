import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import Navigation from "../components/Navigation"

const API_URL = import.meta.env.VITE_API_URL || "http://192.168.254.10:5000"

export default function DashboardPage({ user, onLogout }) {
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalViews: 0,
    totalLikes: 0,
    totalCheckins: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("token")

      const response = await fetch(`${API_URL}/api/organizer/my-events`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setEvents(data.slice(0, 5))

        // Calculate stats
        const totals = {
          totalEvents: data.length,
          totalViews: 0,
          totalLikes: 0,
          totalCheckins: 0,
        }

        for (const event of data) {
          // Would fetch individual analytics
          totals.totalLikes += event.like_count || 0
          totals.totalCheckins += event.current_attendance || 0
        }

        setStats(totals)
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error)
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.name}!</h1>
          <p className="text-gray-600 mt-2">Manage your events and track engagement in Nepal</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Events</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalEvents}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Likes</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalLikes}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Check-ins</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalCheckins}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Views</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalViews}</p>
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Recent Events</h2>
            <Link to="/events/create" className="bg-gradient-to-r from-red-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-red-700 hover:to-blue-700 shadow-md">
              Create Event
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Attendance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{event.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(event.start_time).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {event.current_attendance}/{event.capacity}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          event.status === "ongoing" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-3">
                        <Link to={`/events/${event.id}/analytics`} className="text-blue-600 hover:text-blue-800">
                          Analytics
                        </Link>
                        <Link to={`/events/${event.id}/chat`} className="text-green-600 hover:text-green-800">
                          Chat
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
