const db = require('../config/database');
const path = require('path');
const fs = require('fs');

async function createTables() {
    try {
        console.log("🚀 Starting TOTAL Database Synchronization...");

        // 1. Enable PostGIS
        try {
            await db.query("CREATE EXTENSION IF NOT EXISTS postgis;");
        } catch (e) { console.log("⚠️ PostGIS check skipped"); }

        // 2. The Complete MASTER Schema
        const masterSchema = `
            -- USERS
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                phone VARCHAR(20),
                user_type VARCHAR(20) DEFAULT 'user',
                is_verified BOOLEAN DEFAULT false,
                avatar_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- VEHICLES
            CREATE TABLE IF NOT EXISTS vehicles (
                id SERIAL PRIMARY KEY,
                rider_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                make VARCHAR(100),
                model VARCHAR(100),
                year INT,
                color VARCHAR(50),
                license_plate VARCHAR(20) UNIQUE,
                vehicle_type VARCHAR(50) DEFAULT 'sedan',
                seats_available INT DEFAULT 4,
                registration_document_url TEXT,
                billbook_photo_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- DRIVER LICENSES
            CREATE TABLE IF NOT EXISTS driver_licenses (
                id SERIAL PRIMARY KEY,
                rider_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                license_number VARCHAR(50) UNIQUE,
                license_photo_url TEXT,
                expiry_date DATE,
                issued_date DATE,
                issuing_authority VARCHAR(100),
                license_holder_name VARCHAR(100),
                date_of_birth DATE,
                verification_status VARCHAR(20) DEFAULT 'pending',
                verified_at TIMESTAMP,
                verified_by INTEGER REFERENCES users(id),
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- RIDERS
            CREATE TABLE IF NOT EXISTS riders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                vehicle_id INTEGER REFERENCES vehicles(id),
                license_id INTEGER REFERENCES driver_licenses(id),
                is_active BOOLEAN DEFAULT true,
                is_online BOOLEAN DEFAULT false,
                current_location GEOMETRY(Point, 4326),
                registration_status VARCHAR(20) DEFAULT 'pending',
                approved_at TIMESTAMP,
                approved_by INTEGER REFERENCES users(id),
                rejection_reason TEXT,
                profile_photo_url TEXT,
                emergency_contact VARCHAR(50),
                nid_number VARCHAR(50),
                bank_name VARCHAR(100),
                account_number VARCHAR(50),
                account_holder_name VARCHAR(100),
                terms_accepted BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- RIDE REQUESTS
            CREATE TABLE IF NOT EXISTS ride_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
                accepted_at TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                cancelled_at TIMESTAMP,
                cancellation_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await db.query(masterSchema);
        console.log("✅ Master Schema Created Successfully");

        // 3. Brute-Force Column Checker (Ensures existing tables get new columns)
        const addCol = async (table, col, def) => {
            try {
                await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def};`);
            } catch (e) { /* Silently skip errors */ }
        };

        // Riders Table
        await addCol("riders", "approved_at", "TIMESTAMP");
        await addCol("riders", "approved_by", "INTEGER REFERENCES users(id)");
        await addCol("ride_requests", "accepted_at", "TIMESTAMP");
        await addCol("ride_requests", "started_at", "TIMESTAMP");
        await addCol("ride_requests", "completed_at", "TIMESTAMP");
        await addCol("ride_requests", "cancelled_at", "TIMESTAMP");
        await addCol("ride_requests", "cancellation_reason", "TEXT");
        await addCol("ride_requests", "requested_price", "DECIMAL(10, 2)");
        await addCol("ride_requests", "vehicle_type", "VARCHAR(50) DEFAULT 'sedan'");
        await addCol("ride_requests", "user_phone", "VARCHAR(20)");
        await addCol("ride_requests", "rider_phone", "VARCHAR(20)");
        await addCol("riders", "nid_number", "VARCHAR(50)");
        await addCol("riders", "bank_name", "VARCHAR(100)");
        await addCol("riders", "account_number", "VARCHAR(50)");
        await addCol("riders", "account_holder_name", "VARCHAR(100)");
        await addCol("riders", "terms_accepted", "BOOLEAN DEFAULT false");
        await addCol("riders", "profile_photo_url", "TEXT");
        await addCol("riders", "emergency_contact", "VARCHAR(50)");
        await addCol("riders", "rejection_reason", "TEXT");

        // Driver Licenses Table
        await addCol("driver_licenses", "verified_at", "TIMESTAMP");
        await addCol("driver_licenses", "verified_by", "INTEGER REFERENCES users(id)");
        await addCol("driver_licenses", "rejection_reason", "TEXT");
        await addCol("driver_licenses", "issued_date", "DATE");
        await addCol("driver_licenses", "issuing_authority", "VARCHAR(100)");
        await addCol("driver_licenses", "license_holder_name", "VARCHAR(100)");
        await addCol("driver_licenses", "date_of_birth", "DATE");

        // Vehicles Table
        await addCol("vehicles", "color", "VARCHAR(50)");
        await addCol("vehicles", "registration_document_url", "TEXT");
        await addCol("vehicles", "billbook_photo_url", "TEXT");

        console.log("💎 Total Database Synchronization Complete!");
        return true;
    } catch (error) {
        console.error("❌ Migration Failed:", error.message);
        throw error;
    }
}

module.exports = { createTables };
