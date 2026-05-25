'use strict';

let _db = null;

function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!_db) ({ db: _db } = require('../../packages/db/src'));
  return _db;
}

/** Map collection name → Prisma client accessor key */
const DOMAIN_MODEL = {
  facility_security:   'mashFacilitySecurity',
  personnel_security:  'mashPersonnelSecurity',
  activities_security: 'mashActivitiesSecurity',
  document_control:    'mashDocumentControl',
  media_control:       'mashMediaControl',
  self_inspection_ops: 'mashSelfInspectionOp',
  security_findings:   'mashSecurityFinding',
};

const RELATIONAL_DOMAINS = new Set(Object.keys(DOMAIN_MODEL));

function buildWhere(scope, base = {}) {
  if (!scope || scope.mode === 'all') return base;
  if (scope.mode === 'single') return { ...base, siteId: scope.siteId };
  if (scope.mode === 'multi')  return { ...base, siteId: { in: scope.siteIds } };
  return base;
}

function model(collection) {
  const db = getDb();
  if (!db) throw Object.assign(new Error('DATABASE_URL not configured'), { status: 503 });
  const key = DOMAIN_MODEL[collection];
  if (!key) throw Object.assign(new Error(`Unknown relational domain: ${collection}`), { status: 400 });
  return db[key];
}

async function findMany(collection, scope) {
  return model(collection).findMany({ where: buildWhere(scope), orderBy: { createdAt: 'asc' } });
}

async function findById(collection, id) {
  return model(collection).findUnique({ where: { id } });
}

async function create(collection, data) {
  return model(collection).create({ data });
}

async function update(collection, id, data) {
  return model(collection).update({ where: { id }, data });
}

async function remove(collection, id) {
  return model(collection).delete({ where: { id } });
}

async function aggregateOverview(scope) {
  const db = getDb();
  if (!db) throw Object.assign(new Error('DATABASE_URL not configured'), { status: 503 });
  const where = buildWhere(scope);
  const [facilities, personnel, activities, docs, media, findings, inspections] = await Promise.all([
    db.mashFacilitySecurity.findMany({ where }),
    db.mashPersonnelSecurity.findMany({ where }),
    db.mashActivitiesSecurity.findMany({ where }),
    db.mashDocumentControl.findMany({ where }),
    db.mashMediaControl.findMany({ where }),
    db.mashSecurityFinding.findMany({ where }),
    db.mashSelfInspectionOp.findMany({ where }),
  ]);
  return { facilities, personnel, activities, docs, media, findings, inspections };
}

module.exports = {
  RELATIONAL_DOMAINS,
  DOMAIN_MODEL,
  buildWhere,
  findMany,
  findById,
  create,
  update,
  remove,
  aggregateOverview,
};
