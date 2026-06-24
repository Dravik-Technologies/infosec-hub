#!/usr/bin/env bash
# setup-db.sh — Run inside WSL to initialize the PostgreSQL database.
# Usage: bash setup-db.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-securityapp}"

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"

echo "==> Starting PostgreSQL container..."
docker compose up -d postgres

echo "==> Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; do
  echo "    ... still waiting"
  sleep 2
done
echo "    PostgreSQL is ready."

echo "==> Installing packages/db dependencies..."
cd packages/db
npm install

echo "==> Running Prisma migration (init)..."
npx prisma migrate dev --name init

echo "==> Seeding database (sites + users)..."
npx prisma db seed

echo ""
echo "==> Database setup complete!"
echo "    Sites:  MTSI Alexandria (MTSI-ALX), MTSI Huntsville (MTSI-HVL)"
echo "    Admin:  username=admin  password=value of SEED_ADMIN_PASSWORD (or fallback dev password)"
echo "    URL:    $DATABASE_URL"
