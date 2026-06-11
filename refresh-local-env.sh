#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-securityapp}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
RESET_DB="${RESET_DB:-1}"
START_CRATER="${START_CRATER:-0}"

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"

echo "==> Local env refresh starting"
echo "    DATABASE_URL=$DATABASE_URL"

if [ "$RESET_DB" = "1" ]; then
  echo "==> Resetting local PostgreSQL volume"
  docker compose down -v postgres >/dev/null 2>&1 || true
fi

echo "==> Starting PostgreSQL"
docker compose up -d postgres

echo "==> Waiting for PostgreSQL"
until docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 2
done

echo "==> Applying current Prisma schema"
(
  cd packages/db
  npx prisma generate
  npx prisma migrate deploy --schema prisma/schema.prisma
  npx prisma db seed --schema prisma/schema.prisma
)

echo "==> Starting local app stack"
SERVICES=(hub scorva mash lava data-fabric)

if [ "$START_CRATER" = "1" ] \
  && docker compose config --services | grep -qx "crater-api" \
  && docker compose config --services | grep -qx "crater-ui"; then
  SERVICES+=(crater-api crater-ui)
fi

echo "    Rebuilding services: ${SERVICES[*]}"
docker compose up -d --build "${SERVICES[@]}"

cat <<EOF

==> Local environment ready
    HUB     http://localhost:3010
    SCORVA  http://localhost:3000
    LAVA    http://localhost:3002
    MASH    http://localhost:8080
EOF

if [ "$START_CRATER" = "1" ]; then
cat <<EOF
    CRATER  http://localhost:${CRATER_UI_PORT:-3003}
EOF
fi

cat <<EOF

Default seeded admin:
    username: admin
    password: Admin@12345!

Useful commands:
    docker compose logs -f hub scorva mash lava
    docker compose ps
    docker compose down

To reuse your DB next time without wiping it:
    RESET_DB=0 bash refresh-local-env.sh

To include CRATER in the local stack:
    START_CRATER=1 bash refresh-local-env.sh
EOF
