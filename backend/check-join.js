const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('./config/database');

async function run() {
    try {
        console.log("Check 1: Pending events (raw count)");
        const raw = await db.any("SELECT id, title, organizer_id FROM events WHERE is_approved = false");
        console.log(`Total is_approved=false: ${raw.length}`);

        console.log("\nCheck 2: Pending events with JOIN on users");
        const joined = await db.any("SELECT e.id, e.title, u.email FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.is_approved = false");
        console.log(`Joined pending events: ${joined.length}`);

        if (raw.length > joined.length) {
            console.log("\n⚠️ WARNING: Some pending events are missing their organizers in the users table!");
            const ids = raw.map(r => r.id);
            const joinedIds = joined.map(j => j.id);
            const missing = raw.filter(r => !joinedIds.includes(r.id));
            console.log("Events with missing organizers:", missing);
        }

        console.log("\nCheck 3: Organizer data for these events");
        for (const ev of raw) {
            const user = await db.oneOrNone("SELECT id, email FROM users WHERE id = $1", [ev.organizer_id]);
            console.log(`Event ${ev.id} (${ev.title}) -> Organizer ID ${ev.organizer_id}: ${user ? user.email : 'NOT FOUND'}`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
