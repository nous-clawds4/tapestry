/**
 * Tests for Story 2: Tag-detail page (read).
 * ADR: engineering-team/decisions/0002-tag-detail-page-read.md
 *
 * These tests are intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layer: server API contracts (HTTP against control panel — default :7778).
 * Live publish-flow assertions live in test/tag-detail-publish.test.js.
 *
 * Endpoints under test (introduced by ADR-0002):
 *   GET /api/profile-tags/by-id?tagEventId=<id>
 *   GET /api/profile-tags/profiles-tagged?tagEventId=<id>&wotPov=<>&userPubkey=<>&sort=<>
 */

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

// Set-equality with a diagnostic that names BOTH failure directions separately:
// `missing` = the projection dropped a canonical field; `unexpected` = something
// leaked in (the signature of a spread rather than a whitelist).
function assertSetEqual(actualKeys, expectedKeys, msg) {
  const a = [...actualKeys].sort();
  const e = [...expectedKeys].sort();
  const missing = e.filter((k) => !a.includes(k));
  const unexpected = a.filter((k) => !e.includes(k));
  if (missing.length || unexpected.length) {
    throw new Error(
      `${msg} — missing: [${missing.join(', ')}], unexpected: [${unexpected.join(', ')}]; ` +
      `got [${a.join(', ')}], expected exactly [${e.join(', ')}]`
    );
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── /api/profile-tags/by-id ─── */

t('GET /api/profile-tags/by-id rejects missing tagEventId with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/by-id`);
  assertEqual(status, 400, 'by-id (no tagEventId) status');
});

t('GET /api/profile-tags/by-id rejects malformed tagEventId with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=not-hex`);
  assertEqual(status, 400, 'by-id (bad tagEventId) status');
});

t('GET /api/profile-tags/by-id returns 404 for a well-formed but unknown tagEventId', async () => {
  // Random valid-shape 64-char hex that almost certainly does not exist.
  const unknownId = 'b'.repeat(64);
  const { status, json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${unknownId}`);
  assertEqual(status, 404, 'by-id (unknown) status');
  assert(json && json.success === false, 'by-id (unknown) response.success must be false');
});

/* ─── by-id: the raw tag-definition event (epic tag-event-inspector, Story 1) ─── *
 * Story: engineering-team/stories/tag-event-inspector/1-tag-actions-menu-and-raw-event.md (AC-6)
 * ADR:   engineering-team/decisions/tag-event-inspector/0001-… D1
 *
 * Additive field: `by-id` already holds the scanned event (index.js:770) and
 * projects it away. D1 hangs it on `tag.rawEvent` as a SEVEN-FIELD WHITELIST
 * (`toRawEvent(ev)`), never a `{...ev}` spread.
 */

// Local fixture — a kind-39999 tag element in the local strfry corpus, authored
// by a NON-TA pubkey (58352e0a…) deliberately: a TA-hardcode regression would
// pass silently against a TA-authored tag. Prerequisite: the local stack's
// kind-39999 corpus. Against a BRAINSTORM_BASE_URL lacking this event these
// tests fail loudly (named below) rather than pass vacuously.
// Reseeded 2026-07-18: the original fixture (5633f149…, slug cpc-tag-s12b-…)
// vanished from the local corpus (see OPEN.md — local strfry corpus drift).
const RAW_FIXTURE = {
  eventId: '9ec193a73163b1220236a0106346e059bd4d0d07c27586fab27d553ae2d25a14',
  slug: 'cpc-tag-fixture-1784351872-7e0ce5',
  authorPubkey: 'b78e712c3c6ff6907921839ec348aae86ff210d91bf14a78d3ac1fe7ae88ca10',
};

// The seven canonical NIP-01 event fields, in canonical order. Authority: the
// concept graph's own `39998:<TA>:nostr-event` definition (ADR 0001 §Context),
// not the Tester's judgement.
const CANONICAL_EVENT_KEYS = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];

async function fetchFixtureTag() {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${RAW_FIXTURE.eventId}`
  );
  assertEqual(status, 200,
    `by-id (fixture ${RAW_FIXTURE.slug}) status — PRECONDITION: this suite needs the local ` +
    `kind-39999 corpus carrying event ${RAW_FIXTURE.eventId}`);
  assert(json && json.tag, 'by-id (fixture) must return a tag object');
  return json.tag;
}

t('GET /api/profile-tags/by-id returns the tag definition event on tag.rawEvent', async () => {
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present — the signed event the raw panel renders (ADR 0001 D1)');
  assert(typeof tag.rawEvent === 'object' && !Array.isArray(tag.rawEvent),
    'tag.rawEvent must be a plain object (the event as signed)');
});

t('by-id tag.rawEvent carries EXACTLY the seven canonical NIP-01 keys — no more, no less', async () => {
  // THE whitelist test, and the reason D1 chose a projection over a spread.
  // A `{...ev}` spread passes a presence check but fails this one the moment a
  // scan leg attaches anything extra — e.g. a nostr-tools upgrade that turns
  // `verifiedSymbol` (today a Symbol, silently dropped by JSON.stringify) into a
  // string key, which would start leaking a non-canonical field into a panel
  // captioned "the raw signed event". Set-equality is what makes the whitelist
  // mechanically enforced rather than merely documented.
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present');
  assertSetEqual(Object.keys(tag.rawEvent), CANONICAL_EVENT_KEYS, 'tag.rawEvent key set');
});

t('by-id tag.rawEvent emits the canonical fields in canonical order (AC-6: no field reordered)', async () => {
  // D1's third rationale: a declared key order gives the panel a stable rendering
  // rather than inheriting the relay's incidental order, and makes the local
  // (strfry) and remote (nostr-tools) legs diffable.
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present');
  const actual = Object.keys(tag.rawEvent).join(',');
  assertEqual(actual, CANONICAL_EVENT_KEYS.join(','), 'tag.rawEvent key ORDER');
});

t('by-id tag.rawEvent.id is the requested event id and agrees with tag.eventId', async () => {
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present');
  assertEqual(tag.rawEvent.id, RAW_FIXTURE.eventId, 'rawEvent.id must be the requested tagEventId');
  assertEqual(tag.rawEvent.id, tag.eventId, 'rawEvent.id must agree with tag.eventId (same event, one truth)');
});

t('by-id tag.rawEvent.kind is 39999 — the addressable kind AC-4 encodes into the naddr', async () => {
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present');
  assertEqual(tag.rawEvent.kind, 39999, 'rawEvent.kind');
});

t('by-id tag.rawEvent.pubkey is the tag element\'s own author, agreeing with tag.authorPubkey', async () => {
  // AC-4's naddr is built from tag.authorPubkey; this pins that field to the
  // event's real author. The fixture's author is NOT the TA — so a TA-hardcode
  // anywhere in this path fails here rather than passing by coincidence.
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present');
  assertEqual(tag.rawEvent.pubkey, tag.authorPubkey, 'rawEvent.pubkey must agree with tag.authorPubkey');
  assertEqual(tag.rawEvent.pubkey, RAW_FIXTURE.authorPubkey, 'rawEvent.pubkey must be the fixture tag\'s real author');
});

t('by-id tag.rawEvent.tags contains the d tag, and it equals tag.slug (the naddr identifier)', async () => {
  // The slug/d-tag identity AC-4's naddr depends on: naddrEncode's `identifier`
  // is tag.slug, which is only correct because the d tag IS the slug.
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present');
  assert(Array.isArray(tag.rawEvent.tags), 'rawEvent.tags must be an array (every entry, as signed)');
  const dTags = tag.rawEvent.tags.filter((x) => Array.isArray(x) && x[0] === 'd').map((x) => x[1]);
  assertEqual(dTags.length, 1, 'rawEvent.tags must carry exactly one d tag');
  assertEqual(dTags[0], tag.slug, 'the d tag must equal tag.slug');
  assertEqual(dTags[0], RAW_FIXTURE.slug, 'the d tag must be the fixture slug');
});

t('by-id tag.rawEvent preserves the z tags as signed (read and displayed, never recomposed)', async () => {
  // ADR 0015's LEGACY_Z_TAG composition is DATA here. AC-6 says every tags entry
  // renders, including both z tags; this story must not rewrite them.
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present');
  const zTags = tag.rawEvent.tags.filter((x) => Array.isArray(x) && x[0] === 'z');
  assert(zTags.length >= 1, 'rawEvent.tags must carry the tag element\'s z tag(s) verbatim, as signed');
  assert(zTags.every((x) => /^39998:[0-9a-f]{64}:/.test(x[1])),
    'each z tag must be the concept handle exactly as published (39998:<pubkey>:<slug>)');
});

t('by-id tag.rawEvent.sig and .content are present, unmodified and untruncated (AC-6)', async () => {
  const tag = await fetchFixtureTag();
  assert(tag.rawEvent, 'tag.rawEvent must be present');
  assert(/^[0-9a-f]{128}$/.test(tag.rawEvent.sig || ''),
    'rawEvent.sig must be the full 128-char Schnorr signature (displayed, not verified)');
  assertEqual(typeof tag.rawEvent.content, 'string', 'rawEvent.content must be the raw string payload');
  assertEqual(typeof tag.rawEvent.created_at, 'number', 'rawEvent.created_at must be the Unix timestamp');
});

t('by-id keeps its existing contract alongside rawEvent (additive change, AC-7)', async () => {
  // ADR 0009 set the additive-field precedent on this same endpoint with
  // viewerPin. rawEvent must not disturb any field the page already reads.
  const tag = await fetchFixtureTag();
  assertEqual(tag.eventId, RAW_FIXTURE.eventId, 'tag.eventId unchanged');
  assertEqual(tag.slug, RAW_FIXTURE.slug, 'tag.slug unchanged');
  assertEqual(tag.authorPubkey, RAW_FIXTURE.authorPubkey, 'tag.authorPubkey unchanged');
  assert(typeof tag.name === 'string' && tag.name.length > 0, 'tag.name unchanged');
  assertEqual(typeof tag.createdAt, 'number', 'tag.createdAt unchanged');
});

/* ─── /api/profile-tags/profiles-tagged ─── */

t('GET /api/profile-tags/profiles-tagged rejects missing tagEventId with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`);
  assertEqual(status, 400, 'profiles-tagged (no tagEventId) status');
});

t('GET /api/profile-tags/profiles-tagged rejects malformed tagEventId with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=not-hex`);
  assertEqual(status, 400, 'profiles-tagged (bad tagEventId) status');
});

t('GET /api/profile-tags/profiles-tagged rejects an invalid sort param with 400', async () => {
  const validShapeId = 'c'.repeat(64);
  const { status } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${validShapeId}&sort=bogus`
  );
  assertEqual(status, 400, 'profiles-tagged (bad sort) status');
});

t('GET /api/profile-tags/profiles-tagged returns the documented response shape for a known-empty tag', async () => {
  // Valid-shape but unknown tagEventId → no assertions → empty rows. The
  // endpoint must still return the documented envelope (success/povSuffix/
  // minRank/sort/rows). This guards against the implementer regressing the
  // shape contract — the UI's hook depends on every field being present.
  const validShapeId = 'd'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${validShapeId}`
  );
  assertEqual(status, 200, 'profiles-tagged status');
  assert(json && json.success === true, 'response.success must be true');
  assert(Array.isArray(json.rows), 'response.rows must be an array');
  assertEqual(json.rows.length, 0, 'rows must be empty for a tag nobody asserted');
  assert('povSuffix' in json, 'response must include povSuffix (may be null)');
  assert('minRank' in json, 'response must include minRank (may be null)');
  assert('sort' in json, 'response must include the resolved sort');
  assertEqual(json.sort, 'applied', 'omitted sort must default to "applied"');
});

t('GET /api/profile-tags/profiles-tagged accepts each documented sort value', async () => {
  const validShapeId = 'e'.repeat(64);
  for (const sort of ['applied', 'disputed', 'divisive']) {
    const { status, json } = await fetchJson(
      `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${validShapeId}&sort=${sort}`
    );
    assertEqual(status, 200, `profiles-tagged (sort=${sort}) status`);
    assertEqual(json?.sort, sort, `response.sort must echo "${sort}"`);
  }
});

/* ─── profiles-tagged: row.assertions (epic tag-event-inspector, Story 2) ─── */

/**
 * ADR 0002 D1 — each row carries the evidence behind its own +N/-M:
 *   assertions: [{ polarity: 'apply'|'dispute', counted: boolean, event: <7 fields> }]
 *
 * FIXTURE STRATEGY — discovery, not a hardcoded id. Story 1's RAW_FIXTURE could pin one
 * event because a tag has exactly one definition event. A tagging row's evidence depends
 * on whichever corpus this base URL happens to hold, so these probe for the first tag
 * that HAS rows and skip loudly when none exists (a bare local stack). Measured on this
 * machine 2026-07-16: the local corpus tops out at ONE assertion per row, so the
 * multi-block and `counted` semantics are NOT provable here — those live in
 * tag-detail-publish.test.js, which seeds its own multi-author assertion graph.
 *
 * NB these are live-HTTP and therefore SKIP WHOLESALE in CI (:268-271). They are for
 * local + staging verification. The CI gate for this story is the stack-free source
 * suite, test/tagging-raw-event-inspector-ui.test.js — see its header.
 */
async function fetchFirstTaggedRow() {
  const { status, json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/available-tags`);
  assertEqual(status, 200, 'available-tags status — PRECONDITION for the row.assertions tests');
  const tags = (json?.tags || []).slice(0, 60);
  for (const tag of tags) {
    const r = await fetchJson(
      `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${tag.eventId}&sort=applied`
    );
    const rows = r.json?.rows || [];
    if (rows.length > 0) return { tag, rows };
  }
  throw new Error(
    'PRECONDITION UNMET: no tag in the first 60 of available-tags has any tagged profile at ' +
    `${CONTROL_PANEL_BASE}. These tests need a corpus with at least one tagging. Failing loudly ` +
    'rather than passing vacuously against an empty graph.'
  );
}

/**
 * Guard against the VACUOUS PASS, which bit this suite three times while it was being
 * written. Every test below loops `row.assertions || []`; with the feature unbuilt that
 * is an empty list, the loop body never runs, and the test reports PASS having asserted
 * nothing. A U test that passes before implementation is worse than no test — it is a
 * false green. Call this in any test whose assertions live inside a loop.
 */
function assertNonVacuous(rows, what) {
  const total = rows.reduce((n, r) => n + ((r.assertions || []).length), 0);
  assert(total > 0,
    `${what}: the fixture returned ZERO assertions across ${rows.length} row(s), so this test would ` +
    'pass without asserting anything. Rows exist, therefore assertions must too — every row is on the ' +
    'page BECAUSE at least one assertion put it there (ADR 0002 D1).');
  return total;
}

t('profiles-tagged: every row carries an assertions array (always present, like onlyViewerVisible)', async () => {
  const { rows } = await fetchFirstTaggedRow();
  for (const row of rows) {
    assert(Array.isArray(row.assertions),
      `row ${row.pubkey} must carry assertions as an ARRAY (ADR 0002 D1). Always assigned (|| []) so ` +
      'the client can read it unconditionally — the same convention onlyViewerVisible follows.');
  }
});

t('profiles-tagged: each assertion entry is EXACTLY {polarity, counted, event}', async () => {
  const { rows } = await fetchFirstTaggedRow();
  const entry = rows.flatMap((r) => r.assertions || [])[0];
  assert(entry, 'expected at least one assertion across the fixture tag\'s rows');
  assertSetEqual(Object.keys(entry), ['polarity', 'counted', 'event'], 'assertion entry key set');
});

t('profiles-tagged: assertion.event carries EXACTLY the seven canonical NIP-01 keys', async () => {
  // THE whitelist test — the Story-2 twin of the by-id one above, and it matters MORE
  // here: this endpoint serializes N events per row across every row, so a leak is N×
  // wider than Story 1's single event. A `{...ev}` spread passes a presence check and
  // fails this one the moment a scan leg attaches anything extra — e.g. a nostr-tools
  // upgrade turning `verifiedSymbol` (today a Symbol, silently dropped by
  // JSON.stringify) into a string key, which would start leaking a non-canonical field
  // into blocks captioned "the raw signed event".
  const { rows } = await fetchFirstTaggedRow();
  const entry = rows.flatMap((r) => r.assertions || [])[0];
  assert(entry, 'expected at least one assertion across the fixture tag\'s rows');
  assertSetEqual(Object.keys(entry.event), CANONICAL_EVENT_KEYS, 'assertion.event key set');
});

t('profiles-tagged: assertion.event emits the canonical fields in canonical order', async () => {
  const { rows } = await fetchFirstTaggedRow();
  const entry = rows.flatMap((r) => r.assertions || [])[0];
  assert(entry, 'expected at least one assertion across the fixture tag\'s rows');
  assertEqual(Object.keys(entry.event).join(','), CANONICAL_EVENT_KEYS.join(','),
    'assertion.event key ORDER — a declared order gives the panel a stable rendering rather than ' +
    'inheriting the relay\'s incidental key order, and makes the local (strfry) and remote ' +
    '(nostr-tools) legs diffable');
});

t('profiles-tagged: each assertion is a kind-39999 event that names its row as the target', async () => {
  const { rows } = await fetchFirstTaggedRow();
  assertNonVacuous(rows, 'kind/p-tag check');
  for (const row of rows) {
    for (const a of row.assertions || []) {
      assertEqual(a.event.kind, 39999, 'assertion.event.kind');
      const pTag = (a.event.tags || []).find((tg) => tg[0] === 'p');
      assert(pTag && pTag[1] === row.pubkey,
        `assertion on row ${row.pubkey} must carry a ['p', '${row.pubkey}'] tag — that p-tag is what ` +
        'binds the assertion to this target (the concept graph: "each element links a target pubkey ' +
        `to a tag event ID"). Got: ${JSON.stringify(pTag)}`);
    }
  }
});

t('profiles-tagged: polarity is one of apply|dispute — never neutral, never raw', async () => {
  const { rows } = await fetchFirstTaggedRow();
  assertNonVacuous(rows, 'polarity check');
  for (const row of rows) {
    for (const a of row.assertions || []) {
      assert(a.polarity === 'apply' || a.polarity === 'dispute',
        `assertion.polarity must be 'apply' or 'dispute'; got ${JSON.stringify(a.polarity)}. Neutral ` +
        'assertions (polarity strictly between -0.5 and +0.5) are excluded entirely (story Product ' +
        'decision #5) — they count toward neither +N nor -M, so including them would break the ' +
        'block-count/number reconciliation. Server-emitted, not client-derived (ADR 0002 D1).');
    }
  }
});

t('profiles-tagged: THE INVARIANT — counted blocks reconcile to the row\'s +N/-M (AC-4)', async () => {
  // This is the whole story in one assert. AC-4: "a reader must be able to count the
  // blocks and get back exactly the row's numbers." `counted` is what makes it exact —
  // see the multi-author case in tag-detail-publish.test.js for the row where a naive
  // implementation (no flag) would show 3 blocks under a "+2".
  const { rows } = await fetchFirstTaggedRow();
  for (const row of rows) {
    const counted = (row.assertions || []).filter((a) => a.counted);
    const applies = counted.filter((a) => a.polarity === 'apply').length;
    const disputes = counted.filter((a) => a.polarity === 'dispute').length;
    assertEqual(applies, row.applications,
      `row ${row.pubkey}: counted 'apply' blocks must equal row.applications (${row.applications}); ` +
      `got ${applies}. The panel's contract is "the events behind THIS row's numbers".`);
    assertEqual(disputes, row.disputes,
      `row ${row.pubkey}: counted 'dispute' blocks must equal row.disputes (${row.disputes}); got ${disputes}.`);
  }
});

t('profiles-tagged: assertions are ordered applications-before-disputes (AC-4)', async () => {
  const { rows } = await fetchFirstTaggedRow();
  assertNonVacuous(rows, 'ordering check');
  for (const row of rows) {
    const seq = (row.assertions || []).map((a) => a.polarity);
    const firstDispute = seq.indexOf('dispute');
    if (firstDispute === -1) continue;
    assert(!seq.slice(firstDispute).includes('apply'),
      `row ${row.pubkey}: applications must precede disputes (AC-4 — matching the +N/-M reading ` +
      `order). Got: [${seq.join(', ')}]`);
  }
});

t('profiles-tagged: assertion order is stable across identical requests (AC-4)', async () => {
  const { tag, rows } = await fetchFirstTaggedRow();
  assertNonVacuous(rows, 'stable-order check');
  const url = `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${tag.eventId}&sort=applied`;
  const a = await fetchJson(url);
  const b = await fetchJson(url);
  const ids = (j) => (j.json?.rows || []).map((r) => (r.assertions || []).map((x) => x.event.id).join('|')).join('||');
  assertEqual(ids(a), ids(b),
    'two identical requests must return assertions in identical order (AC-4: "a stable, deterministic ' +
    'order"). The sort is a TOTAL order — polarity, then created_at desc, then id — precisely so two ' +
    'events sharing a timestamp cannot swap between requests.');
});

t('profiles-tagged: R — the documented envelope survives the additive change', async () => {
  // Additive-safety. The UI hook depends on every field being present; ADR 0002 D1
  // claims backward compatibility, and this is what makes the claim mechanical.
  const validShapeId = 'd'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${validShapeId}`
  );
  assertEqual(status, 200, 'profiles-tagged status');
  for (const k of ['success', 'povSuffix', 'minRank', 'sort', 'rows', 'viewerAssertions']) {
    assert(k in json, `response must still include ${k} after the additive assertions change`);
  }
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tag-detail tests (Story 2) ---');
  if (!(await controlPanelReachable())) {
    const skipped = tests.length;
    console.log(`  - SKIP: control panel not reachable at ${CONTROL_PANEL_BASE} — live-API suite needs the local stack (${skipped} tests skipped)`);
    return { pass: 0, fail: 0, skipped };
  }
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\ntag-detail: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
