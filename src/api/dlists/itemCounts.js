/**
 * Simple Lists (DList) item counts.
 *
 * The List Headers page shows, per list, how many items it holds — and a total
 * across every list. It used to get both by fetching every kind-9999/39999
 * event on the relay into the browser and tallying there: hundreds of megabytes
 * moved to produce a few hundred integers, and an outright failure once the
 * relay outgrew the scan buffer.
 *
 * Two figures, two rules, deliberately not additive:
 *
 *   per-list count  — set membership. An item belonging to two lists counts in
 *                     BOTH. (The old client took only an item's FIRST z tag, so
 *                     it undercounted every item in more than one list.)
 *   total           — the union. That same item counts ONCE.
 *
 * So two lists of ten sharing five items read 10, 10, and a total of 15.
 *
 * See engineering-team/decisions/relay-scan-bounds/0001-*.md
 */
const { spawn } = require('child_process');

const HEADER_FILTER = { kinds: [9998, 39998] };
const ITEM_FILTER = { kinds: [9999, 39999] };

/**
 * The counting rule, as a streaming accumulator — events go in one at a time so
 * nothing has to hold the relay in memory.
 *
 * @param {Iterable<string>} headerRefs the parent refs the page has rows for
 * @returns {{ add: (event) => void, result: () => object }}
 */
function createTally(headerRefs) {
  const refs = headerRefs instanceof Set ? headerRefs : new Set(headerRefs);
  const counts = Object.create(null);
  let totalItems = 0;
  let scannedItems = 0;

  return {
    add(event) {
      scannedItems++;
      const tags = (event && event.tags) || [];
      // Distinct, so a list named twice on one item is still one membership.
      const named = new Set();
      for (const t of tags) {
        if ((t[0] === 'z' || t[0] === 'e') && refs.has(t[1])) named.add(t[1]);
      }
      if (named.size === 0) return;       // in no list we show — unattached
      for (const ref of named) counts[ref] = (counts[ref] || 0) + 1;
      totalItems++;                        // once, however many lists it is in
    },
    result() {
      return {
        counts: { ...counts },
        totalItems,
        scannedItems,
        unattached: scannedItems - totalItems,
      };
    },
  };
}

/** The parent ref a list header is referenced by: a coordinate for the
 *  addressable kind, the event id for the plain one. */
function headerRef(ev) {
  if (ev.kind === 39998) {
    const d = (ev.tags.find((t) => t[0] === 'd') || [])[1];
    return `39998:${ev.pubkey}:${d}`;
  }
  return ev.id;
}

/** Run `strfry scan` and hand each parsed event to `onEvent`. Resolves with the
 *  number of lines that parsed. Never buffers the whole result. */
function streamScan(filter, onEvent) {
  return new Promise((resolve, reject) => {
    const proc = spawn('strfry', ['scan', JSON.stringify(filter)], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let buf = '';
    let n = 0;
    const consume = (line) => {
      if (!line) return;
      let ev;
      try { ev = JSON.parse(line); } catch (e) { return; }
      n++;
      onEvent(ev);
    };
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        consume(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    });
    proc.on('error', reject);
    proc.on('close', () => { consume(buf.trim()); resolve(n); });
  });
}

/** `strfry scan --count <filter>`, or null if it could not be read. */
function scanCount(filter) {
  return new Promise((resolve) => {
    const proc = spawn('strfry', ['scan', '--count', JSON.stringify(filter)], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', () => {
      const v = parseInt(out.trim(), 10);
      resolve(Number.isNaN(v) ? null : v);
    });
  });
}

/** The `created_at` of the newest event matching a filter (strfry returns
 *  newest first), or null. */
function newestCreatedAt(filter) {
  return new Promise((resolve) => {
    const proc = spawn('strfry', ['scan', JSON.stringify({ ...filter, limit: 1 })], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', () => {
      const line = out.trim().split('\n')[0];
      if (!line) return resolve(null);
      try { resolve(JSON.parse(line).created_at ?? null); } catch (e) { resolve(null); }
    });
  });
}

/**
 * The full pass costs one read of every list item, so it is cached behind a
 * cheap validator: the item count, the newest item's timestamp, and the header
 * count. All three unchanged means nothing that affects the tally has moved.
 */
let cache = null;   // { validator: {items, newest, headers}, payload }

async function readValidator() {
  const [items, newest, headers] = await Promise.all([
    scanCount(ITEM_FILTER),
    newestCreatedAt(ITEM_FILTER),
    scanCount(HEADER_FILTER),
  ]);
  return { items, newest, headers };
}

function validatorMatches(a, b) {
  return a && b
    && a.items !== null && a.items === b.items
    && a.newest === b.newest
    && a.headers !== null && a.headers === b.headers;
}

async function computeItemCounts() {
  const refs = new Set();
  await streamScan(HEADER_FILTER, (ev) => { refs.add(headerRef(ev)); });

  const tally = createTally(refs);
  await streamScan(ITEM_FILTER, (ev) => tally.add(ev));

  return { ...tally.result(), headers: refs.size };
}

/**
 * GET /api/dlists/item-counts
 * Returns { success, counts, headers, totalItems, scannedItems, unattached, cached }.
 */
async function handleListItemCounts(req, res) {
  try {
    const validator = await readValidator();
    if (cache && validatorMatches(validator, cache.validator)) {
      return res.json({ success: true, ...cache.payload, cached: true });
    }
    const payload = await computeItemCounts();
    cache = { validator, payload };
    res.json({ success: true, ...payload, cached: false });
  } catch (err) {
    console.error('[dlists/item-counts] error:', err.message);
    res.json({ success: false, error: err.message });
  }
}

module.exports = { handleListItemCounts, createTally };
