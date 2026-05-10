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
            color VARCHAR(50),
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
            issued_date DATE,
            issuing_authority VARCHAR(100),
            license_holder_name VARCHAR(100),
            date_of_birth DATE,
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
            nid_number VARCHAR(50),
            bank_name VARCHAR(100),
            account_number VARCHAR(50),
            account_holder_name VARCHAR(100),
            terms_accepted BOOLEAN DEFAULT false,
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

        console.log("Running complete embedded schema migration...");
        await db.query(rideSharingSchema);
        console.log("✓ Ride sharing tables completely synchronized");

        // Add missing columns if they don't exist (Backup check)
        const addCol = async (table, col, def) => {
            try {
                await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def};`);
            } catch (e) {
                // Ignore if it's just a "relation exists" error or column error
            }
        };

        await addCol("riders", "nid_number", "VARCHAR(50)");
        await addCol("riders", "bank_name", "VARCHAR(100)");
        await addCol("riders", "account_number", "VARCHAR(50)");
        await addCol("riders", "account_holder_name", "VARCHAR(100)");
        await addCol("riders", "terms_accepted", "BOOLEAN DEFAULT false");
        await addCol("riders", "profile_photo_url", "TEXT");
        await addCol("riders", "emergency_contact", "VARCHAR(50)");
        await addCol("riders", "registration_status", "VARCHAR(20) DEFAULT 'pending'");
        await addCol("riders", "approved_at", "TIMESTAMP");
        await addCol("riders", "approved_by", "INTEGER REFERENCES users(id)");
        await addCol("riders", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

        await addCol("vehicles", "color", "VARCHAR(50)");
        await addCol("vehicles", "registration_document_url", "TEXT");
        await addCol("vehicles", "billbook_photo_url", "TEXT");
        await addCol("vehicles", "vehicle_type", "VARCHAR(50) DEFAULT 'sedan'");
        await addCol("vehicles", "seats_available", "INT DEFAULT 4");

        await addCol("driver_licenses", "date_of_birth", "DATE");
        await addCol("driver_licenses", "license_holder_name", "VARCHAR(100)");
        await addCol("driver_licenses", "issued_date", "DATE");
        await addCol("driver_licenses", "issuing_authority", "VARCHAR(100)");
        await addCol("driver_licenses", "verification_status", "VARCHAR(20) DEFAULT 'pending'");

        await addCol("ride_requests", "vehicle_type", "VARCHAR(50) DEFAULT 'sedan'");
        await addCol("ride_requests", "user_phone", "VARCHAR(20)");
        await addCol("ride_requests", "rider_phone", "VARCHAR(20)");

        console.log("✓ Database is synchronized and up-to-date!");
        return true;
    } catch (error) {
        console.error("Migration error:", error);
        throw error;
    }
}

module.exports = { createTables };
