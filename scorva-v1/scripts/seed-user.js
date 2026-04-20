#!/usr/bin/env node
/**
 * SCORVA — Create/update a user account
 *
 * Usage:
 *   node scripts/seed-user.js
 *
 * Prerequisites:
 *   1. MongoDB must be running (npm run mongo)
 *   2. MONGODB_URI set in .env
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { randomUUID } = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

// ── User to seed ─────────────────────────────────────────────────────────────
const USERNAME  = 'chris.macabugao';
const PASSWORD  = '#1Virginia';
const NAME      = 'Chris Macabugao';
const EMAIL     = 'chris.macabugao@scorva.local';
const ROLE      = 'Corporate Admin';
// ─────────────────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  _id:           String,
  name:          String,
  username:      String,
  email:         String,
  password_hash: String,
  role:          String,
  status:        String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: 'scorva', serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', UserSchema);

  const hash = await bcrypt.hash(PASSWORD, 12);

  const result = await User.findOneAndUpdate(
    { username: USERNAME },
    {
      $setOnInsert: { _id: randomUUID() },
      $set: {
        name:          NAME,
        username:      USERNAME,
        email:         EMAIL,
        password_hash: hash,
        role:          ROLE,
        status:        'Active',
      },
    },
    { upsert: true, new: true }
  );

  console.log(`User "${result.username}" saved (role: ${result.role})`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err.message); process.exit(1); });
