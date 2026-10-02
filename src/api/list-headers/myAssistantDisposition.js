/**
 * list-headers-disposition #3–#4 — Disposition on My Assistant rows (ADR list-headers-disposition/0003, 0004).
 *
 *   POST /api/list-headers/my-assistant/:handle/self-declare   Submit as a Shared Concept
 *   POST /api/list-headers/my-assistant/:handle/b-defer        Keep private
 *   POST /api/list-headers/my-assistant/:handle/b-append       Wire to an external shared concept  { target }
 *
 * The owner's rule: nobody can trigger somebody else's Assistant to publish anything. So, in order:
 * the same host (another site is refused), a verified session (requireAuth — a no-session call from
 * inside the container has none, whatever the middleware stamped), then the CALLER's own Assistant keys,
 * then the header's author must be that Assistant, then (Wire only) the target, then the latest version, which must itself verify
 * (author, kind, first d, signature), then the shared tag rules, then sign with those keys, then local
 * strfry, then a read-back by id (strfry import exits 0 even when it rejects an event), and only then the
 * graph (ADR list-headers-disposition/0003 and its Amendment 1; 0004 and its Amendment 1). There is no owner, admin or loopback path here, and no Owner-only key helper:
 * Concept Headers' endpoints (src/api/concept/selfDeclare.js, bDisposition.js) keep those until their
 * own fix (OPEN.md row `2026-10-01-concept-headers-disposition-owner-signer`).
 *
 * Nothing is broadcast here; the browser sends a submitted header to the community relay, as Concept
 * Headers does. Every side effect is injected through createMyAssistantDispositionHandler(action, deps),
 * so the branch logic is testable without the stack (test/list-headers-my-assistant-disposition.test.js).
 */

'use strict';

const { composeSelfDeclare, composeKeepPrivate, composeWire, nextCreatedAt, OWN_ADDRESS_REFUSAL } = require('../../lib/headerDispositionCompose');

const HEADER_KIND = 39998;
const HANDLE_RE = /^(\d+):([0-9a-f]{64}):(.+)$/;
const ROUTES = {
  'self-declare': '/api/list-headers/my-assistant/:handle/self-declare',
  'b-defer': '/api/list-headers/my-assistant/:handle/b-defer',
  'b-append': '/api/list-headers/my-assistant/:handle/b-append',
};
// The Wire target's bounds (ADR list-headers-disposition/0004, Amendment 1). The relay keeps tag values of at
// most 1024 bytes (maxTagValSize) and its import exits 0 when it rejects one, so an unbounded target could reach
// the graph while the relay kept nothing. Targets are list headers only: the literal kind 39998 (owner decision).
const MAX_TARGET_BYTES = 1024;
const LIST_HEADER_ADDRESS_RE = /^39998:([0-9a-f]{64}):(.+)$/;
const CONTROL_OR_FORMAT_RE = /[\p{Cc}\p{Cf}]/u;
const NOT_A_LIST_HEADER = "The target must be a list header's address (39998:pubkey:d-tag)";
const TOO_LONG = 'The target is too long — the relay keeps tag values of at most 1024 bytes';
const BAD_CHARACTERS = "The target contains characters an address can't have";

const ACTIONS = {
  'self-declare': { compose: composeSelfDeclare, done: 'declared', already: 'already-declared' },
  'b-defer': { compose: (header) => composeKeepPrivate(header), done: 'deferred', already: 'already-deferred' },
  // Wire (ADR list-headers-disposition/0004 and its Amendment 1). prepare() reads and checks the target from
  // the JSON body before the relay is read, so a bad target costs no lookup. The own address is compared by
  // parts: the caller's Assistant pubkey and the URL's d-tag.
  'b-append': {
    prepare: (req, selfCoord, keys, dTag) => {
      const raw = req.body ? req.body.target : undefined;
      if (typeof raw !== 'string') return { error: NOT_A_LIST_HEADER };
      const target = raw.trim();
      if (CONTROL_OR_FORMAT_RE.test(target)) return { error: BAD_CHARACTERS };
      if (Buffer.byteLength(target, 'utf8') > MAX_TARGET_BYTES) return { error: TOO_LONG };
      const parts = target.match(LIST_HEADER_ADDRESS_RE);
      if (!parts) return { error: NOT_A_LIST_HEADER };
      if (parts[1] === keys.pubkey && parts[2] === dTag) return { error: OWN_ADDRESS_REFUSAL };
      return { target };
    },
    compose: (header, selfCoord, input) => composeWire(header, selfCoord, input.target),
    done: 'wired',
    already: 'already-wired',
  },
};

// Same container path the other server modules use (src/api/dlist-curation/index.js); lazy so a
// stack-free test can load this module.
const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';

/**
 * The cross-site rule of src/api/dlist-curation/update.js:107-115 (ADR curated-dlist-update/0006), copied until
 * ledger row 326 (the house-wide cross-origin posture) centralises it. A browser always sends Origin on a
 * cross-site POST; with no Origin the request goes on to the other checks (ADR list-headers-disposition/0003,
 * Amendment 1 §2).
 */
function sameHost(req) {
  const headers = (req && req.headers) || {};
  if (headers.origin === undefined) return true;
  try {
    return new URL(String(headers.origin)).hostname.toLowerCase() === new URL(`http://${headers.host}`).hostname.toLowerCase();
  } catch {
    return false;
  }
}

function firstD(event) {
  const tag = (event && Array.isArray(event.tags) ? event.tags : []).find((t) => Array.isArray(t) && t[0] === 'd');
  return tag ? tag[1] : null;
}

function newest(events) {
  return (events || []).reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
}

function defaultDeps() {
  return {
    requireAuth: (req, res) => require('../trustedList').requireAuth(req, res),
    getAssistantKeys: (pubkey) => require('../../utils/assistantKeys').getAssistantKeys(pubkey),
    // Shell-free: the d-tag comes from the URL, so it never goes near a shell.
    scanLatest: async (filter) => newest(await require('../concept/bDisposition').strfryScanStream(filter)),
    sign: (template, privkeyHex) => require(NOSTR_TOOLS_PATH).finalizeEvent(template, Uint8Array.from(Buffer.from(privkeyHex, 'hex'))),
    publishLocal: (event) => require('../normalize/helpers').publishToStrfry(event),
    importToGraph: (event, uuid) => require('../normalize/helpers').importEventDirect(event, uuid),
    // A JSON round-trip, so a cached verifiedSymbol can't vouch for the event (publishEvent.js:88).
    verify: (event) => {
      try { return require(NOSTR_TOOLS_PATH).verifyEvent(JSON.parse(JSON.stringify(event))) === true; } catch { return false; }
    },
    // The read-back (Amendment 1 §4): is the event with this id in the local relay now?
    isStored: async (id) => (await require('../concept/bDisposition').strfryScanStream({ ids: [id] })).some((e) => e && e.id === id),
    now: () => Math.floor(Date.now() / 1000),
  };
}

function createMyAssistantDispositionHandler(action, deps = {}) {
  const spec = ACTIONS[action];
  if (!spec) throw new Error(`unknown disposition action: ${action}`);
  const d = { ...defaultDeps(), ...deps };

  return async function handleMyAssistantDisposition(req, res) {
    try {
      if (!sameHost(req)) return res.status(403).json({ success: false, error: 'a request from another site is refused' });

      const sessionPubkey = d.requireAuth(req, res);
      if (!sessionPubkey) return; // requireAuth has answered 401

      const keys = await d.getAssistantKeys(sessionPubkey);
      if (!keys || !keys.pubkey || !keys.privkey) {
        return res.status(403).json({ success: false, error: 'You have no Tapestry Assistant on this instance' });
      }

      // Express has already decoded req.params; decoding again would turn a d-tag of "a%41" into "aA".
      const m = String((req.params && req.params.handle) || '').match(HANDLE_RE);
      if (!m) return res.status(400).json({ success: false, error: 'handle must be kind:pubkey:d-tag' });
      if (Number(m[1]) !== HEADER_KIND) {
        return res.status(400).json({ success: false, error: 'only kind-39998 list headers can be dispositioned' });
      }
      if (m[2] !== keys.pubkey) {
        return res.status(403).json({ success: false, error: 'You can only disposition headers your own Assistant wrote' });
      }

      const dTag = m[3];
      const selfCoord = `${HEADER_KIND}:${keys.pubkey}:${dTag}`;
      const prep = spec.prepare ? spec.prepare(req, selfCoord, keys, dTag) : {};
      if (prep.error) return res.status(400).json({ success: false, error: prep.error });

      const header = await d.scanLatest({ kinds: [HEADER_KIND], authors: [keys.pubkey], '#d': [dTag] });
      if (!header) return res.status(404).json({ success: false, error: `No header ${selfCoord} on this instance` });

      // The relay can hold unverified events (io.js imports with --no-verify), so what the lookup returns is
      // checked before anything is signed — or answered "already", which the browser would then broadcast
      // (Amendment 1 §1).
      const failed = header.pubkey !== keys.pubkey ? 'author'
        : header.kind !== HEADER_KIND ? 'kind'
          : firstD(header) !== dTag ? 'd-tag'
            : !d.verify(header) ? 'signature'
              : null;
      if (failed) {
        console.error(`list-headers/my-assistant/${action}: stored header failed the ${failed} check; nothing signed`);
        return res.status(409).json({ success: false, error: "The stored header couldn't be verified as your Assistant's, so nothing was signed" });
      }

      const composed = spec.compose(header, selfCoord, prep);
      // Domain refusal: HTTP 200 { success: false }, the house contract (bDisposition.js handleBDefer).
      if (composed.refused) return res.json({ success: false, error: composed.refused });
      if (composed.already) return res.json({ success: true, result: spec.already, event: header });

      const signed = d.sign({
        kind: HEADER_KIND,
        content: header.content || '',
        tags: composed.tags,
        created_at: nextCreatedAt(header.created_at, d.now()),
      }, keys.privkey);
      await d.publishLocal(signed);
      // strfry import exits 0 even when it rejects an event, so read the new version back before the graph
      // follows it; a read that fails claims nothing (dlist-curation/update.js readBack, ADR 0004 Amendment 1 §4).
      let stored;
      try {
        stored = await d.isStored(signed.id);
      } catch {
        return res.status(502).json({ success: false, error: "Sent to the relay, but couldn't confirm it was kept — the graph wasn't changed" });
      }
      if (!stored) return res.status(502).json({ success: false, error: "The relay didn't keep the new version, so nothing was saved" });
      await d.importToGraph(signed, selfCoord);
      return res.json({ success: true, result: spec.done, event: signed });
    } catch (error) {
      console.error(`list-headers/my-assistant/${action} error:`, error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  };
}

function register(app) {
  for (const action of Object.keys(ROUTES)) app.post(ROUTES[action], createMyAssistantDispositionHandler(action));
}

module.exports = { createMyAssistantDispositionHandler, register, ROUTES };
