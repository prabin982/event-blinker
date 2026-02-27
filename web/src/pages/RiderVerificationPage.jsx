import { useState, useEffect } from "react"
import { useSelector } from "react-redux"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const API_URL = import.meta.env.VITE_API_URL || "https://event-blinker.onrender.com"

export default function RiderVerificationPage() {
  const navigate = useNavigate()
  const { user, token } = useSelector((state) => state.auth)
  const [pendingRiders, setPendingRiders] = useState([])
  const [pendingLicenses, setPendingLicenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("riders")

  useEffect(() => {
    if (!user || user.user_type !== "organizer") {
      navigate("/dashboard")
      return
    }
    loadData()
  }, [user, navigate])

  const loadData = async () => {
    try {
      setLoading(true)
      const [ridersRes, licensesRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/riders/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/admin/licenses/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      setPendingRiders(ridersRes.data.riders || [])
      setPendingLicenses(licensesRes.data.licenses || [])
    } catch (error) {
      console.error("Load data error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRider = async (riderId) => {
    if (!confirm("Approve this rider?")) return

    try {
      await axios.post(
        `${API_URL}/api/admin/riders/${riderId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert("Rider approved!")
      loadData()
    } catch (error) {
      alert(error.response?.data?.error || "Failed to approve rider")
    }
  }

  const handleRejectRider = async (riderId) => {
    const reason = prompt("Enter rejection reason:")
    if (!reason) return

    try {
      await axios.post(
        `${API_URL}/api/admin/riders/${riderId}/reject`,
        { rejection_reason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert("Rider rejected!")
      loadData()
    } catch (error) {
      alert(error.response?.data?.error || "Failed to reject rider")
    }
  }

  const handleApproveLicense = async (licenseId) => {
    if (!confirm("Approve this license?")) return

    try {
      await axios.post(
        `${API_URL}/api/admin/licenses/${licenseId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert("License approved!")
      loadData()
    } catch (error) {
      alert(error.response?.data?.error || "Failed to approve license")
    }
  }

  const handleRejectLicense = async (licenseId) => {
    const reason = prompt("Enter rejection reason:")
    if (!reason) return

    try {
      await axios.post(
        `${API_URL}/api/admin/licenses/${licenseId}/reject`,
        { rejection_reason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert("License rejected!")
      loadData()
    } catch (error) {
      alert(error.response?.data?.error || "Failed to reject license")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Rider Verification</h1>

      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab("riders")}
          className={`px-4 py-2 font-semibold ${activeTab === "riders" ? "border-b-2 border-orange-500 text-orange-500" : "text-gray-600"
            }`}
        >
          Pending Riders ({pendingRiders.length})
        </button>
        <button
          onClick={() => setActiveTab("licenses")}
          className={`px-4 py-2 font-semibold ${activeTab === "licenses" ? "border-b-2 border-orange-500 text-orange-500" : "text-gray-600"
            }`}
        >
          Pending Licenses ({pendingLicenses.length})
        </button>
      </div>

      {activeTab === "riders" && (
        <div className="space-y-4">
          {pendingRiders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No pending riders</div>
          ) : (
            pendingRiders.map((rider) => (
              <div key={rider.id} className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{rider.first_name} {rider.last_name}</h3>
                    <p className="text-gray-600">{rider.email}</p>
                    <p className="text-gray-600">{rider.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Vehicle</p>
                    <p className="font-semibold">
                      {rider.make} {rider.model} ({rider.year})
                    </p>
                    <p className="text-sm text-gray-600">Plate: {rider.license_plate}</p>
                  </div>
                </div>

                {rider.license_photo_url && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2">License Photo:</p>
                    <img
                      src={`${API_URL}${rider.license_photo_url}`}
                      alt="License"
                      className="max-w-md border rounded"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveRider(rider.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectRider(rider.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "licenses" && (
        <div className="space-y-4">
          {pendingLicenses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No pending licenses</div>
          ) : (
            pendingLicenses.map((license) => (
              <div key={license.id} className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg">
                    {license.first_name} {license.last_name}
                  </h3>
                  <p className="text-gray-600">{license.email}</p>
                  <p className="text-sm text-gray-500">License #: {license.license_number}</p>
                  <p className="text-sm text-gray-500">Expiry: {new Date(license.expiry_date).toLocaleDateString()}</p>
                </div>

                {license.license_photo_url && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2">License Photo:</p>
                    <img
                      src={`${API_URL}${license.license_photo_url}`}
                      alt="License"
                      className="max-w-md border rounded"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveLicense(license.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectLicense(license.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

