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
const mongoose = require('./server/db');

// Pre-register typed Mongoose models
require('./server/models/Employee');
require('./server/models/Document');

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

const _models = {};
function getModel(name) {
    if (_models[name]) return _models[name];
    // Use pre-registered typed models for employees / documents
    try {
        return (_models[name] = mongoose.model(
            name === 'employees' ? 'Employee' :
            name === 'documents' ? 'MashDocument' :
            name
        ));
    } catch { /* fall through — create a flexible model */ }
    const schema = new mongoose.Schema({ _id: String }, { strict: false, versionKey: false });
    schema.set('toJSON', { transform(_, r) { r.id = r._id; delete r._id; return r; } });
    return (_models[name] = mongoose.model(name, schema, name));
}

function dbOk() { return mongoose.connection.readyState === 1; }

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

// Seed once connected
mongoose.connection.once('connected', () => seedAll().catch(console.error));

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

// Serve Vite build if available, otherwise legacy index.html
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
} else {
    app.use(express.static(__dirname));
}

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

// ── Protect all /api/* routes ──────────────────────────────────────────────────
app.use('/api', requireAuth);

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
    if (fs.existsSync(clientDist)) {
        res.sendFile(path.join(clientDist, 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
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
