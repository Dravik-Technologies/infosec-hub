'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:                    String,
  title:                  { type: String, required: true },
  family:                 String,
  status:                 { type: String, default: 'Not Implemented' },
  baseline:               String,
  last_review:            String,
  findings:               { type: Number, default: 0 },
  notes:                  String,
  description:            String,
  implementation_guidance: String,
  siteID:                 { type: String, index: true },
  site:                   String,
  conmon_status:          { type: String, default: 'Open' },  // Compliant / Open / POA&M
  conmon_group:           String,                             // name of covering ConMon activity
  conmon_frequency:       String,                             // frequency of covering activity
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

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

module.exports = model('Control', schema);
