/**
 * author-scoped-inspection #1: the instance assistant roster.
 *
 * Story: engineering-team/stories/author-scoped-inspection/1-instance-assistant-roster.md
 * ADR:   engineering-team/decisions/author-scoped-inspection/0001-instance-assistant-roster-and-delegate-resolver.md
 *
 * The roster's inputs (/etc/brainstorm.conf, customers.json, the secure-key store) live INSIDE the
 * container, so a host-run gate cannot exercise it end to end. Three classes, per
 * test/state-on-concept-page.test.js:
 *
 *   U1..U4 — the narrowed resolver's contract. Host-safe precisely BECAUSE no config is present:
 *            every lookup misses, and "misses cleanly" is what AC-3 and AC-4 rest on.
 *   S1..S6 — source structure the ADR requires. The private-key boundary is pinned HERE and only
 *            here: it is a property of the code, and a clean response never proves it.
 *   H1..H5 — live HTTP; SKIP when the stack is unreachable. Nothing is minted, nothing to tear down.
 *
 * EXPECTED NOW (pre-implementation): U1–U4 and S1–S6 FAIL (no exports, no handler, no route);
 * H1–H5 FAIL with 404, or SKIP when the stack is down.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KEYS_JS = path.join(ROOT, 'src/utils/assistantKeys.js');
const ROSTER_JS = path.join(ROOT, 'src/api/assistant/roster.js');
const API_INDEX_JS = path.join(ROOT, 'src/api/index.js');
const AUTH_MW_JS = path.join(ROOT, 'src/middleware/auth.js');
const CLASSIFICATION_JS = path.join(ROOT, 'src/api/auth/getUserClassification.js');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const ROLES = ['owner', 'admin', 'customer'];
const HEX64 = /^[0-9a-f]{64}$/;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function rel(p) { return path.relative(ROOT, p); }
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist`);
  return s;
}
const flat = (s) => s.replace(/\s+/g, ' ');

/** Strip line and block comments so a structural assertion cannot be satisfied by prose. */
/**
 * Source with comments blanked out, so a structural assertion cannot be satisfied by prose.
 *
 * A scanner, not a regex pair. The obvious `s.replace(/\/\*[\s\S]*?\*\//g, ' ')` cannot tell a
 * comment from a STRING that happens to contain the same two characters, and this repo has one:
 * `src/api/index.js` registers the Express wildcard route `app.delete('/api/settings/*', ...)`.
 * That regex reads the `/*` inside those quotes as an opening comment, runs to the next real
 * `*​/`, and blanks ~300 lines of route registrations — so an assertion that a route exists fails
 * against a file where it plainly does. Strings are tracked here for that reason.
 *
 * Known limit: regex literals are not tracked, so a regex containing `/*` or `//` would still
 * mislead it. None of the files these suites read contains one.
 */
function code(s) {
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '*') {            // block comment
      const end = s.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k++) out += s[k] === '\n' ? '\n' : ' ';
      i = stop;
    } else if (c === '/' && d === '/') {     // line comment
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

function loadKeys() {
  try { return require(KEYS_JS); } catch { return null; }
}

// ── live-stack probe ──────────────────────────────────────────────────────────

let stackUp = null;
async function haveStack() {
  if (stackUp !== null) return stackUp;
  try {
    const res = await fetch(`${HOST_BASE}/api/assistant/pubkey`, { signal: AbortSignal.timeout(2500) });
    stackUp = res.ok;
  } catch { stackUp = false; }
  return stackUp;
}

let _roster;
async function getRoster() {
  if (_roster !== undefined) return _roster;
  try {
    const res = await fetch(`${HOST_BASE}/api/assistant/roster`, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* not JSON — H1 reports it */ }
    _roster = { status: res.status, text, body };
  } catch (e) {
    _roster = { status: 0, text: '', body: null, error: e.message };
  }
  return _roster;
}

class Skip extends Error {}
function skipUnlessStack(up) { if (!up) throw new Skip('control panel not reachable'); }

// ── U — the narrowed resolver's contract (host-safe) ──────────────────────────

test('U1: assistantKeys exports getAssistantPubkeyFor and listInstanceAssistants', () => {
  const m = loadKeys();
  assert(m, `${rel(KEYS_JS)} must load`);
  assert(typeof m.getAssistantPubkeyFor === 'function',
    'ADR 0001 §Implementation: src/utils/assistantKeys.js must export getAssistantPubkeyFor(accountPubkey) — the ONE main->delegate mapping, so getUserClassification and W13 stop minting their own');
  assert(typeof m.listInstanceAssistants === 'function',
    'ADR 0001 §Implementation: src/utils/assistantKeys.js must export listInstanceAssistants({ includeAdmins })');
});

test('U2: an account the instance does not know resolves to null, cleanly', async () => {
  const m = loadKeys();
  assert(m && typeof m.getAssistantPubkeyFor === 'function', 'U1 must pass first');
  let out;
  try {
    out = await m.getAssistantPubkeyFor('b'.repeat(64));
  } catch (e) {
    throw new Error(`AC-3: an unprovisioned account must resolve to null, not throw — got ${e.message}`);
  }
  assert(out === null,
    `AC-3: an unknown account must resolve to exactly null (absent, not an error) — got ${JSON.stringify(out)}`);
});

test('U3: the resolver yields a hex string or null — never an object that could carry a private key', async () => {
  const m = loadKeys();
  assert(m && typeof m.getAssistantPubkeyFor === 'function', 'U1 must pass first');
  for (const input of ['b'.repeat(64), '', null, undefined]) {
    const out = await m.getAssistantPubkeyFor(input);
    const ok = out === null || (typeof out === 'string' && HEX64.test(out));
    assert(ok,
      `AC-4 / ADR 0001 §Decision: getAssistantPubkeyFor must return a hex pubkey string or null so no caller can forward privkey by forwarding too much — for input ${JSON.stringify(input)} it returned ${typeof out} ${JSON.stringify(out)}`);
  }
});

test('U4: listInstanceAssistants resolves to an array even with no instance config present', async () => {
  const m = loadKeys();
  assert(m && typeof m.listInstanceAssistants === 'function', 'U1 must pass first');
  let out;
  try {
    out = await m.listInstanceAssistants({ includeAdmins: false });
  } catch (e) {
    throw new Error(`AC-1: listInstanceAssistants must tolerate a missing instance config (host run, no /etc/brainstorm.conf) rather than throw — got ${e.message}`);
  }
  assert(Array.isArray(out),
    `AC-1: listInstanceAssistants must resolve to an array — got ${typeof out}`);
});

// ── S — structure the ADR requires ────────────────────────────────────────────

test('S1: the roster handler exists and is registered as a GET under /api/assistant/', () => {
  assert(fs.existsSync(ROSTER_JS),
    `ADR 0001 §Implementation: ${rel(ROSTER_JS)} must exist and export handleGetAssistantRoster`);
  const idx = flat(code(src(API_INDEX_JS)));
  assert(/app\.get\(\s*['"]\/api\/assistant\/roster['"]/.test(idx),
    "ADR 0001 §Implementation: src/api/index.js must register app.get('/api/assistant/roster', …) beside the other /api/assistant/* routes");
});

test('S2: the roster path collides with no protectedGetEndpoints entry', () => {
  const mw = src(AUTH_MW_JS);
  const block = mw.slice(mw.indexOf('protectedGetEndpoints'));
  const entries = [...block.slice(0, 400).matchAll(/'(\/[^']+)'/g)].map((m) => m[1]);
  assert(entries.length > 0, 'could not read protectedGetEndpoints from src/middleware/auth.js');
  const p = '/api/assistant/roster';
  for (const e of entries) {
    assert(!p.includes(e),
      `ADR 0001 §Implementation: protectedGetEndpoints matches with .includes(), so the roster path must contain no entry as a substring — '${p}' contains '${e}' and would be silently 401'd`);
  }
});

test('S3: the handler names no private key material and never calls getAssistantKeys directly', () => {
  const s = code(src(ROSTER_JS));
  for (const forbidden of ['privkey', 'nsec']) {
    assert(!new RegExp(forbidden, 'i').test(s),
      `AC-4: ${rel(ROSTER_JS)} must never mention ${forbidden} — the roster is a public-key surface and the boundary is structural, not a convention`);
  }
  assert(!/\bgetAssistantKeys\s*\(/.test(s),
    'AC-4: the handler must go through the narrowed getAssistantPubkeyFor / listInstanceAssistants, never getAssistantKeys (which returns privkey and nsec)');
});

test('S4: admins are included only when the caller is the owner', () => {
  const s = flat(code(src(ROSTER_JS)));
  assert(/includeAdmins/.test(s),
    'ADR 0001 §Decision: the handler must pass includeAdmins through to listInstanceAssistants');
  assert(/BRAINSTORM_OWNER_PUBKEY/.test(s),
    "AC-1 / ADR 0001 §Decision: includeAdmins must be gated on the session pubkey equalling BRAINSTORM_OWNER_PUBKEY — /api/admin/list is behind requireOwnerOnly and a public roster must not route around it");
});

test('S5: getUserClassification stops defining its own resolver and imports the shared one', () => {
  const s = code(src(CLASSIFICATION_JS));
  assert(!/function\s+resolveAssistantPubkey/.test(s),
    'ADR 0001 §Decision: the private resolveAssistantPubkey in src/api/auth/getUserClassification.js must be deleted — one mapping, not three');
  assert(/getAssistantPubkeyFor/.test(s),
    'ADR 0001 §Decision: getUserClassification must call the shared getAssistantPubkeyFor instead');
});

test('S6: a roster row carries the four named fields and no others', () => {
  const s = code(src(KEYS_JS));
  for (const field of ['accountPubkey', 'assistantPubkey', 'role', 'displayName']) {
    assert(new RegExp(`\\b${field}\\b`).test(s),
      `ADR 0001 §Implementation: a roster row must carry ${field}`);
  }
  assert(!/\bnpub\b/.test(s.slice(s.indexOf('listInstanceAssistants'))),
    'ADR 0001 §Implementation: "No other field." — the row is exactly accountPubkey, assistantPubkey, role, displayName');
});

// ── H — live HTTP (SKIP when the stack is down) ───────────────────────────────

test('H1: GET /api/assistant/roster answers 200 with an assistants array', async () => {
  skipUnlessStack(await haveStack());
  const r = await getRoster();
  assert(r.status === 200,
    `AC-1: GET /api/assistant/roster must answer 200 — got ${r.status}${r.error ? ` (${r.error})` : ''}`);
  assert(r.body && r.body.success === true && Array.isArray(r.body.assistants),
    `AC-1: the response must be { success: true, assistants: [...] } — got ${r.text.slice(0, 200)}`);
});

test('H2: every row is a well-formed account/assistant pair', async () => {
  skipUnlessStack(await haveStack());
  const r = await getRoster();
  assert(r.body && Array.isArray(r.body.assistants), 'H1 must pass first');
  for (const row of r.body.assistants) {
    assert(HEX64.test(row.accountPubkey || ''),
      `AC-1: every row needs a 64-hex accountPubkey — got ${JSON.stringify(row.accountPubkey)}`);
    assert(ROLES.includes(row.role),
      `AC-1: role must be one of ${ROLES.join('/')} — got ${JSON.stringify(row.role)}`);
    assert(row.assistantPubkey === null || HEX64.test(row.assistantPubkey || ''),
      `AC-2/AC-3: assistantPubkey must be a 64-hex pubkey or null (absent, never omitted and never an error) — got ${JSON.stringify(row.assistantPubkey)}`);
    assert(Object.prototype.hasOwnProperty.call(row, 'assistantPubkey'),
      'AC-3: an unprovisioned account still appears, with assistantPubkey present and null — the key must not be omitted');
  }
});

test('H3: an unauthenticated read discloses no admin', async () => {
  skipUnlessStack(await haveStack());
  const r = await getRoster();
  assert(r.body && Array.isArray(r.body.assistants), 'H1 must pass first');
  const admins = r.body.assistants.filter((x) => x.role === 'admin');
  assert(admins.length === 0,
    `AC-1 / ADR 0001 §Decision: GET /api/admin/list is owner-only, so an unauthenticated roster must disclose no admin — got ${admins.length}`);
});

test('H4: no private key material appears anywhere in the response', async () => {
  skipUnlessStack(await haveStack());
  const r = await getRoster();
  assert(r.status === 200, 'H1 must pass first');
  for (const forbidden of ['privkey', 'nsec', 'private']) {
    assert(!r.text.toLowerCase().includes(forbidden),
      `AC-4: the roster response must contain no ${forbidden} — found it in the body`);
  }
});

test('H5: the owner row agrees with /api/assistant/pubkey', async () => {
  skipUnlessStack(await haveStack());
  const r = await getRoster();
  assert(r.body && Array.isArray(r.body.assistants), 'H1 must pass first');
  const res = await fetch(`${HOST_BASE}/api/assistant/pubkey`, { signal: AbortSignal.timeout(5000) });
  const { pubkey } = await res.json();
  assert(HEX64.test(pubkey || ''), 'the existing /api/assistant/pubkey must still answer a hex pubkey (regression guard)');
  const owner = r.body.assistants.find((x) => x.role === 'owner');
  assert(owner,
    'AC-1: the roster must carry the owner row even unauthenticated — story 3 falls back to Owner when signed out');
  assert(owner.assistantPubkey === pubkey,
    `AC-2/AC-5: the owner row's assistantPubkey must be this deployment's own TA, resolved at runtime — roster says ${owner.assistantPubkey}, /api/assistant/pubkey says ${pubkey}`);
});

async function run() {
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      if (e instanceof Skip) {
        skipped++;
        console.log(`  ⏭️  ${t.name} — ${e.message}`);
        continue;
      }
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`author-scoped-inspection-roster: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
