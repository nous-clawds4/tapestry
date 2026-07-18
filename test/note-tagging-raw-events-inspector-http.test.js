/**
 * Live HTTP-contract tests for Story 3 (epic: tag-event-inspector) — the
 * `rawEvents` byte channel on GET /api/event-tags/for-event.
 *
 * Story: engineering-team/stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md
 * ADR:   engineering-team/decisions/tag-event-inspector/0003-note-tagging-raw-events-inspector.md
 *
 * SUITE SPLIT (ADR 0003 Consequences #4, carried forward from Story 2): this is
 * the live half. It runs against a REAL stack (control panel + strfry + the
 * publish path) and proves the byte contract source assertions cannot: exact
 * key-set semantics, the 7-field projection, byte-faithfulness. It does NOT
 * gate CI — it SKIPS WHOLESALE ({pass:0, fail:0, skipped}) when `nak` or the
 * control panel is missing, which is exactly CI's stack-free job. The only
 * automatic gate is test/note-tagging-raw-events-inspector-ui.test.js.
 *
 * FIXTURES — self-seeded, zero literals. The local relay holds ZERO
 * event-tagging events (measured in ADR 0003; the federation's only two live
 * on tags.brainstorm.world), so this suite publishes its own graph with
 * disposable nak keys, sibling-precedent style (tag-detail-publish). It leans
 * on the read API's OWN sovereignty parameter — `?authorities=<disposable
 * authority>` — so the fixture is hermetic: no runtime-TA lookup, no shared
 * namespace touched, no TA-pubkey literal anywhere (AC-6). Fixture events are
 * left on the local relay (the precedent's accepted cost; unique disposable
 * keys + slugs make them inert).
 *
 * POV honesty: `mine` is trust-unfiltered (ADR event-tagging/0007), so the
 * viewer-referenced assertions are deterministic on ANY deployment. Whether
 * the OTHER asserter lands in the counted channels depends on the active POV —
 * on the local dev box the house POV resolves `unfiltered` (minRank null ⇒
 * everyone counts; verified live 2026-07-17), so L5/L6 run; on a WoT-filtering
 * deployment they SKIP with a reason instead of lying. L2's set-equality is
 * POV-robust by construction: whatever the POV admits, keys(rawEvents) must
 * equal exactly what the response's channels reference.
 *
 * Intentionally failing (L1–L6) until ADR 0003 D1/D2 land in handleForEvent.
 */

const { execSync } = require('child_process');

const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const PROPAGATION_MS = 600;
// The 7 canonical NIP-01 fields, in canonical order — the toRawEvent contract
// (tag-event-inspector ADR 0001 D1, re-exported by ADR 0003 D2).
const RAW_EVENT_KEYS = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function nakAvailable() {
  try { execSync('command -v nak', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

function nakKeyGen() { return execSync('nak key generate').toString().trim(); }
function nakDerivePubkey(privkey) { return execSync(`nak key public ${privkey}`).toString().trim(); }
function nakSignEvent({ kind, tags = [], content = '', privkey }) {
  const tagArgs = tags.map((t) => `--tag ${t[0]}=${t.slice(1).join('=')}`).join(' ');
  const cmd = `nak event -k ${kind} ${tagArgs} --sec ${privkey} -c ${JSON.stringify(content)}`;
  return JSON.parse(execSync(cmd).toString().trim());
}

async function publish(signedEvent) {
  const r = await fetch(`${BASE}/api/strfry/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: signedEvent, signAs: 'client' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(`publish failed: status=${r.status} body=${JSON.stringify(j)}`);
  return j.event;
}

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Every event id the response's channels reference: tags[].applications ∪ disputes ∪ mine. */
function referencedIds(body) {
  const ids = new Set();
  for (const t of body.tags || []) {
    for (const e of [...(t.applications || []), ...(t.disputes || [])]) ids.add(e.eventId);
  }
  for (const m of body.mine || []) ids.add(m.eventId);
  return ids;
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/**
 * Suite fixture — one disposable authority, one tag+header author, two
 * asserters, one target note id:
 *
 *   authority  → honored via ?authorities= (the sovereignty parameter)
 *   jack       → authors the per-tag tagging header (joins authority's
 *                tagging-with-specific-tag; a-points at 39999:jack:<slug>)
 *   alice      → APPLIES the tag to NOTE (polarity 1) and is the viewer
 *   bob        → DISPUTES the tag on NOTE (polarity −1)
 *   NOTE       → a fresh 64-hex id (nothing else references it)
 *   UNTAGGED   → a fresh 64-hex id with no taggings at all
 */
let ctx = null;

async function setupSuite() {
  const slug = `s3raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const authoritySk = nakKeyGen(); const authorityPk = nakDerivePubkey(authoritySk);
  const jackSk = nakKeyGen(); const jackPk = nakDerivePubkey(jackSk);
  const aliceSk = nakKeyGen(); const alicePk = nakDerivePubkey(aliceSk);
  const bobSk = nakKeyGen(); const bobPk = nakDerivePubkey(bobSk);
  // Fresh 64-hex ids that exist nowhere: derive from throwaway keys.
  const NOTE = nakDerivePubkey(nakKeyGen());
  const UNTAGGED = nakDerivePubkey(nakKeyGen());

  const descriptor = `39999:${jackPk}:tagging:${slug}-tagging`;

  const header = await publish(nakSignEvent({
    kind: 39999,
    tags: [
      ['d', `tagging:${slug}-tagging`],
      ['z', `39998:${authorityPk}:tagging-with-specific-tag`],
      ['a', `39999:${jackPk}:${slug}`],
    ],
    content: '',
    privkey: jackSk,
  }));

  const apply = await publish(nakSignEvent({
    kind: 39999,
    tags: [
      ['d', `event-tag-${slug}-${alicePk.slice(0, 8)}`],
      ['e', NOTE],
      ['z', `39998:${authorityPk}:nostr-event-tag`],
      ['z', descriptor],
      ['polarity', '1'],
    ],
    content: '',
    privkey: aliceSk,
  }));

  const dispute = await publish(nakSignEvent({
    kind: 39999,
    tags: [
      ['d', `event-tag-${slug}-${bobPk.slice(0, 8)}`],
      ['e', NOTE],
      ['z', `39998:${authorityPk}:nostr-event-tag`],
      ['z', descriptor],
      ['polarity', '-1'],
    ],
    content: '',
    privkey: bobSk,
  }));

  // A second target with a dispute ONLY — the story's zero-applications chip
  // shape ("a chip can exist with zero applications (disputes only)").
  const NOTE2 = nakDerivePubkey(nakKeyGen());
  const dispute2 = await publish(nakSignEvent({
    kind: 39999,
    tags: [
      ['d', `event-tag-${slug}-n2-${bobPk.slice(0, 8)}`],
      ['e', NOTE2],
      ['z', `39998:${authorityPk}:nostr-event-tag`],
      ['z', descriptor],
      ['polarity', '-1'],
    ],
    content: '',
    privkey: bobSk,
  }));

  await sleep(PROPAGATION_MS);
  return { slug, authorityPk, jackPk, alicePk, bobPk, NOTE, NOTE2, UNTAGGED, header, apply, dispute, dispute2 };
}

function forEventUrl({ eventId, viewer } = {}) {
  const p = new URLSearchParams({ eventId, authorities: ctx.authorityPk });
  if (viewer) p.set('viewerPubkey', viewer);
  return `${BASE}/api/event-tags/for-event?${p}`;
}

/* ═══════════════════ L (U-class) — must fail now, pass once built ═══════════════════ */

t('L1: rawEvents is on EVERY for-event response — {} for an untagged note (D2 "always assign")', async () => {
  const { status, json } = await fetchJson(forEventUrl({ eventId: ctx.UNTAGGED }));
  assert(status === 200 && json && json.success === true, `for-event must succeed for an untagged id (got ${status})`);
  assert('rawEvents' in json,
    'the response must ALWAYS carry rawEvents, even with no taggings (ADR 0003 D2: the ' +
    '"always assign" convention — absence and emptiness must be distinguishable to callers).');
  assert(json.rawEvents && typeof json.rawEvents === 'object' && !Array.isArray(json.rawEvents),
    'rawEvents must be an id-keyed object (a side-table), not an array.');
  assert(Object.keys(json.rawEvents).length === 0,
    'an untagged note references no events, so rawEvents must be {} — the eager increment is ' +
    '0 B exactly where the story feared the feed multiplier (ADR 0003 D1 measurements).');
});

t('L2: rawEvents holds EXACTLY the ids the channels reference — applications ∪ disputes ∪ mine (AC-3, D2)', async () => {
  const { status, json } = await fetchJson(forEventUrl({ eventId: ctx.NOTE, viewer: ctx.alicePk }));
  assert(status === 200 && json && json.success === true, `for-event must succeed (got ${status})`);
  // Non-vacuous anchor: `mine` is trust-unfiltered (ADR 0007), so the viewer's own
  // apply is deterministic on ANY deployment — the equality below can never pass
  // against an empty response.
  assert((json.mine || []).length >= 1,
    'the viewer\'s own apply must surface in `mine` (trust-unfiltered) — if this fails, the ' +
    'FIXTURE did not classify: check the header/descriptor z-tags before reading further.');
  assert('rawEvents' in json, 'the response must carry rawEvents (ADR 0003 D1/D2 — not built yet?).');
  const referenced = referencedIds(json);
  const keys = new Set(Object.keys(json.rawEvents || {}));
  for (const id of referenced) {
    assert(keys.has(id),
      `referenced id ${id.slice(0, 12)}… is missing from rawEvents — every event behind the ` +
      'counts must ship (AC-3: a reader counts the blocks and gets the numbers back; a missing ' +
      'id triggers the client\'s all-or-nothing withhold, D6).');
  }
  for (const id of keys) {
    assert(referenced.has(id),
      `rawEvents carries ${id.slice(0, 12)}… which NO channel references — the side-table must ` +
      'not ship unreferenced bytes (D2: keyed to exactly the referenced set; anything more is ' +
      'payload the counts cannot explain).');
  }
});

t('L3: each rawEvents value is the as-signed 7-field projection — exact keys, canonical order (AC-3)', async () => {
  const { json } = await fetchJson(forEventUrl({ eventId: ctx.NOTE, viewer: ctx.alicePk }));
  assert(json && 'rawEvents' in json, 'the response must carry rawEvents (not built yet?).');
  const val = (json.rawEvents || {})[ctx.apply.id];
  assert(val, 'the viewer\'s apply must have an entry in rawEvents (it is referenced by `mine` at minimum).');
  const keys = Object.keys(val);
  assert(keys.length === RAW_EVENT_KEYS.length && RAW_EVENT_KEYS.every((k, i) => keys[i] === k),
    `a rawEvents value must carry EXACTLY [${RAW_EVENT_KEYS.join(', ')}] in that order ` +
    `(got [${keys.join(', ')}]). This is the set-equality check ADR 0003's Consequences names ` +
    'as the guard: the exported toRawEvent whitelist is the one definition of "as signed" — ' +
    'a spread would leak scan-leg fields; a missing field breaks byte-faithfulness.');
});

t('L4: the bytes are byte-faithful to the event as published (AC-3)', async () => {
  const { json } = await fetchJson(forEventUrl({ eventId: ctx.NOTE, viewer: ctx.alicePk }));
  assert(json && 'rawEvents' in json, 'the response must carry rawEvents (not built yet?).');
  const got = (json.rawEvents || {})[ctx.apply.id];
  assert(got, 'the viewer\'s apply must have an entry in rawEvents.');
  const want = ctx.apply;
  assert(got.id === want.id && got.pubkey === want.pubkey && got.sig === want.sig,
    'id/pubkey/sig must round-trip untouched — the sig only verifies over the exact bytes.');
  assert(got.created_at === want.created_at && got.kind === want.kind && got.content === want.content,
    'created_at/kind/content must round-trip untouched.');
  assert(JSON.stringify(got.tags) === JSON.stringify(want.tags),
    'the tags array must round-trip untouched — no tag dropped, reordered, truncated, or ' +
    'annotated (AC-6 POV invariant: bytes are POV-invariant; the per-POV verdict rides ' +
    'BESIDE them as channel membership, never inside them).');
});

t('L5: the viewer\'s counted assertion ships ONCE — referenced by both applications and mine, one key (AC-3, D2)', async () => {
  const { json } = await fetchJson(forEventUrl({ eventId: ctx.NOTE, viewer: ctx.alicePk }));
  assert(json && json.success === true, 'for-event must succeed.');
  const tag = (json.tags || []).find((x) => x.tag && x.tag.slug === ctx.slug);
  if (!tag || !(tag.applications || []).some((e) => e.eventId === ctx.apply.id)) {
    // This POV is WoT-filtering and the disposable asserter is outside it — the
    // dedupe case needs a counted+mine overlap, which this environment cannot
    // produce. Honest SKIP; on the unfiltered local box this test runs.
    return 'SKIP';
  }
  assert((json.mine || []).some((m) => m.eventId === ctx.apply.id),
    'the viewer\'s apply must ALSO be referenced via mine — the union rule the chips use.');
  assert('rawEvents' in json, 'the response must carry rawEvents (not built yet?).');
  const occurrences = Object.keys(json.rawEvents || {}).filter((k) => k === ctx.apply.id).length;
  assert(occurrences === 1,
    'an event referenced by BOTH a counted channel and mine must ship exactly once (ADR 0003 ' +
    'D2: the id-keyed map is the dedupe) — double-shipping was Option B\'s defect.');
});

t('L6: a DISPUTING asserter\'s event rides the side-table too — polarity is no gate (AC-3)', async () => {
  const { json } = await fetchJson(forEventUrl({ eventId: ctx.NOTE, viewer: ctx.alicePk }));
  assert(json && json.success === true, 'for-event must succeed.');
  const tag = (json.tags || []).find((x) => x.tag && x.tag.slug === ctx.slug);
  if (!tag || !(tag.disputes || []).some((e) => e.eventId === ctx.dispute.id)) {
    return 'SKIP'; // WoT-filtering POV excludes the disposable disputer — see L5's note.
  }
  assert('rawEvents' in json && (json.rawEvents || {})[ctx.dispute.id],
    'the dispute\'s bytes must ship when the disputes channel references it (AC-3: the panel ' +
    'is "every event behind the numbers" — a dispute-only chip yields its blocks the same way).');
  assert((json.rawEvents || {})[ctx.dispute.id].pubkey === ctx.bobPk,
    'the dispute\'s author must be bob — the block\'s caption pubkey comes from these bytes.');
});

t('L7: a DISPUTE-ONLY chip (zero applications) yields exactly its dispute\'s bytes (AC-3 edge)', async () => {
  const { json } = await fetchJson(forEventUrl({ eventId: ctx.NOTE2, viewer: ctx.alicePk }));
  assert(json && json.success === true, 'for-event must succeed for the dispute-only target.');
  const tag = (json.tags || []).find((x) => x.tag && x.tag.slug === ctx.slug);
  if (!tag) return 'SKIP'; // WoT-filtering POV excludes the disposable disputer — see L5's note.
  assert((tag.applications || []).length === 0 && (tag.disputes || []).length === 1,
    'the fixture must classify as 0 applications / 1 dispute — the story\'s "chip that exists ' +
    'with zero applications" shape.');
  assert((json.mine || []).length === 0,
    'the viewer (alice) has no stance on this target — mine must be empty here.');
  assert('rawEvents' in json, 'the response must carry rawEvents (not built yet?).');
  const keys = Object.keys(json.rawEvents || {});
  assert(keys.length === 1 && keys[0] === ctx.dispute2.id,
    `a dispute-only chip references exactly one event, so rawEvents must be exactly ` +
    `{ ${ctx.dispute2.id.slice(0, 12)}… } (got ${keys.length} keys) — count the blocks, get ` +
    'the popover\'s "Disputed by 1" back (AC-3).');
});

/* ═════════════ R-class sentinels (pass before AND after) ═════════════ */

t('R-http-1: SENTINEL — for-tag does NOT grow rawEvents (D2: sibling handlers untouched)', async () => {
  // Deliberately a headerless slug: the fixture tag's for-tag read would fetch its
  // (fabricated, nowhere-published) target note from EXTERNAL relays and stall on
  // the round-trip — an environmental hang, not a finding. A no-header tag skips
  // the relay leg and returns the same envelope instantly; the with-data guarantee
  // is held by the ui-suite's R3, which region-pins handleForTag/aggregateNotesTagged
  // to never mention rawEvents/toRawEvent at all.
  const p = new URLSearchParams({ tagAuthor: ctx.jackPk, slug: `${ctx.slug}-none`, authorities: ctx.authorityPk, nocache: '1' });
  const { status, json } = await fetchJson(`${BASE}/api/event-tags/for-tag?${p}`);
  assert(status === 200 && json && json.success === true, `for-tag must succeed (got ${status})`);
  assert(!('rawEvents' in json),
    'for-tag must NOT carry rawEvents (ADR 0003 D2 "Do not touch"): the byte channel is ' +
    'handleForEvent\'s alone. for-tag serves up to 50 notes per response — an eager byte ' +
    'increment THERE is the multiplication the story feared, and it was never decided.');
});

t('R-http-2: SENTINEL — the pre-existing for-event envelope survives the additive change', async () => {
  const { status, json } = await fetchJson(forEventUrl({ eventId: ctx.NOTE, viewer: ctx.alicePk }));
  assert(status === 200 && json && json.success === true, `for-event must succeed (got ${status})`);
  assert(json.target && json.target.id === ctx.NOTE, 'target must survive.');
  assert(Array.isArray(json.tags) && Array.isArray(json.unverifiable) && Array.isArray(json.mine),
    'the tags/unverifiable/mine channels must survive as arrays — rawEvents is ADDITIVE ' +
    '(existing consumers, incl. TagANoteModal, read these untouched).');
  assert(Array.isArray(json.authorities) && json.authorities.includes(ctx.authorityPk),
    'the ?authorities= sovereignty parameter must keep being honored and echoed.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- note-tagging raw-events inspector HTTP tests (epic tag-event-inspector, Story 3) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  all: `nak` is not on PATH — cannot seed fixture events.');
    return { pass: 0, fail: 0, failures: [], skipped: tests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  all: control panel not reachable at ${BASE}.`);
    return { pass: 0, fail: 0, failures: [], skipped: tests.length };
  }
  // Route probe: if for-event itself is not wired, nothing below can run.
  try {
    const probe = await fetch(`${BASE}/api/event-tags/for-event`, { signal: AbortSignal.timeout(4000) });
    if (probe.status === 404) {
      console.log('  SKIP  all: /api/event-tags/for-event route not wired on this deployment.');
      return { pass: 0, fail: 0, failures: [], skipped: tests.length };
    }
  } catch {
    console.log('  SKIP  all: for-event probe failed — stack not usable.');
    return { pass: 0, fail: 0, failures: [], skipped: tests.length };
  }

  try {
    ctx = await setupSuite();
  } catch (e) {
    // Seeding is a PRECONDITION (publish path + relay), not the feature under
    // test — an environment that cannot seed skips honestly instead of joining
    // the environmental-failure noise (OPEN.md #27).
    console.log(`  SKIP  all: fixture seeding failed — ${e.message}`);
    return { pass: 0, fail: 0, failures: [], skipped: tests.length };
  }

  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++;
    }
  }
  console.log(`\nnote-tagging-raw-events-inspector-http: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
