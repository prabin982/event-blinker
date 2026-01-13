const db = require("../config/database")

const createTables = async () => {
  try {
    console.log("Creating tables...")

    // Enable PostGIS
    await db.query("CREATE EXTENSION IF NOT EXISTS postgis;")
    console.log("PostGIS enabled")

    // Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('organizer', 'user')),
        avatar_url TEXT,
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log("✓ Users table created")

    // Events table with PostGIS geometry
    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        price DECIMAL(10, 2),
        location_name VARCHAR(255),
        location_address TEXT,
        location_geom GEOMETRY(Point, 4326) NOT NULL,
        capacity INTEGER,
        current_attendance INTEGER DEFAULT 0,
        image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    
    // Create indexes separately (ignore if they exist)
    const createIndexIfNotExists = async (indexQuery) => {
      try {
        await db.query(indexQuery)
      } catch (e) {
        // Ignore if index already exists (error code 42P07)
        if (e.code !== "42P07" && !e.message.includes("already exists")) {
          throw e
        }
      }
    }
    
    await createIndexIfNotExists("CREATE INDEX IF NOT EXISTS idx_events_geom ON events USING GIST(location_geom);")
    await createIndexIfNotExists("CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active);")
    await createIndexIfNotExists("CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);")
    console.log("✓ Events table created")

    // User Likes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, event_id)
      );
    `)
    
    await createIndexIfNotExists("CREATE INDEX IF NOT EXISTS idx_likes_user ON user_likes(user_id);")
    await createIndexIfNotExists("CREATE INDEX IF NOT EXISTS idx_likes_event ON user_likes(event_id);")
    console.log("✓ User Likes table created")

    // Check-ins table
    await db.query(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        location_geom GEOMETRY(Point, 4326)
      );
    `)
    
    // Create unique index for one check-in per user per event per day
    await createIndexIfNotExists("CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_unique ON check_ins(user_id, event_id, DATE(checked_in_at));")
    await createIndexIfNotExists("CREATE INDEX IF NOT EXISTS idx_checkins_event ON check_ins(event_id);")
    console.log("✓ Check-ins table created")

    // Chat Messages table (for event chatbot)
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        sender_type VARCHAR(50) DEFAULT 'user' CHECK (sender_type IN ('user', 'bot', 'organizer')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    
    await createIndexIfNotExists("CREATE INDEX IF NOT EXISTS idx_messages_event ON chat_messages(event_id);")
    console.log("✓ Chat Messages table created")

    console.log("✓ All tables created successfully!")
    process.exit(0)
  } catch (error) {
    console.error("Migration error:", error)
    process.exit(1)
  }
}

createTables()
