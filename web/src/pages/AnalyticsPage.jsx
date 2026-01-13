import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import Navigation from "../components/Navigation"

const API_URL = import.meta.env.VITE_API_URL || "http://192.168.254.10:5000"

export default function AnalyticsPage({ user, onLogout }) {
  const { id } = useParams()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [id])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("token")

      const response = await fetch(`${API_URL}/api/organizer/analytics/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
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

  if (!analytics) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation user={user} onLogout={onLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-gray-600">Analytics not found</p>
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation user={user} onLogout={onLogout} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{analytics.title}</h1>
          <p className="text-gray-600 mt-2">Event Analytics & Insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">Likes</p>
            <p className="text-3xl font-bold text-blue-600">{analytics.like_count || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">Check-ins</p>
            <p className="text-3xl font-bold text-green-600">{analytics.checkin_count || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">Current Attendance</p>
            <p className="text-3xl font-bold text-blue-600">{analytics.current_attendance || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-2">Chat Users</p>
            <p className="text-3xl font-bold text-purple-600">{analytics.unique_chat_users || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Additional Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Total Messages</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.total_messages || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

