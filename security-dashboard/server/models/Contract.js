'use strict';
const { Schema, model } = require('../db');

/*
 * Contract — a vendor contract tracked against the FY26 program budget.
 *
 * amountSpent is updated incrementally via PUT /api/contracts/:id when a
 * user logs an expense; totalValue holds the total obligated amount.
 *
 * status enum mirrors the three lifecycle stages shown in the UI:
 *   Active  — currently executing
 *   Pending — awarded but not yet started / under negotiation
 *   Closed  — completed or terminated
 */
const contractSchema = new Schema({
  _id:         String,

  // ── Required ──────────────────────────────────────────────────────────────
  contractId:  { type: String, required: [true, 'contractId is required'] },

  // ── Relational key ────────────────────────────────────────────────────────
  siteId:      String,   // human-readable site ID, e.g. "SITE-001"; used in $lookup

  // ── Descriptive ───────────────────────────────────────────────────────────
  vendor:      String,
  scope:       String,

  // ── Financial ─────────────────────────────────────────────────────────────
  totalValue:  { type: Number, default: 0 },
  amountSpent: { type: Number, default: 0 },

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  expiration:  Date,
  status:      {
    type:    String,
    enum:    ['Active', 'Pending', 'Closed'],
    default: 'Active',
  },

}, { versionKey: false });

contractSchema.set('toJSON', {
  transform(_, r) { r.id = r._id; delete r._id; return r; },
});

module.exports = model('Contract', contractSchema, 'contracts');
