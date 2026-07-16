/**
 * Tests for Story 11 (epic: event-tagging) — a profile's note-taggings.
 * Story: engineering-team/stories/event-tagging/11-profile-tagging-activity-spans-notes.md
 * ADR:   engineering-team/decisions/event-tagging/0010 (+ 0009 model).
 *
 * The author's note-taggings as an asserter-filtered view over the normalized
 * stream. Core seam `taggingsByAsserter` is unit-tested; the endpoint is
 * source-contract + skip-gated HTTP. UI (AuthoredTaggingSection) is manual/held.
 */
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const CORE = '../src/lib/event-tagging';
const EVENT_TAGS = path.join(REPO, 'src/api/event-tags/index.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function read(p) { if (!fs.existsSync(p)) throw new Error(`${p} missing`); return fs.readFileSync(p, 'utf8'); }
function core() { return require(CORE); }

const JACK = '1111111111111111111111111111111111111111111111111111111111111111';
const ALICE = '2222222222222222222222222222222222222222222222222222222222222222';
const NOTE1 = 'a1'.repeat(32);

const tests = [];
const t = (n, f) => tests.push([n, f]);

t('core: taggingsByAsserter filters the normalized stream to one asserter', () => {
  const c = core();
  assert(typeof c.taggingsByAsserter === 'function', 'core must export taggingsByAsserter');
  const stream = [
    { tag: { authorPubkey: JACK, slug: 'x' }, target: { type: 'event', ref: NOTE1 }, stance: 'apply', asserter: ALICE, eventId: 'e1', createdAt: 2 },
    { tag: { authorPubkey: JACK, slug: 'y' }, target: { type: 'profile', ref: JACK }, stance: 'apply', asserter: JACK, eventId: 'e2', createdAt: 1 },
  ];
  const mine = c.taggingsByAsserter(stream, ALICE);
  assert(mine.length === 1 && mine[0].asserter === ALICE && mine[0].target.ref === NOTE1,
    `expected only ALICE's tagging, got ${JSON.stringify(mine)}`);
  assert(c.taggingsByAsserter(stream, 'nope').length === 0, 'unknown asserter → empty');
});

t('src: /api/event-tags/notes-by-author is registered', () => {
  assert(/['"]\/api\/event-tags\/notes-by-author['"]/.test(read(API_INDEX)), 'must register /api/event-tags/notes-by-author');
});

t('src: handler scans by author, normalizes, and enriches the target notes', () => {
  const src = read(EVENT_TAGS);
  assert(/handleNotesByAuthor/.test(src), 'must define handleNotesByAuthor');
  assert(/normalizeTaggings/.test(src) && /taggingsByAsserter/.test(src), 'handler must consume normalizeTaggings + taggingsByAsserter');
  assert(/authors:\s*\[/.test(src), 'handler must scan by authors:[authorPubkey]');
  assert(/enrichNotes/.test(src), 'handler must enrich the target notes (reuse noteEnrichment)');
});

async function httpGet(url) {
  try { const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 5000); const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to); const json = await r.json().catch(() => null); return { status: r.status, json }; }
  catch { return { status: null, json: null }; }
}

t('http: notes-by-author 400s on bad author + 200 with a notes array on a valid one', async () => {
  const probe = await httpGet(`${BASE}/api/event-tags/for-event`);
  if (probe.status === null) return 'SKIP';
  const bad = await httpGet(`${BASE}/api/event-tags/notes-by-author?authorPubkey=not-hex`);
  assert(bad.status === 400, `bad author must 400 (got ${bad.status}); 404 = route not wired`);
  const ok = await httpGet(`${BASE}/api/event-tags/notes-by-author?authorPubkey=${ALICE}`);
  assert(ok.status === 200, `valid author must 200 (got ${ok.status})`);
  assert(ok.json && Array.isArray(ok.json.notes), 'response must include a notes array');
});

async function run() {
  console.log('\n--- event-tagging notes-by-author tests (epic event-tagging, Story 11) ---');
  let pass = 0, fail = 0, skipped = 0; const failures = [];
  for (const [name, fn] of tests) {
    try { const r = await fn(); if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; } }
    catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failures.push({ name, message: e.message }); fail++; }
  }
  console.log(`\nevent-tagging-notes-by-author: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}
if (require.main === module) { run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); }); }
module.exports = { run };
