# Gestión Patrimonial

Personal financial planner — net worth tracking, multi-bank ingestion, debt modelling, future-event forecasting and optimization insights.

## Stack

- **Backend:** Node.js 22 LTS + Fastify + Drizzle ORM + Zod + decimal.js
- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS v4 + shadcn/ui + TanStack Query/Table + Visx
- **DB:** PostgreSQL 16 (UUIDv7 ids, `numeric` for money, `timestamptz` everywhere, soft-delete via `deleted_at`)
- **Monorepo:** pnpm workspaces · Biome · Lefthook
- **Infra:** Docker Compose (local), OCI ARM Ampere A1 (production), Caddy + Let's Encrypt

## Layout

```
apps/
  api/        # Fastify + Drizzle backend
  web/        # Next.js 15 frontend
packages/
  shared/     # Zod schemas, enums, shared types
infra/
  docker-compose.yml
```

## Quick start (local development)

Prerequisites: Node.js 22, pnpm 9, Docker.

```bash
# Install workspace dependencies
pnpm install

# Start Postgres (only — api and web run on host for fast iteration)
cd infra && docker compose up -d postgres

# Apply schema to the database
cd .. && cp .env.example .env  # edit JWT_SECRET to be 32+ chars
pnpm --filter @gp/api db:push

# Run api (port 8000) and web (port 3000) — open two terminals
pnpm --filter @gp/api dev
pnpm --filter @gp/web dev
```

Visit `http://localhost:3000`. The dashboard lives at `/dashboard`.

## Production deployment (OCI ARM A1)

```bash
cd infra
cp .env.example .env  # set real JWT_SECRET, CORS_ORIGIN, PUBLIC_API_URL
docker compose --profile prod up -d
```

Caddy handles HTTPS via Let's Encrypt automatically. Edit `infra/caddy/Caddyfile`
to set the real domain.

## Status

Early scaffolding. See `C:\Users\asrae\.claude\plans\` for the design plan.
