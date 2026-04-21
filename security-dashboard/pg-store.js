'use strict';

const { db } = require('../packages/db/src');

const SINGLETON = new Set(['budget', 'timeline', 'compliance', 'settings']);

function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function readCollection(name) {
  const row = await db.mashCollection.findUnique({ where: { name } });
  return row ? row.data : null;
}

async function writeCollection(name, data) {
  await db.mashCollection.upsert({
    where: { name },
    create: { name, data },
    update: { data },
  });
}

function stripMethods(doc) {
  const next = { ...doc };
  delete next.save;
  delete next.toJSON;
  delete next.markModified;
  return next;
}

function toStoredItem(item) {
  const id = item.id || item._id;
  const next = { ...item, id };
  delete next._id;
  delete next.__v;
  return next;
}

function toWrappedItem(name, item) {
  const plain = { ...item, _id: item.id };
  return {
    ...plain,
    markModified() {},
    async save() {
      const collection = await getArrayCollection(name);
      const index = collection.findIndex(entry => entry.id === item.id);
      if (index === -1) throw new Error(`Document not found in ${name}`);
      collection[index] = toStoredItem(stripMethods(this));
      await writeCollection(name, collection);
      Object.assign(item, collection[index]);
      return this;
    },
    toJSON() {
      return { ...stripMethods(this) };
    },
  };
}

function toWrappedSingleton(name, data) {
  const doc = { ...data, _id: 'singleton' };
  return {
    ...doc,
    markModified() {},
    async save() {
      const next = stripMethods(this);
      delete next._id;
      await writeCollection(name, next);
      return this;
    },
    toJSON() {
      return { ...stripMethods(this) };
    },
  };
}

async function getArrayCollection(name) {
  const data = await readCollection(name);
  return Array.isArray(data) ? data : [];
}

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, value]) => doc[key] === value);
}

function getPathValue(doc, expr) {
  if (expr == null) return expr;
  if (typeof expr === 'string') {
    if (expr.startsWith('$')) return doc[expr.slice(1)];
    return expr;
  }
  if (typeof expr === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(expr)) {
      if (value && typeof value === 'object' && '$year' in value) {
        out[key] = new Date(getPathValue(doc, value.$year)).getUTCFullYear();
      } else if (value && typeof value === 'object' && '$month' in value) {
        out[key] = new Date(getPathValue(doc, value.$month)).getUTCMonth() + 1;
      } else {
        out[key] = getPathValue(doc, value);
      }
    }
    return out;
  }
  return expr;
}

function getNestedValue(doc, path) {
  return path.split('.').reduce((value, part) => (value == null ? value : value[part]), doc);
}

function aggregateGroupKey(doc, expr) {
  const value = getPathValue(doc, expr);
  return value == null ? 'null' : JSON.stringify(value);
}

function applyAggregate(data, pipeline = []) {
  let rows = data.map(item => ({ ...item, _id: item.id }));

  for (const stage of pipeline) {
    if (stage.$match) {
      rows = rows.filter(row => matches(row, stage.$match));
      continue;
    }

    if (stage.$group) {
      const grouped = new Map();
      for (const row of rows) {
        const keyText = aggregateGroupKey(row, stage.$group._id);
        const keyValue = stage.$group._id == null ? null : getPathValue(row, stage.$group._id);
        if (!grouped.has(keyText)) grouped.set(keyText, { _id: keyValue });
        const target = grouped.get(keyText);

        for (const [field, expr] of Object.entries(stage.$group)) {
          if (field === '_id') continue;
          if (expr.$sum !== undefined) {
            const addend = typeof expr.$sum === 'number' ? expr.$sum : Number(getPathValue(row, expr.$sum) || 0);
            target[field] = (target[field] || 0) + addend;
          } else if (expr.$first !== undefined && target[field] === undefined) {
            target[field] = getPathValue(row, expr.$first);
          }
        }
      }
      rows = [...grouped.values()];
      continue;
    }

    if (stage.$sort) {
      const [[field, dir]] = Object.entries(stage.$sort);
      rows.sort((a, b) => {
        const left = getNestedValue(a, field);
        const right = getNestedValue(b, field);
        if (left === right) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        return left > right ? dir : -dir;
      });
      continue;
    }

    if (stage.$limit) {
      rows = rows.slice(0, stage.$limit);
      continue;
    }

    if (stage.$project) {
      rows = rows.map(row => {
        const next = {};
        for (const [field, expr] of Object.entries(stage.$project)) {
          if (expr === 0) continue;
          if (expr === 1) next[field] = row[field];
          else next[field] = getPathValue(row, expr);
        }
        return next;
      });
    }
  }

  return rows;
}

function createFindQuery(name, filter = {}, { byId } = {}) {
  const state = { sort: null, limit: null, lean: false };

  const execute = async () => {
    const items = await getArrayCollection(name);
    let rows = items.filter(item => (byId ? item.id === byId : matches(item, filter)));

    if (state.sort) {
      const [[field, dir]] = Object.entries(state.sort);
      rows = [...rows].sort((a, b) => {
        const left = a[field];
        const right = b[field];
        if (left === right) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        return left > right ? dir : -dir;
      });
    }

    if (state.limit != null) rows = rows.slice(0, state.limit);

    if (byId) {
      const row = rows[0];
      if (!row) return null;
      return state.lean ? { ...row, _id: row.id } : toWrappedItem(name, row);
    }

    return state.lean ? rows.map(row => ({ ...row, _id: row.id })) : rows.map(row => toWrappedItem(name, row));
  };

  return {
    sort(spec) {
      state.sort = spec;
      return this;
    },
    limit(value) {
      state.limit = value;
      return this;
    },
    lean() {
      state.lean = true;
      return execute();
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
    catch(reject) {
      return execute().catch(reject);
    },
    finally(onFinally) {
      return execute().finally(onFinally);
    },
  };
}

function createSingletonQuery(name) {
  const execute = async () => {
    const data = await readCollection(name);
    if (!data) return null;
    return toWrappedSingleton(name, data);
  };

  return {
    lean: async () => {
      const data = await readCollection(name);
      return data ? { ...data, _id: 'singleton' } : null;
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
    catch(reject) {
      return execute().catch(reject);
    },
    finally(onFinally) {
      return execute().finally(onFinally);
    },
  };
}

function getModel(name) {
  return {
    async exists() {
      const data = await readCollection(name);
      return data != null;
    },
    async countDocuments() {
      const data = await readCollection(name);
      if (SINGLETON.has(name)) return data ? 1 : 0;
      return Array.isArray(data) ? data.length : 0;
    },
    async create(doc) {
      if (SINGLETON.has(name)) {
        const next = { ...doc };
        delete next._id;
        await writeCollection(name, next);
        return toWrappedSingleton(name, next);
      }

      const current = await getArrayCollection(name);
      const stored = toStoredItem(doc);
      current.push(stored);
      await writeCollection(name, current);
      return toWrappedItem(name, stored);
    },
    find(filter = {}) {
      return createFindQuery(name, filter);
    },
    findById(id) {
      if (SINGLETON.has(name) && id === 'singleton') return createSingletonQuery(name);
      return createFindQuery(name, {}, { byId: id });
    },
    async findByIdAndUpdate(id, update, _options = {}) {
      const current = await getArrayCollection(name);
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return null;
      current[index] = { ...current[index], ...(update.$set || {}) };
      await writeCollection(name, current);
      return toWrappedItem(name, current[index]);
    },
    async findByIdAndDelete(id) {
      const current = await getArrayCollection(name);
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return null;
      const [removed] = current.splice(index, 1);
      await writeCollection(name, current);
      return toWrappedItem(name, removed);
    },
    async findOneAndReplace(_filter, doc) {
      const next = { ...doc };
      delete next._id;
      await writeCollection(name, next);
      return toWrappedSingleton(name, next);
    },
    async findOneAndUpdate(_filter, update) {
      const current = (await readCollection(name)) || {};
      const next = { ...current, ...(update.$set || {}) };
      await writeCollection(name, next);
      return toWrappedSingleton(name, next);
    },
    async deleteMany() {
      await writeCollection(name, []);
      return { acknowledged: true };
    },
    async aggregate(pipeline) {
      const current = await getArrayCollection(name);
      return applyAggregate(current, pipeline);
    },
  };
}

module.exports = {
  dbOk: isDbConfigured,
  getModel,
  readCollection,
  writeCollection,
};
