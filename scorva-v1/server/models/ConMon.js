'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:                    String,
  control_id:             { type: String, required: true },
  control_title:          String,
  family:                 String,
  daag_jsig_frequency:    String,
  baseline_applicability: String,
  conmon_group:           String,
  notes:                  String,
  due_date:               String,
  status:                 { type: String, default: 'Pending' },   // 'Pending' | 'Completed'
  completed_date:         String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('ConMon', schema);
