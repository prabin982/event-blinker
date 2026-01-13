require('dotenv').config({ path: '../.env' });
const db = require('../config/database');

async function migrate() {
    try {
        console.log("🛠️  Adding missing columns to ride sharing tables...");

        // Add registration_document_url to vehicles
        const vehicleCol = await db.oneOrNone(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'registration_document_url'"
        );
        if (!vehicleCol) {
            await db.none("ALTER TABLE vehicles ADD COLUMN registration_document_url TEXT");
            console.log("   ✅ Added 'registration_document_url' to vehicles table");
        } else {
            console.log("   ✅ 'registration_document_url' already exists in vehicles");
        }

        // Add license_holder_name to driver_licenses
        const nameCol = await db.oneOrNone(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'driver_licenses' AND column_name = 'license_holder_name'"
        );
        if (!nameCol) {
            await db.none("ALTER TABLE driver_licenses ADD COLUMN license_holder_name VARCHAR(200)");
            console.log("   ✅ Added 'license_holder_name' to driver_licenses table");
        } else {
            console.log("   ✅ 'license_holder_name' already exists");
        }

        // Add date_of_birth to driver_licenses
        const dobCol = await db.oneOrNone(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'driver_licenses' AND column_name = 'date_of_birth'"
        );
        if (!dobCol) {
            await db.none("ALTER TABLE driver_licenses ADD COLUMN date_of_birth DATE");
            console.log("   ✅ Added 'date_of_birth' to driver_licenses table");
        } else {
            console.log("   ✅ 'date_of_birth' already exists");
        }

        console.log("\n✅ Migration complete!");
        process.exit(0);

    } catch (e) {
        console.error("❌ Migration failed:", e.message);
        process.exit(1);
    }
}

migrate();
