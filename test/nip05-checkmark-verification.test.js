/**
 * Story #6: NIP-05 green checkmark must reflect real verification.
 *
 * Today both profile surfaces render the ✅ purely on presence of the
 * kind-0 `nip05` string:
 *
 *   UserDetail.jsx:84      {profile?.nip05 && <p className="user-nip05">✅ {profile.nip05}</p>}
 *   BrainstormProfile.jsx  {profile?.nip05 && <div className="bsp-nip05">✅ {profile.nip05}</div>}
 *
 * No domain lookup, no pubkey match — so unverified / impersonated
 * identifiers display as verified (GitHub #151).
 *
 * These tests are intentionally source-regex (matching the
 * per-query-neo4j-timeout-safety-net / strfry-router-first-boot Bug
 * precedents). They pin the ONE thing the spec fixes — the ✅ next to a
 * profile's nip05 must no longer be gated by nip05-presence alone — WITHOUT
 * prescribing how verification is done (client vs server, reuse of an
 * existing verifyNip05() helper, caching). The story deliberately left that
 * to the Implementer.
 *
 * What source tests CANNOT prove: that the new gate is a *real* match of the
 * domain-attested pubkey against the profile pubkey, and that it is
 * fail-closed in flight. A structurally-correct but semantically-fake gate
 * (e.g. a hook that returns true whenever nip05 exists) would pass T1/T2.
 * The authoritative behavioral gate for AC-1 / AC-2-positive / AC-4 is the
 * staging smoke documented in the test plan ("Not covered"): the two #151
 * pubkeys must show NO ✅, and a known-good identity MUST show ✅. The
 * Reviewer must treat that smoke evidence as required, not optional.
 *
 * T1–T2  : FAIL pre-implementation, PASS post-implementation.
 * R1–R2  : PASS pre AND post — out-of-scope guards; if they flip to FAIL,
 *          the Implementer touched something the story put out of scope.
 */

const fs = require('fs');
const path = require('path');

const UI = path.resolve(__dirname, '../ui/src/pages');
const USERDETAIL_PATH = path.join(UI, 'users/UserDetail.jsx');
const BRAINSTORMPROFILE_PATH = path.join(UI, 'BrainstormProfile.jsx');
const BRAINSTORMSEARCH_PATH = path.join(UI, 'BrainstormSearch.jsx');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

/**
 * The bug pattern: a nip05-presence check (`...nip05 &&`) immediately
 * followed by a single JSX element whose content starts with ✅. Matches
 * the current line in both files. Does NOT match:
 *   - `nip05Verified && <p>✅`           (gated on a verification signal)
 *   - `profile?.nip05 && verified && <p>✅`  (presence AND verification)
 *   - `<p>✅ Active PoV</p>` / `icon: '✅'`   (no nip05-presence guard in front)
 *   - the Identity-table row `nip05 && ( <tr><td>NIP-05</td>... )` (no ✅ in the tag)
 * i.e. it fires ONLY when nip05-presence ALONE renders the checkmark.
 */
const PRESENCE_ONLY_CHECKMARK = /nip05\s*&&\s*\(?\s*<[^>]{0,120}>\s*✅/;

// ---------------------------------------------------------------------------
// Failing tests — must FAIL now, PASS once the ✅ is gated on verification.
// ---------------------------------------------------------------------------

test('T1: UserDetail.jsx no longer renders the NIP-05 ✅ gated by nip05-presence alone', () => {
  const src = fs.readFileSync(USERDETAIL_PATH, 'utf8');
  assert(
    !PRESENCE_ONLY_CHECKMARK.test(src),
    'UserDetail.jsx must not render the green ✅ next to a profile\'s NIP-05 ' +
      'merely because `profile.nip05` is non-empty (AC-1, AC-2, AC-4). The ✅ ' +
      'must be gated on a verification outcome (domain-attested pubkey === profile pubkey), ' +
      'fail-closed. HOW (client/server, reuse of an existing verifyNip05() helper, caching) ' +
      'is the Implementer\'s call — only the presence-only gate must go. ' +
      'Found the presence-only pattern still present (currently UserDetail.jsx:84).'
  );
});

test('T2: BrainstormProfile.jsx no longer renders the NIP-05 ✅ gated by nip05-presence alone', () => {
  const src = fs.readFileSync(BRAINSTORMPROFILE_PATH, 'utf8');
  assert(
    !PRESENCE_ONLY_CHECKMARK.test(src),
    'BrainstormProfile.jsx must not render the green ✅ next to a profile\'s NIP-05 ' +
      'merely because `profile.nip05` is non-empty (AC-1, AC-2, AC-4, AC-5 — same fix on ' +
      'both surfaces). The ✅ must be gated on a verification outcome, fail-closed. ' +
      'Found the presence-only pattern still present (currently BrainstormProfile.jsx:228).'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — must PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: BrainstormSearch.jsx keeps the server-verified "✅ NIP-05 Verified" badge gated on nip05Result', () => {
  const src = fs.readFileSync(BRAINSTORMSEARCH_PATH, 'utf8');
  // Story §"Out of scope": the search-results badge is already gated on real
  // server-side verification (nip05Result, set only after verifyNip05 resolves).
  // It must be left untouched (AC-5). If this flips to FAIL the Implementer
  // changed an out-of-scope, already-correct surface.
  const re = /nip05Result\s*&&[\s\S]{0,200}?✅\s*NIP-05 Verified/;
  assert(
    re.test(src),
    'BrainstormSearch.jsx must keep its `{nip05Result && ( ... ✅ NIP-05 Verified ... )}` ' +
      'pinned-result badge unchanged — it is already gated on real server-side verification ' +
      'and is explicitly OUT OF SCOPE for story #6 (AC-5). The sentinel is failing: this ' +
      'out-of-scope badge was altered or removed.'
  );
});

test('R2: plain-text NIP-05 surfaces stay checkmark-free (no positive indicator added where the story deferred it)', () => {
  const search = fs.readFileSync(BRAINSTORMSEARCH_PATH, 'utf8');
  const userDetail = fs.readFileSync(USERDETAIL_PATH, 'utf8');

  // Story §"Out of scope": surfaces that show NIP-05 as PLAIN TEXT today must
  // not gain a ✅ (adding a positive indicator there is a deferred feature,
  // not this bug fix). Three stable, high-risk anchors:

  // (a) search results list — className "bs-result-nip05"
  const resultWin = search.match(/bs-result-nip05[\s\S]{0,80}/);
  assert(resultWin, 'R2: could not locate the bs-result-nip05 element in BrainstormSearch.jsx (anchor moved?).');
  assert(
    !/✅/.test(resultWin[0]),
    'R2: the search-results NIP-05 (bs-result-nip05) must stay plain text — no ✅ added ' +
      '(story #6 Out of scope). The sentinel is failing.'
  );

  // (b) search suggestions — className "bs-suggest-nip05"
  const suggestWin = search.match(/bs-suggest-nip05[\s\S]{0,80}/);
  assert(suggestWin, 'R2: could not locate the bs-suggest-nip05 element in BrainstormSearch.jsx (anchor moved?).');
  assert(
    !/✅/.test(suggestWin[0]),
    'R2: the search-suggestion NIP-05 (bs-suggest-nip05) must stay plain text — no ✅ added ' +
      '(story #6 Out of scope). The sentinel is failing.'
  );

  // (c) UserDetail Identity-table NIP-05 value cell (same file as the bug —
  //     highest risk of a collateral edit). Anchor on the label cell.
  const idxRow = userDetail.match(/NIP-05<\/td>[\s\S]{0,120}/);
  assert(idxRow, 'R2: could not locate the Identity-table "NIP-05" row in UserDetail.jsx (anchor moved?).');
  assert(
    !/✅/.test(idxRow[0]),
    'R2: the Identity-table NIP-05 row in UserDetail.jsx must stay plain text — the fix ' +
      'is for the header badge only; the detail row is Out of scope for story #6. The sentinel is failing.'
  );
});

async function run() {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
