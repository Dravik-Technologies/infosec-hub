# Sentinel (MASH) - Findings & Fixes

## ✅ Finding 1: Site Selection Warning (FIXED)

### Issue
When adding a facility as an admin with Virginia selected, if NO site was selected at the top, the modal would open with empty fields. This was confusing and allowed creating facilities without proper site assignment.

### Solution
Added site selection validation:
- **Before** opening the Add Facility form, check if `siteId` is selected
- **If not selected**: Display a warning modal directing user to select a site from the dropdown
- **Fields only appear** after a valid site is selected

**Files Updated:**
- `security-dashboard/client/src/pages/FacilityPage.jsx`
  - Added `showSiteWarning` state
  - Added `handleAddFacilityClick()` to validate siteId before opening form
  - Added warning modal with user-friendly message

**Behavior After Fix:**
```
User clicks "+ Add Facility" → No site selected
↓
Warning modal appears: "Please select a site from the dropdown menu at the top"
↓
User clicks OK → Modal closes
↓
User selects site from dropdown at top
↓
User clicks "+ Add Facility" → Form opens normally with fields
```

---

## ✅ Finding 2: Personnel Add/Update/Delete (FIXED)

### Issue #1: No Immediate Update After Adding Personnel
When adding personnel, the modal would close but the list wouldn't show the new person until after a manual browser refresh.

**Solution:** 
- Ensured `load()` function is called immediately after save
- Added error handling for failed saves

### Issue #2: No Delete Functionality
Personnel records could only be edited or viewed, but never deleted. When someone left or a mistake was made, there was no way to remove the record.

**Solution:**
Added full delete functionality:
- **Delete Button** in PersonnelDetail modal (red button in header)
- **Confirmation Dialog** asking user to confirm deletion
- **Immediate Removal** from list after successful deletion
- **Error Handling** if deletion fails on server

**Files Updated:**
- `security-dashboard/client/src/pages/PersonnelPage.jsx`
  - Added `showDeleteConfirm` state in PersonnelDetail
  - Added `deleting` state to track deletion in progress
  - Added `handleDelete()` function using `WS.del()` API call
  - Added confirmation dialog with clear "Delete" button
  - Added `onDelete` handler callback to parent PersonnelPage
  - Added `handleDeletePerson()` in PersonnelPage to remove from list and reload
  - Improved error handling for create operations

**Behavior After Fix:**
```
User clicks on personnel row → Detail modal opens
↓
User clicks "Delete" button (red) → Confirmation dialog appears
↓
User confirms deletion → Person deleted from database & removed from list
↓
List automatically refreshes to reflect deletion
```

---

## Implementation Details

### Delete API Call
```javascript
// Uses the existing WS.del() method from app.js
await WS.del('personnel_security', person.id);
```

### Confirmation Dialog
- Shows personnel name
- Clear warning message
- "Cancel" and "Delete" buttons (Delete is red for visual warning)
- Disabled during deletion to prevent double-clicks

### Immediate UI Updates
1. After adding: `load()` reloads all personnel from server
2. After deleting: 
   - Remove from local state immediately
   - Call `load()` to refresh and ensure consistency
   - Close detail modal

---

## Testing Checklist

- [ ] Add Facility without site selected → Warning appears
- [ ] Select site, then add facility → Form opens normally
- [ ] Add Personnel → List immediately shows new person
- [ ] Open Personnel detail → Delete button visible
- [ ] Click Delete → Confirmation dialog appears
- [ ] Confirm delete → Person removed from list immediately
- [ ] Refresh page → Deleted person stays deleted (verified in DB)

---

## Next Steps

These fixes apply the same pattern across all modals:
1. Validate required selections before opening forms
2. Provide immediate feedback after CRUD operations
3. Always include a way to undo mistakes (delete button)

If you find similar issues in other modules (Documents, Activities, Media, etc.), the same patterns can be applied.

---

## Notes

- Delete is permanent and non-recoverable from the UI
- All changes are persisted to the database immediately
- List auto-refreshes after any add/edit/delete operation
- Site selection is required at header level before adding facilities
- Personnel can now be fully managed (create, read, update, delete)
