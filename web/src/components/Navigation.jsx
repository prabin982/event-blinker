import { Link, useNavigate } from "react-router-dom"

export default function Navigation({ user, onLogout }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    if (onLogout) {
      onLogout() // Update parent state
    }
    navigate("/login")
    // Force reload to clear all state
    window.location.href = "/login"
  }

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">🇳🇵</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Event Nepal</span>
            </Link>
          </div>

          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="text-gray-700 hover:text-blue-600 font-medium">
              Dashboard
            </Link>
            <Link to="/events" className="text-gray-700 hover:text-blue-600 font-medium">
              Events
            </Link>
            {user?.user_type === "organizer" && (
              <Link to="/admin/riders" className="text-gray-700 hover:text-blue-600 font-medium">
                Verify Riders
              </Link>
            )}
            <div className="flex items-center gap-4">
              <span className="text-gray-700">{user?.name}</span>
              <button onClick={handleLogout} className="bg-gradient-to-r from-red-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-red-700 hover:to-blue-700 shadow-md">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
