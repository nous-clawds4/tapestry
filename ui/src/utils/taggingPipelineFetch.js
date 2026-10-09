/**
 * The Tagging pipeline panel's request primitives (tagging-edges Story 4 /
 * ADR 0004 § UI, § Clarifications T7; Story 5 / ADR 0005 D12). Every section
 * of the panel reads its route through readSection, so each section loads,
 * fails and retries on its own, and a failure always arrives as a short code,
 * never as raw text or a stack trace (a non-2xx answer's parsed JSON rides
 * along only for /held's latestRunId and the switch's failure code). Plain
 * ESM in Node 16 syntax so the Node harness can dynamic-import it; it can't
 * parse JSX (the nextTaskCountdown precedent).
 *
 * Every request is a GET but one: sendSwitch's POST, the real-time path's
 * switch (story 5). Both share one race, so the switch's 15 s limit is the
 * reads' own.
 */

const SWITCH_PATH = '/api/tagging-edges/realtime/switch';

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
 * The time-out is this module's own timer racing the whole read, the body
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
  return raced(timeoutMs, (signal) => attempt(url, fetchImpl, { method: 'GET', signal }));
}

/**
 * Turn the real-time path on or off (ADR 0005 D12): one POST of `{"on":…}` as
 * JSON to the switch route, with the default same-origin credentials. It
 * resolves readSection's result shapes, through the same race and the same
 * 15 s default, so an answer that never comes ends as `timeout`. It is never
 * retried, and the promise never rejects.
 *
 * @param {boolean} on
 * @param {{ fetchImpl?: Function, timeoutMs?: number }} [opts]
 */
export async function sendSwitch(on, opts) {
  const { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = opts || {};
  return raced(timeoutMs, (signal) => attempt(SWITCH_PATH, fetchImpl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on }),
    signal,
  }));
}

/** Race one request against `timeoutMs`; the request gets the abort signal the time-out fires. */
async function raced(timeoutMs, request) {
  const controller = new AbortController();
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => {
      // Settle as timeout first, so a fetchImpl that rejects on abort can't
      // turn this request into `network`.
      resolve(failure('timeout'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([request(controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function attempt(url, fetchImpl, init) {
  let res;
  let text;
  try {
    res = await fetchImpl(url, init);
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
