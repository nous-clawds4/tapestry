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
