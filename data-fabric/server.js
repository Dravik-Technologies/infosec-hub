const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8081;
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(__dirname, 'admin-config.json');

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(__dirname));

// ── Session store (in-memory; clears on server restart) ───────────────────────
const sessions = new Set();

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ── First-run: create default config if missing ───────────────────────────────
if (!fs.existsSync(CONFIG_FILE)) {
  const defaultUser = 'admin';
  const defaultPass = 'cimarc2026';
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    usernameHash: sha256(defaultUser),
    passwordHash: sha256(defaultPass)
  }, null, 2));
  console.log('');
  console.log('  Admin config created with default credentials:');
  console.log('    Username : admin');
  console.log('    Password : cimarc2026');
  console.log('');
  console.log('  To change password, run:');
  console.log('    node -e "const c=require(\'crypto\'),fs=require(\'fs\');');
  console.log('    fs.writeFileSync(\'admin-config.json\',JSON.stringify({');
  console.log('    usernameHash:c.createHash(\'sha256\').update(\'admin\').digest(\'hex\'),');
  console.log('    passwordHash:c.createHash(\'sha256\').update(\'NEWPASSWORD\').digest(\'hex\')');
  console.log('    },null,2));"');
  console.log('');
}

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Login ─────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return res.status(500).json({ error: 'Server config error' });
  }
  if (sha256(username) === config.usernameHash && sha256(password) === config.passwordHash) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.add(token);
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// ── Logout ────────────────────────────────────────────────────────────────────
app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(req.headers['x-session-token']);
  res.json({ ok: true });
});

// ── Validate session (used by admin page on load) ─────────────────────────────
app.get('/api/session', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

// ── GET data file (public — pages fetch their own data) ───────────────────────
app.get('/api/data/:file', (req, res) => {
  const file = req.params.file;
  if (!/^[a-z0-9-]+\.json$/.test(file)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// ── POST data file (admin only — saves updated JSON) ─────────────────────────
app.post('/api/data/:file', requireAuth, (req, res) => {
  const file = req.params.file;
  if (!/^[a-z0-9-]+\.json$/.test(file)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(DATA_DIR, file);
  try {
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// ── SSO — accept a hub one-time token, create a local session ────────────────
app.get('/sso', async (req, res) => {
  const { hub_token } = req.query;
  if (!hub_token) return res.redirect('/');
  try {
    const hubUrl = process.env.HUB_URL || 'http://localhost:3010';
    const r = await fetch(`${hubUrl}/api/sso/verify?token=${encodeURIComponent(String(hub_token))}`);
    const body = await r.json();
    if (!r.ok || !body.valid) return res.redirect('/');
    const token = crypto.randomBytes(32).toString('hex');
    sessions.add(token);
    // Return a small HTML page that stores the token and navigates home
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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`CIM-ARC server running at http://localhost:${PORT}`);
  console.log(`Admin panel:           http://localhost:${PORT}/admin.html`);
});
