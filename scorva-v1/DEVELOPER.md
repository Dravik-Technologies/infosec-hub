# SCORVA — Developer Guide

**Security Compliance Operations & Risk Visibility Application**  
Version 2.9 | NIST SP 800-53 Rev 5 | Single-File SPA

---

## Table of Contents

1. [Running the Application](#running-the-application)
2. [Architecture Overview](#architecture-overview)
3. [File Structure](#file-structure)
4. [How Pages Work](#how-pages-work)
5. [How Data Works](#how-data-works)
6. [Persistence System](#persistence-system)
7. [NIST Control Import](#nist-control-import)
8. [Adding a New Page](#adding-a-new-page)
9. [Adding a New Data Type](#adding-a-new-data-type)
10. [Styling and Theming](#styling-and-theming)
11. [Key Utilities](#key-utilities)
12. [Extending the NIST Catalog](#extending-the-nist-catalog)
13. [Building for Production](#building-for-production)
14. [Troubleshooting](#troubleshooting)

---

## Running the Application

SCORVA is a zero-build, zero-dependency SPA. To run it locally:

```bash
# Option 1: VS Code Live Server (recommended)
# Install the "Live Server" extension, right-click index.html → Open with Live Server

# Option 2: Python HTTP server
cd /path/to/scorva
python3 -m http.server 8080
# Then open http://localhost:8080

# Option 3: Node.js
npx serve .
# Then open http://localhost:3000
```

> ⚠️ **Do not open index.html as a `file://` URL directly** — some browsers block localStorage when using the `file://` protocol. Always use a local HTTP server.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        Browser                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ index.html  — Static app shell (sidebar, modals, header) │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │ <script src="...">                        │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │ app.js  — Seed data, state, DB objects, routing, utils   │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │ pages-part-a.js  — Dashboard, CONMON, Tasks, Controls    │  │
│  │ pages-part-b.js  — Settings, POAM, ATO, Reports, etc.   │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │ styles.css  — All CSS (variables, layout, components)    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  localStorage  — Persisted mutations (see Persistence section)  │
└────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- No framework (React, Vue, Angular) — pure ES6+ JavaScript
- No build step — edit files, refresh browser, done
- No external HTTP calls — all data is local
- Template literals generate all HTML — no virtual DOM
- CSS variables handle theming — one variable change reskins everything

---

## File Structure

```
scorva/
├── index.html          App shell, sidebar nav, overlay divs, script tags
├── app.js              Core: data, state, routing, utilities (7800+ lines)
├── pages-part-a.js     Pages: Dashboard, CONMON, Tasks, My Work, Controls
├── pages-part-b.js     Pages: Settings, POAM, ATO, Reports, About, etc.
├── styles.css          All CSS in 35+ numbered sections
└── DEVELOPER.md        This file
```

### Why three JS files?

Browser parser performance. A single 12,000+ line file parses noticeably slower.
Splitting into logical groups (data+routing vs page renders) keeps each file
under ~8,000 lines. There's no technical dependency ordering between the pages
files — they both just call `registerPage()` which is defined in app.js.

---

## How Pages Work

### Registration

Every page is registered with `registerPage(id, renderFn)`:

```javascript
// In pages-part-a.js or pages-part-b.js
registerPage('my-page', function renderMyPage() {
  // This function is called every time navigate('my-page') runs
  // It must return an HTML string
  return `
    <div class="page-header">
      <div><h1 class="page-title">My Page</h1></div>
    </div>
    <div class="card">
      <p>Hello from My Page</p>
    </div>
  `;
});
```

`registerPage` simply does:
```javascript
function registerPage(id, fn) {
  PAGE_RENDERERS[id] = fn;
}
```

### Navigation

```javascript
navigate('my-page');
// 1. Updates AppState.currentPage
// 2. Highlights nav item in sidebar
// 3. Calls PAGE_RENDERERS['my-page']() to get HTML
// 4. Sets document.getElementById('page-content').innerHTML
// 5. Runs animations, updates breadcrumbs, updates URL hash
```

### Page-Local State

Pages use module-scope variables prefixed with `_` for local filter/sort state:

```javascript
// Declared near the top of pages-part-a.js (not inside any function)
let _myPageFilter  = '';
let _myPageSortCol = 'id';

registerPage('my-page', function renderMyPage() {
  const filtered = DATA_THINGS.filter(t => t.name.includes(_myPageFilter));
  return `...${filtered.map(t => renderRow(t)).join('')}...`;
});

// Called by the filter input's oninput handler
function filterMyPage() {
  _myPageFilter = document.getElementById('my-filter').value.toLowerCase();
  navigate('my-page'); // re-renders with new filter
}
```

### Event Handlers in HTML

All `onclick=` attributes in generated HTML must call **global functions** (on `window`). Functions defined inside `registerPage` callbacks are NOT accessible from inline handlers.

```javascript
// ✅ CORRECT — global function
function openMyDrawer(id) { ... }

registerPage('my-page', function() {
  return `<button onclick="openMyDrawer('${esc(id)}')">Open</button>`;
});

// ❌ WRONG — function is not globally accessible
registerPage('my-page', function() {
  function handleClick(id) { ... }  // can't reach this from onclick=""
  return `<button onclick="handleClick('${esc(id)}')">Open</button>`;
});
```

---

## How Data Works

### Seed Data Arrays

All data lives in `app.js` as plain JavaScript arrays:

```javascript
const DATA_CONTROLS = [
  { id:'SI-2', title:'Flaw Remediation', family:'System & Info Integrity',
    status:'Partial', baseline:'Low', lastReview:'2026-02-15', findings:4 },
  // ...
];
```

These arrays are **mutated in-place** by DB objects. Pages read directly from
them — no copying, no selectors, no store subscriptions.

### Data Schemas

| Array | Description | Key Fields |
|-------|-------------|------------|
| `DATA_CONTROLS` | NIST control tracking | id, title, family, status, baseline |
| `DATA_CONMON` | ConMon task inventory | id, title, control, frequency, status, dueDate |
| `DATA_TASKS` | Tasks & Findings | id, title, type, status, assignee, control |
| `DATA_POAM` | POAM items | id, controlId, severity, status, milestones[] |
| `DATA_ATO` | ATO records | id, system, status, expirationDate |
| `DATA_USERS` | User accounts | id, name, username, role, status |
| `DATA_WORKSTATIONS` | Endpoints | id, hostname, ip, os, status |
| `DATA_YUBIKEYS` | Hardware tokens | id, serialNumber, assignedTo, status |
| `NIST_CATALOG` | NIST control descriptions | id → {title, description, enhancements[]} |

---

## Persistence System

### DB Objects

Each major data type has a dedicated DB object that handles localStorage:

| Object | Storage Key | Manages |
|--------|------------|---------|
| `ConmonDB` | `scorva_conmon_data` | CONMON task add/edit/delete/history |
| `ControlsDB` | `scorva_controls_data` | Control library add/edit/delete/import |
| `TrackerDB` | `scorva_trackers_*` | Custom tracker templates and row data |
| `DataStore` | `scorva_data_v1` | Status mutations for tasks, users, yubikeys |

Each DB object follows this API pattern:

```javascript
const MyDB = {
  KEY: 'scorva_mydata',
  load()             { /* merge localStorage → DATA_MY at boot */ },
  save()             { /* write DATA_MY → localStorage */ },
  reset()            { /* clear localStorage key */ },
  add(fields)        { /* create + save */ },
  update(id, fields) { /* merge + save */ },
  delete(id)         { /* splice + save */ },
};
```

### Boot Sequence

```javascript
document.addEventListener('DOMContentLoaded', function() {
  Persist.load();       // restore site, theme, sidebar state
  AccentTheme.load();   // restore accent color before first render
  RowDensity.load();    // restore table density before first render
  ConmonDB.load();      // merge CONMON mutations
  ControlsDB.load();    // merge control library mutations
  reconcileConmonStatuses(); // auto-update overdue CONMON tasks
  Persist.applyNotifState(); // restore notification read status
  // ...sidebar state, nav setup, splash screen...
  _boot2();             // themes, trackers, live activity, tour
});
```

### Resetting All Data

```javascript
// Resets everything to seed data defaults (prompts user first):
DataStore.reset();
// This also calls ConmonDB.reset() and ControlsDB.reset()
// then reloads the page
```

---

## NIST Control Import

SCORVA supports four official NIST SP 800-53 import formats, all accessible from
**Control Library → Import NIST** (the `↑ Import NIST` button in the page header).

---

### Method 1: OSCAL JSON ⭐ Recommended

**What it gives you:** Every control and enhancement in SP 800-53 Rev 5 — full
statement text, supplemental guidance, related controls, family groupings, and
all enhancements. Over 1,000 entries. This is the most complete import option.

**How to get the file (~30 seconds):**
1. Go to: `github.com/usnistgov/oscal-content`
2. Navigate to: `nist.gov / SP800-53 / rev5 / json /`
3. Click `NIST_SP-800-53_rev5_catalog.json`
4. Click the **Download raw file** button (↓ icon, top-right of the file view)
5. Upload the downloaded `.json` file in SCORVA → confirm the import

> ⚠️ The file is ~7MB — do not open it in a text editor. Just upload it directly.

**What SCORVA extracts:**
- Control ID (converts OSCAL `ac-1` → NIST `AC-1`)
- Title, statement text, supplemental guidance
- Enhancements from nested `control.controls[]` array
- Related controls from `links[rel="related"]`
- Baseline (Low/Moderate/High) from the built-in `NIST_BASELINES` lookup table in app.js
- Status defaults to "Not Implemented" (you update this after import)

---

### Method 2: OSCAL XML

Same complete content as OSCAL JSON, published in XML format. Use this if you
are exporting from Archer, eMASS, Xacta, or another OSCAL-compatible GRC tool.

**How to get the file:**
- Same GitHub path as above, but navigate to `rev5 / xml /`
- Download `NIST_SP-800-53_rev5_catalog.xml`

**How SCORVA parses it:**
- Uses the browser's built-in `DOMParser` — no external library required
- Navigates `<catalog> → <group> → <control>` elements
- Reads `<part name="statement">` and `<part name="guidance">` for content
- Parses child `<control>` elements as enhancements

---

### Method 3: NIST CSV (Spreadsheet Format)

The official NIST SP 800-53 spreadsheet in CSV format. Simpler than OSCAL
(no enhancement sub-structure), but easy to review and edit in Excel first.

**How to get the file:**
1. Go to: `csrc.nist.gov/pubs/sp/800/53/r5/upd1/final`
2. Find **"SP 800-53 Controls Spreadsheet"** and download the `.xlsx`
3. Open in Excel → File → Save As → CSV UTF-8

**Auto-detected columns (case-insensitive):**
`Control Identifier`, `Control (or Control Enhancement) Name`,
`Control Text`, `Discussion`, `Related Controls`

Also accepts eMASS and Xacta CSV exports — column names are auto-mapped.

---

### Method 4: SCORVA JSON (Re-import)

Re-import a file exported from SCORVA using **Control Library → Export JSON**.
Restores all fields including status, findings, review dates, and implementation notes.

**Format:** JSON array of objects with at minimum `id` and `title` fields.

---

### How Import Handles Existing Controls

When importing and a control already exists (matching ID):
- **NIST content fields** (description, enhancements, related controls) → overwritten
- **Your tracking fields** (status, findings, lastReview, implementation) → preserved

You can safely re-import from NIST periodically to get updated text without
losing your implementation work. This is controlled by `ControlsDB.importBatch()`.


## Adding a New Page

### 1. Write the render function

In `pages-part-b.js` (or `pages-part-a.js` if it's a heavy page):

```javascript
/* ── My New Page ──────────────────────────────────────────── */

// Page-local state (declare at module scope, not inside functions)
let _mySearch = '';

/**
 * renderMyPage() — Renders the My New Page content.
 * Reads from DATA_MY (or wherever your data lives).
 */
registerPage('my-page', function renderMyPage() {
  const items = DATA_MY.filter(item =>
    !_mySearch || item.name.toLowerCase().includes(_mySearch)
  );

  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">My New Page</h1>
      <p class="page-sub">${items.length} items</p>
    </div>
    <div class="page-actions">
      <button class="btn btn-primary btn-sm" onclick="showAddMyItemModal()">
        + Add Item
      </button>
    </div>
  </div>

  <div class="toolbar mb-4">
    <div class="search-wrap">
      <input class="input" placeholder="Search..."
        oninput="_mySearch=this.value.toLowerCase();navigate('my-page')"/>
    </div>
  </div>

  <div class="card p-0">
    <table id="my-table">
      <thead><tr>
        <th>ID</th>
        <th>Name</th>
        <th>Status</th>
      </tr></thead>
      <tbody>
        ${items.map(item => `
          <tr onclick="openMyDrawer('${esc(item.id)}')" style="cursor:pointer">
            <td class="font-mono text-xs">${esc(item.id)}</td>
            <td>${esc(item.name)}</td>
            <td>${statusBadge(item.status)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
});
```

### 2. Add to app.js routing

```javascript
// In PAGE_ORDER array — position determines Alt+N shortcut
const PAGE_ORDER = [
  'command-center','my-work','tasks','control-library','conmon',
  'poam','agreements','ato-tracking','workstations',
  'my-page',   // ← ADD HERE (position = Alt+10 key)
  // ...
];

// In PAGE_TITLES object
const PAGE_TITLES = {
  // ... existing entries ...
  'my-page': 'My New Page',
};
```

### 3. Add nav item to index.html

```html
<!-- In the sidebar, inside the appropriate <div class="nav-group"> -->
<button class="nav-item" data-page="my-page"
  data-tooltip="My New Page"
  onclick="navigate('my-page')"
  aria-label="My New Page">
  MY_ICON_HERE
</button>
```

---

## Adding a New Data Type

### 1. Define seed data in app.js

```javascript
/* ============================================================
   DATA_MY — Seed data for My Thing tracker
   ============================================================
   SCHEMA:
     id     {string}  Unique identifier e.g. "MY-001"
     name   {string}  Display name
     status {string}  "Active" | "Inactive"
   ============================================================ */
const DATA_MY = [
  { id: 'MY-001', name: 'First Thing', status: 'Active' },
  { id: 'MY-002', name: 'Second Thing', status: 'Inactive' },
];
```

### 2. Build a DB object (copy the ConmonDB pattern)

```javascript
const MyDB = {
  KEY: 'scorva_mydata',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      saved.forEach(s => {
        const idx = DATA_MY.findIndex(m => m.id === s.id);
        if (idx !== -1) Object.assign(DATA_MY[idx], s);
        else DATA_MY.push(s);
      });
    } catch(e) { console.warn('[MyDB] load failed:', e); }
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(DATA_MY)); } catch(e) {}
  },

  reset() { try { localStorage.removeItem(this.KEY); } catch(e) {} },

  nextId() {
    const nums = DATA_MY.map(m => parseInt(m.id.replace('MY-',''))||0);
    return 'MY-' + String(Math.max(...nums, 0) + 1).padStart(3,'0');
  },

  add(fields) {
    const item = { id: this.nextId(), status: 'Active', ...fields };
    DATA_MY.push(item);
    this.save();
    auditLog('MY_ADD', item.id, `Added: ${item.name}`);
    return item;
  },

  update(id, fields) {
    const m = DATA_MY.find(m => m.id === id);
    if (!m) return null;
    Object.assign(m, fields);
    this.save();
    auditLog('MY_UPDATE', id, `Updated: ${Object.keys(fields).join(', ')}`);
    return m;
  },

  delete(id) {
    const idx = DATA_MY.findIndex(m => m.id === id);
    if (idx === -1) return;
    DATA_MY.splice(idx, 1);
    this.save();
    auditLog('MY_DELETE', id, `Deleted`);
  },
};
```

### 3. Wire into boot and reset

In `app.js` `DOMContentLoaded`:
```javascript
MyDB.load();  // merge saved mutations
```

In `DataStore.reset()`:
```javascript
if (typeof MyDB !== 'undefined') MyDB.reset();
```

---

## Styling and Theming

All styles are in `styles.css`. The file is structured in numbered sections:

```css
/* Section 1:  CSS Custom Properties (variables) */
/* Section 2:  Reset and base styles */
/* Section 3:  Layout (app-shell, sidebar, header, page-content) */
/* Section 4:  Splash screen */
/* ... */
/* Section 35: Print stylesheet */
```

### Changing the Accent Color

```css
/* In :root, change --primary to your color: */
--primary: #2b5fb5;       /* buttons, links, active states */
--primary-hover: #3670cc;
--primary-active: #1e4a99;
--primary-bg: #2b5fb526;  /* badge backgrounds, card tints */
```

Or use the Settings page → Accent Color picker (persists to localStorage).

### Adding a New CSS Component

Add it to the relevant section of `styles.css`:

```css
/* ── My Component ───────────────────────────────────────── */
.my-component {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 12px 16px;
}
.my-component:hover {
  background: var(--surface-elevated);
  border-color: var(--border-hover);
}
```

### Available CSS Variables

| Variable | Description |
|----------|-------------|
| `--bg` | Page background |
| `--surface` | Card/panel background |
| `--surface-elevated` | Slightly lighter surface (tooltips, inputs) |
| `--border` | Default border color |
| `--border-hover` | Border on hover |
| `--text-primary` | Main text |
| `--text-secondary` | Muted text |
| `--text-tertiary` | Very muted text, labels |
| `--primary` | Accent color (buttons, links) |
| `--success` | Green (compliant, implemented) |
| `--warning` | Amber (partial, due soon) |
| `--danger` | Red (overdue, critical, non-compliant) |
| `--info` | Blue (IDs, mono text links) |
| `--font-mono` | Monospace font stack |
| `--r-sm/md/lg` | Border radius small/medium/large |
| `--shadow-sm/md/lg` | Box shadow presets |

---

## Key Utilities

These functions are available globally throughout all page render functions:

| Function | Description |
|----------|-------------|
| `navigate(page)` | Route to a page by ID |
| `showModal(title, html)` | Open the modal with custom content |
| `closeModal()` | Close the modal |
| `openDrawer(title, html)` | Open the detail side drawer |
| `closeDrawer()` | Close the drawer |
| `showToast(msg, type, duration)` | Show a notification toast |
| `confirmAction(msg, jsCode, isDestructive)` | Show a confirmation dialog |
| `esc(str)` | HTML-escape a string (ALWAYS use for user data) |
| `fmtDate(iso)` | Format ISO date as "Feb 15, 2026" |
| `daysUntil(iso)` | Days until a date (negative = overdue) |
| `statusBadge(status)` | Returns colored HTML badge for a status string |
| `priorityBadge(priority)` | Returns colored HTML badge for a priority string |
| `auditLog(action, id, detail)` | Add an entry to the audit log |
| `exportCSV(data, filename)` | Download an array as a CSV file |
| `hasPermission(perm)` | Check if current user has a permission |

---

## Extending the NIST Catalog

The `NIST_CATALOG` object in `app.js` currently covers 22 controls.
To add more (e.g. the full 1,100+ control catalog from NIST):

**Option A: Use the Import feature (recommended)**
- Download the NIST CSV from csrc.nist.gov
- Import via Control Library → Import NIST → Upload CSV

**Option B: Extend NIST_CATALOG directly**

```javascript
// In app.js, inside the NIST_CATALOG object:
'PE-3': {
  title:          'Physical Access Control',
  family:         'Physical & Environmental Protection',
  familyCode:     'PE',
  baseline:       { low: true, moderate: true, high: true },
  description:    'Enforce physical access authorizations at all entry...',
  purpose:        'Physical access controls prevent unauthorized...',
  implementation: 'Deploy card-reader access at all server room doors...',
  relatedControls:['AC-2','AC-3','AU-2','AU-9','IA-3','MP-2','MP-4'],
  enhancements: [
    {
      id:          'PE-3(1)',
      title:       'System Access',
      baseline:    'High',
      description: 'Enforce physical access authorizations to the system...'
    },
    // more enhancements...
  ]
},
```

**Option C: Bulk-load via JSON**
Export the NIST catalog from another source as JSON matching the
`DATA_CONTROLS` schema, then import via Control Library → Import NIST → JSON.

---

## Building for Production

SCORVA requires no build step. To prepare for deployment:

1. **Minification** (optional — reduces file size ~60%):
   ```bash
   npx terser app.js -o app.min.js --compress --mangle
   npx terser pages-part-a.js -o pages-part-a.min.js --compress --mangle
   npx terser pages-part-b.js -o pages-part-b.min.js --compress --mangle
   npx csso styles.css --output styles.min.css
   # Update <script src> and <link href> in index.html to point to .min files
   ```

2. **Static hosting**: Copy all 5 files to any web server, S3 bucket,
   Nginx/Apache directory, or SharePoint document library.

3. **Security headers** (recommended for government environments):
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
   X-Frame-Options: DENY
   X-Content-Type-Options: nosniff
   ```
   Note: `'unsafe-inline'` is required because SCORVA uses inline event handlers.
   To remove it, refactor onclick= attributes to use addEventListener().

---

## Troubleshooting

### Page shows blank / "Page Render Error" card
- Open browser DevTools (F12) → Console tab
- The error will be logged there with a stack trace
- Most common causes: undefined variable in template literal, syntax error in a recent change

### localStorage changes not persisting
- Check that you're using a local HTTP server (not `file://`)
- Check DevTools → Application → Local Storage for your keys
- Make sure your DB object's `save()` method is being called

### NIST CSV import skipping all rows
- Check that your CSV has "Control Identifier" (or "id") and a name/title column
- Open the CSV in a text editor and check the actual column headers
- The parser is case-insensitive and does partial matching — "control name" matches "Control (or text) Name"

### Control pills in CONMON show as broken links
- The control ID in the CONMON task doesn't match any entry in DATA_CONTROLS
- Fix: Import the missing control via Control Library → Import NIST, or add it manually
- You can also just edit the CONMON task and select the correct control from the dropdown

### Accordion / collapse not working after navigate()
- SCORVA uses full re-renders on navigate(), not DOM patching
- Any state that needs to survive a re-render must be in a module-scope variable
- Example: `_myAccordionOpen = true; navigate('my-page');` — store it, read it in the render function

### Syntax error in app.js crashes entire app
- SCORVA has an error boundary in navigate() but **not** in app.js itself
- A syntax error in app.js will prevent the app from loading at all
- Use `node --check app.js` to validate syntax before testing in browser

---

*SCORVA v2.9 — UNCLASSIFIED — For official use only*