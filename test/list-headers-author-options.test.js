/**
 * list-headers-disposition #1: Me and My Local Tapestry Assistant in the List Headers Author selector.
 *
 * Story: engineering-team/stories/done/list-headers-disposition/1-author-selector-me-and-my-assistant.md
 * ADR:   engineering-team/decisions/done/list-headers-disposition/0001-me-and-my-assistant-from-the-signed-in-user.md
 * Plan:  engineering-team/stories/done/list-headers-disposition/1-author-selector-me-and-my-assistant.test-plan.md
 * Browser half: tests/brainstorm/list-headers-author-options.spec.js (what a viewer sees on /tapestry/lists).
 *
 *   P1..P9 — the pure rules in ui/src/utils/viewerAuthorScope.js, loaded by dynamic import (the idiom
 *            test/author-scoped-inspection-views.test.js uses for ui/src/utils modules). The page is JSX and
 *            can't be imported without a transform, so what a viewer sees lives in the Playwright spec.
 *
 * Stack-free: no network, no relay, no publish.
 *
 * EXPECTED NOW (pre-implementation): P1–P9 FAIL, each naming the missing module or rule.
 */

const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SCOPE_JS = path.join(ROOT, 'ui/src/utils/viewerAuthorScope.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => JSON.stringify(v);

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch { return null; }
}
let _scope;
async function scope() {
  if (_scope === undefined) _scope = await loadEsm(SCOPE_JS);
  assert(_scope, `ADR 0001 §Implementation: ${path.relative(ROOT, SCOPE_JS)} must exist as a pure ESM module (no React, no fetch)`);
  return _scope;
}

const HEX64 = /^[0-9a-f]{64}$/;
const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const VIEWER = 'a1'.repeat(32);
const VIEWER_TA = 'a2'.repeat(32);
const OTHER = 'b1'.repeat(32);
const OTHER_TA = 'b2'.repeat(32);

// useAuth().user as AuthContext builds it (ui/src/context/AuthContext.jsx:66-71).
const user = (pubkey, assistantPubkey, classification = 'customer') => ({ pubkey, assistantPubkey, classification, profile: null });

// ── P — the pure rules ────────────────────────────────────────────────────────

test('P1: the module exports the two reserved values and the two rules, and the reserved values can never be pubkeys', async () => {
  const m = await scope();
  for (const fn of ['viewerAuthorOptions', 'resolveAuthorFilter']) {
    assert(typeof m[fn] === 'function', `ADR 0001 §Implementation: viewerAuthorScope.js must export ${fn}`);
  }
  assert(m.ME === '@me', `ADR 0001: ME must be the reserved value '@me', got ${show(m.ME)}`);
  assert(m.MY_ASSISTANT === '@my-assistant', `ADR 0001: MY_ASSISTANT must be the reserved value '@my-assistant', got ${show(m.MY_ASSISTANT)}`);
  for (const v of [m.ME, m.MY_ASSISTANT]) {
    assert(!HEX64.test(v) && v !== '', `ADR 0001: a reserved value must be neither a pubkey nor '' (All authors), got ${show(v)}`);
  }
});

test('P2: signed out, or no valid session pubkey: no entries at all (story AC 5, first half)', async () => {
  const { viewerAuthorOptions } = await scope();
  for (const u of [null, undefined, user(null, null, 'unauthenticated'), user('not-a-pubkey', VIEWER_TA)]) {
    const got = viewerAuthorOptions(u);
    assert(Array.isArray(got) && got.length === 0,
      `story AC 5: a visitor who isn't signed in (${show(u)}) gets neither entry — got ${show(got)}`);
  }
});

test('P3: signed in with an Assistant here: Me then My Local Tapestry Assistant, both choosable (story AC 1)', async () => {
  const { viewerAuthorOptions, ME, MY_ASSISTANT } = await scope();
  const got = viewerAuthorOptions(user(VIEWER, VIEWER_TA));
  assert(Array.isArray(got) && got.length === 2, `story AC 1: exactly two entries, got ${show(got)}`);
  assert(got[0].value === ME && got[0].label === 'Me' && !got[0].disabled,
    `story AC 1: the first entry is "Me" (value '@me', choosable), got ${show(got[0])}`);
  assert(got[1].value === MY_ASSISTANT && got[1].label === 'My Local Tapestry Assistant' && !got[1].disabled,
    `story AC 1: the second entry is "My Local Tapestry Assistant" (value '@my-assistant', choosable), got ${show(got[1])}`);
});

test('P4: signed in with no Assistant here: Me choosable, My Local Tapestry Assistant greyed out and labelled as none (story AC 5, second half)', async () => {
  const { viewerAuthorOptions, ME, MY_ASSISTANT } = await scope();
  for (const missing of [null, undefined, '', 'not-a-pubkey']) {
    const got = viewerAuthorOptions(user(VIEWER, missing, 'guest'));
    assert(Array.isArray(got) && got.length === 2, `story AC 5: both entries still appear (assistantPubkey ${show(missing)}), got ${show(got)}`);
    assert(got[0].value === ME && got[0].label === 'Me' && !got[0].disabled,
      `story AC 5: "Me" stays choosable without an Assistant, got ${show(got[0])}`);
    assert(got[1].value === MY_ASSISTANT && got[1].disabled === true,
      `story AC 5: "My Local Tapestry Assistant" appears but can't be chosen (assistantPubkey ${show(missing)}), got ${show(got[1])}`);
    assert(/^My Local Tapestry Assistant\b/.test(got[1].label) && /none on this instance/i.test(got[1].label),
      `story AC 5: the greyed-out entry says it has none on this instance, got label ${show(got[1].label)}`);
  }
});

test('P5: Me resolves to the account, My Local Tapestry Assistant to that account\'s own Assistant (story AC 2, AC 3)', async () => {
  const { resolveAuthorFilter, ME, MY_ASSISTANT } = await scope();
  const u = user(VIEWER, VIEWER_TA);
  assert(resolveAuthorFilter(ME, u) === VIEWER, `story AC 2: Me must match the signed-in account, got ${show(resolveAuthorFilter(ME, u))}`);
  assert(resolveAuthorFilter(MY_ASSISTANT, u) === VIEWER_TA,
    `story AC 3: My Local Tapestry Assistant must match the Assistant held for this person, got ${show(resolveAuthorFilter(MY_ASSISTANT, u))}`);
  const owner = user(OWNER, OWNER_TA, 'owner');
  assert(resolveAuthorFilter(MY_ASSISTANT, owner) === OWNER_TA,
    `ADR 0001: for the Owner, My Local Tapestry Assistant is the Owner's Assistant because that IS their assistantPubkey — got ${show(resolveAuthorFilter(MY_ASSISTANT, owner))}`);
});

test('P6: no fallback to the Owner\'s Assistant — a person with no Assistant here resolves My Local Tapestry Assistant to nothing (story AC 3, ADR 0001)', async () => {
  const { resolveAuthorFilter, MY_ASSISTANT } = await scope();
  for (const missing of [null, undefined, '', 'not-a-pubkey']) {
    const u = user(VIEWER, missing, 'guest');
    // A stray third argument is what a fallback would arrive through; it must change nothing.
    for (const got of [resolveAuthorFilter(MY_ASSISTANT, u), resolveAuthorFilter(MY_ASSISTANT, u, OWNER_TA)]) {
      assert(got === '',
        `story AC 3 / ADR 0001: with no Assistant here (${show(missing)}) My Local Tapestry Assistant must resolve to '' (nothing to match), never another pubkey — got ${show(got)}`);
    }
  }
});

test('P7: signed out, the reserved values resolve to nothing, so a stale selection means All authors (ADR 0001, sign-out)', async () => {
  const { resolveAuthorFilter, ME, MY_ASSISTANT } = await scope();
  for (const u of [null, undefined, user(null, null, 'unauthenticated')]) {
    for (const v of [ME, MY_ASSISTANT]) {
      const got = resolveAuthorFilter(v, u);
      assert(got === '', `ADR 0001: ${v} with no signed-in user (${show(u)}) must resolve to '', got ${show(got)}`);
    }
  }
});

test('P8: today\'s values pass through unchanged — All authors stays empty, a literal author pubkey stays itself (story AC 1)', async () => {
  const { resolveAuthorFilter } = await scope();
  for (const u of [null, user(VIEWER, VIEWER_TA)]) {
    assert(resolveAuthorFilter('', u) === '', `story AC 1: '' is All authors and must resolve to '', got ${show(resolveAuthorFilter('', u))}`);
    for (const pk of [OWNER, OWNER_TA, OTHER]) {
      assert(resolveAuthorFilter(pk, u) === pk,
        `story AC 1: today's literal author entry ${pk.slice(0, 4)}… must still filter by itself, got ${show(resolveAuthorFilter(pk, u))}`);
    }
  }
});

test('P9: two people resolve the same entries to their own pubkeys, never each other\'s (story AC 6)', async () => {
  const { resolveAuthorFilter, ME, MY_ASSISTANT } = await scope();
  const a = user(VIEWER, VIEWER_TA);
  const b = user(OTHER, OTHER_TA);
  assert(resolveAuthorFilter(ME, a) === VIEWER && resolveAuthorFilter(ME, b) === OTHER,
    `story AC 6: Me is each person's own account — got A=${show(resolveAuthorFilter(ME, a))}, B=${show(resolveAuthorFilter(ME, b))}`);
  assert(resolveAuthorFilter(MY_ASSISTANT, a) === VIEWER_TA && resolveAuthorFilter(MY_ASSISTANT, b) === OTHER_TA,
    `story AC 6: My Local Tapestry Assistant is each person's own Assistant — got A=${show(resolveAuthorFilter(MY_ASSISTANT, a))}, B=${show(resolveAuthorFilter(MY_ASSISTANT, b))}`);
});

// ── runner ─────────────────────────────────────────────────────────────────────

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  console.log('\nlist-headers-disposition #1 — Me and My Local Tapestry Assistant (pure rules)\n');
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      fail++;
      failures.push({ name: t.name, message: err.message });
      console.log(`  ✗ ${t.name}\n      ${err.message}`);
    }
  }
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  return { pass, fail, skipped: 0, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
