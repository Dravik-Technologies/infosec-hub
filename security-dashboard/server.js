/**
 * MASH – MTSI Advanced Sentinel Hub
 * Express.js server — JWT auth proxied through the Hub, PostgreSQL-backed persistence
 * Run: npm install && npm start
 */
'use strict';

require('dotenv').config();

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const jwt      = require('jsonwebtoken');
const { dbOk, getDb, getModel, readCollection } = require('./pg-store');

const PORT       = process.env.PORT || 8080;
const DATA_DIR   = path.join(__dirname, 'data');
const JWT_SECRET = process.env.JWT_SECRET || 'mash-dev-secret-change-in-prod';
const JWT_TTL    = '8h';
const AUTH_VERSION = 2;
const HUB_URL    = process.env.HUB_URL || null;
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

// Singletons: entire JSON stored as one doc with _id = 'singleton'
const SINGLETON = new Set(['budget', 'timeline', 'compliance', 'settings', 'role_mappings']);

const ROLE_DEFS = {
    vp_security: {
        label: 'VP of Security',
        domains: ['executive', 'cyber', 'physical', 'personnel', 'industrial', 'program', 'pm', 'risk'],
        permissions: ['*'],
    },
    global_fso: {
        label: 'Global FSO',
        domains: ['executive', 'physical', 'personnel', 'industrial', 'program', 'pm', 'risk'],
        permissions: ['*'],
    },
    security_director: {
        label: 'Director of Security',
        domains: ['executive', 'cyber', 'physical', 'personnel', 'industrial', 'program', 'pm', 'risk'],
        permissions: ['*'],
    },
    persec: {
        label: 'Personnel Security',
        domains: ['personnel'],
        permissions: ['personnel_security:write', 'employees:write', 'risks:write'],
    },
    industrial_security: {
        label: 'Industrial Security',
        domains: ['industrial', 'physical'],
        permissions: ['compliance:write', 'self_inspections:write', 'physical_systems:write', 'risks:write'],
    },
    program_security: {
        label: 'Program Security',
        domains: ['program', 'risk'],
        permissions: ['compliance:write', 'documents:write', 'risks:write', 'timeline:write'],
    },
    cybersecurity: {
        label: 'Cybersecurity',
        domains: ['cyber'],
        permissions: ['cyber_posture:write', 'incidents:write', 'correlations:write', 'risks:write'],
    },
    pm: {
        label: 'Program Manager',
        domains: ['executive', 'cyber', 'physical', 'personnel', 'industrial', 'program', 'pm', 'risk'],
        permissions: ['*'],
    },
    site_manager: {
        label: 'Site Manager',
        domains: ['physical', 'personnel', 'industrial', 'pm', 'risk'],
        permissions: ['sites:write', 'compliance:write', 'self_inspections:write', 'construction:write', 'risks:write', 'employees:write', 'documents:write'],
    },
    executive: {
        label: 'Executive',
        domains: ['executive'],
        permissions: ['read'],
    },
};

const COLLECTION_DOMAINS = {
    sites: 'physical',
    risks: 'risk',
    budget: 'program',
    timeline: 'program',
    compliance: 'industrial',
    activity: 'program',
    milestones: 'program',
    construction: 'pm',
    employees: 'personnel',
    documents: 'program',
    transactions: 'program',
    contracts: 'program',
    inspections: 'industrial',
    self_inspections: 'industrial',
    physical_systems: 'physical',
    personnel_security: 'personnel',
    cyber_posture: 'cyber',
    incidents: 'risk',
    correlations: 'risk',
    role_mappings: 'admin',
};

// ── Seed collections from JSON on first run ───────────────────────────────────
async function seedOne(name) {
    if (!dbOk()) return;
    const M = getModel(name);
    if (SINGLETON.has(name)) {
        const data = readJson(name);
        if (!data) return;
        const existing = await M.findById('singleton').lean();
        if (existing) {
            if (name === 'role_mappings') {
                const { _id, __v, ...current } = existing;
                await M.findOneAndReplace(
                    { _id: 'singleton' },
                    { _id: 'singleton', ...current, ...data },
                    { upsert: true, new: true }
                );
                console.log(`[MASH] Merged singleton seed: ${name}`);
            }
            return;
        }
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
                 'settings','milestones','construction','employees','documents',
                 'transactions','contracts','inspections','role_mappings','users',
                 'incidents','correlations','self_inspections','physical_systems',
                 'personnel_security','cyber_posture','audit_log'];
    for (const c of ALL) await seedOne(c);
    console.log('[MASH] Seed complete.');
}

// Seed JSON files on startup
seedAll().catch(console.error);

// ── PostgreSQL-backed CRUD helpers ────────────────────────────────────────────

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

async function readData(collection) {
    if (dbOk()) return dbGet(collection);
    const data = readJson(collection);
    return SINGLETON.has(collection) ? (data != null ? data : {}) : (data != null ? data : []);
}

async function writeData(collection, data) {
    if (dbOk()) {
        await dbPut(collection, data);
    } else {
        writeJson(collection, data);
    }
}

async function appendData(collection, item) {
    if (dbOk()) return dbPost(collection, item);
    const current = readJson(collection) || [];
    const saved = { ...item, id: item.id || uid() };
    current.push(saved);
    writeJson(collection, current);
    return saved;
}

function normalizeRole(role) {
    return ROLE_DEFS[role] ? role : 'executive';
}

function expandPermissions(role, mapping = {}) {
    const def = ROLE_DEFS[normalizeRole(role)] || ROLE_DEFS.executive;
    const permissions = new Set([...(def.permissions || []), ...((mapping.permissions || []))]);
    const domains = new Set([...(def.domains || []), ...((mapping.domains || []))]);
    return { permissions: [...permissions], domains: [...domains] };
}

function canWrite(user, collection) {
    if (!user) return false;
    const permissions = user.permissions || [];
    if (permissions.includes('*')) return true;
    if (permissions.includes(`${collection}:write`)) return true;
    const domain = COLLECTION_DOMAINS[collection];
    return Boolean(domain && user.domains && user.domains.includes(domain) && permissions.includes(`${domain}:write`));
}

function apiCollectionFromPath(req) {
    const [first, second] = req.path.split('/').filter(Boolean);
    if (first === 'access-admin') return 'role_mappings';
    if (first === 'self-inspections') return 'self_inspections';
    if (first === 'construction-risk') return 'construction';
    if (first === 'executive-posture') return 'activity';
    if (first === 'budget' && second === 'transactions') return 'transactions';
    if (first === 'timeline' && second === 'milestones') return 'timeline';
    return first;
}

async function logAudit(req, action, collection, targetId, outcome = 'ok', detail = {}) {
    const entry = {
        id: uid(),
        action,
        collection,
        targetId: targetId || null,
        outcome,
        detail,
        username: (req.user && req.user.username) || 'system',
        role: (req.user && req.user.role) || 'unknown',
        createdAt: new Date().toISOString(),
    };
    try {
        if (dbOk()) await dbPost('audit_log', entry);
        else {
            const audit = readJson('audit_log') || [];
            audit.unshift(entry);
            writeJson('audit_log', audit.slice(0, 1000));
        }
    } catch (err) {
        console.warn('[MASH audit]', err.message);
    }
}

function requireWritePermission(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const collection = apiCollectionFromPath(req);
    if (!collection || (collection !== 'role_mappings' && !validCollection(collection)))
        return res.status(400).json({ error: 'Invalid collection' });
    if (!canWrite(req.user, collection)) {
        logAudit(req, req.method, collection, req.params && req.params.id, 'denied').catch(() => {});
        return res.status(403).json({ error: `Forbidden — ${req.user.role} cannot update ${collection}` });
    }
    next();
}

function cleanRoleMappings(raw) {
    const mappings = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
    delete mappings._id;
    delete mappings.__v;
    return mappings;
}

function publicRoleDefs() {
    return Object.fromEntries(Object.entries(ROLE_DEFS).map(([id, def]) => [id, {
        id,
        label: def.label,
        domains: def.domains || [],
        permissions: def.permissions || [],
    }]));
}

function sanitizeRoleMapping(input = {}) {
    const role = normalizeRole(input.role);
    const def = ROLE_DEFS[role] || ROLE_DEFS.executive;
    const siteId = input.siteId || null;
    return {
        role,
        siteId,
        siteIds: Array.isArray(input.siteIds) ? input.siteIds.filter(Boolean) : (siteId ? [siteId] : []),
        domains: Array.isArray(input.domains) ? input.domains : (def.domains || []),
        permissions: Array.isArray(input.permissions) ? input.permissions : (def.permissions || []),
        displayTitle: input.displayTitle || def.label || role,
    };
}

async function readRoleMappings() {
    return cleanRoleMappings(await readData('role_mappings'));
}

async function writeRoleMappings(mappings) {
    await writeData('role_mappings', mappings);
}

async function readHubUsers() {
    if (dbOk()) {
        const client = getDb();
        const users = await client.user.findMany({
            orderBy: [{ name: 'asc' }, { username: 'asc' }],
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                role: true,
                title: true,
                siteId: true,
                siteIds: true,
                status: true,
            },
        });
        return users.map(user => ({
            ...user,
            status: user.status || 'Active',
            siteIds: Array.isArray(user.siteIds) ? user.siteIds : [],
        }));
    }
    const users = readJson('users') || [];
    return users.map(({ passwordHash, ...user }) => ({
        ...user,
        status: user.status || 'Active',
        siteIds: Array.isArray(user.siteIds) ? user.siteIds : (user.siteId ? [user.siteId] : []),
    }));
}

function scoreSeverity(severity) {
    return ({ critical: 25, high: 16, medium: 9, low: 4 }[(severity || '').toLowerCase()] || 5);
}

function riskScoreFromSignals({ risks = [], sites = [], inspections = [], construction = [], incidents = [], correlations = [] }) {
    const openRisks = risks.filter(r => !['resolved', 'closed'].includes((r.status || '').toLowerCase()));
    const riskLoad = openRisks.reduce((sum, r) => sum + scoreSeverity(r.severity), 0);
    const avgCompliance = sites.length ? sites.reduce((sum, s) => sum + (s.compliance || 0), 0) / sites.length : 90;
    const overdueInspections = inspections.filter(i => ['overdue', 'late'].includes((i.status || '').toLowerCase())).length;
    const constructionExceptions = construction.reduce((sum, p) => sum + ((p.blockers && p.blockers.length) || 0), 0);
    const incidentLoad = incidents.filter(i => !['closed', 'resolved'].includes((i.status || '').toLowerCase())).length * 4;
    const correlationLoad = correlations.filter(c => (c.status || 'active').toLowerCase() === 'active').length * 4;
    const raw = 100 - (100 - avgCompliance) - Math.min(28, riskLoad) - Math.min(10, overdueInspections * 3)
        - Math.min(8, constructionExceptions * 2) - Math.min(12, incidentLoad) - Math.min(12, correlationLoad);
    return Math.max(0, Math.min(100, Math.round(raw)));
}

async function maybeCreateConstructionRisk(req, project) {
    const blockers = project.blockers || [];
    const tempIssues = (project.temporaryControls || []).filter(c =>
        ['missing', 'failed', 'overdue'].includes((c.status || '').toLowerCase())
    );
    const status = (project.status || '').toLowerCase();
    if (!blockers.length && !tempIssues.length && !['blocked', 'deviation'].includes(status)) return;

    const existing = await readData('risks');
    const alreadyLinked = Array.isArray(existing) && existing.some(r =>
        r.sourceType === 'construction' && r.sourceId === project.id && !['resolved', 'closed'].includes((r.status || '').toLowerCase())
    );
    if (alreadyLinked) return;

    await appendData('risks', {
        id: uid(),
        title: `Construction security deviation — ${project.title || project.name || project.site || project.siteId}`,
        description: [
            blockers.length ? `Blockers: ${blockers.join('; ')}` : null,
            tempIssues.length ? `Temporary control issues: ${tempIssues.map(c => `${c.name || c.control}: ${c.status}`).join('; ')}` : null,
        ].filter(Boolean).join(' '),
        severity: blockers.length || tempIssues.length > 1 ? 'high' : 'medium',
        probability: 'medium',
        impact: 'high',
        status: 'open',
        siteId: project.siteId,
        site: project.site,
        domain: 'pm',
        sourceType: 'construction',
        sourceId: project.id,
        owner: project.owner || project.pm || project.contractor || 'Security PM',
        dueDate: project.projectedCompletion || project.endDate,
        businessImpact: 'Construction deviation may weaken temporary controls or delay secure-space accreditation.',
        createdAt: new Date().toISOString(),
        createdBy: (req.user && req.user.username) || 'system',
    });
}

function normalizeEvidence(input, user) {
    const list = Array.isArray(input) ? input : (input ? [input] : []);
    return list.map(item => ({
        id: item.id || uid(),
        fileName: item.fileName || item.name || 'evidence',
        type: item.type || 'document',
        fileRef: item.fileRef || item.url || item.href || '',
        notes: item.notes || '',
        uploadedBy: item.uploadedBy || (user && user.username) || 'system',
        uploadedAt: item.uploadedAt || new Date().toISOString(),
    }));
}

function isOpenStatus(status) {
    return !['closed', 'resolved', 'complete', 'completed'].includes((status || '').toLowerCase());
}

async function buildExecutivePosture(user) {
    const [sitesRaw, risksRaw, complianceRaw, constructionRaw, inspectionsRaw, physicalRaw, personnelRaw, cyberRaw, incidentsRaw, correlationsRaw] = await Promise.all([
        readData('sites'), readData('risks'), readData('compliance'), readData('construction'),
        readData('self_inspections'), readData('physical_systems'), readData('personnel_security'),
        readData('cyber_posture'), readData('incidents'), readData('correlations'),
    ]);

    const sites = applyRBAC('sites', sitesRaw, user);
    const risks = applyRBAC('risks', risksRaw, user);
    const compliance = applyRBAC('compliance', complianceRaw, user);
    const construction = applyRBAC('construction', constructionRaw, user);
    const selfInspections = applyRBAC('self_inspections', inspectionsRaw, user);
    const physicalSystems = applyRBAC('physical_systems', physicalRaw, user);
    const personnelSecurity = applyRBAC('personnel_security', personnelRaw, user);
    const cyberPosture = applyRBAC('cyber_posture', cyberRaw, user);
    const incidents = applyRBAC('incidents', incidentsRaw, user);
    const correlations = applyRBAC('correlations', correlationsRaw, user);

    const openRisks = risks.filter(r => isOpenStatus(r.status));
    const activeIncidents = incidents.filter(i => isOpenStatus(i.status));
    const activeCorrelations = correlations.filter(c => (c.status || 'active').toLowerCase() === 'active');
    const overdueInspections = selfInspections.filter(i => ['overdue', 'late'].includes((i.status || '').toLowerCase()));
    const constructionExceptions = construction.filter(p =>
        (p.blockers || []).length ||
        ['blocked', 'deviation', 'pending-auth'].includes((p.status || '').toLowerCase()) ||
        (p.temporaryControls || []).some(c => ['missing', 'failed', 'overdue'].includes((c.status || '').toLowerCase()))
    );
    const unhealthyPhysical = physicalSystems.filter(s => !['online', 'nominal', 'healthy'].includes((s.status || '').toLowerCase()));
    const personnelExceptions = personnelSecurity.filter(p =>
        ['overdue', 'expired', 'suspended', 'open'].includes((p.status || '').toLowerCase()) ||
        ['high', 'critical'].includes((p.riskLevel || '').toLowerCase())
    );
    const cyberExceptions = cyberPosture.filter(c =>
        ['critical', 'high'].includes((c.severity || c.riskLevel || '').toLowerCase()) ||
        ['open', 'degraded', 'active'].includes((c.status || '').toLowerCase())
    );

    const score = riskScoreFromSignals({
        risks: openRisks, sites, inspections: selfInspections, construction,
        incidents: activeIncidents, correlations: activeCorrelations,
    });

    return {
        generatedAt: new Date().toISOString(),
        score,
        status: score >= 85 ? 'Nominal' : score >= 70 ? 'Guarded' : score >= 55 ? 'Elevated' : 'Critical',
        domains: [
            { id: 'cyber', label: 'Cyber', score: Math.max(0, 100 - cyberExceptions.length * 12), exceptions: cyberExceptions.length },
            { id: 'physical', label: 'Physical / Industrial', score: Math.max(0, 100 - unhealthyPhysical.length * 10 - overdueInspections.length * 5), exceptions: unhealthyPhysical.length + overdueInspections.length },
            { id: 'personnel', label: 'Personnel Security', score: Math.max(0, 100 - personnelExceptions.length * 12), exceptions: personnelExceptions.length },
            { id: 'program', label: 'Program / POA&M', score: Math.max(0, 100 - openRisks.length * 5), exceptions: openRisks.length },
            { id: 'pm', label: 'Construction / PM', score: Math.max(0, 100 - constructionExceptions.length * 14), exceptions: constructionExceptions.length },
        ],
        metrics: {
            sites: sites.length,
            activeIncidents: activeIncidents.length,
            activeCorrelations: activeCorrelations.length,
            openRisks: openRisks.length,
            highRisks: openRisks.filter(r => ['critical', 'high'].includes((r.severity || '').toLowerCase())).length,
            overdueInspections: overdueInspections.length,
            constructionExceptions: constructionExceptions.length,
            physicalExceptions: unhealthyPhysical.length,
            personnelExceptions: personnelExceptions.length,
            cyberExceptions: cyberExceptions.length,
        },
        topRisks: openRisks.sort((a, b) => scoreSeverity(b.severity) - scoreSeverity(a.severity)).slice(0, 6),
        incidents: activeIncidents.slice(0, 8),
        correlations: activeCorrelations.slice(0, 8),
        overdueInspections: overdueInspections.slice(0, 8),
        constructionExceptions: constructionExceptions.slice(0, 8),
        siteHeat: sites.map(site => ({
            id: site.id,
            siteId: site.siteId,
            name: site.name,
            location: site.location,
            score: site.compliance || 0,
            riskCount: openRisks.filter(r => r.siteId === site.id || r.siteId === site.siteId).length,
            constructionCount: construction.filter(c => c.siteId === site.id || c.siteId === site.siteId).length,
            inspectionStatus: overdueInspections.some(i => i.siteId === site.id || i.siteId === site.siteId) ? 'overdue' : 'current',
        })),
        teamPerformance: {
            soc: { workload: cyberExceptions.length + activeCorrelations.length, avgResponse: '18m', resolutionRate: 91 },
            psoc: { workload: unhealthyPhysical.length + activeIncidents.filter(i => i.domain === 'physical').length, avgResponse: '24m', resolutionRate: 88 },
            investigations: { workload: personnelExceptions.length + activeIncidents.filter(i => i.domain === 'personnel').length, avgResponse: '2.1d', resolutionRate: 84 },
        },
        sourceCounts: {
            complianceFindings: ((compliance && compliance.findings) || []).length,
            selfInspections: selfInspections.length,
            physicalSystems: physicalSystems.length,
            personnelSecurity: personnelSecurity.length,
            cyberPosture: cyberPosture.length,
        },
    };
}

async function buildEscalations(user) {
    const [risksRaw, inspectionsRaw, constructionRaw, incidentsRaw, correlationsRaw] = await Promise.all([
        readData('risks'), readData('self_inspections'), readData('construction'),
        readData('incidents'), readData('correlations'),
    ]);
    const risks = applyRBAC('risks', risksRaw, user);
    const inspections = applyRBAC('self_inspections', inspectionsRaw, user);
    const construction = applyRBAC('construction', constructionRaw, user);
    const incidents = applyRBAC('incidents', incidentsRaw, user);
    const correlations = applyRBAC('correlations', correlationsRaw, user);

    const rows = [];
    risks.filter(r => isOpenStatus(r.status) && ['critical', 'high'].includes((r.severity || '').toLowerCase())).forEach(r => rows.push({
        id: `risk-${r.id}`,
        type: 'risk',
        title: r.title,
        severity: r.severity || 'medium',
        status: r.status || 'open',
        siteId: r.siteId,
        site: r.site,
        owner: r.owner,
        dueDate: r.dueDate,
        sourceId: r.id,
        businessImpact: r.businessImpact,
    }));
    inspections.filter(i => ['overdue', 'late', 'fail'].includes((i.status || '').toLowerCase())).forEach(i => rows.push({
        id: `inspection-${i.id}`,
        type: 'self_inspection',
        title: i.title || i.type || 'Self-inspection exception',
        severity: i.score < 50 ? 'high' : 'medium',
        status: i.status || 'open',
        siteId: i.siteId,
        site: i.site,
        owner: i.owner,
        dueDate: i.dueDate,
        sourceId: i.id,
        evidenceCount: i.evidenceCount || ((i.evidence || []).length),
        businessImpact: 'Inspection exception may affect readiness, compliance posture, or local control effectiveness.',
    }));
    construction.filter(p =>
        (p.blockers || []).length ||
        ['blocked', 'deviation', 'pending-auth'].includes((p.status || '').toLowerCase()) ||
        (p.temporaryControls || []).some(c => ['missing', 'failed', 'overdue'].includes((c.status || '').toLowerCase()))
    ).forEach(p => rows.push({
        id: `construction-${p.id}`,
        type: 'construction',
        title: p.title || p.name || 'Construction security exception',
        severity: (p.blockers || []).length ? 'high' : 'medium',
        status: p.status || 'active',
        siteId: p.siteId,
        site: p.site,
        owner: p.owner || p.pm,
        dueDate: p.projectedCompletion || p.endDate,
        sourceId: p.id,
        businessImpact: 'Construction deviation may weaken temporary controls or delay secure-space handover.',
    }));
    incidents.filter(i => isOpenStatus(i.status) && ['critical', 'high'].includes((i.severity || '').toLowerCase())).forEach(i => rows.push({
        id: `incident-${i.id}`,
        type: 'incident',
        title: i.title,
        severity: i.severity || 'medium',
        status: i.status || 'active',
        siteId: i.siteId,
        site: i.site,
        owner: i.owner,
        dueDate: i.dueDate,
        sourceId: i.id,
        businessImpact: i.businessImpact,
    }));
    correlations.filter(c => (c.status || 'active').toLowerCase() === 'active').forEach(c => rows.push({
        id: `correlation-${c.id}`,
        type: 'correlation',
        title: c.title || c.signal || 'Cross-domain signal',
        severity: c.severity || c.riskLevel || 'medium',
        status: c.status || 'active',
        siteId: c.siteId,
        site: c.site,
        owner: c.owner,
        dueDate: c.dueDate,
        sourceId: c.id,
        businessImpact: c.businessImpact || 'Cross-domain signal may indicate converged or insider-threat activity.',
    }));

    return rows.sort((a, b) => scoreSeverity(b.severity) - scoreSeverity(a.severity));
}

// ── Hub proxy helpers ──────────────────────────────────────────────────────────

/** POST credentials to hub and get back the hub user object. */
function proxyLoginToHub(username, password) {
    const baseUrl = HUB_URL || `http://${HUB_HOST}:${HUB_PORT}`;
    const loginUrl = new URL('/auth/login', baseUrl);
    return fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    }).then(async res => {
        let parsed;
        try {
            parsed = await res.json();
        } catch {
            throw new Error('Bad response from hub');
        }
        if (res.ok && parsed.user) return parsed.user;
        throw new Error(parsed.error || 'Invalid credentials');
    });
}

/** Consume the hub's one-time SSO token and return the hub user. */
function verifyHubToken(token) {
    const baseUrl = HUB_URL || `http://${HUB_HOST}:${HUB_PORT}`;
    const verifyUrl = new URL('/api/sso/verify', baseUrl);
    verifyUrl.searchParams.set('token', token);
    return fetch(verifyUrl).then(async res => {
        let parsed;
        try {
            parsed = await res.json();
        } catch {
            throw new Error('Bad response from hub');
        }
        if (res.ok && parsed.valid) return parsed.user;
        throw new Error(parsed.error || 'SSO verification failed');
    });
}

// ── Hub user → MASH JWT payload ───────────────────────────────────────────────
async function mapHubUser(hubUser) {
    // role_mappings.json: { "<hub_username_lowercase>": { role, siteId, displayTitle } }
    const roleMapRaw = dbOk()
        ? ((await readCollection('role_mappings')) || {})
        : (readJson('role_mappings') || {});
    const roleMap = Array.isArray(roleMapRaw)
        ? (roleMapRaw.find(row => row && typeof row === 'object' && !row.id) || roleMapRaw[0] || {})
        : roleMapRaw;
    const usernameKey = (hubUser.username || '').toLowerCase();
    const emailKey = (hubUser.email || '').toLowerCase();
    const mapping = roleMap[usernameKey] || roleMap[emailKey];

    let role    = 'executive';
    let siteId  = hubUser.siteId || hubUser.site || null;
    let siteIds = Array.isArray(hubUser.siteIds) ? hubUser.siteIds : (siteId ? [siteId] : []);
    let title   = hubUser.title || hubUser.role || 'Security Staff';

    if (mapping) {
        role    = normalizeRole(mapping.role != null ? mapping.role : role);
        siteId  = mapping.siteId != null ? mapping.siteId : siteId;
        siteIds = Array.isArray(mapping.siteIds) ? mapping.siteIds : (siteId ? [siteId] : []);
        title   = mapping.displayTitle  || title;
    } else {
        // Conservative inference: broad Hub roles like "Corporate Admin" do not
        // grant MASH write access unless the security role is explicit.
        const roleText = `${hubUser.role || ''} ${hubUser.title || ''}`.toLowerCase();
        if (roleText.includes('vp of security') || roleText.includes('vp security')) {
            role = 'vp_security';
        } else if (roleText.includes('director of security') || roleText.includes('security director')) {
            role = 'security_director';
        } else if (roleText.includes('security program manager') || /\bpm\b/.test(roleText)) {
            role = 'pm';
        }
        const siteManagerRoles = ['Site Manager', 'Field Officer', 'Site Staff', 'Site Lead'];
        if (role === 'executive' && siteManagerRoles.some(r => (hubUser.role || '').includes(r))) {
            role = 'site_manager';
        }
    }

    const expanded = expandPermissions(role, mapping || {});
    if (!siteIds.length && siteId) siteIds = [siteId];

    return {
        sub:      hubUser.id || hubUser._id || hubUser.username,
        username: hubUser.username,
        role,
        roleLabel: (ROLE_DEFS[role] && ROLE_DEFS[role].label) || role,
        domains: expanded.domains,
        permissions: expanded.permissions,
        siteId:   siteId || null,
        siteIds,
        name:     hubUser.name  || hubUser.username,
        title,
        authVersion: AUTH_VERSION,
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
    const scopedSites = new Set([...(user.siteIds || []), user.siteId].filter(Boolean));
    if (user.role !== 'site_manager' || scopedSites.size === 0) return data;
    const sid = user.siteId;
    const inScope = value => scopedSites.has(value);

    switch (collection) {
        case 'sites':
            return Array.isArray(data) ? data.filter(s => inScope(s.id) || inScope(s.siteId)) : data;
        case 'risks':
            return Array.isArray(data) ? data.filter(r => inScope(r.siteId) || r.siteId === 'all') : data;
        case 'compliance': {
            if (!data || typeof data !== 'object') return data;
            return { ...data, findings: (data.findings || []).filter(f => inScope(f.siteId)) };
        }
        case 'budget': {
            if (!data || typeof data !== 'object') return data;
            return {
                ...data,
                bySite:             (data.bySite             || []).filter(b => inScope(b.siteId)),
                recentTransactions: (data.recentTransactions || []).filter(t => inScope(t.siteId) || t.siteId === 'all'),
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
            return Array.isArray(data) ? data.filter(a => inScope(a.siteId) || a.siteId === 'all' || !a.siteId) : data;
        case 'construction':
            return Array.isArray(data) ? data.filter(c => inScope(c.siteId)) : data;
        case 'employees':
            return Array.isArray(data) ? data.filter(e => inScope(e.siteId)) : data;
        case 'documents':
            return Array.isArray(data) ? data.filter(d => inScope(d.siteId)) : data;
        case 'self_inspections':
        case 'physical_systems':
        case 'personnel_security':
        case 'cyber_posture':
        case 'incidents':
        case 'correlations':
            return Array.isArray(data) ? data.filter(x => inScope(x.siteId) || x.siteId === 'all' || !x.siteId) : data;
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
        const payload = await mapHubUser(hubUser);
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
        if (hubUser.requestedApp && hubUser.requestedApp !== 'mash') {
            return res.redirect('/?sso_error=invalid_target');
        }
        const payload = { ...(await mapHubUser(hubUser)), via: 'sso' };
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
            sites  = readJson('sites')  || [];
            risks  = readJson('risks')  || [];
            budget = readJson('budget') || {};
        }
        res.json({ sites, risks, budget, generatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('[MASH /public/briefing]', err.message);
        res.status(500).json({ error: 'Unable to load briefing data' });
    }
});

// ── Protect all /api/* routes ──────────────────────────────────────────────────
app.use('/api', requireAuth);
app.use('/api', requireWritePermission);

// ── Access administration ────────────────────────────────────────────────────
app.get('/api/access-admin/users', async (req, res) => {
    try {
        const mappings = await readRoleMappings();
        const users = await readHubUsers();
        res.json({
            users: users.map(user => ({
                ...user,
                mashMapping: mappings[(user.username || '').toLowerCase()] || mappings[(user.email || '').toLowerCase()] || null,
            })),
        });
    } catch (err) {
        console.error('[MASH GET /api/access-admin/users]', err.message);
        res.status(500).json({ error: 'Unable to load Hub users' });
    }
});

app.get('/api/access-admin/role-mappings', async (req, res) => {
    try {
        res.json({
            roles: publicRoleDefs(),
            mappings: await readRoleMappings(),
        });
    } catch (err) {
        console.error('[MASH GET /api/access-admin/role-mappings]', err.message);
        res.status(500).json({ error: 'Unable to load role mappings' });
    }
});

app.put('/api/access-admin/role-mappings/:username', async (req, res) => {
    try {
        const username = decodeURIComponent(req.params.username || '').trim().toLowerCase();
        if (!username) return res.status(400).json({ error: 'Username is required' });
        const mappings = await readRoleMappings();
        mappings[username] = sanitizeRoleMapping(req.body || {});
        await writeRoleMappings(mappings);
        await logAudit(req, 'PUT', 'role_mappings', username, 'ok', { role: mappings[username].role });
        res.json({ ok: true, username, mapping: mappings[username], mappings });
    } catch (err) {
        console.error('[MASH PUT /api/access-admin/role-mappings/:username]', err.message);
        res.status(500).json({ error: 'Unable to save role mapping' });
    }
});

app.delete('/api/access-admin/role-mappings/:username', async (req, res) => {
    try {
        const username = decodeURIComponent(req.params.username || '').trim().toLowerCase();
        if (!username) return res.status(400).json({ error: 'Username is required' });
        const mappings = await readRoleMappings();
        delete mappings[username];
        await writeRoleMappings(mappings);
        await logAudit(req, 'DELETE', 'role_mappings', username);
        res.json({ ok: true, username, mappings });
    } catch (err) {
        console.error('[MASH DELETE /api/access-admin/role-mappings/:username]', err.message);
        res.status(500).json({ error: 'Unable to remove role mapping' });
    }
});

// ── VP Security posture aggregation ───────────────────────────────────────────
app.get('/api/executive-posture', async (req, res) => {
    try {
        res.json(await buildExecutivePosture(req.user));
    } catch (err) {
        console.error('[MASH GET /api/executive-posture]', err.message);
        res.status(500).json({ error: 'Unable to build executive posture' });
    }
});

app.get('/api/escalations', async (req, res) => {
    try {
        res.json({
            generatedAt: new Date().toISOString(),
            items: await buildEscalations(req.user),
        });
    } catch (err) {
        console.error('[MASH GET /api/escalations]', err.message);
        res.status(500).json({ error: 'Unable to build escalation queue' });
    }
});

app.get('/api/executive-report', async (req, res) => {
    try {
        const posture = await buildExecutivePosture(req.user);
        const escalations = await buildEscalations(req.user);
        res.json({
            title: 'MASH Executive Security Report',
            classification: 'CUI//SP-SECURITY',
            generatedAt: new Date().toISOString(),
            generatedBy: req.user.username,
            audience: 'VP Security / C-suite / Board',
            posture,
            boardMetrics: {
                enterpriseRiskScore: posture.score,
                postureStatus: posture.status,
                sitesCovered: posture.metrics.sites,
                highRisks: posture.metrics.highRisks,
                activeIncidents: posture.metrics.activeIncidents,
                activeCorrelations: posture.metrics.activeCorrelations,
                overdueInspections: posture.metrics.overdueInspections,
                constructionExceptions: posture.metrics.constructionExceptions,
            },
            narrative: [
                `${posture.status} enterprise posture with a score of ${posture.score}.`,
                `${posture.metrics.highRisks} high or critical open risks require executive attention.`,
                `${posture.metrics.activeCorrelations} active cross-domain signals are being tracked for converged-risk indicators.`,
                `${posture.metrics.overdueInspections} overdue inspections and ${posture.metrics.constructionExceptions} construction exceptions are feeding the risk register.`,
            ],
            escalations: escalations.slice(0, 12),
        });
    } catch (err) {
        console.error('[MASH GET /api/executive-report]', err.message);
        res.status(500).json({ error: 'Unable to build executive report' });
    }
});

app.get('/api/construction-risk', async (req, res) => {
    try {
        const [constructionRaw, risksRaw] = await Promise.all([readData('construction'), readData('risks')]);
        const construction = applyRBAC('construction', constructionRaw, req.user);
        const risks = applyRBAC('risks', risksRaw, req.user);
        const rows = construction.map(project => {
            const temporaryControlIssues = (project.temporaryControls || []).filter(c =>
                ['missing', 'failed', 'overdue'].includes((c.status || '').toLowerCase())
            );
            const linkedRisks = risks.filter(r => r.sourceId === project.id || r.projectId === project.id || r.siteId === project.siteId);
            return {
                ...project,
                temporaryControlIssues,
                linkedRisks,
                riskLevel: (project.blockers || []).length || temporaryControlIssues.length ? 'high' : 'medium',
                deviationCount: (project.blockers || []).length + temporaryControlIssues.length,
            };
        });
        res.json(rows);
    } catch (err) {
        console.error('[MASH GET /api/construction-risk]', err.message);
        res.status(500).json({ error: 'Unable to load construction risk' });
    }
});

app.get('/api/self-inspections', async (req, res) => {
    try {
        const inspections = applyRBAC('self_inspections', await readData('self_inspections'), req.user);
        res.json(inspections);
    } catch (err) {
        console.error('[MASH GET /api/self-inspections]', err.message);
        res.status(500).json({ error: 'Unable to load self-inspections' });
    }
});

app.post('/api/self-inspections', async (req, res) => {
    try {
        const evidence = normalizeEvidence(req.body.evidence || req.body.evidenceItems, req.user);
        const item = {
            ...req.body,
            id: req.body.id || uid(),
            evidence,
            evidenceCount: evidence.length,
            createdAt: new Date().toISOString(),
        };
        const saved = await appendData('self_inspections', item);
        if (['fail', 'overdue'].includes((item.status || '').toLowerCase()) || item.score < 70) {
            await appendData('risks', {
                id: uid(),
                title: `Inspection finding — ${item.title || item.type || item.site || item.siteId}`,
                description: item.summary || item.notes || 'Self-inspection generated remediation item.',
                severity: item.score < 50 ? 'high' : 'medium',
                probability: 'medium',
                impact: item.score < 50 ? 'high' : 'medium',
                status: 'open',
                siteId: item.siteId,
                site: item.site,
                domain: 'industrial',
                sourceType: 'self_inspection',
                sourceId: saved.id,
                owner: item.owner,
                dueDate: item.dueDate,
                businessImpact: 'Potential compliance exposure and inspection readiness degradation.',
                createdAt: new Date().toISOString(),
            });
        }
        await logAudit(req, 'POST', 'self_inspections', saved.id);
        res.status(201).json({ ok: true, data: saved });
    } catch (err) {
        console.error('[MASH POST /api/self-inspections]', err.message);
        res.status(500).json({ error: 'Unable to create self-inspection' });
    }
});

app.patch('/api/self-inspections/:id', async (req, res) => {
    try {
        const updates = { ...req.body, updatedAt: new Date().toISOString() };
        if (Object.prototype.hasOwnProperty.call(req.body, 'evidence') || Object.prototype.hasOwnProperty.call(req.body, 'evidenceItems')) {
            updates.evidence = normalizeEvidence(req.body.evidence || req.body.evidenceItems, req.user);
            updates.evidenceCount = updates.evidence.length;
            delete updates.evidenceItems;
        }
        const result = dbOk()
            ? await dbPatch('self_inspections', req.params.id, updates)
            : null;
        let saved = result;
        if (!dbOk()) {
            const current = readJson('self_inspections') || [];
            const idx = current.findIndex(i => i.id === req.params.id);
            if (idx === -1) return res.status(404).json({ error: 'Self-inspection not found' });
            current[idx] = { ...current[idx], ...updates };
            saved = current[idx];
            writeJson('self_inspections', current);
        }
        if (!saved) return res.status(404).json({ error: 'Self-inspection not found' });
        await logAudit(req, 'PATCH', 'self_inspections', req.params.id);
        res.json({ ok: true, data: saved });
    } catch (err) {
        console.error('[MASH PATCH /api/self-inspections/:id]', err.message);
        res.status(500).json({ error: 'Unable to update self-inspection' });
    }
});

app.post('/api/self-inspections/:id/evidence', async (req, res) => {
    try {
        const evidence = normalizeEvidence(req.body.evidence || req.body, req.user);
        if (!evidence.length) return res.status(400).json({ error: 'Evidence metadata is required' });

        const current = await readData('self_inspections');
        const idx = current.findIndex(i => i.id === req.params.id || i._id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Self-inspection not found' });

        const existing = current[idx].evidence || [];
        current[idx] = {
            ...current[idx],
            evidence: existing.concat(evidence),
            evidenceCount: existing.length + evidence.length,
            updatedAt: new Date().toISOString(),
        };
        await writeData('self_inspections', current);
        await logAudit(req, 'POST_EVIDENCE', 'self_inspections', req.params.id, 'ok', { evidenceCount: evidence.length });
        res.status(201).json({ ok: true, data: current[idx] });
    } catch (err) {
        console.error('[MASH POST /api/self-inspections/:id/evidence]', err.message);
        res.status(500).json({ error: 'Unable to add self-inspection evidence' });
    }
});

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
// Aggregation pipeline (two-stage):
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
// Fires six simultaneous aggregations via Promise.all and returns a
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
            data = SINGLETON.has(collection) ? (data != null ? data : {}) : (data != null ? data : []);
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
        await logAudit(req, 'PUT', collection, null);
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
        if (collection === 'construction') await maybeCreateConstructionRisk(req, result);
        await logAudit(req, 'POST', collection, result.id || result._id);
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
        if (collection === 'construction') await maybeCreateConstructionRisk(req, result);
        await logAudit(req, 'PATCH', collection, id);
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
        await logAudit(req, 'DELETE', collection, id);
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
    console.log(`\x1b[90m  MTSI Advanced Sentinel Hub  v2.3.0  (PostgreSQL + Hub Auth)\x1b[0m`);
    console.log(`\x1b[32m  ● Running → http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[90m  Hub      → ${HUB_URL || `http://${HUB_HOST}:${HUB_PORT}`}\x1b[0m\n`);
    if (JWT_SECRET === 'mash-dev-secret-change-in-prod')
        console.log('\x1b[33m  ⚠ JWT_SECRET not set — use env var in production\x1b[0m\n');
});
