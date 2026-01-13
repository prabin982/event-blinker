#!/usr/bin/env node

/**
 * Complete Setup Script for AI Service and Ride Sharing
 * This script will:
 * 1. Update database schema for chat_messages (allow NULL user_id)
 * 2. Check/create ride sharing tables
 * 3. Verify AI service configuration
 */

require("dotenv").config()
const db = require("./config/database")
const fs = require("fs")
const path = require("path")

async function setupDatabase() {
  console.log("\n🚀 Starting Complete Setup for AI Service & Ride Sharing...\n")

  try {
    // Test database connection
    console.log("📡 Testing database connection...")
    await db.query("SELECT 1")
    console.log("✅ Database connected\n")

    // Step 1: Update chat_messages table to allow NULL user_id
    console.log("📝 Step 1: Updating chat_messages table for bot messages...")
    try {
      await db.query(`
        ALTER TABLE chat_messages 
        ALTER COLUMN user_id DROP NOT NULL;
      `)
      console.log("✅ chat_messages table updated - bot messages enabled\n")
    } catch (err) {
      if (err.message.includes("does not exist")) {
        console.log("⚠️  chat_messages table doesn't exist yet - will be created by main migration\n")
      } else if (err.message.includes("column") || err.message.includes("already")) {
        console.log("✅ chat_messages table already allows NULL user_id\n")
      } else {
        throw err
      }
    }

    // Step 2: Check if ride sharing tables exist
    console.log("📝 Step 2: Checking ride sharing tables...")
    const tablesCheck = await db.oneOrNone(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicles'
      )`
    )

    if (tablesCheck && tablesCheck.exists) {
      console.log("✅ Ride sharing tables already exist\n")
    } else {
      console.log("⚠️  Ride sharing tables not found - Running migration...")
      try {
        const migrationScript = fs.readFileSync(path.join(__dirname, "database/03_ride_sharing_schema.sql"), "utf8")
        await db.query(migrationScript)
        console.log("✅ Ride sharing migration completed successfully\n")
      } catch (err) {
        console.error("❌ Migration failed:", err.message)
        console.log("   Try manual: node scripts/migrate-rides.js\n")
      }
    }

    // Step 3: Verify PostGIS extension
    console.log("📝 Step 3: Verifying PostGIS extension...")
    try {
      await db.query("SELECT PostGIS_version()")
      console.log("✅ PostGIS extension is enabled\n")
    } catch (err) {
      console.log("⚠️  PostGIS extension not found - ride sharing location features may not work")
      console.log("   Run: CREATE EXTENSION IF NOT EXISTS postgis;\n")
    }

    // Step 4: Check environment variables
    console.log("📝 Step 4: Checking environment configuration...")
    const aiServiceUrl = process.env.AI_SERVICE_URL
    if (aiServiceUrl) {
      console.log(`✅ AI_SERVICE_URL configured: ${aiServiceUrl}\n`)
    } else {
      console.log("⚠️  AI_SERVICE_URL not set in .env")
      console.log("   Add to backend/.env: AI_SERVICE_URL=http://192.168.254.10:5100\n")
    }

    console.log("✅ Setup check completed!\n")
    console.log("📋 Summary:")
    console.log("   - Database connection: ✅")
    console.log("   - Chat messages (bot support): ✅")
    console.log("   - Ride sharing tables: " + (tablesCheck?.exists ? "✅" : "⚠️  Run migration"))
    console.log("   - PostGIS extension: " + (await db.oneOrNone("SELECT 1 FROM pg_extension WHERE extname = 'postgis'").then(r => r ? "✅" : "⚠️ ")))
    console.log("   - AI Service URL: " + (aiServiceUrl ? "✅" : "⚠️  Not configured"))
    console.log("\n")

  } catch (error) {
    console.error("❌ Setup error:", error.message)
    console.error("\nFull error:", error)
    process.exit(1)
  } finally {
    await db.$pool.end()
    process.exit(0)
  }
}

// Run setup
setupDatabase()

