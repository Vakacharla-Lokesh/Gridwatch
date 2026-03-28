# GridWatch Client — React Dashboard UI

> Modern React 19 dashboard with real-time WebSocket updates, built with TypeScript, Tailwind CSS, and shadcn/ui components.

## 📁 Project Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx      # Home page + feature overview
│   │   ├── LoginPage.tsx         # Email-based authentication
│   │   ├── Dashboard.tsx         # Main app (sensors + alerts tabs)
│   │   └── SensorDetailPage.tsx  # Single sensor with history
│   ├── components/
│   │   ├── SensorCard.tsx        # Grid item for sensor
│   │   ├── SensorGrid.tsx        # Paginated sensor list
│   │   ├── AlertCard.tsx         # Alert item with actions
│   │   ├── AlertPanel.tsx        # Tabbed alert view
│   │   ├── SensorDetail.tsx      # History + suppressions
│   │   ├── ProtectedRoute.tsx    # Auth guard wrapper
│   │   └── ui/                   # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── badge.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── tooltip.tsx
│   │       └── select.tsx
│   ├── lib/
│   │   ├── auth.tsx              # AuthContext + useAuth hook
│   │   ├── api.ts                # Fetch layer with error handling
│   │   ├── types.ts              # TypeScript interfaces
│   │   ├── ui-helpers.ts         # UI formatting + state variants
│   │   └── utils.ts              # cn() utility (tailwind-merge)
│   ├── hooks/
│   │   └── useSocket.ts          # Socket.IO listeners + state
│   ├── App.tsx                   # Root router + providers
│   ├── main.tsx                  # Entry point
│   ├── App.css                   # Global styles (empty)
│   ├── index.css                 # Tailwind + theme variables
│   └── vite-env.d.ts
├── .env.example                  # Environment template
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md (this file)
```

---

## 🚀 Getting Started

### Install

```bash
cd client
bun install
```

### Development

```bash
# Start dev server (Vite with HMR)
bun run dev

# Open http://localhost:5173
```

### Production Build

```bash
# Build + optimize
bun run build

# Preview offline
bun run preview
```

### Type Checking

```bash
# Check TypeScript only (no emit)
bun run build  # Includes tsc -b check in pipeline
```

---

## 🔐 Authentication Flow

### 1. Landing Page
- Public page with product overview
- "Sign In" button → `/login`

### 2. Login Page
- Email-based input (demo mode: no password)
- Quick-login buttons for test accounts
- On success: JWT token → localStorage
- Redirect: `/dashboard`

### 3. Protected Dashboard
- `ProtectedRoute` component checks `useAuth()`
- If no user: redirects to `/login`
- If loading: shows spinner
- If authenticated: renders main dashboard

### 4. Logout
- Header logout button clears token and logged-in state
- Redirects to `/login`

---

## 📊 Components

### Page-Level

**LandingPage** — Product overview
- Feature grid (6 cards)
- Tech stack section
- CTA buttons
- Footer

**LoginPage** — Authentication entry
- Email input form
- Quick-login buttons (test accounts)
- Demo info badge
- Error handling

**Dashboard** — Main app (tab switcher)
- Sensors tab: `<SensorGrid />`
- Alerts tab: `<AlertPanel />`
- Header with logout

**SensorDetailPage** — Single sensor view
- Back button
- Sensor header (state, counts)
- Suppression manager
- History table (paginated)

### Reusable Components

**SensorCard** — Grid item
```
┌─────────────────────────┐
│ Name          [Badge]   │
│ Zone: North             │
│ Last: 5m ago            │
│ Readings: 500           │
│ Alerts: 2 open          │
│ [View Details →]        │
└─────────────────────────┘
```

**AlertCard** — Alert item
```
┌──────────────────────────────┐
│ Sensor-1  [σ critical]       │
│ Zone: North     [⚠ open]     │
│ Created 3m ago               │
│                              │
│ [Acknowledge]  [Resolve]     │
└──────────────────────────────┘
```

**SensorGrid** — 3-column responsive grid
- Displays all sensors as cards
- Loading skeleton (6 items)
- Real-time state updates
- Empty state handling

**AlertPanel** — Tabs by status
```
[Open (5)]  [Acknowledged (2)]  [Resolved (12)]
┌────────────────────────────────┐
│ AlertCard × 5                  │
└────────────────────────────────┘
```

**SensorDetail** — Sensor full view
```
┌─────────────────────────────────┐
│ North-Sensor-1      [healthy]   │
│ Readings: 500  Alerts: 2        │
│                                 │
│ [SUPPRESSIONS]                  │
│ Active: 0                       │
│ [+ Add Suppression]             │
│                                 │
│ [HISTORY] (paginated)           │
│ Timestamp | V | I | T | Status  │
│ ...       |...|...|...|...      │
└─────────────────────────────────┘
```

---

## 🎨 Styling & Theming

### Design System
- **CSS Framework:** Tailwind CSS 4.2
- **Component Library:** shadcn/ui (9 components)
- **Color Scheme:** CSS custom properties in `index.css`
- **No Hardcoded Colors:** Use Tailwind classes (e.g., `bg-background`, `text-destructive`)

### Responsive Breakpoints
```
Mobile:  1 column
Tablet:  2 columns (md:grid-cols-2)
Desktop: 3 columns (lg:grid-cols-3)
```

### State Variants
```typescript
// ui-helpers.ts
getSensorStateVariant('healthy')    → 'default'      (green)
getSensorStateVariant('warning')    → 'secondary'    (yellow)
getSensorStateVariant('critical')   → 'destructive'  (red)
getSensorStateVariant('silent')     → 'outline'      (gray)
```

---

## 🔄 Real-Time Integration

### WebSocket Hook Pattern

```typescript
// In component
const { sensors, error } = useSensorUpdates();

// Hook maintains state
useSocket()  // Initialize connection
useEffect(() => {
  socket.on('sensor-state-change', (event) => {
    setSensors(prev => merge(prev, event));
  });
}, [socket]);
```

### State Merging Strategy

```typescript
// Initial state from API
const [sensors, setSensors] = useState(fetchedSensors);

// Real-time updates
useEffect(() => {
  realtimeUpdates.forEach(update => {
    setSensors(prev => 
      prev.map(s => s.id === update.sensor_id ? {...s, ...update} : s)
    );
  });
}, [realtimeUpdates]);
```

**Why:** Instant visual feedback without page refresh.

---

## 📡 API Client

### Usage Pattern

```typescript
import { fetchSensors, acknowledgeAlert } from '@/lib/api';

// Fetch
const sensors = await fetchSensors();

// Mutate
await acknowledgeAlert(alertId);
```

### Error Handling
```typescript
try {
  await fetchSensors();
} catch (error) {
  // Error formatted as: "Failed: <endpoint> - <message>"
  console.error(error.message);
}
```

### Authentication
- Token stored in `localStorage`
- Added to every request: `Authorization: Bearer <token>`
- Auto-refresh: On 401 → redirect to login

---

## 🧩 Type Safety

### Core Types

```typescript
// src/lib/types.ts

interface Sensor {
  id: string;
  zone_id: string;
  name: string;
  current_state: 'healthy' | 'warning' | 'critical' | 'silent';
  reading_count: number;
  open_alerts: number;
  last_reading_at: string | null;
}

interface Alert {
  id: string;
  sensor_id: string;
  severity: 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
  // ... 10 more fields
}

interface Reading {
  id: number;
  timestamp: string;
  voltage: number;
  current: number;
  temperature: number;
  has_anomaly: boolean;
}
```

**Every component receives typed props**, preventing runtime errors.

---

## 🚀 Performance

### Code Splitting
- Vite auto-splits routes (lazy load pages)
- Each page loaded on-demand

### Bundle Size
- Main JS: 415KB gzipped (including React 19 + routing + Socket.IO)
- CSS: 55KB gzipped (Tailwind)

### Optimization Opportunities
- [ ] Image optimization (no images currently)
- [ ] Memoize components (`React.memo` for AlertCard)
- [ ] Lazy load tables (virtual scrolling)
- [ ] IndexedDB for offline readings cache

---

## 🧪 Testing

### Manual Testing

**Login Flow:**
```bash
1. Navigate to http://localhost:5173
2. Click "Get Started"
3. Enter: op_north@gridwatch.local
4. Click "Sign In"
5. Verify redirected to /dashboard
```

**Real-Time Updates:**
```bash
1. Open DevTools → Network → WS
2. Verify socket connection established
3. POST sensor reading to /api/ingest
4. Watch SensorGrid update in <100ms
```

**Zone Scoping:**
```bash
1. Login as op_north
2. Verify only North zone sensors visible
3. Switch to op_south (new session)
4. Verify only South zone sensors visible
```

### Automated Tests (Future)
- E2E: Playwright (route navigation, form submission)
- Unit: Vitest (formatters, helpers)
- Integration: MSW (mock API responses)

---

## 🛠️ Environment Variables

```bash
# .env.example
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
VITE_ENV=development
```

---

## 🎯 Key Design Decisions

### Why AuthContext Over Redux
- Simpler mental model (React built-in)
- Sufficient for 2 auth-related pieces of state (user, token)
- Avoids boilerplate for simple use case

### Why localStorage (Not Cookies)
- localStorage persists across tab closes
- No httpOnly flag (intentional: SPA auth pattern)
- Production: use secure httpOnly cookies + CSRF tokens

### Why Socket.IO (Not Raw WebSocket)
- Automatic reconnection
- Fallback transports (long-polling if WebSocket fails)
- Built-in rooms system
- Wide language support (Python, Go, etc.)

### Why shadcn/ui (Not Ant Design)
- Lightweight (copy components to repo, not npm dep)
- Headless + unstyled (full Tailwind control)
- TypeScript-first
- No CSS-in-JS bundle size

---

## 🚀 Production Checklist

- [ ] Update `VITE_API_URL` to production backend
- [ ] Set `VITE_ENV=production`
- [ ] Enable Content Security Policy headers
- [ ] Validate token before rendering (not just in hook)
- [ ] Add error boundary (catch React errors)
- [ ] Implement request debouncing for search
- [ ] Test on mobile + tablets
- [ ] Verify CORS headers from backend
- [ ] Add analytics tracking
- [ ] Monitor performance (Sentry for errors)

---

**Last Updated:** March 28, 2026
