#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Crater — Development startup script
#
# Usage:
#   bash start.sh           Start everything
#   bash start.sh logs      Follow live logs
#   bash start.sh ai-logs   Follow Ollama/model pull logs
#   bash start.sh down      Stop containers
#   bash start.sh rebuild   Rebuild images, keep database data
#   bash start.sh reset     Wipe ALL volumes and rebuild from scratch
#   bash start.sh ai-reset  Wipe only Ollama model volume and pull again
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.dev.yml"
DEFAULT_AI_MODEL="llama3.2:3b"
DEFAULT_FRONTEND_PORT="5174"
DEFAULT_BACKEND_PORT="3002"
DEFAULT_DB_PORT="5433"

info()    { echo -e "${CYAN}[crater]${NC} $*"; }
success() { echo -e "${GREEN}[crater]${NC} $*"; }
warn()    { echo -e "${YELLOW}[crater]${NC} $*"; }
err()     { echo -e "${RED}[crater] ERROR:${NC} $*"; }

env_value() {
  local key="$1"
  local fallback="$2"
  local value=""
  if [ -f .env ]; then
    value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//')" || true
  fi
  echo "${value:-$fallback}"
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -Eq "[:.]${port}$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

service_running() {
  local service="$1"
  docker compose -f "$COMPOSE_FILE" ps --status=running --services 2>/dev/null | grep -qx "$service"
}

# ─── Subcommands ─────────────────────────────────────────────────────────────
case "${1:-start}" in
  logs)
    info "Following logs (Ctrl+C to stop)..."
    docker compose -f "$COMPOSE_FILE" logs -f
    exit 0
    ;;
  ai-logs)
    info "Following Ollama logs (Ctrl+C to stop)..."
    docker compose -f "$COMPOSE_FILE" logs -f ollama ollama-init
    exit 0
    ;;
  down)
    info "Stopping all containers..."
    docker compose -f "$COMPOSE_FILE" down
    success "Stopped."
    exit 0
    ;;
  rebuild)
    # Removes app containers + their anonymous volumes (e.g. stale node_modules),
    # then rebuilds images and restarts. Database volume (postgres_data) is NOT touched.
    # Ollama model volume (ollama_data) is also preserved.
    info "Rebuilding app containers (database and Ollama model data preserved)..."
    docker compose -f "$COMPOSE_FILE" rm -sfv backend frontend ollama-init
    docker compose -f "$COMPOSE_FILE" up --build -d
    success "Rebuild complete."
    exit 0
    ;;
  reset)
    warn "This deletes ALL containers, the database volume, and the Ollama model volume. Continue? [y/N]"
    read -r confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
    success "Reset complete. Run 'bash start.sh' to rebuild."
    exit 0
    ;;
  ai-reset)
    warn "This deletes the Ollama model volume only. Database data is preserved. Continue? [y/N]"
    read -r confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
    docker compose -f "$COMPOSE_FILE" stop backend ollama-init ollama || true
    docker compose -f "$COMPOSE_FILE" rm -sfv ollama-init ollama || true
    docker volume rm crater_ollama_data 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up --build -d
    success "Ollama model volume reset. Watch model pull with: bash start.sh ai-logs"
    exit 0
    ;;
  start) ;;
  *) err "Unknown command: ${1}. Use: start | logs | ai-logs | down | rebuild | reset | ai-reset"; exit 1 ;;
esac

# ─── Header ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  ╔══════════════════════════════╗${NC}"
echo -e "${BOLD}  ║   CRATER — Dev Environment   ║${NC}"
echo -e "${BOLD}  ╚══════════════════════════════╝${NC}"
echo ""

# ─── Pre-flight ───────────────────────────────────────────────────────────────

# 1. Docker available?
if ! docker info &>/dev/null; then
  err "Docker is not running or not accessible."
  echo "  If you are on Windows, run this script from inside WSL:"
  echo "    wsl"
  echo "    cd ~/projects/crater && bash start.sh"
  exit 1
fi
success "Docker is available."

# 2. .env file present?
if [ ! -f .env ]; then
  if [ ! -f .env.example ]; then
    err ".env.example is missing — cannot create .env automatically."
    exit 1
  fi
  warn ".env not found — copying from .env.example..."
  cp .env.example .env
  echo ""
  err "ACTION REQUIRED: open .env and set JWT_SECRET to a real secret."
  echo "  Generate one: openssl rand -base64 32"
  echo ""
  exit 1
fi
success ".env found."

# 3. JWT_SECRET still a placeholder?
if grep -qE "^JWT_SECRET=CHANGE_ME" .env 2>/dev/null; then
  err "JWT_SECRET in .env is still the placeholder value."
  echo "  Generate a real one: openssl rand -base64 32"
  echo "  Then paste it into .env as: JWT_SECRET=<your-value>"
  exit 1
fi
success "JWT_SECRET is configured."

# 4. Ensure local AI defaults exist for Compose interpolation.
if ! grep -qE "^LOCAL_AI_MODEL=" .env 2>/dev/null; then
  info "LOCAL_AI_MODEL not found in .env — using ${DEFAULT_AI_MODEL}."
  {
    echo ""
    echo "# Local AI"
    echo "LOCAL_AI_MODEL=${DEFAULT_AI_MODEL}"
  } >> .env
fi
AI_MODEL="$(grep -E "^LOCAL_AI_MODEL=" .env | tail -n 1 | cut -d '=' -f 2-)"
AI_MODEL="${AI_MODEL:-$DEFAULT_AI_MODEL}"
success "Local AI model configured: ${AI_MODEL}"

# 5. Host port mapping. Container ports stay fixed:
#    frontend 5173, backend 3000, postgres 5432, ollama 11434.
#    Host ports default to 5174/3002/5433 to avoid common workstation conflicts.
FRONTEND_PORT="$(env_value CRATER_FRONTEND_PORT "$DEFAULT_FRONTEND_PORT")"
BACKEND_PORT="$(env_value CRATER_BACKEND_PORT "$DEFAULT_BACKEND_PORT")"
DB_PORT="$(env_value CRATER_DB_PORT "$DEFAULT_DB_PORT")"
success "Host ports: frontend=${FRONTEND_PORT}, backend=${BACKEND_PORT}, database=${DB_PORT}"

PORT_CONFLICT=0
if port_in_use "$FRONTEND_PORT" && ! service_running frontend; then
  err "Host port ${FRONTEND_PORT} is already in use. Set CRATER_FRONTEND_PORT in .env or stop the process using it."
  PORT_CONFLICT=1
fi
if port_in_use "$BACKEND_PORT" && ! service_running backend; then
  err "Host port ${BACKEND_PORT} is already in use. Set CRATER_BACKEND_PORT in .env or stop the process using it."
  PORT_CONFLICT=1
fi
if port_in_use "$DB_PORT" && ! service_running db; then
  err "Host port ${DB_PORT} is already in use. Set CRATER_DB_PORT in .env or stop the process using it."
  PORT_CONFLICT=1
fi
if [ "$PORT_CONFLICT" -eq 1 ]; then
  echo ""
  echo "  Current mappings are controlled by .env:"
  echo "    CRATER_FRONTEND_PORT=${FRONTEND_PORT}  -> container 5173"
  echo "    CRATER_BACKEND_PORT=${BACKEND_PORT}    -> container 3000"
  echo "    CRATER_DB_PORT=${DB_PORT}              -> container 5432"
  echo ""
  echo "  Helpful checks:"
  echo "    ss -ltnp | grep -E ':(${FRONTEND_PORT}|${BACKEND_PORT}|${DB_PORT})\\b'"
  echo "    docker ps --format 'table {{.Names}}\\t{{.Ports}}'"
  exit 1
fi

# 6. Required source directories present?
MISSING=0
for dir in backend client; do
  if [ ! -d "$dir" ]; then
    err "Directory ./$dir is missing."
    MISSING=1
  fi
done
[ $MISSING -eq 1 ] && exit 1
success "Source directories found (backend, client)."

# ─── Build & Start ────────────────────────────────────────────────────────────
echo ""
info "Building images and starting services (this may take a minute on first run)..."
info "Ollama runs in Docker. First startup may be slow while '${AI_MODEL}' downloads into the ollama_data volume."
docker compose -f "$COMPOSE_FILE" up --build -d

# ─── Wait for Ollama model pull ───────────────────────────────────────────────
echo ""
info "Checking Ollama model availability..."
if docker compose -f "$COMPOSE_FILE" ps --status=running --services | grep -qx "ollama"; then
  if docker compose -f "$COMPOSE_FILE" ps --status=exited --services | grep -qx "ollama-init"; then
    success "Ollama model pull completed."
  else
    warn "Ollama model pull may still be running. Watch it with:"
    echo "  bash start.sh ai-logs"
  fi
else
  warn "Ollama is not running yet. Check logs with:"
  echo "  bash start.sh ai-logs"
fi

# ─── Wait for backend health ──────────────────────────────────────────────────
echo ""
info "Waiting for backend health check..."
MAX=60
ELAPSED=0
printf "  "
until curl -sf "http://localhost:${BACKEND_PORT}/api/health" &>/dev/null; do
  if [ $ELAPSED -ge $MAX ]; then
    echo ""
    warn "Backend didn't respond after ${MAX}s. Check logs:"
    echo "  docker compose -f $COMPOSE_FILE logs backend"
    break
  fi
  printf "."
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  All services are running.${NC}"
echo ""
echo -e "  ${BOLD}Frontend ${NC} →  http://localhost:${FRONTEND_PORT}"
echo -e "  ${BOLD}Backend  ${NC} →  http://localhost:${BACKEND_PORT}/api/health"
echo -e "  ${BOLD}Database ${NC} →  localhost:${DB_PORT}  (credentials from .env)"
echo -e "  ${BOLD}Ollama   ${NC} →  internal service: http://ollama:11434  (${AI_MODEL})"
echo ""
echo -e "  ${CYAN}bash start.sh logs   ${NC} — follow logs"
echo -e "  ${CYAN}bash start.sh ai-logs${NC} — follow Ollama/model pull logs"
echo -e "  ${CYAN}bash start.sh down   ${NC} — stop everything"
echo -e "  ${CYAN}bash start.sh rebuild${NC} — rebuild images, keep DB data"
echo -e "  ${CYAN}bash start.sh reset  ${NC} — wipe DB/Ollama data and rebuild from scratch"
echo -e "  ${CYAN}bash start.sh ai-reset${NC} — wipe Ollama model data and pull again"
echo ""
