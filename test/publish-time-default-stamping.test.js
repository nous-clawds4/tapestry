/**
 * shared-concepts-adoption #4 — publish-time default stamping.
 * Story: engineering-team/stories/shared-concepts-adoption/4-publish-time-default-stamping.md
 * ADR:   engineering-team/decisions/shared-concepts-adoption/0004-publish-time-default-stamping.md
 * Book:  engineering-team/audits/shared-concepts-adoption/book.md
 *
 * Three classes:
 *
 *   U1..U6 — pure tests of selectPointerTargets + STAMP_CAP
 *            (src/lib/bValueForms.js — stamp selection IS b-semantics, so it
 *            lives beside classifyBValue): pointer/untyped kept, inherit
 *            excluded, self excluded, sentinel/malformed dropped, cap + dedupe,
 *            zero-require preserved.
 *   S1..S4 — structural pins (line-based; #109/#143 discipline): both pin
 *            writer sites carry the conditional personal handle while the
 *            ADR-0015 legacy literal stays; the TL builder carries the
 *            personal handle beside its existing one; the already-dual
 *            profile-tag lines are byte-unchanged (regression); create-element
 *            consults the selector.
 *   H1..H4 — live-stack integration (SKIP when the stack is down): the
 *            create-element seam proven three ways against a SINGLETON fixture
 *            concept — unwired → single z (regression, passes pre AND post);
 *            wired (pointer-b to a foreign fixture) → BOTH z's (the
 *            discriminating row, fails pre); deferred (sentinel) → single z
 *            (regression); teardown republishes the fixture header bare
 *            (nextStamp discipline, OPEN.md #144).
 *
 * EXPECTED NOW (pre-implementation):
 *   U1–U6 FAIL (selectPointerTargets is not exported);
 *   S1, S2, S4 FAIL (conditional handles / selector reference absent);
 *   S3 PASS (profile-tag dual lines + legacy literals — regression guard);
 *   H2 FAIL when the stack is up (a wired concept's element carries only the
 *     personal z today); H1, H3 PASS (today's single-z behavior IS the
 *     unwired/deferred contract); H4 teardown always runs;
 *   all H SKIP (recorded) when the stack is down.
 *
 * Fixture safety: ONE clearly-named fixture concept (`stamping fixture f4`,
 * created once via the runtime create-concept producer; "already exists" is
 * tolerated on every later run) + three SINGLETON fixed-name elements (the
 * dupe check refuses re-mints, so growth stops after run one — the bounded
 * residue is documented in the test plan). The header's wiring is reset bare
 * each run via nextStamp republish; the foreign target is F1's non-secret
 * throwaway key. Pin/TL parity is S-level only: both writers are
 * browser/session paths a loopback caller cannot operate (recorded gap).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/bValueForms.js');
const PIN_JS = path.join(ROOT, 'ui/src/utils/publishTagPin.js');
const PROFILE_TAG_JS = path.join(ROOT, 'ui/src/utils/publishProfileTag.js');
const TL_JS = path.join(ROOT, 'src/api/trustedList/index.js');
const NORMALIZE_JS = path.join(ROOT, 'src/api/normalize/index.js');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;

const FOREIGN_SK = Uint8Array.from(Array(32).fill(7)); // F1's non-secret throwaway
const CONCEPT_NAME = 'stamping fixture f4';
const CONCEPT_SLUG = 'stamping-fixture-f4';
const SENTINEL = 'b-tag-deferred';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function selOrFail() {
  const { selectPointerTargets } = require(LIB_JS);
  assert(typeof selectPointerTargets === 'function',
    'selectPointerTargets must be exported from src/lib/bValueForms.js (ADR 0004) — implement the pure selector first');
  return selectPointerTargets;
}

const PK = 'a'.repeat(64);
const SELF = `39998:${PK}:recipes`;
const T1 = `39998:${'b'.repeat(64)}:cooking`;
const T2 = `39998:${'c'.repeat(64)}:food`;
const row = (value, type) => ({ value, type });

// ═══ U — the pure selector ═════════════════════════════════════════════

test('U1: pointer-typed and untyped a-tag targets are kept; inherit-typed are excluded', () => {
  const sel = selOrFail();
  const out = sel([row(T1, 'pointer'), row(T2, undefined), row(`39998:${'d'.repeat(64)}:x`, 'inherit')], SELF);
  assert(out.includes(T1) && out.includes(T2), `pointer and untyped targets must be kept, got ${JSON.stringify(out)}`);
  assert(out.length === 2, `inherit-typed targets never stamp (an inherit-only holder declares affiliation with one more b), got ${JSON.stringify(out)}`);
});

test('U2: the self coordinate is excluded — it is already the personal stamp', () => {
  const sel = selOrFail();
  const out = sel([row(SELF, 'pointer'), row(T1, 'pointer')], SELF);
  assert(!out.includes(SELF) && out.includes(T1), `self must be excluded, got ${JSON.stringify(out)}`);
});

test('U3: sentinel and malformed values drop out', () => {
  const sel = selOrFail();
  const out = sel([row(SENTINEL, undefined), row('garbage', 'pointer'), row('f'.repeat(64), 'pointer'), row(T1, 'pointer')], SELF);
  assert(out.length === 1 && out[0] === T1,
    `only well-formed a-tag targets stamp (event-id b's locate an event, not a stampable concept), got ${JSON.stringify(out)}`);
});

test('U4: the cap is enforced and exported (the ratified ~5, implementation-chosen per W11)', () => {
  const { STAMP_CAP } = require(LIB_JS);
  assert(STAMP_CAP === 5, `STAMP_CAP must be 5, got ${STAMP_CAP}`);
  const sel = selOrFail();
  const valid = Array.from({ length: 7 }, (_, i) => row(`39998:${(i.toString(16)).repeat(64).slice(0, 64)}:t${i}`, 'pointer'));
  const out = sel(valid, SELF);
  assert(out.length === 5, `the cap must bound the selection at 5, got ${out.length}`);
});

test('U5: duplicates collapse; empty rows yield an empty selection', () => {
  const sel = selOrFail();
  assert(sel([row(T1, 'pointer'), row(T1, undefined)], SELF).length === 1, 'duplicate targets must collapse');
  assert(sel([], SELF).length === 0 && sel(undefined, SELF).length === 0, 'empty/absent rows yield []');
});

test('U6: the lib stays zero-require', () => {
  const src = safeRead(LIB_JS);
  assert(src && !/\brequire\s*\(/.test(src), 'the pure core must remain zero-require');
});

// ═══ S — structural pins ═══════════════════════════════════════════════

test('S1: both pin-writer sites carry the conditional personal handle; the legacy literal stays', () => {
  const src = safeRead(PIN_JS);
  assert(src, 'publishTagPin.js unreadable');
  // Negative lookahead excludes the LEGACY constant's own definition (line
  // ~48) — only RUNTIME-variable templates count as site additions.
  const personal = (src.match(/39998:\$\{(?!LEGACY)[^}]*\}:tag-pinning/g) || []).length;
  assert(personal >= 2, `both pin builders must template the personal (runtime-TA) tag-pinning handle (found ${personal} of 2 — the profileTag W11 conditional, ADR 0003 finished)`);
  const legacy = (src.match(/TAG_PINNING_HANDLE/g) || []).length;
  assert(legacy >= 2, `the canonical legacy handle stays at both sites (ADR 0015 guard), found ${legacy}`);
});

test('S2: the TL builder carries the personal handle beside its existing one', () => {
  const src = safeRead(TL_JS);
  assert(src, 'trustedList/index.js unreadable');
  assert(/39998:\$\{[^}]*\}:tag-pinning|`39998:` ?\+/.test(src) || /personalZ|personalHandle/.test(src),
    'the TL builder must add the personal (runtime-TA) tag-pinning handle (ADR 0004)');
  assert(/TAG_PINNING_Z_TAG/.test(src), 'the existing shared handle stays (ADR 0015 guard)');
});

test('S3 (regression, passes pre AND post): the already-dual profile-tag lines are byte-unchanged', () => {
  const src = safeRead(PROFILE_TAG_JS);
  assert(src, 'publishProfileTag.js unreadable');
  assert(src.includes("['z', NOSTR_USER_TAG_HANDLE]"), 'the canonical profile-tag z line must stay');
  assert(src.includes("...(hasLocalTa ? [['z', `39998:${localTaPubkey}:nostr-user-tag`]] : [])"),
    'the conditional local-TA z line must stay byte-identical (the pattern this story copies, not edits)');
});

test('S4: create-element consults the selector', () => {
  const src = safeRead(NORMALIZE_JS);
  assert(src, 'normalize/index.js unreadable');
  assert(/selectPointerTargets/.test(src),
    'handleCreateElement must map the header\'s b rows through selectPointerTargets (the ADR 0004 seam)');
});

// ═══ H — live integration (SKIP when the stack is down) ════════════════

let _stack = null;
async function stack() {
  if (_stack) return _stack;
  try {
    const r = await fetch(`${HOST_BASE}/api/assistant/pubkey`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    _stack = (j && j.success && /^[0-9a-f]{64}$/.test(j.pubkey)) ? { up: true, ta: j.pubkey } : { up: false };
  } catch { _stack = { up: false }; }
  return _stack;
}
function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
}
function loopbackPostJson(pathname, body) {
  const out = dockerCurl(['-s', '-m', '25', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); } catch { return { _raw: out.slice(0, 200) }; }
}
async function scanNewest(filter) {
  const f = encodeURIComponent(JSON.stringify(filter));
  const r = await fetch(`${HOST_BASE}/api/strfry/scan?filter=${f}`, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  const events = j.events || j.data || [];
  return events.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
}
async function currentStamp(filter) {
  const ev = await scanNewest(filter).catch(() => null);
  return ev ? ev.created_at || 0 : 0;
}
async function nextStamp(filter) {
  return Math.max(Math.floor(Date.now() / 1000), (await currentStamp(filter)) + 1);
}
function foreignPk() { return require('nostr-tools').getPublicKey(FOREIGN_SK); }
const EXT_TARGET = () => `39998:${foreignPk()}:ext-shared-fixture`;

async function conceptCoord() { return `39998:${(await stack()).ta}:${CONCEPT_SLUG}`; }

/** Ensure the singleton fixture concept exists ("already exists" tolerated). */
async function ensureFixtureConcept() {
  const resp = loopbackPostJson('/api/normalize/create-concept', { name: CONCEPT_NAME, description: 'F4 test fixture — singleton; safe to ignore.' });
  if (resp && resp.success === true) return true;
  const msg = JSON.stringify(resp || {});
  assert(/already exists|exists/i.test(msg), `create-concept failed for a non-exists reason: ${msg.slice(0, 200)}`);
  return true;
}

/** Reset the fixture header BARE (no b) via a nextStamp republish (OPEN.md #144). */
async function bareHeader() {
  const s = await stack();
  const created_at = await nextStamp({ kinds: [39998], authors: [s.ta], '#d': [CONCEPT_SLUG] });
  const existing = await scanNewest({ kinds: [39998], authors: [s.ta], '#d': [CONCEPT_SLUG] });
  const keep = (existing?.tags || []).filter((t) => t[0] !== 'b');
  return loopbackPostJson('/api/strfry/publish', {
    event: { kind: 39998, content: existing?.content || '', tags: keep.length ? keep : [['d', CONCEPT_SLUG], ['names', CONCEPT_NAME, CONCEPT_NAME + 's']], created_at },
    signAs: 'assistant',
  });
}

async function createElement(name) {
  return loopbackPostJson('/api/normalize/create-element', { concept: CONCEPT_NAME, name, json: { [CONCEPT_SLUG.replace(/-([a-z0-9])/g, (m, c) => c.toUpperCase())]: { name } } });
}
async function elementZs(name) {
  const s = await stack();
  const f = encodeURIComponent(JSON.stringify({ kinds: [39999], authors: [s.ta] }));
  const r = await fetch(`${HOST_BASE}/api/strfry/scan?filter=${f}`, { signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  const events = j.events || j.data || [];
  const ev = events.filter((e) => (e.tags || []).some((t) => t[0] === 'name' && t[1] === name))
    .reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
  return ev ? (ev.tags || []).filter((t) => t[0] === 'z').map((t) => t[1]) : null;
}

test('H1 (regression, passes pre AND post): under an UNWIRED concept an element carries the single personal z', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  await ensureFixtureConcept();
  const rb = await bareHeader();
  assert(rb && rb.success === true, `bare-header reset failed: ${JSON.stringify(rb).slice(0, 200)}`);
  const name = 'stamping fixture element unwired';
  const made = await createElement(name);
  const ok = (made && made.success === true) || /already exists/i.test(JSON.stringify(made || {}));
  assert(ok, `element create failed: ${JSON.stringify(made).slice(0, 200)}`);
  const zs = await elementZs(name);
  assert(Array.isArray(zs), 'the unwired element must be scannable');
  assert(zs.includes(await conceptCoord()), 'the personal z must be present');
  assert(zs.length === 1, `an unwired concept's element carries exactly one z, got ${JSON.stringify(zs)}`);
});

test('H2 (THE discriminating row): under a WIRED concept a fresh element carries BOTH addresses', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const wire = loopbackPostJson(`/api/concept/${encodeURIComponent(await conceptCoord())}/b-append`, { target: EXT_TARGET() });
  assert(wire && wire.success === true, `wiring the fixture failed: ${JSON.stringify(wire).slice(0, 200)}`);
  const name = 'stamping fixture element wired';
  const made = await createElement(name);
  const ok = (made && made.success === true) || /already exists/i.test(JSON.stringify(made || {}));
  assert(ok, `element create failed: ${JSON.stringify(made).slice(0, 200)}`);
  const zs = await elementZs(name);
  assert(Array.isArray(zs), 'the wired element must be scannable');
  assert(zs.includes(await conceptCoord()), `the personal z must be present, got ${JSON.stringify(zs)}`);
  assert(zs.includes(EXT_TARGET()),
    `the wired concept's element must ALSO carry the chosen shared handle (the ratified floor — ADR 0004 seam), got ${JSON.stringify(zs)}`);
});

test('H3 (regression, passes pre AND post): under a DEFERRED concept an element carries the single personal z', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rb = await bareHeader();
  assert(rb && rb.success === true, 'bare-header reset before defer failed');
  const defer = loopbackPostJson(`/api/concept/${encodeURIComponent(await conceptCoord())}/b-defer`, {});
  assert(defer && defer.success === true, `defer failed: ${JSON.stringify(defer).slice(0, 200)}`);
  const name = 'stamping fixture element deferred';
  const made = await createElement(name);
  const ok = (made && made.success === true) || /already exists/i.test(JSON.stringify(made || {}));
  assert(ok, `element create failed: ${JSON.stringify(made).slice(0, 200)}`);
  const zs = await elementZs(name);
  assert(Array.isArray(zs) && zs.length === 1 && zs[0] === await conceptCoord(),
    `a deferred (sentinel) concept resolves to personal-only, got ${JSON.stringify(zs)}`);
});

test('H4: teardown — the fixture header resets bare', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rb = await bareHeader();
  assert(rb && rb.success === true, 'teardown bare republish failed');
});

// ═══ runner ════════════════════════════════════════════════════════════

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\npublish-time-default-stamping: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
