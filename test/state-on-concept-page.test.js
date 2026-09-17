/**
 * shared-concepts-legibility #1 — a concept's sharing state on its own page.
 * Story: engineering-team/stories/shared-concepts-legibility/1-state-on-concept-page.md
 * ADR:   engineering-team/decisions/shared-concepts-legibility/0001-sharing-state-resolver.md
 *
 * The owner ruled that "shared" means PUBLISHED TO A PUBLIC RELAY — declared
 * locally is not enough. The load-bearing consequence is U2: a relay check
 * that could not run must resolve to `null` (unknown), NEVER to `false`
 * (not shared). fetchFromRelays collapses exactly that distinction, which is
 * why the resolver lives server-side (ADR Decision).
 *
 *   U1..U8 — the pure resolver: carriesSelfPointer applied to two stores, the
 *            tri-state published rule, local-state passthrough, purity.
 *   S1..S7 — structural: lib + endpoint registration, handler-seam
 *            composition, the page's badge / label / confirm / refresh wiring,
 *            and a regression pin on self-declare's write gate.
 *   H1..H5 — live (SKIP when the stack is down): endpoint shape against real
 *            headers discovered at runtime, handle validation, and a
 *            neighbouring-endpoint regression. No fixtures are minted, so
 *            there is nothing to tear down.
 *
 * EXPECTED NOW (pre-implementation): U1–U8, S1–S6 FAIL (lib, endpoint and UI
 * wiring absent); S7 PASS (regression guard); H1–H4 FAIL with 404; H5 PASS;
 * all H SKIP when the stack is down.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/sharingState.js');
const B_FORMS_JS = path.join(ROOT, 'src/lib/bValueForms.js');
const API_INDEX_JS = path.join(ROOT, 'src/api/index.js');
const HANDLER_JS = path.join(ROOT, 'src/api/concept/sharingState.js');
const SELF_DECLARE_JS = path.join(ROOT, 'src/api/concept/selfDeclare.js');
const DETAIL_JSX = path.join(ROOT, 'ui/src/pages/concepts/ConceptDetail.jsx');
const HOOK_JS = path.join(ROOT, 'ui/src/hooks/useSharingState.js');
const CONFIRM_JSX = path.join(ROOT, 'ui/src/components/ConfirmDialog.jsx');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function libMod() {
  try { return require(LIB_JS); } catch (err) { throw new Error(`src/lib/sharingState.js does not load: ${err.message}`); }
}

const COORD = '39998:'.concat('a'.repeat(64), ':cat-breed');
const OTHER = '39998:'.concat('b'.repeat(64), ':cat-breed');
const SENTINEL = 'b-tag-deferred';

/** A kind-39998 header event carrying the given b values. */
function header(coord, bValues, extraTags) {
  const d = coord.split(':').slice(2).join(':');
  return {
    id: 'e'.repeat(64),
    pubkey: coord.split(':')[1],
    kind: 39998,
    created_at: 1000,
    tags: [['d', d], ['names', 'cat breed', 'cat breeds'],
      ...(bValues || []).map((v) => ['b', v, 'pointer']),
      ...(extraTags || [])],
  };
}

// ═══ U — the pure resolver ═════════════════════════════════════════════

test('U1: carriesSelfPointer is the same test for either store — self coord yes, anything else no', () => {
  const { carriesSelfPointer } = libMod();
  assert(carriesSelfPointer(header(COORD, [COORD]), COORD) === true,
    'a b-tag equal to the event\'s own coordinate is a self-declaration');
  assert(carriesSelfPointer({ ...header(COORD, []), tags: [['d', 'cat-breed'], ['b', COORD]] }, COORD) === true,
    "the third tag element ('pointer') is optional — the live wire form carries it, but its absence must not change the answer");
  assert(carriesSelfPointer(header(COORD, [OTHER]), COORD) === false,
    'a b-tag pointing at ANOTHER header is wiring, not self-declaration');
  assert(carriesSelfPointer(header(COORD, [SENTINEL]), COORD) === false,
    'the keep-private sentinel is a disposition marker, never a self-declaration');
  assert(carriesSelfPointer(header(COORD, []), COORD) === false, 'no b tags → not self-declared');
  assert(carriesSelfPointer(null, COORD) === false, 'a missing event must return false, not throw');
  assert(carriesSelfPointer({ tags: null }, COORD) === false, 'a malformed event must return false, not throw');
});

test('U2 (AC-4, load-bearing): a relay check that could not run resolves to null — never to false', () => {
  const { resolveSharingState } = libMod();
  const out = resolveSharingState({
    coord: COORD, disposition: { wired: false, selfDeclared: true, deferred: false },
    wiredTo: [], relayEvent: null, relayOk: false,
  });
  assert(out.published === null,
    `an unreachable relay must resolve published to null (unknown), got ${JSON.stringify(out.published)}`);
  assert(out.published !== false,
    'reporting "not shared" on the strength of a check that failed to run is the exact defect this story exists to remove');
});

test('U3 (AC-2): the relay copy carries the self-pointer → published', () => {
  const { resolveSharingState } = libMod();
  const out = resolveSharingState({
    coord: COORD, disposition: { wired: false, selfDeclared: true, deferred: false },
    wiredTo: [], relayEvent: header(COORD, [COORD]), relayOk: true,
  });
  assert(out.published === true, 'a relay copy bearing its own coordinate as a b-tag is published');
});

test('U4 (AC-3): a relay copy WITHOUT the self-pointer is not published — published-before-declared', () => {
  const { resolveSharingState } = libMod();
  const out = resolveSharingState({
    coord: COORD, disposition: { wired: false, selfDeclared: true, deferred: false },
    wiredTo: [], relayEvent: header(COORD, []), relayOk: true,
  });
  assert(out.published === false,
    'the published test is two-part: the relay copy must EXIST and carry the self-pointer. A header pushed to the relay before it was declared is present but not shared');
  assert(out.local.selfDeclared === true,
    'local declaration and relay publication are independent — this is the "declared here, not yet on the relay" state');
});

test('U5 (AC-3): no relay copy at all, relay reachable → published false, declared locally true', () => {
  const { resolveSharingState } = libMod();
  const out = resolveSharingState({
    coord: COORD, disposition: { wired: false, selfDeclared: true, deferred: false },
    wiredTo: [], relayEvent: null, relayOk: true,
  });
  assert(out.published === false, 'a reachable relay with no copy is a real negative');
  assert(out.local.selfDeclared === true, 'the local declaration still stands');
});

test('U6 (AC-1): no markers anywhere → not shared, nothing wired, nothing deferred', () => {
  const { resolveSharingState } = libMod();
  const out = resolveSharingState({
    coord: COORD, disposition: { wired: false, selfDeclared: false, deferred: false },
    wiredTo: [], relayEvent: null, relayOk: true,
  });
  assert(out.published === false, 'an undispositioned header is not shared');
  assert(out.local.selfDeclared === false && out.local.wired === false && out.local.deferred === false,
    'an undispositioned header carries none of the three states');
  assert(Array.isArray(out.local.wiredTo) && out.local.wiredTo.length === 0, 'wiredTo must be an empty array, not undefined');
});

test('U7 (AC-7): self-declared AND wired co-occur — both survive, wiredTo excludes the self coord', () => {
  const { resolveSharingState } = libMod();
  const out = resolveSharingState({
    coord: COORD, disposition: { wired: true, selfDeclared: true, deferred: false },
    wiredTo: [OTHER], relayEvent: header(COORD, [COORD, OTHER]), relayOk: true,
  });
  assert(out.local.selfDeclared === true && out.local.wired === true,
    'multi-b headers are ratified and expected — the resolver must not switch on the first match');
  assert(out.local.wiredTo.length === 1 && out.local.wiredTo[0] === OTHER,
    `wiredTo carries only external targets, never the self coordinate — got ${JSON.stringify(out.local.wiredTo)}`);
  assert(out.published === true, 'a co-occurring external wire does not stop the self-declaration from being published');
});

test('U8 (AC-6 + purity): the sentinel state passes through, and the core is zero-require', () => {
  const { resolveSharingState } = libMod();
  const out = resolveSharingState({
    coord: COORD, disposition: { wired: false, selfDeclared: false, deferred: true },
    wiredTo: [], relayEvent: null, relayOk: true,
  });
  assert(out.local.deferred === true, 'a sentinel-only header is kept private');
  assert(out.local.wiredTo.length === 0,
    'the sentinel locates nothing — it must never leak into wiredTo, where the UI would render it as a broken link');

  const src = safeRead(LIB_JS);
  assert(src, 'src/lib/sharingState.js is missing');
  assert(!/\brequire\s*\(/.test(src),
    'the pure core must have zero requires (the house lib pattern — adoptionQueue, trustedDictionary and bValueForms are all strictly zero-require). b-value classification belongs at the HANDLER seam, as trustedDictionary resolves its qualifying set');
  const mod = libMod();
  assert(typeof mod.carriesSelfPointer === 'function' && typeof mod.resolveSharingState === 'function',
    'the lib must export carriesSelfPointer and resolveSharingState');
});

// ═══ S — structural pins ═══════════════════════════════════════════════

test('S1: GET /api/concept/:handle/sharing-state is registered and is a PUBLIC read', () => {
  assert(fs.existsSync(HANDLER_JS), 'src/api/concept/sharingState.js is missing');
  const idx = safeRead(API_INDEX_JS);
  assert(idx, 'src/api/index.js unreadable');
  const line = (idx.split('\n').find((l) => l.includes('sharing-state')) || '');
  assert(line, "src/api/index.js must register '/api/concept/:handle/sharing-state'");
  assert(/app\.get\(/.test(line), 'the sharing-state route must be a GET');
  assert(!/requireOwner/.test(line),
    'the read is public (ADR Decision) — it reveals nothing an observer could not read off the relay. Only the WRITE path (self-declare) is owner-gated');
});

test('S2: the handler composes at the seam — classification from bValueForms, tri-state from the pure lib', () => {
  const src = safeRead(HANDLER_JS);
  assert(src, 'src/api/concept/sharingState.js unreadable');
  assert(/bValueForms/.test(src) && /dispositionOf/.test(src),
    'local classification must reuse dispositionOf from src/lib/bValueForms.js — never reimplemented');
  assert(/sharingState/.test(src.replace(/^.*sharingState\.js.*$/m, '')) || /resolveSharingState/.test(src),
    'the handler must call resolveSharingState from the pure lib');
  assert(/dcosl\.brainstorm\.world/.test(src),
    'the published check targets the community relay wss://dcosl.brainstorm.world (hardwired for now — story Out of scope)');
  assert(/relayOk|relayError/.test(src),
    'the handler must carry the relay failure/emptiness distinction through to the resolver — this is what /api/relay/external preserves and fetchFromRelays throws away');
});

test('S3 (AC-5): the page consumes the endpoint through a hook and renders followable wired targets', () => {
  const hook = safeRead(HOOK_JS);
  assert(hook, 'ui/src/hooks/useSharingState.js is missing');
  assert(/sharing-state/.test(hook), 'the hook must fetch /api/concept/:handle/sharing-state');
  assert(/refresh/.test(hook), 'the hook must expose a refresh so the page can re-resolve after a submit (AC-10)');
  const page = safeRead(DETAIL_JSX);
  assert(page, 'ConceptDetail.jsx unreadable');
  assert(/useSharingState/.test(page), 'ConceptDetail must consume the sharing-state hook');
  assert(/shared-concepts\/header\//.test(page),
    'each wired target must link to the header-event route so it is followable (AC-5)');
});

test('S4 (AC-8): the submit button label is derived from the resolved state', () => {
  const page = safeRead(DETAIL_JSX);
  assert(page, 'ConceptDetail.jsx unreadable');
  assert(/[Rr]e-?submit/.test(page),
    'an already-shared concept\'s button must say it re-submits rather than submits for the first time');
  assert(/published/.test(page),
    'the label must switch on the resolved published state, not on a local flag');
});

test('S5 (AC-9): a confirmation stands between the click and a re-submit, and says why', () => {
  assert(fs.existsSync(CONFIRM_JSX), 'ui/src/components/ConfirmDialog.jsx is missing (the reusable dialog the ADR reuses)');
  const page = safeRead(DETAIL_JSX);
  assert(page, 'ConceptDetail.jsx unreadable');
  assert(/ConfirmDialog/.test(page), 'ConceptDetail must reuse ConfirmDialog rather than publishing straight from the click');
  assert(/already been submitted|already submitted/i.test(page),
    'the confirmation must state that the concept has already been submitted');
  assert(/typically (is )?not necessary|not (usually|typically) necessary|typically unnecessary/i.test(page),
    'the confirmation must add that re-submitting is typically unnecessary (owner ruling)');
});

test('S6 (AC-10): a successful submit re-resolves the state without a page reload', () => {
  const page = safeRead(DETAIL_JSX);
  assert(page, 'ConceptDetail.jsx unreadable');
  assert(/refresh\s*\(\)/.test(page), 'the submit handler must call the hook\'s refresh() on success');
  assert(!/location\.reload/.test(page), 'the page must not reload to pick up the new state');
});

test('S7 (regression, passes pre AND post): self-declare keeps its owner gate and own-header restriction', () => {
  const src = safeRead(SELF_DECLARE_JS);
  assert(src, 'selfDeclare.js unreadable');
  assert(/isOwner\(req\)\s*&&\s*!req\.localTrusted|!isOwner\(req\)\s*&&\s*!req\.localTrusted/.test(src),
    'the write path must remain owner-gated (isOwner || localTrusted) — this story adds a public READ, it must not loosen the write');
  assert(/Only this instance's own concept headers can be self-declared/.test(src),
    'the own-header provenance restriction must remain');
});

// ═══ H — live endpoint (SKIP when the stack is down) ═══════════════════

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
async function hostGetJson(pathname) {
  const r = await fetch(`${HOST_BASE}${pathname}`, { signal: AbortSignal.timeout(30000) });
  let j = null; try { j = await r.json(); } catch { }
  return { status: r.status, json: j };
}
/** Own-TA kind-39998 headers from local strfry, split by whether they self-declare. */
async function ownHeaders(ta) {
  const filter = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [ta] }));
  const { json } = await hostGetJson(`/api/strfry/scan?filter=${filter}`);
  const out = { declared: [], bare: [] };
  for (const ev of (json && json.events) || []) {
    const d = (ev.tags.find((t) => t[0] === 'd') || [])[1];
    if (d == null) continue;
    const coord = `39998:${ev.pubkey}:${d}`;
    const bs = ev.tags.filter((t) => t[0] === 'b').map((t) => String(t[1]).trim());
    if (bs.includes(coord)) out.declared.push(coord);
    else if (bs.length === 0) out.bare.push(coord);
  }
  return out;
}

test('H1: the endpoint answers with the documented shape for an own header', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const { bare, declared } = await ownHeaders(s.ta);
  const coord = bare[0] || declared[0];
  if (!coord) return 'SKIP'; // no own headers on this instance to ask about
  const { status, json } = await hostGetJson(`/api/concept/${encodeURIComponent(coord)}/sharing-state`);
  assert(status === 200, `expected 200 from the sharing-state read, got ${status}`);
  assert(json && json.success === true, `expected success:true, got ${JSON.stringify(json)}`);
  assert(json.local && typeof json.local.selfDeclared === 'boolean' && typeof json.local.wired === 'boolean'
    && typeof json.local.deferred === 'boolean' && Array.isArray(json.local.wiredTo),
    `local must carry the three booleans plus a wiredTo array, got ${JSON.stringify(json.local)}`);
  assert(json.published === true || json.published === false || json.published === null,
    `published must be the tri-state true|false|null, got ${JSON.stringify(json.published)}`);
  assert(json.published !== undefined, 'published must never be undefined — the UI branches on null');
});

test('H2 (AC-2/AC-3): a locally self-declared header reports selfDeclared, with published resolved independently', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const { declared } = await ownHeaders(s.ta);
  if (!declared.length) return 'SKIP'; // nothing self-declared on this instance
  const { json } = await hostGetJson(`/api/concept/${encodeURIComponent(declared[0])}/sharing-state`);
  assert(json && json.local && json.local.selfDeclared === true,
    `${declared[0]} carries a self-pointing b in local strfry, so local.selfDeclared must be true — got ${JSON.stringify(json && json.local)}`);
  assert(json.published === true || json.published === false || json.published === null,
    'published is resolved from the relay, independently of the local declaration');
});

test('H3 (AC-1): a header with no b-tags reports nothing declared, wired or deferred', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const { bare } = await ownHeaders(s.ta);
  if (!bare.length) return 'SKIP';
  const { json } = await hostGetJson(`/api/concept/${encodeURIComponent(bare[0])}/sharing-state`);
  assert(json && json.local, `expected a local block, got ${JSON.stringify(json)}`);
  assert(json.local.selfDeclared === false && json.local.wired === false && json.local.deferred === false,
    `${bare[0]} carries no b-tags, so all three states must be false — got ${JSON.stringify(json.local)}`);
  assert(json.local.wiredTo.length === 0, 'a header with no b-tags wires to nothing');
});

test('H4: handle validation — malformed rejects with 400; a well-formed unknown handle does not 500', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const bad = await hostGetJson('/api/concept/not-a-handle/sharing-state');
  assert(bad.status === 400, `a malformed handle must be a 400, got ${bad.status}`);
  const unknown = `39998:${'c'.repeat(64)}:no-such-concept-here`;
  const miss = await hostGetJson(`/api/concept/${encodeURIComponent(unknown)}/sharing-state`);
  assert(miss.status !== 500, `an unknown but well-formed handle must not 500, got ${miss.status}`);
});

test('H5 (regression, passes pre AND post): the neighbouring adoption-queue read still answers', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const { status, json } = await hostGetJson('/api/adoption-queue');
  assert(status === 200 && json && json.success === true,
    `adding the sharing-state route must not disturb /api/adoption-queue — got ${status}`);
});

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
  console.log(`\nstate-on-concept-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
