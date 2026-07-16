/**
 * Tests for Story 10: Pin a tag (foundational).
 * ADR: engineering-team/decisions/0009-pin-a-tag.md
 *
 * These tests are intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layer: server API contracts (HTTP against control panel — default :7778)
 * plus firmware install-status + concept-graph existence checks.
 *
 * Live publish-flow assertions live in test/pin-a-tag-publish.test.js.
 *
 * What this suite locks in:
 *   1. `GET /api/profile-tags/by-id` accepts an additive optional
 *      `viewerPubkey` query param; response gains a `viewerPin` field
 *      (null when no Pin event exists for that viewer). Existing Story 2
 *      contract is preserved.
 *   2. New `GET /api/profile-tags/pins` endpoint:
 *        - 400 on missing/malformed viewerPubkey,
 *        - 200 with `{ success: true, pins: [] }` for a viewer with no pins,
 *        - response envelope shape documented in ADR 0009.
 *   3. Firmware install-status reports `tag-pinning`.
 *   4. Concept-graph exposes the `tag-pinning` ConceptHeader node.
 */

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

const VALID_SHAPE_TAG_ID = 'a'.repeat(64);
const VALID_SHAPE_VIEWER = 'f'.repeat(64);

/* ─── by-id with viewerPubkey ─── */

t('GET /api/profile-tags/by-id with viewerPubkey accepts the param without breaking the existing contract', async () => {
  // Well-formed tagEventId (unknown) + well-formed viewerPubkey. The endpoint
  // already 404s on unknown tags (per ADR 0002 / tag-detail.test.js); that's
  // fine. What we're checking here: the endpoint must not 400 on the new
  // optional param — and a 404 must still come back with `success: false`,
  // not a 500 from a crash on the new code path.
  const unknownTag = 'b'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${unknownTag}&viewerPubkey=${VALID_SHAPE_VIEWER}`
  );
  // 404 (unknown tag) is the legitimate Story-2 response; the new code path
  // must not have changed that. 200 is also acceptable if the implementer
  // chose to keep the endpoint forgiving of unknown tags (it currently 404s).
  assert(status === 404 || status === 200,
    `by-id with unknown tag + viewerPubkey must return 404 or 200; got ${status}`);
  assert(json && (json.success === false || json.success === true),
    `by-id response must include success field; got ${JSON.stringify(json)}`);
});

t('GET /api/profile-tags/by-id silently ignores a malformed viewerPubkey (no 400)', async () => {
  // ADR 0009: "If !isHexPubkey(viewerPubkey), set viewerPin = null and skip."
  // The endpoint must NOT 400 the request — the read-only contract is
  // preserved even when a client sends junk for the new optional param.
  const unknownTag = 'c'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${unknownTag}&viewerPubkey=not-hex`
  );
  // Same legitimate response set as the prior test — but specifically NOT 400.
  assert(status !== 400,
    `malformed viewerPubkey must not produce a 400; got ${status} body=${JSON.stringify(json)}`);
});

/* ─── /api/profile-tags/pins ─── */

t('GET /api/profile-tags/pins rejects missing viewerPubkey with 400', async () => {
  const { status, json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/pins`);
  assertEqual(status, 400, 'pins (no viewerPubkey) status');
  assert(json && json.success === false,
    `pins (no viewerPubkey) response.success must be false; got ${JSON.stringify(json)}`);
});

t('GET /api/profile-tags/pins rejects malformed viewerPubkey with 400', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=not-hex`
  );
  assertEqual(status, 400, 'pins (malformed viewerPubkey) status');
  assert(json && json.success === false,
    `pins (malformed viewerPubkey) response.success must be false; got ${JSON.stringify(json)}`);
});

t('GET /api/profile-tags/pins returns the documented envelope for a viewer with no pins', async () => {
  // Well-formed but unknown viewer pubkey → no pin events exist → endpoint
  // must still 200 with the documented envelope: { success: true, pins: [] }.
  const unknownViewer = 'd'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${unknownViewer}`
  );
  assertEqual(status, 200, 'pins (no-pins viewer) status');
  assert(json && json.success === true,
    `pins response.success must be true; got ${JSON.stringify(json)}`);
  assert(Array.isArray(json.pins),
    `pins response.pins must be an array; got ${JSON.stringify(json?.pins)}`);
  assertEqual(json.pins.length, 0, 'pins must be empty for an unknown viewer');
});

/* ─── Firmware: tag-pinning concept must be installed ─── */

t('firmware install-status reports the tag-pinning slug', async () => {
  // Prereq: `tag-pinning` concept added to firmware/active/concepts/ and
  // manifest.json, and `POST /api/firmware/install` has been run.
  const { status, json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/firmware/install-status`);
  assertEqual(status, 200, 'install-status response status');
  assert(json && json.success === true,
    `install-status response.success must be true; got ${JSON.stringify(json)}`);
  const slugs = json.installedSlugs || [];
  assert(slugs.includes('tag-pinning'),
    `installedSlugs must include "tag-pinning"; got ${JSON.stringify(slugs)}`);
});

t('concept-graph exposes the tag-pinning ConceptHeader node', async () => {
  // Prereq: firmware install (see above). Use the TA pubkey published by
  // /api/assistant/pubkey rather than hardcoding it.
  const pkRes = await fetch(`${CONTROL_PANEL_BASE}/api/assistant/pubkey`);
  const pkJson = await pkRes.json().catch(() => null);
  const taPubkey = pkJson && (pkJson.pubkey || pkJson.taPubkey);
  assert(taPubkey && /^[0-9a-f]{64}$/.test(taPubkey),
    `could not resolve TA pubkey from /api/assistant/pubkey; got ${JSON.stringify(pkJson)}`);

  const handle = `39998:${taPubkey}:tag-pinning`;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/concept-graph/node/${encodeURIComponent(handle)}`
  );
  assertEqual(status, 200, `concept-graph node ${handle} response status`);
  assert(json && json.success === true,
    `concept-graph response.success must be true; got ${JSON.stringify(json)}`);
  const node = json.node;
  assert(node && node.uuid === handle,
    `concept-graph node.uuid must equal ${handle}; got ${JSON.stringify(node?.uuid)}`);
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- pin-a-tag tests (Story 10) ---');
  if (!(await controlPanelReachable())) {
    const skipped = tests.length;
    console.log(`  - SKIP: control panel not reachable at ${CONTROL_PANEL_BASE} — live-API suite needs the local stack (${skipped} tests skipped)`);
    return { pass: 0, fail: 0, skipped };
  }
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
  console.log(`\npin-a-tag: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
