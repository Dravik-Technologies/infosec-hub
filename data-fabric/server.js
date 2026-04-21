const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  cleanupExpiredSessions,
  createSession,
  deleteSession,
  hasSession,
  isDbConfigured,
  readDocument,
  seedDocument,
  writeDocument,
} = require('./pg-store');

const app = express();
const PORT = process.env.PORT || 8081;
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(__dirname, 'admin-config.json');
const DEFAULT_ADMIN = { username: 'admin', password: 'cimarc2026' };
const localSessions = new Set();

app.use(express.json());
app.use(express.static(__dirname));

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function defaultAdminConfig() {
  return {
    usernameHash: sha256(DEFAULT_ADMIN.username),
    passwordHash: sha256(DEFAULT_ADMIN.password),
  };
}

function ensureLocalAdminConfig() {
  if (fs.existsSync(CONFIG_FILE)) return;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultAdminConfig(), null, 2));
  console.log('');
  console.log('  Admin config created with default credentials:');
  console.log(`    Username : ${DEFAULT_ADMIN.username}`);
  console.log(`    Password : ${DEFAULT_ADMIN.password}`);
  console.log('');
}

function readLocalJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function seedDatabase() {
  if (!isDbConfigured()) return;

  const docs = ['blog', 'digital-pmr', 'glossary', 'monthly-reports', 'schedule'];
  for (const name of docs) {
    const fallback = readLocalJson(path.join(DATA_DIR, `${name}.json`));
    await seedDocument(name, fallback);
  }

  const configFallback = fs.existsSync(CONFIG_FILE)
    ? readLocalJson(CONFIG_FILE)
    : defaultAdminConfig();
  await seedDocument('admin-config', configFallback || defaultAdminConfig());
  await cleanupExpiredSessions();
}

if (!isDbConfigured()) ensureLocalAdminConfig();
seedDatabase().catch(err => console.error('[DATA-FABRIC] Seed failed:', err.message));
setInterval(() => {
  if (isDbConfigured()) cleanupExpiredSessions().catch(() => {});
}, 60 * 60 * 1000);

async function loadAdminConfig() {
  if (isDbConfigured()) {
    const config = await readDocument('admin-config');
    return config || defaultAdminConfig();
  }

  ensureLocalAdminConfig();
  return readLocalJson(CONFIG_FILE) || defaultAdminConfig();
}

async function loadDataFile(baseName) {
  if (isDbConfigured()) {
    const doc = await readDocument(baseName);
    if (doc != null) return doc;
  }

  return readLocalJson(path.join(DATA_DIR, `${baseName}.json`));
}

async function saveDataFile(baseName, body) {
  if (isDbConfigured()) {
    await writeDocument(baseName, body);
    return;
  }

  fs.writeFileSync(path.join(DATA_DIR, `${baseName}.json`), JSON.stringify(body, null, 2), 'utf8');
}

async function requireAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const authorized = isDbConfigured() ? await hasSession(token) : localSessions.has(token);
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const config = await loadAdminConfig();
    if (sha256(username) === config.usernameHash && sha256(password) === config.passwordHash) {
      const token = crypto.randomBytes(32).toString('hex');
      if (isDbConfigured()) {
        await createSession(token);
      } else {
        localSessions.add(token);
      }
      return res.json({ token });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch {
    return res.status(500).json({ error: 'Server config error' });
  }
});

app.post('/api/logout', requireAuth, async (req, res) => {
  const token = req.headers['x-session-token'];
  if (isDbConfigured()) {
    await deleteSession(token);
  } else {
    localSessions.delete(token);
  }
  res.json({ ok: true });
});

app.get('/api/session', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/data/:file', async (req, res) => {
  const file = req.params.file;
  if (!/^[a-z0-9-]+\.json$/.test(file)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const baseName = file.replace(/\.json$/, '');
  const data = await loadDataFile(baseName);
  if (data == null) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.json(data);
});

app.post('/api/data/:file', requireAuth, async (req, res) => {
  const file = req.params.file;
  if (!/^[a-z0-9-]+\.json$/.test(file)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    await saveDataFile(file.replace(/\.json$/, ''), req.body);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to write file' });
  }
});

app.get('/sso', async (req, res) => {
  const { hub_token } = req.query;
  if (!hub_token) return res.redirect('/');

  try {
    const hubUrl = process.env.HUB_URL || 'http://localhost:3010';
    const response = await fetch(`${hubUrl}/api/sso/verify?token=${encodeURIComponent(String(hub_token))}`);
    const body = await response.json();
    if (!response.ok || !body.valid) return res.redirect('/');

    const token = crypto.randomBytes(32).toString('hex');
    if (isDbConfigured()) {
      await createSession(token);
    } else {
      localSessions.add(token);
    }

    res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
<script>
sessionStorage.setItem('cimarc_admin_token', ${JSON.stringify(token)});
window.location.href = '/';
</script>
</body>
</html>`);
  } catch {
    res.redirect('/');
  }
});

app.listen(PORT, () => {
  console.log(`CIM-ARC server running at http://localhost:${PORT}`);
  console.log(`Admin panel:           http://localhost:${PORT}/admin.html`);
  if (isDbConfigured()) {
    console.log('Data storage:          PostgreSQL-backed documents and sessions');
  } else {
    console.log('Data storage:          Local file fallback (set DATABASE_URL for PostgreSQL)');
  }
});
