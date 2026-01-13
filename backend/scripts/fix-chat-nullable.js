#!/usr/bin/env node

/**
 * Fix chat_messages table to allow NULL user_id for bot messages
 */

require("dotenv").config()
const db = require("../config/database")

async function fixChatNullable() {
  try {
    console.log("\n🔧 Fixing chat_messages.user_id to allow NULL...\n")

    // Check current nullable status
    const current = await db.oneOrNone(
      `SELECT is_nullable FROM information_schema.columns 
       WHERE table_name = 'chat_messages' AND column_name = 'user_id'`
    )

    if (!current) {
      console.log("❌ chat_messages table or user_id column not found")
      process.exit(1)
    }

    if (current.is_nullable === "YES") {
      console.log("✅ user_id already allows NULL - no changes needed\n")
      process.exit(0)
    }

    // Alter column to allow NULL
    await db.query(`
      ALTER TABLE chat_messages 
      ALTER COLUMN user_id DROP NOT NULL;
    `)

    console.log("✅ Successfully updated chat_messages.user_id to allow NULL\n")
    console.log("   Bot messages can now be stored with NULL user_id\n")

    process.exit(0)
  } catch (error) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  } finally {
    await db.$pool.end()
  }
}

fixChatNullable()
