# Architecture & Technical Design

## System Architecture
- Single Node.js web server serving static UI and REST endpoints
- Routing organized in `router/` with API handlers in `router/api/`
- Database layer powered by Prisma with schema in `prisma/schema.prisma` and migrations in `prisma/migrations/`
- File storage in `uploads/` and static site content in `public/`

## Components
- `server.js` — application entry and middleware setup
- `router/` — route handlers (index, admin, 404 and `api/` subroutes)
- `public/` — static HTML, CSS, JS, and reusable components
- `prisma/` — schema, migrations, and seed data
- `uploads/` — user-submitted files organized by category

## Data Flow
1. Client requests a page or an API endpoint
2. Server middleware authenticates (if implemented) and routes request
3. API endpoints interact with Prisma to query/update DB
4. File uploads are streamed to disk; metadata saved in DB
5. Responses returned as JSON (API) or static HTML views

## Technology Stack
- Runtime: Node.js
- Framework: Minimal Express-style routing (custom or `express`)
- ORM: Prisma (Postgres/SQLite configurable)
- Frontend: Static HTML/CSS/vanilla JS in `public/` (can be replaced with React/Vue)

## Extensibility Points
- Add authentication middleware (JWT or session-based) in `server.js`
- Introduce modular service layers (e.g., `services/` for business logic)
- Replace static frontend with SPA or server-side templates
- Swap DB provider via Prisma config for production (Postgres) vs local (SQLite)

## Scaling Considerations
- For modest scale, a single Node process with Postgres is sufficient
- For larger deployments, separate services: web server, API service, file storage (S3), and DB cluster
- Use caching (Redis) for session or heavy read queries
