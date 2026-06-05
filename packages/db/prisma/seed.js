'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Sites ──────────────────────────────────────────────────────────────────
  const sites = [
    { id: 'MTSI-ALX', label: 'MTSI Alexandria' },
    { id: 'MTSI-HVL', label: 'MTSI Huntsville' },
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
      id: 'admin-alx',
      name: 'MTSI Admin',
      username: 'admin',
      email: 'admin@mtsi.com',
      password: 'Admin@12345!',
      role: 'Hub Admin',
      siteId: 'MTSI-ALX',
      siteIds: ['MTSI-ALX', 'MTSI-HVL'],
    },
    {
      id: 'sso-alx',
      name: 'Alexandria SSO',
      username: 'alx.user',
      email: 'user@mtsi-alx.com',
      password: 'User@12345!',
      role: 'Hub User',
      siteId: 'MTSI-ALX',
      siteIds: ['MTSI-ALX'],
    },
    {
      id: 'sso-hvl',
      name: 'Huntsville SSO',
      username: 'hvl.user',
      email: 'user@mtsi-hvl.com',
      password: 'User@12345!',
      role: 'Hub User',
      siteId: 'MTSI-HVL',
      siteIds: ['MTSI-HVL'],
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

  // ── MASH sites ─────────────────────────────────────────────────────────────
  const mashSites = [
    { siteId: 'MTSI-ALX', name: 'MTSI Alexandria', location: 'Alexandria, VA', status: 'Active' },
    { siteId: 'MTSI-HVL', name: 'MTSI Huntsville', location: 'Huntsville, AL', status: 'Active' },
  ];

  for (const ms of mashSites) {
    await db.mashSite.upsert({
      where: { siteId: ms.siteId },
      update: { name: ms.name, location: ms.location, status: ms.status },
      create: ms,
    });
    console.log(`  MashSite: ${ms.name}`);
  }

  console.log('Seeding complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
