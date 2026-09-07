/**
 * Strfry scan API endpoint.
 * Runs `strfry scan <filter>` and returns parsed JSON events.
 *
 * The scan STREAMS and stops at a bound. It used to `exec` the command into a
 * fixed 10 MB buffer, which meant a relay holding enough events failed outright
 * with "stdout maxBuffer length exceeded" instead of returning data — the whole
 * result or nothing. A bounded response that declares its own truncation is the
 * house pattern for this (ADR event-tagging/0017: complete, or explicitly
 * partial — never silently small-capped).
 *
 * See engineering-team/decisions/relay-scan-bounds/0001-*.md
 */
const { spawn } = require('child_process');

/** Never assemble more than this many events, whatever the caller asks for. */
const SCAN_MAX_EVENTS = 20000;

/** Nor more than this many bytes of stdout. 10 MB is the ceiling this endpoint
 *  has always had — keeping it means every request that succeeded before still
 *  succeeds, byte for byte. Past it, we now truncate and say so. */
const SCAN_MAX_BYTES = 10 * 1024 * 1024;

/**
 * `strfry scan --count <filter>`, with any `limit` stripped so the answer is the
 * true size of the match rather than the size of the bounded slice.
 */
function countMatching(filter) {
  return new Promise((resolve) => {
    const { limit, ...unlimited } = filter;
    const proc = spawn('strfry', ['scan', '--count', JSON.stringify(unlimited)], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', () => {
      const n = parseInt(out.trim(), 10);
      resolve(Number.isNaN(n) ? null : n);
    });
  });
}

/**
 * Decide what a finished read should report.
 *
 * Split out because the interesting case is the one that is awkward to reach
 * from the outside: we stopped early AND could not learn the true total. The
 * read still *knows* it stopped, so the honest answer is "partial, size
 * unknown" — never "complete". Passing the bounded length off as the total
 * would produce "showing 500 of 500, truncated", and dropping the truncation
 * flag would recreate the silent partial this endpoint exists to remove.
 *
 * @param {{bounded: boolean, counted: number|null, received: number}} o
 * @returns {{total: number|null, truncated: boolean}}
 */
function resolveTotal({ bounded, counted, received }) {
  if (!bounded) return { total: received, truncated: false };
  if (counted === null) return { total: null, truncated: true };
  return { total: counted, truncated: counted > received };
}

/**
 * GET /api/strfry/scan?filter=<json-filter>
 * Returns { success: true, events, count, total, truncated, limit }.
 *
 * `events` and `count` keep their original meaning, so callers that read only
 * those are unaffected. `truncated` says whether `events` is all of them.
 * `total` is the true number of matching events, or **null** when the read was
 * bounded and the count could not be read — unknown, never guessed.
 */
function handleStrfryScan(req, res) {
  const filterParam = req.query.filter || '{}';

  let filter;
  try {
    filter = JSON.parse(filterParam);
  } catch (e) {
    return res.json({ success: false, error: 'Invalid filter JSON' });
  }

  const asked = Number.isInteger(filter.limit) && filter.limit > 0 ? filter.limit : SCAN_MAX_EVENTS;
  const effectiveLimit = Math.min(asked, SCAN_MAX_EVENTS);

  // argv, not a shell string — no quoting to get wrong and nothing to inject into.
  const proc = spawn('strfry', ['scan', JSON.stringify(filter)], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  const events = [];
  let buf = '';
  let bytes = 0;
  let bounded = false;   // we stopped early rather than reading to the end
  let settled = false;

  function stop() {
    if (bounded) return;
    bounded = true;
    proc.kill('SIGTERM');
  }

  proc.stdout.on('data', (chunk) => {
    if (bounded) return;
    bytes += chunk.length;
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        events.push(JSON.parse(line));
      } catch (e) {
        // skip unparseable lines (e.g. strfry log output)
        continue;
      }
      if (events.length >= effectiveLimit) return stop();
    }
    if (bytes >= SCAN_MAX_BYTES) stop();
  });

  proc.on('error', (err) => {
    if (settled) return;
    settled = true;
    console.error('strfry scan error:', err.message);
    res.json({ success: false, error: err.message });
  });

  proc.on('close', async () => {
    if (settled) return;
    settled = true;

    // A trailing line with no newline (only reachable when we read to the end).
    if (!bounded && buf.trim()) {
      try { events.push(JSON.parse(buf)); } catch (e) { /* not an event */ }
    }

    // Reading to the end IS the total; only a bounded read has to go ask.
    const counted = bounded ? await countMatching(filter) : null;
    const { total, truncated } = resolveTotal({
      bounded,
      counted,
      received: events.length,
    });

    res.json({
      success: true,
      events,
      count: events.length,
      total,
      truncated,
      limit: effectiveLimit,
    });
  });
}

module.exports = { handleStrfryScan, resolveTotal, SCAN_MAX_EVENTS, SCAN_MAX_BYTES };
