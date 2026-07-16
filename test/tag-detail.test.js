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
// by a NON-TA pubkey (c06d93c9…) deliberately: a TA-hardcode regression would
// pass silently against a TA-authored tag. Prerequisite: the local stack's
// kind-39999 corpus. Against a BRAINSTORM_BASE_URL lacking this event these
// tests fail loudly (named below) rather than pass vacuously.
const RAW_FIXTURE = {
  eventId: '5633f149de1dd8635d9b45c77ab44c7decf2ad179b76898340ed1be2537e975d',
  slug: 'cpc-tag-s12b-1784175857927-1vizzi',
  authorPubkey: 'c06d93c96d6e659c9f3a6af97bc490d26cc0141fd8d638d54ef20a0197938899',
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
