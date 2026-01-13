# 📊 Event Blinker Database Schema

## Complete Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATABASE OVERVIEW                                      │
│                          PostgreSQL + PostGIS (Location Features)                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────────────┐
                                    │      USERS       │  ◄── Central Entity
                                    │──────────────────│      (All users start here)
                                    │ id (PK)          │
                                    │ email            │
                                    │ password_hash    │
                                    │ name             │
                                    │ user_type        │ ──► 'user' | 'organizer' | 'admin'
                                    │ avatar_url       │
                                    │ phone            │
                                    │ bio              │
                                    │ is_verified      │
                                    │ created_at       │
                                    │ updated_at       │
                                    └────────┬─────────┘
                                             │
           ┌─────────────────────────────────┼─────────────────────────────────┐
           │                                 │                                 │
           ▼                                 ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│     EVENTS       │              │     RIDERS       │              │   RIDE_REQUESTS  │
│──────────────────│              │──────────────────│              │──────────────────│
│ id (PK)          │              │ id (PK)          │              │ id (PK)          │
│ organizer_id(FK) │──┐           │ user_id (FK)     │◄─┐           │ user_id (FK)     │ ──► Passenger
│ title            │  │           │ vehicle_id (FK)  │  │           │ rider_id (FK)    │ ──► Assigned Rider
│ description      │  │           │ license_id (FK)  │  │           │ pickup_address   │
│ category         │  │           │ registration_    │  │           │ dropoff_address  │
│ start_time       │  │           │   status         │  │           │ pickup_location  │ ◄─ PostGIS POINT
│ end_time         │  │           │ is_online        │  │           │ dropoff_location │ ◄─ PostGIS POINT
│ price            │  │           │ current_location │  │           │ vehicle_type     │
│ location_name    │  │           │ total_rides      │  │           │ estimated_price  │
│ location_geom    │◄─┘           │ total_earnings   │  │           │ requested_price  │
│ capacity         │  PostGIS     │ profile_photo    │  │           │ status           │ ──► pending|accepted|
│ current_attendance│  POINT      │ emergency_contact│  │           │                  │     in_progress|completed|
│ image_url        │              │ bank_name        │  │           │ distance_km      │     cancelled
│ is_active        │              │ account_number   │  │           │ created_at       │
│ is_approved      │              │ approved_at      │  │           │ completed_at     │
│ status           │              │ approved_by      │  │           └────────┬─────────┘
│ created_at       │              │ created_at       │  │                    │
└────────┬─────────┘              └────────┬─────────┘  │                    │
         │                                 │            │                    │
         │                    ┌────────────┼────────────┘                    │
         │                    │            │                                 │
         ▼                    ▼            ▼                                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   ┌──────────────────┐
│   USER_LIKES     │ │    VEHICLES      │ │ DRIVER_LICENSES  │   │  RIDE_REVIEWS    │
│──────────────────│ │──────────────────│ │──────────────────│   │──────────────────│
│ id (PK)          │ │ id (PK)          │ │ id (PK)          │   │ id (PK)          │
│ user_id (FK)     │ │ rider_id (FK)    │ │ rider_id (FK)    │   │ ride_request_id  │
│ event_id (FK)    │ │ make             │ │ license_number   │   │ user_id (FK)     │
│ created_at       │ │ model            │ │ license_photo_url│   │ rider_id (FK)    │
└──────────────────┘ │ year             │ │ expiry_date      │   │ rating           │
                     │ color            │ │ issued_date      │   │ comment          │
┌──────────────────┐ │ license_plate    │ │ issuing_authority│   │ created_at       │
│   CHECK_INS      │ │ vehicle_type     │ │ verification_    │   └──────────────────┘
│──────────────────│ │ seats_available  │ │   status         │
│ id (PK)          │ │ billbook_photo   │ │ license_holder   │
│ user_id (FK)     │ │ registration_doc │ │ date_of_birth    │
│ event_id (FK)    │ │ created_at       │ │ verified_at      │
│ checked_in_at    │ └──────────────────┘ │ verified_by      │
│ location_geom    │                      │ created_at       │
└──────────────────┘                      └──────────────────┘

┌──────────────────┐
│  CHAT_MESSAGES   │  ──► For AI chatbot with event organizers
│──────────────────│
│ id (PK)          │
│ user_id (FK)     │  ──► Can be NULL for bot messages
│ event_id (FK)    │
│ message          │
│ sender_type      │  ──► 'user' | 'bot' | 'organizer'
│ created_at       │
└──────────────────┘
```

---

## 🔗 Table Relationships Explained

### 1️⃣ **USERS → EVENTS** (One-to-Many)
```
One organizer can create MANY events
users.id  ────────►  events.organizer_id
```

### 2️⃣ **USERS → RIDERS** (One-to-One)
```
One user can become ONE rider
users.id  ────────►  riders.user_id
```

### 3️⃣ **RIDERS → VEHICLES** (One-to-One/Many)
```
One rider has ONE active vehicle
riders.vehicle_id  ────────►  vehicles.id
```

### 4️⃣ **RIDERS → DRIVER_LICENSES** (One-to-One)
```
One rider has ONE license
riders.license_id  ────────►  driver_licenses.id
```

### 5️⃣ **USERS → RIDE_REQUESTS** (Passenger)
```
One passenger can make MANY ride requests
users.id  ────────►  ride_requests.user_id
```

### 6️⃣ **RIDERS → RIDE_REQUESTS** (Driver)
```
One rider can accept MANY ride requests
riders.id  ────────►  ride_requests.rider_id
```

### 7️⃣ **USERS → USER_LIKES** (Many-to-Many via Events)
```
One user can like MANY events
One event can be liked by MANY users
users.id  ────────►  user_likes.user_id
events.id ────────►  user_likes.event_id
```

### 8️⃣ **USERS → CHECK_INS** (Many-to-Many via Events)
```
One user can check-in to MANY events
One event can have MANY check-ins
users.id  ────────►  check_ins.user_id
events.id ────────►  check_ins.event_id
```

---

## 📍 PostGIS Location Fields

Your database uses **PostGIS** for geographic queries. Here are the location fields:

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `events` | `location_geom` | `GEOMETRY(Point, 4326)` | Event venue coordinates |
| `check_ins` | `location_geom` | `GEOMETRY(Point, 4326)` | User check-in location |
| `ride_requests` | `pickup_location` | `GEOGRAPHY(Point, 4326)` | Pickup coordinates |
| `ride_requests` | `dropoff_location` | `GEOGRAPHY(Point, 4326)` | Dropoff coordinates |
| `riders` | `current_location` | `GEOGRAPHY(Point, 4326)` | Rider's real-time position |

### Example PostGIS Query:
```sql
-- Find all events within 5km of a point
SELECT * FROM events
WHERE ST_DWithin(
  location_geom::geography,
  ST_SetSRID(ST_MakePoint(85.3240, 27.7172), 4326)::geography,
  5000  -- 5km in meters
);
```

---

## 🔄 Status Workflows

### Ride Request Status:
```
                    ┌─────────────┐
        Created ──► │   pending   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌───────────────┐
       │ accepted │  │cancelled │  │rider_cancelled│
       └────┬─────┘  └──────────┘  └───────────────┘
            │
            ▼
     ┌─────────────┐
     │ in_progress │  (Rider picked up passenger)
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │  completed  │  (Trip finished)
     └─────────────┘
```

### Rider Registration Status:
```
      ┌─────────┐
      │ pending │ ──► Admin reviews documents
      └────┬────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌──────────┐ ┌──────────┐
│ approved │ │ rejected │
└──────────┘ └──────────┘
```

### Event Approval Status:
```
      ┌────────────────┐
      │ is_approved:   │
      │   false        │ ──► Created by organizer, awaiting admin
      └───────┬────────┘
              │
       Admin Approves
              │
              ▼
      ┌────────────────┐
      │ is_approved:   │
      │   true         │ ──► Visible to all users
      └────────────────┘
```

---

## 🗃️ Complete Table Structure

### USERS
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| name | VARCHAR(255) | NOT NULL | Display name |
| user_type | VARCHAR(50) | CHECK | 'user', 'organizer', or 'admin' |
| avatar_url | TEXT | | Profile picture URL |
| phone | VARCHAR(20) | | Phone number for rides |
| bio | TEXT | | User biography |
| is_verified | BOOLEAN | DEFAULT false | Organizer verification status |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation time |
| updated_at | TIMESTAMP | | Last update time |

### EVENTS
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| organizer_id | INTEGER | FOREIGN KEY (users.id) | Event creator |
| title | VARCHAR(255) | NOT NULL | Event name |
| description | TEXT | | Event details |
| category | VARCHAR(100) | | Event category |
| start_time | TIMESTAMP | NOT NULL | Event start |
| end_time | TIMESTAMP | NOT NULL | Event end |
| price | DECIMAL(10,2) | | Ticket price (NULL = free) |
| location_name | VARCHAR(255) | | Venue name |
| location_geom | GEOMETRY(Point,4326) | NOT NULL | GPS coordinates |
| capacity | INTEGER | | Maximum attendees |
| current_attendance | INTEGER | DEFAULT 0 | Current check-ins |
| image_url | TEXT | | Event banner image |
| is_active | BOOLEAN | DEFAULT true | Event visibility |
| is_approved | BOOLEAN | DEFAULT false | Admin approval |
| status | VARCHAR(50) | CHECK | 'upcoming', 'ongoing', 'completed', 'cancelled' |

### RIDERS
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| user_id | INTEGER | FOREIGN KEY, UNIQUE | Associated user account |
| vehicle_id | INTEGER | FOREIGN KEY | Current active vehicle |
| license_id | INTEGER | FOREIGN KEY | Verified license |
| registration_status | VARCHAR(50) | | 'pending', 'approved', 'rejected' |
| is_online | BOOLEAN | DEFAULT false | Accepting rides? |
| current_location | GEOGRAPHY(Point,4326) | | GPS for nearby matching |
| total_rides | INTEGER | DEFAULT 0 | Completed trip count |
| total_earnings | DECIMAL(10,2) | DEFAULT 0 | Lifetime earnings |
| profile_photo_url | TEXT | | Rider's photo |
| emergency_contact | VARCHAR(20) | | Emergency phone |
| bank_name | VARCHAR(100) | | Payment bank |
| account_number | VARCHAR(50) | | Payment account |
| approved_at | TIMESTAMP | | Approval date |
| approved_by | INTEGER | | Admin who approved |

### VEHICLES
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| rider_id | INTEGER | FOREIGN KEY | Owner (users.id) |
| make | VARCHAR(100) | NOT NULL | Brand (e.g., Honda) |
| model | VARCHAR(100) | NOT NULL | Model (e.g., Civic) |
| year | INTEGER | NOT NULL | Manufacturing year |
| color | VARCHAR(50) | | Vehicle color |
| license_plate | VARCHAR(20) | UNIQUE | Registration number |
| vehicle_type | VARCHAR(50) | | 'motorcycle', 'sedan', 'suv' |
| seats_available | INTEGER | DEFAULT 4 | Passenger capacity |
| billbook_photo_url | TEXT | | Registration document |
| registration_document_url | TEXT | | Additional docs |

### DRIVER_LICENSES
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| rider_id | INTEGER | FOREIGN KEY | License holder (users.id) |
| license_number | VARCHAR(50) | UNIQUE, NOT NULL | Official license number |
| license_photo_url | TEXT | NOT NULL | Photo of license |
| expiry_date | DATE | NOT NULL | License expiration |
| issued_date | DATE | | License issue date |
| issuing_authority | VARCHAR(100) | | Issuing office |
| license_holder_name | VARCHAR(200) | | Name on license |
| date_of_birth | DATE | | DOB on license |
| verification_status | VARCHAR(50) | | 'pending', 'approved', 'rejected' |
| verified_at | TIMESTAMP | | Verification time |
| verified_by | INTEGER | | Admin who verified |

### RIDE_REQUESTS
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| user_id | INTEGER | FOREIGN KEY | Passenger |
| rider_id | INTEGER | FOREIGN KEY | Assigned driver |
| pickup_address | TEXT | NOT NULL | Human-readable pickup |
| dropoff_address | TEXT | NOT NULL | Human-readable dropoff |
| pickup_location | GEOGRAPHY(Point,4326) | | GPS pickup point |
| dropoff_location | GEOGRAPHY(Point,4326) | | GPS dropoff point |
| vehicle_type | VARCHAR(50) | | Requested vehicle type |
| estimated_price | DECIMAL(10,2) | | System-calculated fare |
| requested_price | DECIMAL(10,2) | | Final negotiated fare |
| distance_km | DECIMAL(6,2) | | Trip distance |
| status | VARCHAR(50) | | 'pending', 'accepted', 'in_progress', 'completed', 'cancelled' |
| created_at | TIMESTAMP | DEFAULT NOW() | Request time |
| completed_at | TIMESTAMP | | Trip completion time |

---

## 🔍 Common Queries Used in Your App

### Find Nearby Events (5km radius):
```sql
SELECT * FROM events
WHERE is_active = true AND is_approved = true
  AND ST_DWithin(
    location_geom::geography,
    ST_SetSRID(ST_MakePoint($longitude, $latitude), 4326)::geography,
    5000
  )
ORDER BY start_time ASC;
```

### Find Pending Ride Requests Near Rider:
```sql
SELECT rr.*, u.name as passenger_name
FROM ride_requests rr
JOIN users u ON rr.user_id = u.id
WHERE rr.status = 'pending'
  AND ST_DWithin(
    rr.pickup_location,
    ST_SetSRID(ST_MakePoint($rider_lng, $rider_lat), 4326)::geography,
    10000  -- 10km
  )
ORDER BY ST_Distance(rr.pickup_location, ST_SetSRID(ST_MakePoint($rider_lng, $rider_lat), 4326)::geography);
```

### Get Rider Earnings:
```sql
SELECT 
  SUM(CASE WHEN DATE(completed_at) = CURRENT_DATE THEN requested_price ELSE 0 END) as today,
  SUM(CASE WHEN completed_at >= NOW() - INTERVAL '7 days' THEN requested_price ELSE 0 END) as this_week,
  SUM(requested_price) as total
FROM ride_requests
WHERE rider_id = $rider_id AND status = 'completed';
```

---

This schema supports your complete Event Blinker ecosystem:
- **Event Discovery** with location-based search
- **Ride Sharing** with real-time driver matching
- **User Authentication** with role-based access
- **Admin Management** with approval workflows
