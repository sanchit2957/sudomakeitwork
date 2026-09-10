# Sahay (Assam Rescue Platform)

A full-stack, real-time emergency disaster relief and rescue coordination system built for rapid response in flood-affected regions.

## Project Structure

```
├── frontend/             # React 19 + Vite + Tailwind CSS + Radix UI client application
│   ├── public/           # Static assets, service worker (PWA), manifests, uploads
│   └── src/              # Pages, components, hooks, contexts, and UI state
├── backend/              # Node.js + Express + tRPC API and background workers
│   ├── _core/            # Server bootstrap, security headers, Vite dev middleware
│   ├── dispatch/         # Automated responder matching engine & lifecycle workers
│   ├── routers/          # tRPC procedures & REST endpoints (SOS, donations, safety)
│   ├── tracking/         # Real-time SSE live location tracking
│   ├── weather/          # Multi-provider weather aggregation engine
│   └── db.ts             # Operational database client & connection pool
├── database/             # Drizzle ORM schema, SQL migrations & Supabase schemas
│   ├── schema.ts         # Authoritative table schemas & relations
│   ├── migrations/       # Versioned SQL migration records
│   └── supabase_schema.sql
├── shared/               # Shared constants, types, error models, and Assam geo-boundaries
├── docs/                 # Production status reports, technical audits, and implementation notes
├── scripts/              # Standalone automation and test utility scripts
└── android/              # Native Android wrapper via Capacitor
```

## Getting Started

### Prerequisites
- Node.js >= 20
- npm (bundled with Node.js)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Testing & Type Checking
```bash
npm run check    # Type-check TypeScript codebase
npm test         # Run Vitest test suites
```

## Documentation
Refer to the [docs/](./docs/) directory for detailed system audits, verification notes, and operational status logs.

## License
MIT

