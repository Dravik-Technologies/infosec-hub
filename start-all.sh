#!/usr/bin/env bash
# ============================================================
#  MTSI Security Hub — Start All Apps (bash / Git Bash)
#  Run from the monorepo root:  bash start-all.sh
# ============================================================

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONGOD="/c/Users/chris.macabugao/web-applications/mongodb-win32-x86_64-windows-8.2.6/bin/mongod.exe"
MONGO_DATA="$ROOT/scorva-v1/mongodb-data"
MONGO_LOG="$MONGO_DATA/mongod.log"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

header() { echo -e "\n${CYAN}  ========================================${NC}"; }
label()  { echo -e "  ${YELLOW}$1${NC}"; }

header
echo -e "  ${GREEN}MTSI Security Hub | Starting all apps${NC}"
header

# ── 0. Remove stale WiredTiger lock ─────────────────────────
if [ -f "$MONGO_DATA/WiredTiger.lock" ]; then
  echo -e "\n${YELLOW}[MongoDB]${NC} Removing stale WiredTiger.lock..."
  rm -f "$MONGO_DATA/WiredTiger.lock"
fi

# ── 1. MongoDB (port 27017) ──────────────────────────────────
label "[1/7] Starting MongoDB on port 27017..."
"$MONGOD" --dbpath "$MONGO_DATA" --port 27017 --logpath "$MONGO_LOG" --logappend &
MONGO_PID=$!
sleep 2

# ── 2. Hub (port 3010) ──────────────────────────────────────
label "[2/7] Starting Hub on port 3010..."
(cd "$ROOT/hub" && node server/index.js) &
HUB_PID=$!

# ── 3. Scorva (port 3001) ───────────────────────────────────
label "[3/7] Starting Scorva on port 3001..."
(cd "$ROOT/scorva-v1" && node server/index.js) &
SCORVA_PID=$!

# ── 4. Crater API — eMASS server (port 3002) ────────────────
label "[4/7] Starting Crater API on port 3002..."
(cd "$ROOT/emass-app/server" && npx tsx watch src/server.ts) &
CRATER_API_PID=$!

# ── 5. Crater Client — eMASS Vite (port 3003) ───────────────
label "[5/7] Starting Crater Client on port 3003..."
(cd "$ROOT/emass-app" && npx vite) &
CRATER_UI_PID=$!

# ── 6. Data Fabric (port 8081) ──────────────────────────────
label "[6/7] Starting Data Fabric on port 8081..."
(cd "$ROOT/data-fabric" && node server.js) &
DATAFABRIC_PID=$!

# ── 7. MASH Security Dashboard (port 8080) ──────────────────
label "[7/7] Starting MASH Security Dashboard on port 8080..."
(cd "$ROOT/security-dashboard" && node server.js) &
MASH_PID=$!

echo -e "\n${GREEN}  ========================================${NC}"
echo -e "  All apps running. PIDs:"
echo -e "  MongoDB       PID $MONGO_PID   :27017"
echo -e "  Hub           PID $HUB_PID     :3010"
echo -e "  Scorva        PID $SCORVA_PID  :3001"
echo -e "  Crater API    PID $CRATER_API_PID :3002"
echo -e "  Crater UI     PID $CRATER_UI_PID  :3003"
echo -e "  Data Fabric   PID $DATAFABRIC_PID :8081"
echo -e "  MASH          PID $MASH_PID    :8080"
echo -e "${GREEN}  ========================================${NC}"
echo -e "\n  Press ${RED}Ctrl+C${NC} to stop all apps.\n"

# Wait for all background jobs; Ctrl+C kills them all
trap 'echo -e "\n\nShutting down all apps..."; kill $MONGO_PID $HUB_PID $SCORVA_PID $CRATER_API_PID $CRATER_UI_PID $DATAFABRIC_PID $MASH_PID 2>/dev/null; exit 0' INT TERM

wait
