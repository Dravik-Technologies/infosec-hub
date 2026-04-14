'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:                    String,
  title:                  { type: String, required: true },
  family:                 String,
  status:                 { type: String, default: 'Not Implemented' },
  baseline:               String,
  last_review:            String,
  findings:               { type: Number, default: 0 },
  notes:                  String,
  description:            String,
  implementation_guidance: String,
  conmon_status:          { type: String, default: 'Open' },  // Compliant / Open / POA&M
  conmon_group:           String,                             // name of covering ConMon activity
  conmon_frequency:       String,                             // frequency of covering activity
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('Control', schema);
