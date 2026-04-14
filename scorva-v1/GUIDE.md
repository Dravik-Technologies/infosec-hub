# SCORVA — Master Configuration & Navigation Guide
**Created by:** Syedali Shah, Senior ISSO
**Application:** SCORVA Cyber Command Center v2.9
**Classification:** UNCLASSIFIED

---

## TABLE OF CONTENTS
1. [Where to Change Font Sizes](#1-font-sizes)
2. [Where to Change Colors](#2-colors)
3. [Where to Change Layout Sizes](#3-layout-sizes)
4. [Where to Edit the Navigation Sidebar](#4-navigation-sidebar)
5. [Where Each Page Lives](#5-page-locations)
6. [Where the Data Lives](#6-data-locations)
7. [Where to Add/Remove Nav Items](#7-adding-nav-items)
8. [Where to Change the App Name or Logo](#8-branding)
9. [Where the Footer Text Lives](#9-footer)
10. [Where to Change KPI Cards on the Dashboard](#10-kpi-cards)
11. [Planned Enhancements (20+)](#11-enhancements)
12. [File Map — What Each File Does](#12-file-map)

---

## 1. FONT SIZES

**File:** `styles.css`
**Where:** Top of the file — look for the `▶▶ USER CONFIGURATION ◀◀` block
**Section label:** `-- FONT SIZES`

```
--font-base:   20px;   ← This controls most text in the app
--font-kpi:    60px;   ← The big numbers on dashboard KPI cards
```

**How to change:** Open `styles.css`, find `--font-base`, change the number, save, refresh browser.
**Tip:** Increasing `--font-base` by 1–2px at a time is safest.

---

## 2. COLORS

**File:** `styles.css`
**Where:** Search for `1. CSS VARIABLES` section (after the configuration block)

| Variable | Controls |
|---|---|
| `--primary` | Blue accent color (buttons, active nav) |
| `--bg` | Main dark background |
| `--surface` | Card/panel backgrounds |
| `--success` | Green (compliant, resolved) |
| `--danger` | Red (critical, errors) |
| `--warning` | Orange (overdue, high priority) |
| `--info` | Light blue (informational, links) |
| `--text-primary` | Main text color |
| `--text-secondary` | Secondary/dimmed text |

---

## 3. LAYOUT SIZES

**File:** `styles.css`
**Where:** `▶▶ USER CONFIGURATION ◀◀` block → `-- LAYOUT DIMENSIONS`

| Variable | Controls |
|---|---|
| `--sidebar-w` | Width of the left navigation panel |
| `--header-h` | Height of the top bar |
| `--banner-h` | Height of the UNCLASSIFIED banner at top |
| `--footer-h` | Height of the status footer at bottom |

---

## 4. NAVIGATION SIDEBAR

**File:** `index.html`
**Where:** Inside `<nav class="sidebar-nav">` (around line 139)

### Current Navigation Structure:
```
OVERVIEW
  ├── Command Dashboard   (page: command-center)
  ├── My Work            (page: my-work)
  └── Calendar           (page: calendar)    ← moved here from Reporting

MONITORING
  ├── Tasks & Findings   (page: tasks)
  ├── CONMON             (page: conmon)
  └── Control Library    (page: control-library)

COMPLIANCE
  ├── ATO Tracking       (page: ato-tracking)
  ├── POAM               (page: poam)
  └── Agreements         (page: agreements)

RESOURCES              ← renamed from "Assets"
  ├── Workstations       (page: workstations)
  ├── YubiKeys           (page: yubikeys)
  ├── LAVA Users         (page: lava-users)
  └── Software Licenses  (page: software-licenses)

[REPORTING section removed — Calendar now lives under Overview]

ADMINISTRATION
  ├── Report Builder     (page: reports)       ← moved from Reporting
  ├── User Onboarding    (page: onboarding)
  ├── Administration Hub (page: admin-hub)
  └── Audit Log          (page: audit-log)

MY TRACKERS            ← dynamic, populated by JS
  ├── All Trackers       (page: trackers)
  └── + New Tracker

FOOTER (always visible)
  ├── Settings           (page: settings)
  └── About              (page: about)
```

### How to rename a nav section label:
Search `index.html` for the `nav-group-label` text you want to change and update it.

### How to move a nav item to a different section:
Cut the `<button class="nav-item"...>` block and paste it inside the correct `<div id="navgroup-XXX" class="nav-group-items">`.

---

## 5. PAGE LOCATIONS

| Page | File | Search for |
|---|---|---|
| Dashboard (Command Center) | `pages-part-a.js` | `registerPage('command-center'` |
| My Work | `pages-part-a.js` | `registerPage('my-work'` |
| Tasks & Findings | `pages-part-a.js` | `registerPage('tasks'` |
| CONMON | `pages-part-a.js` | `registerPage('conmon'` |
| Control Library | `pages-part-a.js` | `registerPage('control-library'` |
| ATO Tracking | `pages-part-b.js` | `registerPage('ato-tracking'` |
| POAM | `pages-part-b.js` | `registerPage('poam'` |
| Agreements | `pages-part-b.js` | `registerPage('agreements'` |
| Workstations | `pages-part-b.js` | `registerPage('workstations'` |
| YubiKeys | `pages-part-b.js` | `registerPage('yubikeys'` |
| LAVA Users | `pages-part-b.js` | `registerPage('lava-users'` |
| Software Licenses | `pages-part-b.js` | `registerPage('software-licenses'` |
| Calendar | `pages-part-b.js` | `registerPage('calendar'` |
| Report Builder | `pages-part-b.js` | `registerPage('reports'` |
| User Onboarding | `pages-part-b.js` | `registerPage('onboarding'` |
| Administration Hub | `pages-part-b.js` | `registerPage('admin-hub'` |
| Audit Log | `pages-part-b.js` | `registerPage('audit-log'` |
| Notifications | `pages-part-b.js` | `registerPage('notifications'` |
| Settings | `pages-part-b.js` | `registerPage('settings'` |
| About | `pages-part-b.js` | `registerPage('about'` |
| Trackers | `pages-part-b.js` | `registerPage('trackers'` |

---

## 6. DATA LOCATIONS

All application data lives in `app.js`. Search for the variable name:

| Data | Variable | Search for in app.js |
|---|---|---|
| Tasks & Findings | `DATA_TASKS` | `const DATA_TASKS` |
| CONMON items | `DATA_CONMON` | `const DATA_CONMON` |
| Controls | `DATA_CONTROLS` | `const DATA_CONTROLS` |
| Workstations | `DATA_WORKSTATIONS` | `const DATA_WORKSTATIONS` |
| YubiKeys | `DATA_YUBIKEYS` | `const DATA_YUBIKEYS` |
| Users | `DATA_USERS` | `const DATA_USERS` |
| ATO records | `DATA_ATO` | `const DATA_ATO` |
| Agreements | `DATA_AGREEMENTS` | `const DATA_AGREEMENTS` |
| Software Licenses | `DATA_LICENSES` | `const DATA_LICENSES` |
| Notifications | `DATA_NOTIFICATIONS` | `const DATA_NOTIFICATIONS` |

---

## 7. ADDING NAV ITEMS

To add a new navigation item to any section, copy this template and paste it inside the correct `navgroup-XXX` div in `index.html`:

```html
<button class="nav-item" data-page="YOUR-PAGE-ID" data-tooltip="Your Label" onclick="navigate('YOUR-PAGE-ID')">
  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <!-- paste an SVG icon path here -->
  </svg>
  <span>Your Label</span>
</button>
```

To make it Admin-only, add `nav-admin-only` to the class list.

For SVG icons, visit: https://lucide.dev — copy the SVG path from any icon.

---

## 8. BRANDING

| Item | File | Where |
|---|---|---|
| App name "SCORVA" in sidebar | `index.html` | Search `sidebar-logo-name` |
| App name "SCORVA" in splash screen | `index.html` | Search `splash-app-name` |
| App subtitle in splash | `index.html` | Search `splash-app-sub` |
| Shield logo SVG | `index.html` | Search `splash-shield` |
| Browser tab title | `index.html` | Line 6 — `<title>` tag |
| PWA app name | `manifest.json` | `"name"` field |

---

## 9. FOOTER

| Item | File | Where |
|---|---|---|
| Author name & title | `index.html` | Search `Syedali Shah` in classification-footer |
| Version number | `index.html` | Search `SCORVA v2.9` in classification-footer |
| About page credit | `pages-part-b.js` | Search `registerPage('about'` → bottom card |
| Footer timestamp (live clock) | `app.js` | Search `updateFooterTime` |

---

## 10. KPI CARDS (Dashboard Numbers)

**File:** `pages-part-a.js`
**Where:** Search `registerPage('command-center'` → look for `div class="kpi-card"`

The 5 KPI cards show:
1. **Open Findings** → links to Tasks & Findings page
2. **CONMON Overdue** → links to CONMON page
3. **Compliance Score %** → calculated from CONMON data
4. **Active ATOs** → links to ATO Tracking page
5. **Unread Alerts** → links to Notifications page

**To change the KPI card size:** Edit `--font-kpi` in `styles.css` configuration block.
**To change KPI colors:** Edit the `style="color:..."` inline on each `.kpi-value` in `pages-part-a.js`.

---

## 11. PLANNED ENHANCEMENTS (20+)

These are improvements identified for future implementation:

| # | Enhancement | Status |
|---|---|---|
| 1 | Configurable font scale via CSS variables | ✅ Done |
| 2 | Navigation restructure (cleaner sections) | ✅ Done |
| 3 | Report Builder moved to Administration | ✅ Done |
| 4 | Software Licenses moved to Resources | ✅ Done |
| 5 | Assets renamed to Resources | ✅ Done |
| 6 | Author credit (Syedali Shah, Senior ISSO) | ✅ Done |
| 7 | Version number corrected to v2.9 | ✅ Done |
| 8 | Data cutoff fix (overflow & word-wrap) | ✅ Done |
| 9 | KPI card redesign (icon as background accent) | ✅ Done |
| 10 | Pulsing notification dot animation | ✅ Done |
| 11 | Header backdrop blur effect | ✅ Done |
| 12 | Sidebar gradient background | ✅ Done |
| 13 | Dot-grid texture on page background | ✅ Done |
| 14 | Page header divider line | ✅ Done |
| 15 | Scroll progress bar (blue gradient) | ✅ Done |
| 16 | System nav group hidden when empty | ✅ Done |
| 17 | Comments added to all nav sections in HTML | ✅ Done |
| 18 | This GUIDE.md master reference document | ✅ Done |
| 19 | Larger avatar with gradient and ring | ✅ Done |
| 20 | Better card hover shadow effects | ✅ Done |
| 21 | min-width: 0 on all grid children (fix overflow) | ✅ Done |
| 22 | Table cells no longer clip long content | ✅ Done |
| 23 | Nav item label truncation with ellipsis | ✅ Done |
| 24 | Global search results bigger text | ✅ Done |
| 25 | KPI color glow effects per card type | ✅ Done |
| 26 | Font base increased to 20px (much larger throughout) | ✅ Done |
| 27 | Nav item font size 15px, group labels 11px bold | ✅ Done |
| 28 | Table rows taller with larger text (15.5px) | ✅ Done |
| 29 | Badge / pill text larger and bolder | ✅ Done |
| 30 | All button text larger (15px base, 17px large) | ✅ Done |
| 31 | Form input text larger (15.5px) | ✅ Done |
| 32 | Modal/drawer title larger (21px bold) | ✅ Done |
| 33 | Section headings (h2/h3/h4) larger and bolder | ✅ Done |
| 34 | Cards have more padding (24px) and a styled header | ✅ Done |
| 35 | Sidebar avatar name / role text larger | ✅ Done |
| 36 | Breadcrumb trail text larger (14px) | ✅ Done |
| 37 | Search bar text and results larger | ✅ Done |
| 38 | Empty state messages clearer and more visible | ✅ Done |
| 39 | Tooltips larger text (13px) | ✅ Done |
| 40 | Footer credit bar larger text (13px bold) | ✅ Done |
| 41 | Notification dot ring glow on hover | ✅ Done |
| 42 | Active nav item stronger highlight with left accent bar | ✅ Done |
| 43 | Table row hover highlight (blue tint) | ✅ Done |
| 44 | Card focus ring for accessibility | ✅ Done |
| 45 | Sidebar custom scrollbar (dark-themed, thin) | ✅ Done |
| 46 | Page content custom scrollbar (dark-themed) | ✅ Done |
| 47 | Status badge colors more distinct with borders | ✅ Done |
| 48 | Section divider/hr lines more visible | ✅ Done |
| 49 | Splash screen app name larger (44px, bold) | ✅ Done |
| 50 | Sidebar logo "SCORVA" bolder (20px, 800 weight) | ✅ Done |
| — | Light mode improvements | 🔲 Planned |
| — | Mobile/tablet responsive improvements | 🔲 Planned |
| — | Exportable PDF with better layout | 🔲 Planned |
| — | User profile page | 🔲 Planned |
| — | Dark/light theme toggle in header | 🔲 Planned |
| — | Keyboard shortcut customization | 🔲 Planned |

---

## 12. FILE MAP

| File | Purpose | Edit when you want to... |
|---|---|---|
| `index.html` | App shell, navigation, overlays | Change nav items, header layout, footer text, meta tags |
| `styles.css` | All visual styling | Change fonts, colors, spacing, layout sizes |
| `app.js` | Core engine, data, utilities | Change data records, add functions, modify behavior |
| `pages-part-a.js` | Dashboard, CONMON, Tasks, My Work, Control Library | Edit those page layouts and content |
| `pages-part-b.js` | All other pages (ATO, POAM, Settings, About, etc.) | Edit those page layouts and content |
| `manifest.json` | PWA settings (install as app) | Change app name, icon, theme color |
| `sw.js` | Service worker (offline support) | (do not edit unless you know what you're doing) |
| `GUIDE.md` | This document | Keep updated as the app changes |

---

*Last updated: March 24, 2026 — Syedali Shah, Senior ISSO*
