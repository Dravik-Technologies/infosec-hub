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
  siteID:        { type: String, required: true, index: true },
  site:          String,
}, {
  collection: 'ATOPackages',
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

module.exports = model('ATO', schema);
