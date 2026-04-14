'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:         String,
  title:       { type: String, required: true },
  category:    { type: String, default: 'Agreement' },
  type:        { type: String, required: true },
  status:      { type: String, default: 'Active' },
  signed:      String,
  expires:     String,
  parties:     String,
  assigned_to: String,
  site:        String,
  notes:       String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('Agreement', schema);
