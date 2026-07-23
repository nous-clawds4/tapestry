/**
 * Integration tests for Story 13: live publish flow for the
 * pin-aware tag index.
 * ADR: engineering-team/decisions/0012-most-pinned-tag-index.md
 *
 * Exercises the parts of the spec the contract suite cannot:
 *   - AC-1 (per-row pinnedCount reflects actual pin events)
 *   - AC-2 (most-pinned sort orders rows by count desc, ties on tagEventId)
 *   - AC-5 (viewerPinned true for the viewer's own pin)
 *   - AC-6 (pinnedByMe filter narrows the rows; total reflects filtered)
 *   - AC-8 (kind-5 deletion drops a pin from the count)
 *   - AC-9 (replaceable dedupe: same author counted as 1)
 *   - AC-10 (server-side pagination correctness under filter)
 *   - Union: a tag with only pins (no endorsements/disputes) appears
 *   - POV scope (Phase 2): out-of-WoT pinners don't contribute
 *
 * Approach: ephemeral keypairs via `nak`, signed events POSTed to
 * /api/strfry/publish, then assertions against /api/profile-tags/index.
 * Mirrors test/tl-publication-from-pins-publish.test.js + Story 12's
 * publish-flow suite.
 *
 * Skips when `nak` is missing or the control panel is unreachable.
 * Phase-2 (POV-required) skips when settings.json is not writable.
 */

const { execSync, execFileSync } = require('child_process');
const { ensureRankedPool, makeAuthorDealer } = require('./helpers/livePov');
const fs = require('fs');
const path = require('path');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
const PROPAGATION_MS = 800;

const SETTINGS_PATH = process.env.TAPESTRY_SETTINGS_PATH
  || path.join(process.env.BRAINSTORM_BASE_DIR || '/var/lib/brainstorm', 'settings.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function nakAvailable() {
  try { execSync('command -v nak', { stdio: 'pipe' }); return true; } catch { return false; }
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

// Z-TAG COMPOSITION pubkey. This suite previously resolved it at runtime from
// /api/assistant/pubkey, citing CLAUDE.md's "never hardcode" rule — but z-tag
// composition for tag/nostr-user-tag/tag-pinning is that rule's NAMED
// EXCEPTION (ADR 0015): the server reads pins via handles built from the
// LEGACY literal (src/api/profile-tags/index.js:49-61), so pins composed
// under a rebuilt container's fresh runtime TA are invisible to every read.
const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
async function fetchTaPubkey() {
  return LEGACY_Z_TAG_PUBKEY;
}

function nakKeyGen() { return execSync('nak key generate').toString().trim(); }
function nakDerivePubkey(privkey) { return execSync(`nak key public ${privkey}`).toString().trim(); }

function nakSignEvent({ kind, tags = [], content = '', privkey }) {
  // argv-style — avoids bash brace-expansion on JSON tag values.
  const args = ['event', '-k', String(kind)];
  for (const tag of tags) {
    args.push('--tag', `${tag[0]}=${tag.slice(1).join('=')}`);
  }
  args.push('--sec', privkey, '-c', content);
  return JSON.parse(execFileSync('nak', args).toString().trim());
}

async function publish(signedEvent) {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/strfry/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: signedEvent, signAs: 'client' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(`publish failed: status=${r.status} body=${JSON.stringify(j)}`);
  return j.event;
}

async function fetchJson(url) {
  const r = await fetch(url);
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

async function meiliUpsertProfile(doc) {
  const r = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([doc]),
  });
  if (!r.ok) throw new Error(`meili upsert failed: ${r.status} ${await r.text()}`);
  await sleep(800);
}

function canMutateSettings() {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) return false;
    fs.accessSync(dir, fs.constants.W_OK);
    if (fs.existsSync(SETTINGS_PATH)) fs.accessSync(SETTINGS_PATH, fs.constants.W_OK);
    return true;
  } catch { return false; }
}

function readSettingsFile() {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
}

function writeSettingsFile(obj) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

/* ── Fixture builders ───────────────────────────────────────── */

async function publishTagEvent({ slug, name, description, authorSk, taPubkey }) {
  return await publish(nakSignEvent({
    kind: 39999,
    tags: [['d', slug], ['z', `39998:${taPubkey}:tag`]],
    content: JSON.stringify({ tag: { slug, name, description: description || '' } }),
    privkey: authorSk,
  }));
}

function buildPinEvent({ tag, viewerSk, viewerPk, taPubkey, curationMethod }) {
  const dTag = `tag-pin-${tag.slug}-${tag.authorPubkey.slice(0, 8)}-${viewerPk.slice(0, 8)}`;
  return nakSignEvent({
    kind: 39999,
    tags: [
      ['d', dTag],
      ['e', tag.eventId],
      ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
      ['z', `39998:${taPubkey}:tag-pinning`],
      ['curation-method', JSON.stringify(curationMethod || {
        observer: viewerPk, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false,
      })],
    ],
    content: JSON.stringify({ tagPinning: { tagEventId: tag.eventId, curationMethod: curationMethod || {} } }),
    privkey: viewerSk,
  });
}

function buildProfileTagAssertion({ tagSlug, tagEventId, targetPubkey, authorSk, authorPk, polarity, taPubkey }) {
  const dTag = `profile-tag-${tagSlug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  return nakSignEvent({
    kind: 39999,
    tags: [
      ['d', dTag],
      ['p', targetPubkey],
      ['e', tagEventId],
      ['z', `39998:${taPubkey}:nostr-user-tag`],
      ['polarity', String(polarity)],
    ],
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: targetPubkey, tagEventId } }),
    privkey: authorSk,
  });
}

function findRow(rows, tagEventId) {
  return (rows || []).find((r) => r.tagEventId === tagEventId);
}

/* ── Phase 1: no-POV tests ──────────────────────────────────── */
/*
 * Fixture: two tags. tagA: 2 distinct pinners. tagB: 1 pinner. The viewer
 * is one of tagA's pinners. tagA also has one endorsement (so it appears
 * in the index even before union-widening); tagB has NO endorsements
 * (testing the union behavior).
 */

let basicCtx = null;
const basicTests = [];
function tBasic(name, fn) { basicTests.push([name, fn]); }

async function setupBasicSuite() {
  const taPubkey = await fetchTaPubkey();
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s13b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const tagA = await publishTagEvent({
    slug: `mpt-a-${slugBase}`,
    name: `MPT-A ${slugBase}`,
    description: 'Story 13 most-pinned test tag A (2 pinners + 1 endorsement)',
    authorSk: tagAuthorSk, taPubkey,
  });
  const tagB = await publishTagEvent({
    slug: `mpt-b-${slugBase}`,
    name: `MPT-B ${slugBase}`,
    description: 'Story 13 most-pinned test tag B (1 pinner, no endorsements — union test)',
    authorSk: tagAuthorSk, taPubkey,
  });

  // Pinners and the endorser come from the pre-ranked pool (helpers/livePov.js):
  // pinnedCount and assertion counts include only POV-counted authors, so on a
  // POV-filtered stack ephemeral identities' pins/endorsements are dropped.
  const dealer = makeAuthorDealer();
  const viewer = dealer.take();
  const otherPinner = dealer.take();
  const endorser = dealer.take();
  const someTarget = nakDerivePubkey(nakKeyGen());

  // One endorsement for tagA — so tagA shows up in the existing
  // assertion-driven sorts too. (tagB has none → tests the union.)
  await publish(buildProfileTagAssertion({
    tagSlug: `mpt-a-${slugBase}`, tagEventId: tagA.id, targetPubkey: someTarget,
    authorSk: endorser.sk, authorPk: endorser.pk, polarity: 1, taPubkey,
  }));

  // Pins.
  const tagAObj = { eventId: tagA.id, slug: `mpt-a-${slugBase}`, authorPubkey: tagAuthorPk };
  const tagBObj = { eventId: tagB.id, slug: `mpt-b-${slugBase}`, authorPubkey: tagAuthorPk };
  await publish(buildPinEvent({ tag: tagAObj, viewerSk: viewer.sk, viewerPk: viewer.pk, taPubkey }));
  await publish(buildPinEvent({ tag: tagAObj, viewerSk: otherPinner.sk, viewerPk: otherPinner.pk, taPubkey }));
  await publish(buildPinEvent({ tag: tagBObj, viewerSk: otherPinner.sk, viewerPk: otherPinner.pk, taPubkey }));

  await sleep(PROPAGATION_MS);
  basicCtx = { taPubkey, tagA, tagB, tagAObj, tagBObj, viewer, otherPinner, slugBase };
}

tBasic('AC-1: published pins increment pinnedCount on the tag rows', async () => {
  const { tagA, tagB } = basicCtx;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=200`
  );
  const rowA = findRow(json.rows, tagA.id);
  const rowB = findRow(json.rows, tagB.id);
  assert(rowA, `tagA row must appear; got tagEventIds=${(json.rows||[]).map(r => r.tagEventId.slice(0,8)).join(',')}`);
  assert(rowB, `tagB row must appear (union of pins) — confirms tags with pins-but-no-assertions surface`);
  assertEq(rowA.pinnedCount, 2, 'tagA.pinnedCount');
  assertEq(rowB.pinnedCount, 1, 'tagB.pinnedCount');
});

tBasic('AC-2: sort=most-pinned orders rows by pinnedCount desc; ties on tagEventId asc', async () => {
  const { tagA, tagB } = basicCtx;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=200`
  );
  const idxA = (json.rows || []).findIndex((r) => r.tagEventId === tagA.id);
  const idxB = (json.rows || []).findIndex((r) => r.tagEventId === tagB.id);
  assert(idxA >= 0 && idxB >= 0, 'both fixture tags must be in the result');
  assert(idxA < idxB,
    `tagA (pinnedCount=2) MUST sort before tagB (pinnedCount=1); got idxA=${idxA}, idxB=${idxB}`);
});

tBasic('Union widening: tagB (pins-but-no-assertions) appears in the listing', async () => {
  const { tagB } = basicCtx;
  // tagB has zero assertions; pre-Story-13 it would not appear.
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=200`
  );
  const rowB = findRow(json.rows, tagB.id);
  assert(rowB, `tagB must appear via union widening; pin-only tags should be visible in the listing`);
  assertEq(rowB.applications, 0, 'tagB.applications (no endorsements)');
  assertEq(rowB.disputes, 0, 'tagB.disputes (no disputes)');
});

tBasic('AC-5: viewer\'s own pin sets viewerPinned=true on that tag\'s row (and on no others)', async () => {
  const { tagA, tagB, viewer } = basicCtx;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=200&viewerPubkey=${viewer.pk}`
  );
  const rowA = findRow(json.rows, tagA.id);
  const rowB = findRow(json.rows, tagB.id);
  assertEq(rowA?.viewerPinned, true, 'viewerPinned on tagA (viewer pinned it)');
  assertEq(rowB?.viewerPinned, false, 'viewerPinned on tagB (viewer did NOT pin it)');
});

tBasic('AC-6: pinnedByMe=true narrows rows to the viewer\'s pinned set; total reflects the filter', async () => {
  const { tagA, tagB, viewer } = basicCtx;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=200&viewerPubkey=${viewer.pk}&pinnedByMe=true`
  );
  const pks = (json.rows || []).map((r) => r.tagEventId);
  assert(pks.includes(tagA.id), 'tagA must appear when pinnedByMe=true (viewer pinned it)');
  assert(!pks.includes(tagB.id), 'tagB must NOT appear when pinnedByMe=true (viewer did NOT pin it)');
  // Every surviving row is one the viewer pinned.
  for (const row of (json.rows || [])) {
    assertEq(row.viewerPinned, true,
      `every row under pinnedByMe=true must have viewerPinned=true; got ${JSON.stringify(row)}`);
  }
  // total reflects the filter.
  assert(json.total === (json.rows || []).length,
    `total (${json.total}) must equal the filtered row count (${(json.rows || []).length})`);
});

tBasic('AC-9: same author publishing two pins for the same tag is counted as 1 (replaceable dedupe)', async () => {
  const { tagA, tagAObj, taPubkey, viewer } = basicCtx;

  // Re-publish viewer's pin event with a newer created_at — same d-tag,
  // so the relay replaces the prior entry. The count should still be 2
  // (viewer + otherPinner), NOT 3.
  await sleep(1100);
  const repinned = buildPinEvent({
    tag: tagAObj, viewerSk: viewer.sk, viewerPk: viewer.pk, taPubkey,
    curationMethod: { observer: viewer.pk, method: 'nip85:rank', cutoff: 5, includeScoreInTL: false },
  });
  await publish(repinned);
  await sleep(PROPAGATION_MS);

  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=200`
  );
  const rowA = findRow(json.rows, tagA.id);
  assertEq(rowA?.pinnedCount, 2,
    'tagA must STILL have pinnedCount=2 after viewer re-pins (replaceable dedupe)');
});

tBasic('AC-8: kind-5 deletion of a pin event removes it from pinnedCount', async () => {
  const { tagA, tagAObj, taPubkey, viewer } = basicCtx;

  // First, look up viewer's latest pin event for tagA (post-re-pin from
  // the prior test).
  const dTag = `tag-pin-${tagAObj.slug}-${tagAObj.authorPubkey.slice(0, 8)}-${viewer.pk.slice(0, 8)}`;
  // We don't have a clean "get my pin event id" path here; use the
  // /api/profile-tags/pins endpoint.
  const pinsR = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewer.pk}`
  );
  const myPin = (pinsR.json?.pins || []).find((p) => p.tag.eventId === tagA.id);
  assert(myPin, 'viewer\'s pin row must be retrievable via /api/profile-tags/pins');

  // kind-5 deletion targeting the pin event id.
  const del = nakSignEvent({
    kind: 5,
    tags: [['e', myPin.pinEventId]],
    content: 'unpinned for AC-8',
    privkey: viewer.sk,
  });
  await publish(del);
  await sleep(PROPAGATION_MS);

  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=200`
  );
  const rowA = findRow(json.rows, tagA.id);
  assertEq(rowA?.pinnedCount, 1,
    'tagA.pinnedCount MUST drop to 1 after viewer\'s pin is kind-5-deleted (otherPinner remains)');
});

/* ── Phase 2: POV-required (WoT-author filter on pin authors) ── */
/*
 * Fixture: one tag. Two pinners — one in-WoT, one out-of-WoT. With POV
 * configured, only the in-WoT pinner counts. Without POV, both count
 * (the existing fallback semantic).
 */

let povCtx = null;
let savedSettings = null;
const povTests = [];
function tPov(name, fn) { povTests.push([name, fn]); }

async function setupPovSuite() {
  const taPubkey = await fetchTaPubkey();
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s13p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `mpt-pov-${slugBase}`;

  const tag = await publishTagEvent({
    slug: tagSlug, name: `MPT POV ${slugBase}`,
    description: 'AC: WoT-author filter applies to pin authors',
    authorSk: tagAuthorSk, taPubkey,
  });

  const delegatedPubkey = nakDerivePubkey(nakKeyGen());
  const povSuffix = delegatedPubkey.slice(0, 8);
  const minRank = 50;
  const rankField = `wot_rank_${povSuffix}`;

  const inWotPinner = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const outOfWotPinner = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();

  await meiliUpsertProfile({ id: inWotPinner.pk, pubkey: inWotPinner.pk, name: `inWot-${slugBase}`, [rankField]: 80 });
  await meiliUpsertProfile({ id: outOfWotPinner.pk, pubkey: outOfWotPinner.pk, name: `outOfWot-${slugBase}`, [rankField]: 10 });

  const tagObj = { eventId: tag.id, slug: tagSlug, authorPubkey: tagAuthorPk };
  await publish(buildPinEvent({ tag: tagObj, viewerSk: inWotPinner.sk, viewerPk: inWotPinner.pk, taPubkey }));
  await publish(buildPinEvent({ tag: tagObj, viewerSk: outOfWotPinner.sk, viewerPk: outOfWotPinner.pk, taPubkey }));

  await sleep(PROPAGATION_MS);

  // Install house POV.
  savedSettings = readSettingsFile();
  writeSettingsFile({
    ...savedSettings,
    grapevine: {
      ...(savedSettings.grapevine || {}),
      searchPreferences: {
        ...((savedSettings.grapevine || {}).searchPreferences || {}),
        delegatedPubkey,
        filters: { rank: { min: minRank } },
      },
    },
  });

  povCtx = { taPubkey, tag, povSuffix, minRank, inWotPinner, outOfWotPinner, slugBase };
}

async function teardownPovSuite() {
  if (savedSettings !== null) {
    try { writeSettingsFile(savedSettings); } catch {}
  }
}

tPov('WoT scope: pin authors who fail the WoT filter do NOT contribute to pinnedCount', async () => {
  const { tag } = povCtx;
  // House POV is now configured. Both pinners exist; only inWotPinner
  // (rank 80 ≥ minRank 50) should count. outOfWotPinner (rank 10) should
  // be filtered out.
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=200`
  );
  const row = findRow(json.rows, tag.id);
  assert(row, `tag must appear in the listing under POV; got rows=${JSON.stringify((json.rows||[]).map(r=>r.tagEventId.slice(0,8)))}`);
  assertEq(row.pinnedCount, 1,
    'pinnedCount must equal the number of in-WoT pinners (1), not the total (2)');
});

/* ── Helpers ── */

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/* ── Run ── */

async function run() {
  console.log('\n--- most-pinned-tag-index publish-flow tests (Story 13) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: basicTests.length + povTests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: basicTests.length + povTests.length };
  }
  const ranked = await ensureRankedPool();
  if (!ranked.ok) {
    console.log(`  SKIP  ${ranked.reason}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: basicTests.length + povTests.length };
  }

  let pass = 0, fail = 0, skipped = 0;

  console.log('  (phase 1: basic — no POV required)');
  try {
    await setupBasicSuite();
    for (const [name, fn] of basicTests) {
      try { await fn(); console.log(`  PASS  ${name}`); pass++; }
      catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); fail++; }
    }
  } catch (err) {
    console.log(`  FAIL  basic suite setup: ${err.message}`);
    fail++;
  }

  console.log('  (phase 2: POV-required — needs settings.json writable)');
  if (!canMutateSettings()) {
    console.log(`  SKIP  ${SETTINGS_PATH} not writable from this process; POV-scope test runs in environments where the test process and the server share a filesystem`);
    skipped += povTests.length;
  } else {
    try {
      await setupPovSuite();
      try {
        for (const [name, fn] of povTests) {
          try { await fn(); console.log(`  PASS  ${name}`); pass++; }
          catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); fail++; }
        }
      } finally { await teardownPovSuite(); }
    } catch (err) {
      console.log(`  FAIL  POV suite setup: ${err.message}`);
      fail++;
      await teardownPovSuite();
    }
  }

  console.log(`\nmost-pinned-tag-index-publish: ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
