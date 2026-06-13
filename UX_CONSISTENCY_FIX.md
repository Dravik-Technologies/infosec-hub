# UX Consistency & Documentation Fixes

## Issue 1: Personnel Add Missing Site Validation (FIXED)

### Problem
**PersonnelPage** didn't validate site selection before opening the form, unlike **FacilityPage**. This created an inconsistent UX:

**Facility Flow (Correct):**
```
Click "+ Add Facility" with no site
↓
Warning modal: "Select a site"
↓
User selects site from dropdown
↓
Click "+ Add Facility" again
↓
Form opens with site pre-filled
```

**Personnel Flow (Broken):**
```
Click "+ Add Personnel" with no site
↓
Form opens with empty siteId: ''
↓
User fills all fields
↓
Click "Add Personnel"
↓
Server returns 400: "siteId is required" ❌
↓
User confused, has to start over
```

### Solution
Added **proactive site selection check** to PersonnelPage (matching FacilityPage behavior):

**Files Updated:**
- `security-dashboard/client/src/pages/PersonnelPage.jsx`
  - Line 573: Added `showSiteWarning` state
  - Line 592: Added `handleAddPersonnelClick()` handler (validates siteId)
  - Line 687-705: Added warning modal (matches Facility style)
  - Line 751: Updated button to use `handleAddPersonnelClick()` instead of direct `setAddingPerson(true)`

**Now Both Flows Are Consistent:**
```
Click "+ Add Personnel" or "+ Add Facility" with no site
↓
⚠️ Warning modal: "Please select a site..."
↓
User must select site and try again
↓
Form only opens after site is chosen
↓
Form has site pre-filled (can't be changed)
↓
Save succeeds (siteId always present)
```

---

## Issue 2: Documentation Accuracy (FIXED)

### Problem
The summary claimed "read-only form field" but only the header text displayed the site:

**Stated:**
> "Make siteId read-only for new records (can't manually change)"

**Actual Implementation (Facility):**
```javascript
Modal Header:
  "Add Facility"
  Site: MTSI-CO  ← Text in header only
  
Form body:
  [No visible Site ID field]
  siteId is pre-filled internally but not shown as form field
```

### Solution
Updated documentation to accurately reflect what was implemented:

**Files Updated:**
- `TENANCY_SECURITY_FIX.md`
  - Clarified that site is shown in header, not as a visible form field
  - Noted Personnel form DOES have read-only Site ID field
  - Added "proactive validation" section explaining the warning flow

**Accurate Summary:**
- **Facility form**: Site shown in header text, siteId pre-filled but hidden
- **Personnel form**: Site shown in header text, plus visible read-only Site ID field
- **Both**: Proactive warning if no site selected before opening form

---

## Security Remains Unaffected

Both fixes are **UX/documentation only**. The critical security fix (server-side removal of fallback) is unchanged:

```javascript
// Still enforced in tenantScope.js line 175:
if (!bodySiteId) {
  throw new Error('siteId is required...');  // ✓ No silent fallback
}
```

---

## Testing Checklist

- [ ] Click "+ Add Facility" with no site selected → Warning modal appears
- [ ] Click "+ Add Personnel" with no site selected → Warning modal appears
- [ ] Select MTSI-CO, click "+ Add Facility" → Form opens with "Site: MTSI-CO" in header
- [ ] Select MTSI-OH, click "+ Add Personnel" → Form opens with "Site: MTSI-OH" in header
- [ ] Personnel form shows Site ID field as read-only when adding new record
- [ ] Try API POST without siteId → 400 error (server validation)
- [ ] Create facility in MTSI-CO → Saved to MTSI-CO (not primary site)
- [ ] Create personnel in MTSI-AL → Saved to MTSI-AL (not primary site)

---

## Summary

| Issue | Severity | Status | Fix |
|-------|----------|--------|-----|
| Personnel missing site validation | Medium | ✅ FIXED | Added proactive warning modal |
| Documentation overstated "read-only field" | Low | ✅ FIXED | Clarified actual implementation |
| Server-side fallback removed | HIGH | ✅ FIXED | (from previous commit) |

All three issues are now resolved. The security is fixed, the UX is consistent, and the documentation is accurate.
