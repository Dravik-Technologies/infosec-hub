'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema(
  { _id: String, label: { type: String, required: true } },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('Site', schema);
