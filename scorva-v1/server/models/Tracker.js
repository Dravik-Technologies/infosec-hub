'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  name:        { type: String, required: true },
  description: String,
  columns:     { type: Array, default: [] },
  rows:        { type: Array, default: [] },
  subtrackers: { type: Array, default: [] },
  site:        String,
  created_by:  String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id.toString(); delete r.__v; return r; } });

module.exports = model('Tracker', schema);
