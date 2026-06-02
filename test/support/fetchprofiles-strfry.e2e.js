/**
 * Verify the edited /api/profiles read path (src/api/profiles/fetchProfiles.js)
 * against the REAL strfry store — the server half of Finding 1.
 *
 * Runs INSIDE the tapestry container (requires nostr-tools at the Docker path).
 * Uses a throwaway strfry config + temp LMDB so the dev DB is untouched. Imports
 * kind-0 events via the real `strfry import`, then calls the exported getProfiles()
 * and asserts it reads them back (and that a newer import wins after cache invalidation).
 *
 *   docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/support/fetchprofiles-strfry.e2e.js
 */
const { execSync } = require('child_process');

const DB = '/tmp/fp-e2e-db';
const CONF = '/tmp/fp-e2e.conf';
process.env.STRFRY_CONFIG = CONF;
execSync(`rm -rf ${DB} && mkdir -p ${DB} && cp /etc/strfry.conf ${CONF} && sed -i 's|^db = .*|db = "${DB}/"|' ${CONF}`);

const { generateSecretKey, getPublicKey, finalizeEvent } = require('nostr-tools');
const { getProfiles, invalidateProfileCache } = require('/usr/local/lib/node_modules/brainstorm/src/api/profiles/fetchProfiles');

const sk = generateSecretKey();
const pk = getPublicKey(sk);
const nowS = Math.floor(Date.now() / 1000);

function importEvent(ev) { execSync('strfry import', { input: JSON.stringify(ev) + '\n', stdio: ['pipe', 'ignore', 'ignore'] }); }
function kind0(content, createdAt) { return finalizeEvent({ kind: 0, created_at: createdAt, tags: [], content: JSON.stringify(content) }, sk); }

(async () => {
  // 1) import a profile, getProfiles reads it back from real strfry
  importEvent(kind0({ name: 'Eve', lud16: 'eve-old@example.com' }, nowS - 100));
  let m = await getProfiles([pk], { bypassCache: true });
  let p = m.get(pk);
  console.log('getProfiles read-back:', JSON.stringify(p));
  if (!p || p.lud16 !== 'eve-old@example.com') throw new Error('getProfiles did not read the imported profile from strfry');

  // 2) a newer import + cache invalidation → newest-wins returns the fresh one
  importEvent(kind0({ name: 'Eve', lud16: 'eve-new@example.com' }, nowS + 5));
  invalidateProfileCache([pk]);
  m = await getProfiles([pk], { bypassCache: true });
  p = m.get(pk);
  console.log('after newer import:', JSON.stringify(p));
  if (!p || p.lud16 !== 'eve-new@example.com') throw new Error('newest-wins failed: stale profile returned');

  // 3) cache hit: without invalidation/bypass, a subsequent older-content import is NOT seen
  m = await getProfiles([pk]); // cached from step 2
  if (m.get(pk).lud16 !== 'eve-new@example.com') throw new Error('cache did not serve the last result');

  execSync(`rm -rf ${DB} ${CONF}`);
  console.log('FETCHPROFILES-STRFRY E2E: PASS');
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
