const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function migrateRides() {
  try {
    console.log('Starting ride sharing migration...');

    // Read the schema file
    const schemaPath = path.join(__dirname, '../../database/03_ride_sharing_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute the schema
    await db.query(schema);

    console.log('✅ Ride sharing tables created successfully!');
  } catch (error) {
    if (error.code === '42P07') { // duplicate_table
      console.log('⚠️ Tables already exist, skipping...');
    } else {
      console.error('❌ Migration failed:', error);
    }
  } finally {
    await db.$pool.end();
  }
}

migrateRides();
