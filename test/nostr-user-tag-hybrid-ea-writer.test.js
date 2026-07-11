/**
 * Tests for Story 2 (epic: tag-stack-merge-hardening) — nostr-user-tag writer
 * emits a hybrid e+a parent reference.
 *
 * ADR: engineering-team/decisions/tag-stack-merge-hardening/0002-nostr-user-tag-hybrid-ea-writer.md
 * Governing ADR: 0022 (hybrid e+a wire shape).
 *
 * Intentionally failing until the writer + firmware schema change lands.
 * Hand-rolled in the project's existing test style — no new framework.
 *
 * Levels:
 *   - SOURCE-CONTRACT (regex) for the writer (`publishProfileTag.js`) and the
 *     `createTag` return (`useProfileTags.js`): both are ESM and not
 *     require()-able from the CJS runner (same constraint as Story 1's UI
 *     assertions). Each regex pins the exact change ADR-0022/0002 prescribes.
 *   - BEHAVIORAL-UNIT (JSON parse) for the firmware schema: load the actual
 *     json-schema file and assert the optional `tagAddress` shape.
 *
 * AC-6 (firmware reinstall) is operational — verified during cycle-local
 * (POST /api/firmware/install, then confirm the concept-graph shows the new
 * schema). The schema change that *necessitates* the reinstall is pinned by
 * AC-5 here.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const WRITER = 'ui/src/utils/publishProfileTag.js';
const HOOK = 'ui/src/hooks/useProfileTags.js';
const READ = 'src/api/profile-tags/index.js';
const SCHEMA = 'firmware/active/concepts/nostr-user-tag/json-schema.json';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ── AC-1: hybrid wire shape on the writer ───────────────────────────── */

t('AC-1a: writer emits an `a` coordinate built from the tag author pubkey + slug', () => {
  const src = readSrc(WRITER);
  assert(/\[\s*['"]a['"]\s*,/.test(src),
    'publishProfileTag.js must add an [\'a\', ...] tag to the assertion (ADR-0022 hybrid e+a)');
  assert(/39999:\$\{[^}]*authorPubkey[^}]*\}:\$\{[^}]*slug[^}]*\}/.test(src),
    'the `a` value must be the coordinate `39999:${tag.authorPubkey}:${tag.slug}` (stable tag identity)');
});

t('AC-1b: writer RETAINS the `e` event-id reference (provenance)', () => {
  const src = readSrc(WRITER);
  assert(/\[\s*['"]e['"]\s*,\s*tag\.eventId\s*\]/.test(src),
    'publishProfileTag.js must keep [\'e\', tag.eventId] alongside the new `a` (hybrid, not a replacement)');
});

t('AC-1c: writer leaves d / p / z / polarity tags unchanged', () => {
  const src = readSrc(WRITER);
  assert(/\[\s*['"]d['"]\s*,\s*dTag\s*\]/.test(src), 'd-tag entry must remain');
  assert(/\[\s*['"]p['"]\s*,\s*targetPubkey\s*\]/.test(src), 'p-tag entry must remain');
  assert(/\[\s*['"]z['"]\s*,\s*NOSTR_USER_TAG_HANDLE\s*\]/.test(src),
    'z-tag must remain the (ADR-0015-pinned) NOSTR_USER_TAG_HANDLE — unchanged');
  assert(/\[\s*['"]polarity['"]\s*,/.test(src), 'polarity-tag entry must remain');
});

/* ── AC-2: content mirror carries tagAddress ─────────────────────────── */

t('AC-2: content mirror includes tagAddress alongside taggedPubkey + tagEventId', () => {
  const src = readSrc(WRITER);
  const mirror = src.match(/nostrUserTag:\s*\{[^}]*\}/);
  assert(mirror, 'could not locate the nostrUserTag content mirror in publishProfileTag.js');
  assert(/tagAddress/.test(mirror[0]),
    'the nostrUserTag content object must carry `tagAddress` (the `a` coordinate) — AC-2');
  assert(/taggedPubkey/.test(mirror[0]) && /tagEventId/.test(mirror[0]),
    'the content mirror must still carry taggedPubkey and tagEventId');
});

/* ── AC-3: author resolved at apply time; refuse on missing ──────────── */

t('AC-3a: writer refuses to publish when the tag author pubkey is missing/invalid', () => {
  const src = readSrc(WRITER);
  assert(/authorPubkey/.test(src),
    'publishProfileTag.js must reference tag.authorPubkey to build the coordinate');
  assert(/authorPubkey[\s\S]{0,200}throw|throw[\s\S]{0,200}authorPubkey/.test(src),
    'the writer must THROW (refuse to publish) when authorPubkey is absent/malformed, rather than ' +
    'silently emitting a malformed `a` or falling back to e-only (ADR-0002 Option A)');
});

t('AC-3b: createTag returns the author pubkey so create-then-apply supplies the coord', () => {
  const src = readSrc(HOOK);
  const ret = src.match(/return \{ eventId: signed\.id[^}]*\}/);
  assert(ret, 'could not locate the createTag return in useProfileTags.js');
  assert(/authorPubkey/.test(ret[0]),
    'createTag must return authorPubkey (the creator = signed.pubkey) so an immediate apply can build the `a` coord — AC-3');
});

/* ── AC-4: legacy #e reads unbroken ──────────────────────────────────── */

t('AC-4a: the retained `e` tag keeps new assertions matchable by existing #e scans', () => {
  const src = readSrc(WRITER);
  // Same retained-`e` invariant as AC-1b, framed as the read-compat guarantee:
  // because new events still carry ['e', tag.eventId], a reader scanning #e
  // (as today) matches old AND new assertions identically.
  assert(/\[\s*['"]e['"]\s*,\s*tag\.eventId\s*\]/.test(src),
    'the `e` tag must be retained so #e-based reads keep matching new assertions (AC-4)');
});

t('AC-4b: read path still scans assertions by #e (not switched to #a)', () => {
  const src = readSrc(READ);
  assert(/['"]#e['"]\s*:/.test(src),
    'src/api/profile-tags/index.js must still scan assertions by #e — this story does not change reads (AC-4)');
});

/* ── AC-5: firmware schema accepts both legacy and hybrid ─────────────── */

t('AC-5a: firmware nostr-user-tag schema declares an optional tagAddress property', () => {
  const schema = JSON.parse(readSrc(SCHEMA));
  const nut = schema?.jsonSchema?.properties?.nostrUserTag;
  assert(nut, 'schema.jsonSchema.properties.nostrUserTag must exist');
  assert(nut.properties && nut.properties.tagAddress,
    'nostrUserTag.properties must include a `tagAddress` field (mirrors the event `a` tag) — AC-5');
  assert(typeof nut.properties.tagAddress.type === 'string' || nut.properties.tagAddress.type === 'string',
    'tagAddress should declare a type (string)');
});

t('AC-5b: tagAddress is OPTIONAL; tagEventId stays REQUIRED (legacy e-only still validates)', () => {
  const schema = JSON.parse(readSrc(SCHEMA));
  const nut = schema?.jsonSchema?.properties?.nostrUserTag;
  assert(nut && Array.isArray(nut.required), 'nostrUserTag.required must be an array');
  assert(nut.required.includes('taggedPubkey') && nut.required.includes('tagEventId'),
    'required must keep taggedPubkey and tagEventId (legacy e-only assertions still validate) — AC-5');
  assert(!nut.required.includes('tagAddress'),
    'tagAddress must NOT be in required (it is optional, so old e-only events still pass) — AC-5');
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- nostr-user-tag hybrid e+a writer (epic tag-stack-merge-hardening, Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nnostr-user-tag-hybrid-ea-writer: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
