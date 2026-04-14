'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:           String,
  system:        { type: String, required: true },
  category:      { type: String, required: true },
  status:        { type: String, required: true },
  issued:        String,
  expires:       String,
  ao:            String,
  controls:      { type: Number, default: 0 },
  open_findings: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('ATO', schema);
