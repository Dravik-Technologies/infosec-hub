'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Sites ──────────────────────────────────────────────────────────────────
  const sites = [
    { id: 'MTSI-VA', label: 'MTSI Virginia' },
    { id: 'MTSI-OH', label: 'MTSI Ohio' },
    { id: 'MTSI-LV', label: 'MTSI Las Vegas' },
    { id: 'MTSI-CO', label: 'MTSI Colorado' },
    { id: 'MTSI-STL', label: 'MTSI St. Louis' },
    { id: 'MTSI-AL', label: 'MTSI Alabama' },
    { id: 'MTSI-FL', label: 'MTSI Florida' },
  ];

  for (const site of sites) {
    await db.site.upsert({
      where: { id: site.id },
      update: { label: site.label },
      create: site,
    });
    console.log(`  Site: ${site.label} (${site.id})`);
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  const users = [
    {
      id: 'admin-mtsi',
      name: 'MTSI Admin',
      username: 'admin',
      email: 'admin@mtsi.com',
      password: 'Admin@12345!',
      role: 'Hub Admin',
      siteId: 'MTSI-VA',
      siteIds: ['MTSI-VA', 'MTSI-OH', 'MTSI-LV', 'MTSI-CO', 'MTSI-STL', 'MTSI-AL', 'MTSI-FL'],
    },
    {
      id: 'user-va',
      name: 'Virginia User',
      username: 'va.user',
      email: 'user@mtsi-va.com',
      password: 'User@12345!',
      role: 'Hub User',
      siteId: 'MTSI-VA',
      siteIds: ['MTSI-VA'],
    },
    {
      id: 'user-al',
      name: 'Alabama User',
      username: 'al.user',
      email: 'user@mtsi-al.com',
      password: 'User@12345!',
      role: 'Hub User',
      siteId: 'MTSI-AL',
      siteIds: ['MTSI-AL'],
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await db.user.upsert({
      where: { username: u.username },
      update: { name: u.name, email: u.email, role: u.role, siteId: u.siteId, siteIds: u.siteIds },
      create: {
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        passwordHash,
        role: u.role,
        siteId: u.siteId,
        siteIds: u.siteIds,
        status: 'Active',
      },
    });
    console.log(`  User: ${u.name} (${u.username}) → ${u.siteId}`);
  }

  // ── Sentinel sites (one per Site) ───────────────────────────────────────────
  const sentinelSites = [
    { siteId: 'MTSI-VA', name: 'MTSI Virginia', location: 'Virginia', status: 'Active' },
    { siteId: 'MTSI-OH', name: 'MTSI Ohio', location: 'Ohio', status: 'Active' },
    { siteId: 'MTSI-LV', name: 'MTSI Las Vegas', location: 'Las Vegas, NV', status: 'Active' },
    { siteId: 'MTSI-CO', name: 'MTSI Colorado', location: 'Colorado', status: 'Active' },
    { siteId: 'MTSI-STL', name: 'MTSI St. Louis', location: 'St. Louis, MO', status: 'Active' },
    { siteId: 'MTSI-AL', name: 'MTSI Alabama', location: 'Alabama', status: 'Active' },
    { siteId: 'MTSI-FL', name: 'MTSI Florida', location: 'Florida', status: 'Active' },
  ];

  for (const ss of sentinelSites) {
    await db.mashSite.upsert({
      where: { siteId: ss.siteId },
      update: { name: ss.name, location: ss.location, status: ss.status },
      create: ss,
    });
    console.log(`  SentinelSite: ${ss.name}`);
  }

  console.log('Seeding complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
