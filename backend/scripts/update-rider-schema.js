const db = require('../config/database');

async function updateSchema() {
    console.log('--- Updating Rider Schema ---');
    try {
        // 1. Add billbook_photo_url to vehicles if missing
        await db.none(`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS billbook_photo_url TEXT,
      ADD COLUMN IF NOT EXISTS registration_document_url TEXT;
    `);
        console.log('✓ Vehicles table updated (billbook/registration photo columns)');

        // 2. Add profile_photo_url and personal info to riders if missing
        await db.none(`
      ALTER TABLE riders 
      ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20),
      ADD COLUMN IF NOT EXISTS nid_number VARCHAR(50);
    `);
        console.log('✓ Riders table updated (profile photo, emergency contact, nid)');

        // 3. Add personal details to driver_licenses if missing
        await db.none(`
      ALTER TABLE driver_licenses
      ADD COLUMN IF NOT EXISTS license_holder_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS date_of_birth DATE;
    `);
        console.log('✓ Driver Licenses table updated');

        console.log('--- Schema Update Complete ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Schema update failed:', err.message);
        process.exit(1);
    }
}

updateSchema();
