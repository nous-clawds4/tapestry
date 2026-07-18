const { test, expect } = require('@playwright/test');

/**
 * deploy-safety-gate Story #3 / ADR 0003 — Scheduled Tasks panel aggregate
 * countdown. Playwright lane: the render/tick behavior the Node suite
 * (test/next-task-countdown.test.js) cannot observe.
 *
 * Every backend surface the settings page touches is route-stubbed so the
 * states are deterministic (the login-failure-and-tag-collapse.spec.js
 * precedent): auth (`/api/auth/*` — the settings page is owner/admin-gated
 * client-side in SettingsIndex), the settings payload, the panel's
 * `/api/scheduled-tasks/*` + `/api/get-customers` fetches, and the line's
 * own `/api/deploy-safety/status` source. No live data dependency beyond a
 * reachable control panel serving the UI bundle.
 *
 * Selection seams (ADR 0003 §Implementation notes): the line's root carries
 * data-testid="next-task-line", data-state="<state>", and — in
 * countdown/starting states — data-entry-id="<entryId>".
 *
 * Run: BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test \
 *        tests/brainstorm/scheduled-tasks-panel-countdown.spec.js --project=chromium
 */

const OWNER_PUBKEY = 'a'.repeat(64);
const JSON_HEADERS = { status: 200, contentType: 'application/json' };
const fulfillJson = (route, body) =>
  route.fulfill({ ...JSON_HEADERS, body: JSON.stringify(body) });

/* ── Fixtures ─────────────────────────────────────────────────────────── */

function makeEntry({ id, taskId, label, enabled, hours = 6 }) {
  return {
    id, taskId, taskName: taskId, label, enabled,
    intervalDays: 0, intervalHours: hours, intervalMinutes: 0, cron: '',
    args: {},
    timer: { active: enabled, nextRunAt: null, lastRunAt: null },
  };
}

// ADR 0001-shaped /api/deploy-safety/status body. `nextFire` here is
// {entryId, taskId, label, at}; inMs/withinBuffer are derived at fulfill time
// like the real endpoint derives them at request time.
function statusPayload({ queue, nextFire = null, enabledEntryCount = 1 }) {
  const q = queue ||
    { enabled: true, stateKnown: true, activeCount: 0, activeTasks: [], schedulerHalted: false };
  let nf = null;
  if (nextFire) {
    const inMs = Date.parse(nextFire.at) - Date.now();
    nf = { ...nextFire, inMs, withinBuffer: inMs <= 600000 };
  }
  return {
    success: true,
    safeToDeploy: !(nf && nf.withinBuffer),
    verdict: 'safe',
    reasons: [],
    checkedAt: new Date().toISOString(),
    bufferMs: 600000,
    queue: q,
    legacy: { inFlightCount: 0 },
    schedule: { enabledEntryCount, nextFire: nf },
  };
}

/**
 * Stub every endpoint the settings page + panel touch. `status` is a
 * FUNCTION evaluated per request, so tests can flip the answer mid-run.
 */
async function stubPanelBackend(page, { entries, status }) {
  await page.route('**/api/auth/status', (r) =>
    fulfillJson(r, { authenticated: true, pubkey: OWNER_PUBKEY }));
  await page.route('**/api/auth/user-classification', (r) =>
    fulfillJson(r, { success: true, classification: 'owner' }));
  await page.route('**/api/profiles**', (r) =>
    fulfillJson(r, { success: true, profiles: {} }));
  await page.route('**/api/settings', (r) =>
    fulfillJson(r, { success: true, settings: {}, defaults: {}, overrides: {} }));
  await page.route('**/api/scheduled-tasks/list', (r) =>
    fulfillJson(r, { success: true, entries }));
  await page.route('**/api/scheduled-tasks/history**', (r) =>
    fulfillJson(r, { success: true, runs: [] }));
  await page.route('**/api/get-customers', (r) =>
    fulfillJson(r, { success: true, customers: [] }));
  await page.route('**/api/grapevine/preferences', (r) =>
    fulfillJson(r, { success: true, preferences: { povPubkey: 'f'.repeat(64) } }));
  await page.route('**/api/deploy-safety/status**', (r) => fulfillJson(r, status()));
}

async function openScheduledTasksPanel(page) {
  await page.goto('/tapestry/settings/relays');
  await page.getByRole('button', { name: /Scheduled Tasks/i }).first().click();
  // The panel is open once its hint renders.
  await expect(page.getByText('Schedule any parameterized task')).toBeVisible({ timeout: 15000 });
}

const line = (page) => page.getByTestId('next-task-line');

test.describe('Scheduled Tasks panel aggregate countdown (deploy-safety-gate #3 / ADR 0003)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  test('AC-1: exactly one aggregate line renders — task name + hours-and-minutes — alongside intact per-entry rows', async ({ page }) => {
    const fireAt = new Date(Date.now() + 90 * 60000).toISOString(); // 1 h 30 m out
    await stubPanelBackend(page, {
      entries: [
        makeEntry({ id: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', enabled: true }),
        makeEntry({ id: 'entry-beta', taskId: 'sweepTask', label: 'Beta Sweep', enabled: true }),
      ],
      // The endpoint sends its bare label; the line must render the panel's
      // display title for entry-alpha ("Alpha Export") via resolveTitle →
      // computeDisplayTitle (ADR 0003 sub-decision 1).
      status: () => statusPayload({
        nextFire: { entryId: 'entry-alpha', taskId: 'exportGraph', label: 'exportGraph', at: fireAt },
        enabledEntryCount: 2,
      }),
    });
    await openScheduledTasksPanel(page);

    // Exactly one aggregate line, in countdown state, naming entry-alpha.
    await expect(line(page)).toBeVisible({ timeout: 10000 });
    await expect(line(page)).toHaveCount(1);
    await expect(line(page)).toHaveAttribute('data-state', /countdown|starting/);
    await expect(line(page)).toHaveAttribute('data-entry-id', 'entry-alpha');

    // The operator's requested form: name + "starts in __ hours and __ minutes".
    await expect(line(page)).toContainText(/Next Scheduled Task/i);
    await expect(line(page)).toContainText('Alpha Export'); // display title, not the bare endpoint label
    await expect(line(page)).toContainText(/starts in/i);
    await expect(line(page)).toContainText(/1 hour and 30 minutes/); // ceil(≈90 min) at minutes granularity

    // The per-entry rows remain present and unchanged alongside the line.
    await expect(page.locator('h3', { hasText: 'Alpha Export' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Beta Sweep' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Scheduled Entry' })).toBeVisible();
  });

  test('AC-3: the countdown ticks down across a minute boundary without a reload', async ({ page }) => {
    // Fire time fixed at FIRST status request: 75 s out. First render shows
    // "2 minutes" (ceiling); ~15 s later the 60 s boundary passes and the
    // line must read "1 minute" — with no navigation in between.
    let fireAt = null;
    await stubPanelBackend(page, {
      entries: [makeEntry({ id: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', enabled: true })],
      status: () => {
        if (!fireAt) fireAt = new Date(Date.now() + 75000).toISOString();
        return statusPayload({
          nextFire: { entryId: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', at: fireAt },
        });
      },
    });
    await openScheduledTasksPanel(page);

    await expect(line(page)).toContainText(/2 minutes/, { timeout: 10000 });
    // The tick (1 s cadence, minute-granularity display) must cross the
    // boundary on its own — no reload() is issued in this test.
    await expect(line(page)).toContainText(/\b1 minute\b/, { timeout: 25000 });
    const text = await line(page).innerText();
    expect(text).not.toMatch(/-\d/); // never negative
  });

  test('AC-3: at the fire moment the line moves on to the then-current state — never a frozen or negative countdown', async ({ page }) => {
    // First answer: a fire ~4 s out. Once that moment passes, every
    // subsequent answer says nothing is upcoming. The line must re-fetch at
    // the zero crossing (or the 10 s poll) and land on none-upcoming.
    let fireAtMs = null;
    await stubPanelBackend(page, {
      entries: [makeEntry({ id: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', enabled: true })],
      status: () => {
        if (!fireAtMs) fireAtMs = Date.now() + 4000;
        if (Date.now() < fireAtMs) {
          return statusPayload({
            nextFire: { entryId: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', at: new Date(fireAtMs).toISOString() },
          });
        }
        return statusPayload({ nextFire: null, enabledEntryCount: 0 });
      },
    });
    await openScheduledTasksPanel(page);

    await expect(line(page)).toBeVisible({ timeout: 10000 });
    await expect(line(page)).toHaveAttribute('data-state', 'none-upcoming', { timeout: 25000 });
    const text = await line(page).innerText();
    expect(text.trim().length).toBeGreaterThan(0); // never blank
    expect(text).not.toMatch(/Alpha Export/);      // never a stale task name
    expect(text).not.toMatch(/-\d/);               // never negative time
  });

  test('AC-2: the line names the endpoint\'s soonest ENABLED entry — a disabled entry never appears — and a toggle is reflected without a reload', async ({ page }) => {
    const betaAt = new Date(Date.now() + 3 * 3600000).toISOString();   // enabled, 3 h out
    const gammaAt = new Date(Date.now() + 20 * 60000).toISOString();   // nominally sooner, but disabled
    const betaFire = { entryId: 'entry-beta', taskId: 'sweepTask', label: 'Beta Sweep', at: betaAt };
    const gammaFire = { entryId: 'entry-gamma', taskId: 'gammaTask', label: 'Gamma Sweep', at: gammaAt };

    // The endpoint's selection (soonest among ENABLED) is beta while gamma is
    // disabled; after the toggle round-trip it becomes gamma.
    let currentFire = betaFire;
    await stubPanelBackend(page, {
      entries: [
        makeEntry({ id: 'entry-gamma', taskId: 'gammaTask', label: 'Gamma Sweep', enabled: false, hours: 1 }),
        makeEntry({ id: 'entry-beta', taskId: 'sweepTask', label: 'Beta Sweep', enabled: true }),
      ],
      status: () => statusPayload({ nextFire: currentFire, enabledEntryCount: 1 }),
    });
    await page.route('**/api/scheduled-tasks/update', (route) => {
      // The enabled set changed server-side: the soonest-among-enabled is now gamma.
      currentFire = gammaFire;
      fulfillJson(route, { success: true, message: 'Updated', timer: { active: true, nextRunAt: gammaAt } });
    });
    await openScheduledTasksPanel(page);

    // Before the toggle: beta is named; the disabled-but-nominally-sooner
    // gamma never appears as "next".
    await expect(line(page)).toBeVisible({ timeout: 10000 });
    await expect(line(page)).toHaveAttribute('data-entry-id', 'entry-beta');
    await expect(line(page)).toContainText('Beta Sweep');
    expect(await line(page).innerText()).not.toMatch(/Gamma Sweep/);

    // Toggle gamma on via its card and save — the ScheduledEntryCard path
    // that bypasses the parent today (ADR 0003 verified fact: parent entries
    // go stale after a card toggle; the onScheduleChanged bump fixes it).
    const gammaCard = page
      .locator('.settings-group', { has: page.locator('h3', { hasText: 'Gamma Sweep' }) })
      .first();
    await gammaCard.getByText('Disabled', { exact: true }).click();
    await gammaCard.getByRole('button', { name: 'Save' }).click();

    // The line comes to reflect the new soonest without a reload — via the
    // onScheduleChanged → scheduleVersion bump (immediate) or, at worst, the
    // 10 s poll backstop (ADR 0003 sub-decision 2 / AC-5 §5 refresh window).
    await expect(line(page)).toHaveAttribute('data-entry-id', 'entry-gamma', { timeout: 15000 });
    await expect(line(page)).toContainText('Gamma Sweep');
  });

  test('AC-4: queue enabled but nothing upcoming — the line says so plainly; no blank, no stale name, no countdown', async ({ page }) => {
    await stubPanelBackend(page, {
      entries: [makeEntry({ id: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', enabled: false })],
      status: () => statusPayload({ nextFire: null, enabledEntryCount: 0 }),
    });
    await openScheduledTasksPanel(page);

    await expect(line(page)).toBeVisible({ timeout: 10000 });
    await expect(line(page)).toHaveAttribute('data-state', 'none-upcoming');
    const text = (await line(page).innerText()).trim();
    expect(text.length).toBeGreaterThan(0);                  // never a blank
    expect(text).toMatch(/no scheduled task|no.*upcoming/i); // states it plainly
    expect(text).not.toMatch(/Alpha Export/);                // never a stale task name
    expect(text).not.toMatch(/starts in/i);                  // never a nonsense countdown
    expect(text).not.toMatch(/scheduling is disabled|switched off/i); // ≠ the queue-disabled copy
  });

  test('AC-4: task-queue layer disabled — stated in plain language, distinguishable from "nothing scheduled"', async ({ page }) => {
    await stubPanelBackend(page, {
      entries: [makeEntry({ id: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', enabled: true })],
      status: () => statusPayload({ queue: { enabled: false }, nextFire: null, enabledEntryCount: 0 }),
    });
    await openScheduledTasksPanel(page);

    await expect(line(page)).toBeVisible({ timeout: 10000 });
    await expect(line(page)).toHaveAttribute('data-state', 'queue-disabled');
    const text = (await line(page).innerText()).trim();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/disabled|switched off/i);            // says scheduling is off…
    expect(text).not.toMatch(/no scheduled task is upcoming/i); // …not "nothing scheduled"
    expect(text).not.toMatch(/starts in/i);                     // no countdown either
  });

  test('AC-5: the line never contradicts the deploy-safety answer — same entryId, time within rounding + Δt of the same fire', async ({ page }) => {
    const fireAt = new Date(Date.now() + 47 * 60000).toISOString();
    await stubPanelBackend(page, {
      entries: [makeEntry({ id: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', enabled: true })],
      status: () => statusPayload({
        nextFire: { entryId: 'entry-alpha', taskId: 'exportGraph', label: 'Alpha Export', at: fireAt },
      }),
    });
    await openScheduledTasksPanel(page);
    await expect(line(page)).toBeVisible({ timeout: 10000 });
    await expect(line(page)).toHaveAttribute('data-state', /countdown|starting/);

    // Observe the status answer through the SAME stubbed pipeline the line
    // consumes (in-page fetch goes through the route), then read the DOM at
    // effectively the same moment.
    const payload = await page.evaluate(() =>
      fetch('/api/deploy-safety/status').then((r) => r.json()));
    const observedAt = Date.now();
    const displayed = await line(page).innerText();
    const entryId = await line(page).getAttribute('data-entry-id');
    const readAt = Date.now();

    // (a) Same task, by entryId — the ADR's definition of "names the same task".
    expect(payload.schedule.nextFire).toBeTruthy();
    expect(entryId).toBe(payload.schedule.nextFire.entryId);

    // (b) Time remaining consistent with the same fire: within 60 s (ceiling
    // rounding) + Δt between the two observations (ADR 0003 sub-decision 5).
    const m = displayed.match(/(?:(\d+)\s*days?,?\s*)?(?:(\d+)\s*hours?\s*(?:and\s*)?)?(\d+)\s*minutes?/i);
    expect(m, `countdown text must expose hours-and-minutes; got "${displayed}"`).toBeTruthy();
    const displayedMs =
      ((parseInt(m[1] || '0', 10) * 1440) + (parseInt(m[2] || '0', 10) * 60) + parseInt(m[3], 10)) * 60000;
    const deltaT = readAt - observedAt + 5000; // measurement slack
    expect(Math.abs(displayedMs - payload.schedule.nextFire.inMs)).toBeLessThanOrEqual(60000 + deltaT);
  });
});
