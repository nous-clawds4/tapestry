/**
 * Tests for tagging-edges Story 4 — the tagging pipeline panel's section reader.
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md
 *        (§ Implementation notes → § UI, `ui/src/utils/taggingPipelineFetch.js`; § Clarifications T7)
 *
 * TF — unit tests of readSection(url, { fetchImpl, timeoutMs }) from
 *      ui/src/utils/taggingPipelineFetch.js, loaded by import() (the
 *      next-task-countdown precedent: the node harness cannot parse JSX, so
 *      the panel's read logic lives in a plain-ESM util). Every test drives
 *      an injected fake fetchImpl that answers minimal Response-like objects
 *      ({ ok, status, text() }); no request leaves the process.
 *
 * TF20–TF24 — tagging-edges Story 5 (engineering-team/stories/tagging-edges/5-real-time-path-switch.md; ADR
 *      engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md D12 and § Seams "The fetch util"):
 *      sendSwitch(on, { fetchImpl, timeoutMs = 15000 }), the panel's one POST. It sends exactly one request to
 *      /api/tagging-edges/realtime/switch, shares readSection's race, resolves readSection's result shapes and never
 *      rejects. readSection is untouched, so TF1 (every read sends GET) stands as it is. Each TF20+ test fails by
 *      name through loadSwitch() until the module exports sendSwitch.
 *
 * Stack-free; runs on Node 16 (the host gate, no global fetch) and Node 22.
 * RED until the module exists: each test fails by name through loadFetch().
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.join(__dirname, '..');
const MODULE_REL = 'ui/src/utils/taggingPipelineFetch.js';
const MODULE_ABS = path.join(REPO_ROOT, MODULE_REL);

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function show(v) {
  try { return JSON.stringify(v); } catch (_e) { return String(v); }
}
function sameJson(a, b) { return show(a) === show(b); }

async function loadFetch(bust) {
  if (!fs.existsSync(MODULE_ABS)) {
    throw new Error(
      `${MODULE_REL} not implemented yet: it does not export readSection (ADR 0004 § UI — ` +
      `readSection(url, { fetchImpl = globalThis.fetch, timeoutMs = 15000 }), plain ESM, Node 16 syntax)`
    );
  }
  let mod;
  try {
    const href = pathToFileURL(MODULE_ABS).href + (bust ? `?tf=${bust}` : '');
    mod = await import(href);
  } catch (e) {
    throw new Error(
      `${MODULE_REL} is not importable by node: it must be plain ESM .js with no JSX and no React, ` +
      `in Node 16 syntax, and must not touch fetch at import time (ADR 0004 § UI). (${e.message})`
    );
  }
  if (typeof mod.readSection !== 'function') {
    throw new Error(
      `${MODULE_REL} not implemented yet: it does not export readSection (ADR 0004 § UI)`
    );
  }
  return mod;
}

/** Bound every readSection call so a hanging implementation fails its test instead of the suite. */
function guarded(promise, ms, what) {
  let timer;
  const guard = new Promise((_res, rej) => {
    timer = setTimeout(() => rej(new Error(`${what} did not settle within ${ms} ms`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

/* ─── Fakes ─── */

/** A minimal Response-like object: ok, status, text(). */
function response(status, text) {
  return {
    ok: status >= 200 && status <= 299,
    status,
    text: async () => text,
  };
}

/** A fetchImpl that records its calls and answers `answer` (a response, or a function of the call). */
function fakeFetch(answer) {
  const calls = [];
  const impl = (...args) => {
    calls.push(args);
    return Promise.resolve(typeof answer === 'function' ? answer(...args) : answer);
  };
  impl.calls = calls;
  return impl;
}

async function read(mod, url, opts, ms = 2000) {
  return guarded(mod.readSection(url, opts), ms, `readSection(${show(url)})`);
}

function expectFailure(out, code, httpStatus, label) {
  assert(out && typeof out === 'object', `${label}: readSection must resolve to an object; got ${show(out)}`);
  assert(out.ok === false, `${label}: expected ok: false; got ${show(out)}`);
  assert(out.code === code, `${label}: expected code ${show(code)}; got ${show(out.code)} (whole result ${show(out)})`);
  assert(out.httpStatus === httpStatus,
    `${label}: expected httpStatus ${show(httpStatus)}; got ${show(out.httpStatus)} (whole result ${show(out)})`);
}

const STATUS_URL = '/api/tagging-edges/status';
const HELD_URL = '/api/tagging-edges/held?runId=run-1&offset=0&limit=50';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

/* ───────────────────────── TF — readSection ───────────────────────── */

test('TF1: readSection calls the given fetchImpl exactly once, with the url unchanged and { method: \'GET\', signal } where signal is an abort signal [AC-1 "changes nothing", AC-5; ADR 0004 § UI (taggingPipelineFetch.js)]', async () => {
  const mod = await loadFetch();
  const f = fakeFetch(response(200, '{"running":false}'));
  await read(mod, HELD_URL, { fetchImpl: f });
  assert(f.calls.length === 1, `expected fetchImpl to be called exactly once; it was called ${f.calls.length} times`);
  const [url, init] = f.calls[0];
  assert(url === HELD_URL, `expected fetchImpl's first argument to be the url as given (${show(HELD_URL)}); got ${show(url)}`);
  assert(init && typeof init === 'object', `expected a second argument { method, signal }; got ${show(init)}`);
  assert(init.method === 'GET', `expected method 'GET' (every request the panel sends is a GET); got ${show(init.method)}`);
  const sig = init.signal;
  assert(sig && typeof sig === 'object' && typeof sig.aborted === 'boolean' && typeof sig.addEventListener === 'function',
    `expected init.signal to be an AbortSignal (an AbortController's signal); got ${show(sig)}`);
  assert(sig.aborted === false, 'the signal handed to fetchImpl must not already be aborted');
});

test('TF2: a 2xx answer whose JSON is a plain object resolves to { ok: true, body } with body the parsed object, for 200 and for another 2xx [AC-5; ADR 0004 § UI]', async () => {
  const mod = await loadFetch();
  for (const status of [200, 203]) {
    const payload = { running: false, latest: { runId: 'run-1', outcome: 'done' }, previous: [] };
    const f = fakeFetch(response(status, JSON.stringify(payload)));
    const out = await read(mod, STATUS_URL, { fetchImpl: f });
    assert(out && out.ok === true, `status ${status} with a JSON object: expected ok: true; got ${show(out)}`);
    assert(sameJson(out.body, payload), `status ${status}: expected body ${show(payload)}; got ${show(out.body)}`);
  }
});

test('TF3: a 2xx plain object with success: false is still { ok: true, body } — readSection never reads success [AC-5; ADR 0004 § UI "It never reads data.success"]', async () => {
  const mod = await loadFetch();
  const payload = { success: false, error: 'something', running: false };
  const out = await read(mod, STATUS_URL, { fetchImpl: fakeFetch(response(200, JSON.stringify(payload))) });
  assert(out && out.ok === true,
    `a 200 whose JSON object says success: false must still be ok: true (the body is the section's to judge); got ${show(out)}`);
  assert(sameJson(out.body, payload), `expected body ${show(payload)}; got ${show(out.body)}`);
});

test('TF4: a 2xx whose JSON is an array is { ok: false, code: \'bad-json\', httpStatus: 200 } [AC-5 "never a raw JSON body"; ADR 0004 § UI; T7]', async () => {
  const mod = await loadFetch();
  const out = await read(mod, STATUS_URL, { fetchImpl: fakeFetch(response(200, '[{"runId":"run-1"}]')) });
  expectFailure(out, 'bad-json', 200, '2xx array');
});

test('TF5: a 2xx whose JSON is null is { ok: false, code: \'bad-json\', httpStatus } [AC-5; ADR 0004 § UI; T7]', async () => {
  const mod = await loadFetch();
  const out = await read(mod, STATUS_URL, { fetchImpl: fakeFetch(response(200, 'null')) });
  expectFailure(out, 'bad-json', 200, '2xx null');
});

test('TF6: a 2xx whose JSON is a string, a number or a boolean is { ok: false, code: \'bad-json\', httpStatus } [AC-5; ADR 0004 § UI; T7 "anything but a plain object"]', async () => {
  const mod = await loadFetch();
  for (const text of ['"ok"', '42', 'true']) {
    const out = await read(mod, STATUS_URL, { fetchImpl: fakeFetch(response(201, text)) });
    expectFailure(out, 'bad-json', 201, `2xx ${text}`);
  }
});

test('TF7: a 2xx whose text is not JSON at all (an HTML page, an empty body) is { ok: false, code: \'bad-json\', httpStatus } [AC-5 "never a raw JSON body or a stack trace"; ADR 0004 § UI; T7]', async () => {
  const mod = await loadFetch();
  for (const text of ['<!doctype html><html><body>Not the API</body></html>', '', '{"running":']) {
    const out = await read(mod, STATUS_URL, { fetchImpl: fakeFetch(response(200, text)) });
    expectFailure(out, 'bad-json', 200, `2xx text ${show(text.slice(0, 20))}`);
  }
});

test('TF8: a 401, 403 or 500 whose body is JSON is { ok: false, code: \'http-<status>\', httpStatus: <status>, body } with body the parsed JSON, a JSON array included [AC-5 "shows the error\'s code"; ADR 0004 § UI "body is the parsed JSON of a non-2xx answer when it parses"]', async () => {
  const mod = await loadFetch();
  const cases = [401, 403, 500].map((status) => [status, { success: false, error: `refused-${status}` }]);
  cases.push([500, ['a']]); // JSON that parses but is not a plain object is still the parsed body of a non-2xx
  for (const [status, payload] of cases) {
    const f = fakeFetch(response(status, JSON.stringify(payload)));
    const out = await read(mod, '/api/tagging-edges/drift-counts', { fetchImpl: f });
    const label = `status ${status} with JSON ${show(payload)}`;
    expectFailure(out, `http-${status}`, status, label);
    assert(sameJson(out.body, payload), `${label}: expected body to be the parsed JSON ${show(payload)}; got ${show(out.body)}`);
    assert(f.calls.length === 1, `${label}: a non-2xx answer must not be retried (T7): fetchImpl called ${f.calls.length} times`);
  }
});

test('TF9: /held\'s 404 carrying latestRunId is { ok: false, code: \'http-404\', httpStatus: 404 } and its body still carries latestRunId, so the panel can restart the list [AC-5; ADR 0004 § UI "used only for /held\'s latestRunId"]', async () => {
  const mod = await loadFetch();
  const payload = { success: false, error: 'run-not-latest', latestRunId: 'run-2' };
  const out = await read(mod, HELD_URL, { fetchImpl: fakeFetch(response(404, JSON.stringify(payload))) });
  expectFailure(out, 'http-404', 404, '/held 404');
  assert(out.body && out.body.latestRunId === 'run-2',
    `expected body.latestRunId 'run-2' from the 404's JSON; got body ${show(out.body)}`);
});

test('TF10: a non-2xx whose body is not JSON (an HTML error page, an empty body) is { ok: false, code: \'http-<status>\', httpStatus, body: null }, after exactly one fetchImpl call [AC-5 "never a raw JSON body or a stack trace"; ADR 0004 § UI; T7 "never retried"]', async () => {
  const mod = await loadFetch();
  for (const [status, text] of [[500, '<html><body>Internal Server Error</body></html>'], [502, ''], [404, 'Cannot GET /api/tagging-edges/held']]) {
    const f = fakeFetch(response(status, text));
    const out = await read(mod, HELD_URL, { fetchImpl: f });
    expectFailure(out, `http-${status}`, status, `status ${status} non-JSON`);
    assert(out.body === null, `status ${status} with a non-JSON body: expected body null; got ${show(out.body)}`);
    assert(f.calls.length === 1, `status ${status}: a non-2xx answer must not be retried (T7): fetchImpl called ${f.calls.length} times`);
  }
});

test('TF11: a fetchImpl that rejects (the network is down) is { ok: false, code: \'network\', httpStatus: null, body: null }, after exactly one fetchImpl call [AC-5; ADR 0004 § UI; T7 "httpStatus and body are null for network", "never retried"]', async () => {
  const mod = await loadFetch();
  const f = fakeFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  const out = await read(mod, STATUS_URL, { fetchImpl: f });
  expectFailure(out, 'network', null, 'rejected fetch');
  assert(out.body === null, `a network failure has no answer body: expected body null; got ${show(out.body)}`);
  assert(f.calls.length === 1, `a network failure must not be retried (T7): fetchImpl called ${f.calls.length} times`);
});

test('TF12: a fetchImpl that throws synchronously is also { ok: false, code: \'network\', httpStatus: null, body: null } — readSection resolves, never rejects [AC-5 "never a stack trace"; ADR 0004 § UI; T7]', async () => {
  const mod = await loadFetch();
  const f = fakeFetch(() => { throw new TypeError('fetch is not a function'); });
  let out;
  try {
    out = await read(mod, STATUS_URL, { fetchImpl: f });
  } catch (e) {
    throw new Error(`readSection must resolve to { ok: false, code: 'network' } when fetchImpl throws; it rejected with ${e.message}`);
  }
  expectFailure(out, 'network', null, 'throwing fetch');
  assert(out.body === null, `throwing fetch: a network result has no answer body: expected body null; got ${show(out.body)}`);
  assert(f.calls.length === 1, `a throwing fetchImpl must not be retried (T7): fetchImpl called ${f.calls.length} times`);
});

test('TF13: a fetchImpl that never settles and ignores its signal ends as { ok: false, code: \'timeout\', httpStatus: null, body: null } shortly after timeoutMs (30 ms here), not before [AC-4 "unknown, never 0", AC-5; ADR 0004 § UI "its own timer racing the fetch"; T7]', async () => {
  const mod = await loadFetch();
  const f = fakeFetch(() => new Promise(() => {}));
  const started = Date.now();
  const out = await read(mod, '/api/tagging-edges/drift-counts', { fetchImpl: f, timeoutMs: 30 }, 1500);
  const elapsed = Date.now() - started;
  expectFailure(out, 'timeout', null, 'hanging fetch');
  assert(out.body === null, `hanging fetch: a timeout result has no answer body: expected body null; got ${show(out.body)}`);
  assert(elapsed >= 20, `the timeout must wait for timeoutMs (30 ms); readSection settled after only ${elapsed} ms`);
  assert(elapsed < 1000,
    `with timeoutMs 30 the timeout must come well within a second; it took ${elapsed} ms ` +
    `(the suite's own guard is 1500 ms; on a heavily loaded box a value near that is timer lag, not the implementation)`);
  assert(f.calls.length === 1, `expected one fetchImpl call; got ${f.calls.length}`);
});

test('TF14: a fetchImpl that honours its signal (rejects with an AbortError when aborted) still ends as { code: \'timeout\', httpStatus: null, body: null }, not \'network\', when the timer fires [AC-5; ADR 0004 § UI "timeout is decided by its own timer"; T7]', async () => {
  const mod = await loadFetch();
  const f = fakeFetch((_url, init) => new Promise((_res, rej) => {
    const sig = init && init.signal;
    if (sig && typeof sig.addEventListener === 'function') {
      sig.addEventListener('abort', () => {
        const e = new Error('The operation was aborted');
        e.name = 'AbortError';
        rej(e);
      });
    }
  }));
  const out = await read(mod, STATUS_URL, { fetchImpl: f, timeoutMs: 30 }, 1500);
  expectFailure(out, 'timeout', null, 'signal-honouring hanging fetch');
  assert(out.body === null, `signal-honouring hanging fetch: a timeout result has no answer body: expected body null; got ${show(out.body)}`);
  assert(f.calls.length === 1, `a timed-out read must not be retried (T7): fetchImpl called ${f.calls.length} times`);
});

test('TF15: an answer that arrives before a short timeoutMs is used, not reported as a timeout [AC-5; ADR 0004 § UI]', async () => {
  const mod = await loadFetch();
  const payload = { on: true, running: true, state: 'live' };
  const f = fakeFetch(() => new Promise((res) => setTimeout(() => res(response(200, JSON.stringify(payload))), 5)));
  const out = await read(mod, '/api/tagging-edges/realtime/status', { fetchImpl: f, timeoutMs: 500 }, 1500);
  assert(out && out.ok === true, `an answer after 5 ms with timeoutMs 500 must be ok: true; got ${show(out)}`);
  assert(sameJson(out.body, payload), `expected body ${show(payload)}; got ${show(out.body)}`);
  assert(f.calls.length === 1, `expected one fetchImpl call; got ${f.calls.length}`);
});

test('TF16: the module imports with no global fetch (Node 16), and with no fetchImpl readSection calls globalThis.fetch as it is when called [AC-5; ADR 0004 § UI "fetch is referenced only when it is called"]', async () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'fetch');
  const saved = globalThis.fetch;
  try {
    delete globalThis.fetch;
    const mod = await loadFetch(`nofetch-${Date.now()}`);
    const calls = [];
    globalThis.fetch = (url, init) => {
      calls.push([url, init]);
      return Promise.resolve(response(200, '{"entries":[]}'));
    };
    const out = await read(mod, '/api/scheduled-tasks/list', {});
    assert(calls.length === 1,
      `with no fetchImpl, readSection must call the globalThis.fetch present at call time (set after import); it was called ${calls.length} times`);
    assert(calls[0][0] === '/api/scheduled-tasks/list' && calls[0][1] && calls[0][1].method === 'GET',
      `expected globalThis.fetch('/api/scheduled-tasks/list', { method: 'GET', signal }); got ${show(calls[0])}`);
    assert(out && out.ok === true && Array.isArray(out.body && out.body.entries),
      `expected { ok: true, body: { entries: [] } } through the default fetch; got ${show(out)}`);
  } finally {
    if (had) globalThis.fetch = saved; else delete globalThis.fetch;
  }
});

test('TF17: the module is plain ESM .js: export syntax, no require/module.exports, no JSX, no React import, no alias, and every relative import ends in .js [ADR 0004 § UI "plain ESM, Node 16 syntax"; § Seams (import() from Node suites)]', async () => {
  await loadFetch();
  const raw = fs.readFileSync(MODULE_ABS, 'utf-8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  assert(/\bexport\b/.test(code), `${MODULE_REL} must use ESM export syntax`);
  assert(!/\brequire\s*\(/.test(code) && !/\bmodule\.exports\b/.test(code),
    `${MODULE_REL} must be ESM, not CommonJS (no require(), no module.exports)`);
  assert(!/from\s+['"]react['"]/.test(code) && !/\bReact\./.test(code),
    `${MODULE_REL} must not import or use React`);
  assert(!/<\/[A-Za-z]/.test(code) && !/<[A-Za-z][\w.]*(\s[^<>]*)?\/>/.test(code),
    `${MODULE_REL} must hold no JSX`);
  const imports = [...code.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of imports) {
    assert(!spec.startsWith('@/'), `import ${show(spec)} uses an alias; the module must be importable by Node as it stands`);
    if (spec.startsWith('.')) {
      assert(spec.endsWith('.js'), `relative import ${show(spec)} must carry its .js suffix (no alias, Node-importable)`);
    }
  }
});

test('TF18: a body read that fails (text() rejects) resolves to { ok: false, code: \'network\', httpStatus: null, body: null } for a 2xx and for a non-2xx, never a rejection, after one fetchImpl call [AC-5 "never a stack trace"; ADR 0004 § UI; T7 "a text() that rejects ends as network", "readSection itself never rejects"]', async () => {
  const mod = await loadFetch();
  for (const status of [200, 500]) {
    const f = fakeFetch({ ok: status < 300, status, text: () => Promise.reject(new TypeError('body stream error')) });
    let out;
    try {
      out = await read(mod, STATUS_URL, { fetchImpl: f });
    } catch (e) {
      throw new Error(`status ${status}: readSection must resolve when res.text() rejects; it rejected with ${e.message}`);
    }
    const label = `status ${status}, text() rejects`;
    expectFailure(out, 'network', null, label);
    assert(out.body === null, `${label}: a network result has no answer body: expected body null; got ${show(out.body)}`);
    assert(f.calls.length === 1, `${label}: a failed body read must not be retried (T7): fetchImpl called ${f.calls.length} times`);
  }
  // A text() that throws synchronously must not make readSection reject either (the code is not pinned here).
  const g = fakeFetch({ ok: true, status: 200, text: () => { throw new TypeError('body already used'); } });
  let out2;
  try {
    out2 = await read(mod, STATUS_URL, { fetchImpl: g });
  } catch (e) {
    throw new Error(`readSection must resolve when res.text() throws; it rejected with ${e.message}`);
  }
  assert(out2 && out2.ok === false && (['network', 'timeout', 'bad-json'].includes(out2.code) || /^http-\d{3}$/.test(String(out2.code))),
    `text() throwing: expected { ok: false } with one of the four codes; got ${show(out2)}`);
});

test('TF19: a response whose body never arrives (text() never settles) ends as { ok: false, code: \'timeout\', httpStatus: null, body: null } shortly after timeoutMs — the timer covers the whole read [AC-4 "unknown, never 0", AC-5; T7 "the time-out covers the whole read, the body included"]', async () => {
  const mod = await loadFetch();
  const f = fakeFetch({ ok: true, status: 200, text: () => new Promise(() => {}) });
  const started = Date.now();
  let out;
  try {
    out = await read(mod, STATUS_URL, { fetchImpl: f, timeoutMs: 30 }, 1500);
  } catch (e) {
    throw new Error(`a response whose text() never settles must end as timeout (T7: the time-out covers the body); ${e.message}`);
  }
  const elapsed = Date.now() - started;
  expectFailure(out, 'timeout', null, 'hanging body');
  assert(out.body === null, `hanging body: a timeout result has no answer body: expected body null; got ${show(out.body)}`);
  assert(elapsed >= 20, `the timeout must wait for timeoutMs (30 ms); readSection settled after only ${elapsed} ms`);
  assert(f.calls.length === 1, `expected one fetchImpl call; got ${f.calls.length}`);
});

/* ───────────────────────── TF20–TF24 — sendSwitch (story 5) ───────────────────────── */

const SWITCH_URL = '/api/tagging-edges/realtime/switch';

/** Loads the module and checks it exports sendSwitch; the failure says what ADR 0005 expects. */
async function loadSwitch(bust) {
  const mod = await loadFetch(bust);
  if (typeof mod.sendSwitch !== 'function') {
    throw new Error(
      `${MODULE_REL} does not export sendSwitch yet (ADR 0005 D12: sendSwitch(on, { fetchImpl, timeoutMs = 15000 }) ` +
      `POSTs {"on":…} to ${SWITCH_URL} through readSection's race, resolves readSection's result shapes and never rejects)`
    );
  }
  return mod;
}

async function send(mod, on, opts, ms = 2000) {
  return guarded(mod.sendSwitch(on, opts), ms, `sendSwitch(${show(on)})`);
}

/** The switch's recorded answer (ADR 0005 D11). */
const recordedAnswer = (on) => ({ success: true, on, changedAt: '2026-10-01T15:10:00.000Z', recorded: true, takesEffectWithinSeconds: 5 });

test('TF20: sendSwitch(on) calls the given fetchImpl exactly once, with the switch path and { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: \'{"on":true}\' (or \'{"on":false}\'), signal } — an unaborted AbortSignal, and no other option but the default same-origin credentials [story 5 AC-1; ADR 0005 D12 "sendSwitch", § Seams "The fetch util"]', async () => {
  const mod = await loadSwitch();
  for (const on of [true, false]) {
    const f = fakeFetch(response(200, JSON.stringify(recordedAnswer(on))));
    await send(mod, on, { fetchImpl: f });
    const label = `sendSwitch(${on})`;
    assert(f.calls.length === 1, `${label}: expected fetchImpl to be called exactly once (a change is never retried); it was called ${f.calls.length} times`);
    const [url, init] = f.calls[0];
    assert(url === SWITCH_URL, `${label}: expected the url ${show(SWITCH_URL)}; got ${show(url)}`);
    assert(init && typeof init === 'object', `${label}: expected a second argument { method, headers, body, signal }; got ${show(init)}`);
    assert(init.method === 'POST', `${label}: expected method 'POST' (ADR 0005 D12); got ${show(init.method)}`);
    assert(sameJson(init.headers, { 'Content-Type': 'application/json' }),
      `${label}: expected headers { 'Content-Type': 'application/json' } (ADR 0005 D12); got ${show(init.headers)}`);
    assert(init.body === JSON.stringify({ on }), `${label}: expected the body ${show(JSON.stringify({ on }))}; got ${show(init.body)}`);
    const sig = init.signal;
    assert(sig && typeof sig === 'object' && typeof sig.aborted === 'boolean' && typeof sig.addEventListener === 'function',
      `${label}: expected init.signal to be an AbortSignal (readSection's race); got ${show(sig)}`);
    assert(sig.aborted === false, `${label}: the signal handed to fetchImpl must not already be aborted`);
    const extra = Object.keys(init).filter((k) => !['method', 'headers', 'body', 'signal', 'credentials'].includes(k));
    assert(extra.length === 0, `${label}: the request carries no option beyond method, headers, body and signal (ADR 0005 D12); found ${show(extra)}`);
    assert(init.credentials === undefined || init.credentials === 'same-origin',
      `${label}: credentials stay the default same-origin (ADR 0005 D12); got ${show(init.credentials)}`);
  }
});

test('TF21: sendSwitch resolves readSection\'s result shapes — a 2xx JSON object is { ok: true, body } with recorded passed through (true or false); a 401, 403 or 500 is { ok: false, code: \'http-<status>\', httpStatus, body } with the parsed body (its code, ENOSPC, included); a 502 HTML page has body null; a 2xx that is not a JSON object is bad-json — each after exactly one call [story 5 AC-4 "the panel shows the reason"; ADR 0005 D12 "It resolves readSection\'s result shapes"]', async () => {
  const mod = await loadSwitch();
  for (const body of [recordedAnswer(true), { success: true, on: false, recorded: false, takesEffectWithinSeconds: 5 }]) {
    const f = fakeFetch(response(200, JSON.stringify(body)));
    const out = await send(mod, body.on, { fetchImpl: f });
    assert(out && out.ok === true && sameJson(out.body, body), `a 200 answering ${show(body)}: expected { ok: true, body }; got ${show(out)}`);
    assert(f.calls.length === 1, `a 200: expected one fetchImpl call; got ${f.calls.length}`);
  }
  const failures = [
    [401, { success: false, error: 'Not authenticated' }],
    [403, { success: false, error: 'Owner or admin access required' }],
    [403, { success: false, error: 'cross-site request refused' }],
    [500, { success: false, error: 'could not write the switch', code: 'ENOSPC' }],
  ];
  for (const [status, body] of failures) {
    const f = fakeFetch(response(status, JSON.stringify(body)));
    const out = await send(mod, true, { fetchImpl: f });
    const label = `a ${status} answering ${show(body)}`;
    expectFailure(out, `http-${status}`, status, label);
    assert(sameJson(out.body, body), `${label}: expected the parsed body ${show(body)}; got ${show(out.body)}`);
    assert(f.calls.length === 1, `${label}: a change is never retried: fetchImpl called ${f.calls.length} times`);
  }
  const html = fakeFetch(response(502, '<html><body>Bad Gateway</body></html>'));
  const gw = await send(mod, false, { fetchImpl: html });
  expectFailure(gw, 'http-502', 502, 'a 502 HTML page');
  assert(gw.body === null, `a 502 HTML page: expected body null; got ${show(gw.body)}`);
  for (const text of ['<!doctype html><html></html>', '[1]', '']) {
    const out = await send(mod, true, { fetchImpl: fakeFetch(response(200, text)) });
    expectFailure(out, 'bad-json', 200, `a 200 whose text is ${show(text)}`);
  }
});

test('TF22: a switch request that never settles ends as { ok: false, code: \'timeout\', httpStatus: null, body: null } shortly after timeoutMs (30 ms here), not before — whether fetchImpl ignores its signal, rejects on abort, or answers headers whose body never arrives — after one call [story 5 AC-1 "If the server has not answered within 15 seconds … the outcome is unknown"; ADR 0005 D12 "It shares readSection\'s race"; § Seams "It resolves timeout at timeoutMs"]', async () => {
  const mod = await loadSwitch();
  const abortRejecting = (_url, init) => new Promise((_res, rej) => {
    const sig = init && init.signal;
    if (sig && typeof sig.addEventListener === 'function') {
      sig.addEventListener('abort', () => { const e = new Error('The operation was aborted'); e.name = 'AbortError'; rej(e); });
    }
  });
  const cases = [
    ['ignores its signal', () => new Promise(() => {})],
    ['rejects on abort', abortRejecting],
    ['answers, but its body never arrives', () => ({ ok: true, status: 200, text: () => new Promise(() => {}) })],
  ];
  for (const [label, answer] of cases) {
    const f = fakeFetch(answer);
    const started = Date.now();
    let out;
    try {
      out = await send(mod, true, { fetchImpl: f, timeoutMs: 30 }, 1500);
    } catch (e) {
      throw new Error(`a fetchImpl that ${label}: sendSwitch must resolve as timeout, never reject (ADR 0005 D12); ${e.message}`);
    }
    const elapsed = Date.now() - started;
    expectFailure(out, 'timeout', null, `a fetchImpl that ${label}`);
    assert(out.body === null, `a fetchImpl that ${label}: a timeout has no answer body; got ${show(out.body)}`);
    assert(elapsed >= 20, `a fetchImpl that ${label}: the timeout must wait for timeoutMs (30 ms); it settled after ${elapsed} ms`);
    assert(elapsed < 1000, `a fetchImpl that ${label}: with timeoutMs 30 the timeout must come well within a second; it took ${elapsed} ms`);
    assert(f.calls.length === 1, `a fetchImpl that ${label}: expected one call; got ${f.calls.length}`);
  }
});

test('TF23: sendSwitch never rejects — a fetchImpl that rejects (the network is down), one that throws synchronously, and an answer whose text() rejects each resolve to { ok: false, code: \'network\', httpStatus: null, body: null }, after one call [story 5 AC-1; ADR 0005 D12 "never rejects"; § Seams "It … never rejects"]', async () => {
  const mod = await loadSwitch();
  const cases = [
    ['rejects', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['throws synchronously', () => { throw new TypeError('fetch is not a function'); }],
    ['answers, but text() rejects', () => ({ ok: true, status: 200, text: () => Promise.reject(new TypeError('body stream error')) })],
  ];
  for (const [label, answer] of cases) {
    const f = fakeFetch(answer);
    let out;
    try {
      out = await send(mod, false, { fetchImpl: f });
    } catch (e) {
      throw new Error(`a fetchImpl that ${label}: sendSwitch must resolve to { ok: false, code: 'network' }, never reject (ADR 0005 D12); it rejected with ${e.message}`);
    }
    expectFailure(out, 'network', null, `a fetchImpl that ${label}`);
    assert(out.body === null, `a fetchImpl that ${label}: a network result has no answer body; got ${show(out.body)}`);
    assert(f.calls.length === 1, `a fetchImpl that ${label}: a change is never retried: fetchImpl called ${f.calls.length} times`);
  }
});

test('TF24: sendSwitch\'s defaults — with no fetchImpl it calls globalThis.fetch as it is when called, with the same POST; with no timeoutMs its race is 15 000 ms, the 15 seconds after which the panel says the outcome is unknown [story 5 AC-1 "within 15 seconds"; ADR 0005 D12 "sendSwitch(on, { fetchImpl, timeoutMs = 15000 })"]', async () => {
  const mod = await loadSwitch();
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'fetch');
  const savedFetch = globalThis.fetch;
  const realSetTimeout = globalThis.setTimeout;
  const calls = [];
  const delays = [];
  try {
    globalThis.fetch = (url, init) => { calls.push([url, init]); return Promise.resolve(response(200, JSON.stringify(recordedAnswer(true)))); };
    globalThis.setTimeout = function spiedSetTimeout(fn, ms, ...rest) { delays.push(ms); return realSetTimeout(fn, ms, ...rest); };
    const out = await send(mod, true, {});
    assert(calls.length === 1, `with no fetchImpl, sendSwitch must call the globalThis.fetch present at call time; it was called ${calls.length} times`);
    assert(calls[0][0] === SWITCH_URL && calls[0][1] && calls[0][1].method === 'POST' && calls[0][1].body === '{"on":true}',
      `expected globalThis.fetch(${show(SWITCH_URL)}, { method: 'POST', body: '{"on":true}', … }); got ${show(calls[0])}`);
    assert(out && out.ok === true, `expected { ok: true, body } through the default fetch; got ${show(out)}`);
    assert(delays.includes(15000), `with no timeoutMs, sendSwitch's race must be 15000 ms (ADR 0005 D12; story 5 AC-1); the timers set were ${show(delays)}`);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    if (had) globalThis.fetch = savedFetch; else delete globalThis.fetch;
  }
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- tagging-pipeline-fetch tests (tagging-edges story #4) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-pipeline-fetch: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { run };
