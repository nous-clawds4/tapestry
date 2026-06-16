/**
 * Tests for Story 1: Tag user profiles.
 * ADR: engineering-team/decisions/0001-profile-tag-architecture.md
 *
 * These tests are intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layers:
 *   - Firmware files (filesystem)
 *   - Server API endpoints (HTTP against control panel — default :7778)
 *   - Concept graph (HTTP against concept-graph API — default :8877)
 *
 * Prereq for the concept-graph layer: firmware reinstall (`POST /api/firmware/install`)
 * must run after the new firmware files exist, so the graph reflects them.
 */

const fs = require('fs');
const path = require('path');

const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const FIRMWARE_DIR = path.resolve(__dirname, '..', 'firmware', 'versions', 'v1.0.0', 'concepts');
const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const CONCEPT_GRAPH_BASE = process.env.CONCEPT_GRAPH_URL || 'http://localhost:8877';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

function jsonTagOf(node) {
  return (node?.tags || []).find((t) => t.type === 'json');
}

function parseSchemaJsonTag(node) {
  const tag = jsonTagOf(node);
  if (!tag) throw new Error('schema node has no `json` tag');
  return JSON.parse(tag.value);
}

const tests = [];

function t(name, fn) { tests.push([name, fn]); }

/* ─── Firmware: nostr-user-tag concept files exist with the right shape ─── */

t('firmware: nostr-user-tag concept directory exists with three required files', () => {
  const dir = path.join(FIRMWARE_DIR, 'nostr-user-tag');
  assert(fs.existsSync(dir), `expected directory ${dir}`);
  for (const f of ['concept-header.json', 'json-schema.json', 'manifest.json']) {
    assert(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
});

t('firmware: nostr-user-tag concept-header has matching slug and oKeys.singular = nostrUserTag', () => {
  const file = path.join(FIRMWARE_DIR, 'nostr-user-tag', 'concept-header.json');
  const ch = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertEqual(ch.word?.slug, 'concept-header-for-the-concept-of-nostr-user-tags',
    'concept-header word.slug');
  assertEqual(ch.conceptHeader?.oSlugs?.singular, 'nostr-user-tag',
    'concept-header oSlugs.singular');
  assertEqual(ch.conceptHeader?.oKeys?.singular, 'nostrUserTag',
    'concept-header oKeys.singular');
});

t('firmware: nostr-user-tag schema requires taggedPubkey and tagEventId, omits polarity', () => {
  const file = path.join(FIRMWARE_DIR, 'nostr-user-tag', 'json-schema.json');
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
  const inner = schema.jsonSchema?.properties?.nostrUserTag;
  assert(inner, 'schema.jsonSchema.properties.nostrUserTag missing');
  assert(Array.isArray(inner.required) && inner.required.includes('taggedPubkey'),
    'taggedPubkey must be required');
  assert(inner.required.includes('tagEventId'), 'tagEventId must be required');
  assert(!('polarity' in (inner.properties || {})),
    'polarity must NOT be in JSON schema (lives on the event-tag array per ADR-0001)');
});

/* ─── Firmware: tag concept enriched with name + description + applicableTo ─── */

t('firmware: tag schema declares name and description properties', () => {
  const file = path.join(FIRMWARE_DIR, 'tag', 'json-schema.json');
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
  const props = schema.jsonSchema?.properties?.tag?.properties;
  assert(props?.name, 'tag.name property missing');
  assert(props?.description, 'tag.description property missing');
});

t('firmware: tag schema retains slug uniqueness constraint', () => {
  const file = path.join(FIRMWARE_DIR, 'tag', 'json-schema.json');
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tagObj = schema.jsonSchema?.properties?.tag;
  assert(Array.isArray(tagObj?.required) && tagObj.required.includes('slug'),
    'tag.slug must remain required');
  const unique = tagObj?.['x-tapestry']?.unique;
  assert(Array.isArray(unique) && unique.includes('slug'),
    'tag.x-tapestry.unique must include slug');
});

/* ─── Server API: /api/profile-tags/* endpoints ─── */

t('GET /api/profile-tags/available-tags returns { success, tags: [] }', async () => {
  const { status, json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/available-tags`);
  assertEqual(status, 200, 'available-tags status');
  assert(json && json.success === true, 'available-tags response.success must be true');
  assert(Array.isArray(json.tags), 'available-tags response.tags must be an array');
});

t('GET /api/profile-tags/tags-for-profile rejects missing pubkey with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile`);
  assertEqual(status, 400, 'tags-for-profile (no pubkey) status');
});

t('GET /api/profile-tags/tags-for-profile rejects malformed pubkey with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=not-hex`);
  assertEqual(status, 400, 'tags-for-profile (bad pubkey) status');
});

t('GET /api/profile-tags/tags-for-profile returns applications and disputes arrays for a valid pubkey', async () => {
  const validPubkey = 'a'.repeat(64);
  const { status, json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${validPubkey}`);
  assertEqual(status, 200, 'tags-for-profile status');
  assert(json && json.success === true, 'tags-for-profile response.success must be true');
  assert(Array.isArray(json.applications), 'response.applications must be an array');
  assert(Array.isArray(json.disputes), 'response.disputes must be an array');
});

t('GET /api/profile-tags/wot-tags returns { success: true } for a valid viewer', async () => {
  const validPubkey = 'a'.repeat(64);
  const { status, json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/wot-tags?viewer=${validPubkey}`);
  assertEqual(status, 200, 'wot-tags status');
  assert(json && json.success === true, 'wot-tags response.success must be true');
});

/* ─── Concept Graph: new firmware reflected after `POST /api/firmware/install` ─── */

t('concept-graph /summaries lists nostr-user-tag', async () => {
  const { status, json } = await fetchJson(`${CONCEPT_GRAPH_BASE}/api/concept-graph/summaries`);
  assertEqual(status, 200, '/summaries status');
  const handles = (json.summaries || []).map((s) => s.handle);
  const handle = `39998:${TA_PUBKEY}:nostr-user-tag`;
  assert(handles.includes(handle),
    `${handle} not in /summaries; firmware reinstall (POST /api/firmware/install) required`);
});

t('concept-graph nostr-user-tag-schema requires taggedPubkey + tagEventId only (no polarity)', async () => {
  const { status, json } = await fetchJson(
    `${CONCEPT_GRAPH_BASE}/api/concept-graph/node/39999:${TA_PUBKEY}:nostr-user-tag-schema`
  );
  assertEqual(status, 200, 'schema node status');
  const parsed = parseSchemaJsonTag(json.node);
  const inner = parsed.jsonSchema?.properties?.nostrUserTag;
  assert(inner, 'graph: jsonSchema.properties.nostrUserTag missing');
  assert(Array.isArray(inner.required) && inner.required.includes('taggedPubkey'),
    'graph schema must require taggedPubkey');
  assert(inner.required.includes('tagEventId'),
    'graph schema must require tagEventId');
  assert(!('polarity' in (inner.properties || {})),
    'graph schema must NOT contain polarity (event-tag-only per ADR-0001)');
});

t('concept-graph tag-schema declares name and description', async () => {
  const { status, json } = await fetchJson(
    `${CONCEPT_GRAPH_BASE}/api/concept-graph/node/39999:${TA_PUBKEY}:tag-schema`
  );
  assertEqual(status, 200, 'tag-schema node status');
  const parsed = parseSchemaJsonTag(json.node);
  const props = parsed.jsonSchema?.properties?.tag?.properties;
  assert(props?.name, 'graph: tag.name missing');
  assert(props?.description, 'graph: tag.description missing');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- profile-tags tests (Story 1) ---');
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
  console.log(`\nprofile-tags: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
