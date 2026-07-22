/**
 * Unit tests for the bounties HTTP/DB layer additions:
 *   - GET /api/bounties `issuer` query param (src/api/bounties.js:handleListBounties,
 *     src/db/bounties.js:listOpenBounties/listAllBounties) — server-side issuer
 *     filtering that composes with the existing status/limit semantics.
 *   - trust-rank production refusal (src/lib/trust-rank.js) — DEV_SKIP_TRUST_CHECK
 *     must never bypass the trust gate when NODE_ENV=production.
 *
 * Follows the plain-node check()/summary pattern used by test/receiving.api.test.js,
 * and the BOUNTIES_DB_PATH temp-sqlite redirect used by test/auto-pay.test.js and
 * test/boot-safety.test.js (src/db/bounties.js resolves its db path from that env
 * var when set, so no Express server is needed — handlers are exercised directly
 * against a real temp sqlite db with stub req/res objects, same as
 * test/auth-signature.test.js does for src/middleware/auth.js).
 *
 * Run: `node test/bounties-api.test.js`.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brainstorm-bounties-api-'));
process.env.BOUNTIES_DB_PATH = path.join(tmpDir, 'bounties.db');

const { createBounty, listOpenBounties, listAllBounties, markFulfilled } = require('../src/db/bounties');
const { handleListBounties } = require('../src/api/bounties');

let passed = 0, failed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { console.log(`  ok  ${name}`); passed++; })
    .catch(err => { console.error(`  FAIL  ${name}\n      ${err.stack || err.message}`); failed++; });
}

function pk(char) {
  return String(char).repeat(64);
}

function makeBounty(issuer, coordSuffix, amountSats = 1000) {
  return createBounty({
    issuerPubkey: issuer,
    listCoordinate: `39998:${issuer}:${coordSuffix}`,
    amountSats,
    bountyCapSats: amountSats,
    criteria: 'test bounty',
  });
}

function fakeReq(query = {}, body = {}) {
  return { query, body };
}

function fakeRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.body = o; return r; };
  return r;
}

// handleListBounties always scans strfry for claims (kind 39999) via a child
// process; strfry isn't installed in this harness, so scanStrfry logs a caught
// error and returns []. That's the correct resilience behavior (see
// boot-safety.test.js), but it's noisy here — quiet it per-call.
async function withQuietStderr(fn) {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

async function main() {
  console.log('Running bounties API (issuer filter + trust-rank prod refusal) tests…\n');

  // ---- DB layer: issuer-scoped queries -----------------------------------
  console.log('DB layer (src/db/bounties.js): issuer-scoped queries');

  await check('listAllBounties({issuer}) returns only that issuer\'s bounties, any status', () => {
    const issuerA = pk('1');
    const issuerB = pk('2');
    const openA = makeBounty(issuerA, 'db-open-a');
    const fulfilledA = makeBounty(issuerA, 'db-fulfilled-a');
    markFulfilled(fulfilledA.id);
    makeBounty(issuerB, 'db-open-b');

    const rowsA = listAllBounties({ limit: 100, issuer: issuerA });
    assert.strictEqual(rowsA.length, 2, 'only issuerA rows returned');
    assert.ok(rowsA.every(r => r.issuer_pubkey === issuerA));
    assert.deepStrictEqual(new Set(rowsA.map(r => r.id)), new Set([openA.id, fulfilledA.id]));
  });

  await check('listOpenBounties({issuer}) filters to open status AND that issuer', () => {
    const issuerC = pk('3');
    const issuerD = pk('4');
    const openC = makeBounty(issuerC, 'db-open-c');
    const fulfilledC = makeBounty(issuerC, 'db-fulfilled-c');
    markFulfilled(fulfilledC.id);
    makeBounty(issuerD, 'db-open-d');

    const rowsC = listOpenBounties({ limit: 100, issuer: issuerC });
    assert.strictEqual(rowsC.length, 1, 'fulfilled bounty excluded even though same issuer');
    assert.strictEqual(rowsC[0].id, openC.id);

    const rowsD = listOpenBounties({ limit: 100, issuer: issuerD });
    assert.strictEqual(rowsD.length, 1);
    assert.strictEqual(rowsD[0].issuer_pubkey, issuerD);
  });

  await check('omitting issuer preserves prior all-issuers behavior', () => {
    const issuerE = pk('5');
    makeBounty(issuerE, 'db-no-issuer-filter');
    const rows = listAllBounties({ limit: 1000 });
    assert.ok(rows.some(r => r.issuer_pubkey === issuerE), 'unscoped query still finds bounties across issuers');
  });

  // ---- Handler: composition with status + limit --------------------------
  console.log('\nHandler (src/api/bounties.js:handleListBounties): issuer composes with status');

  await check('issuer param + status=all: both statuses included, other issuers excluded', async () => {
    const issuer = pk('6');
    const other = pk('7');
    const openBounty = makeBounty(issuer, 'handler-open');
    const fulfilledBounty = makeBounty(issuer, 'handler-fulfilled');
    markFulfilled(fulfilledBounty.id);
    makeBounty(other, 'handler-other');

    const res = fakeRes();
    await withQuietStderr(() => handleListBounties(fakeReq({ status: 'all', issuer }), res));

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.bounties.length, 2, 'both of issuer\'s bounties returned');
    assert.ok(res.body.bounties.every(b => b.issuer_pubkey === issuer));
  });

  await check('issuer param + default status=open: fulfilled bounty excluded', async () => {
    const issuer = pk('8');
    const openBounty = makeBounty(issuer, 'handler-open-2');
    const fulfilledBounty = makeBounty(issuer, 'handler-fulfilled-2');
    markFulfilled(fulfilledBounty.id);

    const res = fakeRes();
    await withQuietStderr(() => handleListBounties(fakeReq({ issuer }), res));

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.bounties.length, 1);
    assert.strictEqual(res.body.bounties[0].id, openBounty.id);
    assert.strictEqual(res.body.bounties[0].derivedStatus, 'open');
  });

  await check('issuer param respects the limit cap composed with the query', async () => {
    const issuer = pk('c');
    for (let i = 0; i < 3; i++) makeBounty(issuer, `handler-limit-${i}`, 1000 + i);

    const res = fakeRes();
    await withQuietStderr(() => handleListBounties(fakeReq({ status: 'all', issuer, limit: '2' }), res));

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.bounties.length, 2, 'limit still applies with issuer filter');
  });

  await check('issuer param is case-insensitive on input, matched against lowercase storage', async () => {
    const issuerLower = pk('b');
    makeBounty(issuerLower, 'handler-case');
    const res = fakeRes();
    await withQuietStderr(() => handleListBounties(fakeReq({ status: 'all', issuer: issuerLower.toUpperCase() }), res));
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.bounties.length, 1);
    assert.strictEqual(res.body.bounties[0].issuer_pubkey, issuerLower);
  });

  // ---- Handler: invalid issuer -> 400 ------------------------------------
  console.log('\nHandler: invalid issuer -> 400 validation');

  await check('non-hex issuer -> 400 {success:false}', async () => {
    const res = fakeRes();
    await handleListBounties(fakeReq({ issuer: 'not-a-pubkey' }), res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(typeof res.body.error === 'string' && res.body.error.length > 0);
  });

  await check('short hex issuer (63 chars) -> 400', async () => {
    const res = fakeRes();
    await handleListBounties(fakeReq({ issuer: 'a'.repeat(63) }), res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  await check('empty issuer -> 400', async () => {
    const res = fakeRes();
    await handleListBounties(fakeReq({ issuer: '' }), res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  await check('no issuer param at all -> unchanged 200 response shape', async () => {
    const res = fakeRes();
    await withQuietStderr(() => handleListBounties(fakeReq({ status: 'all', limit: '1' }), res));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.bounties));
  });

  // ---- trust-rank: production refuses the dev bypass ---------------------
  console.log('\ntrust-rank (src/lib/trust-rank.js): DEV_SKIP_TRUST_CHECK vs NODE_ENV=production');

  function reloadTrustRank() {
    const modPath = require.resolve('../src/lib/trust-rank');
    delete require.cache[modPath];
    return require('../src/lib/trust-rank');
  }

  function withEnv(vars, fn) {
    const prev = {};
    for (const key of Object.keys(vars)) prev[key] = process.env[key];
    for (const [key, val] of Object.entries(vars)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    return Promise.resolve().then(fn).finally(() => {
      for (const key of Object.keys(vars)) {
        if (prev[key] === undefined) delete process.env[key];
        else process.env[key] = prev[key];
      }
    });
  }

  await check('NODE_ENV=production refuses the DEV_SKIP_TRUST_CHECK bypass and warns once, not per-call', async () => {
    await withEnv({ NODE_ENV: 'production', DEV_SKIP_TRUST_CHECK: 'true', OWNER_PUBKEY: undefined }, async () => {
      const { rank } = reloadTrustRank();
      const warnCalls = [];
      const originalWarn = console.warn;
      console.warn = (...args) => { warnCalls.push(args); };
      try {
        const observer = pk('e');
        const subject = pk('f');
        const r1 = await rank(observer, subject);
        const r2 = await rank(observer, subject);
        assert.notStrictEqual(r1, 100, 'production must not accept the dev bypass');
        assert.strictEqual(r1, 0, 'falls through to the real (no rank found) result');
        assert.strictEqual(r2, 0);
        assert.strictEqual(warnCalls.length, 1, 'warns exactly once per process, not once per call');
        assert.ok(
          String(warnCalls[0][0]).includes('DEV_SKIP_TRUST_CHECK'),
          'warning names the refused env var'
        );
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  await check('non-production still honors the DEV_SKIP_TRUST_CHECK bypass (short-circuits to 100)', async () => {
    await withEnv({ NODE_ENV: 'test', DEV_SKIP_TRUST_CHECK: 'true' }, async () => {
      const { rank } = reloadTrustRank();
      const observer = pk('2');
      const subject = pk('3');
      const result = await rank(observer, subject);
      assert.strictEqual(result, 100, 'non-production keeps the dev bypass working');
    });
  });

  await check('NODE_ENV unset (falsy, non-production) still honors the bypass', async () => {
    await withEnv({ NODE_ENV: undefined, DEV_SKIP_TRUST_CHECK: 'true' }, async () => {
      const { rank } = reloadTrustRank();
      const result = await rank(pk('4'), pk('5'));
      assert.strictEqual(result, 100);
    });
  });

  await check('reads a kind-30382 rank through the real /api/strfry/scan envelope ({success, events})', async () => {
    await withEnv({ NODE_ENV: 'production', DEV_SKIP_TRUST_CHECK: undefined, OWNER_PUBKEY: pk('a') }, async () => {
      const { rank } = reloadTrustRank();
      const observer = pk('a');
      const subject = pk('b');
      const originalFetch = global.fetch;
      global.fetch = async (url) => {
        if (String(url).includes('/api/strfry/scan')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              events: [{ kind: 30382, pubkey: observer, tags: [['d', subject], ['p', subject], ['rank', '5']] }],
            }),
          };
        }
        return { ok: false, json: async () => ({}) }; // meili miss
      };
      try {
        assert.strictEqual(await rank(observer, subject), 5, 'rank tag must be read from the {success, events} envelope');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // Leave a clean, unpatched trust-rank module cached for any later require in
  // this process (none currently, but avoid surprising a future test added here).
  reloadTrustRank();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
