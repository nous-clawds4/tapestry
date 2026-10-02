/**
 * Create New Concept on /dictionary (the design's screen, 2026-10-02).
 *
 * The owner's decisions: any signed-in reader can create a concept, which here means publishing a
 * DList header (kind 39998), not the owner-only Neo4j concept skeleton; it is shared as it is created
 * (its b-tag points to itself); there is no Private option in this version. Since 2026-10-02 (later
 * the same day) the header is always signed by the person's own Assistant, and the finder can open
 * the page wired to a shared concept: test/dictionary-wired-create.test.js holds that endpoint and route.
 *
 *   N1..N5 — pure: ui/src/pages/dictionary/newConceptDraft.js (dynamic import).
 *   S1..S5 — structural pins, read off comment-stripped source.
 *
 * The browser half is tests/brainstorm/dictionary-concepts.spec.js D24–D27.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const DRAFT_JS = path.join(UI, 'pages/dictionary/newConceptDraft.js');
const PAGE_JSX = path.join(UI, 'pages/dictionary/NewConcept.jsx');
const INDEX_JSX = path.join(UI, 'pages/dictionary/Index.jsx');
const CONCEPTS_JSX = path.join(UI, 'pages/dictionaries/Concepts.jsx');
const APP_JSX = path.join(UI, 'App.jsx');
const DTAG_JS = path.join(UI, 'utils/dtag.js');

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

let _d;
async function draftMod() {
  if (_d === undefined) {
    try { _d = await import(pathToFileURL(DRAFT_JS).href); } catch (err) { _d = null; console.log(`      (could not load: ${err.message})`); }
  }
  assert(_d && typeof _d.conceptHeaderDraft === 'function', `${path.relative(ROOT, DRAFT_JS)} must load as a pure ESM module`);
  return _d;
}

const PK = 'a'.repeat(64);

// ═══ N — newConceptDraft.js ═══════════════════════════════════════════════════

test('N1: the draft is a shared kind-39998 header: d, names, description, and a b-tag that points to itself', async () => {
  const { conceptHeaderDraft } = await draftMod();
  const { headerDTag } = await import(pathToFileURL(DTAG_JS).href);
  const out = conceptHeaderDraft({ singular: ' Taco Truck in Nashville ', plural: 'Taco Trucks in Nashville', description: ' Trucks. ', pubkey: PK });
  const d = headerDTag('Taco Truck in Nashville');
  assert(out.d === d, `the d-tag is the singular name's slug, as New DList derives it; got ${out.d}`);
  assert(out.coord === `39998:${PK}:${d}`, `coord ${out.coord}`);
  assert(out.event.kind === 39998 && out.event.content === '', 'kind 39998, empty content');
  assert(JSON.stringify(out.event.tags) === JSON.stringify([
    ['d', d], ['names', 'Taco Truck in Nashville', 'Taco Trucks in Nashville'], ['description', 'Trucks.'], ['b', out.coord, 'pointer'],
  ]), `tags ${JSON.stringify(out.event.tags)}`);
  assert(out.ready === true, 'ready with both names');
});

test('N2: no description tag when the description is blank', async () => {
  const { conceptHeaderDraft } = await draftMod();
  const out = conceptHeaderDraft({ singular: 'Bird', plural: 'Birds', description: '   ', pubkey: PK });
  assert(!out.event.tags.some((t) => t[0] === 'description'), JSON.stringify(out.event.tags));
});

test('N3: not ready until both names are filled in', async () => {
  const { conceptHeaderDraft } = await draftMod();
  assert(conceptHeaderDraft({ singular: 'Bird', plural: '', pubkey: PK }).ready === false, 'no plural');
  assert(conceptHeaderDraft({ singular: '  ', plural: 'Birds', pubkey: PK }).ready === false, 'no singular');
  assert(conceptHeaderDraft({ singular: '!!!', plural: 'Birds', pubkey: PK }).ready === false, 'a name with no slug has no d-tag');
});

test('N4: before the signer is known, the b-tag says so rather than naming a key', async () => {
  const { conceptHeaderDraft } = await draftMod();
  const out = conceptHeaderDraft({ singular: 'Bird', plural: 'Birds', pubkey: null });
  assert(out.coord === null, 'no coordinate without a signer');
  const b = out.event.tags.find((t) => t[0] === 'b');
  assert(b && b[1] === `39998:<signer>:${out.d}` && b[2] === 'pointer', JSON.stringify(b));
});

test('N5: the preview is the event, one tag per line', async () => {
  const { conceptHeaderDraft, draftPreview } = await draftMod();
  const { event } = conceptHeaderDraft({ singular: 'Bird', plural: 'Birds', pubkey: PK });
  const text = draftPreview(event);
  assert(text.includes('"kind": 39998') && text.includes('    ["names","Bird","Birds"]'), text);
  assert(JSON.stringify(JSON.parse(text)) === JSON.stringify({ kind: 39998, tags: event.tags, content: '' }), 'it is valid JSON of the same event');
});

// ═══ S — structural ═══════════════════════════════════════════════════════════

test('S1: /dictionary/new exists, and /dictionary\'s Create New Concept opens it (the control panel keeps its own)', () => {
  assert(/path: '\/dictionary\/new', element: <DictionaryNewConceptPage \/>/.test(flat(code(src(APP_JSX)))), 'the route');
  assert(/newConceptHref=\{DICTIONARY_NEW_PATH\}/.test(flat(code(src(INDEX_JSX)))), '/dictionary passes it');
  const body = flat(code(src(CONCEPTS_JSX)));
  assert(/newConceptHref = NEW_CONCEPT_PATH \}\) \{/.test(body), 'the control panel default stays the New Concept page');
  assert(/<Link to=\{newConceptHref\} className="dict-create-btn">/.test(body), 'the button follows the prop');
});

test('S2: who signs — the signed-in person\'s own Assistant, on the server, whoever they are; no extension, no fallback', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/const signer = person\.signedIn \? person\.assistant : null;/.test(s), 'the signer is the reader\'s own Assistant (owner, 2026-10-02)');
  assert(/export const NEW_CONCEPT_API = '\/api\/dictionaries\/concepts\/new';/.test(s) && /await fetch\(NEW_CONCEPT_API, \{/.test(s),
    'created through the endpoint that signs with the caller\'s own Assistant key');
  assert(!/window\.nostr/.test(s) && !/\/api\/strfry\/publish/.test(s) && !/signAs/.test(s), 'no NIP-07 path and no raw publish');
  assert(/const canCreate = person\.signedIn && Boolean\(signer\) && draft\.ready && !selfTarget && !busy && !locked;/.test(s),
    'signed in, with an Assistant and both names, not wired to itself (dictionary-wired-create S4), and not yet created');
  assert(/ASSISTANT_COPY\.noAssistantLine/.test(s) && /<Link to="\/setup">\{ASSISTANT_COPY\.noAssistantLink\}<\/Link>/.test(s),
    'no Assistant here: the page says so and points to Account Setup (owner, 2026-10-02: no fallback)');
});

test('S3: it won\'t replace a header this instance\'s relay holds for the Assistant, and says what the broadcast did', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/if \(resp\.status === 409 && data\.code === 'exists'\) \{ setExisting\(data\.coord \|\| draft\.coord\); return; \}/.test(s),
    'the server\'s refusal stops it, and the page links to the existing header');
  assert(/publishToRelays\(signed, CONCEPT_PUBLISH_RELAYS\)/.test(s), 'shared to the community relay');
  assert(/classifyBroadcast\(result\)/.test(s) && /outcomeMessage\(\{ outcome, verb: target \? 'wire' : 'submit' \}\)/.test(s),
    'the broadcast outcome is read, not assumed, in the words for what was made');
  assert(/if \(outcome === 'not-delivered'\) \{ setUndelivered/.test(s), 'an undelivered broadcast stays here, with Try again');
});

test('S4: no Private option in this version', () => {
  const s = code(src(PAGE_JSX));
  assert(!/Private/.test(s) && !/type="checkbox"/.test(s), 'the design\'s Private checkbox is left out (owner, 2026-10-02)');
});

test('S5: once published, the page holds to that event: its concept, its Try again, the form locked', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/const coordOf = \(signed\) => `39998:\$\{signed\.pubkey\}:\$\{\(signed\.tags \|\| \[\]\)\.find\(\(t\) => t\[0\] === 'd'\)\?\.\[1\] \|\| ''\}`;/.test(s),
    'the concept opened is the published event\'s, not the form\'s');
  assert(/const locked = Boolean\(undelivered\);/.test(s) && /<fieldset disabled=\{!signer \|\| busy \|\| locked\}/.test(s), 'the form is locked once the header exists');
  assert(/if \(!signed \|\| signed\.pubkey !== signer\) \{ throw new Error/.test(s), 'the server-signed event is checked before it is broadcast');
  const body = flat(code(src(CONCEPTS_JSX)));
  assert(/No matching concept of your own\? \{create\}, wired to this one\./.test(body) && /<Link to=\{dictionaryWirePath\(concept\.uuid\)\} className="dict-add-create">Create New Concept<\/Link>/.test(body),
    'the finder\'s Create New Concept opens /dictionary/new wired to the result (the owner, 2026-10-02), not the control panel\'s New Concept page');
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
  console.log(`\ndictionary-new-concept: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
