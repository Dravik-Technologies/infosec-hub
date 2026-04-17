'use strict';
const { Schema, model } = require('../db');

/*
 * InspectionItem — one row in a self-inspection checklist.
 *
 * Relational design: siteId ties every item back to a Site document,
 * enabling both per-site queries (GET /api/inspections/:siteId) and
 * cross-site rollups (GET /api/inspections/action-items).
 *
 * status enum enforces the four lifecycle values the UI expects; Mongoose
 * rejects any other string before the write reaches MongoDB.
 */
const inspectionItemSchema = new Schema({
  _id:         String,

  // ── Relational key ────────────────────────────────────────────────────────
  siteId:      { type: String, required: [true, 'siteId is required'] },

  // ── Checklist fields ──────────────────────────────────────────────────────
  controlId:   String,
  description: String,
  status:      {
    type:    String,
    enum:    ['Pass', 'Fail', 'Pending', 'N/A'],
    default: 'Pending',
  },
  notes:       String,

}, { versionKey: false });

inspectionItemSchema.set('toJSON', {
  transform(_, r) { r.id = r._id; delete r._id; return r; },
});

module.exports = model('InspectionItem', inspectionItemSchema, 'inspections');
