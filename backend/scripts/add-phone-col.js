require('dotenv').config({ path: '../.env' });
const db = require('../config/database');

async function migrate() {
    try {
        console.log("🛠️  Adding 'phone' column to users table...");

        // Check if column exists first
        const check = await db.oneOrNone(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone'"
        );

        if (check) {
            console.log("   ✅ 'phone' column already exists.");
        } else {
            await db.none("ALTER TABLE users ADD COLUMN phone VARCHAR(20)");
            console.log("   ✅ Added 'phone' column to users table.");
        }

    } catch (e) {
        console.error("❌ Migration failed:", e.message);
    }
}

migrate();
