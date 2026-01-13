-- Seed sample data (run after initial schema)
-- Insert test users
INSERT INTO users (email, password, first_name, last_name, user_type) 
VALUES 
  ('organizer@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'John', 'Organizer', 'organizer'),
  ('user@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Jane', 'User', 'user'),
  ('user2@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Mike', 'Johnson', 'user');

-- Insert sample events with geospatial data
INSERT INTO events (organizer_id, title, description, event_type, start_time, end_time, price, image_url, location_name, location, capacity, status)
VALUES
  (
    (SELECT id FROM users WHERE email = 'organizer@example.com'),
    'Tech Conference 2025',
    'Annual technology conference featuring keynotes from industry leaders, networking sessions, and hands-on workshops on emerging technologies.',
    'Conference',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '9 days',
    99.99,
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500',
    'Grand Convention Center, New York',
    ST_GeomFromText('POINT(-74.0060 40.7128)', 4326),
    500,
    'active'
  ),
  (
    (SELECT id FROM users WHERE email = 'organizer@example.com'),
    'Summer Music Festival',
    'Outdoor music festival featuring local and international artists. Bring your family and friends for a day of great music and entertainment.',
    'Music',
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '15 days',
    45.00,
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500',
    'Central Park, New York',
    ST_GeomFromText('POINT(-73.9654 40.7829)', 4326),
    1000,
    'active'
  ),
  (
    (SELECT id FROM users WHERE email = 'organizer@example.com'),
    'Food & Wine Expo',
    'Experience culinary delights from top chefs and vintners. Wine tasting, food pairings, and live cooking demonstrations.',
    'Food',
    NOW() + INTERVAL '21 days',
    NOW() + INTERVAL '22 days',
    75.50,
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500',
    'Downtown Culinary Center',
    ST_GeomFromText('POINT(-74.0150 40.7200)', 4326),
    300,
    'active'
  ),
  (
    (SELECT id FROM users WHERE email = 'organizer@example.com'),
    'Fitness & Wellness Marathon',
    'Join us for a marathon event focused on health and wellness. Includes 5K run, yoga sessions, and nutrition workshops.',
    'Sports',
    NOW() + INTERVAL '28 days',
    NOW() + INTERVAL '29 days',
    29.99,
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=500',
    'Riverside Park',
    ST_GeomFromText('POINT(-73.9776 40.7614)', 4326),
    2000,
    'active'
  );

-- Insert sample likes
INSERT INTO event_likes (user_id, event_id)
SELECT 
  u.id,
  e.id
FROM users u, events e
WHERE u.email = 'user@example.com'
AND e.title IN ('Tech Conference 2025', 'Summer Music Festival')
ON CONFLICT (user_id, event_id) DO NOTHING;

-- Insert sample check-ins
INSERT INTO check_ins (user_id, event_id, location)
SELECT 
  u.id,
  e.id,
  ST_GeomFromText('POINT(-74.0060 40.7128)', 4326)
FROM users u, events e
WHERE u.email = 'user@example.com'
AND e.title = 'Tech Conference 2025'
ON CONFLICT (user_id, event_id) DO NOTHING;

-- Insert sample chat messages
INSERT INTO chat_messages (sender_id, event_id, message, message_type)
VALUES
  (
    (SELECT id FROM users WHERE email = 'user@example.com'),
    (SELECT id FROM events WHERE title = 'Tech Conference 2025' LIMIT 1),
    'What time does the keynote start tomorrow?',
    'text'
  ),
  (
    (SELECT id FROM users WHERE email = 'organizer@example.com'),
    (SELECT id FROM events WHERE title = 'Tech Conference 2025' LIMIT 1),
    'The keynote starts at 9:00 AM. Thank you for attending!',
    'text'
  ),
  (
    (SELECT id FROM users WHERE email = 'user@example.com'),
    (SELECT id FROM events WHERE title = 'Summer Music Festival' LIMIT 1),
    'Can you help me with directions to the park?',
    'direction_request'
  );

-- Update event stats
INSERT INTO event_stats (event_id, likes_count, check_ins_count, messages_count)
SELECT 
  e.id,
  (SELECT COUNT(*) FROM event_likes WHERE event_id = e.id),
  (SELECT COUNT(*) FROM check_ins WHERE event_id = e.id),
  (SELECT COUNT(*) FROM chat_messages WHERE event_id = e.id)
FROM events e
ON CONFLICT DO NOTHING;
