/**
 * Story search-index-selection #4 — "A confirm step on first pin".
 *
 * Story:     engineering-team/stories/search-index-selection/4-confirm-step-on-first-pin.md
 * Design:    the story's "Design note (Light — after Gate A)". No ADR (Light lane; Gate A ruled
 *            this is a re-ordering of WHEN the same pin + the same curation blob publish).
 * Test plan: engineering-team/test-plans/search-index-selection/4-confirm-step-on-first-pin.md
 *
 * WHAT THIS SUITE IS. This is a UI-only story: there is no server seam, no new endpoint, no
 * wire change. So the suite drives the one piece of the flow that is (or must become) pure
 * logic — the curation blob the dialog builds — and pins everything else with source
 * sentinels and regression sentinels. STACK-FREE: no strfry, no neo4j, no control panel.
 *
 *   U  the blob's byte-identity, as pure functions. AC-2's sentinel: an UNTOUCHED submit
 *      through the dialog must deep-equal `defaultCurationMethod(pubkey)`, and the default
 *      itself must keep exactly today's key set. Stories 3 (`membershipMethod`) and 5 (the
 *      variant key) add fields to this same dialog; U3 is what keeps them from leaking into
 *      the default a first pin publishes.
 *   S  source sentinels: the interstitial is wired in `Tag.jsx`, the create-mode copy exists,
 *      the untouched surfaces really are untouched (byte-compared against HEAD).
 *   R  regression sentinels on the deliberately untouched behaviour (green before AND after).
 *
 * THE TESTABILITY CONTRACT THIS SUITE INTRODUCES (the Implementer must land it).
 * React JSX does not import in node, so the dialog's submit build cannot be exercised where
 * it lives today (`ui/src/components/CurationMethodDialog.jsx:120-153`). The Implementer
 * extracts it — behaviour-preserving — into a new pure ESM module:
 *
 *   ui/src/utils/curationDialogBuild.js
 *     export function normalizeCutoff(raw)                 // '1' -> { ok:true, value:1 }
 *     export function normalizeObserver(raw, viewerPubkey) // ''  -> { ok:true, value:viewerPubkey }
 *     export function buildCuration(state)
 *
 *   `state` is the dialog's form state, verbatim:
 *     { observer, viewerPubkey, cutoff, includeScoreInTL, method,
 *       includeProfiles, includeNotes, includeItems, noteMethod,
 *       authorConstraint, rawAuthorConstraint, authorConstraintTouched }
 *
 *   returns { ok: true, curation } on success,
 *           { ok: false, fieldErrors } when validation fails (the dialog renders these
 *           exactly as it does today and publishes nothing).
 *
 * The module must be importable by plain node: no JSX, no vite-only specifiers, no React.
 * `CurationMethodDialog.jsx` then imports all three and keeps its own `useState` wiring.
 *
 * `defaultCurationMethod` (`ui/src/utils/publishTagPin.js`) is the WIRE CONTRACT and is NOT
 * touched by this story — S9 byte-compares it against `git show HEAD`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const UI = (p) => path.join(REPO, 'ui', 'src', p);
const SRC = (p) => path.join(REPO, 'src', p);

const PUBLISH_TAG_PIN = UI('utils/publishTagPin.js');
const BUILD_MODULE = UI('utils/curationDialogBuild.js');
const DIALOG = UI('components/CurationMethodDialog.jsx');
const TAG_PAGE = UI('pages/Tag.jsx');
const AFFORDANCE = UI('components/TagPinAffordance.jsx');
const CONTEXT_MODAL = UI('components/PinToContextModal.jsx');
const PANEL = UI('components/PinnedListPanel.jsx');

const tests = [];
function t(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function head(relPath) {
  try {
    return execFileSync('git', ['show', `HEAD:${relPath}`], { cwd: REPO, encoding: 'utf8' });
  } catch { return null; }
}

const VIEWER = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

// ── module loading ──────────────────────────────────────────────────────────

/**
 * `ui/src/utils/publishTagPin.js` is ESM carrying a vite-only alias (`@tapestry/event-tagging`)
 * and browser transports. Same trick as test/pin-stack-composition.test.js `loadClientPublishTagPin`:
 * rewrite the alias onto the real CJS lib, stub every other import, import the rewritten copy.
 */
async function loadClientPublishTagPin() {
  const src = rd(PUBLISH_TAG_PIN);
  if (!src) return { __loadError: 'publishTagPin.js unreadable' };
  const rel = path
    .relative(path.dirname(PUBLISH_TAG_PIN), SRC('lib/event-tagging/index.js'))
    .split(path.sep).join('/');
  const rewritten = src.replace(/^import\s+([\s\S]*?)\s+from\s+'([^']+)';?[ \t]*$/gm, (m, clause, spec) => {
    if (spec === '@tapestry/event-tagging') {
      return `import __et from '${rel}';\nconst ${clause} = __et;`;
    }
    const names = [...clause.matchAll(/([A-Za-z_$][\w$]*)/g)].map((x) => x[1]).filter((n) => n !== 'as');
    return names.map((n) => `const ${n} = undefined;`).join('\n');
  });
  const tmp = path.join(path.dirname(PUBLISH_TAG_PIN), `__confirm_step_probe_${process.pid}.mjs`);
  fs.writeFileSync(tmp, rewritten);
  try { return await import(pathToFileURL(tmp).href); }
  catch (e) { return { __loadError: e.message }; }
  finally { try { fs.unlinkSync(tmp); } catch { /* best effort */ } }
}

/** The new pure module. Imported as-is — it must be plain ESM with no vite-only specifiers. */
async function loadBuildModule() {
  if (!fs.existsSync(BUILD_MODULE)) {
    return { __loadError: 'ui/src/utils/curationDialogBuild.js does not exist' };
  }
  try { return await import(pathToFileURL(BUILD_MODULE).href); }
  catch (e) { return { __loadError: e.message }; }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function sortedKeys(o) { return Object.keys(o).sort(); }

/** Order-insensitive deep equality (arrays stay ordered; object key order does not matter). */
function deepEq(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEq(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = sortedKeys(a), kb = sortedKeys(b);
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) => deepEq(a[k], b[k]));
  }
  return false;
}

/**
 * The dialog's form state as React seeds it from `initialCuration`, with NOTHING touched.
 * Mirrors `CurationMethodDialog.jsx` `useState` initialisers (`:68-98`) exactly — that
 * mapping is the thing AC-2 makes load-bearing, so it lives here in one place.
 */
function seededFrom(init, viewerPubkey) {
  const initTypes = init.targetTypes || ['profile', 'note'];
  return {
    viewerPubkey,
    cutoff: String(init.cutoff ?? 1),
    includeScoreInTL: !!init.includeScoreInTL,
    method: init.method || 'nip85:rank',
    includeProfiles: initTypes.includes('profile'),
    includeNotes: initTypes.includes('note'),
    includeItems: initTypes.includes('item'),
    noteMethod: init.noteMethod || 'notes:net-endorsed',
    rawAuthorConstraint: init.authorConstraint,
    authorConstraint: init.authorConstraint === 'observer' ? 'observer' : '',
    authorConstraintTouched: false,
    observer: init.observer && init.observer !== viewerPubkey ? init.observer : '',
  };
}

async function built(state, whatFor) {
  const mod = await loadBuildModule();
  assert(!mod.__loadError,
    `${whatFor}: ui/src/utils/curationDialogBuild.js must load in plain node (error: ${mod.__loadError}).`);
  assert(typeof mod.buildCuration === 'function',
    `${whatFor}: curationDialogBuild.js must export buildCuration(state).`);
  return mod.buildCuration(state);
}

// ===========================================================================
// U — the curation blob as pure logic (AC-2, AC-4, AC-6, E2, E3)
// ===========================================================================

t('U1 AC-2: the default curation a first pin publishes carries exactly today\'s six keys — no membershipMethod, no authorConstraint', async () => {
  const mod = await loadClientPublishTagPin();
  assert(!mod.__loadError, `publishTagPin.js must load as a module (error: ${mod.__loadError}).`);
  assert(typeof mod.defaultCurationMethod === 'function', 'publishTagPin.js must export defaultCurationMethod.');
  const d = mod.defaultCurationMethod(VIEWER);
  const expected = ['cutoff', 'includeScoreInTL', 'method', 'noteMethod', 'observer', 'targetTypes'];
  assert(deepEq(sortedKeys(d), expected),
    `the wire default's key set must stay exactly ${JSON.stringify(expected)} — this story reveals the default, it does not re-decide it (story "Out of scope"). Got ${JSON.stringify(sortedKeys(d))}.`);
  assert(!('authorConstraint' in d),
    'a new pin is deliberately unconstrained (search-index-selection ADR 0001 §2): `authorConstraint` must be ABSENT, not empty.');
  assert(!('membershipMethod' in d),
    'story 3 lands `membershipMethod` in this same dialog; absent must stay absent in the DEFAULT blob.');
});

t('U2 AC-2: the default curation\'s values are today\'s values (observer=viewer, nip85:rank, cutoff 1, score on, all three target types, net-endorsed)', async () => {
  const mod = await loadClientPublishTagPin();
  assert(!mod.__loadError, `publishTagPin.js must load as a module (error: ${mod.__loadError}).`);
  const d = mod.defaultCurationMethod(VIEWER);
  assert(d.observer === VIEWER, `observer must be the viewer's pubkey; got ${d.observer}.`);
  assert(d.method === 'nip85:rank', `method must be 'nip85:rank'; got ${JSON.stringify(d.method)}.`);
  assert(d.cutoff === 1, `cutoff must be 1 (story 17); got ${JSON.stringify(d.cutoff)}.`);
  assert(d.includeScoreInTL === true, `includeScoreInTL must be true (story 17); got ${JSON.stringify(d.includeScoreInTL)}.`);
  assert(deepEq(d.targetTypes, ['profile', 'note', 'item']),
    `targetTypes must be ['profile','note','item'] (dlist-item-tagging #5); got ${JSON.stringify(d.targetTypes)}.`);
  assert(d.noteMethod === 'notes:net-endorsed', `noteMethod must be 'notes:net-endorsed'; got ${JSON.stringify(d.noteMethod)}.`);
});

t('U3 AC-2 (the sentinel): confirming the interstitial without touching a field builds exactly the default blob', async () => {
  const pin = await loadClientPublishTagPin();
  assert(!pin.__loadError, `publishTagPin.js must load as a module (error: ${pin.__loadError}).`);
  const def = pin.defaultCurationMethod(VIEWER);
  const r = await built(seededFrom(def, VIEWER), 'U3');
  assert(r && r.ok === true,
    `an untouched default must validate; buildCuration returned ${JSON.stringify(r)}.`);
  assert(deepEq(r.curation, def),
    `AC-2: an UNTOUCHED submit must deep-equal defaultCurationMethod(pubkey) — otherwise the interstitial changes what a first pin publishes, which is wire-visible and escalates the story.\n  built:   ${JSON.stringify(r.curation)}\n  default: ${JSON.stringify(def)}`);
});

t('U4 AC-2: the untouched build stays key-for-key with the default even as the dialog grows fields (no extra, no missing)', async () => {
  const pin = await loadClientPublishTagPin();
  assert(!pin.__loadError, `publishTagPin.js must load as a module (error: ${pin.__loadError}).`);
  const def = pin.defaultCurationMethod(VIEWER);
  const r = await built(seededFrom(def, VIEWER), 'U4');
  assert(r && r.ok === true, `an untouched default must validate; got ${JSON.stringify(r)}.`);
  const extra = sortedKeys(r.curation).filter((k) => !(k in def));
  const missing = sortedKeys(def).filter((k) => !(k in r.curation));
  assert(extra.length === 0,
    `the untouched build added key(s) ${JSON.stringify(extra)} the default does not carry. Stories 3 and 5 add controls to this dialog; an unchosen control must emit NOTHING.`);
  assert(missing.length === 0,
    `the untouched build dropped key(s) ${JSON.stringify(missing)} the default carries.`);
});

t('U5 AC-4 / E2: the day-one search pin — "Only me" plus items selected builds one blob carrying authorConstraint and the item target', async () => {
  const pin = await loadClientPublishTagPin();
  assert(!pin.__loadError, `publishTagPin.js must load as a module (error: ${pin.__loadError}).`);
  const state = seededFrom(pin.defaultCurationMethod(VIEWER), VIEWER);
  state.authorConstraint = 'observer';
  state.authorConstraintTouched = true;
  const r = await built(state, 'U5');
  assert(r && r.ok === true, `the E2 combination must validate; got ${JSON.stringify(r)}.`);
  assert(r.curation.authorConstraint === 'observer',
    `E2: choosing "Only me" in the interstitial must land authorConstraint:'observer' in the FIRST pin — got ${JSON.stringify(r.curation.authorConstraint)}. Today this needs pin-then-edit.`);
  assert(r.curation.targetTypes.includes('item'),
    `E2: items stay selected; got ${JSON.stringify(r.curation.targetTypes)}.`);
});

t('U6 AC-6: an untouched trust-scope control re-emits whatever the pin already carried, and emits nothing when the pin carried nothing', async () => {
  const absent = await built(
    seededFrom({ observer: VIEWER, method: 'nip85:rank', cutoff: 1, includeScoreInTL: true, targetTypes: ['profile', 'note'], noteMethod: 'notes:net-endorsed' }, VIEWER),
    'U6');
  assert(absent.ok === true, `an old pin's blob must validate; got ${JSON.stringify(absent)}.`);
  assert(!('authorConstraint' in absent.curation),
    'an untouched control on a pin that carried no constraint must emit NO authorConstraint key (AC-6: editing an old pin cannot silently add a constraint).');

  const unknown = await built(
    seededFrom({ observer: VIEWER, method: 'nip85:rank', cutoff: 1, includeScoreInTL: true, targetTypes: ['profile', 'note'], noteMethod: 'notes:net-endorsed', authorConstraint: 'future-value' }, VIEWER),
    'U6');
  assert(unknown.curation.authorConstraint === 'future-value',
    `an untouched control must re-emit the RAW value verbatim (a value this build does not recognise is never silently downgraded); got ${JSON.stringify(unknown.curation.authorConstraint)}.`);
});

t('U7 AC-6: the edit-path targetTypes fallback is ["profile","note"] — editing a pre-item pin cannot silently add items', async () => {
  const r = await built(
    seededFrom({ observer: VIEWER, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false, noteMethod: 'notes:net-endorsed' }, VIEWER),
    'U7');
  assert(r.ok === true, `a legacy blob with no targetTypes must validate; got ${JSON.stringify(r)}.`);
  assert(deepEq(r.curation.targetTypes, ['profile', 'note']),
    `a pin with no targetTypes must fall back to ['profile','note'], never to the create-time default; got ${JSON.stringify(r.curation.targetTypes)}.`);
});

t('U8 E3: a cutoff of "1" normalizes to the number 1, and junk is rejected rather than silently coerced', async () => {
  const mod = await loadBuildModule();
  assert(!mod.__loadError, `curationDialogBuild.js must load in plain node (error: ${mod.__loadError}).`);
  assert(typeof mod.normalizeCutoff === 'function', 'curationDialogBuild.js must export normalizeCutoff(raw).');
  const ok = mod.normalizeCutoff('1');
  assert(ok.ok === true && ok.value === 1 && typeof ok.value === 'number',
    `normalizeCutoff('1') must be { ok:true, value:1 } as a NUMBER (the blob's cutoff is numeric); got ${JSON.stringify(ok)}.`);
  for (const bad of ['', '0', '-3', '1.5', 'abc', null, undefined]) {
    assert(mod.normalizeCutoff(bad).ok === false,
      `normalizeCutoff(${JSON.stringify(bad)}) must be rejected, not coerced.`);
  }
});

t('U9 E3: an empty observer field means "me" — it resolves to the viewer, and an npub resolves to its hex', async () => {
  const mod = await loadBuildModule();
  assert(!mod.__loadError, `curationDialogBuild.js must load in plain node (error: ${mod.__loadError}).`);
  assert(typeof mod.normalizeObserver === 'function', 'curationDialogBuild.js must export normalizeObserver(raw, viewerPubkey).');
  const empty = mod.normalizeObserver('', VIEWER);
  assert(empty.ok === true && empty.value === VIEWER,
    `normalizeObserver('', viewer) must resolve to the viewer's pubkey; got ${JSON.stringify(empty)}.`);
  const hex = mod.normalizeObserver(OTHER, VIEWER);
  assert(hex.ok === true && hex.value === OTHER, `a 64-char hex observer must pass through; got ${JSON.stringify(hex)}.`);
  const { nip19 } = require('nostr-tools');
  const npub = nip19.npubEncode(OTHER);
  const decoded = mod.normalizeObserver(npub, VIEWER);
  assert(decoded.ok === true && decoded.value === OTHER,
    `an npub observer must decode to hex; got ${JSON.stringify(decoded)}.`);
  assert(mod.normalizeObserver('not-a-key', VIEWER).ok === false,
    'a malformed observer must be rejected so nothing is signed.');
});

t('U10 AC-3 / E4: a build that fails validation returns field errors and no curation — there is nothing to publish', async () => {
  const pin = await loadClientPublishTagPin();
  assert(!pin.__loadError, `publishTagPin.js must load as a module (error: ${pin.__loadError}).`);
  const state = seededFrom(pin.defaultCurationMethod(VIEWER), VIEWER);
  state.includeProfiles = false; state.includeNotes = false; state.includeItems = false;
  const r = await built(state, 'U10');
  assert(r && r.ok === false,
    `selecting no target type must NOT produce a curation (nothing may be signed); got ${JSON.stringify(r)}.`);
  assert(r.fieldErrors && r.fieldErrors.targetTypes,
    `the failure must name the field so the dialog can render it inline; got ${JSON.stringify(r.fieldErrors)}.`);
  assert(!('curation' in r) || r.curation == null,
    'a failed build must not hand back a half-built blob.');
});

// ===========================================================================
// S — source sentinels: the interstitial is wired, the copy exists,
//     and the untouched surfaces are byte-identical to HEAD
// ===========================================================================

t('S1 AC-1: clicking Pin no longer publishes — handlePin opens the dialog instead of calling publishWithCuration directly', () => {
  const src = rd(TAG_PAGE);
  assert(src, 'ui/src/pages/Tag.jsx must be readable.');
  const m = src.match(/const handlePin\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/);
  assert(m, 'could not locate `const handlePin = async (...) => { … }` in Tag.jsx.');
  const body = m[1];
  assert(!/publishWithCuration\s*\(\s*defaultCurationMethod\s*\(/.test(body),
    'AC-1: handlePin must NOT call publishWithCuration(defaultCurationMethod(…)) — nothing may be signed or published before the interstitial\'s primary action.');
  assert(/set[A-Za-z]*Dialog|setPinDialog/.test(body),
    'AC-1: handlePin must open the curation dialog (e.g. `setPinDialog({ open: true, context: null })`).');
});

t('S2 AC-5 / E6: "Pin to community" routes through the same interstitial — handlePinToContext no longer calls pinTag inline', () => {
  const src = rd(TAG_PAGE);
  const m = src.match(/const handlePinToContext\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/);
  assert(m, 'could not locate `const handlePinToContext = async (context) => { … }` in Tag.jsx.');
  const body = m[1];
  assert(!/\bpinTag\s*\(/.test(body),
    'AC-5: handlePinToContext must not sign the pin inline — it closes the picker and opens the same interstitial with the chosen context.');
  assert(/set[A-Za-z]*Dialog|setPinDialog/.test(body),
    'AC-5: handlePinToContext must open the curation dialog carrying the chosen context.');
  assert(/context/.test(body),
    'AC-5/E6: the chosen context must be carried into the dialog state so the context-stamped pin is what gets published.');
});

t('S3 AC-1 / E4: Tag.jsx mounts exactly ONE curation dialog, in create mode, seeded with defaultCurationMethod', () => {
  const src = rd(TAG_PAGE);
  const mounts = src.match(/<CurationMethodDialog\b/g) || [];
  assert(mounts.length === 1,
    `AC-1: Tag.jsx must mount exactly one <CurationMethodDialog (found ${mounts.length}). E4: never two dialogs at once.`);
  assert(/import\s+CurationMethodDialog\s+from/.test(src),
    'Tag.jsx must import CurationMethodDialog (Gate A ruling 1: reuse the dormant create branch, no new component).');
  const mount = src.slice(src.indexOf('<CurationMethodDialog'));
  const el = mount.slice(0, mount.indexOf('/>') + 2);
  assert(/mode=["{]?["']?create/.test(el), `the Tag-page mount must be mode="create"; element was:\n${el}`);
  assert(/initialCuration=\{\s*defaultCurationMethod\s*\(/.test(el),
    `AC-1: the interstitial must be pre-filled with today's defaults — initialCuration={defaultCurationMethod(…)}; element was:\n${el}`);
  assert(/viewerPubkey=\{/.test(el), `the mount must pass viewerPubkey (the observer fallback); element was:\n${el}`);
});

t('S4 AC-4 / AC-5: the dialog\'s onSubmit publishes ONE pin — routing to publishWithCuration or the factored-out context publish', () => {
  const src = rd(TAG_PAGE);
  const mount = src.slice(src.indexOf('<CurationMethodDialog'));
  const el = mount.slice(0, mount.indexOf('/>') + 2);
  assert(/onSubmit=\{/.test(el), `the mount must wire onSubmit; element was:\n${el}`);
  assert(/publishWithCuration|publishContextPin/.test(el) ||
         /publishContextPin\s*=/.test(src),
    'AC-4/AC-5: onSubmit must route to publishWithCuration(curation) or to a factored-out publishContextPin(curation, context) — one publish, no publish-then-amend.');
  assert(/publishContextPin/.test(src),
    'AC-5: the context pin body (pinTag + the awaited refresh) must be factored out of handlePinToContext so both paths share one publish (design note).');
  assert(!/publishWithCuration\s*\(\s*defaultCurationMethod\s*\(/.test(src),
    'AC-1: no call site may still publish the defaults without passing through the interstitial.');
});

t('S5 AC-3: cancelling closes the dialog and publishes nothing', () => {
  const src = rd(TAG_PAGE);
  const mount = src.slice(src.indexOf('<CurationMethodDialog'));
  const el = mount.slice(0, mount.indexOf('/>') + 2);
  const onCancel = el.match(/onCancel=\{([\s\S]*?)\}\s*(?:\n|\/>)/);
  assert(onCancel, `AC-3: the mount must wire onCancel; element was:\n${el}`);
  const body = onCancel[1];
  assert(/set[A-Za-z]*Dialog|setPinDialog/.test(body),
    `AC-3: onCancel must close the dialog state; got ${body}`);
  assert(!/pinTag|publishWithCuration|publishContextPin|fetch\s*\(/.test(body),
    `AC-3: onCancel must publish NOTHING — no pinTag, no publish, no refresh call; got ${body}`);
});

t('S6 Gate A ruling 2: create mode explains what a pin does, and offers a collapsed "What\'s a Trusted List?"', () => {
  const src = rd(DIALOG);
  assert(src, 'ui/src/components/CurationMethodDialog.jsx must be readable.');
  assert(/Pinning publishes a Trusted List under your point of view/i.test(src),
    'Gate A ruling 2: create mode must carry the explanation line "Pinning publishes a Trusted List under your point of view with this curation."');
  assert(/<details/.test(src) && /What['’]s a Trusted List\?/i.test(src),
    'Gate A ruling 2: create mode must carry a COLLAPSED <details> expander titled "What\'s a Trusted List?" (the dialog is a confirm step, not a tutorial).');
  assert(!/<details[^>]*\bopen\b/.test(src),
    'the "What\'s a Trusted List?" expander must be collapsed by default (no `open` attribute).');
});

t('S7 AC-6: the create-mode copy is gated on the mode — an edit of an existing pin sees neither the line nor the expander', () => {
  const src = rd(DIALOG);
  const idxLine = src.search(/Pinning publishes a Trusted List under your point of view/i);
  const idxDetails = src.search(/What['’]s a Trusted List\?/i);
  assert(idxLine > -1 && idxDetails > -1, 'the create-mode copy must exist before this sentinel can check its gating (see S6).');
  const from = Math.max(0, Math.min(idxLine, idxDetails) - 600);
  const window = src.slice(from, Math.max(idxLine, idxDetails) + 400);
  assert(/mode\s*===\s*'create'|mode\s*!==\s*'edit'/.test(window),
    'AC-6: the explanation line and the expander must be rendered only in create mode (`mode === \'create\'` / `mode !== \'edit\'`) — edit mode is untouched.');
});

t('S8: the dialog builds its blob through the shared pure module — no second copy of the build rule', () => {
  const src = rd(DIALOG);
  assert(/from\s+'(\.\.\/utils\/curationDialogBuild|\.\.\/utils\/curationDialogBuild\.js)'/.test(src),
    'CurationMethodDialog.jsx must import the build rule from ui/src/utils/curationDialogBuild.js (the testability contract in this file\'s header) — a JSX-only build cannot be pinned by AC-2\'s sentinel.');
  assert(/buildCuration\s*\(/.test(src),
    'the dialog\'s submit must call buildCuration(state) rather than assembling `custom` inline.');
  assert(!/function\s+normalizeCutoff\s*\(/.test(src) && !/function\s+normalizeObserver\s*\(/.test(src),
    'normalizeCutoff / normalizeObserver must MOVE into the pure module (or be re-exported from it), not be duplicated in the JSX.');
});

t('S9 AC-2: defaultCurationMethod is byte-identical to HEAD — the wire default is not touched by this story', () => {
  const rel = 'ui/src/utils/publishTagPin.js';
  const now = rd(PUBLISH_TAG_PIN);
  const was = head(rel);
  assert(was !== null, 'could not read HEAD:ui/src/utils/publishTagPin.js (is this a git checkout?).');
  const grab = (s) => {
    const i = s.indexOf('export function defaultCurationMethod');
    if (i < 0) return null;
    const j = s.indexOf('\n}', i);
    return j < 0 ? null : s.slice(i, j + 2);
  };
  const a = grab(now), b = grab(was);
  assert(a && b, 'defaultCurationMethod must exist in both HEAD and the working tree.');
  assert(a === b,
    `AC-2 / "Out of scope": defaultCurationMethod must be byte-identical to HEAD. Changing the default blob is wire-visible and escalates this story out of the Light lane.\n--- HEAD ---\n${b}\n--- now ---\n${a}`);
});

t('S10 AC-7 / AC-5 / E5: the pin affordance and the community picker are byte-identical to HEAD', () => {
  for (const [rel, abs] of [
    ['ui/src/components/TagPinAffordance.jsx', AFFORDANCE],
    ['ui/src/components/PinToContextModal.jsx', CONTEXT_MODAL],
  ]) {
    const was = head(rel);
    assert(was !== null, `could not read HEAD:${rel}.`);
    assert(rd(abs) === was,
      `${rel} must be unchanged (design note "Not touched"). AC-7: a returning pinner still gets the Pinned/Back toggle and no dialog; E5: no user, no affordance; AC-5: the picker's onPick still fires and the interstitial opens after.`);
  }
});

t('S11 (house rule): no 64-char hex pubkey literal is introduced in any file this story touches', () => {
  for (const [rel, abs] of [
    ['ui/src/pages/Tag.jsx', TAG_PAGE],
    ['ui/src/components/CurationMethodDialog.jsx', DIALOG],
    ['ui/src/utils/curationDialogBuild.js', BUILD_MODULE],
  ]) {
    const src = rd(abs);
    if (!src) continue; // the new module may not exist yet — U-class names that
    const hits = (src.match(/["'`][0-9a-f]{64}["'`]/g) || []);
    assert(hits.length === 0,
      `${rel} must not hardcode a pubkey (CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode"); found ${JSON.stringify(hits)}.`);
  }
});

t('S12 E1: a failed publish surfaces inline and leaves the dialog open with the user\'s edits intact', () => {
  const src = rd(DIALOG);
  assert(/await\s+onSubmit\(/.test(src), 'the dialog must await onSubmit so a rejection is catchable.');
  const m = src.match(/try\s*\{\s*await\s+onSubmit\(([\s\S]*?)\n\s*\}\s*(?:finally|catch)/);
  assert(m, 'could not locate the dialog\'s submit try/catch.');
  assert(/catch\s*\([\s\S]{0,40}\)\s*\{[\s\S]{0,200}setError\(/.test(src),
    'E1: a signer refusal must land in setError — the dialog stays open, nothing was published.');
  const block = m[1];
  assert(!/onCancel\(\)[\s\S]{0,40}catch/.test(block) || /await onSubmit[\s\S]*?onCancel\(\);/.test(block),
    'E1: the dialog must close only on SUCCESS (onCancel() after a resolved onSubmit), never in the error path.');
});

// ===========================================================================
// R — regression sentinels on the deliberately untouched behaviour
//     (these are green BEFORE the implementation and must stay green after)
// ===========================================================================

t('S13 AC-5 (review finding): the community-pin interstitial shows the chosen context, fixed', () => {
  const page = rd(TAG_PAGE);
  const dialog = rd(UI('components/CurationMethodDialog.jsx'));
  const mount = page.slice(page.indexOf('<CurationMethodDialog'), page.indexOf('/>', page.indexOf('<CurationMethodDialog')));
  assert(/context=\{pinDialog\.context\}/.test(mount),
    'AC-5: the create-mode mount must pass the chosen context into the dialog.');
  assert(/contextName=/.test(mount), 'AC-5: and its display name (KNOWN_CONTEXTS lookup, slug fallback).');
  const create = dialog.slice(dialog.indexOf("mode === 'create' &&"), dialog.indexOf("mode === 'create' &&") + 2500);
  assert(/\{context && \(/.test(create) && /Community:/.test(create) && /contextName \|\| context/.test(create),
    'AC-5: create mode must render a fixed "Community: <name>" line when a context is set, and nothing when neutral.');
  assert(!/onChange=[^\n]*context/i.test(create), 'AC-5: the context is shown, not editable, in the interstitial.');
});

t('R1 AC-2: the pin refresh is still AWAITED before the NIP-51 exports fire', () => {
  const src = rd(TAG_PAGE);
  const m = src.match(/const publishWithCuration\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/);
  assert(m, 'could not locate publishWithCuration in Tag.jsx (AC-2 says it stays untouched).');
  const body = m[1];
  const iRefresh = body.indexOf("'/api/trusted-list/refresh-pinned-tag'");
  const iFollowSet = body.indexOf('publishNip51ExportForPin');
  const iBookmarks = body.indexOf('publishNoteBookmarkSetForPin');
  assert(iRefresh > -1, 'publishWithCuration must still POST /api/trusted-list/refresh-pinned-tag.');
  assert(/await\s+fetch\(\s*'\/api\/trusted-list\/refresh-pinned-tag'/.test(body),
    'ADR tag-stack-merge-hardening/0001 (B2): the refresh must stay AWAITed — fire-and-forget races the export against a not-yet-created list and publishes an EMPTY kind-30000.');
  assert(iFollowSet > iRefresh && iBookmarks > iRefresh,
    `AC-2: the awaited refresh must still come BEFORE both exports (refresh@${iRefresh}, follow-set@${iFollowSet}, bookmarks@${iBookmarks}).`);
});

t('R4 AC-5 (J2 finding): publishContextPin keeps the AWAITED, best-effort refresh the inline body had', () => {
  // The Design note factors handlePinToContext's inline body (pinTag + awaited refresh with a
  // swallowing .catch) into publishContextPin. A factoring that drops the await races the
  // panel against a not-yet-created list; one that drops the .catch turns a best-effort
  // refresh 500 into a "Pin failed" AFTER a successful publish — both violate AC-5's
  // "exactly as today". Pre-implementation this asserts the same properties on the inline body.
  const src = rd(TAG_PAGE);
  const m = src.match(/const publishContextPin\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/)
    || src.match(/const handlePinToContext\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/);
  assert(m, 'could not locate publishContextPin (or, pre-implementation, handlePinToContext) in Tag.jsx.');
  const body = m[1];
  assert(/await\s+fetch\(\s*'\/api\/trusted-list\/refresh-pinned-tag'[\s\S]*?\)\s*\.catch\(/.test(body),
    'the context-pin refresh must stay AWAITED and best-effort (an awaited fetch followed by a swallowing .catch), exactly as the inline body is today.');
  assert(body.indexOf('pinTag(') > -1 && body.indexOf('pinTag(') < body.indexOf("'/api/trusted-list/refresh-pinned-tag'"),
    'the context pin must be signed and published BEFORE its refresh is requested.');
});

t('R2 AC-6: the Pinned-tab "Edit curation" path still mounts the dialog in edit mode, with its Unpin affordance', () => {
  const src = rd(PANEL);
  assert(src, 'ui/src/components/PinnedListPanel.jsx must be readable.');
  const i = src.indexOf('<CurationMethodDialog');
  assert(i > -1, 'PinnedListPanel.jsx must still mount CurationMethodDialog.');
  const el = src.slice(i, src.indexOf('/>', i) + 2);
  assert(/mode="edit"/.test(el), `AC-6: the edit mount must stay mode="edit"; element was:\n${el}`);
  assert(/onUnpin=\{/.test(el), `AC-6: the edit mount keeps its Unpin affordance; element was:\n${el}`);
  assert(/initialCuration=\{[^}]*curationMethod/.test(el),
    `AC-6: the edit mount still seeds from the existing pin's curationMethod; element was:\n${el}`);
});

t('R3 AC-6: the edit-path targetTypes fallback ["profile","note"] survives the refactor', () => {
  const dialog = rd(DIALOG);
  const module_ = rd(BUILD_MODULE);
  const both = `${dialog}\n${module_}`;
  assert(/\['profile',\s*'note'\]/.test(both),
    'AC-6: the initTypes fallback [\'profile\',\'note\'] must survive wherever the seeding now lives — editing a pre-item pin must not silently add items.');
  assert(/submitLabel|Pin with these settings/.test(dialog) && /Save changes/.test(dialog),
    'AC-6: the edit mode keeps its "Save changes" label and create mode keeps "Pin with these settings".');
  assert(/Edit curation/.test(dialog) && /Pin curation method/.test(dialog),
    'AC-6: both titles survive (the create title is the confirm-step heading).');
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
  console.log(`\nconfirm-step-on-first-pin: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
