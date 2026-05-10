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

        // Define all table schemas in one block
        const schemaFiles = [
            "../../database/01_initial_schema.sql",
            "../../database/03_ride_sharing_schema.sql"
        ];

        for (const relPath of schemaFiles) {
            const fullPath = path.join(__dirname, relPath);
            if (fs.existsSync(fullPath)) {
                console.log(`Running schema: ${relPath}`);
                const sql = fs.readFileSync(fullPath, "utf8");
                await db.query(sql);
            }
        }

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
