/**
 * Tests for Story 2 (epic: trusted-lists) — Weighted-sum membership method.
 *
 * ADR: engineering-team/decisions/trusted-lists/0002-weighted-sum-method.md
 * Plan: engineering-team/stories/trusted-lists/2-input-agreement-method.test-plan.md
 *
 * Intentionally failing until implemented. Layers: unit (registry/resolver),
 * source contract (UI + validation kit), live (no-POV fallback, seeded-POV
 * known-value matrix, count restore). Settings are mutated VIA DOCKER EXEC
 * with snapshot/restore — the settings volume is in-container on this
 * machine-class, so the older host-path technique cannot apply.
 */

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
const TAPESTRY_CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const IN_CONTAINER_SETTINGS = '/var/lib/brainstorm/settings.json';

const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`;
const NOSTR_USER_TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`;
const TAG_PINNING_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`;

// Fixed dev-only house delegate for the seeded-POV phase (any hex; dev stack).
const DEV_DELEGATE = 'abababababababababababababababababababababababababababababababab';
const RANK_FIELD = `wot_rank_${DEV_DELEGATE.slice(0, 8)}`;

const PROPAGATION_MS = 800;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ─── unit scaffolding (same technique as story-1 suite) ─────────────── */

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-weighted-sum-'));
let tmpCounter = 0;
function loadMembershipMethods(settingsContent) {
  const settingsPath = path.join(TMP_DIR, `settings-${++tmpCounter}.json`);
  if (settingsContent !== undefined) fs.writeFileSync(settingsPath, settingsContent, 'utf-8');
  process.env.TAPESTRY_SETTINGS_PATH = settingsPath;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}src${path.sep}`)) delete require.cache[key];
  }
  return require(path.join(REPO_ROOT, 'src', 'api', 'trustedList', 'membershipMethods.js'));
}

/* ─── docker-exec settings mutation with snapshot/restore ────────────── */

function dockerAvailable() {
  try {
    execSync(`docker exec ${TAPESTRY_CONTAINER} true`, { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function readContainerSettings() {
  try {
    return execSync(
      `docker exec ${TAPESTRY_CONTAINER} cat ${IN_CONTAINER_SETTINGS}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch { return null; } // file may not exist yet
}

function writeContainerSettings(content) {
  execFileSync('docker',
    ['exec', '-i', TAPESTRY_CONTAINER, 'sh', '-c', `cat > ${IN_CONTAINER_SETTINGS}`],
    { input: content });
}

function mergeContainerSettings(patch) {
  const raw = readContainerSettings();
  let obj = {};
  try { obj = raw ? JSON.parse(raw) : {}; } catch { obj = {}; }
  const merged = deepMerge(obj, patch);
  writeContainerSettings(JSON.stringify(merged, null, 2) + '\n');
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
      && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/* ─── live plumbing (mirrors the sibling TL suites) ──────────────────── */

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
function nakDerivePubkey(sk) { return execSync(`nak key public ${sk}`).toString().trim(); }
function nakSignEvent({ kind, tags = [], content = '', privkey }) {
  const args = ['event', '-k', String(kind)];
  for (const tag of tags) args.push('--tag', `${tag[0]}=${tag.slice(1).join('=')}`);
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
async function refreshAll() {
  const out = execSync(
    `docker exec ${TAPESTRY_CONTAINER} curl -s -X POST http://127.0.0.1:7778/api/trusted-list/refresh-all-pinned-tags`,
    { encoding: 'utf8', timeout: 300000 });
  let json = null; try { json = JSON.parse(out); } catch {}
  assert(json?.success === true, `refresh-all failed: ${out.slice(0, 300)}`);
}
async function strfryScan(filter) {
  const safe = JSON.stringify(filter).replace(/"/g, '\\"');
  const out = execSync(
    `docker exec ${TAPESTRY_CONTAINER} sh -c 'strfry scan "${safe}" 2>/dev/null'`,
    { maxBuffer: 20 * 1024 * 1024 }).toString();
  const events = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch {}
  }
  return events;
}
async function fetchTaPubkey() {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/assistant/pubkey`);
  const j = await r.json().catch(() => null);
  return j?.pubkey || null;
}
async function findLatestTL(taPubkey, dTag) {
  const events = await strfryScan({ kinds: [30392], authors: [taPubkey], '#d': [dTag] });
  events.sort((a, b) => b.created_at - a.created_at);
  return events[0] || null;
}
async function meiliUpsert(doc) {
  const r = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([doc]),
  });
  assert(r.ok, `meili upsert failed: ${r.status}`);
}
async function meiliWaitIndexed(pk, field, { timeoutMs = 120000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents/${pk}`);
      if (r.ok) {
        const doc = await r.json();
        if (typeof doc[field] === 'number') return true;
      }
    } catch {}
    await sleep(2000);
  }
  return false;
}

async function fetchPovFilter() {
  const probe = `${'0'.repeat(63)}1`;
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${probe}`);
  const j = await r.json().catch(() => null);
  return { povSuffix: j?.povSuffix || null, minRank: Number.isFinite(Number(j?.minRank)) ? Number(j.minRank) : null };
}

/* fixture builders */
async function publishTag({ slug, authorSk }) {
  return await publish(nakSignEvent({
    kind: 39999,
    tags: [['d', slug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug, name: `wsum test ${slug}`, description: '' } }),
    privkey: authorSk,
  }));
}
async function publishApplyOrDispute({ slug, tagEventId, targetPk, taggerSk, taggerPk, polarity }) {
  return await publish(nakSignEvent({
    kind: 39999,
    tags: [
      ['d', `profile-tag-${slug}-${targetPk.slice(0, 8)}-${taggerPk.slice(0, 8)}`],
      ['p', targetPk],
      ['e', tagEventId],
      ['z', NOSTR_USER_TAG_HANDLE],
      ['polarity', String(polarity)],
    ],
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: targetPk, tagEventId } }),
    privkey: taggerSk,
  }));
}
async function publishPin({ slug, tagEvent, tagAuthorPk, viewerSk, viewerPk }) {
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
  return `tl-pin-${viewerPk.slice(0, 8)}-${tagAuthorPk.slice(0, 8)}-${slug}`;
}

function pTagFor(tl, pk) { return tl.tags.find((t) => t[0] === 'p' && t[1] === pk); }
function contentMember(tl, pk) {
  try { return (JSON.parse(tl.content).members || []).find((m) => m.pubkey === pk); } catch { return null; }
}

/* ─── tests ──────────────────────────────────────────────────────────── */

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('U1 IMPLEMENTED_METHOD_IDS contains count + input (ladder prefix)', async () => {
  // Amended at Story 3: later rungs append; this suite pins its own rung's
  // methods as a prefix rather than freezing the full list.
  const m = loadMembershipMethods(undefined);
  assert(m.IMPLEMENTED_METHOD_IDS[0] === 'count' && m.IMPLEMENTED_METHOD_IDS[1] === 'input',
    'count and input must be the first two implemented methods');
});

t('U2 resolver: settings "input" → "input"', async () => {
  const m = loadMembershipMethods(JSON.stringify({ trustedLists: { membershipMethod: 'input' } }));
  assertEqual(m.resolveMembershipMethod(), 'input', 'implemented "input" must resolve to itself');
});

t('U3 resolver: garbage id fail-safes to "count"', async () => {
  // Amended at Story 3: 'certainty' became implemented; the fail-safe
  // property is pinned with an id that will never be valid.
  const m = loadMembershipMethods(JSON.stringify({ trustedLists: { membershipMethod: 'not-a-method' } }));
  assertEqual(m.resolveMembershipMethod(), 'count', 'unknown ids must resolve to "count"');
});

t('S1 UI: "input" option enabled with Weighted-sum label', async () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'ui', 'src', 'pages', 'grapevine', 'TrustDetermination.jsx'), 'utf-8');
  const entry = src.match(/\{ id: 'input'[\s\S]*?\}/);
  assert(entry, 'TrustDetermination.jsx must define the input method entry');
  assert(/available: true/.test(entry[0]),
    'the input entry must be available: true (selectable) at rung 2');
  assert(/Weighted sum/i.test(entry[0]),
    'the input entry label must describe the weighted sum');
});

t('S2 validation kit exists and carries the scenario expectations', async () => {
  const kitPath = path.join(REPO_ROOT, 'scripts', 'tl-ladder-validate.js');
  assert(fs.existsSync(kitPath),
    'scripts/tl-ladder-validate.js must exist (operator validation kit AC)');
  const kit = fs.readFileSync(kitPath, 'utf-8');
  for (const marker of ['1.8', '-0.84', 'expected']) {
    assert(kit.includes(marker),
      `validation kit must carry the known-value expectation table (missing "${marker}")`);
  }
});

/* live */
let liveReady = false;
let liveSkipReason = '';
let settingsSnapshot = null; // null = file absent at start

function liveSkip() { return { skipped: true, reason: liveSkipReason }; }

t('L0 GUARD publish policy is local-only — FAILS if external publishing is enabled', async () => {
  if (!liveReady) return liveSkip();
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/publish-policy`);
  const j = await r.json().catch(() => null);
  assert(j?.allowExternalPublish === false,
    `refusing to run: BRAINSTORM_PUBLIC_LOCAL_ONLY must be active (got ${JSON.stringify(j)})`);
});

t('LA no-POV fallback: method "input" on an unfiltered stack publishes as count', async () => {
  if (!liveReady) return liveSkip();
  const pov = await fetchPovFilter();
  if (pov.povSuffix && pov.minRank !== null) {
    return { skipped: true, reason: 'stack already has a POV filter; fallback path not naturally testable here' };
  }
  mergeContainerSettings({ trustedLists: { membershipMethod: 'input' } });

  const tagAuthorSk = nakKeyGen(); const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const viewerSk = nakKeyGen(); const viewerPk = nakDerivePubkey(viewerSk);
  const taggerSk = nakKeyGen(); const taggerPk = nakDerivePubkey(taggerSk);
  const targetSk = nakKeyGen(); const targetPk = nakDerivePubkey(targetSk);
  const slug = `wsumfb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const tagEvent = await publishTag({ slug, authorSk: tagAuthorSk });
  await publishApplyOrDispute({ slug, tagEventId: tagEvent.id, targetPk, taggerSk, taggerPk, polarity: 1 });
  const dTag = await publishPin({ slug, tagEvent, tagAuthorPk, viewerSk, viewerPk });
  await sleep(PROPAGATION_MS);
  await refreshAll();
  await sleep(PROPAGATION_MS);

  const ta = await fetchTaPubkey();
  const tl = await findLatestTL(ta, dTag);
  assert(tl, `expected TL at ${dTag}`);
  // Story 4: method tag stripped; fallback-to-count is observable as
  // score-less plain p tags.
  assert(!tl.tags.some((x) => x[0] === 'membership-method'),
    'published TLs must NOT carry a membership-method tag (stripped at Story 4)');
  const p = pTagFor(tl, targetPk);
  assert(p && p.length <= 2,
    `fallback TL must carry plain p tags (no score); got ${JSON.stringify(p)}`);
});

t('LB seeded-POV known-value matrix (scores on the TL, membership/order/counts unchanged)', async () => {
  if (!liveReady) return liveSkip();

  // Seed house POV (inclusive gate at 3) + method input.
  mergeContainerSettings({
    grapevine: { searchPreferences: { delegatedPubkey: DEV_DELEGATE, filters: { rank: { enabled: true, cutoff: 3 } } } },
    trustedLists: { membershipMethod: 'input' },
  });

  // Scenario taggers: [rank, votePolarity, targetKey]
  const scenarios = {
    A: { expected: 1,     taggings: [[100, 1]] },
    B: { expected: 0.3,   taggings: Array.from({ length: 10 }, () => [3, 1]) },
    C: { expected: 1.8,   taggings: [[90, 1], [90, 1]] },
    // 1 apply vs 1 dispute can never pass `applies > disputes` — D uses
    // unequal counts with the same weighted result (fixture corrected).
    D: { expected: 0.4,   taggings: [[40, 1], [40, 1], [40, -1]] },
    E: { expected: 0,     taggings: [[40, 1], [40, 1], [80, -1]] },
    F: { expected: -0.84, taggings: [[3, 1], [3, 1], [90, -1]] },
  };

  const tagAuthorSk = nakKeyGen(); const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const viewerSk = nakKeyGen(); const viewerPk = nakDerivePubkey(viewerSk);
  const slug = `wsumkv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tagEvent = await publishTag({ slug, authorSk: tagAuthorSk });

  const targets = {};
  const upserted = [];
  for (const [key, sc] of Object.entries(scenarios)) {
    const targetSk = nakKeyGen(); const targetPk = nakDerivePubkey(targetSk);
    targets[key] = targetPk;
    for (const [rank, vote] of sc.taggings) {
      const sk = nakKeyGen(); const pk = nakDerivePubkey(sk);
      await meiliUpsert({ id: pk, pubkey: pk, name: `wsum-tagger-${key}-${rank}`, [RANK_FIELD]: rank });
      upserted.push(pk);
      await publishApplyOrDispute({ slug, tagEventId: tagEvent.id, targetPk, taggerSk: sk, taggerPk: pk, polarity: vote });
    }
  }
  // Bounded wait for the LAST upserted doc (queue is FIFO; if the last is
  // indexed the earlier ones are too — re-check a sample to be safe).
  const lastIndexed = await meiliWaitIndexed(upserted[upserted.length - 1], RANK_FIELD);
  const firstIndexed = lastIndexed && await meiliWaitIndexed(upserted[0], RANK_FIELD, { timeoutMs: 10000 });
  if (!lastIndexed || !firstIndexed) {
    return { skipped: true, reason: 'meili indexing did not settle in budget (livePov convention: skip, not fail)' };
  }

  const dTag = await publishPin({ slug, tagEvent, tagAuthorPk, viewerSk, viewerPk });
  await sleep(PROPAGATION_MS);
  await refreshAll();
  await sleep(PROPAGATION_MS);

  const ta = await fetchTaPubkey();
  const tl = await findLatestTL(ta, dTag);
  assert(tl, `expected TL at ${dTag}`);

  // Story 4: method tag stripped; input mode is observable by its scores.
  assert(!tl.tags.some((x) => x[0] === 'membership-method'),
    'published TLs must NOT carry a membership-method tag (stripped at Story 4)');

  for (const [key, sc] of Object.entries(scenarios)) {
    const pk = targets[key];
    const p = pTagFor(tl, pk);
    assert(p, `scenario ${key}: target must be a member (count predicate unchanged)`);
    assertEqual(p[3], String(sc.expected),
      `scenario ${key}: p-tag score slot must carry the weighted sum`);
    const cm = contentMember(tl, pk);
    assertEqual(cm?.score, sc.expected, `scenario ${key}: content JSON score`);
    const applies = sc.taggings.filter(([, v]) => v === 1).length;
    const disputes = sc.taggings.filter(([, v]) => v === -1).length;
    assertEqual(cm?.endorsements, applies, `scenario ${key}: endorsements count unchanged`);
    assertEqual(cm?.disputes, disputes, `scenario ${key}: disputes count unchanged`);
  }

  // Ordering: endorsements desc, then pubkey asc — unchanged from count.
  const memberPks = tl.tags.filter((x) => x[0] === 'p').map((x) => x[1])
    .filter((pk) => Object.values(targets).includes(pk));
  const expectedOrder = Object.values(targets)
    .map((pk) => ({ pk, e: contentMember(tl, pk)?.endorsements ?? 0 }))
    .sort((a, b) => (b.e - a.e) || a.pk.localeCompare(b.pk))
    .map((x) => x.pk);
  assertEqual(JSON.stringify(memberPks), JSON.stringify(expectedOrder),
    'member order must remain endorsements desc, pubkey asc');
});

t('LC switching back to count restores Story-1 output shape', async () => {
  if (!liveReady) return liveSkip();
  mergeContainerSettings({ trustedLists: { membershipMethod: 'count' } });
  await refreshAll();
  await sleep(PROPAGATION_MS);
  const ta = await fetchTaPubkey();
  const tls = (await strfryScan({ kinds: [30392], authors: [ta] }))
    .filter((tl) => (tl.tags.find((x) => x[0] === 'd')?.[1] || '').includes('wsumkv'));
  tls.sort((a, b) => b.created_at - a.created_at);
  const tl = tls[0];
  assert(tl, 'expected the known-value TL to have re-published under count');
  assert(!tl.tags.some((x) => x[0] === 'membership-method'),
    'published TLs must NOT carry a membership-method tag (stripped at Story 4)');
  const scored = tl.tags.filter((x) => x[0] === 'p' && x.length > 2);
  assertEqual(scored.length, 0, 'count TLs must carry plain p tags again (no scores)');
});

/* ─── runner ─────────────────────────────────────────────────────────── */

async function run() {
  console.log('\n▶ tl-weighted-sum-method suite (trusted-lists Story 2)');

  liveReady = nakAvailable() && dockerAvailable() && await controlPanelReachable();
  if (!liveReady) {
    liveSkipReason = !nakAvailable() ? 'nak not on PATH'
      : !dockerAvailable() ? `docker/${TAPESTRY_CONTAINER} unavailable`
        : `control panel unreachable at ${CONTROL_PANEL_BASE}`;
    console.log(`  (live layer skipped: ${liveSkipReason})`);
  } else {
    settingsSnapshot = readContainerSettings();
  }

  let pass = 0; let fail = 0; let skipped = 0;
  try {
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
  } finally {
    if (liveReady) {
      // Byte-exact settings restore (or removal if the file did not exist).
      try {
        if (settingsSnapshot === null) {
          execSync(`docker exec ${TAPESTRY_CONTAINER} rm -f ${IN_CONTAINER_SETTINGS}`);
        } else {
          writeContainerSettings(settingsSnapshot);
        }
        console.log('  (settings.json restored to pre-suite state)');
      } catch (e) {
        console.log(`  ⚠ settings restore FAILED: ${e.message} — inspect ${IN_CONTAINER_SETTINGS}`);
      }
    }
    delete process.env.TAPESTRY_SETTINGS_PATH;
  }
  console.log(`  tl-weighted-sum-method: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped };
}

module.exports = { run };
