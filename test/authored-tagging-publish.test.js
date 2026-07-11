/**
 * Integration tests for Story 5: live publish-flow against the authored-by API.
 * ADR: engineering-team/decisions/0005-authored-tagging-on-profile.md
 *
 * Fixture (one "profile owner" authoring 5 assertions across 2 tags and 4
 * targets; 5 other WoT authors providing peer-noise; 1 below-WoT author
 * providing a contribution that must NOT count; 1 out-of-WoT target whose
 * row must be filtered out):
 *
 *   Owner (in WoT): 5 assertions
 *     Row1: APPLY  TagPopular on TargetA   (createdAt = T+0)   peer apps = 3
 *     Row2: APPLY  TagPopular on TargetB   (createdAt = T+1)   peer apps = 0
 *     Row3: DISPUTE TagPopular on TargetC  (createdAt = T+2)   peer disp = 1
 *     Row4: APPLY  TagPopular on TargetD   (createdAt = T+3)   *** filtered (D out of WoT) ***
 *     Row5: APPLY  TagNiche   on TargetA   (createdAt = T+4)   peer apps = 0
 *
 *   Other WoT authors (5):
 *     authA, authB, authC → APPLY TagPopular on TargetA   (3 peer apps on Row1)
 *     authD, authE        → APPLY TagPopular on TargetE   (peer-noise on a different target)
 *     authA               → DISPUTE TagPopular on TargetC (1 peer dispute on Row3)
 *
 *   Below-WoT author: APPLY TagPopular on TargetF — must NOT contribute to any count.
 *
 *   Targets:
 *     TargetA, TargetB, TargetC, TargetE, TargetF: rank ≥ minRank   → in WoT
 *     TargetD:                                    rank <  minRank   → NOT in WoT
 *
 *   Parent-tag aggregate counts (Reading A — WoT-only authors, all targets):
 *     TagPopular applications = owner(A,B,D) + others(3 on A, 2 on E) = 8
 *     TagPopular disputes     = owner(C) + others(1 on C)             = 2
 *     TagNiche   applications = owner(A)                              = 1
 *     TagNiche   disputes     = 0
 *
 *   After server's TARGET-WoT filter (Row4 dropped because TargetD's rank is
 *   below the threshold), the rows array is exactly 4 rows: Row1, Row2,
 *   Row3, Row5.
 *
 *   Sort orderings within the fixture (deterministic by design):
 *     recent      (createdAt desc):        Row5 > Row3 > Row2 > Row1
 *     applied     (parentApplications):    [Row3, Row2, Row1 tied at 8] > Row5(1); tiebreak createdAt desc
 *                                          → Row3 > Row2 > Row1 > Row5
 *     disputed    (parentDisputes):        [Row3, Row2, Row1 tied at 2] > Row5(0); tiebreak createdAt desc
 *                                          → Row3 > Row2 > Row1 > Row5
 *     most-backed (polarity-matched peer): Row1(apps=3) > Row3(disp=1) > [Row2,Row5 tied at 0];
 *                                          tiebreak createdAt desc → Row5 > Row2
 *                                          → Row1 > Row3 > Row5 > Row2
 *     divisive    (min(parentA, parentD)): TagPopular min=2 vs TagNiche min=0
 *                                          → Row3, Row2, Row1 (tied at 2, createdAt desc) > Row5
 *                                          → Row3 > Row2 > Row1 > Row5
 *
 *   ONLY the `most-backed` order distinguishes Reading B from Reading A; this
 *   is the key correctness test for the new sort + the peer-count machinery.
 *
 * Skips when nak missing, control panel unreachable, or settings.json not
 * writable (POV install is required for the WoT filter to be active).
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
const PROPAGATION_MS = 800;

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
  const slugBase = `s5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const baseTs = Math.floor(Date.now() / 1000) - 60; // anchor in the recent past

  // POV configuration — we install a synthetic POV via settings.json so the
  // server's resolvePov returns a deterministic povSuffix + minRank for the
  // duration of the suite.
  const delegatedPubkey = nakDerivePubkey(nakKeyGen());
  const povSuffix = delegatedPubkey.slice(0, 8);
  const minRank = 50;
  const rankField = `wot_rank_${povSuffix}`;

  // Profile owner — in WoT. This is the pubkey whose authored activity we'll
  // be reading.
  const ownerSk = nakKeyGen();
  const ownerPk = nakDerivePubkey(ownerSk);
  await meiliUpsertProfile({
    id: ownerPk, pubkey: ownerPk, name: `Owner-${slugBase}`,
    display_name: `Owner ${slugBase}`,
    picture: `https://example.test/${slugBase}-owner.png`,
    [rankField]: 80,
  });

  // Other WoT authors (peers) — also in WoT.
  const others = Array.from({ length: 5 }, (_, i) => {
    const sk = nakKeyGen();
    return { sk, pk: nakDerivePubkey(sk), idx: i };
  });
  for (const o of others) {
    await meiliUpsertProfile({
      id: o.pk, pubkey: o.pk, name: `Other${o.idx}-${slugBase}`,
      display_name: `Other${o.idx} ${slugBase}`,
      picture: `https://example.test/${slugBase}-other${o.idx}.png`,
      [rankField]: 70,
    });
  }
  // One below-WoT author — must not contribute to parent OR peer counts.
  const belowSk = nakKeyGen();
  const belowPk = nakDerivePubkey(belowSk);
  await meiliUpsertProfile({
    id: belowPk, pubkey: belowPk, name: `Below-${slugBase}`,
    [rankField]: 10,
  });

  // Targets — A, B, C, E, F in WoT; D below.
  const targetSks = {};
  const targetPks = {};
  for (const name of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const sk = nakKeyGen();
    targetSks[name] = sk;
    targetPks[name] = nakDerivePubkey(sk);
    const rank = (name === 'D') ? 10 : 70;
    await meiliUpsertProfile({
      id: targetPks[name], pubkey: targetPks[name],
      name: `Target${name}-${slugBase}`,
      display_name: `Target${name} ${slugBase}`,
      picture: `https://example.test/${slugBase}-target${name}.png`,
      [rankField]: rank,
    });
  }

  // Wait for Meili to settle the upserts before any read uses them.
  await sleep(1200);

  // Tag-elements — TagPopular and TagNiche. Authored by a fresh key so
  // ownership of the tag concept isn't entangled with the profile owner.
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  async function publishTag(suffix, name) {
    const slug = `s5-${slugBase}-${suffix}`;
    const ev = nakSignEvent({
      kind: 39999,
      tags: [['d', slug], ['z', TAG_HANDLE]],
      content: JSON.stringify({ tag: { slug, name, description: `s5 ${slugBase} ${suffix}` } }),
      privkey: tagAuthorSk,
    });
    return { slug, event: await publish(ev) };
  }
  const tagPopular = await publishTag('popular', `Popular ${slugBase}`);
  const tagNiche   = await publishTag('niche',   `Niche ${slugBase}`);

  // Owner's 5 assertions — explicit createdAt values to make the `recent`
  // sort deterministic. Spread 5 seconds apart so the unix-second timestamps
  // never collide.
  const rows = {};
  rows.Row1 = await publish(signProfileTagEvent({
    tagSlug: tagPopular.slug, tagEventId: tagPopular.event.id,
    targetPubkey: targetPks.A,
    authorSk: ownerSk, authorPk: ownerPk,
    polarity: 1, createdAt: baseTs + 0,
  }));
  rows.Row2 = await publish(signProfileTagEvent({
    tagSlug: tagPopular.slug, tagEventId: tagPopular.event.id,
    targetPubkey: targetPks.B,
    authorSk: ownerSk, authorPk: ownerPk,
    polarity: 1, createdAt: baseTs + 1,
  }));
  rows.Row3 = await publish(signProfileTagEvent({
    tagSlug: tagPopular.slug, tagEventId: tagPopular.event.id,
    targetPubkey: targetPks.C,
    authorSk: ownerSk, authorPk: ownerPk,
    polarity: -1, createdAt: baseTs + 2,
  }));
  // Row4 — owner apply TagPopular on TargetD. Must NOT appear post-filter.
  rows.Row4 = await publish(signProfileTagEvent({
    tagSlug: tagPopular.slug, tagEventId: tagPopular.event.id,
    targetPubkey: targetPks.D,
    authorSk: ownerSk, authorPk: ownerPk,
    polarity: 1, createdAt: baseTs + 3,
  }));
  rows.Row5 = await publish(signProfileTagEvent({
    tagSlug: tagNiche.slug, tagEventId: tagNiche.event.id,
    targetPubkey: targetPks.A,
    authorSk: ownerSk, authorPk: ownerPk,
    polarity: 1, createdAt: baseTs + 4,
  }));

  // Peer noise from in-WoT authors.
  //   others[0..2] APPLY TagPopular on TargetA → 3 peer apps on Row1
  //   others[3..4] APPLY TagPopular on TargetE → peer-noise (no contribution to row peer counts)
  //   others[0]    DISPUTE TagPopular on TargetC → 1 peer dispute on Row3
  for (let i = 0; i < 3; i++) {
    await publish(signProfileTagEvent({
      tagSlug: tagPopular.slug, tagEventId: tagPopular.event.id,
      targetPubkey: targetPks.A,
      authorSk: others[i].sk, authorPk: others[i].pk,
      polarity: 1, createdAt: baseTs + 10 + i,
    }));
  }
  for (let i = 3; i < 5; i++) {
    await publish(signProfileTagEvent({
      tagSlug: tagPopular.slug, tagEventId: tagPopular.event.id,
      targetPubkey: targetPks.E,
      authorSk: others[i].sk, authorPk: others[i].pk,
      polarity: 1, createdAt: baseTs + 20 + i,
    }));
  }
  await publish(signProfileTagEvent({
    tagSlug: tagPopular.slug, tagEventId: tagPopular.event.id,
    targetPubkey: targetPks.C,
    authorSk: others[0].sk, authorPk: others[0].pk,
    polarity: -1, createdAt: baseTs + 30,
  }));

  // Below-WoT noise.
  await publish(signProfileTagEvent({
    tagSlug: tagPopular.slug, tagEventId: tagPopular.event.id,
    targetPubkey: targetPks.F,
    authorSk: belowSk, authorPk: belowPk,
    polarity: 1, createdAt: baseTs + 40,
  }));

  await sleep(PROPAGATION_MS);

  // Install the POV via settings.json so the server's resolvePov returns
  // (povSuffix, minRank). Restore on teardown.
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
    slugBase, baseTs,
    delegatedPubkey, povSuffix, minRank,
    ownerSk, ownerPk,
    others, belowPk,
    targetPks,
    tagPopular, tagNiche,
    rows,
  };
}

function teardownSuite() {
  if (settingsBackup !== null) {
    try { writeSettingsFile(settingsBackup); } catch { /* best-effort */ }
    settingsBackup = null;
  }
}

/* ─── Helpers used by tests ─── */

async function getAuthored(extraParams = {}) {
  const params = new URLSearchParams({ authorPubkey: ctx.ownerPk, ...extraParams });
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/authored-by?${params}`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  return json;
}

function indexOfAssertion(rows, assertionEventId) {
  return rows.findIndex((r) => r.assertionEventId === assertionEventId);
}

function rowFor(json, rowName) {
  return (json.rows || []).find((r) => r.assertionEventId === ctx.rows[rowName].id);
}

/* ─── Tests ─── */

t('response carries the resolved POV (povSuffix + minRank) from settings.json', async () => {
  const json = await getAuthored();
  assert(json.povSuffix === ctx.povSuffix, `povSuffix mismatch: ${json.povSuffix} vs ${ctx.povSuffix}`);
  assert(json.minRank === ctx.minRank, `minRank mismatch: ${json.minRank} vs ${ctx.minRank}`);
});

t('rows array contains exactly the 4 fixture rows whose target is in the WoT (Row4 dropped)', async () => {
  const json = await getAuthored();
  const ourRows = (json.rows || []).filter((r) =>
    [ctx.rows.Row1.id, ctx.rows.Row2.id, ctx.rows.Row3.id, ctx.rows.Row4.id, ctx.rows.Row5.id]
      .includes(r.assertionEventId)
  );
  assert(ourRows.length === 4, `expected 4 fixture rows, got ${ourRows.length}`);
  const has = (n) => ourRows.some((r) => r.assertionEventId === ctx.rows[n].id);
  assert(has('Row1'), 'Row1 missing');
  assert(has('Row2'), 'Row2 missing');
  assert(has('Row3'), 'Row3 missing');
  assert(!has('Row4'), 'Row4 (target out of WoT) must be filtered out');
  assert(has('Row5'), 'Row5 missing');
});

t('row shape includes polarity, createdAt, target metadata, tag metadata, parent counts, peer counts', async () => {
  const json = await getAuthored();
  const r1 = rowFor(json, 'Row1');
  assert(r1, 'Row1 missing');
  assert(r1.polarity === 'applied', `Row1 polarity: ${r1.polarity}`);
  assert(typeof r1.createdAt === 'number', 'createdAt must be numeric');
  assert(r1.targetPubkey === ctx.targetPks.A, `Row1 targetPubkey: ${r1.targetPubkey}`);
  assert(
    r1.targetDisplayName && r1.targetDisplayName.includes(ctx.slugBase),
    `Row1 targetDisplayName must contain slugBase, got ${JSON.stringify(r1.targetDisplayName)}`
  );
  assert(
    r1.targetPicture && r1.targetPicture.includes(ctx.slugBase),
    'Row1 targetPicture must round-trip from Meili'
  );
  assert(r1.tagEventId === ctx.tagPopular.event.id, 'Row1 tagEventId');
  assert(r1.tagSlug === ctx.tagPopular.slug, `Row1 tagSlug: ${r1.tagSlug}`);
  assert(r1.tagName.includes(ctx.slugBase), 'Row1 tagName must round-trip');
  assert(typeof r1.parentApplications === 'number', 'parentApplications numeric');
  assert(typeof r1.parentDisputes === 'number', 'parentDisputes numeric');
  assert(typeof r1.peerApplications === 'number', 'peerApplications numeric');
  assert(typeof r1.peerDisputes === 'number', 'peerDisputes numeric');
});

t('polarity is "disputed" for Row3 (the only owner dispute in the fixture)', async () => {
  const json = await getAuthored();
  const r3 = rowFor(json, 'Row3');
  assert(r3, 'Row3 missing');
  assert(r3.polarity === 'disputed', `Row3 polarity: ${r3.polarity}`);
});

t('parent-tag aggregate counts reflect Reading A (WoT-author applications/disputes for the parent tag)', async () => {
  const json = await getAuthored();
  // All TagPopular rows share the same parent counts.
  const r1 = rowFor(json, 'Row1');
  const r2 = rowFor(json, 'Row2');
  const r3 = rowFor(json, 'Row3');
  const r5 = rowFor(json, 'Row5');

  // TagPopular: owner applies on A,B,D (3) + other WoT applies on A×3, E×2 (5) → 8
  assert(r1.parentApplications === 8, `TagPopular parentApplications: ${r1.parentApplications}`);
  assert(r2.parentApplications === 8, `(B) ${r2.parentApplications}`);
  assert(r3.parentApplications === 8, `(C) ${r3.parentApplications}`);
  // TagPopular: owner dispute on C (1) + other WoT dispute on C (1) → 2
  assert(r1.parentDisputes === 2, `TagPopular parentDisputes: ${r1.parentDisputes}`);
  // TagNiche: only owner uses it. apps=1, disp=0
  assert(r5.parentApplications === 1, `TagNiche parentApplications: ${r5.parentApplications}`);
  assert(r5.parentDisputes === 0, `TagNiche parentDisputes: ${r5.parentDisputes}`);
});

t('parent-tag aggregate counts EXCLUDE below-WoT-rank authors', async () => {
  // The below-WoT author applied TagPopular on TargetF. If parent counts
  // included them, parentApplications would be 9 instead of 8.
  const json = await getAuthored();
  const r1 = rowFor(json, 'Row1');
  assert(r1.parentApplications === 8, `below-WoT author leaked into parentApplications: ${r1.parentApplications}`);
});

t('peerApplications counts in-WoT authors OTHER THAN the profile owner who asserted the same (tag, target) pair', async () => {
  const json = await getAuthored();
  const r1 = rowFor(json, 'Row1');
  // Row1: owner apply TagPopular on A; 3 other WoT authors also apply
  // TagPopular on A; below-WoT author does not contribute.
  assert(r1.peerApplications === 3, `Row1 peerApplications: ${r1.peerApplications}`);
  assert(r1.peerDisputes === 0, `Row1 peerDisputes: ${r1.peerDisputes}`);
});

t('peerDisputes counts in-WoT authors OTHER THAN the profile owner who disputed the same (tag, target) pair', async () => {
  const json = await getAuthored();
  const r3 = rowFor(json, 'Row3');
  // Row3: owner dispute TagPopular on C; 1 other WoT author also disputes.
  assert(r3.peerApplications === 0, `Row3 peerApplications: ${r3.peerApplications}`);
  assert(r3.peerDisputes === 1, `Row3 peerDisputes: ${r3.peerDisputes}`);
});

t('peer counts EXCLUDE the profile owner from their own assertion', async () => {
  // Row5: owner apply TagNiche on A. Nobody else asserted TagNiche on A.
  // If the owner counted themselves, peerApplications would be 1.
  const json = await getAuthored();
  const r5 = rowFor(json, 'Row5');
  assert(r5.peerApplications === 0, `Row5 peerApplications (owner-leak suspect): ${r5.peerApplications}`);
});

t('peer counts are 0 when no other in-WoT author has hit the same (tag, target) pair', async () => {
  // Row2: owner apply TagPopular on B. No other author touched B.
  const json = await getAuthored();
  const r2 = rowFor(json, 'Row2');
  assert(r2.peerApplications === 0, `Row2 peerApplications: ${r2.peerApplications}`);
  assert(r2.peerDisputes === 0, `Row2 peerDisputes: ${r2.peerDisputes}`);
});

/* ─── Sort tests — the heart of the suite ─── */

t('sort=recent orders rows by createdAt desc (Row5 > Row3 > Row2 > Row1)', async () => {
  const json = await getAuthored({ sort: 'recent' });
  const i1 = indexOfAssertion(json.rows, ctx.rows.Row1.id);
  const i2 = indexOfAssertion(json.rows, ctx.rows.Row2.id);
  const i3 = indexOfAssertion(json.rows, ctx.rows.Row3.id);
  const i5 = indexOfAssertion(json.rows, ctx.rows.Row5.id);
  assert(i1 >= 0 && i2 >= 0 && i3 >= 0 && i5 >= 0,
    `all four fixture rows must appear; got 1=${i1} 2=${i2} 3=${i3} 5=${i5}`);
  assert(i5 < i3 && i3 < i2 && i2 < i1,
    `expected Row5<Row3<Row2<Row1 by index; got 1=${i1} 2=${i2} 3=${i3} 5=${i5}`);
});

t('sort=applied orders rows by parent applications desc, ties by createdAt desc (Row3 > Row2 > Row1 > Row5)', async () => {
  const json = await getAuthored({ sort: 'applied' });
  const i1 = indexOfAssertion(json.rows, ctx.rows.Row1.id);
  const i2 = indexOfAssertion(json.rows, ctx.rows.Row2.id);
  const i3 = indexOfAssertion(json.rows, ctx.rows.Row3.id);
  const i5 = indexOfAssertion(json.rows, ctx.rows.Row5.id);
  assert(i3 < i2 && i2 < i1 && i1 < i5,
    `expected Row3<Row2<Row1<Row5; got 1=${i1} 2=${i2} 3=${i3} 5=${i5}`);
});

t('sort=disputed orders rows by parent disputes desc, ties by createdAt desc (Row3 > Row2 > Row1 > Row5)', async () => {
  const json = await getAuthored({ sort: 'disputed' });
  const i1 = indexOfAssertion(json.rows, ctx.rows.Row1.id);
  const i2 = indexOfAssertion(json.rows, ctx.rows.Row2.id);
  const i3 = indexOfAssertion(json.rows, ctx.rows.Row3.id);
  const i5 = indexOfAssertion(json.rows, ctx.rows.Row5.id);
  assert(i3 < i2 && i2 < i1 && i1 < i5,
    `expected Row3<Row2<Row1<Row5; got 1=${i1} 2=${i2} 3=${i3} 5=${i5}`);
});

t('sort=most-backed orders rows by polarity-matched peer count (Row1 > Row3 > Row5 > Row2)', async () => {
  // Row1 (applied, peerApplications=3) > Row3 (disputed, peerDisputes=1)
  //   > Row5 (applied, peerApplications=0, createdAt newer than Row2's)
  //   > Row2 (applied, peerApplications=0, oldest)
  // This is the only sort whose order is NOT equivalent to a Reading-A sort.
  const json = await getAuthored({ sort: 'most-backed' });
  const i1 = indexOfAssertion(json.rows, ctx.rows.Row1.id);
  const i2 = indexOfAssertion(json.rows, ctx.rows.Row2.id);
  const i3 = indexOfAssertion(json.rows, ctx.rows.Row3.id);
  const i5 = indexOfAssertion(json.rows, ctx.rows.Row5.id);
  assert(i1 < i3 && i3 < i5 && i5 < i2,
    `expected Row1<Row3<Row5<Row2; got 1=${i1} 2=${i2} 3=${i3} 5=${i5}`);
});

t('sort=divisive orders rows by min(parentA, parentD) desc, ties by createdAt desc (Row3 > Row2 > Row1 > Row5)', async () => {
  const json = await getAuthored({ sort: 'divisive' });
  const i1 = indexOfAssertion(json.rows, ctx.rows.Row1.id);
  const i2 = indexOfAssertion(json.rows, ctx.rows.Row2.id);
  const i3 = indexOfAssertion(json.rows, ctx.rows.Row3.id);
  const i5 = indexOfAssertion(json.rows, ctx.rows.Row5.id);
  assert(i3 < i2 && i2 < i1 && i1 < i5,
    `expected Row3<Row2<Row1<Row5; got 1=${i1} 2=${i2} 3=${i3} 5=${i5}`);
});

/* ─── Negative / edge cases ─── */

t('an author with no authored assertions returns rows: []', async () => {
  // Fresh, never-used pubkey.
  const lonelyPk = nakDerivePubkey(nakKeyGen());
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/authored-by?authorPubkey=${lonelyPk}`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  assert(Array.isArray(json.rows) && json.rows.length === 0, `expected empty rows, got ${json.rows?.length}`);
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- authored-tagging publish-flow tests (Story 5) ---');

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
  console.log(`\nauthored-tagging-publish: ${pass} passed, ${fail} failed${perTestSkipped ? `, ${perTestSkipped} skipped` : ''}`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
