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

## Status

Early scaffolding. See `C:\Users\asrae\.claude\plans\` for the design plan.
