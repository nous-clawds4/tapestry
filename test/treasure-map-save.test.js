'use strict';
/**
 * treasure-map-edit #5: Edit mode — Save signs and publishes the edited Map.
 *
 * Story: engineering-team/stories/treasure-map-edit/5-save-the-edited-map.md
 * ADR:   engineering-team/decisions/treasure-map-edit/0005-save-is-one-pure-sequence-with-injected-effects.md
 * Plan:  engineering-team/stories/treasure-map-edit/5-save-the-edited-map.test-plan.md
 * Browser half: tests/brainstorm/treasure-map-save.spec.js (what a viewer sees and does).
 *
 * Classes (pure; the save sequence is ui/src/pages/treasure-map/saveTreasureMap.js, driven with fakes):
 *   K — isNewer(latest, base): what counts as a newer Map.                                                     [AC-5]
 *   M — stampFor(base, now): a created_at that replaces the published Map.                                     [AC-2]
 *   C — cleanSave(result): "accepted everywhere".                                                              [AC-6]
 *   Q — saveTreasureMap: the order of the checks, each refusal, each outcome, and what is signed.   [AC-2, AC-5..AC-8]
 *   P — planEdit's `changed`: Save is on only when the edited Map differs.                                     [AC-1]
 *   O — setOverrideAll(pending, on, duties): only the cards with duties (book decision 18).                    [AC-9]
 *   R — the publish report's `subject`: "Your Treasure Map", unquoted; old callers unchanged.                  [AC-6]
 *   W — the words (story § Copy).                                                                    [AC-4..AC-7]
 *   S — source sentinels: the sequence is pure; only useMapSave signs and publishes; the page saves
 *       through it; the edit state can finish.                                                   [AC-2, AC-3, AC-6]
 *
 * Everything here FAILS against story 4's code: saveTreasureMap.js and useMapSave.js don't exist, planEdit has no
 * `changed`, setOverrideAll turns on every card, describeTaggingPublish quotes its subject, COPY.edit has none of
 * Save's words, and useMapEdit has no finish.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const DIR = path.join(REPO, 'ui/src/pages/treasure-map');
const SAVE = path.join(DIR, 'saveTreasureMap.js');
const SAVE_HOOK = path.join(DIR, 'useMapSave.js');
const EDIT_MODEL = path.join(DIR, 'editTreasureMap.js');
const EDIT_HOOK = path.join(DIR, 'useMapEdit.js');
const VIEW_MODEL = path.join(DIR, 'manageTreasureMap.js');
const PAGE = path.join(DIR, 'Index.jsx');
const REPORT = path.join(REPO, 'ui/src/utils/taggingPublishReport.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const VIEWER = 'a1'.repeat(32);
const OTHER = 'e1'.repeat(32);
const R0 = 'wss://old.example';
const RELAYS = ['wss://one.example', 'wss://two.example'];
const LETTER = { [A]: 'A', [B]: 'B', [C]: 'C', [VIEWER]: 'V', [OTHER]: 'O' };

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' && LETTER[x] ? LETTER[x] : x));
const rel = (p) => path.relative(REPO, p);
const clone = (v) => JSON.parse(JSON.stringify(v));

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

const cache = {};
async function esm(absPath, what) {
  if (cache[absPath]) return cache[absPath];
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { cache[absPath] = await import(`${pathToFileURL(absPath).href}?t=${Date.now()}`); } catch (err) {
    throw new Error(`${rel(absPath)} could not be loaded in Node: ${err.message}`);
  }
  return cache[absPath];
}
async function saveFn(name) {
  const mod = await esm(SAVE, 'The save sequence (ADR treasure-map-edit/0005 sub-decision 1).');
  assert(typeof mod[name] === 'function', `${rel(SAVE)} does not export ${name}() (ADR 0005 sub-decision 1)`);
  return mod[name];
}
async function editFn(name) {
  const mod = await esm(EDIT_MODEL, 'The edit model.');
  assert(typeof mod[name] === 'function', `${rel(EDIT_MODEL)} does not export ${name}()`);
  return mod[name];
}
async function words() {
  const { COPY } = await esm(VIEW_MODEL, 'The page view-model.');
  return (COPY && COPY.edit) || {};
}

const BASE = { id: '9'.repeat(64), pubkey: VIEWER, created_at: 1790121600, kind: 10040, content: 'kept', sig: 'f'.repeat(128),
  tags: [['30382:rank', A, R0]] };
const DRAFT = { kind: 10040, pubkey: VIEWER, content: 'kept', tags: [['30382:rank', B, ''], ['3038x', B, '']] };
const NOW = 1800000000;

/**
 * Fakes for the save sequence's effects. Each records its call in `calls`, in order.
 * @param {object} o  signer: 'ok'|'none'|'mismatch'; latest: an event, null, or 'throw'; sign: 'ok'|'decline'|'mismatch';
 *   publish: a publishEverywhere result, or 'throw'.
 */
function fakes(o = {}) {
  const calls = [];
  const signed = [];
  const published = [];
  const mismatch = () => Object.assign(new Error(`Your signer is on a different account (…${OTHER.slice(-6)}) than you’re signed in as (…${VIEWER.slice(-6)}).`), { code: 'SIGNER_MISMATCH', name: 'SignerMismatchError' });
  const deps = {
    readLatest: async () => {
      calls.push('readLatest');
      if (o.latest === 'throw') throw new Error('no relay answered');
      return o.latest === undefined ? null : o.latest;
    },
    activeSigner: async (expected) => {
      calls.push(`activeSigner:${LETTER[expected] || expected}`);
      if (o.signer === 'none') throw new Error('No NIP-07 extension detected.');
      if (o.signer === 'mismatch') throw mismatch();
      return expected;
    },
    sign: async (unsigned) => {
      calls.push('sign');
      signed.push(clone(unsigned));
      if (o.sign === 'decline') throw new Error('User rejected the request');
      if (o.sign === 'mismatch') throw mismatch();
      return { ...unsigned, id: '7'.repeat(64), sig: 'e'.repeat(128) };
    },
    publish: async (event) => {
      calls.push('publish');
      published.push(clone(event));
      if (o.publish === 'throw') throw new Error('network down');
      return o.publish || { local: { success: true }, external: { successes: RELAYS, failures: [], details: { [RELAYS[0]]: { status: 'accepted', reason: '' }, [RELAYS[1]]: { status: 'accepted', reason: '' } } } };
    },
    now: () => NOW,
  };
  return { deps, calls, signed, published };
}
async function save(o = {}, input = {}) {
  const saveTreasureMap = await saveFn('saveTreasureMap');
  const f = fakes(o);
  const args = { viewer: VIEWER, base: BASE, draft: DRAFT, relays: RELAYS, deps: f.deps, ...input };
  const before = clone({ base: args.base, draft: args.draft });
  let got;
  try { got = await saveTreasureMap(args); } catch (err) { throw new Error(`saveTreasureMap threw ${err.message} (it must answer every case with an outcome)`); }
  assert(show({ base: args.base, draft: args.draft }) === show(before), 'saveTreasureMap changed its base or draft');
  assert(got && typeof got === 'object', `saveTreasureMap answered ${show(got)}`);
  return { got, ...f };
}
const PARTIAL = { local: { success: true }, external: { successes: [RELAYS[0]], failures: [RELAYS[1]], details: { [RELAYS[0]]: { status: 'accepted', reason: '' }, [RELAYS[1]]: { status: 'refused', reason: 'blocked' } } } };
const LOCAL_ONLY = { local: { success: true }, external: { successes: [], failures: [], skippedByGate: true } };
const RELAYS_ONLY = { local: { success: false, error: 'disk full' }, external: { successes: RELAYS, failures: [], details: { [RELAYS[0]]: { status: 'accepted', reason: '' }, [RELAYS[1]]: { status: 'accepted', reason: '' } } } };
const NOWHERE = { local: { success: false, error: 'disk full' }, external: { successes: [], failures: RELAYS, details: { [RELAYS[0]]: { status: 'refused', reason: 'blocked' }, [RELAYS[1]]: { status: 'unreachable', reason: 'connection failure' } } } };

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// K — isNewer
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('K1: a different Map at the same time or later is newer; the same Map, or an older one, is not; any Map is newer than none', async () => {
  const isNewer = await saveFn('isNewer');
  const cases = [
    [{ ...BASE, id: '8'.repeat(64), created_at: BASE.created_at + 60 }, BASE, true, 'later, another id'],
    [{ ...BASE, id: '8'.repeat(64) }, BASE, true, 'the same time, another id (to be safe)'],
    [BASE, BASE, false, 'the same Map'],
    [{ ...BASE, id: '8'.repeat(64), created_at: BASE.created_at - 60 }, BASE, false, 'an older Map'],
    [null, BASE, false, 'nothing found'],
    [BASE, null, true, 'a Map where the page read none'],
    [null, null, false, 'none, and none'],
  ];
  const wrong = [];
  for (const [latest, base, want, label] of cases) {
    let got;
    try { got = isNewer(latest, base); } catch (err) { got = `threw ${err.message}`; }
    if (got !== want) wrong.push(`${label}: want ${want}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// M — stampFor
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('M1: now, unless the published Map is as new or newer — then one second after it; with no Map, now', async () => {
  const stampFor = await saveFn('stampFor');
  const wrong = [];
  const check = (base, now, want, label) => { const got = stampFor(base, now); if (got !== want) wrong.push(`${label}: want ${want}, got ${show(got)}`); };
  check(BASE, NOW, NOW, 'an older Map');
  check({ ...BASE, created_at: NOW + 500 }, NOW, NOW + 501, 'a Map stamped in the future (clock skew)');
  check({ ...BASE, created_at: NOW }, NOW, NOW + 1, 'a Map stamped this second');
  check(null, NOW, NOW, 'no Map');
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// C — cleanSave
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('C1: clean only when this instance\'s relay and every outside relay tried accepted it', async () => {
  const cleanSave = await saveFn('cleanSave');
  const { deps } = fakes();
  const everywhere = await deps.publish({});
  const cases = [
    [everywhere, true, 'everywhere'],
    [PARTIAL, false, 'one relay refused'],
    [LOCAL_ONLY, false, 'the publish policy kept it local'],
    [RELAYS_ONLY, false, 'every relay, but not this instance\'s'],
    [NOWHERE, false, 'nowhere'],
    [{ local: { success: true }, external: { successes: [], failures: [], details: {} } }, false, 'no outside relay tried'],
    [null, false, 'no result'],
  ];
  const wrong = [];
  for (const [result, want, label] of cases) {
    let got;
    try { got = cleanSave(result); } catch (err) { got = `threw ${err.message}`; }
    if (got !== want) wrong.push(`${label}: want ${want}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Q — saveTreasureMap
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('Q1: accepted everywhere — the signer check, the newer-Map check, sign, publish, in that order; outcome "saved"', async () => {
  const { got, calls } = await save();
  assert(show(calls) === show(['activeSigner:V', 'readLatest', 'sign', 'publish']), `calls: ${show(calls)}`);
  assert(got.outcome === 'saved', `outcome: ${show(got.outcome)}`);
  assert(got.signed && got.signed.id === '7'.repeat(64), `signed: ${show(got.signed)}`);
  assert(got.report && got.report.ok === true, `report: ${show(got.report)}`);
});
test('Q2: what is signed — the viewer\'s kind 10040, the draft\'s content and tags exactly, created_at from stampFor; what is published is what was signed', async () => {
  const { got, signed, published } = await save({}, { base: { ...BASE, created_at: NOW + 10 } });
  const want = { kind: 10040, pubkey: VIEWER, created_at: NOW + 11, content: DRAFT.content, tags: DRAFT.tags };
  assert(signed.length === 1 && show(signed[0]) === show(want), `signed ${show(signed)}; want ${show(want)}`);
  assert(published.length === 1 && published[0].id === '7'.repeat(64) && show(published[0].tags) === show(DRAFT.tags), `published ${show(published)}`);
  assert(got.outcome === 'saved', `outcome: ${show(got.outcome)}`);
});
test('Q3: the wrong Map — no viewer, no draft, a draft or base of someone else — is "not-sent" with reason "viewer", and nothing is asked of the signer', async () => {
  const cases = [
    [{ viewer: null }, 'no viewer'],
    [{ draft: null }, 'no draft'],
    [{ draft: { ...DRAFT, pubkey: OTHER } }, 'a draft of someone else'],
    [{ base: { ...BASE, pubkey: OTHER } }, 'a Map read for someone else'],
  ];
  const wrong = [];
  for (const [input, label] of cases) {
    const { got, calls } = await save({}, input);
    if (got.outcome !== 'not-sent' || got.reason !== 'viewer') wrong.push(`${label}: ${show({ outcome: got.outcome, reason: got.reason })}`);
    if (calls.length !== 0) wrong.push(`${label}: called ${show(calls)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});
test('Q4: no signer extension — "not-sent", "no-signer", the story\'s words; nothing read, signed or published', async () => {
  const e = await words();
  const { got, calls } = await save({ signer: 'none' });
  assert(got.outcome === 'not-sent' && got.reason === 'no-signer', `got ${show({ outcome: got.outcome, reason: got.reason })}`);
  assert(got.message === e.noSigner && typeof e.noSigner === 'string', `message ${show(got.message)}; COPY.edit.noSigner is ${show(e.noSigner)}`);
  assert(show(calls) === show(['activeSigner:V']), `calls: ${show(calls)}`);
});
test('Q5: the signer on another account — "mismatch", with the app\'s own words; nothing signed or published', async () => {
  const { got, calls } = await save({ signer: 'mismatch' });
  assert(got.outcome === 'not-sent' && got.reason === 'mismatch', `got ${show({ outcome: got.outcome, reason: got.reason })}`);
  assert(/different account/.test(got.message || ''), `message ${show(got.message)} should be the SignerMismatchError's words`);
  assert(!calls.includes('sign') && !calls.includes('publish'), `calls: ${show(calls)}`);
  const late = await save({ sign: 'mismatch' });
  assert(late.got.outcome === 'not-sent' && late.got.reason === 'mismatch', `a signer that signs as someone else: ${show({ outcome: late.got.outcome, reason: late.got.reason })}`);
  assert(!late.calls.includes('publish'), `a signer that signs as someone else must not publish: ${show(late.calls)}`);
});
// Re-aimed at Amendment 1 (book decision 19): the answer carries the newer Map, which the page then shows.
test('Q6: a newer Map since the page read it — "changed", the story\'s words, and the newer Map itself; nothing signed or published', async () => {
  const e = await words();
  const newer = { ...BASE, id: '8'.repeat(64), created_at: BASE.created_at + 30 };
  const { got, calls } = await save({ latest: newer });
  assert(got.outcome === 'not-sent' && got.reason === 'changed', `got ${show({ outcome: got.outcome, reason: got.reason })}`);
  assert(got.latest && got.latest.id === newer.id, `the answer carries the newer Map: ${show(got.latest)}`);
  assert(got.message === e.changedSince && typeof e.changedSince === 'string', `message ${show(got.message)}; COPY.edit.changedSince is ${show(e.changedSince)}`);
  assert(!calls.includes('sign') && !calls.includes('publish'), `calls: ${show(calls)}`);
  const none = await save({ latest: BASE }, { base: null, draft: { ...DRAFT } });
  assert(none.got.reason === 'changed', `a Map appeared where the page read none: ${show({ outcome: none.got.outcome, reason: none.got.reason })}`);
});
test('Q7: the check never blocks on the same Map, an older one, or a read that answers nothing', async () => {
  const wrong = [];
  for (const [latest, label] of [[BASE, 'the same Map'], [{ ...BASE, id: '8'.repeat(64), created_at: BASE.created_at - 30 }, 'an older Map'], ['throw', 'the read failed'], [null, 'nothing found']]) {
    const { got, calls } = await save({ latest });
    if (got.outcome !== 'saved') wrong.push(`${label}: ${show({ outcome: got.outcome, reason: got.reason })}`);
    if (!calls.includes('publish')) wrong.push(`${label}: never published`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});
test('Q8: the person declines to sign — "declined", the story\'s words; nothing published', async () => {
  const e = await words();
  const { got, calls } = await save({ sign: 'decline' });
  assert(got.outcome === 'not-sent' && got.reason === 'declined', `got ${show({ outcome: got.outcome, reason: got.reason })}`);
  assert(got.message === e.declined && typeof e.declined === 'string', `message ${show(got.message)}; COPY.edit.declined is ${show(e.declined)}`);
  assert(!calls.includes('publish'), `calls: ${show(calls)}`);
});
test('Q9: accepted somewhere but not everywhere — "partial", with the report in "Your Treasure Map" words', async () => {
  const wrong = [];
  const cases = [
    [PARTIAL, /^Your Treasure Map was saved on this instance['’]s relay and accepted by 1 of 2 relays\./, 'one relay refused'],
    [LOCAL_ONLY, /^Your Treasure Map was saved on this instance['’]s relay only/, 'the publish policy kept it local'],
    [RELAYS_ONLY, /^Your Treasure Map could not be saved on this instance['’]s relay \(disk full\), but 2 of 2 relays accepted it\./, 'only the outside relays'],
  ];
  for (const [publish, message, label] of cases) {
    const { got } = await save({ publish });
    if (got.outcome !== 'partial') wrong.push(`${label}: outcome ${show(got.outcome)}`);
    if (!got.report || got.report.ok !== true || !message.test(got.report.message || '')) wrong.push(`${label}: report ${show(got.report && got.report.message)}`);
    if (!got.signed) wrong.push(`${label}: no signed event returned`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});
test('Q10: accepted nowhere, or the publish threw — "failed", with the report saying so', async () => {
  const wrong = [];
  for (const [publish, label] of [[NOWHERE, 'every relay refused and the local write failed'], ['throw', 'the publish threw']]) {
    const { got } = await save({ publish });
    if (got.outcome !== 'failed') wrong.push(`${label}: outcome ${show(got.outcome)}`);
    if (!got.report || got.report.ok !== false || !/^Your Treasure Map could not be saved/.test(got.report.message || '')) wrong.push(`${label}: report ${show(got.report && got.report.message)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});
test('Q11: with no Map found — a new Map, stamped now, holding only what the edit added', async () => {
  const draft = { kind: 10040, pubkey: VIEWER, content: '', tags: [['3038x', B, '']] };
  const { got, signed } = await save({}, { base: null, draft });
  assert(got.outcome === 'saved', `outcome ${show(got.outcome)}`);
  assert(show(signed[0]) === show({ kind: 10040, pubkey: VIEWER, created_at: NOW, content: '', tags: [['3038x', B, '']] }), `signed ${show(signed)}`);
});

test('Q12: a save no longer current (isCurrent false) — "stale", checked just before signing and again just before publishing; nothing after it runs (Amendment 1)', async () => {
  const saveTreasureMap = await saveFn('saveTreasureMap');
  const wrong = [];
  for (const [failAt, label, mustNot] of [[1, 'before signing', ['sign', 'publish']], [2, 'before publishing', ['publish']]]) {
    const f = fakes();
    let asks = 0;
    f.deps.isCurrent = () => { asks++; return asks < failAt; };
    let got;
    try { got = await saveTreasureMap({ viewer: VIEWER, base: BASE, draft: DRAFT, relays: RELAYS, deps: f.deps }); } catch (err) { got = { threw: err.message }; }
    if (!got || got.outcome !== 'not-sent' || got.reason !== 'stale') wrong.push(`${label}: ${show(got)}`);
    for (const call of mustNot) if (f.calls.includes(call)) wrong.push(`${label}: still called ${call}`);
  }
  const omitted = await save();
  if (omitted.got.outcome !== 'saved') wrong.push(`no isCurrent given: want saved, got ${show(omitted.got.outcome)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// P — planEdit's `changed`
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const MAP = { ...BASE, content: '', tags: [['30382:rank', A, R0], ['30392', VIEWER, R0], ['39998:dlist-header', VIEWER, R0], ['39998:restaurants', C, R0]] };
const rf = () => '';
test('P1: changed — false with nothing pending, and for a pick that leaves the Map byte-identical; true for a real change', async () => {
  const planEdit = await editFn('planEdit');
  const plan = (pending, event = MAP) => planEdit({ event, viewer: VIEWER, pending, relayFor: rf });
  const wrong = [];
  const cases = [
    [{}, false, 'nothing pending'],
    [{ concepts: VIEWER }, false, 'Concepts → the Assistant its own entry already names (story 3 review, non-blocking 4)'],
    [{ scores: B }, true, 'Scores → B'],
    [{ backups: true }, false, 'the backup switch on a Map with no backups'],
  ];
  for (const [pending, want, label] of cases) {
    const got = plan(pending).changed;
    if (got !== want) wrong.push(`${label}: want ${want}, got ${show(got)}`);
  }
  const withBackup = plan({ backups: true }, { ...MAP, tags: [...MAP.tags, ['30382:rank', C, R0]] }).changed;
  if (withBackup !== true) wrong.push(`the backup switch on a Map with a backup: want true, got ${show(withBackup)}`);
  assert(wrong.length === 0, wrong.join('; '));
});
test('P2: changed with no Map found — true once the edit adds a tag, false before', async () => {
  const planEdit = await editFn('planEdit');
  const none = planEdit({ event: null, viewer: VIEWER, pending: {}, relayFor: rf }).changed;
  const one = planEdit({ event: null, viewer: VIEWER, pending: { lists: B }, relayFor: rf }).changed;
  assert(none === false && one === true, `no Map: nothing pending ${show(none)}, Lists → B ${show(one)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// O — setOverrideAll(pending, on, duties) (book decision 18)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('O1: on turns on only the cards with duties; off clears all three; no empty override; input unchanged', async () => {
  const setOverrideAll = await editFn('setOverrideAll');
  const start = { scores: B, lists: B, concepts: B, everything: B, backups: true };
  const duties = { scores: ['3038x:tag:X'], lists: [], concepts: ['39998:d'] };
  const on = setOverrideAll(start, true, duties);
  assert(show(on.override) === show({ scores: true, concepts: true }) || show(on.override) === show({ concepts: true, scores: true }),
    `on: want override { scores, concepts } only (Lists has no duties), got ${show(on.override)}`);
  assert(on.backups === true && on.everything === B, `on kept the rest? ${show(on)}`);
  const off = setOverrideAll({ ...on, override: { scores: true, lists: true, concepts: true } }, false, duties);
  assert(!('override' in off), `off: want no override key, got ${show(off.override)}`);
  assert(!('override' in start), 'setOverrideAll changed its input');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// R — the publish report's subject
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('R1: describeTaggingPublish takes a subject used as written; without one, the quoted name as before', async () => {
  const { describeTaggingPublish } = await esm(REPORT, 'The publish report.');
  const relays = RELAYS;
  const withSubject = describeTaggingPublish({ name: 'x', subject: 'Your Treasure Map', local: PARTIAL.local, external: PARTIAL.external, relays });
  assert(/^Your Treasure Map was saved/.test(withSubject.message), `with subject: ${show(withSubject.message)}`);
  const without = describeTaggingPublish({ name: 'Nashville', local: PARTIAL.local, external: PARTIAL.external, relays });
  assert(/^"Nashville" was saved/.test(without.message), `without subject: ${show(without.message)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// W — the words (story § Copy)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('W1: Save\'s words, exactly (apostrophes curly, as the page\'s other words)', async () => {
  const e = await words();
  const want = {
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Treasure Map updated',
    reportSubject: 'Your Treasure Map',
    changedSince: 'Your Treasure Map changed since this page read it. The page now shows the new one, with your changes on top; check them and save again.',
    noSigner: 'Couldn’t save: no Nostr signer was found in this browser.',
    declined: 'Couldn’t save: the signature was declined.',
  };
  const wrong = Object.entries(want).filter(([k, v]) => e[k] !== v).map(([k, v]) => `COPY.edit.${k}: want ${show(v)}, got ${show(e[k])}`);
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — source sentinels (ADR 0005 sub-decisions 1, 3, 5, 6)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('S1: the save sequence is pure — no React, window, fetch, signer or publish module; only .js-suffixed imports', () => {
  const src = codeOnly(safeRead(SAVE));
  assert(src, `${rel(SAVE)} does not exist`);
  const wrong = [];
  if (/from\s+['"]react['"]/.test(src)) wrong.push('it imports React');
  const bad = src.match(/\b(window\.|fetch\s*\(|localStorage|sessionStorage)/);
  if (bad) wrong.push(`it uses ${bad[1]}`);
  const imp = src.match(/from\s+['"][^'"]*(signerGuard|nostrPublish|publishProfileTag)[^'"]*['"]/);
  if (imp) wrong.push(`it imports ${imp[0]}`);
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) if (!m[1].endsWith('.js')) wrong.push(`import ${m[1]} lacks .js`);
  assert(wrong.length === 0, `${rel(SAVE)}: ${wrong.join('; ')}`);
});
test('S2: useMapSave wires the real effects — the signer check, window.nostr.signEvent, publishEverywhere — and nothing else signs; no taPubkey or literal key', () => {
  const src = codeOnly(safeRead(SAVE_HOOK));
  assert(src, `${rel(SAVE_HOOK)} does not exist`);
  const wrong = [];
  if (!/getActiveSignerOrThrow/.test(src)) wrong.push('it doesn\'t use getActiveSignerOrThrow');
  if (!/assertSignerMatches/.test(src)) wrong.push('it doesn\'t check the signed event\'s pubkey with assertSignerMatches');
  if (!/window\.nostr\.signEvent/.test(src)) wrong.push('it doesn\'t sign with window.nostr.signEvent');
  if (!/publishEverywhere/.test(src)) wrong.push('it doesn\'t publish with publishEverywhere');
  if (!/getSessionPubkey/.test(src)) wrong.push('it doesn\'t check the session is still the viewer\'s (getSessionPubkey; Amendment 1)');
  if (!/from\s+['"]\.\/saveTreasureMap(\.js)?['"]/.test(src)) wrong.push('it doesn\'t take the sequence from ./saveTreasureMap');
  if (/\btaPubkey\b/.test(src)) wrong.push('it uses taPubkey');
  if (/[0-9a-f]{64}/i.test(src)) wrong.push('it contains a 64-hex literal');
  assert(wrong.length === 0, `${rel(SAVE_HOOK)}: ${wrong.join('; ')}`);
});
test('S3: the page saves through useMapSave, never signing or publishing itself, and offers COPY.edit.save', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  if (!/from\s+['"]\.\/useMapSave(\.js)?['"]/.test(src)) wrong.push('it doesn\'t import ./useMapSave');
  const imp = src.match(/from\s+['"][^'"]*(signerGuard|nostrPublish|publishProfileTag)[^'"]*['"]/);
  if (imp) wrong.push(`it imports ${imp[0]} (only useMapSave signs and publishes)`);
  if (/\bsignEvent\b|\bpublishEverywhere\b/.test(src)) wrong.push('it signs or publishes itself');
  if (!/COPY\.edit\.save\b/.test(src)) wrong.push('it doesn\'t offer COPY.edit.save');
  assert(wrong.length === 0, `${rel(PAGE)}: ${wrong.join('; ')}`);
});
test('S4: the edit state can finish — Edit off and the changes cleared after a save — and still signs, publishes and stores nothing', () => {
  const src = codeOnly(safeRead(EDIT_HOOK));
  assert(src, `${rel(EDIT_HOOK)} does not exist`);
  assert(/\bfinish\b/.test(src), `${rel(EDIT_HOOK)} offers no finish (ADR 0005 sub-decision 5)`);
  const bad = src.match(/\b(signEvent|getActiveSigner\w*|publish\w*\s*\(|localStorage|sessionStorage)\b/);
  assert(!bad, `${rel(EDIT_HOOK)} uses ${bad && bad[1]}`);
});

async function run() {
  console.log(`${NL}=== treasure-map-save (treasure-map-edit #5) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, f] of tests) {
    try {
      await f();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}treasure-map-save: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };
