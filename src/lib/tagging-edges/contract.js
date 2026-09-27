/**
 * The tagging edge contract (epic tagging-edges, story 1; ADR tagging-edges/0001).
 *
 * One definition of the NostrUser→NostrUser `TAGS` relationship that reflects a tagging — a
 * kind-39999 `nostr-user-tag` assertion. Every writer (the gap-filling pass, the real-time path)
 * derives `TAGS` properties through this module and no other way, so their edges cannot drift.
 *
 * Pure and dependency-free: plain objects in, plain objects out; nothing outside this folder is
 * required, and there is no I/O, clock, randomness or logging. Both stamp pubkeys are parameters:
 * the caller supplies the canonical stamp's pubkey (an ADR 0015 site) and this deployment's TA
 * (resolved at runtime), so no pubkey is written here.
 *
 * Callers pass only relay-verified events: signatures are not checked here (strfry verifies them
 * before storing). A writer must not run without both stamp pubkeys — it would read every tagging
 * as a non-tagging and retire every edge (ADR 0001, "Binding for later stories").
 */

const TAGS_RELATIONSHIP = 'TAGS';

const REFUSAL = Object.freeze({
  NOT_AN_EVENT: 'not-an-event',
  WRONG_KIND: 'wrong-kind',
  NO_D: 'no-d',
  NO_STAMP: 'no-nostr-user-tag-stamp',
  NO_TARGET: 'no-target',
  SEVERAL_TARGETS: 'several-targets',
  BAD_TARGET: 'bad-target',
  NO_TAG_REFERENCE: 'no-tag-reference',
  SEVERAL_TAG_REFERENCES: 'several-tag-references',
  BAD_TAG_ADDRESS: 'bad-tag-address',
});

const HEX64 = /^[0-9a-f]{64}$/;
const HEX64_ANY_CASE = /^[0-9a-fA-F]{64}$/;
const TAG_ADDRESS_RE = /^39999:([0-9a-fA-F]{64}):(.+)$/s;
const ANY_ADDRESS_RE = /^(\d+):([0-9a-fA-F]{64}):(.*)$/s;
// strfry indexes a `d` of at most 255 bytes and skips a longer one; with no `d` left the identity is ''.
const MAX_D_BYTES = 255;

const EMPTY_TARGETS = () => ({ eventIds: [], addresses: [] });

function isObject(x) { return !!x && typeof x === 'object'; }
function distinct(xs) { return [...new Set(xs)]; }

/**
 * The event check (step 1): NIP-01 lowercase id and pubkey, a non-negative integer created_at,
 * and a tags array. Taggings, deletions and supplied tag elements all pass the same check.
 */
function isEvent(ev) {
  return isObject(ev)
    && typeof ev.id === 'string' && HEX64.test(ev.id)
    && typeof ev.pubkey === 'string' && HEX64.test(ev.pubkey)
    && Number.isInteger(ev.created_at) && ev.created_at >= 0
    && Array.isArray(ev.tags);
}

function firstTag(ev, name) { return ev.tags.find((t) => Array.isArray(t) && t[0] === name); }
function stringValues(ev, name) {
  return ev.tags.filter((t) => Array.isArray(t) && t[0] === name && typeof t[1] === 'string').map((t) => t[1]);
}

/** The value of the first `d` strfry indexes (over-long ones are skipped), when it is usable; otherwise null. */
function identityD(ev) {
  const t = ev.tags.find((x) => Array.isArray(x) && x[0] === 'd'
    && !(typeof x[1] === 'string' && Buffer.byteLength(x[1], 'utf8') > MAX_D_BYTES));
  const d = t && t[1];
  if (typeof d !== 'string' || d === '' || Buffer.byteLength(d, 'utf8') > MAX_D_BYTES) return null;
  return d;
}

/** `39998:<pubkey>:<conceptSlug>`, or null for a missing or empty pubkey (which matches nothing). */
function stamp(pubkey, conceptSlug) {
  return typeof pubkey === 'string' && pubkey !== '' ? `39998:${pubkey}:${conceptSlug}` : null;
}

/** A well-formed tag address with its pubkey segment lower-cased (the slug keeps its case), else null. */
function parseTagAddress(a) {
  const m = TAG_ADDRESS_RE.exec(a);
  return m ? { address: `39999:${m[1].toLowerCase()}:${m[2]}`, slug: m[2] } : null;
}

/** An `a` value of any kind with its pubkey segment lower-cased; anything else as published. */
function normalizeAddress(a) {
  const m = ANY_ADDRESS_RE.exec(a);
  return m ? `${m[1]}:${m[2].toLowerCase()}:${m[3]}` : a;
}

/**
 * Resolve a tag named only by event id from the caller's tag elements (step 5). The element must
 * pass the event check, be the event the tagging names, be kind 39999 with a non-empty first `d`,
 * and carry a `:tag` stamp this deployment honours. Any error while looking it up or reading it
 * counts as absent. Never searches by slug.
 */
function resolveTagElement(tagEventId, opts) {
  try {
    const map = opts.tagElementsById;
    const el = map && typeof map.get === 'function' ? map.get(tagEventId) : undefined;
    if (!isEvent(el) || el.id !== tagEventId || el.kind !== 39999) return null;
    const d = firstTag(el, 'd');
    const slug = d && d[1];
    if (typeof slug !== 'string' || slug === '') return null;
    const tagStamps = [stamp(opts.canonicalPubkey, 'tag'), stamp(opts.localPubkey, 'tag')].filter(Boolean);
    const zs = stringValues(el, 'z');
    if (!tagStamps.some((s) => zs.includes(s))) return null;
    return { address: `39999:${el.pubkey}:${slug}`, slug };
  } catch (_) {
    return null;
  }
}

/**
 * Convert a tagging event to its `TAGS` edge, or refuse it with a reason. Never throws.
 * Once the event is a valid kind-39999 with an identity `d`, a refusal also carries that version
 * (address, eventId, createdAt, from), so a newer non-tagging version can retire an edge.
 */
function taggingToEdge(event, options) {
  const refuse = (reason) => ({ ok: false, reason });
  try {
    const opts = isObject(options) ? options : {};

    // 1. The event.
    if (!isEvent(event)) return refuse(REFUSAL.NOT_AN_EVENT);
    if (event.kind !== 39999) return refuse(REFUSAL.WRONG_KIND);
    const d = identityD(event);
    if (d === null) return refuse(REFUSAL.NO_D);
    const version = { address: `39999:${event.pubkey}:${d}`, eventId: event.id, createdAt: event.created_at, from: event.pubkey };
    const refuseVersion = (reason) => ({ ok: false, reason, ...version });

    // 2. The nostr-user-tag stamp.
    const zs = stringValues(event, 'z');
    const canonicalStamp = stamp(opts.canonicalPubkey, 'nostr-user-tag');
    const localStamp = stamp(opts.localPubkey, 'nostr-user-tag');
    const zCanonical = canonicalStamp !== null && zs.includes(canonicalStamp);
    const zLocal = localStamp !== null && zs.includes(localStamp);
    if (!zCanonical && !zLocal) return refuseVersion(REFUSAL.NO_STAMP);

    // 3. The target.
    const targets = distinct(stringValues(event, 'p').map((p) => p.toLowerCase()));
    if (targets.length === 0) return refuseVersion(REFUSAL.NO_TARGET);
    if (targets.length > 1) return refuseVersion(REFUSAL.SEVERAL_TARGETS);
    const to = targets[0];
    if (!HEX64.test(to)) return refuseVersion(REFUSAL.BAD_TARGET);

    // 4. The tag reference: `a` values are normalized before they are counted; non-hex `e` values are ignored.
    const aValues = distinct(stringValues(event, 'a').map((a) => { const t = parseTagAddress(a); return t ? t.address : a; }));
    if (aValues.length > 1) return refuseVersion(REFUSAL.SEVERAL_TAG_REFERENCES);
    const named = aValues.length === 1 ? parseTagAddress(aValues[0]) : null;
    if (aValues.length === 1 && !named) return refuseVersion(REFUSAL.BAD_TAG_ADDRESS);
    const eValues = distinct(stringValues(event, 'e').filter((e) => HEX64_ANY_CASE.test(e)).map((e) => e.toLowerCase()));
    if (eValues.length > 1) return refuseVersion(REFUSAL.SEVERAL_TAG_REFERENCES);
    const tagEventId = eValues.length === 1 ? eValues[0] : null;
    if (!named && !tagEventId) return refuseVersion(REFUSAL.NO_TAG_REFERENCE);

    // 5. Resolution: `a` is the tag's identity and `e` is provenance (ADR profile/0022).
    const tag = named || (tagEventId ? resolveTagElement(tagEventId, opts) : null);

    // 6. The stance, exactly as published; null when absent.
    const p = firstTag(event, 'polarity');
    const polarity = p && typeof p[1] === 'string' ? p[1] : null;

    // 7. The edge — these properties and nothing else.
    return {
      ok: true,
      edge: {
        type: TAGS_RELATIONSHIP,
        from: event.pubkey,
        to,
        address: version.address,
        eventId: event.id,
        createdAt: event.created_at,
        polarity,
        tagAddress: tag ? tag.address : null,
        tagEventId,
        tagSlug: tag ? tag.slug : null,
        zCanonical,
        zLocal,
      },
    };
  } catch (_) {
    return refuse(REFUSAL.NOT_AN_EVENT);
  }
}

function isRefusal(x) { return isObject(x) && x.ok === false; }

/**
 * Does version `a` stand over version `b`? Newer created_at; on a tie the lower event id (NIP-01).
 * Relational comparison, so a createdAt read back from Neo4j (a driver Integer or a BigInt) orders
 * the same as a JS number.
 */
function standsOver(a, b) {
  if (a.createdAt > b.createdAt) return true;
  if (a.createdAt < b.createdAt) return false;
  return a.eventId < b.eventId;
}

function outcome(standing, superseded, droppedTarget, changed, reason) {
  return { standing, superseded, droppedTarget, changed, reason };
}

/**
 * Which version of a tagging stands (AC-3). `current` is an edge or null; `incoming` is an edge, a
 * refusal carrying an address (a non-tagging version, which retires the edge), or null. Pass the
 * edge itself — `taggingToEdge(…).edge` — not the `{ ok, edge }` result.
 * Tag resolution only moves from null to a value; the stamp flags follow the incoming record.
 */
function standingEdge(current, incoming) {
  const cur = isObject(current) && !isRefusal(current) ? current : null;
  if (!isObject(incoming)) return outcome(cur, null, null, false, 'no-incoming');
  const retiring = isRefusal(incoming);
  if (!cur) {
    return retiring
      ? outcome(null, null, null, false, 'retired-by-non-tagging')
      : outcome(incoming, null, null, true, 'new');
  }
  if (incoming.address !== cur.address) return outcome(cur, null, null, false, 'address-mismatch');

  if (incoming.eventId === cur.eventId) {
    if (retiring) return outcome(null, cur, cur.to, true, 'retired-by-non-tagging');
    const keepResolved = cur.tagAddress != null;
    const merged = {
      ...cur,
      tagAddress: keepResolved ? cur.tagAddress : incoming.tagAddress,
      tagSlug: keepResolved ? cur.tagSlug : incoming.tagSlug,
      zCanonical: incoming.zCanonical,
      zLocal: incoming.zLocal,
    };
    const changed = Object.keys(merged).some((k) => merged[k] !== cur[k]);
    return outcome(changed ? merged : cur, null, null, changed, 'same-version');
  }

  if (standsOver(incoming, cur)) {
    if (retiring) return outcome(null, cur, cur.to, true, 'retired-by-non-tagging');
    return outcome(incoming, cur, incoming.to !== cur.to ? cur.to : null, true, 'newer');
  }
  return outcome(cur, incoming, null, false, 'older-ignored');
}

/** What a well-formed kind-5 names — lower-cased ids and addresses — or null for anything else. */
function deletionTargets(deletion) {
  if (!isEvent(deletion) || deletion.kind !== 5) return null;
  return {
    eventIds: distinct(stringValues(deletion, 'e').filter((e) => HEX64_ANY_CASE.test(e)).map((e) => e.toLowerCase())),
    addresses: distinct(stringValues(deletion, 'a').map(normalizeAddress)),
  };
}

/** The ids and addresses a kind-5 names (the edges it could touch); both empty for anything else. */
function revokeTargets(deletion) {
  try {
    return deletionTargets(deletion) || EMPTY_TARGETS();
  } catch (_) {
    return EMPTY_TARGETS();
  }
}

/**
 * Does a kind-5 remove this edge (AC-4)? Only the tagger's revoke naming the edge's event id, or
 * its address with a created_at no earlier than the edge's version. Order-free and never throws.
 */
function revokeApplies(edge, deletion) {
  try {
    const named = deletionTargets(deletion);
    if (!named) return { applies: false, reason: 'not-a-deletion' };
    if (!isObject(edge)) return { applies: false, reason: 'not-named' };
    if (deletion.pubkey !== edge.from) return { applies: false, reason: 'not-the-tagger' };
    if (named.eventIds.includes(edge.eventId)) return { applies: true, reason: 'names-event-id' };
    if (named.addresses.includes(edge.address)) {
      return deletion.created_at >= edge.createdAt
        ? { applies: true, reason: 'names-address' }
        : { applies: false, reason: 'address-deletion-older' };
    }
    return { applies: false, reason: 'not-named' };
  } catch (_) {
    return { applies: false, reason: 'not-a-deletion' };
  }
}

module.exports = {
  TAGS_RELATIONSHIP,
  REFUSAL,
  taggingToEdge,
  standingEdge,
  revokeApplies,
  revokeTargets,
};
