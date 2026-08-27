/**
 * Tests for Story 1 (epic: trusted-lists) — TL membership-method selector
 * (Count only).
 *
 * ADR: engineering-team/decisions/trusted-lists/0001-tl-membership-method-selector.md
 * Plan: engineering-team/stories/trusted-lists/1-tl-method-selector.test-plan.md
 *
 * Intentionally failing until the feature is implemented.
 *
 * Layers:
 *   1. UNIT — src/api/trustedList/membershipMethods.js contract + resolver
 *      fail-safety, driven through TAPESTRY_SETTINGS_PATH temp files with a
 *      require-cache bust (mirrors test/search-api-result-type-settings.test.js).
 *   2. SOURCE CONTRACT — defaults.json ships the default; the panel exists in
 *      TrustDetermination.jsx and writes only its own settings key.
 *   3. LIVE — pin + apply → refresh-all → published kind-30392 carries the
 *      ['membership-method','count'] tag alongside today's unchanged shape.
 *      Mirrors test/tl-publication-from-pins-publish.test.js. Skips when nak
 *      or the control panel is unavailable; the publish-policy guard FAILS
 *      (never skips) if external publishing is enabled.
 */

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const TAPESTRY_CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';

// ADR 0015 legacy z-tag pubkey — concept handles for tag/pin z-tags are
// intentionally literal (see CLAUDE.md § Named exception).
const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`;
const NOSTR_USER_TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`;
const TAG_PINNING_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`;

const PROPAGATION_MS = 800;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ─── Unit-layer scaffolding ─────────────────────────────────────────── */

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-method-selector-'));
let tmpCounter = 0;

/**
 * Load a fresh membershipMethods module with TAPESTRY_SETTINGS_PATH pointed
 * at a per-test file. Busts the require cache for src/ so
 * src/config/settings.js re-evaluates SETTINGS_PATH (same technique, and the
 * same process-env caveat, as search-api-result-type-settings.test.js).
 */
function loadMembershipMethods(settingsContent) {
  const settingsPath = path.join(TMP_DIR, `settings-${++tmpCounter}.json`);
  if (settingsContent !== undefined) {
    fs.writeFileSync(settingsPath, settingsContent, 'utf-8');
  }
  process.env.TAPESTRY_SETTINGS_PATH = settingsPath;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}src${path.sep}`)) delete require.cache[key];
  }
  const modPath = path.join(REPO_ROOT, 'src', 'api', 'trustedList', 'membershipMethods.js');
  assert(fs.existsSync(modPath),
    'src/api/trustedList/membershipMethods.js must exist (ADR 0001 implementation notes; contract pinned by the test plan)');
  return require(modPath);
}

/* ─── Live-layer scaffolding (mirrors tl-publication-from-pins) ──────── */

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
  const j = await r.json().catch(() => null);
  assert(r.ok && j?.success !== false, `publish failed: ${r.status} ${JSON.stringify(j)}`);
  return signedEvent;
}

async function refreshAllViaLoopback() {
  try {
    const out = execSync(
      `docker exec ${TAPESTRY_CONTAINER} curl -s -X POST http://127.0.0.1:7778/api/trusted-list/refresh-all-pinned-tags`,
      { encoding: 'utf8', timeout: 300000 }
    );
    let json = null; try { json = JSON.parse(out); } catch (_e) {}
    return { status: json && json.success ? 200 : 500, json };
  } catch (e) {
    return { status: 0, json: null, error: e.message };
  }
}

async function strfryScan(filter) {
  const safe = JSON.stringify(filter).replace(/"/g, '\\"');
  const out = execSync(
    `docker exec ${TAPESTRY_CONTAINER} sh -c 'strfry scan "${safe}" 2>/dev/null'`,
    { maxBuffer: 20 * 1024 * 1024 }
  ).toString();
  const events = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch {}
  }
  return events;
}

async function fetchRuntimeTaPubkey() {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/assistant/pubkey`);
  const j = await r.json().catch(() => null);
  return (j && (j.pubkey || j.taPubkey)) || null;
}

async function findLatestTL(taPubkey, dTag) {
  const events = await strfryScan({ kinds: [30392], authors: [taPubkey], '#d': [dTag] });
  events.sort((a, b) => b.created_at - a.created_at);
  return events[0] || null;
}

/* ─── Tests ──────────────────────────────────────────────────────────── */

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* Unit */

t('U1 defaults.json ships trustedLists.membershipMethod="count" (AC-5)', async () => {
  const defaults = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'defaults.json'), 'utf-8'));
  assertEqual(defaults?.trustedLists?.membershipMethod, 'count',
    'defaults.json must ship trustedLists.membershipMethod="count"');
});

t('U2 membershipMethods exports METHOD_IDS (3 methods, ordered) + resolver', async () => {
  // Amended 2026-08-27 (Story 2, operator direction): the selector collapsed
  // to the original three methods — rung-4 formalization is not a method.
  // IMPLEMENTED grows per rung, so assert count is first and the list is a
  // prefix of METHOD_IDS rather than pinning this story's snapshot.
  const m = loadMembershipMethods(undefined);
  assertEqual(JSON.stringify(m.METHOD_IDS), JSON.stringify(['count', 'input', 'certainty']),
    'METHOD_IDS must be the three ladder methods in wire-stable order');
  assert(Array.isArray(m.IMPLEMENTED_METHOD_IDS) && m.IMPLEMENTED_METHOD_IDS[0] === 'count'
    && m.IMPLEMENTED_METHOD_IDS.every((id) => m.METHOD_IDS.includes(id)),
    'IMPLEMENTED_METHOD_IDS must start with "count" and be a subset of METHOD_IDS');
  assert(typeof m.resolveMembershipMethod === 'function',
    'membershipMethods must export resolveMembershipMethod()');
});

t('U3 resolver: no settings file → "count" (AC-5)', async () => {
  const m = loadMembershipMethods(undefined); // path points at a nonexistent file
  assertEqual(m.resolveMembershipMethod(), 'count',
    'with no settings file the resolver must return "count"');
});

t('U4 resolver: valid-but-unimplemented id → "count" (fail-safe)', async () => {
  // Amended at Story 2: 'input' became implemented; 'certainty' is the
  // current valid-but-unimplemented exemplar (rung 3 will move it too).
  const m = loadMembershipMethods(JSON.stringify({ trustedLists: { membershipMethod: 'certainty' } }));
  assertEqual(m.resolveMembershipMethod(), 'count',
    'a known-but-not-yet-implemented method id must resolve to "count" in this story');
});

t('U5 resolver: garbage value → "count" (fail-safe)', async () => {
  const m = loadMembershipMethods(JSON.stringify({ trustedLists: { membershipMethod: 'blorp' } }));
  assertEqual(m.resolveMembershipMethod(), 'count',
    'an unknown method string must resolve to "count"');
});

t('U6 resolver: malformed settings JSON → "count", no throw (fail-safe)', async () => {
  const m = loadMembershipMethods('{ this is not JSON');
  let value;
  try { value = m.resolveMembershipMethod(); } catch (e) {
    throw new Error(`resolver must never throw on malformed settings; threw: ${e.message}`);
  }
  assertEqual(value, 'count', 'malformed settings must resolve to "count"');
});

t('U7 resolver: override "count" honored on a fresh per-call disk read (AC-2)', async () => {
  const m = loadMembershipMethods(JSON.stringify({ trustedLists: { membershipMethod: 'count' } }));
  assertEqual(m.resolveMembershipMethod(), 'count', 'explicit "count" override must resolve to "count"');
  // Flip the file under the SAME loaded module — proves disk-read-per-call
  // (no-restart switching, the mechanism rungs 2–4 rely on).
  fs.writeFileSync(process.env.TAPESTRY_SETTINGS_PATH,
    JSON.stringify({ trustedLists: { membershipMethod: 'blorp' } }), 'utf-8');
  assertEqual(m.resolveMembershipMethod(), 'count',
    'resolver must re-read settings per call (flipped file must be honored, fail-safe applied)');
});

/* Source contract */

t('S1 TrustDetermination.jsx renders the TL membership-method panel: 3 methods, unimplemented disabled (AC-1)', async () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'ui', 'src', 'pages', 'grapevine', 'TrustDetermination.jsx'), 'utf-8');
  for (const id of ['count', 'input', 'certainty']) {
    assert(new RegExp(`['"\`]${id}['"\`]`).test(src),
      `TrustDetermination.jsx must reference membership-method id "${id}"`);
  }
  assert(/membershipMethod/.test(src),
    'TrustDetermination.jsx must reference the membershipMethod settings key');
  assert(/disabled/i.test(src),
    'the three unimplemented methods must render disabled (AC-1)');
});

t('S2 panel writes { trustedLists: { membershipMethod } } via the settings API (AC-2)', async () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'ui', 'src', 'pages', 'grapevine', 'TrustDetermination.jsx'), 'utf-8');
  assert(/api\/settings/.test(src),
    'the panel must persist through /api/settings (server-side, not localStorage)');
  assert(/trustedLists/.test(src),
    'the PUT body must be scoped to the trustedLists key (deep-merge preserves siblings)');
});

/* Live */

let liveReady = false;
let liveSkipReason = '';

t('L0 GUARD publish policy is local-only (AC-6) — FAILS if external publishing is enabled', async () => {
  if (!liveReady) return { skipped: true, reason: liveSkipReason };
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/publish-policy`);
  const j = await r.json().catch(() => null);
  assert(j?.allowExternalPublish === false,
    `BRAINSTORM_PUBLISH_LOCAL_ONLY must be active while testing this book (got ${JSON.stringify(j)}). ` +
    'Refusing to run live publishing tests against external relays.');
});

t('L1+L2 pin + apply → refresh → TL keeps today\'s shape AND carries ["membership-method","count"] (AC-3, AC-4)', async () => {
  if (!liveReady) return { skipped: true, reason: liveSkipReason };

  // Amended at Story 2: the membership method AND the house POV are real
  // operator knobs now, so this test must PIN its environment (count mode,
  // no POV filter — its ephemeral tagger is unranked and a live POV gate
  // would drop the apply) instead of assuming it. Snapshot/restore via
  // docker exec, same technique as the story-2 suite.
  let snapshot = null;
  let canPin = false;
  try {
    snapshot = execSync(`docker exec ${TAPESTRY_CONTAINER} cat /var/lib/brainstorm/settings.json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    canPin = true;
  } catch { snapshot = null; canPin = true; /* file may not exist; still writable */ }
  const pinMethod = (content) => execFileSync('docker',
    ['exec', '-i', TAPESTRY_CONTAINER, 'sh', '-c', 'cat > /var/lib/brainstorm/settings.json'],
    { input: content });
  try {
    let obj = {};
    try { obj = snapshot ? JSON.parse(snapshot) : {}; } catch {}
    const pinned = { ...obj, trustedLists: { ...(obj.trustedLists || {}), membershipMethod: 'count' } };
    if (pinned.grapevine?.searchPreferences) {
      pinned.grapevine = { ...pinned.grapevine };
      delete pinned.grapevine.searchPreferences;
    }
    pinMethod(JSON.stringify(pinned, null, 2) + '\n');
    await runL1L2CountModeBody();
  } finally {
    if (canPin) {
      if (snapshot === null) execSync(`docker exec ${TAPESTRY_CONTAINER} rm -f /var/lib/brainstorm/settings.json`);
      else pinMethod(snapshot);
    }
  }
});

async function runL1L2CountModeBody() {

  const taPubkey = await fetchRuntimeTaPubkey();
  assert(taPubkey, 'could not resolve runtime TA pubkey');

  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);
  const taggerSk = nakKeyGen();
  const taggerPk = nakDerivePubkey(taggerSk);
  const targetSk = nakKeyGen();
  const targetPk = nakDerivePubkey(targetSk);

  const slug = `tlmm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const tagEvent = await publish(nakSignEvent({
    kind: 39999,
    tags: [['d', slug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug, name: `TL method test ${slug}`, description: '' } }),
    privkey: tagAuthorSk,
  }));

  await publish(nakSignEvent({
    kind: 39999,
    tags: [
      ['d', `profile-tag-${slug}-${targetPk.slice(0, 8)}-${taggerPk.slice(0, 8)}`],
      ['p', targetPk],
      ['e', tagEvent.id],
      ['z', NOSTR_USER_TAG_HANDLE],
      ['polarity', '1'],
    ],
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: targetPk, tagEventId: tagEvent.id } }),
    privkey: taggerSk,
  }));

  const curationMethod = { observer: viewerPk, method: 'nip85:rank', cutoff: 1, includeScoreInTL: false };
  await publish(nakSignEvent({
    kind: 39999,
    tags: [
      ['d', `tag-pin-${slug}-${tagAuthorPk.slice(0, 8)}-${viewerPk.slice(0, 8)}`],
      ['e', tagEvent.id],
      ['a', `39999:${tagAuthorPk}:${slug}`],
      ['z', TAG_PINNING_HANDLE],
      ['curation-method', JSON.stringify(curationMethod)],
    ],
    content: JSON.stringify({ tagPinning: { tagEventId: tagEvent.id, curationMethod } }),
    privkey: viewerSk,
  }));

  await sleep(PROPAGATION_MS);
  const { status, json } = await refreshAllViaLoopback();
  assert(status === 200 && json?.success === true,
    `refresh-all-pinned-tags failed: status ${status} body=${JSON.stringify(json)}`);
  await sleep(PROPAGATION_MS);

  const dTag = `tl-pin-${viewerPk.slice(0, 8)}-${tagAuthorPk.slice(0, 8)}-${slug}`;
  const tl = await findLatestTL(taPubkey, dTag);
  assert(tl, `expected a kind-30392 TL at d-tag ${dTag}; got none`);

  // AC-3 — today's shape, unchanged: member present, counts in content,
  // cutoff/min-rank/metric/observer tags intact.
  const pTags = tl.tags.filter((x) => x[0] === 'p');
  assert(pTags.some((x) => x[1] === targetPk),
    `TL must contain the applied target ${targetPk.slice(0, 8)}… as a p tag (count semantics unchanged)`);
  const content = JSON.parse(tl.content || '{}');
  const member = (content.members || []).find((m) => m.pubkey === targetPk);
  assert(member && member.endorsements === 1 && member.disputes === 0,
    `content JSON must keep raw counts (endorsements=1, disputes=0); got ${JSON.stringify(member)}`);
  for (const tagName of ['cutoff', 'min-rank', 'observer', 'metric']) {
    assert(tl.tags.some((x) => x[0] === tagName),
      `TL must keep its existing ['${tagName}', …] tag (shape unchanged)`);
  }

  // AC-4 — the one permitted delta: the computing method, on the wire.
  const methodTag = tl.tags.find((x) => x[0] === 'membership-method');
  assert(methodTag, 'TL must carry a ["membership-method", …] tag (AC-4)');
  assertEqual(methodTag[1], 'count',
    'with default settings the recorded membership method must be "count"');
}

t('L3 unauthenticated PUT /api/settings is rejected (settings auth gate)', async () => {
  if (!liveReady) return { skipped: true, reason: liveSkipReason };
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trustedLists: { membershipMethod: 'count' } }),
  });
  assert(r.status === 401 || r.status === 403,
    `unauthenticated settings write must be rejected; got ${r.status}`);
});

/* ─── Runner ─────────────────────────────────────────────────────────── */

async function run() {
  console.log('\n▶ tl-membership-method-selector suite (trusted-lists Story 1)');

  liveReady = nakAvailable() && await controlPanelReachable();
  if (!liveReady) {
    liveSkipReason = !nakAvailable() ? 'nak not on PATH' : `control panel unreachable at ${CONTROL_PANEL_BASE}`;
    console.log(`  (live layer skipped: ${liveSkipReason})`);
  }

  let pass = 0; let fail = 0; let skipped = 0;
  for (const [name, fn] of tests) {
    try {
      const result = await fn();
      if (result && result.skipped) {
        skipped += 1;
        console.log(`  ↷ SKIP ${name} (${result.reason})`);
      } else {
        pass += 1;
        console.log(`  ✓ ${name}`);
      }
    } catch (e) {
      fail += 1;
      console.log(`  ✗ ${name}\n      ${e.message}`);
    }
  }
  delete process.env.TAPESTRY_SETTINGS_PATH;
  console.log(`  tl-membership-method-selector: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped };
}

module.exports = { run };
