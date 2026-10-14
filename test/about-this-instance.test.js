'use strict';
/**
 * about-this-instance #1: the instance's Owner, Admins and customer count — the Node half.
 *
 * Story: engineering-team/stories/about-this-instance/1-owner-admins-customer-count.md
 * ADR:   engineering-team/decisions/about-this-instance/0001-public-instance-roles-read.md
 * Plan:  engineering-team/stories/about-this-instance/1-owner-admins-customer-count.test-plan.md
 * Browser half: tests/brainstorm/about-this-instance.spec.js. Words: test/helpers/aboutThisInstanceFixtures.js.
 *
 *   K1..K6 — the key store's two new reads (SecureKeyStorage), over a temp store with real encryption.   [AC-3, AC-4]
 *   C1..C7 — countInstanceCustomers over that store (C7 from review round 1).                            [AC-3]
 *   H1..H6 — the read's handler, through its deps.                                                      [AC-2, AC-3, AC-4, AC-6]
 *   R1..R2 — the route: registered, and public in the route table.                                      [AC-4]
 *   S1..S8 — the page sources; rendering itself is the browser half's.                                  [AC-1..AC-6]
 *
 * Stack-free. Nothing under /etc or /var/lib is read or written: every store is a temp dir with its own master key,
 * and the owner, the admins and the TA reach the code under test through its deps (ADR § Implementation notes).
 *
 * EXPECTED NOW (pre-implementation): every test FAILS — the two store methods, countInstanceCustomers, the handler,
 * the route, its table entry, the section component, and the link do not exist yet.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const F = require('./helpers/aboutThisInstanceFixtures');

const ROOT = path.resolve(__dirname, '..');
const STORE_JS = path.join(ROOT, 'src/utils/secureKeyStorage.js');
const RELAY_KEYS_JS = path.join(ROOT, 'src/utils/customerRelayKeys.js');
const KEYS_JS = path.join(ROOT, 'src/utils/assistantKeys.js');
const HANDLER_JS = path.join(ROOT, 'src/api/owner/aboutThisInstance.js');
const ROUTE_ACCESS_JS = path.join(ROOT, 'src/middleware/routeAccess.js');
const API_INDEX_JS = path.join(ROOT, 'src/api/index.js');
const ABOUT_JSX = path.join(ROOT, 'ui/src/pages/BrainstormAbout.jsx');
const SECTION_JSX = path.join(ROOT, 'ui/src/components/AboutThisInstance.jsx');
const SEARCH_ABOUT_JSX = path.join(ROOT, 'ui/src/pages/BrainstormAboutSearch.jsx');

const MASTER = 'about-this-instance-test-master-key';
const HEX64 = /^[0-9a-f]{64}$/;

// Account pubkeys. Their Assistants' pubkeys are minted per world (real keys, real encryption).
const OWNER = '0a'.repeat(32);
const ADMIN = '0b'.repeat(32);
const ADMIN_2 = '0e'.repeat(32);
const ACTIVE = '0c'.repeat(32);    // an active customer
const INACTIVE = '0d'.repeat(32);  // an inactive customer: status plays no part (AC-3)
const LISTED = '0f'.repeat(32);    // on the customer list with no key: nowhere in the store, so not counted (AC-3)
const CORRUPT = '1c'.repeat(32);   // a key file that will not decrypt

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function rel(p) { return path.relative(ROOT, p); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist`);
  return s;
}
const sorted = (a) => [...a].sort();
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

/**
 * Source with comments blanked out, so a structural assertion cannot be satisfied by prose. Strings are tracked, so a
 * `/*` inside quotes (src/api/index.js registers '/api/settings/*') is not read as a comment. Same scanner as
 * test/author-scoped-inspection-roster.test.js.
 */
function code(s) {
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '*') {
      const end = s.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k++) out += s[k] === '\n' ? '\n' : ' ';
      i = stop;
    } else if (c === '/' && d === '/') {
      let k = i;
      while (k < n && s[k] !== '\n') { out += ' '; k++; }
      i = k;
    } else if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        if (s[i] === '\\') { out += s[i] + (s[i + 1] || ''); i += 2; continue; }
        out += s[i];
        if (s[i] === quote) { i++; break; }
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Run fn with the console quiet: the store logs every write, and logs an error for a file it cannot read. */
async function quiet(fn) {
  const saved = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = () => {};
  try { return await fn(); } finally { [console.log, console.warn, console.error] = saved; }
}

function load(p, what) {
  try { return require(p); } catch (e) {
    throw new Error(`${rel(p)} must load (${what}; run \`npm ci\` if a dependency is missing): ${e.message}`);
  }
}
function StoreClass() { return load(STORE_JS, 'the key store').SecureKeyStorage; }
function generateRelayKeys() { return load(RELAY_KEYS_JS, 'key generation').generateRelayKeys(); }
function openStore(dir) { return new (StoreClass())({ storagePath: dir, masterKey: MASTER }); }

function needMethod(store, name) {
  assert(typeof store[name] === 'function',
    `ADR 0001 Decision 3: SecureKeyStorage must have ${name}() — ${name === 'listStoredAccounts'
      ? 'the account pubkeys with a stored Assistant key (H)'
      : "the stored Assistant pubkey of one account, decrypting the envelope only"}`);
}
function countFn() {
  const m = load(KEYS_JS, 'the assistant-key mapping');
  assert(typeof m.countInstanceCustomers === 'function',
    'ADR 0001 Decision 4: src/utils/assistantKeys.js must export countInstanceCustomers(deps) — the customer count, beside the mapping it reads');
  return m.countInstanceCustomers;
}
function handlerFn() {
  const m = load(HANDLER_JS, 'the read\'s handler');
  assert(typeof m.handleGetAboutThisInstance === 'function',
    'ADR 0001 § Implementation notes: src/api/owner/aboutThisInstance.js must export handleGetAboutThisInstance(req, res, deps)');
  return m.handleGetAboutThisInstance;
}

/**
 * AC-3's world: key files for the Owner, an Admin, an active and an inactive customer, an account that is itself an
 * Assistant (the active customer's), and the TA's own pubkey; the TA's key under its real store name; and the other
 * files a real store holds. LISTED is on the customer list but has no key, so it is nowhere here. Expected count: 2.
 */
async function ac3World() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'about-this-instance-'));
  const store = openStore(dir);
  const keys = {};
  const put = async (account, k = generateRelayKeys()) => { await quiet(() => store.storeRelayKeys(account, k)); keys[account] = k; return k; };

  const ta = generateRelayKeys();
  await quiet(() => store.storeRelayKeys('tapestry-assistant', ta)); // where the TA really lives
  fs.writeFileSync(path.join(dir, '.master-key'), 'not a key file');
  fs.writeFileSync(path.join(dir, 'README.txt'), 'not a key file');

  await put(OWNER);
  await put(ADMIN);
  const active = await put(ACTIVE);
  await put(INACTIVE);
  const assistantAccount = active.pubkey;  // the active customer's Assistant, holding a key of its own
  await put(assistantAccount);
  await put(ta.pubkey);                   // the TA's pubkey, holding a key as an account

  return {
    dir, store, keys, ta, assistantAccount,
    holders: [OWNER, ADMIN, ACTIVE, INACTIVE, assistantAccount, ta.pubkey],
    deps: (over = {}) => ({
      openStore: () => openStore(dir),
      getOwnerPubkey: () => OWNER,
      getAdminPubkeys: () => [ADMIN],
      getTaPubkey: () => ta.pubkey,
      ...over,
    }),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
async function withWorld(fn) {
  const w = await ac3World();
  try { return await fn(w); } finally { w.cleanup(); }
}

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
async function callHandler(deps) {
  const res = mockRes();
  await quiet(() => handlerFn()({ session: {} }, res, deps));
  return res;
}

// ── K — the key store's two new reads ────────────────────────────────────────

test('K1: listStoredAccounts names exactly the accounts with a stored key — not the TA\'s store name, the master key or other files', async () => {
  await withWorld(async (w) => {
    needMethod(w.store, 'listStoredAccounts');
    const got = await quiet(() => w.store.listStoredAccounts());
    assert(Array.isArray(got), `listStoredAccounts must answer an array, got ${typeof got}`);
    assert(same(got, w.holders),
      `ADR Decision 2: H is the 64-hex file names in the store. Expected ${JSON.stringify(sorted(w.holders))}, got ${JSON.stringify(sorted(got))}`);
  });
});

test('K2: listStoredAccounts answers [] when the store\'s directory is gone (a fresh instance has no customers)', async () => {
  await withWorld(async (w) => {
    needMethod(w.store, 'listStoredAccounts');
    fs.rmSync(w.dir, { recursive: true, force: true });
    let got;
    try { got = await quiet(() => w.store.listStoredAccounts()); } catch (e) {
      throw new Error(`ADR Decision 3: a missing directory is an empty store, not an error — it threw: ${e.message}`);
    }
    assert(Array.isArray(got) && got.length === 0, `expected [], got ${JSON.stringify(got)}`);
  });
});

test('K3: getStoredPubkey answers the account\'s Assistant pubkey, and null for an account with no key', async () => {
  await withWorld(async (w) => {
    needMethod(w.store, 'getStoredPubkey');
    const got = await quiet(() => w.store.getStoredPubkey(ACTIVE));
    assert(got === w.keys[ACTIVE].pubkey, `expected the active customer's Assistant ${w.keys[ACTIVE].pubkey}, got ${got}`);
    const none = await quiet(() => w.store.getStoredPubkey(LISTED));
    assert(none === null, `an account with no key file must answer null, got ${JSON.stringify(none)}`);
  });
});

test('K4: getStoredPubkey answers null for anything that is not a 64-hex pubkey, even a name a readable key file has', async () => {
  await withWorld(async (w) => {
    needMethod(w.store, 'getStoredPubkey');
    // 'tapestry-assistant.json' is a real, readable key file in this store, so null here is the validation, not a miss.
    const bad = ['tapestry-assistant', `../${path.basename(w.dir)}/${ACTIVE}`, `${ACTIVE}.json`, ACTIVE.slice(0, 63), '', null, undefined, 42];
    for (const b of bad) {
      let got;
      try { got = await quiet(() => w.store.getStoredPubkey(b)); } catch (e) {
        throw new Error(`getStoredPubkey(${JSON.stringify(b)}) must answer null, not throw: ${e.message}`);
      }
      assert(got === null, `ADR § Implementation notes: getStoredPubkey validates 64-hex before building a path — ${JSON.stringify(b)} answered ${JSON.stringify(got)}`);
    }
    const good = await quiet(() => w.store.getStoredPubkey(ACTIVE));
    assert(good === w.keys[ACTIVE].pubkey, 'the same store answers a valid account (so the nulls above are not a dead store)');
  });
});

test('K5: getStoredPubkey never decrypts the private key or the nsec', async () => {
  await withWorld(async (w) => {
    needMethod(w.store, 'getStoredPubkey');
    const plaintexts = [];
    const real = w.store.decrypt.bind(w.store);
    w.store.decrypt = (enc) => { const out = real(enc); plaintexts.push(String(out)); return out; };
    let got;
    try { got = await quiet(() => w.store.getStoredPubkey(ACTIVE)); } finally { w.store.decrypt = real; }
    assert(got === w.keys[ACTIVE].pubkey, `the path under test ran: expected ${w.keys[ACTIVE].pubkey}, got ${got}`);
    assert(plaintexts.length >= 1, 'getStoredPubkey must decrypt the envelope through the store\'s own decrypt, so this guard can see what it decrypts');
    const { privkey, nsec } = w.keys[ACTIVE];
    for (const p of plaintexts) {
      assert(!p.includes(privkey) && !p.includes(nsec),
        'ADR Decision 3: getStoredPubkey decrypted a private field — it must decrypt the outer envelope only and read `pubkey`');
    }
  });
});

test('K6: getStoredPubkey answers null for a key file that will not decrypt, without throwing', async () => {
  await withWorld(async (w) => {
    needMethod(w.store, 'getStoredPubkey');
    fs.writeFileSync(path.join(w.dir, `${CORRUPT}.json`), JSON.stringify({ encrypted: '00', iv: '00'.repeat(16), authTag: '00'.repeat(16) }));
    let got;
    try { got = await quiet(() => w.store.getStoredPubkey(CORRUPT)); } catch (e) {
      throw new Error(`a file that won't decrypt must answer null, not throw: ${e.message}`);
    }
    assert(got === null, `expected null, got ${JSON.stringify(got)}`);
  });
});

// ── C — the count ────────────────────────────────────────────────────────────

test('C1: AC-3\'s worked example reads 2 — the active and the inactive customer', async () => {
  await withWorld(async (w) => {
    const n = await quiet(() => countFn()(w.deps()));
    assert(typeof n === 'number', `countInstanceCustomers must answer a number, got ${JSON.stringify(n)}`);
    assert(n === 2,
      `AC-3: keys for the Owner, an Admin, an active and an inactive customer, an account that is itself an Assistant and the TA's pubkey, plus a listed customer with no key, count 2 — got ${n}`);
  });
});

test('C2: an Admin is excluded however the config spells it, and an Owner who is also an Admin is excluded once', async () => {
  await withWorld(async (w) => {
    const count = countFn();
    const n1 = await quiet(() => count(w.deps({ getAdminPubkeys: () => [ADMIN.toUpperCase(), ADMIN, 'not-a-key', ''] })));
    assert(n1 === 2, `an upper-case, duplicated Admin among junk entries must still be excluded — expected 2, got ${n1}`);
    const n2 = await quiet(() => count(w.deps({ getAdminPubkeys: () => [OWNER, ADMIN] })));
    assert(n2 === 2, `the Owner listed as an Admin too must not change the count — expected 2, got ${n2}`);
    const n3 = await quiet(() => count(w.deps({ getAdminPubkeys: () => [] })));
    assert(n3 === 3, `with no Admins configured, the Admin's key is a customer's (ADR Decision 2) — expected 3, got ${n3}`);
  });
});

test('C3: an empty store counts 0, and so does a store whose directory is gone', async () => {
  const count = countFn();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'about-this-instance-empty-'));
  try {
    const deps = { openStore: () => openStore(dir), getOwnerPubkey: () => OWNER, getAdminPubkeys: () => [], getTaPubkey: () => null };
    const n1 = await quiet(() => count(deps));
    assert(n1 === 0, `an empty store must count 0, got ${JSON.stringify(n1)}`);
    const store = openStore(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    const n2 = await quiet(() => count({ ...deps, openStore: () => store }));
    assert(n2 === 0, `a store whose directory is gone must count 0, got ${JSON.stringify(n2)}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('C4: a store that cannot be opened or listed answers null, not a number and not a throw', async () => {
  const count = countFn();
  const base = { getOwnerPubkey: () => OWNER, getAdminPubkeys: () => [ADMIN], getTaPubkey: () => null };
  let n1;
  try { n1 = await quiet(() => count({ ...base, openStore: () => { throw new Error('Master key required for secure key storage.'); } })); } catch (e) {
    throw new Error(`ADR Decision 3: an unopenable store answers null — it threw: ${e.message}`);
  }
  assert(n1 === null, `an unopenable store must answer null, got ${JSON.stringify(n1)}`);
  const n2 = await quiet(() => count({ ...base, openStore: () => ({ listStoredAccounts: () => { throw new Error('EACCES'); }, getStoredPubkey: () => null }) }));
  assert(n2 === null, `a store that cannot be listed must answer null, got ${JSON.stringify(n2)}`);
});

test('C5: a key file that will not decrypt still counts — it is a stored key', async () => {
  await withWorld(async (w) => {
    fs.writeFileSync(path.join(w.dir, `${CORRUPT}.json`), JSON.stringify({ encrypted: '00', iv: '00'.repeat(16), authTag: '00'.repeat(16) }));
    const n = await quiet(() => countFn()(w.deps()));
    assert(n === 3, `ADR Decision 3: the unreadable key file counts as a key holder — expected 3, got ${JSON.stringify(n)}`);
  });
});

test('C6: the customer list plays no part — the count never loads it', async () => {
  await withWorld(async (w) => {
    const count = countFn();
    const loads = [];
    const realLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (/customerManager|customers\.json/.test(String(request))) loads.push(request);
      return realLoad.apply(this, arguments);
    };
    let n;
    try { n = await quiet(() => count(w.deps())); } finally { Module._load = realLoad; }
    assert(n === 2, `the path under test ran: expected 2, got ${JSON.stringify(n)}`);
    assert(loads.length === 0, `ADR Decision 2: status on the customer list plays no part, so the count must not load it — loaded ${JSON.stringify(loads)}`);
  });
});

test('C7: an Assistant pubkey stored in upper case is still recognised as an Assistant (review round 1, non-blocking 2)', async () => {
  await withWorld(async (w) => {
    // The inactive customer's key file is rewritten with its Assistant pubkey in upper case, and that Assistant holds a
    // key of its own (lower case, as every file name is). It is an Assistant, so it is not a customer.
    const k = generateRelayKeys();
    await quiet(() => w.store.storeRelayKeys(INACTIVE, { ...k, pubkey: k.pubkey.toUpperCase() }));
    const stored = await quiet(() => w.store.getStoredPubkey(INACTIVE));
    assert(stored === k.pubkey.toUpperCase(), `fixture check: the stored Assistant pubkey must be upper case, got ${stored}`);
    await quiet(() => w.store.storeRelayKeys(k.pubkey, generateRelayKeys()));
    const n = await quiet(() => countFn()(w.deps()));
    assert(n === 2, `the upper-case Assistant's own key file must be excluded like any Assistant — expected 2, got ${JSON.stringify(n)}`);
  });
});

// ── H — the read's handler ───────────────────────────────────────────────────

const baseDeps = (over = {}) => ({
  getOwnerPubkey: () => OWNER,
  getAdminPubkeys: () => [ADMIN],
  countInstanceCustomers: async () => 12,
  ...over,
});

test('H1: the read answers 200 with exactly success, ownerPubkey, adminPubkeys and customerCount', async () => {
  const res = await callHandler(baseDeps());
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
  const b = res.body || {};
  assert(same(Object.keys(b), ['success', 'ownerPubkey', 'adminPubkeys', 'customerCount']),
    `ADR Decision 1: nothing but the four fields — got ${JSON.stringify(Object.keys(b))}`);
  assert(b.success === true && b.ownerPubkey === OWNER && same(b.adminPubkeys, [ADMIN]) && b.customerCount === 12,
    `expected { success: true, ownerPubkey: OWNER, adminPubkeys: [ADMIN], customerCount: 12 }, got ${JSON.stringify(b)}`);
});

test('H2: adminPubkeys are lower-cased, de-duplicated, invalid entries dropped, the Owner removed, configured order kept', async () => {
  const res = await callHandler(baseDeps({
    getAdminPubkeys: () => [ADMIN_2.toUpperCase(), ADMIN, OWNER, ADMIN, 'not-a-key', '', null, ADMIN_2],
  }));
  const got = res.body && res.body.adminPubkeys;
  assert(JSON.stringify(got) === JSON.stringify([ADMIN_2, ADMIN]),
    `AC-2 ("shown only as Owner") and ADR Decision 1: expected [ADMIN_2, ADMIN] in that order, got ${JSON.stringify(got)}`);
});

test('H3: a count that could not be taken still answers the Owner and the Admins', async () => {
  const res = await callHandler(baseDeps({ countInstanceCustomers: async () => null }));
  const b = res.body || {};
  assert(res.statusCode === 200 && b.success === true, `expected 200 and success: true, got ${res.statusCode} ${JSON.stringify(b)}`);
  assert(b.customerCount === null, `customerCount must be null, got ${JSON.stringify(b.customerCount)}`);
  assert(b.ownerPubkey === OWNER && same(b.adminPubkeys, [ADMIN]), `the Owner and the Admins must still be answered, got ${JSON.stringify(b)}`);
});

test('H4: an unset or malformed owner answers ownerPubkey null; an upper-case one is lower-cased', async () => {
  for (const [given, want] of [[null, null], [undefined, null], ['', null], ['not-a-key', null], [OWNER.toUpperCase(), OWNER]]) {
    const res = await callHandler(baseDeps({ getOwnerPubkey: () => given }));
    const b = res.body || {};
    assert(res.statusCode === 200, `owner ${JSON.stringify(given)}: expected 200, got ${res.statusCode}`);
    assert(b.ownerPubkey === want, `owner ${JSON.stringify(given)}: expected ownerPubkey ${JSON.stringify(want)}, got ${JSON.stringify(b.ownerPubkey)}`);
    assert(same(b.adminPubkeys || [], [ADMIN]), `owner ${JSON.stringify(given)}: the Admins must be untouched, got ${JSON.stringify(b.adminPubkeys)}`);
  }
});

test('H5: over a real store, the read answers the count and no customer identity or key material (AC-4)', async () => {
  await withWorld(async (w) => {
    const count = countFn();
    const res = await callHandler(baseDeps({ countInstanceCustomers: () => count(w.deps()) }));
    const b = res.body || {};
    assert(b.customerCount === 2, `the path under test ran over the real store: expected customerCount 2, got ${JSON.stringify(b.customerCount)}`);
    const text = JSON.stringify(b);
    const { nip19 } = require('nostr-tools');
    const leaks = [];
    for (const account of [ACTIVE, INACTIVE, w.assistantAccount, w.ta.pubkey]) {
      if (text.includes(account)) leaks.push(`account ${account.slice(0, 8)}…`);
      if (text.includes(nip19.npubEncode(account))) leaks.push(`npub of ${account.slice(0, 8)}…`);
    }
    for (const [account, k] of Object.entries(w.keys)) {
      for (const field of ['pubkey', 'npub', 'privkey', 'nsec']) {
        if (k[field] && text.includes(k[field])) leaks.push(`${field} of ${account.slice(0, 8)}…'s Assistant`);
      }
    }
    assert(leaks.length === 0, `AC-4: the read must carry no customer identity and no key material — found ${leaks.join(', ')}`);
  });
});

test('H6: a failure outside the count answers 500 { success: false, error }', async () => {
  const res = await callHandler(baseDeps({ getAdminPubkeys: () => { throw new Error('settings unreadable'); } }));
  const b = res.body || {};
  assert(res.statusCode === 500, `expected 500, got ${res.statusCode}`);
  assert(b.success === false && typeof b.error === 'string' && b.error.length > 0, `expected { success: false, error }, got ${JSON.stringify(b)}`);
});

// ── R — the route ────────────────────────────────────────────────────────────

test('R1: the route table opens GET (and HEAD) /api/about-this-instance to everyone, as a read', () => {
  const ra = load(ROUTE_ACCESS_JS, 'the route table');
  const entry = ra.ROUTE_ACCESS[`GET ${F.ROUTE}`];
  assert(entry && entry.access === 'public' && entry.kind === 'read',
    `ADR Decision 1: the table needs 'GET ${F.ROUTE}': PUBLIC_READ — got ${JSON.stringify(entry)}`);
  for (const method of ['GET', 'HEAD']) {
    const got = ra.resolveRouteAccess(method, F.ROUTE);
    assert(got === 'public', `${method} ${F.ROUTE} must resolve 'public' (a route with no entry is the owner's side's) — got ${JSON.stringify(got)}`);
  }
});

test('R2: src/api/index.js registers GET /api/about-this-instance', () => {
  const s = code(src(API_INDEX_JS));
  assert(/app\.get\(\s*['"`]\/api\/about-this-instance['"`]\s*,/.test(s),
    `ADR § Implementation notes: register app.get('${F.ROUTE}', …) beside GET /api/owner-info`);
});

// ── S — the page sources (rendering is tests/brainstorm/about-this-instance.spec.js) ──

test('S1: /about renders the section after its existing content, which stays as it is (AC-1)', () => {
  const s = src(ABOUT_JSX);
  const c = code(s);
  assert(/import\s+AboutThisInstance\s+from\s+['"][^'"]*components\/AboutThisInstance(\.jsx)?['"]/.test(c),
    'BrainstormAbout.jsx must import the section from ../components/AboutThisInstance');
  const at = c.indexOf('<AboutThisInstance');
  assert(at > 0, 'BrainstormAbout.jsx must render <AboutThisInstance />');
  for (const kept of ['Brainstorm is a search engine for', 'Brainstorm is a project of', 'Brainstorm is open source', 'How Personalization Works']) {
    const i = s.indexOf(kept);
    assert(i > 0, `the existing content must be unchanged — "${kept}" is missing`);
    assert(at > i, `the section must come after the existing content — it renders before "${kept}"`);
  }
});

test('S2: the section carries its anchor, its title and its subtitle (AC-1)', () => {
  const s = src(SECTION_JSX);
  assert(new RegExp(`id=\\{?["'\`]${F.ANCHOR_ID}["'\`]\\}?`).test(s), `the section must carry id="${F.ANCHOR_ID}"`);
  assert(s.includes(F.COPY.title), `the title "${F.COPY.title}"`);
  assert(s.includes(F.COPY.subtitle), `the subtitle "${F.COPY.subtitle}"`);
});

test('S3: the section scrolls itself into view when the address carries #this-instance (AC-1, AC-5)', () => {
  const c = code(src(SECTION_JSX));
  assert(/\bhash\b/.test(c) && /scrollIntoView/.test(c),
    'ADR Decision 6: an effect reads location.hash and calls scrollIntoView on the section, on mount and once data has rendered');
});

test('S4: the cards come from the read and the shared profile batch, and open /user/<pubkey> (AC-2)', () => {
  const c = code(src(SECTION_JSX));
  assert(c.includes(`'${F.ROUTE}'`) || c.includes(`"${F.ROUTE}"`) || c.includes(`\`${F.ROUTE}\``), `the section fetches ${F.ROUTE}`);
  assert(/import\s*\{[^}]*\bfetchProfilesChunked\b[^}]*\}\s*from\s*['"][^'"]*utils\/profileBatch(\.js)?['"]/.test(c),
    'ADR § Implementation notes: names come through fetchProfilesChunked from ui/src/utils/profileBatch.js');
  assert(/\/user\/\$\{/.test(c), 'each card links to `/user/${pubkey}`');
  assert(/\bnip05\b/.test(c), 'each card shows the NIP-05 address when there is one');
  assert(/npubEncode/.test(c), 'the fallback name is a shortened npub (nip19.npubEncode)');
  assert(src(SECTION_JSX).includes(F.COPY.noAdmins), `zero Admins shows "${F.COPY.noAdmins}"`);
});

test('S5: the count line says customer or customers, or that the count is unavailable (AC-3)', () => {
  const s = src(SECTION_JSX);
  assert(new RegExp(`['"\`]${F.COPY.customerMany}['"\`]`).test(s) && new RegExp(`['"\`]${F.COPY.customerOne}['"\`]`).test(s),
    `the count line's words "${F.COPY.customerOne}" / "${F.COPY.customerMany}"`);
  assert(s.includes(F.COPY.countUnavailable), `a null count reads "${F.COPY.countUnavailable}"`);
});

test('S6: a failed load says so (AC-6)', () => {
  const s = src(SECTION_JSX);
  const variants = [F.COPY.loadFailed, F.COPY.loadFailed.replace(/'/g, '&apos;'), F.COPY.loadFailed.replace(/'/g, '’')];
  assert(variants.some((v) => s.includes(v)), `the failure line "${F.COPY.loadFailed}"`);
});

test('S7: the section loads no customer list and no owner-only read (AC-4)', () => {
  const c = code(src(SECTION_JSX));
  assert(c.includes(F.ROUTE), `the path under test: the section fetches ${F.ROUTE}`);
  const found = F.FORBIDDEN_READS.filter((r) => c.includes(r));
  assert(found.length === 0, `AC-4: the section must not read ${found.join(', ')}`);
});

test('S8: /about-brainstorm-search links "About this Brainstorm Instance" to /about#this-instance; its other links stay (AC-5)', () => {
  const s = src(SEARCH_ABOUT_JSX);
  const link = new RegExp(`<a\\s[^>]*href=["']${F.LINK_HREF}["'][^>]*>\\s*${F.COPY.linkText}\\s*</a>`);
  assert(link.test(s), `expected <a href="${F.LINK_HREF}" …>${F.COPY.linkText}</a>`);
  for (const kept of ['/how-search-works', '/brainstorm-skill', '/developers']) {
    assert(s.includes(`href="${kept}"`), `the existing link to ${kept} must stay`);
  }
});

// ── runner ───────────────────────────────────────────────────────────────────

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`about-this-instance: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
