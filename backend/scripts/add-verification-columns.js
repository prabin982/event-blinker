require("dotenv").config()
const db = require("../config/database")

async function addVerificationColumns() {
  try {
    console.log("\n🔧 Adding verification and approval columns...\n")

    // Add is_verified to users table
    try {
      await db.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
      `)
      console.log("✅ Added is_verified column to users table")
    } catch (err) {
      if (!err.message.includes("already exists") && !err.message.includes("duplicate")) {
        console.log("⚠️  Could not add is_verified:", err.message)
      } else {
        console.log("✅ is_verified column already exists")
      }
    }

    // Add is_approved to events table
    try {
      await db.query(`
        ALTER TABLE events 
        ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
      `)
      console.log("✅ Added is_approved column to events table")
    } catch (err) {
      if (!err.message.includes("already exists") && !err.message.includes("duplicate")) {
        console.log("⚠️  Could not add is_approved:", err.message)
      } else {
        console.log("✅ is_approved column already exists")
      }
    }

    // Set existing users (except organizers) as verified
    try {
      await db.query(`
        UPDATE users 
        SET is_verified = true 
        WHERE user_type != 'organizer' OR user_type IS NULL;
      `)
      console.log("✅ Set existing users as verified")
    } catch (err) {
      console.log("⚠️  Could not update existing users:", err.message)
    }

    // Set existing events as approved (for backward compatibility)
    try {
      await db.query(`
        UPDATE events 
        SET is_approved = true 
        WHERE is_approved IS NULL OR is_approved = false;
      `)
      console.log("✅ Set existing events as approved")
    } catch (err) {
      console.log("⚠️  Could not update existing events:", err.message)
    }

    console.log("\n✅ Verification columns added successfully!\n")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  } finally {
    await db.$pool.end()
  }
}

addVerificationColumns()
