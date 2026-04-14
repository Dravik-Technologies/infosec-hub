'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:                  String,
  title:                { type: String, required: true },
  control_id:           String,
  weakness:             String,
  severity:             String,
  status:               { type: String, default: 'Open' },
  site:                 String,
  source_type:          String,
  source_id:            String,
  responsible_party:    String,
  point_of_contact:     String,
  resources:            String,
  scheduled_completion: String,
  milestones:           { type: Array, default: [] },
  identified_date:      String,
  ato_id:               String,
  poam_type:            String,
  comments:             String,
  completed_date:       String,
  closed_date:          String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('POAM', schema);
