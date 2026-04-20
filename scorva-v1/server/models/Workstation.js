'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:            String,
  asset_tag:      String,
  hostname:       { type: String, required: true },
  type:           { type: String, default: 'Workstation' },
  username:       String,
  siteID:         { type: String, required: true, index: true },
  site:           String,
  os:             String,
  ip:             String,
  location:       String,
  classification: { type: String, default: 'Unclassified' },
  status:         { type: String, default: 'Available' },
  system:         String,
  key_expiry:     String,
  last_seen:      String,
  notes:          String,
}, {
  collection: 'Devices',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

schema.index({ siteID: 1, _id: 1 }, { name: 'site_doc_lookup' });

schema.pre('validate', function syncSiteID(next) {
  if (!this.siteID && this.site) this.siteID = this.site;
  if (!this.site && this.siteID) this.site = this.siteID;
  next();
});

schema.set('toJSON', { transform: (_d, r) => {
  r.id = r._id;
  if (!r.siteID && r.site) r.siteID = r.site;
  if (!r.site && r.siteID) r.site = r.siteID;
  delete r._id;
  delete r.__v;
  return r;
} });

module.exports = model('Workstation', schema);
