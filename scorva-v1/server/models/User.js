'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:           String,
  name:          { type: String, required: true },
  title:         String,
  username:      { type: String, required: true, unique: true },
  email:         { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role:          { type: String, default: 'Viewer' },
  site:          String,
  status:        { type: String, default: 'Active' },
  yubikey:             String,
  workstation:         String,
  last_login:          String,
  training_compliant:  { type: Boolean, default: false },
  training_due:        String,
  dod_8140: {
    baseline:     String,
    cert_name:    String,
    cert_expiry:  String,
    status:       { type: String, default: 'Pending' },
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; delete r.password_hash; return r; } });

module.exports = model('User', schema);
