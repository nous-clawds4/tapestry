/**
 * Tests for deploy-safety-gate Story 3 — Scheduled Tasks panel aggregate countdown.
 *
 * Story: engineering-team/stories/deploy-safety-gate/3-scheduled-tasks-panel-countdown.md
 * ADR:   engineering-team/decisions/deploy-safety-gate/0003-panel-countdown-from-deploy-safety-status.md
 *
 * Three classes, all stack-free:
 *   U — unit tests on the pure helpers in ui/src/utils/nextTaskCountdown.js
 *       (dynamic-imported plain ESM; the povNoticeText precedent — the node
 *       harness cannot parse JSX, so the formatting/state logic lives in a
 *       plain .js util).
 *   S — structural sentinels on ui/src/pages/settings/RelaySettings.jsx
 *       pinning only what ADR 0003 names: the NextScheduledTaskLine component,
 *       its placement between the hint and the Add button, its data source
 *       (/api/deploy-safety/status), the 1 s tick + 10 s poll + schedule-bump
 *       refresh wiring, the resolveTitle→computeDisplayTitle naming, and the
 *       data-testid/data-state Playwright seams.
 *   R — regression guards that PASS pre AND post implementation: the per-entry
 *       rows stay untouched (AC-1) and ADR 0001's payload fields the line
 *       consumes stay present server-side (ADR 0003 §Consequences).
 *
 * U-, D- and S-class tests FAIL until the feature exists — the helper module
 * and the component are missing. The observable render/tick behavior is covered by
 * tests/brainstorm/scheduled-tasks-panel-countdown.spec.js (Playwright lane).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.join(__dirname, '..');
const HELPER_REL = 'ui/src/utils/nextTaskCountdown.js';
const RELAY_SETTINGS_REL = 'ui/src/pages/settings/RelaySettings.jsx';
const DEPLOY_SAFETY_API_REL = 'src/api/deploy-safety/index.js';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSafe(rel) {
  try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }
  catch (_e) { return null; }
}

/** Substring window after the first occurrence of `marker` (admin-tools precedent). */
function regionAround(src, marker, before = 0, after = 4000) {
  const idx = src.indexOf(marker);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), idx + after);
}

async function loadHelpers() {
  const abs = path.join(REPO_ROOT, HELPER_REL);
  let mod;
  try {
    mod = await import(pathToFileURL(abs).href);
  } catch (e) {
    throw new Error(
      `${HELPER_REL} does not exist (or is not importable by node) yet — the pure countdown ` +
      `formatting/state helpers (ADR deploy-safety-gate/0003 §Implementation notes) are not ` +
      `implemented. The module must be plain ESM .js — no JSX, no React import. (${e.message})`
    );
  }
  assert(typeof mod.formatTimeToFire === 'function',
    `${HELPER_REL} must export formatTimeToFire(remainingMs) (ADR 0003 sub-decision 3)`);
  assert(typeof mod.deriveNextTaskLine === 'function',
    `${HELPER_REL} must export deriveNextTaskLine(statusJson) (ADR 0003 sub-decision 4)`);
  return mod;
}

/* ─── Payload fixtures — ADR 0001-shaped /api/deploy-safety/status bodies ─── */

const FIRE_B = {
  entryId: 'entry-b',
  taskId: 'sweepTask',
  label: 'Beta Sweep',
  at: '2026-07-19T12:00:00.000Z',
  inMs: 5400000,
  withinBuffer: false,
};

function okPayload(nextFire, overrides = {}) {
  return {
    success: true,
    safeToDeploy: true,
    verdict: 'safe',
    reasons: [],
    checkedAt: '2026-07-18T00:00:00.000Z',
    bufferMs: 600000,
    queue: { enabled: true, stateKnown: true, activeCount: 0, activeTasks: [], schedulerHalted: false },
    legacy: { inFlightCount: 0 },
    schedule: { enabledEntryCount: 2, nextFire },
    ...overrides,
  };
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ───────────────────────── U — formatTimeToFire ───────────────────────── */

t('U1 (AC-1): multi-day remaining renders days, hours and minutes in order — hours-and-minutes granularity, no seconds', async () => {
  const { formatTimeToFire } = await loadHelpers();
  // 2 d 3 h 12 m = 3072 minutes exactly.
  const out = formatTimeToFire(3072 * 60000);
  assert(typeof out === 'string' && out.length > 0,
    `formatTimeToFire(2d3h12m) must return a non-empty string; got ${JSON.stringify(out)}`);
  for (const part of ['2 days', '3 hours', '12 minutes']) {
    assert(out.includes(part),
      `formatTimeToFire(2d3h12m) must contain "${part}" (ADR 0003 sub-decision 3: ` +
      `"starts in 2 days, 3 hours and 12 minutes"); got "${out}"`);
  }
  assert(out.indexOf('2 days') < out.indexOf('3 hours') && out.indexOf('3 hours') < out.indexOf('12 minutes'),
    `days must precede hours must precede minutes; got "${out}"`);
});

t('U2 (AC-1): the operator\'s reference band (1–24 h) reads "<h> hour(s) and <m> minutes", singular/plural correct', async () => {
  const { formatTimeToFire } = await loadHelpers();
  const out = formatTimeToFire(65 * 60000); // 1 h 05 m
  assert(/\b1 hour and 5 minutes\b/.test(out),
    `formatTimeToFire(1h05m) must read "1 hour and 5 minutes" (the operator's reference form, ` +
    `story AC-1 / ADR 0003 sub-decision 3); got "${out}"`);
  assert(!/1 hours\b/.test(out), `singular "1 hour", never "1 hours"; got "${out}"`);
  assert(!/day/i.test(out), `under 24 h must not mention days; got "${out}"`);
});

t('U3 (AC-1 edge): exactly one hour remaining names the hour — never an under-an-hour-only or day rendering', async () => {
  const { formatTimeToFire } = await loadHelpers();
  const out = formatTimeToFire(60 * 60000);
  assert(typeof out === 'string' && /\b1 hour\b/.test(out),
    `formatTimeToFire(exactly 1 h) must mention "1 hour" (ceil(3600000/60000)=60 → 1 h 0 m band); got "${JSON.stringify(out)}"`);
  assert(!/1 hours\b/.test(out), `singular "1 hour"; got "${out}"`);
  assert(!/day/i.test(out), `1 h is not a multi-day rendering; got "${out}"`);
});

t('U4 (AC-1 scope note): under an hour drops the "0 hours and" — a bare minutes rendering', async () => {
  const { formatTimeToFire } = await loadHelpers();
  const out = formatTimeToFire(23 * 60000);
  assert(/\b23 minutes\b/.test(out),
    `formatTimeToFire(23m) must read "23 minutes"; got "${JSON.stringify(out)}"`);
  assert(!/hour/i.test(out),
    `under an hour must not say "0 hours and" (ADR 0003 sub-decision 3: "0 hours and" dropped); got "${out}"`);
  assert(!/day/i.test(out), `no days under an hour; got "${out}"`);
});

t('U5 (AC-3): ceiling rounding — 60 001 ms is "2 minutes", 60 000 ms and 1 ms are "1 minute", "0 minutes" is unreachable', async () => {
  const { formatTimeToFire } = await loadHelpers();
  const twoMin = formatTimeToFire(60001);
  assert(/\b2 minutes\b/.test(twoMin) && !/hour/i.test(twoMin),
    `formatTimeToFire(60001) must ceil to "2 minutes" (ADR 0003 sub-decision 3); got "${JSON.stringify(twoMin)}"`);
  const oneMinExact = formatTimeToFire(60000);
  assert(/\b1 minute\b/.test(oneMinExact) && !/1 minutes\b/.test(oneMinExact),
    `formatTimeToFire(60000) must read singular "1 minute"; got "${JSON.stringify(oneMinExact)}"`);
  for (const ms of [1, 500, 59999]) {
    const out = formatTimeToFire(ms);
    assert(/\b1 minute\b/.test(out) && !/1 minutes\b/.test(out),
      `formatTimeToFire(${ms}) must ceil to singular "1 minute" — never "0 minutes" while time remains; got "${JSON.stringify(out)}"`);
    assert(!/\b0 (minutes?|hours?)\b/.test(out),
      `"0 hours and 0 minutes" must be unreachable (ceiling rounding); got "${out}" for ${ms} ms`);
  }
});

t('U6 (AC-3): zero or negative remaining returns null — the transitional "moves on" seam, never a negative countdown', async () => {
  const { formatTimeToFire } = await loadHelpers();
  assert(formatTimeToFire(0) === null,
    `formatTimeToFire(0) must be null (ADR 0003 sub-decision 3: remainingMs ≤ 0 → null → the component ` +
    `shows transitional copy and re-fetches); got ${JSON.stringify(formatTimeToFire(0))}`);
  assert(formatTimeToFire(-5000) === null,
    `formatTimeToFire(-5000) must be null — the display never counts into negative time (AC-3); ` +
    `got ${JSON.stringify(formatTimeToFire(-5000))}`);
});

t('U7 (AC-1): no rendering at any magnitude mentions seconds — the operator asked for hours and minutes', async () => {
  const { formatTimeToFire } = await loadHelpers();
  for (const ms of [500, 59999, 60000, 23 * 60000, 60 * 60000, 3072 * 60000]) {
    const out = formatTimeToFire(ms);
    assert(out === null || !/second/i.test(out),
      `formatTimeToFire(${ms}) must not mention seconds (story scope note: seconds precision not required); got "${out}"`);
  }
});

/* ───────────────────────── D — deriveNextTaskLine ───────────────────────── */

t('D1 (AC-1/AC-2): a payload with a nextFire derives state "countdown" carrying the endpoint\'s entryId/taskId/label/at verbatim', async () => {
  const { deriveNextTaskLine } = await loadHelpers();
  const line = deriveNextTaskLine(okPayload(FIRE_B));
  assert(line && line.state === 'countdown',
    `deriveNextTaskLine(payload with nextFire) must be state "countdown"; got ${JSON.stringify(line)}`);
  assert(line.entryId === FIRE_B.entryId,
    `the derived line must carry the endpoint's entryId (identity is endpoint-owned, ADR 0003 sub-decision 1); got ${JSON.stringify(line)}`);
  assert(line.taskId === FIRE_B.taskId, `taskId must be carried; got ${JSON.stringify(line)}`);
  assert(line.label === FIRE_B.label, `label must be carried (the resolveTitle fallback); got ${JSON.stringify(line)}`);
  assert(line.at === FIRE_B.at, `the absolute fire time "at" must be carried (the local tick's anchor); got ${JSON.stringify(line)}`);
});

t('D2 (AC-2): the helper consumes the endpoint\'s selection — decoy fields in the payload never override nextFire', async () => {
  const { deriveNextTaskLine } = await loadHelpers();
  // The endpoint already computed min-at over ENABLED entries (computeVerdict).
  // A sooner-looking decoy elsewhere in the payload must not be re-derived from.
  const payload = okPayload(FIRE_B, {
    queue: {
      enabled: true, stateKnown: true, activeCount: 1,
      activeTasks: [{ taskName: 'decoyRunningTask', startedAt: '2026-07-18T00:00:00.000Z' }],
      schedulerHalted: false,
    },
  });
  payload.entries = [{ entryId: 'decoy-sooner', enabled: false, at: '2026-07-18T00:00:01.000Z' }];
  const line = deriveNextTaskLine(payload);
  assert(line && line.state === 'countdown' && line.entryId === 'entry-b',
    `deriveNextTaskLine must carry schedule.nextFire (the verdict's own soonest-among-enabled selection) — ` +
    `never re-derive from other payload fields (that is Option B's structural AC-5 drift, rejected by ADR 0003); ` +
    `got ${JSON.stringify(line)}`);
  assert(line.label !== 'decoyRunningTask' && line.entryId !== 'decoy-sooner',
    `decoy fields must not leak into the derived line; got ${JSON.stringify(line)}`);
});

t('D3 (AC-4): queue enabled + state known + no nextFire derives "none-upcoming" — with no stale task fields', async () => {
  const { deriveNextTaskLine } = await loadHelpers();
  const line = deriveNextTaskLine(okPayload(null, { schedule: { enabledEntryCount: 0, nextFire: null } }));
  assert(line && line.state === 'none-upcoming',
    `queue.enabled && queue.stateKnown && !schedule.nextFire must derive "none-upcoming" (ADR 0003 sub-decision 4); ` +
    `got ${JSON.stringify(line)}`);
  assert(!line.entryId && !line.label,
    `the none-upcoming state must not carry a stale task name (AC-4: "never … a stale task name"); got ${JSON.stringify(line)}`);
});

t('D4 (AC-4): queue.enabled === false derives "queue-disabled" — distinct from nothing-scheduled, and it wins over any stray nextFire', async () => {
  const { deriveNextTaskLine } = await loadHelpers();
  const disabled = deriveNextTaskLine(okPayload(null, {
    queue: { enabled: false },
    schedule: { enabledEntryCount: 0, nextFire: null },
  }));
  assert(disabled && disabled.state === 'queue-disabled',
    `queue.enabled === false must derive "queue-disabled" (the ratified queue-disabled ≠ nothing-scheduled ` +
    `distinction, story product decision 3); got ${JSON.stringify(disabled)}`);
  // A disabled queue will not fire anything — a stray nextFire must not produce a countdown.
  const strayFire = deriveNextTaskLine(okPayload(FIRE_B, { queue: { enabled: false } }));
  assert(strayFire && strayFire.state === 'queue-disabled',
    `queue-disabled must win over a stray nextFire — the panel must never count down toward a fire the ` +
    `disabled queue will not execute (AC-4); got ${JSON.stringify(strayFire)}`);
});

t('D5 (AC-4/AC-5): queue enabled but state UNKNOWN derives "unknown" — never "none-upcoming" when the truth is unavailable', async () => {
  const { deriveNextTaskLine } = await loadHelpers();
  const line = deriveNextTaskLine(okPayload(null, {
    safeToDeploy: false, verdict: 'unsafe', reasons: ['QUEUE_STATE_UNAVAILABLE'],
    queue: { enabled: true, stateKnown: false },
    schedule: { enabledEntryCount: 1, nextFire: null },
  }));
  assert(line && line.state === 'unknown',
    `queue.stateKnown === false must derive "unknown" (ADR 0003 sub-decision 4 — the endpoint's own ` +
    `fail-closed state); got ${JSON.stringify(line)}`);
  assert(line.state !== 'none-upcoming',
    `an unknown queue state must NEVER read as "nothing scheduled" (AC-4's honesty requirement); got ${JSON.stringify(line)}`);
});

t('D6 (loading/malformed): null, undefined, empty and success:false payloads all derive "unknown" — never a countdown, never an empty-state claim', async () => {
  const { deriveNextTaskLine } = await loadHelpers();
  for (const bad of [null, undefined, {}, { success: false, error: 'boom' }, 'not-json-shaped']) {
    const line = deriveNextTaskLine(bad);
    assert(line && line.state === 'unknown',
      `deriveNextTaskLine(${JSON.stringify(bad)}) must derive "unknown" (malformed/absent payload → unknown, ` +
      `ADR 0003 §Implementation notes); got ${JSON.stringify(line)}`);
  }
});

t('D7 (AC-4/AC-5): the countdown, none-upcoming, queue-disabled and unknown states are four pairwise-distinct values', async () => {
  const { deriveNextTaskLine } = await loadHelpers();
  const states = new Set([
    deriveNextTaskLine(okPayload(FIRE_B)).state,
    deriveNextTaskLine(okPayload(null, { schedule: { enabledEntryCount: 0, nextFire: null } })).state,
    deriveNextTaskLine(okPayload(null, { queue: { enabled: false }, schedule: { enabledEntryCount: 0, nextFire: null } })).state,
    deriveNextTaskLine(null).state,
  ]);
  assert(states.size === 4,
    `the four display states must be pairwise distinct (AC-4: the empty states are never conflated; ` +
    `AC-5: they mirror the endpoint's own distinctions); got ${JSON.stringify([...states])}`);
});

/* ───────────── S — structural sentinels on RelaySettings.jsx ───────────── */

t('S1 (AC-1): RelaySettings.jsx declares function NextScheduledTaskLine — the isolated aggregate-line component', () => {
  const src = readSafe(RELAY_SETTINGS_REL);
  assert(src !== null, `${RELAY_SETTINGS_REL} missing at expected path — re-baseline.`);
  assert(/function\s+NextScheduledTaskLine\b/.test(src),
    `${RELAY_SETTINGS_REL} does not declare \`function NextScheduledTaskLine\` (ADR 0003 §Implementation ` +
    `notes: an isolated component so the 1 s tick re-renders one line, not every ScheduledEntryCard). ` +
    `Declare it above ScheduledTasksPanel.`);
});

t('S2 (AC-1): ScheduledTasksPanel renders <NextScheduledTaskLine …> between the hint paragraph and the Add-button block, alongside (not replacing) the rows', () => {
  const src = readSafe(RELAY_SETTINGS_REL);
  assert(src !== null, `${RELAY_SETTINGS_REL} missing — S1 must pass first.`);
  const usageIdx = src.indexOf('<NextScheduledTaskLine');
  assert(usageIdx !== -1,
    `ScheduledTasksPanel never renders <NextScheduledTaskLine …> (story AC-1: exactly one aggregate line ` +
    `alongside the per-entry rows; ADR 0003 sub-decision 6).`);
  const hintIdx = src.indexOf('Schedule any parameterized task');
  const addBtnIdx = src.indexOf('+ Add Scheduled Entry');
  assert(hintIdx !== -1 && addBtnIdx !== -1,
    `panel anchor text changed (hint paragraph / Add button) — re-baseline this sentinel.`);
  assert(hintIdx < usageIdx && usageIdx < addBtnIdx,
    `<NextScheduledTaskLine> must sit between the hint paragraph and the "+ Add Scheduled Entry" block ` +
    `(ADR 0003 sub-decision 6: one line, above the rows it summarizes). Found usage at ${usageIdx}, ` +
    `hint at ${hintIdx}, Add button at ${addBtnIdx}.`);
});

t('S3 (AC-5): NextScheduledTaskLine sources /api/deploy-safety/status — the same schedule answer the merge gate consumes', () => {
  const src = readSafe(RELAY_SETTINGS_REL);
  assert(src !== null, `${RELAY_SETTINGS_REL} missing — S1 must pass first.`);
  const region = regionAround(src, 'function NextScheduledTaskLine');
  assert(region.length > 0, `NextScheduledTaskLine declaration not found — S1 must pass first.`);
  assert(/['"`]\/api\/deploy-safety\/status['"`]/.test(region),
    `NextScheduledTaskLine must fetch GET /api/deploy-safety/status (ADR 0003 Option A / sub-decision 1: ` +
    `schedule.nextFire is the SOLE source of which task is next and when — AC-5 holds structurally because ` +
    `the panel and the merge gate read the same computeVerdict() selection). Fetching /api/scheduled-tasks/list ` +
    `for the aggregate line is rejected Option B.`);
});

t('S4 (AC-3): the component carries the 1 s tick and the 10 s poll, both cleaned up on unmount', () => {
  const src = readSafe(RELAY_SETTINGS_REL);
  assert(src !== null, `${RELAY_SETTINGS_REL} missing — S1 must pass first.`);
  const region = regionAround(src, 'function NextScheduledTaskLine');
  assert(region.length > 0, `NextScheduledTaskLine declaration not found — S1 must pass first.`);
  const setIntervals = (region.match(/setInterval\(/g) || []).length;
  assert(setIntervals >= 2,
    `NextScheduledTaskLine must run TWO intervals — a 1 s tick (recomputing remaining from the cached ` +
    `absolute nextFire.at) and a 10 s poll (the StreamingETLPanel precedent) (ADR 0003 sub-decision 2); ` +
    `found ${setIntervals} setInterval call(s) in the component region.`);
  assert(/\b1000\b|\b1_000\b/.test(region),
    `the 1-second tick cadence (1000 ms) is missing from the component region (ADR 0003 sub-decision 2).`);
  assert(/\b10000\b|\b10_000\b|10\s*\*\s*1000\b/.test(region),
    `the 10-second poll cadence (10000 ms) is missing from the component region (ADR 0003 sub-decision 2).`);
  assert(/clearInterval\(/.test(region),
    `intervals must be cleared on unmount (mirror StreamingETLPanel — panels unmount on tab switch).`);
});

t('S5 (AC-2): schedule-change refresh wiring — scheduleVersion bump in the panel and an onScheduleChanged prop on the cards', () => {
  const src = readSafe(RELAY_SETTINGS_REL);
  assert(src !== null, `${RELAY_SETTINGS_REL} missing — S1 must pass first.`);
  assert(/scheduleVersion/.test(src),
    `RelaySettings.jsx never mentions scheduleVersion (ADR 0003 sub-decision 2: the parent bumps a ` +
    `scheduleVersion counter whenever it refetches /list; the line re-fetches on its change). Without it ` +
    `AC-2's "comes to reflect" waits on the 10 s poll alone — rejected as the sole mechanism.`);
  assert(/onScheduleChanged/.test(src),
    `RelaySettings.jsx never mentions onScheduleChanged (ADR 0003 sub-decision 2: ScheduledEntryCard gains ` +
    `an optional onScheduleChanged prop, called on successful save/toggle, wired to the parent's fetchList — ` +
    `per-entry toggles bypass the parent today, so a toggle would otherwise never reach the line).`);
  const usage = regionAround(src, '<NextScheduledTaskLine', 0, 300);
  assert(/scheduleVersion/.test(usage),
    `the <NextScheduledTaskLine …> usage must receive the scheduleVersion prop (the bump seam); ` +
    `usage region: "${usage.slice(0, 200)}"`);
});

t('S6 (AC-1/AC-5): the line\'s display name goes through resolveTitle → computeDisplayTitle, with the endpoint label as fallback', () => {
  const src = readSafe(RELAY_SETTINGS_REL);
  assert(src !== null, `${RELAY_SETTINGS_REL} missing — S1 must pass first.`);
  assert(/resolveTitle/.test(src),
    `RelaySettings.jsx never mentions resolveTitle (ADR 0003 sub-decision 1: display name = ` +
    `resolveTitle(nextFire.entryId, nextFire.label) — the panel's computeDisplayTitle for the matching ` +
    `entry, else the endpoint's label — so the line and the row beneath it name the task identically).`);
  const usage = regionAround(src, '<NextScheduledTaskLine', 0, 300);
  assert(/resolveTitle/.test(usage),
    `the <NextScheduledTaskLine …> usage must receive the resolveTitle prop; usage region: "${usage.slice(0, 200)}"`);
  // The resolveTitle wiring must reach computeDisplayTitle somewhere near a resolveTitle mention.
  let wired = false;
  let idx = src.indexOf('resolveTitle');
  while (idx !== -1 && !wired) {
    if (src.slice(idx, idx + 500).includes('computeDisplayTitle')) wired = true;
    idx = src.indexOf('resolveTitle', idx + 1);
  }
  assert(wired,
    `resolveTitle must delegate to computeDisplayTitle (ADR 0003 sub-decision 1 — printing the endpoint's ` +
    `bare label next to a row titled "processCustomer — Alice" names one task two ways; rejected sub-alternative).`);
});

t('S7 (AC-1..AC-5 seams): the line\'s root carries data-testid="next-task-line" and a data-state attribute — the Playwright hooks', () => {
  const src = readSafe(RELAY_SETTINGS_REL);
  assert(src !== null, `${RELAY_SETTINGS_REL} missing — S1 must pass first.`);
  const region = regionAround(src, 'function NextScheduledTaskLine');
  assert(/data-testid=["']next-task-line["']/.test(region),
    `NextScheduledTaskLine's root element must carry data-testid="next-task-line" (ADR 0003 §Implementation ` +
    `notes — the seam tests/brainstorm/scheduled-tasks-panel-countdown.spec.js selects on).`);
  assert(/data-state/.test(region),
    `NextScheduledTaskLine's root element must carry data-state="<state>" (the four-state seam) and, in ` +
    `countdown/starting states, data-entry-id="<entryId>" (the AC-5 identity seam).`);
});

t('S8 (harness): the helper module stays plain — no React import, importable by node', () => {
  const src = readSafe(HELPER_REL);
  assert(src !== null,
    `${HELPER_REL} does not exist yet (ADR 0003 §Implementation notes: pure formatting/state helpers live ` +
    `in a plain ESM .js so the node harness can import them — the povNoticeText precedent).`);
  assert(!/from\s+['"]react['"]/.test(src) && !/require\(\s*['"]react['"]\s*\)/.test(src),
    `${HELPER_REL} must not import React (plain module — no JSX, no hooks; ADR 0003 rejected the ` +
    `helpers-inline-in-JSX sub-alternative for exactly this reason).`);
});

/* ───────────── R — regression guards (PASS pre AND post) ───────────── */

t('R1 (AC-1 regression): the per-entry rows remain — ScheduledTasksPanel still fetches /api/scheduled-tasks/list and maps entries to ScheduledEntryCard', () => {
  const src = readSafe(RELAY_SETTINGS_REL);
  assert(src !== null, `${RELAY_SETTINGS_REL} missing — re-baseline.`);
  assert(/['"`]\/api\/scheduled-tasks\/list['"`]/.test(src),
    `R1: ScheduledTasksPanel no longer fetches /api/scheduled-tasks/list — story AC-1 requires the ` +
    `aggregate line ALONGSIDE the existing per-entry rows, which remain present and unchanged.`);
  assert(/<ScheduledEntryCard\b/.test(src),
    `R1: ScheduledTasksPanel no longer renders ScheduledEntryCard — the per-entry rows must remain ` +
    `(story AC-1; ADR 0003 out-of-scope: no changes to the rows beyond the additive onScheduleChanged prop).`);
  assert(/computeDisplayTitle/.test(src),
    `R1: computeDisplayTitle is gone — the rows' display-title derivation (ADR 0021 §Q4) must remain.`);
});

t('R2 (ADR 0001 contract): the deploy-safety endpoint still carries the fields the line consumes — queue.enabled/stateKnown and schedule.nextFire{entryId,taskId,label,at}', () => {
  const src = readSafe(DEPLOY_SAFETY_API_REL);
  assert(src !== null, `${DEPLOY_SAFETY_API_REL} missing — re-baseline.`);
  for (const field of ['nextFire', 'entryId', 'taskId', 'label', 'at', 'stateKnown', 'schedule']) {
    assert(new RegExp('\\b' + field + '\\b').test(src),
      `R2: src/api/deploy-safety/index.js no longer mentions "${field}" — the panel is the SECOND consumer ` +
      `of ADR 0001's payload contract (ADR 0003 §Consequences: renaming these fields now breaks the UI as ` +
      `well as the ops tooling). Story #3 must not touch the backend.`);
  }
  assert(/function\s+computeVerdict\b/.test(src),
    `R2: computeVerdict is gone from the deploy-safety module — the shared selection AC-5 leans on must remain.`);
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- next-task-countdown tests (deploy-safety-gate story #3) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nnext-task-countdown: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { run };
