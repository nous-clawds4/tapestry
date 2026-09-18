/**
 * Story 11 / ADR 0010: Pinned-tag Trusted List refresh engine.
 *
 * Three callers — cron orchestrator, user-clicked refresh endpoints, and
 * the client-side refresh-on-pin — converge on `runOnePin(pinEvent)`.
 *
 * Wire shape (kind-30392):
 *   d        = `tl-pin-<observer8>-<tagAuthor8>-<tagSlug>`
 *   title    = tag.name
 *   metric   = "pinned-tag-membership"
 *   observer = <observer pubkey>
 *   source-tag = <tagEventId> <tagAuthorPubkey> <tagSlug>
 *   cutoff   = <integer string>
 *   min-rank = <integer string>
 *   p tags   = one per member that passes the disputes function (v1: pubkey only,
 *              no relay/score since Story-10's default has includeScoreInTL=false)
 *   content  = JSON { members: [{ pubkey, endorsements, disputes }] }
 *
 * Retraction: empty-membership replacement at the same d-tag with a
 * ["status","retracted"] marker tag. No on-disk status; derived from strfry.
 */

const { exec } = require('child_process');
const profileTags = require('../profile-tags');
const { buildAndPublishTL } = require('./index');
const { resolvePov } = require('../_shared/pov');
const {
  curateNotes, variantOfPin, variantKeyArgs,
  contextHandle, tlDTag, noteTlDTag, itemTlDTag,
  trustedListZTags, conceptTrustedList, tlHeaderDTag, tlHeaderAddr, buildTLHeader,
  isKnownAuthorConstraint,
} = require('../../lib/event-tagging');
const { resolveMembershipMethod, isImplementedMembershipMethod } = require('./membershipMethods');

const TA_PUBKEY = profileTags.TA_PUBKEY;
const TAG_PINNING_Z_TAG = profileTags.TAG_PINNING_Z_TAG;
// Max note members carried in a single kind-30393 note TL (ADR event-tagging/0017). Conservative —
// ~1000 e-tags ≈ 75KB, under typical strfry max-event-size limits. Exceeding it publishes the top N
// and marks the TL partial (a SIGNALED bound, never a silent small cap). Operator-tunable per relay.
const NOTE_TL_MEMBER_CAP = 1000;
/**
 * search-index-selection ADR 0001 §4 — the published list's disclosure of the
 * pin's author constraint, so a consumer can tell "this set is self-curated and
 * certain" from "this set is a WoT threshold" WITHOUT fetching the pin.
 *
 * The value is the RESOLVED constraint (gated on the shared vocabulary), so an
 * unknown — fail-open — value emits NO tag: the list is honestly undisclosed
 * rather than falsely disclosed. Absent ⇒ [] ⇒ byte-identical tag arrays.
 */
function authorConstraintTags(authorConstraint) {
  return isKnownAuthorConstraint(authorConstraint) ? [['author-constraint', authorConstraint]] : [];
}
/**
 * search-index-selection ADR 0002 §1 — the one-time "unknown pin membership
 * method ignored" notice. The registry stays pure (no logging), so the notice
 * lives here at the call site, modelled on warnUnknownAuthorConstraint.
 *
 * SILENT on absence: every pin published before that story omits the field, so
 * warning on absence would log once per pin per refresh cycle forever. Keyed by
 * the offending value so one bad pin cannot flood the log.
 */
const warnedPinMembershipMethods = new Set();
function warnUnknownPinMembershipMethod(value) {
  if (value === undefined || value === null || value === '') return;
  if (isImplementedMembershipMethod(value)) return;
  if (warnedPinMembershipMethods.has(value)) return;
  warnedPinMembershipMethods.add(value);
  console.warn(`[refreshPinnedTags] unknown pin membershipMethod ${JSON.stringify(value)} ignored (falling back to the instance default)`);
}
// Max item members carried in a single kind-30394 item TL (ADR dlist-item-tagging/0003 §1.9).
// Half NOTE_TL_MEMBER_CAP: an `a` coordinate (~80–120 bytes) is roughly double a 64-hex `e` id,
// so 500 keeps one event inside the same ~75KB budget. Overflow is SIGNALED, never silent.
const ITEM_TL_MEMBER_CAP = 500;
// A relay round-trip for the lazy TL header must never stall a refresh cycle: the header is
// best-effort (failure policy F1 — publish the TL without the per-tag z), so bound it.
const TL_HEADER_RELAY_TIMEOUT_MS = 5000;

function isHexPubkey(v) {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safe = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safe}'`, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const events = [];
      for (const line of stdout.split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

function dTagOf(event) {
  const t = (event.tags || []).find((x) => x[0] === 'd');
  return t ? t[1] : null;
}

function dedupeReplaceable(events) {
  const byKey = new Map();
  for (const ev of events) {
    const d = dTagOf(ev);
    const key = `${ev.pubkey}|${d || ev.id}`;
    const existing = byKey.get(key);
    if (!existing || ev.created_at > existing.created_at) byKey.set(key, ev);
  }
  return Array.from(byKey.values());
}

// ADR trusted-lists/0002: 6-decimal rounding for published weighted scores —
// full precision for hand validation, without binary-float noise.
function round6(x) { return Number(x.toFixed(6)); }

/**
 * The kind-30392 TL d-tag. Composed shape (wire-binding, Story 11 invariant):
 *   tl-pin-${observer.slice(0, 8)}-${tagAuthorPubkey.slice(0, 8)}-${tagSlug}
 * plus pinVariantKey({ contextSlug }) — i.e. the `-in-<context>` replaceability
 * suffix for a contextual pin, the empty string for a neutral one.
 *
 * ADR feat-tags-modernization/0001 §5: the string itself is built by the SHARED
 * composer `tlDTag` in src/lib/event-tagging/pins.js, which the client publisher
 * (`ui/src/utils/publishTagPin.js`) also delegates to — one composer, two thin
 * wrappers, so client and server cannot disagree.
 */
function computeTLDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug, variantSlug }) {
  return tlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug, variantSlug });
}

/**
 * search-index-selection ADR 0003 §3 layer 1 (C3, operator ruling 2026-09-18) —
 * a pin counts for an observer only if the pin's AUTHOR is that observer.
 *
 * The TL address keys on `curationMethod.observer` (an editable field) while the
 * pin address keys on the pin's author, so a stranger who names your pubkey as
 * observer otherwise publishes at your permanent address and overwrites your
 * list every cycle. This applies at write time the same check a subscriber
 * applies at read time: a pin about your point of view must be yours.
 *
 * A skipped pin claims NO d-tag — it never owned the address — so the sweep is
 * untouched, and any list it previously published is retracted (ADR
 * Consequences: that is the intended outcome). Honouring a pin signed by the
 * observer's 10040-designated assistant is a named follow-up, not built here.
 */
/**
 * search-index-selection ADR 0003 §2 — the published list's disclosure of a
 * RECIPE variant. Recipes only: a contextual list discloses through its context
 * `z` and a neutral list discloses nothing, so both keep byte-identical tag
 * arrays (AC-2). Purely additive.
 */
function variantDisclosureTags(variant) {
  return (variant && variant.kind === 'recipe' && variant.slug)
    ? [['variant', variant.slug]]
    : [];
}

const warnedAuthorObserverMismatch = new Set();
function authorObserverMismatch(pinEvent, observer) {
  if (!pinEvent || pinEvent.pubkey === observer) return null;
  if (!warnedAuthorObserverMismatch.has(pinEvent.id)) {
    warnedAuthorObserverMismatch.add(pinEvent.id);
    console.warn(`[refreshPinnedTags] pin ${pinEvent.id} names observer ${observer} but is signed by ${pinEvent.pubkey} — skipped (author-observer-mismatch)`);
  }
  // The house skip shape is `errorReason` (test plan §"ADR ambiguities", item 1).
  return { status: 'skipped', errorReason: 'author-observer-mismatch' };
}

async function enumeratePinnedTags() {
  const events = await strfryScan({
    kinds: [39999],
    '#z': [TAG_PINNING_Z_TAG],
  });
  return dedupeReplaceable(events);
}

async function lookupTagEvent(tagEventId) {
  const events = await strfryScan({ kinds: [39999], ids: [tagEventId] });
  if (events.length === 0) return null;
  const tagEv = events[0];
  const payload = profileTags.parseTagPayload(tagEv);
  if (!payload) return null;
  return {
    eventId: tagEv.id,
    slug: payload.slug,
    name: payload.name || payload.slug,
    description: payload.description || '',
    authorPubkey: tagEv.pubkey,
    createdAt: tagEv.created_at,
  };
}

/**
 * Apply the v1 disputes function to the per-target aggregation from
 * aggregateProfilesTagged. A candidate is a member iff:
 *   applications >= cutoff AND applications > disputes
 */
function applyDisputesFunction(byTarget, cutoff) {
  const members = [];
  for (const entry of byTarget.values()) {
    if (entry.applications >= cutoff && entry.applications > entry.disputes) {
      members.push({
        pubkey: entry.pubkey,
        endorsements: entry.applications,
        disputes: entry.disputes,
      });
    }
  }
  // Stable order: by endorsements desc, then pubkey asc.
  members.sort((a, b) =>
    (b.endorsements - a.endorsements) || a.pubkey.localeCompare(b.pubkey));
  return members;
}

/**
 * Positive-only memo of per-tag TL-header `d`-tags known to exist (confirmed by a
 * scan hit or a successful publish). A header is never deleted, so a positive cache
 * is sound across cycles; a NEGATIVE cache would wedge a failed mint until restart.
 */
const tlHeaderMemo = new Set();

function withRelayTimeout(promise, ms) {
  let timer = null;
  const bounded = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`TL header relay call timed out after ${ms}ms`)), ms);
    if (timer.unref) timer.unref();
  });
  return Promise.race([Promise.resolve(promise), bounded])
    .finally(() => { if (timer) clearTimeout(timer); });
}

/** Default header publisher: sign as the TA and write to local strfry (+ best-effort graph import). */
async function publishTLHeaderEvent(unsigned) {
  const {
    loadTAKey, signAndFinalize, publishToStrfry, importEventDirect,
  } = require('../normalize/helpers');
  await loadTAKey();
  const event = signAndFinalize(unsigned);
  await publishToStrfry(event);
  const dTag = (event.tags || []).find((t) => t[0] === 'd');
  try {
    await importEventDirect(event, `39999:${event.pubkey}:${dTag ? dTag[1] : ''}`);
  } catch {
    // The relay copy is what discovery reads; the graph row is a convenience.
  }
  return event;
}

/**
 * ADR dlist-item-tagging/0002 + 0003 §3 — ensure the tag's per-tag Trusted-List
 * header (TA-signed kind-39999 at `d = tl:<slug>-tls`) exists. Lazy, idempotent,
 * memoized positively. NEVER throws: failure policy F1 wants the Trusted List
 * published anyway, minus only the per-tag `z` membership claim.
 *
 * Injectable deps ({ strfryScan | scan, publishHeader | publish | publishEvent })
 * so the header path is exercisable without a relay.
 */
async function ensureTagTLHeader({ tag }, deps = {}) {
  const slug = tag && tag.slug;
  if (!slug) return { status: 'error', errorReason: 'tag has no slug' };
  const dTag = tlHeaderDTag(slug);
  const addr = tlHeaderAddr(TA_PUBKEY, slug);
  if (tlHeaderMemo.has(dTag)) return { status: 'exists', addr };

  const scan = deps.strfryScan || deps.scan || strfryScan;
  const publishHeader = deps.publishHeader || deps.publish || deps.publishEvent || publishTLHeaderEvent;
  try {
    const existing = await withRelayTimeout(
      scan({ kinds: [39999], authors: [TA_PUBKEY], '#d': [dTag] }), TL_HEADER_RELAY_TIMEOUT_MS,
    );
    if (Array.isArray(existing) && existing.length > 0) {
      tlHeaderMemo.add(dTag);
      return { status: 'exists', addr };
    }
    const name = tag.name || slug;
    await withRelayTimeout(publishHeader(buildTLHeader({
      tagAuthorPubkey: tag.authorPubkey,
      slug,
      names: [`Trusted List for ${name}`, `Trusted Lists for ${name}`],
      description: `Trusted Lists derived from the ${name} tag.`,
      taPubkeys: [TA_PUBKEY],
    })), TL_HEADER_RELAY_TIMEOUT_MS);
    tlHeaderMemo.add(dTag);
    return { status: 'created', addr };
  } catch (err) {
    // F1: no memo on failure — the next refresh retries the mint.
    return { status: 'error', addr, errorReason: err.message };
  }
}

/**
 * Refresh one pinned-tag's TL.
 * Returns { status, error?, errorReason?, tlEventId?, dTag?, memberCount? }.
 *
 * Injectable deps ({ lookupTag, aggregateProfilesTagged, resolvePov,
 * resolveMembershipMethod, publishTL }) for hermetic tests, mirroring
 * `runOneNotePin`; defaults are the real implementations, so every production
 * call path is unchanged.
 */
async function runOnePin(pinEvent, options = {}) {
  const deps = options.deps || options;
  const lookupTag = deps.lookupTag || lookupTagEvent;
  const aggregateProfilesTagged = deps.aggregateProfilesTagged
    || ((args) => profileTags.aggregateProfilesTagged(args));
  const publishTL = deps.publishTL || buildAndPublishTL;

  const curation = profileTags.parseCurationMethod(pinEvent);
  if (!curation || curation.method !== 'nip85:rank') {
    return { status: 'unsupported', errorReason: 'curation method not supported in v1' };
  }
  const observer = curation.observer;
  if (!isHexPubkey(observer)) {
    return { status: 'error', errorReason: 'observer pubkey missing or malformed' };
  }
  // search-index-selection ADR 0003 §3 (C3) — right after the observer bail.
  const mismatch = authorObserverMismatch(pinEvent, observer);
  if (mismatch) return mismatch;
  // search-index-selection ADR 0001 — read AFTER the observer bail (E2: a
  // constrained pin with no valid observer is an error, never "trust nobody"
  // and never "trust everyone"). Absent ⇒ unconstrained; an unknown value fails
  // open inside the aggregation and is NOT disclosed on the published list.
  const authorConstraint = curation.authorConstraint;
  // search-index-selection ADR 0002 §1 — the pin's own fold wins; absent ⇒ the
  // instance dial (AC-2). An unknown / future-rung / malformed value FAILS OPEN
  // to the dial, matching the registry's own posture.
  const pinMembershipMethod = curation.membershipMethod;
  const tagEventId = profileTags.parsePinTagEventId(pinEvent);
  if (!tagEventId) {
    return { status: 'error', errorReason: 'pin event has no referenced tag event id' };
  }

  const tag = await lookupTag(tagEventId);
  if (!tag) {
    return { status: 'error', errorReason: 'referenced tag event missing from local strfry' };
  }

  // ADR feat-tags-modernization/0001 §1 — CONTEXT FIRST, THEN THE METHOD
  // (identity vs scoring). The context is recovered from the pin's `z` STAMP
  // (never the d-tag) and feeds ONLY the d-tag composer and the discovery `z`;
  // it never reaches POV resolution, aggregation, or the membership fold.
  // null for a neutral pin ⇒ no suffix, no context z ⇒ output unchanged.
  // search-index-selection ADR 0003 §1 — generalised: the context is now one of
  // two variant kinds. A RECIPE keys the address on `-v-<slug>` and stamps NO
  // community z; a PLACE is byte-identical to today (AC-2).
  const variant = variantOfPin(pinEvent, TA_PUBKEY);
  const contextSlug = variant.kind === 'context' ? variant.slug : null;

  // POV resolution: pass observer through the same cascade
  // handleProfilesTagged uses. When no POV is configured (no
  // povSuffix or no minRank), the aggregation falls back to "all
  // assertions count" — same semantic the rest of the codebase uses.
  // The disputes function (cutoff + endorsements>disputes) still applies.
  const { povSuffix, minRank } = (deps.resolvePov || resolvePov)({ wotPov: 'user', userPubkey: observer });
  // Story 21 / ADR 0019 AC-21: default cutoff is 1 when none is set (the
  // client's defaultCurationMethod already sends 1; this server fallback
  // now matches). An explicit finite cutoff is still honored unchanged.
  const cutoff = Number.isFinite(curation.cutoff) ? curation.cutoff : 1;
  const minRankForTag = Number.isFinite(minRank) ? minRank : 0;

  const { byTarget, wotFiltering } = await aggregateProfilesTagged({
    tagEventId, povSuffix, minRank, authorConstraint, observer,
  });
  // ADR trusted-lists/0001: the membership method, resolved fresh per refresh
  // (fail-safe: always an implemented id). Dispatch is a map so rungs 2-4 add
  // branches without touching the count path.
  // search-index-selection ADR 0002 §1: the PIN's method wins; only a pin that
  // carries none — or one this build cannot execute — falls back to the
  // deployment-wide dial (which keeps its zero-arg signature and meaning).
  // ADR trusted-lists/0002: weighted methods need the WoT filter's ranks;
  // without them the fold degrades to count and the wire tag records the
  // math that actually ran.
  const requestedMethod = isImplementedMembershipMethod(pinMembershipMethod)
    ? pinMembershipMethod
    : (warnUnknownPinMembershipMethod(pinMembershipMethod),
      deps.resolveMembershipMethod
        ? deps.resolveMembershipMethod()
        : resolveMembershipMethod());
  const membershipMethod =
    (requestedMethod !== 'count' && !wotFiltering) ? 'count' : requestedMethod;
  const membershipFolds = {
    count: () => applyDisputesFunction(byTarget, cutoff),
    // Rung 2: membership/order unchanged (same fold), plus the signed
    // trust-weighted sum as the per-member score. round6 kills float noise
    // for hand validation (ADR 0002 point 4).
    input: () => applyDisputesFunction(byTarget, cutoff).map((m) => ({
      ...m,
      score: round6(byTarget.get(m.pubkey)?.weightedSum ?? 0),
    })),
    // Story 4 (formalized contract, D12): integer score
    // round(max(agreement x certainty, 0) x 100); membership predicate v2
    // (applications >= cutoff AND score >= 1 — net-zero/negative members
    // drop off the list); ordered score desc, pubkey asc.
    certainty: () => applyDisputesFunction(byTarget, cutoff)
      .map((m) => {
        const entry = byTarget.get(m.pubkey);
        const input = entry?.weightedInput ?? 0;
        const score = input === 0 ? 0
          : Math.round(Math.max((entry.weightedSum / input) * (1 - Math.pow(0.5, input)), 0) * 100);
        return { ...m, score };
      })
      .filter((m) => m.score >= 1)
      .sort((a, b) => (b.score - a.score) || a.pubkey.localeCompare(b.pubkey)),
  };
  const members = membershipFolds[membershipMethod]();
  // Story 4: the legacy Story-12 includeScoreInTL enrichment (member's raw
  // wot_rank in the score slot) is retired — the slot's meaning is singular:
  // the active method's score. Old pins carrying the flag are accepted and
  // the flag ignored.

  const dTag = computeTLDTag({
    observer, tagAuthorPubkey: tag.authorPubkey, tagSlug: tag.slug,
    ...variantKeyArgs(variant),
  });

  // ADR dlist-item-tagging/0002 — every Trusted List carries the concept z plus a
  // membership claim on the tag's (lazily minted) per-tag TL header. F1: if the
  // header cannot be minted, keep the concept axis and drop only the claim.
  const ensureHeaderDep = deps.ensureTagTLHeader || deps.ensureHeader;
  const headerResult = ensureHeaderDep
    ? await ensureHeaderDep({ tag }, deps)
    : await ensureTagTLHeader({ tag }, deps);
  const tlZTags = (headerResult && headerResult.status !== 'error')
    ? trustedListZTags({ taPubkey: TA_PUBKEY, tagSlug: tag.slug })
    : [['z', conceptTrustedList(TA_PUBKEY)]];

  try {
    const { event } = await publishTL({
      kind: 30392,
      dTag,
      title: tag.name,
      metric: 'pinned-tag-membership',
      items: members.map((m) => {
        const item = { tag: 'p', value: m.pubkey };
        if (m.score != null) item.score = m.score;
        return item;
      }),
      extraTags: [
        ['observer', observer],
        ['source-tag', tag.eventId, tag.authorPubkey, tag.slug],
        ['cutoff', String(cutoff)],
        ['min-rank', String(minRankForTag)],
        // ADR search-index-selection/0001 §4 — the disclosure rides immediately
        // after min-rank, which stays an honest record of what ran.
        ...authorConstraintTags(authorConstraint),
        // search-index-selection ADR 0002 §2 — EVERY 30392 discloses the fold
        // that actually ran (post-downgrade, post-fail-open), so a consumer can
        // tell a certainty list from a count one without fetching the pin.
        // Once the method is per-pin, "look up the deployment setting" stops
        // being an answer. Restores the tag Story 4 dropped.
        ['membership-method', membershipMethod],
        // rigor rides certainty TLs so consumers can reproduce scores (D12:
        // constant, not a knob) — it qualifies the method, so it reads after it.
        ...(membershipMethod === 'certainty' ? [['rigor', '0.5']] : []),
        // search-index-selection ADR 0003 §2 — a RECIPE's list discloses its
        // variant. The variant is already in the d-tag, but no reader parses the
        // suffix (standing rule), so without this tag a consumer has no
        // supported way to read it. Contextual lists need nothing new — their
        // context z below IS the disclosure — and neutral lists gain nothing, so
        // both keep byte-identical tag arrays (AC-2).
        ...variantDisclosureTags(variant),
        // ADR dlist-item-tagging/0002 — the family-wide Trusted-List z pair. The
        // 30392 gains its FIRST relay-filterable discovery axis here.
        ...tlZTags,
        // ADR feat-tags-modernization/0001 §3 — a CONTEXTUAL list carries the
        // context concept as an additional `z`, so a plain relay filter
        // ({kinds:[30392], "#z":[<context>]}) finds "every TL in <context>".
        // Neutral lists carry none: the asymmetry is the feature.
        ...(contextSlug ? [['z', contextHandle(TA_PUBKEY, contextSlug)]] : []),
      ],
      content: JSON.stringify({
        members: members.map((m) => ({
          pubkey: m.pubkey,
          endorsements: m.endorsements,
          disputes: m.disputes,
          ...(m.score != null ? { score: m.score } : {}),
        })),
      }),
    });
    return {
      status: 'ok',
      tlEventId: event.id,
      dTag,
      memberCount: members.length,
    };
  } catch (err) {
    // ADR tag-stack-merge-hardening/0001 (B4a): return the already-computed
    // dTag so refreshAllPinnedTags keeps it in currentDTags and
    // retractStaleTLs does NOT treat this pin's existing (healthy) TL as
    // stale — a transient publish failure must never wipe a live TL.
    return { status: 'error', errorReason: `publish failed: ${err.message}`, dTag };
  }
}

/**
 * Refresh-by-pinEventId — looks up the pin first, enforces ownership.
 * Used by the user-clicked POST /api/trusted-list/refresh-pinned-tag.
 */
async function refreshOnePinnedTagById({ pinEventId, sessionPubkey }) {
  const events = await strfryScan({ kinds: [39999], ids: [pinEventId] });
  if (events.length === 0) return { status: 'error', error: 'not-found' };
  const pin = events[0];
  // Defensive: pin must carry the tag-pinning z-tag.
  const zTag = (pin.tags || []).find((t) => t[0] === 'z');
  if (!zTag || zTag[1] !== TAG_PINNING_Z_TAG) {
    return { status: 'error', error: 'not-found' };
  }
  if (sessionPubkey && pin.pubkey !== sessionPubkey) {
    return { status: 'error', error: 'forbidden' };
  }
  // Recompute BOTH the profile TL (kind-30392) and the note TL (kind-30393) for
  // this pin. Previously only runOnePin ran here, so a single-pin refresh — the
  // "Update pinned notes" button, or a context-pin curation edit — never
  // recomputed the note list, leaving its drift stuck. The note twin no-ops for
  // profile-only pins (returns 'skipped').
  const profileResult = await runOnePin(pin);
  const noteResult = await runOneNotePin(pin);
  const itemResult = await runOneItemPin(pin);
  return {
    ...profileResult,
    noteStatus: noteResult && noteResult.status,
    itemStatus: itemResult && itemResult.status,
  };
}

/**
 * Diff strfry: any TA-signed kind-30392 with a `tl-pin-` d-tag whose
 * (observer, tagAuthor, tagSlug) doesn't match a current pin must be
 * retracted via an empty-membership replacement. Idempotent — already-
 * retracted slots are skipped via the marker check.
 */
async function retractStaleTLs(currentDTags, options = {}) {
  const { kind = 30392, dPrefix = 'tl-pin-' } = options;
  // Same injectable-deps shape as the runners, so the sweep is testable without a relay.
  const deps = options.deps || options;
  const scan = deps.strfryScan || deps.scan || strfryScan;
  const publish = deps.publishTL || deps.publish || buildAndPublishTL;
  const wanted = new Set(currentDTags);
  const tls = await scan({ kinds: [kind], authors: [TA_PUBKEY] });
  for (const tl of tls) {
    const dTag = dTagOf(tl);
    if (!dTag || !dTag.startsWith(dPrefix)) continue;
    if (wanted.has(dTag)) continue;
    const alreadyRetracted = (tl.tags || []).some(
      (t) => t[0] === 'status' && t[1] === 'retracted'
    );
    if (alreadyRetracted) continue;
    // Find the title/observer/source-tag from the prior TL to carry forward
    // (consumers reading the retracted event can still tell which TL it was).
    // ADR dlist-item-tagging/0003 §1: `z` rides along too, so a #z consumer sees the
    // list marked `retracted` rather than watch it vanish off the discovery axis.
    const carryOver = (tl.tags || []).filter((t) =>
      t[0] === 'title' || t[0] === 'metric' || t[0] === 'observer' || t[0] === 'source-tag'
      || t[0] === 'z'
    );
    try {
      await publish({
        kind,
        dTag,
        items: [],
        extraTags: [...carryOver, ['status', 'retracted']],
        content: '',
      });
    } catch (err) {
      console.error(`[refreshPinnedTags] retract failed for ${dTag}:`, err.message);
    }
  }
}

/**
 * event-tagging #17 / ADR 0016 — the note twin of `runOnePin`. For a pin whose tag targets NOTES,
 * publish a TA-signed **kind-30393** Trusted List of the trusted-tagged notes (e-tag members),
 * curated by the pin's `noteMethod` (`curateNotes`), under the observer POV. `d-tag`
 * `tl-pin-notes-<obs8>-<tagAuthor8>-<slug>`, metric `pinned-tag-notes`. Empty curated set ⇒
 * empty-membership replacement. Injectable deps ({ lookupTag, aggregateNotesTagged, publishTL })
 * for hermetic tests; defaults hit the real stack.
 */
async function runOneNotePin(pinEvent, options = {}) {
  const deps = options.deps || options;
  const lookupTag = deps.lookupTag || lookupTagEvent;
  const aggregateNotesTagged = deps.aggregateNotesTagged || ((args) => require('../event-tags').aggregateNotesTagged(args));
  const publishTL = deps.publishTL || buildAndPublishTL;

  const curation = profileTags.parseCurationMethod(pinEvent);
  if (!curation || curation.method !== 'nip85:rank') {
    return { status: 'unsupported', errorReason: 'curation method not supported in v1' };
  }
  const observer = curation.observer;
  if (!isHexPubkey(observer)) {
    return { status: 'error', errorReason: 'observer pubkey missing or malformed' };
  }
  // search-index-selection ADR 0003 §3 (C3) — same terms as runOnePin.
  const mismatch = authorObserverMismatch(pinEvent, observer);
  if (mismatch) return mismatch;
  // search-index-selection ADR 0001 — after the observer bail (E2), as in runOnePin.
  const authorConstraint = curation.authorConstraint;
  // Note-targeting gate: build a note TL only when the pin targets notes. Absent
  // targetTypes ⇒ ADR-0015 default (['profile','note']) ⇒ include notes.
  const targetTypes = Array.isArray(curation.targetTypes) ? curation.targetTypes : ['profile', 'note'];
  if (!targetTypes.includes('note')) {
    return { status: 'skipped', errorReason: 'pin does not target notes' };
  }
  const tagEventId = profileTags.parsePinTagEventId(pinEvent);
  if (!tagEventId) {
    return { status: 'error', errorReason: 'pin event has no referenced tag event id' };
  }
  const tag = await lookupTag(tagEventId);
  if (!tag) {
    return { status: 'error', errorReason: 'referenced tag event missing from local strfry' };
  }

  // ADR feat-tags-modernization/0001 §1 — context first (identity), then the
  // curation (scoring): the same discriminator as the profile TL, so a
  // contextual note-pin's list coexists with the neutral one's.
  // search-index-selection ADR 0003 §1 — generalised to the full variant.
  const variant = variantOfPin(pinEvent, TA_PUBKEY);
  const contextSlug = variant.kind === 'context' ? variant.slug : null;

  // Observer POV (same cascade as runOnePin) → the aggregation's trust filter.
  const { povSuffix, minRank } = resolvePov({ wotPov: 'user', userPubkey: observer });
  const noteMethod = curation.noteMethod || 'notes:net-endorsed';
  const sort = noteMethod === 'notes:most-applied' ? 'applied' : 'recent';
  // A durable list must be COMPLETE (ADR event-tagging/0017): use the uncapped `fullMembers`, not the
  // 50-capped `members` (that cap is only for the UI's note-body fetch). Curate the full set, then bound
  // by an explicit, SIGNALED ceiling — never a silent small cap.
  const { fullMembers, scanTruncated, total } = await aggregateNotesTagged({
    tagAuthor: tag.authorPubkey, slug: tag.slug, authorities: [TA_PUBKEY],
    povSuffix, minRank, viewerPubkey: undefined, sort,
    authorConstraint, observer,
  });
  // The pin's cutoff applies to notes too (mirrors the profile rule in
  // applyDisputesFunction), defaulting to 1 like runOnePin — so a lone
  // self-tagging counts, but cutoff ≥ 2 requires that many trusted taggings.
  const noteCutoff = Number.isFinite(curation.cutoff) ? curation.cutoff : 1;
  const curated = curateNotes(fullMembers || [], noteMethod, noteCutoff);
  const published = curated.slice(0, NOTE_TL_MEMBER_CAP);
  const totalTrusted = Number.isFinite(total) ? total : curated.length;
  // Partial when the taggings scan was bounded, or the curated set exceeds what one event can carry.
  const partial = !!scanTruncated || curated.length > NOTE_TL_MEMBER_CAP;
  // ADR §5: the shared composer — the client's computeNoteTLDTag delegates to
  // the same function, so the note-TL d-tag cannot drift across the seam.
  const dTag = noteTlDTag({
    observer, tagAuthorPubkey: tag.authorPubkey, tagSlug: tag.slug,
    ...variantKeyArgs(variant),
  });

  // ADR dlist-item-tagging/0002 — the same family-wide z pair, same F1 fallback.
  const ensureHeaderDep = deps.ensureTagTLHeader || deps.ensureHeader;
  const headerResult = ensureHeaderDep
    ? await ensureHeaderDep({ tag }, deps)
    : await ensureTagTLHeader({ tag }, deps);
  const tlZTags = (headerResult && headerResult.status !== 'error')
    ? trustedListZTags({ taPubkey: TA_PUBKEY, tagSlug: tag.slug })
    : [['z', conceptTrustedList(TA_PUBKEY)]];

  try {
    const { event, uuid } = await publishTL({
      kind: 30393,
      dTag,
      title: tag.name,
      metric: 'pinned-tag-notes',
      items: published.map((n) => ({ tag: 'e', value: n.id })),
      extraTags: [
        ['observer', observer],
        ['source-tag', tag.eventId, tag.authorPubkey, tag.slug],
        ['curation-method', noteMethod],
        // Relay-filterable discovery tags (metadata, NOT members — members are the e-tags above):
        //   #a → find every note TL for a tag across observers;  #p → find every note TL for an observer.
        ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
        ['p', observer],
        // ADR search-index-selection/0001 §4 — the disclosure, immediately after
        // the observer axis on the note list.
        ...authorConstraintTags(authorConstraint),
        // search-index-selection ADR 0003 §2 — the recipe disclosure (see runOnePin).
        ...variantDisclosureTags(variant),
        // ADR dlist-item-tagging/0002 — the family-wide Trusted-List z pair. The
        // legacy a/p pair above stays through the dual-emit window (Decision 4).
        ...tlZTags,
        // Partial signal: present ⇒ the list is NOT exhaustive; the value is the true total. Absent ⇒ complete.
        ...(partial ? [['truncated', String(totalTrusted)]] : []),
        // ADR feat-tags-modernization/0001 §3 — the context z rides the NOTE
        // list too, so both 3039x lists are discoverable by context.
        ...(contextSlug ? [['z', contextHandle(TA_PUBKEY, contextSlug)]] : []),
      ],
      content: JSON.stringify({
        notes: published.map((n) => ({ id: n.id, applications: n.applications, disputes: n.disputes })),
        ...(partial ? { partial: true, total: totalTrusted } : {}),
      }),
    });
    return { status: 'ok', dTag, memberCount: published.length, partial, uuid: uuid || (event && event.id) };
  } catch (err) {
    return { status: 'error', dTag, errorReason: err.message };
  }
}

/**
 * Story dlist-item-tagging #5 / ADR 0003 — the ITEM twin of `runOneNotePin`. For a pin whose
 * curation method targets ITEMS, publish a TA-signed **kind-30394** Trusted List of the
 * trusted-tagged addressable items (`a`-coordinate members) under the observer POV.
 * `d`-tag `tl-pin-items-<obs8>-<tagAuthor8>-<slug>`, metric `pinned-tag-items`. An empty
 * curated set publishes NOTHING (AC-6). Injectable deps
 * ({ lookupTag, aggregateNotesTagged, publishTL, ensureTagTLHeader }) for hermetic tests.
 */
async function runOneItemPin(pinEvent, options = {}) {
  const deps = options.deps || options;
  const lookupTag = deps.lookupTag || lookupTagEvent;
  const aggregateNotesTagged = deps.aggregateNotesTagged || ((args) => require('../event-tags').aggregateNotesTagged(args));
  const publishTL = deps.publishTL || buildAndPublishTL;

  const curation = profileTags.parseCurationMethod(pinEvent);
  if (!curation || curation.method !== 'nip85:rank') {
    return { status: 'unsupported', errorReason: 'curation method not supported in v1' };
  }
  const observer = curation.observer;
  if (!isHexPubkey(observer)) {
    return { status: 'error', errorReason: 'observer pubkey missing or malformed' };
  }
  // search-index-selection ADR 0003 §3 (C3) — same terms as runOnePin.
  const mismatch = authorObserverMismatch(pinEvent, observer);
  if (mismatch) return mismatch;
  // search-index-selection ADR 0001 — after the observer bail (E2), as in runOnePin.
  const authorConstraint = curation.authorConstraint;
  // Item-targeting gate (AC-2): absent targetTypes reads as the PRE-EXISTING default
  // (['profile','note']), so a pin authored before this story publishes no item list.
  const targetTypes = Array.isArray(curation.targetTypes) ? curation.targetTypes : ['profile', 'note'];
  if (!targetTypes.includes('item')) {
    return { status: 'skipped', errorReason: 'pin does not target items' };
  }
  const tagEventId = profileTags.parsePinTagEventId(pinEvent);
  if (!tagEventId) {
    return { status: 'error', errorReason: 'pin event has no referenced tag event id' };
  }
  const tag = await lookupTag(tagEventId);
  if (!tag) {
    return { status: 'error', errorReason: 'referenced tag event missing from local strfry' };
  }

  // ADR feat-tags-modernization/0001 §1 — context first (identity), then scoring.
  // search-index-selection ADR 0003 §1 — generalised to the full variant.
  const variant = variantOfPin(pinEvent, TA_PUBKEY);
  const contextSlug = variant.kind === 'context' ? variant.slug : null;

  const { povSuffix, minRank } = (deps.resolvePov || resolvePov)({ wotPov: 'user', userPubkey: observer });
  const noteMethod = curation.noteMethod || 'notes:net-endorsed';
  const sort = noteMethod === 'notes:most-applied' ? 'applied' : 'recent';
  const { fullItemMembers, itemTotal, scanTruncated } = await aggregateNotesTagged({
    tagAuthor: tag.authorPubkey, slug: tag.slug, authorities: [TA_PUBKEY],
    povSuffix, minRank, viewerPubkey: undefined, sort,
    authorConstraint, observer,
  });
  // ADR 0003 §1.7: `fullItemMembers` mixes address-keyed and id-keyed members. An id-keyed
  // member has NO coordinate and therefore cannot be an `a` member. This story adds no other
  // filter — whatever coordinate kinds the aggregation admits are what get signed (E5).
  const addressable = (fullItemMembers || []).filter((m) => typeof m.address === 'string' && m.address);
  const noteCutoff = Number.isFinite(curation.cutoff) ? curation.cutoff : 1;
  // `curateNotes` is pure over {applications, disputes, createdAt} and never reads `id`,
  // so address rows curate identically — reused verbatim, no itemMethod enum.
  const curated = curateNotes(addressable, noteMethod, noteCutoff);
  const published = curated.slice(0, ITEM_TL_MEMBER_CAP);
  const totalTrusted = Number.isFinite(itemTotal) ? itemTotal : curated.length;
  const partial = !!scanTruncated || curated.length > ITEM_TL_MEMBER_CAP;
  // AC-6: never an empty 30394 — nothing published at all when nothing qualifies.
  if (published.length === 0) {
    return { status: 'skipped', errorReason: 'no trusted item taggings' };
  }

  const dTag = itemTlDTag({
    observer, tagAuthorPubkey: tag.authorPubkey, tagSlug: tag.slug,
    ...variantKeyArgs(variant),
  });

  // ADR dlist-item-tagging/0002 — the family-wide z pair, same F1 fallback.
  const ensureHeaderDep = deps.ensureTagTLHeader || deps.ensureHeader;
  const headerResult = ensureHeaderDep
    ? await ensureHeaderDep({ tag }, deps)
    : await ensureTagTLHeader({ tag }, deps);
  const tlZTags = (headerResult && headerResult.status !== 'error')
    ? trustedListZTags({ taPubkey: TA_PUBKEY, tagSlug: tag.slug })
    : [['z', conceptTrustedList(TA_PUBKEY)]];

  try {
    const { event, uuid } = await publishTL({
      kind: 30394,
      dTag,
      title: tag.name,
      metric: 'pinned-tag-items',
      items: published.map((m) => ({ tag: 'a', value: m.address })),
      extraTags: [
        ['observer', observer],
        ['source-tag', tag.eventId, tag.authorPubkey, tag.slug],
        ['curation-method', noteMethod],
        // E1: NO `a` back-ref here — on a 30394 `a` IS the member letter, so a tag
        // coordinate would be read as a curated item. `p` is a non-member letter, so
        // {kinds:[30394], "#p":[observer]} stays an unambiguous observer axis.
        ['p', observer],
        // ADR search-index-selection/0001 §4 — the disclosure, immediately after
        // the observer axis on the item list.
        ...authorConstraintTags(authorConstraint),
        // search-index-selection ADR 0003 §2 — the recipe disclosure (see runOnePin).
        ...variantDisclosureTags(variant),
        ...tlZTags,
        ...(contextSlug ? [['z', contextHandle(TA_PUBKEY, contextSlug)]] : []),
        // Partial signal: present ⇒ NOT exhaustive, value is the true total. Absent ⇒ complete.
        ...(partial ? [['truncated', String(totalTrusted)]] : []),
      ],
      content: JSON.stringify({
        items: published.map((m) => ({ address: m.address, applications: m.applications, disputes: m.disputes })),
        ...(partial ? { partial: true, total: totalTrusted } : {}),
      }),
    });
    return { status: 'ok', dTag, memberCount: published.length, partial, uuid: uuid || (event && event.id) };
  } catch (err) {
    // Story § Rulings 1 (unified failure policy): return the d-tag so the cycle roster
    // keeps it and a transient publish failure never retracts a live list.
    return { status: 'error', dTag, errorReason: err.message };
  }
}

/**
 * search-index-selection ADR 0003 §3 layer 2 — the three Trusted-List addresses a
 * pin WOULD claim, computed without publishing anything, for the collision
 * pre-pass. Returns null for a pin that claims no address at all: one the
 * runners will reject anyway (no observer, no tag) or one C3 already skips
 * (author ≠ observer — it never owned the address, so it can collide with
 * nobody). Because all three `d`-tags derive from the same inputs, a collision
 * fires simultaneously across the 30392/30393/30394 family — one detector on the
 * 30392 address suffices.
 */
async function pinClaimedAddresses(pin, deps = {}) {
  const lookupTag = deps.lookupTag || lookupTagEvent;
  const curation = profileTags.parseCurationMethod(pin);
  const observer = curation && curation.observer;
  if (!curation || curation.method !== 'nip85:rank') return null;
  if (!isHexPubkey(observer)) return null;
  if (pin.pubkey !== observer) return null;
  const tagEventId = profileTags.parsePinTagEventId(pin);
  if (!tagEventId) return null;
  let tag = null;
  try { tag = await lookupTag(tagEventId); } catch { return null; }
  if (!tag) return null;
  const args = {
    observer,
    tagAuthorPubkey: tag.authorPubkey,
    tagSlug: tag.slug,
    ...variantKeyArgs(variantOfPin(pin, TA_PUBKEY)),
  };
  return { dTag: tlDTag(args), noteDTag: noteTlDTag(args), itemDTag: itemTlDTag(args) };
}

/**
 * Refresh every pin event in local strfry (cron path).
 * Returns { pins: [{ pinEventId, status, ... }] }
 *
 * search-index-selection ADR 0003 — SEAM 2: injectable deps
 * ({ enumeratePinnedTags, lookupTag, … }) in the house `options.deps || options`
 * shape, forwarded verbatim to the runners and to all three sweeps. Defaults
 * stay the real implementations, so every production call path is unchanged.
 */
async function refreshAllPinnedTags(options = {}) {
  const deps = options.deps || options;
  const enumerate = deps.enumeratePinnedTags || enumeratePinnedTags;
  const pins = await enumerate();
  const results = [];
  const currentDTags = [];
  const currentNoteDTags = [];
  const currentItemDTags = [];

  // ADR 0003 §3 layer 2 — the collision pre-pass. After layer 1 (C3, applied in
  // every runner) the only collisions left are RESIDUAL ones between two of the
  // observer's OWN pins: suffix ambiguity (a neutral pin on the tag `foo-v-bar`
  // vs a recipe `bar` on the tag `foo`) or an 8-char prefix collision. Between
  // two of your own pins there is no principled winner, so both are skipped and
  // logged loudly — and their `d` stays on the roster, so a list already
  // published there is NOT retracted while the ambiguity is unresolved.
  const addressesByPin = new Map();
  const pinIdsByDTag = new Map();
  for (const pin of pins) {
    const addresses = await pinClaimedAddresses(pin, deps);
    addressesByPin.set(pin.id, addresses);
    if (!addresses) continue;
    if (!pinIdsByDTag.has(addresses.dTag)) pinIdsByDTag.set(addresses.dTag, []);
    pinIdsByDTag.get(addresses.dTag).push(pin.id);
  }
  const collidedPinIds = new Set();
  for (const [dTag, pinIds] of pinIdsByDTag) {
    if (pinIds.length < 2) continue;
    console.error(`[refreshPinnedTags] pin-variant-collision: ${pinIds.length} of this observer's own pins resolve to the Trusted List address ${dTag} (pins ${pinIds.join(', ')}) — all skipped, nothing published at that address, and the address is kept on the roster so the list already there is not retracted`);
    for (const id of pinIds) collidedPinIds.add(id);
  }

  for (const pin of pins) {
    if (collidedPinIds.has(pin.id)) {
      const addresses = addressesByPin.get(pin.id);
      results.push({
        pinEventId: pin.id,
        status: 'collision',
        errorReason: 'pin-variant-collision',
        dTag: addresses.dTag,
        noteTL: { status: 'collision', dTag: addresses.noteDTag, memberCount: undefined },
        itemTL: { status: 'collision', dTag: addresses.itemDTag, memberCount: undefined },
      });
      currentDTags.push(addresses.dTag);
      currentNoteDTags.push(addresses.noteDTag);
      currentItemDTags.push(addresses.itemDTag);
      continue;
    }
    const result = await runOnePin(pin, { deps });
    // event-tagging #17: the note TL is refreshed alongside the pubkey TL for every note-targeting pin.
    const noteResult = await runOneNotePin(pin, { deps });
    // dlist-item-tagging #5: and the item TL for every item-targeting pin.
    const itemResult = await runOneItemPin(pin, { deps });
    results.push({
      pinEventId: pin.id,
      ...result,
      noteTL: { status: noteResult.status, dTag: noteResult.dTag, memberCount: noteResult.memberCount },
      itemTL: { status: itemResult.status, dTag: itemResult.dTag, memberCount: itemResult.memberCount },
    });
    // Story dlist-item-tagging #5 § Rulings 1 — ONE failure policy for every TL kind: a
    // d-tag from a FAILED publish still joins the roster, so the sweep below can never
    // retract a live list over a transient error.
    if (result.dTag) currentDTags.push(result.dTag);
    if (noteResult.dTag) currentNoteDTags.push(noteResult.dTag);
    if (itemResult.dTag) currentItemDTags.push(itemResult.dTag);
  }
  await retractStaleTLs(currentDTags, { deps });
  await retractStaleTLs(currentNoteDTags, { kind: 30393, dPrefix: 'tl-pin-notes-', deps });
  await retractStaleTLs(currentItemDTags, { kind: 30394, dPrefix: 'tl-pin-items-', deps });
  return { pins: results };
}

/**
 * Refresh only the given viewer's pins. Does NOT call retractStaleTLs —
 * single-viewer scope.
 */
async function refreshPinnedTagsForViewer(viewerPubkey) {
  const allPins = await enumeratePinnedTags();
  const pins = allPins.filter((p) => p.pubkey === viewerPubkey);
  const results = [];
  for (const pin of pins) {
    const result = await runOnePin(pin);
    const noteResult = await runOneNotePin(pin);
    const itemResult = await runOneItemPin(pin);
    results.push({
      pinEventId: pin.id,
      ...result,
      noteTL: { status: noteResult.status, dTag: noteResult.dTag, memberCount: noteResult.memberCount },
      itemTL: { status: itemResult.status, dTag: itemResult.dTag, memberCount: itemResult.memberCount },
    });
  }
  return { pins: results };
}

module.exports = {
  refreshAllPinnedTags,
  refreshPinnedTagsForViewer,
  refreshOnePinnedTagById,
  // Exported for tests:
  runOnePin,
  runOneNotePin,
  runOneItemPin,
  ensureTagTLHeader,
  retractStaleTLs,
  NOTE_TL_MEMBER_CAP,
  ITEM_TL_MEMBER_CAP,
  computeTLDTag,
  applyDisputesFunction,
};
