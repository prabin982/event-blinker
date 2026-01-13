require('dotenv').config();
const db = require('../config/database');

async function fix() {
    console.log("🔧 Fixing event approval system...\n");

    try {
        // 1. Add column if missing
        const col = await db.oneOrNone(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'is_approved'"
        );
        if (!col) {
            await db.none("ALTER TABLE events ADD COLUMN is_approved BOOLEAN DEFAULT false");
            console.log("✅ Added is_approved column");
        } else {
            console.log("✅ is_approved column exists");
        }

        // 2. Set existing events to approved (for backward compatibility)
        const result = await db.result("UPDATE events SET is_approved = true WHERE is_approved IS NULL");
        console.log(`✅ Updated ${result.rowCount} existing events to approved`);

        // 3. Verify organizers
        const organizers = await db.any("SELECT id, email, is_verified FROM users WHERE user_type = 'organizer'");
        console.log(`\n📋 Found ${organizers.length} organizers:`);
        organizers.forEach(o => {
            console.log(`  - ${o.email} (verified: ${o.is_verified || false})`);
        });

        // 4. Check pending events
        const pending = await db.any("SELECT id, title, created_at FROM events WHERE is_approved = false ORDER BY created_at DESC");
        console.log(`\n📋 ${pending.length} pending events awaiting approval:`);
        pending.forEach(e => {
            console.log(`  - ${e.title} (${e.created_at})`);
        });

        // 5. Check all events
        const allEvents = await db.any("SELECT id, title, is_approved FROM events ORDER BY created_at DESC LIMIT 10");
        console.log(`\n📋 Recent events (last 10):`);
        allEvents.forEach(e => {
            console.log(`  - ${e.title} (approved: ${e.is_approved})`);
        });

        console.log("\n✅ Diagnostic complete!");
        process.exit(0);
    } catch (e) {
        console.error("❌ Error:", e.message);
        console.error(e);
        process.exit(1);
    }
}

fix();
