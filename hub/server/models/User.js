'use strict';

const { Schema, model } = require('mongoose');

// Mirrors scorva-v1's User model so both apps share the same users collection
const schema = new Schema({
  _id:           String,
  name:          { type: String, required: true },
  title:         String,
  username:      { type: String, required: true, unique: true },
  email:         { type: String, required: true, unique: true },
  password_hash: { type: String, required: true, select: false },
  role:          { type: String, default: 'Hub Viewer' },
  site:          String,
  status:        { type: String, default: 'Active' },
  last_login:    String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', {
  transform: (_d, r) => {
    r.id = r._id;
    delete r._id;
    delete r.__v;
    delete r.password_hash;
    return r;
  },
});

module.exports = model('User', schema);
