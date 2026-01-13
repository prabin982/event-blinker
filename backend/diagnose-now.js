const path = require('path');
// Explicitly load .env from the root backend directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('./config/database');

async function run() {
    try {
        console.log("=== DIAGNOSTIC START ===");

        // 1. Check Organizers
        console.log("\n1. Organizer Accounts (is_verified?):");
        const users = await db.any("SELECT id, email, user_type, is_verified FROM users WHERE user_type = 'organizer'");
        console.log(users);

        // 2. Check All Events (count by approval status)
        console.log("\n2. Event Statistics:");
        const stats = await db.any("SELECT is_approved, count(*) FROM events GROUP BY is_approved");
        console.log(stats);

        // 3. Check Recent Events
        console.log("\n3. Recent events in DB:");
        const recent = await db.any("SELECT id, title, organizer_id, is_approved, created_at FROM events ORDER BY created_at DESC LIMIT 5");
        console.log(recent);

        // 4. Trace the JOIN
        if (recent.length > 0) {
            console.log("\n4. Tracing Organizer JOIN for latest event:");
            const latest = recent[0];
            const user = await db.oneOrNone("SELECT id, email, name FROM users WHERE id = $1", [latest.organizer_id]);
            if (user) {
                console.log(`✅ Event organizer found: ${user.email} (ID: ${user.id})`);
            } else {
                console.log(`❌ Event organizer NOT FOUND for ID: ${latest.organizer_id}`);
            }
        }

        // 5. Test Admin Query
        console.log("\n5. Testing Admin route query:");
        const pending = await db.any(
            `SELECT e.id, e.title, u.email as organizer_email
             FROM events e 
             JOIN users u ON e.organizer_id = u.id 
             WHERE e.is_approved = false`
        );
        console.log(`Found ${pending.length} pending events via JOIN.`);
        console.log(pending);

        console.log("\n=== DIAGNOSTIC END ===");
        process.exit(0);
    } catch (e) {
        console.error("DIAGNOSTIC FAILED:", e.message);
        process.exit(1);
    }
}
run();
