/**
 * MASH – MTSI Advanced Sentinel Hub
 * Express.js server (MERN stack — JSON file persistence)
 * Run: npm install && npm start
 */
const express = require('express');
const fs      = require('fs');
const path    = require('path');

const PORT     = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ── JSON helpers ───────────────────────────────────────────────────────────────
function readJson(name) {
    const fp = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(fp)) return null;
    try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}
function writeJson(name, data) {
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf8');
}

// ── Validate collection name (no path traversal) ──────────────────────────────
function validCollection(name) {
    return /^[a-z0-9_-]{1,64}$/i.test(name);
}

// ── API routes ─────────────────────────────────────────────────────────────────

// GET /api/:collection
app.get('/api/:collection', (req, res) => {
    const { collection } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    const data = readJson(collection);
    if (collection === 'budget') {
        res.json(data !== null ? data : {});
    } else {
        res.json(data !== null ? data : []);
    }
});

// PUT /api/:collection  — replace entire collection
app.put('/api/:collection', (req, res) => {
    const { collection } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    writeJson(collection, req.body);
    res.json({ ok: true });
});

// POST /api/:collection  — append item (array) or replace (object)
app.post('/api/:collection', (req, res) => {
    const { collection } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    const item     = req.body;
    const existing = readJson(collection);
    if (Array.isArray(existing)) {
        existing.push(item);
        writeJson(collection, existing);
    } else {
        writeJson(collection, item);
    }
    res.status(201).json({ ok: true, data: item });
});

// PATCH /api/:collection/:id  — partial update by id
app.patch('/api/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    const existing = readJson(collection);
    if (Array.isArray(existing)) {
        const idx = existing.findIndex(i => i.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        existing[idx] = { ...existing[idx], ...req.body };
        writeJson(collection, existing);
        return res.json({ ok: true, data: existing[idx] });
    }
    if (existing && typeof existing === 'object') {
        Object.assign(existing, req.body);
        writeJson(collection, existing);
        return res.json({ ok: true, data: existing });
    }
    res.status(400).json({ error: 'Cannot PATCH this collection' });
});

// DELETE /api/:collection/:id
app.delete('/api/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    if (!validCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
    const existing = readJson(collection);
    if (!Array.isArray(existing)) return res.status(400).json({ error: 'Not an array' });
    writeJson(collection, existing.filter(i => i.id !== id));
    res.json({ ok: true });
});

// ── Catch-all → index.html ─────────────────────────────────────────────────────
app.get('*', (req, res) => {
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
    console.log(`\x1b[90m  MTSI Advanced Sentinel Hub  v2.2.0  (Express)\x1b[0m`);
    console.log(`\x1b[32m  ● Running → http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[90m  Data dir → ${DATA_DIR}\x1b[0m\n`);
});
