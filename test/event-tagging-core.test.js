/**
 * Tests for Story 1 (epic: event-tagging) — the dependency-free protocol core.
 *
 * Story: engineering-team/stories/event-tagging/1-protocol-core-and-spec.md
 * ADR:   engineering-team/decisions/event-tagging/0001-protocol-core-and-spec.md
 * Wire:  protocols/drafts/event-taggings.md (David's indirect per-tag-header protocol)
 *
 * Intentionally failing until src/lib/event-tagging/ lands (red phase). The core
 * module does not exist yet, so it is require()d LAZILY inside each test — never at
 * file top — so loading this suite cannot crash test/test.js's require phase.
 *
 * Pure construction only: no signing, no publishing, no firmware, no network.
 * Hand-rolled in the project's existing test style — no new framework.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CORE_REQUIRE = '../src/lib/event-tagging';
const CORE_DIR = path.join(REPO_ROOT, 'src/lib/event-tagging');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function jsonEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}

/** Lazily load the under-test core with a descriptive red-phase message. */
function load() {
  try { return require(CORE_REQUIRE); }
  catch (e) { throw new Error(`event-tagging core not implemented yet (require('${CORE_REQUIRE}') failed: ${e.message})`); }
}

// ─── fixtures (fixed, fake-but-valid 64-hex) ───
const TA     = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'; // canonical namespace
const LOCAL  = '5555555555555555555555555555555555555555555555555555555555555555'; // local (runtime) namespace
const JACK   = '1111111111111111111111111111111111111111111111111111111111111111'; // tag-element + header author
const ALICE  = '2222222222222222222222222222222222222222222222222222222222222222'; // asserter
const CHARLIE= '3333333333333333333333333333333333333333333333333333333333333333'; // addressable-target author
const NOTE_ID= '4444444444444444444444444444444444444444444444444444444444444444'; // kind-1 note id
const SLUG = 'awesome-tag';

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─── AC: handle composers ───
t('handles: concept + address composers compose exact strings', () => {
  const c = load();
  jsonEq(c.conceptTag(TA), `39998:${TA}:tag`, 'conceptTag');
  jsonEq(c.conceptNostrEventTag(TA), `39998:${TA}:nostr-event-tag`, 'conceptNostrEventTag');
  jsonEq(c.conceptTaggingWithSpecificTag(TA), `39998:${TA}:tagging-with-specific-tag`, 'conceptTaggingWithSpecificTag');
  jsonEq(c.tagElementAddr(JACK, SLUG), `39999:${JACK}:awesome-tag`, 'tagElementAddr');
  jsonEq(c.taggingHeaderAddr(JACK, SLUG), `39999:${JACK}:tagging:awesome-tag-tagging`, 'taggingHeaderAddr');
});

// ─── AC: slug parity with src/lib/dtag.js ───
t('slug: byte-identical to src/lib/dtag.js slug incl. diacritics', () => {
  const c = load();
  const { slug: dtagSlug } = require('../src/lib/dtag.js'); // the real, existing canonical slug
  const cases = ['Awesome Tag', 'Café Über', 'Hello, World!', '  spaced   out  ', 'ALL CAPS', 'mixed-Sep_arators'];
  for (const input of cases) {
    const got = c.slug(input);
    const want = dtagSlug(input);
    assert(got === want, `slug("${input}") = "${got}" but dtag.slug = "${want}" (must match exactly)`);
  }
  assert(c.slug('Café Über') === 'cafe-uber', `slug must strip diacritics: got "${c.slug('Café Über')}"`);
});

// ─── AC-1: tag-element ───
t('buildTagElement: exact kind/tags/content for a named tag', () => {
  const c = load();
  const ev = c.buildTagElement({ name: 'Awesome Tag', description: 'marks awesome things', taPubkeys: [TA, LOCAL] });
  jsonEq(Object.keys(ev).sort(), ['content', 'kind', 'tags'], 'tag-element must have exactly {kind,tags,content}');
  jsonEq(ev.kind, 39999, 'tag-element kind');
  jsonEq(ev.tags, [['d', 'awesome-tag'], ['z', `39998:${TA}:tag`], ['z', `39998:${LOCAL}:tag`]], 'tag-element tags (dual-z: canonical + local)');
  jsonEq(JSON.parse(ev.content), { tag: { slug: 'awesome-tag', name: 'Awesome Tag', description: 'marks awesome things' } }, 'tag-element content');
});

// ─── AC-2: tagging-header ───
t('buildTaggingHeader: header+item shape, d=tagging:<slug>-tagging, a=tag-element', () => {
  const c = load();
  const names = ['Tagging of an event as an Awesome Tag', 'Taggings of events as Awesome Tags'];
  const ev = c.buildTaggingHeader({ tagAuthorPubkey: JACK, slug: SLUG, names, description: 'applies the Awesome Tag to an event', taPubkeys: [TA, LOCAL] });
  jsonEq(ev.kind, 39999, 'header kind');
  jsonEq(ev.tags, [
    ['d', 'tagging:awesome-tag-tagging'],
    ['names', names[0], names[1]],
    ['description', 'applies the Awesome Tag to an event'],
    ['z', `39998:${TA}:tagging-with-specific-tag`],
    ['z', `39998:${LOCAL}:tagging-with-specific-tag`],
    ['a', `39999:${JACK}:awesome-tag`],
  ], 'header tags (dual-z: canonical + local; simultaneously list-header + list-item)');
  jsonEq(ev.content, '', 'header content empty per spec');
});

// ─── AC-3: assertion, kind-1 note target ({id} → e) ───
t('buildEventTaggingAssertion: kind-1 note target uses e, dual z, polarity, d-tag', () => {
  const c = load();
  const ev = c.buildEventTaggingAssertion({
    headerAuthorPubkey: JACK, slug: SLUG, target: { id: NOTE_ID }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL],
  });
  jsonEq(Object.keys(ev).sort(), ['content', 'kind', 'tags'], 'assertion must have exactly {kind,tags,content} (no pubkey/created_at)');
  jsonEq(ev.kind, 39999, 'assertion kind');
  jsonEq(ev.tags, [
    ['d', 'event-tag-awesome-tag-44444444-22222222'],
    ['e', NOTE_ID],
    ['z', `39998:${TA}:nostr-event-tag`],
    ['z', `39998:${LOCAL}:nostr-event-tag`],
    ['z', `39999:${JACK}:tagging:awesome-tag-tagging`],
    ['polarity', '1'],
  ], 'assertion tags (kind-1 target in e; dual concept-z then the user-rooted header z)');
});

// ─── AC-4: assertion, addressable target ({address} → a) ───
t('buildEventTaggingAssertion: addressable target uses a, target8 from coord pubkey', () => {
  const c = load();
  const address = `39999:${CHARLIE}:good-tag-tag`;
  const ev = c.buildEventTaggingAssertion({
    headerAuthorPubkey: JACK, slug: SLUG, target: { address }, polarity: -1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL],
  });
  jsonEq(ev.tags, [
    ['d', 'event-tag-awesome-tag-33333333-22222222'], // target8 = CHARLIE.slice(0,8), NOT "39999:"
    ['a', address],
    ['z', `39998:${TA}:nostr-event-tag`],
    ['z', `39998:${LOCAL}:nostr-event-tag`],
    ['z', `39999:${JACK}:tagging:awesome-tag-tagging`],
    ['polarity', '-1'],
  ], 'assertion tags (addressable target in a; dual concept-z; dispute polarity)');
});

// ─── AC-5: filter — all taggings using a tag ───
t('filterTaggingsUsingTag: #z over the tagging-header coord', () => {
  const c = load();
  const f = c.filterTaggingsUsingTag({ headerAuthorPubkey: JACK, slug: SLUG });
  jsonEq(f.kinds, [39999], 'kinds');
  jsonEq(f['#z'], [`39999:${JACK}:tagging:awesome-tag-tagging`], '#z');
});

// ─── AC-6: filter — all tags applied to an event ───
t('filterTagsAppliedToEvent: #e for {id}, #a for {address}', () => {
  const c = load();
  const byId = c.filterTagsAppliedToEvent({ target: { id: NOTE_ID } });
  jsonEq(byId.kinds, [39999], 'kinds (id)');
  jsonEq(byId['#e'], [NOTE_ID], '#e (id)');
  assert(byId['#a'] === undefined, 'id form must not emit #a');

  const addr = `39999:${CHARLIE}:good-tag-tag`;
  const byAddr = c.filterTagsAppliedToEvent({ target: { address: addr } });
  jsonEq(byAddr.kinds, [39999], 'kinds (address)');
  jsonEq(byAddr['#a'], [addr], '#a (address)');
  assert(byAddr['#e'] === undefined, 'address form must not emit #e');
});

// ─── AC-7: filter — tagging-headers that exist for a tag ───
t('filterTaggingHeadersForTag: #a tag-element + #z tagging-with-specific-tag', () => {
  const c = load();
  const f = c.filterTaggingHeadersForTag({ tagAuthorPubkey: JACK, slug: SLUG, taPubkey: TA });
  jsonEq(f.kinds, [39999], 'kinds');
  jsonEq(f['#a'], [`39999:${JACK}:awesome-tag`], '#a (the tag-element coord)');
  jsonEq(f['#z'], [`39998:${TA}:tagging-with-specific-tag`], '#z (the header type)');
});

// ─── AC: polarity / pubkey guards ───
t('assertion rejects bad polarity and malformed pubkeys', () => {
  const c = load();
  const good = { headerAuthorPubkey: JACK, slug: SLUG, target: { id: NOTE_ID }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA] };
  let threw;
  threw = false; try { c.buildEventTaggingAssertion({ ...good, polarity: 0 }); } catch { threw = true; }
  assert(threw, 'polarity 0 must throw (only 1/-1 allowed)');
  threw = false; try { c.buildEventTaggingAssertion({ ...good, polarity: 2 }); } catch { threw = true; }
  assert(threw, 'polarity 2 must throw');
  threw = false; try { c.buildEventTaggingAssertion({ ...good, asserterPubkey: 'not-a-pubkey' }); } catch { threw = true; }
  assert(threw, 'malformed asserterPubkey must throw (no silent fallback)');
});

// ─── Review fix: handle-composing author pubkeys must be guarded too ───
t('builders reject malformed handle-composing author pubkeys (no silent orphan)', () => {
  const c = load();
  // headerAuthorPubkey composes the descriptor z-coordinate in the assertion.
  for (const bad of ['', undefined, 'npub1xxx', 'ABC', '1111']) {
    let threw = false;
    try {
      c.buildEventTaggingAssertion({
        headerAuthorPubkey: bad, slug: SLUG, target: { id: NOTE_ID }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA],
      });
    } catch { threw = true; }
    assert(threw, `malformed headerAuthorPubkey (${JSON.stringify(bad)}) must throw — else it mints an undiscoverable assertion`);
  }
  // tagAuthorPubkey composes the `a` coordinate in the header.
  for (const bad of ['', undefined, 'npub1xxx', 'ABC', '1111']) {
    let threw = false;
    try {
      c.buildTaggingHeader({ tagAuthorPubkey: bad, slug: SLUG, names: ['X'], description: 'd', taPubkeys: [TA] });
    } catch { threw = true; }
    assert(threw, `malformed tagAuthorPubkey (${JSON.stringify(bad)}) must throw — else it mints an undiscoverable header`);
  }
});

// ─── AC-8 (determinism): pure, no time/pubkey leakage ───
t('builders are deterministic and emit no pubkey/created_at', () => {
  const c = load();
  const args = { headerAuthorPubkey: JACK, slug: SLUG, target: { id: NOTE_ID }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA] };
  const a = c.buildEventTaggingAssertion(args);
  const b = c.buildEventTaggingAssertion(args);
  jsonEq(a, b, 'same inputs must yield deep-equal output (no Date.now variance)');
  assert(!('created_at' in a), 'core must not set created_at');
  assert(!('pubkey' in a), 'core must not set top-level pubkey');
});

// ─── Federation: multi-z is parameterized (canonical + local), deduped, validated ───
t('federation: taPubkeys emits one concept-z per namespace, deduped; splinter = single namespace', () => {
  const c = load();
  // Splinter (own island): a single namespace → single concept-z.
  const solo = c.buildTagElement({ name: 'Awesome Tag', description: '', taPubkeys: [LOCAL] });
  jsonEq(solo.tags, [['d', 'awesome-tag'], ['z', `39998:${LOCAL}:tag`]], 'single namespace → single concept-z (own island)');
  // Dedup: identical canonical+local (e.g. on the legacy deployment where runtime TA == canonical) → one z, not two.
  const dup = c.buildTagElement({ name: 'Awesome Tag', description: '', taPubkeys: [TA, TA] });
  jsonEq(dup.tags, [['d', 'awesome-tag'], ['z', `39998:${TA}:tag`]], 'duplicate namespaces must dedup to a single concept-z');
});

t('federation: empty or malformed taPubkeys throws (no hardcoded fallback)', () => {
  const c = load();
  let threw;
  threw = false; try { c.buildTagElement({ name: 'X', description: '', taPubkeys: [] }); } catch { threw = true; }
  assert(threw, 'empty taPubkeys must throw — the core embeds no default/canonical namespace');
  threw = false; try { c.buildTagElement({ name: 'X', description: '', taPubkeys: [TA, 'not-hex'] }); } catch { threw = true; }
  assert(threw, 'a malformed taPubkeys entry must throw (would compose an undiscoverable concept handle)');
  threw = false; try { c.buildTagElement({ name: 'X', description: '' }); } catch { threw = true; }
  assert(threw, 'missing taPubkeys must throw');
});

// ─── AC-8 (purity/coupling): source-contract over the module files ───
t('purity: no app requires, no network, no Date.now, no crypto, CJS only', () => {
  if (!fs.existsSync(CORE_DIR)) throw new Error(`src/lib/event-tagging/ does not exist yet (purity check)`);
  const files = fs.readdirSync(CORE_DIR).filter((f) => f.endsWith('.js'));
  assert(files.length > 0, 'expected .js files under src/lib/event-tagging/');
  const banned = ['Date.now', 'PUBLISH_RELAYS', 'nostrPublish', 'window.nostr', 'SimplePool', 'fetch(', 'wss:', 'crypto', 'http'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(CORE_DIR, f), 'utf-8');
    for (const bad of banned) {
      assert(!src.includes(bad), `${f} must not reference "${bad}" (dependency-free, no I/O, no time)`);
    }
    assert(!/\bimport\s/.test(src), `${f} must be CommonJS (no ESM import)`);
    // every require(...) must be a sibling './' path — no app/parent escapes, no node_modules deps
    const reqs = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    for (const r of reqs) {
      assert(r.startsWith('./'), `${f}: require('${r}') is not a sibling './' path — core must import nothing external`);
    }
  }
});

async function run() {
  console.log('\n--- event-tagging core tests (epic event-tagging, Story 1) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nevent-tagging-core: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
