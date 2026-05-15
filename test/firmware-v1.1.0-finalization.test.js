/**
 * Story #7: Firmware v1.1.0 finalization.
 *
 * These tests pin the substrate the ADR locks in:
 *   - v1.1.0 manifest has the same top-level shape as v1.0.0
 *   - v1.1.0 concepts list = v1.0.0 list + 2 new concepts (no dupes, no drops)
 *   - enumerations / elements / sets / relationshipTypes deep-equal v1.0.0
 *     (drift protection — protects against future divergence too)
 *   - changelog is newest-first with v1.1.0 prepended, both v1.0.0 entries preserved
 *   - no SKELETON / NOT YET DEPLOYABLE markers anywhere under v1.1.0
 *   - brainstorm-community schema gains an optional nip72Wrapping property
 *   - brainstorm-community-signal schema preserved
 *   - firmware/active symlink resolves to versions/v1.1.0
 *   - v1.0.0 directory contents untouched (rollback safety)
 *
 * See engineering-team/stories/7-firmware-v1.1.0-finalization.test-plan.md
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const FIRMWARE = path.join(ROOT, 'firmware');
const V1_0_0 = path.join(FIRMWARE, 'versions/v1.0.0');
const V1_1_0 = path.join(FIRMWARE, 'versions/v1.1.0');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function readJson(p) {
  const raw = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${path.relative(ROOT, p)} is not valid JSON: ${err.message}`);
  }
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────
 * T1–T5 — manifest shape
 * ──────────────────────────────────────────────────────────── */

test('v1.1.0 manifest has the same 9 top-level keys as v1.0.0', () => {
  const v1 = readJson(path.join(V1_0_0, 'manifest.json'));
  const v11 = readJson(path.join(V1_1_0, 'manifest.json'));
  const v1Keys = Object.keys(v1).sort();
  const v11Keys = Object.keys(v11).sort();
  const missing = v1Keys.filter(k => !v11Keys.includes(k));
  const extra = v11Keys.filter(k => !v1Keys.includes(k));
  assert(missing.length === 0,
    `v1.1.0 manifest missing top-level keys: ${missing.join(', ')}`);
  assert(extra.length === 0,
    `v1.1.0 manifest has unexpected top-level keys not in v1.0.0: ${extra.join(', ')}`);
});

test('v1.1.0 concepts list is v1.0.0 concepts + brainstorm-community + brainstorm-community-signal', () => {
  const v1 = readJson(path.join(V1_0_0, 'manifest.json'));
  const v11 = readJson(path.join(V1_1_0, 'manifest.json'));
  const v1Slugs = v1.concepts.map(c => c.slug);
  const v11Slugs = v11.concepts.map(c => c.slug);
  assert(v11Slugs.length === v1Slugs.length + 2,
    `v1.1.0 has ${v11Slugs.length} concepts; expected ${v1Slugs.length + 2} (${v1Slugs.length} from v1.0.0 + 2 new)`);
  for (const slug of v1Slugs) {
    assert(v11Slugs.includes(slug), `v1.1.0 missing v1.0.0 concept "${slug}"`);
  }
  assert(v11Slugs.includes('brainstorm-community'),
    'v1.1.0 missing brainstorm-community concept');
  assert(v11Slugs.includes('brainstorm-community-signal'),
    'v1.1.0 missing brainstorm-community-signal concept');
  // No duplicates.
  const dupes = v11Slugs.filter((s, i) => v11Slugs.indexOf(s) !== i);
  assert(dupes.length === 0, `v1.1.0 concepts list has duplicates: ${dupes.join(', ')}`);
});

test('v1.1.0 enumerations / elements / sets / relationshipTypes are deep-equal to v1.0.0 (drift protection)', () => {
  const v1 = readJson(path.join(V1_0_0, 'manifest.json'));
  const v11 = readJson(path.join(V1_1_0, 'manifest.json'));
  for (const key of ['enumerations', 'elements', 'sets', 'relationshipTypes']) {
    try {
      assert.deepStrictEqual(v11[key], v1[key]);
    } catch (err) {
      throw new Error(`v1.1.0 ${key} diverged from v1.0.0 — Slice 1 introduces no new ${key}, so they must be deep-equal. ${err.message.split('\n')[0]}`);
    }
  }
});

test('v1.1.0 changelog has 3 entries with v1.1.0 first and the two v1.0.0 entries preserved', () => {
  const v1 = readJson(path.join(V1_0_0, 'manifest.json'));
  const v11 = readJson(path.join(V1_1_0, 'manifest.json'));
  assert(Array.isArray(v11.changelog), 'v1.1.0 changelog must be an array');
  assert(v11.changelog.length === 3,
    `v1.1.0 changelog must have 3 entries (1 new + 2 preserved); got ${v11.changelog.length}`);
  assert(v11.changelog[0].version === '1.1.0',
    `v1.1.0 changelog[0] must be the new v1.1.0 entry; got version ${v11.changelog[0].version}`);
  assert(v11.changelog[0].date === '2026-05-14',
    `v1.1.0 changelog[0].date must be "2026-05-14"; got ${v11.changelog[0].date}`);
  assert(Array.isArray(v11.changelog[0].changes) && v11.changelog[0].changes.length > 0,
    'v1.1.0 changelog[0].changes must be a non-empty array');
  // The two v1.0.0 entries must be preserved verbatim at indices 1 and 2.
  try {
    assert.deepStrictEqual(v11.changelog.slice(1), v1.changelog);
  } catch (err) {
    throw new Error(`v1.1.0 changelog entries 1+ must equal v1.0.0 changelog. ${err.message.split('\n')[0]}`);
  }
});

test('v1.1.0 manifest has version "1.1.0" and date "2026-05-14"', () => {
  const v11 = readJson(path.join(V1_1_0, 'manifest.json'));
  assert(v11.version === '1.1.0', `v1.1.0 manifest.version must be "1.1.0"; got "${v11.version}"`);
  assert(v11.date === '2026-05-14', `v1.1.0 manifest.date must be "2026-05-14"; got "${v11.date}"`);
});

/* ────────────────────────────────────────────────────────────
 * T6 — no SKELETON markers anywhere in deployable firmware
 * ──────────────────────────────────────────────────────────── */

test('no SKELETON / NOT YET DEPLOYABLE markers anywhere under firmware/versions/v1.1.0', () => {
  const files = walk(V1_1_0);
  const offenders = [];
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    // Match the uppercase SKELETON placeholder marker only — the
    // lowercase word "skeleton" appears legitimately in domain copy
    // (e.g. node-type/json-schema.json: "the concept skeleton for…").
    if (/\bSKELETON\b|NOT YET DEPLOYABLE|Not yet deployable/.test(raw)) {
      offenders.push(path.relative(ROOT, f));
    }
  }
  assert(offenders.length === 0,
    `SKELETON / NOT YET DEPLOYABLE marker still in deployable firmware: ${offenders.join(', ')}`);
});

/* ────────────────────────────────────────────────────────────
 * T7–T9 — schema shape
 * ──────────────────────────────────────────────────────────── */

test('brainstorm-community json-schema has optional nip72Wrapping property', () => {
  const file = readJson(path.join(V1_1_0, 'concepts/brainstorm-community/json-schema.json'));
  const inner = file.jsonSchema.properties.brainstormCommunity;
  assert(inner, 'json-schema must have jsonSchema.properties.brainstormCommunity');
  assert(inner.properties.nip72Wrapping,
    'brainstormCommunity.properties.nip72Wrapping must be defined');
  assert(inner.properties.nip72Wrapping.type === 'string',
    'nip72Wrapping.type must be "string"');
  assert(!inner.required.includes('nip72Wrapping'),
    'nip72Wrapping must NOT be in the required array — wrapping is optional per PLAN.md §3');
});

test('brainstorm-community json-schema required array has the 7 PLAN.md §3 required fields', () => {
  const file = readJson(path.join(V1_1_0, 'concepts/brainstorm-community/json-schema.json'));
  const required = file.jsonSchema.properties.brainstormCommunity.required;
  for (const field of ['slug', 'name', 'description', 'relays', 'seedMembers', 'weightingModel', 'endorsementThreshold']) {
    assert(required.includes(field),
      `brainstormCommunity.required must include "${field}"`);
  }
});

test('brainstorm-community-signal schema has targetPubkey + communityATag required and type/role/comments optional', () => {
  const file = readJson(path.join(V1_1_0, 'concepts/brainstorm-community-signal/json-schema.json'));
  const inner = file.jsonSchema.properties.brainstormCommunitySignal;
  assert(inner, 'json-schema must have jsonSchema.properties.brainstormCommunitySignal');
  for (const field of ['targetPubkey', 'communityATag']) {
    assert(inner.required.includes(field),
      `brainstormCommunitySignal.required must include "${field}"`);
  }
  for (const field of ['type', 'role', 'comments']) {
    assert(inner.properties[field],
      `brainstormCommunitySignal.properties.${field} must be defined`);
    assert(!inner.required.includes(field),
      `${field} must NOT be in the required array (default behavior per PLAN.md §3)`);
  }
});

/* ────────────────────────────────────────────────────────────
 * T10 — symlink flip
 * ──────────────────────────────────────────────────────────── */

test('firmware/active symlink resolves to versions/v1.1.0', () => {
  const link = path.join(FIRMWARE, 'active');
  let stat;
  try {
    stat = fs.lstatSync(link);
  } catch {
    throw new Error('firmware/active does not exist');
  }
  assert(stat.isSymbolicLink(),
    'firmware/active must be a symlink (got a regular file or directory)');
  const target = fs.readlinkSync(link);
  assert(target === 'versions/v1.1.0',
    `firmware/active must resolve to "versions/v1.1.0"; got "${target}"`);
});

/* ────────────────────────────────────────────────────────────
 * T11 — v1.0.0 untouched (rollback safety)
 * ──────────────────────────────────────────────────────────── */

test('firmware/versions/v1.0.0 manifest still has its original v1.0.0 contents (34 concepts, 2 changelog entries)', () => {
  const v1 = readJson(path.join(V1_0_0, 'manifest.json'));
  assert(v1.version === '1.0.0', `v1.0.0 manifest.version regressed to "${v1.version}"`);
  assert(v1.concepts.length === 34,
    `v1.0.0 concepts count regressed; expected 34, got ${v1.concepts.length}`);
  assert(v1.changelog.length === 2,
    `v1.0.0 changelog length regressed; expected 2, got ${v1.changelog.length}`);
});

/* ────────────────────────────────────────────────────────────
 * T12 — coreMemberOf linkage
 * ──────────────────────────────────────────────────────────── */

test('each new concept json-schema has a coreMemberOf entry whose slug matches the concept-header word.slug', () => {
  for (const concept of ['brainstorm-community', 'brainstorm-community-signal']) {
    const header = readJson(path.join(V1_1_0, 'concepts', concept, 'concept-header.json'));
    const schema = readJson(path.join(V1_1_0, 'concepts', concept, 'json-schema.json'));
    const headerSlug = header.word.slug;
    const link = schema.word.coreMemberOf;
    assert(Array.isArray(link) && link.length === 1,
      `${concept}/json-schema.json must have word.coreMemberOf as a single-entry array`);
    assert(link[0].slug === headerSlug,
      `${concept}/json-schema.json coreMemberOf slug "${link[0].slug}" must match concept-header.json word.slug "${headerSlug}"`);
  }
});

/* ────────────────────────────────────────────────────────────
 * T13 — per-concept manifest.json shape
 * ──────────────────────────────────────────────────────────── */

test('each new concept directory contains a manifest.json with { HAS_ELEMENT, IS_A_SUPERSET_OF } shape', () => {
  for (const concept of ['brainstorm-community', 'brainstorm-community-signal']) {
    const m = readJson(path.join(V1_1_0, 'concepts', concept, 'manifest.json'));
    assert(Array.isArray(m.HAS_ELEMENT),
      `${concept}/manifest.json must have HAS_ELEMENT as an array`);
    assert(Array.isArray(m.IS_A_SUPERSET_OF),
      `${concept}/manifest.json must have IS_A_SUPERSET_OF as an array`);
  }
});

/* ────────────────────────────────────────────────────────────
 * T14 — PLAN.md §5 status update
 * ──────────────────────────────────────────────────────────── */

test('PLAN.md §5 Skeleton status paragraph carries the 2026-05-14 finalized note', () => {
  const plan = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
  assert(/Finalized 2026-05-14/.test(plan),
    'PLAN.md must contain "Finalized 2026-05-14" — append to the §5 Skeleton status paragraph');
});

/* ────────────────────────────────────────────────────────────
 * Runner
 * ──────────────────────────────────────────────────────────── */

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
