/**
 * dlist-curation #4 — POST /api/dlist-curation/header
 *
 * Authors (or re-signs) the signed-in user's Tapestry Assistant curation header for a chosen
 * community DList header, per protocols/drafts/assistant-designation.md § "Per-DList curation
 * entries" and ADR engineering-team/decisions/dlist-curation/0004-assistant-curation-header-endpoint.md.
 *
 *   body: { "target": "39998:<community pubkey>:<d-tag>" }
 *
 * Flow: verified session → the CALLER's assistant keys (never the owner's TA as a fallback) →
 * validate the target → fetch the community header (DList relays first, local strfry second) →
 * self-declared check → existing-header scan (exact / conflict / unpointed / none) → compose →
 * sign → local strfry import → DList relays under the publish-policy gate → honest per-destination
 * report. The header is a letter in this relay: nothing here touches the graph.
 *
 * Every side effect is injected through createAuthorCurationHeaderHandler(deps) so the branch
 * logic is testable without the stack (test/dlist-curation-header-endpoint.test.js).
 */

const { A_TAG_RE, dispositionOf } = require('../../lib/bValueForms');

const ROUTE = '/api/dlist-curation/header';
const HEADER_KIND = 39998;
const INHERIT_ITEMS = 'inherit-items';
const COPIED_TAGS = ['names', 'slug', 'json']; // ADR 0004 sub-decision 2; never `b`, never `concept-graph`
const RELAY_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 8000;
const SCAN_TIMEOUT_MS = 10000;

// Same container paths the other server modules use (src/api/relay/fetchEvents.js); lazy so a
// stack-free test can load this module without them.
const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';
let _nt = null;
function nt() {
  if (!_nt) {
    if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require(WS_PATH);
    _nt = require(NOSTR_TOOLS_PATH);
  }
  return _nt;
}

/* ── pure helpers (exported for the suite) ────────────────────────────────── */

/** `<kind>:<pubkey>:<d-tag>` → { kind, pubkey, d } or null. Split at the first two colons only. */
function parseATag(value) {
  if (typeof value !== 'string' || !A_TAG_RE.test(value)) return null;
  const i = value.indexOf(':');
  const j = value.indexOf(':', i + 1);
  const kind = Number(value.slice(0, i));
  if (!Number.isInteger(kind)) return null;
  return { kind, pubkey: value.slice(i + 1, j), d: value.slice(j + 1) };
}

function bTagsOf(ev) {
  return (ev && Array.isArray(ev.tags) ? ev.tags : []).filter((t) => Array.isArray(t) && t[0] === 'b');
}

/**
 * What an existing assistant header for this d-tag means for the request:
 *   'none'      — no header
 *   'exact'     — exactly one b, and it is ["b", <target>, "inherit-items"]
 *   'conflict'  — any other b (other target, other type, untyped, or extra b tags): never re-point silently
 *   'unpointed' — a header with no b at all: append the contract b (the firmware seed rule)
 */
function classifyExisting(existing, target) {
  if (!existing) return 'none';
  const bs = bTagsOf(existing);
  if (bs.length === 0) return 'unpointed';
  if (bs.length === 1 && bs[0][1] === target && bs[0][2] === INHERIT_ITEMS) return 'exact';
  return 'conflict';
}

/**
 * The unsigned template. With `existing` (the unpointed case) every existing tag is preserved in
 * order and the contract b appended, content kept, created_at skew-proof; otherwise a fresh header:
 * d, then names / slug / json copied verbatim from the community header (slug synthesized when
 * absent), then the contract b. Nothing that points into the community author's namespace is copied.
 */
function composeCurationHeader(community, target, existing, opts = {}) {
  const now = typeof opts.now === 'function' ? opts.now : () => Math.floor(Date.now() / 1000);
  const contractB = ['b', target, INHERIT_ITEMS];
  if (existing) {
    const tags = (Array.isArray(existing.tags) ? existing.tags : []).map((t) => [...t]);
    tags.push(contractB);
    return {
      kind: HEADER_KIND,
      created_at: Math.max(now(), (existing.created_at || 0) + 1),
      content: typeof existing.content === 'string' ? existing.content : '',
      tags,
    };
  }
  const ctags = community && Array.isArray(community.tags) ? community.tags : [];
  const dTag = ctags.find((t) => Array.isArray(t) && t[0] === 'd');
  const d = dTag && typeof dTag[1] === 'string' ? dTag[1] : parseATag(target).d;
  const tags = [['d', d]];
  for (const name of COPIED_TAGS) {
    const t = ctags.find((x) => Array.isArray(x) && x[0] === name);
    if (t) tags.push([...t]);
    else if (name === 'slug') tags.push(['slug', d]);
  }
  tags.push(contractB);
  return { kind: HEADER_KIND, created_at: now(), content: '', tags };
}

function wsOnly(urls) {
  return (Array.isArray(urls) ? urls : [])
    .filter((u) => typeof u === 'string' && /^wss?:\/\/.+/i.test(u.trim()))
    .map((u) => u.trim());
}

function newest(events) {
  return (Array.isArray(events) ? events : [])
    .filter((e) => e && typeof e === 'object')
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0] || null;
}

/* ── real seams (the defaults) ────────────────────────────────────────────── */

/** `strfry scan <filter>` → parsed events (log noise skipped). */
function scanLocal(filter) {
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    const proc = spawn('strfry', ['scan', JSON.stringify(filter)]);
    let out = '';
    let settled = false;
    const finish = (fn, v) => { if (!settled) { settled = true; clearTimeout(timer); fn(v); } };
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      finish(reject, new Error(`strfry scan timed out after ${SCAN_TIMEOUT_MS}ms`));
    }, SCAN_TIMEOUT_MS);
    proc.stdout.on('data', (c) => { out += c; });
    proc.on('error', (err) => finish(reject, err));
    proc.on('close', () => {
      const events = [];
      for (const line of out.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        try { events.push(JSON.parse(s)); } catch { /* strfry log line */ }
      }
      finish(resolve, events);
    });
  });
}

/**
 * querySync over the given relays, bounded. By default a failure reads as "not there" (local is
 * the fallback); `opts.strict` rethrows it instead — for callers that must not proceed blind
 * (dlist-curation #7's current-Map fetch).
 */
async function fetchFromRelays(filter, urls, opts = {}) {
  const relays = wsOnly(urls);
  if (relays.length === 0) return [];
  const { SimplePool } = nt();
  const pool = new SimplePool();
  try {
    const events = await Promise.race([
      pool.querySync(relays, filter),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`relay fetch timed out after ${FETCH_TIMEOUT_MS}ms`)), FETCH_TIMEOUT_MS)),
    ]);
    return Array.isArray(events) ? events : [];
  } catch (err) {
    if (opts && opts.strict) throw err;
    console.warn(`[dlist-curation] relay fetch failed (${relays.join(',')}): ${err.message}`);
    return [];
  } finally {
    try { pool.close(relays); } catch { /* already closed */ }
  }
}

/**
 * One send per relay, each settled on its own (OPEN.md row 200: never push a success before the
 * relay answered). Rows: { url, status: 'ok' | 'failed', error? }.
 */
async function publishToRelays(event, urls) {
  const relays = wsOnly(urls);
  if (relays.length === 0) return [];
  const { SimplePool } = nt();
  const pool = new SimplePool();
  try {
    const settled = await Promise.allSettled(relays.map((url) => {
      const r = pool.publish([url], event);
      const attempt = Array.isArray(r) ? r[0] : r; // SimplePool.publish returns one promise per relay
      return Promise.race([
        attempt,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${RELAY_TIMEOUT_MS}ms`)), RELAY_TIMEOUT_MS)),
      ]);
    }));
    return settled.map((r, i) => (r.status === 'fulfilled'
      ? { url: relays[i], status: 'ok' }
      : { url: relays[i], status: 'failed', error: (r.reason && r.reason.message) || String(r.reason) }));
  } finally {
    try { pool.close(relays); } catch { /* already closed */ }
  }
}

/** The deployment's publish policy — the same rule as src/api/publish-policy/index.js. */
function isLocalOnly() {
  const { getConfigFromFile } = require('../../utils/config');
  const raw = process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY !== undefined
    ? process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY
    : getConfigFromFile('BRAINSTORM_PUBLISH_LOCAL_ONLY', 'false');
  return raw === 'true';
}

function defaultDeps() {
  return {
    requireAuth: (req, res) => require('../trustedList').requireAuth(req, res),
    getAssistantKeys: (pubkey) => require('../../utils/assistantKeys').getAssistantKeys(pubkey),
    fetchFromRelays,
    scanLocal,
    publishLocal: (event) => require('../trustedList').publishToStrfry(event),
    publishToRelays,
    isLocalOnly,
    getDListRelays: () => {
      const settings = require('../../config/settings').getSettings();
      return (settings && settings.aRelays && settings.aRelays.aDListRelays) || [];
    },
    sign: (template, privkeyHex) => nt().finalizeEvent(template, Uint8Array.from(Buffer.from(privkeyHex, 'hex'))),
    now: () => Math.floor(Date.now() / 1000),
  };
}

/* ── the handler ──────────────────────────────────────────────────────────── */

function createAuthorCurationHeaderHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  return async function handleAuthorCurationHeader(req, res) {
    try {
      const sessionPubkey = d.requireAuth(req, res);
      if (!sessionPubkey) return;

      const keys = await d.getAssistantKeys(sessionPubkey);
      if (!keys || !keys.pubkey || !keys.privkey) {
        return res.status(400).json({ success: false, error: 'no Tapestry Assistant is provisioned for this account' });
      }

      const target = req.body && req.body.target;
      const parsed = parseATag(target);
      if (!parsed) {
        return res.status(400).json({ success: false, error: 'target must be a community header a-tag (kind:pubkey:d-tag)' });
      }
      if (parsed.kind !== HEADER_KIND) {
        return res.status(400).json({ success: false, error: 'only kind-39998 community headers are supported (39999-declared headers: not yet)' });
      }
      if (parsed.pubkey === sessionPubkey || parsed.pubkey === keys.pubkey) {
        return res.status(400).json({ success: false, error: 'cannot curate your own header (or one your assistant authored)' });
      }

      // The community header — relays first (the source the panel offers), local mirror second.
      const communityFilter = { kinds: [HEADER_KIND], authors: [parsed.pubkey], '#d': [parsed.d] };
      const relays = wsOnly(d.getDListRelays());
      let community = newest(await d.fetchFromRelays(communityFilter, relays));
      if (!community) community = newest(await d.scanLocal(communityFilter));
      if (!community) {
        return res.status(404).json({ success: false, error: 'community header not found on the DList relays or in local strfry' });
      }
      const bValues = bTagsOf(community).map((t) => t[1]);
      if (!dispositionOf(bValues, target).selfDeclared) {
        return res.status(400).json({ success: false, error: 'target is not a self-declared shared concept (no b to its own coordinate)' });
      }

      // Never-clobber: the assistant's own header for this d-tag decides what happens next.
      const existing = newest(await d.scanLocal({ kinds: [HEADER_KIND], authors: [keys.pubkey], '#d': [parsed.d] }));
      const state = classifyExisting(existing, target);
      if (state === 'exact') {
        return res.json({ success: true, existing: true, header: existing, published: null });
      }
      if (state === 'conflict') {
        return res.status(409).json({
          success: false,
          error: 'an existing header by your assistant carries a different b pointer; it was not re-pointed',
          existing: { b: bTagsOf(existing), event: existing },
        });
      }

      const template = composeCurationHeader(community, target, state === 'unpointed' ? existing : null, { now: d.now });
      const signed = d.sign(template, keys.privkey);

      try {
        await d.publishLocal(signed);
      } catch (err) {
        return res.status(500).json({ success: false, error: `local publish failed: ${err.message}`, stage: 'local' });
      }

      let rows;
      if (d.isLocalOnly()) {
        rows = relays.map((url) => ({ url, status: 'skipped', reason: 'local-only publish policy' }));
      } else {
        try { rows = await d.publishToRelays(signed, relays); }
        catch (err) { rows = relays.map((url) => ({ url, status: 'failed', error: err.message })); }
      }
      return res.json({ success: true, existing: false, header: signed, published: { local: 'ok', relays: rows } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };
}

function register(app) {
  app.post(ROUTE, createAuthorCurationHeaderHandler());
}

module.exports = {
  register,
  createAuthorCurationHeaderHandler,
  parseATag,
  classifyExisting,
  composeCurationHeader,
  // Exported for the suite / future reuse:
  scanLocal,
  fetchFromRelays,
  publishToRelays,
  isLocalOnly,
};
