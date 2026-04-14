'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:       String,
  serial:    { type: String, required: true, unique: true },
  model:     String,
  status:    { type: String, default: 'Unassigned' },
  username:  String,
  site:      String,
  issued:    String,
  last_auth: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('YubiKey', schema);
