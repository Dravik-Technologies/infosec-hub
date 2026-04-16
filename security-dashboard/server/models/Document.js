'use strict';
const { Schema, model } = require('../db');

// SCIF documentation types
const DOC_TYPES   = ['csp', 'ffc', 'tempest', 'sap', 'other'];
// Accreditation workflow statuses
const STATUSES    = ['draft', 'pending_fso', 'submitted', 'accredited'];

const schema = new Schema({
  _id:         String,
  title:       { type: String, required: true },
  type:        { type: String, enum: DOC_TYPES, default: 'other' },
  siteId:      { type: String, required: true },
  status:      { type: String, enum: STATUSES, default: 'draft' },
  version:     { type: String, default: 'v1.0' },
  fileRef:     String,   // file path or S3 key
  submittedBy: String,
  reviewedBy:  String,
  approvedBy:  String,
  notes:       String,
  createdAt:   { type: String },
  updatedAt:   { type: String },
}, { versionKey: false });

schema.set('toJSON', {
  transform(_, r) { r.id = r._id; delete r._id; return r; },
});

module.exports = model('MashDocument', schema, 'documents');
