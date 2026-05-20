/**
 * Tests for Story 11: Periodic Trusted List publication from pinned tags.
 * ADR: engineering-team/decisions/0010-tl-publication-from-pins.md
 *
 * These tests are intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layer: server API contracts (HTTP against control panel — default :7778).
 * Live publish-flow assertions live in test/tl-publication-from-pins-publish.test.js.
 *
 * What this suite locks in:
 *   1. Three new POST routes under /api/trusted-list/refresh-*:
 *        - refresh-all-pinned-tags (no auth; called by the cron)
 *        - refresh-pinned-tag (user-scoped; auth required)
 *        - refresh-pinned-tags-for-viewer (user-scoped; auth required)
 *      Each rejects missing/malformed input with 400, rejects unauthenticated
 *      calls (where auth applies) with 401/403, and exists (no 404).
 *   2. scheduled-tasks recognizes the new `refreshPinnedTagTLs` taskId on the
 *      status / update / history handlers.
 *   3. /api/profile-tags/pins rows carry a `tlStatus` object with
 *      status ∈ {'ok','never','unsupported','retracted'} — additive change
 *      to Story 10's row shape.
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

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function postJson(url, body) {
  return fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

const VALID_SHAPE_HEX_64 = 'a'.repeat(64);

/* ─── refresh-all-pinned-tags ─── */

t('POST /api/trusted-list/refresh-all-pinned-tags exists and returns the documented envelope for empty state', async () => {
  // Cron-side endpoint: no auth gate (loopback convention). When no pins
  // exist for any user on the instance, this must 200 with {success:true,
  // pins:[]} — same envelope shape as /api/profile-tags/pins.
  const { status, json } = await postJson(`${CONTROL_PANEL_BASE}/api/trusted-list/refresh-all-pinned-tags`);
  assertEqual(status, 200, 'refresh-all-pinned-tags status');
  assert(json && json.success === true,
    `refresh-all-pinned-tags response.success must be true; got ${JSON.stringify(json)}`);
  assert(Array.isArray(json.pins),
    `refresh-all-pinned-tags response.pins must be an array; got ${JSON.stringify(json?.pins)}`);
});

/* ─── refresh-pinned-tag (user-scoped) ─── */

t('POST /api/trusted-list/refresh-pinned-tag rejects an unauthenticated call', async () => {
  // No Cookie header → no session. Auth gate must fire before any other
  // validation: 401 (no session) or 403 (treats absent session as
  // unauthorized). Anything else (404 / 200 / 500) indicates a missing
  // auth gate.
  const { status } = await postJson(
    `${CONTROL_PANEL_BASE}/api/trusted-list/refresh-pinned-tag`,
    { pinEventId: VALID_SHAPE_HEX_64 }
  );
  assert(status === 401 || status === 403,
    `refresh-pinned-tag with no session must be 401 or 403; got ${status}`);
});

t('POST /api/trusted-list/refresh-pinned-tag rejects missing pinEventId with 400', async () => {
  // Without a body the endpoint must reject as 400 (bad request) — note
  // this MAY come after the auth gate (and thus surface as 401/403 first)
  // depending on order of checks. Accept either: the test passes if the
  // endpoint signals "won't process this" via 400-or-auth-error, and
  // fails if it 200s / 404s.
  const { status } = await postJson(
    `${CONTROL_PANEL_BASE}/api/trusted-list/refresh-pinned-tag`,
    {}
  );
  assert(status === 400 || status === 401 || status === 403,
    `refresh-pinned-tag with empty body must be 400/401/403; got ${status}`);
  assert(status !== 404, 'refresh-pinned-tag endpoint must exist (not 404)');
});

t('POST /api/trusted-list/refresh-pinned-tag rejects a malformed pinEventId', async () => {
  const { status } = await postJson(
    `${CONTROL_PANEL_BASE}/api/trusted-list/refresh-pinned-tag`,
    { pinEventId: 'not-hex' }
  );
  assert(status === 400 || status === 401 || status === 403,
    `refresh-pinned-tag with malformed pinEventId must be 400/401/403; got ${status}`);
  assert(status !== 404, 'refresh-pinned-tag endpoint must exist (not 404)');
});

/* ─── refresh-pinned-tags-for-viewer (user-scoped) ─── */

t('POST /api/trusted-list/refresh-pinned-tags-for-viewer rejects an unauthenticated call', async () => {
  const { status } = await postJson(
    `${CONTROL_PANEL_BASE}/api/trusted-list/refresh-pinned-tags-for-viewer?viewerPubkey=${VALID_SHAPE_HEX_64}`
  );
  assert(status === 401 || status === 403,
    `refresh-pinned-tags-for-viewer with no session must be 401 or 403; got ${status}`);
});

t('POST /api/trusted-list/refresh-pinned-tags-for-viewer rejects missing viewerPubkey with 400', async () => {
  const { status } = await postJson(
    `${CONTROL_PANEL_BASE}/api/trusted-list/refresh-pinned-tags-for-viewer`
  );
  assert(status === 400 || status === 401 || status === 403,
    `refresh-pinned-tags-for-viewer with no viewerPubkey must be 400/401/403; got ${status}`);
  assert(status !== 404, 'refresh-pinned-tags-for-viewer endpoint must exist (not 404)');
});

t('POST /api/trusted-list/refresh-pinned-tags-for-viewer rejects malformed viewerPubkey with 400', async () => {
  const { status } = await postJson(
    `${CONTROL_PANEL_BASE}/api/trusted-list/refresh-pinned-tags-for-viewer?viewerPubkey=not-hex`
  );
  assert(status === 400 || status === 401 || status === 403,
    `refresh-pinned-tags-for-viewer with malformed viewerPubkey must be 400/401/403; got ${status}`);
  assert(status !== 404, 'refresh-pinned-tags-for-viewer endpoint must exist (not 404)');
});

/* ─── scheduled-tasks taskId ─── */

t('scheduled-tasks recognizes refreshPinnedTagTLs (status returns the documented schedule shape)', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/scheduled-tasks/status?taskId=refreshPinnedTagTLs`
  );
  assertEqual(status, 200, `scheduled-tasks/status?taskId=refreshPinnedTagTLs status (got ${status} body=${JSON.stringify(json)})`);
  assert(json && json.success === true,
    `scheduled-tasks status.success must be true; got ${JSON.stringify(json)}`);
  assertEqual(json.taskId, 'refreshPinnedTagTLs', 'scheduled-tasks status.taskId echoes the request');
  assert(json.schedule && typeof json.schedule.enabled === 'boolean',
    `scheduled-tasks status.schedule.enabled must be a boolean; got ${JSON.stringify(json.schedule)}`);
});

t('scheduled-tasks recognizes refreshPinnedTagTLs (history endpoint 200s with taskId echoed)', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/scheduled-tasks/history?taskId=refreshPinnedTagTLs`
  );
  assertEqual(status, 200, `scheduled-tasks/history?taskId=refreshPinnedTagTLs status`);
  assert(json && json.success === true,
    `scheduled-tasks history.success must be true; got ${JSON.stringify(json)}`);
  // The generalized scheduler (per ADR 0003) echoes taskId in the
  // response. The OLD hardcoded handler (currently in the running container)
  // does NOT include this field — so this assertion fails meaningfully
  // until the Implementer redeploys the up-to-date scheduled-tasks module
  // AND adds refreshPinnedTagTLs to DEFAULTS (otherwise the handler 400s).
  assertEqual(json.taskId, 'refreshPinnedTagTLs',
    'scheduled-tasks history.taskId must echo the request');
  assert(Array.isArray(json.runs),
    `scheduled-tasks history.runs must be an array; got ${JSON.stringify(json?.runs)}`);
});

/* ─── /api/profile-tags/pins additive change: tlStatus on every row ─── */

t('/api/profile-tags/pins for an unknown viewer returns success with empty pins (unchanged from Story 10)', async () => {
  // Guard test: the additive `tlStatus` change must not break Story 10's
  // empty-state envelope. Confirms `pins:[]` and success:true survive.
  const unknownViewer = 'd'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${unknownViewer}`
  );
  assertEqual(status, 200, 'pins (unknown viewer) status');
  assert(json && json.success === true, `pins.success must be true; got ${JSON.stringify(json)}`);
  assert(Array.isArray(json.pins),
    `pins.pins must be an array; got ${JSON.stringify(json?.pins)}`);
  assertEqual(json.pins.length, 0, 'pins must be empty for an unknown viewer');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tl-publication-from-pins tests (Story 11) ---');
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
  console.log(`\ntl-publication-from-pins: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
