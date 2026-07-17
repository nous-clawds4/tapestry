/**
 * contextual-pins Story 1 / ADR 0001 — context-scoped pins.
 *
 * RED until:
 *   - the SDK module `src/lib/event-tagging/pins.js` exists (pinVariantKey,
 *     contextHandle, contextSlugOfPin, contextPinsToTags, KNOWN_CONTEXTS);
 *   - the five d-tag schemes thread pinVariantKey (client + server);
 *   - pinTag stamps a runtime-TA context z; the read path exposes viewerPins;
 *   - the two contexts are seeded in firmware.
 *
 * Pure-logic coverage of the SDK spine + source-contract markers for the
 * client/server surfaces that don't load under node (vite alias / JSX).
 * The SDK is required LAZILY inside each test so a not-yet-existent module
 * fails THIS suite meaningfully instead of crashing the runner at load.
 */
const fs = require('fs');
const path = require('path');

function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
const SRC = (p) => path.resolve(__dirname, '..', 'src', p);
const UI = (p) => path.resolve(__dirname, '..', 'ui/src', p);
const FW = (p) => path.resolve(__dirname, '..', 'firmware/versions/v1.0.0', p);
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function P() {
  try { return require('../src/lib/event-tagging/pins'); }
  catch (e) { throw new Error('SDK module src/lib/event-tagging/pins.js does not exist yet: ' + e.message); }
}

const tests = [];
const t = (n, f) => tests.push([n, f]);

// Fixtures. RUNTIME_TA is deliberately DISTINCT from the legacy pubkey — the
// non-dev case, where a legacy-vs-runtime confusion actually breaks discovery.
const RUNTIME_TA = 'aa'.repeat(32);
const LEGACY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_AUTHOR = 'bb'.repeat(32);
const VIEWER = 'cc'.repeat(32);

function pinEvent({ contextSlug = null, tagSlug = 'bitcoin', tagAuthor = TAG_AUTHOR, author = VIEWER } = {}) {
  const tags = [
    ['e', 'deadbeef'.repeat(8)],
    ['a', `39999:${tagAuthor}:${tagSlug}`],
    ['z', `39998:${LEGACY}:tag-pinning`], // base pin stamp — legacy pubkey (ADR 0015)
  ];
  if (contextSlug) tags.push(['z', `39998:${RUNTIME_TA}:${contextSlug}`]); // context stamp — runtime TA
  return { kind: 39999, pubkey: author, tags, content: '' };
}

// ── SDK: pinVariantKey (the single d-tag discriminator) ──────────────────────

t('pinVariantKey() with no/empty context → "" (bare pins keep their current d-tag byte-for-byte)', () => {
  const { pinVariantKey } = P();
  assert(pinVariantKey() === '', 'no arg must yield empty discriminator');
  assert(pinVariantKey({}) === '', 'empty object must yield empty discriminator');
  assert(pinVariantKey({ contextSlug: null }) === '', 'null contextSlug must yield empty discriminator');
});

t('pinVariantKey({contextSlug:"lfo"}) → "-in-lfo"', () => {
  const { pinVariantKey } = P();
  assert(pinVariantKey({ contextSlug: 'lfo' }) === '-in-lfo',
    `expected "-in-lfo", got ${JSON.stringify(pinVariantKey({ contextSlug: 'lfo' }))}`);
});

// ── SDK: contextHandle (runtime-TA, bare slug) ───────────────────────────────

t('contextHandle(taPubkey,"lfo") → 39998:<taPubkey>:lfo (runtime TA, no prefix)', () => {
  const { contextHandle } = P();
  assert(contextHandle(RUNTIME_TA, 'lfo') === `39998:${RUNTIME_TA}:lfo`,
    `got ${contextHandle(RUNTIME_TA, 'lfo')}`);
});

// ── SDK: contextSlugOfPin (recover context from the z stamp, not the d-tag) ──

t('contextSlugOfPin recovers the context slug from a contextual pin', () => {
  const { contextSlugOfPin } = P();
  assert(contextSlugOfPin(pinEvent({ contextSlug: 'lfo' }), RUNTIME_TA) === 'lfo',
    'must recover "lfo" from the runtime-TA context z stamp');
});

t('contextSlugOfPin returns null for a neutral pin (explicit-affiliation: no stamp, no context)', () => {
  const { contextSlugOfPin } = P();
  assert(contextSlugOfPin(pinEvent({ contextSlug: null }), RUNTIME_TA) === null,
    'a neutral pin must have no context');
});

t('contextSlugOfPin does NOT misread the legacy tag-pinning z as a context (disambiguation)', () => {
  const { contextSlugOfPin } = P();
  // The base pin z is 39998:<LEGACY>:tag-pinning. Even if a deployment's runtime
  // TA coincided with LEGACY (dev machine), "tag-pinning" is not a known context
  // slug, so it must never be returned as a context.
  const p = pinEvent({ contextSlug: null });
  assert(contextSlugOfPin(p, LEGACY) === null,
    'the tag-pinning base stamp must never be read as a context');
});

// ── SDK: contextPinsToTags (pure derivation: dedupe + injected trust filter) ─

t('contextPinsToTags dedupes by pinned-tag a-coordinate (two authors, one tag → one chip)', () => {
  const { contextPinsToTags } = P();
  const out = contextPinsToTags(
    [pinEvent({ author: 'a1'.repeat(32) }), pinEvent({ author: 'a2'.repeat(32) })],
    { trustFilter: () => true }
  );
  assert(out.length === 1, `expected 1 deduped tag, got ${out.length}`);
  assert(out[0].tagSlug === 'bitcoin', `expected slug "bitcoin", got ${out[0].tagSlug}`);
});

t('contextPinsToTags applies the injected trustFilter (untrusted authors dropped)', () => {
  const { contextPinsToTags } = P();
  const trusted = 'a1'.repeat(32);
  const out = contextPinsToTags(
    [pinEvent({ author: trusted, tagSlug: 'bitcoin' }),
     pinEvent({ author: 'a2'.repeat(32), tagSlug: 'nostr' })],
    { trustFilter: (pk) => pk === trusted }
  );
  assert(out.length === 1 && out[0].tagSlug === 'bitcoin',
    `only the trusted author's tag should survive, got ${JSON.stringify(out.map((x) => x.tagSlug))}`);
});

t('contextPinsToTags returns display-sufficient fields (slug + author + a-coord) from events alone (portable, no I/O)', () => {
  const { contextPinsToTags } = P();
  const out = contextPinsToTags([pinEvent({})], { trustFilter: () => true });
  assert(out[0].tagSlug === 'bitcoin', 'must expose tagSlug');
  assert(out[0].tagAuthorPubkey === TAG_AUTHOR, 'must expose tagAuthorPubkey');
  assert(typeof out[0].aCoord === 'string' && out[0].aCoord.includes(':bitcoin'), 'must expose the a-coordinate');
});

t('contextPinsToTags does not mutate its input (pure)', () => {
  const { contextPinsToTags } = P();
  const input = [pinEvent({})];
  const before = JSON.stringify(input);
  contextPinsToTags(input, { trustFilter: () => true });
  assert(JSON.stringify(input) === before, 'input events must not be mutated');
});

// Demonstrates the discoverability contract purely: a #z scan for a context is
// equivalent to filtering by contextSlugOfPin — neutral pins are excluded.
t('a context scan excludes neutral pins of the same tag (discoverability via stamp)', () => {
  const { contextSlugOfPin } = P();
  const mixed = [pinEvent({ contextSlug: 'lfo' }), pinEvent({ contextSlug: null })];
  const inLfo = mixed.filter((p) => contextSlugOfPin(p, RUNTIME_TA) === 'lfo');
  assert(inLfo.length === 1, 'only the lfo-stamped pin belongs to the lfo context');
});

// ── SDK: KNOWN_CONTEXTS (the initial offered set; slugs only, no event IDs) ──

t('KNOWN_CONTEXTS offers lfo + tapestry-web-of-trust with display names and no event IDs', () => {
  const { KNOWN_CONTEXTS } = P();
  assert(Array.isArray(KNOWN_CONTEXTS), 'KNOWN_CONTEXTS must be an array');
  const bySlug = Object.fromEntries(KNOWN_CONTEXTS.map((c) => [c.slug, c]));
  assert(bySlug.lfo && bySlug.lfo.name === 'LFO', 'must offer lfo → "LFO"');
  assert(bySlug['tapestry-web-of-trust'] && /Tapestry/.test(bySlug['tapestry-web-of-trust'].name),
    'must offer tapestry-web-of-trust → "Tapestry & Web of Trust"');
  for (const c of KNOWN_CONTEXTS) {
    assert(!/^[0-9a-f]{64}$/i.test(c.id || ''), 'contexts must not carry hardcoded 64-hex event IDs');
  }
});

// ── Source-contract: write path threads the discriminator + stamps runtime TA ─

t('publishTagPin: computePinEventDTag threads pinVariantKey (context in pin identity)', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  assert(/computePinEventDTag[\s\S]{0,400}pinVariantKey/.test(s),
    'computePinEventDTag must append pinVariantKey so contextual pins get a distinct d-tag');
});

t('publishTagPin: computeTLDTag + computeNoteBookmarkDTag thread pinVariantKey', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  assert(/computeTLDTag[\s\S]{0,400}pinVariantKey/.test(s), 'computeTLDTag must append pinVariantKey');
  assert(/computeNoteBookmarkDTag[\s\S]{0,400}pinVariantKey/.test(s), 'computeNoteBookmarkDTag must append pinVariantKey');
});

t('publishTagPin: pinTag stamps the context via contextHandle (runtime TA), not the legacy literal', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  assert(/contextHandle\s*\(/.test(s),
    'pinTag must compose the context z via contextHandle(taPubkey, slug), i.e. the runtime TA — not LEGACY_TA_PUBKEY');
});

// ── Source-contract: server threads discriminator, keeps retraction set-based ─

t('refreshPinnedTags: TL d-tags thread pinVariantKey and context is recovered from the pin', () => {
  const s = rd(SRC('api/trustedList/refreshPinnedTags.js'));
  assert(/pinVariantKey/.test(s), 'server TL d-tag builders must thread pinVariantKey');
  assert(/contextSlugOfPin/.test(s), 'runOnePin must recover the context from the pin z stamp');
});

t('refreshPinnedTags: retraction stays SET-BASED on full d-tags (invariant — no (obs,author,slug) collapse)', () => {
  const s = rd(SRC('api/trustedList/refreshPinnedTags.js'));
  assert(/new Set\(\s*currentDTags\s*\)/.test(s),
    'retractStaleTLs must diff on the full set of current d-tags; collapsing by (obs,author,slug) would retract sibling contextual TLs');
});

t('profile-tags read path exposes viewerPins (plural — coexisting pins per tag)', () => {
  const s = rd(SRC('api/profile-tags/index.js'));
  assert(/viewerPins/.test(s), 'the tag read response must expose viewerPins (array), not only a singular viewerPin');
});

// ── Source-contract: firmware provisioning (no event IDs; slug-derivable) ────

t('firmware seeds the lfo + tapestry-web-of-trust context concepts in the manifest', () => {
  let manifest;
  try { manifest = JSON.parse(rd(FW('manifest.json'))); } catch { manifest = null; }
  assert(manifest && Array.isArray(manifest.concepts), 'active firmware manifest must parse');
  const slugs = new Set(manifest.concepts.map((c) => c.slug));
  assert(slugs.has('lfo'), 'manifest must register the lfo context concept');
  assert(slugs.has('tapestry-web-of-trust'), 'manifest must register the tapestry-web-of-trust context concept');
});

t('firmware context concept-header files exist (fresh-deploy provisioning, no event IDs in client code)', () => {
  assert(rd(FW('concepts/lfo/concept-header.json')).length > 0, 'concepts/lfo/concept-header.json must exist');
  assert(rd(FW('concepts/tapestry-web-of-trust/concept-header.json')).length > 0,
    'concepts/tapestry-web-of-trust/concept-header.json must exist');
});

// ── Source-contract: client affordance (two-button pin + context picker) ─────

t('tag pin UI offers a context/community pin affordance driven by KNOWN_CONTEXTS', () => {
  const s = rd(UI('components/TagPinAffordance.jsx')) + rd(UI('pages/Tag.jsx'));
  assert(/KNOWN_CONTEXTS/.test(s), 'the pin affordance must offer contexts from KNOWN_CONTEXTS');
  assert(/viewerPins/.test(s), 'the pin UI must consume viewerPins (per-context pin state)');
});

// ── Story 2 — Pinned tab displays the TA-signed note TL (kind-30393) ─────────

t('Story 2: a client note-TL d-tag helper composes tl-pin-notes-… with the discriminator', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  assert(/computeNoteTLDTag/.test(s), 'publishTagPin must export computeNoteTLDTag (client mirror of the server note-TL d-tag)');
  assert(/tl-pin-notes-[\s\S]{0,120}pinVariantKey/.test(s),
    'computeNoteTLDTag must compose tl-pin-notes-… and thread pinVariantKey (context-aware)');
});

t('Story 2: usePinnedNotes reads the TA-signed kind-30393 (authors=TA), not the client kind-30003', () => {
  const s = rd(UI('hooks/usePinnedNotes.js'));
  assert(/30393/.test(s), 'usePinnedNotes must read the TA-signed note TL (kind-30393)');
  assert(/computeNoteTLDTag/.test(s), 'usePinnedNotes must key on the note-TL d-tag');
  assert(/taPubkey/.test(s), 'usePinnedNotes must scan authors=[taPubkey] (the TA-signed list)');
  assert(!/kinds:\s*\[30003\]/.test(s), 'usePinnedNotes must NOT read the client kind-30003 bookmark as the display source');
});

t('Story 2: the Pinned panel reads notes under the pin\'s observer + context, and updates via server refresh', () => {
  const s = rd(UI('components/PinnedListPanel.jsx'));
  assert(/usePinnedNotes\(\s*tag,\s*observer,\s*noteMethod,\s*contextSlug\b/.test(s),
    'PinnedListPanel must call usePinnedNotes with the pin observer + contextSlug (its own note list)');
  assert(/refresh-pinned-tag[\s\S]{0,200}refetchPinnedNotes/.test(s),
    'the "update pinned notes" action must recompute the TA note TL via the server refresh (no client re-export)');
});

t('Story 2: the stale "no TA-signed note-TL yet" comment is retired', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  assert(!/no TA-signed note-TL yet/.test(s), 'the obsolete issue-#336 comment must be removed (the note TL now exists and is displayed)');
});

// ── Story 3 — tagging an event refreshes the viewer's pins (no prompt) ───────

t('Story 3: event-tagging apply/dispute refreshes the viewer\'s pins via the server (no signer prompt)', () => {
  const s = rd(UI('hooks/useEventTagging.js'));
  assert(/refresh-pinned-tags-for-viewer/.test(s),
    'useEventTagging must call refresh-pinned-tags-for-viewer after a tagging (server recompute, no NIP-07 prompt)');
  assert(/refreshViewerPinsDebounced[\s\S]{0,600}refreshViewerPinsDebounced/.test(s),
    'both applyTag AND disputeTag must trigger the pin refresh');
});

t('Story 3: the pin refresh is debounced per viewer (coalesce tag/untag bursts)', () => {
  const s = rd(UI('hooks/useEventTagging.js'));
  assert(/setTimeout[\s\S]{0,200}refresh-pinned-tags-for-viewer|_pinRefreshTimers/.test(s),
    'the refresh must be debounced (a per-viewer timer), not fired synchronously on every keystroke/tagging');
});

// ── Note-curation cutoff (mirrors the profile rule for notes) ────────────────

t('Note curation honors the pin cutoff: a lone self-tagging is excluded at cutoff 2', () => {
  const { curateNotes } = require('../src/lib/event-tagging/taggings');
  const notes = [
    { id: 'solo',  applications: 1, disputes: 0, createdAt: 100 }, // just the viewer
    { id: 'voted', applications: 2, disputes: 0, createdAt: 200 }, // viewer + 1 other
  ];
  const at1 = curateNotes(notes, 'notes:net-endorsed', 1).map((n) => n.id);
  assert(at1.includes('solo') && at1.includes('voted'), 'cutoff 1: both qualify');
  const at2 = curateNotes(notes, 'notes:net-endorsed', 2).map((n) => n.id);
  assert(!at2.includes('solo') && at2.includes('voted'),
    'cutoff 2: a note with only one (self) tagging must be excluded — the reported bug');
});

t('Note curation cutoff mirrors the profile rule (applications >= cutoff AND applications > disputes)', () => {
  const { curateNotes } = require('../src/lib/event-tagging/taggings');
  const notes = [{ id: 'contested', applications: 2, disputes: 2, createdAt: 1 }]; // meets cutoff but not net-positive
  assert(curateNotes(notes, 'notes:net-endorsed', 2).length === 0,
    'a note that meets the cutoff but is not net-positive (apps not > disputes) must be excluded');
});

t('curateNotes default (no cutoff arg) preserves back-compat behavior', () => {
  const { curateNotes } = require('../src/lib/event-tagging/taggings');
  const notes = [{ id: 'a', applications: 1, disputes: 0, createdAt: 1 }];
  assert(curateNotes(notes, 'notes:net-endorsed').map((n) => n.id).join() === 'a',
    'default (no cutoff) keeps the prior net-endorsed behavior (a 1-application note qualifies)');
});

t('Server note curation threads the pin cutoff', () => {
  const s = rd(SRC('api/trustedList/refreshPinnedTags.js'));
  assert(/curateNotes\([^)]*noteCutoff|curateNotes\([\s\S]{0,80}curation\.cutoff/.test(s),
    'runOneNotePin must pass the pin cutoff into curateNotes');
});

t('A single-pin refresh recomputes BOTH the profile and note TLs', () => {
  const s = rd(SRC('api/trustedList/refreshPinnedTags.js'));
  const fn = s.slice(s.indexOf('function refreshOnePinnedTagById'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(/runOnePin\(pin\)/.test(body) && /runOneNotePin\(pin\)/.test(body),
    'refreshOnePinnedTagById must run BOTH runOnePin (profiles) and runOneNotePin (notes) — else "Update pinned notes" and context-pin edits never recompute the note list');
});

async function run() {
  console.log('\n--- context-scoped pins tests (contextual-pins Story 1, ADR 0001) ---');
  let pass = 0, fail = 0; const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failures.push({ name, message: e.message }); fail++; }
  }
  console.log(`\ncontext-scoped-pins: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) { run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); }); }
module.exports = { run };
