'use strict';
const { Schema, model } = require('../db');

const schema = new Schema({
  _id:                String,
  name:               { type: String, required: true },
  siteId:             { type: String, required: true },
  position:           String,
  clearanceLevel:     { type: String, enum: ['confidential', 'secret', 'ts-sci', 'ts-sci-poly'], required: true },
  clearanceGranted:   String,   // ISO date string
  reinvestigationDue: String,   // ISO date — PR (Periodic Reinvestigation)
  trainingDueDate:    String,   // ISO date — annual security training
  annualBriefingDue:  String,   // ISO date — annual briefing
  status:             { type: String, enum: ['active', 'terminated', 'suspended', 'transferred'], default: 'active' },
  notes:              String,
}, { versionKey: false });

schema.set('toJSON', {
  transform(_, r) { r.id = r._id; delete r._id; return r; },
});

module.exports = model('Employee', schema, 'employees');
