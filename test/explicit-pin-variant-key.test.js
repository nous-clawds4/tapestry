/**
 * Story search-index-selection #5 — "An explicit pin variant key" (recipes beside places).
 *
 * Story:     engineering-team/stories/search-index-selection/5-explicit-pin-variant-key.md
 * ADR:       engineering-team/decisions/search-index-selection/0003-explicit-pin-variant-key.md (Accepted)
 * Test plan: engineering-team/test-plans/search-index-selection/5-explicit-pin-variant-key.md
 *
 * WHAT THIS SUITE IS. The variant rides the `d` tag — the search backend's permanent
 * subscription key — so the spine of the suite is composition and publication, driven
 * through the real composers and the real runners with INJECTED deps. Everything that
 * lives in JSX (which does not import in node) is pinned with source sentinels.
 *
 *   U  the SDK: `pinVariantKey`, `variantOfPin`, `variantKeyArgs`, the three TL composers,
 *      the slug rules and the pre-signature uniqueness check. Pure, relay-free.
 *   H  the runners (`runOnePin` / `runOneNotePin` / `runOneItemPin` / `refreshAllPinnedTags`
 *      / `retractStaleTLs`) through injected deps: what a recipe publishes, what a
 *      legacy contextual pin still publishes, and the C3 author-must-match policy.
 *   A  client/server parity for a recipe address, and the blob's continued innocence.
 *   S  source sentinels, one per row of ADR §4's readers table.
 *   R  regression sentinels — green BEFORE and AFTER (the guard suites stay untouched, the
 *      retraction sweep still catches `-v-` d-tags, `contextSlugOfPin` is unchanged).
 *
 * STACK-FREE. No strfry, no neo4j, no control panel. `TA_PUBKEY` is provisioned via env at
 * load time (same as test/pin-stack-composition.test.js).
 *
 * ── TESTABILITY CONTRACTS THIS SUITE INTRODUCES (the Implementer must land them) ──────────
 *
 * SEAM 1 — the pre-signature uniqueness/slug check must be PURE and shared.
 *   ADR §3 puts the only real guard in the create dialog, which is JSX and unreachable from
 *   node; ADR §1 puts the slug rules and `KNOWN_CONTEXTS` in the SDK. So the rule lives in
 *   `src/lib/event-tagging/pins.js` (re-exported through `src/lib/event-tagging/index.js`,
 *   which the UI already consumes as `@tapestry/event-tagging`):
 *
 *     const VARIANT_SLUG_MAX = 40;
 *     function validateVariantSlug({ name, existing = [] })
 *       // `existing` = the viewer's existing pins of THIS tag as variantOfPin() outputs:
 *       //              [{ kind: 'context'|'recipe'|null, slug }]
 *       // -> { ok: true,  slug }
 *       // -> { ok: false, reason: 'empty'|'too-long'|'known-context'|'in-use', error }
 *       //    `error` is the message the dialog renders and MUST name the conflict.
 *
 *   `CurationMethodDialog.jsx` calls it and renders `error` inline; nothing is signed on
 *   `ok: false`. The blob builder (`ui/src/utils/curationDialogBuild.js`) is NOT involved —
 *   the variant is identity, not scoring (ADR §2, Option B rejected).
 *
 * SEAM 2 — `refreshAllPinnedTags` must accept injected deps.
 *   ADR §3 layer 2 puts the collision pre-pass in `refreshAllPinnedTags`, which today takes
 *   no arguments and reaches strfry through the module-level `enumeratePinnedTags`. The
 *   house shape applies, unchanged from the runners:
 *
 *     refreshAllPinnedTags(options = {})
 *       const deps = options.deps || options;
 *       const enumerate = deps.enumeratePinnedTags || enumeratePinnedTags;
 *       // deps are forwarded verbatim to runOnePin / runOneNotePin / runOneItemPin
 *       // and to the three retractStaleTLs calls.
 *
 *   Defaults stay the real implementations. Without this, neither the collision pre-pass nor
 *   the roster behaviour under C3 is checkable without a live stack.
 *
 * SHAPE NOTE (ADR ambiguity, resolved by the plan). ADR §3 layer 1 specifies
 * `{ status: 'skipped', reason: 'author-observer-mismatch' }` while every existing runner skip
 * uses `errorReason`. The suite accepts EITHER key carrying that exact value, so the
 * Implementer may stay consistent with the house shape.
 */

'use strict';

// Must be set BEFORE the server modules load: getOwnerAssistantPubkey() reads env first, and
// this host has no /etc/brainstorm.conf (the stack runs in Docker). Respects a real value.
const FIXTURE_TA = 'f'.repeat(63) + '1';
if (!process.env.TA_PUBKEY) process.env.TA_PUBKEY = FIXTURE_TA;

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const SRC = (p) => path.join(REPO, 'src', p);
const UI = (p) => path.join(REPO, 'ui', 'src', p);

const PINS_LIB = SRC('lib/event-tagging/pins.js');
const ET_INDEX = SRC('lib/event-tagging/index.js');
const REFRESH_PATH = SRC('api/trustedList/refreshPinnedTags.js');
const PROFILE_TAGS = SRC('api/profile-tags/index.js');
const TRUSTED_LIST = SRC('api/trustedList/index.js');
const PUBLISH_TAG_PIN = UI('utils/publishTagPin.js');
const BUILD_MODULE = UI('utils/curationDialogBuild.js');
const DIALOG = UI('components/CurationMethodDialog.jsx');
const TAG_PAGE = UI('pages/Tag.jsx');
const PANEL = UI('components/PinnedListPanel.jsx');
const PINS_PAGE = UI('pages/Pins.jsx');
const USE_PINNED_NOTES = UI('hooks/usePinnedNotes.js');
const USE_TAG_MEMBER_SETS = UI('hooks/useTagMemberSets.js');
const CONTEXT_MODAL = UI('components/PinToContextModal.jsx');
const FIRMWARE_SCHEMA = path.join(REPO, 'firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json');

const tests = [];
function t(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function head(relPath) {
  try { return execFileSync('git', ['show', `HEAD:${relPath}`], { cwd: REPO, encoding: 'utf8' }); }
  catch { return null; }
}
function loadPins() { try { return require(PINS_LIB); } catch (e) { return { __loadError: e.message }; } }
function loadET() { try { return require(ET_INDEX); } catch (e) { return { __loadError: e.message }; } }
function loadRefresh() { try { return require(REFRESH_PATH); } catch (e) { return { __loadError: e.message }; } }
function runnerTaPubkey() {
  try { return require(SRC('api/profile-tags')).TA_PUBKEY || null; } catch { return null; }
}

// ── fixtures ────────────────────────────────────────────────────────────────
const HEX = (c) => c.repeat(64);
const OBS = HEX('a');
const TAGAUTHOR = HEX('b');
const TAG_EVENT_ID = HEX('c');
const STRANGER = HEX('9');
const M1 = HEX('1');
const M2 = HEX('2');
const N1 = HEX('3');
const N2 = HEX('4');
const ADDR1 = `30023:${HEX('7')}:an-article`;
const TAG = { eventId: TAG_EVENT_ID, slug: 'funny', name: 'Funny', authorPubkey: TAGAUTHOR, createdAt: 1 };
const POV = { povSuffix: 'deadbeef', minRank: 0.25, delegatedPubkey: HEX('d') };
const LEGACY_TA = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_PINNING_Z = `39998:${LEGACY_TA}:tag-pinning`;

/**
 * A kind-39999 pin. `contextSlug` adds the community `z` stamp (a PLACE); `variantSlug` adds
 * the new `['variant', …]` tag (a RECIPE). Both together is the E3 disagreement fixture.
 */
function makePin({
  contextSlug = null, variantSlug = null, taPubkey, author = OBS, observer = OBS,
  cutoff = 1, targetTypes, membershipMethod, noteMethod = 'notes:net-endorsed',
  tagEventId = TAG_EVENT_ID, id,
} = {}) {
  const cm = { method: 'nip85:rank', observer, cutoff, noteMethod };
  if (targetTypes !== undefined) cm.targetTypes = targetTypes;
  if (membershipMethod !== undefined) cm.membershipMethod = membershipMethod;
  const tags = [['e', tagEventId], ['z', TAG_PINNING_Z], ['curation-method', JSON.stringify(cm)]];
  if (contextSlug) tags.push(['z', `39998:${taPubkey || runnerTaPubkey()}:${contextSlug}`]);
  if (variantSlug) tags.push(['variant', variantSlug]);
  return {
    id: id || `pin-${variantSlug || contextSlug || 'neutral'}-${author.slice(0, 4)}`,
    kind: 39999, pubkey: author, created_at: 10, tags, content: '{}',
  };
}

function byTargetMap() {
  return new Map([
    [M1, { pubkey: M1, applications: 3, disputes: 0, weightedSum: 1, weightedInput: 1 }],
    [M2, { pubkey: M2, applications: 2, disputes: 1, weightedSum: 2, weightedInput: 2 }],
  ]);
}

function profileDeps({ membershipMethod = 'count', tagsById } = {}) {
  const publishCalls = []; const dialCalls = [];
  return {
    publishCalls, dialCalls,
    deps: {
      lookupTag: async (id) => (tagsById ? tagsById[id] : TAG),
      aggregateProfilesTagged: async () => ({ byTarget: byTargetMap(), wotFiltering: true }),
      resolvePov: () => POV,
      resolveMembershipMethod: (...args) => { dialCalls.push(args); return membershipMethod; },
      ensureTagTLHeader: async () => ({ status: 'exists' }),
      ensureHeader: async () => ({ status: 'exists' }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30392' }, uuid: 'u1' }; },
    },
  };
}

function noteDeps({ tagsById } = {}) {
  const publishCalls = [];
  const full = [
    { id: N1, applications: 3, disputes: 0, createdAt: 100 },
    { id: N2, applications: 2, disputes: 0, createdAt: 200 },
  ];
  return {
    publishCalls,
    deps: {
      lookupTag: async (id) => (tagsById ? tagsById[id] : TAG),
      aggregateNotesTagged: async () => ({ members: full, fullMembers: full, scanTruncated: false, total: full.length }),
      resolvePov: () => POV,
      resolveMembershipMethod: () => 'count',
      ensureTagTLHeader: async () => ({ status: 'exists' }),
      ensureHeader: async () => ({ status: 'exists' }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30393' }, uuid: 'u2' }; },
    },
  };
}

function itemDeps({ tagsById } = {}) {
  const publishCalls = [];
  const items = [{ address: ADDR1, applications: 2, disputes: 0, createdAt: 100, mine: false }];
  return {
    publishCalls,
    deps: {
      lookupTag: async (id) => (tagsById ? tagsById[id] : TAG),
      aggregateNotesTagged: async () => ({
        members: [], fullMembers: [], total: 0,
        itemMembers: items, fullItemMembers: items, itemTotal: items.length,
        itemTruncated: false, scanTruncated: false,
      }),
      resolvePov: () => POV,
      resolveMembershipMethod: () => 'count',
      ensureTagTLHeader: async () => ({ status: 'exists', addr: `39999:${runnerTaPubkey()}:tl:funny-tls` }),
      ensureHeader: async () => ({ status: 'exists', addr: `39999:${runnerTaPubkey()}:tl:funny-tls` }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30394' }, uuid: 'u3' }; },
    },
  };
}

const DEPS_CONTRACT =
  'the runner must honor its INJECTED deps (pin-stack-composition established this contract); ';

async function runProfilePin(pin, opts) {
  const mod = loadRefresh();
  assert(typeof mod.runOnePin === 'function',
    `refreshPinnedTags.js must export runOnePin (load error: ${mod.__loadError || 'none'}).`);
  const { deps, publishCalls, dialCalls } = profileDeps(opts);
  let result;
  try { result = await mod.runOnePin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls, dialCalls };
}

async function runNotePin(pin, opts) {
  const mod = loadRefresh();
  assert(typeof mod.runOneNotePin === 'function', 'refreshPinnedTags.js must export runOneNotePin.');
  const { deps, publishCalls } = noteDeps(opts);
  let result;
  try { result = await mod.runOneNotePin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls };
}

async function runItemPin(pin, opts) {
  const mod = loadRefresh();
  assert(typeof mod.runOneItemPin === 'function', 'refreshPinnedTags.js must export runOneItemPin.');
  const { deps, publishCalls } = itemDeps(opts);
  let result;
  try { result = await mod.runOneItemPin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls };
}

function extra(call, name) { return (call.extraTags || []).filter((x) => x[0] === name); }
function zTags(call) { return extra(call, 'z').map((x) => x[1]); }
const TL_Z_RE = /^39998:[0-9a-f]{64}:trusted-list$|^39999:[0-9a-f]{64}:tl:.+-tls$/;
/** z tags that are NOT the Trusted-List discovery pair — i.e. the context stamp, if any. */
function contextZTags(call) { return zTags(call).filter((z) => !TL_Z_RE.test(z)); }
function skipReason(r) { return (r && (r.reason || r.errorReason)) || null; }

/** Same ESM-rewrite trick as test/pin-stack-composition.test.js. */
async function loadClientPublishTagPin() {
  const src = rd(PUBLISH_TAG_PIN);
  if (!src) return { __loadError: 'publishTagPin.js unreadable' };
  const rel = path.relative(path.dirname(PUBLISH_TAG_PIN), ET_INDEX).split(path.sep).join('/');
  const rewritten = src.replace(/^import\s+([\s\S]*?)\s+from\s+'([^']+)';?[ \t]*$/gm, (m, clause, spec) => {
    if (spec === '@tapestry/event-tagging') return `import __et from '${rel}';\nconst ${clause} = __et;`;
    const names = [...clause.matchAll(/([A-Za-z_$][\w$]*)/g)].map((x) => x[1]).filter((n) => n !== 'as');
    return names.map((n) => `const ${n} = undefined;`).join('\n');
  });
  const tmp = path.join(path.dirname(PUBLISH_TAG_PIN), `__variant_probe_${process.pid}.mjs`);
  fs.writeFileSync(tmp, rewritten);
  try { return await import(pathToFileURL(tmp).href); }
  catch (e) { return { __loadError: e.message }; }
  finally { try { fs.unlinkSync(tmp); } catch { /* best effort */ } }
}

async function loadBuildModule() {
  if (!fs.existsSync(BUILD_MODULE)) return { __loadError: 'ui/src/utils/curationDialogBuild.js does not exist' };
  try { return await import(pathToFileURL(BUILD_MODULE).href); }
  catch (e) { return { __loadError: e.message }; }
}

// ===========================================================================
// U — the SDK: the generalised variant key, its reader, and the slug rules
// ===========================================================================

t('U1: pinVariantKey keeps the legacy forms — no members is "" and a context is "-in-<ctx>"', () => {
  const { pinVariantKey } = loadPins();
  assert(typeof pinVariantKey === 'function', 'pins.js must export pinVariantKey.');
  assert(pinVariantKey() === '', 'no argument must still yield the empty (neutral) key.');
  assert(pinVariantKey({}) === '', 'an empty object must still yield the empty key.');
  assert(pinVariantKey({ contextSlug: 'lfo' }) === '-in-lfo',
    'a community pin must still key on -in-<contextSlug>, byte-identical to today (AC-2).');
  assert(pinVariantKey({ contextSlug: null, variantSlug: null }) === '',
    'both members null must yield the neutral key.');
});

t('U2: pinVariantKey gives a recipe its own prefix — "-v-<slug>", never "-in-"', () => {
  const { pinVariantKey } = loadPins();
  assert(typeof pinVariantKey === 'function', 'pins.js must export pinVariantKey.');
  const got = pinVariantKey({ variantSlug: 'search-index' });
  assert(got === '-v-search-index',
    `a recipe must key on -v-<slug> (ADR §1); got ${JSON.stringify(got)}.`);
});

t('U3: the two members are mutually exclusive and the variant wins (E3 — a reader can never compute an address the publisher did not)', () => {
  const { pinVariantKey } = loadPins();
  assert(typeof pinVariantKey === 'function', 'pins.js must export pinVariantKey.');
  const got = pinVariantKey({ contextSlug: 'lfo', variantSlug: 'search-index' });
  assert(got === '-v-search-index',
    `with both members present the VARIANT wins (ADR §1, matching variantOfPin's precedence); got ${JSON.stringify(got)}.`);
});

t('U4: the variant slug bound is exported as VARIANT_SLUG_MAX = 40 (E4)', () => {
  const pins = loadPins();
  assert(pins.VARIANT_SLUG_MAX === 40,
    `pins.js must export VARIANT_SLUG_MAX === 40 (ADR §1, E4); got ${JSON.stringify(pins.VARIANT_SLUG_MAX)}.`);
});

t('U5: variantOfPin reads the pin\'s own variant tag first — a recipe stays a recipe even beside a stray context z (E3)', () => {
  const { variantOfPin } = loadPins();
  const TA = runnerTaPubkey();
  assert(typeof variantOfPin === 'function', 'pins.js must export variantOfPin(pinEvent, taPubkey) (ADR §1).');
  const recipe = variantOfPin(makePin({ variantSlug: 'search-index' }), TA);
  assert(recipe && recipe.kind === 'recipe' && recipe.slug === 'search-index',
    `a pin carrying ['variant','search-index'] must read as {kind:'recipe',slug:'search-index'}; got ${JSON.stringify(recipe)}.`);
  const both = variantOfPin(makePin({ variantSlug: 'search-index', contextSlug: 'lfo', taPubkey: TA }), TA);
  assert(both && both.kind === 'recipe' && both.slug === 'search-index',
    `E3: variant first — a disagreeing pin resolves as the RECIPE and the stray z is ignored; got ${JSON.stringify(both)}.`);
});

t('U6: variantOfPin falls back to the context z for legacy pins, is null for a neutral pin, and ignores a malformed variant tag', () => {
  const { variantOfPin } = loadPins();
  const TA = runnerTaPubkey();
  assert(typeof variantOfPin === 'function', 'pins.js must export variantOfPin (ADR §1).');
  const ctx = variantOfPin(makePin({ contextSlug: 'lfo', taPubkey: TA }), TA);
  assert(ctx && ctx.kind === 'context' && ctx.slug === 'lfo',
    `a legacy contextual pin must read as {kind:'context',slug:'lfo'} with no back-fill (ADR §7); got ${JSON.stringify(ctx)}.`);
  const neutral = variantOfPin(makePin(), TA);
  assert(neutral && neutral.kind === null && neutral.slug === null,
    `a neutral pin must read as {kind:null,slug:null}; got ${JSON.stringify(neutral)}.`);
  const bad = makePin({ contextSlug: 'lfo', taPubkey: TA });
  bad.tags.push(['variant']);        // no value
  bad.tags.push(['variant', '']);    // empty value
  const fallback = variantOfPin(bad, TA);
  assert(fallback && fallback.kind === 'context' && fallback.slug === 'lfo',
    `a malformed variant tag must be ignored and the context recovered; got ${JSON.stringify(fallback)}.`);
});

t('U7: variantKeyArgs turns a variantOfPin result into the composers\' arguments, so no call site re-writes the ternary', () => {
  const { variantKeyArgs, pinVariantKey } = loadPins();
  assert(typeof variantKeyArgs === 'function',
    'pins.js must export the variantKeyArgs(variant) adapter (ADR §1: "so no call site re-writes that ternary").');
  assert(pinVariantKey(variantKeyArgs({ kind: 'recipe', slug: 'search-index' })) === '-v-search-index',
    'variantKeyArgs must map a recipe onto { variantSlug }.');
  assert(pinVariantKey(variantKeyArgs({ kind: 'context', slug: 'lfo' })) === '-in-lfo',
    'variantKeyArgs must map a context onto { contextSlug }.');
  assert(pinVariantKey(variantKeyArgs({ kind: null, slug: null })) === '',
    'variantKeyArgs must map the neutral variant onto neither member.');
});

t('U8: all three Trusted-List composers take the generalised key — a recipe addresses tl-pin- / tl-pin-notes- / tl-pin-items- at -v-<slug>', () => {
  const { tlDTag, noteTlDTag, itemTlDTag } = loadPins();
  const args = { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny', variantSlug: 'search-index' };
  assert(tlDTag(args) === 'tl-pin-aaaaaaaa-bbbbbbbb-funny-v-search-index',
    `tlDTag must thread variantSlug; got ${tlDTag(args)}.`);
  assert(noteTlDTag(args) === 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny-v-search-index',
    `noteTlDTag must thread variantSlug; got ${noteTlDTag(args)}.`);
  assert(itemTlDTag(args) === 'tl-pin-items-aaaaaaaa-bbbbbbbb-funny-v-search-index',
    `itemTlDTag must thread variantSlug; got ${itemTlDTag(args)}.`);
});

t('U9: the legacy addresses are byte-identical — neutral and contextual composition is unchanged by the generalisation (AC-2)', () => {
  const { tlDTag, noteTlDTag, itemTlDTag } = loadPins();
  const args = { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny' };
  assert(tlDTag(args) === 'tl-pin-aaaaaaaa-bbbbbbbb-funny', `neutral tlDTag moved: ${tlDTag(args)}.`);
  assert(noteTlDTag(args) === 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny', `neutral noteTlDTag moved: ${noteTlDTag(args)}.`);
  assert(itemTlDTag(args) === 'tl-pin-items-aaaaaaaa-bbbbbbbb-funny', `neutral itemTlDTag moved: ${itemTlDTag(args)}.`);
  const ctx = { ...args, contextSlug: 'lfo' };
  assert(tlDTag(ctx) === 'tl-pin-aaaaaaaa-bbbbbbbb-funny-in-lfo', `contextual tlDTag moved: ${tlDTag(ctx)}.`);
  assert(noteTlDTag(ctx) === 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny-in-lfo', `contextual noteTlDTag moved: ${noteTlDTag(ctx)}.`);
  assert(itemTlDTag(ctx) === 'tl-pin-items-aaaaaaaa-bbbbbbbb-funny-in-lfo', `contextual itemTlDTag moved: ${itemTlDTag(ctx)}.`);
});

t('U10: validateVariantSlug is the pre-signature house rule — canonical slug, non-empty, <=40, not a community, not already in use (AC-3, AC-4)', () => {
  const pins = loadPins();
  const { validateVariantSlug, KNOWN_CONTEXTS } = pins;
  assert(typeof validateVariantSlug === 'function',
    'pins.js must export validateVariantSlug({name, existing}) — SEAM 1: the ADR §3 client refusal must be pure to be testable (the dialog is JSX).');
  const { slug } = require(SRC('lib/event-tagging/slug.js'));

  const ok = validateVariantSlug({ name: 'Search Index!', existing: [] });
  assert(ok && ok.ok === true && ok.slug === slug('Search Index!') && ok.slug === 'search-index',
    `the stored variant must be the CANONICAL slug() of the name (AC-4); got ${JSON.stringify(ok)}.`);

  const empty = validateVariantSlug({ name: '!!!', existing: [] });
  assert(empty && empty.ok === false && empty.reason === 'empty',
    `a name that slugifies to '' must be refused with reason 'empty' (AC-4); got ${JSON.stringify(empty)}.`);

  const long = validateVariantSlug({ name: 'a'.repeat(41), existing: [] });
  assert(long && long.ok === false && long.reason === 'too-long',
    `a slug over VARIANT_SLUG_MAX (40) must be refused (E4); got ${JSON.stringify(long)}.`);
  const atBound = validateVariantSlug({ name: 'a'.repeat(40), existing: [] });
  assert(atBound && atBound.ok === true, `exactly 40 chars must be accepted; got ${JSON.stringify(atBound)}.`);

  const ctxSlug = KNOWN_CONTEXTS[0].slug;
  const asContext = validateVariantSlug({ name: ctxSlug, existing: [] });
  assert(asContext && asContext.ok === false && asContext.reason === 'known-context',
    `a slug colliding with a KNOWN_CONTEXTS member must be REFUSED, never silently promoted to a community (ADR §1); got ${JSON.stringify(asContext)}.`);

  const dupVariant = validateVariantSlug({ name: 'Search Index', existing: [{ kind: 'recipe', slug: 'search-index' }] });
  assert(dupVariant && dupVariant.ok === false && dupVariant.reason === 'in-use',
    `a name that SLUGIFIES onto an existing variant must be refused before anything is signed (AC-3); got ${JSON.stringify(dupVariant)}.`);
  assert(typeof dupVariant.error === 'string' && dupVariant.error.includes('search-index'),
    `the refusal message must NAME the conflict (AC-3); got ${JSON.stringify(dupVariant.error)}.`);

  const dupContext = validateVariantSlug({ name: 'lfo', existing: [{ kind: 'context', slug: 'lfo' }] });
  assert(dupContext && dupContext.ok === false,
    `a slug equal to an existing pin's context slug must be refused (AC-3); got ${JSON.stringify(dupContext)}.`);

  // The neutral pin is the residual case: only an empty slug could collide with it, and that
  // is already refused above. A neutral sibling must never block a legitimate recipe.
  const besideNeutral = validateVariantSlug({ name: 'Search Index', existing: [{ kind: null, slug: null }] });
  assert(besideNeutral && besideNeutral.ok === true,
    `a viewer's existing NEUTRAL pin must not block a recipe name; got ${JSON.stringify(besideNeutral)}.`);
});

t('U11: the event-tagging SDK index re-exports the whole variant API (the UI consumes it as @tapestry/event-tagging)', () => {
  const et = loadET();
  for (const name of ['pinVariantKey', 'variantOfPin', 'variantKeyArgs', 'validateVariantSlug', 'VARIANT_SLUG_MAX']) {
    assert(et[name] !== undefined,
      `src/lib/event-tagging/index.js must re-export ${name} (ADR Implementation notes: "Add exports to src/lib/event-tagging/index.js"). Load error: ${et.__loadError || 'none'}.`);
  }
});

// ===========================================================================
// H — the runners, through injected deps
// ===========================================================================

t('H1: a recipe pin publishes its profile TL (30392) at the -v-<slug> address, discloses the variant, and claims no community (AC-1)', async () => {
  const { call } = await runProfilePin(makePin({ variantSlug: 'search-index' }));
  assert(call.kind === 30392, `expected the profile TL kind 30392; got ${call.kind}.`);
  assert(call.dTag === 'tl-pin-aaaaaaaa-bbbbbbbb-funny-v-search-index',
    `a recipe's 30392 must publish at tl-pin-<obs8>-<author8>-<slug>-v-search-index; got ${call.dTag}.`);
  const v = extra(call, 'variant');
  assert(v.length === 1 && v[0][1] === 'search-index',
    `the published list must disclose ['variant','search-index'] (ADR §2, "no reader parses the d suffix"); extraTags were ${JSON.stringify(call.extraTags)}.`);
  assert(contextZTags(call).length === 0,
    `AC-1: nothing on the wire may claim a recipe is about a community; context z tags were ${JSON.stringify(contextZTags(call))}.`);
});

t('H2: a recipe pin publishes its note TL (30393) at the -v-<slug> address with the same disclosure and no context z', async () => {
  const { call } = await runNotePin(makePin({ variantSlug: 'search-index', targetTypes: ['profile', 'note'] }));
  assert(call.kind === 30393, `expected the note TL kind 30393; got ${call.kind}.`);
  assert(call.dTag === 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny-v-search-index',
    `a recipe's 30393 must publish at tl-pin-notes-…-v-search-index; got ${call.dTag}.`);
  assert(extra(call, 'variant').length === 1, `the note list must disclose the variant; extraTags were ${JSON.stringify(call.extraTags)}.`);
  assert(contextZTags(call).length === 0, `a recipe's note list must carry no context z; got ${JSON.stringify(contextZTags(call))}.`);
});

t('H3: a recipe pin publishes its item TL (30394) at the -v-<slug> address with the same disclosure and no context z', async () => {
  const { call } = await runItemPin(makePin({ variantSlug: 'search-index', targetTypes: ['profile', 'note', 'item'] }));
  assert(call.kind === 30394, `expected the item TL kind 30394; got ${call.kind}.`);
  assert(call.dTag === 'tl-pin-items-aaaaaaaa-bbbbbbbb-funny-v-search-index',
    `a recipe's 30394 must publish at tl-pin-items-…-v-search-index; got ${call.dTag}.`);
  assert(extra(call, 'variant').length === 1, `the item list must disclose the variant; extraTags were ${JSON.stringify(call.extraTags)}.`);
  assert(contextZTags(call).length === 0, `a recipe's item list must carry no context z; got ${JSON.stringify(contextZTags(call))}.`);
});

t('H4: a legacy contextual pin is unchanged — the -in-<ctx> address, the context z, and NO variant tag (AC-2, E1)', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const { contextHandle } = loadPins();
  const { call: profile } = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA }));
  assert(profile.dTag === 'tl-pin-aaaaaaaa-bbbbbbbb-funny-in-lfo',
    `a contextual 30392 must keep its exact address; got ${profile.dTag}.`);
  assert(zTags(profile).includes(contextHandle(TA, 'lfo')),
    `a contextual list must still carry the community z; z tags were ${JSON.stringify(zTags(profile))}.`);
  assert(extra(profile, 'variant').length === 0,
    `AC-2: a contextual list's tag array must stay byte-identical — no variant disclosure (ADR §2); extraTags were ${JSON.stringify(profile.extraTags)}.`);
  const { call: note } = await runNotePin(makePin({ contextSlug: 'lfo', taPubkey: TA, targetTypes: ['profile', 'note'] }));
  assert(note.dTag === 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny-in-lfo', `a contextual 30393 must keep its exact address; got ${note.dTag}.`);
  assert(extra(note, 'variant').length === 0, 'a contextual note list must carry no variant disclosure.');
  const { call: item } = await runItemPin(makePin({ contextSlug: 'lfo', taPubkey: TA, targetTypes: ['profile', 'note', 'item'] }));
  assert(item.dTag === 'tl-pin-items-aaaaaaaa-bbbbbbbb-funny-in-lfo', `a contextual 30394 must keep its exact address; got ${item.dTag}.`);
  assert(extra(item, 'variant').length === 0, 'a contextual item list must carry no variant disclosure.');
});

t('H5 (C3): a pin whose author is not the observer publishes nothing and claims no address — runOnePin skips it', async () => {
  const mod = loadRefresh();
  assert(typeof mod.runOnePin === 'function', 'refreshPinnedTags.js must export runOnePin.');
  const { deps, publishCalls } = profileDeps();
  const pin = makePin({ author: STRANGER, observer: OBS });
  const r = await mod.runOnePin(pin, { deps, ...deps });
  assert(r && r.status === 'skipped' && skipReason(r) === 'author-observer-mismatch',
    `C3 (ADR §3 layer 1): a pin about someone else's point of view must return {status:'skipped', reason:'author-observer-mismatch'}; got ${JSON.stringify(r)}.`);
  assert(publishCalls.length === 0,
    `a skipped pin must publish NOTHING; it published ${JSON.stringify(publishCalls.map((c) => c.dTag))}.`);
  assert(!r.dTag,
    `a skipped pin must contribute no d-tag to the roster (it never owned the address); got ${JSON.stringify(r.dTag)}.`);
});

t('H6 (C3): the note and item runners skip an author-observer mismatch on the same terms', async () => {
  const mod = loadRefresh();
  assert(typeof mod.runOneNotePin === 'function' && typeof mod.runOneItemPin === 'function',
    'refreshPinnedTags.js must export runOneNotePin and runOneItemPin.');
  const notePin = makePin({ author: STRANGER, observer: OBS, targetTypes: ['profile', 'note'] });
  const nd = noteDeps();
  const nr = await mod.runOneNotePin(notePin, { deps: nd.deps, ...nd.deps });
  assert(nr && nr.status === 'skipped' && skipReason(nr) === 'author-observer-mismatch',
    `runOneNotePin must apply C3; got ${JSON.stringify(nr)}.`);
  assert(nd.publishCalls.length === 0, 'the note runner must publish nothing for a mismatched pin.');
  assert(!nr.dTag, 'the note runner must contribute no d-tag for a mismatched pin.');
  const itemPin = makePin({ author: STRANGER, observer: OBS, targetTypes: ['profile', 'note', 'item'] });
  const idp = itemDeps();
  const ir = await mod.runOneItemPin(itemPin, { deps: idp.deps, ...idp.deps });
  assert(ir && ir.status === 'skipped' && skipReason(ir) === 'author-observer-mismatch',
    `runOneItemPin must apply C3; got ${JSON.stringify(ir)}.`);
  assert(idp.publishCalls.length === 0, 'the item runner must publish nothing for a mismatched pin.');
  assert(!ir.dTag, 'the item runner must contribute no d-tag for a mismatched pin.');
});

t('H7 (C3 consequence): the sweep RETRACTS the list a skipped stranger pin had published, and leaves the observer\'s own list alone', async () => {
  const mod = loadRefresh();
  assert(typeof mod.retractStaleTLs === 'function', 'refreshPinnedTags.js must export retractStaleTLs.');
  const { tlDTag } = loadPins();
  const ownD = tlDTag({ observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny' });
  const strangerD = tlDTag({ observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'gone' });
  const publishCalls = [];
  const deps = {
    strfryScan: async () => ([
      { kind: 30392, tags: [['d', ownD], ['title', 'Funny'], ['observer', OBS]] },
      { kind: 30392, tags: [['d', strangerD], ['title', 'Gone'], ['observer', OBS]] },
    ]),
    publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'x' } }; },
  };
  // The cycle's roster: the observer's own pin is the sole claimant; the skipped stranger
  // pin contributed nothing (H5).
  await mod.retractStaleTLs([ownD], { deps });
  assert(publishCalls.length === 1,
    `exactly one retraction was expected (the stranger's address); got ${JSON.stringify(publishCalls.map((c) => c.dTag))}.`);
  const ret = publishCalls[0];
  assert(ret.dTag === strangerD, `the retraction must target the off-roster address ${strangerD}; got ${ret.dTag}.`);
  assert(Array.isArray(ret.items) && ret.items.length === 0, 'a retraction must publish empty membership.');
  assert((ret.extraTags || []).some((x) => x[0] === 'status' && x[1] === 'retracted'),
    `a retraction must carry ['status','retracted']; extraTags were ${JSON.stringify(ret.extraTags)}.`);
  assert(!publishCalls.some((c) => c.dTag === ownD),
    'the observer\'s own list must be left untouched by the sweep (it is on the roster).');
});

t('H8: two of the observer\'s OWN pins resolving to one address freeze each other — both skipped, logged, and the d-tag KEPT on the roster', async () => {
  const mod = loadRefresh();
  assert(typeof mod.refreshAllPinnedTags === 'function', 'refreshPinnedTags.js must export refreshAllPinnedTags.');
  const { tlDTag } = loadPins();
  // Suffix ambiguity (ADR §3, residual case 2): a NEUTRAL pin on the tag `foo-v-bar` and a
  // RECIPE `bar` on the tag `foo` compose the same tl-pin-<o8>-<a8>-foo-v-bar.
  const TAG_A = { eventId: HEX('5'), slug: 'foo-v-bar', name: 'Foo V Bar', authorPubkey: TAGAUTHOR, createdAt: 1 };
  const TAG_B = { eventId: HEX('6'), slug: 'foo', name: 'Foo', authorPubkey: TAGAUTHOR, createdAt: 1 };
  const collided = tlDTag({ observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'foo-v-bar' });
  assert(collided === tlDTag({ observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'foo', variantSlug: 'bar' }),
    'fixture precondition: tlDTag must thread variantSlug (ADR §1) for the two pins to genuinely collide on one address — ' +
    'pre-implementation the composer ignores variantSlug, which is U8\'s failure, not this one\'s.');
  const pinA = makePin({ id: 'pin-A', tagEventId: TAG_A.eventId });
  const pinB = makePin({ id: 'pin-B', tagEventId: TAG_B.eventId, variantSlug: 'bar' });
  const tagsById = { [TAG_A.eventId]: TAG_A, [TAG_B.eventId]: TAG_B };
  const { deps, publishCalls } = profileDeps({ tagsById });
  deps.enumeratePinnedTags = async () => [pinA, pinB];
  deps.aggregateNotesTagged = async () => ({
    members: [], fullMembers: [], total: 0,
    itemMembers: [], fullItemMembers: [], itemTotal: 0, itemTruncated: false, scanTruncated: false,
  });
  // The sweep must still see the collided d-tag on the roster: a list already published there
  // must NOT be retracted just because both claimants are frozen.
  deps.strfryScan = async () => ([{ kind: 30392, tags: [['d', collided], ['observer', OBS]] }]);
  const logged = [];
  const origErr = console.error; const origWarn = console.warn;
  console.error = (...a) => logged.push(a.join(' '));
  console.warn = (...a) => logged.push(a.join(' '));
  let out;
  try { out = await mod.refreshAllPinnedTags({ deps, ...deps }); }
  catch (err) {
    console.error = origErr; console.warn = origWarn;
    throw new Error('SEAM 2: refreshAllPinnedTags must accept injected deps ({ enumeratePinnedTags, … }) and forward them to the runners and the sweep; it reached the real stack instead: ' + err.message);
  } finally { console.error = origErr; console.warn = origWarn; }
  const rows = (out && out.pins) || [];
  assert(rows.length === 2, `both pins must be reported; got ${JSON.stringify(rows)}.`);
  assert(rows.every((r) => r.status === 'collision'),
    `ADR §3 layer 2: between two of your own pins there is no principled winner — both must be skipped with status 'collision'; got ${JSON.stringify(rows.map((r) => r.status))}.`);
  assert(!publishCalls.some((c) => c.dTag === collided),
    `nothing may be published over a collided address; publishes were ${JSON.stringify(publishCalls.map((c) => c.dTag))}.`);
  assert(logged.some((l) => l.includes('pin-variant-collision')),
    `the collision must be logged loudly ('pin-variant-collision'); logs were ${JSON.stringify(logged)}.`);
  assert(!publishCalls.some((c) => (c.extraTags || []).some((x) => x[0] === 'status' && x[1] === 'retracted')),
    'the collided d-tag must stay on the roster, so the sweep must NOT retract the list already published there.');
});

t('H9 (SEAM 2): refreshAllPinnedTags drives its pins through injected deps, and two distinct variants of one tag both publish to their own address', async () => {
  const mod = loadRefresh();
  assert(typeof mod.refreshAllPinnedTags === 'function', 'refreshPinnedTags.js must export refreshAllPinnedTags.');
  const { deps, publishCalls } = profileDeps();
  deps.enumeratePinnedTags = async () => [
    makePin({ id: 'pin-neutral' }),
    makePin({ id: 'pin-recipe', variantSlug: 'search-index' }),
  ];
  deps.aggregateNotesTagged = async () => ({
    members: [], fullMembers: [], total: 0,
    itemMembers: [], fullItemMembers: [], itemTotal: 0, itemTruncated: false, scanTruncated: false,
  });
  deps.strfryScan = async () => [];
  let out;
  try { out = await mod.refreshAllPinnedTags({ deps, ...deps }); }
  catch (err) {
    throw new Error('SEAM 2: refreshAllPinnedTags must accept injected deps ({ enumeratePinnedTags, … }); it reached the real stack instead: ' + err.message);
  }
  const rows = (out && out.pins) || [];
  assert(rows.length === 2, `both pins must be refreshed; got ${JSON.stringify(rows)}.`);
  const dTags = publishCalls.filter((c) => c.kind === 30392).map((c) => c.dTag);
  assert(dTags.includes('tl-pin-aaaaaaaa-bbbbbbbb-funny'), `the neutral pin must publish at its own address; got ${JSON.stringify(dTags)}.`);
  assert(dTags.includes('tl-pin-aaaaaaaa-bbbbbbbb-funny-v-search-index'), `the recipe must publish at its own address; got ${JSON.stringify(dTags)}.`);
  assert(new Set(dTags).size === dTags.length, `coexisting pins must never share an address; got ${JSON.stringify(dTags)}.`);
});

t('H10 (E6): two recipes of one tag fold independently — each discloses its own membership method at its own address', async () => {
  const a = await runProfilePin(makePin({ variantSlug: 'search-index', membershipMethod: 'certainty' }), { membershipMethod: 'count' });
  const b = await runProfilePin(makePin({ variantSlug: 'everyday', membershipMethod: 'count' }), { membershipMethod: 'count' });
  assert(a.call.dTag === 'tl-pin-aaaaaaaa-bbbbbbbb-funny-v-search-index', `first recipe address wrong: ${a.call.dTag}.`);
  assert(b.call.dTag === 'tl-pin-aaaaaaaa-bbbbbbbb-funny-v-everyday', `second recipe address wrong: ${b.call.dTag}.`);
  const am = extra(a.call, 'membership-method').map((x) => x[1]);
  const bm = extra(b.call, 'membership-method').map((x) => x[1]);
  assert(am.length === 1 && am[0] === 'certainty', `E6: the first recipe must fold by its own method; disclosed ${JSON.stringify(am)}.`);
  assert(bm.length === 1 && bm[0] === 'count', `E6: the second recipe must fold by its own method; disclosed ${JSON.stringify(bm)}.`);
});

t('H11 (E2): a recipe whose slug happens to be a community slug stays a recipe — the carrier decides the kind, not the deployment\'s KNOWN_CONTEXTS', async () => {
  const { KNOWN_CONTEXTS } = loadPins();
  const ctxSlug = KNOWN_CONTEXTS[0].slug; // 'lfo' on this deployment
  const { call } = await runProfilePin(makePin({ variantSlug: ctxSlug }));
  assert(call.dTag === `tl-pin-aaaaaaaa-bbbbbbbb-funny-v-${ctxSlug}`,
    `E2: a pin carrying ['variant','${ctxSlug}'] must keep the -v- address even though ${ctxSlug} is a known context; got ${call.dTag}.`);
  assert(contextZTags(call).length === 0,
    `E2: extending KNOWN_CONTEXTS must never make an already-published recipe start claiming a community; got ${JSON.stringify(contextZTags(call))}.`);
});

// ===========================================================================
// A — client/server parity, and the blob's continued innocence
// ===========================================================================

t('A1: the four client composers thread the variant and agree with the server, address for address (AC-1, E5)', async () => {
  const client = await loadClientPublishTagPin();
  assert(client && !client.__loadError, `publishTagPin.js must load (error: ${client && client.__loadError}).`);
  const pins = loadPins();
  const rows = [
    { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny', variantSlug: 'search-index' },
    { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny', contextSlug: 'lfo' },
    { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny' },
  ];
  for (const row of rows) {
    assert(client.computeTLDTag(row) === pins.tlDTag(row),
      `profile-TL parity broke for ${JSON.stringify(row)}: client "${client.computeTLDTag(row)}" vs server "${pins.tlDTag(row)}".`);
    assert(client.computeNoteTLDTag(row) === pins.noteTlDTag(row),
      `note-TL parity broke for ${JSON.stringify(row)}: client "${client.computeNoteTLDTag(row)}" vs server "${pins.noteTlDTag(row)}".`);
  }
  const pinD = client.computePinEventDTag({
    tagSlug: 'funny', tagAuthorPubkey: TAGAUTHOR, viewerPubkey: OBS, variantSlug: 'search-index',
  });
  assert(pinD === 'tag-pin-funny-bbbbbbbb-aaaaaaaa-v-search-index',
    `computePinEventDTag must thread variantSlug (the pin's own address); got ${pinD}.`);
  const bookmarkD = client.computeNoteBookmarkDTag({
    viewerPubkey: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny', variantSlug: 'search-index',
  });
  assert(bookmarkD === 'notes-pin-aaaaaaaa-bbbbbbbb-funny-v-search-index',
    `E5: computeNoteBookmarkDTag must thread variantSlug so a recipe's export never falls back to the neutral address; got ${bookmarkD}.`);
});

t('A2: the variant is identity, not scoring — the curation blob the dialog builds still carries no variant field', async () => {
  const mod = await loadBuildModule();
  assert(mod && !mod.__loadError && typeof mod.buildCuration === 'function',
    `ui/src/utils/curationDialogBuild.js must still export buildCuration (error: ${mod && mod.__loadError}).`);
  const out = mod.buildCuration({
    observer: '', viewerPubkey: OBS, cutoff: '1', includeScoreInTL: true, method: 'nip85:rank',
    includeProfiles: true, includeNotes: true, includeItems: false, noteMethod: 'notes:net-endorsed',
    authorConstraint: null, rawAuthorConstraint: '', authorConstraintTouched: false,
  });
  assert(out && out.ok === true, `buildCuration must still accept today's state; got ${JSON.stringify(out)}.`);
  assert(!('variant' in out.curation),
    `ADR Option B is rejected: the variant must NEVER enter the curationMethod blob (an unparseable blob would collapse two pins onto one address). Got keys ${JSON.stringify(Object.keys(out.curation))}.`);
});

// ===========================================================================
// S — source sentinels, one per row of ADR §4's readers table
// ===========================================================================

t('S1: /by-id viewerPins expose each pin\'s variant beside its context (ADR §4, profile-tags:900)', () => {
  const src = rd(PROFILE_TAGS);
  assert(/variantOfPin\s*\(/.test(src),
    'src/api/profile-tags/index.js must use variantOfPin (ADR §4) so the client can see a pin\'s variant.');
  assert(/variant:\s*variantOfPin\(/.test(src),
    'the viewerPins rows must carry `variant: variantOfPin(ev2, TA_PUBKEY)` beside the back-compat `context` (AC-5).');
});

t('S2: the neutral pin is the one with NEITHER a context NOR a variant (profile-tags:905-906)', () => {
  const src = rd(PROFILE_TAGS);
  const i = src.indexOf('viewerPin = viewerPins.find(');
  assert(i !== -1, 'profile-tags must still pick viewerPin out of viewerPins.');
  const line = src.slice(i, src.indexOf('\n', i));
  assert(/variant/.test(line),
    `AC-5: viewerPin must be "no context AND no variant" — a recipe carries no context and would otherwise be picked as the neutral pin. Line was: ${line}`);
});

t('S3: the /pins rows carry the variant too (profile-tags:1651)', () => {
  const src = rd(PROFILE_TAGS);
  const i = src.indexOf('context: contextSlugOfPin(pin, TA_PUBKEY)');
  assert(i !== -1, 'the /pins row builder must still exist.');
  const around = src.slice(Math.max(0, i - 400), i + 400);
  assert(/variant:\s*variantOfPin\(pin/.test(around),
    'the /pins rows must carry `variant: variantOfPin(pin, TA_PUBKEY)` beside `context` (ADR §4) — the enrichers below key off it.');
});

t('S4: enrichRowsWithTLStatus delegates to tlDTag and passes the row\'s variant (profile-tags:1715, AC-5)', () => {
  const src = rd(PROFILE_TAGS);
  const i = src.indexOf('async function enrichRowsWithTLStatus');
  assert(i !== -1, 'profile-tags must define enrichRowsWithTLStatus.');
  const body = src.slice(i, i + 2500);
  assert(!/`tl-pin-\$\{/.test(body),
    'ADR §4: the hand-composed `tl-pin-…` template must be replaced by the shared composer — a second copy of the address rule is how client and server drift.');
  assert(/tlDTag\s*\(/.test(body) && /variant/.test(body),
    'enrichRowsWithTLStatus must call tlDTag(...) with the row\'s variant so a recipe\'s TL status is read at its own address (AC-5).');
});

t('S5: enrichRowsWithItemTLStatus reads the item TL at the pin\'s own variant address (profile-tags:1792)', () => {
  const src = rd(PROFILE_TAGS);
  const i = src.indexOf('async function enrichRowsWithItemTLStatus');
  assert(i !== -1, 'profile-tags must define enrichRowsWithItemTLStatus.');
  const body = src.slice(i, i + 2000);
  assert(/itemTlDTag\s*\(/.test(body), 'enrichRowsWithItemTLStatus must still compose through itemTlDTag.');
  assert(!/contextSlug:\s*row\.context\b/.test(body),
    'ADR §4 (J1 round 3): the item-TL status d must take the row\'s full VARIANT (context OR recipe), not `contextSlug: row.context` — else a recipe\'s item list is read at the neutral address.');
  assert(/variant/.test(body), 'enrichRowsWithItemTLStatus must thread the row\'s variant.');
});

t('S6: the NIP-51 export endpoint composes from variantOfPin + tlDTag (trustedList/index.js:409-411)', () => {
  const src = rd(TRUSTED_LIST);
  assert(!/`tl-pin-\$\{/.test(src),
    'ADR §4: src/api/trustedList/index.js must stop hand-composing the `tl-pin-…` string.');
  assert(/variantOfPin\s*\(/.test(src) && /tlDTag\s*\(/.test(src),
    'the export path must read the pin\'s variant (variantOfPin) and compose through tlDTag, so a recipe exports from its own list (ADR §4).');
});

t('S7: pinTag emits [\'variant\', slug] for a recipe and never both a community z and a variant (ADR §2, publishTagPin:153-176)', () => {
  const src = rd(PUBLISH_TAG_PIN);
  const i = src.indexOf('export async function pinTag');
  assert(i !== -1, 'publishTagPin.js must define pinTag.');
  const body = src.slice(i, i + 3000);
  assert(/\['variant',/.test(body),
    "pinTag must emit ['variant', slug] on the kind-39999 pin for a recipe (ADR §2 — the variant is a pin TAG, not a blob field).");
  assert(/variant/.test(body) && /context/.test(body),
    'pinTag must accept a variant beside the existing context argument.');
  assert(/never both|mutually exclusive|not both/i.test(body),
    'ADR §2: a pin is a place OR a recipe, never both — the exclusion must be explicit in pinTag (guard + comment), not incidental.');
});

t('S8 (E5): the note-bookmark export passes the ACTIVE pin\'s variant, not the neutral address (publishTagPin:396)', () => {
  const src = rd(PUBLISH_TAG_PIN);
  const i = src.indexOf('export async function publishNoteBookmarkSetForPin');
  assert(i !== -1, 'publishTagPin.js must define publishNoteBookmarkSetForPin.');
  const body = src.slice(i, i + 3000);
  const call = body.indexOf('computeNoteBookmarkDTag(');
  assert(call !== -1, 'publishNoteBookmarkSetForPin must compose its d-tag with computeNoteBookmarkDTag.');
  const args = body.slice(call, body.indexOf('\n', call) + 200);
  assert(/variantSlug|contextSlug|variant/.test(args),
    `E5 / ADR Consequences: the 30003 export must be written at the ACTIVE pin's address (the reader at PinnedListPanel:293 already links there); args were: ${args.slice(0, 200)}`);
});

t('S9: PinnedListPanel composes all four addresses from the pin\'s variant and labels a recipe by its name (ADR §4)', () => {
  const src = rd(PANEL);
  assert(/pin.*\.variant|activePin\?\.variant|variantOfPin\(/.test(src),
    'PinnedListPanel.jsx must read the pin\'s variant (`activePin.variant`) rather than `activePin.context` alone (ADR §4).');
  for (const composer of ['computeTLDTag', 'itemTlDTag', 'computeNoteBookmarkDTag']) {
    const i = src.indexOf(`${composer}(`);
    assert(i !== -1, `PinnedListPanel.jsx must still compose through ${composer}.`);
    const args = src.slice(i, i + 320);
    assert(/variant/.test(args),
      `${composer} in PinnedListPanel.jsx must be given the pin's variant, or a recipe's panel reads the neutral address.`);
  }
  assert(/usePinnedNotes\([^)]*variant/.test(src.replace(/\s+/g, ' ')),
    'the note list (usePinnedNotes) must be given the pin\'s variant too (ADR §4, PinnedListPanel:200).');
  const labelIdx = src.indexOf('KNOWN_CONTEXTS.find');
  assert(labelIdx === -1 || /variant/.test(src.slice(Math.max(0, labelIdx - 400), labelIdx + 400)),
    'a recipe must be labelled by its own name, never through the KNOWN_CONTEXTS community-label logic (ADR §4).');
});

t('S10: usePinnedNotes composes the note-TL address from the variant (OPEN-298 class, hooks/usePinnedNotes.js:54)', () => {
  const src = rd(USE_PINNED_NOTES);
  const i = src.indexOf('computeNoteTLDTag(');
  assert(i !== -1, 'usePinnedNotes.js must still compose through computeNoteTLDTag.');
  const args = src.slice(i, i + 260);
  assert(/variant/.test(args),
    `the Pinned tab's note list must be addressed by the pin's variant (context OR recipe), not contextSlug alone; args were: ${args.slice(0, 200)}`);
});

t('S11 (OPEN 298 closes): useTagMemberSets delegates to tlDTag with the pin\'s variant instead of hand-composing a suffix-less string', () => {
  const src = rd(USE_TAG_MEMBER_SETS);
  assert(!/`tl-pin-\$\{/.test(src),
    'OPEN 298: useTagMemberSets.js must stop hand-composing `tl-pin-…` (it drops the suffix entirely, losing contextual AND recipe pins).');
  assert(/tlDTag\s*\(/.test(src) && /variant/.test(src),
    'useTagMemberSets.js must call tlDTag with the pin\'s variant (ADR §4).');
});

t('S12: the Pinned tab\'s default pin is the one with NEITHER context nor variant — not `!p.variant` (ADR §4, Tag.jsx:161-168)', () => {
  const src = rd(TAG_PAGE);
  const i = src.indexOf('const neutral = viewerPins.find(');
  assert(i !== -1, 'Tag.jsx must still choose a default pin out of viewerPins.');
  const line = src.slice(i, src.indexOf(';', i));
  assert(/variantOfPin\(|\.variant\?\.kind|variant\.kind/.test(line),
    `the default pin must be selected on the variant's KIND being null; got: ${line}`);
  assert(!/!p\.variant\b/.test(line),
    `J1 round 4: \`!p.variant\` is always false — the row carries an object ({kind,slug}) on every pin. Got: ${line}`);
});

t('S13: the switcher orders neutral -> places -> recipes, with a name for each recipe (Tag.jsx:174-181)', () => {
  const src = rd(TAG_PAGE);
  assert(/variantNameOf/.test(src),
    'Tag.jsx must gain variantNameOf beside contextNameOf (ADR Implementation notes) so a recipe is labelled by its own name.');
  const i = src.indexOf('orderedViewerPins');
  assert(i !== -1, 'Tag.jsx must still build orderedViewerPins.');
  const body = src.slice(i, i + 900);
  assert(/recipe/.test(body),
    'orderedViewerPins must sort in three bands — neutral, then places, then recipes (ADR §5); the recipe band is missing.');
  assert(/contextNameOf/.test(body),
    'the places band must keep its existing alphabetical-by-context-name ordering (AC-6).');
});

t('S14: the chip row separates recipes from places with a divider and its own glyph (ADR §5, Tag.jsx:573-590)', () => {
  const src = rd(TAG_PAGE);
  assert(/bs-pin-switcher-divider/.test(src),
    'ADR §5: a non-interactive "Your curations" divider must separate the last place from the first recipe (the design doc\'s binding warning).');
  assert(/Your curations/.test(src), 'the divider must be labelled "Your curations" (ADR §5).');
  assert(/🧪/.test(src), 'ADR §5: recipes render with a distinct glyph (🧪) in place of 📌.');
  const modal = rd(CONTEXT_MODAL);
  assert(!/variant/i.test(modal),
    'ADR §5: recipes are never created from — nor listed in — the "Pin to a community" picker; PinToContextModal.jsx must not learn about variants.');
});

t('S15: Tag.jsx:142 pinnedContextSlugs is the verified non-consumer — unchanged (ADR §4)', () => {
  const src = rd(TAG_PAGE);
  const i = src.indexOf('const pinnedContextSlugs');
  assert(i !== -1, 'Tag.jsx must still compute pinnedContextSlugs.');
  const now = src.slice(i, src.indexOf(');', i) + 2);
  const before = head('ui/src/pages/Tag.jsx');
  assert(before, 'git show HEAD:ui/src/pages/Tag.jsx must be readable.');
  const j = before.indexOf('const pinnedContextSlugs');
  const then = before.slice(j, before.indexOf(');', j) + 2);
  assert(now === then,
    `ADR §4 declares pinnedContextSlugs a verified NON-consumer (a recipe is never a community, and the client refuses a community slug). It changed:\n  now:  ${now}\n  head: ${then}`);
});

t('S16: the Pins page shows a recipe by name with the recipe glyph, not through KNOWN_CONTEXTS (ADR §4, Pins.jsx:47-58, :73-74)', () => {
  const src = rd(PINS_PAGE);
  assert(/variant/.test(src),
    'Pins.jsx must read each pin\'s variant (ADR §4) — today it only knows `context`.');
  assert(/🧪/.test(src),
    'a recipe badge must carry the recipe glyph, so the Pins page does not render a recipe as a place (ADR §5).');
  const i = src.indexOf('function contextLabel');
  assert(i !== -1, 'Pins.jsx must still label contexts.');
  const around = src.slice(i, i + 900);
  assert(/recipe|variant/.test(around),
    'the label/sort helper must branch on the variant kind rather than routing a recipe through KNOWN_CONTEXTS.');
});

t('S17: the create-mode dialog offers "Save as a separate curation" with a live slug preview and an inline refusal (ADR §5)', () => {
  const src = rd(DIALOG);
  assert(/Save as a separate curation/.test(src),
    'ADR §5: the create-mode dialog must offer the optional "Save as a separate curation" name field (this is the only creation surface for a recipe).');
  assert(/validateVariantSlug/.test(src),
    'the dialog must call validateVariantSlug (SEAM 1) and refuse INLINE, pre-signature (ADR §3) — nothing may be signed on a duplicate, an empty slug, a >40-char slug, or a community slug.');
  assert(/slug\s*\(/.test(src),
    'the field must show a live canonical slug() preview of the typed name (AC-4).');
  const i = src.indexOf('Save as a separate curation');
  const around = src.slice(Math.max(0, i - 1200), i + 1200);
  assert(/mode === 'create'/.test(around) && /context/.test(around),
    'ADR §5: the field is create-mode only and mutually exclusive with pinDialog.context — a community pin never shows it.');
});

t('S18: Tag.jsx publishes a recipe through its own publishVariantPin, passing the {name, slug} beside the blob', () => {
  const src = rd(TAG_PAGE);
  assert(/publishVariantPin/.test(src),
    'ADR §5: submission routes to a new publishVariantPin(curation, variant) in Tag.jsx, a sibling of publishContextPin.');
  const i = src.indexOf('publishVariantPin');
  const body = src.slice(i, i + 1200);
  assert(/pinTag\s*\(/.test(body) || /pinTag/.test(src.slice(i, i + 2000)),
    'publishVariantPin must publish through pinTag (the single pin publisher).');
  assert(/variant/.test(body), 'publishVariantPin must pass the chosen variant through to pinTag.');
});

t('S19: PinToContextModal is untouched, byte for byte (ADR §5: "Pin to a community" is not the recipe surface)', () => {
  const now = rd(CONTEXT_MODAL);
  const before = head('ui/src/components/PinToContextModal.jsx');
  assert(before !== null, 'git show HEAD:ui/src/components/PinToContextModal.jsx must be readable.');
  assert(now === before,
    'ADR §5 states PinToContextModal.jsx is UNTOUCHED — a recipe is created from the curation dialog, never from the community picker.');
});

t('S20: the tag-pinning firmware schema documents the variant (ADR §8)', () => {
  const raw = rd(FIRMWARE_SCHEMA);
  assert(raw, `${FIRMWARE_SCHEMA} must be readable.`);
  let json = null;
  try { json = JSON.parse(raw); } catch (e) { throw new Error(`tag-pinning json-schema.json must stay valid JSON: ${e.message}`); }
  const props = (((json.jsonSchema || {}).properties || {}).tagPinning || {}).properties || {};
  assert(Object.prototype.hasOwnProperty.call(props, 'variant'),
    `ADR §8: the tag-pinning element schema must gain a 'variant' property beside tagEventId (the only human-readable definition of the pin's wire shape). Properties were ${JSON.stringify(Object.keys(props))}.`);
  assert(/variant/.test(JSON.stringify(json)) && /recipe|curation-variant|curation variant/i.test(JSON.stringify(json)),
    'the variant property must be DESCRIBED (what it is, that it mirrors the event tag, and that a community pin carries a z instead) — ADR §8.');
});

t('S22 (review finding): a viewer who already holds a neutral pin can still REACH the create dialog to make a recipe', () => {
  // TagPinAffordance only renders the Pin button while viewerPin is falsy, so the neutral-pin
  // holder — the very user this story is for — had no door to the "Save as a separate
  // curation" field. The Pinned tab must offer a second door that opens the same dialog in
  // variant-ONLY mode (a name required, so it can never publish a second neutral pin).
  const page = rd(UI('pages/Tag.jsx'));
  const dialog = rd(UI('components/CurationMethodDialog.jsx'));
  assert(/hasAnyPin && user && \(/.test(page) && /New curation/.test(page),
    'the Pinned tab must render a "New curation" entry point whenever the viewer holds any pin');
  assert(/setPinDialog\(\{ open: true, context: null, variantOnly: true \}\)/.test(page),
    'that door opens the create dialog in variant-only mode (no context)');
  assert(/requireVariant=\{!!pinDialog\.variantOnly\}/.test(page),
    'the mount forwards variantOnly as requireVariant');
  assert(/requireVariant && !variantName\.trim\(\)/.test(dialog) && /would replace/.test(dialog),
    'in variant-only mode the dialog refuses to submit without a name, naming the stomp it prevents');
  const affordance = rd(UI('components/TagPinAffordance.jsx'));
  assert(/viewerPin/.test(affordance), 'premise: the Pin affordance is gated on viewerPin (so a second door is needed)');
});

t('S21: no TA-pubkey literal is introduced anywhere this story touches (CLAUDE.md house rule)', () => {
  const files = [PINS_LIB, REFRESH_PATH, PROFILE_TAGS, TRUSTED_LIST, PUBLISH_TAG_PIN, DIALOG, TAG_PAGE, PANEL, PINS_PAGE, USE_PINNED_NOTES, USE_TAG_MEMBER_SETS];
  const ALLOWED = new Set([LEGACY_TA]); // ADR-0015 named exception, pre-existing
  for (const f of files) {
    const src = rd(f);
    const hits = [...src.matchAll(/[0-9a-f]{64}/g)].map((m) => m[0]).filter((h) => !ALLOWED.has(h));
    assert(hits.length === 0,
      `${path.relative(REPO, f)} must not carry a 64-hex pubkey literal (CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode"); found ${JSON.stringify(hits.slice(0, 3))}.`);
  }
});

// ===========================================================================
// R — regression sentinels (green BEFORE and AFTER)
// ===========================================================================

t('R1: the guard suites are untouched by the implementation (the byte-identity owners stay put)', () => {
  for (const rel of [
    'test/pin-stack-composition.test.js',
    'test/context-scoped-pins.test.js',
    'test/only-me-curation.test.js',
    'test/per-pin-membership-method.test.js',
  ]) {
    const before = head(rel);
    assert(before !== null, `git show HEAD:${rel} must be readable.`);
    assert(rd(path.join(REPO, rel)) === before,
      `${rel} is a GUARD suite for this story (the story's scoped gate): Phase 4 must not edit it. Re-aims belong to Phase 3.`);
  }
});

t('R2: the retraction sweep still recognises -v- suffixed d-tags on all three list kinds', async () => {
  const mod = loadRefresh();
  assert(typeof mod.retractStaleTLs === 'function', 'refreshPinnedTags.js must export retractStaleTLs.');
  const cases = [
    { kind: 30392, dPrefix: 'tl-pin-', stale: 'tl-pin-aaaaaaaa-bbbbbbbb-funny-v-gone' },
    { kind: 30393, dPrefix: 'tl-pin-notes-', stale: 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny-v-gone' },
    { kind: 30394, dPrefix: 'tl-pin-items-', stale: 'tl-pin-items-aaaaaaaa-bbbbbbbb-funny-v-gone' },
  ];
  for (const c of cases) {
    const publishCalls = [];
    const deps = {
      strfryScan: async () => ([{ kind: c.kind, tags: [['d', c.stale], ['observer', OBS]] }]),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'x' } }; },
    };
    await mod.retractStaleTLs([], { kind: c.kind, dPrefix: c.dPrefix, deps });
    assert(publishCalls.length === 1 && publishCalls[0].dTag === c.stale,
      `a -v- suffixed ${c.kind} list off the roster must still be retracted by the prefix sweep; publishes were ${JSON.stringify(publishCalls.map((x) => x.dTag))}.`);
  }
});

t('R3: contextSlugOfPin is unchanged — it stays the context-only accessor its existing callers depend on', () => {
  const { contextSlugOfPin } = loadPins();
  const TA = runnerTaPubkey();
  assert(typeof contextSlugOfPin === 'function', 'pins.js must still export contextSlugOfPin (ADR §1: "stays, unchanged").');
  assert(contextSlugOfPin(makePin({ contextSlug: 'lfo', taPubkey: TA }), TA) === 'lfo',
    'contextSlugOfPin must still recover a community slug from the z stamp.');
  assert(contextSlugOfPin(makePin({ variantSlug: 'search-index' }), TA) === null,
    'a recipe is NOT a context: contextSlugOfPin must return null for a pin carrying only a variant tag.');
  assert(contextSlugOfPin(makePin(), TA) === null, 'a neutral pin must still resolve to null.');
});

t('R4: the computeTLDTag wrapper keeps its name and shape (restore-historical R-2 pins it)', () => {
  const src = rd(REFRESH_PATH);
  assert(/function\s+computeTLDTag/.test(src),
    'refreshPinnedTags.js must still define computeTLDTag — test/restore-historical-data-and-fix-tl-author-filter.test.js:384-394 asserts it by name.');
  assert(/tl-pin-\$\{[^}]+slice\(0,\s*8\)\}-\$\{[^}]+slice\(0,\s*8\)\}-\$\{[^}]+\}/i.test(src),
    'the canonical `tl-pin-<obs8>-<author8>-<slug>` shape must remain documented in refreshPinnedTags.js (the comment at :118 is what restore-historical R-2 matches).');
});

t('R5: a neutral pin still publishes exactly today\'s 30392 — no variant tag, no address change (AC-2)', async () => {
  const { call } = await runProfilePin(makePin(), { membershipMethod: 'count' });
  assert(call.dTag === 'tl-pin-aaaaaaaa-bbbbbbbb-funny', `the neutral address moved: ${call.dTag}.`);
  assert(extra(call, 'variant').length === 0,
    `a neutral list must gain nothing (ADR §2: additive for recipes only); extraTags were ${JSON.stringify(call.extraTags)}.`);
  assert(contextZTags(call).length === 0, 'a neutral list must carry no context z.');
});

// ===========================================================================

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const test of tests) {
    try {
      const r = await test.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${test.name}`); skipped++; }
      else { console.log(`  ✓ ${test.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${test.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: test.name, message: err.message });
      fail++;
    }
  }
  console.log(`\nexplicit-pin-variant-key: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
