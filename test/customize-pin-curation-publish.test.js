/**
 * Integration tests for Story 12: customize pin curation method.
 * ADR: engineering-team/decisions/0011-customize-pin-curation.md
 *
 * Tests the server-observable wire-shape effects of Story 12's
 * customizer:
 *   - AC-2: a pin event with cutoff=1 (instead of the Story-10 default 2)
 *     produces a TL whose ['cutoff','1'] event-tag matches.
 *   - AC-4: editing a pin (re-publish kind-39999 with same d-tag and new
 *     curation values) lands at the same TL d-tag with the new values
 *     after refresh.
 *   - AC-7 (POV-required): includeScoreInTL=true + resolvable POV emits
 *     p tags carrying ['p', pubkey, '', '<score>'] triples.
 *   - AC-8: includeScoreInTL=true + no resolvable POV still publishes the
 *     TL — members appear without scores; no error.
 *
 * Approach: ephemeral keypairs via `nak`, signed kind-39999 + assertion
 * events POSTed to /api/strfry/publish, then the cron-side
 * /api/trusted-list/refresh-all-pinned-tags endpoint triggers TL
 * generation. Mirrors test/tl-publication-from-pins-publish.test.js.
 *
 * Skips:
 *   - whole suite when `nak` is missing or control panel unreachable
 *   - AC-7 (POV-required) when settings.json isn't writable from this
 *     process (same skip path as the prior POV-required suites).
 */

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// ADR tag-stack-merge-hardening/0001: /api/trusted-list/refresh-all-pinned-tags
// is loopback-only — it can only be triggered from INSIDE the container, the
// way the cron (refreshPinnedTagTLs.sh) does. A host HTTP call now correctly
// 403s, so these live-integration suites drive it via docker exec.
const { execSync: _execSync } = require('child_process');
const _TAPESTRY_CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
async function refreshAllViaLoopback() {
  try {
    const out = _execSync(
      `docker exec ${_TAPESTRY_CONTAINER} curl -s -X POST http://127.0.0.1:7778/api/trusted-list/refresh-all-pinned-tags`,
      { encoding: 'utf8', timeout: 300000 }
    );
    let json = null; try { json = JSON.parse(out); } catch (_e) {}
    return { status: json && json.success ? 200 : 500, json };
  } catch (e) {
    return { status: 0, json: null, error: e.message };
  }
}
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_HANDLE = `39998:${TA_PUBKEY}:tag`;
const NOSTR_USER_TAG_HANDLE = `39998:${TA_PUBKEY}:nostr-user-tag`;
const TAG_PINNING_HANDLE = `39998:${TA_PUBKEY}:tag-pinning`;
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

function nakKeyGen() { return execSync('nak key generate').toString().trim(); }
function nakDerivePubkey(privkey) { return execSync(`nak key public ${privkey}`).toString().trim(); }

function nakSignEvent({ kind, tags = [], content = '', privkey }) {
  // argv-style to avoid bash brace-expansion on JSON tag values.
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

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

async function postJson(url, body) {
  return fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

async function strfryScan(filter) {
  const safe = JSON.stringify(filter).replace(/"/g, '\\"');
  const out = execSync(
    `docker exec tapestry sh -c 'strfry scan "${safe}" 2>/dev/null'`,
    { maxBuffer: 20 * 1024 * 1024 }
  ).toString();
  const events = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch {}
  }
  return events;
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

/* ── Fixture builders (shared with Story-11 patterns) ──────── */

async function publishTagEvent({ slug, name, description, authorSk }) {
  return await publish(nakSignEvent({
    kind: 39999,
    tags: [['d', slug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug, name, description: description || '' } }),
    privkey: authorSk,
  }));
}

function buildPinEvent({ tag, viewerSk, viewerPk, curationMethod }) {
  const dTag = `tag-pin-${tag.slug}-${tag.authorPubkey.slice(0, 8)}-${viewerPk.slice(0, 8)}`;
  return nakSignEvent({
    kind: 39999,
    tags: [
      ['d', dTag],
      ['e', tag.eventId],
      ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
      ['z', TAG_PINNING_HANDLE],
      ['curation-method', JSON.stringify(curationMethod)],
    ],
    content: JSON.stringify({ tagPinning: { tagEventId: tag.eventId, curationMethod } }),
    privkey: viewerSk,
  });
}

function buildProfileTagAssertion({ tagSlug, tagEventId, targetPubkey, authorSk, authorPk, polarity }) {
  const dTag = `profile-tag-${tagSlug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  return nakSignEvent({
    kind: 39999,
    tags: [
      ['d', dTag],
      ['p', targetPubkey],
      ['e', tagEventId],
      ['z', NOSTR_USER_TAG_HANDLE],
      ['polarity', String(polarity)],
    ],
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: targetPubkey, tagEventId } }),
    privkey: authorSk,
  });
}

function expectedTLDTag({ observerPk, tagAuthorPk, tagSlug }) {
  return `tl-pin-${observerPk.slice(0, 8)}-${tagAuthorPk.slice(0, 8)}-${tagSlug}`;
}

async function findLatestTL(dTag) {
  const events = await strfryScan({ kinds: [30392], authors: [TA_PUBKEY], '#d': [dTag] });
  if (events.length === 0) return null;
  events.sort((a, b) => b.created_at - a.created_at);
  return events[0];
}

/* ── Phase 1: basic (no POV required) ──────────────────────── */
/*
 * Fixture: one tag, one viewer who pins it with custom curation values.
 * One assertion author publishes a single +1 for one target — this is
 * intentionally short of the Story-10 default cutoff=2 but matches the
 * Story-12 cutoff=1 customization. AC-2 verifies the wire effect.
 */

let basicCtx = null;
const basicTests = [];
function tBasic(name, fn) { basicTests.push([name, fn]); }

async function setupBasicSuite() {
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s12b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `cpc-tag-${slugBase}`;
  const publishedTag = await publishTagEvent({
    slug: tagSlug,
    name: `CPC Tag ${slugBase}`,
    description: 'Story 12 basic-suite test tag',
    authorSk: tagAuthorSk,
  });
  const tag = { eventId: publishedTag.id, slug: tagSlug, authorPubkey: tagAuthorPk, name: `CPC Tag ${slugBase}` };

  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);

  const authorA = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const targetPk = nakDerivePubkey(nakKeyGen());

  // Single endorsement. With Story-10 default cutoff=2 the target would NOT
  // make the TL; with the customized cutoff=1 it should.
  await publish(buildProfileTagAssertion({
    tagSlug: tag.slug, tagEventId: tag.eventId, targetPubkey: targetPk,
    authorSk: authorA.sk, authorPk: authorA.pk, polarity: 1,
  }));

  // Pin with custom curation: cutoff=1.
  const pinEvent = buildPinEvent({
    tag, viewerSk, viewerPk,
    curationMethod: { observer: viewerPk, method: 'nip85:rank', cutoff: 1, includeScoreInTL: false },
  });
  const publishedPin = await publish(pinEvent);

  await sleep(PROPAGATION_MS);

  basicCtx = {
    tag, viewerSk, viewerPk, authorA, targetPk,
    pinEventId: publishedPin.id, slugBase,
  };
}

/* AC-2 — customized curation lands in strfry + TL reflects it. */
tBasic('pin event with cutoff=1 produces a TL whose [cutoff,1] event-tag matches the pin\'s curation', async () => {
  const { tag, viewerPk } = basicCtx;
  const { status } = await refreshAllViaLoopback();
  assert(status === 200, `refresh-all-pinned-tags status ${status}`);
  await sleep(PROPAGATION_MS);

  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, `expected a TL for the customized pin at d-tag ${dTag}; got none`);
  const cutoffTag = (tl.tags || []).find((t) => t[0] === 'cutoff');
  assert(cutoffTag,
    `TL must carry a cutoff tag; got tags=${JSON.stringify(tl.tags?.map(t => t[0]))}`);
  assert(cutoffTag[1] === '1',
    `cutoff tag must reflect the pin's cutoff=1; got ${JSON.stringify(cutoffTag)}`);

  // Bonus: with cutoff=1, the single-endorsement target SHOULD appear as a
  // member. With the Story-10 default cutoff=2 it would not.
  const memberPubkeys = (tl.tags || []).filter((t) => t[0] === 'p').map((t) => t[1]);
  assert(memberPubkeys.includes(basicCtx.targetPk),
    `target with 1 endorsement MUST appear when cutoff=1; got members=${JSON.stringify(memberPubkeys)}`);
});

/* AC-4 + AC-5 — edit-in-place: re-publish the same d-tag with new cutoff,
 * then re-trigger refresh, then verify the latest TL reflects the new cutoff. */
tBasic('editing a pin (re-publish kind-39999 with same d-tag, new cutoff) lands at the same TL d-tag with the new values after refresh', async () => {
  const { tag, viewerSk, viewerPk } = basicCtx;

  // Edit: re-publish the pin with cutoff=5 (target with 1 endorsement should
  // now be excluded).
  await sleep(1100); // ensure created_at advances
  const newPin = buildPinEvent({
    tag, viewerSk, viewerPk,
    curationMethod: { observer: viewerPk, method: 'nip85:rank', cutoff: 5, includeScoreInTL: false },
  });
  await publish(newPin);
  await sleep(PROPAGATION_MS);

  // Trigger refresh again.
  await sleep(1100); // ensure TL created_at advances past prior TL
  const { status } = await refreshAllViaLoopback();
  assert(status === 200, `refresh-all-pinned-tags status ${status}`);
  await sleep(PROPAGATION_MS);

  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, 'TL must exist after the edit refresh');
  const cutoffTag = (tl.tags || []).find((t) => t[0] === 'cutoff');
  assert(cutoffTag && cutoffTag[1] === '5',
    `after edit, cutoff tag must reflect the new value cutoff=5; got ${JSON.stringify(cutoffTag)}`);

  // The previously-qualifying target should now be excluded.
  const memberPubkeys = (tl.tags || []).filter((t) => t[0] === 'p').map((t) => t[1]);
  assert(!memberPubkeys.includes(basicCtx.targetPk),
    `target with 1 endorsement MUST be excluded when cutoff=5; got members=${JSON.stringify(memberPubkeys)}`);
});

/* AC-8 — includeScoreInTL=true with no resolvable POV still publishes the TL.
 * No setup of a POV here — the basic-suite intentionally has none. */
tBasic('pin with includeScoreInTL=true + no resolvable POV still publishes a kind-30392 with bare p tags (no score) and no error', async () => {
  const { tag, viewerSk, viewerPk } = basicCtx;

  // Re-publish (edit) the pin again with includeScoreInTL=true + cutoff=1 so
  // the previously-qualifying target reappears, this time exercising the
  // include-score path.
  await sleep(1100);
  const newPin = buildPinEvent({
    tag, viewerSk, viewerPk,
    curationMethod: { observer: viewerPk, method: 'nip85:rank', cutoff: 1, includeScoreInTL: true },
  });
  await publish(newPin);
  await sleep(PROPAGATION_MS);

  await sleep(1100);
  const { status } = await refreshAllViaLoopback();
  assert(status === 200, `refresh-all-pinned-tags status ${status}`);
  await sleep(PROPAGATION_MS);

  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, 'TL must exist after the includeScoreInTL=true edit (no POV configured = degrade silently)');

  // Members are present (cutoff=1 again).
  const pTags = (tl.tags || []).filter((t) => t[0] === 'p');
  assert(pTags.length >= 1,
    `at least one member should appear (cutoff=1, single endorsement); got pTags=${JSON.stringify(pTags)}`);

  // The p tags must NOT carry score (no POV resolvable → no score).
  for (const pt of pTags) {
    // Bare p tag is ['p', pubkey]. Score-bearing is ['p', pubkey, '', '<num>'].
    // When POV is unresolvable, the score slot must be absent (length 2)
    // OR (defensive) the optional third element must NOT be a numeric score.
    const looksLikeScore = pt.length >= 4 && /^-?\d+(\.\d+)?$/.test(pt[3] || '');
    assert(!looksLikeScore,
      `p tag must not carry a score when POV is unresolvable; got ${JSON.stringify(pt)}`);
  }
});

/* ── Phase 2: POV-required ── AC-7 disputes function + score emission ── */
/*
 * Fixture: one tag, a configured POV (delegated pubkey + minRank), one
 * in-WoT assertion author, one target with a wot_rank score, one Pin
 * event with includeScoreInTL=true. The generator MUST emit p tags
 * carrying [pubkey, '', '<score>'].
 */

let povCtx = null;
let savedSettings = null;
const povTests = [];
function tPov(name, fn) { povTests.push([name, fn]); }

async function setupPovSuite() {
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s12p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `cpc-pov-${slugBase}`;
  const publishedTag = await publishTagEvent({
    slug: tagSlug, name: `CPC POV ${slugBase}`, description: 'AC-7 score-emission test', authorSk: tagAuthorSk,
  });
  const tag = { eventId: publishedTag.id, slug: tagSlug, authorPubkey: tagAuthorPk, name: `CPC POV ${slugBase}` };

  const delegatedPubkey = nakDerivePubkey(nakKeyGen());
  const povSuffix = delegatedPubkey.slice(0, 8);
  const minRank = 50;
  const rankField = `wot_rank_${povSuffix}`;

  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);

  const inWotA = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const targetPk = nakDerivePubkey(nakKeyGen());

  await meiliUpsertProfile({ id: inWotA.pk, pubkey: inWotA.pk, name: `inWotA-${slugBase}`, [rankField]: 80 });
  // Target has a wot_rank under this POV — the value the generator must
  // emit into the p tag's score slot.
  await meiliUpsertProfile({ id: targetPk, pubkey: targetPk, name: `target-${slugBase}`, [rankField]: 42 });
  await meiliUpsertProfile({ id: viewerPk, pubkey: viewerPk, name: `viewer-${slugBase}`, [rankField]: 80 });

  // Single in-WoT endorsement → with cutoff=1, target qualifies.
  await publish(buildProfileTagAssertion({
    tagSlug, tagEventId: tag.eventId, targetPubkey: targetPk,
    authorSk: inWotA.sk, authorPk: inWotA.pk, polarity: 1,
  }));

  const pinEvent = buildPinEvent({
    tag, viewerSk, viewerPk,
    curationMethod: { observer: viewerPk, method: 'nip85:rank', cutoff: 1, includeScoreInTL: true },
  });
  const publishedPin = await publish(pinEvent);

  await sleep(PROPAGATION_MS);

  // Configure house POV so resolvePov returns povSuffix + minRank for this
  // observer.
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
    tag, viewerSk, viewerPk,
    pinEventId: publishedPin.id,
    delegatedPubkey, povSuffix, minRank,
    targetPk, slugBase,
  };
}

async function teardownPovSuite() {
  if (savedSettings !== null) {
    try { writeSettingsFile(savedSettings); } catch {}
  }
}

tPov('AC-7: pin with includeScoreInTL=true + resolvable POV produces a kind-30392 whose p tags carry [pubkey, \'\', <score>] triples', async () => {
  const { tag, viewerPk, targetPk } = povCtx;
  const { status } = await refreshAllViaLoopback();
  assert(status === 200, `refresh-all-pinned-tags status ${status}`);
  await sleep(PROPAGATION_MS);

  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, 'TL must exist for the POV-required pin');

  const pTags = (tl.tags || []).filter((t) => t[0] === 'p');
  const targetTag = pTags.find((t) => t[1] === targetPk);
  assert(targetTag,
    `target with score MUST appear in the TL members; got pTags=${JSON.stringify(pTags)}`);
  // Documented score-bearing wire shape: ['p', pubkey, '', '<score>'].
  // The third element is the relay slot (empty), the fourth is the score.
  assert(targetTag.length >= 4,
    `target p tag must include the score slot (4 elements); got ${JSON.stringify(targetTag)}`);
  assert(targetTag[2] === '' || typeof targetTag[2] === 'string',
    `p tag's relay slot (index 2) must be an empty string or relay url; got ${JSON.stringify(targetTag[2])}`);
  assert(/^-?\d+(\.\d+)?$/.test(targetTag[3] || ''),
    `p tag's score slot (index 3) must be a numeric string; got ${JSON.stringify(targetTag[3])}`);
  assert(targetTag[3] === '42',
    `score must equal the wot_rank value seeded in Meili (42); got ${JSON.stringify(targetTag[3])}`);
});

/* ── Run ── */

async function run() {
  console.log('\n--- customize-pin-curation publish-flow tests (Story 12) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: basicTests.length + povTests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
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
    console.log(`  SKIP  ${SETTINGS_PATH} not writable from this process; AC-7 score-emission test runs in environments where the test process and the server share a filesystem`);
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

  console.log(`\ncustomize-pin-curation-publish: ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
