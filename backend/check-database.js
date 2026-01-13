#!/usr/bin/env node

/**
 * Database Diagnostic Script for Admin Portal
 * Checks if required tables and columns exist
 */

require('dotenv').config();
const pgPromise = require('pg-promise');

const initOptions = {
  // Disable logging to reduce output
  capSQL: false,
};

const pgp = pgPromise(initOptions);

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'event_blinker',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'prabin',
};

const db = pgp(config);

async function checkDatabase() {
  console.log('\n🔍 Database Diagnostic Check\n');
  console.log(`📡 Connecting to: ${config.user}@${config.host}:${config.port}/${config.database}\n`);

  try {
    // Test connection
    const conn = await db.connect();
    console.log('✅ Database connection successful\n');
    conn.done();

    // Check tables
    const tables = ['riders', 'users', 'vehicles', 'driver_licenses'];
    console.log('📋 Checking tables:');
    
    for (const table of tables) {
      try {
        const exists = await db.one(
          `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
          [table]
        );
        
        if (exists.exists) {
          console.log(`   ✅ ${table} - EXISTS`);
          
          // Check row count
          const count = await db.one(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`      └─ Rows: ${count.count}`);
        } else {
          console.log(`   ❌ ${table} - NOT FOUND`);
        }
      } catch (error) {
        console.log(`   ❌ ${table} - ERROR: ${error.message}`);
      }
    }

    // Check specific columns
    console.log('\n📊 Checking required columns:\n');
    
    const checks = [
      {
        table: 'riders',
        columns: ['id', 'user_id', 'registration_status', 'created_at']
      },
      {
        table: 'users',
        columns: ['id', 'email', 'first_name', 'last_name', 'phone']
      },
      {
        table: 'vehicles',
        columns: ['id', 'rider_id', 'make', 'model', 'year', 'license_plate']
      },
      {
        table: 'driver_licenses',
        columns: ['id', 'rider_id', 'verification_status', 'license_number', 'created_at']
      }
    ];

    for (const check of checks) {
      console.log(`${check.table}:`);
      for (const column of check.columns) {
        try {
          const exists = await db.one(
            `SELECT EXISTS(SELECT 1 FROM information_schema.columns 
             WHERE table_name = $1 AND column_name = $2)`,
            [check.table, column]
          );
          
          if (exists.exists) {
            console.log(`   ✅ ${column}`);
          } else {
            console.log(`   ❌ ${column} - MISSING`);
          }
        } catch (error) {
          console.log(`   ❌ ${column} - ERROR`);
        }
      }
      console.log('');
    }

    // Check for pending data
    console.log('🔎 Checking for pending data:\n');
    
    try {
      const pendingRiders = await db.one(
        `SELECT COUNT(*) as count FROM riders WHERE registration_status = 'pending'`
      );
      console.log(`   Pending riders: ${pendingRiders.count}`);
    } catch (error) {
      console.log(`   Pending riders: ERROR - ${error.message}`);
    }

    try {
      const pendingLicenses = await db.one(
        `SELECT COUNT(*) as count FROM driver_licenses WHERE verification_status = 'pending'`
      );
      console.log(`   Pending licenses: ${pendingLicenses.count}`);
    } catch (error) {
      console.log(`   Pending licenses: ERROR - ${error.message}`);
    }

    console.log('\n✅ Diagnostic complete!\n');

  } catch (error) {
    console.error('\n❌ Database Error:\n');
    console.error(`   ${error.message}\n`);
    
    console.log('Troubleshooting steps:');
    console.log('1. Ensure PostgreSQL is running');
    console.log('2. Check .env file for correct DB credentials:');
    console.log(`   DB_HOST=${config.host}`);
    console.log(`   DB_PORT=${config.port}`);
    console.log(`   DB_NAME=${config.database}`);
    console.log(`   DB_USER=${config.user}`);
    console.log('3. Run migrations: cd backend && npm run migrate');
    console.log('4. Verify schema: psql -U postgres -d event_blinker -c "\\dt"');
    console.log('');
  } finally {
    await pgp.end();
  }
}

checkDatabase().catch(error => {
  console.error(error);
  process.exit(1);
});
