/**
 * Regression guard: POST /api/tapestry-key/:key (handlePut) must AWAIT the
 * async LMDB write before it reads the envelope and responds.
 *
 * The bug: handlePut called `const envelope = store.put(key, data, meta)` with
 * no `await`. Because tapestry-store.put is async, `envelope` was a *pending
 * Promise*, so:
 *   - `envelope.updatedAt` was `undefined` → Neo4j's `tapestryJsonUpdatedAt`
 *     was written as undefined/null, and
 *   - `res.json({ data: envelope })` serialized the Promise to `{}`, and
 *   - the LMDB write was not guaranteed durable before the response.
 * Every other call site (handleOffload, handleOffloadAll, tapestry-derive)
 * awaits store.put correctly — handlePut was the lone outlier.
 *
 * Stack-free: this suite needs neither LMDB nor Neo4j. It injects fake
 * tapestry-store and neo4j-driver modules into the require cache (the seam used
 * by close-unauth-write-surface.test.js), loads handlePut fresh, and asserts
 * the resolved envelope — not a Promise — reaches both the Cypher write and the
 * response body. Originals are restored in run()'s finally so later suites in
 * the shared runner are not contaminated.
 *
 * TI1, TI2 : FAIL against the un-awaited code, PASS once the `await` lands.
 * RI1      : PASS pre AND post — a source sentinel mirroring the sibling-audit
 *            grep; flips to FAIL if any un-awaited store.put/store.remove is
 *            (re)introduced anywhere in tapestry-key/index.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'src/api/tapestry-key/index.js');
const INDEX_PATH = require.resolve(INDEX_FILE);
const STORE_PATH = require.resolve(path.join(ROOT, 'src/lib/tapestry-store'));
const DRIVER_PATH = require.resolve(path.join(ROOT, 'src/lib/neo4j-driver'));
const DERIVE_PATH = require.resolve(path.join(ROOT, 'src/lib/tapestry-derive'));

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function mkRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

// A fixed, non-Date epoch the fake store stamps onto every envelope. If
// handlePut forgets to await, the handler reads `.updatedAt` off the pending
// Promise (undefined) instead of this number — the discriminating signal.
const FAKE_TS = 1234567890;

/**
 * Load a fresh handlePut with tapestry-store + neo4j-driver stubbed, returning
 * the handler plus the call logs the stubs record.
 */
function loadHandlerWithStubs() {
  // Force fresh loads of the handler and anything that closes over the store.
  delete require.cache[INDEX_PATH];
  delete require.cache[DERIVE_PATH];

  const storeCalls = [];
  const cypherCalls = [];

  require.cache[STORE_PATH] = {
    id: STORE_PATH, filename: STORE_PATH, loaded: true,
    exports: {
      put: async (key, data, meta = {}) => {
        storeCalls.push({ key, data, meta });
        return { updatedAt: FAKE_TS, ...meta, data };
      },
      get() { return null; },
      remove: async () => {},
      stats() { return { count: 0, path: '(stub)' }; },
      listKeys() { return []; },
      close() {},
    },
  };

  require.cache[DRIVER_PATH] = {
    id: DRIVER_PATH, filename: DRIVER_PATH, loaded: true,
    exports: {
      runCypher: async (cypher, params) => { cypherCalls.push({ fn: 'runCypher', cypher, params }); return []; },
      writeCypher: async (cypher, params) => { cypherCalls.push({ fn: 'writeCypher', cypher, params }); return []; },
      getDriver() { return null; },
      closeDriver() {},
      toJS(x) { return x; },
    },
  };

  const mod = require(INDEX_PATH);
  return { handlePut: mod.handlePut, storeCalls, cypherCalls };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('TI1: handlePut awaits store.put — the Neo4j timestamp write gets the resolved numeric updatedAt (not undefined)', async () => {
  const { handlePut, storeCalls, cypherCalls } = loadHandlerWithStubs();
  const res = mkRes();
  await handlePut({ params: { key: 'k1' }, body: { data: { hello: 'world' } } }, res);

  assert(storeCalls.length === 1, `expected store.put to be called once, got ${storeCalls.length}`);
  const write = cypherCalls.find((c) => c.fn === 'writeCypher');
  assert(write, 'expected a writeCypher call to set tapestryJsonUpdatedAt');
  assert(
    write.params && write.params.ts === FAKE_TS,
    `tapestryJsonUpdatedAt must be the resolved numeric updatedAt (${FAKE_TS}); got ${write.params && write.params.ts} — store.put was not awaited.`
  );
});

test('TI2: handlePut response body carries the resolved envelope, not a pending Promise', async () => {
  const { handlePut } = loadHandlerWithStubs();
  const res = mkRes();
  await handlePut({ params: { key: 'k2' }, body: { data: { a: 1 } } }, res);

  assert(res.body && res.body.success === true, `expected { success: true }, got ${JSON.stringify(res.body)}`);
  const env = res.body.data;
  assert(
    env && typeof env.updatedAt === 'number',
    `response data must be the resolved envelope with a numeric updatedAt; got ${JSON.stringify(env)} — an un-awaited Promise serializes to {}.`
  );
  assert(env.data && env.data.a === 1, 'the response envelope must carry the written data.');
});

test('RI1: no un-awaited store.put(/store.remove( remains in tapestry-key/index.js (sibling-audit sentinel)', () => {
  const src = fs.readFileSync(INDEX_FILE, 'utf8');
  const offenders = [];
  src.split('\n').forEach((line, i) => {
    if (/\bstore\.(put|remove)\s*\(/.test(line) && !/\bawait\s+store\.(put|remove)\s*\(/.test(line)) {
      offenders.push(i + 1);
    }
  });
  assert(
    offenders.length === 0,
    `un-awaited store.put/store.remove at src/api/tapestry-key/index.js line(s) ${offenders.join(', ')} — async LMDB writes must be awaited.`
  );
});

async function run() {
  // Snapshot the cache entries we mutate so later suites in the shared runner
  // (node test/test.js) see the real modules again.
  const snapshot = {
    [INDEX_PATH]: require.cache[INDEX_PATH],
    [STORE_PATH]: require.cache[STORE_PATH],
    [DRIVER_PATH]: require.cache[DRIVER_PATH],
    [DERIVE_PATH]: require.cache[DERIVE_PATH],
  };
  let pass = 0;
  let fail = 0;
  try {
    for (const t of tests) {
      try {
        await t.fn();
        console.log(`  ✓ ${t.name}`);
        pass++;
      } catch (err) {
        console.log(`  ✗ ${t.name}`);
        console.log(`      ${err.message}`);
        fail++;
      }
    }
  } finally {
    for (const [p, entry] of Object.entries(snapshot)) {
      if (entry === undefined) delete require.cache[p];
      else require.cache[p] = entry;
    }
  }
  return { pass, fail };
}

module.exports = { run };
