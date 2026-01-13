const db = require('./config/database');

async function fix() {
    try {
        console.log("Updating User 3 to Pending Organizer...");
        await db.none("UPDATE users SET user_type='organizer', is_verified=false WHERE id=3");
        console.log("✅ User 3 updated successfully.");

        console.log("Updating all events to unapproved (for testing flow)...");
        await db.none("UPDATE events SET is_approved=false");
        console.log("✅ All events set to pending.");

        process.exit(0);
    } catch (e) {
        console.error("❌ Fix failed:", e.message);
        process.exit(1);
    }
}
fix();
