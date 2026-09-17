/**
 * Simple Lists (DList) per-page item counts.
 *
 * `GET /api/dlists/item-counts` answers "how many items does every list on the
 * relay hold?" by walking every kind-9999/39999 event — 39 s on a relay with
 * 455k items. The `/lists` index only ever shows 50 headers at a time, so it
 * does not need that answer: it needs a count for the 50 coordinates it is
 * about to paint. This endpoint takes those coordinates and runs one bounded
 * `strfry scan --count` per coordinate, so the cost is O(page), not O(relay).
 *
 * GET /api/dlists/page-counts?coords=<c1>&coords=<c2>…   (repeated params, ≤50)
 *   → { success, counts: { [coord]: number }, invalid: [coord…], partial: bool }
 *
 * Deliberately separate from `itemCounts.js`: that handler sits behind a
 * whole-relay validator cache and carries union `totalItems` semantics a
 * per-page slice cannot produce. The counting idiom is re-typed here so that
 * file stays byte-unchanged.
 *
 * Story: engineering-team/stories/dlist-item-tagging/9-paginate-the-lists-index.md
 */
const { spawn } = require('child_process');

/** At most one page of headers per request; over-cap is a caller bug, not a truncation. */
const MAX_COORDS = 50;
/** `strfry scan --count` spawns in flight at once. */
const CONCURRENCY = 8;
/** Whole-request budget; coordinates unresolved at the deadline are omitted and `partial` is set. */
const DEADLINE_MS = 10000;

const ITEM_KINDS = [9999, 39999];
const COORD_RE = /^39998:[0-9a-f]{64}:/;   // an empty final segment is legal (E4)
const ID_RE = /^[0-9a-f]{64}$/;

/**
 * The bounded count filter for one header key, or null if the key is malformed.
 * Shape check only — it never asks whether the list exists or who authored it.
 */
function filterForCoord(coord) {
  if (typeof coord !== 'string') return null;
  if (COORD_RE.test(coord)) return { kinds: ITEM_KINDS.slice(), '#z': [coord] };
  if (ID_RE.test(coord)) return { kinds: ITEM_KINDS.slice(), '#e': [coord] };
  return null;
}

/**
 * `strfry scan --count <filter>` as a promise of a number. Spawned with argv,
 * never a shell string. Rejects when the child cannot run or prints no number,
 * so a single coordinate's failure is isolated by the caller.
 */
function scanCountFilter(filter, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('strfry', ['scan', '--count', JSON.stringify(filter)], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    let timer = null;
    if (opts.timeoutMs > 0) {
      timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) { /* already gone */ } }, opts.timeoutMs);
    }
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', () => {
      clearTimeout(timer);
      const v = parseInt(out.trim(), 10);
      if (Number.isNaN(v)) reject(new Error('strfry scan --count returned no number'));
      else resolve(v);
    });
  });
}

/**
 * Count each coordinate, at most CONCURRENCY at a time, within the deadline.
 *
 * @param {string[]} coords header coordinates / event ids (de-duped, capped here)
 * @param {{countFilter?: Function, deadlineMs?: number}} deps test seam
 * @returns {Promise<{counts: object, invalid: string[], partial: boolean}>}
 */
async function countsForCoords(coords, deps = {}) {
  const countFilter = deps.countFilter || scanCountFilter;
  const deadlineMs = Number.isFinite(deps.deadlineMs) ? deps.deadlineMs : DEADLINE_MS;

  const seen = new Set();
  const unique = [];
  for (const c of Array.isArray(coords) ? coords : []) {
    if (typeof c !== 'string' || seen.has(c)) continue;    // E8: one scan, one key
    seen.add(c);
    unique.push(c);
  }
  const capped = unique.slice(0, MAX_COORDS);

  const invalid = [];
  const valid = [];
  for (const c of capped) (filterForCoord(c) ? valid : invalid).push(c);

  const counts = {};
  const total = valid.length;
  let next = 0;
  let finished = 0;

  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  if (total === 0) resolveDone();

  async function worker() {
    while (next < total) {
      const coord = valid[next++];
      try {
        const n = await countFilter(filterForCoord(coord), { timeoutMs: deadlineMs });
        if (Number.isFinite(n)) counts[coord] = n;
      } catch (e) {
        // Per-coordinate failure isolation: no key, so the client renders —.
      }
      finished++;
      if (finished === total) resolveDone();
    }
  }
  for (let i = 0; i < Math.min(CONCURRENCY, total); i++) worker();

  let timer = null;
  const deadline = new Promise((r) => { timer = setTimeout(r, deadlineMs); });
  await Promise.race([done, deadline]);
  clearTimeout(timer);

  return { counts, invalid, partial: finished < total };
}

/**
 * GET /api/dlists/page-counts — public, read-only.
 * 400 is reserved for the request-level failures: coords missing/empty, more
 * than MAX_COORDS, or every coordinate malformed. One bad coordinate among
 * good ones is reported per-coordinate in `invalid` instead.
 */
async function handleListPageCounts(req, res, deps) {
  try {
    const raw = req && req.query ? req.query.coords : undefined;
    let coords = null;
    if (Array.isArray(raw)) coords = raw.filter((c) => typeof c === 'string' && c !== '');
    else if (typeof raw === 'string' && raw !== '') coords = [raw];

    if (!coords || coords.length === 0) {
      return res.status(400).json({ success: false, error: 'coords is required' });
    }
    if (coords.length > MAX_COORDS) {
      return res.status(400).json({ success: false, error: `at most ${MAX_COORDS} coordinates per request` });
    }
    if (!coords.some((c) => filterForCoord(c))) {
      return res.status(400).json({ success: false, error: 'no well-formed coordinate in coords' });
    }

    const out = await countsForCoords(coords, deps || {});
    return res.json({
      success: true,
      counts: { ...out.counts },
      invalid: out.invalid,
      partial: out.partial,
    });
  } catch (err) {
    console.error('[dlists/page-counts] error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleListPageCounts,
  countsForCoords,
  MAX_COORDS,
  CONCURRENCY,
  DEADLINE_MS,
};
