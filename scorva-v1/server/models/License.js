'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:     String,
  product: { type: String, required: true },
  vendor:  String,
  seats:   { type: Number, default: 0 },
  used:    { type: Number, default: 0 },
  status:  { type: String, default: 'Active' },
  expires: String,
  cost:    String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('License', schema);
