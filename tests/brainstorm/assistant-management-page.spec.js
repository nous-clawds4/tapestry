const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');

/**
 * assistant-management #1: the Assistant Management page, its FAQ and ten placeholder action pages, and the
 * profile editor's move — the browser class.
 *
 * Story: engineering-team/stories/assistant-management/1-the-assistant-management-page.md
 * ADR:   engineering-team/decisions/assistant-management/0001-the-hub-takes-assistant-and-the-editor-moves-under-it.md
 * Plan:  engineering-team/stories/assistant-management/1-the-assistant-management-page.test-plan.md
 * Node half: test/assistant-management-page.test.js (D/M/W/O/H). Expected words: test/helpers/assistantManagementFixtures.js.
 *
 *   B0  — the served origin runs a build that contains the code under test.                 [prerequisite]
 *   B1  — a viewer with an assistant: the page, its sections and cards in order, every card
 *         marked, and the count line.                                                        [AC-1, AC-2]
 *   B2  — a signed-out visitor: the cards with no marks and no count, and a sign-in line.    [AC-2]
 *   B3  — a signed-in viewer with no assistant: no marks, no count, a line linking to /setup. [AC-2]
 *   B4  — while sign-in resolves: no marks and neither line, ever.                            [AC-2]
 *   B5  — every card is a real link: a click anywhere on it, or Enter, opens its page.       [AC-3]
 *   B6  — the three NIP links open their NIP in a new tab, and the card's page does not open. [AC-3]
 *   B7  — the FAQ: closed above the sections; opens and closes by click, Enter and Space,
 *         saying which; the five questions in order; closed again after a reload.            [AC-4]
 *   B8  — each of the ten placeholder pages (one test each).                                  [AC-5]
 *   B9  — the editor at /assistant/profile/edit: its heading, its back link, and the editor. [AC-6]
 *   B10 — the Brainstorm /settings card names and links to the Edit Assistant Profile page.   [AC-6]
 *   B11 — all twelve addresses load directly, and again after a reload.                     [AC-7]
 *   B12 — 375 px wide: no horizontal scroll on the hub, a placeholder and the editor.         [AC-7]
 *   B13 — the hub and a placeholder ask nothing beyond the shared top bar, and only read.    [AC-7]
 *
 * The menus, the Dashboard prompt, the banner, the Settings tab and the old address are the re-aimed
 * tests/brainstorm/my-assistant-page.spec.js (B4–B10); the legacy panels are tests/brainstorm/one-writer.spec.js.
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked: a catch-all answers `success: false`, and the routes that matter answer per scenario.
 * The NIP links' hosts (github.com, nostrhub.io) are answered locally, so a popup never leaves the machine.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test:
 *   `cd ui && npm run build && npx vite preview --port 4173 --strictPort`, then BRAINSTORM_BASE_URL=http://localhost:4173.
 *   A source-only edit is INVISIBLE to this class; B0 guards exactly that. tests/global-setup.js sets
 *   BRAINSTORM_SERVER_ACCESSIBLE=true when the base URL answers.
 *
 * These FAIL against the build before this story: /assistant is the editor ("🤖 My Assistant"), and the ten action
 * pages and /assistant/profile/edit render "Page not found".
 */

// Fixtures, never live keys: the runtime lookups are mocked to return them.
const TA = 'aa'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const GUEST = 'ee'.repeat(32);
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const GUEST_USER = { pubkey: GUEST, classification: 'guest', assistantPubkey: null };

// Every setup step done, so the Assistant Alert (story 2) may show: it must not change anything this class checks.
const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pathname = (page) => new URL(page.url()).pathname;
const textOf = (locator) => locator.evaluate((el) => el.textContent || '');

/** The editor's status answer for the viewer's own assistant (the shape tests/brainstorm/my-assistant-page.spec.js uses). */
function editorStatus(assistantPubkey) {
  const defaults = { name: "Fixture's Tapestry Assistant", display_name: "Fixture's Tapestry Assistant", about: 'fixture', picture: '', banner: '', website: '', nip05: '', lud16: '' };
  if (!assistantPubkey) return { success: true, hasRelayKey: false, hasProfile: false, profileSource: null, isPublicInstance: false, isOwner: false, defaults };
  return {
    success: true, hasRelayKey: true, assistantPubkey, assistantNpub: 'npub1fixture', hasProfile: false, profile: null,
    profileSource: null, isOwner: false, isPublicInstance: false, computedNip05: null, defaults,
  };
}

/**
 * Mock every route. `who` is null (a visitor) or { pubkey, classification, assistantPubkey }; `authDelayMs` holds
 * sign-in back. Returns a live log of every /api request and every request that was not a GET.
 */
async function mock(page, { who = null, authDelayMs = 0, setup = SETUP_DONE } = {}) {
  const log = { api: [], nonGet: [] };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(u.pathname);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.context().route(/^https:\/\/(github\.com|nostrhub\.io)\//,
    (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>external NIP (fixture)</title>' }));

  // Catch-all FIRST: Playwright tries the most recently registered matching route first.
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-management-page.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null }));
  });
  await page.route('**/api/auth/user-classification', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who
      ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
      : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null }));
  });
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(setup)));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json(editorStatus(who && who.assistantPubkey))));
  return log;
}

/**
 * Hard-load a page and let sign-in settle before judging it. It waits for a <main> or a heading, not a <main> alone:
 * the app's "Page not found" has no <main>, and a test should say "‹address› is a page", not time out.
 */
async function open(page, address) {
  await page.goto(address);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  return page.locator('main').first();
}

/** Does any JS chunk the origin serves contain `needle`? (tests/brainstorm/setup-status.spec.js's helper.) */
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

/** Is the FAQ open? Read the way assistive technology does: a <details>' open state, or a toggle's aria-expanded. */
const faqState = (toggle) => toggle.evaluate((el) => {
  const d = el.closest('details');
  if (d) return d.open ? 'open' : 'closed';
  const t = el.closest('[aria-expanded]');
  if (t) return t.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed';
  return 'unannounced';
});

test.describe('The Assistant Management page (assistant-management #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served origin runs a build that contains the Assistant Management page', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, 'Manage the Profile and Capabilities of');
    expect(found,
      `the bundle served by ${baseURL} does not contain "Manage the Profile and Capabilities of", the hub's heading (${why}). ` +
      'Either the bundle predates your edit — a source-only change is INVISIBLE to this class, so run `cd ui && npm run build` — ' +
      'or the hub is not built yet, in which case B1–B13 say so directly.').toBe(true);
  });

  /* ───────── B1 — a viewer with an assistant ───────── */
  test('B1: a viewer with an assistant sees the page — kicker, heading, three sections, ten cards in order — every card marked "Needs attention", and "10 actions need attention" (AC-1, AC-2)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER });
    const main = await open(page, X.HUB);
    await expect(page.getByRole('heading', { name: 'Page not found' }), 'AC-1: /assistant is the hub, not "Page not found"').toHaveCount(0);
    await expect(main.getByText(X.COPY.kicker, { exact: true }), 'the kicker').toBeVisible();
    await expect(main.getByRole('heading', { level: 1 }), 'the heading, in the owner\'s words').toHaveText(X.COPY.heading);

    const h2s = (await main.getByRole('heading', { level: 2 }).allTextContents()).map(squash);
    const order = h2s.filter((h) => X.SECTIONS.some((s) => s.heading === h));
    expect(order, 'AC-1: the three section headings, in this order').toEqual(X.SECTIONS.map((s) => s.heading));

    for (const s of X.SECTIONS) {
      const region = main.getByRole('region', { name: s.heading });
      await expect(region, `"${s.heading}" is a section named by its heading`).toHaveCount(1);
      const expected = X.ACTIONS.filter((a) => a.section === s.key);
      const items = region.getByRole('listitem');
      await expect(items, `"${s.heading}" holds ${expected.length} card(s)`).toHaveCount(expected.length);
      for (let i = 0; i < expected.length; i++) {
        const a = expected[i];
        const item = items.nth(i);
        await expect(item.locator(`a[href="${a.path}"]`), `card ${i + 1} of "${s.heading}" is "${a.title}", linking to ${a.path}`).toHaveCount(1);
        expect(squash(await item.innerText()), `the "${a.title}" card shows its title and its description`).toContain(a.text);
        await expect(item).toContainText(a.title);
      }
    }

    await expect(main.getByText(X.COPY.needsAttention, { exact: true }), 'AC-2: one visible "Needs attention" mark per card').toHaveCount(10);
    for (const a of X.ACTIONS) {
      const link = main.locator(`a[href="${a.path}"]`);
      expect(squash(await textOf(link)), `a screen reader hears the "${a.title}" card as needing attention`).toBe(`${X.COPY.needsAttentionSrPrefix} ${a.title}`);
    }
    await expect(main.getByText(X.countText(10), { exact: true }), 'AC-2: the count line').toBeVisible();
    const text = await textOf(main);
    expect(text, 'no sign-in line for a signed-in viewer').not.toContain(X.COPY.signedOutLine);
    expect(text, 'no no-assistant line for a viewer who has one').not.toContain(X.COPY.noAssistantLine);
  });

  /* ───────── B2 — signed out ───────── */
  test('B2: a signed-out visitor sees the cards with no marks and no count, and a line asking them to sign in, with a sign-in button (AC-2)', async ({ page }) => {
    await mock(page, { who: null });
    const main = await open(page, X.HUB);
    for (const a of X.ACTIONS) await expect(main.locator(`a[href="${a.path}"]`), `the "${a.title}" card is still there`).toHaveCount(1);
    const text = await textOf(main);
    expect(text, 'no card is marked for a visitor — "needs attention" is about the viewer\'s own assistant').not.toContain(X.COPY.needsAttention);
    expect(text, 'no count line for a visitor').not.toMatch(/actions? needs? attention/);
    await expect(main.getByText(X.COPY.signedOutLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: X.COPY.signInButton })).toBeVisible();
    expect(text).not.toContain(X.COPY.noAssistantLine);
  });

  /* ───────── B3 — no assistant ───────── */
  test('B3: a signed-in viewer with no assistant sees no marks and no count, and a line saying so that links to Account Setup (AC-2)', async ({ page }) => {
    await mock(page, { who: GUEST_USER });
    const main = await open(page, X.HUB);
    const text = await textOf(main);
    expect(text, 'no card is marked: this viewer has no assistant to attend to').not.toContain(X.COPY.needsAttention);
    expect(text, 'no count line').not.toMatch(/actions? needs? attention/);
    expect(text, 'no sign-in line for a signed-in viewer').not.toContain(X.COPY.signedOutLine);
    await expect(main.getByText(X.COPY.noAssistantLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: X.COPY.noAssistantLink, exact: true }), 'the line links to /setup').toHaveAttribute('href', '/setup');
  });

  /* ───────── B4 — sign-in still resolving ───────── */
  test('B4: while sign-in is still resolving, the cards carry no marks and neither line shows — not even for a moment (AC-2)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER, authDelayMs: 2500 });
    await page.goto(X.HUB);
    const seen = new Set();
    let rendered = false;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const body = await page.evaluate(() => (document.body ? document.body.textContent : ''));
      if (body.includes(X.COPY.heading.slice(0, 30))) rendered = true;
      for (const [label, needle] of [['a mark', X.COPY.needsAttention], ['the count line', 'actions need attention'],
        ['the sign-in line', X.COPY.signedOutLine], ['the no-assistant line', X.COPY.noAssistantLine]]) if (body.includes(needle)) seen.add(label);
      await page.waitForTimeout(100);
    }
    expect(rendered, 'precondition: the hub rendered while sign-in was still resolving').toBe(true);
    expect([...seen], 'shown while sign-in was resolving').toEqual([]);
    await expect(page.locator('main').first().getByText(X.countText(10), { exact: true }), 'once sign-in resolves, the marks and the count arrive').toBeVisible({ timeout: 10000 });
  });

  /* ───────── B5 — every card is a link ───────── */
  test('B5: a card opens its page when clicked anywhere on it, or when its link is reached from the keyboard and Enter is pressed — and each is a real link (AC-3)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER });
    let main = await open(page, X.HUB);
    for (const a of X.ACTIONS) await expect(main.locator(`a[href="${a.path}"]`), `"${a.title}" is an <a href="${a.path}">, so it opens in a new tab like any link`).toHaveCount(1);
    const bounties = X.ACTIONS.find((a) => a.path === '/assistant/bounties');
    // A click where a person would make it: on the description, by position. (Locator.click() refuses an element
    // that another covers — and a card-wide link covers its description by design.)
    const box = await main.getByText(bounties.text, { exact: true }).boundingBox();
    expect(box, 'precondition: the Bounties card shows its description').not.toBeNull();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => pathname(page), { message: 'a click on the card\'s description — not its title — opens the card\'s page' }).toBe(bounties.path);
    main = await open(page, X.HUB);
    await main.locator('a[href="/assistant/pins"]').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => pathname(page), { message: 'Enter on a focused card opens its page' }).toBe('/assistant/pins');
  });

  /* ───────── B6 — the NIP links ───────── */
  test('B6: each NIP link opens its NIP in a new tab, and the card\'s own page does not open (AC-3)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER });
    const main = await open(page, X.HUB);
    for (const a of X.ACTIONS.filter((x) => x.link)) {
      const link = main.getByRole('link', { name: a.link.text, exact: true });
      await expect(link, `the "${a.title}" card links "${a.link.text}"`).toHaveCount(1);
      await expect(link).toHaveAttribute('href', a.link.href);
      await expect(link, 'it opens in a new tab').toHaveAttribute('target', '_blank');
      expect(await link.getAttribute('rel'), 'safely: rel="noopener noreferrer"').toMatch(/noopener/);
      const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
      await popup.waitForLoadState('domcontentloaded');
      expect(popup.url(), 'the new tab is the NIP').toBe(a.link.href);
      await popup.close();
      await page.waitForTimeout(300);
      expect(pathname(page), `following "${a.link.text}" must not also open ${a.path}`).toBe(X.HUB);
    }
  });

  /* ───────── B7 — the FAQ ───────── */
  test('B7: the FAQ sits closed between the heading and the first section; click, Enter and Space open and close it, and it says which; the five questions come in order; a reload closes it (AC-4)', async ({ page }) => {
    test.setTimeout(90000);
    await mock(page, { who: null });
    let main = await open(page, X.HUB);
    let toggle = main.getByText(X.COPY.faqToggle, { exact: true });
    await expect(toggle, 'a "Frequently asked questions" toggle').toBeVisible();
    expect(await faqState(toggle), 'closed by default, and announced as such').toBe('closed');
    for (const q of X.FAQ) await expect(main.getByText(q.question, { exact: true }), `closed: "${q.question}" is not shown`).toBeHidden();

    const placed = await main.evaluate((m, [faqText, firstSection]) => {
      const find = (text) => [...m.querySelectorAll('*')].find((el) => el.childElementCount === 0 && el.textContent.trim() === text);
      const h1 = m.querySelector('h1');
      const faq = find(faqText);
      const section = find(firstSection);
      const after = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      return { belowHeading: after(h1, faq), aboveSections: after(faq, section) };
    }, [X.COPY.faqToggle, X.SECTIONS[0].heading]);
    expect(placed, 'AC-4: below the heading and above the first section').toEqual({ belowHeading: true, aboveSections: true });

    await toggle.click();
    expect(await faqState(toggle), 'a click opens it, and it says so').toBe('open');
    let lastY = -1;
    for (const q of X.FAQ) {
      const question = main.getByText(q.question, { exact: true });
      await expect(question).toBeVisible();
      await expect(main.getByText(q.answer, { exact: true }), `the answer to "${q.question}", in the owner's words`).toBeVisible();
      const y = (await question.boundingBox()).y;
      expect(y, `"${q.question}" comes after the question before it`).toBeGreaterThan(lastY);
      lastY = y;
    }
    await toggle.click();
    expect(await faqState(toggle), 'a second click closes it').toBe('closed');

    const focusToggle = () => toggle.evaluate((el) => (el.closest('summary') || el.closest('button') || el).focus());
    await focusToggle();
    await page.keyboard.press('Enter');
    expect(await faqState(toggle), 'Enter opens it').toBe('open');
    await focusToggle();
    await page.keyboard.press('Space');
    expect(await faqState(toggle), 'Space closes it').toBe('closed');

    await toggle.click();
    expect(await faqState(toggle)).toBe('open');
    await page.reload();
    main = await open(page, X.HUB);
    toggle = main.getByText(X.COPY.faqToggle, { exact: true });
    expect(await faqState(toggle), 'closed again on a fresh load').toBe('closed');
  });

  /* ───────── B8 — the ten placeholder pages ───────── */
  for (const a of X.ACTIONS) {
    test(`B8 ${a.path}: a placeholder page with the title, "Placeholder page.", the description, the alert criteria${a.planningNotes ? ', the planning notes' : ''}${a.editLink ? ', a link to the editor' : ''} and a way back (AC-5)`, async ({ page }) => {
      await mock(page, { who: CUSTOMER_USER });
      const main = await open(page, a.path);
      await expect(page.getByRole('heading', { name: 'Page not found' }), `${a.path} is a page`).toHaveCount(0);
      await expect(main.getByRole('heading', { level: 1 }), 'the heading is the action\'s title').toHaveText(a.title);
      await expect(main.getByText(X.COPY.placeholder, { exact: true }), 'it says it is a placeholder').toBeVisible();
      expect(squash(await main.innerText()), 'the description').toContain(a.text);
      if (a.link) {
        const link = main.getByRole('link', { name: a.link.text, exact: true });
        await expect(link, 'the description\'s NIP link').toHaveAttribute('href', a.link.href);
        await expect(link).toHaveAttribute('target', '_blank');
      }
      await expect(main.getByText(X.COPY.alertCriteriaHeading, { exact: true }), 'an "Alert criteria" section').toBeVisible();
      await expect(main.getByText(a.alertCriteria || X.NOT_YET_DEFINED, { exact: true }),
        a.alertCriteria ? 'the owner\'s alert criteria' : 'no criteria yet, said so').toBeVisible();
      if (a.planningNotes) {
        await expect(main.getByText(X.COPY.planningNotesHeading, { exact: true }), 'a "Planning notes" section').toBeVisible();
        await expect(main.getByText(a.planningNotes, { exact: true }), 'the owner\'s notes').toBeVisible();
      } else {
        await expect(main.getByText(X.COPY.planningNotesHeading, { exact: true }), 'no "Planning notes" section where the owner gave none').toHaveCount(0);
      }
      await expect(main.getByRole('link', { name: X.COPY.backToHub, exact: true }), 'the way back').toHaveAttribute('href', X.HUB);
      const toEditor = main.locator(`a[href="${X.EDITOR}"]`);
      if (a.editLink) await expect(main.getByRole('link', { name: a.editLink.text, exact: true }), 'the profile page links to the editor').toHaveAttribute('href', X.EDITOR);
      else await expect(toEditor, 'only the profile page links to the editor').toHaveCount(0);
    });
  }

  /* ───────── B9 — the editor, moved ───────── */
  test('B9: /assistant/profile/edit is the editor, headed "Edit Assistant Profile", with a link back to /assistant/profile — and it still asks a visitor to sign in (AC-6)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER });
    let main = await open(page, X.EDITOR);
    await expect(page.getByRole('heading', { name: 'Page not found' }), `${X.EDITOR} is a page`).toHaveCount(0);
    await expect(main.getByRole('heading', { level: 1 }), 'the heading').toHaveText(X.COPY.editorHeading);
    await expect(main.getByRole('link', { name: X.COPY.editorBack, exact: true }), 'the way back').toHaveAttribute('href', X.PROFILE_PAGE);
    await expect(page.getByRole('button', { name: /publish profile/i }), 'the editor itself, unchanged').toBeVisible({ timeout: 20000 });

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { who: null });
    main = await open(page, X.EDITOR);
    await expect(main, 'a visitor is still asked to sign in, as before the move').toContainText('Sign in to see and manage your Tapestry Assistant.');
    await expect(page.getByRole('button', { name: /publish profile/i })).toHaveCount(0);
  });

  /* ───────── B10 — the /settings card ───────── */
  test('B10: the Brainstorm /settings card names the Edit Assistant Profile page and links to it (AC-6)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER });
    await page.goto('/settings');
    await page.locator('.bss-page').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1000);
    await expect(page.getByText(X.COPY.settingsCardText, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: X.COPY.settingsCardButton, exact: true })).toHaveAttribute('href', X.EDITOR);
    await expect(page.getByText(/Open My Assistant/), 'the old label is gone').toHaveCount(0);
  });

  /* ───────── B11 — direct loads ───────── */
  test('B11: all twelve addresses load when typed in, and again when refreshed — never "Page not found" (AC-7)', async ({ page }) => {
    test.setTimeout(180000);
    await mock(page, { who: CUSTOMER_USER });
    for (const address of [X.HUB, ...X.ACTIONS.map((a) => a.path), X.EDITOR]) {
      await open(page, address);
      await expect(page.getByRole('heading', { name: 'Page not found' }), `${address} (typed in)`).toHaveCount(0);
      await page.reload();
      await page.locator('main, h1').first().waitFor({ timeout: 20000 });
      await expect(page.getByRole('heading', { name: 'Page not found' }), `${address} (refreshed)`).toHaveCount(0);
    }
  });

  /* ───────── B12 — phone width ───────── */
  test('B12: at 375 px wide nothing scrolls sideways — the hub (signed out, and signed in with the FAQ open), a placeholder with notes, and the editor (AC-7)', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await mock(page, { who: null });
    await open(page, X.HUB);
    expect(await overflow(), 'the hub, signed out').toBeLessThanOrEqual(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { who: CUSTOMER_USER });
    const main = await open(page, X.HUB);
    await expect(main.getByText(X.COPY.faqToggle, { exact: true }), 'precondition: the hub\'s FAQ toggle').toBeVisible();
    await main.getByText(X.COPY.faqToggle, { exact: true }).click();
    expect(await overflow(), 'the hub, signed in, FAQ open').toBeLessThanOrEqual(0);
    await open(page, '/assistant/preferences');
    expect(await overflow(), '/assistant/preferences').toBeLessThanOrEqual(0);
    await open(page, X.EDITOR);
    expect(await overflow(), 'the editor').toBeLessThanOrEqual(0);
  });

  /* ───────── B13 — read-only ───────── */
  test('B13: the hub and a placeholder ask the server nothing the shared top bar does not already ask, and send nothing but GETs (AC-7)', async ({ page }) => {
    test.setTimeout(90000);
    const log = await mock(page, { who: CUSTOMER_USER });
    const pathsOn = async (address) => {
      const from = log.api.length;
      await open(page, address);
      await page.waitForTimeout(1500);
      return new Set(log.api.slice(from));
    };
    // The baseline: a /setup placeholder, which wears the same <TopBar /> and asks nothing of its own. Loaded twice.
    const baseline = new Set([...(await pathsOn('/setup/follow')), ...(await pathsOn('/setup/follow'))]);
    for (const address of [X.HUB, '/assistant/preferences']) {
      const extra = [...(await pathsOn(address))].filter((p) => !baseline.has(p));
      expect(extra, `${address} asked for something the top bar alone does not`).toEqual([]);
    }
    expect(log.nonGet, 'nothing is published, signed or stored: only GETs').toEqual([]);
  });
});
