/**
 * Integration tests for Story 2: live publish-flow against the tag-detail API.
 * ADR: engineering-team/decisions/0002-tag-detail-page-read.md
 *
 * Exercises the parts of the spec that the contract-only suite cannot:
 *   - by-id returns the right tag fields (slug/name/description/author/createdAt)
 *   - by-id surfaces author display_name/picture from Meili when present,
 *     and degrades to author=null when the author has no Meili doc
 *   - profiles-tagged groups assertions across multiple authors and targets
 *   - profiles-tagged honours each `sort` value (applied / disputed / divisive)
 *   - profiles-tagged returns empty rows for a tag with no assertions
 *
 * Approach: ephemeral keypairs via `nak`, signed kind-39999 events POSTed to
 * `/api/strfry/publish` with `signAs: "client"`. Mirrors Story 1's publish
 * suite. Skips when `nak` is missing or the control panel isn't reachable.
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

// Settings file the server reads on every getSettings() call (the meili proxy +
// the new resolvePov helper both consult this on every request). Default path
// matches src/config/settings.js; override via TAPESTRY_SETTINGS_PATH.
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

// Sentinel: throw to mark a single test as skipped (vs pass/fail). The
// runner below treats SkipTest specially in its catch.
class SkipTest extends Error {
  constructor(reason) { super(reason); this.name = 'SkipTest'; }
}

function canMutateSettings() {
  try {
    // The presence-and-writability check has to be on the directory (so we
    // can create the file if missing) and on the file itself when present.
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

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// Suite-level fixture: one tag, multiple authors, three target profiles with
// deliberate (apps,disputes) shapes so every sort order is unambiguous:
//   targetA → 3 apps, 0 disputes  (min=0, total=3)
//   targetB → 2 apps, 2 disputes  (min=2, total=4)  ← most divisive
//   targetC → 0 apps, 1 dispute   (min=0, total=1)
//
// Sort 'applied':   A(3) > B(2) > C(0)
// Sort 'disputed':  B(2) > C(1) > A(0)
// Sort 'divisive':  B(min=2) > A(min=0,total=3) > C(min=0,total=1)
let ctx = null;

async function setupSuite() {
  // Author of the tag itself + 4 other authors used as asserters.
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Tag-element: name carries the slugBase so we can identify it deterministically.
  const tagSlug = `tagdetail-${slugBase}`;
  const tagName = `Tag Detail Test ${slugBase}`;
  const tagDescription = 'Story-2 fixture tag';
  const tagEvent = nakSignEvent({
    kind: 39999,
    tags: [['d', tagSlug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug: tagSlug, name: tagName, description: tagDescription } }),
    privkey: tagAuthorSk,
  });
  const publishedTag = await publish(tagEvent);

  // Make the tag author discoverable via Meili so by-id can return author
  // {displayName, picture}.
  await meiliUpsertProfile({
    id: tagAuthorPk,
    pubkey: tagAuthorPk,
    name: `TagAuthor-${slugBase}`,
    display_name: `TagAuthor ${slugBase}`,
    picture: `https://example.test/${slugBase}.png`,
  });

  // 4 distinct asserter authors — independent from the tag author.
  const asserters = Array.from({ length: 4 }, () => {
    const sk = nakKeyGen();
    return { sk, pk: nakDerivePubkey(sk) };
  });

  // 3 distinct target profiles.
  const targets = Array.from({ length: 3 }, () => {
    const sk = nakKeyGen();
    return { pk: nakDerivePubkey(sk) };
  });
  const [targetA, targetB, targetC] = targets;

  // Seed Meili docs for each target so profiles-tagged can enrich rows.
  for (let i = 0; i < targets.length; i++) {
    await meiliUpsertProfile({
      id: targets[i].pk,
      pubkey: targets[i].pk,
      name: `Target${'ABC'[i]}-${slugBase}`,
      display_name: `Target ${'ABC'[i]} ${slugBase}`,
      picture: `https://example.test/target-${'abc'[i]}.png`,
    });
  }

  // targetA: 3 apps from asserters[0..2]
  for (let i = 0; i < 3; i++) {
    const ev = signProfileTagEvent({
      tagSlug, tagEventId: publishedTag.id,
      targetPubkey: targetA.pk,
      authorSk: asserters[i].sk, authorPk: asserters[i].pk,
      polarity: 1,
    });
    await publish(ev);
  }
  // targetB: 2 apps (asserters 0,1), 2 disputes (asserters 2,3)
  for (let i = 0; i < 2; i++) {
    await publish(signProfileTagEvent({
      tagSlug, tagEventId: publishedTag.id,
      targetPubkey: targetB.pk,
      authorSk: asserters[i].sk, authorPk: asserters[i].pk,
      polarity: 1,
    }));
  }
  for (let i = 2; i < 4; i++) {
    await publish(signProfileTagEvent({
      tagSlug, tagEventId: publishedTag.id,
      targetPubkey: targetB.pk,
      authorSk: asserters[i].sk, authorPk: asserters[i].pk,
      polarity: -1,
    }));
  }
  // targetC: 1 dispute (asserter 0)
  await publish(signProfileTagEvent({
    tagSlug, tagEventId: publishedTag.id,
    targetPubkey: targetC.pk,
    authorSk: asserters[0].sk, authorPk: asserters[0].pk,
    polarity: -1,
  }));

  // Also publish a separate empty-state tag (zero assertions) for one test.
  const emptyTagSlug = `empty-${slugBase}`;
  const emptyTagEvent = nakSignEvent({
    kind: 39999,
    tags: [['d', emptyTagSlug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug: emptyTagSlug, name: `Empty ${slugBase}`, description: '' } }),
    privkey: tagAuthorSk,
  });
  const publishedEmptyTag = await publish(emptyTagEvent);

  // Author with NO Meili doc — used to verify by-id degrades to author=null.
  const ghostAuthorSk = nakKeyGen();
  const ghostAuthorPk = nakDerivePubkey(ghostAuthorSk);
  const ghostTagSlug = `ghost-${slugBase}`;
  const ghostTagEvent = nakSignEvent({
    kind: 39999,
    tags: [['d', ghostTagSlug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug: ghostTagSlug, name: `Ghost ${slugBase}`, description: 'no meili doc' } }),
    privkey: ghostAuthorSk,
  });
  const publishedGhostTag = await publish(ghostTagEvent);

  await sleep(PROPAGATION_MS);

  ctx = {
    tagAuthorPk,
    publishedTag,
    publishedEmptyTag,
    publishedGhostTag,
    ghostAuthorPk,
    tagSlug, tagName, tagDescription,
    targetA, targetB, targetC,
    asserters,
    slugBase,
  };
}

/* ─── by-id ─── */

t('by-id returns the published tag with slug, name, description, authorPubkey, createdAt', async () => {
  const { publishedTag, tagSlug, tagName, tagDescription, tagAuthorPk } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${publishedTag.id}`
  );
  assert(status === 200, `by-id status ${status}`);
  assert(json?.success === true, 'by-id success');
  const tag = json.tag;
  assert(tag, 'response.tag missing');
  assert(tag.eventId === publishedTag.id, `tag.eventId mismatch (${tag.eventId} vs ${publishedTag.id})`);
  assert(tag.slug === tagSlug, `tag.slug mismatch (${tag.slug} vs ${tagSlug})`);
  assert(tag.name === tagName, `tag.name mismatch (${tag.name} vs ${tagName})`);
  assert(tag.description === tagDescription, `tag.description mismatch`);
  assert(tag.authorPubkey === tagAuthorPk, `tag.authorPubkey mismatch`);
  assert(typeof tag.createdAt === 'number' && tag.createdAt > 0, 'tag.createdAt must be a unix-seconds number');
});

t('by-id surfaces author display_name and picture from Meili when present', async () => {
  const { publishedTag, slugBase } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${publishedTag.id}`
  );
  assert(status === 200, `by-id status ${status}`);
  assert(json?.author, 'author block must be present when Meili has the doc');
  // Endpoint may project the field as displayName (camelCase per ADR) or
  // pass through display_name. Accept either, but require *some* name.
  const name = json.author.displayName || json.author.display_name || json.author.name;
  assert(name && name.includes(slugBase),
    `author name should include slugBase (${slugBase}); got ${JSON.stringify(json.author)}`);
  assert(json.author.picture && json.author.picture.includes(slugBase), 'author picture must round-trip');
});

t('by-id returns author=null when the tag author has no Meili doc', async () => {
  const { publishedGhostTag } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${publishedGhostTag.id}`
  );
  assert(status === 200, `by-id status ${status}`);
  assert(json?.success === true, 'success');
  assert(json.author === null, `author must be null when no Meili doc; got ${JSON.stringify(json.author)}`);
});

/* ─── profiles-tagged: grouping + enrichment ─── */

t('profiles-tagged groups by target with correct application and dispute counts', async () => {
  const { publishedTag, targetA, targetB, targetC } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedTag.id}`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  const byPk = new Map((json.rows || []).map((r) => [r.pubkey, r]));
  const a = byPk.get(targetA.pk);
  const b = byPk.get(targetB.pk);
  const c = byPk.get(targetC.pk);
  assert(a, 'targetA row missing');
  assert(b, 'targetB row missing');
  assert(c, 'targetC row missing');
  assert(a.applications === 3 && a.disputes === 0, `targetA expected 3/0 got ${a.applications}/${a.disputes}`);
  assert(b.applications === 2 && b.disputes === 2, `targetB expected 2/2 got ${b.applications}/${b.disputes}`);
  assert(c.applications === 0 && c.disputes === 1, `targetC expected 0/1 got ${c.applications}/${c.disputes}`);
});

t('profiles-tagged enriches each row with displayName and picture when Meili has the doc', async () => {
  const { publishedTag, targetA, slugBase } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedTag.id}`
  );
  assert(status === 200, `status ${status}`);
  const row = (json.rows || []).find((r) => r.pubkey === targetA.pk);
  assert(row, 'targetA row missing for enrichment check');
  const name = row.displayName || row.display_name || row.name;
  assert(name && name.includes(slugBase), `targetA enrichment name missing slugBase; got ${JSON.stringify(row)}`);
  assert(row.picture && row.picture.includes('target-a'), 'targetA picture must round-trip from Meili');
});

t('profiles-tagged returns empty rows for a tag with zero assertions', async () => {
  const { publishedEmptyTag } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedEmptyTag.id}`
  );
  assert(status === 200, `status ${status}`);
  assert(json?.success === true, 'success');
  assert(Array.isArray(json.rows) && json.rows.length === 0, 'rows must be empty');
});

/* ─── profiles-tagged: server-side sort ─── */

function indexOfPk(rows, pk) { return rows.findIndex((r) => r.pubkey === pk); }

t('sort=applied orders rows by applications desc (A=3 → B=2 → C=0)', async () => {
  const { publishedTag, targetA, targetB, targetC } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedTag.id}&sort=applied`
  );
  assert(status === 200, `status ${status}`);
  const rows = json.rows || [];
  const iA = indexOfPk(rows, targetA.pk);
  const iB = indexOfPk(rows, targetB.pk);
  const iC = indexOfPk(rows, targetC.pk);
  assert(iA >= 0 && iB >= 0 && iC >= 0, 'all three targets must appear');
  assert(iA < iB && iB < iC, `expected A<B<C by index, got A=${iA} B=${iB} C=${iC}`);
});

t('sort=disputed orders rows by disputes desc (B=2 → C=1 → A=0)', async () => {
  const { publishedTag, targetA, targetB, targetC } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedTag.id}&sort=disputed`
  );
  assert(status === 200, `status ${status}`);
  const rows = json.rows || [];
  const iA = indexOfPk(rows, targetA.pk);
  const iB = indexOfPk(rows, targetB.pk);
  const iC = indexOfPk(rows, targetC.pk);
  assert(iB < iC && iC < iA, `expected B<C<A by index, got A=${iA} B=${iB} C=${iC}`);
});

t('sort=divisive ranks B (min=2) above A (min=0,total=3) above C (min=0,total=1)', async () => {
  const { publishedTag, targetA, targetB, targetC } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedTag.id}&sort=divisive`
  );
  assert(status === 200, `status ${status}`);
  const rows = json.rows || [];
  const iA = indexOfPk(rows, targetA.pk);
  const iB = indexOfPk(rows, targetB.pk);
  const iC = indexOfPk(rows, targetC.pk);
  assert(iB < iA && iA < iC,
    `expected B<A<C (B is most divisive; A has higher total volume than C among the min=0 group); got A=${iA} B=${iB} C=${iC}`);
});

/* ─── profiles-tagged: POV WoT-filter narrows the result set ─── */

// Verifies the CLAUDE.md POV-first invariant: assertions from authors below
// the active POV's `wot_rank_<suffix>` threshold must NOT be counted.
//
// Mutates the on-disk house-prefs to install a deterministic POV with
// minRank=50, sets four asserter Meili docs with deliberate wot_rank_<suffix>
// values (two above, two below), and asserts that profiles-tagged returns
// exactly two applications — not four. Skips when settings.json isn't
// writable from the test process (e.g., on a box that doesn't share FS with
// the server). When skipped, the WoT filter is still transitively covered by
// Story 1's `typeahead search returns a profile tagged by a third-party
// author` test, which exercises the same shared resolvePov helper through
// the search proxy.
t('profiles-tagged drops assertions whose authors are below the POV WoT rank threshold', async () => {
  if (!canMutateSettings()) {
    throw new SkipTest(`${SETTINGS_PATH} not writable from this process; covered transitively by Story-1 search-side WoT test`);
  }
  const { tagSlug, publishedTag, slugBase } = ctx;

  // Fresh asserters and target so this test owns its own assertion graph
  // entirely — independent of the suite-level fixture's targets/asserters,
  // so it doesn't perturb the sort/grouping tests.
  const inWotAuthors = Array.from({ length: 2 }, () => {
    const sk = nakKeyGen();
    return { sk, pk: nakDerivePubkey(sk) };
  });
  const outOfWotAuthors = Array.from({ length: 2 }, () => {
    const sk = nakKeyGen();
    return { sk, pk: nakDerivePubkey(sk) };
  });
  const targetPk = nakDerivePubkey(nakKeyGen());

  // The POV's delegated pubkey — its first 8 chars are the suffix the server
  // reads for wot_rank_<suffix>. We don't need the matching privkey, just a
  // valid 64-char hex.
  const delegatedPubkey = nakDerivePubkey(nakKeyGen());
  const povSuffix = delegatedPubkey.slice(0, 8);
  const minRank = 50;
  const rankField = `wot_rank_${povSuffix}`;

  // Seed Meili docs. Asserters above threshold; out-of-WoT below.
  for (let i = 0; i < inWotAuthors.length; i++) {
    await meiliUpsertProfile({
      id: inWotAuthors[i].pk,
      pubkey: inWotAuthors[i].pk,
      name: `InWot${i}-${slugBase}`,
      [rankField]: 80,
    });
  }
  for (let i = 0; i < outOfWotAuthors.length; i++) {
    await meiliUpsertProfile({
      id: outOfWotAuthors[i].pk,
      pubkey: outOfWotAuthors[i].pk,
      name: `OutWot${i}-${slugBase}`,
      [rankField]: 10,
    });
  }
  // Target also seeded so enrichment doesn't mask a missing-row bug.
  await meiliUpsertProfile({
    id: targetPk,
    pubkey: targetPk,
    name: `WotTarget-${slugBase}`,
  });

  // Each asserter (in and out) applies the tag (positive polarity) to the
  // shared target. Without the POV filter, all 4 would count.
  for (const a of [...inWotAuthors, ...outOfWotAuthors]) {
    await publish(signProfileTagEvent({
      tagSlug, tagEventId: publishedTag.id,
      targetPubkey: targetPk,
      authorSk: a.sk, authorPk: a.pk,
      polarity: 1,
    }));
  }
  await sleep(PROPAGATION_MS);

  const original = readSettingsFile();
  try {
    // Install a house POV with a min-rank filter. The server reads this on
    // every request via getSettings(); no restart required.
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
      `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${publishedTag.id}`
    );
    assert(status === 200, `status ${status}`);
    assert(json?.povSuffix === povSuffix,
      `expected povSuffix ${povSuffix}; got ${json?.povSuffix}`);

    const row = (json.rows || []).find((r) => r.pubkey === targetPk);
    assert(row, 'target row must appear (in-WoT asserters supplied positive applications)');
    assert(row.applications === 2,
      `with house POV (minRank=${minRank}), expected 2 in-WoT applications, got ${row.applications}`);
    assert(row.disputes === 0, `expected 0 disputes, got ${row.disputes}`);
  } finally {
    // Always restore. Failure to restore would leave the dev box in a weird
    // state for the next request.
    writeSettingsFile(original);
  }
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tag-detail publish-flow tests (Story 2) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: tests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: tests.length };
  }

  try {
    await setupSuite();
  } catch (err) {
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
  console.log(`\ntag-detail-publish: ${pass} passed, ${fail} failed${perTestSkipped ? `, ${perTestSkipped} skipped` : ''}`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
