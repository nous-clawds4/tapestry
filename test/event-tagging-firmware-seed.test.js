/**
 * Tests for Story 3 (epic: event-tagging) — seed the two DList concepts in firmware.
 *
 * Story: engineering-team/stories/event-tagging/3-firmware-seed-event-tagging-concepts.md
 * ADR:   engineering-team/decisions/event-tagging/0003-firmware-seed-event-tagging-concepts.md
 *
 * Three layers (house style — cf. header-conceptgraph-tag, b-tag-seeds):
 *   FS   — filesystem/manifest structure (deterministic; drives the red phase).
 *   SC   — source-contract over handleCreateConcept (deterministic).
 *   LIVE — against the running stack (:8877 graph + :7778 strfry-scan); the
 *          authoritative post-reinstall proof. SKIPS when the API is unreachable
 *          or the concepts aren't seeded yet (the POST /api/firmware/install
 *          precondition isn't met) — matching profile-tags' concept-graph layer.
 *          After a reinstall they MUST be PASS, not SKIP (Reviewer-required).
 *
 * Intentionally failing until the firmware files + seam land (red phase).
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const CONCEPTS = path.join(REPO, 'firmware/versions/v1.0.0/concepts');
const VERSION_MANIFEST = path.join(REPO, 'firmware/versions/v1.0.0/manifest.json');
const NORMALIZE = path.join(REPO, 'src/api/normalize/index.js');
const CANONICAL = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

/** GET JSON with a short timeout; returns parsed body or null (unreachable). */
async function getJson(url, ms = 4000) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }
const SKIP = 'SKIP';

// ─── Filesystem ───

for (const slug of ['nostr-event-tag', 'tagging-with-specific-tag']) {
  t(`FS: ${slug} concept dir + 3 files; header oNames`, () => {
    const dir = path.join(CONCEPTS, slug);
    for (const f of ['concept-header.json', 'json-schema.json', 'manifest.json']) {
      assert(fs.existsSync(path.join(dir, f)), `missing firmware/versions/v1.0.0/concepts/${slug}/${f}`);
    }
    const ch = readJson(path.join(dir, 'concept-header.json'));
    assert(ch.conceptHeader && ch.conceptHeader.oNames, `${slug}/concept-header.json missing conceptHeader.oNames`);
    const wantSingular = slug === 'nostr-event-tag' ? 'nostr event tagging' : 'tagging with specific tag';
    assert(ch.conceptHeader.oNames.singular === wantSingular,
      `${slug} oNames.singular should be "${wantSingular}" (got "${ch.conceptHeader.oNames.singular}")`);
  });
}

t('FS: manifest registers both with exact slugs + dir/conceptHeader/jsonSchema', () => {
  const manifest = readJson(VERSION_MANIFEST);
  const concepts = manifest.concepts || [];
  for (const slug of ['nostr-event-tag', 'tagging-with-specific-tag']) {
    const e = concepts.find((c) => c.slug === slug);
    assert(e, `versions/v1.0.0/manifest.json has no entry with slug "${slug}" (wire-critical — NOT the oNames-derived "${slug}ging")`);
    assert(e.dir === `./concepts/${slug}/`, `${slug} entry dir should be ./concepts/${slug}/ (got ${e.dir})`);
    assert(e.conceptHeader === 'concept-header.json' && e.jsonSchema === 'json-schema.json',
      `${slug} entry must reference concept-header.json + json-schema.json`);
  }
});

t('FS: both manifest entries communityReference.headerATag → canonical pubkey + relayHints', () => {
  const concepts = readJson(VERSION_MANIFEST).concepts || [];
  for (const slug of ['nostr-event-tag', 'tagging-with-specific-tag']) {
    const cr = (concepts.find((c) => c.slug === slug) || {}).communityReference;
    assert(cr, `${slug} must declare a communityReference (federation to the canonical authority)`);
    assert(cr.headerATag === `39998:${CANONICAL}:${slug}`,
      `${slug} communityReference.headerATag should be 39998:${CANONICAL}:${slug} (canonical, not a runtime pubkey) — got ${cr.headerATag}`);
    assert(Array.isArray(cr.relayHints) && cr.relayHints.length > 0, `${slug} communityReference needs relayHints`);
  }
});

t('FS: tagging-with-specific-tag declares headerTags [["recommended","a"],["allowed","e"]]', () => {
  const ch = readJson(path.join(CONCEPTS, 'tagging-with-specific-tag/concept-header.json'));
  const ht = ch.headerTags || (ch.conceptHeader && ch.conceptHeader.headerTags);
  assert(Array.isArray(ht), 'tagging-with-specific-tag/concept-header.json must declare a headerTags array (top-level or under conceptHeader)');
  const has = (name, val) => ht.some((tag) => Array.isArray(tag) && tag[0] === name && tag[1] === val);
  assert(has('recommended', 'a'), 'headerTags must include ["recommended","a"]');
  assert(has('allowed', 'e'), 'headerTags must include ["allowed","e"]');
});

t('FS: manifest still registers nostr-user-tag + tag (no accidental removal)', () => {
  const slugs = (readJson(VERSION_MANIFEST).concepts || []).map((c) => c.slug);
  for (const slug of ['tag', 'nostr-user-tag', 'tag-pinning']) {
    assert(slugs.includes(slug), `regression: existing concept "${slug}" disappeared from the manifest`);
  }
});

// ─── Source-contract over handleCreateConcept ───

t('SC: handleCreateConcept spreads a concept\'s declared extra header tags onto the 39998 header', () => {
  const src = fs.readFileSync(NORMALIZE, 'utf8');
  // The seam must read the concept's declared extra header tags (ADR 0003 suggests
  // a `headerTags` field on the firmware concept) and emit them onto the kind-39998
  // header tags before signAndFinalize. Anchored on a PROPERTY access (`.headerTags`
  // off the override/concept), distinct from the existing local `headerTags` array var.
  const reads = /(conceptHeaderOverrides|ch|headerWord\.conceptHeader)\.headerTags|extraHeaderTags|customHeaderTags/.test(src);
  assert(reads,
    'src/api/normalize/index.js handleCreateConcept does not read a concept\'s declared extra header tags ' +
    '(e.g. conceptHeaderOverrides.headerTags) to emit onto the kind-39998 header. Per ADR 0003, spread the ' +
    'declared headerTags onto the header `tags` array before signAndFinalize (~:1244–1263). STRUCTURAL ' +
    'sentinel; the authoritative proof is the LIVE published-header test after a firmware reinstall.');
});

t('SC: existing fixed header-tag builder preserved (d/names/json)', () => {
  const src = fs.readFileSync(NORMALIZE, 'utf8');
  assert(/\['d',\s*headerDTag\]/.test(src), "regression: the ['d', headerDTag] header tag was removed");
  assert(/\['json',\s*JSON\.stringify\(headerWord\)\]/.test(src), "regression: the ['json', JSON.stringify(headerWord)] header tag was removed");
});

// ─── Live (skip-gated) ───

t('LIVE: both handles resolve at :8877 (skip if precondition unmet)', async () => {
  const summaries = await getJson('http://localhost:8877/api/concept-graph/summaries');
  if (!summaries || !summaries.success) return SKIP; // concept-graph API unreachable
  const handles = (summaries.summaries || []).map((s) => s.handle);
  const present = (slug) => handles.some((h) => typeof h === 'string' && h.endsWith(`:${slug}`));
  if (!present('nostr-event-tag') && !present('tagging-with-specific-tag')) return SKIP; // not seeded — run POST /api/firmware/install
  assert(present('nostr-event-tag'), 'concept graph is missing 39998:<TA>:nostr-event-tag after seeding');
  assert(present('tagging-with-specific-tag'), 'concept graph is missing 39998:<TA>:tagging-with-specific-tag after seeding');
});

t('LIVE: published tagging-with-specific-tag header carries literal recommended/allowed (skip if unmet)', async () => {
  const ta = await getJson('http://localhost:7778/api/assistant/pubkey');
  if (!ta || !ta.pubkey) return SKIP;
  const filter = JSON.stringify({ kinds: [39998], authors: [ta.pubkey], '#d': ['tagging-with-specific-tag'] });
  const res = await getJson('http://localhost:7778/api/strfry/scan?filter=' + encodeURIComponent(filter));
  if (!res || !res.success) return SKIP; // strfry-scan unreachable
  const ev = (res.events || [])[0];
  if (!ev) return SKIP; // header not published yet — reinstall precondition
  const tags = ev.tags || [];
  const has = (name, val) => tags.some((tag) => tag[0] === name && tag[1] === val);
  assert(has('recommended', 'a'), 'published tagging-with-specific-tag header is missing ["recommended","a"] tag (spec fidelity)');
  assert(has('allowed', 'e'), 'published tagging-with-specific-tag header is missing ["allowed","e"] tag (spec fidelity)');
});

t('LIVE: nostr-user-tag still resolves at :8877 (regression; skip if unreachable)', async () => {
  const summaries = await getJson('http://localhost:8877/api/concept-graph/summaries');
  if (!summaries || !summaries.success) return SKIP;
  const handles = (summaries.summaries || []).map((s) => s.handle);
  assert(handles.some((h) => typeof h === 'string' && h.endsWith(':nostr-user-tag')),
    'regression: existing nostr-user-tag concept no longer resolves in the concept graph');
});

async function run() {
  console.log('\n--- event-tagging firmware-seed tests (epic event-tagging, Story 3) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === SKIP) { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++;
    }
  }
  console.log(`\nevent-tagging-firmware-seed: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
