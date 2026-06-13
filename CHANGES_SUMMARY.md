# MASH → Sentinel & Site Standardization - Changes Summary

## ✅ Completed Changes

### 1. **Hub App List Renamed** ✓
**File:** `hub/server/index.js`
```javascript
// Changed from:
{ id: 'mash', name: 'MASH', tagline: 'MTSI Advanced Sentinel Hub', ... }

// Changed to:
{ id: 'sentinel', name: 'Sentinel', tagline: 'Security Operations Center', ... }
```

**Result:** Hub Portal now displays "Sentinel" in the app launcher

---

### 2. **Database Seed Updated** ✓
**File:** `packages/db/prisma/seed.js`

#### Old Sites (Removed):
- ❌ MTSI-ALX → Alexandria
- ❌ MTSI-HVL → Huntsville

#### New Sites (Added):
- ✅ MTSI-VA → Virginia
- ✅ MTSI-OH → Ohio
- ✅ MTSI-LV → Las Vegas
- ✅ MTSI-CO → Colorado
- ✅ MTSI-STL → St. Louis
- ✅ MTSI-AL → Alabama
- ✅ MTSI-FL → Florida

#### Test Users:
- Admin: Access to all 7 sites
- va.user: MTSI-VA only
- al.user: MTSI-AL only

---

### 3. **Docker Compose Updated** ✓
**File:** `docker-compose.yml`
- Comment changed from `MASH` to `Sentinel`
- JWT secret name updated for clarity
- Service still named `mash` (directory name kept for compatibility)

---

### 4. **Sentinel Test Files Updated** ✓
**File:** `security-dashboard/__tests__/tenantScope.test.js`
- All references to `MTSI-ALX` → `MTSI-VA`
- All references to `MTSI-HVL` → `MTSI-OH`
- Tests now validate with new site IDs

---

### 5. **Sentinel Library Comments Updated** ✓
**File:** `security-dashboard/lib/tenantScope.js`
- Updated comments to reflect site ID logic (no longer hardcoded to specific sites)

---

## 🔄 Files Modified

| File | Changes |
|------|---------|
| `hub/server/index.js` | App name: MASH → Sentinel |
| `packages/db/prisma/seed.js` | Sites: 2 old → 7 new; Users: updated references |
| `docker-compose.yml` | Comment & JWT secret naming |
| `security-dashboard/__tests__/tenantScope.test.js` | Site ID references |
| `security-dashboard/lib/tenantScope.js` | Comment clarification |

---

## 🚀 Next Steps

### Step 1: Reset Database
```bash
export POSTGRES_PORT=5433
docker compose down postgres
docker volume rm security-app-factory_postgres_data
docker compose up -d postgres
sleep 10
```

### Step 2: Run Seed
```bash
cd packages/db
npx prisma db seed
cd ../..
```

### Step 3: Rebuild Apps
```bash
export POSTGRES_PORT=5433
docker compose up -d --build --force-recreate hub scorva crater mash lava
sleep 15
```

### Step 4: Verify
```bash
# Check Hub app list
curl http://localhost:3010/api/apps | jq '.[] | select(.id=="sentinel") | {name, tagline}'

# Output should be:
# {
#   "name": "Sentinel",
#   "tagline": "Security Operations Center"
# }
```

---

## 📋 Verification Checklist

After applying changes:

- [ ] Hub displays **"Sentinel"** in portal (not "MASH")
- [ ] Sentinel app launches from Hub
- [ ] Database contains 7 new sites (MTSI-VA, MTSI-OH, etc.)
- [ ] Admin user has access to all 7 sites
- [ ] Test users (va.user, al.user) only see their assigned site
- [ ] SCORVA site selector shows 7 sites
- [ ] Sentinel (MASH) functionality intact

---

## 🔐 Data Isolation Verification

### Test as Admin (all sites):
```bash
# Login as admin/admin
# Should see all 7 sites in any app
```

### Test as Site-Scoped User:
```bash
# Login as va.user / User@12345!
# Should ONLY see MTSI-VA
# Attempting to access MTSI-OH data → 403 Forbidden
```

---

## Future: Sub-Areas Within Sites

The 7 site IDs are **primary organizational units**. Sub-areas (e.g., "Alexandria Facility" under MTSI-VA) are managed via:

- **MashSite table** (current): 1:M relationship
- **Location model** (future): Dedicated sub-area tracking

Example:
```javascript
// Under MTSI-VA, you could have:
- Alexandria Facility
- Arlington Office
- Pentagon Annex

// Each would have siteId: 'MTSI-VA'
// But with location-specific details
```

---

## Rollback (if needed)

```bash
# Revert code changes
git checkout packages/db/prisma/seed.js hub/server/index.js docker-compose.yml

# Reseed with old sites
cd packages/db && npx prisma db seed && cd ../..

# Rebuild
docker compose up -d --build hub mash
```

---

## Questions?

- Site consistency across apps: ✅ Now using same 7 site IDs
- Entra ID integration: See `ENTRA_ID_MIGRATION.html`
- Multi-tenant architecture: See `DATABASE_ARCHITECTURE.html`
