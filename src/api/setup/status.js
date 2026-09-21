/**
 * GET /api/setup/status — the signed-in viewer's three /setup steps (setup-status-and-alert #1,
 * ADR setup-status-and-alert/0001).
 *
 * One answer, computed here and shared by the /setup page and the Setup Alert, so the two cannot
 * disagree. Every step is about the SESSION's viewer — their assistant, their kind 3, their kind
 * 10040 — and no request parameter can change whose state is read or which relays are asked.
 *
 *   1 · Create your account              done = this instance holds an assistant for you
 *   2 · Create your follow list          done = your follow list follows someone other than you
 *   3 · Activate your Brainstorm account done = your Map names your assistant for rank AND followers
 *
 * Steps 2 and 3 read this instance's relay first; only when it has no such event are the outside
 * relays configured for that kind read, and the newest event found counts. Each step says whether
 * its check FINISHED: it found the event, or found none locally and none outside after at least one
 * outside relay answered. A step is `pending` — what the alert counts — only when its check finished,
 * it is not done, and (step 3) the Map does not name another provider.
 *
 * Read-only: strfry is only scanned, outside relays are only read, and nothing is stored anywhere.
 *
 *   no session  → { success: true, signedIn: false }
 *   signed in   → { success: true, signedIn: true, steps: { account, follow, activate } }
 *   a throw     → 500 { success: false, error: 'Could not check setup status' }
 */

const HEX64 = /^[0-9a-f]{64}$/i;
const NEWLINE = String.fromCharCode(10);

/** Relay Settings lists that keep follow lists: general-purpose relays, the WoT relay, profile indexers. */
const FOLLOW_LIST_RELAY_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aWotRelays', 'aProfileRelays'];

/** One outside relay gets this long to answer (the /api/relay/external strict budget). */
const RELAY_BUDGET_MS = 8000;

/** One local `strfry scan` gets this long. */
const LOCAL_SCAN_TIMEOUT_MS = 5000;

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    getAssistantPubkeyFor: (pubkey) => require('../../utils/assistantKeys').getAssistantPubkeyFor(pubkey),
    scanLocal: (filter) => scanLocalStrict(filter),
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
    readConfiguredRelays: (categories) => require('../assistant/profilePublish').readConfiguredRelays(categories),
    mapDefaultRelays: () => require('../export/nip85/currentMap').defaultRelays(),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
  };
}

/**
 * `strfry scan <filter>`, and the events it printed — or a rejection. Unlike the curation scan, a
 * scan that fails to start, exits non-zero or outlives `timeoutMs` REJECTS: a failed scan says
 * nothing about what the relay holds, so it must never read as "none here".
 */
function scanLocalStrict(filter, { timeoutMs = LOCAL_SCAN_TIMEOUT_MS } = {}) {
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    let out = '';
    let settled = false;
    let timer = null;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    let proc;
    try {
      proc = spawn('strfry', ['scan', JSON.stringify(filter)]);
    } catch (err) {
      reject(err);
      return;
    }
    timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already gone */ }
      finish(reject, new Error(`strfry scan timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stdout.on('data', (chunk) => { out += chunk; });
    proc.on('error', (err) => finish(reject, err));
    proc.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(`strfry scan exited with code ${code}`));
        return;
      }
      const events = [];
      for (const line of out.split(NEWLINE)) {
        const s = line.trim();
        if (!s) continue;
        try { events.push(JSON.parse(s)); } catch { /* a strfry log line */ }
      }
      finish(resolve, events);
    });
  });
}

/** Newest by created_at; on a tie the lexically lowest id (NIP-01's rule for replaceable events). */
function newest(events) {
  let best = null;
  for (const e of events) {
    if (!best) { best = e; continue; }
    const a = e.created_at || 0;
    const b = best.created_at || 0;
    if (a > b || (a === b && String(e.id) < String(best.id))) best = e;
  }
  return best;
}

/** One relay read, given up at RELAY_BUDGET_MS. A throw or a timeout is `unreachable`. */
async function readWithinBudget(url, filter, deps) {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve().then(() => deps.readRelay(url, filter)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('relay budget spent')), RELAY_BUDGET_MS); }),
    ]);
  } catch (err) {
    return { status: 'unreachable', events: [], error: err && err.message ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The viewer's newest event of one kind: this instance's relay first, then — only on a miss — the
 * given outside relays, all at once.
 *
 * @returns {Promise<{finished: true, event: Object|null, source: 'local'|'relay'|null}
 *                  |{finished: false, reason: 'local-unreadable'|'no-outside-relays'|'outside-unreachable'}>}
 */
async function lookupNewest({ kind, pubkey, relays }, deps) {
  const filter = { kinds: [kind], authors: [pubkey] };
  const mine = (e) => e && e.kind === kind && e.pubkey === pubkey;

  let local;
  try {
    local = await deps.scanLocal(filter);
  } catch {
    return { finished: false, reason: 'local-unreadable' };
  }
  const held = (Array.isArray(local) ? local : []).filter(mine);
  if (held.length > 0) return { finished: true, event: newest(held), source: 'local' };

  if (!Array.isArray(relays) || relays.length === 0) return { finished: false, reason: 'no-outside-relays' };

  const answers = await Promise.all(relays.map((url) => readWithinBudget(url, filter, deps)));
  const answered = answers.filter((a) => a && a.status === 'ok');
  if (answered.length === 0) return { finished: false, reason: 'outside-unreachable' };

  const found = newest(answered.flatMap((a) => (Array.isArray(a.events) ? a.events : [])).filter(mine));
  return found ? { finished: true, event: found, source: 'relay' } : { finished: true, event: null, source: null };
}

/** The pubkey of the first entry named `name` with a valid (64-hex) delegate, lowercased; else null. */
function firstProvider(tags, name) {
  for (const t of Array.isArray(tags) ? tags : []) {
    if (Array.isArray(t) && t[0] === name && typeof t[1] === 'string' && HEX64.test(t[1])) return t[1].toLowerCase();
  }
  return null;
}

/** The three steps, from the viewer, their assistant and the two lookups. Pure. */
function evaluateSteps({ viewer, assistantPubkey, follow, map }) {
  const self = String(viewer || '').toLowerCase();
  const assistant = typeof assistantPubkey === 'string' && assistantPubkey ? assistantPubkey.toLowerCase() : null;

  const account = { done: !!assistant, pending: !assistant, finished: true };

  let followStep;
  if (!follow || !follow.finished) {
    followStep = { done: false, pending: false, finished: false };
  } else {
    const followed = new Set();
    const tags = follow.event && Array.isArray(follow.event.tags) ? follow.event.tags : [];
    for (const t of tags) {
      if (Array.isArray(t) && t[0] === 'p' && typeof t[1] === 'string' && HEX64.test(t[1])) {
        const pk = t[1].toLowerCase();
        if (pk !== self) followed.add(pk);
      }
    }
    const done = followed.size >= 1;
    followStep = { done, pending: !done, finished: true, followCount: followed.size };
  }

  let activate;
  if (!map || !map.finished) {
    activate = { done: false, pending: false, finished: false, otherProvider: false };
  } else {
    const tags = map.event ? map.event.tags : [];
    const rank = firstProvider(tags, '30382:rank');
    const followers = firstProvider(tags, '30382:followers');
    const done = !!assistant && rank === assistant && followers === assistant;
    const otherProvider = !!((rank && rank !== assistant) || (followers && followers !== assistant));
    activate = { done, pending: !done && !otherProvider, finished: true, otherProvider };
  }

  return { account, follow: followStep, activate };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return null;
  }
}

/**
 * The outside relays only: ws/wss URLs whose host is not this instance's own — loopback, the host of
 * BRAINSTORM_RELAY_URL, STRFRY_DOMAIN — each once, case-blind and one trailing slash apart. This
 * instance's relay answering "none" is not outside evidence: its answer is the local scan's.
 */
function outsideOnly(urls, deps) {
  const own = new Set(LOOPBACK_HOSTS);
  const relayHost = hostOf(String(deps.getConfigFromFile('BRAINSTORM_RELAY_URL', '') || ''));
  if (relayHost) own.add(relayHost);
  const domain = String(deps.getConfigFromFile('STRFRY_DOMAIN', '') || '').trim().toLowerCase();
  if (domain) own.add(domain);

  const seen = new Set();
  const kept = [];
  for (const raw of Array.isArray(urls) ? urls : []) {
    if (typeof raw !== 'string') continue;
    const url = raw.trim();
    if (!/^wss?:\/\//i.test(url)) continue;
    const host = hostOf(url);
    if (!host || own.has(host)) continue;
    const key = url.toLowerCase().replace(/\/+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(url);
  }
  return kept;
}

/** Where follow lists are looked for outside: Relay Settings' general-purpose, WoT and profile relays. */
function followListRelays(deps) {
  return outsideOnly(deps.readConfiguredRelays(FOLLOW_LIST_RELAY_CATEGORIES), deps);
}

/** Where Maps are looked for outside: the server's current-Map list, minus this instance's relay. */
function treasureMapRelays(deps) {
  return outsideOnly(deps.mapDefaultRelays(), deps);
}

/** A lookup's provenance on its step: `source` when it finished, `reason` when it did not. */
function withProvenance(step, lookup) {
  if (lookup && lookup.finished) return { ...step, source: lookup.source || null };
  return { ...step, source: null, reason: lookup ? lookup.reason : 'outside-unreachable' };
}

async function handleSetupStatus(req, res, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const session = req && req.session;
  const viewer = session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
    ? session.pubkey.toLowerCase()
    : null;
  if (!viewer) return res.json({ success: true, signedIn: false });

  try {
    const assistantPubkey = await d.getAssistantPubkeyFor(viewer);
    const [follow, map] = await Promise.all([
      lookupNewest({ kind: 3, pubkey: viewer, relays: followListRelays(d) }, d),
      lookupNewest({ kind: 10040, pubkey: viewer, relays: treasureMapRelays(d) }, d),
    ]);
    const steps = evaluateSteps({ viewer, assistantPubkey, follow, map });
    return res.json({
      success: true,
      signedIn: true,
      steps: {
        account: steps.account,
        follow: withProvenance(steps.follow, follow),
        activate: withProvenance(steps.activate, map),
      },
    });
  } catch (err) {
    console.error('[setup/status] could not check setup status:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Could not check setup status' });
  }
}

module.exports = {
  handleSetupStatus,
  lookupNewest,
  evaluateSteps,
  followListRelays,
  treasureMapRelays,
  outsideOnly,
  scanLocalStrict,
  FOLLOW_LIST_RELAY_CATEGORIES,
  RELAY_BUDGET_MS,
  LOCAL_SCAN_TIMEOUT_MS,
};
