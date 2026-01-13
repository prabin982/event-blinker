-- PostgreSQL Database Schema for Event Blinker App
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  profile_image_url TEXT,
  user_type VARCHAR(20) CHECK (user_type IN ('user', 'organizer')) DEFAULT 'user',
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table with geospatial data
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  price DECIMAL(10, 2),
  image_url TEXT,
  location_name VARCHAR(255) NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  capacity INT,
  attendees_count INT DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('active', 'cancelled', 'completed')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for fast geospatial queries
CREATE INDEX idx_events_location ON events USING GIST(location);

-- Likes table
CREATE TABLE event_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_id)
);

-- Check-ins table
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  location GEOMETRY(Point, 4326),
  UNIQUE(user_id, event_id)
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type VARCHAR(20) CHECK (message_type IN ('text', 'direction_request')) DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for chat messages
CREATE INDEX idx_chat_messages_event ON chat_messages(event_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);

-- Organizer events stats table
CREATE TABLE event_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  likes_count INT DEFAULT 0,
  check_ins_count INT DEFAULT 0,
  messages_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_event_likes_user ON event_likes(user_id);
CREATE INDEX idx_event_likes_event ON event_likes(event_id);
CREATE INDEX idx_check_ins_user ON check_ins(user_id);
CREATE INDEX idx_check_ins_event ON check_ins(event_id);
