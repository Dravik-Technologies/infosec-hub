'use strict';

const { randomUUID } = require('crypto');
const { db } = require('./index');
const { ALL_APPS } = require('./appAccess');

const DOCUMENT_NAME = 'hub_access_requests';
const REQUESTABLE_APPS = ALL_APPS.filter(app => app !== 'hub');
const APP_LABELS = {
  scorva: 'SCORVA',
  crater: 'CRATER',
  mash: 'MASH',
  lava: 'LAVA',
  nexus: 'NEXUS',
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeAppId(value) {
  const appId = normalizeLower(value);
  return REQUESTABLE_APPS.includes(appId) ? appId : '';
}

function sanitizeRequest(entry) {
  const appId = normalizeAppId(entry && entry.appId);
  return {
    id: normalizeText(entry && entry.id) || randomUUID(),
    appId,
    appLabel: APP_LABELS[appId] || appId.toUpperCase(),
    username: normalizeLower(entry && entry.username),
    email: normalizeLower(entry && entry.email),
    name: normalizeText(entry && entry.name),
    firstName: normalizeText(entry && entry.firstName),
    lastName: normalizeText(entry && entry.lastName),
    position: normalizeText(entry && entry.position),
    organization: normalizeText(entry && entry.organization),
    phone: normalizeText(entry && entry.phone),
    justification: normalizeText(entry && entry.justification),
    sourceApp: normalizeAppId(entry && entry.sourceApp) || appId,
    status: normalizeText(entry && entry.status) || 'pending',
    createdAt: normalizeText(entry && entry.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(entry && entry.updatedAt) || new Date().toISOString(),
    reviewedAt: normalizeText(entry && entry.reviewedAt) || null,
    reviewedBy: normalizeText(entry && entry.reviewedBy) || null,
    reviewNotes: normalizeText(entry && entry.reviewNotes) || '',
    matchedUserId: normalizeText(entry && entry.matchedUserId) || null,
  };
}

async function readRequests() {
  const doc = await db.dataFabricDocument.findUnique({
    where: { name: DOCUMENT_NAME },
  });
  if (!doc || !Array.isArray(doc.data)) return [];
  return doc.data.map(sanitizeRequest).filter(entry => entry.appId);
}

async function writeRequests(requests) {
  await db.dataFabricDocument.upsert({
    where: { name: DOCUMENT_NAME },
    create: { name: DOCUMENT_NAME, data: requests },
    update: { data: requests },
  });
}

async function listAccessRequests() {
  const requests = await readRequests();
  return requests.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function createAccessRequest(input) {
  const appId = normalizeAppId(input && input.appId);
  if (!appId) throw new Error('A valid appId is required');

  const request = sanitizeRequest({
    appId,
    username: input && input.username,
    email: input && input.email,
    name: input && input.name,
    firstName: input && input.firstName,
    lastName: input && input.lastName,
    position: input && input.position,
    organization: input && input.organization,
    phone: input && input.phone,
    justification: input && input.justification,
    sourceApp: input && input.sourceApp,
    status: 'pending',
  });

  // Validate required fields
  if (!request.username || !request.email) {
    throw new Error('username and email are required');
  }
  if (!request.firstName || !request.lastName) {
    throw new Error('firstName and lastName are required');
  }

  const requests = await readRequests();
  const existing = requests.find(entry =>
    entry.appId === request.appId &&
    entry.username === request.username &&
    ['pending', 'approved_pending_user'].includes(entry.status)
  );

  if (existing) {
    return { created: false, request: existing };
  }

  requests.unshift(request);
  await writeRequests(requests);
  return { created: true, request };
}

async function updateAccessRequest(id, updates) {
  const requestId = normalizeText(id);
  const requests = await readRequests();
  const index = requests.findIndex(entry => entry.id === requestId);
  if (index === -1) return null;

  const current = requests[index];
  const next = sanitizeRequest({
    ...current,
    ...updates,
    id: current.id,
    appId: current.appId,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  });
  requests[index] = next;
  await writeRequests(requests);
  return next;
}

module.exports = {
  APP_LABELS,
  REQUESTABLE_APPS,
  createAccessRequest,
  listAccessRequests,
  updateAccessRequest,
};
