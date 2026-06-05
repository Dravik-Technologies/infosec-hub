'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { db } = require('../../../packages/db/src/index');
const {
  getAllowedApps,
  getSecurityRole,
  getTitleFromSecurityRole,
  mergeAllowedApps,
  mergeAppFactory,
  normalizePlatformRole,
} = require('../../../packages/db/src/appAccess');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const users = await db.user.findMany({ orderBy: [{ username: 'asc' }] });

  let changed = 0;
  for (const user of users) {
    const nextRole = normalizePlatformRole(user.role);
    const securityRole = getSecurityRole(user);
    const nextTitle = (user.title && String(user.title).trim()) || getTitleFromSecurityRole(securityRole) || null;
    const nextAllowedApps = getAllowedApps(user);
    const nextDod8140 = mergeAppFactory(
      mergeAllowedApps(user.dod8140, nextAllowedApps),
      { securityRole }
    );

    const roleChanged = nextRole !== user.role;
    const titleChanged = (user.title || null) !== nextTitle;
    const dodChanged = JSON.stringify(user.dod8140 || null) !== JSON.stringify(nextDod8140 || null);

    if (!roleChanged && !titleChanged && !dodChanged) continue;
    changed += 1;

    const summary = {
      username: user.username,
      fromRole: user.role,
      toRole: nextRole,
      title: nextTitle,
      allowedApps: nextAllowedApps,
    };

    if (dryRun) {
      console.log('[DRY RUN]', JSON.stringify(summary));
      continue;
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        role: nextRole,
        title: nextTitle,
        dod8140: nextDod8140,
      },
    });
    console.log('[UPDATED]', JSON.stringify(summary));
  }

  console.log(dryRun ? `[DRY RUN] ${changed} users would be updated.` : `[DONE] ${changed} users updated.`);
}

main()
  .catch(err => {
    console.error('[syncHubAccessModel]', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
