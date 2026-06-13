# Site Standardization & MASH → Sentinel Rename

## Summary of Changes

### 1. ✅ App Rename: MASH → Sentinel
- **Hub display name:** Now "Sentinel" (was "MASH")
- **Tagline:** "Security Operations Center"
- **App ID:** Still `sentinel` (was `mash`) in routing
- **Port:** 8080 (unchanged)
- **Docker service:** Still named `mash` (directory name unchanged for now)

### 2. ✅ Standardized Site IDs
Old sites (removed):
- ❌ MTSI-ALX (Alexandria)
- ❌ MTSI-HVL (Huntsville)

New sites (all apps now use these):
- ✅ MTSI-VA (Virginia)
- ✅ MTSI-OH (Ohio)
- ✅ MTSI-LV (Las Vegas)
- ✅ MTSI-CO (Colorado)
- ✅ MTSI-STL (St. Louis)
- ✅ MTSI-AL (Alabama)
- ✅ MTSI-FL (Florida)

### 3. ✅ Database Consistency
All apps now reference the same site IDs:
- **Hub:** Site selection, user assignment
- **SCORVA:** Control, POAM, Task filtering
- **CRATER:** ProjectSystem assignment
- **Sentinel (MASH):** Facility, Personnel, Document control
- **LAVA:** SAAR, System request filtering
- **NEXUS:** Snapshot aggregation

## Files Changed

### 1. `hub/server/index.js`
```javascript
// Before:
{ id: 'mash', name: 'MASH', ... }

// After:
{ id: 'sentinel', name: 'Sentinel', ... }
```

### 2. `packages/db/prisma/seed.js`
**Sites table:**
- Updated from `MTSI-ALX, MTSI-HVL` to 7 standard sites

**Users table:**
- Admin user now has access to all 7 sites
- Created test users for MTSI-VA and MTSI-AL

**MashSite table (now called "Sentinel sites"):**
- One entry per Site ID with matching locations

## How to Apply Changes

### Step 1: Reset Database
```bash
export POSTGRES_PORT=5433

# Delete old data (WARNING: clears all data)
docker compose down postgres
docker volume rm security-app-factory_postgres_data

# Start fresh
docker compose up -d postgres
sleep 10
```

### Step 2: Run Migration & Seed
```bash
cd packages/db
npx prisma migrate deploy
npx prisma db seed

cd ../..
```

### Step 3: Rebuild & Restart Apps
```bash
export POSTGRES_PORT=5433
docker compose up -d --build --force-recreate hub scorva crater mash lava
sleep 10
```

### Step 4: Verify
```bash
# Check Hub displays Sentinel
curl http://localhost:3010/api/apps | jq '.[] | select(.id=="sentinel")'

# Should return:
# {
#   "id": "sentinel",
#   "name": "Sentinel",
#   "tagline": "Security Operations Center",
#   ...
# }
```

## Entra ID Group Mapping (for future)

When integrating with Entra ID, create security groups:

| Site | Entra Group | User Access |
|------|-------------|-------------|
| MTSI-VA | MTSI_VA_USERS | Grants MTSI-VA site access |
| MTSI-OH | MTSI_OH_USERS | Grants MTSI-OH site access |
| MTSI-LV | MTSI_LV_USERS | Grants MTSI-LV site access |
| MTSI-CO | MTSI_CO_USERS | Grants MTSI-CO site access |
| MTSI-STL | MTSI_STL_USERS | Grants MTSI-STL site access |
| MTSI-AL | MTSI_AL_USERS | Grants MTSI-AL site access |
| MTSI-FL | MTSI_FL_USERS | Grants MTSI-FL site access |

**Group naming pattern:** `SITE_<SITE_ID>_USERS`
- Example: `SITE_MTSI_VA_USERS` maps to `siteId: MTSI-VA`

## Sub-Areas (Future Enhancement)

The current design supports adding sub-locations within each site:

```javascript
// Example: Adding "Alexandria Facility" under MTSI-VA

// Option 1: Use MashSite for Sentinel locations
await db.mashSite.create({
  siteId: 'MTSI-VA',  // Parent site
  name: 'Alexandria Facility',
  location: 'Alexandria, VA',
  // ... facility-specific fields
});

// Option 2: Create a Location model (future)
model Location {
  id      String @id
  siteId  String // MTSI-VA
  name    String // Alexandria Facility
  // facility-specific data
}
```

Currently, sub-areas are managed via the **MashSite** model, which has a 1:M relationship to a Site.

## Testing Checklist

- [ ] Hub displays "Sentinel" in app list
- [ ] SCORVA shows all 7 sites in site selector
- [ ] Admin user can toggle between all 7 sites
- [ ] Test user (MTSI-AL) only sees MTSI-AL data
- [ ] Sentinel home page loads for MTSI-VA
- [ ] NEXUS rollup shows all sites for Hub Admin
- [ ] Database query includes correct siteId filters

## Rollback (if needed)

If you need to revert to old sites:

```bash
# Restore from backup or revert seed.js
git checkout packages/db/prisma/seed.js hub/server/index.js docker-compose.yml

# Reseed with old data
npm --prefix packages/db run seed
```

## Notes

- Site IDs are case-sensitive (MTSI-VA, not mtsi-va)
- Always use these 7 site IDs across all new apps going forward
- When creating Entra groups, match the site ID naming convention
- Sub-areas/locations within sites are managed per app (e.g., Sentinel facility details)
