'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  siteID: {
    type: String,
    required: true,
    index: true,
  },
  controlID: {
    type: String,
    required: true,
    trim: true,
  },
  controlTitle: {
    type: String,
    required: true,
    default: '',
  },
  family: {
    type: String,
    required: true,
    default: '',
  },
  status: {
    type: String,
    required: true,
    default: 'Pending',
  },
  dueDate: {
    type: String,
    required: true,
    default: '',
  },
  daagJsigFrequency: {
    type: String,
    default: '',
  },
  baselineApplicability: {
    type: String,
    default: '',
  },
  conmonGroup: {
    type: String,
    default: '',
  },
  notes: {
    type: String,
    default: '',
  },
  completedDate: {
    type: String,
    default: null,
  },
}, {
  collection: 'SiteControls',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

schema.index({ siteID: 1, controlID: 1 }, { unique: true, name: 'site_control_lookup' });

schema.set('toJSON', { transform: (_d, r) => {
  r.id = String(r._id);
  r.control_id = r.controlID;
  r.control_title = r.controlTitle;
  r.due_date = r.dueDate;
  r.completed_date = r.completedDate;
  r.daag_jsig_frequency = r.daagJsigFrequency;
  r.baseline_applicability = r.baselineApplicability;
  r.conmon_group = r.conmonGroup;
  r.site = r.siteID;
  delete r.__v;
  return r;
} });

module.exports = model('ConMon', schema);
