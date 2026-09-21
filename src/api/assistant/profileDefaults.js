/**
 * One default profile for every assistant — assistant-profile #3, ADR 0003.
 *
 * The owner specified the default on 2026-09-11 (story assistant-profile #3). This module is the only
 * place it is defined, and it knows nothing about roles: an Owner's, an Admin's and a Customer's
 * assistant get the same table, differing only in the person's name and npub. It holds:
 *
 *   - the public-instance rule (describeInstance), composed from the SSRF guard's classifiers so the
 *     app has one notion of "a stranger could reach this" (OPEN.md row 148);
 *   - the person's name (resolvePersonName): the local relay first, then the instance's profile relays;
 *   - the definition itself (buildDefaultProfile), pure;
 *   - the finishing step every published assistant profile passes through (finalizeAssistantProfile):
 *     the server-managed NIP-05 and the ["client", ‹domain›] tag on a public instance, neither off it.
 *
 * Dependencies are injectable the feedReadPath way (`options.deps?.X ?? options.X ?? realX`), and the
 * real helpers are required lazily inside their functions, so this module loads in a bare checkout.
 */

const net = require('net');
const { isPublicAddress, hasPrivateHostSuffix } = require('../../utils/ssrfGuard');

/** A public instance serves the branded avatar at this path (ADR ta-avatar/0002). */
const TA_AVATAR_PATH = '/ta-avatar.png';

/**
 * The reference deployment's copy of the branded avatar — the picture an instance that is not public
 * proposes, because its own copy is unreachable for everyone else (story, open question 1). The only
 * deployment URL written into this code.
 */
const REFERENCE_TA_AVATAR_URL = 'https://tapestry.brainstorm.world/ta-avatar.png';

/** How long a profile-relay answer about a person's name is remembered, found or not. */
const NAME_MEMO_MS = 10 * 60 * 1000;

// person pubkey → { name, at } from the profile relays. A name found on the local relay is not
// remembered: that read is cheap, and it is always asked first.
const nameMemo = new Map();

/** The owner's words, verbatim — the story's second quoted paragraph. */
const ABOUT_SECOND_PARAGRAPH = 'I use social proof, such as decentralized lists, tags, follows, mutes, reports, and more, '
  + 'to curate data for my owner and publish it in a variety of formats including kind 3038x Trusted Assertions, '
  + 'kind 3039x Trusted Lists, and kind 39999 items on decentralized lists. This means that my owner\'s '
  + 'personalized trust metrics are available to any client that supports NIP-85 and related custom NIPs '
  + 'including Decentralized Lists and Trusted Lists.';

// ─── The instance ───────────────────────────────────────────────────────────────

/**
 * Is `host` a name or address a stranger's nostr client could reach? Syntactic and synchronous — no
 * DNS (ADR 0003 sub-decision 1): the same configuration always gives the same answer, and a resolver
 * hiccup can never strip the NIP-05 from a published profile.
 */
function isPublicHost(host) {
  let h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (!h) return false;
  return net.isIP(h) ? isPublicAddress(h) : !hasPrivateHostSuffix(h);
}

/** Is the configured domain — possibly carrying a port, e.g. `localhost:7777` — a public instance? */
function isPublicDomain(domain) {
  let hostname;
  try {
    hostname = new URL(`https://${String(domain || '').trim()}`).hostname;
  } catch {
    return false;
  }
  return isPublicHost(hostname);
}

/**
 * The instance's domain: STRFRY_DOMAIN, else BRAINSTORM_RELAY_URL's host, else "localhost".
 * Returns e.g. "tapestry.brainstorm.world", or "localhost:7777" on a dev box.
 */
function getInstanceDomain(options = {}) {
  const getConfigFromFile = options.deps?.getConfigFromFile ?? options.getConfigFromFile ?? realGetConfigFromFile;
  const domain = getConfigFromFile('STRFRY_DOMAIN', '');
  if (domain && domain !== 'localhost') return domain;
  const relayUrl = getConfigFromFile('BRAINSTORM_RELAY_URL', '');
  if (relayUrl) {
    const host = relayUrl.replace(/^wss?:\/\//, '').replace(/\/.*$/, '');
    if (host) return host;
  }
  return 'localhost';
}

/**
 * Everything the default and the finishing step need to know about this instance.
 * @returns {{ domain: string, isPublic: boolean, website: string, avatarUrl: string }}
 */
function describeInstance(options = {}) {
  const domain = getInstanceDomain(options);
  const isPublic = isPublicDomain(domain);
  return {
    domain,
    isPublic,
    website: isPublic ? `https://${domain}` : '',
    avatarUrl: isPublic ? `https://${domain}${TA_AVATAR_PATH}` : REFERENCE_TA_AVATAR_URL,
  };
}

// ─── The person's name ──────────────────────────────────────────────────────────

/** A kind 0's display_name, else its name — whitespace tidied — or '' when it has neither. */
function nameFromProfileEvent(event) {
  if (!event) return '';
  let content;
  try { content = JSON.parse(event.content); } catch { return ''; }
  if (!content || typeof content !== 'object') return '';
  for (const key of ['display_name', 'name']) {
    const value = typeof content[key] === 'string' ? content[key].replace(/\s+/g, ' ').trim() : '';
    if (value) return value;
  }
  return '';
}

/**
 * The person's name, from their own nostr profile.
 *
 * The local relay answers first (BIBLE §30), and a name there needs no relay traffic. Otherwise the
 * instance's profile relays are asked — only for a caller ADR 0001 already lets reach relays — and the
 * person's newest kind 0 among what they return and the local one decides. Nothing is copied into the
 * local relay: the person's profile is their letter, not this instance's.
 *
 * @param {Object} options
 * @param {string} options.personPubkey - hex pubkey of the person whose assistant this is
 * @param {boolean} [options.allowRelayLookup=false] - may the profile relays be asked?
 * @param {Object} [options.deps] - injectable: scanLocalKind0, queryRelaysKind0, getProfileRelays, now,
 *   memo (each also accepted directly on `options`).
 * @returns {Promise<{ name: string, source: 'local'|'relay'|null }>}
 */
async function resolvePersonName(options = {}) {
  const { personPubkey, allowRelayLookup = false, deps } = options;
  const scanLocalKind0 = deps?.scanLocalKind0 ?? options.scanLocalKind0 ?? realScanLocalKind0;
  const queryRelaysKind0 = deps?.queryRelaysKind0 ?? options.queryRelaysKind0 ?? realQueryRelaysKind0;
  const getProfileRelays = deps?.getProfileRelays ?? options.getProfileRelays ?? realGetProfileRelays;
  const now = deps?.now ?? options.now ?? Date.now;
  const memo = deps?.memo ?? options.memo ?? nameMemo;
  const { RELAY_BUDGET_MS, BACKSTOP_MS, withinBudget } = require('./profileState');

  // 1. The local relay.
  let local = null;
  try { local = await scanLocalKind0(personPubkey); } catch { local = null; }
  const localName = nameFromProfileEvent(local);
  if (localName) return { name: localName, source: 'local' };

  // 2. An anonymous caller gets the local answer only.
  if (!allowRelayLookup) return { name: '', source: null };

  // 3. A recent relay answer is remembered, found or not.
  const remembered = memo.get(personPubkey);
  if (remembered && now() - remembered.at < NAME_MEMO_MS) {
    return { name: remembered.name, source: remembered.name ? 'relay' : null };
  }

  // 4. The profile relays, within ADR 0001's budget; the backstop only catches a helper that hangs.
  //    A failure or a timeout is "no name".
  let events = [];
  try {
    const found = await withinBudget(
      Promise.resolve().then(() => queryRelaysKind0(getProfileRelays(), personPubkey, { maxWait: RELAY_BUDGET_MS })),
      BACKSTOP_MS,
      [],
    );
    events = Array.isArray(found) ? found : [];
  } catch (err) {
    console.warn(`[assistant] profile-relay name lookup failed for ${String(personPubkey).slice(0, 8)}: ${err.message}`);
  }
  // The person's newest profile decides — so a newer one with no name is not overruled by an older copy
  // that has one.
  const candidates = events.filter((e) => e && e.kind === 0 && e.pubkey === personPubkey);
  if (local) candidates.push(local);
  const newest = candidates.reduce((best, e) => (!best || e.created_at > best.created_at ? e : best), null);
  const name = nameFromProfileEvent(newest);

  // 5. Remember the answer.
  memo.set(personPubkey, { name, at: now() });
  return { name, source: name ? 'relay' : null };
}

/** The handlers' dependency: the person's name, or '' when they have none. */
async function getPersonName(pubkey, { allowRelayLookup = false } = {}) {
  return (await resolvePersonName({ personPubkey: pubkey, allowRelayLookup })).name;
}

// ─── The one definition ─────────────────────────────────────────────────────────

/** The person's full npub. */
function personNpub(pubkey) {
  return require('nostr-tools').nip19.npubEncode(pubkey);
}

/** The owner's about text: "‹name› (‹npub›)" with a name, the npub alone without one. */
function defaultAbout(personName, npub) {
  const whom = personName ? `${personName} (${npub})` : npub;
  return `I am the Tapestry Assistant for ${whom}. You can find my pubkey in my owner's kind 10040 event.`
    + `\n\n${ABOUT_SECOND_PARAGRAPH}`;
}

/**
 * The default profile for a person's assistant — the story's table. Pure, and there is no role to pass:
 * every role gets this same definition.
 * @returns {{ name, display_name, about, picture, banner, website, nip05, lud16 }} every value a string
 */
function buildDefaultProfile({ personPubkey, personName, instance }) {
  const npub = personNpub(personPubkey);
  const assistantName = `${personName || `npub...${npub.slice(-6)}`}'s Tapestry Assistant`;
  return {
    name: assistantName,
    display_name: assistantName,
    about: defaultAbout(personName, npub),
    picture: instance.avatarUrl,
    banner: '',
    website: instance.website,
    nip05: '',
    lud16: '',
  };
}

/**
 * What every published assistant profile — default or edited — becomes before it is signed. NIP-05 is
 * server-managed: whatever the content arrived with is dropped, and a public instance sets its own and
 * tags the event with the ["client", ‹domain›] it was published from. Empty fields are left out.
 * @returns {{ content: Object, tags: string[][] }}
 */
function finalizeAssistantProfile({ content, instance, nip05LocalPart }) {
  const finished = {};
  for (const [key, value] of Object.entries(content || {})) {
    if (key === 'nip05' || value === '') continue;
    finished[key] = value;
  }
  if (instance.isPublic) finished.nip05 = `${nip05LocalPart}@${instance.domain}`;
  return { content: finished, tags: instance.isPublic ? [['client', instance.domain]] : [] };
}

// ─── Real helpers (used when no deps are injected) ──────────────────────────────

function realGetConfigFromFile(name, fallback) {
  return require('../../utils/config').getConfigFromFile(name, fallback);
}

function realScanLocalKind0(pubkey) {
  return require('./profileState').scanLocalKind0(pubkey);
}

function realQueryRelaysKind0(relays, pubkey, options) {
  return require('./profileState').queryRelaysKind0(relays, pubkey, options);
}

/** The instance's profile relays, parsed by the one relay-settings reader (ADR 0002). */
function realGetProfileRelays() {
  return require('./profilePublish').readConfiguredRelays(['aProfileRelays']);
}

module.exports = {
  TA_AVATAR_PATH,
  REFERENCE_TA_AVATAR_URL,
  NAME_MEMO_MS,
  isPublicHost,
  isPublicDomain,
  getInstanceDomain,
  describeInstance,
  nameFromProfileEvent,
  resolvePersonName,
  getPersonName,
  personNpub,
  defaultAbout,
  buildDefaultProfile,
  finalizeAssistantProfile,
};
