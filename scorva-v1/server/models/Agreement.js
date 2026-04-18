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
  siteID:      { type: String, required: true, index: true },
  site:        String,
  notes:       String,
}, {
  collection: 'Documents',
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

module.exports = model('Agreement', schema);
