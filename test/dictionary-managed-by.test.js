/**
 * "Managed by" on the Dictionary page (the design's Dictionary screen, 2026-10-01): which of the
 * signed-in reader's Assistants' Dictionaries /dictionary shows, or the union of all of them.
 *
 * The owner's decisions: each Assistant's Dictionary is read from this instance's relay (no
 * cross-instance read); the union ships with "n of m Assistants" support counts; signed out it is
 * a plain label; the choice lives in the URL (?managedBy=<npub> or all).
 *
 *   M1..M11 — pure: ui/src/pages/dictionaries/managedDictionary.js (dynamic import).
 *   S1..S4 — structural pins, read off comment-stripped source.
 *
 * The browser half is tests/brainstorm/dictionary-concepts.spec.js D12–D15.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const MANAGED_JS = path.join(UI, 'pages/dictionaries/managedDictionary.js');
const INDEX_JSX = path.join(UI, 'pages/dictionary/Index.jsx');
const MANAGED_BY_JSX = path.join(UI, 'pages/dictionary/ManagedBy.jsx');
const CONCEPTS_JSX = path.join(UI, 'pages/dictionaries/Concepts.jsx');
const ENTRY_JSX = path.join(UI, 'pages/dictionaries/ConceptEntry.jsx');
const HELPERS_JS = path.join(UI, 'pages/dictionaries/conceptsDictionary.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function src(p) {
  let s = '';
  try { s = fs.readFileSync(p, 'utf8'); } catch { /* reported below */ }
  assert(s.length > 0, `${path.relative(ROOT, p)} must exist`);
  return s;
}
const flat = (s) => s.replace(/\s+/g, ' ');
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

let _m;
async function m() {
  if (_m === undefined) {
    try { _m = await import(pathToFileURL(MANAGED_JS).href); } catch (err) { _m = null; console.log(`      (could not load: ${err.message})`); }
  }
  assert(_m && typeof _m.managerOptions === 'function', `${path.relative(ROOT, MANAGED_JS)} must load as a pure ESM module`);
  return _m;
}

const ACCOUNT = '1'.repeat(64);
const LOCAL = '2'.repeat(64);
const REMOTE = '3'.repeat(64);
const OTHER = '4'.repeat(64);
const PERSON = { account: ACCOUNT, assistant: LOCAL, authors: [ACCOUNT, LOCAL] };
const ROWS = [
  { pubkey: REMOTE, local: false, tags: [{ key: 'brainstorm', name: 'My Brainstorm Assistant' }] },
  { pubkey: LOCAL, local: true, tags: [] },
];
const PROFILES = { [REMOTE]: { name: 'Robin', website: 'robin.example' }, [LOCAL]: { name: 'Lark', nip05: 'lark@here.example' } };

// ═══ M — managedDictionary.js ═════════════════════════════════════════════════

test('M1: managerOptions — the local Assistant first, read as the reader\'s own Dictionary; others read alone', async () => {
  const opts = (await m()).managerOptions({ rows: ROWS, profiles: PROFILES, person: PERSON });
  assert(opts.length === 2 && opts[0].key === LOCAL && opts[0].local === true, 'local first');
  assert(JSON.stringify(opts[0].authors) === JSON.stringify([ACCOUNT, LOCAL]), 'the local one reads the reader\'s pair, as the page always has');
  assert(JSON.stringify(opts[1].authors) === JSON.stringify([REMOTE]), 'a tagged Assistant reads its own headers');
  assert(opts[1].name === 'Robin' && opts[1].detail === 'robin.example', `name and URL from the profile, got ${opts[1].name} / ${opts[1].detail}`);
  assert(opts[0].detail === 'lark@here.example', `no URL → the NIP-05, got ${opts[0].detail}`);
});

test('M2: managerOptions — a reader with no Assistant here still has their own concepts first', async () => {
  const person = { account: ACCOUNT, assistant: null, authors: [ACCOUNT] };
  const opts = (await m()).managerOptions({ rows: [ROWS[0]], profiles: PROFILES, person });
  assert(opts[0].key === ACCOUNT && opts[0].local && JSON.stringify(opts[0].authors) === JSON.stringify([ACCOUNT]), JSON.stringify(opts[0]));
  assert(opts[0].self === true, 'marked as the reader\'s own, not an Assistant (no Local pill; the union counts Dictionaries)');
  assert(opts[1].key === REMOTE, 'then the tagged Assistant');
});

test('M3: parseManagedBy — no value, an npub, hex, "all", and what it cannot honour', async () => {
  const mod = await m();
  const opts = mod.managerOptions({ rows: ROWS, profiles: PROFILES, person: PERSON });
  const npub = mod.managedByParam(REMOTE);
  assert(npub.startsWith('npub1'), 'the URL carries an npub');
  assert(mod.parseManagedBy(null, opts).choice === LOCAL, 'no value → the local Assistant');
  assert(mod.parseManagedBy(npub, opts).choice === REMOTE, 'an npub → that Assistant');
  assert(mod.parseManagedBy(REMOTE, opts).choice === REMOTE, 'hex works too');
  assert(mod.parseManagedBy('all', opts).choice === mod.ALL, '"all" → the union');
  const stranger = mod.parseManagedBy(mod.managedByParam(OTHER), opts);
  assert(stranger.choice === LOCAL && stranger.unknown === true, 'an Assistant that is not one of yours → local, and says so');
  const junk = mod.parseManagedBy('not-a-key', opts);
  assert(junk.choice === LOCAL && junk.unknown === true, 'garbage → local, and says so');
  const solo = mod.parseManagedBy('all', [opts[0]]);
  assert(solo.choice === LOCAL && solo.unknown === true, 'a union of one is just the local Dictionary');
  assert(mod.parseManagedBy(npub, []).choice === REMOTE, 'before the options load, the URL\'s Assistant is kept as named');
});

test('M4: managedView — local is the person read; another Assistant or all are Assistant reads', async () => {
  const mod = await m();
  const opts = mod.managerOptions({ rows: ROWS, profiles: PROFILES, person: PERSON });
  const local = mod.managedView({ choice: LOCAL, options: opts });
  assert(local.person === true && local.sets.length === 0, 'local → the page\'s own read');
  const one = mod.managedView({ choice: REMOTE, options: opts });
  assert(!one.person && !one.all && one.sets.length === 1 && one.sets[0].key === REMOTE && one.current.name === 'Robin', JSON.stringify(one));
  const all = mod.managedView({ choice: mod.ALL, options: opts });
  assert(all.all && all.sets.map((x) => x.key).join() === `${LOCAL},${REMOTE}`, 'all → one read per Assistant, local first');
});

const entry = (coord, sharedCoord, extra = {}) => ({ coord, sharedCoord, name: coord.split(':')[2], ...extra });
const SHARED_DOG = `39998:${OTHER}:dog`;

test('M5: mergeDictionaries — entries for the same shared concept are one row, supported by both', async () => {
  const { mergeDictionaries } = await m();
  const out = mergeDictionaries([
    { key: LOCAL, entries: [entry(`39998:${LOCAL}:dog`, SHARED_DOG), entry(`39998:${LOCAL}:cat`, `39998:${OTHER}:cat`)] },
    { key: REMOTE, entries: [entry(`39998:${REMOTE}:dog`, SHARED_DOG)] },
  ]);
  const dog = out.entries.find((e) => e.sharedCoord === SHARED_DOG);
  assert(out.entries.length === 2, `two shared concepts, got ${out.entries.length}`);
  assert(dog.coord === `39998:${LOCAL}:dog`, 'the first Assistant\'s entry (the local one) stands for the row');
  assert(dog.support.count === 2 && dog.support.of === 2, `2 of 2, got ${JSON.stringify(dog.support)}`);
  const cat = out.entries.find((e) => e.name === 'cat');
  assert(cat.support.count === 1 && cat.support.of === 2, '1 of 2');
});

test('M6: mergeDictionaries — a self-declared entry stands for itself', async () => {
  const { mergeDictionaries } = await m();
  const self = `39998:${REMOTE}:mine`;
  const out = mergeDictionaries([{ key: LOCAL, entries: [] }, { key: REMOTE, entries: [entry(self, self)] }]);
  assert(out.entries.length === 1 && out.entries[0].support.count === 1, JSON.stringify(out.entries));
});

test('M7: mergeDictionaries — an entry with no shared coordinate (b → event id) keys by its own coordinate', async () => {
  const { mergeDictionaries, conceptKey } = await m();
  const e = entry(`39998:${LOCAL}:eventy`, null);
  assert(conceptKey(e) === e.coord, 'its own coordinate');
  const out = mergeDictionaries([{ key: LOCAL, entries: [e] }, { key: REMOTE, entries: [entry(`39998:${REMOTE}:eventy`, null)] }]);
  assert(out.entries.length === 2, 'two different headers are two rows');
});

test('M8: mergeDictionaries — a failed read counts in "of" but supports nothing, and is named', async () => {
  const { mergeDictionaries } = await m();
  const out = mergeDictionaries([
    { key: LOCAL, entries: [entry(`39998:${LOCAL}:dog`, SHARED_DOG)] },
    { key: REMOTE, error: 'HTTP 500' },
  ]);
  assert(out.entries[0].support.count === 1 && out.entries[0].support.of === 2, JSON.stringify(out.entries[0].support));
  assert(JSON.stringify(out.failed) === JSON.stringify([REMOTE]), 'the failed Assistant is reported');
});

test('M9: mergeDictionaries — an Assistant carrying the same concept twice counts once', async () => {
  const { mergeDictionaries } = await m();
  const out = mergeDictionaries([{ key: LOCAL, entries: [entry(`39998:${LOCAL}:dog`, SHARED_DOG), entry(`39998:${ACCOUNT}:dog`, SHARED_DOG)] }]);
  assert(out.entries.length === 1 && out.entries[0].support.count === 1 && out.entries[0].support.of === 1, JSON.stringify(out.entries));
});

test('M10: mergeDictionaries — headers whose b-tags list the same targets in another order are one row', async () => {
  const { mergeDictionaries } = await m();
  const A = `39998:${OTHER}:a`;
  const B = `39998:${OTHER}:b`;
  // Tied scores keep tag order, so the server names A for one and B for the other.
  const out = mergeDictionaries([
    { key: LOCAL, entries: [{ coord: `39998:${LOCAL}:x`, sharedCoord: A, targets: [A, B] }] },
    { key: REMOTE, entries: [{ coord: `39998:${REMOTE}:x`, sharedCoord: B, targets: [B, A] }] },
  ]);
  assert(out.entries.length === 1, `one row, got ${out.entries.length}`);
  assert(out.entries[0].support.count === 2 && out.entries[0].coord === `39998:${LOCAL}:x`, JSON.stringify(out.entries[0]));
});

test('M11: mergeDictionaries — an entry that bridges two rows supports both, and never hides either', async () => {
  const { mergeDictionaries } = await m();
  const A = `39998:${OTHER}:a`;
  const B = `39998:${OTHER}:b`;
  const out = mergeDictionaries([
    { key: LOCAL, entries: [{ coord: `39998:${LOCAL}:a`, sharedCoord: A, targets: [A] }, { coord: `39998:${LOCAL}:b`, sharedCoord: B, targets: [B] }] },
    { key: REMOTE, entries: [{ coord: `39998:${REMOTE}:ab`, sharedCoord: A, targets: [A, B] }] },
    { key: OTHER, error: 'HTTP 500' },
  ]);
  assert(out.entries.length === 2, `both of the local Assistant's entries stay, got ${out.entries.map((e) => e.coord)}`);
  assert(out.entries.every((e) => e.support.count === 2 && e.support.of === 3), JSON.stringify(out.entries.map((e) => e.support)));
  assert(out.answered === 2, `two reads answered, got ${out.answered}`);
});

// ═══ S — structural ═══════════════════════════════════════════════════════════

test('S1: /dictionary keeps the choice in the URL and passes it to the shared body', () => {
  const s = flat(code(src(INDEX_JSX)));
  assert(/useSearchParams\(\)/.test(s) && /params\.get\(MANAGED_BY_PARAM\)/.test(s), 'the choice is read from ?managedBy=');
  assert(/next\.delete\(MANAGED_BY_PARAM\)/.test(s), 'the local Assistant is the URL with no value');
  assert(/<ManagedBy person=\{person\}/.test(s), 'the picker sits beside the title');
  assert(/<ConceptsDictionaryBody entryHref=\{dictionaryEntryPath\} managed=\{managed\}( newConceptHref=\{DICTIONARY_NEW_PATH\})? \/>/.test(s), 'the body gets the choice');
  assert(/useMyAssistants\(person\)/.test(s), 'the Assistants are the reader\'s own (GET /api/assistant/my-assistants)');
  assert(/['"`]\/api\/assistant\/my-assistants['"`]/.test(code(src(HELPERS_JS))), 'read through the My Assistants endpoint');
});

test('S2: signed out, "Managed by" is a label, not a menu', () => {
  const s = flat(code(src(MANAGED_BY_JSX)));
  assert(/if \(!person\.signedIn\) \{ return <span className="bsd-managed">Managed by <span className="bsd-managed-name">The owner’s Assistant<\/span><\/span>;/.test(s),
    'a plain label for the owner\'s Dictionary');
  assert(/role="menuitemradio" aria-checked=\{on\}/.test(s), 'signed in, the options are a radio menu');
});

test('S3: the body reads one Assistant or the union through the same endpoint, and keeps the reader\'s own read', () => {
  const s = flat(code(src(CONCEPTS_JSX)));
  assert(/useConceptDictionary\(person, povParams, \{ enabled: !managed \}\)/.test(s), 'no choice → the reader\'s own read, as before');
  assert(/useAssistantDictionaries\(assistantsMode \? managed\.sets : \[\], povParams/.test(s), 'Assistant reads from the active point of view');
  assert(/mergeDictionaries\(many\.data\.reads\)/.test(s), 'the union is mergeDictionaries');
  assert(/\{e\.support\.count\} of \{e\.support\.of\} \{unionNoun\}/.test(s) && /\? 'Dictionaries' : 'Assistants'/.test(s),
    'rows say "n of m Assistants" (Dictionaries when the reader\'s own concepts are one of them)');
  assert(/if \(merged\.answered === 0\) error =/.test(s) && /if \(read\.error\) error = read\.error;/.test(s),
    'a failed read is an error, never an empty Dictionary');
  assert(/canAdd=\{signedIn && !managed\}/.test(s), 'Add to Dictionary only on the reader\'s own list');
  assert(/listHref: `\$\{location\.pathname\}\$\{location\.search\}`/.test(s), 'an entry knows the list it came from');
  assert(/'General Usage Metric: filing \(lowest first\)'/.test(s) && /'General Usage Metric: filing \(highest first\)'/.test(s),
    'the design\'s "General Usage Metric" sort labels, named for the metric now that there are two (dictionary-gum2 S2)');
});

test('S4: the entry page returns to that list and names another Assistant\'s header', () => {
  const s = flat(code(src(ENTRY_JSX)));
  assert(/fromList === listHref \|\| fromList\.startsWith\(`\$\{listHref\}\?`\)/.test(s), 'back only to the same list, with its query');
  assert(/<Link to=\{backHref\} className="dict-back">/.test(s), 'the back link uses it');
  assert(/`\$\{nameOf\(author\)\}’s header`/.test(s), 'another Assistant\'s header carries its name');
});

// ═══ runner ══════════════════════════════════════════════════════════════════

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\ndictionary-managed-by: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
