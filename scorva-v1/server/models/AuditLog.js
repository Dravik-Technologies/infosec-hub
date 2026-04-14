'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  username:  String,
  action:    { type: String, required: true },
  resource:  String,
  detail:    String,
  site:      String,
}, { timestamps: { createdAt: 'timestamp', updatedAt: false } });

schema.index({ timestamp: -1 });
schema.index({ username: 1 });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id.toString(); delete r._id; delete r.__v; return r; } });

module.exports = model('AuditLog', schema);
