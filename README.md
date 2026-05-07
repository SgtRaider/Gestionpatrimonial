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

Prerequisites: Node.js 22, pnpm 9, PostgreSQL 16 or 17 (Docker optional).

```bash
# 1. Install dependencies
pnpm install

# 2. Postgres
# Either use Docker:
cd infra && docker compose up -d postgres && cd ..
# Or install Postgres 17 natively (Windows):
#   winget install PostgreSQL.PostgreSQL.17 --silent --override "--mode unattended --superpassword postgres"
# Then create the role and DB:
#   psql -U postgres -h localhost -p 5433 -c "CREATE ROLE gp_user WITH LOGIN PASSWORD 'gp_password' CREATEDB;"
#   psql -U postgres -h localhost -p 5433 -c "CREATE DATABASE gestionpatrimonial OWNER gp_user;"

# 3. Configure env
cp .env.example .env
# Make sure DATABASE_URL points to the right port (5432 docker / 5433 native PG 17 alongside an existing PG 16)
# JWT_SECRET must be 32+ chars

# 4. Apply schema and seed sample data
pnpm --filter @gp/api db:migrate
pnpm --filter @gp/api db:seed

# 5. Run api (port 8000) and web (port 3000) — two terminals
pnpm --filter @gp/api dev
pnpm --filter @gp/web dev
```

Visit `http://localhost:3000`. The dashboard lives at `/dashboard`,
movimientos at `/cuentas/movimientos`.

### Database scripts

- `pnpm --filter @gp/api db:generate` — generate a new SQL migration from
  current Drizzle schema diff.
- `pnpm --filter @gp/api db:migrate` — apply pending migrations.
- `pnpm --filter @gp/api db:push` — push schema directly (dev only,
  bypasses migrations).
- `pnpm --filter @gp/api db:seed` — wipe and reseed with the sample
  dataset (4 institutions, 5 accounts, 14 categories, 33 transactions).
- `pnpm --filter @gp/api db:studio` — open drizzle-kit studio web UI.

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
