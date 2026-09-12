const { test, expect } = require('@playwright/test');

/**
 * assistant-profile #1: The setup prompt tells the truth — the browser class.
 *
 * Story: engineering-team/stories/assistant-profile/1-setup-prompt-tells-the-truth.md
 * ADR:   engineering-team/decisions/assistant-profile/0001-one-setup-state-answer-local-first.md
 * Node half: test/assistant-setup-state.test.js (U/S/D/R/H).
 *
 * ── Why this file carries the acceptance criteria ────────────────────────
 * Every AC here is about what a viewer SEES on the dashboard: whether the "Set up my
 * Assistant's profile" prompt appears, for whom, and where its button goes. A source scan
 * can only say a token is in a file, so the ACs are settled here.
 *
 *   B0 — the served origin runs a build that contains the code under test.       [prerequisite]
 *   B1 — a visitor's hard load: no prompt, no assistant item, no pubkeys=null.  [AC1, AC4]
 *   B2 — an Owner whose assistant has a profile never sees the prompt — not even
 *        for an instant while sign-in resolves.                                  [AC1]
 *   B3 — an Admin with no profile: the prompt concerns THEIR assistant, offers no
 *        "Surprise me", and leads to the Tapestry assistant editor.             [AC3, AC4]
 *   B4 — a Customer with no profile: the prompt leads to /settings.              [AC3]
 *   B5 — an Owner with no profile: the prompt (with "Surprise me") leads to the
 *        Tapestry assistant editor.                                              [AC3]
 *   B6 — a signed-in user with no assistant: no prompt, no item, no status call. [AC4]
 *   B7 — the status check fails: no prompt — an error is never "no profile".      [AC1, edge]
 *   B8 — publish, come back: the prompt is gone without a reload.                 [AC5]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked: a catch-all answers emptily, and the routes that matter answer
 * per scenario. The instance TA HAS a kind 0 in the mocked /api/profiles store, exactly as on
 * staging and production when the bug was reproduced (2026-09-11) — so a build that asks about
 * `null` sees nothing and prompts, which is the defect.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true      (the tests/brainstorm/ gate)
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test. From an isolated worktree:
 *   `cd ui && npm run build && npx vite preview --port 4173 --strictPort`, then
 *   BRAINSTORM_BASE_URL=http://localhost:4173. A source-only edit is INVISIBLE to this class;
 *   B0 guards exactly that.
 *
 * These FAIL against the current build: it asks /api/profiles?pubkeys=null on a hard load and
 * shows the prompt to everyone, about the instance TA. B5 and B8 pass on it by coincidence —
 * see the test plan.
 */

// Fixtures, never live keys: the runtime lookups are mocked to return them.
const TA = 'aa'.repeat(32);
const OWNER = 'bb'.repeat(32);
const ADMIN = 'cc'.repeat(32);
const ADMIN_ASSISTANT = 'c1'.repeat(32);
const CUSTOMER = 'dd'.repeat(32);
const CUSTOMER_ASSISTANT = 'd1'.repeat(32);
const GUEST = 'ee'.repeat(32);

const OWNER_USER = { pubkey: OWNER, classification: 'owner', assistantPubkey: TA };
const ADMIN_USER = { pubkey: ADMIN, classification: 'admin', assistantPubkey: ADMIN_ASSISTANT };
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const NO_ASSISTANT_USER = { pubkey: GUEST, classification: 'guest', assistantPubkey: null };

const PROMPT_BUTTON = /Set up my Assistant.s profile/;
const CHECKLIST_ITEM = 'Give your Assistant a profile';
const CHECKLIST_ACTION = /Set up profile/;
const SURPRISE = /Surprise me/;

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Mock every route. `who` is null (a visitor) or { pubkey, classification, assistantPubkey }.
 * `status` is the /api/assistant/status answer about that user's assistant: { hasProfile },
 * 'error' (a 500), or a function returning either. Returns a live log of the calls that matter.
 */
async function mock(page, { who = null, status = { hasProfile: false }, authDelayMs = 0 } = {}) {
  const log = { profiles: [], statusCalls: [] };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Catch-all FIRST: Playwright tries the most recently registered matching route first, so
  // every specific route below overrides this one for its own path. Unmocked endpoints answer
  // `success: false` — the dashboard's panels guard on `success` before reading a payload,
  // whereas a guessed payload of the wrong shape crashes the whole page (the key-status panel
  // reads per-label `derived` counts from a successful answer).
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-setup-prompt.spec.js' })));

  // The dashboard's graph panels (stats, health, recent activity, the concept count), answered
  // emptily in the shape cypher() parses.
  await page.route('**/api/neo4j/query', (r) => r.fulfill(json({ success: true, data: [] })));

  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/status', (r) => r.fulfill(json({ success: true })));

  await page.route('**/api/auth/status', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false }));
  });
  await page.route('**/api/auth/user-classification', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who
      ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
      : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null }));
  });

  // The kind-0 store behind /api/profiles: the instance TA has a profile, as on staging and prod.
  await page.route('**/api/profiles**', (r) => {
    const url = new URL(r.request().url());
    log.profiles.push(url.search);
    const asked = (url.searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const profiles = {};
    for (const pk of asked) profiles[pk] = pk === TA ? { name: 'Tapestry Assistant' } : null;
    return r.fulfill(json({ success: true, profiles }));
  });

  // The one answer every surface shares (ADR 0001).
  await page.route('**/api/assistant/status**', (r) => {
    const customerPubkey = new URL(r.request().url()).searchParams.get('customerPubkey');
    log.statusCalls.push(customerPubkey);
    const current = typeof status === 'function' ? status() : status;
    if (current === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    const assistantPubkey = who && who.pubkey === customerPubkey ? who.assistantPubkey : null;
    return r.fulfill(json({
      success: true,
      hasRelayKey: !!assistantPubkey,
      assistantPubkey,
      hasProfile: !!current.hasProfile,
      profile: current.hasProfile ? { name: 'Fixture Assistant' } : null,
      profileSource: current.hasProfile ? 'local' : null,
      defaults: { name: 'Fixture Assistant', display_name: 'Fixture Assistant', about: '', picture: '', banner: '', website: '', nip05: '', lud16: '' },
      isOwner: customerPubkey === OWNER,
    }));
  });

  return log;
}

/** Hard-load the dashboard and let sign-in and any setup check settle before judging it. */
async function openDashboard(page) {
  await page.goto('/tapestry/');
  await page.locator('.dashboard').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2000);
}

/** Does any JS chunk the origin serves contain `needle`? Follows chunk references one hop at a time. */
async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { found: false, why: 'no built JS is referenced from the app shell — is this a built UI? Run `cd ui && npm run build`.' };
  const seen = new Set();
  while (queue.length && seen.size < 400) {
    const asset = queue.shift();
    if (seen.has(asset)) continue;
    seen.add(asset);
    const res = await request.get(asset);
    if (!res.ok()) continue;
    const js = await res.text();
    if (js.includes(needle)) return { found: true };
    for (const m of js.matchAll(/["'(](\.{0,2}\/?(?:assets\/)?[\w.-]+\.js)["')]/g)) {
      const ref = m[1];
      const resolved = ref.startsWith('assets/') ? `/${ref}` : new URL(ref, new URL(asset, 'http://origin')).pathname;
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  return { found: false, why: `searched ${seen.size} JS chunks` };
}

test.describe('The assistant setup prompt tells the truth (assistant-profile #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served origin runs a build that contains the setup-state check under test', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, 'needs-setup');
    expect(found,
      `the bundle served by ${baseURL} does not contain "needs-setup", the status ADR 0001 names for a definite "no profile" (${why}). ` +
      'Either the bundle predates your edit — a source-only change is INVISIBLE to this class, so run `cd ui && npm run build` — ' +
      'or the check is not implemented, in which case B1–B8 say so directly.').toBe(true);
  });

  /* ───────── B1 — the reproduced bug ───────── */
  test('B1: a visitor\'s hard load shows no assistant prompt and no assistant checklist item, and never asks about pubkeys=null', async ({ page }) => {
    const log = await mock(page, { who: null });
    await openDashboard(page);
    expect(log.profiles.filter((q) => /pubkeys=null\b/.test(q)),
      'AC1: the dashboard asked /api/profiles?pubkeys=null — the hard-load race behind the false prompt (reproduced 2026-09-11 on staging and prod)').toEqual([]);
    await expect(page.getByRole('button', { name: PROMPT_BUTTON }),
      'AC4: a visitor who is not signed in must not be prompted to set up an assistant').toHaveCount(0);
    await expect(page.getByText(CHECKLIST_ITEM), 'AC4: no "Give your Assistant a profile" item for a visitor').toHaveCount(0);
  });

  /* ───────── B2 — a profile that exists is never reported missing ───────── */
  test('B2: an Owner whose assistant has a profile never sees the prompt on a hard load — not even for an instant while sign-in resolves', async ({ page }) => {
    await page.addInitScript(() => {
      window.__sawPrompt = false;
      const look = () => {
        if (!window.__sawPrompt && document.body && /Set up my Assistant.s profile/.test(document.body.innerText || '')) window.__sawPrompt = true;
      };
      new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true });
    });
    const log = await mock(page, { who: OWNER_USER, status: { hasProfile: true }, authDelayMs: 400 });
    await openDashboard(page);
    expect(await page.evaluate(() => window.__sawPrompt),
      'AC1: the "Set up my Assistant\'s profile" prompt appeared during a hard load, for an assistant that HAS a profile ' +
      `(the page asked /api/profiles for ${JSON.stringify(log.profiles)} and /api/assistant/status for ${JSON.stringify(log.statusCalls)})`).toBe(false);
    await expect(page.getByRole('button', { name: CHECKLIST_ACTION }),
      'AC1: the checklist still offers "Set up profile" for an assistant that has one').toHaveCount(0);
    expect(log.statusCalls,
      'AC5: the dashboard must ask /api/assistant/status — the answer every surface shares — about the signed-in Owner').toContain(OWNER);
  });

  /* ───────── B3 — whose assistant? ───────── */
  test('B3: an Admin whose own assistant has no profile is prompted about THEIR assistant, is offered no "Surprise me", and is sent to the Tapestry assistant editor', async ({ page }) => {
    const log = await mock(page, { who: ADMIN_USER, status: { hasProfile: false } });
    await openDashboard(page);
    const prompt = page.getByRole('button', { name: PROMPT_BUTTON });
    await expect(prompt, 'AC3: an Admin whose assistant has no profile must be prompted').toHaveCount(1);
    expect(log.statusCalls,
      'AC4: the check must ask about the Admin\'s own pubkey — their assistant — and never about anyone else').toEqual(expect.arrayContaining([ADMIN]));
    expect(log.statusCalls.filter((pk) => pk !== ADMIN), 'AC4: the dashboard asked about someone other than the signed-in Admin').toEqual([]);
    await expect(page.getByRole('button', { name: SURPRISE }),
      'AC4: "Surprise me" rewrites the INSTANCE TA\'s profile, which is not an Admin\'s assistant — it must not be offered to them').toHaveCount(0);
    await prompt.click();
    await expect(page, 'AC3: the button must lead to where an Admin publishes their own assistant\'s profile').toHaveURL(/\/tapestry\/settings\/assistant$/);
  });

  test('B4: a Customer whose own assistant has no profile is prompted, and the button leads to /settings — the editor a Customer can reach', async ({ page }) => {
    const log = await mock(page, { who: CUSTOMER_USER, status: { hasProfile: false } });
    await openDashboard(page);
    const prompt = page.getByRole('button', { name: PROMPT_BUTTON });
    await expect(prompt, 'AC3: a Customer whose assistant has no profile must be prompted').toHaveCount(1);
    await prompt.click();
    await expect.poll(() => new URL(page.url()).pathname,
      'AC3: the Tapestry settings page is Owner/Admin-only, so a Customer must be sent to /settings').toBe('/settings');
    expect(log.statusCalls, 'AC4: the check must ask about the Customer\'s own pubkey').toContain(CUSTOMER);
  });

  test('B5: an Owner whose assistant has no profile is prompted, is offered "Surprise me", and is sent to the Tapestry assistant editor', async ({ page }) => {
    await mock(page, { who: OWNER_USER, status: { hasProfile: false } });
    await openDashboard(page);
    const prompt = page.getByRole('button', { name: PROMPT_BUTTON });
    await expect(prompt, 'AC3: an Owner whose assistant has no profile must be prompted').toHaveCount(1);
    await expect(page.getByRole('button', { name: SURPRISE }), 'the Owner\'s assistant IS the instance TA, so "Surprise me" stays for the Owner until story 5').toHaveCount(1);
    await prompt.click();
    await expect(page).toHaveURL(/\/tapestry\/settings\/assistant$/);
  });

  test('B6: a signed-in user with no assistant sees no prompt and no assistant checklist item, and no status request is made', async ({ page }) => {
    const log = await mock(page, { who: NO_ASSISTANT_USER });
    await openDashboard(page);
    await expect(page.getByRole('button', { name: PROMPT_BUTTON }), 'AC4: a user with no assistant must not be prompted').toHaveCount(0);
    await expect(page.getByText(CHECKLIST_ITEM), 'AC4: no "Give your Assistant a profile" item without an assistant').toHaveCount(0);
    expect(log.statusCalls, 'ADR 0001: with no assistant there is nothing to ask about').toEqual([]);
  });

  /* ───────── B7 — an error is not an answer ───────── */
  test('B7: when the status check fails, no prompt appears — an error is never "no profile"', async ({ page }) => {
    await mock(page, { who: OWNER_USER, status: 'error' });
    await openDashboard(page);
    await expect(page.getByRole('button', { name: PROMPT_BUTTON }),
      'ADR 0001: a failed check renders nothing — it must never read as "your assistant has no profile"').toHaveCount(0);
  });

  /* ───────── B8 — no stale answer outlives a publish ───────── */
  test('B8: after a publish, returning to the dashboard shows no prompt — without a reload', async ({ page }) => {
    let published = false;
    const log = await mock(page, { who: OWNER_USER, status: () => ({ hasProfile: published }) });
    await openDashboard(page);
    await expect(page.getByRole('button', { name: PROMPT_BUTTON }), 'precondition: the prompt shows before the publish').toHaveCount(1);
    published = true;   // the publish happens in the editor; from here on the one answer says so
    await page.getByRole('button', { name: PROMPT_BUTTON }).click();
    await expect(page).toHaveURL(/\/tapestry\/settings\/assistant$/);
    // React Router 7 applies a navigation as a React transition: the URL changes before the new
    // route renders. Going back inside that gap lands on the same, never-unmounted dashboard,
    // which never asks again — a race in this test, not in the page (seen in 2 of 3 full-spec
    // runs). So wait until the dashboard has really gone.
    await page.locator('.dashboard').first().waitFor({ state: 'detached', timeout: 20000 });
    await page.goBack();
    await page.locator('.dashboard').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: PROMPT_BUTTON }),
      'AC5: the dashboard still prompts after the assistant\'s profile was published ' +
      `(the page asked /api/profiles for ${JSON.stringify(log.profiles)} and /api/assistant/status for ${JSON.stringify(log.statusCalls)})`).toHaveCount(0);
  });
});
