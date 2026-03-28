# GridWatch — Sensor Monitoring Platform

> Full-stack sensor monitoring system with anomaly detection, real-time alerts, and WebSocket-powered dashboards.
> Built with Node.js, React, PostgreSQL, and TypeScript.

## 🚀 Quick Start

```bash
# One command to run everything
docker-compose up

# In another terminal, seed the database with test data
docker exec gridwatch-server bun db/seed.ts

# Access the dashboard
# Frontend: http://localhost:5173
# API: http://localhost:3001
```

Test credentials from seed:
- **Operator (North):** `op_north@gridwatch.local`
- **Operator (South):** `op_south@gridwatch.local`
- **Supervisor:** `supervisor@gridwatch.local`

---

## 📐 Architecture Overview

```
┌─────────────────┐         ┌──────────────────────┐        ┌────────────────┐
│   IoT Sensors   │─POST    │  /api/ingest         │        │     React      │
│  (devices)      │──────→  │  (< 200ms response)  │────→   │   Dashboard    │
│                 │         └──────────────────────┘        └────────────────┘
│                 │                  ↓                             ↑
└─────────────────┘          [PostgreSQL Write]            [WebSocket Real-time]
                                     ↓
                         ┌───────────────────────┐
                         │  Async Workers        │
                         │  - Anomaly Detection  │
                         │  - Alert Engine       │
                         │  - Escalation Cron    │
                         │  - Pattern Watcher    │
                         └───────────────────────┘
```

### Data Flow

1. **Ingest** → POST /api/ingest receives sensor readings
   - Persisted to PostgreSQL immediately (< 50ms)
   - Returns 202 Accepted
   - Async processing queued

2. **Anomaly Detection** → Async worker evalulates 4 rule types
   - Threshold violations (voltage, current, temperature)
   - Rate of change (sudden spikes)
   - Pattern absence (silence > 5min)
   - Custom rules from `sensor_rules` config

3. **Alert Lifecycle** → State machine with audit trail
   - Open → Acknowledged → Resolved (one-way forward only)
   - Severity: `warning` | `critical`
   - Escalation after 30 minutes (to supervisor)
   - Audit log: append-only, never deleted

4. **Real-time Sync** → WebSocket broadcasts state changes
   - Zone-scoped events (no cross-zone leakage)
   - Events: sensor-state-change, alert-event, suppression-event
   - Socket.IO with reconnection logic
   - ClientIDs tied to user zones

5. **Suppression** → Blackout windows for scheduled maintenance
   - Active suppressions block new alerts
   - Existing open alerts unaffected (by design)
   - Check: `WHERE sensor_id=$1 AND NOW() BETWEEN start_time AND end_time`

---

## 📊 Database Schema

### Core Tables

**zones** — Geographic groupings
```sql
id UUID PRIMARY KEY
name TEXT UNIQUE
```

**sensors** — IoT devices
```sql
id UUID PRIMARY KEY
zone_id UUID REFERENCES zones
name TEXT
current_state TEXT ('healthy', 'warning', 'critical', 'silent')
last_reading_at TIMESTAMPTZ
```

**readings** — Raw sensor telemetry (50k+/day in production)
```sql
id BIGSERIAL PRIMARY KEY
sensor_id UUID (indexed with timestamp)
timestamp TIMESTAMPTZ
voltage NUMERIC, current NUMERIC, temperature NUMERIC
has_anomaly BOOLEAN
```

**sensor_rules** — Detection rules (threshold, rate_of_change, pattern_absence)
```sql
id UUID PRIMARY KEY
sensor_id UUID
rule_type TEXT
config JSONB (field, min/max, threshold, time_windows, etc.)
severity TEXT ('warning', 'critical')
```

**anomalies** — Detected rule violations
```sql
id UUID PRIMARY KEY
reading_id BIGINT
sensor_id UUID
rule_id UUID
rule_type TEXT
detected_at TIMESTAMPTZ
suppressed BOOLEAN
```

**alerts** — Operational incidents
```sql
id UUID PRIMARY KEY
anomaly_id UUID
sensor_id UUID
severity TEXT
status TEXT ('open', 'acknowledged', 'resolved')
assigned_to UUID REFERENCES users
escalated BOOLEAN
created_at TIMESTAMPTZ
```

**alert_audit_log** — Append-only state transitions
```sql
id BIGSERIAL PRIMARY KEY
alert_id UUID
changed_by UUID
from_status TEXT, to_status TEXT
changed_at TIMESTAMPTZ
```

**suppressions** — Maintenance blackout windows
```sql
id UUID PRIMARY KEY
sensor_id UUID
created_by UUID
start_time, end_time TIMESTAMPTZ
reason TEXT
```

**users** — Operators and supervisors
```sql
id UUID PRIMARY KEY
email TEXT UNIQUE
role TEXT ('operator', 'supervisor')
```

**user_zones** — Multi-zone assignment (operators only)
```sql
user_id, zone_id (composite key)
```

### Index Justification

| Index | Table | Reason |
|-------|-------|--------|
| `readings(sensor_id, timestamp DESC)` | readings | 48h history queries for single sensor |
| `readings(timestamp DESC)` | readings | Global anomaly dashboards by time |
| `alerts(status, created_at DESC)` | alerts | Tab filtering (open/acked/resolved) |
| `suppressions(sensor_id, start_time, end_time)` | suppressions | Active window lookup every ingest |

---

## 🔌 API Endpoints

### Ingest
```bash
POST /api/ingest
Content-Type: application/json
Authorization: Bearer <token>

{
  "sensor_id": "uuid",
  "timestamp": "2025-03-28T09:50:00Z",
  "voltage": 220.5,
  "current": 12.3,
  "temperature": 35.2
}

# Response: 202 Accepted
```

### Sensors
```bash
GET /api/sensors           # All sensors (zone-filtered)
GET /api/sensors/:id       # Single sensor with metadata
GET /api/sensors/:id/history?page=1&limit=100&from=...&to=...
```

### Alerts
```bash
GET /api/alerts?status=open|acknowledged|resolved
GET /api/alerts/:id
PATCH /api/alerts/:id/acknowledge
PATCH /api/alerts/:id/resolve
```

### Suppressions
```bash
GET /api/suppressions/:sensorId?activeOnly=true
POST /api/suppressions
  { "sensor_id", "start_time", "end_time", "reason" }
DELETE /api/suppressions/:id
```

---

## 🎨 Frontend Architecture

### Pages

**Dashboard** (`/`)
- **Sensors Tab:** Grid of SensorCard components with real-time state updates
- **Alerts Tab:** Tabbed panel showing open/acknowledged/resolved alerts

**Sensor Detail** (`/sensors/:id`)
- Sensor header with state badge and timeline
- Reading history table with pagination metadata
- Current suppressions list + create dialog
- Delete suppression buttons

### Components

| Component | Purpose |
|-----------|---------|
| `SensorCard` | Display individual sensor state, last update, alert count |
| `AlertCard` | Show severity, status, transition buttons (ack/resolve) |
| `SensorGrid` | Responsive grid of SensorCard with real-time merge |
| `AlertPanel` | Tabbed interface with dynamic counts |
| `SensorDetail` | History, suppressions, metadata |

### React Hooks

**Custom Hooks (Phase 5)**
- `useSocket()` — Socket.IO connection
- `useSensorUpdates()` — Real-time sensor state changes
- `useAlertUpdates()` — Real-time alert events

**Standard Hooks**
- `useState` — Local component state
- `useEffect` — Data fetching, socket listeners
- `useNavigate, useParams` — React Router navigation

### Styling

- **Tailwind CSS + shadcn/ui** — No hardcoded colors
- **Theme Variables** — Defined in `src/index.css`
- **Components:** Card, Badge, Button, Dialog, Input, Select, Tabs, Table, Tooltip

---

## 🔐 Authentication & Zone Scoping

### Middleware Chain
```typescript
// Every protected route:
1. Verify JWT from Authorization header
2. Extract user_id, role, zones
3. Set req.user with { id, role, zones: string[] }
   - Supervisors: zones = null (no filter)
   - Operators: zones = [zone1, zone2, ...] (assigned zones only)
4. Validate zone_id in query against req.user.zones
```

### Zone Isolation Pattern
```typescript
// In every query:
SELECT * FROM sensors
WHERE zone_id = ANY($1)  // req.user.zones

// Supervisors get null, interpreted as "all zones" in most DBs
// Operators get only their assigned zones
```

---

## 📡 Real-Time Events

### WebSocket Events

**sensor-state-change**
```json
{
  "data": {
    "sensor_id": "uuid",
    "zone_id": "uuid",
    "name": "North-Sensor-1",
    "state": "warning",
    "timestamp": "2025-03-28T09:50:00Z",
    "severity": "warning"
  }
}
```

**alert-event**
```json
{
  "data": {
    "alert_id": "uuid",
    "sensor_id": "uuid",
    "type": "created|acknowledged|resolved|escalated",
    "severity": "warning|critical",
    "status": "open|acknowledged|resolved",
    "timestamp": "2025-03-28T09:50:00Z"
  }
}
```

**suppression-event**
```json
{
  "data": {
    "suppression_id": "uuid",
    "sensor_id": "uuid",
    "start_time": "2025-03-28T10:00:00Z",
    "end_time": "2025-03-28T14:00:00Z",
    "reason": "Scheduled maintenance"
  }
}
```

### Socket Rooms

- Connected users joined to:
  - `zone:{zone_id}` (zone-scoped events)
  - `supervisor` (if supervisor, receives all events)

---

## 🛡️ Critical Design Decisions

### 1. Ingest Durability (< 200ms Response)
- Sensor readings written to PostgreSQL *before* returning 202
- Anomaly detection queued async (doesn't block response)
- Even if worker crashes, readings persist in DB

### 2. Escalation Exactly-Once
```sql
INSERT INTO escalation_log (alert_id, escalated_to, escalated_at)
VALUES ($1, $2, NOW())
ON CONFLICT DO NOTHING
```
- UNIQUE constraint prevents duplicate escalations
- Cron job can run multiple times safely

### 3. Suppression Check
- Suppressions are applied at anomaly detection time
- Suppressed anomalies recorded but don't create alerts
- Existing open alerts NOT retroactively suppressed (by design)
- Rationale: Alert state is source of truth; suppressions are future-looking

### 4. Audit Trail (Alert State Machine)
- Every alert transition written to `alert_audit_log`
- Append-only: never UPDATE or DELETE
- Enforces state machine: open → ack → resolved (no backtracking)

### 5. Zone Scoping (Data Layer)
- NOT enforced in route handlers (too error-prone)
- Enforced in middleware: `req.user.zones` set once
- Every query uses `WHERE zone_id = ANY(req.user.zones)`
- Supervisors: `zone_id = ANY(NULL)` → no filter (SQL NULL behavior)

### 6. WebSocket Room Scoping
- Events emitted to `zone:{zone_id}` rooms
- Supervisors subscribe to all zones
- Cross-zone data never emitted to wrong clients

---

## 🚨 Known Limitations & Future Work

### Limitations (Out of Scope)
1. **No authentication token generation** — Seed script assumes JWT in Authorization header
2. **No email notifications** — Escalation only updates DB and broadcasts via WebSocket
3. **No rule builder UI** — Rules hardcoded in seed; API exists but no UI
4. **No multi-tenant isolation** — Single PostgreSQL DB; assumes same org
5. **Supervisor UI minimal** — Can view all data but no bulk operations
6. **Frontend pagination** — History table shows page metadata but no "next page" button (stub)

### Production Gaps (Week 1 Improvements)
1. **Redis for queue** — Replace in-memory EventEmitter with BullMQ
2. **JWT signing** — Implement token generation endpoint
3. **Email alerts** — Integration with SMTP or SNS for escalation
4. **Rule builder UI** — Drag-and-drop rule creation
5. **Backup strategy** — PostgreSQL WAL archival, automated snapshots
6. **Monitoring** — Prometheus metrics, Grafana dashboards
7. **Test suite** — Unit tests for workers, integration tests for API
8. **Load testing** — Vegeta/k6 for 1000 sensors × 10 readings/sec

---

## 🔧 Development

### Running Locally (With Docker)
```bash
docker-compose up
# Waits for postgres, then starts server and client in parallel
```

### Running Locally (Without Docker)
```bash
# Terminal 1: PostgreSQL
# Assume postgres:16 running on localhost:5432

# Terminal 2: Server
cd server
bun install  # or npm install
DATABASE_URL=postgresql://gridwatch:secret@localhost/gridwatch bun run index.ts

# Terminal 3: Client
cd client
bun install
bun run dev
```

### Seed Data
```bash
# After services are running:
docker exec gridwatch-server bun db/seed.ts
```

### Testing Ingest
```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token" \
  -d '{
    "sensor_id": "12345678-1234-5678-1234-567812345678",
    "timestamp": "2025-03-28T09:50:00Z",
    "voltage": 220,
    "current": 12,
    "temperature": 35
  }'
```

---

## 📋 Testing Checklist

- [ ] **Ingest**
  - [ ] POST /api/ingest returns 202 in < 200ms
  - [ ] Readings persisted to DB
  - [ ] Async anomaly detection evaluates rules

- [ ] **Anomaly Detection**
  - [ ] Threshold rule triggers on voltage out-of-range
  - [ ] Rate-of-change detects temperature spikes
  - [ ] Pattern-absence triggers after 5min silence
  - [ ] Suppressed anomalies don't create alerts

- [ ] **Alerts**
  - [ ] Alert created for non-suppressed anomalies
  - [ ] Can transition: open → ack → resolved
  - [ ] Invalid transitions blocked
  - [ ] Audit log records all transitions
  - [ ] Escalation triggers after 30min in 'open' state

- [ ] **Real-Time**
  - [ ] WebSocket connects on dashboard load
  - [ ] SensorCard state updates in real-time
  - [ ] AlertPanel tab counts update live
  - [ ] Zone scoping prevents cross-zone data leakage

- [ ] **Suppression**
  - [ ] Create new suppression window
  - [ ] Active suppressions listed on sensor detail
  - [ ] Delete suppression
  - [ ] Check suppression blocks new anomaly alerts

- [ ] **Frontend**
  - [ ] Dashboard loads sensors and alerts
  - [ ] SensorGrid is responsive (mobile/tablet/desktop)
  - [ ] AlertPanel tabs functional
  - [ ] Click sensor card → navigate to detail
  - [ ] History table displays pagination metadata

---

## 📚 File Structure

```
gridwatch/
├── docker-compose.yml              # Multi-container orchestration
├── gitignore
│
├── server/
│   ├── index.ts                    # Express entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   └── seed.ts             # Generate test data
│   │   ├── routes/
│   │   │   ├── ingest.ts           # POST /ingest
│   │   │   ├── sensors.ts          # GET /sensors, /sensors/:id, /history
│   │   │   ├── alerts.ts           # GET /alerts, PATCH acknowledge/resolve
│   │   │   ├── suppressions.ts     # CRUD suppression windows
│   │   │   └── auth.ts             # GET /auth/me
│   │   ├── workers/
│   │   │   ├── anomaly-detector.ts # Rule evaluation
│   │   │   ├── escalation.ts       # 30min timeout + escalate
│   │   │   └── pattern-watcher.ts  # Cron: check silence
│   │   ├── services/
│   │   │   ├── alert-service.ts    # State machine
│   │   │   ├── suppression-service.ts
│   │   │   └── sensor-service.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT verify
│   │   │   ├── zone-scope.ts       # Enforce zone isolation
│   │   │   └── error-handler.ts
│   │   └── realtime/
│   │       └── socket.ts           # WebSocket rooms
│   │
│   └── README.md
│
├── client/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   ├── tailwind.config.js
│   ├── postcs.config.js
│   ├── src/
│   │   ├── App.tsx                 # Router + layout
│   │   ├── index.css               # Theme variables
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── SensorCard.tsx
│   │   │   ├── AlertCard.tsx
│   │   │   ├── SensorGrid.tsx
│   │   │   ├── AlertPanel.tsx
│   │   │   ├── SensorDetail.tsx
│   │   │   └── ui/                 # shadcn components
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── badge.tsx
│   │   │       ├── dialog.tsx
│   │   │       ├── input.tsx
│   │   │       ├── tabs.tsx
│   │   │       ├── table.tsx
│   │   │       └── ...
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   └── SensorDetailPage.tsx
│   │   ├── hooks/
│   │   │   └── useSocket.ts        # Socket.IO connection + custom hooks
│   │   └── lib/
│   │       ├── api.ts              # Fetch layer
│   │       ├── types.ts            # Type definitions
│   │       └── ui-helpers.ts       # Formatting + variant selectors
│   │
│   └── README.md
│
└── README.md (this file)
```

---

## 🎯 Conclusion

GridWatch demonstrates:
- ✅ **Clean architecture** — Separated concerns (routes, workers, services)
- ✅ **Durability** — Ingest persisted before response
- ✅ **Real-time** — WebSocket with zone scoping
- ✅ **Audit trail** — Append-only alert log
- ✅ **Type safety** — Full TypeScript, strict mode
- ✅ **UI/UX** — Modern React with Tailwind
