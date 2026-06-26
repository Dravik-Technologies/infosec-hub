#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_FILE="$ROOT_DIR/scripts/seed-remote-mock-data.sql"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Seed file not found: $SQL_FILE" >&2
  exit 1
fi

if [[ -z "${PGHOST:-}" || -z "${PGUSER:-}" || -z "${PGPORT:-}" || -z "${PGPASSWORD:-}" ]]; then
  echo "Missing PostgreSQL env vars. Export PGHOST, PGUSER, PGPORT, PGPASSWORD, and optionally PGDATABASE." >&2
  exit 1
fi

DB_NAME="${PGDATABASE:-postgres}"

echo "Seeding mock data into ${PGHOST}:${PGPORT}/${DB_NAME} ..."
psql "host=${PGHOST} port=${PGPORT} user=${PGUSER} dbname=${DB_NAME} sslmode=require" -f "$SQL_FILE"
echo "Mock data seed complete."
