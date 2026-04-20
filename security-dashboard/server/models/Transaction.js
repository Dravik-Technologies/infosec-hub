'use strict';
const { Schema, model } = require('../db');

/*
 * Transaction — immutable audit record created each time an expense is logged
 * against a Contract via PUT /api/contracts/:id.
 *
 * transactionId is a short human-readable identifier (TXN-XXXXX) generated
 * server-side for display in the Audit Trail view.
 *
 * type enum:
 *   Expense    — funds drawn down from a contract (debit)
 *   Allocation — new funds added to a contract (credit, future use)
 *
 * date defaults to the moment the record is created; never updated after
 * insert so the trail remains tamper-evident.
 */
const transactionSchema = new Schema({
  _id:           String,

  // ── Reference keys ────────────────────────────────────────────────────────
  transactionId: String,   // e.g. "TXN-8F92A"  — display ID
  contractId:    String,   // human-readable contract ID
  siteId:        String,   // facility the contract is assigned to

  // ── Financial ─────────────────────────────────────────────────────────────
  amount:        { type: Number, default: 0 },
  type:          {
    type:    String,
    enum:    ['Expense', 'Allocation'],
    default: 'Expense',
  },

  // ── Temporal ──────────────────────────────────────────────────────────────
  date:          { type: Date, default: Date.now },

}, { versionKey: false });

transactionSchema.set('toJSON', {
  transform(_, r) { r.id = r._id; delete r._id; return r; },
});

module.exports = model('Transaction', transactionSchema, 'transactions');
