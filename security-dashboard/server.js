/**
 * MASH – MTSI Advanced Sentinel Hub
 * Express.js server — JWT auth proxied through the Hub, MongoDB persistence
 * Run: npm install && npm start
 */
'use strict';

require('dotenv').config();

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const http     = require('http');
const jwt      = require('jsonwebtoken');
// DB layer removed — MASH runs on JSON file persistence

const PORT       = process.env.PORT || 8080;
const DATA_DIR   = path.join(__dirname, 'data');
const JWT_SECRET = process.env.JWT_SECRET || 'mash-dev-secret-change-in-prod';
const JWT_TTL    = '8h';
const HUB_HOST   = process.env.HUB_HOST || '127.0.0.1';
const HUB_PORT   = parseInt(process.env.HUB_PORT || '3010', 10);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── JSON helpers (seed / fallback) ────────────────────────────────────────────
function readJson(name) {
    const fp = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(fp)) return null;
    try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}
function writeJson(name, data) {
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf8');
}
function validCollection(name) {
    const reserved = ['users', 'role_mappings'];
    return /^[a-z0-9_-]{1,64}$/i.test(name) && !reserved.includes(name);
}
const uid = () => 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

// ── MongoDB model registry ────────────────────────────────────────────────────

// Singletons: entire JSON stored as one doc with _id = 'singleton'
const SINGLETON = new Set(['budget', 'timeline', 'compliance', 'settings']);

function dbOk() { return false; }

// ── Seed collections from JSON on first run ───────────────────────────────────
async function seedOne(name) {
    if (!dbOk()) return;
    const M = getModel(name);
    if (SINGLETON.has(name)) {
        if (await M.exists({ _id: 'singleton' })) return;
        const data = readJson(name);
        if (!data) return;
        await M.create({ _id: 'singleton', ...data });
        console.log(`[MASH] Seeded singleton: ${name}`);
    } else {
        if (await M.countDocuments() > 0) return;
        const data = readJson(name);
        if (!Array.isArray(data)) return;
        for (const item of data) {
            try { await M.create({ ...item, _id: item.id || item._id || uid() }); }
            catch (e) { console.warn(`[MASH] Seed warning [${name}]:`, e.message); }
        }
        console.log(`[MASH] Seeded array: ${name} (${data.length} items)`);
    }
}

async function seedAll() {
    const ALL = ['sites','risks','budget','timeline','compliance','activity',
                 'settings','milestones','construction','employees','documents'];
    for (const c of ALL) await seedOne(c);
    console.log('[MASH] Seed complete.');
}

// Seed JSON files on startup
seedAll().catch(console.error);

// ── MongoDB CRUD helpers ──────────────────────────────────────────────────────

async function dbGet(collection) {
    const M = getModel(collection);
    if (SINGLETON.has(collection)) {
        const doc = await M.findById('singleton').lean();
        if (!doc) return {};
        const { _id, __v, ...rest } = doc;
        return rest;
    }
    const docs = await M.find().lean();
    return docs.map(({ _id, __v, ...rest }) => ({ ...rest, id: _id }));
}

async function dbPut(collection, body) {
    const M = getModel(collection);
    if (SINGLETON.has(collection)) {
        await M.findOneAndReplace({ _id: 'singleton' }, { _id: 'singleton', ...body }, { upsert: true, new: true });
    } else {
        await M.deleteMany({});
        if (Array.isArray(body)) {
            for (const item of body) await M.create({ ...item, _id: item.id || item._id || uid() });
        }
    }
}

async function dbPost(collection, item) {
    const M = getModel(collection);
    if (SINGLETON.has(collection)) {
        await M.findOneAndUpdate({ _id: 'singleton' }, { $set: item }, { upsert: true });
        return item;
    }
    const _id = item.id || uid();
    await M.create({ ...item, _id });
    return { ...item, id: _id };
}

async function dbPatch(collection, id, updates) {
    const M = getModel(collection);
    if (SINGLETON.has(collection)) {
        // Update an item inside a nested array (e.g. a compliance finding)
        const doc = await M.findById('singleton');
        if (!doc) return null;
        for (const arr of ['findings','checklist','standards','milestones','bySite','recentTransactions']) {
            if (!Array.isArray(doc[arr])) continue;
            const idx = doc[arr].findIndex(x => x.id === id);
            if (idx === -1) continue;
            Object.assign(doc[arr][idx], updates);
            doc.markModified(arr);
            await doc.save();
            return doc[arr][idx];
        }
        Object.assign(doc, updates);
        await doc.save();
        return doc.toJSON();
    }
    const doc = await M.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!doc) return null;
    const { _id, __v, ...rest } = doc.toJSON();
    return { ...rest, id: _id };
}

async function dbDelete(collection, id) {
    if (SINGLETON.has(collection)) return false;
    return !!(await getModel(collection).findByIdAndDelete(id));
}

// ── Hub proxy helpers ──────────────────────────────────────────────────────────

/** POST credentials to hub and get back the hub user object. */
function proxyLoginToHub(username, password) {
    const body = JSON.stringify({ username, password });
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: HUB_HOST, port: HUB_PORT,
                path: '/auth/login', method: 'POST',
                headers: {
                    'Content-Type':   'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            res => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode === 200 && parsed.user) resolve(parsed.user);
                        else reject(new Error(parsed.error || 'Invalid credentials'));
                    } catch { reject(new Error('Bad response from hub')); }
                });
                res.on('error', reject);
            }
        );
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Hub auth timeout')); });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/** Consume the hub's one-time SSO token and return the hub user. */
function verifyHubToken(token) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: HUB_HOST, port: HUB_PORT,
                path: `/api/sso/verify?token=${encodeURIComponent(token)}`,
                method: 'GET',
            },
            res => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode === 200 && parsed.valid) resolve(parsed.user);
                        else reject(new Error(parsed.error || 'SSO verification failed'));
                    } catch { reject(new Error('Bad response from hub')); }
                });
                res.on('error', reject);
            }
        );
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('Hub SSO timeout')); });
        req.on('error', reject);
        req.end();
    });
}

// ── Hub user → MASH JWT payload ───────────────────────────────────────────────
function mapHubUser(hubUser) {
    // role_mappings.json: { "<hub_username_lowercase>": { role, siteId, displayTitle } }
    const roleMap = readJson('role_mappings') || {};
    const mapping = roleMap[(hubUser.username || '').toLowerCase()];

    let role   = 'global_fso';   // safe default — restrict later via mapping
    let siteId = null;
    let title  = hubUser.title || hubUser.role || 'Security Staff';

    if (mapping) {
        role   = mapping.role          ?? role;
        siteId = mapping.siteId        ?? siteId;
        title  = mapping.displayTitle  || title;
    } else {
        // Infer from hub role string
        const siteManagerRoles = ['Site Manager', 'Field Officer', 'Site Staff', 'Site Lead'];
        if (siteManagerRoles.some(r => (hubUser.role || '').includes(r))) {
            role = 'site_manager';
        }
    }

    return {
        sub:      hubUser.id || hubUser._id || hubUser.username,
        username: hubUser.username,
        role,
        siteId:   siteId || null,
        name:     hubUser.name  || hubUser.username,
        title,
    };
}

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// The new MASH app is CDN-based (no build step) — always serve from the root
// directory where index.html lives. client/dist is the old Vite build and is
// no longer used; keeping the variable only for the SPA fallback below.
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(__dirname));

// ── RBAC: filter GET response based on role ────────────────────────────────────
const SITE_NAMES = {
    'lincolnia-hq':       'Lincolnia HQ',
    'texas-field':        'Texas Field Office',
    'california-lab':     'California Lab',
    'maryland-warehouse': 'Maryland Warehouse',
    'colorado-springs':   'Colorado Springs',
    'seattle-annex':      'Seattle Annex',
    'dc-metro':           'DC Metro Office',
};

function applyRBAC(collection, data, user) {
    if (user.role !== 'site_manager' || !user.siteId) return data;
    const sid = user.siteId;

    switch (collection) {
        case 'sites':
            return Array.isArray(data) ? data.filter(s => s.id === sid) : data;
        case 'risks':
            return Array.isArray(data) ? data.filter(r => r.siteId === sid || r.siteId === 'all') : data;
        case 'compliance': {
            if (!data || typeof data !== 'object') return data;
            return { ...data, findings: (data.findings || []).filter(f => f.siteId === sid) };
        }
        case 'budget': {
            if (!data || typeof data !== 'object') return data;
            return {
                ...data,
                bySite:             (data.bySite             || []).filter(b => b.siteId === sid),
                recentTransactions: (data.recentTransactions || []).filter(t => t.siteId === sid || t.siteId === 'all'),
            };
        }
        case 'timeline': {
            if (!data || typeof data !== 'object') return data;
            const siteName = SITE_NAMES[sid];
            return {
                ...data,
                milestones: (data.milestones || []).filter(
                    m => m.site === siteName || m.site === 'All Sites' || m.site === 'HQ — All Sites'
                ),
            };
        }
        case 'activity':
            return Array.isArray(data) ? data.filter(a => a.siteId === sid || a.siteId === 'all' || !a.siteId) : data;
        case 'construction':
            return Array.isArray(data) ? data.filter(c => c.siteId === sid) : data;
        case 'employees':
            return Array.isArray(data) ? data.filter(e => e.siteId === sid) : data;
        case 'documents':
            return Array.isArray(data) ? data.filter(d => d.siteId === sid) : data;
        default:
            return data;
    }
}

// ── JWT middleware ─────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
        return res.status(401).json({ error: 'Unauthorized — no token' });
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token expired or invalid' });
    }
}

// ── Public auth routes ─────────────────────────────────────────────────────────

// Direct login — proxies credentials to the Hub
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'Username and password are required' });
    try {
        const hubUser = await proxyLoginToHub(username, password);
        const payload = mapHubUser(hubUser);
        const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
        res.json({ token, user: payload });
    } catch (err) {
        if (err.message === 'Invalid credentials')
            return res.status(401).json({ error: 'Invalid credentials' });
        if (err.message.includes('timeout') || err.message.includes('ECONNREFUSED'))
            return res.status(503).json({ error: 'Hub is unavailable — ensure the Hub server is running on port 3010.' });
        return res.status(503).json({ error: err.message });
    }
});

// Hub SSO entry point — hub redirects here with a one-time token
app.get('/auth/sso', async (req, res) => {
    const { hub_token } = req.query;
    if (!hub_token) return res.redirect('/?sso_error=missing_token');
    try {
        const hubUser = await verifyHubToken(hub_token);
        const payload = { ...mapHubUser(hubUser), via: 'sso' };
        const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
        res.redirect(`/?mash_token=${token}`);
    } catch (err) {
        console.error('[MASH SSO]', err.message);
        res.redirect(`/?sso_error=${encodeURIComponent(err.message)}`);
    }
});

// ── Public executive briefing page (no auth required) ─────────────────────────
app.get(['/briefing', '/briefing.html'], (_req, res) => {
    res.sendFile(path.join(__dirname, 'briefing.html'));
});

// ── Public read-only briefing summary (no auth required) ──────────────────────
app.get('/public/briefing', async (req, res) => {
    try {
        let sites, risks, budget;
        if (dbOk()) {
            [sites, risks, budget] = await Promise.all([
                dbGet('sites'), dbGet('risks'), dbGet('budget'),
            ]);
        } else {
            sites  = readJson('sites')  ?? [];
            risks  = readJson('risks')  ?? [];
            budget = readJson('budget') ?? {};
        }
        res.json({ sites, risks, budget, generatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('[MASH /public/briefing]', err.message);
        res.status(500).json({ error: 'Unable to load briefing data' });
    }
});

// ── Protect all /api/* routes ──────────────────────────────────────────────────
app.use('/api', requireAuth);

// ── Typed Site routes ─────────────────────────────────────────────────────────
// Registered BEFORE the generic /api/:collection handlers.
// Express matches routes in registration order — a literal path segment like
// "sites" would otherwise lose to the :collection wildcard if placed after it.

// POST /api/sites — Create a new facility (Mongoose validates required fields)
app.post('/api/sites', async (req, res) => {
    const { siteId, name } = req.body || {};
    if (!siteId) return res.status(400).json({ error: 'siteId is required' });
    if (!name)   return res.status(400).json({ error: 'name is required' });
    try {
        let doc;
        if (dbOk()) {
            const _id = req.body.id || uid();
            doc = await getModel('sites').create({ ...req.body, _id });
            doc = doc.toJSON();
        } else {
            const item     = { ...req.body, id: req.body.id || uid() };
            const existing = readJson('sites') || [];
            existing.push(item);
            writeJson('sites', existing);
            doc = item;
        }
        res.status(201).json({ ok: true, data: doc });
    } catch (err) {
        console.error('[MASH POST /api/sites]', err.message);
        const status = err.name === 'ValidationError' ? 400 : 500;
        res.status(status).json({ error: err.message });
    }
});

// PUT /api/sites/:id — Replace a single facility document by ID.
// Distinct from PUT /api/:collection (which replaces the whole array).
// runValidators: true re-runs the schema rules on every update.
app.put('/api/sites/:id', async (req, res) => {
    const { id } = req.params;
    if (!req.body.name) return res.status(400).json({ error: 'name is required' });

    // Strip any status value that isn't a valid enum member (e.g. legacy 'green',
    // 'yellow', 'red' from old seed data). Removing it from the $set payload means
    // Mongoose leaves the existing stored value unchanged rather than rejecting the
    // entire update with a ValidationError.
    const VALID_STATUSES = new Set(['Active', 'Construction', 'Renovation', 'Decommissioned']);
    const body = { ...req.body };
    if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
        delete body.status;
    }

    try {
        let doc;
        if (dbOk()) {
            doc = await getModel('sites').findByIdAndUpdate(
                id,
                { $set: body },
                { new: true, runValidators: true }
            );
            if (!doc) return res.status(404).json({ error: 'Site not found' });
            doc = doc.toJSON();
        } else {
            const list = readJson('sites') || [];
            const idx  = list.findIndex(s => s.id === id || s._id === id);
            if (idx === -1) return res.status(404).json({ error: 'Site not found' });
            list[idx] = { ...list[idx], ...body, id };
            writeJson('sites', list);
            doc = list[idx];
        }
        res.json({ ok: true, data: doc });
    } catch (err) {
        console.error('[MASH PUT /api/sites/:id]', err.message);
        const status = err.name === 'ValidationError' ? 400 : 500;
        res.status(status).json({ error: err.message });
    }
});

// ── Typed Inspection routes ───────────────────────────────────────────────────
// Registered BEFORE the generic handlers.
// CRITICAL ordering: /action-items MUST come before /:siteId — otherwise
// Express would treat the literal string "action-items" as a :siteId value.

// POST /api/inspections/import — Bulk-create checklist items for one site
app.post('/api/inspections/import', async (req, res) => {
    const { siteId, items } = req.body || {};
    if (!siteId)                            return res.status(400).json({ error: 'siteId is required' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items must be a non-empty array' });
    try {
        const saved = [];
        if (dbOk()) {
            const M = getModel('inspections');
            for (const item of items) {
                const doc = await M.create({ ...item, siteId, _id: uid() });
                saved.push(doc.toJSON());
            }
        } else {
            const existing = readJson('inspections') || [];
            for (const item of items) {
                const entry = { ...item, siteId, id: uid() };
                existing.push(entry);
                saved.push(entry);
            }
            writeJson('inspections', existing);
        }
        res.status(201).json({ ok: true, count: saved.length, data: saved });
    } catch (err) {
        console.error('[MASH POST /api/inspections/import]', err.message);
        const status = err.name === 'ValidationError' ? 400 : 500;
        res.status(status).json({ error: err.message });
    }
});

// GET /api/inspections/action-items — Fail + Pending items across ALL sites
app.get('/api/inspections/action-items', async (req, res) => {
    try {
        let docs;
        if (dbOk()) {
            docs = await getModel('inspections')
                .find({ status: { $in: ['Fail', 'Pending'] } })
                .lean();
            docs = docs.map(({ _id, __v, ...r }) => ({ ...r, id: _id }));
        } else {
            const all = readJson('inspections') || [];
            docs = all.filter(i => i.status === 'Fail' || i.status === 'Pending');
        }
        res.json(docs);
    } catch (err) {
        console.error('[MASH GET /api/inspections/action-items]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/inspections/:id — Update status + notes on a single checklist item
app.put('/api/inspections/:id', async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body || {};
    try {
        let doc;
        if (dbOk()) {
            doc = await getModel('inspections').findByIdAndUpdate(
                id,
                { $set: { status, notes } },
                { new: true, runValidators: true }
            );
            if (!doc) return res.status(404).json({ error: 'Inspection item not found' });
            doc = doc.toJSON();
        } else {
            const all = readJson('inspections') || [];
            const idx = all.findIndex(i => i.id === id || i._id === id);
            if (idx === -1) return res.status(404).json({ error: 'Inspection item not found' });
            all[idx] = { ...all[idx], status, notes };
            writeJson('inspections', all);
            doc = all[idx];
        }
        res.json({ ok: true, data: doc });
    } catch (err) {
        console.error('[MASH PUT /api/inspections/:id]', err.message);
        const httpStatus = err.name === 'ValidationError' ? 400 : 500;
        res.status(httpStatus).json({ error: err.message });
    }
});

// GET /api/inspections/:siteId — All checklist items for a specific site
app.get('/api/inspections/:siteId', async (req, res) => {
    const { siteId } = req.params;
    try {
        let docs;
        if (dbOk()) {
            docs = await getModel('inspections').find({ siteId }).lean();
            docs = docs.map(({ _id, __v, ...r }) => ({ ...r, id: _id }));
        } else {
            const all = readJson('inspections') || [];
            docs = all.filter(i => i.siteId === siteId);
        }
        res.json(docs);
    } catch (err) {
        console.error(`[MASH GET /api/inspections/${siteId}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Typed Contract routes ─────────────────────────────────────────────────────
// Registered before the generic /api/:collection wildcard.

// POST /api/contracts — Provision a new vendor contract
app.post('/api/contracts', async (req, res) => {
    const { contractId } = req.body || {};
    if (!contractId) return res.status(400).json({ error: 'contractId is required' });
    try {
        let doc;
        if (dbOk()) {
            const _id = req.body.id || uid();
            doc = await getModel('contracts').create({ ...req.body, _id });
            doc = doc.toJSON();
        } else {
            const item     = { ...req.body, id: req.body.id || uid() };
            const existing = readJson('contracts') || [];
            existing.push(item);
            writeJson('contracts', existing);
            doc = item;
        }
        res.status(201).json({ ok: true, data: doc });
    } catch (err) {
        console.error('[MASH POST /api/contracts]', err.message);
        const status = err.name === 'ValidationError' ? 400 : 500;
        res.status(status).json({ error: err.message });
    }
});

// PUT /api/contracts/:id — Edit a contract or log an expense against it.
//
// Audit trail: if amountSpent is present in the body, this is an expense-log
// operation. We read the existing amountSpent first, compute the delta, then
// insert an immutable Transaction record alongside the contract update.
app.put('/api/contracts/:id', async (req, res) => {
    const { id }       = req.params;
    const isExpense    = req.body.amountSpent !== undefined;
    const txnShortId   = () => 'TXN-' + Math.random().toString(36).slice(2, 7).toUpperCase();

    try {
        let doc;
        if (dbOk()) {
            // Read old value so we can compute the expense delta
            let expenseDelta = 0;
            if (isExpense) {
                const existing = await getModel('contracts').findById(id).lean();
                if (existing) {
                    expenseDelta = (req.body.amountSpent || 0) - (existing.amountSpent || 0);
                }
            }

            doc = await getModel('contracts').findByIdAndUpdate(
                id,
                { $set: req.body },
                { new: true, runValidators: true }
            );
            if (!doc) return res.status(404).json({ error: 'Contract not found' });
            doc = doc.toJSON();

            // Write audit record — fire-and-forget (don't fail the PUT if this errors)
            if (isExpense && expenseDelta > 0) {
                getModel('transactions').create({
                    _id:           uid(),
                    transactionId: txnShortId(),
                    contractId:    doc.contractId || '',
                    siteId:        doc.siteId     || '',
                    amount:        expenseDelta,
                    type:          'Expense',
                    date:          new Date(),
                }).catch(e => console.error('[MASH TXN create]', e.message));
            }
        } else {
            const list = readJson('contracts') || [];
            const idx  = list.findIndex(c => c.id === id || c._id === id);
            if (idx === -1) return res.status(404).json({ error: 'Contract not found' });

            if (isExpense) {
                const expenseDelta = (req.body.amountSpent || 0) - (list[idx].amountSpent || 0);
                if (expenseDelta > 0) {
                    const txns = readJson('transactions') || [];
                    txns.unshift({
                        id:            uid(),
                        transactionId: txnShortId(),
                        contractId:    list[idx].contractId || '',
                        siteId:        list[idx].siteId     || '',
                        amount:        expenseDelta,
                        type:          'Expense',
                        date:          new Date().toISOString(),
                    });
                    writeJson('transactions', txns);
                }
            }

            list[idx] = { ...list[idx], ...req.body, id };
            writeJson('contracts', list);
            doc = list[idx];
        }
        res.json({ ok: true, data: doc });
    } catch (err) {
        console.error('[MASH PUT /api/contracts/:id]', err.message);
        const status = err.name === 'ValidationError' ? 400 : 500;
        res.status(status).json({ error: err.message });
    }
});

// ── Budget / site-utilization aggregation ────────────────────────────────────
// GET /api/budget/site-utilization
//
// Groups all Contract documents by siteId, sums totalValue (allocated) and
// amountSpent (spent), then $lookup-joins the sites collection to resolve each
// siteId to a human-readable facility name.
//
// Pipeline (two stages + $lookup):
//   Stage 1 — $group by siteId → sum allocated + spent
//   Stage 2 — $lookup against 'sites' on localField: siteId / foreignField: siteId
//   Stage 3 — $project to shape the output (siteId, siteName, allocated, spent, percentage)
//
// JSON fallback replicates the same logic in plain JS using a Map.
//
// Registered before GET /api/:collection to avoid the wildcard eating the path.
app.get('/api/budget/site-utilization', async (req, res) => {
    try {
        let docs;
        if (dbOk()) {
            docs = await getModel('contracts').aggregate([
                {
                    $group: {
                        _id:       '$siteId',
                        allocated: { $sum: '$totalValue' },
                        spent:     { $sum: '$amountSpent' },
                    },
                },
                {
                    // JOIN: resolve each siteId to its Site document for the facility name
                    $lookup: {
                        from:         'sites',
                        localField:   '_id',      // the grouped contract siteId
                        foreignField: 'siteId',   // the siteId field on Site documents
                        as:           'siteData',
                    },
                },
                {
                    $project: {
                        _id:        0,
                        siteId:     '$_id',
                        siteName:   {
                            $ifNull: [{ $arrayElemAt: ['$siteData.name', 0] }, '$_id'],
                        },
                        allocated:  1,
                        spent:      1,
                        percentage: {
                            $cond: [
                                { $gt: ['$allocated', 0] },
                                {
                                    $round: [
                                        { $multiply: [{ $divide: ['$spent', '$allocated'] }, 100] },
                                        0,
                                    ],
                                },
                                0,
                            ],
                        },
                    },
                },
                { $sort: { percentage: -1 } },
            ]);
        } else {
            // JSON fallback — replicate the aggregation with plain JS
            const contracts = readJson('contracts') || [];
            const sites     = readJson('sites')     || [];
            const siteMap   = new Map(
                sites.map(s => [s.siteId || s.id || s._id, s.name || s.siteId || '—'])
            );
            const grouped   = new Map();
            for (const c of contracts) {
                const sid = c.siteId || null;
                if (!sid) continue;
                if (!grouped.has(sid)) grouped.set(sid, { allocated: 0, spent: 0 });
                const g  = grouped.get(sid);
                g.allocated += c.totalValue  || 0;
                g.spent     += c.amountSpent || 0;
            }
            docs = [...grouped.entries()]
                .map(([siteId, { allocated, spent }]) => ({
                    siteId,
                    siteName:   siteMap.get(siteId) || siteId,
                    allocated,
                    spent,
                    percentage: allocated > 0 ? Math.round((spent / allocated) * 100) : 0,
                }))
                .sort((a, b) => b.percentage - a.percentage);
        }
        res.json(docs);
    } catch (err) {
        console.error('[MASH GET /api/budget/site-utilization]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/budget/transactions — Latest 50 audit records, newest first
app.get('/api/budget/transactions', async (req, res) => {
    try {
        let docs;
        if (dbOk()) {
            const raw = await getModel('transactions')
                .find()
                .sort({ date: -1 })
                .limit(50)
                .lean();
            docs = raw.map(({ _id, __v, ...r }) => ({ ...r, id: _id }));
        } else {
            const all = readJson('transactions') || [];
            docs = [...all]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 50);
        }
        res.json(docs);
    } catch (err) {
        console.error('[MASH GET /api/budget/transactions]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Compliance matrix aggregation ────────────────────────────────────────────
// GET /api/compliance/matrix
//
// Aggregates InspectionItem documents into a per-control summary.
// Each row answers: "of the sites that HAVE this control, how many passed?"
//
// MongoDB pipeline (two-stage):
//   Stage 1 — group by (controlId, siteId) so each site contributes one row
//             per control regardless of how many checklist entries it has.
//   Stage 2 — group by controlId to count totalApplicableSites and
//             compliantSites (those with status === 'Pass').
//
// JSON fallback reproduces the same logic in plain JS using a Map.
//
// Registered before GET /api/:collection so the literal path segment
// "compliance" is never mistaken for a :collection wildcard parameter.
app.get('/api/compliance/matrix', async (req, res) => {
    try {
        let docs;
        if (dbOk()) {
            const M = getModel('inspections');
            const rows = await M.aggregate([
                // Stage 1 — one row per (controlId, siteId) pair
                {
                    $group: {
                        _id:         { controlId: '$controlId', siteId: '$siteId' },
                        status:      { $first: '$status' },
                        description: { $first: '$description' },
                    },
                },
                // Stage 2 — roll up to controlId, count sites and passing sites
                {
                    $group: {
                        _id:                  '$_id.controlId',
                        description:          { $first: '$description' },
                        totalApplicableSites: { $sum: 1 },
                        compliantSites:       {
                            $sum: { $cond: [{ $eq: ['$status', 'Pass'] }, 1, 0] },
                        },
                    },
                },
                {
                    $project: {
                        _id:                  0,
                        controlId:            '$_id',
                        description:          1,
                        totalApplicableSites: 1,
                        compliantSites:       1,
                    },
                },
                { $sort: { controlId: 1 } },
            ]);
            docs = rows;
        } else {
            // JSON fallback — same logic in plain JS
            const all = readJson('inspections') || [];
            // Map: controlId → { siteIds: Set, passSiteIds: Set, description }
            const map = new Map();
            for (const item of all) {
                const cid = item.controlId || 'UNKNOWN';
                if (!map.has(cid)) {
                    map.set(cid, { description: item.description || '', siteIds: new Set(), passSiteIds: new Set() });
                }
                const entry = map.get(cid);
                if (item.siteId) entry.siteIds.add(item.siteId);
                if (item.status === 'Pass' && item.siteId) entry.passSiteIds.add(item.siteId);
            }
            docs = [...map.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([controlId, v]) => ({
                    controlId,
                    description:          v.description,
                    totalApplicableSites: v.siteIds.size,
                    compliantSites:       v.passSiteIds.size,
                }));
        }
        res.json(docs);
    } catch (err) {
        console.error('[MASH GET /api/compliance/matrix]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Executive Summary aggregation ────────────────────────────────────────────
// GET /api/executive-summary
//
// Fires six simultaneous MongoDB aggregations via Promise.all and returns a
// single JSON object with the three KPI buckets the ExecutiveBriefing needs:
//
//   financials  — Contract totals (allocated / spent / count)
//   exposures   — InspectionItem counts by status + top-5 failing controls
//   sites       — Site totals, per-site fail counts, top-5 contracts by value
//
// JSON fallback replicates the same logic in plain JS using reduce + Map.
//
// Registered before the generic handlers so "executive-summary" is never
// mistaken for a :collection wildcard value.
app.get('/api/executive-summary', async (req, res) => {
    try {
        if (dbOk()) {
            const [
                finRows,        // Contract $group → allocated, spent, count
                statusRows,     // InspectionItem $group by status
                siteStatRows,   // Site $group by status
                topControls,    // top-5 failing controlIds
                topContracts,   // top-5 contracts by totalValue
                failBySite,     // failing count per siteId
                txnRows,        // monthly transaction totals for burn history
            ] = await Promise.all([

                // 1 — Contract totals
                getModel('contracts').aggregate([{
                    $group: {
                        _id:       null,
                        allocated: { $sum: '$totalValue'  },
                        spent:     { $sum: '$amountSpent' },
                        count:     { $sum: 1              },
                    },
                }]),

                // 2 — Inspection items grouped by status
                getModel('inspections').aggregate([{
                    $group: { _id: '$status', count: { $sum: 1 } },
                }]),

                // 3 — Sites grouped by status
                getModel('sites').aggregate([{
                    $group: { _id: '$status', count: { $sum: 1 } },
                }]),

                // 4 — Top-5 most common failing controls
                getModel('inspections').aggregate([
                    { $match: { status: 'Fail' } },
                    {
                        $group: {
                            _id:         '$controlId',
                            description: { $first: '$description' },
                            failCount:   { $sum: 1 },
                        },
                    },
                    { $sort: { failCount: -1 } },
                    { $limit: 5 },
                    { $project: { _id: 0, controlId: '$_id', description: 1, failCount: 1 } },
                ]),

                // 5 — Top-5 contracts by totalValue
                getModel('contracts').find().sort({ totalValue: -1 }).limit(5).lean(),

                // 6 — Per-site failing inspection counts
                getModel('inspections').aggregate([
                    { $match: { status: 'Fail' } },
                    { $group: { _id: '$siteId', failCount: { $sum: 1 } } },
                ]),

                // 7 — Monthly transaction totals (for burn history sparkline)
                getModel('transactions').aggregate([
                    {
                        $group: {
                            _id:   { year: { $year: '$date' }, month: { $month: '$date' } },
                            spent: { $sum: '$amount' },
                        },
                    },
                    { $sort: { '_id.year': 1, '_id.month': 1 } },
                ]),
            ]);

            // Parse financial row
            const fin       = finRows[0] || { allocated: 0, spent: 0, count: 0 };

            // Parse inspection status counts
            let failCount = 0, pendingCount = 0;
            for (const row of statusRows) {
                if (row._id === 'Fail')    failCount    = row.count;
                if (row._id === 'Pending') pendingCount = row.count;
            }

            // Per-site failing map  { siteId → failCount }
            const perSiteFailing = {};
            for (const row of failBySite) { perSiteFailing[row._id] = row.failCount; }

            // Site status breakdown + readiness count
            const bySiteStatus = {};
            for (const row of siteStatRows) { bySiteStatus[row._id || 'Unknown'] = row.count; }
            const totalSiteCount = Object.values(bySiteStatus).reduce((s, n) => s + n, 0);
            const readySites     = totalSiteCount - Object.keys(perSiteFailing).length;

            // Build 6-month burn history
            const MONTH_NAMES  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const plannedPerMo = fin.allocated ? Math.round(fin.allocated / 12) : 0;
            const now          = new Date();
            const burnHistory  = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const y = d.getFullYear(), m = d.getMonth() + 1;
                const row = txnRows.find(r => r._id.year === y && r._id.month === m);
                burnHistory.push({ month: MONTH_NAMES[m - 1], spent: row ? row.spent : 0, planned: plannedPerMo });
            }

            res.json({
                financials: {
                    allocated:     fin.allocated,
                    spent:         fin.spent,
                    contractCount: fin.count,
                    burnHistory,
                },
                exposures: {
                    total:       failCount + pendingCount,
                    failing:     failCount,
                    pending:     pendingCount,
                    topControls,
                },
                sites: {
                    total:         totalSiteCount,
                    readySites:    Math.max(0, readySites),
                    bySiteStatus,
                    perSiteFailing,
                    topContracts:  topContracts.map(({ _id, __v, ...r }) => ({ ...r, id: _id })),
                },
            });

        } else {
            // ── JSON fallback ─────────────────────────────────────────────────
            const contracts    = readJson('contracts')    || [];
            const inspections  = readJson('inspections')  || [];
            const sites        = readJson('sites')        || [];
            const transactions = readJson('transactions') || [];

            const allocated = contracts.reduce((s, c) => s + (c.totalValue  || 0), 0);
            const spent     = contracts.reduce((s, c) => s + (c.amountSpent || 0), 0);

            const failItems    = inspections.filter(i => i.status === 'Fail');
            const pendingItems = inspections.filter(i => i.status === 'Pending');

            // Top-5 failing controls
            const ctrlMap = new Map();
            for (const item of failItems) {
                const cid = item.controlId || 'UNKNOWN';
                if (!ctrlMap.has(cid))
                    ctrlMap.set(cid, { controlId: cid, description: item.description || '', failCount: 0 });
                ctrlMap.get(cid).failCount++;
            }
            const topControls = [...ctrlMap.values()]
                .sort((a, b) => b.failCount - a.failCount)
                .slice(0, 5);

            // Per-site failing map
            const perSiteFailing = {};
            for (const item of failItems) {
                if (item.siteId) perSiteFailing[item.siteId] = (perSiteFailing[item.siteId] || 0) + 1;
            }
            const readySites = sites.filter(s => !perSiteFailing[s.siteId || s.id]).length;

            // Site status breakdown
            const bySiteStatus = {};
            for (const s of sites) {
                const st = s.status || 'Unknown';
                bySiteStatus[st] = (bySiteStatus[st] || 0) + 1;
            }

            const topContracts = [...contracts]
                .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
                .slice(0, 5);

            // 6-month burn history from transactions JSON
            const MONTH_NAMES_FB  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const plannedPerMoFB  = allocated ? Math.round(allocated / 12) : 0;
            const nowFB           = new Date();
            const burnHistory     = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(nowFB.getFullYear(), nowFB.getMonth() - i, 1);
                const y = d.getFullYear(), m = d.getMonth();  // 0-based
                const mo = transactions
                    .filter(t => { const td = new Date(t.date); return td.getFullYear() === y && td.getMonth() === m; })
                    .reduce((s, t) => s + (t.amount || 0), 0);
                burnHistory.push({ month: MONTH_NAMES_FB[m], spent: mo, planned: plannedPerMoFB });
            }

            res.json({
                financials: { allocated, spent, contractCount: contracts.length, burnHistory },
                exposures:  { total: failItems.length + pendingItems.length, failing: failItems.length, pending: pendingItems.length, topControls },
                sites:      { total: sites.length, readySites, bySiteStatus, perSiteFailing, topContracts },
            });
        }
    } catch (err) {
        console.error('[MASH GET /api/executive-summary]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Typed Timeline milestone routes ──────────────────────────────────────────
// Milestones live inside the `timeline` singleton document under a `milestones`
// array.  The generic PATCH /api/:collection/:id already handles in-place edits
// (dbPatch searches singleton arrays by item.id).  We only need typed routes for
// CREATE and DELETE since neither maps cleanly to the generic handlers.
//
// Both paths have three segments after /api/ so they never collide with the
// two-segment generic /api/:collection or three-segment /api/:collection/:id.

// POST /api/timeline/milestones — push a new milestone into the singleton array
app.post('/api/timeline/milestones', async (req, res) => {
    try {
        const milestone = { ...req.body, id: req.body.id || uid() };
        if (dbOk()) {
            const M   = getModel('timeline');
            const doc = await M.findById('singleton');
            if (!doc) return res.status(404).json({ error: 'Timeline not initialised' });
            if (!Array.isArray(doc.milestones)) doc.milestones = [];
            doc.milestones.push(milestone);
            doc.markModified('milestones');
            await doc.save();
        } else {
            const tl = readJson('timeline') || {};
            const ms = Array.isArray(tl.milestones) ? tl.milestones : [];
            ms.push(milestone);
            writeJson('timeline', { ...tl, milestones: ms });
        }
        res.status(201).json({ ok: true, data: milestone });
    } catch (err) {
        console.error('[MASH POST /api/timeline/milestones]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/timeline/milestones/:id — remove one milestone by id
app.delete('/api/timeline/milestones/:id', async (req, res) => {
    const { id } = req.params;
    try {
        if (dbOk()) {
            const M   = getModel('timeline');
            const doc = await M.findById('singleton');
            if (!doc) return res.status(404).json({ error: 'Timeline not initialised' });
            const before = (doc.milestones || []).length;
            doc.milestones = (doc.milestones || []).filter(m => m.id !== id);
            if (doc.milestones.length === before)
                return res.status(404).json({ error: 'Milestone not found' });
            doc.markModified('milestones');
            await doc.save();
        } else {
            const tl = readJson('timeline') || {};
            const ms = Array.isArray(tl.milestones) ? tl.milestones : [];
            const filtered = ms.filter(m => m.id !== id);
            if (filtered.length === ms.length)
                return res.status(404).json({ error: 'Milestone not found' });
            writeJson('timeline', { ...tl, milestones: filtered });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(`[MASH DELETE /api/timeline/milestones/${id}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Generic CRUD ───────────────────────────────────────────────────────────────

app.get('/api/:collection', async (req, res) => {
    const { collection } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    try {
        let data;
        if (dbOk()) {
            data = await dbGet(collection);
        } else {
            data = readJson(collection);
            data = SINGLETON.has(collection) ? (data ?? {}) : (data ?? []);
        }
        res.json(applyRBAC(collection, data, req.user));
    } catch (err) {
        console.error('[MASH GET]', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/:collection', async (req, res) => {
    const { collection } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    try {
        if (dbOk()) { await dbPut(collection, req.body); }
        else         { writeJson(collection, req.body); }
        res.json({ ok: true });
    } catch (err) {
        console.error('[MASH PUT]', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/:collection', async (req, res) => {
    const { collection } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    try {
        let result;
        if (dbOk()) {
            result = await dbPost(collection, req.body);
        } else {
            const item     = req.body;
            const existing = readJson(collection);
            if (Array.isArray(existing)) { existing.push(item); writeJson(collection, existing); }
            else                         { writeJson(collection, item); }
            result = item;
        }
        res.status(201).json({ ok: true, data: result });
    } catch (err) {
        console.error('[MASH POST]', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

app.patch('/api/:collection/:id', async (req, res) => {
    const { collection, id } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    try {
        let result;
        if (dbOk()) {
            result = await dbPatch(collection, id, req.body);
            if (!result) return res.status(404).json({ error: 'Not found' });
        } else {
            const existing = readJson(collection);
            if (Array.isArray(existing)) {
                const idx = existing.findIndex(i => i.id === id);
                if (idx === -1) return res.status(404).json({ error: 'Not found' });
                existing[idx] = { ...existing[idx], ...req.body };
                writeJson(collection, existing);
                result = existing[idx];
            } else if (existing && typeof existing === 'object') {
                Object.assign(existing, req.body);
                writeJson(collection, existing);
                result = existing;
            } else {
                return res.status(400).json({ error: 'Cannot PATCH this collection' });
            }
        }
        res.json({ ok: true, data: result });
    } catch (err) {
        console.error('[MASH PATCH]', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/:collection/:id', async (req, res) => {
    const { collection, id } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    try {
        if (dbOk()) {
            const ok = await dbDelete(collection, id);
            if (!ok) return res.status(404).json({ error: 'Not found or cannot delete singleton' });
        } else {
            const existing = readJson(collection);
            if (!Array.isArray(existing)) return res.status(400).json({ error: 'Not an array' });
            writeJson(collection, existing.filter(i => i.id !== id));
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('[MASH DELETE]', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log('\x1b[36m');
    console.log('  ███╗   ███╗ █████╗ ███████╗██╗  ██╗');
    console.log('  ████╗ ████║██╔══██╗██╔════╝██║  ██║');
    console.log('  ██╔████╔██║███████║███████╗███████║');
    console.log('  ██║╚██╔╝██║██╔══██║╚════██║██╔══██║');
    console.log('  ██║ ╚═╝ ██║██║  ██║███████║██║  ██║');
    console.log('  ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝\x1b[0m');
    console.log(`\x1b[90m  MTSI Advanced Sentinel Hub  v2.3.0  (MongoDB + Hub Auth)\x1b[0m`);
    console.log(`\x1b[32m  ● Running → http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[90m  Hub      → http://${HUB_HOST}:${HUB_PORT}\x1b[0m\n`);
    if (JWT_SECRET === 'mash-dev-secret-change-in-prod')
        console.log('\x1b[33m  ⚠ JWT_SECRET not set — use env var in production\x1b[0m\n');
});
