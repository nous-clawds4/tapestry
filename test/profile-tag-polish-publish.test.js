/**
 * Integration tests for Story 7: live publish-flow against the polish bundle.
 * ADR: engineering-team/decisions/0006-profile-tag-polish-omni-search-pov.md
 *
 * Two fixture clusters:
 *
 * (1) POV-correctness fixture for tags-for-profile:
 *     - Profile owner: T (target being viewed).
 *     - Tag: tagP ("Polish-X").
 *     - 1 in-WoT author applies tagP on T.
 *     - 1 in-WoT author disputes tagP on T.
 *     - 1 below-WoT author applies tagP on T.  ← must be filtered out under POV
 *     With a configured POV: applications=1, disputes=1.
 *     Without POV: applications=2, disputes=1.
 *
 * (2) Omni-search fixture for tagHits / tagHitsHasMore / tagLimit:
 *     Publish 7 tag-elements with names containing a unique slugBase so we
 *     can isolate them. Three name patterns:
 *       - 7 tags whose names all contain `slugBase` so a query for slugBase
 *         matches all 7.
 *     Test behavior:
 *       - q=slugBase, default tagLimit (5) → tagHits.length === 5,
 *         tagHitsHasMore === true.
 *       - q=slugBase, tagLimit=10 → tagHits.length === 7, tagHitsHasMore === false.
 *       - q=slugBase, tagLimit=99999 → tagHits.length <= 50 (server clamp).
 *
 * Skips when nak missing, control panel unreachable, or settings.json
 * not writable (the POV-correctness sub-suite needs settings.json to
 * install a synthetic POV).
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
const PROPAGATION_MS = 900;

const SETTINGS_PATH = process.env.TAPESTRY_SETTINGS_PATH
  || path.join(process.env.BRAINSTORM_BASE_DIR || '/var/lib/brainstorm', 'settings.json');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
class SkipTest extends Error { constructor(reason) { super(reason); this.name = 'SkipTest'; } }

function nakAvailable() {
  try { execSync('command -v nak', { stdio: 'pipe' }); return true; } catch { return false; }
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

function nakKeyGen() { return execSync('nak key generate').toString().trim(); }
function nakDerivePubkey(privkey) { return execSync(`nak key public ${privkey}`).toString().trim(); }
function nakSignEvent({ kind, tags = [], content = '', privkey, createdAt }) {
  const tagArgs = tags.map((t) => `--tag ${t[0]}=${t.slice(1).join('=')}`).join(' ');
  const tsArg = createdAt ? `--created-at ${createdAt}` : '';
  const cmd = `nak event -k ${kind} ${tagArgs} ${tsArg} --sec ${privkey} -c ${JSON.stringify(content)}`;
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
}

function signProfileTagEvent({ tagSlug, tagEventId, targetPubkey, authorSk, authorPk, polarity, createdAt }) {
  const dTag = `profile-tag-${tagSlug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  const tags = [
    ['d', dTag],
    ['p', targetPubkey],
    ['e', tagEventId],
    ['z', NOSTR_USER_TAG_HANDLE],
  ];
  if (polarity !== undefined && polarity !== null) tags.push(['polarity', String(polarity)]);
  const content = JSON.stringify({ nostrUserTag: { taggedPubkey: targetPubkey, tagEventId } });
  return nakSignEvent({ kind: 39999, tags, content, privkey: authorSk, createdAt });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

let ctx = null;
let settingsBackup = null;

async function setupSuite() {
  const slugBase = `s7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // POV configuration installed in settings.json so the server's resolvePov
  // returns deterministic (povSuffix, minRank) for the duration of the suite.
  const delegatedPubkey = nakDerivePubkey(nakKeyGen());
  const povSuffix = delegatedPubkey.slice(0, 8);
  const minRank = 50;
  const rankField = `wot_rank_${povSuffix}`;

  // POV fixture: target T, 1 in-WoT applier, 1 in-WoT disputer, 1 below-WoT applier.
  const targetSk = nakKeyGen();
  const targetPk = nakDerivePubkey(targetSk);
  const inWotApplierSk = nakKeyGen();
  const inWotApplierPk = nakDerivePubkey(inWotApplierSk);
  const inWotDisputerSk = nakKeyGen();
  const inWotDisputerPk = nakDerivePubkey(inWotDisputerSk);
  const belowWotApplierSk = nakKeyGen();
  const belowWotApplierPk = nakDerivePubkey(belowWotApplierSk);

  // Tag author for the POV fixture.
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);

  // Meili docs for the POV fixture authors (target included for Meili enrichment
  // parity with the existing endpoints).
  await meiliUpsertProfile({ id: targetPk, pubkey: targetPk, name: `Target-${slugBase}`, [rankField]: 70 });
  await meiliUpsertProfile({ id: inWotApplierPk, pubkey: inWotApplierPk, name: `InWotApplier-${slugBase}`, [rankField]: 70 });
  await meiliUpsertProfile({ id: inWotDisputerPk, pubkey: inWotDisputerPk, name: `InWotDisputer-${slugBase}`, [rankField]: 70 });
  await meiliUpsertProfile({ id: belowWotApplierPk, pubkey: belowWotApplierPk, name: `BelowWot-${slugBase}`, [rankField]: 10 });
  await meiliUpsertProfile({ id: tagAuthorPk, pubkey: tagAuthorPk, name: `TagAuthor-${slugBase}`, [rankField]: 70 });

  await sleep(1200);

  // Publish the POV-fixture tag-element.
  async function publishTag(suffix, name) {
    const slug = `s7-${slugBase}-${suffix}`;
    const ev = nakSignEvent({
      kind: 39999,
      tags: [['d', slug], ['z', TAG_HANDLE]],
      content: JSON.stringify({ tag: { slug, name, description: `s7 ${slugBase} ${suffix}` } }),
      privkey: tagAuthorSk,
    });
    return { slug, event: await publish(ev) };
  }
  const tagP = await publishTag('polish', `Polish-X ${slugBase}`);

  // POV-fixture assertions.
  await publish(signProfileTagEvent({
    tagSlug: tagP.slug, tagEventId: tagP.event.id, targetPubkey: targetPk,
    authorSk: inWotApplierSk, authorPk: inWotApplierPk, polarity: 1,
  }));
  await publish(signProfileTagEvent({
    tagSlug: tagP.slug, tagEventId: tagP.event.id, targetPubkey: targetPk,
    authorSk: inWotDisputerSk, authorPk: inWotDisputerPk, polarity: -1,
  }));
  await publish(signProfileTagEvent({
    tagSlug: tagP.slug, tagEventId: tagP.event.id, targetPubkey: targetPk,
    authorSk: belowWotApplierSk, authorPk: belowWotApplierPk, polarity: 1,
  }));

  // Omni-search fixture: 7 tag-elements whose names all contain a sub-slug
  // unique to this run. q=<subSlug> matches all 7 deterministically.
  const subSlug = `omni-${slugBase}`;
  const omniTags = [];
  for (let i = 0; i < 7; i++) {
    omniTags.push(await publishTag(`omni-${i}`, `Tag${i} ${subSlug}`));
  }

  await sleep(PROPAGATION_MS);

  // Install POV via settings.json.
  settingsBackup = readSettingsFile();
  writeSettingsFile({
    ...settingsBackup,
    grapevine: {
      ...(settingsBackup.grapevine || {}),
      searchPreferences: {
        ...((settingsBackup.grapevine || {}).searchPreferences || {}),
        delegatedPubkey,
        filters: { rank: { min: minRank } },
      },
    },
  });

  ctx = {
    slugBase, subSlug,
    delegatedPubkey, povSuffix, minRank,
    targetPk, tagAuthorPk,
    inWotApplierPk, inWotDisputerPk, belowWotApplierPk,
    tagP, omniTags,
  };
}

function teardownSuite() {
  if (settingsBackup !== null) {
    try { writeSettingsFile(settingsBackup); } catch { /* best-effort */ }
    settingsBackup = null;
  }
}

/* ─── tags-for-profile: POV-correctness ─── */

t('tags-for-profile WITHOUT POV params returns all 3 fixture assertions (no WoT filter)', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${ctx.targetPk}`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  // Backward-compat: no POV → no author filter → all 3 assertions (2 apps, 1 dispute) surface.
  assert(json.applications.length === 2, `expected 2 apps without POV, got ${json.applications.length}`);
  assert(json.disputes.length === 1, `expected 1 dispute without POV, got ${json.disputes.length}`);
});

t('tags-for-profile WITH wotPov=house filters out below-WoT-rank assertion authors', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${ctx.targetPk}&wotPov=house`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  assert(json.povSuffix === ctx.povSuffix, `expected povSuffix ${ctx.povSuffix}, got ${json.povSuffix}`);
  // POV active → below-WoT applier dropped → 1 app, 1 dispute survive.
  assert(json.applications.length === 1, `expected 1 app with POV (below-WoT filtered out), got ${json.applications.length}`);
  assert(json.disputes.length === 1, `expected 1 dispute with POV, got ${json.disputes.length}`);
  // The surviving application must be the in-WoT one.
  assert(
    json.applications[0]?.authorPubkey === ctx.inWotApplierPk,
    `surviving application's author should be inWotApplier; got ${json.applications[0]?.authorPubkey?.slice(0, 12)}`
  );
});

t('tags-for-profile WITH wotPov=user&userPubkey=<hex> applies the same WoT filter', async () => {
  // The user has no user-prefs file, so wotPov=user falls back to house POV.
  // The filter still applies; the test just verifies the param is accepted.
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${ctx.targetPk}&wotPov=user&userPubkey=${ctx.targetPk}`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  // Same expectation as the house-POV case.
  assert(json.applications.length === 1, `expected 1 app with POV, got ${json.applications.length}`);
  assert(json.disputes.length === 1, `expected 1 dispute with POV, got ${json.disputes.length}`);
});

/* ─── wot-tags: new POV-param contract ─── */

t('wot-tags WITH wotPov=house filters assertion authors by WoT rank', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/wot-tags?wotPov=house`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  assert(json.povSuffix === ctx.povSuffix, `expected povSuffix ${ctx.povSuffix}`);
  // The fixture's tagP has WoT-allowed assertions on targetPk, so it must surface.
  assert(
    json.tagEventIds.includes(ctx.tagP.event.id),
    'tagP.eventId should be in wot-tags response when there are in-WoT assertions on it'
  );
});

/* ─── Search proxy: tagHits + tagHitsHasMore + tagLimit ─── */

t('search proxy: q=<unique-substring> returns tagHits including the fixture tags', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=${encodeURIComponent(ctx.subSlug)}`
  );
  assert(status === 200, `status ${status}`);
  assert(Array.isArray(json?.tagHits), 'tagHits is array');
  // Default tagLimit is 5; the fixture has 7 omni-tags matching.
  const fixtureEventIds = new Set(ctx.omniTags.map((o) => o.event.id));
  const matched = json.tagHits.filter((h) => fixtureEventIds.has(h.eventId));
  assert(matched.length === 5, `expected 5 fixture tagHits at default limit, got ${matched.length}`);
});

t('search proxy: default tagLimit caps at 5 and sets tagHitsHasMore=true when more exist', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=${encodeURIComponent(ctx.subSlug)}`
  );
  assert(status === 200, `status ${status}`);
  assert(json.tagHits.length === 5, `expected 5 tagHits at default limit, got ${json.tagHits.length}`);
  assert(json.tagHitsHasMore === true, `expected tagHitsHasMore=true with 7 fixture matches at limit 5; got ${json.tagHitsHasMore}`);
});

t('search proxy: tagLimit=10 returns all 7 fixture matches and tagHitsHasMore=false', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=${encodeURIComponent(ctx.subSlug)}&tagLimit=10`
  );
  assert(status === 200, `status ${status}`);
  const fixtureEventIds = new Set(ctx.omniTags.map((o) => o.event.id));
  const matched = json.tagHits.filter((h) => fixtureEventIds.has(h.eventId));
  assert(matched.length === 7, `expected 7 fixture tagHits with tagLimit=10, got ${matched.length}`);
  assert(json.tagHitsHasMore === false, `expected tagHitsHasMore=false with tagLimit=10 > 7 matches; got ${json.tagHitsHasMore}`);
});

t('search proxy: each tagHit carries {eventId, slug, name, description}', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=${encodeURIComponent(ctx.subSlug)}&tagLimit=10`
  );
  assert(status === 200, `status ${status}`);
  const h = json.tagHits.find((h) => h.eventId === ctx.omniTags[0].event.id);
  assert(h, 'fixture tag must be in tagHits');
  assert(typeof h.eventId === 'string' && /^[0-9a-f]{64}$/.test(h.eventId), 'eventId is 64-hex');
  assert(typeof h.slug === 'string' && h.slug.length > 0, 'slug is non-empty string');
  assert(typeof h.name === 'string' && h.name.length > 0, 'name is non-empty string');
  assert('description' in h, 'description field present');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- profile-tag-polish publish-flow tests (Story 7) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: tests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: tests.length };
  }
  if (!canMutateSettings()) {
    console.log(`  SKIP  ${SETTINGS_PATH} not writable from this process; suite needs POV install`);
    return { pass: 0, fail: 0, skipped: tests.length };
  }

  try {
    await setupSuite();
  } catch (err) {
    teardownSuite();
    console.log(`  FAIL  suite setup: ${err.message}`);
    return { pass: 0, fail: 1, skipped: tests.length };
  }

  let pass = 0, fail = 0, perTestSkipped = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      if (err && err.name === 'SkipTest') {
        console.log(`  SKIP  ${name}\n        ${err.message}`);
        perTestSkipped++;
      } else {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        fail++;
      }
    }
  }
  teardownSuite();
  console.log(`\nprofile-tag-polish-publish: ${pass} passed, ${fail} failed${perTestSkipped ? `, ${perTestSkipped} skipped` : ''}`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
