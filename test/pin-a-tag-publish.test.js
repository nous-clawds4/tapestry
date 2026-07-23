/**
 * Integration tests for Story 10 (Pin a tag): live publish flow.
 * ADR: engineering-team/decisions/0009-pin-a-tag.md
 *
 * Exercises the parts of the spec that the contract-only suite cannot:
 *   - Publishing a kind-39999 `tag-pinning` event populates `viewerPin` on
 *     /api/profile-tags/by-id?...&viewerPubkey=<viewer>.
 *   - Default curation-method JSON is carried in both the curation-method
 *     event-tag and the content body.
 *   - `/api/profile-tags/pins` returns the published pin, joined to live
 *     tag metadata, sorted by createdAt desc.
 *   - Publishing a kind-5 deletion targeting the pin event id clears
 *     `viewerPin` back to null AND removes the row from /pins.
 *   - `/pins` filters out pin events whose referenced tag event no longer
 *     exists (dangling pins).
 *
 * Approach: ephemeral keypairs via `nak`, signed events POSTed to
 * `/api/strfry/publish` with `signAs: "client"`. Mirrors the existing
 * test/profile-tags-publish.test.js + test/tag-detail-write-publish.test.js
 * harnesses. Skips when `nak` is missing or the control panel is unreachable.
 */

const { execSync, execFileSync } = require('child_process');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const PROPAGATION_MS = 600;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function nakAvailable() {
  try { execSync('command -v nak', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

function nakKeyGen() { return execSync('nak key generate').toString().trim(); }
function nakDerivePubkey(privkey) { return execSync(`nak key public ${privkey}`).toString().trim(); }
function nakSignEvent({ kind, tags = [], content = '', privkey }) {
  // Use execFileSync (argv) rather than execSync (shell) because Pin events
  // carry a `curation-method` event-tag whose value is JSON. Passing JSON
  // through bash triggers brace-expansion on `{a,b,c}` substrings, which
  // splits the tag value into multiple positional args; argv-style invocation
  // avoids the shell entirely.
  const args = ['event', '-k', String(kind)];
  for (const t of tags) {
    args.push('--tag', `${t[0]}=${t.slice(1).join('=')}`);
  }
  args.push('--sec', privkey, '-c', content);
  return JSON.parse(execFileSync('nak', args).toString().trim());
}

async function publish(signedEvent) {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/strfry/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: signedEvent, signAs: 'client' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) {
    throw new Error(`publish failed: status=${r.status} body=${JSON.stringify(j)}`);
  }
  return j.event;
}

async function fetchJson(url) {
  const r = await fetch(url);
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

let ctx = null;

/** Build, sign, and publish a tag event (kind-39999 with z=tag handle). */
async function publishTag({ slug, name, description, authorSk, tagHandle }) {
  const ev = nakSignEvent({
    kind: 39999,
    tags: [['d', slug], ['z', tagHandle]],
    content: JSON.stringify({ tag: { slug, name, description: description || '' } }),
    privkey: authorSk,
  });
  return await publish(ev);
}

/**
 * Build, sign, and publish a kind-39999 `tag-pinning` Pin event under the
 * shape ADR 0009 fixes:
 *   d = `tag-pin-${tagSlug}-${tagAuthor8}-${viewer8}`
 *   e = tagEventId
 *   a = `39999:${tagAuthorPubkey}:${tagSlug}`
 *   z = `39998:${TA}:tag-pinning`
 *   curation-method = JSON-stringified default object
 *   content = JSON-stringified { tagPinning: { tagEventId, curationMethod } }
 */
function buildPinEvent({ tag, viewerSk, viewerPk, tagPinningHandle, curationMethod }) {
  const dTag = `tag-pin-${tag.slug}-${tag.authorPubkey.slice(0, 8)}-${viewerPk.slice(0, 8)}`;
  const tags = [
    ['d', dTag],
    ['e', tag.eventId],
    ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
    ['z', tagPinningHandle],
    ['curation-method', JSON.stringify(curationMethod)],
  ];
  const content = JSON.stringify({ tagPinning: { tagEventId: tag.eventId, curationMethod } });
  return nakSignEvent({ kind: 39999, tags, content, privkey: viewerSk });
}

async function setupSuite() {
  // ADR 0015 (named exception): the z-tag composition for the `tag` and
  // `tag-pinning` concept handles is intentionally bound to the LEGACY literal
  // pubkey — the server reads pins via TAG_PINNING_Z_TAG built from
  // LEGACY_Z_TAG_PUBKEY (src/api/profile-tags/index.js:49,61), and the UI
  // publishes the same way (ui/src/utils/publishTagPin.js LEGACY_TA_PUBKEY).
  // This suite previously derived the handles from /api/assistant/pubkey (the
  // runtime TA), which matched only by coincidence on the original dev
  // container (same key); a container rebuild mints a new TA and the pins
  // vanish from the read path. Compose with the literal, as the ADR ratifies.
  const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
  const tagHandle = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`;
  const tagPinningHandle = `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`;

  const slugBase = `s10-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `pin-tag-${slugBase}`;
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const publishedTag = await publishTag({
    slug: tagSlug,
    name: `Pin Tag ${slugBase}`,
    description: `Test tag for Story 10 — ${slugBase}`,
    authorSk: tagAuthorSk,
    tagHandle,
  });

  // A SECOND tag, also pinned later, for sort-by-createdAt-desc + multi-row
  // /pins behavior.
  const tagSlug2 = `pin-tag2-${slugBase}`;
  const publishedTag2 = await publishTag({
    slug: tagSlug2,
    name: `Pin Tag Two ${slugBase}`,
    description: `Second test tag — ${slugBase}`,
    authorSk: tagAuthorSk,
    tagHandle,
  });

  // A THIRD tag, used only for the "dangling pin" case — we publish a Pin
  // for it but the tag event will be referenced by id only; we will then
  // delete the tag event (via kind-5) so the /pins endpoint must filter
  // out the dangling pin.
  const tagSlug3 = `pin-tag3-${slugBase}`;
  const publishedTag3 = await publishTag({
    slug: tagSlug3,
    name: `Pin Tag Three ${slugBase}`,
    description: `Dangling tag — ${slugBase}`,
    authorSk: tagAuthorSk,
    tagHandle,
  });

  // The viewer who will pin.
  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);

  await sleep(PROPAGATION_MS);

  const tag = {
    eventId: publishedTag.id,
    slug: tagSlug,
    authorPubkey: publishedTag.pubkey,
  };
  const tag2 = {
    eventId: publishedTag2.id,
    slug: tagSlug2,
    authorPubkey: publishedTag2.pubkey,
  };
  const tag3 = {
    eventId: publishedTag3.id,
    slug: tagSlug3,
    authorPubkey: publishedTag3.pubkey,
  };

  ctx = {
    tagHandle, tagPinningHandle,
    tagAuthorSk, tagAuthorPk,
    tag, tag2, tag3,
    viewerSk, viewerPk,
    slugBase,
  };
}

/* ─── by-id viewerPin ─── */

t('by-id with viewerPubkey returns viewerPin: null when no pin exists', async () => {
  const { tag, viewerPk } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${tag.eventId}&viewerPubkey=${viewerPk}`
  );
  assert(status === 200, `by-id status — got ${status}`);
  assert(json && json.success === true, `by-id success must be true; got ${JSON.stringify(json)}`);
  assert('viewerPin' in json,
    `by-id response must carry viewerPin field when viewerPubkey is provided; got ${JSON.stringify(json)}`);
  assert(json.viewerPin === null,
    `viewerPin must be null when no pin event exists; got ${JSON.stringify(json.viewerPin)}`);
});

t('by-id with viewerPubkey returns viewerPin object after publishing a pin event for this viewer', async () => {
  const { tag, viewerSk, viewerPk, tagPinningHandle } = ctx;
  const curation = {
    observer: viewerPk,
    method: 'nip85:rank',
    cutoff: 2,
    includeScoreInTL: false,
  };
  const pinEvent = buildPinEvent({ tag, viewerSk, viewerPk, tagPinningHandle, curationMethod: curation });
  const publishedPin = await publish(pinEvent);
  await sleep(PROPAGATION_MS);

  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${tag.eventId}&viewerPubkey=${viewerPk}`
  );
  assert(status === 200, `by-id status — got ${status}`);
  const vp = json && json.viewerPin;
  assert(vp && typeof vp === 'object' && !Array.isArray(vp),
    `viewerPin must be a non-null object after publishing a Pin; got ${JSON.stringify(vp)}`);
  assert(vp.pinEventId === publishedPin.id,
    `viewerPin.pinEventId must equal the published pin event id; got ${JSON.stringify(vp.pinEventId)}`);
  assert(typeof vp.createdAt === 'number',
    `viewerPin.createdAt must be a number; got ${JSON.stringify(vp.createdAt)}`);
  assert(vp.curationMethod && typeof vp.curationMethod === 'object',
    `viewerPin.curationMethod must be an object; got ${JSON.stringify(vp.curationMethod)}`);
});

t('Pin event publishes default curation-method tag with observer=viewer, method=nip85:rank, cutoff=2, includeScoreInTL=false', async () => {
  const { tag2, viewerSk, viewerPk, tagPinningHandle } = ctx;
  const curation = {
    observer: viewerPk,
    method: 'nip85:rank',
    cutoff: 2,
    includeScoreInTL: false,
  };
  const pinEvent = buildPinEvent({ tag: tag2, viewerSk, viewerPk, tagPinningHandle, curationMethod: curation });
  await publish(pinEvent);
  await sleep(PROPAGATION_MS);

  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${tag2.eventId}&viewerPubkey=${viewerPk}`
  );
  const cm = json && json.viewerPin && json.viewerPin.curationMethod;
  assert(cm, `viewerPin.curationMethod must be present; got ${JSON.stringify(json?.viewerPin)}`);
  assert(cm.observer === viewerPk, `curationMethod.observer must be the viewer pubkey; got ${JSON.stringify(cm.observer)}`);
  assert(cm.method === 'nip85:rank', `curationMethod.method must be 'nip85:rank'; got ${JSON.stringify(cm.method)}`);
  assert(cm.cutoff === 2, `curationMethod.cutoff must be 2; got ${JSON.stringify(cm.cutoff)}`);
  assert(cm.includeScoreInTL === false, `curationMethod.includeScoreInTL must be false; got ${JSON.stringify(cm.includeScoreInTL)}`);
});

/* ─── /api/profile-tags/pins (live) ─── */

t('/api/profile-tags/pins joins pinned tag event ids to live tag metadata and returns rows sorted by createdAt desc', async () => {
  const { tag, tag2, viewerPk, slugBase } = ctx;
  // Both pins were published in prior tests. Their createdAt order is
  // (tag pin first) → (tag2 pin second). Expect desc → tag2 before tag.
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  assert(status === 200, `pins status — got ${status}`);
  assert(json && Array.isArray(json.pins),
    `pins response.pins must be an array; got ${JSON.stringify(json)}`);
  const pks = json.pins.map((p) => p && p.tag && p.tag.eventId);
  assert(pks.includes(tag.eventId),
    `pins must contain the first published pin (tag ${tag.slug}); got ${JSON.stringify(pks)}`);
  assert(pks.includes(tag2.eventId),
    `pins must contain the second published pin (tag ${tag2.slug}); got ${JSON.stringify(pks)}`);

  const row = json.pins.find((p) => p.tag.eventId === tag.eventId);
  assert(row && row.tag && row.tag.slug === tag.slug,
    `pins row tag.slug must equal published slug; got ${JSON.stringify(row?.tag)}`);
  assert(row.tag.name && row.tag.name.includes(slugBase),
    `pins row tag.name must reflect the published tag name; got ${JSON.stringify(row.tag.name)}`);
  assert(typeof row.tag.description === 'string',
    `pins row tag.description must be a string; got ${JSON.stringify(row.tag.description)}`);
  assert(row.pinEventId && /^[0-9a-f]{64}$/.test(row.pinEventId),
    `pins row.pinEventId must be a 64-char hex; got ${JSON.stringify(row.pinEventId)}`);
  assert(typeof row.createdAt === 'number',
    `pins row.createdAt must be a number; got ${JSON.stringify(row.createdAt)}`);
  assert(row.curationMethod && typeof row.curationMethod === 'object',
    `pins row.curationMethod must be an object; got ${JSON.stringify(row.curationMethod)}`);

  // Sort: desc by createdAt. The newer of (tag, tag2) is whichever's pin we
  // published second — tag2.
  const idx1 = json.pins.findIndex((p) => p.tag.eventId === tag.eventId);
  const idx2 = json.pins.findIndex((p) => p.tag.eventId === tag2.eventId);
  assert(idx2 >= 0 && idx1 >= 0 && idx2 < idx1,
    `pins must be sorted by createdAt desc — tag2 (newer pin) must appear before tag; got order ${JSON.stringify(json.pins.map((p) => p.tag.slug))}`);
});

/* ─── Kind-5 deletion / unpin ─── */

t('publishing a kind-5 deletion for the pin event clears by-id viewerPin back to null', async () => {
  const { tag, viewerSk, viewerPk } = ctx;
  // The Pin event for `tag` was published in an earlier test; look it up.
  const before = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${tag.eventId}&viewerPubkey=${viewerPk}`
  );
  const pinEventId = before.json && before.json.viewerPin && before.json.viewerPin.pinEventId;
  assert(pinEventId, `precondition: viewerPin must be set for tag ${tag.slug} before deletion; got ${JSON.stringify(before.json?.viewerPin)}`);

  const del = nakSignEvent({
    kind: 5,
    tags: [['e', pinEventId]],
    content: 'unpinned',
    privkey: viewerSk,
  });
  await publish(del);
  await sleep(PROPAGATION_MS);

  const after = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${tag.eventId}&viewerPubkey=${viewerPk}`
  );
  assert(after.json && after.json.viewerPin === null,
    `after kind-5 deletion, viewerPin must be null; got ${JSON.stringify(after.json?.viewerPin)}`);
});

t('after kind-5 deletion the unpinned tag no longer appears in /api/profile-tags/pins', async () => {
  const { tag, tag2, viewerPk } = ctx;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  // Guard: the test must observe a real response, not the 404 / null path
  // (which would make !pks.includes(...) trivially true).
  assert(status === 200 && json && json.success === true,
    `/pins must return success=true; got status=${status} body=${JSON.stringify(json)}`);
  assert(Array.isArray(json.pins),
    `/pins response.pins must be an array; got ${JSON.stringify(json.pins)}`);

  const pks = json.pins.map((p) => p.tag && p.tag.eventId);
  // tag was unpinned in the prior test → must be absent.
  assert(!pks.includes(tag.eventId),
    `/pins must not contain the unpinned tag after kind-5 deletion; got ${JSON.stringify(pks)}`);
  // tag2 is still pinned → must still be present (sanity: confirms the
  // endpoint is actually returning real data, not just []).
  assert(pks.includes(tag2.eventId),
    `/pins must still contain tag2 (still pinned); got ${JSON.stringify(pks)}`);
});

/* ─── Dangling pin filter ─── */

t('/api/profile-tags/pins filters out pin events whose referenced tag event no longer exists', async () => {
  const { tag3, tagAuthorSk, viewerSk, viewerPk, tagPinningHandle } = ctx;
  // First pin the dangling-tag candidate.
  const curation = { observer: viewerPk, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false };
  const pinEvent = buildPinEvent({ tag: tag3, viewerSk, viewerPk, tagPinningHandle, curationMethod: curation });
  await publish(pinEvent);
  await sleep(PROPAGATION_MS);

  // Sanity: the pin appears.
  const beforeList = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  const before = (beforeList.json && beforeList.json.pins || []).map((p) => p.tag && p.tag.eventId);
  assert(before.includes(tag3.eventId),
    `precondition: tag3 pin must appear in /pins before deleting the tag event; got ${JSON.stringify(before)}`);

  // Delete the tag event itself (via kind-5 from its author).
  const deleteTag = nakSignEvent({
    kind: 5,
    tags: [['e', tag3.eventId]],
    content: 'revoke tag',
    privkey: tagAuthorSk,
  });
  await publish(deleteTag);
  await sleep(PROPAGATION_MS);

  // Now /pins should filter out the dangling pin row.
  const afterList = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  const after = (afterList.json && afterList.json.pins || []).map((p) => p.tag && p.tag.eventId);
  assert(!after.includes(tag3.eventId),
    `/pins must filter out dangling pins (referenced tag deleted); got ${JSON.stringify(after)}`);
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- pin-a-tag publish-flow tests (Story 10) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: tests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: tests.length };
  }

  try {
    await setupSuite();
  } catch (err) {
    console.log(`  FAIL  suite setup: ${err.message}`);
    return { pass: 0, fail: 1, skipped: 0 };
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
  console.log(`\npin-a-tag-publish: ${pass} passed, ${fail} failed`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
