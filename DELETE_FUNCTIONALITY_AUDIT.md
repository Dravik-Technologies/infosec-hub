# Delete Functionality Audit - Sentinel

## Current Status

| Module | Collection | Delete | Detail View | Pattern |
|--------|-----------|--------|-------------|---------|
| **Facility** | facility_security | ❌ NO | Card + Edit Form | Edit modal only |
| **Personnel** | personnel_security | ✅ YES | Detail Modal | PersonnelDetail modal |
| **Activities** | activities_security | ✅ YES | Detail Modal | ActivityDetail modal |
| **Documents** | document_control | ? UNKNOWN | ? | ? |
| **DD254** | dd254_register | ? UNKNOWN | ? | ? |
| **Media** | media_control | ? UNKNOWN | ? | ? |
| **Inspections** | mash_self_inspection_ops | ❌ NO | Card view | InspectionCard only |

## Implementation Plan

### 1. ✅ FACILITIES - Add Delete to Edit Form
**Current**: Only Edit button on card
**To Do**:
- Add delete button to FacilityForm (show when `isEdit === true`)
- Add `window.confirm()` before deleting
- Add `WS.del()` call
- Call `onSave()` to refresh list
- Add `onDelete` callback prop

**Location**: `security-dashboard/client/src/pages/FacilityPage.jsx`
- FacilityForm component (around line 100)
- FacilityCard component (around line 310)

### 2. ❓ DOCUMENTS - Verify Delete Exists
**Status**: Unknown - need to check
**Location**: `security-dashboard/client/src/pages/DocumentsPage.jsx`

### 3. ❓ DD254 - Verify Delete Exists  
**Status**: Unknown - need to verify (grep found `handleDelete` on line 266)
**Location**: `security-dashboard/client/src/pages/DD254Page.jsx`

### 4. ❓ MEDIA - Verify Delete Exists
**Status**: Unknown - need to check
**Location**: `security-dashboard/client/src/pages/MediaPage.jsx`

### 5. ✅ INSPECTIONS - Add Delete Functionality
**Current**: Only card view with click-to-select
**To Do**:
- Create InspectionDetail modal (similar to ActivityDetail/PersonnelDetail)
- Add delete functionality to detail modal
- Wire up onSelect state management
- Add delete button with confirmation

**Location**: `security-dashboard/client/src/pages/InspectionsPage.jsx`
- InspectionCard component (start ~line 19)
- Export function (start ~line 80)

---

## Next Steps

1. Add delete to **FacilityPage** (high priority - already used)
2. Verify/add delete to **DocumentsPage** (likely already has it)
3. Verify delete in **DD254Page** (likely already has it)
4. Verify/add delete to **MediaPage** (likely already has it)
5. Add delete to **InspectionsPage** (needs detail modal)

---

## Delete Pattern Template

```javascript
// In detail/form component:
const [deleting, setDeleting] = useState(false);

async function handleDelete() {
  if (!window.confirm('Delete this record? This cannot be undone.')) return;
  setDeleting(true);
  try {
    const result = await WS.del('collection_name', id);
    if (result?._wsError) {
      alert(result.message || 'Delete failed');
    } else {
      onDeleted?.(); // Callback to parent to refresh list
    }
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Failed to delete record');
  } finally {
    setDeleting(false);
  }
}

// In JSX:
<button 
  type="button" 
  className="ws-action-btn" 
  style={{ color: 'var(--red)' }} 
  disabled={deleting}
  onClick={handleDelete}
>
  {deleting ? 'Deleting…' : 'Delete'}
</button>
```
