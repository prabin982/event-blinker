-- Ride Sharing System Database Schema
-- Run this after the main schema (01_create_schema.sql)

-- Vehicles table - stores car information
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  color VARCHAR(50),
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  vehicle_type VARCHAR(50) CHECK (vehicle_type IN ('sedan', 'suv', 'hatchback', 'van', 'motorcycle', 'other')) DEFAULT 'sedan',
  seats_available INT DEFAULT 4,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driver licenses table - stores license information and photos
CREATE TABLE IF NOT EXISTS driver_licenses (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(50) UNIQUE NOT NULL,
  license_photo_url TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  issued_date DATE,
  issuing_authority VARCHAR(100),
  verification_status VARCHAR(20) CHECK (verification_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Riders table - extends user info for ride providers
CREATE TABLE IF NOT EXISTS riders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicles(id),
  license_id INTEGER REFERENCES driver_licenses(id),
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  current_location GEOMETRY(Point, 4326),
  rating DECIMAL(3, 2) DEFAULT 5.0,
  total_rides INT DEFAULT 0,
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  phone_verified BOOLEAN DEFAULT false,
  registration_status VARCHAR(20) CHECK (registration_status IN ('pending', 'approved', 'rejected', 'suspended')) DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ride requests table - stores user ride requests
CREATE TABLE IF NOT EXISTS ride_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pickup_location GEOMETRY(Point, 4326) NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_location GEOMETRY(Point, 4326) NOT NULL,
  dropoff_address TEXT NOT NULL,
  distance_km DECIMAL(10, 2),
  estimated_price DECIMAL(10, 2),
  requested_price DECIMAL(10, 2), -- Price rider offers (if different)
  status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  rider_id INTEGER REFERENCES riders(id),
  user_phone VARCHAR(20),
  rider_phone VARCHAR(20),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ride offers table - stores rider responses to ride requests
CREATE TABLE IF NOT EXISTS ride_offers (
  id SERIAL PRIMARY KEY,
  ride_request_id INTEGER NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  offered_price DECIMAL(10, 2) NOT NULL,
  estimated_arrival_minutes INT,
  status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ride reviews table
CREATE TABLE IF NOT EXISTS ride_reviews (
  id SERIAL PRIMARY KEY,
  ride_request_id INTEGER NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_rider ON vehicles(rider_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_licenses_rider ON driver_licenses(rider_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON driver_licenses(verification_status);
CREATE INDEX IF NOT EXISTS idx_riders_user ON riders(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(registration_status);
CREATE INDEX IF NOT EXISTS idx_riders_location ON riders USING GIST(current_location);
CREATE INDEX IF NOT EXISTS idx_riders_active ON riders(is_active, is_online);
CREATE INDEX IF NOT EXISTS idx_ride_requests_user ON ride_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_rider ON ride_requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_pickup ON ride_requests USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_ride_requests_dropoff ON ride_requests USING GIST(dropoff_location);
CREATE INDEX IF NOT EXISTS idx_ride_offers_request ON ride_offers(ride_request_id);
CREATE INDEX IF NOT EXISTS idx_ride_offers_rider ON ride_offers(rider_id);
CREATE INDEX IF NOT EXISTS idx_ride_reviews_rider ON ride_reviews(rider_id);

