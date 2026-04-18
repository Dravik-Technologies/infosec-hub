'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:     String,
  type:    { type: String, default: 'info' },
  title:   { type: String, required: true },
  message: String,
  siteID:  { type: String, index: true },
  site:    String,
  read:    { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

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

module.exports = model('Notification', schema);
