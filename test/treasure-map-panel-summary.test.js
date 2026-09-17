/**
 * treasure-map-relay-presence #3: scannable presence panel.
 *
 * Story: engineering-team/stories/treasure-map-relay-presence/3-scannable-presence-panel.md
 * ADR:   engineering-team/decisions/treasure-map-relay-presence/0003-scannable-presence-panel.md
 *
 * Classes (house pattern — see test/tl-treasure-map-panel.test.js):
 *   M (behavioral, pure) — summarizePresence(), ESM-imported. The precedence table IS this
 *                          story's deliverable, so it carries the weight of the suite. M4 pins
 *                          the one ordering the two criteria do not settle between them.
 *   S (structure)        — disclosure + render-site wiring with no Node-reachable surface.
 *   R (sentinel)         — stories 1 and 2 intact. Pass before AND after.
 *
 * Hermetic: no socket, no nostr-tools, no relay writes (OPEN.md rows 13, 75/126/128/141).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PANEL = path.resolve(__dirname, '../ui/src/pages/grapevine/TreasureMapRelayPresence.jsx');
const PAGE = path.resolve(__dirname, '../ui/src/pages/grapevine/TrustedAssertions.jsx');
const UTIL = path.resolve(__dirname, '../ui/src/utils/treasureMap.js');

const AUTHOR = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }

const LOCAL = { id: 'a'.repeat(64), kind: 10040, pubkey: AUTHOR, created_at: 2000 };
const SAME = { id: LOCAL.id, created_at: LOCAL.created_at };
const OTHER = { id: 'b'.repeat(64), created_at: 3000 };   // a different, newer version
const OLDER = { id: 'c'.repeat(64), created_at: 1000 };   // a different, older version

const agreeing = () => ({ status: 'present', event: { ...SAME } });
const divergent = () => ({ status: 'present', event: { ...OTHER } });
const missing = () => ({ status: 'absent', event: null });
const unreachable = () => ({ status: 'unreachable', event: null });
const pending = () => ({ status: 'pending', event: null });

async function summarizer() {
  const mod = await loadEsm(UTIL);
  assert(mod, 'ui/src/utils/treasureMap.js must import cleanly');
  assert(typeof mod.summarizePresence === 'function',
    'ADR 0003 § Implementation notes 1: ui/src/utils/treasureMap.js must export summarizePresence(localEvent, rowStates)');
  return mod.summarizePresence;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── M: the precedence table (AC-2, AC-4) ─────────────────────── */

test('M1: everything agreeing is an explicit all-clear', async () => {
  const summarize = await summarizer();
  const r = summarize(LOCAL, [agreeing(), agreeing(), agreeing()]);
  assert(r.level === 'ok', `AC-2 rung 4: all agreeing must be "ok", got "${r.level}"`);
  assert(r.counts.agreeing === 3, `expected 3 agreeing, got ${r.counts.agreeing}`);
});

test('M2: one divergent relay outranks three missing ones', async () => {
  const summarize = await summarizer();
  const r = summarize(LOCAL, [divergent(), missing(), missing(), missing()]);
  assert(r.level === 'divergent',
    `AC-2: a single stale copy misdirects readers and outranks any number of absences — expected "divergent", got "${r.level}"`);
  // The lower condition may still be reported alongside, so the counts must survive.
  assert(r.counts.divergent === 1 && r.counts.missing === 3,
    `both counts must be available to the caller, got ${JSON.stringify(r.counts)}`);
});

test('M3: missing outranks unreachable', async () => {
  const summarize = await summarizer();
  const r = summarize(LOCAL, [agreeing(), missing(), unreachable()]);
  assert(r.level === 'missing',
    `AC-2 rung 3 beats rung 4 — a missing Map is one click from fixed, an unreachable relay is not; expected "missing", got "${r.level}"`);
});

test('M4: divergent is reported even while other relays are still pending', async () => {
  const summarize = await summarizer();
  const r = summarize(LOCAL, [divergent(), pending(), pending()]);
  assert(r.level === 'divergent',
    `ADR 0003 § Decision: "divergent" sits ABOVE "checking". A divergence is already true and cannot be revoked by a later answer, so suppressing it until the slowest relay answers would hide the most important finding for the whole check. Expected "divergent", got "${r.level}"`);
});

test('M5: nothing but an all-clear or a count is asserted while relays are still pending', async () => {
  const summarize = await summarizer();

  const withMissing = summarize(LOCAL, [agreeing(), missing(), pending()]);
  assert(withMissing.level === 'checking',
    `AC-4: a missing count can still fall (3 may become 2), so it must wait — expected "checking", got "${withMissing.level}"`);

  const allGoodSoFar = summarize(LOCAL, [agreeing(), agreeing(), pending()]);
  assert(allGoodSoFar.level === 'checking',
    `AC-4: an all-clear must never be shown while a relay has not answered — expected "checking", got "${allGoodSoFar.level}"`);

  const withUnreachable = summarize(LOCAL, [unreachable(), pending()]);
  assert(withUnreachable.level === 'checking',
    `AC-4: "unreachable" sits below "checking" too — expected "checking", got "${withUnreachable.level}"`);
});

test('M6: a pending relay is never counted as agreeing', async () => {
  const summarize = await summarizer();
  const r = summarize(LOCAL, [agreeing(), pending(), pending()]);
  assert(r.counts.agreeing === 1,
    `AC-4: only relays that actually answered may count as agreeing — expected 1, got ${r.counts.agreeing}`);
  assert(r.counts.pending === 2, `expected 2 pending, got ${r.counts.pending}`);
});

test('M7: an older differing version is divergent too, not just a newer one', async () => {
  const summarize = await summarizer();
  const r = summarize(LOCAL, [{ status: 'present', event: { ...OLDER } }]);
  assert(r.level === 'divergent',
    `a relay serving an OLDER version is the stale-copy case the story is most concerned with — expected "divergent", got "${r.level}"`);
});

test('M8: with no local copy, a relay holding the Map is not called divergent', async () => {
  const summarize = await summarizer();
  const r = summarize(null, [{ status: 'present', event: { ...OTHER } }]);
  assert(r.level !== 'divergent',
    `with nothing local to differ FROM, a relay's copy is not a divergence — got "${r.level}"`);
  assert(r.counts.divergent === 0, `expected 0 divergent, got ${r.counts.divergent}`);
});

test('M9: unreachable alone is reported as such', async () => {
  const summarize = await summarizer();
  const r = summarize(LOCAL, [agreeing(), unreachable()]);
  assert(r.level === 'unreachable', `AC-2 rung 3: expected "unreachable", got "${r.level}"`);
  assert(r.counts.unreachable === 1, `expected 1 unreachable, got ${r.counts.unreachable}`);
});

test('M10: an empty or malformed input never throws, and reports nothing to say', async () => {
  const summarize = await summarizer();
  for (const [label, local, rowStates] of [
    ['empty', LOCAL, []],
    ['null rows', LOCAL, null],
    ['undefined rows', LOCAL, undefined],
    ['garbage members', LOCAL, [null, {}, { status: 'weird' }]],
    ['no local, no rows', null, []],
  ]) {
    let r;
    try { r = summarize(local, rowStates); } catch (err) {
      throw new Error(`must not throw on ${label}: ${err.message}`);
    }
    assert(r && typeof r.level === 'string' && r.counts,
      `${label}: must still return { level, counts }`);
  }
  assert(summarize(LOCAL, []).counts.total === 0,
    'ADR 0003: an empty panel reports total 0 so the caller can suppress it rather than claiming an all-clear over nothing');
});

/* ── S: disclosure and render-site wiring ─────────────────────── */

test('S1: the panel is collapsed by default, using the page\'s disclosure idiom', () => {
  const src = safeRead(PANEL);
  assert(src, 'the panel must exist');
  assert(/useState\(false\)/.test(src),
    'AC-1: the panel must default to closed (TreasureMapManualEdit.jsx:22 is the sibling precedent)');
  assert(/▾/.test(src) && /▸/.test(src),
    'AC-1: use the page\'s established ▾/▸ disclosure marker rather than a new affordance');
});

test('S2: the summary comes from the shared helper, not an inline count', () => {
  const src = safeRead(PANEL);
  assert(/summarizePresence/.test(src),
    'ADR 0003 § Decision: the precedence rule must come from the testable helper, not be re-derived in JSX');
  assert(!/hold a copy/.test(src),
    'AC-2: the coverage count ("N of M hold a copy") is exactly the statistic this story replaces with a status light');
});

test('S3: the local strfry row is included in what the summary judges', () => {
  const src = safeRead(PANEL);
  assert(/inLocal\s*\?\s*'present'\s*:\s*'absent'/.test(src),
    'ADR 0003 § Decision: local strfry is one of the reported locations and the comparison base — a summary that skipped it would contradict the rows beneath it');
});

test('S4: a differing version\'s timestamp is rendered as text, not only as a tooltip', () => {
  const src = safeRead(PANEL);
  // The value already exists as `detail`; the story is about rendering it. Strip the tooltip
  // occurrence first, so a surviving `{detail}` proves a SECOND, visible use — keeping the
  // tooltip as well is fine, and this deliberately does not forbid it.
  const rendered = /\{detail\}/.test(src.replace(/title=\{detail\}/g, ''));
  assert(rendered,
    'AC-3: `detail` (the relay version\'s creation time) must be rendered as visible text — today it reaches the DOM only via title={detail}, which means in practice it is not available');
});

test('S5: only the rows collapse — the summary is always visible', () => {
  const src = safeRead(PANEL);
  assert(/\{open &&/.test(src),
    'AC-1: the row list must be gated on the open state');
  const openGateIdx = src.indexOf('{open &&');
  const summaryIdx = src.search(/summarizePresence|SUMMARY/);
  assert(summaryIdx !== -1 && summaryIdx < openGateIdx,
    'AC-2: the summary must render outside the collapsed region — a status light you have to open the panel to see is not a status light');
});

/* ── R: sentinels — stories 1 and 2 must survive ──────────────── */

test('R1: every earlier helper is still exported and still behaves', async () => {
  const mod = await loadEsm(UTIL);
  assert(mod, 'treasureMap.js must import cleanly');
  for (const fn of ['classifyEntry', 'findGenericTlDelegation', 'composeManualUpdate',
    'upsertGenericTlTag', 'buildPresenceTargets', 'compareMapVersions', 'planRelaySync']) {
    assert(typeof mod[fn] === 'function', `earlier export must survive: ${fn}`);
  }
  assert(mod.planRelaySync(LOCAL, OLDER).direction === 'push',
    'story 2: planRelaySync still plans a push against an older relay copy');
  assert(mod.compareMapVersions(LOCAL, OTHER) === 'newer',
    'story 1: compareMapVersions still orders a newer relay copy');
});

test('R2: the panel keeps its story-1 and story-2 surface', () => {
  const src = safeRead(PANEL);
  assert(/buildPresenceTargets/.test(src), 'story 1: targets still from the shared helper');
  assert(/useConfig/.test(src), 'story 1: relays still from configuration');
  assert(/Import to local strfry/.test(src), 'story 1: the local-row import affordance survives');
  assert(/probeOne/.test(src), 'story 2: the shared probe path survives');
  assert(/planRelaySync/.test(src), 'story 2: sync direction still decided by the helper');
  assert(/isExternalPublishAllowed/.test(src), 'story 2: the publish-policy gate survives');
  assert(!/Promise\.(all|allSettled)\s*\(/.test(src), 'story 1 AC-5: rows still resolve independently');
  assert(!/wss?:\/\/[a-z0-9]/i.test(src), 'story 1 AC-1: still no relay URL literal');
  assert(!/[0-9a-fA-F]{64}/.test(src), 'CLAUDE.md: still no 64-hex literal');
});

test('R3: the page still mounts every Treasure-Map panel', () => {
  const page = safeRead(PAGE);
  assert(/TreasureMapRelayPresence/.test(page), 'story 1: the presence panel');
  assert(/onMapReplaced=\{search\}/.test(page), 'story 2: the re-read wiring');
  assert(/TlOptInCard/.test(page), 'tl-treasure-map #3');
  assert(/TreasureMapManualEdit/.test(page), 'treasure-map-user-assistant #2');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
