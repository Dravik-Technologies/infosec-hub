'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  name:        { type: String, required: true },
  description: String,
  columns:     { type: Array, default: [] },
  rows:        { type: Array, default: [] },
  subtrackers: { type: Array, default: [] },
  siteID:      { type: String, index: true },
  site:        String,
  created_by:  String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.pre('validate', function syncSiteID(next) {
  if (!this.siteID && this.site) this.siteID = this.site;
  if (!this.site && this.siteID) this.site = this.siteID;
  next();
});

schema.set('toJSON', { transform: (_d, r) => {
  r.id = r._id.toString();
  if (!r.siteID && r.site) r.siteID = r.site;
  if (!r.site && r.siteID) r.site = r.siteID;
  delete r.__v;
  return r;
} });

module.exports = model('Tracker', schema);
