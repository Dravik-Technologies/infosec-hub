# Critical Multi-Tenancy Bug Fixes

## 🔴 Severity: HIGH - Tenant Data Isolation Breach

### The Vulnerability
A Hub Admin could create facilities and personnel in the **wrong tenant site** despite the warning modal:

**Attack Scenario:**
1. Hub Admin logs in, primary site = MTSI-VA
2. Header site selector shows: MTSI-CO (Colorado)
3. Admin clicks "+ Add Facility" → Warning appears "select a site" ✓
4. Admin thinks they're working on MTSI-CO
5. Admin fills form and saves
6. **Bug**: Facility silently created under MTSI-VA (primary site) ❌
7. Audit trail shows facility created in wrong state

### Root Cause
**Three-layer fallback to user's primary site:**
1. **Frontend**: Form `siteId` defaults to `''` (empty string)
2. **Frontend**: Selected header site NOT passed to form component  
3. **Backend**: Server falls back to `req.user.siteId` (primary site) when body is empty

---

## ✅ Fixes Applied

### Fix #1: Frontend - Pass Selected Site to Forms

**Files Updated:**
- `security-dashboard/client/src/pages/FacilityPage.jsx`
- `security-dashboard/client/src/pages/PersonnelPage.jsx`

**Changes:**
1. **Add `siteId` prop** to form components (FacilityForm, PersonnelForm)
2. **Pre-populate blank forms** with `siteId: siteId || ''`
3. **Display site in header** for clarity (shows "Site: MTSI-CO")
4. **Check site selection before opening form** (show warning if none selected)
5. **Personnel form field is read-only for new records** (can't manually change)
6. **Update legacy placeholder** from "site-001" to "MTSI-VA"

**Before (Vulnerable):**
```javascript
const blank = {
  name: '', facilityType: 'SCIF', siteId: '',  // ❌ empty default
  // ...
};

<FacilityForm fac={editingFac} /* no siteId prop */ />
```

**After (Fixed):**
```javascript
function FacilityForm({ fac, siteId, onSave, onClose }) {  // ✓ accept siteId
  const blank = {
    name: '', facilityType: 'SCIF', siteId: siteId || '',  // ✓ pre-filled
    // ...
  };
}

<FacilityForm fac={editingFac} siteId={siteId} onSave={...} />  // ✓ pass it
```

**Visual Indicators:**
```
Modal Header:
  "Add Facility"
  Site: MTSI-CO  ← User can't miss this

Form Fields:
  All fields filled and ready
  siteId is pre-populated in form (hidden from view, enforced by server)
  Personnel: Site ID field shows selected site as read-only
```

**Proactive Validation:**
```
User clicks "+ Add Facility" or "+ Add Personnel" with NO site selected
↓
Warning modal: "Please select a site from the dropdown menu at the top"
↓
User must dismiss, select site, then retry
↓
Form only opens after site is chosen
```

---

### Fix #2: Backend - Remove Fallback to Primary Site

**File Updated:**
- `security-dashboard/lib/tenantScope.js` (lines 164-190)

**Changes:**
1. **Remove fallback logic**: No longer defaults to `req.user.siteId`
2. **Require explicit siteId**: Must come from `req.body.siteId`
3. **Throw 400 if missing**: Clear error instead of silent fallback
4. **Validate access**: Only allow write if user can access that site

**Before (Vulnerable):**
```javascript
function resolveWriteSiteId(req) {
  const bodySiteId = req.body?.siteId || null;
  const scope = getUserSiteScope(req.user);
  
  const target = bodySiteId || scope.siteId;  // ❌ Falls back to primary
  // ...
  return target;
}
```

**After (Fixed):**
```javascript
function resolveWriteSiteId(req) {
  const bodySiteId = (req.body?.siteId || '').trim() || null;
  
  if (!bodySiteId) {  // ✓ Explicit check
    const err = new Error('siteId is required and must be explicitly provided...');
    err.status = 400;
    throw err;
  }
  if (!assertSiteAccess(req.user, bodySiteId)) {
    const err = new Error(`Site access denied: ${bodySiteId}`);
    err.status = 403;
    throw err;
  }
  return bodySiteId;
}
```

---

## Testing the Fix

### Scenario 1: Creating in Wrong Tenant (Should Now Fail)
```
1. User A (primary=MTSI-VA, allowed=MTSI-CO) selects MTSI-CO
2. Clicks "+ Add Facility"
3. Form shows: Site: MTSI-CO (read-only)
4. Fills details and saves
5. ✓ Facility created in MTSI-CO (not MTSI-VA)
```

### Scenario 2: Missing siteId (Should Now Error)
```
1. Manually craft API request without siteId
   POST /api/ws/facility_security
   { "name": "Test", "siteId": "" }  ← empty string
2. Server returns 400: "siteId is required..."
3. ✓ Creation blocked, prevents silent fallback
```

### Scenario 3: Cross-Site Attack (Should Now Deny)
```
1. User A (allowed: MTSI-OH) tries:
   POST /api/ws/facility_security
   { "name": "Hack", "siteId": "MTSI-VA" }
2. Server checks assertSiteAccess(userA, "MTSI-VA")
3. User A not in MTSI-VA scope → 403 Forbidden
4. ✓ Access denied, prevents cross-site write
```

---

## Audit Trail Impact

**Before Fix:** Admins couldn't tell where records were created
```
Created: Facility "Building A" 
Site:    MTSI-VA  ← Wrong site, silent bug, no error
```

**After Fix:** Data goes exactly where intended, or errors with reason
```
✓ Facility created in MTSI-CO (admin selected MTSI-CO)
✗ Request error: siteId is required (if form bug or API misuse)
✗ Site access denied: MTSI-VA (if user tries to cross-site-write)
```

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `security-dashboard/client/src/pages/FacilityPage.jsx` | 57, 103-106, 479-482, 505 | Add siteId prop, pre-fill form, display site, pass to component |
| `security-dashboard/client/src/pages/PersonnelPage.jsx` | 29, 75-78, 94-95, 632-633, 685 | Add siteId prop, pre-fill form, read-only field, pass to component |
| `security-dashboard/lib/tenantScope.js` | 164-190 | Remove fallback, require explicit siteId, throw 400 if missing |

---

## Deployment Steps

```bash
export POSTGRES_PORT=5433
docker compose up -d --build --force-recreate mash
sleep 10
```

**Verification:**
```bash
# 1. UI: Add facility with site selected
#    → Should show "Site: MTSI-CO" in header
#    → Should have read-only siteId field

# 2. API: Try adding with empty siteId
curl -X POST http://localhost:8080/api/ws/facility_security \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"Test","siteId":""}'
#    → Should get 400: "siteId is required..."

# 3. UI: Select MTSI-OH, add personnel
#    → Should show "Site: MTSI-OH" 
#    → Personnel saved to MTSI-OH (not primary site)
```

---

## Security Classification

**CVSS v3.1 Score:** 5.3 (Medium)
- **Vector:** CVSS:3.1/AV:N/AC:L/PR:H/UI:R/S:C/C:L/I:L/A:N
- **Attack Vector:** Network
- **Privileges Required:** High (Hub Admin)
- **User Interaction:** Required (must select wrong site)
- **Scope:** Changed (affects cross-tenant integrity)
- **Impact:** Low (confidentiality/integrity of data in wrong site)

---

## Prevented Scenarios

✅ Hub Admin creates facility in MTSI-CO but it goes to MTSI-VA  
✅ Personnel record silently assigned to wrong site  
✅ Multi-site user could corrupt another site's data  
✅ Audit trail shows correct site (no hidden fallbacks)  
✅ API calls with empty siteId no longer accepted  
✅ Cross-site writes explicitly denied with 403  

---

## Lessons Learned

1. **Frontend validation ≠ Server security**: Warning modal helps UX but doesn't stop bugs
2. **Never trust client for tenancy boundaries**: Must enforce on server
3. **Explicit > Implicit**: Better to error on missing siteId than guess
4. **Three-layer defense**: Client validation, header display, server enforcement
5. **Audit logging**: Tracks where data actually ends up

---

## Migration Note

This is a **breaking change** for any code relying on the fallback behavior. All writes to site-owned collections must now explicitly include `siteId` in the request body.

If existing integrations fail with "siteId is required":
- Update client to pass siteId from header selection
- Verify user has access to that siteId
- No data is at risk; the block prevents silent corruption
