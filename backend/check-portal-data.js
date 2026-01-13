const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('./config/database');

async function run() {
    try {
        console.log("=== DIAGNOSTIC REPORT ===");

        // 1. Organizers Check
        const orgs = await db.any("SELECT id, email, user_type, is_verified, created_at FROM users WHERE user_type = 'organizer'");
        console.log("\n--- Organizers in DB ---");
        if (orgs.length === 0) {
            console.log("No users with user_type='organizer' found.");
        } else {
            console.table(orgs);
        }

        // 2. Events Check
        const events = await db.any(`
            SELECT e.id, e.title, e.is_approved, e.organizer_id, u.email as organizer_email 
            FROM events e 
            LEFT JOIN users u ON e.organizer_id = u.id
            ORDER BY e.created_at DESC
        `);
        console.log("\n--- Events in DB ---");
        if (events.length === 0) {
            console.log("No events found.");
        } else {
            console.table(events);
        }

        // 3. Pending counts vs actual query
        const pendingOrgs = await db.any("SELECT id FROM users WHERE user_type = 'organizer' AND is_verified = false");
        const pendingEvents = await db.any("SELECT id FROM events WHERE is_approved = false");

        console.log("\n--- Pending Totals ---");
        console.log(`Pending Organizers: ${pendingOrgs.length}`);
        console.log(`Pending Events: ${pendingEvents.length}`);

        process.exit(0);
    } catch (e) {
        console.error("DIAGNOSTIC FAILED:", e.message);
        process.exit(1);
    }
}
run();
