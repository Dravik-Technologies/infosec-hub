@echo off
setlocal

:: ============================================================
::  MTSI Security Hub — Start All Apps
::  Run from the monorepo root:  start-all.bat
:: ============================================================

set ROOT=%~dp0

echo.
echo  ========================================
echo   MTSI Security Hub ^| Starting all apps
echo  ========================================
echo.

:: ── 1. Hub (port 3010) ────────────────────────────────────
echo [1/6] Starting Hub on port 3010...
start "Hub" cmd /k "cd /d %ROOT%hub && node server/index.js"

:: ── 2. Scorva (port 3001) ─────────────────────────────────
echo [2/6] Starting Scorva on port 3001...
start "Scorva" cmd /k "cd /d %ROOT%scorva-v1 && node server/index.js"

:: ── 3. Crater API (port 3002) ─────────────────────────────
echo [3/6] Starting Crater API on port 3002...
start "Crater-API" cmd /k "cd /d %ROOT%crater\backend && npm run dev"

:: ── 4. Crater Client (port 3003) ──────────────────────────
echo [4/6] Starting Crater Client on port 3003...
start "Crater-Client" cmd /k "cd /d %ROOT%crater\client && npm run dev"

:: ── 5. Data Fabric (port 8081) ────────────────────────────
echo [5/6] Starting Data Fabric on port 8081...
start "Data-Fabric" cmd /k "cd /d %ROOT%data-fabric && node server.js"

:: ── 6. Sentinel Security Dashboard (port 8080) ────────────
echo [6/6] Starting Sentinel Security Dashboard on port 8080...
start "Sentinel" cmd /k "cd /d %ROOT%security-dashboard && node server.js"

echo.
echo  ========================================
echo   All apps launched in separate windows.
echo.
echo   Hub            :  http://localhost:3010
echo   Scorva         :  http://localhost:3001
echo   Crater (API)   :  http://localhost:3002
echo   Crater (UI)    :  http://localhost:3003
echo   Data Fabric    :  http://localhost:8081
echo   Sentinel       :  http://localhost:8080
echo  ========================================
echo.
pause
