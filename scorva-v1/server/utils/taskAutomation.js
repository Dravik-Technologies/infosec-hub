'use strict';

const { db } = require('../../../packages/db/src/index');

function today() {
  return new Date().toISOString().split('T')[0];
}

function priorityFromDueDate(dueDate, fallback = 'Medium') {
  if (!dueDate) return fallback;
  if (dueDate < today()) return 'High';
  const due = new Date(dueDate);
  const now = new Date(today());
  if (Number.isNaN(due.getTime())) return fallback;
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return days <= 7 ? 'High' : days <= 30 ? 'Medium' : fallback;
}

async function nextTaskId() {
  const last = await db.task.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const lastNum = last ? parseInt(String(last.id).replace('TF-', ''), 10) || 0 : 0;
  return 'TF-' + String(lastNum + 1).padStart(4, '0');
}

async function ensureTaskForSource({
  source,
  sourceId,
  siteId,
  title,
  type = 'Task',
  status = 'Open',
  priority = 'Medium',
  assignee = null,
  dueDate = null,
  control = null,
  linkedControls = [],
  notes = null,
  username = null,
}) {
  if (!source || !sourceId || !siteId || !title) return null;

  const existing = await db.task.findFirst({
    where: { source, sourceId, siteId, status: { notIn: ['Completed', 'Closed'] } },
    select: { id: true },
  });

  const data = {
    title,
    type,
    status,
    priority: priorityFromDueDate(dueDate, priority),
    assignee: assignee || null,
    dueDate: dueDate || null,
    control: control || null,
    linkedControls: linkedControls || [],
    notes: notes || null,
    source,
    sourceId,
  };

  if (existing) {
    return db.task.update({ where: { id: existing.id }, data });
  }

  return db.task.create({
    data: {
      id: await nextTaskId(),
      siteId,
      ...data,
      created: today(),
      createdBy: username || null,
    },
  });
}

async function completeTasksForSource(source, sourceId, evidence) {
  if (!source || !sourceId) return { count: 0 };
  return db.task.updateMany({
    where: { source, sourceId, status: { notIn: ['Completed', 'Closed'] } },
    data: { status: 'Completed', evidence: evidence || null },
  });
}

module.exports = {
  ensureTaskForSource,
  completeTasksForSource,
  priorityFromDueDate,
};
