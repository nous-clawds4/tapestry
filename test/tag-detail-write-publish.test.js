/**
 * Integration tests for Story 3: viewer-union semantics on profiles-tagged.
 * ADR: engineering-team/decisions/0004-tag-detail-page-write.md
 *
 * The suite is split into two phases so the maximum amount of behavior runs
 * on the maximum number of environments:
 *
 *   Phase 1 (no POV needed) — viewerAssertions population, both polarity
 *     branches, "empty when viewer has no assertions" edge case. Runs anywhere
 *     `nak` is on PATH and the control panel is reachable.
 *
 *   Phase 2 (POV-required) — viewer-only target unioned in (applications=0,
 *     disputes=0, onlyViewerVisible=true), no-leak guarantee for the
 *     unviewed read, false-positive guard for in-WoT rows. The viewer-union
 *     is only observable when a POV with a minRank threshold is installed —
 *     without it, the WoT filter degrades to "all positive applications
 *     count" (per the resolvePov fallback) and the viewer's own assertion
 *     is in the row already, defeating the very thing the union covers.
 *     Skips when `/var/lib/brainstorm/settings.json` isn't writable from the
 *     test process (e.g., the brainstorm server runs in a container and the
 *     test process is on the host). Implementer / reviewer environments that
 *     share the filesystem with the server (or run tests inside the
 *     container) exercise this phase end-to-end.
 *
 * Approach: ephemeral keypairs via `nak`, signed kind-39999 events POSTed to
 * `/api/strfry/publish` with `signAs: "client"`. Mirrors Story 2's publish
 * suite. Mutates settings.json to install a deterministic house POV with a
 * minRank threshold; restores on `finally`.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const NOSTR_USER_TAG_HANDLE = `39998:${TA_PUBKEY}:nostr-user-tag`;
const TAG_HANDLE = `39998:${TA_PUBKEY}:tag`;
const PROPAGATION_MS = 600;

const SETTINGS_PATH = process.env.TAPESTRY_SETTINGS_PATH
  || path.join(process.env.BRAINSTORM_BASE_DIR || '/var/lib/brainstorm', 'settings.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function nakAvailable() {
  try { execSync('command -v nak', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
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

function signProfileTagEvent({ tagSlug, tagEventId, targetPubkey, authorSk, authorPk, polarity }) {
  const dTag = `profile-tag-${tagSlug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  const tags = [
    ['d', dTag],
    ['p', targetPubkey],
    ['e', tagEventId],
    ['z', NOSTR_USER_TAG_HANDLE],
  ];
  if (polarity !== undefined && polarity !== null) tags.push(['polarity', String(polarity)]);
  const content = JSON.stringify({ nostrUserTag: { taggedPubkey: targetPubkey, tagEventId } });
  return nakSignEvent({ kind: 39999, tags, content, privkey: authorSk });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

class SkipTest extends Error {
  constructor(reason) { super(reason); this.name = 'SkipTest'; }
}

function canMutateSettings() {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) return false;
    fs.accessSync(dir, fs.constants.W_OK);
    if (fs.existsSync(SETTINGS_PATH)) {
      fs.accessSync(SETTINGS_PATH, fs.constants.W_OK);
    }
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

/* ─── Phase 1: no-POV viewerAssertions tests ─────────────────────────────
 *
 * Fixture: one tag, one asserter (viewerA) who applies one target and
 * disputes another. No POV configured — viewerA's assertions are in the
 * row already (the "fallback: all positive applications count" branch of
 * resolvePov). What we're verifying:
 *   - viewerAssertions is populated by the viewer's pubkey.
 *   - Both 'applied' and 'disputed' polarities round-trip.
 *   - A different viewer (with no assertions) gets an empty map.
 */

let noPovCtx = null;
const noPovTests = [];
function tNoPov(name, fn) { noPovTests.push([name, fn]); }

async function setupNoPovSuite() {
  const tagAuthorSk = nakKeyGen();
  const slugBase = `s3np-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `s3np-${slugBase}`;
  const tagEvent = nakSignEvent({
    kind: 39999,
    tags: [['d', tagSlug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug: tagSlug, name: `S3 NoPov ${slugBase}`, description: '' } }),
    privkey: tagAuthorSk,
  });
  const publishedTag = await publish(tagEvent);

  const viewerA = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const viewerB = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const targetApplied = nakDerivePubkey(nakKeyGen());
  const targetDisputed = nakDerivePubkey(nakKeyGen());

  // Seed Meili so target enrichment works (we don't strictly need this for
  // viewerAssertions, but the response shape is more realistic with it).
  await meiliUpsertProfile({ id: targetApplied, pubkey: targetApplied, name: `TA-${slugBase}` });
  await meiliUpsertProfile({ id: targetDisputed, pubkey: targetDisputed, name: `TD-${slugBase}` });

  // viewerA applies targetApplied, disputes targetDisputed.
  await publish(signProfileTagEvent({
    tagSlug, tagEventId: publishedTag.id, targetPubkey: targetApplied,
    authorSk: viewerA.sk, authorPk: viewerA.pk, polarity: 1,
  }));
  await publish(signProfileTagEvent({
    tagSlug, tagEventId: publishedTag.id, targetPubkey: targetDisputed,
    authorSk: viewerA.sk, authorPk: viewerA.pk, polarity: -1,
  }));
  await sleep(PROPAGATION_MS);

  noPovCtx = {
    publishedTag, viewerA, viewerB,
    targetApplied, targetDisputed,
    slugBase,
  };
}

tNoPov('viewerAssertions is populated when viewerPubkey is provided', async () => {
  const { publishedTag, viewerA, targetApplied, targetDisputed } = noPovCtx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
      + `?tagEventId=${publishedTag.id}&viewerPubkey=${viewerA.pk}`
  );
  assert(status === 200, `status ${status}`);
  const va = json?.viewerAssertions;
  assert(va && typeof va === 'object' && !Array.isArray(va),
    `viewerAssertions must be a map; got ${JSON.stringify(va)}`);
  assert(va[targetApplied] === 'applied',
    `viewerAssertions[targetApplied]='applied' expected; got ${JSON.stringify(va[targetApplied])}`);
  assert(va[targetDisputed] === 'disputed',
    `viewerAssertions[targetDisputed]='disputed' expected; got ${JSON.stringify(va[targetDisputed])}`);
});

tNoPov('viewerAssertions is an empty map for a viewer with no assertions on this tag', async () => {
  const { publishedTag, viewerB } = noPovCtx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
      + `?tagEventId=${publishedTag.id}&viewerPubkey=${viewerB.pk}`
  );
  assert(status === 200, `status ${status}`);
  const va = json?.viewerAssertions;
  assert(va && typeof va === 'object', `viewerAssertions must be present as a map; got ${JSON.stringify(va)}`);
  assert(Object.keys(va).length === 0, `expected empty map; got ${JSON.stringify(va)}`);
});

tNoPov('each row carries onlyViewerVisible: false when the viewer is in the in-WoT counts', async () => {
  // No POV → resolvePov falls back to "all positive applications count" →
  // viewerA's apply is in the in-WoT counts → row.applications=1 and
  // onlyViewerVisible MUST be false (the row would be visible even without
  // the viewer-union).
  const { publishedTag, viewerA, targetApplied } = noPovCtx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
      + `?tagEventId=${publishedTag.id}&viewerPubkey=${viewerA.pk}`
  );
  assert(status === 200, `status ${status}`);
  const row = (json.rows || []).find((r) => r.pubkey === targetApplied);
  assert(row, 'targetApplied row must appear');
  assert(row.applications === 1, `expected applications=1; got ${row.applications}`);
  assert(row.onlyViewerVisible === false,
    `expected onlyViewerVisible=false (row is WoT-visible); got ${row.onlyViewerVisible}`);
});

tNoPov('rows have an onlyViewerVisible field even when no viewerPubkey is passed', async () => {
  // The flag should be present (default false) on every row regardless of
  // whether a viewer is supplied — the UI's <TagPageRow> reads it
  // unconditionally.
  const { publishedTag, targetApplied } = noPovCtx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedTag.id}`
  );
  assert(status === 200, `status ${status}`);
  const row = (json.rows || []).find((r) => r.pubkey === targetApplied);
  assert(row, 'targetApplied row must appear');
  assert('onlyViewerVisible' in row,
    `rows must carry an onlyViewerVisible field even without viewerPubkey; got ${JSON.stringify(row)}`);
  assert(row.onlyViewerVisible === false,
    `expected onlyViewerVisible=false when no viewer is supplied; got ${row.onlyViewerVisible}`);
});

/* ─── Phase 2: POV-required viewer-union tests ────────────────────────────
 *
 * Fixture: one tag, one POV (delegated pubkey + minRank=50). One in-WoT
 * author and one out-of-WoT viewer. The viewer applies to two targets and
 * disputes a third.
 *
 *   inWotAuthorA (wot_rank 80, in-WoT) — applies to targetWot
 *   outOfWotViewer (wot_rank 10, out-of-WoT) — applies targetWot AND
 *     targetViewerOnly, disputes targetDisputed
 *   inWotAuthorB (wot_rank 80, in-WoT) — DOES NOT apply (used to test the
 *     "viewer with no assertions" edge case under POV)
 *
 * Expected with viewerPubkey = outOfWotViewer.pk:
 *   - targetWot         → applications=1 (A), disputes=0, onlyViewerVisible=false
 *                         viewerAssertions[targetWot] = 'applied'
 *   - targetViewerOnly  → applications=0, disputes=0, onlyViewerVisible=true
 *                         viewerAssertions[targetViewerOnly] = 'applied'
 *   - targetDisputed    → applications=0, disputes=0, onlyViewerVisible=true
 *                         viewerAssertions[targetDisputed] = 'disputed'
 *
 * Without viewerPubkey:
 *   - targetWot         → applications=1, disputes=0
 *   - targetViewerOnly, targetDisputed → NOT in rows (no in-WoT assertion).
 */

let povCtx = null;
let savedSettings = null;
const povTests = [];
function tPov(name, fn) { povTests.push([name, fn]); }

async function setupPovSuite() {
  const tagAuthorSk = nakKeyGen();
  const slugBase = `s3pov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `s3pov-${slugBase}`;
  const tagEvent = nakSignEvent({
    kind: 39999,
    tags: [['d', tagSlug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug: tagSlug, name: `S3 Pov ${slugBase}`, description: '' } }),
    privkey: tagAuthorSk,
  });
  const publishedTag = await publish(tagEvent);

  const delegatedPubkey = nakDerivePubkey(nakKeyGen());
  const povSuffix = delegatedPubkey.slice(0, 8);
  const minRank = 50;
  const rankField = `wot_rank_${povSuffix}`;

  const inWotAuthorA = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const inWotAuthorB = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const outOfWotViewer = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();

  const targetWot = nakDerivePubkey(nakKeyGen());
  const targetViewerOnly = nakDerivePubkey(nakKeyGen());
  const targetDisputed = nakDerivePubkey(nakKeyGen());

  await meiliUpsertProfile({
    id: inWotAuthorA.pk, pubkey: inWotAuthorA.pk,
    name: `InWotA-${slugBase}`, [rankField]: 80,
  });
  await meiliUpsertProfile({
    id: inWotAuthorB.pk, pubkey: inWotAuthorB.pk,
    name: `InWotB-${slugBase}`, [rankField]: 80,
  });
  await meiliUpsertProfile({
    id: outOfWotViewer.pk, pubkey: outOfWotViewer.pk,
    name: `OutWotViewer-${slugBase}`, [rankField]: 10,
  });
  await meiliUpsertProfile({ id: targetWot, pubkey: targetWot, name: `TargetWot-${slugBase}` });
  await meiliUpsertProfile({ id: targetViewerOnly, pubkey: targetViewerOnly, name: `TargetViewerOnly-${slugBase}` });
  await meiliUpsertProfile({ id: targetDisputed, pubkey: targetDisputed, name: `TargetDisputed-${slugBase}` });

  await publish(signProfileTagEvent({
    tagSlug, tagEventId: publishedTag.id, targetPubkey: targetWot,
    authorSk: inWotAuthorA.sk, authorPk: inWotAuthorA.pk, polarity: 1,
  }));
  await publish(signProfileTagEvent({
    tagSlug, tagEventId: publishedTag.id, targetPubkey: targetWot,
    authorSk: outOfWotViewer.sk, authorPk: outOfWotViewer.pk, polarity: 1,
  }));
  await publish(signProfileTagEvent({
    tagSlug, tagEventId: publishedTag.id, targetPubkey: targetViewerOnly,
    authorSk: outOfWotViewer.sk, authorPk: outOfWotViewer.pk, polarity: 1,
  }));
  await publish(signProfileTagEvent({
    tagSlug, tagEventId: publishedTag.id, targetPubkey: targetDisputed,
    authorSk: outOfWotViewer.sk, authorPk: outOfWotViewer.pk, polarity: -1,
  }));

  await sleep(PROPAGATION_MS);

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

  povCtx = {
    publishedTag, povSuffix, minRank,
    inWotAuthorA, inWotAuthorB, outOfWotViewer,
    targetWot, targetViewerOnly, targetDisputed,
    slugBase,
  };
}

async function teardownPovSuite() {
  if (savedSettings !== null) {
    try { writeSettingsFile(savedSettings); } catch { /* ignore */ }
  }
}

tPov('viewer-union: viewer-only applied target surfaces with applications=0, disputes=0, onlyViewerVisible=true', async () => {
  const { publishedTag, outOfWotViewer, targetViewerOnly, povSuffix } = povCtx;
  const url = `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
    + `?tagEventId=${publishedTag.id}&viewerPubkey=${outOfWotViewer.pk}`;
  const { status, json } = await fetchJson(url);
  assert(status === 200, `status ${status}`);
  assert(json?.povSuffix === povSuffix, `expected povSuffix=${povSuffix}; got ${json?.povSuffix}`);

  const row = (json.rows || []).find((r) => r.pubkey === targetViewerOnly);
  assert(row, 'targetViewerOnly row must appear via viewer-union');
  assert(row.applications === 0, `expected applications=0 on viewer-only row; got ${row.applications}`);
  assert(row.disputes === 0, `expected disputes=0; got ${row.disputes}`);
  assert(row.onlyViewerVisible === true,
    `expected onlyViewerVisible=true on viewer-only applied row; got ${row.onlyViewerVisible}`);

  const va = json.viewerAssertions || {};
  assert(va[targetViewerOnly] === 'applied',
    `expected viewerAssertions[targetViewerOnly]='applied'; got ${JSON.stringify(va[targetViewerOnly])}`);
});

tPov('viewer-union: viewer-only disputed target surfaces with onlyViewerVisible=true and viewerAssertions="disputed"', async () => {
  const { publishedTag, outOfWotViewer, targetDisputed } = povCtx;
  const url = `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
    + `?tagEventId=${publishedTag.id}&viewerPubkey=${outOfWotViewer.pk}`;
  const { json } = await fetchJson(url);
  const row = (json.rows || []).find((r) => r.pubkey === targetDisputed);
  assert(row, 'targetDisputed row must appear via viewer-union');
  assert(row.applications === 0 && row.disputes === 0,
    `expected 0/0 on viewer-only disputed target; got ${row.applications}/${row.disputes}`);
  assert(row.onlyViewerVisible === true, `expected onlyViewerVisible=true; got ${row.onlyViewerVisible}`);
  const va = json.viewerAssertions || {};
  assert(va[targetDisputed] === 'disputed',
    `expected viewerAssertions[targetDisputed]='disputed'; got ${JSON.stringify(va[targetDisputed])}`);
});

tPov('viewer-union: WoT-visible target keeps applications=1 and onlyViewerVisible=false even when the viewer also applied', async () => {
  const { publishedTag, outOfWotViewer, targetWot } = povCtx;
  const url = `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
    + `?tagEventId=${publishedTag.id}&viewerPubkey=${outOfWotViewer.pk}`;
  const { json } = await fetchJson(url);
  const row = (json.rows || []).find((r) => r.pubkey === targetWot);
  assert(row, 'targetWot row must appear (in-WoT author applied)');
  assert(row.applications === 1,
    `expected 1 in-WoT application on targetWot (viewer NOT counted); got ${row.applications}`);
  assert(row.disputes === 0, `expected 0 disputes on targetWot; got ${row.disputes}`);
  assert(row.onlyViewerVisible === false,
    `onlyViewerVisible must be false when the row is WoT-visible; got ${row.onlyViewerVisible}`);

  const va = json.viewerAssertions || {};
  assert(va[targetWot] === 'applied',
    `viewerAssertions[targetWot] should still echo the viewer's polarity; got ${JSON.stringify(va[targetWot])}`);
});

tPov('viewer-union: without viewerPubkey, viewer-only targets are NOT in rows (no-leak guarantee)', async () => {
  // AC-8 backstop on the server side: a logged-out caller must NOT see
  // targets that only exist because of an out-of-WoT viewer's assertion.
  const { publishedTag, targetViewerOnly, targetDisputed, targetWot } = povCtx;
  const url = `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedTag.id}`;
  const { json } = await fetchJson(url);
  const pks = (json.rows || []).map((r) => r.pubkey);
  assert(pks.includes(targetWot),
    `targetWot must remain visible without viewerPubkey (in-WoT applied)`);
  assert(!pks.includes(targetViewerOnly),
    `targetViewerOnly must NOT appear without viewerPubkey (would leak viewer-only state)`);
  assert(!pks.includes(targetDisputed),
    `targetDisputed must NOT appear without viewerPubkey`);
});

tPov('viewer-union: WoT-visible target with a different (no-assertion) viewer keeps onlyViewerVisible=false', async () => {
  // Edge case: inWotAuthorB has no assertions on this tag at all. With them
  // as the viewer, the row count for targetWot still comes through (from
  // inWotAuthorA), and onlyViewerVisible must stay false — the row is
  // POV-visible regardless of the viewer.
  const { publishedTag, inWotAuthorB, targetWot } = povCtx;
  const url = `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
    + `?tagEventId=${publishedTag.id}&viewerPubkey=${inWotAuthorB.pk}`;
  const { json } = await fetchJson(url);
  const row = (json.rows || []).find((r) => r.pubkey === targetWot);
  assert(row, 'targetWot row must remain visible from POV-only counts');
  assert(row.applications === 1, `expected 1 application; got ${row.applications}`);
  assert(row.onlyViewerVisible === false,
    `expected onlyViewerVisible=false (viewer has no assertion here); got ${row.onlyViewerVisible}`);
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tag-detail-write publish-flow tests (Story 3) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: noPovTests.length + povTests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: noPovTests.length + povTests.length };
  }

  let pass = 0, fail = 0, skipped = 0;

  // ─── Phase 1: no-POV tests ──
  console.log('  (phase 1: no POV required)');
  try {
    await setupNoPovSuite();
    for (const [name, fn] of noPovTests) {
      try {
        await fn();
        console.log(`  PASS  ${name}`);
        pass++;
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        fail++;
      }
    }
  } catch (err) {
    console.log(`  FAIL  no-POV suite setup: ${err.message}`);
    fail++;
  }

  // ─── Phase 2: POV-required tests ──
  console.log('  (phase 2: POV-required — needs settings.json writable)');
  if (!canMutateSettings()) {
    console.log(`  SKIP  ${SETTINGS_PATH} not writable from this process; viewer-union/no-leak/false-positive guards exercised on environments where the test process and the server share a filesystem`);
    skipped += povTests.length;
  } else {
    try {
      await setupPovSuite();
      try {
        for (const [name, fn] of povTests) {
          try {
            await fn();
            console.log(`  PASS  ${name}`);
            pass++;
          } catch (err) {
            console.log(`  FAIL  ${name}\n        ${err.message}`);
            fail++;
          }
        }
      } finally {
        await teardownPovSuite();
      }
    } catch (err) {
      console.log(`  FAIL  POV suite setup: ${err.message}`);
      fail++;
      await teardownPovSuite();
    }
  }

  console.log(`\ntag-detail-write-publish: ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
