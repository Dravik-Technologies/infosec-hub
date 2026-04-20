'use strict';
const { Schema, model } = require('../db');

/*
 * Site — typed Mongoose model for MASH facility records.
 *
 * Validation enforced by Mongoose before any write reaches MongoDB:
 *   - siteId and name are required → create() throws ValidationError if absent
 *   - compliance has min:0, max:100 → out-of-range numbers are rejected
 *   - runValidators: true on findByIdAndUpdate() activates these rules on PUT
 *
 * Extra fields (status, manager, clearanceLevel, openFindings) are kept for
 * compatibility with existing seeded data — they are optional but stored.
 *
 * _id is String (not ObjectId) to match the existing flexible-model convention
 * used by the rest of the MASH data layer (uid() strings, e.g. "id-abc123").
 *
 * toJSON transform: replaces _id with id so all API responses use `id`, which
 * is what every React component in the frontend expects.
 */
const siteSchema = new Schema({
  _id:            String,

  // ── Required fields (schema validation) ──────────────────────────────────
  siteId:         { type: String, required: [true, 'siteId is required'] },
  name:           { type: String, required: [true, 'name is required']   },

  // ── Operational fields ────────────────────────────────────────────────────
  location:       String,
  status:         {
    type:    String,
    enum:    ['Active', 'Construction', 'Renovation', 'Decommissioned'],
    default: 'Active',
  },
  scifZones:      { type: Number, default: 0 },
  nextInspection: String,   // stored as 'YYYY-MM-DD'

}, { versionKey: false });

siteSchema.set('toJSON', {
  transform(_, r) { r.id = r._id; delete r._id; return r; },
});

module.exports = model('Site', siteSchema, 'sites');
