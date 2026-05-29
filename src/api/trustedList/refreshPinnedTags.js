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
    return { status: 'error', errorReason: `publish failed: ${err.message}` };
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
async function retractStaleTLs(currentDTags) {
  const wanted = new Set(currentDTags);
  const tls = await strfryScan({ kinds: [30392], authors: [TA_PUBKEY] });
  for (const tl of tls) {
    const dTag = dTagOf(tl);
    if (!dTag || !dTag.startsWith('tl-pin-')) continue;
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
        kind: 30392,
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
 * Refresh every pin event in local strfry (cron path).
 * Returns { pins: [{ pinEventId, status, ... }] }
 */
async function refreshAllPinnedTags() {
  const pins = await enumeratePinnedTags();
  const results = [];
  const currentDTags = [];
  for (const pin of pins) {
    const result = await runOnePin(pin);
    results.push({ pinEventId: pin.id, ...result });
    if (result.dTag) currentDTags.push(result.dTag);
  }
  await retractStaleTLs(currentDTags);
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
    results.push({ pinEventId: pin.id, ...result });
  }
  return { pins: results };
}

module.exports = {
  refreshAllPinnedTags,
  refreshPinnedTagsForViewer,
  refreshOnePinnedTagById,
  // Exported for tests:
  runOnePin,
  computeTLDTag,
  applyDisputesFunction,
};
