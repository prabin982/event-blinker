// Distance calculation utility using Haversine formula
// Calculates distance between two lat/lng points in kilometers

function toRadians(degrees) {
  return degrees * (Math.PI / 180)
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return Math.round(distance * 100) / 100 // Round to 2 decimal places
}

/**
 * Calculate ride price based on distance and vehicle type
 * @param {number} distanceKm - Distance in kilometers
 * @param {string} vehicleType - Type of vehicle (sedan, suv, etc.)
 * @returns {number} Price in local currency (NPR)
 */
function calculateRidePrice(distanceKm, vehicleType = "sedan") {
  // Base price per km for different vehicle types (in NPR)
  const baseRates = {
    motorcycle: 15,
    sedan: 25,
    hatchback: 22,
    suv: 35,
    van: 40,
    other: 25,
  }

  const baseRate = baseRates[vehicleType] || baseRates.sedan

  // Base fare (minimum charge)
  const baseFare = 50

  // Distance-based pricing
  let price = baseFare + distanceKm * baseRate

  // Apply discounts for longer distances
  if (distanceKm > 20) {
    price = price * 0.9 // 10% discount for long rides
  } else if (distanceKm > 10) {
    price = price * 0.95 // 5% discount for medium rides
  }

  // Round to nearest 5
  return Math.ceil(price / 5) * 5
}

/**
 * Estimate ride duration in minutes
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Estimated duration in minutes
 */
function estimateDuration(distanceKm) {
  // Average speed: 30 km/h in city, 60 km/h on highway
  // Using weighted average: 40 km/h
  const averageSpeed = 40
  const minutes = (distanceKm / averageSpeed) * 60
  return Math.ceil(minutes)
}

module.exports = {
  calculateDistance,
  calculateRidePrice,
  estimateDuration,
}

