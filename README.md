# Event Blinker - Real-Time Event Discovery Platform

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-blue)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## Overview

**Event Blinker** is a modern, real-time event discovery platform connecting event-goers with local events. Users can discover events based on location, see live updates, interact with event organizers, and check in to events—all while organizers manage events from an intuitive web portal.

### Key Features

- **Real-time Map Discovery**: Interactive map with live event markers
- **Geospatial Search**: Find events within a specific radius
- **Live Event Chat**: Real-time messaging with event organizers and attendees
- **Event Likes & Check-ins**: Social engagement and attendance tracking
- **Organizer Dashboard**: Comprehensive admin panel with analytics
- **WebSocket Support**: Real-time updates for events and messages
- **Mobile-First**: Responsive design optimized for smartphones

---

## Tech Stack

\`\`\`
┌─────────────────────────────────────────┐
│        Frontend (React Native/Web)      │
│   - Expo (Mobile)                       │
│   - React + Vite (Web Portal)           │
│   - Mapbox GL (Maps)                    │
│   - Redux (State Management)            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Backend (Node.js + Express.js)        │
│   - Express API                         │
│   - Socket.io (Real-time)               │
│   - JWT Authentication                  │
│   - Rate Limiting                       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Database (PostgreSQL + PostGIS)       │
│   - Geospatial Queries                  │
│   - Event Management                    │
│   - User Data                           │
│   - Real-time Messaging                 │
└─────────────────────────────────────────┘
\`\`\`

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Git
- Python 3.8+ (optional, for virtual env)

### Installation (5 minutes)

\`\`\`bash
# 1. Backend
cd backend
npm install
echo "DATABASE_URL=postgresql://user:password@localhost/event_blinker" > .env
npm run migrate
npm start

# 2. Mobile App (in new terminal)
cd mobile
npm install
npm start

# 3. Web Portal (in new terminal)
cd web
npm install
npm run dev
\`\`\`

---

## Architecture

### Database Schema

**Users**
\`\`\`sql
- id (PK)
- email (UNIQUE)
- password_hash
- name
- user_type (organizer/user)
- avatar_url
- created_at
\`\`\`

**Events (with PostGIS)**
\`\`\`sql
- id (PK)
- organizer_id (FK)
- title
- description
- category
- start_time
- end_time
- price
- location_geom (GEOMETRY)
- capacity
- current_attendance
- status (upcoming/ongoing/completed)
- created_at
\`\`\`

**Likes, Check-ins, Messages**: Supporting tables for engagement

### API Endpoints

**Authentication**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login user

**Events**
- `GET /api/events` - List events (with geospatial filter)
- `POST /api/events` - Create event (requires auth)
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

**Engagement**
- `POST /api/likes/:event_id` - Like/unlike event
- `POST /api/checkin/:event_id` - Check in to event
- `GET /api/chat/:event_id` - Get messages
- `POST /api/chat/:event_id` - Send message

**Organizer**
- `GET /api/organizer/my-events` - Get my events
- `GET /api/organizer/analytics/:event_id` - Event analytics

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for full details.

---

## Project Structure

\`\`\`
event-blinker/
├── backend/
│   ├── server.js                    # Main API server
│   ├── config/
│   │   ├── database.js              # PostgreSQL connection
│   │   └── server.js                # Server configuration
│   ├── routes/
│   │   ├── auth.js                  # Authentication endpoints
│   │   ├── events.js                # Event CRUD
│   │   ├── likes.js                 # Like management
│   │   ├── checkins.js              # Check-in system
│   │   ├── chat.js                  # Real-time chat
│   │   └── organizer.js             # Organizer features
│   ├── middleware/
│   │   └── auth.js                  # JWT authentication
│   ├── utils/
│   │   └── socket-handler.js        # WebSocket handlers
│   ├── scripts/
│   │   └── migrate.js               # Database migration
│   └── package.json
│
├── mobile/
│   ├── App.js                       # Main app entry
│   ├── app/
│   │   ├── screens/
│   │   │   ├── MapScreen.js         # Event map discovery
│   │   │   ├── EventDetailScreen.js # Event details & actions
│   │   │   ├── LoginScreen.js       # User authentication
│   │   │   ├── ProfileScreen.js     # User profile
│   │   │   └── ChatScreen.js        # Event chat
│   │   ├── components/
│   │   │   ├── EventCard.js         # Event card component
│   │   │   └── ChatMessage.js       # Message component
│   │   ├── redux/
│   │   │   ├── store.js             # Redux store setup
│   │   │   ├── authSlice.js         # Auth state
│   │   │   └── eventSlice.js        # Events state
│   │   └── utils/
│   │       ├── api.js               # API client
│   │       └── socket.js            # Socket.io setup
│   └── package.json
│
└── web/
    ├── src/
    │   ├── pages/
    │   │   ├── LoginPage.jsx        # Auth page
    │   │   ├── DashboardPage.jsx    # Organizer dashboard
    │   │   ├── CreateEventPage.jsx  # Event creation
    │   │   └── AnalyticsPage.jsx    # Event analytics
    │   ├── components/
    │   │   ├── EventForm.jsx        # Event form
    │   │   ├── Navigation.jsx       # Nav bar
    │   │   └── Analytics.jsx        # Analytics charts
    │   ├── redux/
    │   │   ├── store.js             # Redux store
    │   │   ├── authSlice.js         # Auth slice
    │   │   └── eventSlice.js        # Event slice
    │   ├── App.jsx                  # Main app
    │   └── index.css                # Tailwind styles
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
\`\`\`

---

## Development Workflow

### 1. Start Backend
\`\`\`bash
cd backend
npm start
# Runs on http://localhost:5000
\`\`\`

### 2. Start Mobile App
\`\`\`bash
cd mobile
npm start
# Press 'i' for iOS or 'a' for Android
\`\`\`

### 3. Start Web Portal
\`\`\`bash
cd web
npm run dev
# Runs on http://localhost:5173
\`\`\`

### Running Tests
\`\`\`bash
# Backend unit tests
cd backend && npm test

# Mobile E2E tests
cd mobile && npm test

# Web portal tests
cd web && npm test
\`\`\`

---

## Deployment

### Quick Deployment Options

**AWS**: Full enterprise setup with scaling
\`\`\`bash
See DEPLOYMENT_GUIDE.md for step-by-step
\`\`\`

**Vercel** (Web Portal): 
\`\`\`bash
cd web && vercel --prod
\`\`\`

**Railway** (Backend):
\`\`\`bash
railway up
\`\`\`

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time | <200ms | ✓ |
| Map Load Time | <1s | ✓ |
| Database Query | <100ms | ✓ |
| WebSocket Latency | <50ms | ✓ |
| Error Rate | <0.1% | ✓ |

---

## Security Features

- JWT-based authentication with refresh tokens
- Password hashing with bcryptjs
- CORS protection
- Rate limiting on API endpoints
- SQL injection prevention with parameterized queries
- XSS protection with input sanitization
- HTTPS enforced in production
- Database encryption at rest
- Environment variables for sensitive data

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## Troubleshooting

### Common Issues

**Port already in use?**
\`\`\`bash
lsof -i :5000 | awk 'NR!=1 {print $2}' | xargs kill -9
\`\`\`

**Database connection failed?**
\`\`\`bash
psql -U postgres
CREATE DATABASE event_blinker;
\`\`\`

**CORS errors?**
- Check backend .env SOCKET_IO_CORS setting
- Ensure API_URL matches backend URL

---

**Built with ❤️ for event discovery enthusiasts**
