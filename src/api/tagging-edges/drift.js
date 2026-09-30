/**
 * The tagging pipeline panel's drift count (tagging-edges story 4, ADR tagging-edges/0004 § Implementation notes →
 * Server).
 *
 *   GET  /api/tagging-edges/drift-counts   owner or admin: the relay taggings and the graph's TAGS relationships,
 *                                          each counted once, with when it was taken and how long it took
 *
 * The relay count is one strict `strfry scan --count` over both nostr-user-tag stamps (the canonical one and this
 * deployment's own), never two counts added. The graph count is one read-only Cypher. Both run in parallel, each
 * raced against limitMs (10 s): a count that fails, or loses its race, is { known: false, code } in a 200 answer,
 * never 0. Error codes pass the library's allow-list (allowErrorCode); no host, path, message or credential appears,
 * and the stamp identities appear only as 8-character prefixes.
 *
 * It reads only: `strfry scan` writes nothing, the Cypher is a MATCH … RETURN, and nothing is enqueued, so it never
 * starts a pass. One count runs at a time: a request that passes the gate while one is in flight joins it and gets
 * the same answer. A refused request resolves no identity, spawns nothing, runs no Cypher and never joins a count.
 *
 * gateOwnerOrAdmin() and countFilter() are the pure halves. The handler takes its dependencies as a third argument,
 * for tests.
 */

const { allowErrorCode } = require('../../lib/tagging-edges/realtime');
const { stamp } = require('../../lib/tagging-edges/contract');
const { resolveIdentities } = require('../../pipeline/tagging-edges/identities');
const { sameHost } = require('./index');

const LIMIT_MS = 10000;
const OWNER_RE = /^[0-9a-f]{64}$/;
const CANONICAL_Z_RE = /^39998:(.*):nostr-user-tag$/s;
const TAGS_COUNT = 'MATCH ()-[r:TAGS]->() RETURN count(r) AS n';

/** The real dependencies, required lazily so this module loads stack-free. */
function defaultDeps() {
  return {
    ownerPubkey: () => require('../../utils/config').getConfigFromFile('BRAINSTORM_OWNER_PUBKEY'),
    getAdminPubkeys: () => require('../../utils/config').getAdminPubkeys(),
    // The runner's nested shape (reconcileTaggingEdges.js defaultDeps), for resolveIdentities.
    identities: {
      canonicalZ: () => require('../profile-tags').NOSTR_USER_TAG_Z_TAG,
      getOwnerAssistantPubkey: () => require('../../utils/assistantKeys').getOwnerAssistantPubkey(),
    },
    env: process.env,
    countStrict: (filter, opts) => require('../../lib/strfryScanStrict').countStrict(filter, opts),
    runCypher: (cypher, params, txConfig) => require('../../lib/neo4j-driver').runCypher(cypher, params, txConfig),
    now: () => Date.now(),
    limitMs: LIMIT_MS,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle),
  };
}

/** As realtime.js's withDeps: a non-object third argument (Express's next) is ignored. */
function withDeps(deps) {
  const given = deps && typeof deps === 'object' ? deps : {};
  const d = { ...defaultDeps(), ...given };
  if (typeof given.getOwnerPubkey === 'function') d.ownerPubkey = given.getOwnerPubkey;
  else if (typeof given.ownerPubkey === 'string') { const o = given.ownerPubkey; d.ownerPubkey = () => o; }
  return d;
}

/**
 * Pure but for the injected readers. Who may ask for a count, checked in this order before anything is counted:
 * a session pubkey (401; loopback is not admitted), a signed-in owner or admin (403), and the cross-site rule (403).
 * The owner is a lowercase 64-hex pubkey; admins are compared as isAdminPubkey compares them (includes, case-sensitive).
 * An owner lookup that throws admits no owner, and an admin lookup that throws admits no admin.
 * → null when admitted, else { status, error }
 */
function gateOwnerOrAdmin(req, d) {
  const session = req && req.session;
  if (!session || typeof session.pubkey !== 'string' || session.pubkey === '') {
    return { status: 401, error: 'Not authenticated' };
  }
  let owner = null;
  try { owner = d.ownerPubkey(); } catch (_) { owner = null; }
  let admins = [];
  try { admins = d.getAdminPubkeys(); } catch (_) { admins = []; }
  const isOwner = typeof owner === 'string' && OWNER_RE.test(owner) && session.pubkey === owner;
  const isAdmin = Array.isArray(admins) && admins.includes(session.pubkey);
  if (session.authenticated !== true || !(isOwner || isAdmin)) {
    return { status: 403, error: 'Owner or admin access required' };
  }
  if (!sameHost(req)) return { status: 403, error: 'cross-site request refused' };
  return null;
}

/** Pure. One relay filter over both nostr-user-tag stamps, the canonical one first; one z when they are the same. */
function countFilter(identities) {
  const z = [stamp(identities.canonicalPubkey, 'nostr-user-tag'), stamp(identities.localPubkey, 'nostr-user-tag')];
  return { kinds: [39999], '#z': [...new Set(z)] };
}

/** A count's value when it is a non-negative safe integer, else null. */
const countOf = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : null);

/** The graph's answer: exactly one row whose n is a non-negative safe integer, else null. */
const rowsCount = (rows) => (Array.isArray(rows) && rows.length === 1 && rows[0] ? countOf(rows[0].n) : null);

/**
 * Run one count raced against d.limitMs through d.setTimer; the timer is cleared when the count settles.
 * → always resolves: { known: true, count, takenAt, ms } | { known: false, code, takenAt, ms }
 * takenAt is when the count started; ms is how long it took to settle, and exactly limitMs for a lost race or for a
 * count whose settling threw. Only a throw as the count starts (the clock or setTimer) escapes, as a rejection.
 */
function raceCount(d, work, parse) {
  const start = d.now();
  const takenAt = new Date(start).toISOString();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer) => { if (!settled) { settled = true; resolve(answer); } };
    const timer = d.setTimer(() => finish({ known: false, code: 'timeout', takenAt, ms: d.limitMs }), d.limitMs);
    // A throw while settling (the clock, clearTimer or parse) still settles the count as an unknown one, with the
    // count's own error code when it had failed. Its time cannot be read, so ms is limitMs, the most a count may take.
    const failed = (err) => finish({ known: false, code: allowErrorCode(err && err.code), takenAt, ms: d.limitMs });
    let pending;
    try { pending = Promise.resolve(work()); } catch (err) { pending = Promise.reject(err); }
    pending.then(
      (value) => {
        try {
          d.clearTimer(timer);
          const count = parse(value);
          const ms = d.now() - start;
          finish(count === null ? { known: false, code: 'unparseable', takenAt, ms } : { known: true, count, takenAt, ms });
        } catch (e) { failed(e); }
      },
      (err) => {
        try {
          d.clearTimer(timer);
          finish({ known: false, code: allowErrorCode(err && err.code), takenAt, ms: d.now() - start });
        } catch (_) { failed(err); }
      },
    );
  });
}

/**
 * Both counts and the answer. Every count that fails, or whose settling throws, becomes an unknown count, so this
 * resolves to the answer shape; only a throw as a count starts rejects it.
 */
async function countBoth(d) {
  // The canonical z-tag is kept as resolveIdentities reads it, so a local refusal can still give the canonical prefix.
  let canonicalZ;
  const ids = resolveIdentities({
    identities: {
      canonicalZ: () => { canonicalZ = d.identities.canonicalZ(); return canonicalZ; },
      getOwnerAssistantPubkey: () => d.identities.getOwnerAssistantPubkey(),
    },
    env: d.env,
  });

  const graph = raceCount(d, () => d.runCypher(TAGS_COUNT, {}, { timeout: d.limitMs }), rowsCount);
  let relay;
  let stamps;
  if (ids.refusal) {
    // Nothing is spawned for an identity that did not resolve. resolveIdentities checks the canonical one first, so
    // a local refusal means the canonical one resolved.
    relay = { known: false, code: 'identity', identity: ids.refusal.identity, takenAt: new Date(d.now()).toISOString(), ms: 0 };
    const m = ids.refusal.identity === 'local' ? CANONICAL_Z_RE.exec(canonicalZ) : null;
    stamps = { canonical: m ? m[1].slice(0, 8) : null, local: null };
  } else {
    relay = raceCount(d, () => d.countStrict(countFilter(ids), { timeoutMs: d.limitMs }), countOf);
    stamps = { canonical: ids.canonicalPubkey.slice(0, 8), local: ids.localPubkey.slice(0, 8) };
  }
  const [relayAnswer, graphAnswer] = await Promise.all([relay, graph]);
  return { success: true, limitMs: d.limitMs, relay: relayAnswer, graph: graphAnswer, stamps };
}

/** The count in flight, shared by every admitted request that arrives while it runs (single flight). */
let inflight = null;

/**
 * GET /api/tagging-edges/drift-counts — owner or admin. An unexpected failure outside the counts (a throw as a count
 * starts) answers 500 with an allow-listed code.
 */
async function handleDriftCounts(req, res, deps) {
  const d = withDeps(deps);
  const refused = gateOwnerOrAdmin(req, d);
  if (refused) return res.status(refused.status).json({ success: false, error: refused.error });
  try {
    if (!inflight) inflight = countBoth(d).finally(() => { inflight = null; });
    return res.json(await inflight);
  } catch (err) {
    return res.status(500).json({ success: false, error: `could not count: ${allowErrorCode(err && err.code)}` });
  }
}

module.exports = {
  gateOwnerOrAdmin,
  countFilter,
  handleDriftCounts,
};
