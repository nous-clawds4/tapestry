/**
 * Integration tests for Story 1: live publish flow.
 *
 * Exercises the parts of the spec that the contract-only suite cannot:
 *   - Polarity bucketing on real events (apply / dispute / omitted = positive)
 *   - Replaceable d-tag overwrite (toggle apply ↔ dispute)
 *   - Kind-5 deletion -> entry disappears
 *   - available-tags reflects a published tag-element
 *
 * Approach: ephemeral keypairs via `nak`, signed kind-39999 events POSTed to
 * the existing `/api/strfry/publish` endpoint with `signAs: "client"`. No
 * new dependencies, no fixtures — fresh keys per test where independence
 * matters.
 *
 * Skips when prerequisites are missing (nak not on PATH, control-panel
 * unreachable). The contract suite still runs in those environments.
 */

const { execSync } = require('child_process');
const { ensureRankedPool, makeAuthorDealer, meiliUpsertAndWait, fetchPovFilter } = require('./helpers/livePov');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

// Sentinel: throw to mark a single test as skipped (vs pass/fail) — e.g. when
// a Meili doc this test depends on cannot be indexed within the wait budget.
const SKIP = Symbol('skip');
function skipTest(reason) {
  const e = new Error(reason);
  e[SKIP] = true;
  return e;
}
const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const NOSTR_USER_TAG_HANDLE = `39998:${TA_PUBKEY}:nostr-user-tag`;
const TAG_HANDLE = `39998:${TA_PUBKEY}:tag`;
const PROPAGATION_MS = 600; // strfry import → query settle time

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function nakAvailable() {
  try {
    execSync('command -v nak', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

function nakKeyGen() {
  return execSync('nak key generate').toString().trim();
}

function nakDerivePubkey(privkey) {
  return execSync(`nak key public ${privkey}`).toString().trim();
}

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
  if (!r.ok || !j.success) {
    throw new Error(`publish failed: status=${r.status} body=${JSON.stringify(j)}`);
  }
  return j.event;
}

async function fetchTagsForProfile(pubkey) {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${pubkey}`);
  const json = await r.json().catch(() => null);
  if (r.status !== 200) {
    throw new Error(`tags-for-profile?pubkey=${pubkey.slice(0, 8)}… returned status ${r.status}`);
  }
  if (!json || !json.success) {
    throw new Error(`tags-for-profile returned non-success body: ${JSON.stringify(json)}`);
  }
  return json;
}

async function fetchAvailableTags() {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/profile-tags/available-tags`);
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

async function fetchMeiliSearch(q) {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=${encodeURIComponent(q)}`);
  const json = await r.json().catch(() => null);
  if (!r.ok || !json || json.success === false) {
    throw new Error(`meili search returned status=${r.status} body=${JSON.stringify(json)}`);
  }
  return json;
}

async function meiliUpsertProfile(doc) {
  // Upsert a single profile document and WAIT for Meili to index it — a fixed
  // settle sleep is not enough: under stream-consumer ETL load the task queue
  // has been observed taking minutes per task. On timeout, skip the test
  // rather than fail (environmental, not a code defect).
  const res = await meiliUpsertAndWait(doc, { timeoutMs: 90000 });
  if (!res.ok) throw skipTest(res.reason);
}

function signProfileTagEvent({ tagSlug, tagEventId, targetPubkey, authorSk, authorPk, polarity }) {
  const dTag = `profile-tag-${tagSlug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  const tags = [
    ['d', dTag],
    ['p', targetPubkey],
    ['e', tagEventId],
    ['z', NOSTR_USER_TAG_HANDLE],
  ];
  if (polarity !== undefined && polarity !== null) {
    tags.push(['polarity', String(polarity)]);
  }
  const content = JSON.stringify({
    nostrUserTag: { taggedPubkey: targetPubkey, tagEventId },
  });
  return nakSignEvent({ kind: 39999, tags, content, privkey: authorSk });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

let ctx = null;

async function setupSuite() {
  // Shipped behavior (pov-selectable-tag-surfaces ADR-0006): assertions only
  // count when their author's wot_rank_<povSuffix> >= minRank in Meili. Sign
  // as a pre-ranked pool author (helpers/livePov.js) so the tests exercise
  // bucketing/replacement/deletion, not the WoT gate. run() has already
  // verified the pool docs via ensureRankedPool().
  const { sk: authorSk, pk: authorPk } = makeAuthorDealer().take();

  const tagSlug = `test-tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagContent = JSON.stringify({
    tag: { slug: tagSlug, name: `Test Tag ${tagSlug}`, description: 'integration-test tag' },
  });
  const tagEvent = nakSignEvent({
    kind: 39999,
    tags: [['d', tagSlug], ['z', TAG_HANDLE]],
    content: tagContent,
    privkey: authorSk,
  });
  const published = await publish(tagEvent);
  ctx = { authorSk, authorPk, tagSlug, tagEventId: published.id };
  await sleep(PROPAGATION_MS);
}

/* ─── Tests ─── */

t('available-tags lists a kind-39999 tag-element after it is published', async () => {
  const { tagEventId } = ctx;
  const { status, json } = await fetchAvailableTags();
  assert(status === 200, `available-tags status ${status}`);
  assert(Array.isArray(json?.tags), 'available-tags response.tags must be array');
  assert(
    json.tags.some((tg) => tg.eventId === tagEventId),
    `available-tags should include published test tag (id=${tagEventId})`
  );
});

t('apply (polarity=1) appears under applications, not disputes', async () => {
  const { authorSk, authorPk, tagSlug, tagEventId } = ctx;
  const targetPk = nakDerivePubkey(nakKeyGen());

  const ev = signProfileTagEvent({ tagSlug, tagEventId, targetPubkey: targetPk, authorSk, authorPk, polarity: 1 });
  await publish(ev);
  await sleep(PROPAGATION_MS);

  const json = await fetchTagsForProfile(targetPk);
  assert((json.applications || []).length === 1, `expected 1 application, got ${(json.applications || []).length}`);
  assert((json.disputes || []).length === 0, `expected 0 disputes, got ${(json.disputes || []).length}`);
  const entry = json.applications[0];
  assert(entry.tagEventId === tagEventId, `entry.tagEventId mismatch`);
  assert(entry.authorPubkey === authorPk, `entry.authorPubkey mismatch`);
});

t('dispute (polarity=-1) appears under disputes, not applications', async () => {
  const { authorSk, authorPk, tagSlug, tagEventId } = ctx;
  const targetPk = nakDerivePubkey(nakKeyGen());

  const ev = signProfileTagEvent({ tagSlug, tagEventId, targetPubkey: targetPk, authorSk, authorPk, polarity: -1 });
  await publish(ev);
  await sleep(PROPAGATION_MS);

  const json = await fetchTagsForProfile(targetPk);
  assert((json.disputes || []).length === 1, `expected 1 dispute, got ${(json.disputes || []).length}`);
  assert((json.applications || []).length === 0, `expected 0 applications, got ${(json.applications || []).length}`);
});

t('event without a polarity tag defaults to applied', async () => {
  const { authorSk, authorPk, tagSlug, tagEventId } = ctx;
  const targetPk = nakDerivePubkey(nakKeyGen());

  const ev = signProfileTagEvent({ tagSlug, tagEventId, targetPubkey: targetPk, authorSk, authorPk, polarity: undefined });
  assert(!ev.tags.some((x) => x[0] === 'polarity'), 'fixture must omit polarity tag');
  await publish(ev);
  await sleep(PROPAGATION_MS);

  const json = await fetchTagsForProfile(targetPk);
  assert((json.applications || []).length === 1, 'omitted polarity must default to applied');
  assert((json.disputes || []).length === 0, 'omitted polarity must NOT bucket as disputed');
});

t('overwriting the same d-tag with flipped polarity moves the entry between buckets (single record)', async () => {
  const { authorSk, authorPk, tagSlug, tagEventId } = ctx;
  const targetPk = nakDerivePubkey(nakKeyGen());

  const apply = signProfileTagEvent({ tagSlug, tagEventId, targetPubkey: targetPk, authorSk, authorPk, polarity: 1 });
  await publish(apply);
  await sleep(PROPAGATION_MS);

  let json = await fetchTagsForProfile(targetPk);
  assert((json.applications || []).length === 1, 'after apply, expected 1 application');

  const dispute = signProfileTagEvent({ tagSlug, tagEventId, targetPubkey: targetPk, authorSk, authorPk, polarity: -1 });
  await publish(dispute);
  await sleep(PROPAGATION_MS);

  json = await fetchTagsForProfile(targetPk);
  assert((json.applications || []).length === 0, `after overwrite, expected 0 applications, got ${(json.applications || []).length}`);
  assert((json.disputes || []).length === 1, `after overwrite, expected 1 dispute, got ${(json.disputes || []).length}`);
});

t('typeahead search returns a profile tagged by a third-party author, with _matchedTags on the hit', async () => {
  // ─── Conditional contract (same gate probe as profile-tag-polish.test.js) ───
  // A ratified change gated the entire tag-match path behind the per-result-type
  // setting `search.resultTypes.tags` (getResultTypes in
  // src/api/search/profiles/meili/index.js; shipped default `false` in
  // src/config/defaults.json). When disabled, computeTagMatches never runs: no
  // tag-derived hits, no _matchedTags, and the `tagHits` key is omitted from
  // the response entirely — so probe the mode via tagHits-key presence and
  // skip when the behavior under test is structurally off.
  const probe = await fetchMeiliSearch(`__gate_probe_${Math.random().toString(36).slice(2, 8)}__`);
  if (!('tagHits' in probe)) {
    throw skipTest(
      'tags result type disabled (search.resultTypes.tags=false — shipped default; tag-match path structurally off; test meaningful only on tags-enabled instances)'
    );
  }

  const { authorSk, authorPk } = ctx;
  // Fresh tag with a deliberately unusual name so we don't collide with any
  // real profile's name/display_name.
  const tagSlug = `birb-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagName = tagSlug; // search query uses this verbatim

  // Publish a brand-new tag concept element from the same author. Cannot reuse
  // ctx.tagEventId because that one's `name` might already match other docs.
  const tagEvent = nakSignEvent({
    kind: 39999,
    tags: [['d', tagSlug], ['z', TAG_HANDLE]],
    content: JSON.stringify({
      tag: { slug: tagSlug, name: tagName, description: 'integration-test tag for search flow' },
    }),
    privkey: authorSk,
  });
  const publishedTag = await publish(tagEvent);

  // Target pubkey is independent — the searching client (this test) is NOT
  // the asserter. The assertion comes from Author A; the test acts as a
  // third-party searcher.
  const targetPk = nakDerivePubkey(nakKeyGen());

  // Seed a Meili profile doc for the target so the search proxy has
  // enrichment data to return. Name is deliberately UNRELATED to the
  // search query so the only reason this profile can appear in results
  // is the tag match.
  // On rank-filtered instances the settings' rank cutoff becomes a Meili
  // engine filter on the search itself — an unranked profile never appears in
  // hits, tag-matched or not. Rank the target into the active POV so the test
  // exercises the tag-match mechanism, not the WoT gate. No-op when unfiltered.
  const { povSuffix, minRank } = await fetchPovFilter();
  const targetDoc = {
    id: targetPk,
    pubkey: targetPk,
    name: `ProfileTagsTest-${Date.now()}`,
    display_name: `ProfileTagsTest-${Date.now()}`,
  };
  if (povSuffix && minRank !== null) targetDoc[`wot_rank_${povSuffix}`] = minRank;
  await meiliUpsertProfile(targetDoc);

  // Apply the tag (positive polarity) — author A → target T.
  const assertion = signProfileTagEvent({
    tagSlug,
    tagEventId: publishedTag.id,
    targetPubkey: targetPk,
    authorSk,
    authorPk,
    polarity: 1,
  });
  await publish(assertion);
  await sleep(PROPAGATION_MS);

  // Search by the tag name. Searcher is unauthenticated — proxy falls back
  // to whatever the house POV is (or no POV in dev).
  const result = await fetchMeiliSearch(tagName);
  const hit = (result.hits || []).find((h) => (h.pubkey || h.id) === targetPk);
  assert(hit, `target ${targetPk.slice(0, 8)}… should appear in search results for "${tagName}"`);
  assert(Array.isArray(hit._matchedTags), 'hit must carry _matchedTags array');
  assert(
    hit._matchedTags.some((t) => t.name === tagName),
    `_matchedTags should include "${tagName}", got ${JSON.stringify(hit._matchedTags)}`
  );
});

t('publishing a kind-5 deletion removes the asserted entry from the API response', async () => {
  const { authorSk, authorPk, tagSlug, tagEventId } = ctx;
  const targetPk = nakDerivePubkey(nakKeyGen());

  const apply = signProfileTagEvent({ tagSlug, tagEventId, targetPubkey: targetPk, authorSk, authorPk, polarity: 1 });
  const published = await publish(apply);
  await sleep(PROPAGATION_MS);

  let json = await fetchTagsForProfile(targetPk);
  assert((json.applications || []).length === 1, 'baseline: should be 1 application');

  const del = nakSignEvent({
    kind: 5,
    tags: [['e', published.id]],
    content: 'revoke',
    privkey: authorSk,
  });
  await publish(del);
  await sleep(PROPAGATION_MS);

  json = await fetchTagsForProfile(targetPk);
  assert(
    (json.applications || []).length === 0 && (json.disputes || []).length === 0,
    `after deletion, expected empty buckets, got applications=${(json.applications || []).length} disputes=${(json.disputes || []).length}`
  );
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- profile-tags publish-flow tests (Story 1) ---');

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
    console.log(`  FAIL  suite setup: ${err.message}`);
    return { pass: 0, fail: 1, skipped: tests.length };
  }

  let pass = 0;
  let fail = 0;
  let skipped = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      if (err && err[SKIP]) {
        console.log(`  SKIP  ${name}\n        ${err.message}`);
        skipped++;
      } else {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        fail++;
      }
    }
  }
  console.log(`\nprofile-tags-publish: ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
  return { pass, fail, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
