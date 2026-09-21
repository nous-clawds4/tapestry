const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * assistant-profile #5: One writer — nothing else can change an assistant's profile. Browser half (B-class:
 * what the dashboard and the two legacy pages DO).
 *
 * Story: engineering-team/stories/assistant-profile/5-one-writer-for-assistant-profiles.md
 * ADR:   engineering-team/decisions/assistant-profile/0005-one-writer-for-an-assistants-profile.md
 * Node half: test/one-writer-assistant-profile.test.js (G/P/W — W is this class's CI backstop).
 *
 * Every /api route is mocked, so each test decides exactly what the server answers:
 *
 *   B0 — the served bundle is a build of this story: the My Assistant page's code is in it, and neither
 *        one-click publish label is.                                                    [prerequisite]
 *   B1 — the dashboard, for the Owner, an Admin and a Customer whose assistant has no profile: the
 *        welcome card's one action leads to the My Assistant page, and nothing is published.   [AC1, AC5]
 *   B2 — the legacy NIP-85 page, signed in as the Owner: the panel shows the assistant's status read-only,
 *        links to the My Assistant page, and nothing on it publishes.                    [AC2, AC5]
 *   B3 — the legacy customer page, signed in as a Customer: the same.                    [AC2, AC5]
 *   B4 — both panels show the link in every state: while the status loads, with no key, with no profile,
 *        when the status request fails, and — on the NIP-85 page — signed out.          [AC2]
 *
 * The legacy pages are static files that Express serves as they are (bin/control-panel.js: /legacy and
 * /control from public/, and *.html looked up the way serveHtmlFile does). A `vite preview` of the built UI
 * does not serve them, so each test serves them from this checkout's own public/ through page.route — the
 * files under test, byte for byte.
 *
 * Prerequisites: BRAINSTORM_SERVER_ACCESSIBLE=true, and BRAINSTORM_BASE_URL pointing at an origin serving the
 * BUILT ui under test (B0 and B1 test that build; B2–B4 follow the panel's link into it). From an isolated
 * worktree: `cd ui && npx vite build`, then serve its dist with
 * `npx vite preview --outDir <worktree>/dist --port 4173 --strictPort`.
 *
 * Against the current build and pages: B0 fails (the bundle still has "Use the default profile"), B1 fails
 * for the Owner (a second button, which publishes) — the Admin and Customer cases pass, as they have since
 * story 1 — and B2–B4 fail (both panels still publish, and neither links to the My Assistant page).
 */

// Fixtures, never live keys: the runtime lookups are mocked to return them.
const TA = 'aa'.repeat(32);
const OWNER = 'bb'.repeat(32);
const ADMIN = 'ad'.repeat(32);
const ADMIN_ASSISTANT = 'a1'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);

const OWNER_USER = { pubkey: OWNER, classification: 'owner', assistantPubkey: TA, label: 'the Owner' };
const ADMIN_USER = { pubkey: ADMIN, classification: 'admin', assistantPubkey: ADMIN_ASSISTANT, label: 'an Admin' };
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT, label: 'a Customer' };

// The one writer's page, since assistant-management #1 (ADR assistant-management/0001): /assistant is now the hub.
const MY_ASSISTANT = '/assistant/profile/edit';
const PROMPT_BUTTON = /Set up my Assistant.s profile/;
const PUBLISHES = /\/api\/(assistant\/publish-profile|strfry\/publish)(\?|$)/;

const REPO = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(REPO, 'public');
// serveHtmlFile's search order for /legacy/‹name›.html (bin/control-panel.js:212-215).
const HTML_DIRS = ['pages/customers', 'pages/manage', 'pages', ''].map((d) => path.join(PUBLIC_DIR, d));

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const pathname = (page) => new URL(page.url()).pathname;

/**
 * Mock the app's routes for `who` (null: a visitor). `status` decides /api/assistant/status: 'published',
 * 'unpublished', 'no-key', 'fail' (the request is aborted) or 'hold' (it stays pending until `release()`).
 * Every POST that could publish a profile is logged, whatever answers it.
 */
async function mockApp(page, { who = null, status = 'unpublished' } = {}) {
  const log = { publishes: [], status: [] };
  let release = () => {};
  const held = new Promise((resolve) => { release = resolve; });
  page.on('request', (req) => { if (req.method() === 'POST' && PUBLISHES.test(req.url())) log.publishes.push(`${req.method()} ${new URL(req.url()).pathname}`); });

  // Catch-all FIRST: Playwright tries the most recently registered matching route first.
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by one-writer.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/status', (r) => r.fulfill(json({ success: true })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/settings', (r) => r.fulfill(json({ success: true, settings: {}, defaults: {}, overrides: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(who
    ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
    : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })));
  // The legacy customer page checks the signed-in person against the customers list before it shows its panels.
  await page.route('**/api/get-user-data**', (r) => r.fulfill(json({ pubkey: who && who.pubkey, name: 'fixture', display_name: 'Fixture' })));
  await page.route('**/api/get-customers', (r) => r.fulfill(json({
    success: true,
    customers: [{ pubkey: CUSTOMER, name: 'carmen', display_name: 'Carmen', status: 'active', directory: 'carmen' }],
  })));

  await page.route('**/api/assistant/status**', async (r) => {
    const url = new URL(r.request().url());
    log.status.push({ customerPubkey: url.searchParams.get('customerPubkey'), defaults: url.searchParams.get('defaults') });
    if (status === 'fail') return r.abort('failed');
    if (status === 'hold') { await held; return r.fulfill(json({ success: false, error: 'released at the end of the test' })); }
    const mine = who && url.searchParams.get('customerPubkey') === who.pubkey;
    if (!mine || status === 'no-key') {
      return r.fulfill(json({ success: true, hasRelayKey: false, hasProfile: false, profileSource: null, isOwner: who === OWNER_USER, isPublicInstance: true }));
    }
    const published = status === 'published';
    return r.fulfill(json({
      success: true, hasRelayKey: true, assistantPubkey: who.assistantPubkey, assistantNpub: 'npub1fixture',
      hasProfile: published,
      profile: published ? { name: 'Published Fixture', display_name: 'Published Fixture', about: 'Published from the My Assistant page.' } : null,
      profileSource: published ? 'local' : null, isOwner: who === OWNER_USER, isPublicInstance: true,
    }));
  });
  // Answered as a publish would be, so a page that still publishes gets as far as it can — the log is what counts.
  await page.route('**/api/assistant/publish-profile', (r) => r.fulfill(json({
    success: true, outcome: 'published', relays: { total: 1, success: 1, results: [] },
    message: "The Tapestry Assistant's profile was saved on this instance's relay and accepted by 1 of 1 relays.",
  })));
  await page.route('**/ta-avatar.png', (r) => r.fulfill({ status: 404, body: '' }));
  return { log, release };
}

/** Serve /legacy/* and /control/* from this checkout's public/, as Express does. */
async function serveLegacy(page) {
  await page.route(/\/(legacy|control)\//, (route) => {
    const url = new URL(route.request().url());
    const rest = decodeURIComponent(url.pathname.replace(/^\/(legacy|control)\//, ''));
    let file = null;
    if (url.pathname.startsWith('/legacy/') && /^[^/]+\.html$/.test(rest)) {
      file = HTML_DIRS.map((dir) => path.join(dir, rest)).find((f) => fs.existsSync(f)) || null;
    } else {
      const f = path.join(PUBLIC_DIR, rest);
      if (f.startsWith(PUBLIC_DIR) && fs.existsSync(f) && fs.statSync(f).isFile()) file = f;
    }
    return file ? route.fulfill({ path: file }) : route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found\n' });
  });
}

async function openDashboard(page) {
  await page.goto('/tapestry/');
  await page.locator('.dashboard').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
}

const LEGACY_PAGES = {
  nip85: {
    title: 'the legacy NIP-85 page',
    url: '/legacy/nip85.html',
    who: OWNER_USER,
    panel: (page) => page.locator('.section').filter({ has: page.locator('#ownerAssistantLoading') }),
    profileStatus: '#ownerAssistantProfileStatus',
  },
  customer: {
    title: 'the legacy customer page',
    url: '/legacy/customer.html',
    who: CUSTOMER_USER,
    panel: (page) => page.locator('.nip85-panel').filter({ has: page.locator('#assistantLoading') }),
    profileStatus: '#assistantProfileStatus',
  },
};

async function openLegacy(page, which) {
  await serveLegacy(page);
  await page.goto(which.url);
  const panel = which.panel(page);
  await expect(panel, `${which.title} still has its assistant panel (ADR 0005 keeps it, read-only)`).toBeVisible({ timeout: 20000 });
  return panel;
}

/** The link to the My Assistant page, in `panel`. */
const pageLink = (panel) => panel.locator(`a[href="${MY_ASSISTANT}"]`);

/** Does any JS chunk the origin serves contain `needle`? Follows chunk references one hop at a time. */
async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const queue = [...(await index.text()).matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { found: false, why: 'no built JS is referenced from the app shell — is this a built UI? Run `cd ui && npx vite build`.' };
  const seen = new Set();
  while (queue.length && seen.size < 400) {
    const asset = queue.shift();
    if (seen.has(asset)) continue;
    seen.add(asset);
    const res = await request.get(asset);
    if (!res.ok()) continue;
    const js = await res.text();
    if (js.includes(needle)) return { found: true, why: `found in ${asset}` };
    for (const m of js.matchAll(/["'(](\.{0,2}\/?(?:assets\/)?[\w.-]+\.js)["')]/g)) {
      const ref = m[1];
      const resolved = ref.startsWith('assets/') ? `/${ref}` : new URL(ref, new URL(asset, 'http://origin')).pathname;
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  return { found: false, why: `searched ${seen.size} JS chunks` };
}

test.describe('One writer — nothing else can change an assistant\'s profile (assistant-profile #5)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served origin runs a build of this story — the My Assistant page\'s code is in it, and neither "Use the default profile" nor "Surprise me" is', async ({ request, baseURL }) => {
    const page4 = await bundleContains(request, 'no-picture');
    expect(page4.found, `the bundle served by ${baseURL} lacks "no-picture", the My Assistant page's code (story 4) — is this a build of this branch? (${page4.why})`).toBe(true);
    for (const label of ['Use the default profile', 'Surprise me']) {
      const old = await bundleContains(request, label);
      expect(old.found,
        `the bundle served by ${baseURL} still contains "${label}" (${old.why}). Either it predates your edit — run ` +
        '`cd ui && npx vite build` — or the dashboard still offers a one-click publish, which B1 then shows directly.').toBe(false);
    }
  });

  /* ───────── B1 — AC1: the dashboard's only assistant action leads to the My Assistant page ───────── */
  for (const who of [OWNER_USER, ADMIN_USER, CUSTOMER_USER]) {
    test(`B1: for ${who.label} whose assistant has no profile, the dashboard's welcome card offers one action — "Set up my Assistant's profile", which leads to the My Assistant page — and the dashboard publishes nothing`, async ({ page }) => {
      const { log } = await mockApp(page, { who, status: 'unpublished' });
      await openDashboard(page);
      const card = page.locator('.welcome-card');
      await expect(card, `precondition: ${who.label}'s assistant has no profile, so the dashboard prompts`).toHaveCount(1);
      const actions = card.locator('button, a[href]');
      const labels = (await actions.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      expect(labels, 'AC1 ("its only assistant action is the link to the My Assistant page"), ADR 0005 sub-decision 4').toHaveLength(1);
      await expect(actions.first()).toHaveText(PROMPT_BUTTON);
      expect(log.publishes, 'AC1 / AC5: the dashboard publishes nothing — on load or otherwise').toEqual([]);
      await actions.first().click();
      await expect.poll(() => pathname(page), { message: 'AC1: the one action leads to the My Assistant page' }).toBe(MY_ASSISTANT);
      expect(log.publishes, 'AC1 / AC5: following it publishes nothing either').toEqual([]);
    });
  }

  /* ───────── B2, B3 — AC2: each legacy panel is read-only, and links to the My Assistant page ───────── */
  for (const [id, key] of [['B2', 'nip85'], ['B3', 'customer']]) {
    const which = LEGACY_PAGES[key];
    test(`${id}: ${which.title}, signed in as ${which.who.label}, shows their assistant read-only — its pubkey, "Published" and the published name — links to the My Assistant page, and publishes nothing`, async ({ page }) => {
      const { log } = await mockApp(page, { who: which.who, status: 'published' });
      const panel = await openLegacy(page, which);
      await expect(panel.locator(which.profileStatus), 'the read-only status is kept (ADR 0005 sub-decision 5)').toContainText('Published', { timeout: 15000 });
      await expect(panel, 'the preview shows the published profile').toContainText('Published Fixture');
      await expect(panel, 'the assistant\'s pubkey is shown').toContainText(which.who.assistantPubkey.slice(0, 12));
      await expect(panel.getByRole('button', { name: /publish/i }),
        'AC2 ("they no longer publish an assistant profile"): the panel offers no publish button').toHaveCount(0);
      for (const control of await panel.locator('button, [onclick]').all()) {
        if (await control.isVisible()) await control.click({ timeout: 2000 }).catch(() => {});
      }
      await page.waitForTimeout(500);
      expect(log.publishes, 'AC2 / AC5: nothing on the page publishes — not on load, not on any click').toEqual([]);
      const statusAsks = log.status.filter((s) => s.customerPubkey);
      expect(statusAsks.length, 'the panel asks for its status').toBeGreaterThan(0);
      expect(statusAsks.every((s) => s.customerPubkey === which.who.pubkey && s.defaults === '0'),
        `ADR 0005 sub-decision 5: the panel asks about the signed-in person, with defaults=0 — asked ${JSON.stringify(statusAsks)}`).toBe(true);
      const link = pageLink(panel);
      await expect(link, 'AC2 ("…and a link to the My Assistant page")').toBeVisible();
      await expect(link, 'the link names the page it leads to').toContainText(/My Assistant/);
      await link.click();
      await expect.poll(() => pathname(page), { message: 'the link leads to the My Assistant page' }).toBe(MY_ASSISTANT);
    });
  }

  /* ───────── B4 — AC2: the link shows in every state of each panel ───────── */
  const STATES = [
    ['while its status is still loading', { status: 'hold' }],
    ['when the assistant has no key', { status: 'no-key' }],
    ['when the profile is not published', { status: 'unpublished' }],
    ['when the status request fails', { status: 'fail' }],
  ];
  for (const key of ['nip85', 'customer']) {
    const which = LEGACY_PAGES[key];
    const states = key === 'nip85' ? [...STATES, ['to a visitor who is not signed in', { status: 'unpublished', signedOut: true }]] : STATES;
    for (const [when, opts] of states) {
      test(`B4: on ${which.title}, the assistant panel links to the My Assistant page ${when} — and offers nothing that publishes`, async ({ page }) => {
        const { log, release } = await mockApp(page, { who: opts.signedOut ? null : which.who, status: opts.status });
        try {
          const panel = await openLegacy(page, which);
          await page.waitForTimeout(1000);
          await expect(pageLink(panel), `AC2, ADR 0005 sub-decision 5 ("a link that shows in every state") — ${when}`).toBeVisible();
          await expect(panel.getByRole('button', { name: /publish/i }), 'no publish button in any state').toHaveCount(0);
          expect(log.publishes, 'nothing is published').toEqual([]);
        } finally {
          release();
        }
      });
    }
  }
});
