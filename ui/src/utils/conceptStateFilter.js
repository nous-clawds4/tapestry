/**
 * The Concepts list's state filter — which of my concepts have reached the
 * community, and which haven't.
 * (Story shared-concepts-seeding #3, ADR shared-concepts-seeding/0001.)
 *
 * Dependency-free on purpose: the predicate is data in, boolean out, so it can
 * be exercised without a browser (the ui/src/utils/bDisposition.js shape, and
 * the "pure core" split of ADR firmware-explorer/0001). The page renders this;
 * it does not own it.
 *
 * "Shared" means PUBLISHED TO A PUBLIC RELAY — a local self-declaration is not
 * enough (owner ruling; the concept graph's own definition of `shared-concept`).
 * So publication is never derived here: `ctx.publishedByCoord` carries the
 * already-resolved answer from /api/shared-by-me, which computes it in
 * src/lib/sharingState.js — the rule's only home. A concept ABSENT from that map
 * was never declared, and is therefore knowably not shared.
 *
 * `published` is tri-state and `null` never collapses to `false`: reporting
 * "not shared" on the strength of a check that failed to run is the defect the
 * legibility book removed, and re-introducing it here would put a second,
 * contradicting answer on a second page.
 */

/**
 * The states the Coverage select offers, in display order.
 *
 * `needsPublication` is what lets the page avoid paying for a relay round trip
 * on every visit: only these two states require /api/shared-by-me, so the rest
 * answer instantly from the row's own disposition.
 */
export const STATES = [
  { id: 'all', label: 'All states', needsPublication: false },
  { id: 'not-yet-shared', label: 'Not yet shared (mine)', needsPublication: true },
  { id: 'undispositioned', label: 'Undispositioned (mine)', needsPublication: false },
  { id: 'shared', label: 'Shared (mine)', needsPublication: true },
  { id: 'wired', label: 'Wired to external', needsPublication: false },
  { id: 'private', label: 'Deliberately private', needsPublication: false },
];

/** Does this state need publication data before it can answer? */
export function needsPublication(state) {
  const s = STATES.find((x) => x.id === state);
  return Boolean(s && s.needsPublication);
}

const dispOf = (row) => (row && row._disp) || {};

/** Mine = authored by this instance's TA, matching the existing "(mine)" scoping. */
function isMine(row, taPubkey) {
  return Boolean(row && taPubkey && row.author === taPubkey);
}

/**
 * Publication for a row, as /api/shared-by-me reported it.
 * `undefined` = not in the response at all = never declared.
 */
function publicationOf(row, ctx) {
  const map = ctx && ctx.publishedByCoord;
  if (!map || typeof map.get !== 'function') return undefined;
  return map.get(row && row.uuid);
}

/**
 * Is this row part of the seeding work-list?
 *
 * Ratified at the story's Planning gate: wired and deliberately-private
 * concepts are EXCLUDED. Both are decisions the owner already made — wired is
 * already affiliated with the community, private is a deliberate no — so
 * listing either makes the work-list noisier every time it is used.
 *
 * What remains is "undispositioned, plus tried-but-didn't-reach". The second
 * group is the important one: it carries a self-declaration, so a filter built
 * on the disposition chip would call it shared and drop it.
 */
function isNotYetShared(row, ctx) {
  if (!isMine(row, ctx && ctx.taPubkey)) return false;
  const d = dispOf(row);
  if (d.wired || d.deferred) return false;

  const published = publicationOf(row, ctx);
  if (published === undefined) return true;  // never declared → knowably not shared
  if (published === null) return false;      // could not be confirmed → never call it not-shared
  return published === false;                // declared, but it did not land → retry
}

/** Confirmed on the community relay. Unconfirmed is not shared, and not "not shared". */
function isShared(row, ctx) {
  if (!isMine(row, ctx && ctx.taPubkey)) return false;
  return publicationOf(row, ctx) === true;
}

/** No b tag at all — the DispositionPanel's prompt set. Unchanged by this story. */
function isUndispositioned(row, ctx) {
  if (!isMine(row, ctx && ctx.taPubkey)) return false;
  const d = dispOf(row);
  return !d.wired && !d.selfDeclared && !d.deferred;
}

/**
 * Does `row` belong under `state`?
 *
 * @param {object} row    a Concepts-list row: {uuid (a-tag coord), author, _disp}
 * @param {string} state  one of STATES[].id
 * @param {object} ctx    {taPubkey, publishedByCoord: Map<coord, boolean|null>, relayOk}
 * @returns {boolean}
 */
export function matchesState(row, state, ctx = {}) {
  switch (state) {
    case 'not-yet-shared': return isNotYetShared(row, ctx);
    case 'shared': return isShared(row, ctx);
    case 'undispositioned': return isUndispositioned(row, ctx);
    case 'wired': return Boolean(dispOf(row).wired);
    case 'private': return Boolean(dispOf(row).deferred);
    case 'all':
    case '':
    case undefined:
    case null:
      return true;
    default:
      return true; // an unknown state must not silently hide rows
  }
}

/**
 * How many of a row set are being withheld because publication could not be
 * confirmed — the count the page shows so an unreachable relay is visible
 * rather than silently shrinking the list.
 */
export function unconfirmedCount(rows, ctx = {}) {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((row) => {
    if (!isMine(row, ctx.taPubkey)) return false;
    const d = dispOf(row);
    if (d.wired || d.deferred) return false;
    return publicationOf(row, ctx) === null;
  }).length;
}
