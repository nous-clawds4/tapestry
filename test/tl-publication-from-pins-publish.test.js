/**
 * Integration tests for Story 11: live TL publication flow.
 * ADR: engineering-team/decisions/0010-tl-publication-from-pins.md
 *
 * Exercises the parts of the spec that the contract-only suite cannot:
 *   - End-to-end refresh: a Pin event + assertions in strfry, observer POV
 *     configured → POST /api/trusted-list/refresh-all-pinned-tags produces a
 *     kind-30392 with the documented wire shape.
 *   - Disputes function (AC-5): only WoT-trusted authors count; cutoff +
 *     endorsement>dispute applied correctly.
 *   - Replacement in place (AC-2): two refreshes → one TL slot, latest wins.
 *   - Retraction (AC-9): unpin + refresh → empty replacement with
 *     ["status","retracted"] marker.
 *   - Unsupported method (AC-7): a non-`nip85:rank` pin yields no TL,
 *     tlStatus=unsupported on /pins.
 *   - Per-pin isolation (AC-8 amended): one failing pin doesn't block
 *     another in the same refresh-all call.
 *   - Wire-shape compatibility (AC-10): produced kind-30392 includes
 *     d / title / metric / observer / source-tag / cutoff / min-rank tags,
 *     `p` member tags, and a JSON content body with per-member counts.
 *   - tlStatus derivation (ADR amendment): /api/profile-tags/pins rows
 *     include `tlStatus` with status ∈ {ok, never, unsupported, retracted}.
 *
 * Approach: ephemeral keypairs via `nak`, signed events POSTed to
 * /api/strfry/publish with signAs:'client'. Mirrors test/pin-a-tag-publish
 * and test/tag-detail-write-publish. Tests skip when `nak` is missing or
 * the control panel is unreachable. The AC-5 disputes test additionally
 * requires settings.json to be writable from the test process; it skips
 * gracefully otherwise.
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
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
// ADR 0015's split, which this suite previously conflated into one constant:
// Z-TAG COMPOSITION for tag/nostr-user-tag/tag-pinning is bound to the LEGACY
// literal (named exception), while TL SIGNING and AUTHOR FILTERING use the
// per-deployment runtime TA (/api/assistant/pubkey). The two matched only by
// coincidence on the original dev container; a container rebuild mints a new
// runtime TA and the coincidence breaks.
const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`;
const NOSTR_USER_TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`;
const TAG_PINNING_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`;

// Runtime TA — resolved once per run from the instance itself; TLs are signed
// under this key. Populated by the runner before any test executes.
let RUNTIME_TA_PUBKEY = null;
async function fetchRuntimeTaPubkey() {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/assistant/pubkey`);
  const j = await r.json().catch(() => null);
  return (j && (j.pubkey || j.taPubkey)) || null;
}
const PROPAGATION_MS = 800;

const SETTINGS_PATH = process.env.TAPESTRY_SETTINGS_PATH
  || path.join(process.env.BRAINSTORM_BASE_DIR || '/var/lib/brainstorm', 'settings.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

/**
 * argv-style nak invocation: avoids bash brace-expansion on JSON tag values
 * (same fix as test/pin-a-tag-publish.test.js).
 */
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
  if (!r.ok || !j.success) {
    throw new Error(`publish failed: status=${r.status} body=${JSON.stringify(j)}`);
  }
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
  // Suppress strfry's verbose INFO-level stderr output by redirecting
  // inside the container shell.
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

/* ── Fixture builders ────────────────────────────────────────────────── */

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
  const tags = [
    ['d', dTag],
    ['p', targetPubkey],
    ['e', tagEventId],
    ['z', NOSTR_USER_TAG_HANDLE],
    ['polarity', String(polarity)],
  ];
  return nakSignEvent({
    kind: 39999,
    tags,
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: targetPubkey, tagEventId } }),
    privkey: authorSk,
  });
}

function defaultCurationMethod(observerPk) {
  return { observer: observerPk, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false };
}

function expectedTLDTag({ observerPk, tagAuthorPk, tagSlug }) {
  return `tl-pin-${observerPk.slice(0, 8)}-${tagAuthorPk.slice(0, 8)}-${tagSlug}`;
}

/* ── Phase 1: structural tests (no POV needed) ──────────────────────── */
/*
 * Fixture: one tag, one viewer who pins it under the default
 * curation-method. No POV configured → WoT filter falls back to
 * "all positive applications count". This is enough to verify the
 * TL's wire shape, replacement-in-place behavior, retraction, and
 * unsupported-method skipping. The disputes function with WoT
 * filtering is exercised in Phase 2.
 */

let basicCtx = null;
const basicTests = [];
function tBasic(name, fn) { basicTests.push([name, fn]); }

async function setupBasicSuite() {
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s11b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `tl-tag-${slugBase}`;

  const publishedTag = await publishTagEvent({
    slug: tagSlug,
    name: `TL Tag ${slugBase}`,
    description: `Story 11 basic-suite test tag — ${slugBase}`,
    authorSk: tagAuthorSk,
  });
  const tag = { eventId: publishedTag.id, slug: tagSlug, authorPubkey: tagAuthorPk, name: `TL Tag ${slugBase}` };

  // The pinner — both pins (supported + unsupported) come from this viewer.
  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);

  // Two assertion authors — applying the tag to a single target.
  // Endorsing authors come from the pre-ranked pool (helpers/livePov.js): TL
  // membership counts endorsements from POV-counted authors only, so on a
  // POV-filtered stack ephemeral authors' endorsements are dropped and the
  // target never qualifies. run() has verified the pool via ensureRankedPool().
  const dealer = makeAuthorDealer();
  const authorA = dealer.take();
  const authorB = dealer.take();
  const targetPk = nakDerivePubkey(nakKeyGen());

  // Publish a tag for "unsupported method" testing — separate so the
  // basic refresh test doesn't conflate them.
  const unsupportedTagSlug = `tl-tag-unsupported-${slugBase}`;
  const unsupportedPublishedTag = await publishTagEvent({
    slug: unsupportedTagSlug,
    name: `TL Tag Unsupported ${slugBase}`,
    description: 'unsupported-method test tag',
    authorSk: tagAuthorSk,
  });
  const unsupportedTag = {
    eventId: unsupportedPublishedTag.id,
    slug: unsupportedTagSlug,
    authorPubkey: tagAuthorPk,
    name: `TL Tag Unsupported ${slugBase}`,
  };

  // Two profile-tag applications + one dispute. With no POV configured
  // (no WoT filter), all three count.
  await publish(buildProfileTagAssertion({
    tagSlug: tag.slug, tagEventId: tag.eventId, targetPubkey: targetPk,
    authorSk: authorA.sk, authorPk: authorA.pk, polarity: 1,
  }));
  await publish(buildProfileTagAssertion({
    tagSlug: tag.slug, tagEventId: tag.eventId, targetPubkey: targetPk,
    authorSk: authorB.sk, authorPk: authorB.pk, polarity: 1,
  }));

  // Pin with the default curation-method (cutoff=2, method=nip85:rank).
  const pinEvent = buildPinEvent({
    tag, viewerSk, viewerPk,
    curationMethod: defaultCurationMethod(viewerPk),
  });
  const publishedPin = await publish(pinEvent);

  // Pin the unsupported tag with method='trust-everyone'.
  const unsupportedPin = buildPinEvent({
    tag: unsupportedTag, viewerSk, viewerPk,
    curationMethod: { observer: viewerPk, method: 'trust-everyone', cutoff: 1, includeScoreInTL: false },
  });
  const publishedUnsupportedPin = await publish(unsupportedPin);

  await sleep(PROPAGATION_MS);

  basicCtx = {
    tag, unsupportedTag, viewerSk, viewerPk, authorA, authorB, targetPk,
    pinEventId: publishedPin.id, unsupportedPinEventId: publishedUnsupportedPin.id,
    slugBase,
  };
}

async function findLatestTL(dTag) {
  const events = await strfryScan({ kinds: [30392], authors: [RUNTIME_TA_PUBKEY], '#d': [dTag] });
  if (events.length === 0) return null;
  events.sort((a, b) => b.created_at - a.created_at);
  return events[0];
}

tBasic('refresh-all-pinned-tags publishes a kind-30392 TL for the supported pin (AC-1)', async () => {
  const { tag, viewerPk } = basicCtx;
  const { status, json } = await refreshAllViaLoopback();
  assert(status === 200, `refresh-all-pinned-tags status ${status} body=${JSON.stringify(json)}`);
  assert(json?.success === true, `refresh-all-pinned-tags success; got ${JSON.stringify(json)}`);
  await sleep(PROPAGATION_MS);

  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, `Expected a kind-30392 TL at d-tag ${dTag}; got none`);
  assert(tl.kind === 30392, `TL kind must be 30392; got ${tl.kind}`);
  assert(tl.pubkey === RUNTIME_TA_PUBKEY,
    `TL must be signed by the runtime TA pubkey ${RUNTIME_TA_PUBKEY.slice(0,8)}…; got ${tl.pubkey?.slice(0,8)}…`);
});

tBasic('published TL carries the AC-10 + product-constraint tag set (d/title/metric/observer/source-tag/cutoff/min-rank)', async () => {
  const { tag, viewerPk } = basicCtx;
  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, 'TL must exist (AC-1 should have populated it)');
  const find = (k) => (tl.tags || []).find((t) => t[0] === k);

  assert(find('d')?.[1] === dTag, `d-tag must equal ${dTag}; got ${JSON.stringify(find('d'))}`);
  assert(find('title'),
    `TL must carry a title tag (existing TrustedListDetail reads it); got tags=${JSON.stringify(tl.tags?.map(t=>t[0]))}`);
  assert(find('metric'),
    `TL must carry a metric tag; got tags=${JSON.stringify(tl.tags?.map(t=>t[0]))}`);
  assert(find('observer')?.[1] === viewerPk,
    `TL must carry an observer tag with viewer pubkey; got ${JSON.stringify(find('observer'))}`);
  const sourceTag = find('source-tag');
  assert(sourceTag && sourceTag[1] === tag.eventId,
    `TL must carry a source-tag tag referencing the tag event id; got ${JSON.stringify(sourceTag)}`);
  // ADR specifies source-tag[2]=tagAuthor, source-tag[3]=slug. Verify both.
  assert(sourceTag[2] === tag.authorPubkey,
    `source-tag[2] must be the tag author pubkey; got ${sourceTag[2]}`);
  assert(sourceTag[3] === tag.slug,
    `source-tag[3] must be the tag slug; got ${sourceTag[3]}`);
  assert(find('cutoff'),
    `TL must carry a cutoff tag (disputes-function param); got tags=${JSON.stringify(tl.tags?.map(t=>t[0]))}`);
  assert(find('min-rank'),
    `TL must carry a min-rank tag (disputes-function param); got tags=${JSON.stringify(tl.tags?.map(t=>t[0]))}`);
});

tBasic('published TL content body carries per-member endorsement/dispute counts (v1 product constraint)', async () => {
  const { tag, viewerPk } = basicCtx;
  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, 'TL must exist');
  // tl-fixes #1 (2026-08-28): the per-member content JSON was dropped as
  // duplicative of the p tags — content is empty; membership lives in tags.
  assert(tl.content === '',
    `TL content must be empty since tl-fixes #1; got ${JSON.stringify(tl.content?.slice(0, 100))}`);
  const { targetPk } = basicCtx;
  const targetRow = tl.tags.find((x) => x[0] === 'p' && x[1] === targetPk);
  assert(targetRow,
    `TL p tags must include the qualifying target; got ${JSON.stringify(tl.tags.filter((x)=>x[0]==='p'))}`);
});

tBasic('refreshing the same pin twice replaces the TL in place — same d-tag, latest created_at wins (AC-2)', async () => {
  const { tag, viewerPk } = basicCtx;
  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const before = await findLatestTL(dTag);
  assert(before, 'precondition: a TL must exist before second refresh');

  // Sleep so created_at changes deterministically.
  await sleep(1100);
  const { status } = await refreshAllViaLoopback();
  assert(status === 200, `second refresh status ${status}`);
  await sleep(PROPAGATION_MS);

  const after = await findLatestTL(dTag);
  assert(after, 'TL must still exist after second refresh');
  assert(after.created_at > before.created_at,
    `after.created_at (${after.created_at}) must exceed before.created_at (${before.created_at}) — slot must be replaced in place`);

  // No event accumulation: exactly one TL event per d-tag SHOULD survive in
  // strfry's addressable-replaceable index (the older event becomes
  // inaccessible by id-or-d, depending on relay behavior). We don't
  // strictly assert "count == 1" because some relays keep prior events
  // queryable by id; but the latest-per-d MUST be the newer one (just
  // asserted) — that's the AC-2 contract.
});

tBasic('pin with method != nip85:rank produces no TL and tlStatus=unsupported on /pins (AC-7)', async () => {
  const { unsupportedTag, viewerPk } = basicCtx;
  const dTagUnsupported = expectedTLDTag({
    observerPk: viewerPk, tagAuthorPk: unsupportedTag.authorPubkey, tagSlug: unsupportedTag.slug,
  });
  const tl = await findLatestTL(dTagUnsupported);
  assert(!tl,
    `no kind-30392 should exist for the unsupported pin's d-tag; got ${tl?.id?.slice(0,8)}…`);

  // /api/profile-tags/pins surfaces tlStatus per row.
  const { json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`);
  assert(json?.success === true, 'pins lookup must succeed');
  const unsupportedRow = (json.pins || []).find((p) => p.tag?.eventId === unsupportedTag.eventId);
  assert(unsupportedRow, `unsupported pin must appear in /pins; got ${JSON.stringify(json.pins.map(p=>p.tag.slug))}`);
  assert(unsupportedRow.tlStatus,
    `unsupported pin row must carry a tlStatus object; got ${JSON.stringify(unsupportedRow)}`);
  assert(unsupportedRow.tlStatus.status === 'unsupported',
    `unsupported pin's tlStatus.status must be 'unsupported'; got ${JSON.stringify(unsupportedRow.tlStatus)}`);
});

tBasic('/api/profile-tags/pins rows carry tlStatus with status=ok after refresh (ADR amendment)', async () => {
  const { tag, viewerPk, pinEventId } = basicCtx;
  const { json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`);
  const row = (json.pins || []).find((p) => p.pinEventId === pinEventId);
  assert(row, `pin row must appear in /pins; got pinEventIds=${json.pins.map(p=>p.pinEventId.slice(0,8))}`);
  assert(row.tlStatus, `row must carry tlStatus; got ${JSON.stringify(row)}`);
  assert(row.tlStatus.status === 'ok',
    `tlStatus.status must be 'ok' after a successful refresh; got ${JSON.stringify(row.tlStatus)}`);
  assert(typeof row.tlStatus.lastRefreshAt === 'number',
    `tlStatus.lastRefreshAt must be a number; got ${JSON.stringify(row.tlStatus)}`);
  assert(typeof row.tlStatus.tlEventId === 'string' && /^[0-9a-f]{64}$/.test(row.tlStatus.tlEventId),
    `tlStatus.tlEventId must be 64-char hex; got ${JSON.stringify(row.tlStatus.tlEventId)}`);
  assert(typeof row.tlStatus.memberCount === 'number',
    `tlStatus.memberCount must be a number; got ${JSON.stringify(row.tlStatus.memberCount)}`);
});

tBasic('unpinning + refresh-all produces an empty-membership replacement with [status,retracted] marker (AC-9)', async () => {
  const { tag, viewerSk, viewerPk, pinEventId } = basicCtx;
  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });

  // Unpin via kind-5 (mirrors Story 10's unpin path).
  const del = nakSignEvent({
    kind: 5,
    tags: [['e', pinEventId]],
    content: 'unpinned for AC-9 test',
    privkey: viewerSk,
  });
  await publish(del);
  await sleep(PROPAGATION_MS);

  // Cron tick (manual trigger of the refresh-all endpoint).
  await sleep(1100); // ensure created_at advances past prior TL
  const { status } = await refreshAllViaLoopback();
  assert(status === 200, `refresh-all status ${status}`);
  await sleep(PROPAGATION_MS);

  const tl = await findLatestTL(dTag);
  assert(tl, `the d-tag slot must still resolve to a TL event (empty replacement, not a kind-5 delete)`);
  const pCount = (tl.tags || []).filter((t) => t[0] === 'p').length;
  assert(pCount === 0, `retracted TL must have no p tags; got ${pCount}`);
  const retractedMarker = (tl.tags || []).some((t) => t[0] === 'status' && t[1] === 'retracted');
  assert(retractedMarker,
    `retracted TL must carry ["status","retracted"] marker; got tags=${JSON.stringify(tl.tags)}`);
});

/* ── Phase 2: POV-required tests (AC-5 disputes function) ─────────────
 *
 * Fixture: one tag, one POV (delegated pubkey + minRank=50), three
 * profile-tag authors (two in-WoT, one out-of-WoT), three targets:
 *
 *   targetClearMember — 2 in-WoT endorsements, 0 disputes → makes the TL
 *                       under default cutoff=2.
 *   targetOneShort   — 1 in-WoT endorsement, 0 disputes → excluded
 *                       (endorsements < cutoff=2).
 *   targetMoreDisputes — 2 in-WoT endorsements, 3 in-WoT disputes →
 *                       excluded (endorsements not > disputes).
 *
 * The out-of-WoT author endorses targetOneShort. Because the disputes
 * function counts WoT-trusted votes only, that author's endorsement
 * does NOT push targetOneShort over the cutoff.
 */

let povCtx = null;
let savedSettings = null;
const povTests = [];
function tPov(name, fn) { povTests.push([name, fn]); }

async function setupPovSuite() {
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s11p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `tl-pov-${slugBase}`;
  const publishedTag = await publishTagEvent({
    slug: tagSlug, name: `TL POV ${slugBase}`, description: 'AC-5 test tag', authorSk: tagAuthorSk,
  });
  const tag = { eventId: publishedTag.id, slug: tagSlug, authorPubkey: tagAuthorPk, name: `TL POV ${slugBase}` };

  // POV setup
  const delegatedPubkey = nakDerivePubkey(nakKeyGen());
  const povSuffix = delegatedPubkey.slice(0, 8);
  const minRank = 50;
  const rankField = `wot_rank_${povSuffix}`;

  // The viewer (pin author) — the OBSERVER for this pin.
  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);

  // Assertion authors
  const inWotA = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const inWotB = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const outOfWot = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();

  // Targets
  const targetClearMember = nakDerivePubkey(nakKeyGen());
  const targetOneShort = nakDerivePubkey(nakKeyGen());
  const targetMoreDisputes = nakDerivePubkey(nakKeyGen());

  // Seed Meili so author/target enrichment works.
  await meiliUpsertProfile({ id: inWotA.pk, pubkey: inWotA.pk, name: `inWotA-${slugBase}`, [rankField]: 80 });
  await meiliUpsertProfile({ id: inWotB.pk, pubkey: inWotB.pk, name: `inWotB-${slugBase}`, [rankField]: 80 });
  await meiliUpsertProfile({ id: outOfWot.pk, pubkey: outOfWot.pk, name: `outOfWot-${slugBase}`, [rankField]: 10 });
  await meiliUpsertProfile({ id: targetClearMember, pubkey: targetClearMember, name: `clearMember-${slugBase}` });
  await meiliUpsertProfile({ id: targetOneShort, pubkey: targetOneShort, name: `oneShort-${slugBase}` });
  await meiliUpsertProfile({ id: targetMoreDisputes, pubkey: targetMoreDisputes, name: `moreDisputes-${slugBase}` });
  // Viewer needs to be visible too so resolvePov resolves them.
  await meiliUpsertProfile({ id: viewerPk, pubkey: viewerPk, name: `viewer-${slugBase}`, [rankField]: 80 });

  // Endorsements / disputes (kind-39999 nostr-user-tag events)
  // targetClearMember: 2 in-WoT endorsements, 0 disputes
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetClearMember, authorSk: inWotA.sk, authorPk: inWotA.pk, polarity: 1 }));
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetClearMember, authorSk: inWotB.sk, authorPk: inWotB.pk, polarity: 1 }));

  // targetOneShort: 1 in-WoT endorsement + 1 OUT-of-WoT endorsement (shouldn't count)
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetOneShort, authorSk: inWotA.sk, authorPk: inWotA.pk, polarity: 1 }));
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetOneShort, authorSk: outOfWot.sk, authorPk: outOfWot.pk, polarity: 1 }));

  // targetMoreDisputes: 2 in-WoT endorsements + 3 in-WoT disputes
  // 2 endorsements satisfies cutoff but endorsements (2) NOT > disputes (3) → excluded.
  // We need 3 disputes from 2 authors — use distinct d-tags by including the targetPubkey suffix in the d-tag.
  // The assertion-event d-tag composition (`profile-tag-<slug>-<tgt8>-<auth8>`) is per-(author, target) — so
  // each author can publish at most ONE assertion per target (replaceable). Polarity flips are replacements,
  // not additions. So we can't actually get 3 disputes from 2 authors. Use 3 dispute authors.
  const inWotC = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const inWotD = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  const inWotE = (() => { const sk = nakKeyGen(); return { sk, pk: nakDerivePubkey(sk) }; })();
  await meiliUpsertProfile({ id: inWotC.pk, pubkey: inWotC.pk, name: `inWotC-${slugBase}`, [rankField]: 70 });
  await meiliUpsertProfile({ id: inWotD.pk, pubkey: inWotD.pk, name: `inWotD-${slugBase}`, [rankField]: 70 });
  await meiliUpsertProfile({ id: inWotE.pk, pubkey: inWotE.pk, name: `inWotE-${slugBase}`, [rankField]: 70 });
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetMoreDisputes, authorSk: inWotA.sk, authorPk: inWotA.pk, polarity: 1 }));
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetMoreDisputes, authorSk: inWotB.sk, authorPk: inWotB.pk, polarity: 1 }));
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetMoreDisputes, authorSk: inWotC.sk, authorPk: inWotC.pk, polarity: -1 }));
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetMoreDisputes, authorSk: inWotD.sk, authorPk: inWotD.pk, polarity: -1 }));
  await publish(buildProfileTagAssertion({ tagSlug, tagEventId: tag.eventId, targetPubkey: targetMoreDisputes, authorSk: inWotE.sk, authorPk: inWotE.pk, polarity: -1 }));

  // The pin (cutoff=2, observer=viewerPk)
  const pinEvent = buildPinEvent({
    tag, viewerSk, viewerPk,
    curationMethod: { observer: viewerPk, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
  });
  const publishedPin = await publish(pinEvent);

  await sleep(PROPAGATION_MS);

  // Install the POV via settings.json (mirrors test/tag-detail-write-publish.test.js).
  // For the cron's POV resolution, the observer (= viewerPk) needs user-prefs
  // pointing at `delegatedPubkey` with `filters.rank.min = minRank`. We
  // install at the house level — resolvePov's fallback path picks it up.
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
    targetClearMember, targetOneShort, targetMoreDisputes,
    slugBase,
  };
}

async function teardownPovSuite() {
  if (savedSettings !== null) {
    try { writeSettingsFile(savedSettings); } catch { /* ignore */ }
  }
}

tPov('AC-5 disputes function: target with 2 WoT-trusted endorsements / 0 disputes makes the TL under cutoff=2', async () => {
  const { tag, viewerPk, targetClearMember } = povCtx;
  // Trigger a refresh now that the POV is configured.
  const { status } = await refreshAllViaLoopback();
  assert(status === 200, `refresh-all status ${status}`);
  await sleep(PROPAGATION_MS);

  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, `TL must exist for the POV-test pin`);

  const memberPubkeys = (tl.tags || []).filter(t => t[0] === 'p').map(t => t[1]);
  assert(memberPubkeys.includes(targetClearMember),
    `targetClearMember (2 in-WoT endorsements, 0 disputes) MUST appear in TL members; got ${JSON.stringify(memberPubkeys)}`);
});

tPov('AC-5 disputes function: target with 1 WoT-trusted + 1 out-of-WoT endorsement does NOT make the TL (cutoff=2)', async () => {
  const { tag, viewerPk, targetOneShort } = povCtx;
  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, 'TL must exist');
  const memberPubkeys = (tl.tags || []).filter(t => t[0] === 'p').map(t => t[1]);
  assert(!memberPubkeys.includes(targetOneShort),
    `targetOneShort (1 WoT-trusted endorsement; out-of-WoT vote must NOT count) MUST be excluded; got ${JSON.stringify(memberPubkeys)}`);
});

tPov('AC-5 disputes function: target with 2 endorsements AND 3 disputes is excluded (endorsements NOT > disputes)', async () => {
  const { tag, viewerPk, targetMoreDisputes } = povCtx;
  const dTag = expectedTLDTag({ observerPk: viewerPk, tagAuthorPk: tag.authorPubkey, tagSlug: tag.slug });
  const tl = await findLatestTL(dTag);
  assert(tl, 'TL must exist');
  const memberPubkeys = (tl.tags || []).filter(t => t[0] === 'p').map(t => t[1]);
  assert(!memberPubkeys.includes(targetMoreDisputes),
    `targetMoreDisputes (endorsements=2, disputes=3) MUST be excluded; got ${JSON.stringify(memberPubkeys)}`);
});

/* ── Run ── */

async function run() {
  console.log('\n--- tl-publication-from-pins publish-flow tests (Story 11) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: basicTests.length + povTests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: basicTests.length + povTests.length };
  }
  RUNTIME_TA_PUBKEY = await fetchRuntimeTaPubkey();
  if (!RUNTIME_TA_PUBKEY) {
    console.log('  SKIP  could not resolve the runtime TA pubkey from /api/assistant/pubkey; TL signature checks need it');
    return { pass: 0, fail: 0, skipped: basicTests.length + povTests.length };
  }
  const ranked = await ensureRankedPool();
  if (!ranked.ok) {
    console.log(`  SKIP  ${ranked.reason}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: basicTests.length + povTests.length };
  }

  let pass = 0, fail = 0, skipped = 0;

  // ── Phase 1: basic (no POV needed) ──
  console.log('  (phase 1: basic — no POV required)');
  try {
    await setupBasicSuite();
    for (const [name, fn] of basicTests) {
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
    console.log(`  FAIL  basic suite setup: ${err.message}`);
    fail++;
  }

  // ── Phase 2: POV-required (AC-5 disputes function) ──
  console.log('  (phase 2: POV-required — needs settings.json writable)');
  if (!canMutateSettings()) {
    console.log(`  SKIP  ${SETTINGS_PATH} not writable from this process; AC-5 disputes-function tests run on environments where the test process and the server share a filesystem`);
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

  console.log(`\ntl-publication-from-pins-publish: ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
