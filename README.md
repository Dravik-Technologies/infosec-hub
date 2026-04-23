# security-app-factory

Monorepo for the Security App Factory applications, with a shared PostgreSQL schema in `packages/db/prisma/schema.prisma`.

## Local database setup

Use Node 18+ locally. The current Prisma 5.22.0 CLI in this repo does not run correctly on Node 12.

Prisma requires `DATABASE_URL` before `generate`, `migrate`, `studio`, or `db seed` commands will work.

This repo is configured for the local Docker Postgres defaults used elsewhere in the project:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=securityapp
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/securityapp
```

Local env files:

- `.env` for root-level scripts like `setup-db.sh`
- `packages/db/.env` for direct Prisma CLI usage inside `packages/db`
- `.env.example` and `packages/db/.env.example` as templates for teammates

## Quick start

1. Start PostgreSQL and initialize Prisma:

```bash
bash setup-db.sh
```

2. Run shared Prisma commands:

```bash
cd packages/db
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

If you point the repo at a different database, update both `.env` and `packages/db/.env` so runtime code and Prisma CLI commands stay aligned.
