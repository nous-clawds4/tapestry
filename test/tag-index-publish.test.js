/**
 * Integration tests for Story 4: live publish-flow against the tag-index API.
 * ADR: engineering-team/decisions/0003-tag-index-page.md
 *
 * Fixture (all tag descriptions contain a unique slugBase so q=<slugBase>
 * isolates the fixture from any pre-existing tags in the DB):
 *
 *   Tag X:  5 applications, 0 disputes
 *   Tag Y:  1 application,  6 disputes
 *   Tag Z:  3 applications, 3 disputes
 *   Tag W:  0 assertions   (control — must NOT appear in the index)
 *
 *   Asserters: 7 reusable ephemeral keypairs.
 *   Targets: 1 per asserted tag; assertions are flipped between apply
 *     and dispute via the polarity event-tag.
 *
 * Shapes are designed so each sort has an unambiguous leader within the
 * fixture:
 *   used     (total volume desc):  Y(7) > Z(6) > X(5)
 *   endorsed (apps desc):          X(5) > Z(3) > Y(1)
 *   divisive (min(apps,dis) desc): Z(3) > Y(1) > X(0)
 *
 * Skips when nak missing or control panel unreachable. Mirrors Story 2's
 * tag-detail-publish suite.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ensureRankedPool, makeAuthorDealer, meiliUpsertAndWait } = require('./helpers/livePov');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const NOSTR_USER_TAG_HANDLE = `39998:${TA_PUBKEY}:nostr-user-tag`;
const TAG_HANDLE = `39998:${TA_PUBKEY}:tag`;
const PROPAGATION_MS = 600;

const SETTINGS_PATH = process.env.TAPESTRY_SETTINGS_PATH
  || path.join(process.env.BRAINSTORM_BASE_DIR || '/var/lib/brainstorm', 'settings.json');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

class SkipTest extends Error {
  constructor(reason) { super(reason); this.name = 'SkipTest'; }
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
  // Upsert and WAIT for indexing — a fixed settle sleep is not enough: under
  // stream-consumer ETL load the Meili task queue takes minutes per task.
  // On timeout, mark the dependent test/suite skipped (environmental).
  const res = await meiliUpsertAndWait(doc, { timeoutMs: 90000 });
  if (!res.ok) throw new SkipTest(res.reason);
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

async function setupSuite() {
  const slugBase = `s4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 7 reusable asserters, drawn from the pre-ranked pool (helpers/livePov.js):
  // on POV-filtered stacks only ranked authors' assertions count, and this
  // suite exercises volume/sort semantics, not the WoT gate. run() has
  // verified the pool via ensureRankedPool().
  const dealer = makeAuthorDealer();
  const asserters = Array.from({ length: 7 }, () => dealer.take());

  // Author of the tag-elements themselves — distinct from asserters.
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);

  // Seed Meili doc for the tag author so by-row enrichment can flow.
  await meiliUpsertProfile({
    id: tagAuthorPk,
    pubkey: tagAuthorPk,
    name: `TagAuthor-${slugBase}`,
    display_name: `TagAuthor ${slugBase}`,
    picture: `https://example.test/${slugBase}-author.png`,
  });

  // Publish four tag-elements. Names + descriptions designed for q-filter tests.
  async function publishTag(suffix, name, description) {
    const slug = `tagindex-${slugBase}-${suffix}`;
    const ev = nakSignEvent({
      kind: 39999,
      tags: [['d', slug], ['z', TAG_HANDLE]],
      content: JSON.stringify({ tag: { slug, name, description } }),
      privkey: tagAuthorSk,
    });
    return { slug, event: await publish(ev) };
  }

  // All descriptions contain slugBase so q=<slugBase> isolates the fixture.
  const tagX = await publishTag('podcaster', `Podcaster ${slugBase}`, `someone who podcasts ${slugBase}`);
  const tagY = await publishTag('designer',  `Designer ${slugBase}`,  `someone who designs ${slugBase}`);
  const tagZ = await publishTag('researcher', `Researcher ${slugBase}`, `someone who researches ${slugBase}`);
  const tagW = await publishTag('warden',    `Warden ${slugBase}`,    `unasserted ${slugBase}`);

  // One target per asserted tag — keeps the assertion graph clean.
  const targetX = nakDerivePubkey(nakKeyGen());
  const targetY = nakDerivePubkey(nakKeyGen());
  const targetZ = nakDerivePubkey(nakKeyGen());

  // Tag X: 5 apps from asserters[0..4]
  for (let i = 0; i < 5; i++) {
    await publish(signProfileTagEvent({
      tagSlug: tagX.slug, tagEventId: tagX.event.id, targetPubkey: targetX,
      authorSk: asserters[i].sk, authorPk: asserters[i].pk,
      polarity: 1,
    }));
  }
  // Tag Y: 1 app (asserter[0]) + 6 disputes (asserters[1..6])
  await publish(signProfileTagEvent({
    tagSlug: tagY.slug, tagEventId: tagY.event.id, targetPubkey: targetY,
    authorSk: asserters[0].sk, authorPk: asserters[0].pk,
    polarity: 1,
  }));
  for (let i = 1; i < 7; i++) {
    await publish(signProfileTagEvent({
      tagSlug: tagY.slug, tagEventId: tagY.event.id, targetPubkey: targetY,
      authorSk: asserters[i].sk, authorPk: asserters[i].pk,
      polarity: -1,
    }));
  }
  // Tag Z: 3 apps (asserters[0..2]) + 3 disputes (asserters[3..5])
  for (let i = 0; i < 3; i++) {
    await publish(signProfileTagEvent({
      tagSlug: tagZ.slug, tagEventId: tagZ.event.id, targetPubkey: targetZ,
      authorSk: asserters[i].sk, authorPk: asserters[i].pk,
      polarity: 1,
    }));
  }
  for (let i = 3; i < 6; i++) {
    await publish(signProfileTagEvent({
      tagSlug: tagZ.slug, tagEventId: tagZ.event.id, targetPubkey: targetZ,
      authorSk: asserters[i].sk, authorPk: asserters[i].pk,
      polarity: -1,
    }));
  }
  // Tag W: no assertions.

  await sleep(PROPAGATION_MS);

  ctx = {
    slugBase, asserters, tagAuthorPk,
    tagX, tagY, tagZ, tagW,
    targetX, targetY, targetZ,
  };
}

/* ─── Helpers used by tests ─── */

async function getIndex(extraParams = {}) {
  const params = new URLSearchParams({ q: ctx.slugBase, ...extraParams });
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?${params}`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  return json;
}

function indexOfTagEventId(rows, tagEventId) {
  return rows.findIndex((r) => r.tagEventId === tagEventId);
}

/* ─── Tests ─── */

t('row shape includes name, description, authorPubkey, applications, disputes, displayName, picture', async () => {
  const json = await getIndex({ sort: 'endorsed' });
  const row = (json.rows || []).find((r) => r.tagEventId === ctx.tagX.event.id);
  assert(row, 'tag X row missing');
  assert(row.name === `Podcaster ${ctx.slugBase}`, `name mismatch: ${row.name}`);
  assert(row.description?.includes(ctx.slugBase), 'description must round-trip');
  assert(row.authorPubkey === ctx.tagAuthorPk, 'authorPubkey mismatch');
  assert(row.applications === 5, `expected 5 apps, got ${row.applications}`);
  assert(row.disputes === 0, `expected 0 disputes, got ${row.disputes}`);
  // displayName comes from Meili; the author doc was upserted in setup.
  assert(
    row.displayName && row.displayName.includes(ctx.slugBase),
    `expected displayName containing slugBase, got ${JSON.stringify(row.displayName)}`
  );
  assert(
    row.picture && row.picture.includes(ctx.slugBase),
    'picture must round-trip from Meili'
  );
});

t('tag with zero assertions does NOT appear in the index', async () => {
  const json = await getIndex();
  const w = (json.rows || []).find((r) => r.tagEventId === ctx.tagW.event.id);
  assert(!w, `Tag W (no assertions) must not appear in index; found row ${JSON.stringify(w)}`);
});

t('sort=used ranks Y(vol=7) > Z(vol=6) > X(vol=5) inside the fixture', async () => {
  const json = await getIndex({ sort: 'used' });
  const iX = indexOfTagEventId(json.rows, ctx.tagX.event.id);
  const iY = indexOfTagEventId(json.rows, ctx.tagY.event.id);
  const iZ = indexOfTagEventId(json.rows, ctx.tagZ.event.id);
  assert(iX >= 0 && iY >= 0 && iZ >= 0, `all three fixture tags must appear; got X=${iX} Y=${iY} Z=${iZ}`);
  assert(iY < iZ && iZ < iX, `expected Y<Z<X by index; got X=${iX} Y=${iY} Z=${iZ}`);
});

t('sort=endorsed ranks X(apps=5) > Z(apps=3) > Y(apps=1) inside the fixture', async () => {
  const json = await getIndex({ sort: 'endorsed' });
  const iX = indexOfTagEventId(json.rows, ctx.tagX.event.id);
  const iY = indexOfTagEventId(json.rows, ctx.tagY.event.id);
  const iZ = indexOfTagEventId(json.rows, ctx.tagZ.event.id);
  assert(iX < iZ && iZ < iY, `expected X<Z<Y by index; got X=${iX} Y=${iY} Z=${iZ}`);
});

t('sort=divisive ranks Z(min=3) > Y(min=1) > X(min=0) inside the fixture', async () => {
  const json = await getIndex({ sort: 'divisive' });
  const iX = indexOfTagEventId(json.rows, ctx.tagX.event.id);
  const iY = indexOfTagEventId(json.rows, ctx.tagY.event.id);
  const iZ = indexOfTagEventId(json.rows, ctx.tagZ.event.id);
  assert(iZ < iY && iY < iX, `expected Z<Y<X by index; got X=${iX} Y=${iY} Z=${iZ}`);
});

t('q substring filter matches tag name case-insensitively', async () => {
  // Use a name-specific substring that ONLY one fixture tag matches. Lowercase
  // to verify case-insensitivity.
  const q = `podcaster ${ctx.slugBase}`.toLowerCase();
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?q=${encodeURIComponent(q)}`
  );
  assert(status === 200, `status ${status}`);
  const matchedFixture = (json.rows || []).filter((r) =>
    [ctx.tagX.event.id, ctx.tagY.event.id, ctx.tagZ.event.id].includes(r.tagEventId)
  );
  assert(matchedFixture.length === 1, `expected 1 fixture match for "${q}", got ${matchedFixture.length}`);
  assert(matchedFixture[0].tagEventId === ctx.tagX.event.id, 'expected tag X to be the match');
});

t('q substring filter matches tag description case-insensitively', async () => {
  // "DESIGNS" is mixed-case substring of "someone who designs <slugBase>".
  const q = `DESIGNS ${ctx.slugBase}`;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?q=${encodeURIComponent(q)}`
  );
  assert(status === 200, `status ${status}`);
  const matchedFixture = (json.rows || []).filter((r) =>
    [ctx.tagX.event.id, ctx.tagY.event.id, ctx.tagZ.event.id].includes(r.tagEventId)
  );
  assert(matchedFixture.length === 1, `expected 1 fixture match for "${q}", got ${matchedFixture.length}`);
  assert(matchedFixture[0].tagEventId === ctx.tagY.event.id, 'expected tag Y (Designer) to be the match');
});

t('q with no matches returns total=0 and empty rows', async () => {
  const q = `__definitely_no_match_${Math.random().toString(36).slice(2, 10)}__`;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?q=${encodeURIComponent(q)}`
  );
  assert(status === 200, `status ${status}`);
  assert(Array.isArray(json.rows) && json.rows.length === 0, 'rows must be empty');
  assert(json.total === 0, `total must be 0; got ${json.total}`);
});

t('pagination: limit=2 / offset=0 + offset=2 covers the fixture without overlap', async () => {
  const page1 = await getIndex({ sort: 'used', limit: '2', offset: '0' });
  const page2 = await getIndex({ sort: 'used', limit: '2', offset: '2' });

  // Filter both pages to fixture tags. The fixture has 3 asserted tags
  // (X, Y, Z); the q=slugBase filter isolates the fixture so total should
  // be 3 on both pages (consistent).
  const fixtureIds = new Set([ctx.tagX.event.id, ctx.tagY.event.id, ctx.tagZ.event.id]);
  const p1 = (page1.rows || []).filter((r) => fixtureIds.has(r.tagEventId));
  const p2 = (page2.rows || []).filter((r) => fixtureIds.has(r.tagEventId));

  assert(page1.total === 3, `page1.total expected 3, got ${page1.total}`);
  assert(page2.total === 3, `page2.total expected 3, got ${page2.total}`);
  assert(page1.limit === 2 && page2.limit === 2, `limit echo mismatch (${page1.limit}, ${page2.limit})`);
  assert(page1.offset === 0 && page2.offset === 2, `offset echo mismatch (${page1.offset}, ${page2.offset})`);

  // Combine pages; no tag should appear twice.
  const all = [...p1, ...p2];
  const ids = all.map((r) => r.tagEventId);
  const uniq = new Set(ids);
  assert(uniq.size === ids.length, `pages overlap: ${JSON.stringify(ids)}`);

  // Combined should cover the fixture.
  for (const id of fixtureIds) {
    assert(uniq.has(id), `combined pages must include fixture tag ${id.slice(0, 8)}…`);
  }
});

/* ─── POV-WoT filter narrowing (same SKIP pattern as Story 2) ─── */

t('index drops tags whose ONLY assertions come from authors below the POV WoT rank threshold', async () => {
  if (!canMutateSettings()) {
    throw new SkipTest(`${SETTINGS_PATH} not writable from this process; transitively covered by Story-1 and Story-2 WoT tests`);
  }

  // Build a fresh tag with two asserters: one in-WoT, one out-of-WoT, both
  // applying. With the POV configured, the tag should still appear (the
  // in-WoT asserter survives the filter). Then build a second tag with
  // ONLY the out-of-WoT asserter — that one must disappear under the POV.

  const slugBase2 = `s4-wot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagAuthorSk = nakKeyGen();

  async function publishTag(suffix, name) {
    const slug = `${slugBase2}-${suffix}`;
    const ev = nakSignEvent({
      kind: 39999,
      tags: [['d', slug], ['z', TAG_HANDLE]],
      content: JSON.stringify({ tag: { slug, name, description: `wot-test ${slugBase2}` } }),
      privkey: tagAuthorSk,
    });
    return { slug, event: await publish(ev) };
  }

  const inWotSk = nakKeyGen(), inWotPk = nakDerivePubkey(inWotSk);
  const outWotSk = nakKeyGen(), outWotPk = nakDerivePubkey(outWotSk);
  const target = nakDerivePubkey(nakKeyGen());

  // POV configuration.
  const delegatedPubkey = nakDerivePubkey(nakKeyGen());
  const povSuffix = delegatedPubkey.slice(0, 8);
  const minRank = 50;
  const rankField = `wot_rank_${povSuffix}`;

  await meiliUpsertProfile({ id: inWotPk, pubkey: inWotPk, name: `InWot-${slugBase2}`, [rankField]: 80 });
  await meiliUpsertProfile({ id: outWotPk, pubkey: outWotPk, name: `OutWot-${slugBase2}`, [rankField]: 10 });

  const tagMixed = await publishTag('mixed', `Mixed ${slugBase2}`);
  const tagOutOnly = await publishTag('out-only', `OutOnly ${slugBase2}`);

  // Mixed: 1 in-WoT app + 1 out-of-WoT app.
  await publish(signProfileTagEvent({
    tagSlug: tagMixed.slug, tagEventId: tagMixed.event.id, targetPubkey: target,
    authorSk: inWotSk, authorPk: inWotPk, polarity: 1,
  }));
  await publish(signProfileTagEvent({
    tagSlug: tagMixed.slug, tagEventId: tagMixed.event.id, targetPubkey: target,
    authorSk: outWotSk, authorPk: outWotPk, polarity: 1,
  }));
  // Out-only: 1 out-of-WoT app.
  await publish(signProfileTagEvent({
    tagSlug: tagOutOnly.slug, tagEventId: tagOutOnly.event.id, targetPubkey: target,
    authorSk: outWotSk, authorPk: outWotPk, polarity: 1,
  }));
  await sleep(PROPAGATION_MS);

  const original = readSettingsFile();
  try {
    writeSettingsFile({
      ...original,
      grapevine: {
        ...(original.grapevine || {}),
        searchPreferences: {
          ...((original.grapevine || {}).searchPreferences || {}),
          delegatedPubkey,
          filters: { rank: { min: minRank } },
        },
      },
    });

    const { status, json } = await fetchJson(
      `${CONTROL_PANEL_BASE}/api/profile-tags/index?q=${encodeURIComponent(slugBase2)}`
    );
    assert(status === 200, `status ${status}`);
    assert(json?.povSuffix === povSuffix, `expected povSuffix ${povSuffix}, got ${json?.povSuffix}`);

    const mixedRow = (json.rows || []).find((r) => r.tagEventId === tagMixed.event.id);
    const outOnlyRow = (json.rows || []).find((r) => r.tagEventId === tagOutOnly.event.id);

    assert(mixedRow, 'mixed tag must still appear (in-WoT asserter survives)');
    assert(mixedRow.applications === 1, `mixed tag should count only the in-WoT app; got ${mixedRow.applications}`);
    assert(!outOnlyRow, 'out-only tag must NOT appear (only assertion is from below-threshold author)');
  } finally {
    writeSettingsFile(original);
  }
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tag-index publish-flow tests (Story 4) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: tests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: tests.length };
  }

  const ranked = await ensureRankedPool();
  if (!ranked.ok) {
    console.log(`  SKIP  ${ranked.reason}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: tests.length };
  }

  try {
    await setupSuite();
  } catch (err) {
    if (err && err.name === 'SkipTest') {
      console.log(`  SKIP  suite setup: ${err.message}; skipping live publish-flow tests`);
      return { pass: 0, fail: 0, skipped: tests.length };
    }
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
  console.log(`\ntag-index-publish: ${pass} passed, ${fail} failed${perTestSkipped ? `, ${perTestSkipped} skipped` : ''}`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
