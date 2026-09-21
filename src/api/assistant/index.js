/**
 * Brainstorm Assistant API
 *
 * Endpoints for managing an assistant's kind 0 nostr profile. The "assistant"
 * is a server-side nostr identity:
 *   - For the owner: the Tapestry Assistant (TA) key.
 *   - For a customer: their Customer Relay Key.
 *
 * The key is selected by getAssistantKeys(pubkey). The kind 0 event is signed
 * server-side with that key, written to local strfry, and then sent to the relays
 * getAssistantPublishRelays() names — the instance's configured general-purpose,
 * profile and WoT relays (ADR assistant-profile/0002), which is the same list
 * /api/assistant/status consults when the local relay has no profile (ADR 0001).
 *
 * POST /api/assistant/publish-profile accepts an optional `content` object so
 * the caller can pass user-edited fields; when omitted, the one default profile
 * is used (./profileDefaults.js, ADR assistant-profile/0003). Either way the
 * profile passes the same finishing step before it is signed.
 */

const nostrTools = require('nostr-tools');
const { getAssistantKeys } = require('../../utils/assistantKeys');
const { getConfigFromFile, getAdminPubkeys } = require('../../utils/config');
const { SecureKeyStorage } = require('../../utils/secureKeyStorage');
const { getSettings, updateOverrides, resetOverride } = require('../../config/settings');
const { resolveAssistantProfileState, importToLocalRelay } = require('./profileState');
const {
  getConfiguredPublishRelays, getAssistantPublishRelays, publishToRelays,
  publishSubject, summarizePublish, localFailureMessage,
} = require('./profilePublish');
const { isPublishLocalOnly } = require('../publish-policy');
const { handleGetAssistantRoster } = require('./roster');
const {
  describeInstance, isPublicHost, getPersonName, buildDefaultProfile, finalizeAssistantProfile,
} = require('./profileDefaults');

// NIP-05 (`nip05`) is server-computed and deterministic — see
// computeAssistantLocalPart — so we intentionally exclude it from the list
// of user-editable kind 0 fields. If a client sends one, sanitizeProfileContent
// drops it; the publish handler always sets nip05 itself.
const PROFILE_FIELDS = ['name', 'display_name', 'about', 'picture', 'banner', 'website', 'lud16'];

/**
 * The instance's https website — e.g. "https://tapestry.brainstorm.world" — or '' when the instance is
 * not public, so a dev box never offers https://localhost:7777 (ADR assistant-profile/0003).
 */
function getInstanceWebsite() {
  return describeInstance().website;
}

/**
 * Could a stranger's nostr client actually fetch something from `website`?
 *
 * One rule for the whole app: the story's "public instance" test (./profileDefaults.js), built on the
 * SSRF guard's classifiers, so loopback, private-network and private-name addresses all fail — the gap
 * OPEN.md row 148 recorded. ./avatar.js gates the badged avatar's publishable URL on this.
 */
function isPubliclyReachable(website) {
  if (!website) return false;
  let hostname;
  try { hostname = new URL(website).hostname; } catch { return false; }
  return isPublicHost(hostname);
}

/**
 * Compute a deterministic NIP-05 local-part for an Assistant.
 *
 * Format: `<sanitized-name>-tapestry-assistant-<6-char-suffix>`
 *   - sanitized-name: lowercase, NIP-05-legal chars only (`[a-z0-9._-]`),
 *     non-legal runs collapsed to `-`, leading/trailing separators stripped,
 *     capped at 32 chars to avoid runaway names. If empty after sanitization,
 *     the whole prefix is dropped — yielding just `tapestry-assistant-<suffix>`.
 *   - 6-char-suffix: last 6 hex chars of the assistant pubkey.
 *
 * Determinism: same caller name + same assistant pubkey → same local-part.
 * Uniqueness: 16M possible suffixes; collisions are vanishingly unlikely at
 * Brainstorm's user-base size. "Last writer wins" if it ever happens.
 */
function computeAssistantLocalPart(callerName, assistantPubkey) {
  const suffix = String(assistantPubkey || '').slice(-6).toLowerCase();
  const sanitized = String(callerName || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[-._]{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 32)
    .replace(/[-._]+$/, '');
  return sanitized
    ? `${sanitized}-tapestry-assistant-${suffix}`
    : `tapestry-assistant-${suffix}`;
}

/**
 * Update the settings-backed NIP-05 names map to point `localPart` at
 * `assistantPubkey`, removing any prior entries that pointed at the same
 * pubkey under a different local-part. This is what keeps
 * `/.well-known/nostr.json` consistent with the latest published Assistant
 * profile (handled by src/api/nip05.js).
 */
function updateNip05Mapping(localPart, assistantPubkey) {
  const settings = getSettings();
  const existingNames = (settings.nip05 && settings.nip05.names) || {};
  for (const [key, val] of Object.entries(existingNames)) {
    if (val === assistantPubkey && key !== localPart) {
      try { resetOverride(`nip05.names.${key}`); } catch (e) { console.warn(`[assistant] could not remove old nip05 mapping "${key}":`, e.message); }
    }
  }
  updateOverrides({ nip05: { names: { [localPart]: assistantPubkey } } });
}

/**
 * The default profile for `personPubkey`'s assistant — the one definition (./profileDefaults.js), for
 * every role. `options.personName` and `options.instance` are used as given; otherwise the name is looked
 * up (the local relay, and the profile relays only when `options.allowRelayLookup` is true) and the
 * instance is read from its configuration.
 */
async function buildDefaultProfileContent(personPubkey, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const personName = typeof opts.personName === 'string'
    ? opts.personName
    : await getPersonName(personPubkey, { allowRelayLookup: Boolean(opts.allowRelayLookup) });
  const instance = opts.instance || describeInstance();
  return buildDefaultProfile({ personPubkey, personName, instance });
}

/**
 * Strip any keys outside the allowed kind 0 fields and coerce values to strings.
 */
function sanitizeProfileContent(content) {
  const clean = {};
  for (const key of PROFILE_FIELDS) {
    const value = content?.[key];
    if (typeof value === 'string') {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * POST /api/assistant/publish-profile
 * Body: {
 *   customerPubkey: "hex",          // pubkey whose assistant we're publishing for
 *   content?: {                      // optional user-edited kind 0 fields
 *     name, display_name, about, picture, banner, website, nip05, lud16
 *   }
 * }
 * If `content` is omitted, the one default profile is published (ADR assistant-profile/0003) — what
 * the legacy pages and the dashboard's "Use the default profile" do.
 *
 * Default or edited, the profile passes finalizeAssistantProfile before it is signed: on a public
 * instance it carries the server-managed NIP-05 and a ["client", ‹domain›] tag, and on any other
 * instance neither.
 *
 * The profile is written to this instance's relay first; only then does it go to the configured
 * publish relays, and the answer says what each of them did (ADR assistant-profile/0002).
 */
function defaultPublishProfileDeps() {
  return {
    getAssistantKeys: (pubkey) => getAssistantKeys(pubkey),
    getOwnerPubkey: () => getConfigFromFile('BRAINSTORM_OWNER_PUBKEY'),
    getPersonName: (pubkey, options) => getPersonName(pubkey, options),
    describeInstance: () => describeInstance(),
    importEvent: (event) => importToLocalRelay(event),
    updateNip05Mapping: (localPart, pubkey) => updateNip05Mapping(localPart, pubkey),
    isLocalOnly: () => isPublishLocalOnly(),
    getSettings: () => getSettings(),
    publishToRelays: (event, relays, options) => publishToRelays(event, relays, options),
    now: () => Date.now(),
  };
}

/**
 * Every side effect behind one seam (the dlist-curation way), so what this handler sends where can be
 * tested without strfry, a key store or a relay.
 */
function createPublishProfileHandler(deps = {}) {
  const d = { ...defaultPublishProfileDeps(), ...deps };

  return async function handlePublishProfile(req, res) {
    try {
      const { customerPubkey, content } = req.body;
      if (!customerPubkey || !/^[0-9a-f]{64}$/.test(customerPubkey)) {
        return res.status(400).json({ success: false, error: 'Valid customerPubkey is required' });
      }

      // Verify caller is the customer or the owner
      const ownerPubkey = d.getOwnerPubkey();
      const isOwner = customerPubkey === ownerPubkey;
      const sessionPubkey = req.session && req.session.pubkey;
      if (sessionPubkey !== customerPubkey && sessionPubkey !== ownerPubkey) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }

      // Whose assistant this is, in the words every line of the answer will use.
      const subject = publishSubject({
        isOwnerTarget: isOwner,
        isSelf: sessionPubkey === customerPubkey,
        targetPubkey: customerPubkey,
      });

      // 1. Get assistant keys (unified: owner → TA key, customer → customer relay key)
      const relayKeys = await d.getAssistantKeys(customerPubkey);
      if (!relayKeys || !relayKeys.privkey) {
        return res.status(400).json({ success: false, error: isOwner ? 'Tapestry Assistant keys not found.' : 'Customer relay keys not found. Set up Trusted Assertions first.' });
      }

      // Convert privkey from nsec or hex to Uint8Array
      let privkeyBytes;
      if (typeof relayKeys.privkey === 'string') {
        if (relayKeys.privkey.startsWith('nsec')) {
          privkeyBytes = nostrTools.nip19.decode(relayKeys.privkey).data;
        } else {
          privkeyBytes = Buffer.from(relayKeys.privkey, 'hex');
        }
      } else {
        privkeyBytes = relayKeys.privkey;
      }

      const assistantPubkey = nostrTools.getPublicKey(privkeyBytes);

      // 2. The content: the user's edits if present, otherwise the one default (ADR assistant-profile/0003),
      //    which is built here and nowhere else — no dependency can stand in for it. The person's name is
      //    needed only for the default or for the NIP-05, which only a public instance publishes; a publish
      //    is always signed in, so the lookup may reach the profile relays.
      const instance = d.describeInstance();
      const hasUserContent = Boolean(content && typeof content === 'object');
      const personName = (!hasUserContent || instance.isPublic)
        ? await d.getPersonName(customerPubkey, { allowRelayLookup: true })
        : '';
      const draft = hasUserContent
        ? sanitizeProfileContent(content)
        : buildDefaultProfile({ personPubkey: customerPubkey, personName, instance });

      // 2a. NIP-05 is server-managed: the deterministic local-part from the person's name and the
      //     assistant's pubkey. The finishing step sets it — with the client tag — on a public instance
      //     only, and drops empty fields.
      const localPart = computeAssistantLocalPart(personName, assistantPubkey);
      const { domain } = instance;
      const finished = finalizeAssistantProfile({ content: draft, instance, nip05LocalPart: localPart });
      const profileContent = finished.content;

      const assistantName = profileContent.display_name || profileContent.name || 'Assistant';

      const event = {
        kind: 0,
        pubkey: assistantPubkey,
        created_at: Math.floor(d.now() / 1000),
        tags: finished.tags,
        content: JSON.stringify(profileContent),
      };

      // 3. Sign with assistant's private key
      const signedEvent = nostrTools.finalizeEvent(event, privkeyBytes);
      console.log(`[assistant] Kind 0 event signed: ${signedEvent.id.slice(0, 16)}...`);

      const localOnly = Boolean(d.isLocalOnly());

      // 4. This instance's relay first (BIBLE §30). If it refuses the profile, nothing goes outward.
      try {
        await d.importEvent(signedEvent);
      } catch (err) {
        console.error(`[assistant] local write failed for ${assistantPubkey.slice(0, 8)}: ${err.message}`);
        return res.status(500).json({
          success: false,
          stage: 'local',
          localOnly,
          error: localFailureMessage(subject, err.message),
          relays: { total: 0, success: 0, results: [] },
        });
      }
      console.log(`[assistant] Kind 0 published to strfry for ${assistantPubkey.slice(0, 8)}`);

      // 4b. Keep .well-known/nostr.json in sync. Done after the strfry publish so
      // a publish failure doesn't leave a NIP-05 record pointing at a kind 0
      // that isn't actually published. Only a public instance publishes a NIP-05,
      // so only a public instance has one to attest; an existing entry is left alone.
      if (instance.isPublic) {
        try {
          d.updateNip05Mapping(localPart, assistantPubkey);
          console.log(`[assistant] NIP-05 mapping ${localPart} → ${assistantPubkey.slice(0, 8)} written`);
        } catch (err) {
          console.warn('[assistant] NIP-05 mapping update failed (kind 0 already published):', err.message);
        }
      }

      // 5. The relays this instance is configured to publish to — each reported as it answered.
      const relayOptions = { deps: { getSettings: d.getSettings } };
      const publishRelays = getAssistantPublishRelays({ localOnly, ...relayOptions });
      const configuredRelays = localOnly ? getConfiguredPublishRelays(relayOptions) : publishRelays;
      const results = localOnly
        ? configuredRelays.map((relay) => ({ relay, status: 'skipped', reason: 'local-only publish mode' }))
        : await d.publishToRelays(signedEvent, publishRelays);
      const { outcome, message, accepted } = summarizePublish({ subject, rows: results, localOnly });

      console.log(`[assistant] ${outcome}: ${message}`);
      for (const row of results) {
        if (row.status !== 'accepted') {
          console.warn(`[assistant] ${row.relay} — ${row.status}${row.reason ? `: ${row.reason}` : ''}`);
        }
      }

      return res.json({
        success: true,
        event: signedEvent,
        assistantPubkey,
        assistantName,
        nip05: instance.isPublic ? { localPart, domain, address: `${localPart}@${domain}` } : null,
        localOnly,
        outcome,
        relays: { total: results.length, success: accepted, results },
        message,
      });

    } catch (err) {
      console.error(`[assistant] Error publishing profile:`, err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };
}

const handlePublishProfile = createPublishProfileHandler();

/**
 * GET /api/assistant/status
 * Query: ?customerPubkey=hex[&defaults=0]
 * Returns the assistant's pubkey, whether its profile is published (ADR assistant-profile/0001), and —
 * unless the caller sent defaults=0 — the default profile the editor prefills and resets to, with the
 * NIP-05 a publish would carry (ADR assistant-profile/0003). The dashboard's setup check sends
 * defaults=0: it never reads them, and the person's name may need a relay round-trip.
 */
function defaultStatusDeps() {
  return {
    getOwnerPubkey: () => getConfigFromFile('BRAINSTORM_OWNER_PUBKEY'),
    getAdminPubkeys: () => getAdminPubkeys(),
    getAssistantKeys: (pubkey) => getAssistantKeys(pubkey),
    getPersonName: (pubkey, options) => getPersonName(pubkey, options),
    describeInstance: () => describeInstance(),
    resolveAssistantProfileState: (options) => resolveAssistantProfileState(options),
  };
}

/**
 * The same seam as the publish handler's, so what each role is offered can be tested without a key
 * store, strfry or a relay. The publish list is not a dependency: it is passed to the setup check as
 * getAssistantPublishRelays itself, the one list publishing and checking share (ADR 0003 Amendment 1).
 */
function createAssistantStatusHandler(deps = {}) {
  const d = { ...defaultStatusDeps(), ...deps };

  return async function handleAssistantStatus(req, res) {
    try {
      const { customerPubkey } = req.query;
      // The defaults are built from the person's npub, which only a real pubkey has.
      if (!customerPubkey || !/^[0-9a-f]{64}$/.test(customerPubkey)) {
        return res.status(400).json({ success: false, error: 'Valid customerPubkey is required' });
      }
      const wantDefaults = req.query.defaults !== '0';

      const ownerPubkey = d.getOwnerPubkey();
      const isOwner = customerPubkey === ownerPubkey;

      // Whether this assistant has a profile — the one rule every setup surface
      // shares (ADR assistant-profile/0001): the local relay first, then the
      // publish relays, copying a profile found only there back home. That
      // fallback runs only for the assistant's own signed-in user, the owner or an
      // admin, or the in-container operator; an anonymous GET is answered from the
      // local relay alone, so a public read never writes. The person's-name lookup
      // for the defaults reaches the profile relays under the same rule.
      const session = req.session || {};
      const sessionPubkey = session.authenticated ? session.pubkey : null;
      const allowRelayFallback = Boolean(
        (sessionPubkey && (
          sessionPubkey === customerPubkey
          || sessionPubkey === ownerPubkey
          || d.getAdminPubkeys().includes(sessionPubkey)
        ))
        || req.localTrusted === true
      );

      const instance = d.describeInstance();

      // Unified assistant key access (owner → TA key, customer → customer relay key)
      const relayKeys = await d.getAssistantKeys(customerPubkey);

      if (!relayKeys || !relayKeys.pubkey) {
        const answer = { success: true, hasRelayKey: false, hasProfile: false, profileSource: null, isPublicInstance: instance.isPublic };
        if (wantDefaults) {
          const personName = await d.getPersonName(customerPubkey, { allowRelayLookup: allowRelayFallback });
          answer.defaults = buildDefaultProfile({ personPubkey: customerPubkey, personName, instance });
        }
        return res.json(answer);
      }

      // The name lookup and the setup check run together, so a relay round-trip for one never waits
      // on the other.
      const [personName, state] = await Promise.all([
        wantDefaults ? d.getPersonName(customerPubkey, { allowRelayLookup: allowRelayFallback }) : '',
        d.resolveAssistantProfileState({
          assistantPubkey: relayKeys.pubkey,
          allowRelayFallback,
          getPublishRelays: getAssistantPublishRelays,
        }),
      ]);

      const answer = {
        success: true,
        hasRelayKey: true,
        assistantPubkey: relayKeys.pubkey,
        assistantNpub: relayKeys.npub,
        hasProfile: state.hasProfile,
        profile: state.profile,
        profileSource: state.source,
        isOwner,
        isPublicInstance: instance.isPublic,
      };
      if (wantDefaults) {
        answer.defaults = buildDefaultProfile({ personPubkey: customerPubkey, personName, instance });
        // The NIP-05 the next publish will carry, for the editor's read-only display — on a public
        // instance only, because nothing else publishes one.
        const localPart = computeAssistantLocalPart(personName, relayKeys.pubkey);
        answer.computedNip05 = instance.isPublic
          ? { localPart, domain: instance.domain, address: `${localPart}@${instance.domain}` }
          : null;
      }
      return res.json(answer);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };
}

const handleAssistantStatus = createAssistantStatusHandler();

/**
 * GET /api/assistant/pubkey
 * Returns the owner's Tapestry Assistant pubkey (no auth required — pubkey is public).
 */
function handleGetTAPubkey(req, res) {
  const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
  const pubkey = getOwnerAssistantPubkey();
  if (!pubkey) {
    return res.status(404).json({ success: false, error: 'TA pubkey not configured' });
  }
  return res.json({ success: true, pubkey });
}

/**
 * POST /api/assistant/provision-key
 * Generates and stores a new server-side Assistant keypair for the caller's
 * session pubkey, if one doesn't already exist. Used by admins (who don't
 * get one at signup the way customers do) and as a fallback in any case
 * where a recognised user is missing their Assistant key.
 *
 * Auth: any authenticated session whose pubkey is the owner, an admin, or
 * an active customer. Storage scheme matches customer relay keys (slot is
 * the caller's pubkey), so getAssistantKeys(pubkey) will find it without
 * any extra routing.
 */
async function handleProvisionAssistantKey(req, res) {
  try {
    if (!req.session || !req.session.authenticated || !req.session.pubkey) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const sessionPubkey = req.session.pubkey;

    // Only known roles can provision: owner, admin, or active customer.
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    const isOwner = sessionPubkey === ownerPubkey;
    const isAdmin = !isOwner && getAdminPubkeys().includes(sessionPubkey);
    let isCustomer = false;
    if (!isOwner && !isAdmin) {
      try {
        const CustomerManager = require('../../utils/customerManager');
        const cm = new CustomerManager();
        await cm.initialize();
        const customer = await cm.getCustomer(sessionPubkey);
        isCustomer = customer && customer.status === 'active';
      } catch {}
    }
    if (!isOwner && !isAdmin && !isCustomer) {
      return res.status(403).json({ success: false, error: 'Only the owner, an admin, or an active customer can provision an Assistant key' });
    }

    // If a key already exists, refuse — re-provisioning would lose the
    // signing identity of every event already signed by the old key.
    const existing = await getAssistantKeys(sessionPubkey);
    if (existing && existing.pubkey) {
      return res.status(409).json({
        success: false,
        error: 'Assistant key already exists for this user',
        pubkey: existing.pubkey,
        npub: existing.npub,
      });
    }

    const { generateRelayKeys } = require('../../utils/customerRelayKeys');
    const keys = generateRelayKeys();

    // Store under the caller's pubkey — same slot scheme as customer keys.
    // Owner is handled above (existing check would have returned the TA key
    // stored under 'tapestry-assistant'), so we never write the owner here.
    const storage = new SecureKeyStorage();
    await storage.storeRelayKeys(sessionPubkey, keys);

    console.log(`[assistant] Provisioned new Assistant key for ${sessionPubkey.slice(0, 8)} (role: ${isAdmin ? 'admin' : isCustomer ? 'customer' : 'owner'})`);

    return res.json({
      success: true,
      pubkey: keys.pubkey,
      npub: keys.npub,
    });
  } catch (err) {
    console.error('[assistant] provision-key error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// buildDefaultProfileContent is exported for tests: it is the stack-free entry point
// to the one default the editor offers and a content-less publish signs
// (./profileDefaults.js holds the definition itself).
// getInstanceWebsite + isPubliclyReachable are exported so ./avatar.js can gate the
// composite's publishable URL on the SAME rule as the branded default — one notion
// of "could a stranger fetch this", not two (ADR ta-avatar/0003 D4).
// createPublishProfileHandler and createAssistantStatusHandler are the seams tests
// drive (ADRs assistant-profile/0002 and 0003).
module.exports = {
  handlePublishProfile, createPublishProfileHandler,
  handleAssistantStatus, createAssistantStatusHandler, handleGetTAPubkey, handleProvisionAssistantKey,
  handleGetAssistantRoster,
  buildDefaultProfileContent, getInstanceWebsite, isPubliclyReachable, getAssistantPublishRelays,
};
