'use strict';
/**
 * manage-treasure-map #2: the Assistants by category cards on /treasure-map, and story 1's review findings 1, 2, 4.
 *
 * Story: engineering-team/stories/done/manage-treasure-map/2-the-assistants-by-category-cards.md
 * ADR:   engineering-team/decisions/done/manage-treasure-map/0002-the-cards-count-with-their-own-rule-over-the-same-read.md
 * Plan:  engineering-team/stories/done/manage-treasure-map/2-the-assistants-by-category-cards.test-plan.md
 * Browser half: tests/brainstorm/manage-treasure-map-cards.spec.js (what a viewer SEES).
 *
 * Classes:
 *   K — the rule, pure: categoryAssistants(event) in ui/src/pages/treasure-map/manageTreasureMap.js. Every row of the
 *       story's AC-2 example table, then the edges the ADR names (sub-decisions 1–2).                       [AC-2]
 *   C — the cards, pure: categoryCards({ assistants, profiles, localPubkey }) (sub-decision 3).            [AC-1, AC-3]
 *   W — the new words in COPY, exactly (sub-decision 4; story § Copy).                            [AC-1, AC-3, AC-5]
 *   S — source sentinels on the JSX this runner can't execute, and the one export the ADR adds (sub-decisions 5, 6, 8).
 *                                                                                                 [AC-3, AC-4, AC-5]
 *
 * S2 re-aimed by treasure-map-edit #3 (ADR treasure-map-edit/0003): the page may take aRelays, and only aRelays, from
 * useConfig() for the relay an edited entry names; taPubkey stays banned.
 *
 * Re-aimed by treasure-map-edit #2 (book decision 11; ADR treasure-map-edit/0002): K9 and K16, whose `*:tag` entry now
 * counts on no card. That story's test plan records both changes.
 *
 * Everything FAILS against the current code: manageTreasureMap.js has no categoryAssistants, categoryCards or new
 * words; myAssistants.js doesn't export cardFields; the page reads no profiles and its <pre> isn't focusable.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { nip19 } = require('nostr-tools');

const REPO = path.resolve(__dirname, '..');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/treasure-map/manageTreasureMap.js');
const PAGE = path.join(REPO, 'ui/src/pages/treasure-map/Index.jsx');
const MA_VIEW_MODEL = path.join(REPO, 'ui/src/pages/assistants/myAssistants.js');
const PROFILE_BATCH = path.join(REPO, 'ui/src/utils/profileBatch.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const E = 'e1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const R = 'wss://relay.example';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const short = (pk) => (pk ? `${pk.slice(0, 4)}…` : String(pk));
const names = (list) => (Array.isArray(list) ? list.map(short).join(', ') : show(list));

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(`${pathToFileURL(absPath).href}?t=${Date.now()}`); } catch (err) {
    throw new Error(`${rel(absPath)} could not be loaded in Node: ${err.message}`);
  }
}
async function fn(name) {
  const mod = await esm(VIEW_MODEL, 'the page view-model (ADR manage-treasure-map/0001 sub-decision 4)');
  assert(typeof mod[name] === 'function', `${rel(VIEW_MODEL)} does not export ${name}() (ADR 0002)`);
  return mod[name];
}
const mapOf = (entries) => ({ id: '9'.repeat(64), pubkey: 'a1'.repeat(32), kind: 10040, created_at: 1, content: '', sig: 'f'.repeat(128), tags: entries.map(([k, pk]) => [k, pk, R]) });
const npubShort = (pk) => { const n = nip19.npubEncode(pk); return `${n.slice(0, 12)}…${n.slice(-6)}`; };

/** Run categoryAssistants on entries and compare the named categories. */
async function expectCats(entries, want, label) {
  const categoryAssistants = await fn('categoryAssistants');
  let got;
  try { got = categoryAssistants(mapOf(entries)); } catch (err) { throw new Error(`${label}: threw ${err.message}`); }
  const wrong = [];
  for (const [cat, list] of Object.entries(want)) {
    const g = got && got[cat];
    if (show(g) !== show(list)) wrong.push(`${cat}: want [${names(list)}], got [${names(g)}]`);
  }
  assert(wrong.length === 0, `${label} — ${show(entries.map(([k, pk]) => `${k} → ${short(pk)}`))}: ${wrong.join('; ')}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// K — the rule: the story's AC-2 example table, row by row
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('K1: `30382:rank` → A — Scores: A', () => expectCats([['30382:rank', A]], { scores: [A], lists: [], concepts: [] }, 'K1'));
test('K2: rank → A and all Scores (`3038x`) → B — Scores: A and B (the owner’s "it is mixed")', () =>
  expectCats([['30382:rank', A], ['3038x', B]], { scores: [A, B] }, 'K2'));
test('K3: rank → A and everything (`*`) → C — Scores: A and C', () =>
  expectCats([['30382:rank', A], ['*', C]], { scores: [A, C] }, 'K3'));
test('K4: rank → A, `3038x` → B, `*` → C — Scores: A and B; `*` reaches no Score', () =>
  expectCats([['30382:rank', A], ['3038x', B], ['*', C]], { scores: [A, B] }, 'K4'));
test('K5: `3038x:tag` → B and `*` → C — Scores: B and C; `*` still covers Scores that aren’t tag-based', () =>
  expectCats([['3038x:tag', B], ['*', C]], { scores: [B, C] }, 'K5'));
test('K6: rank → A, then rank → B — Scores: A (B is an alternate)', () =>
  expectCats([['30382:rank', A], ['30382:rank', B]], { scores: [A] }, 'K6'));
test('K7: rank → A, followers → A, `3038x` → A — Scores: A, once', () =>
  expectCats([['30382:rank', A], ['30382:followers', A], ['3038x', A]], { scores: [A] }, 'K7'));
test('K8: `*` → C — C on all three cards', () =>
  expectCats([['*', C]], { scores: [C], lists: [C], concepts: [C] }, 'K8'));
test('K9 (treasure-map-edit #2): `*:tag` → D and nothing else is ignored — nothing on any card', () =>
  expectCats([['*:tag', D]], { scores: [], lists: [], concepts: [] }, 'K9'));
test('K10: Concepts — `39998:dog-breed` → A, `39998:dlist-header` → B, `*` → C: A and B', () =>
  expectCats([['39998:dog-breed', A], ['39998:dlist-header', B], ['*', C]], { concepts: [A, B], scores: [C], lists: [C] }, 'K10'));
test('K11: nothing that applies — all three empty', () =>
  expectCats([['99999', A]], { scores: [], lists: [], concepts: [] }, 'K11'));

// ── K — the edges the ADR names ──────────────────────────────────────────────────────────────────────────────────

test('K12: only valid 64-hex delegates count; uppercase ones count lowercased; a key’s first VALID delegate is its Assistant', () =>
  expectCats([
    ['30382:rank', 'not-a-key'],
    ['30382:rank', 'c'.repeat(63)],
    ['30382:rank', A.toUpperCase()],
    ['30392'],
    ['30392', B],
  ], { scores: [A], lists: [B] }, 'K12'));

test('K13: entries of other kinds count for no category — 99999, bare 30000, 30379, 30400, 3040x, **, empty and non-string keys', async () => {
  const categoryAssistants = await fn('categoryAssistants');
  const ev = mapOf([['99999', A], ['30000', A], ['30379', A], ['30400', A], ['3040x', A], ['**', A], ['', A], ['*x', A]]);
  ev.tags.push([42, A, R], [null, A, R], [['30382'], A, R]);
  const got = categoryAssistants(ev);
  assert(show(got) === show({ scores: [], lists: [], concepts: [] }), `want three empty lists, got ${show(got)}`);
});

test('K14: the kind ranges — 30380 and 30389 are Scores, 30390 and 30399 Lists, 39998 and 39999 Concepts', () =>
  expectCats([['30380', A], ['30389:x', B], ['30390', C], ['30399:y', D], ['39998', A], ['39999:z', E]],
    { scores: [A, B], lists: [C, D], concepts: [A, E] }, 'K14'));

test('K15: bare `39998` counts for Concepts and covers them completely, so `*` doesn’t reach Concepts (but still Scores and Lists)', () =>
  expectCats([['39998', A], ['*', C]], { concepts: [A], scores: [C], lists: [C] }, 'K15'));

test('K16 (treasure-map-edit #2): `*:tag` is ignored beside `3038x:tag`, `3038x`, `3038x:dlist` or `3039x:tag` — only the family entry counts', async () => {
  await expectCats([['3038x:tag', B], ['*:tag', D]], { scores: [B], lists: [] }, 'K16a');
  await expectCats([['3038x', B], ['*:tag', D]], { scores: [B], lists: [] }, 'K16b');
  await expectCats([['3038x:dlist', B], ['*:tag', D]], { scores: [B], lists: [] }, 'K16c');
  await expectCats([['3039x:tag', B], ['*:tag', D]], { lists: [B], scores: [] }, 'K16d');
});

test('K17: Lists — own, family-wide and everything together: `30396:tag:x` → A, `3039x` → B, `*` → C gives A and B', () =>
  expectCats([['30396:tag:x', A], ['3039x', B], ['*', C]], { lists: [A, B], scores: [C], concepts: [C] }, 'K17'));

test('K18: Assistants come in the order the Map first names them, without repeats', () =>
  expectCats([['3038x', B], ['30382:rank', A], ['30382:followers', B], ['30383', C]], { scores: [B, A, C] }, 'K18'));

test('K19: a covering entry that has no valid delegate covers nothing — `3038x` with a bad key doesn’t stop `*`', () =>
  expectCats([['3038x', 'nope'], ['*', C]], { scores: [C] }, 'K19'));

test('K20: no event, no tags, or garbage — three empty lists, never a throw', async () => {
  const categoryAssistants = await fn('categoryAssistants');
  for (const ev of [null, undefined, {}, { tags: 'x' }, { tags: [null, 'x', 7, []] }, 'garbage']) {
    let got;
    try { got = categoryAssistants(ev); } catch (err) { throw new Error(`${show(ev)}: threw ${err.message}`); }
    assert(show(got) === show({ scores: [], lists: [], concepts: [] }), `${show(ev)}: want three empty lists, got ${show(got)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// C — the cards
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const CARD_WORDS = [
  ['scores', 'Scores', 'Trust scores for profiles and content, one at a time.'],
  ['lists', 'Lists', 'Curated lists of profiles and content.'],
  ['concepts', 'Concepts', 'Structured datasets your community organizes together.'],
];

test('C1: three cards — Scores, Lists, Concepts, in that order, with the story’s titles and descriptions', async () => {
  const categoryCards = await fn('categoryCards');
  const cards = categoryCards({ assistants: { scores: [], lists: [], concepts: [] }, profiles: {}, localPubkey: null });
  assert(Array.isArray(cards) && cards.length === 3, `want 3 cards, got ${show(cards)}`);
  CARD_WORDS.forEach(([key, title, description], i) => {
    const c = cards[i] || {};
    assert(c.key === key && c.title === title && c.description === description, `card ${i + 1}: want ${show({ key, title, description })}, got ${show({ key: c.key, title: c.title, description: c.description })}`);
  });
});

test('C2: none, single and mixed — state, count, people, and at most three avatars', async () => {
  const categoryCards = await fn('categoryCards');
  const cards = categoryCards({
    assistants: { scores: [A, B, C, D], lists: [LOCAL], concepts: [] },
    profiles: { [A]: { display_name: 'Ava' }, [B]: { name: 'Bea' }, [C]: { display_name: 'Cy' }, [D]: { name: 'Dee' }, [LOCAL]: { display_name: 'Zed Local' } },
    localPubkey: LOCAL,
  });
  const [scores, lists, concepts] = cards;
  assert(scores.state === 'mixed' && scores.count === 4, `Scores: want mixed of 4, got ${show({ state: scores.state, count: scores.count })}`);
  assert(Array.isArray(scores.people) && scores.people.map((p) => p.name).join() === 'Ava,Bea,Cy,Dee', `Scores people: want Ava,Bea,Cy,Dee, got ${show(scores.people)}`);
  assert(Array.isArray(scores.avatars) && scores.avatars.length === 3 && scores.avatars.map((p) => p.pubkey).join() === [A, B, C].join(), `Scores avatars: want the first three, got ${show(scores.avatars)}`);
  assert(lists.state === 'single' && lists.count === 1 && lists.people[0].name === 'Zed Local' && lists.people[0].initial === 'Z', `Lists: want single Zed Local (Z), got ${show(lists)}`);
  assert(concepts.state === 'none' && concepts.count === 0 && concepts.people.length === 0 && concepts.avatars.length === 0, `Concepts: want none, got ${show(concepts)}`);
});

test('C3: the local Assistant is marked local — and nothing is, with no local Assistant', async () => {
  const categoryCards = await fn('categoryCards');
  const assistants = { scores: [A, LOCAL], lists: [], concepts: [] };
  const withLocal = categoryCards({ assistants, profiles: {}, localPubkey: LOCAL })[0].people;
  assert(withLocal.find((p) => p.pubkey === LOCAL).local === true && withLocal.find((p) => p.pubkey === A).local === false, `want only ${short(LOCAL)} local, got ${show(withLocal)}`);
  const none = categoryCards({ assistants, profiles: {}, localPubkey: null })[0].people;
  assert(none.every((p) => p.local === false), `localPubkey null: want no local, got ${show(none)}`);
});

test('C4: names — display name, else name, else the shortened npub; a failed lookup or a non-text name falls back too', async () => {
  const categoryCards = await fn('categoryCards');
  const { PROFILE_LOOKUP_FAILED } = await esm(PROFILE_BATCH, 'the shared profile lookup');
  const cards = categoryCards({
    assistants: { scores: [A, B, C, D, E], lists: [], concepts: [] },
    profiles: { [A]: { display_name: 'Ava', name: 'ava' }, [B]: { name: 'Bea' }, [C]: null, [D]: PROFILE_LOOKUP_FAILED, [E]: { display_name: 7, name: ['x'] } },
    localPubkey: null,
  });
  const got = cards[0].people.map((p) => p.name);
  const want = ['Ava', 'Bea', npubShort(C), npubShort(D), npubShort(E)];
  assert(show(got) === show(want), `want ${show(want)}, got ${show(got)}`);
});

test('C5: the avatar letter is a whole character, even when the name starts with an emoji', async () => {
  const categoryCards = await fn('categoryCards');
  const [scores] = categoryCards({ assistants: { scores: [A], lists: [], concepts: [] }, profiles: { [A]: { display_name: '🦊 Fox' } }, localPubkey: null });
  assert(scores.people[0].initial === '🦊', `want 🦊, got ${show(scores.people[0].initial)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// W — the new words
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function stringsIn(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

test('W1: COPY holds the section’s fixed words — heading, the three titles and descriptions, Assigned to, Mixed, Not assigned yet, Raw Treasure Map', async () => {
  const { COPY } = await esm(VIEW_MODEL, 'the page view-model');
  const all = stringsIn(COPY);
  const want = ['Assistants by category', 'Assigned to', 'Mixed', 'Not assigned yet', 'Raw Treasure Map', ...CARD_WORDS.flatMap(([, t, d]) => [t, d])];
  const missing = want.filter((w) => !all.includes(w));
  assert(missing.length === 0, `COPY is missing ${show(missing)} (story 2 § Copy)`);
});

test('W2: the Mixed count reads "· N Assistants"', async () => {
  const { COPY } = await esm(VIEW_MODEL, 'the page view-model');
  assert(COPY && typeof COPY.mixedCount === 'function', 'COPY.mixedCount(n) is missing (ADR 0002 sub-decision 4)');
  for (const n of [2, 3, 7]) assert(COPY.mixedCount(n) === `· ${n} Assistants`, `mixedCount(${n}): want "· ${n} Assistants", got ${show(COPY.mixedCount(n))}`);
});

test('W3: the Mixed line reads "Mixed assignments can be reviewed on the Advanced page.", its link being "Advanced page"', async () => {
  const { COPY } = await esm(VIEW_MODEL, 'the page view-model');
  const line = [COPY.mixedLineBefore, COPY.mixedLineLink, COPY.mixedLineAfter];
  assert(line.every((s) => typeof s === 'string'), `COPY.mixedLineBefore / mixedLineLink / mixedLineAfter missing: ${show(line)}`);
  assert(line.join('') === 'Mixed assignments can be reviewed on the Advanced page.' && COPY.mixedLineLink === 'Advanced page', `got ${show(line)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — source sentinels and the one export
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

let tsLib = null;
function ts() {
  if (!tsLib) tsLib = require('typescript');
  return tsLib;
}
function parse(file) {
  const src = safeRead(file);
  return src ? ts().createSourceFile(file, src, ts().ScriptTarget.Latest, true, ts().ScriptKind.JSX) : null;
}
function walk(node, visit) { visit(node); ts().forEachChild(node, (child) => walk(child, visit)); }

test('S1: /assistants’ view-model exports cardFields — the one name rule both design pages use (ADR 0002 sub-decision 8)', async () => {
  const mod = await esm(MA_VIEW_MODEL, 'the My Assistants view-model');
  assert(typeof mod.cardFields === 'function', `${rel(MA_VIEW_MODEL)} does not export cardFields`);
  const f = mod.cardFields(A, { display_name: 'Ava' });
  assert(f && f.name === 'Ava' && f.initial === 'A', `cardFields(A, {display_name:'Ava'}) should give name Ava, initial A; got ${show(f)}`);
});

test('S2: the page reads names through the shared profile lookup, and its own Assistant from the session — never taPubkey or a literal key (useConfig only for aRelays, treasure-map-edit #3)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  assert(/import\s*\{[^}]*\bfetchProfilesChunked\b[^}]*\}\s*from\s*['"][^'"]*utils\/profileBatch(\.js)?['"]/.test(src), `${rel(PAGE)} should import fetchProfilesChunked from utils/profileBatch (ADR 0002 sub-decision 5)`);
  assert(/\bassistantPubkey\b/.test(src), `${rel(PAGE)} should take the local Assistant from user.assistantPubkey`);
  const bad = src.match(/\btaPubkey\b/);
  assert(!bad, `${rel(PAGE)} uses ${bad && bad[0]}; the local Assistant is the session's own, never the instance owner's`);
  // treasure-map-edit #3 (ADR 0003): the page may read the relay settings from the config, and nothing else from it.
  const uses = src.match(/[^\n]*\buseConfig\s*\(\s*\)[^\n]*/g) || [];
  const other = uses.filter((line) => !/\{\s*aRelays\s*\}\s*=\s*useConfig\s*\(\s*\)/.test(line));
  assert(other.length === 0, `${rel(PAGE)} reads more than aRelays from useConfig(): ${show(other)}`);
  const hex = src.match(/[0-9a-f]{64}/i);
  assert(!hex, `${rel(PAGE)} contains a 64-hex literal (${hex && hex[0].slice(0, 12)}…)`);
});

test('S3: the raw Treasure Map box is keyboard-reachable — tabIndex 0, role region, named by COPY.rawBoxLabel (story 1 review, non-blocking 4); so is every other box on the page (treasure-map-edit #3)', () => {
  const sf = parse(PAGE);
  assert(sf, `${rel(PAGE)} does not exist`);
  const pres = [];
  walk(sf, (n) => {
    if ((ts().isJsxOpeningElement(n) || ts().isJsxSelfClosingElement(n)) && n.tagName.getText() === 'pre') pres.push(n);
  });
  // treasure-map-edit #3 adds the edited viewer's box (ADR treasure-map-edit/0003 sub-decision 4): the raw box is the
  // one named by COPY.rawBoxLabel, exactly once, and every box keeps the same keyboard access with a name from COPY.
  const attrsOf = (pre) => {
    const attrs = {};
    for (const a of pre.attributes.properties) if (a.name) attrs[a.name.getText()] = a.initializer ? a.initializer.getText() : 'true';
    return attrs;
  };
  const raw = pres.filter((pre) => /COPY\.rawBoxLabel/.test(attrsOf(pre)['aria-label'] || ''));
  assert(raw.length === 1, `want one <pre> named by COPY.rawBoxLabel in ${rel(PAGE)}, got ${raw.length} of ${pres.length}`);
  const wrong = [];
  pres.forEach((pre, i) => {
    const attrs = attrsOf(pre);
    if (!/^\{\s*0\s*\}$|^["']0["']$/.test(attrs.tabIndex || '')) wrong.push(`<pre> ${i + 1}: tabIndex ${show(attrs.tabIndex)}, want {0}`);
    if (!/^["']region["']$/.test(attrs.role || '')) wrong.push(`<pre> ${i + 1}: role ${show(attrs.role)}, want "region"`);
    if (!/^\{\s*COPY\./.test(attrs['aria-label'] || '')) wrong.push(`<pre> ${i + 1}: aria-label ${show(attrs['aria-label'])}, want a COPY word`);
  });
  assert(wrong.length === 0, `the raw boxes: ${wrong.join('; ')}`);
});

async function run() {
  console.log(`${NL}=== manage-treasure-map-cards (manage-treasure-map #2) ===`);
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
  console.log(`${NL}manage-treasure-map-cards: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };
