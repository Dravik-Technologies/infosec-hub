'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:     String,
  type:    { type: String, default: 'info' },
  title:   { type: String, required: true },
  message: String,
  site:    String,
  read:    { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('Notification', schema);
