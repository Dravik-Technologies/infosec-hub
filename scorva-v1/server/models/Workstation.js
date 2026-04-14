'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:            String,
  asset_tag:      String,
  hostname:       { type: String, required: true },
  type:           { type: String, default: 'Workstation' },
  username:       String,
  site:           String,
  os:             String,
  ip:             String,
  location:       String,
  classification: { type: String, default: 'Unclassified' },
  status:         { type: String, default: 'Available' },
  system:         String,
  key_expiry:     String,
  last_seen:      String,
  notes:          String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('Workstation', schema);
