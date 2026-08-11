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

/**
 * Turn whatever arrives in the address into a state the page can render.
 *
 * A stale bookmark, a typo, or a hand-edited link must not produce an empty
 * table — "no rows" reads as "you have no concepts", which is a claim, not a
 * shrug. Anything unrecognised falls back to All.
 *
 * `'all'` normalises to `''` so the page can leave the parameter out of the
 * address entirely on an ordinary visit rather than writing `?state=all`
 * (ADR shared-concepts-seeding/0002).
 */
export function normalizeState(raw) {
  if (typeof raw !== 'string' || raw === '' || raw === 'all') return '';
  return STATES.some((s) => s.id === raw && s.id !== 'all') ? raw : '';
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
 *
 * BOTH publication-bearing states need this, in opposite directions. When the
 * relay cannot be asked, every declared concept resolves to `null`, so
 * `not-yet-shared` withholds them (they might be shared) and `shared` withholds
 * them too (they might not be). A `shared` list that silently shrank to nothing
 * would assert "you have shared nothing" — the one lie src/api/concept/
 * sharedByMe.js:12-21 says a completeness surface must never tell.
 *
 * The count is scoped the way its state's predicate is scoped, so the number
 * shown is the number actually missing from THAT list: `not-yet-shared` drops
 * wired and private rows because they were never candidates, while `shared`
 * counts every declaration whose fate is unknown.
 */
/**
 * How the route to the not-yet-shared list should present itself.
 *
 * **Zero is a claim of completion.** "0 waiting" tells the owner she has shared
 * everything, so it may only be said when both inputs are sound. There are
 * three ways to arrive at a zero and only one of them earns that sentence
 * (ADR shared-concepts-seeding/0002, "Honesty rules for the count"):
 *
 *   rows == null       → the population could not be read. UNKNOWN, no number.
 *   ctx.relayOk false  → publication is unconfirmed, so matchesState withholds
 *                        those rows and any count here is a LOWER BOUND —
 *                        showing it reads as "you are closer to done than you
 *                        are". UNKNOWN, no number.
 *   count === 0        → genuinely nothing waiting. CLEAR — say so rather than
 *                        presenting an errand with nothing in it.
 *   otherwise          → WAITING, with the count.
 *
 * An EMPTY population is clear; a MISSING one is unknown. Collapsing the two —
 * `(rows || [])` — is how "we could not check" turns into "you are done".
 *
 * The count comes from matchesState, the same function the destination filters
 * with, so the number and the list it advertises cannot disagree.
 *
 * @returns {{kind: 'waiting'|'clear'|'unknown', count: number|null}}
 */
export function summarizeNotYetShared(rows, ctx = {}) {
  if (!Array.isArray(rows)) return { kind: 'unknown', count: null };
  if (ctx.relayOk === false) return { kind: 'unknown', count: null };
  const count = rows.filter((row) => matchesState(row, 'not-yet-shared', ctx)).length;
  return count === 0 ? { kind: 'clear', count: 0 } : { kind: 'waiting', count };
}

export function unconfirmedCount(rows, ctx = {}, state = 'not-yet-shared') {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((row) => {
    if (!isMine(row, ctx.taPubkey)) return false;
    if (state === 'not-yet-shared') {
      const d = dispOf(row);
      if (d.wired || d.deferred) return false;
    }
    return publicationOf(row, ctx) === null;
  }).length;
}
