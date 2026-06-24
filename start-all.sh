#!/usr/bin/env bash
# ============================================================
#  MTSI Security Hub — Start All Apps (bash / Git Bash)
#  Run from the monorepo root:  bash start-all.sh
# ============================================================

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

header() { echo -e "\n${CYAN}  ========================================${NC}"; }
label()  { echo -e "  ${YELLOW}$1${NC}"; }

header
echo -e "  ${GREEN}MTSI Security Hub | Starting all apps${NC}"
header

# ── 1. Hub (port 3010) ──────────────────────────────────────
label "[1/6] Starting Hub on port 3010..."
(cd "$ROOT/hub" && node server/index.js) &
HUB_PID=$!

# ── 2. Scorva (port 3001) ───────────────────────────────────
label "[2/6] Starting Scorva on port 3001..."
(cd "$ROOT/scorva-v1" && node server/index.js) &
SCORVA_PID=$!

# ── 3. Crater API (port 3002) ───────────────────────────────
label "[3/6] Starting Crater API on port 3002..."
(cd "$ROOT/crater/backend" && npm run dev) &
CRATER_API_PID=$!

# ── 4. Crater Client (port 3003) ────────────────────────────
label "[4/6] Starting Crater Client on port 3003..."
(cd "$ROOT/crater/client" && npm run dev) &
CRATER_UI_PID=$!

# ── 5. Data Fabric (port 8081) ──────────────────────────────
label "[5/6] Starting Data Fabric on port 8081..."
(cd "$ROOT/data-fabric" && node server.js) &
DATAFABRIC_PID=$!

# ── 6. Sentinel Security Dashboard (port 8080) ──────────────
label "[6/6] Starting Sentinel Security Dashboard on port 8080..."
(cd "$ROOT/security-dashboard" && node server.js) &
MASH_PID=$!

echo -e "\n${GREEN}  ========================================${NC}"
echo -e "  All apps running. PIDs:"
echo -e "  Hub           PID $HUB_PID     :3010"
echo -e "  Scorva        PID $SCORVA_PID  :3001"
echo -e "  Crater API    PID $CRATER_API_PID :3002"
echo -e "  Crater UI     PID $CRATER_UI_PID  :3003"
echo -e "  Data Fabric   PID $DATAFABRIC_PID :8081"
echo -e "  Sentinel      PID $MASH_PID    :8080"
echo -e "${GREEN}  ========================================${NC}"
echo -e "\n  Press ${RED}Ctrl+C${NC} to stop all apps.\n"

# Wait for all background jobs; Ctrl+C kills them all
trap 'echo -e "\n\nShutting down all apps..."; kill $HUB_PID $SCORVA_PID $CRATER_API_PID $CRATER_UI_PID $DATAFABRIC_PID $MASH_PID 2>/dev/null; exit 0' INT TERM

wait
