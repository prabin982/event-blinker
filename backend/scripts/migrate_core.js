const db = require("../config/database")
const fs = require("fs")
const path = require("path")

const createTables = async () => {
    try {
        console.log("Creating/Updating tables...")

        // Enable PostGIS (Critical for maps/rides)
        try {
            await db.query("CREATE EXTENSION IF NOT EXISTS postgis;")
            console.log("✓ PostGIS extension enabled");
        } catch (e) {
            console.log("⚠️ PostGIS extension check failed (might already be enabled or permission denied). Continuing...");
        }

        // Define all table schemas directly here to avoid file system issues on Render
        const rideSharingSchema = `
        CREATE TABLE IF NOT EXISTS vehicles (
            id SERIAL PRIMARY KEY,
            rider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            make VARCHAR(100) NOT NULL,
            model VARCHAR(100) NOT NULL,
            year INT NOT NULL,
            license_plate VARCHAR(20) UNIQUE NOT NULL,
            vehicle_type VARCHAR(50) DEFAULT 'sedan',
            seats_available INT DEFAULT 4,
            registration_document_url TEXT,
            billbook_photo_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS driver_licenses (
            id SERIAL PRIMARY KEY,
            rider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            license_number VARCHAR(50) UNIQUE NOT NULL,
            license_photo_url TEXT NOT NULL,
            expiry_date DATE NOT NULL,
            verification_status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS riders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            vehicle_id INTEGER REFERENCES vehicles(id),
            license_id INTEGER REFERENCES driver_licenses(id),
            is_active BOOLEAN DEFAULT true,
            is_online BOOLEAN DEFAULT false,
            current_location GEOMETRY(Point, 4326),
            registration_status VARCHAR(20) DEFAULT 'pending',
            profile_photo_url TEXT,
            emergency_contact VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ride_requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            pickup_location GEOMETRY(Point, 4326) NOT NULL,
            pickup_address TEXT NOT NULL,
            dropoff_location GEOMETRY(Point, 4326) NOT NULL,
            dropoff_address TEXT NOT NULL,
            distance_km DECIMAL(10, 2),
            estimated_price DECIMAL(10, 2),
            requested_price DECIMAL(10, 2),
            status VARCHAR(20) DEFAULT 'pending',
            rider_id INTEGER REFERENCES riders(id),
            user_phone VARCHAR(20),
            rider_phone VARCHAR(20),
            vehicle_type VARCHAR(50) DEFAULT 'sedan',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_ride_requests_pickup ON ride_requests USING GIST(pickup_location);
    `;

        console.log("Running embedded schema migration...");
        await db.query(rideSharingSchema);
        console.log("✓ Ride sharing tables created/updated");

        // Add missing columns if they don't exist
        const addCol = async (table, col, def) => {
            try {
                await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def};`);
            } catch (e) { console.log(`Note: ${col} check on ${table} skipped`); }
        };

        await addCol("users", "is_verified", "BOOLEAN DEFAULT false");
        await addCol("riders", "profile_photo_url", "TEXT");
        await addCol("riders", "registration_status", "VARCHAR(20) DEFAULT 'pending'");

        console.log("✓ Database is synchronized and up-to-date!");
        return true;
    } catch (error) {
        console.error("Migration error:", error);
        throw error;
    }
}

module.exports = { createTables };
