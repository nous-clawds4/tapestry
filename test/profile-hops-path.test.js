/**
 * Story #39 (profile epic): Follows-hops path page + HOPS link activation.
 * ADR 0035. See engineering-team/stories/profile/39-profile-hops-path.test-plan.md
 *
 * Builds the click-through page for the #38 HOPS stat and activates its link.
 * New endpoint GET /api/get-follows-hops-paths returns up to 25 equally-short
 * FOLLOWS paths (each an ordered [{pubkey, influence}]); the page renders one
 * path as a vertical column of profile cards (pic, name, Owner-PoV rank =
 * Math.round(influence*100)) and a re-roll button (shown only when >1 path).
 * 3-state contract (as ADR 0034): paths / no-path (∞) / error.
 *
 * SOURCE-REGEX SENTINELS — the profile-family convention (#33–#38): no DB, no
 * React harness (local neo4j is stale/near-empty, OPEN.md #6). Browser behavior
 * is covered by the supplementary spec tests/brainstorm/profile-hops-path.spec.js.
 *
 * T* must FAIL pre-implementation and PASS post-implementation.
 * R* are regression/guard sentinels — they must PASS both before and after.
 */

const fs = require('fs');
const path = require('path');

const HANDLER     = path.resolve(__dirname, '../src/api/export/users/queries/follows-hops-paths.js');
const USERS_INDEX = path.resolve(__dirname, '../src/api/export/users/index.js');
const API_INDEX   = path.resolve(__dirname, '../src/api/index.js');
const AUTH        = path.resolve(__dirname, '../src/middleware/auth.js');
const HOOK        = path.resolve(__dirname, '../ui/src/hooks/useFollowsHopsPaths.js');
const PAGE        = path.resolve(__dirname, '../ui/src/pages/BrainstormFollowsHops.jsx');
const APP         = path.resolve(__dirname, '../ui/src/App.jsx');
const PROFILE     = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function countOf(src, re) { return (src.match(re) || []).length; }
function countsLabelIndex(src, label) {
  const re = new RegExp('bsp-count-label"[^>]*>\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const m = src.match(re);
  return m ? m.index : -1;
}

// ── Backend: GET /api/get-follows-hops-paths handler ──

test('T1: a follows-hops-paths handler module exists and exports handleGetFollowsHopsPaths', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'expected a new handler at src/api/export/users/queries/follows-hops-paths.js (does not exist yet).');
  assert(/handleGetFollowsHopsPaths/.test(src) && /module\.exports/.test(src),
    'the handler must define and export handleGetFollowsHopsPaths (mirror handleGetFollowsHops).');
});

test('T2: the handler validates 64-hex source/target and 400s with {success:false} (graceful failure)', () => {
  const src = safeRead(HANDLER);
  assert(/\{\s*64\s*\}/.test(src), 'must validate pubkeys are 64-char hex (a `{64}` length check).');
  assert(/\.status\(\s*400\s*\)[\s\S]{0,250}success:\s*false/.test(src),
    'malformed/missing source or target must 400 with {success:false} (→ UI unavailable, not a false path).');
});

test('T3: the handler short-circuits source===target to a single-node path with hops:0 (no allShortestPaths) (AC self-view)', () => {
  const src = safeRead(HANDLER);
  assert(/(source|src)\s*===\s*(target|tgt)|(target|tgt)\s*===\s*(source|src)/.test(src),
    'must special-case source === target (self-view is a single-node path, not a 1+-hop traversal).');
  assert(/hops:\s*0\b/.test(src),
    'self-view must return {success:true, hops:0, paths:[[{pubkey, influence}]]} — one card, computed WITHOUT allShortestPaths.');
});

test('T4: the handler uses DIRECTED allShortestPaths over FOLLOWS, cap 20, LIMIT 25 (AC path + re-roll set + bound)', () => {
  const src = safeRead(HANDLER);
  assert(/allShortestPaths\s*\(/.test(src),
    'the re-roll set requires allShortestPaths (all equally-short paths), not a single shortestPath.');
  assert(/:FOLLOWS\*[0-9]?\.\.20\]\s*->/.test(src),
    'the traversal must be DIRECTED and capped at 20: `-[:FOLLOWS*..20]->` (literal cap; directionality preserved).');
  assert(/LIMIT\s+25\b/.test(src),
    'must bound the returned paths with a literal `LIMIT 25` (cost control; Neo4j stops after 25).');
});

test('T5: the handler returns each path as ordered nodes(p) with pubkey AND Owner-PoV influence', () => {
  const src = safeRead(HANDLER);
  assert(/nodes\(\s*p\s*\)/.test(src),
    'must return the ordered nodes of the path (nodes(p)), not length/count — this IS the path.');
  assert(/pubkey/.test(src) && /influence/.test(src),
    'each path node must carry { pubkey, influence } so the client can render name/pic (via /api/profiles) and rank (Math.round(influence*100)).');
});

test('T6: the handler binds the pubkeys as params and passes a numeric query timeout to runCypher', () => {
  const src = safeRead(HANDLER);
  assert(/runCypher\s*\(/.test(src), 'must execute via the pooled Bolt helper runCypher (ADR 0034), not cypher-shell.');
  assert(/\$src|\$source/.test(src) && /\$tgt|\$target/.test(src),
    'pubkeys must be BOUND params ($src/$tgt), not interpolated (the cap/LIMIT are literals; user input is never interpolated).');
  assert(/runCypher\s*\([\s\S]{0,500}\btimeout\s*:/.test(src),
    'must pass a transaction config with a numeric `timeout:` — allShortestPaths at cap 20 must be deadline-bounded.');
});

test('T7: no-path-within-cap maps to {success:true, hops:null, paths:[]} (AC ∞)', () => {
  const src = safeRead(HANDLER);
  assert(/hops:\s*null/.test(src) && /paths:\s*\[\s*\]/.test(src),
    'when allShortestPaths returns no rows, respond {success:true, hops:null, paths:[]} — the UI renders ∞ with no cards.');
});

test('T8: hops is derived from the path length (paths[0].length - 1) and a truncated flag is set from the LIMIT', () => {
  const src = safeRead(HANDLER);
  assert(/length\s*-\s*1/.test(src),
    'the count must be derived from the actual path: paths[0].length - 1 (count and path can never disagree).');
  assert(/truncated/.test(src) && /25/.test(src),
    'must set `truncated` (true when 25 paths were returned, i.e. there may be more) so the UI can say "a random one of 25+".');
});

test('T9: a query error/timeout is caught and returned as {success:false} (graceful failure, NOT a false path/∞)', () => {
  const src = safeRead(HANDLER);
  assert(/catch\s*\([\s\S]{0,300}success:\s*false/.test(src),
    'an error/timeout must be caught → {success:false, error} so the UI shows "unavailable", never a false path or ∞.');
});

// ── Backend: route + export ──

test('T10: GET /api/get-follows-hops-paths is registered to handleGetFollowsHopsPaths', () => {
  const src = safeRead(API_INDEX);
  assert(/app\.get\(\s*['"]\/api\/get-follows-hops-paths['"]/.test(src),
    'src/api/index.js must register app.get(\'/api/get-follows-hops-paths\', ...).');
  assert(/handleGetFollowsHopsPaths/.test(src), 'the route must be wired to users.handleGetFollowsHopsPaths.');
});

test('T11: handleGetFollowsHopsPaths is re-exported from src/api/export/users/index.js', () => {
  const src = safeRead(USERS_INDEX);
  assert(/handleGetFollowsHopsPaths/.test(src), 'src/api/export/users/index.js must re-export handleGetFollowsHopsPaths.');
});

// ── Frontend: hook ──

test('T12: a useFollowsHopsPaths hook exists, default-exported, fetching the endpoint with AbortController', () => {
  const src = safeRead(HOOK);
  assert(/export default function useFollowsHopsPaths/.test(src), 'useFollowsHopsPaths must be the default export.');
  assert(/\/api\/get-follows-hops-paths\?source=/.test(src) && /target=/.test(src),
    'the hook must fetch `/api/get-follows-hops-paths?source=${source}&target=${target}`.');
  assert(/AbortController/.test(src), 'the hook must use an AbortController (its own async lifecycle, non-blocking).');
});

test('T13: the hook exposes hops/paths/truncated/noPath/loading/error, with noPath from a successful empty result', () => {
  const src = safeRead(HOOK);
  for (const field of ['hops', 'paths', 'truncated', 'noPath', 'loading', 'error']) {
    assert(new RegExp('\\b' + field + '\\b').test(src), `the hook must expose \`${field}\`.`);
  }
  assert(/\.length\s*===\s*0|length === 0/.test(src) && /===\s*null/.test(src) && /success/.test(src),
    'noPath must derive from a SUCCESSFUL empty result (success && paths.length === 0 && hops === null) — so ∞ is never shown for an error.');
});

// ── Frontend: page ──

test('T14: a BrainstormFollowsHops page exists, default-exported', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'expected a new page at ui/src/pages/BrainstormFollowsHops.jsx.');
  assert(/export default function BrainstormFollowsHops/.test(src), 'the page must be default-exported as BrainstormFollowsHops.');
});

test('T15: the page resolves source = logged-in viewer else Owner, and calls useFollowsHopsPaths(source, target)', () => {
  const src = safeRead(PAGE);
  assert(/useConfig/.test(src) && /useAuth/.test(src), 'the page must use useAuth (viewer) and useConfig (ownerPubkey).');
  assert(/user\?\.pubkey/.test(src) && /ownerPubkey/.test(src),
    'source must be `user?.pubkey || ownerPubkey` (logged-in viewer; else the Owner) — same rule as #38.');
  assert(/useFollowsHopsPaths\(/.test(src), 'the page must call useFollowsHopsPaths(source, target).');
});

test('T16: the page renders the path as profile cards that link to /user/<pubkey> (AC path-as-cards + card links)', () => {
  const src = safeRead(PAGE);
  assert(/\.map\(/.test(src), 'the path must be rendered by mapping over its nodes (one card per node).');
  assert(countOf(src, /to=\{`\/user\//g) >= 2 || /to=\{`\/user\/\$\{[^}]*pubkey[^}]*\}`\}/.test(src),
    'each card must be a <Link to={`/user/${...}`}> (clicking a card navigates to that profile) — distinct from the back-link.');
  assert(/bsp-follows-avatar|bsp-hops-card|bsp-hops-path/.test(src),
    'cards must show an avatar (reuse bsp-follows-avatar or a bsp-hops-* card class).');
});

test('T17: each card shows the Owner-PoV rank = Math.round(influence*100) (AC per-card rank)', () => {
  const src = safeRead(PAGE);
  assert(/Math\.round/.test(src) && /influence\s*\*\s*100/.test(src),
    'rank must be Math.round(influence*100) from the path node\'s Owner-PoV influence — the same derivation as BrainstormReporters.');
});

test('T18: the page enriches name/pic via /api/profiles (AC card name + picture)', () => {
  const src = safeRead(PAGE);
  assert(/\/api\/profiles\?pubkeys=/.test(src),
    'the page must fetch profile name/pic via /api/profiles?pubkeys=<csv> (batched), as the sibling list pages do.');
});

test('T19: a re-roll button is rendered ONLY when more than one shortest path exists (AC re-roll + hidden when ≤1)', () => {
  const src = safeRead(PAGE);
  assert(/paths\.length\s*>\s*1/.test(src),
    'the re-roll button must be gated on `paths.length > 1` — hidden for a single path, self-view, and no-path.');
  assert(/<button/i.test(src), 'there must be a re-roll <button>.');
});

test('T20: the no-path (∞) state shows a "no follow path" message keyed on noPath, with no cards (AC ∞ state)', () => {
  const src = safeRead(PAGE);
  assert(/noPath/.test(src), 'the page must branch on the hook\'s `noPath`.');
  assert(/There is no follow path from /.test(src),
    'the no-path state must show "There is no follow path from <source> to <target>" (consistent with #38).');
});

test('T21: the page shows the hop count, consistent with #38 copy ("…hop(s) away…by follows") (AC count)', () => {
  const src = safeRead(PAGE);
  assert(/by follows/.test(src) && / away from /.test(src),
    'the count line must read like #38: "<target> is N hop(s) away from <source> by follows."');
  assert(/hop\$\{[^}]*'s'|'hop'\s*:\s*'hops'|'hops'\s*:\s*'hop'/.test(src),
    'singular/plural: "1 hop" vs "N hops".');
});

// ── Frontend: route ──

test('T22: App.jsx imports BrainstormFollowsHops and registers /user/:pubkey/follows-hops', () => {
  const src = safeRead(APP);
  assert(/import\s+BrainstormFollowsHops\s+from/.test(src), 'App.jsx must import the BrainstormFollowsHops page.');
  assert(/\/user\/:pubkey\/follows-hops/.test(src), 'App.jsx must register the route /user/:pubkey/follows-hops.');
});

// ── Frontend: HOPS link activation on the profile page ──

test('T23: the HOPS stat on the profile page is now a <Link> to /user/${pubkey}/follows-hops, enclosing the Hops label (AC link activation)', () => {
  const src = safeRead(PROFILE);
  const linkIdx = src.indexOf('/user/${pubkey}/follows-hops');
  assert(linkIdx !== -1,
    'the HOPS counter must link to `/user/${pubkey}/follows-hops` (was a non-link <span> in #38).');
  const hopsIdx = countsLabelIndex(src, 'Hops');
  assert(hopsIdx !== -1 && hopsIdx > linkIdx,
    'the follows-hops Link must open BEFORE the Hops counts-row label (it wraps it).');
  const between = src.slice(linkIdx, hopsIdx);
  assert(!between.includes('</Link>'),
    'the Hops label must sit INSIDE the follows-hops <Link> (no closing </Link> between the link and the label).');
  assert(/bsp-count-link/.test(between),
    'the activated HOPS counter must carry the bsp-count-link affordance class.');
});

// ── Regression / guard sentinels (must PASS before AND after) ──

test('R1: the HOPS counter stays placed between Verified Followers and Verified Reporters (#38 placement preserved)', () => {
  const src = safeRead(PROFILE);
  const vf = countsLabelIndex(src, 'Verified Followers');
  const hops = countsLabelIndex(src, 'Hops');
  const vr = countsLabelIndex(src, 'Verified Reporters');
  assert(hops !== -1 && vf !== -1 && vr !== -1, 'the Verified Followers / Hops / Verified Reporters counts-row labels must all exist.');
  assert(vf < hops && hops < vr, `HOPS must remain between Verified Followers and Verified Reporters (VF=${vf}, HOPS=${hops}, VR=${vr}).`);
});

test('R2: the existing sibling counters/links remain intact (regression)', () => {
  const src = safeRead(PROFILE);
  assert(/\/user\/\$\{pubkey\}\/follows\b/.test(src), 'Following → /follows must remain.');
  assert(/\/user\/\$\{pubkey\}\/followers/.test(src), 'Verified Followers → /followers must remain.');
  assert(/\/user\/\$\{pubkey\}\/reporters/.test(src), 'Verified Reporters → /reporters must remain.');
});

test('R3: the #38 /api/get-follows-hops endpoint is still registered (built on, not broken) (regression)', () => {
  const src = safeRead(API_INDEX);
  assert(/app\.get\(\s*['"]\/api\/get-follows-hops['"]/.test(src),
    'the #38 count endpoint /api/get-follows-hops must remain registered.');
});

test('R4 (guard): /api/get-follows-hops-paths is NOT added to any auth gate — must stay publicly readable', () => {
  const src = safeRead(AUTH);
  assert(!/get-follows-hops-paths/.test(src),
    'the new endpoint must remain public (logged-out viewers use the Owner source). It must NOT appear in any allowlist in src/middleware/auth.js.');
});

async function run() {
  let pass = 0, fail = 0;
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
