/**
 * Story #8: Community-reference pointer — Nostr Relay stub.
 * ADR 0005 (Accepted; depends on ADR 0004) — Option A: a firmware
 * `communityReference` manifest field + an idempotent firmware-install
 * sub-pass that fetches the community kind-39998 Header via the existing
 * /api/relay/external, publishes it to local strfry WITHOUT re-signing,
 * explicitly materializes it as a Neo4j node (buildImportCypher/executeCypher
 * — ADR 0005 Rev 2; Pass-3 derive does NOT do this), and MERGEs a Neo4j-only
 * `REFERENCES {source:'firmware-community'}` placeholder edge (local Header →
 * community Header), failing gracefully (never throws out of install).
 *
 * Precedent: stories #5 / #6. The behavioral round-trip — a real community
 * Header fetched off a relay, materialized as a distinct foreign node, the
 * REFERENCES edge present, graceful skip when no relay carries it, knownGoodEventId
 * mismatch handling, and re-install idempotency — needs a live firmware
 * install + relays + Neo4j and is NOT reproducible in this hand-rolled
 * runner. It is the **authoritative behavioral gate via local docker smoke
 * (cycle-local) + staging**, documented in the test plan §"Not covered".
 * The Reviewer must treat that smoke as required, not optional.
 *
 * TI1, TI2 : FAIL pre-implementation, PASS post.
 * RI1, RI2 : PASS pre AND post — scope guards. RI1 flips to FAIL if the
 *            Implementer drifts to ADR Option B (a first-class signed
 *            editorial firmware relationship-type). RI2 flips if the Implementer edits
 *            files ADR 0005 declared "No source change".
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'firmware/active/manifest.json');
const INSTALL = path.join(ROOT, 'src/firmware/install.js');
const NO_TOUCH = [
  'src/api/relay/fetchEvents.js',
  'src/api/strfry/commands/publishEvent.js',
  'src/api/tapestry-key/index.js',
];

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #8 is implemented per ADR 0005.
// ---------------------------------------------------------------------------

test('TI1: firmware manifest carries a well-formed `communityReference` on the nostr-relay concept (AC-1, ADR 0005)', () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const entry = (m.concepts || []).find((c) => c.slug === 'nostr-relay');
  assert(entry, 'nostr-relay concept entry not found in firmware/active/manifest.json (firmware shape changed?).');
  const cr = entry.communityReference;
  assert(
    cr && typeof cr === 'object',
    'nostr-relay concept entry has no `communityReference` (AC-1). ADR 0005 Implementation ' +
      'notes: add `communityReference: { headerATag, relayHints[], knownGoodEventId? }` to ' +
      'the nostr-relay entry in the versioned firmware manifest.'
  );
  assert(
    typeof cr.headerATag === 'string' && /^39998:[0-9a-f]{64}:nostr-relay$/.test(cr.headerATag),
    '`communityReference.headerATag` must be a kind-39998 a-tag `39998:<64-hex curator pubkey>:nostr-relay` ' +
      `(AC-1). Got: ${JSON.stringify(cr.headerATag)}.`
  );
  assert(
    Array.isArray(cr.relayHints) &&
      cr.relayHints.length > 0 &&
      cr.relayHints.every((r) => typeof r === 'string' && /^wss?:\/\//.test(r)),
    '`communityReference.relayHints` must be a non-empty array of ws(s):// URLs (ADR 0005: ' +
      'defaults to the PUBLISH_RELAYS set per ADR 0004 so it matches what export emits). Got: ' +
      `${JSON.stringify(cr.relayHints)}.`
  );
  assert(
    cr.knownGoodEventId === undefined ||
      (typeof cr.knownGoodEventId === 'string' && /^[0-9a-f]{64}$/.test(cr.knownGoodEventId)),
    '`communityReference.knownGoodEventId`, when present, must be a 64-hex event id (AC-4 ' +
      `integrity pin). Got: ${JSON.stringify(cr.knownGoodEventId)}.`
  );
});

test('TI2: install.js has a graceful community-reference sub-pass, wired before Pass-3 derive (AC-1/AC-3/AC-5, ADR 0005)', () => {
  const src = fs.readFileSync(INSTALL, 'utf8');

  const iRelay = src.indexOf('/api/relay/external');
  const iStrfry = src.indexOf('/api/strfry/publish');
  const iRefs = src.search(/:\s*REFERENCES\s*\]/);
  const iMaterialize = src.search(/buildImportCypher|executeCypher/);
  const iDerive = src.indexOf('/api/tapestry-key/derive-all/');

  assert(
    iRelay !== -1,
    'install.js does not fetch the community Header via `/api/relay/external` (AC-1). ' +
      'ADR 0005: the sub-pass builds a {kinds:[39998],authors:[curatorPk],"#d":[slug]} (or ' +
      'ids:[knownGoodEventId]) filter and calls the existing /api/relay/external.'
  );
  assert(
    iStrfry !== -1,
    'install.js does not publish the fetched community Header via `/api/strfry/publish` ' +
      '(AC-1). ADR 0005: pass the already-signed foreign event through WITHOUT re-signing, ' +
      'so the existing derive turns it into a distinct foreign node.'
  );
  assert(
    iMaterialize !== -1,
    'install.js does not explicitly materialize the fetched community Header as a Neo4j ' +
      'node (AC-1/AC-2). ADR 0005 Rev 2: Pass-3 derive does NOT ingest strfry events into ' +
      'Neo4j — pass_communityReferences MUST call buildImportCypher/executeCypher (from ' +
      'src/api/neo4j/eventSync) on the fetched event, or the REFERENCES edge can never form ' +
      '(this was the M1 defect).'
  );
  assert(
    iRefs !== -1,
    'install.js never MERGEs a `[:REFERENCES]` edge (AC-2 placeholder). ADR 0005 Rev 2: ' +
      'MERGE (localHeader)-[r:REFERENCES]->(communityHeader) SET r.source=\'firmware-community\' ' +
      '— Neo4j-only, idempotent; `source` disambiguates from the eventSync tag→event REFERENCES.'
  );
  assert(
    iDerive !== -1,
    'install.js Pass-3 derive marker `/api/tapestry-key/derive-all/` not found ' +
      '(install flow changed? — re-baseline this ordering sentinel).'
  );
  assert(
    iRelay !== -1 && iDerive !== -1 && iRelay < iDerive,
    'The community-reference sub-pass must be wired BEFORE the Pass-3 derive block (ADR 0005: ' +
      '"after pass1_bootstrap, before the Pass-3 derive block" — the published community Header ' +
      'must exist in strfry before derive runs so it becomes a node). Found /api/relay/external ' +
      `at ${iRelay}, derive-all at ${iDerive}.`
  );
  // Graceful: a per-concept try/catch must exist in the community-ref region
  // (ADR 0005 / AC-3 / AC-5: a miss or error must never throw out of install).
  const region = src.slice(iRelay === -1 ? 0 : iRelay, iDerive === -1 ? src.length : iDerive);
  assert(
    /\btry\s*\{/.test(region) && /\bcatch\s*\(/.test(region),
    'The community-reference sub-pass must wrap each concept in try/catch and never throw out ' +
      'of install (AC-3 graceful degradation: relay miss / id-mismatch / error ⇒ log + continue; ' +
      'the local firmware concept is created exactly as before).'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('RI1: no first-class editorial firmware relationship-type added (ADR 0005 chose Option A, rejected Option B)', () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  assert(
    Array.isArray(m.relationshipTypes) && m.relationshipTypes.length === 11,
    `manifest.relationshipTypes must stay at the known 11 (Option A: the REFERENCES edge is ` +
      `Neo4j-only, NOT a firmware relationship-type). Found ${m.relationshipTypes && m.relationshipTypes.length}. ` +
      'A change here means the Implementer drifted into ADR 0005 Option B (out of scope; ' +
      'belongs to plan item (1)).'
  );
  const editorialRel = m.relationshipTypes.filter((r) => /\b(import|references)\b/i.test(JSON.stringify(r)));
  assert(
    editorialRel.length === 0,
    'A first-class IMPORT/REFERENCES relationship-type was registered in the firmware manifest — ' +
      'that is ADR 0005 Option B (protocol-correct signed editorial relationship), explicitly ' +
      'deferred to plan item (1). The stub keeps it a Neo4j-only REFERENCES edge.'
  );
});

test('RI2: ADR-0005 "No source change" files stay free of community-reference logic', () => {
  for (const rel of NO_TOUCH) {
    const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert(
      !/community[-\s]?[Rr]eference|communityReference/.test(s),
      `${rel} gained community-reference logic. ADR 0005 Implementation notes: "No source ` +
        `change to fetchEvents.js / publishEvent.js / tapestry-key/index.js — reuse as-is." ` +
        `The new behavior belongs only in src/firmware/install.js + the firmware manifest.`
    );
  }
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
