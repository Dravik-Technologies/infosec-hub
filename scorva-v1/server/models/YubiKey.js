'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:       String,
  serial:    { type: String, required: true, unique: true },
  model:     String,
  status:    { type: String, default: 'Unassigned' },
  username:  String,
  siteID:    { type: String, required: true, index: true },
  site:      String,
  issued:    String,
  last_auth: String,
}, {
  collection: 'YubiKeys',
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

module.exports = model('YubiKey', schema);
