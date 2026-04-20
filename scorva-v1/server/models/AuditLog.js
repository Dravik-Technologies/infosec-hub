'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  username:  String,
  action:    { type: String, required: true },
  resource:  String,
  detail:    String,
  siteID:    { type: String, required: true, index: true },
  site:      String,
}, {
  collection: 'AuditLogs',
  timestamps: { createdAt: 'timestamp', updatedAt: false },
});

schema.index({ timestamp: -1 });
schema.index({ username: 1 });
schema.index({ siteID: 1, _id: 1 }, { name: 'site_doc_lookup' });

schema.pre('validate', function syncSiteID(next) {
  if (!this.siteID && this.site) this.siteID = this.site;
  if (!this.site && this.siteID) this.site = this.siteID;
  next();
});

schema.set('toJSON', { transform: (_d, r) => {
  r.id = r._id.toString();
  if (!r.siteID && r.site) r.siteID = r.site;
  if (!r.site && r.siteID) r.site = r.siteID;
  delete r._id;
  delete r.__v;
  return r;
} });

module.exports = model('AuditLog', schema);
