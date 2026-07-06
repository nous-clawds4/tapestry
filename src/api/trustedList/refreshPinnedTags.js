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
const { curateNotes } = require('../../lib/event-tagging');

const TA_PUBKEY = profileTags.TA_PUBKEY;
const TAG_PINNING_Z_TAG = profileTags.TAG_PINNING_Z_TAG;

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

function computeTLDTag({ observer, tagAuthorPubkey, tagSlug }) {
  return `tl-pin-${observer.slice(0, 8)}-${tagAuthorPubkey.slice(0, 8)}-${tagSlug}`;
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
 * Refresh one pinned-tag's TL.
 * Returns { status, error?, errorReason?, tlEventId?, dTag?, memberCount? }.
 */
async function runOnePin(pinEvent) {
  const curation = profileTags.parseCurationMethod(pinEvent);
  if (!curation || curation.method !== 'nip85:rank') {
    return { status: 'unsupported', errorReason: 'curation method not supported in v1' };
  }
  const observer = curation.observer;
  if (!isHexPubkey(observer)) {
    return { status: 'error', errorReason: 'observer pubkey missing or malformed' };
  }
  const tagEventId = profileTags.parsePinTagEventId(pinEvent);
  if (!tagEventId) {
    return { status: 'error', errorReason: 'pin event has no referenced tag event id' };
  }

  const tag = await lookupTagEvent(tagEventId);
  if (!tag) {
    return { status: 'error', errorReason: 'referenced tag event missing from local strfry' };
  }

  // POV resolution: pass observer through the same cascade
  // handleProfilesTagged uses. When no POV is configured (no
  // povSuffix or no minRank), the aggregation falls back to "all
  // assertions count" — same semantic the rest of the codebase uses.
  // The disputes function (cutoff + endorsements>disputes) still applies.
  const { povSuffix, minRank } = resolvePov({ wotPov: 'user', userPubkey: observer });
  // Story 21 / ADR 0019 AC-21: default cutoff is 1 when none is set (the
  // client's defaultCurationMethod already sends 1; this server fallback
  // now matches). An explicit finite cutoff is still honored unchanged.
  const cutoff = Number.isFinite(curation.cutoff) ? curation.cutoff : 1;
  const minRankForTag = Number.isFinite(minRank) ? minRank : 0;

  const { byTarget } = await profileTags.aggregateProfilesTagged({
    tagEventId, povSuffix, minRank,
  });
  const members = applyDisputesFunction(byTarget, cutoff);

  // Story 12 / ADR 0011 AC-7: enrich members with their wot_rank score
  // when the pin requested includeScoreInTL AND the observer's POV is
  // resolvable. AC-8: degrade silently when POV is unresolvable
  // (povSuffix null) — members still publish without scores.
  if (curation.includeScoreInTL === true && povSuffix) {
    try {
      const memberPubkeys = members.map((m) => m.pubkey);
      if (memberPubkeys.length > 0) {
        const memberDocs = await profileTags.meiliFetchProfilesByPubkey(memberPubkeys);
        const rankField = `wot_rank_${povSuffix}`;
        for (const m of members) {
          const doc = memberDocs.get(m.pubkey);
          if (doc && typeof doc[rankField] === 'number') {
            m.score = doc[rankField];
          }
        }
      }
    } catch {
      // Meili unreachable / lookup failed → degrade silently; members
      // still publish without scores.
    }
  }

  const dTag = computeTLDTag({
    observer, tagAuthorPubkey: tag.authorPubkey, tagSlug: tag.slug,
  });

  try {
    const { event } = await buildAndPublishTL({
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
  return await runOnePin(pin);
}

/**
 * Diff strfry: any TA-signed kind-30392 with a `tl-pin-` d-tag whose
 * (observer, tagAuthor, tagSlug) doesn't match a current pin must be
 * retracted via an empty-membership replacement. Idempotent — already-
 * retracted slots are skipped via the marker check.
 */
async function retractStaleTLs(currentDTags, { kind = 30392, dPrefix = 'tl-pin-' } = {}) {
  const wanted = new Set(currentDTags);
  const tls = await strfryScan({ kinds: [kind], authors: [TA_PUBKEY] });
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
    const carryOver = (tl.tags || []).filter((t) =>
      t[0] === 'title' || t[0] === 'metric' || t[0] === 'observer' || t[0] === 'source-tag'
    );
    try {
      await buildAndPublishTL({
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

  // Observer POV (same cascade as runOnePin) → the aggregation's trust filter.
  const { povSuffix, minRank } = resolvePov({ wotPov: 'user', userPubkey: observer });
  const noteMethod = curation.noteMethod || 'notes:net-endorsed';
  // Align the NOTES_CAP ranking with the curation so the cap keeps the notes the
  // method would surface (inherits the NOTES_CAP window; ADR 0015 follow-up).
  const sort = noteMethod === 'notes:most-applied' ? 'applied' : 'recent';
  const { members } = await aggregateNotesTagged({
    tagAuthor: tag.authorPubkey, slug: tag.slug, authorities: [TA_PUBKEY],
    povSuffix, minRank, viewerPubkey: undefined, sort,
  });
  const curated = curateNotes(members || [], noteMethod);
  const dTag = `tl-pin-notes-${observer.slice(0, 8)}-${tag.authorPubkey.slice(0, 8)}-${tag.slug}`;

  try {
    const { event, uuid } = await publishTL({
      kind: 30393,
      dTag,
      title: tag.name,
      metric: 'pinned-tag-notes',
      items: curated.map((n) => ({ tag: 'e', value: n.id })),
      extraTags: [
        ['observer', observer],
        ['source-tag', tag.eventId, tag.authorPubkey, tag.slug],
        ['curation-method', noteMethod],
      ],
      content: JSON.stringify({ notes: curated.map((n) => ({ id: n.id, applications: n.applications, disputes: n.disputes })) }),
    });
    return { status: 'ok', dTag, memberCount: curated.length, uuid: uuid || (event && event.id) };
  } catch (err) {
    return { status: 'error', dTag, errorReason: err.message };
  }
}

/**
 * Refresh every pin event in local strfry (cron path).
 * Returns { pins: [{ pinEventId, status, ... }] }
 */
async function refreshAllPinnedTags() {
  const pins = await enumeratePinnedTags();
  const results = [];
  const currentDTags = [];
  const currentNoteDTags = [];
  for (const pin of pins) {
    const result = await runOnePin(pin);
    // event-tagging #17: the note TL is refreshed alongside the pubkey TL for every note-targeting pin.
    const noteResult = await runOneNotePin(pin);
    results.push({ pinEventId: pin.id, ...result, noteTL: { status: noteResult.status, dTag: noteResult.dTag, memberCount: noteResult.memberCount } });
    if (result.dTag) currentDTags.push(result.dTag);
    if (noteResult.dTag && noteResult.status === 'ok') currentNoteDTags.push(noteResult.dTag);
  }
  await retractStaleTLs(currentDTags);
  await retractStaleTLs(currentNoteDTags, { kind: 30393, dPrefix: 'tl-pin-notes-' });
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
    results.push({ pinEventId: pin.id, ...result, noteTL: { status: noteResult.status, dTag: noteResult.dTag, memberCount: noteResult.memberCount } });
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
  computeTLDTag,
  applyDisputesFunction,
};
