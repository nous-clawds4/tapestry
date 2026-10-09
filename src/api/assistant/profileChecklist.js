/**
 * The profile check — which items of the signed-in viewer's Assistant's profile need attention
 * (assistant-profile-checklist #1, ADR assistant-profile-checklist/0001).
 *
 * One part of the one attention answer (GET /api/assistant/attention): src/api/assistant/attention.js calls
 * checkProfile for the session's own Assistant beside the identification-tags check, and the hub, the Assistant Alert
 * and the /assistant/profile page all read what it answers. The seven items and their order are the shared list
 * (src/lib/assistant-profile-items); the background image is listed and never checked.
 *
 * The profile is the Assistant's newest kind 0, found the way every setup surface finds it (ADR assistant-profile/0001:
 * this instance's relay first, then the publish relays), with a STRICT local scan, so a relay that cannot be read is
 * "profile-unreadable", never "no profile". The rules that need the outside — the NIP-05, looked up the way any nostr
 * client would (lookupNip05, through the SSRF guard), and the outside publish relays' copies — run in parallel, each
 * within its own budget; everything else reads the profile alone. "Branded to / hosted by this instance" always means
 * this instance's own domain, read at runtime (describeInstance), never a literal.
 *
 * Read-only: nothing is signed, published or stored here (the resolver's existing copy-home of a profile found only on a
 * publish relay is its own, ADR assistant-profile/0001). No request parameter is read: the caller hands in the
 * Assistant's pubkey from the session.
 *
 * Dependencies are injectable the attention.js way (`{ ...defaultDeps(), ...deps }`), with the heavy modules required
 * lazily, so the module loads in a bare checkout and every rule runs stack-free.
 */

const { PROFILE_ITEMS, COMPOSITE_AVATAR_FILE_RE } = require('../../lib/assistant-profile-items');
const { REFERENCE_TA_AVATAR_URL } = require('./profileDefaults');

/** How long each outside publish relay gets to answer — the budget every profile surface uses (profileState.js). */
const PROFILE_RELAY_BUDGET_MS = 4000;

const NIP05_RE = /^([^@\s]+)@([^@\s]+)$/;

function defaultDeps() {
  return {
    describeInstance: () => require('./profileDefaults').describeInstance(),
    resolveAssistantProfileState: (options) => require('./profileState').resolveAssistantProfileState(options),
    getAssistantPublishRelays: () => require('./profilePublish').getAssistantPublishRelays(),
    getConfiguredPublishRelays: () => require('./profilePublish').getConfiguredPublishRelays(),
    isLocalOnly: () => require('../publish-policy').isPublishLocalOnly(),
    scanLocalStrict: (filter) => require('../setup/status').scanLocalStrict(filter),
    outsideOnly: (urls, d) => require('../setup/status').outsideOnly(urls, d),
    lookupNip05: (address) => require('../nip05').lookupNip05(address),
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
    hasStoredAvatar: (file) => require('./avatar').hasStoredAvatar(file),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
  };
}

const lower = (s) => String(s || '').toLowerCase();
const text = (v) => (typeof v === 'string' ? v.trim() : '');

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

/** The resolver's local scan, made strict: a failed strfry scan rejects instead of reading as "no profile". */
function strictNewestKind0(d) {
  return async (pubkey) => {
    const events = await d.scanLocalStrict({ kinds: [0], authors: [pubkey] });
    const mine = (Array.isArray(events) ? events : []).filter((e) => e && e.kind === 0 && lower(e.pubkey) === lower(pubkey));
    return newest(mine);
  };
}

function parseContent(event) {
  try {
    const content = JSON.parse(event.content);
    return content && typeof content === 'object' && !Array.isArray(content) ? content : {};
  } catch {
    return {};
  }
}

/** The host of a NIP-05 identifier, lowercased, or null when it is not one. */
function nip05Host(value) {
  const m = text(value).match(NIP05_RE);
  return m ? m[2].toLowerCase() : null;
}

/**
 * The composite's bare file name when `picture` is a stamped avatar this instance hosts — https, this instance's own
 * origin, /generated/<a composite file name>, nothing after it — else null.
 */
function compositeFileOf(picture, instance) {
  const value = text(picture);
  if (!value || !instance || !instance.website) return null;
  let url;
  let site;
  try { url = new URL(value); site = new URL(instance.website); } catch { return null; }
  if (url.protocol !== 'https:' || url.origin !== site.origin) return null;
  if (url.search || url.hash || url.username || url.password) return null;
  const m = url.pathname.match(/^\/generated\/([^/]+)$/);
  return m && COMPOSITE_AVATAR_FILE_RE.test(m[1]) ? m[1] : null;
}

/** One relay read, given up at `ms`. A throw or a timeout is not an answer. */
async function readWithin(url, filter, d, ms) {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve().then(() => d.readRelay(url, filter)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('relay budget spent')), ms); }),
    ]);
  } catch (err) {
    return { status: 'unreachable', events: [], error: err && err.message ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Where the Assistant's profile is outside this instance: each outside publish relay asked once, all at once, each
 * within PROFILE_RELAY_BUDGET_MS. Holding = it answered with the Assistant's kind 0 at least as new as this profile.
 * @returns {Promise<{ mode: 'local-only-mode'|'no-relays'|'read', total: number, answered: number, holding: number }>}
 */
async function readVisibility({ assistantPubkey, profileCreatedAt }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  if (d.isLocalOnly()) return { mode: 'local-only-mode', total: 0, answered: 0, holding: 0 };
  const relays = d.outsideOnly(d.getConfiguredPublishRelays(), d);
  if (!Array.isArray(relays) || relays.length === 0) return { mode: 'no-relays', total: 0, answered: 0, holding: 0 };
  const filter = { kinds: [0], authors: [assistantPubkey] };
  const answers = await Promise.all(relays.map((url) => readWithin(url, filter, d, PROFILE_RELAY_BUDGET_MS)));
  const answered = answers.filter((a) => a && a.status === 'ok');
  const since = Number(profileCreatedAt) || 0;
  const holding = answered.filter((a) => (Array.isArray(a.events) ? a.events : [])
    .some((e) => e && e.kind === 0 && lower(e.pubkey) === lower(assistantPubkey) && Number(e.created_at) >= since)).length;
  return { mode: 'read', total: relays.length, answered: answered.length, holding };
}

/** A row: the item's key, whether it counts, and its state. */
function row(item, finished, done, reason, detail = {}) {
  return { key: item.key, counts: item.counts, finished, done, reason: done ? null : reason, ...detail };
}

/** Each counted item's rule, given a readable profile (ADR 0001 sub-decision 3). */
const RULES = {
  avatar(item, { content, instance, avatarStored }) {
    const picture = text(content.picture);
    const detail = { picture: picture || null };
    if (!instance.isPublic) return row(item, true, false, 'no-public-address', detail);
    if (!picture) return row(item, true, false, 'no-picture', detail);
    if (compositeFileOf(picture, instance)) return row(item, true, avatarStored === true, 'missing-file', detail);
    if (picture === instance.avatarUrl || picture === REFERENCE_TA_AVATAR_URL) return row(item, true, false, 'standard-image', detail);
    return row(item, true, false, 'not-personalized', detail);
  },

  nip05(item, { content, instance, assistantPubkey, nip05 }) {
    const address = text(content.nip05);
    const detail = { address: address || null };
    if (!instance.isPublic) return row(item, true, false, 'no-public-address', detail);
    if (!address) return row(item, true, false, 'none', detail);
    if (nip05Host(address) !== lower(instance.domain)) return row(item, true, false, 'other-domain', detail);
    if (!nip05 || nip05.outcome === 'unreachable') return row(item, false, false, 'unreachable', detail);
    if (nip05.outcome === 'malformed') return row(item, true, false, 'other-domain', detail);
    const listed = nip05.outcome === 'answered' && typeof nip05.pubkey === 'string' && lower(nip05.pubkey) === lower(assistantPubkey);
    return row(item, true, listed, 'not-listed', detail);
  },

  website(item, { content, instance }) {
    const value = text(content.website);
    const detail = { value: value || null, expected: instance.website || '' };
    if (!instance.isPublic) return row(item, true, false, 'no-public-address', detail);
    if (!value) return row(item, true, false, 'none', detail);
    let url;
    let site;
    try { url = new URL(value); site = new URL(instance.website); } catch { return row(item, true, false, 'other', detail); }
    const same = url.protocol === 'https:' && url.host === site.host && url.pathname === '/'
      && !url.search && !url.hash && !url.username && !url.password;
    return row(item, true, same, 'other', detail);
  },

  'name-and-about'(item, { content }) {
    const hasName = Boolean(text(content.name) || text(content.display_name));
    const hasAbout = Boolean(text(content.about));
    const reason = !hasName && !hasAbout ? 'no-name-no-about' : !hasName ? 'no-name' : 'no-about';
    return row(item, true, hasName && hasAbout, reason, { hasName, hasAbout });
  },

  'client-tag'(item, { event, instance }) {
    const detail = { expected: instance.domain || '' };
    if (!instance.isPublic) return row(item, true, false, 'no-public-address', detail);
    const tags = Array.isArray(event.tags) ? event.tags : [];
    const tagged = tags.some((t) => Array.isArray(t) && t[0] === 'client' && typeof t[1] === 'string' && lower(t[1]) === lower(instance.domain));
    return row(item, true, tagged, 'none', detail);
  },

  visible(item, { visibility }) {
    const v = visibility || {};
    const detail = { relaysTotal: v.total || 0, relaysAnswered: v.answered || 0, relaysHolding: v.holding || 0 };
    if (v.mode === 'local-only-mode') return row(item, true, false, 'local-only-mode', detail);
    if (v.mode === 'no-relays') return row(item, true, false, 'no-relays', detail);
    if (!v.answered) return row(item, false, false, 'unreachable', detail);
    return row(item, true, v.holding > 0, 'only-here', detail);
  },
};

/**
 * The action, from what was found. Pure.
 *   { unreadable: true, instance }                  — the local relay could not be read: every counted item unfinished
 *   { event: null, instance }                       — no profile anywhere: every counted item needs attention
 *   { event, content, instance, assistantPubkey, nip05, visibility, avatarStored }
 * @returns {{ finished, done, pending, hasProfile, instance: { domain, website, isPublic }, items: Object[] }}
 */
function evaluateProfileItems(input = {}) {
  const raw = input.instance || {};
  const instance = { domain: raw.domain || '', website: raw.website || '', isPublic: raw.isPublic === true, avatarUrl: raw.avatarUrl || '' };
  const content = input.content || (input.event ? parseContent(input.event) : {});
  const items = PROFILE_ITEMS.map((item) => {
    if (!item.counts) return { key: item.key, counts: false, finished: false, done: false, reason: 'not-checked' };
    if (input.unreadable) return row(item, false, false, 'profile-unreadable');
    if (!input.event) return row(item, true, false, 'no-profile');
    return RULES[item.key](item, { ...input, content, instance });
  });
  const counted = items.filter((r) => r.counts);
  const finished = counted.every((r) => r.finished);
  const done = finished && counted.every((r) => r.done);
  const pending = counted.some((r) => r.finished && !r.done);
  return {
    finished,
    done,
    pending,
    hasProfile: input.unreadable ? null : Boolean(input.event),
    instance: { domain: instance.domain, website: instance.website, isPublic: instance.isPublic },
    items,
  };
}

/**
 * The profile action for one Assistant — the session's own; the caller resolves whose.
 * @param {{ assistantPubkey: string }} input
 */
async function checkProfile({ assistantPubkey }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const instance = d.describeInstance();

  let state;
  try {
    state = await d.resolveAssistantProfileState({
      assistantPubkey,
      allowRelayFallback: true,
      getPublishRelays: () => d.getAssistantPublishRelays(),
      deps: { scanLocalKind0: strictNewestKind0(d) },
    });
  } catch {
    return evaluateProfileItems({ unreadable: true, instance });
  }
  const event = state && state.hasProfile && state.event ? state.event : null;
  if (!event) return evaluateProfileItems({ event: null, instance });

  const content = parseContent(event);
  const onThisDomain = instance.isPublic && nip05Host(content.nip05) === lower(instance.domain);
  const avatarFile = instance.isPublic ? compositeFileOf(content.picture, instance) : null;
  const [nip05, visibility] = await Promise.all([
    onThisDomain
      ? Promise.resolve().then(() => d.lookupNip05(text(content.nip05))).catch(() => ({ outcome: 'unreachable', pubkey: null }))
      : null,
    readVisibility({ assistantPubkey, profileCreatedAt: event.created_at }, d),
  ]);
  const avatarStored = avatarFile ? Boolean(d.hasStoredAvatar(avatarFile)) : false;
  return evaluateProfileItems({ event, content, instance, assistantPubkey, nip05, visibility, avatarStored });
}

module.exports = {
  checkProfile,
  evaluateProfileItems,
  readVisibility,
  PROFILE_RELAY_BUDGET_MS,
};
