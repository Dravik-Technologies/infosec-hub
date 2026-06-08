'use strict';

/**
 * Token Epoch Cache
 * ─────────────────────────────────────────────────────────────────────────────
 * In-memory cache for user token epochs to reduce database queries during auth.
 * When a user's tokenEpoch changes (revocation), the cache entry is invalidated.
 *
 * Cache TTL: 5-10 seconds (configurable via EPOCH_CACHE_TTL env var)
 * This keeps per-request latency low while still catching revocations quickly.
 */

const CACHE_TTL = parseInt(process.env.EPOCH_CACHE_TTL || '5000', 10);
const epochCache = new Map();

async function getTokenEpoch(db, userId) {
  const cached = epochCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.epoch;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { tokenEpoch: true },
    });

    if (user) {
      epochCache.set(userId, {
        epoch: user.tokenEpoch || 0,
        timestamp: Date.now(),
      });
      return user.tokenEpoch || 0;
    }
  } catch (err) {
    console.error('[tokenEpochCache]', err.message);
  }

  return 0;
}

function invalidateCache(userId) {
  epochCache.delete(userId);
}

function invalidateAllCache() {
  epochCache.clear();
}

module.exports = {
  getTokenEpoch,
  invalidateCache,
  invalidateAllCache,
};
