/**
 * Integration test for Story 17 AC-22 — WYSIWYG invariant.
 * ADR: engineering-team/decisions/0014-tag-detail-curated-view-and-pin-polish.md
 *
 * Locks down the end-to-end property: when a user pins a tag with the
 * Story-17 defaults (cutoff=1, observer=self, includeScoreInTL=true),
 * the published kind-30392 Trusted List's member set equals the
 * Curated view's row set (i.e., the WoT-filtered rows from
 * /api/profile-tags/profiles-tagged for which applications > disputes)
 * under the same POV.
 *
 * Approach mirrors test/customize-pin-curation-publish.test.js:
 *   - ephemeral keypairs via `nak`,
 *   - kind-39999 tag + assertion + pin events POSTed to /api/strfry/publish,
 *   - /api/trusted-list/refresh-all-pinned-tags triggers TL generation,
 *   - strfry scan retrieves the TL,
 *   - /api/profile-tags/profiles-tagged returns the row list, which
 *     is then filtered client-side to Net >= 1 to compute the Curated
 *     set.
 *
 * Skips when `nak` is missing or the control panel is unreachable.
 *
 * Per CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode," this
 * suite resolves the TA pubkey at runtime via /api/assistant/pubkey.
 */

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ensureRankedPool, makeAuthorDealer } = require('./helpers/livePov');

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
const PROPAGATION_MS = 800;

const PUBLISH_TAG_PIN_PATH = path.resolve(__dirname, '../ui/src/utils/publishTagPin.js');

/**
 * Parse the actual `defaultCurationMethod` literal-object body from the
 * source of ui/src/utils/publishTagPin.js. The module ships as ESM
 * (`export function ...`) so we cannot `require()` it from this
 * CommonJS test; we extract the object literal via regex and evaluate
 * the simple literal fields.
 *
 * AC-22 says "given a user pins with the defaults of THIS story" —
 * meaning the test must use whatever defaultCurationMethod CURRENTLY
 * returns, so pre-implementation (cutoff: 2, includeScoreInTL: false)
 * produces a divergence vs the Curated view's algorithm (Net >= 1).
 * Post-implementation (cutoff: 1, includeScoreInTL: true) produces
 * convergence.
 */
function readDefaultCurationFromSource(viewerPubkey) {
  const src = fs.readFileSync(PUBLISH_TAG_PIN_PATH, 'utf8');
  const m = src.match(/export\s+function\s+defaultCurationMethod\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};?\s*\}/);
  if (!m) throw new Error('could not locate defaultCurationMethod in publishTagPin.js source');
  const body = m[1];
  const cutoffM = body.match(/cutoff:\s*(\d+)/);
  const includeM = body.match(/includeScoreInTL:\s*(true|false)/);
  const methodM = body.match(/method:\s*['"]([^'"]+)['"]/);
  if (!cutoffM || !includeM || !methodM) {
    throw new Error(`could not parse defaultCurationMethod fields from body: ${body}`);
  }
  return {
    observer: viewerPubkey,
    method: methodM[1],
    cutoff: parseInt(cutoffM[1], 10),
    includeScoreInTL: includeM[1] === 'true',
  };
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
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

let _taPubkey = null;
async function fetchTaPubkey() {
  if (_taPubkey) return _taPubkey;
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/assistant/pubkey`);
  const j = await r.json();
  if (!j?.success || !j.pubkey) throw new Error('could not resolve TA pubkey');
  _taPubkey = j.pubkey;
  return _taPubkey;
}

function nakKeyGen() { return execSync('nak key generate').toString().trim(); }
function nakDerivePubkey(privkey) { return execSync(`nak key public ${privkey}`).toString().trim(); }

function nakSignEvent({ kind, tags = [], content = '', privkey }) {
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

/* ── Fixture builders ────────────────────────────────────────── */

async function publishTagEvent({ slug, name, description, authorSk, tagHandle }) {
  return await publish(nakSignEvent({
    kind: 39999,
    tags: [['d', slug], ['z', tagHandle]],
    content: JSON.stringify({ tag: { slug, name, description: description || '' } }),
    privkey: authorSk,
  }));
}

function buildPinEvent({ tag, viewerSk, viewerPk, curationMethod, tagPinningHandle }) {
  const dTag = `tag-pin-${tag.slug}-${tag.authorPubkey.slice(0, 8)}-${viewerPk.slice(0, 8)}`;
  return nakSignEvent({
    kind: 39999,
    tags: [
      ['d', dTag],
      ['e', tag.eventId],
      ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
      ['z', tagPinningHandle],
      ['curation-method', JSON.stringify(curationMethod)],
    ],
    content: JSON.stringify({ tagPinning: { tagEventId: tag.eventId, curationMethod } }),
    privkey: viewerSk,
  });
}

function buildProfileTagAssertion({ tagSlug, tagEventId, targetPubkey, authorSk, authorPk, polarity, nostrUserTagHandle }) {
  const dTag = `profile-tag-${tagSlug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  return nakSignEvent({
    kind: 39999,
    tags: [
      ['d', dTag],
      ['p', targetPubkey],
      ['e', tagEventId],
      ['z', nostrUserTagHandle],
      ['polarity', String(polarity)],
    ],
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: targetPubkey, tagEventId } }),
    privkey: authorSk,
  });
}

function expectedTLDTag({ observerPk, tagAuthorPk, tagSlug }) {
  return `tl-pin-${observerPk.slice(0, 8)}-${tagAuthorPk.slice(0, 8)}-${tagSlug}`;
}

async function findLatestTL(dTag, taPubkey) {
  const events = await strfryScan({ kinds: [30392], authors: [taPubkey], '#d': [dTag] });
  if (events.length === 0) return null;
  events.sort((a, b) => b.created_at - a.created_at);
  return events[0];
}

/* ── Suite state ─────────────────────────────────────────────── */

let suiteSkipped = false;
let suiteSkipReason = '';
let ctx = null;
const tests = [];
function t(name, fn) { tests.push([name, fn]); }

async function setupSuite() {
  if (!nakAvailable()) { suiteSkipped = true; suiteSkipReason = '`nak` not on PATH'; return; }
  if (!(await controlPanelReachable())) { suiteSkipped = true; suiteSkipReason = `control panel not reachable at ${CONTROL_PANEL_BASE}`; return; }

  // ADR 0015's split: taPubkey (runtime, from /api/assistant/pubkey) is kept
  // for TL AUTHOR scans — TLs are signed under the runtime TA — while Z-TAG
  // COMPOSITION uses the LEGACY literal (the ADR's named exception; the server
  // reads pins/tags/assertions via legacy-built handles). Deriving the handles
  // from the runtime TA matched only by coincidence on the original dev
  // container.
  const taPubkey = await fetchTaPubkey();
  const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
  const TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`;
  const NOSTR_USER_TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`;
  const TAG_PINNING_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`;

  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s17-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `wysiwyg-${slugBase}`;
  const published = await publishTagEvent({
    slug: tagSlug,
    name: `WYSIWYG Tag ${slugBase}`,
    description: 'Story 17 AC-22 fixture',
    authorSk: tagAuthorSk,
    tagHandle: TAG_HANDLE,
  });
  const tag = { eventId: published.id, slug: tagSlug, authorPubkey: tagAuthorPk, name: `WYSIWYG Tag ${slugBase}` };

  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);

  // Authors shape per-target endorsement/dispute counts — drawn from the
  // pre-ranked pool (helpers/livePov.js): the Curated view and TL membership
  // count POV-counted authors only.
  const dealer = makeAuthorDealer();
  const authorA = dealer.take();
  const authorB = dealer.take();

  // Three target profiles, each with distinct (apps, disputes) under no
  // WoT-filter (the basic-suite path mirroring customize-pin-curation-publish
  // — no settings.json mutation). The Curated rule is `applications > disputes`.
  //   targetIn  : 1 apply, 0 disputes  → IN Curated (1 > 0)
  //   targetTie : 1 apply, 1 dispute   → NOT in Curated (1 > 1 is false)
  //   targetOut : 0 apply, 1 dispute   → NOT in Curated (and not in rows at
  //                all if apps==0 unless disputes show — actually rows DO
  //                include disputes-only entries; Curated still excludes
  //                because 0 > 1 is false)
  const targetIn  = nakDerivePubkey(nakKeyGen());
  const targetTie = nakDerivePubkey(nakKeyGen());
  const targetOut = nakDerivePubkey(nakKeyGen());

  // targetIn: A=+1
  await publish(buildProfileTagAssertion({
    tagSlug: tag.slug, tagEventId: tag.eventId, targetPubkey: targetIn,
    authorSk: authorA.sk, authorPk: authorA.pk, polarity: 1, nostrUserTagHandle: NOSTR_USER_TAG_HANDLE,
  }));
  // targetTie: A=+1, B=-1
  await publish(buildProfileTagAssertion({
    tagSlug: tag.slug, tagEventId: tag.eventId, targetPubkey: targetTie,
    authorSk: authorA.sk, authorPk: authorA.pk, polarity: 1, nostrUserTagHandle: NOSTR_USER_TAG_HANDLE,
  }));
  await publish(buildProfileTagAssertion({
    tagSlug: tag.slug, tagEventId: tag.eventId, targetPubkey: targetTie,
    authorSk: authorB.sk, authorPk: authorB.pk, polarity: -1, nostrUserTagHandle: NOSTR_USER_TAG_HANDLE,
  }));
  // targetOut: B=-1
  await publish(buildProfileTagAssertion({
    tagSlug: tag.slug, tagEventId: tag.eventId, targetPubkey: targetOut,
    authorSk: authorB.sk, authorPk: authorB.pk, polarity: -1, nostrUserTagHandle: NOSTR_USER_TAG_HANDLE,
  }));

  // Pin with whatever `defaultCurationMethod` CURRENTLY returns in
  // publishTagPin.js source — this is exactly what a user clicking
  // Pin with defaults publishes. Pre-impl: cutoff=2 → targetIn fails
  // the cutoff → TL diverges from the Curated set. Post-impl:
  // cutoff=1 → TL converges with the Curated set.
  const liveDefaultCuration = readDefaultCurationFromSource(viewerPk);
  const pinEvent = buildPinEvent({ tag, viewerSk, viewerPk, curationMethod: liveDefaultCuration, tagPinningHandle: TAG_PINNING_HANDLE });
  const publishedPin = await publish(pinEvent);

  await sleep(PROPAGATION_MS);

  ctx = {
    taPubkey, tag, viewerSk, viewerPk,
    targetIn, targetTie, targetOut,
    pinEventId: publishedPin.id,
    liveDefaultCuration,
  };
}

/* ── AC-22 — WYSIWYG: TL member set === Curated row set ─────── */

t('AC-22: published TL membership (using defaultCurationMethod from source) equals the Curated view (applications > disputes) under the same POV', async () => {
  // Trigger TL refresh for all pins.
  const { status } = await refreshAllViaLoopback();
  assert(status === 200, `refresh-all-pinned-tags status ${status}`);
  await sleep(PROPAGATION_MS);

  // Fetch the published TL for this pin.
  const dTag = expectedTLDTag({
    observerPk: ctx.viewerPk,
    tagAuthorPk: ctx.tag.authorPubkey,
    tagSlug: ctx.tag.slug,
  });
  const tl = await findLatestTL(dTag, ctx.taPubkey);
  assert(tl, `AC-22: expected a TL at d-tag ${dTag}; got none`);

  // Build the published TL's member set from its `p` tags.
  const tlMembers = new Set(
    (tl.tags || []).filter((t) => t[0] === 'p').map((t) => t[1])
  );

  // Fetch the Curated view via the rows endpoint. The Curated rule is
  // applications > disputes, applied client-side. Use wotPov=user with
  // viewer = the pin's observer (matches the rows the user would see
  // logged in on their own POV).
  const params = new URLSearchParams({
    tagEventId: ctx.tag.eventId,
    wotPov: 'user',
    userPubkey: ctx.viewerPk,
    viewerPubkey: ctx.viewerPk,
    sort: 'applied',
  });
  const { status: rowsStatus, json: rowsJson } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?${params}`
  );
  assert(rowsStatus === 200, `profiles-tagged status ${rowsStatus}`);
  assert(rowsJson?.success === true, 'profiles-tagged success');

  // Curated set = rows with applications > disputes (the new default
  // view's algorithm).
  const curatedMembers = new Set(
    (rowsJson.rows || [])
      .filter((r) => r.applications > r.disputes)
      .map((r) => r.pubkey)
  );

  // Both sets must be equal — that's the WYSIWYG invariant.
  // Additionally, sanity-check that our fixture produced a non-degenerate
  // partition (otherwise the equality holds vacuously).
  assert(tlMembers.has(ctx.targetIn),
    `AC-22 sanity: targetIn (${ctx.targetIn.slice(0, 8)}…) MUST appear in the TL (1 apply, 0 disputes); ` +
      `TL members: ${[...tlMembers].map((p) => p.slice(0, 8)).join(',') || '(empty)'}`);
  assert(!tlMembers.has(ctx.targetTie),
    `AC-22 sanity: targetTie (${ctx.targetTie.slice(0, 8)}…) MUST NOT appear in the TL (1 apply, 1 dispute; ` +
      `applications > disputes is false)`);
  assert(!tlMembers.has(ctx.targetOut),
    `AC-22 sanity: targetOut (${ctx.targetOut.slice(0, 8)}…) MUST NOT appear in the TL (0 applies, 1 dispute)`);

  // Compute set differences for an informative error if they diverge.
  const inTLOnly = [...tlMembers].filter((p) => !curatedMembers.has(p));
  const inCuratedOnly = [...curatedMembers].filter((p) => !tlMembers.has(p));
  assert(
    inTLOnly.length === 0 && inCuratedOnly.length === 0,
    `AC-22 WYSIWYG broken: published TL membership and Curated view diverge.\n` +
      `  In TL but NOT in Curated: ${inTLOnly.map((p) => p.slice(0, 8)).join(',') || '(none)'}\n` +
      `  In Curated but NOT in TL: ${inCuratedOnly.map((p) => p.slice(0, 8)).join(',') || '(none)'}\n` +
      `  TL members: [${[...tlMembers].map((p) => p.slice(0, 8)).join(',')}]\n` +
      `  Curated:    [${[...curatedMembers].map((p) => p.slice(0, 8)).join(',')}]`
  );
});

/* ── Run ─── */

async function run() {
  console.log('\n--- tag-detail-curated-view-and-pin-polish-publish tests (Story 17 AC-22) ---');
  const ranked = await ensureRankedPool().catch((e) => ({ ok: false, reason: e.message }));
  if (!ranked.ok) {
    console.log(`  SKIP — ${ranked.reason}`);
    return { pass: 0, fail: 0, skipped: tests.length };
  }
  try {
    await setupSuite();
  } catch (err) {
    suiteSkipped = true;
    suiteSkipReason = `setup error: ${err.message}`;
  }
  if (suiteSkipped) {
    console.log(`  SKIP — ${suiteSkipReason}`);
    return { pass: 0, fail: 0, skipped: tests.length };
  }
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      fail++;
    }
  }
  console.log(`\ntag-detail-curated-view-and-pin-polish-publish: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail = 0 }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
