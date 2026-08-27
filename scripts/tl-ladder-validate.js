#!/usr/bin/env node
/**
 * TL ladder validation kit (ADR trusted-lists/0002; Story 2 AC "Operator
 * validation kit"). One command; the operator only reads the output.
 *
 * Seeds the known-value fixture on the LOCAL dev stack — ephemeral npubs,
 * their WoT ranks under the house POV, one tag + pin + taggings per
 * scenario — then, per requested method: sets the pipeline method,
 * refreshes, reads the published TL back, and prints published vs expected.
 * Exits non-zero on any mismatch.
 *
 *   BRAINSTORM_BASE_URL=http://localhost:8778 node scripts/tl-ladder-validate.js [method|--all]
 *
 *   method: count | input | certainty   (default: input)
 *   --all:  run every IMPLEMENTED method over the same fixture and print
 *           one combined table with a column per method.
 *
 * Expectations per method:
 *   count     — membership + raw endorsement/dispute counts (no score).
 *   input     — score = Σ(rank/100 × ±1), round6.
 *   certainty — score = (Σw×r ÷ Σw) × (1 − 0.5^Σw), round6 (rung 3).
 * Methods not yet in IMPLEMENTED_METHOD_IDS are refused (the pipeline would
 * silently fall back to count and the table would lie).
 *
 * LOUD SIDE EFFECTS (dev-only, printed as they happen): seeds house POV if
 * absent; sets trustedLists.membershipMethod (leaves the LAST run method
 * active). Local relay only (publish policy is checked first).
 */

const { execSync, execFileSync } = require('child_process');
const path = require('path');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const SETTINGS = '/var/lib/brainstorm/settings.json';

// Single source of truth for what the pipeline can execute.
const { METHOD_IDS, IMPLEMENTED_METHOD_IDS } =
  require(path.join(__dirname, '..', 'src', 'api', 'trustedList', 'membershipMethods.js'));

const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`;
const NOSTR_USER_TAG_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`;
const TAG_PINNING_HANDLE = `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`;

const DEV_DELEGATE = 'abababababababababababababababababababababababababababababababab';

/** Scenario matrix: taggings as [rank, +1 apply / −1 dispute]. All scenarios
 * are members under the count predicate by construction (applies > disputes). */
const SCENARIOS = [
  { key: 'A', desc: 'one rank-100 apply', taggings: [[100, 1]] },
  { key: 'B', desc: 'ten rank-3 applies', taggings: Array.from({ length: 10 }, () => [3, 1]) },
  { key: 'C', desc: 'two rank-90 applies (weighting beats counting vs B)', taggings: [[90, 1], [90, 1]] },
  { key: 'D', desc: 'two rank-40 applies + rank-40 dispute', taggings: [[40, 1], [40, 1], [40, -1]] },
  { key: 'E', desc: 'equal-weight split: 2× rank-40 apply vs rank-80 dispute', taggings: [[40, 1], [40, 1], [80, -1]] },
  { key: 'F', desc: 'dispute dominance: 2× rank-3 apply vs rank-90 dispute', taggings: [[3, 1], [3, 1], [90, -1]] },
];
// Reference expectations — input: A 1, B 0.3, C 1.8, D 0.4, E 0, F -0.84.

function round6(x) { return Number(x.toFixed(6)); }

/** What the published TL should show for a scenario under a method.
 * Returns { kind: 'score', value } or { kind: 'member', applies, disputes }. */
function expectation(method, taggings) {
  const applies = taggings.filter(([, v]) => v === 1).length;
  const disputes = taggings.filter(([, v]) => v === -1).length;
  if (method === 'count') return { kind: 'member', applies, disputes };
  const input = taggings.reduce((s, [r]) => s + r / 100, 0);
  const wsum = taggings.reduce((s, [r, v]) => s + (r / 100) * v, 0);
  if (method === 'input') return { kind: 'score', value: round6(wsum) };
  if (method === 'certainty') {
    // ADR 0003: certainty publishes on the 0-100 scale (decimals kept).
    const value = input === 0 ? 0 : round6(((wsum / input) * (1 - Math.pow(0.5, input))) * 100);
    return { kind: 'score', value };
  }
  throw new Error(`no expectation defined for method "${method}"`);
}

/* ── plumbing ────────────────────────────────────────────────────────── */

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', ...opts });
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function nakKeyGen() { return sh('nak key generate').trim(); }
function nakPub(sk) { return sh(`nak key public ${sk}`).trim(); }
function nakSign({ kind, tags, content, sk }) {
  const args = ['event', '-k', String(kind)];
  for (const tag of tags) args.push('--tag', `${tag[0]}=${tag.slice(1).join('=')}`);
  args.push('--sec', sk, '-c', content);
  return JSON.parse(execFileSync('nak', args).toString().trim());
}
async function publish(ev) {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/strfry/publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: ev, signAs: 'client' }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.success === false) throw new Error(`publish failed: ${r.status} ${JSON.stringify(j)}`);
}
function readSettings() {
  try { return JSON.parse(sh(`docker exec ${CONTAINER} cat ${SETTINGS}`, { stdio: ['pipe', 'pipe', 'pipe'] })); }
  catch { return {}; }
}
function writeSettings(obj) {
  execFileSync('docker', ['exec', '-i', CONTAINER, 'sh', '-c', `cat > ${SETTINGS}`],
    { input: JSON.stringify(obj, null, 2) + '\n' });
}
function setMethod(method) {
  const s = readSettings();
  writeSettings({ ...s, trustedLists: { ...(s.trustedLists || {}), membershipMethod: method } });
  console.log(`⚠ SET pipeline membership method: ${method} (settings.json)`);
}
async function strfryScan(filter) {
  const safe = JSON.stringify(filter).replace(/"/g, '\\"');
  const out = sh(`docker exec ${CONTAINER} sh -c 'strfry scan "${safe}" 2>/dev/null'`, { maxBuffer: 20 * 1024 * 1024 });
  return out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
async function refresh() {
  const out = sh(`docker exec ${CONTAINER} curl -s -X POST http://127.0.0.1:7778/api/trusted-list/refresh-all-pinned-tags`, { timeout: 600000 });
  if (!JSON.parse(out || '{}').success) throw new Error(`refresh failed: ${out.slice(0, 200)}`);
}

/* ── main ────────────────────────────────────────────────────────────── */

async function main() {
  const arg = process.argv[2] || 'input';
  const runAll = arg === '--all' || arg === 'all';
  const methods = runAll ? [...IMPLEMENTED_METHOD_IDS] : [arg];
  for (const m of methods) {
    if (!METHOD_IDS.includes(m)) throw new Error(`unknown method "${m}" (methods: ${METHOD_IDS.join(', ')})`);
    if (!IMPLEMENTED_METHOD_IDS.includes(m)) {
      throw new Error(`method "${m}" is not implemented yet — the pipeline would fall back to count and this table would lie. Implemented: ${IMPLEMENTED_METHOD_IDS.join(', ')}`);
    }
  }
  console.log(`\n══ TL ladder validation kit — method(s): ${methods.join(', ')} ══\n`);

  // 0. Preconditions.
  sh('command -v nak');
  sh(`docker exec ${CONTAINER} true`);
  const policy = await (await fetch(`${CONTROL_PANEL_BASE}/api/publish-policy`)).json();
  if (policy?.allowExternalPublish !== false) {
    throw new Error('publish policy is NOT local-only — refusing to seed fixtures');
  }
  console.log('✓ preconditions: nak, container, local-only publish policy');

  // 0.5 Prune prior fixture debris (OPEN 182) so refresh stays fast.
  // Skip with --no-prune (second arg).
  if (!process.argv.includes('--no-prune')) {
    console.log('… pruning prior fixture events (scripts/tl-prune-fixtures.js)');
    sh(`node ${__dirname}/tl-prune-fixtures.js`, { timeout: 600000 });
  }

  // 1. House POV (seed if absent).
  let settings = readSettings();
  const sp = settings.grapevine?.searchPreferences;
  if (!sp?.delegatedPubkey || !sp?.filters?.rank?.enabled) {
    settings = {
      ...settings,
      grapevine: {
        ...(settings.grapevine || {}),
        searchPreferences: {
          ...(sp || {}),
          delegatedPubkey: DEV_DELEGATE,
          filters: { ...(sp?.filters || {}), rank: { enabled: true, cutoff: 3 } },
        },
      },
    };
    writeSettings(settings);
    console.log(`⚠ SEEDED house POV: delegate ${DEV_DELEGATE.slice(0, 8)}…, rank gate ≥ 3 (settings.json)`);
  }
  const povSuffix = readSettings().grapevine.searchPreferences.delegatedPubkey.slice(0, 8);
  const rankField = `wot_rank_${povSuffix}`;

  // 2. Seed fixture ONCE (shared by every method run).
  const stamp = `tlkit-${Date.now().toString(36)}`;
  const tagAuthorSk = nakKeyGen(); const tagAuthorPk = nakPub(tagAuthorSk);
  const viewerSk = nakKeyGen(); const viewerPk = nakPub(viewerSk);
  const slug = `${stamp}-scores`;
  const tagEvent = nakSign({
    kind: 39999, tags: [['d', slug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug, name: `TL ladder kit ${stamp}`, description: '' } }), sk: tagAuthorSk,
  });
  await publish(tagEvent);

  const targets = {};
  const seededDocs = [];
  for (const sc of SCENARIOS) {
    const tSk = nakKeyGen(); const tPk = nakPub(tSk);
    targets[sc.key] = tPk;
    for (const [rank, vote] of sc.taggings) {
      const sk = nakKeyGen(); const pk = nakPub(sk);
      seededDocs.push({ id: pk, pubkey: pk, name: `${stamp}-tagger-${sc.key}-${rank}`, [rankField]: rank });
      await publish(nakSign({
        kind: 39999,
        tags: [
          ['d', `profile-tag-${slug}-${tPk.slice(0, 8)}-${pk.slice(0, 8)}`],
          ['p', tPk], ['e', tagEvent.id], ['z', NOSTR_USER_TAG_HANDLE], ['polarity', String(vote)],
        ],
        content: JSON.stringify({ nostrUserTag: { taggedPubkey: tPk, tagEventId: tagEvent.id } }), sk,
      }));
    }
  }
  const up = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seededDocs),
  });
  if (!up.ok) throw new Error(`meili seed failed: ${up.status}`);
  console.log(`✓ seeded ${seededDocs.length} tagger ranks + ${SCENARIOS.length} scenario targets under one tag`);

  const lastPk = seededDocs[seededDocs.length - 1].pubkey;
  let indexed = false;
  for (let i = 0; i < 60; i++) {
    const r = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents/${lastPk}`);
    if (r.ok && typeof (await r.json())[rankField] === 'number') { indexed = true; break; }
    await sleep(2000);
  }
  if (!indexed) throw new Error('meili did not index the seeded ranks in time — re-run in a minute');
  console.log('✓ meili indexed the seeded ranks');

  const curationMethod = { observer: viewerPk, method: 'nip85:rank', cutoff: 1, includeScoreInTL: false };
  await publish(nakSign({
    kind: 39999,
    tags: [
      ['d', `tag-pin-${slug}-${tagAuthorPk.slice(0, 8)}-${viewerPk.slice(0, 8)}`],
      ['e', tagEvent.id], ['a', `39999:${tagAuthorPk}:${slug}`], ['z', TAG_PINNING_HANDLE],
      ['curation-method', JSON.stringify(curationMethod)],
    ],
    content: JSON.stringify({ tagPinning: { tagEventId: tagEvent.id, curationMethod } }), sk: viewerSk,
  }));
  await sleep(800);

  // 3. Per method: set → refresh → read back.
  const taPubkey = (await (await fetch(`${CONTROL_PANEL_BASE}/api/assistant/pubkey`)).json()).pubkey;
  const dTag = `tl-pin-${viewerPk.slice(0, 8)}-${tagAuthorPk.slice(0, 8)}-${slug}`;
  const results = {}; // method → { tl, wireMethod }
  for (const method of methods) {
    setMethod(method);
    console.log(`… refreshing under "${method}" (this is the slow part)`);
    await refresh();
    await sleep(800);
    const tls = await strfryScan({ kinds: [30392], authors: [taPubkey], '#d': [dTag] });
    tls.sort((a, b) => b.created_at - a.created_at);
    const tl = tls[0];
    if (!tl) throw new Error(`no TL published at ${dTag} under ${method}`);
    results[method] = { tl, wireMethod: tl.tags.find((t) => t[0] === 'membership-method')?.[1] };
  }

  // 4. Combined report.
  let failures = 0;
  const cell = (method, sc) => {
    const { tl } = results[method];
    const exp = expectation(method, sc.taggings);
    const p = tl.tags.find((t) => t[0] === 'p' && t[1] === targets[sc.key]);
    let member = null;
    try { member = (JSON.parse(tl.content).members || []).find((m) => m.pubkey === targets[sc.key]); } catch {}
    if (exp.kind === 'member') {
      const ok = !!p && member?.endorsements === exp.applies && member?.disputes === exp.disputes;
      if (!ok) failures += 1;
      return { text: p ? `member ${member?.endorsements ?? '?'}↑ ${member?.disputes ?? '?'}↓` : 'NOT MEMBER', ok };
    }
    const ok = !!p && p[3] === String(exp.value);
    if (!ok) failures += 1;
    return { text: p ? (p[3] !== undefined ? p[3] : '(no score)') : '(not member)', ok, expected: exp.value };
  };

  console.log(`\nd-tag: ${dTag}`);
  for (const method of methods) {
    const wm = results[method].wireMethod;
    if (wm !== method) { failures += 1; console.log(`✗ under "${method}" the wire records "${wm}" (POV gate unresolvable?)`); }
  }
  const header = ['scenario', 'description'.padEnd(53)].concat(
    methods.map((m) => `${m} (expected)`.padEnd(22))).join('  ');
  console.log(`\n${header}`);
  console.log('─'.repeat(header.length));
  for (const sc of SCENARIOS) {
    const cells = methods.map((m) => {
      const c = cell(m, sc);
      const expText = expectation(m, sc.taggings);
      const expStr = expText.kind === 'member' ? `${expText.applies}↑ ${expText.disputes}↓` : String(expText.value);
      return `${c.ok ? '✓' : '✗'} ${c.text} (${expStr})`.padEnd(22);
    });
    console.log([sc.key.padEnd(8), sc.desc.padEnd(53).slice(0, 53)].concat(cells).join('  '));
  }
  const lastMethod = methods[methods.length - 1];
  console.log(`\nraw p-tags (under "${lastMethod}"):\n${results[lastMethod].tl.tags.filter((t) => t[0] === 'p').map((t) => '  ' + JSON.stringify(t)).join('\n')}`);
  console.log(`\n(pipeline method left set to "${lastMethod}")`);
  console.log(failures === 0 ? '\n══ ALL SCENARIOS MATCH ══' : `\n══ ${failures} MISMATCH(ES) ══`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`kit failed: ${e.message}`); process.exit(1); });
