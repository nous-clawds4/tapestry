/**
 * Full HTTP integration for the server-side Finding-1 edits, against the LIVE
 * brainstorm server in the tapestry container:
 *   POST /api/strfry/publish  (publishEvent.js — kind-0 fan-out + cache bust)
 *   GET  /api/profiles        (fetchProfiles.js — newest-wins + ?fresh + invalidate)
 *
 * Prereqs handled by the caller: profile relays are temporarily pointed at the
 * local strfry relay (ws://127.0.0.1:7777) so the fan-out never reaches public
 * relays, and brainstorm has been restarted to load the edited modules.
 *
 * Self-cleaning: deletes the throwaway pubkey's events from /var/lib/strfry at
 * the end via `strfry delete`, so the dev store is left as it was.
 *
 *   docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/support/http-integration.e2e.js
 */
const assert = require('assert');
const { execSync } = require('child_process');
const { generateSecretKey, getPublicKey, finalizeEvent } = require('nostr-tools');

const BASE = process.env.API_BASE || 'http://127.0.0.1:7778';
const sk = generateSecretKey();
const pk = getPublicKey(sk);
const nowS = Math.floor(Date.now() / 1000);

function kind0(content, createdAt) {
  return finalizeEvent({ kind: 0, created_at: createdAt, tags: [], content: JSON.stringify(content) }, sk);
}

async function publish(ev) {
  const r = await fetch(`${BASE}/api/strfry/publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: ev, signAs: 'client' }),
  });
  return { status: r.status, body: await r.json() };
}

async function getProfile(fresh) {
  const r = await fetch(`${BASE}/api/profiles?pubkeys=${pk}${fresh ? '&fresh=1' : ''}`);
  const j = await r.json();
  return j.profiles ? j.profiles[pk] : undefined;
}

function cleanup() {
  try {
    process.env.STRFRY_CONFIG = '/etc/strfry.conf';
    execSync(`strfry delete --filter '{"authors":["${pk}"]}'`, { stdio: ['pipe', 'ignore', 'ignore'] });
  } catch (e) { console.warn('cleanup warning:', e.message); }
}

(async () => {
  console.log(`server: ${BASE}  throwaway pubkey: ${pk.slice(0, 12)}…\n`);

  // 1) Publish a kind-0 with an lud16 (client-signed). Edited handler must fan out + report it.
  const ev1 = kind0({ name: 'HTTPTest', lud16: 'http-a@example.com' }, nowS);
  const p1 = await publish(ev1);
  assert.strictEqual(p1.status, 200, `publish 1 status ${p1.status}: ${JSON.stringify(p1.body)}`);
  assert.ok(p1.body.success, `publish 1 not success: ${JSON.stringify(p1.body)}`);
  assert.ok(Array.isArray(p1.body.profileRelays), `kind-0 publish must include profileRelays fan-out results: ${JSON.stringify(p1.body)}`);
  console.log('1) publish lud16 → success; fan-out:', JSON.stringify(p1.body.profileRelays));

  // 2) ?fresh=1 read returns the just-published lud16 (read from local strfry after import).
  const prof1 = await getProfile(true);
  assert.ok(prof1 && prof1.lud16 === 'http-a@example.com', `fresh read mismatch: ${JSON.stringify(prof1)}`);
  console.log('2) GET ?fresh=1 →', JSON.stringify(prof1));

  // 3) Plain read (no ?fresh) — populates the 5-min cache with this value.
  const profCached = await getProfile(false);
  assert.strictEqual(profCached.lud16, 'http-a@example.com', 'cache-populate read mismatch');
  console.log('3) GET (no fresh) populates cache →', JSON.stringify(profCached));

  // 4) Publish a NEWER kind-0 switching to bolt12 (REPLACE). The handler must invalidate the cache.
  const ev2 = kind0({ name: 'HTTPTest', bolt12: 'lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy' }, nowS + 5);
  const p2 = await publish(ev2);
  assert.ok(p2.body.success, `publish 2 not success: ${JSON.stringify(p2.body)}`);
  console.log('4) publish bolt12 (newer) → success; fan-out:', JSON.stringify(p2.body.profileRelays));

  // 5) THE key assertion: a plain read (no ?fresh) now returns the NEW profile (bolt12, no lud16).
  //    If the publish handler had NOT busted the cache, step-3's cached lud16 would still return.
  const prof2 = await getProfile(false);
  assert.ok(prof2 && prof2.bolt12 && !prof2.lud16,
    `cache-bust failed — expected bolt12 & no lud16 on a NON-fresh read, got ${JSON.stringify(prof2)}`);
  console.log('5) GET (no fresh) after switch → cache was busted →', JSON.stringify(prof2));

  cleanup();
  console.log('\nHTTP-INTEGRATION E2E: PASS');
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); cleanup(); process.exit(1); });
