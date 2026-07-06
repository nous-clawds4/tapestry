/**
 * Tests for the two-bug bugfix batch:
 *   Bug 1 — login failures are surfaced (no NIP-07 signer / declined / server
 *           reject) through one shared modal, with a bounded wait for the
 *           asynchronously-injected window.nostr and typed failure codes.
 *   Bug 2 — mobile tag-result crowding: collapse tag hits to the first N with
 *           a "show more" toggle (all viewports).
 *
 * ADR: engineering-team/decisions/0021-login-failure-surfacing-and-tag-result-collapse.md
 *
 * These tests are intentionally FAILING against a clean (pre-implementation)
 * tree. NOTE for the Implementer: the `bugfixes` working tree may still carry
 * an earlier *informal* implementation. Revert those UI edits before making
 * these pass, so the suite goes red for the right reasons first (see the test
 * plan's "Verification" section).
 *
 * Two layers, matching repo convention:
 *   A. BEHAVIORAL unit tests of the pure helper ui/src/utils/nip07.js. Because
 *      ui/ is "type":"module", the CJS runner loads it via dynamic import() and
 *      exercises waitForNostr() for real (the injection-race logic — the single
 *      most important correctness fix in ADR 0021). This is stronger than a
 *      source regex and is where rigor matters most.
 *   B. SOURCE-CONTRACT assertions for the inherently-JSX/CSS parts the Node
 *      runner can't execute (modal wiring in AuthProvider, the collapse
 *      slice/toggle in BrainstormSearch, dead-CSS removal, entry-point wiring).
 *      Same approach as test/search-results-url.test.js and
 *      test/collapse-into-export-concept.test.js.
 *
 * Companion: tests/brainstorm/login-failure-and-tag-collapse.spec.js (Playwright)
 * covers the observable behavior — the modal appearing on a no-signer click,
 * the late-injection race not firing a false "no signer", and the toggle
 * expanding the tag list.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function readSrc(rel) {
  const p = path.join(REPO, rel);
  assert(fs.existsSync(p), `expected file to exist: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

const NIP07_REL = 'ui/src/utils/nip07.js';
const AUTH_REL = 'ui/src/context/AuthContext.jsx';
const MODAL_REL = 'ui/src/components/LoginErrorModal.jsx';
const HEADER_REL = 'ui/src/components/Header.jsx';
const USERMENU_REL = 'ui/src/components/BrainstormUserMenu.jsx';
const SEARCH_REL = 'ui/src/pages/BrainstormSearch.jsx';
const STYLES_REL = 'ui/src/styles.css';

/* Import the (ESM) helper fresh-ish for behavioral tests. waitForNostr is
 * stateless — it reads window.nostr at call time — so module caching is fine;
 * we just set global.window before each call. */
async function importNip07() {
  const p = path.join(REPO, NIP07_REL);
  assert(fs.existsSync(p), `${NIP07_REL} must exist and export waitForNostr (ADR 0021 AC-1)`);
  const mod = await import(pathToFileURL(p).href);
  assert(typeof mod.waitForNostr === 'function',
    `${NIP07_REL} must export a waitForNostr() function (ADR 0021 AC-1)`);
  return mod;
}

/* ──────────────────────────────────────────────────────────────────────────
 * A. BEHAVIORAL — waitForNostr (ADR 0021 AC-1, Decision 3)
 * ────────────────────────────────────────────────────────────────────────── */

/* Timing-assert defusal (story test-hermeticity-ci #3, AC-4): these three
 * tests previously compared Date.now() deltas against wall-clock bounds
 * (<100ms / a 60ms magic injection / >=120ms) — the stack-free subset's only
 * load-sensitive assertions, a latent flake under CI load. Rewritten to pin
 * the SAME three contracts deterministically: immediacy via a zero wait
 * budget, the injection race via next-macrotask scheduling under a generous
 * ceiling, and deadline honor via a far-too-late signer that must NOT
 * resolve. No Date.now() remains in this suite. */

t('AC-1a: waitForNostr returns an already-present window.nostr even with a ZERO wait budget (deterministic immediacy)', async () => {
  const { waitForNostr } = await importNip07();
  const signer = { getPublicKey: () => {} };
  global.window = { nostr: signer };
  try {
    const result = await waitForNostr(0, 10);
    assert(result === signer,
      'waitForNostr must return the already-present window.nostr object without consuming any wait budget — the present-signer check must precede the deadline check (AC-1). A zero-budget call proves immediacy more strictly than an elapsed-ms bound, and cannot flake under load.');
  } finally { delete global.window; }
});

t('AC-1b: waitForNostr resolves to a signer injected AFTER the call starts (the injection race, deterministic scheduling)', async () => {
  const { waitForNostr } = await importNip07();
  const signer = { getPublicKey: () => {} };
  global.window = {}; // no nostr yet — extension hasn't injected
  try {
    // Next macrotask: deterministically after waitForNostr begins, no magic delay.
    setTimeout(() => { global.window.nostr = signer; }, 0);
    const result = await waitForNostr(4000, 20);
    assert(result === signer,
      'waitForNostr must resolve to a window.nostr that appears AFTER the call starts — NIP-07 extensions inject asynchronously; an immediate one-shot check fires a false "no signer" (ADR 0021 Decision 3 / AC-1). The 4000ms budget is a ceiling, not a wait: the call resolves at the first poll after injection.');
  } finally { delete global.window; }
});

t('AC-1c: waitForNostr gives up (null) by its deadline — a signer arriving far too late is NOT resolved (deterministic, no elapsed-ms math)', async () => {
  const { waitForNostr } = await importNip07();
  global.window = {};
  let lateTimer = null;
  let guardTimer = null;
  try {
    // A signer scheduled far beyond the 150ms deadline must not be resolved.
    lateTimer = setTimeout(() => { global.window.nostr = { getPublicKey: () => {} }; }, 4000);
    // Safety harness, not a behavior assert: if the implementation ignored its
    // deadline it would hang — fail legibly at 5s instead. Load cannot trip
    // this (5000ms >> the 150ms deadline scale); only a real regression can.
    const guard = new Promise((_, reject) => {
      guardTimer = setTimeout(
        () => reject(new Error('waitForNostr ignored its 150ms deadline (still pending after 5s)')), 5000);
    });
    const result = await Promise.race([waitForNostr(150, 20), guard]);
    assert(result === null || result === undefined,
      'waitForNostr must resolve null/undefined when no signer appears within its deadline — tolerating late injection is AC-1b; HONORING the deadline is this test (AC-1).');
  } finally {
    clearTimeout(lateTimer);
    clearTimeout(guardTimer);
    delete global.window;
  }
});

/* ──────────────────────────────────────────────────────────────────────────
 * B. SOURCE-CONTRACT — Bug 1 (login failure surfacing)
 * ────────────────────────────────────────────────────────────────────────── */

t('AC-2: runLogin waits for window.nostr via waitForNostr (no immediate one-shot check)', () => {
  const src = readSrc(AUTH_REL);
  assert(/waitForNostr/.test(src),
    'AuthContext.jsx must use waitForNostr() from utils/nip07 before declaring NO_SIGNER (ADR 0021 AC-2). The immediate `if (!window.nostr) throw` mis-reports late-injecting extensions.');
  assert(/from\s+['"]\.\.\/utils\/nip07['"]/.test(src) || /utils\/nip07/.test(src),
    'AuthContext.jsx must import waitForNostr from ../utils/nip07 (ADR 0021 Implementation notes).');
  // The brittle immediate guard must be gone: no bare `if (!window.nostr)` throw.
  assert(!/if\s*\(\s*!\s*window\.nostr\s*\)\s*\{?\s*\n?\s*throw/.test(src),
    'AuthContext.jsx must NOT keep the immediate `if (!window.nostr) throw` guard — replace it with the bounded waitForNostr() check (ADR 0021 Decision 3).');
});

t('AC-3: the four typed failure codes exist (NO_SIGNER / SIGNER_DECLINED / NOT_AUTHORIZED / UNKNOWN)', () => {
  const src = readSrc(AUTH_REL);
  for (const code of ['NO_SIGNER', 'SIGNER_DECLINED', 'NOT_AUTHORIZED', 'UNKNOWN']) {
    assert(src.includes(code),
      `AuthContext.jsx must categorize login failures with the code ${code} (ADR 0021 Decision 2 / AC-3). Showing raw err.message leaks cryptic extension/server strings.`);
  }
});

t('AC-4: NO_SIGNER copy is vendor-neutral — no brand names in the login surfaces', () => {
  const surfaces = [AUTH_REL, MODAL_REL];
  for (const rel of surfaces) {
    const src = readSrc(rel);
    assert(!/nos2x/i.test(src) && !/\balby\b/i.test(src),
      `${rel} must not name specific signer software (e.g. nos2x / Alby) — the user asked for vendor-neutral copy (ADR 0021 AC-4).`);
  }
  // …and the modal must still say *something* about needing a signer.
  const modal = readSrc(MODAL_REL);
  assert(/signer/i.test(modal),
    'LoginErrorModal must explain (vaguely) that a Nostr signer is needed (ADR 0021 AC-4).');
});

t('AC-5: NOT_AUTHORIZED preserves the server-supplied message', () => {
  const modal = readSrc(MODAL_REL);
  const auth = readSrc(AUTH_REL);
  // Either the modal renders the carried message for NOT_AUTHORIZED, or the
  // context attaches the server message to the NOT_AUTHORIZED error.
  const modalUsesMessage = /NOT_AUTHORIZED[\s\S]{0,200}message|message[\s\S]{0,200}NOT_AUTHORIZED/.test(modal)
    || /error\.message|error\?\.message/.test(modal);
  const ctxCarriesServerMsg = /NOT_AUTHORIZED[\s\S]{0,200}(verifyData|loginData)\.message|(verifyData|loginData)\.message[\s\S]{0,200}NOT_AUTHORIZED/.test(auth);
  assert(modalUsesMessage || ctxCarriesServerMsg,
    'The NOT_AUTHORIZED case must surface the server\'s own message (the meaningful "why"), not a generic line (ADR 0021 Decision 2 / AC-5).');
});

t('AC-6a: a single LoginErrorModal is rendered by AuthProvider', () => {
  const src = readSrc(AUTH_REL);
  assert(/import\s+LoginErrorModal\s+from\s+['"]\.\.\/components\/LoginErrorModal['"]/.test(src),
    'AuthContext.jsx must import LoginErrorModal (ADR 0021 Decision 1 / AC-6).');
  assert(/<LoginErrorModal\b/.test(src),
    'AuthProvider must render <LoginErrorModal> so every entry point shares one failure surface (ADR 0021 Decision 1 / AC-6).');
});

t('AC-6b: login() records a CODED error (object with code), not a bare string, and re-throws', () => {
  const src = readSrc(AUTH_REL);
  // The stored error must carry a code so the modal can map code → copy.
  assert(/setLoginError\(\s*\{[\s\S]*?code/.test(src) || /loginError[\s\S]{0,400}\.code/.test(src),
    'login() must store a coded error object (e.g. { code, message }) so LoginErrorModal can map code → controlled copy — not a bare err.message string (ADR 0021 Decision 2 / AC-6).');
  assert(/catch[\s\S]{0,200}throw/.test(src),
    'login() must re-throw after recording the error, preserving the contract callers like Tag.jsx rely on (ADR 0021 Decision 1 / AC-6).');
});

t('AC-6c: LoginErrorModal maps the failure code to copy (reads error.code)', () => {
  const modal = readSrc(MODAL_REL);
  assert(/code/.test(modal),
    'LoginErrorModal must branch on the failure code to choose controlled, vendor-neutral copy (ADR 0021 Decision 2 / AC-6c).');
  assert(/NO_SIGNER/.test(modal),
    'LoginErrorModal must map the NO_SIGNER code to its install-guidance copy (ADR 0021 AC-6c).');
});

t('AC-7a: bare login() callsites swallow the re-throw (no unhandled rejection)', () => {
  for (const rel of [USERMENU_REL, SEARCH_REL]) {
    const src = readSrc(rel);
    assert(/onClick=\{\s*\(\)\s*=>\s*login\(\)\.catch\(/.test(src),
      `${rel}: the logged-out sign-in button must call login().catch(...) so the post-modal rejection isn't an unhandled console error (ADR 0021 Implementation notes / AC-7).`);
  }
});

t('AC-7b: Header no longer renders its own inline .signin-error span', () => {
  const src = readSrc(HEADER_REL);
  assert(!/signin-error/.test(src),
    'Header.jsx must drop its inline .signin-error span — the shared LoginErrorModal replaces it (ADR 0021 Implementation notes / AC-7).');
});

t('AC-7c: the dead .signin-error CSS rule is removed', () => {
  const css = readSrc(STYLES_REL);
  assert(!/\.signin-error\b/.test(css),
    'styles.css must delete the now-unused .signin-error rule (ADR 0021 Consequences / AC-7).');
});

/* ──────────────────────────────────────────────────────────────────────────
 * B. SOURCE-CONTRACT — Bug 2 (tag-result collapse)
 * ────────────────────────────────────────────────────────────────────────── */

t('AC-8: TAG_COLLAPSE_LIMIT constant is defined and equals 3', () => {
  const src = readSrc(SEARCH_REL);
  const m = src.match(/const\s+TAG_COLLAPSE_LIMIT\s*=\s*(\d+)/);
  assert(m, 'BrainstormSearch.jsx must define a module constant TAG_COLLAPSE_LIMIT (ADR 0021 AC-8).');
  assert(m[1] === '3', `TAG_COLLAPSE_LIMIT must be 3 (the agreed default); found ${m[1]} (ADR 0021 AC-8).`);
});

t('AC-9: tag hits render sliced to the limit unless expanded', () => {
  const src = readSrc(SEARCH_REL);
  assert(/tagsExpanded/.test(src),
    'BrainstormSearch.jsx must track tagsExpanded state to control collapse (ADR 0021 AC-9).');
  assert(/resultsTagHits\.slice\(\s*0\s*,\s*TAG_COLLAPSE_LIMIT\s*\)/.test(src),
    'BrainstormSearch.jsx must render resultsTagHits.slice(0, TAG_COLLAPSE_LIMIT) when collapsed (ADR 0021 AC-9).');
  assert(/tagsExpanded\s*\?\s*resultsTagHits\s*:\s*resultsTagHits\.slice/.test(src),
    'BrainstormSearch.jsx must show the full list only when tagsExpanded is true, else the sliced list (ADR 0021 AC-9).');
});

t('AC-10: a toggle appears only when tag count exceeds the limit, with a count and aria-expanded', () => {
  const src = readSrc(SEARCH_REL);
  assert(/resultsTagHits\.length\s*>\s*TAG_COLLAPSE_LIMIT/.test(src),
    'The "show more" toggle must be conditional on resultsTagHits.length > TAG_COLLAPSE_LIMIT (ADR 0021 AC-10).');
  assert(/resultsTagHits\.length\s*-\s*TAG_COLLAPSE_LIMIT/.test(src),
    'The toggle label must show the remaining count (length − limit) — the at-a-glance "there\'s more here" signal (ADR 0021 AC-10).');
  assert(/aria-expanded=\{?\s*tagsExpanded/.test(src),
    'The toggle must expose aria-expanded={tagsExpanded} for accessibility (ADR 0021 AC-10).');
  assert(/bs-taghits-toggle/.test(src),
    'The toggle must use the .bs-taghits-toggle class (ADR 0021 AC-10/AC-12).');
});

t('AC-11: tagsExpanded resets on a fresh search and is NOT touched in the load-more branch', () => {
  const src = readSrc(SEARCH_REL);
  assert(/setTagsExpanded\(\s*false\s*\)/.test(src),
    'BrainstormSearch.jsx must reset tagsExpanded to false on a fresh search so the next query starts collapsed (ADR 0021 AC-11).');
  // The reset must sit with the offset===0 fresh-result branch (next to
  // setResultsTagHits), not in the pagination-append branch.
  const freshBranch = src.match(/setResultsTagHits\([\s\S]{0,160}/);
  assert(freshBranch && /setTagsExpanded\(\s*false\s*\)/.test(freshBranch[0]),
    'setTagsExpanded(false) must live in the offset===0 branch beside setResultsTagHits — tag hits do not paginate, so load-more must not reset the toggle (ADR 0021 AC-11).');
});

t('AC-12: .bs-taghits-toggle styling exists', () => {
  const css = readSrc(STYLES_REL);
  assert(/\.bs-taghits-toggle\b/.test(css),
    'styles.css must define .bs-taghits-toggle for the show-more toggle (ADR 0021 AC-12).');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- login-failure-and-tag-collapse tests (ADR 0021) ---');
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      fail++;
    }
  }
  console.log(`\nlogin-failure-and-tag-collapse: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
