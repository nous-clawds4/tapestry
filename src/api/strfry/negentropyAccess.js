'use strict';
/**
 * Who may run a negentropy sync (owner decision, 2026-10-10).
 *
 * The owner, an admin, or a direct-local caller (the loopback task scripts; `req.localTrusted`, set by
 * src/middleware/auth.js) may run any sync. A signed-in person who is neither may run one narrow sync:
 * download one author's kind 30382 Trusted Assertions. That is how Brainstorm Search, Search Preferences and
 * Brainstorm Settings bring a chosen point of view's scores to this instance. Everyone else is refused:
 * 401 when not signed in, 403 when signed in.
 */

const { isOwnerOrAdmin } = require('../../middleware/auth');

const POV_SYNC_KIND = 30382;
const PUBKEY_HEX = /^[0-9a-f]{64}$/;

/** True only for { dir: 'down', filter: { kinds: [30382], authors: [<one hex pubkey>] } }. */
function isPovSync(body) {
  if (!body || typeof body !== 'object') return false;
  const { dir, filter } = body;
  if (dir !== 'down') return false;
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return false;
  const keys = Object.keys(filter).sort();
  if (keys.length !== 2 || keys[0] !== 'authors' || keys[1] !== 'kinds') return false;
  const { kinds, authors } = filter;
  return Array.isArray(kinds) && kinds.length === 1 && kinds[0] === POV_SYNC_KIND
    && Array.isArray(authors) && authors.length === 1
    && typeof authors[0] === 'string' && PUBKEY_HEX.test(authors[0]);
}

function createSyncGuards({ isOwnerOrAdmin: ownerOrAdmin }) {
  const signedIn = (req) => Boolean(req.session && req.session.authenticated);
  const isSyncManager = (req) => Boolean(req.localTrusted) || ownerOrAdmin(req);

  function refuse(req, res) {
    if (!signedIn(req)) return res.status(401).json({ success: false, error: 'Sign in to run a sync.' });
    return res.status(403).json({ success: false, error: 'Only the owner or an admin can run this sync.' });
  }

  function requireSyncManager(req, res, next) {
    return isSyncManager(req) ? next() : refuse(req, res);
  }

  function requireSyncManagerOrPovSync(req, res, next) {
    if (isSyncManager(req)) return next();
    if (signedIn(req) && isPovSync(req.body)) return next();
    return refuse(req, res);
  }

  return { isSyncManager, requireSyncManager, requireSyncManagerOrPovSync };
}

module.exports = {
  ...createSyncGuards({ isOwnerOrAdmin }),
  createSyncGuards,
  isPovSync,
  POV_SYNC_KIND,
};
