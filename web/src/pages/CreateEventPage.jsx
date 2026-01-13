import { useNavigate } from "react-router-dom"
import Navigation from "../components/Navigation"
import EventForm from "../components/EventForm"

export default function CreateEventPage({ user, onLogout }) {
  const navigate = useNavigate()

  const handleEventCreated = () => {
    navigate("/dashboard")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation user={user} onLogout={onLogout} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Event</h1>
          <p className="text-gray-600 mt-2">Fill in the details to create and publish your event in Nepal</p>
        </div>

        <EventForm onEventCreated={handleEventCreated} />
      </div>
    </div>
  )
}
