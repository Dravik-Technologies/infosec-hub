# Site Selection Validation - All Modules

## Summary

Implemented admin-only site selection validation across all 8 data-entry modules (Facility, Personnel, Activities, Documents, DD254, Media, Inspections). Admin users with multi-site access now see a warning modal if they attempt to add records without first selecting a specific site. Regular users with single-site access have their site auto-filled silently.

**Build Status:** ✅ All modules compile without syntax errors.

---

## Implementation Details

### Core Logic

**For each module:**
- **canSeeAllSites** flag: `true` when `sites.length > 1` (user has multi-site access)
- **effectiveSiteId**: Uses header-selected `siteId`, falls back to user's `primarySiteId` or first site in `siteIds` array
- **Admin warning**: Only shown when `canSeeAllSites=true` AND `siteId` is empty (user hasn't selected a site)
- **Regular user behavior**: Site auto-filled silently, no warning

### Files Modified

| File | Changes |
|------|---------|
| [App.jsx](security-dashboard/client/src/App.jsx) | Pass `sites` array to all page components in addition to `user` and `siteId` |
| [FacilityPage.jsx](security-dashboard/client/src/pages/FacilityPage.jsx) | ✅ Warning modal + auto-fill logic |
| [PersonnelPage.jsx](security-dashboard/client/src/pages/PersonnelPage.jsx) | ✅ Warning modal + auto-fill logic |
| [ActivitiesPage.jsx](security-dashboard/client/src/pages/ActivitiesPage.jsx) | ✅ Warning modal + auto-fill logic |
| [DocumentsPage.jsx](security-dashboard/client/src/pages/DocumentsPage.jsx) | ✅ Warning modal + auto-fill logic |
| [DD254Page.jsx](security-dashboard/client/src/pages/DD254Page.jsx) | ✅ Warning modal + auto-fill logic |
| [MediaPage.jsx](security-dashboard/client/src/pages/MediaPage.jsx) | ✅ Warning modal + auto-fill logic |
| [InspectionsPage.jsx](security-dashboard/client/src/pages/InspectionsPage.jsx) | ✅ Auto-fill logic prepared (no Add button currently) |

---

## Behavior Matrix

### Admin User (canSeeAllSites=true)

| Scenario | Behavior |
|----------|----------|
| Site dropdown visible in header | Yes |
| Clicks "+ Add [Module]" with no site selected | ⚠️ Warning modal appears → "Please select a site..." |
| Must dismiss warning and select site first | Yes |
| Form opens with site pre-filled after selection | Yes |
| Can change site via dropdown before clicking Add | Yes |
| Form sends siteId to server | ✅ Always includes selected site |

### Regular User (canSeeAllSites=false, single site only)

| Scenario | Behavior |
|----------|----------|
| Site dropdown visible in header | No |
| Clicks "+ Add [Module]" | ✅ Form opens immediately, no warning |
| Form displays with site pre-filled | Yes |
| Can see/change which site they're adding to | Displays in form or header, read-only |
| Form sends siteId to server | ✅ Always includes their assigned site |

---

## Warning Modal UX

All modules show consistent warning when admin tries to add without selecting site:

```
┌─────────────────────────────────┐
│ ⚠️ Site Required                 │
├─────────────────────────────────┤
│ Please select a site from the    │
│ dropdown menu at the top before  │
│ adding [records]. Each [record]  │
│ must be assigned to a specific   │
│ site.                            │
├─────────────────────────────────┤
│                          [OK]    │
└─────────────────────────────────┘
```

---

## Code Pattern (Example: FacilityPage)

```javascript
// 1. Accept new props
export default function FacilityPage({ siteId, user, sites }) {
  
  // 2. Calculate flags
  const canSeeAllSites = (sites || []).length > 1;
  const effectiveSiteId = siteId || user?.primarySiteId || user?.siteIds?.[0] || '';
  
  // 3. Add warning state
  const [showSiteWarning, setShowSiteWarning] = useState(false);
  
  // 4. Add handler with conditional logic
  function handleAddFacilityClick() {
    if (canSeeAllSites && !siteId) {
      setShowSiteWarning(true);
      return;
    }
    setAddingFac(true);
  }
  
  // 5. Use effectiveSiteId for data loading and forms
  useEffect(() => { load(); }, [effectiveSiteId]);
  
  // 6. Render warning modal when needed
  {showSiteWarning && (
    <div>Warning modal content...</div>
  )}
  
  // 7. Update button to use handler
  <button onClick={handleAddFacilityClick}>+ Add Facility</button>
  
  // 8. Pass effectiveSiteId to forms
  <FacilityForm siteId={effectiveSiteId} ... />
}
```

---

## Testing Checklist

### Setup
- [ ] User with multiple sites assigned (admin)
- [ ] User with single site assigned (regular user)

### Admin User Tests
- [ ] Click "+ Add Facility" with no site selected → Warning appears
- [ ] Click "+ Add Personnel" with no site selected → Warning appears
- [ ] Click "+ Add Activity" with no site selected → Warning appears
- [ ] Click "+ Add Document" with no site selected → Warning appears
- [ ] Click "+ Add DD254" with no site selected → Warning appears
- [ ] Click "+ Add Media" with no site selected → Warning appears
- [ ] Dismiss warning and select site from dropdown → Try adding again → Form opens
- [ ] Site pre-filled in form matches selected site
- [ ] Record saved to correct site (verify in DB)

### Regular User Tests (Single Site)
- [ ] Click "+ Add Facility" → Form opens immediately (no warning)
- [ ] Click "+ Add Personnel" → Form opens immediately (no warning)
- [ ] Form shows their assigned site (read-only or as header)
- [ ] Record saved to their site (verify in DB)

### Both User Types
- [ ] Delete functionality still works
- [ ] Data filtering by siteId works correctly
- [ ] No warnings appear in browser console

---

## Server-Side Security

The server-side validation in `tenantScope.js` (line 175) already requires explicit `siteId`:

```javascript
if (!bodySiteId) {
  throw new Error('siteId is required and must be explicitly provided...');
}
```

This means:
- ✅ Even if a user manually crafts an API request without siteId, server rejects it with 400 error
- ✅ No silent fallback to user's primary site
- ✅ Frontend warning + backend enforcement = defense in depth

---

## Deployment

```bash
export POSTGRES_PORT=5433
docker compose up -d --build --force-recreate sentinel
sleep 10
```

Verify:
- [ ] Build completes without errors
- [ ] Page loads and displays
- [ ] Site dropdown shows (if multi-site user)
- [ ] Warning modals appear when expected

---

## Notes

- **InspectionsPage**: Updated with auto-fill infrastructure, but no "Add Inspection" button currently exists in the UI. The infrastructure is ready if that feature is added.
- **All modules**: Changed siteId prop references to use `effectiveSiteId` for consistency.
- **Data loading**: All modules now load data for `effectiveSiteId` instead of just the selected header `siteId`.
- **No breaking changes**: Existing functionality (edit, delete, view) unchanged.

---

## Related Security Fixes

See [tenantScope.js](security-dashboard/lib/tenantScope.js) line 175 for critical server-side fallback removal that prevents silent data leakage when siteId is empty.
