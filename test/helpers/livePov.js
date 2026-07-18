'use strict';
/**
 * Shared plumbing for the live publish-flow suites on POV-filtered stacks.
 *
 * Since pov-selectable-tag-surfaces (ADR 0006), the tag read paths drop
 * assertions whose author lacks `wot_rank_<povSuffix> >= minRank` in the Meili
 * profiles index. The publish suites were written against unfiltered dev stacks
 * and signed with per-run ephemeral keys — unrankable, so on a stack with
 * house-POV scores every read-back is legitimately empty and the suites fail
 * for environmental reasons, not code defects (observed 2026-07-18; see
 * OPEN.md — local live-suite baseline).
 *
 * The repair: assertion authors come from a FIXED POOL of dev-only keypairs
 * whose ranked Meili docs are provisioned once and persist. Suite setup calls
 * `ensureRankedPool()` — a fast no-op when the docs are present; when they are
 * missing (e.g. a search-index rebuild rewrote the profiles index) it re-upserts
 * them and waits, bounded, for Meili to index. Under heavy stream-consumer ETL
 * load the Meili task queue has been observed taking 5–8 MINUTES per task, so
 * on timeout the caller should SKIP its POV-dependent tests with the returned
 * reason rather than fail — the established live-suite convention (cf. "nak not
 * on PATH", "settings.json not writable").
 *
 * The pool keys are dev-only test identities, deliberately committed (same
 * class as SMOKE_TEST.md's known test pubkey). They must never be used for
 * anything but local/live test publishing.
 */

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const MEILI_BASE = process.env.MEILI_URL_HOST || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

// Fixed dev-only author pool. Provisioned 2026-07-18 with ranked Meili docs
// (name/display_name "BrainstormLiveSuiteAuthor<n>", a picture URL, and the
// active POV's wot_rank field). ensureRankedPool() re-provisions if absent.
const AUTHOR_POOL = [
  { sk: 'b4946db6fdd5d5ab251c814be4be57a051316c383cb14b6f478563efa10e0264', pk: '9c416f3a06b4ac849655955d0bb97029533c8d1bef0a7ec0020f443071c058f8' },
  { sk: '355a6396233fbb81ec254f4138264a48eede2d31708ae91764d9fe5820ba2aff', pk: '0d7265f0b1e72d6e7e59756f8bdb7d8e7e5a554cfda653ffe2abc8fde5c2d8ca' },
  { sk: '2f23bdb7d27dbe50731443e0899aef7e0b7e7e96159a5ab393ec873dbe7c9acb', pk: 'cb19732506df8b75d0d0ba7ccc2e5e9bef7695b7a5815eeaeb5b4b85a049528b' },
  { sk: '5296581854070abd5bcbb0e76192c28a15b9bbed36901a2579cefa3282cb200c', pk: 'ec4d577fa7d3778dc35a724c2f1a176e191f47e857ef266c909c4a33417b767f' },
  { sk: '9b4d5bfa87fc2263a34ac96b41e346f7ab5419122f23f902293cb8f271c3dcf2', pk: 'fd441931713966d11582035afa374c21d61a60f310f927bcddf1a6d0e3a0d45c' },
  { sk: '4ea12e829e11ec6ccdde29f93c90d2559310f59d9a70eb820ac57cb5d1292122', pk: 'f3fffc16a16270e7ddcdae50c8306e4e36028da231879cba99165042095d8b60' },
  { sk: '0d6ee2111a9febe7a8a103f4b18cce30a2a8b94c8f245c75187fbd92f5f23c7a', pk: '09cca19788495c450f856265b3e2a8f4fa1e0c9e89b6d08628bbffc289a2f667' },
  { sk: 'cccbc9c2c404f8d9022dd068378102d126cc4268e95584ecb5cde2b4b8fc722c', pk: '1235c15715846669ed75f7b5dab6d01b0ac8776feb63d759f9fc371412b45238' },
];

/** Active POV filter as the API resolves it. Any well-formed pubkey works. */
async function fetchPovFilter() {
  const probe = `${'0'.repeat(63)}1`;
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${probe}`);
  const json = await r.json().catch(() => null);
  if (!r.ok || !json || json.success !== true) {
    throw new Error(`fetchPovFilter: tags-for-profile probe failed (status ${r.status})`);
  }
  const minRank = Number(json.minRank);
  return {
    povSuffix: json.povSuffix || null,
    minRank: Number.isFinite(minRank) ? minRank : null,
  };
}

/** The indexed Meili doc for a pubkey, or null. Reflects indexed state only. */
async function meiliGetDoc(pk) {
  try {
    const r = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents/${pk}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Poll a Meili task until it settles or the budget runs out. */
async function meiliWaitForTask(taskUid, { timeoutMs = 90000, pollMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${MEILI_BASE}/tasks/${taskUid}`);
    if (r.ok) {
      const t = await r.json();
      if (t.status === 'succeeded') return { ok: true };
      if (t.status === 'failed' || t.status === 'canceled') {
        return { ok: false, reason: `Meili task ${taskUid} ${t.status}` };
      }
    }
    await new Promise((res) => setTimeout(res, pollMs));
  }
  return { ok: false, reason: `Meili task ${taskUid} not indexed within ${timeoutMs / 1000}s (task queue busy — re-run when the stream-consumer ETL settles)` };
}

/**
 * Upsert docs into the profiles index and wait (bounded) for indexing.
 * PUT = add-or-PARTIAL-UPDATE. Deliberate: POST replaces documents wholesale,
 * so a test writing a bare {id, name} doc for a pool pubkey would silently
 * strip its wot_rank_* fields and break every later POV-filtered suite.
 */
async function meiliUpsertAndWait(docs, opts = {}) {
  const list = Array.isArray(docs) ? docs : [docs];
  const r = await fetch(`${MEILI_BASE}/indexes/${MEILI_INDEX}/documents`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  });
  if (!r.ok) return { ok: false, reason: `Meili upsert failed: ${r.status} ${await r.text()}` };
  const { taskUid } = await r.json();
  return meiliWaitForTask(taskUid, opts);
}

/**
 * Verify (and if needed provision) the pool authors' ranked docs for the
 * ACTIVE POV. Fast path: all docs present → no writes, returns in ~1s.
 * Returns { ok, filtered, reason? }. On ok:false the caller should SKIP its
 * POV-dependent tests with `reason`.
 */
async function ensureRankedPool(opts = {}) {
  const { povSuffix, minRank } = await fetchPovFilter();
  if (!povSuffix || minRank === null) return { ok: true, filtered: false };
  const field = `wot_rank_${povSuffix}`;
  const missing = [];
  for (const a of AUTHOR_POOL) {
    const doc = await meiliGetDoc(a.pk);
    if (!doc || typeof doc[field] !== 'number' || doc[field] < minRank) missing.push(a);
  }
  if (missing.length === 0) return { ok: true, filtered: true };
  const docs = missing.map((a, i) => ({
    id: a.pk,
    pubkey: a.pk,
    name: `BrainstormLiveSuiteAuthor${AUTHOR_POOL.indexOf(a) + 1}`,
    display_name: `BrainstormLiveSuiteAuthor${AUTHOR_POOL.indexOf(a) + 1}`,
    picture: `https://example.com/live-suite-author-${AUTHOR_POOL.indexOf(a) + 1}.png`,
    [field]: minRank,
  }));
  const res = await meiliUpsertAndWait(docs, opts);
  if (!res.ok) {
    return { ok: false, filtered: true, reason: `pool author rank docs not indexed: ${res.reason}` };
  }
  return { ok: true, filtered: true };
}

/** Sequential dealer over the pool — distinct ranked identities per call. */
function makeAuthorDealer() {
  let i = 0;
  return {
    take() {
      if (i >= AUTHOR_POOL.length) {
        throw new Error(`author pool exhausted (${AUTHOR_POOL.length} identities) — grow AUTHOR_POOL`);
      }
      return AUTHOR_POOL[i++];
    },
  };
}

module.exports = {
  CONTROL_PANEL_BASE,
  MEILI_BASE,
  MEILI_INDEX,
  AUTHOR_POOL,
  fetchPovFilter,
  meiliGetDoc,
  meiliWaitForTask,
  meiliUpsertAndWait,
  ensureRankedPool,
  makeAuthorDealer,
};
