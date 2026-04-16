@echo off
setlocal

:: ============================================================
::  MTSI Security Hub — Start All Apps
::  Run from the monorepo root:  start-all.bat
:: ============================================================

set ROOT=%~dp0
set MONGOD=C:\Users\chris.macabugao\web-applications\mongodb-win32-x86_64-windows-8.2.6\bin\mongod.exe
set MONGO_DATA=%ROOT%scorva-v1\mongodb-data
set MONGO_LOG=%ROOT%scorva-v1\mongodb-data\mongod.log

echo.
echo  ========================================
echo   MTSI Security Hub ^| Starting all apps
echo  ========================================
echo.

:: ── 0. Remove stale WiredTiger lock if present ─────────────
if exist "%MONGO_DATA%\WiredTiger.lock" (
    echo [MongoDB] Removing stale WiredTiger.lock...
    del /f "%MONGO_DATA%\WiredTiger.lock"
)

:: ── 1. MongoDB (port 27017) ────────────────────────────────
echo [1/6] Starting MongoDB on port 27017...
start "MongoDB" "%MONGOD%" --dbpath "%MONGO_DATA%" --port 27017 --logpath "%MONGO_LOG%" --logappend
timeout /t 2 /nobreak >nul

:: ── 2. Hub (port 3010) ────────────────────────────────────
echo [2/6] Starting Hub on port 3010...
start "Hub" cmd /k "cd /d %ROOT%hub && node server/index.js"

:: ── 3. Scorva (port 3001) ─────────────────────────────────
echo [3/6] Starting Scorva on port 3001...
start "Scorva" cmd /k "cd /d %ROOT%scorva-v1 && node server/index.js"

:: ── 4. Crater API — eMASS server (port 3002) ──────────────
echo [4/6] Starting Crater API on port 3002...
start "Crater-API" cmd /k "cd /d %ROOT%emass-app\server && npx tsx watch src/server.ts"

:: ── 5. Crater Client — eMASS Vite (port 3003) ─────────────
echo [5/6] Starting Crater Client on port 3003...
start "Crater-Client" cmd /k "cd /d %ROOT%emass-app && npx vite"

:: ── 6. Data Fabric (port 8081) ────────────────────────────
echo [6/6] Starting Data Fabric on port 8081...
start "Data-Fabric" cmd /k "cd /d %ROOT%data-fabric && node server.js"

:: ── 7. MASH Security Dashboard (port 8080) ────────────────
echo [7/7] Starting MASH Security Dashboard on port 8080...
start "MASH" cmd /k "cd /d %ROOT%security-dashboard && node server.js"

echo.
echo  ========================================
echo   All apps launched in separate windows.
echo.
echo   MongoDB        :  27017
echo   Hub            :  http://localhost:3010
echo   Scorva         :  http://localhost:3001
echo   Crater (API)   :  http://localhost:3002
echo   Crater (UI)    :  http://localhost:3003
echo   Data Fabric    :  http://localhost:8081
echo   MASH           :  http://localhost:8080
echo  ========================================
echo.
pause
