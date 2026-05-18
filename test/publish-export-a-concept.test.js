/**
 * Story #9: Publish/export a concept to the community.
 * ADR 0004 (Accepted) — Concept-Graph-rooted export; own-authored TA-signed
 * events only; Header as the graceful floor; reuse the existing browser
 * publish primitive (`publishEverywhere`); owner-only.
 *
 * Precedent: stories #5 / #6 / strfry-router-first-boot — the deterministic
 * part of a relay/Neo4j feature is pinned with source/structural sentinels;
 * the actual round-trip (events landing on relays, foreign nodes excluded,
 * idempotency, partial-failure reporting, owner-only enforcement) is NOT
 * reproducible in this hand-rolled Node runner and is the **authoritative
 * behavioral gate via local docker smoke (cycle-local) + staging**, documented
 * in the test plan §"Not covered". The Reviewer must treat that smoke as
 * required, not optional.
 *
 * Deliberate limitation (read this): ADR 0004 left the exact route name/path
 * open ("new handler under src/api/concept/ OR extend src/api/concept-graph/").
 * These sentinels therefore pin the **stable contract** the ADR did fix —
 * (a) the feature is wired through the existing publish primitive, (b) export
 * is provenance-filtered to this instance's own pubkey — WITHOUT prescribing
 * the open mechanism. A semantically-correct implementation that renames
 * things keeps these green by updating the anchor; a missing or
 * provenance-unsafe implementation fails.
 *
 * TE1, TE2 : FAIL pre-implementation, PASS post.
 * RE1      : PASS pre AND post — scope guard; a flip to FAIL means the
 *            Implementer drifted to ADR Option B (new server-side external
 *            publisher) or changed the out-of-scope publish primitive.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOSTR_PUBLISH = path.join(ROOT, 'ui/src/utils/nostrPublish.js');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

/** Recursively collect .js/.jsx files under a dir (no node_modules under these trees). */
function collect(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collect(p));
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const UI_FILES = collect(path.join(ROOT, 'ui/src'));
const API_FILES = collect(path.join(ROOT, 'src/api'));

// A concept-scoped export/publish token (distinct from the existing
// per-PROFILE publishEverywhere usage in ui/src/hooks/useProfileActions.js).
const CONCEPT_EXPORT = /export-set|publish[-\s.]{0,3}concept|concept[\s\S]{0,40}export/i;

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #9 is implemented per ADR 0004.
// ---------------------------------------------------------------------------

test('TE1: a "publish concept" action is wired through the existing publishEverywhere primitive (AC-1, ADR 0004 Option A)', () => {
  const wired = UI_FILES.some((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return s.includes('publishEverywhere') && CONCEPT_EXPORT.test(s);
  });
  assert(
    wired,
    'No UI surface pairs a concept event-set export with `publishEverywhere` (AC-1; ADR 0004 ' +
      'Option A: the owner "Publish concept" action loops the existing browser publish primitive ' +
      'over the concept\'s constituent events). The existing per-profile use of publishEverywhere ' +
      'in useProfileActions.js does NOT satisfy this — a concept-scoped export/publish path must ' +
      'exist. STRUCTURAL sentinel only; the authoritative proof (events actually reach the ' +
      'community relays, Concept-Graph-rooted) is the local/staging smoke in the test plan.'
  );
});

test('TE2: a server endpoint enumerates a concept\'s OWN-authored events (provenance filter to this TA pubkey) (AC-2/AC-6, ADR 0004)', () => {
  const ok = API_FILES.some((f) => {
    const s = fs.readFileSync(f, 'utf8');
    const isExport = CONCEPT_EXPORT.test(s);
    const provenance =
      /getTAPubkey|getOwnerAssistantPubkey/.test(s) &&
      /\bpubkey\b\s*[:=]|n\.pubkey|\.pubkey\s*=|pubkey\s*===|WHERE[\s\S]{0,80}pubkey/i.test(s);
    return isExport && provenance;
  });
  assert(
    ok,
    'No server export path enumerates a concept\'s constituent events filtered to THIS ' +
      'instance\'s own/TA pubkey (AC-2 provenance principle: you never re-export someone ' +
      'else\'s concept under your identity; ADR 0004 Implementation notes: `WHERE node.pubkey ' +
      '= <TA pubkey>`). Owner-only enforcement (AC-6) and the actual exclusion of foreign ' +
      'nodes are the authoritative local/staging smoke gate — this sentinel only pins that ' +
      'the provenance filter is present in source.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinel — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('RE1: publish primitive reused unchanged; no ADR-Option-B server-side external publisher introduced', () => {
  const np = fs.readFileSync(NOSTR_PUBLISH, 'utf8');
  assert(
    /export\s+(async\s+)?function\s+publishEverywhere/.test(np) && /PUBLISH_RELAYS\s*=/.test(np),
    'ui/src/utils/nostrPublish.js must keep exporting `publishEverywhere` and defining ' +
      '`PUBLISH_RELAYS` (ADR 0004 Option A: reuse as-is, "No change to nostrPublish.js"). ' +
      'Sentinel failing ⇒ the out-of-scope publish primitive was altered.'
  );
  const optionB = API_FILES.find((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return /SimplePool/.test(s) && /\.publish\s*\(/.test(s);
  });
  assert(
    !optionB,
    'A server-side external-relay publisher (SimplePool + .publish()) was introduced' +
      (optionB ? ` in ${path.relative(ROOT, optionB)}` : '') +
      ' — that is ADR 0004 Option B, explicitly REJECTED for this stub. Export must reuse the ' +
      'browser-side publish path (Option A). (Pre-impl: fetchEvents.js uses SimplePool.querySync ' +
      'for FETCH only, never .publish — this guard holds.)'
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
