'use strict';

const path = require('path');
const { randomUUID } = require('crypto');
const bcryptPath = require.resolve('bcryptjs', {
  paths: [path.resolve(__dirname, '..'), process.cwd()],
});
const bcrypt = require(bcryptPath);
const { db } = require('./index');
const { ensureAppAccess } = require('./appAccess');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function formatDateOnly(date) {
  if (!date) return null;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function deriveUsername(saar) {
  const explicit = normalizeLower(saar && saar.submittedBy);
  if (explicit && explicit !== 'anonymous' && explicit !== 'system') return explicit;

  const email = normalizeLower(saar && saar.email);
  if (!email.includes('@')) return '';
  return email.split('@')[0]
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '');
}

function buildDisplayName(saar) {
  return [normalizeText(saar && saar.firstName), normalizeText(saar && saar.lastName)].filter(Boolean).join(' ').trim();
}

function trainingCompliant(saar) {
  const annual = saar && saar.annualTrainingDate ? new Date(saar.annualTrainingDate) : null;
  const derivative = saar && saar.derivativeTrainingDate ? new Date(saar.derivativeTrainingDate) : null;
  if (!annual || !derivative) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return annual >= cutoff && derivative >= cutoff;
}

function trainingDue(saar) {
  const annual = saar && saar.annualTrainingDate ? addDays(new Date(saar.annualTrainingDate), 365) : null;
  const derivative = saar && saar.derivativeTrainingDate ? addDays(new Date(saar.derivativeTrainingDate), 365) : null;
  const due = [annual, derivative].filter(Boolean).sort((a, b) => a.getTime() - b.getTime())[0];
  return formatDateOnly(due);
}

async function uniqueUsername(base) {
  const seed = normalizeLower(base) || 'scorva.user';
  let candidate = seed;
  let count = 1;
  while (await db.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
    candidate = `${seed}${count}`;
    count += 1;
  }
  return candidate;
}

async function findMatchingUser(saar) {
  const email = normalizeLower(saar && saar.email);
  const username = deriveUsername(saar);
  if (email) {
    const byEmail = await db.user.findFirst({ where: { email } });
    if (byEmail) return byEmail;
  }
  if (username) {
    const byUsername = await db.user.findUnique({ where: { username } });
    if (byUsername) return byUsername;
  }
  return null;
}

async function upsertScorvaYubiKey(serial, username, siteId) {
  const cleanSerial = normalizeText(serial);
  if (!cleanSerial) return null;

  const existing = await db.yubiKey.findUnique({ where: { serial: cleanSerial } });
  const payload = {
    serial: cleanSerial,
    username: normalizeLower(username) || null,
    status: 'Assigned',
    issued: formatDateOnly(new Date()),
    siteId: siteId || null,
  };

  if (existing) {
    return db.yubiKey.update({ where: { serial: cleanSerial }, data: payload });
  }

  const created = await db.yubiKey.create({
    data: {
      id: `yk-${cleanSerial.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()}`,
      model: 'YubiKey',
      lastAuth: null,
      ...payload,
    },
  }).catch(async () => {
    const fallbackId = `yk-${randomUUID()}`;
    return db.yubiKey.create({
      data: {
        id: fallbackId,
        model: 'YubiKey',
        lastAuth: null,
        ...payload,
      },
    });
  });

  return created;
}

async function provisionScorvaFromSaar(saar, options) {
  const actor = normalizeText(options && options.actor) || 'lava';
  const match = await findMatchingUser(saar);
  const siteIds = [...new Set([match && match.siteId, saar && saar.siteId].filter(Boolean).map(String))];
  const siteId = siteIds[0] || null;
  const role = (match && match.role) || 'Viewer';
  const status = 'Active';
  const name = buildDisplayName(saar) || (match && match.name) || normalizeLower(saar && saar.email);
  const title = normalizeText((saar && saar.rankGrade) || (match && match.title) || (saar && saar.organization)) || null;
  const email = normalizeLower(saar && saar.email) || (match && match.email) || null;
  const username = match
    ? match.username
    : await uniqueUsername(deriveUsername(saar) || (email && email.split('@')[0]) || `scorva-${saar && saar.id}`);
  const notesMeta = {
    source: 'lava_saar',
    saarId: saar && saar.id,
    provisionedBy: actor,
    provisionedAt: new Date().toISOString(),
  };
  const nextDod8140 = ensureAppAccess(((match && match.dod8140) || null), 'scorva');
  const mergedDod8140 = {
    ...(nextDod8140 && typeof nextDod8140 === 'object' ? nextDod8140 : {}),
    scorvaProvisioning: notesMeta,
  };

  let user;
  if (match) {
    user = await db.user.update({
      where: { id: match.id },
      data: {
        name,
        title,
        email: email || match.email,
        role,
        status,
        siteId: siteId || match.siteId || null,
        siteIds: siteIds.length ? siteIds : (Array.isArray(match.siteIds) ? match.siteIds : []),
        trainingCompliant: trainingCompliant(saar),
        trainingDue: trainingDue(saar),
        yubikey: normalizeText(saar && saar.yubiKeySerial) || match.yubikey || null,
        dod8140: mergedDod8140,
      },
    });
  } else {
    const passwordHash = await bcrypt.hash(randomUUID(), 12);
    user = await db.user.create({
      data: {
        id: `scorva-${randomUUID()}`,
        name,
        title,
        username,
        email,
        passwordHash,
        role,
        status,
        siteId,
        siteIds,
        trainingCompliant: trainingCompliant(saar),
        trainingDue: trainingDue(saar),
        yubikey: normalizeText(saar && saar.yubiKeySerial) || null,
        dod8140: mergedDod8140,
      },
    });
  }

  const yubiKey = await upsertScorvaYubiKey(saar && saar.yubiKeySerial, user.username, user.siteId || siteId);
  return { user, yubiKey, created: !match };
}

module.exports = {
  provisionScorvaFromSaar,
};
