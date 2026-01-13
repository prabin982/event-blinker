require('dotenv').config()
const db = require('../config/database')

async function addRiderFields() {
  try {
    console.log('\n🔧 Adding rider-specific columns if missing...\n')

    // Add license_holder_name and date_of_birth to driver_licenses
    await db.query(`ALTER TABLE driver_licenses ADD COLUMN IF NOT EXISTS license_holder_name VARCHAR(200);`)
    console.log('✅ Ensured driver_licenses.license_holder_name')

    await db.query(`ALTER TABLE driver_licenses ADD COLUMN IF NOT EXISTS date_of_birth DATE;`)
    console.log('✅ Ensured driver_licenses.date_of_birth')

    // Add registration_document_url to vehicles
    await db.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration_document_url TEXT;`)
    console.log('✅ Ensured vehicles.registration_document_url')

    console.log('\n✅ Rider fields added or already present.\n')
    process.exit(0)
  } catch (err) {
    console.error('❌ Failed to add rider fields:', err.message)
    process.exit(1)
  } finally {
    try { await db.$pool.end() } catch (e) {}
  }
}

addRiderFields()
