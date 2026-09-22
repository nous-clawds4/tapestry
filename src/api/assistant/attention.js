/**
 * GET /api/assistant/attention — which of the signed-in viewer's Assistant Management actions need attention,
 * for the actions that have a real check (assistant-identification-tags #1, ADR assistant-identification-tags/0001).
 *
 * One answer, computed here and shared by the /assistant hub, the Assistant Alert and the action page, so the three
 * cannot disagree. Every check is about the SESSION's viewer and the assistant this instance holds for them (the one
 * main→delegate mapping; for the Owner the instance TA), and no request parameter can change whose state is read or
 * which relays are asked.
 *
 * Today one action is checked, `identification-tags`: the four taggings that make the handshake between a person and
 * their assistant (src/lib/identification-tags). Each is looked up by its replaceable address — the publisher's
 * deterministic d tag, which embeds the slug and not the tag's author, so a tagging of anyone's same-named tag counts —
 * on this instance's relay first; only when that holds none are the outside relays this instance reads tags from
 * (Relay Settings' tag-federation list) asked, and then the newest found counts. A tagging is present when the signer's
 * latest stance applies it. Each canonical definition is looked up the same way and reported; it never gates "present".
 *
 * "Finished" is /setup's rule (src/api/setup/status.js, whose strict pieces this module reuses): the local relay held
 * it, or held none and at least one outside relay answered. The action is `done` when every tagging is finished and
 * present, and `pending` — what the Assistant Alert counts — when at least one finished check found a tagging missing.
 *
 * Read-only: strfry is only scanned, outside relays are only read, and nothing is stored anywhere.
 *
 *   no session          → { success: true, signedIn: false }
 *   no assistant here   → { success: true, signedIn: true, hasAssistant: false, actions: {} }
 *   an assistant        → { success: true, signedIn: true, hasAssistant: true, actions: { 'identification-tags': { … } } }
 *   a throw             → 500 { success: false, error: 'Could not check assistant attention' }
 */

const {
  REQUIRED_TAGGINGS, CANONICAL_TAG_AUTHOR, canonicalTagAddress, taggingDTag, signerAndTarget, readPolarity, polarityBucket,
} = require('../../lib/identification-tags');
const { scanLocalStrict, outsideOnly, RELAY_BUDGET_MS } = require('../setup/status');

const HEX64 = /^[0-9a-f]{64}$/i;

/** The Relay Settings list this instance reads taggings from outside (ADR tag-federation/0001): opt-in, empty by default. */
const TAG_RELAY_CATEGORIES = ['aTagFederationRelays'];

/** The action key in the answer's map, as ui/src/pages/assistant/actions.js names it. */
const IDENTIFICATION_TAGS = 'identification-tags';

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    getAssistantPubkeyFor: (pubkey) => require('../../utils/assistantKeys').getAssistantPubkeyFor(pubkey),
    scanLocal: (filter) => scanLocalStrict(filter),
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
    readConfiguredRelays: (categories) => require('./profilePublish').readConfiguredRelays(categories),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
  };
}

function dTagOf(event) {
  const tags = event && Array.isArray(event.tags) ? event.tags : [];
  const t = tags.find((x) => Array.isArray(x) && x[0] === 'd');
  return t ? t[1] : null;
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
 * The newest event at each of one author's replaceable addresses: this instance's relay first, in one scan; then —
 * only for the addresses it did not hold — the given outside relays, all at once, with only those addresses.
 *
 * @returns {Promise<Object<string, {finished: true, event: Object|null, source: 'local'|'relay'|null}
 *                                 |{finished: false, reason: 'local-unreadable'|'no-outside-relays'|'outside-unreachable'}>>}
 *   one entry per `d`
 */
async function lookupByAddresses({ kind, author, ds, relays }, deps) {
  const out = {};
  const wanted = Array.from(new Set(Array.isArray(ds) ? ds : []));
  const who = String(author || '').toLowerCase();
  const mine = (e) => e && e.kind === kind && String(e.pubkey || '').toLowerCase() === who && wanted.includes(dTagOf(e));

  let local;
  try {
    local = await deps.scanLocal({ kinds: [kind], authors: [author], '#d': wanted });
  } catch {
    for (const d of wanted) out[d] = { finished: false, reason: 'local-unreadable' };
    return out;
  }
  const held = (Array.isArray(local) ? local : []).filter(mine);
  const missing = [];
  for (const d of wanted) {
    const at = held.filter((e) => dTagOf(e) === d);
    if (at.length > 0) out[d] = { finished: true, event: newest(at), source: 'local' };
    else missing.push(d);
  }
  if (missing.length === 0) return out;

  if (!Array.isArray(relays) || relays.length === 0) {
    for (const d of missing) out[d] = { finished: false, reason: 'no-outside-relays' };
    return out;
  }

  const filter = { kinds: [kind], authors: [author], '#d': missing };
  const answers = await Promise.all(relays.map((url) => readWithinBudget(url, filter, deps)));
  const answered = answers.filter((a) => a && a.status === 'ok');
  if (answered.length === 0) {
    for (const d of missing) out[d] = { finished: false, reason: 'outside-unreachable' };
    return out;
  }
  const found = answered.flatMap((a) => (Array.isArray(a.events) ? a.events : [])).filter((e) => mine(e) && missing.includes(dTagOf(e)));
  for (const d of missing) {
    const at = found.filter((e) => dTagOf(e) === d);
    out[d] = at.length > 0 ? { finished: true, event: newest(at), source: 'relay' } : { finished: true, event: null, source: null };
  }
  return out;
}

/** Where taggings are looked for outside: the tag-federation relays, minus this instance's own. */
function tagRelays(deps) {
  return outsideOnly(deps.readConfiguredRelays(TAG_RELAY_CATEGORIES), deps);
}

/**
 * The identification-tags action, from its four taggings' lookups and their definitions'. Pure.
 * @param {{entries: Array<{required: Object, lookup: Object, definition: Object}>}} input
 * @returns {{finished: boolean, done: boolean, pending: boolean, taggings: Object[]}}
 */
function evaluateIdentificationTags({ entries }) {
  const taggings = (Array.isArray(entries) ? entries : []).map(({ required, lookup, definition }) => {
    const row = { key: required.key, name: required.name, slug: required.slug, signer: required.signer, target: required.target };
    if (lookup && lookup.finished) {
      row.present = !!lookup.event && polarityBucket(readPolarity(lookup.event)) === 'apply';
      row.finished = true;
      row.source = lookup.source || null;
    } else {
      row.present = false;
      row.finished = false;
      row.source = null;
      row.reason = lookup && lookup.reason ? lookup.reason : 'outside-unreachable';
    }
    const address = required.address || canonicalTagAddress(required.slug);
    if (definition && definition.finished) {
      row.definition = { finished: true, found: !!definition.event, source: definition.source || null, eventId: definition.event ? definition.event.id : null, address };
    } else {
      row.definition = { finished: false, found: null, source: null, reason: definition && definition.reason ? definition.reason : 'outside-unreachable', eventId: null, address };
    }
    return row;
  });
  const finished = taggings.every((t) => t.finished);
  const done = finished && taggings.every((t) => t.present);
  const pending = taggings.some((t) => t.finished && !t.present);
  return { finished, done, pending, taggings };
}

/** The four taggings and their definitions, looked up by address in at most three local scans, then evaluated. */
async function checkIdentificationTags({ viewer, assistantPubkey }, deps) {
  const relays = tagRelays(deps);
  const plan = REQUIRED_TAGGINGS.map((required) => {
    const { signerPubkey, targetPubkey } = signerAndTarget(required, { personPubkey: viewer, assistantPubkey });
    return { required, signerPubkey, d: taggingDTag({ slug: required.slug, targetPubkey, signerPubkey }) };
  });
  const bySigner = new Map();
  for (const p of plan) {
    if (!bySigner.has(p.signerPubkey)) bySigner.set(p.signerPubkey, []);
    bySigner.get(p.signerPubkey).push(p.d);
  }
  const [signerResults, definitions] = await Promise.all([
    Promise.all([...bySigner.entries()].map(async ([author, ds]) => [author, await lookupByAddresses({ kind: 39999, author, ds, relays }, deps)])),
    lookupByAddresses({ kind: 39999, author: CANONICAL_TAG_AUTHOR, ds: REQUIRED_TAGGINGS.map((r) => r.slug), relays }, deps),
  ]);
  const lookups = new Map(signerResults);
  const entries = plan.map((p) => ({ required: p.required, lookup: lookups.get(p.signerPubkey)[p.d], definition: definitions[p.required.slug] }));
  return evaluateIdentificationTags({ entries });
}

async function handleAssistantAttention(req, res, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const session = req && req.session;
  const viewer = session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
    ? session.pubkey.toLowerCase()
    : null;
  if (!viewer) return res.json({ success: true, signedIn: false });

  try {
    const answered = await d.getAssistantPubkeyFor(viewer);
    const assistantPubkey = typeof answered === 'string' && HEX64.test(answered) ? answered.toLowerCase() : null;
    if (!assistantPubkey) return res.json({ success: true, signedIn: true, hasAssistant: false, actions: {} });
    const identificationTags = await checkIdentificationTags({ viewer, assistantPubkey }, d);
    return res.json({ success: true, signedIn: true, hasAssistant: true, actions: { [IDENTIFICATION_TAGS]: identificationTags } });
  } catch (err) {
    console.error('[assistant/attention] could not check assistant attention:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Could not check assistant attention' });
  }
}

module.exports = {
  handleAssistantAttention,
  lookupByAddresses,
  checkIdentificationTags,
  evaluateIdentificationTags,
  tagRelays,
  TAG_RELAY_CATEGORIES,
  IDENTIFICATION_TAGS,
};
