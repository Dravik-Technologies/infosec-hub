'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:                  String,
  title:                { type: String, required: true },
  control_id:           String,
  weakness:             String,
  severity:             String,
  status:               { type: String, default: 'Open' },
  siteID:               { type: String, required: true, index: true },
  site:                 String,
  source_type:          String,
  source_id:            String,
  responsible_party:    String,
  point_of_contact:     String,
  resources:            String,
  scheduled_completion: String,
  milestones:           { type: Array, default: [] },
  identified_date:      String,
  ato_id:               String,
  poam_type:            String,
  comments:             String,
  completed_date:       String,
  closed_date:          String,
}, {
  collection: 'POAMs',
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

module.exports = model('POAM', schema);
