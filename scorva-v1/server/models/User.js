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
  siteID:        { type: String, index: true },
  siteIDs:       { type: [String], default: [], index: true },
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

schema.pre('validate', function syncSiteID(next) {
  if ((!this.siteIDs || !this.siteIDs.length) && (this.siteID || this.site)) {
    this.siteIDs = [this.siteID || this.site].filter(Boolean);
  }
  if ((!this.siteID || !this.site) && this.siteIDs?.length) {
    this.siteID = this.siteID || this.siteIDs[0];
    this.site = this.site || this.siteIDs[0];
  }
  if (!this.siteID && this.site) this.siteID = this.site;
  if (!this.site && this.siteID) this.site = this.siteID;
  next();
});

schema.set('toJSON', { transform: (_d, r) => {
  r.id = r._id;
  if ((!r.siteIDs || !r.siteIDs.length) && (r.siteID || r.site)) {
    r.siteIDs = [r.siteID || r.site].filter(Boolean);
  }
  if (!r.siteID && r.site) r.siteID = r.site;
  if (!r.site && r.siteID) r.site = r.siteID;
  delete r._id;
  delete r.__v;
  delete r.password_hash;
  return r;
} });

module.exports = model('User', schema);
