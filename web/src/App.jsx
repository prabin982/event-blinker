import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { Provider } from "react-redux"
import store from "./redux/store"

import LoginPage from "./pages/LoginPage"
import DashboardPage from "./pages/DashboardPage"
import EventsPage from "./pages/EventsPage"
import CreateEventPage from "./pages/CreateEventPage"
import AnalyticsPage from "./pages/AnalyticsPage"
import ChatManagementPage from "./pages/ChatManagementPage"

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check if token exists
    const token = localStorage.getItem("token")
    if (token) {
      setIsAuthenticated(true)
      const storedUser = localStorage.getItem("user")
      if (storedUser) setUser(JSON.parse(storedUser))
    }
  }, [])

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUser(null)
  }

  return (
    <Provider store={store}>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" />
              ) : (
                <LoginPage setIsAuthenticated={setIsAuthenticated} setUser={setUser} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <DashboardPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route path="/events" element={isAuthenticated ? <EventsPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route
            path="/events/create"
            element={isAuthenticated ? <CreateEventPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/events/:id/analytics"
            element={isAuthenticated ? <AnalyticsPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/events/:eventId/chat"
            element={isAuthenticated ? <ChatManagementPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        </Routes>
      </Router>
    </Provider>
  )
}

export default App
