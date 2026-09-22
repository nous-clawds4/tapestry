/**
 * POST /api/assistant/identification-tags/publish — your Assistant signs its identification taggings of you
 * (assistant-identification-tags #3, ADR assistant-identification-tags/0003).
 *
 * A narrow, session-bound route, in the shape of publish-profile (ADR 0003 Option A), through which the signed-in
 * person's own Assistant signs its identification taggings: the required taggings whose signer is the Assistant (src/lib/identification-tags: "My Tapestry Owner", "My Human"), each an
 * ordinary nostr-user-tag assertion of the canonical tag, tagging the signed-in person, as an apply, in exactly the
 * shape the browser's tagging publisher gives the person's own (ui/src/utils/publishProfileTag.js).
 *
 * Whose Assistant comes from the SESSION only: the one main→delegate mapping (getAssistantKeys — the Owner's is the
 * instance TA, anyone else's their own relay key); no request parameter names a person or an Assistant. Refusals come
 * first, before any key is read: not signed in (401), a body that is not a non-empty list of the Assistant-signed
 * required keys (400), no Assistant on this instance (403). The route signs nothing else. The generic signer
 * (src/api/strfry/commands/publishEvent.js) stays owner-or-admin (OPEN.md row 269) and TA-only, and the other assistant-key signers —
 * trusted lists, curated DList headers and updates, normalization, NIP-85 — are unchanged by it.
 *
 * Per tagging: its canonical definition must be findable (story 1's lookup, local relay first, then the tag-federation
 * relays), else that tagging alone is refused as tag-not-found; the event is written to this instance's relay first —
 * a failed write sends it nowhere and says so — then to the relays this instance is configured to publish to (the
 * general-purpose, profile and WoT lists plus the relays it reads tags from), each reported in the profile publish's
 * words (accepted | refused | unreachable | timeout, or skipped in local-only mode).
 *
 * Nothing calls this at Assistant creation. publishAssistantTaggingsFor is exported for a later, separately decided
 * creation-time caller.
 */

const {
  REQUIRED_TAGGINGS, CANONICAL_TAG_AUTHOR, taggingDTag,
} = require('../../lib/identification-tags');
const { lookupByAddresses, tagRelays } = require('./attention');

const HEX64 = /^[0-9a-f]{64}$/i;

/** The Relay Settings lists the Assistant's taggings go to: the profile publish's three, plus the relays this instance reads tags from. */
const TAGGING_PUBLISH_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aProfileRelays', 'aWotRelays', 'aTagFederationRelays'];

const CODES = {
  NOT_SIGNED_IN: 'not-signed-in',
  NOT_AN_ASSISTANT_TAGGING: 'not-an-assistant-tagging',
  NO_ASSISTANT: 'no-assistant',
  TAG_NOT_FOUND: 'tag-not-found',
};

/** The refusal words (story 3 § Copy) and the page's "tag not found" sentence (story 2 § Copy). */
const WORDS = {
  [CODES.NOT_SIGNED_IN]: 'Sign in to have your Assistant publish its taggings.',
  [CODES.NO_ASSISTANT]: "You don't have a Tapestry Assistant on this instance yet.",
  [CODES.NOT_AN_ASSISTANT_TAGGING]: 'That is not one of the taggings your Assistant publishes.',
  tagNotFound: (name) => `Tag not found: the tag "${name}" has not been published yet, so this tagging can't be made here.`,
  failed: "Could not publish your Assistant's taggings",
};

const ASSISTANT_ENTRIES = REQUIRED_TAGGINGS.filter((e) => e.signer === 'assistant');
const ASSISTANT_KEYS = new Set(ASSISTANT_ENTRIES.map((e) => e.key));

// nostr-tools, lazily and resiliently: the absolute path resolves inside the container, the bare require everywhere
// else (the stack-free runner installs node_modules at the repo root). Mirrors src/api/strfry/commands/publishEvent.js.
let _nt = null;
function getNostrTools() {
  if (!_nt) {
    try { _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools'); }
    catch { _nt = require('nostr-tools'); }
  }
  return _nt;
}

/** The canonical z stamp of a nostr-user-tag assertion — the ADR 0015 literal, from its one server home. */
function canonicalZ() {
  return require('../profile-tags').NOSTR_USER_TAG_Z_TAG;
}

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    getAssistantKeys: (pubkey) => require('../../utils/assistantKeys').getAssistantKeys(pubkey),
    getOwnerAssistantPubkey: () => require('../../utils/assistantKeys').getOwnerAssistantPubkey(),
    scanLocal: (filter) => require('../setup/status').scanLocalStrict(filter),
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
    readConfiguredRelays: (categories) => require('./profilePublish').readConfiguredRelays(categories),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
    importEvent: (event) => require('./profileState').importToLocalRelay(event),
    isLocalOnly: () => require('../publish-policy').isPublishLocalOnly(),
    publishToRelays: (event, relays, options) => require('./profilePublish').publishToRelays(event, relays, options),
    finalizeEvent: (template, privkeyBytes) => getNostrTools().finalizeEvent(template, privkeyBytes),
    getPublicKey: (privkeyBytes) => getNostrTools().getPublicKey(privkeyBytes),
    now: () => Date.now(),
  };
}

/** A stored private key as bytes: hex, or an nsec. */
function privkeyBytesOf(privkey) {
  if (privkey instanceof Uint8Array) return privkey;
  const s = String(privkey);
  if (s.startsWith('nsec')) return getNostrTools().nip19.decode(s).data;
  return Uint8Array.from(Buffer.from(s, 'hex'));
}

/**
 * The unsigned tagging, in the browser publisher's shape (ui/src/utils/publishProfileTag.js): d (the replaceable
 * address), p (the target), a (the tag's address), e (the definition's id), the canonical z, the local z from the
 * runtime TA (omitted when unresolved), polarity, and the content that mirrors them. Pure.
 */
function buildAssistantTagging({ signerPubkey, targetPubkey, tag, localTaPubkey, canonicalZ: canonical, createdAt }) {
  const tagAddress = `39999:${tag.authorPubkey}:${tag.slug}`;
  const hasLocalTa = HEX64.test(localTaPubkey || '');
  return {
    kind: 39999,
    pubkey: signerPubkey,
    created_at: createdAt,
    tags: [
      ['d', taggingDTag({ slug: tag.slug, targetPubkey, signerPubkey })],
      ['p', targetPubkey],
      ['a', tagAddress],
      ['e', tag.eventId],
      ['z', canonical],
      ...(hasLocalTa ? [['z', `39998:${localTaPubkey}:nostr-user-tag`]] : []),
      ['polarity', '1'],
    ],
    content: JSON.stringify({
      nostrUserTag: { taggedPubkey: targetPubkey, tagEventId: tag.eventId, tagAddress },
    }),
  };
}

/**
 * The whole flow after the session and body checks: whose key, the definitions, then per tagging the build, the sign,
 * the local write and the fan-out, each reported. Answers { refusal } when the viewer has no Assistant here, else
 * { results } — one row per requested key, in REQUIRED_TAGGINGS order.
 */
async function publishAssistantTaggingsFor({ viewer, keys }, deps) {
  const d = { ...defaultDeps(), ...deps };
  const wanted = new Set(Array.isArray(keys) ? keys : []);
  const entries = ASSISTANT_ENTRIES.filter((e) => wanted.has(e.key));

  const relayKeys = await d.getAssistantKeys(viewer);
  if (!relayKeys || !relayKeys.privkey) return { refusal: { status: 403, code: CODES.NO_ASSISTANT } };
  const privkeyBytes = privkeyBytesOf(relayKeys.privkey);
  const assistantPubkey = String(d.getPublicKey(privkeyBytes)).toLowerCase();

  const definitions = await lookupByAddresses({ kind: 39999, author: CANONICAL_TAG_AUTHOR, ds: entries.map((e) => e.slug), relays: tagRelays(d) }, d);

  const localOnly = Boolean(d.isLocalOnly());
  const configured = d.readConfiguredRelays(TAGGING_PUBLISH_CATEGORIES);
  const publishRelays = localOnly ? [] : configured;
  const localTaPubkey = d.getOwnerAssistantPubkey();
  if (!HEX64.test(localTaPubkey || '')) {
    console.warn('[assistant/identification-tags] runtime TA pubkey unresolved — the local z is omitted (the canonical z still ships)');
  }
  const { summarizePublish, localFailureMessage } = require('./profilePublish');
  const zCanonical = canonicalZ();

  const results = [];
  for (const entry of entries) {
    const subject = `"${entry.name}"`;
    const definition = definitions[entry.slug];
    if (!definition || !definition.finished || !definition.event) {
      results.push({ key: entry.key, name: entry.name, ok: false, code: CODES.TAG_NOT_FOUND, message: WORDS.tagNotFound(entry.name) });
      continue;
    }
    const template = buildAssistantTagging({
      signerPubkey: assistantPubkey,
      targetPubkey: viewer,
      tag: { eventId: definition.event.id, slug: entry.slug, authorPubkey: CANONICAL_TAG_AUTHOR },
      localTaPubkey,
      canonicalZ: zCanonical,
      createdAt: Math.floor(d.now() / 1000),
    });
    const signed = d.finalizeEvent(template, privkeyBytes);

    // This instance's relay first (BIBLE §30). If it refuses the tagging, nothing goes outward for it.
    try {
      await d.importEvent(signed);
    } catch (err) {
      const reason = err && err.message ? err.message : String(err);
      results.push({
        key: entry.key, name: entry.name, ok: false, stage: 'local', outcome: 'not-delivered', localOnly,
        message: localFailureMessage(subject, reason),
        relays: { total: 0, success: 0, results: [] },
      });
      continue;
    }

    const rows = localOnly
      ? configured.map((relay) => ({ relay, status: 'skipped', reason: 'local-only publish mode' }))
      : await d.publishToRelays(signed, publishRelays);
    const { outcome, message, accepted } = summarizePublish({ subject, rows, localOnly });
    results.push({ key: entry.key, name: entry.name, ok: true, outcome, message, localOnly, relays: { total: rows.length, success: accepted, results: rows } });
  }
  return { results };
}

/**
 * Every side effect behind one seam (the profile publish's way), so what this handler signs and sends where can be
 * tested without a key store, strfry or a relay.
 */
function createPublishIdentificationTaggingsHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };

  return async function handlePublishIdentificationTaggings(req, res) {
    const session = req && req.session;
    const viewer = session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
      ? session.pubkey.toLowerCase()
      : null;
    if (!viewer) return res.status(401).json({ success: false, code: CODES.NOT_SIGNED_IN, error: WORDS[CODES.NOT_SIGNED_IN] });

    const keys = req && req.body ? req.body.keys : undefined;
    const wellFormed = Array.isArray(keys) && keys.length > 0 && keys.every((k) => typeof k === 'string' && ASSISTANT_KEYS.has(k));
    if (!wellFormed) return res.status(400).json({ success: false, code: CODES.NOT_AN_ASSISTANT_TAGGING, error: WORDS[CODES.NOT_AN_ASSISTANT_TAGGING] });

    try {
      const out = await publishAssistantTaggingsFor({ viewer, keys: [...new Set(keys)] }, d);
      if (out.refusal) return res.status(out.refusal.status).json({ success: false, code: out.refusal.code, error: WORDS[out.refusal.code] });
      for (const row of out.results) {
        console.log(`[assistant/identification-tags] ${row.key}: ${row.ok ? row.outcome : row.code || row.stage} — ${row.message}`);
        for (const r of (row.relays && row.relays.results) || []) {
          if (r.status !== 'accepted') console.warn(`[assistant/identification-tags] ${r.relay} — ${r.status}${r.reason ? `: ${r.reason}` : ''}`);
        }
      }
      return res.json({ success: true, results: out.results });
    } catch (err) {
      console.error("[assistant/identification-tags] could not publish the Assistant's taggings:", err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: WORDS.failed });
    }
  };
}

const handlePublishIdentificationTaggings = createPublishIdentificationTaggingsHandler();

module.exports = {
  createPublishIdentificationTaggingsHandler,
  handlePublishIdentificationTaggings,
  publishAssistantTaggingsFor,
  buildAssistantTagging,
  TAGGING_PUBLISH_CATEGORIES,
  CODES,
};
