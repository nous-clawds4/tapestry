/**
 * Tests for Story 3 (epic: trusted-lists) — Certainty method (0–100) + prune.
 * ADR: engineering-team/decisions/trusted-lists/0003-certainty-method-and-prune.md
 * Plan: engineering-team/stories/trusted-lists/3-certainty-method.test-plan.md
 *
 * Intentionally failing until implemented. Mirrors the story-2 suite's
 * docker-exec settings pin + seeded-POV live matrix; the prune test runs
 * FIRST so the live refresh is fast (OPEN 182).
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
function round6(x) { return Number(x.toFixed(6)); }
// Same expression shape as the implementation — float-exact expectations.
function certaintyScore(taggings) {
  const input = taggings.reduce((s, [r]) => s + r / 100, 0);
  if (input === 0) return 0;
  const wsum = taggings.reduce((s, [r, v]) => s + (r / 100) * v, 0);
  return round6(((wsum / input) * (1 - Math.pow(0.5, input))) * 100);
}

/* unit scaffolding (story-1/2 technique) */
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-certainty-'));
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

/* docker settings + live plumbing (story-2 technique) */
function dockerAvailable() {
  try { execSync(`docker exec ${TAPESTRY_CONTAINER} true`, { stdio: 'pipe' }); return true; } catch { return false; }
}
function readContainerSettings() {
  try {
    return execSync(`docker exec ${TAPESTRY_CONTAINER} cat ${IN_CONTAINER_SETTINGS}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch { return null; }
}
function writeContainerSettings(content) {
  execFileSync('docker', ['exec', '-i', TAPESTRY_CONTAINER, 'sh', '-c', `cat > ${IN_CONTAINER_SETTINGS}`], { input: content });
}
function pinEnvironment({ method, pov }) {
  const raw = readContainerSettings();
  let obj = {};
  try { obj = raw ? JSON.parse(raw) : {}; } catch {}
  obj.trustedLists = { ...(obj.trustedLists || {}), membershipMethod: method };
  obj.grapevine = { ...(obj.grapevine || {}) };
  if (pov) {
    obj.grapevine.searchPreferences = {
      ...(obj.grapevine.searchPreferences || {}),
      delegatedPubkey: DEV_DELEGATE,
      filters: { rank: { enabled: true, cutoff: 3 } },
    };
  } else {
    delete obj.grapevine.searchPreferences;
  }
  writeContainerSettings(JSON.stringify(obj, null, 2) + '\n');
}
function nakAvailable() { try { execSync('command -v nak', { stdio: 'pipe' }); return true; } catch { return false; } }
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
async function publish(ev) {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/strfry/publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: ev, signAs: 'client' }),
  });
  const j = await r.json().catch(() => null);
  assert(r.ok && j?.success !== false, `publish failed: ${r.status} ${JSON.stringify(j)}`);
  return ev;
}
async function refreshAll() {
  const out = execSync(
    `docker exec ${TAPESTRY_CONTAINER} curl -s -X POST http://127.0.0.1:7778/api/trusted-list/refresh-all-pinned-tags`,
    { encoding: 'utf8', timeout: 600000 });
  let json = null; try { json = JSON.parse(out); } catch {}
  assert(json?.success === true, `refresh-all failed: ${out.slice(0, 300)}`);
}
async function strfryScan(filter) {
  const safe = JSON.stringify(filter).replace(/"/g, '\\"');
  const out = execSync(
    `docker exec ${TAPESTRY_CONTAINER} sh -c 'strfry scan "${safe}" 2>/dev/null'`,
    { maxBuffer: 40 * 1024 * 1024 }).toString();
  const events = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch {}
  }
  return events;
}
function dTagOf(ev) { return (ev.tags || []).find((t) => t[0] === 'd')?.[1] || ''; }
const FIXTURE_PREFIX_RE = /(tlkit-|wsumkv-|wsumfb-|tlmm-|repro-|repro2-)/;

async function fetchTaPubkey() {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/assistant/pubkey`);
  return (await r.json().catch(() => null))?.pubkey || null;
}
async function meiliUpsertMany(docs) {
  const r = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(docs),
  });
  assert(r.ok, `meili upsert failed: ${r.status}`);
}
async function meiliWaitIndexed(pk, field, { timeoutMs = 120000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents/${pk}`);
      if (r.ok && typeof (await r.json())[field] === 'number') return true;
    } catch {}
    await sleep(2000);
  }
  return false;
}

/* tests */
const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('U1 IMPLEMENTED_METHOD_IDS is ["count","input","certainty"]', async () => {
  const m = loadMembershipMethods(undefined);
  assertEqual(JSON.stringify(m.IMPLEMENTED_METHOD_IDS), JSON.stringify(['count', 'input', 'certainty']),
    'rung 3 must implement all three methods');
});

t('U2 resolver: settings "certainty" → "certainty"', async () => {
  const m = loadMembershipMethods(JSON.stringify({ trustedLists: { membershipMethod: 'certainty' } }));
  assertEqual(m.resolveMembershipMethod(), 'certainty', 'implemented "certainty" must resolve to itself');
});

t('S1 UI: certainty option enabled with 0–100 blurb', async () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'ui', 'src', 'pages', 'grapevine', 'TrustDetermination.jsx'), 'utf-8');
  const entry = src.match(/\{ id: 'certainty'[\s\S]*?\}/);
  assert(entry, 'certainty entry must exist');
  assert(/available: true/.test(entry[0]), 'certainty must be available: true at rung 3');
  assert(/100/.test(entry[0]), 'certainty blurb must state the 0–100 scale');
});

t('S2 prune script exists; kit prunes before seeding and scales certainty ×100', async () => {
  const prunePath = path.join(REPO_ROOT, 'scripts', 'tl-prune-fixtures.js');
  assert(fs.existsSync(prunePath), 'scripts/tl-prune-fixtures.js must exist (OPEN 182)');
  const prune = fs.readFileSync(prunePath, 'utf-8');
  assert(/ids/.test(prune) && /strfry delete/.test(prune),
    'prune must delete by explicit id lists via strfry delete');
  const kit = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'tl-ladder-validate.js'), 'utf-8');
  assert(/prune/i.test(kit), 'kit must invoke the prune before seeding (--no-prune to skip)');
  assert(/\* 100|\*100/.test(kit), 'kit certainty expectation must be on the 0–100 scale');
});

let liveReady = false;
let liveSkipReason = '';
let settingsSnapshot = null;
function liveSkip() { return { skipped: true, reason: liveSkipReason }; }

t('L0 GUARD publish policy is local-only — FAILS if external publishing is enabled', async () => {
  if (!liveReady) return liveSkip();
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/publish-policy`);
  const j = await r.json().catch(() => null);
  assert(j?.allowExternalPublish === false, `refusing to run: publish policy ${JSON.stringify(j)}`);
});

t('LP prune removes all fixture-prefixed events (and makes refresh fast)', async () => {
  if (!liveReady) return liveSkip();
  execSync(`node ${path.join(REPO_ROOT, 'scripts', 'tl-prune-fixtures.js')}`,
    { encoding: 'utf8', env: { ...process.env }, stdio: 'pipe', timeout: 600000 });
  const remaining39999 = (await strfryScan({ kinds: [39999] }))
    .filter((ev) => FIXTURE_PREFIX_RE.test(dTagOf(ev)));
  const remainingTLs = (await strfryScan({ kinds: [30392, 30393] }))
    .filter((ev) => FIXTURE_PREFIX_RE.test(dTagOf(ev)));
  assertEqual(remaining39999.length, 0,
    'no fixture-prefixed kind-39999 events may remain after prune');
  assertEqual(remainingTLs.length, 0,
    'no fixture-prefixed TLs may remain after prune');
});

t('LB certainty known-value matrix (0–100 scores; membership/order/counts unchanged)', async () => {
  if (!liveReady) return liveSkip();
  pinEnvironment({ method: 'certainty', pov: true });

  const scenarios = {
    A: { taggings: [[100, 1]] },
    B: { taggings: Array.from({ length: 10 }, () => [3, 1]) },
    C: { taggings: [[90, 1], [90, 1]] },
    D: { taggings: [[40, 1], [40, 1], [40, -1]] },
    E: { taggings: [[40, 1], [40, 1], [80, -1]] },
    F: { taggings: [[3, 1], [3, 1], [90, -1]] },
  };

  const tagAuthorSk = nakKeyGen(); const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const viewerSk = nakKeyGen(); const viewerPk = nakDerivePubkey(viewerSk);
  const slug = `tlmm-cert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tagEvent = await publish(nakSignEvent({
    kind: 39999, tags: [['d', slug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug, name: `certainty test ${slug}`, description: '' } }),
    privkey: tagAuthorSk,
  }));

  const targets = {};
  const upserted = [];
  for (const [key, sc] of Object.entries(scenarios)) {
    const tSk = nakKeyGen(); const tPk = nakDerivePubkey(tSk);
    targets[key] = tPk;
    for (const [rank, vote] of sc.taggings) {
      const sk = nakKeyGen(); const pk = nakDerivePubkey(sk);
      upserted.push({ id: pk, pubkey: pk, name: `tlmm-cert-tagger-${key}-${rank}`, [RANK_FIELD]: rank });
      await publish(nakSignEvent({
        kind: 39999,
        tags: [
          ['d', `profile-tag-${slug}-${tPk.slice(0, 8)}-${pk.slice(0, 8)}`],
          ['p', tPk], ['e', tagEvent.id], ['z', NOSTR_USER_TAG_HANDLE], ['polarity', String(vote)],
        ],
        content: JSON.stringify({ nostrUserTag: { taggedPubkey: tPk, tagEventId: tagEvent.id } }),
        privkey: sk,
      }));
    }
  }
  await meiliUpsertMany(upserted);
  const okLast = await meiliWaitIndexed(upserted[upserted.length - 1].pubkey, RANK_FIELD);
  const okFirst = okLast && await meiliWaitIndexed(upserted[0].pubkey, RANK_FIELD, { timeoutMs: 10000 });
  if (!okLast || !okFirst) return { skipped: true, reason: 'meili indexing did not settle in budget' };

  const curationMethod = { observer: viewerPk, method: 'nip85:rank', cutoff: 1, includeScoreInTL: false };
  await publish(nakSignEvent({
    kind: 39999,
    tags: [
      ['d', `tag-pin-${slug}-${tagAuthorPk.slice(0, 8)}-${viewerPk.slice(0, 8)}`],
      ['e', tagEvent.id], ['a', `39999:${tagAuthorPk}:${slug}`], ['z', TAG_PINNING_HANDLE],
      ['curation-method', JSON.stringify(curationMethod)],
    ],
    content: JSON.stringify({ tagPinning: { tagEventId: tagEvent.id, curationMethod } }),
    privkey: viewerSk,
  }));
  await sleep(PROPAGATION_MS);
  await refreshAll();
  await sleep(PROPAGATION_MS);

  const ta = await fetchTaPubkey();
  const dTag = `tl-pin-${viewerPk.slice(0, 8)}-${tagAuthorPk.slice(0, 8)}-${slug}`;
  const tls = await strfryScan({ kinds: [30392], authors: [ta], '#d': [dTag] });
  tls.sort((a, b) => b.created_at - a.created_at);
  const tl = tls[0];
  assert(tl, `expected TL at ${dTag}`);
  assertEqual(tl.tags.find((x) => x[0] === 'membership-method')?.[1], 'certainty',
    'TL must record membership-method "certainty"');

  let content = {};
  try { content = JSON.parse(tl.content); } catch {}
  for (const [key, sc] of Object.entries(scenarios)) {
    const pk = targets[key];
    const expected = certaintyScore(sc.taggings);
    const p = tl.tags.find((x) => x[0] === 'p' && x[1] === pk);
    assert(p, `scenario ${key}: target must be a member (count predicate until rung 4)`);
    assertEqual(p[3], String(expected),
      `scenario ${key}: p-tag score must be certainty×agreement on the 0–100 scale`);
    const cm = (content.members || []).find((m) => m.pubkey === pk);
    assertEqual(cm?.score, expected, `scenario ${key}: content JSON score`);
    const applies = sc.taggings.filter(([, v]) => v === 1).length;
    const disputes = sc.taggings.filter(([, v]) => v === -1).length;
    assertEqual(cm?.endorsements, applies, `scenario ${key}: endorsements unchanged`);
    assertEqual(cm?.disputes, disputes, `scenario ${key}: disputes unchanged`);
  }
  // Sanity anchors on the scale itself:
  assertEqual(certaintyScore(scenarios.A.taggings), 50, 'formula anchor: A must be exactly 50');
  assert(certaintyScore(scenarios.F.taggings) < 0, 'formula anchor: F must be negative');
});

/* runner */
async function run() {
  console.log('\n▶ tl-certainty-method suite (trusted-lists Story 3)');
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
        if (result && result.skipped) { skipped += 1; console.log(`  ↷ SKIP ${name} (${result.reason})`); }
        else { pass += 1; console.log(`  ✓ ${name}`); }
      } catch (e) {
        fail += 1;
        console.log(`  ✗ ${name}\n      ${e.message}`);
      }
    }
  } finally {
    if (liveReady) {
      try {
        if (settingsSnapshot === null) execSync(`docker exec ${TAPESTRY_CONTAINER} rm -f ${IN_CONTAINER_SETTINGS}`);
        else writeContainerSettings(settingsSnapshot);
        console.log('  (settings.json restored to pre-suite state)');
      } catch (e) {
        console.log(`  ⚠ settings restore FAILED: ${e.message}`);
      }
    }
    delete process.env.TAPESTRY_SETTINGS_PATH;
  }
  console.log(`  tl-certainty-method: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped };
}

module.exports = { run };
