'use strict';
const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id:        String,
  title:      { type: String, required: true },
  site:       String,
  type:       { type: String, default: 'Task' },
  status:     { type: String, default: 'Open' },
  priority:   String,
  assignee:   String,
  due_date:   String,
  control:         String,
  linked_controls: { type: [String], default: [] },  // array of control IDs
  activity_id:     String,                            // ConMon activity this task belongs to
  evidence:        String,                            // evidence note when marking complete
  created:         String,
  notes:           String,
  source:          { type: String, default: null },
  source_id:       { type: String, default: null },
  created_by:      { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.set('toJSON', { transform: (_d, r) => { r.id = r._id; delete r._id; delete r.__v; return r; } });

module.exports = model('Task', schema);
