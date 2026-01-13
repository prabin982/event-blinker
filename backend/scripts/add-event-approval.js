require('dotenv').config({ path: '../.env' });
const db = require('../config/database');

async function migrate() {
    try {
        console.log("🛠️  Adding is_approved column to events table...");

        // Check if column exists
        const col = await db.oneOrNone(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'is_approved'"
        );

        if (!col) {
            await db.none("ALTER TABLE events ADD COLUMN is_approved BOOLEAN DEFAULT false");
            console.log("   ✅ Added 'is_approved' column to events table");

            // Set existing events to approved (backward compatibility)
            const result = await db.result("UPDATE events SET is_approved = true WHERE is_approved IS NULL");
            console.log(`   ✅ Set ${result.rowCount} existing events to approved`);
        } else {
            console.log("   ✅ 'is_approved' column already exists");
        }

        console.log("\n✅ Migration complete!");
        process.exit(0);

    } catch (e) {
        console.error("❌ Migration failed:", e.message);
        process.exit(1);
    }
}

migrate();
