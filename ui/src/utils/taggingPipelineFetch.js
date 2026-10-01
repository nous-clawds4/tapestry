/**
 * The Tagging pipeline panel's one read primitive (tagging-edges Story 4 /
 * ADR 0004 § UI, § Clarifications T7). Every section of the panel reads its
 * route through readSection, so each section loads, fails and retries on its
 * own, and a failure always arrives as a short code, never as raw text or a
 * stack trace (a non-2xx answer's parsed JSON rides along only for /held's
 * latestRunId). Plain ESM in Node 16 syntax so the Node harness can
 * dynamic-import it; it can't parse JSX (the nextTaskCountdown precedent).
 *
 * Every request is a GET: the panel only reads.
 */

/**
 * Read one section's route.
 *
 * - `{ ok: true, body }` only for a 2xx whose JSON is a plain object. The
 *   body's own `success` flag is never read: judging it is the section's job.
 * - Otherwise `{ ok: false, code, httpStatus, body }`, with code one of
 *   `http-<status>`, `network`, `timeout` or `bad-json`. `body` is the parsed
 *   JSON of a non-2xx answer when it parses (used only for /held's
 *   latestRunId, never rendered raw), else null. `httpStatus` and `body` are
 *   null for `network` and `timeout`.
 *
 * The time-out is this function's own timer racing the whole read, the body
 * included, so a fetchImpl that ignores `signal` still ends as `timeout`.
 * The 15 s default leaves the server's 10 s count its margin. fetchImpl is
 * called exactly once; nothing is retried; the promise never rejects.
 *
 * @param {string} url
 * @param {{ fetchImpl?: Function, timeoutMs?: number }} [opts] — fetchImpl
 *   defaults to the global fetch as it is at call time (never at import).
 * @returns {Promise<{ ok: true, body: object } |
 *   { ok: false, code: string, httpStatus: number|null, body: * }>}
 */
export async function readSection(url, opts) {
  // `opts || {}` rather than a default parameter, so a null opts still resolves.
  const { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = opts || {};
  const controller = new AbortController();
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => {
      // Settle as timeout first, so a fetchImpl that rejects on abort can't
      // turn this read into `network`.
      resolve(failure('timeout'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([attempt(url, fetchImpl, controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function attempt(url, fetchImpl, signal) {
  let res;
  let text;
  try {
    res = await fetchImpl(url, { method: 'GET', signal });
    text = await res.text();
  } catch {
    // No answer, or an answer whose body could not be read.
    return failure('network');
  }

  let parsed;
  let parses = true;
  try {
    parsed = JSON.parse(text);
  } catch {
    parses = false;
  }

  const status = res.status;
  if (!(status >= 200 && status <= 299)) {
    return failure(`http-${status}`, status, parses ? parsed : null);
  }
  if (parses && isPlainObject(parsed)) return { ok: true, body: parsed };
  return failure('bad-json', status, null);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function failure(code, httpStatus = null, body = null) {
  return { ok: false, code, httpStatus, body };
}
