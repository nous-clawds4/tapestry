const { test, expect } = require('@playwright/test');
const F = require('../../test/helpers/aboutThisInstanceFixtures');

/**
 * about-this-instance #1: the "About this Brainstorm Instance" section on /about — the browser half.
 *
 * Story: engineering-team/stories/about-this-instance/1-owner-admins-customer-count.md
 * ADR:   engineering-team/decisions/about-this-instance/0001-public-instance-roles-read.md
 * Plan:  engineering-team/stories/about-this-instance/1-owner-admins-customer-count.test-plan.md
 * Node half: test/about-this-instance.test.js. Words and fixture people: test/helpers/aboutThisInstanceFixtures.js.
 *
 *   B0  — the served origin runs a build that contains the section.                                   [prerequisite]
 *   B1  — a visitor: the section below /about's unchanged content; the Owner card, two Admin cards (one
 *         named, one a shortened npub) with "2" beside the heading, and "12 customers".                [AC-1, AC-2, AC-3]
 *   B2  — the cards open /user/<pubkey>.                                                              [AC-2]
 *   B3  — zero Admins: "0" beside the heading and "No admins"; the Owner card alone.                  [AC-2]
 *   B4  — the count line: "1 customer", "0 customers", and "Customer count unavailable".              [AC-3]
 *   B5  — a visitor's page reads no customer list and no owner-only read, asks profiles only for the
 *         Owner and the Admins, and only reads.                                                        [AC-4]
 *   B6  — the read fails (500, success: false, a dropped connection): the failure line, /about's own
 *         content intact; while the read is on its way, the title and subtitle are already there.     [AC-6, AC-1]
 *   B7  — the profile lookup fails: every card falls back to its shortened npub, and no failure line. [AC-2, AC-6]
 *   B8  — a signed-in customer sees the same section.                                                 [AC-1]
 *   B9  — /about#this-instance opened directly lands on the section.                                  [AC-1]
 *   B10 — the link on /about-brainstorm-search lands on the section.                                  [AC-5]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked: a catch-all answers `success: false`; sign-in, the profiles and the read answer per
 * scenario. Fixture pubkeys only, never a live key.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test:
 *   `cd ui && npm run build && npx vite preview --port 4173 --strictPort`, then BRAINSTORM_BASE_URL=http://localhost:4173.
 *   A source-only edit is INVISIBLE to this class; B0 guards exactly that. tests/global-setup.js sets
 *   BRAINSTORM_SERVER_ACCESSIBLE=true when the base URL answers.
 *
 * These FAIL against the build before this story: /about has no such section, and /about-brainstorm-search no link.
 */

const ADMINS = [F.ADMIN_NAMED, F.ADMIN_UNKNOWN];
const ABOUT = { success: true, ownerPubkey: F.OWNER, adminPubkeys: ADMINS, customerCount: 12 };
const CUSTOMER_USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const NARROW = { width: 375, height: 500 }; // tall enough content that the section starts below the fold

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const section = (page) => page.locator(`#${F.ANCHOR_ID}`);
const cardFor = (page, pubkey) => section(page).locator(`a[href="/user/${pubkey}"]`);

/**
 * Mock every /api route. `about`: an answer object, or 'error' (500), 'unsuccessful' (200, success: false),
 * 'abort' (a dropped connection) or 'hang'. `profiles`: 'ok' or 'error'.
 */
async function mock(page, { who = null, about = ABOUT, profiles = 'ok' } = {}) {
  const log = { api: [], nonGet: [], aboutCalls: 0, profilePubkeys: [] };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (!u.pathname.startsWith('/api/')) return;
    log.api.push(`${req.method()} ${u.pathname}`);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by about-this-instance.spec.js' })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(who
    ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
    : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })));
  await page.route('**/api/profiles**', (r) => {
    const asked = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    log.profilePubkeys.push(...asked);
    if (profiles === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    const found = {};
    for (const pk of asked) if (F.PROFILES[pk]) found[pk] = F.PROFILES[pk];
    return r.fulfill(json({ success: true, profiles: found }));
  });
  await page.route(`**${F.ROUTE}`, (r) => {
    log.aboutCalls++;
    if (about === 'hang') return new Promise(() => {});
    if (about === 'abort') return r.abort('connectionreset');
    if (about === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    if (about === 'unsuccessful') return r.fulfill(json({ success: false, error: 'fixture failure' }));
    return r.fulfill(json(about));
  });
  return log;
}

async function open(page, address = F.PAGE) {
  await page.goto(address);
  await page.getByRole('heading', { name: 'About Brainstorm', exact: true }).waitFor({ timeout: 20000 });
}

/** Wait until the section has drawn its answer (a card, or the failure line). */
async function settled(page) {
  await expect(section(page).locator('a[href^="/user/"]').or(section(page).getByText(F.COPY.loadFailed)).first())
    .toBeVisible({ timeout: 10000 });
}

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
  return { found: false, why: `"${needle}" is in none of the ${seen.size} JS assets the app shell reaches` };
}

/** The section's top edge relative to the viewport. */
const topOf = (page) => section(page).evaluate((el) => el.getBoundingClientRect().top);

test.describe('About this Brainstorm Instance, on /about (about-this-instance #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  test('B0: the served origin runs a build that contains the section', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, F.COPY.subtitle);
    expect(found,
      `the bundle served by ${baseURL} does not contain the subtitle "${F.COPY.subtitle}" (${why}). ` +
      'Either the bundle predates your edit — a source-only change is INVISIBLE to this class, so run `cd ui && npm run build` — ' +
      'or the section is not built yet, in which case B1–B10 say so directly.').toBe(true);
  });

  test('B1: a visitor sees the section below /about\'s unchanged content — the Owner, two Admins with "2" beside the heading, and "12 customers" (AC-1, AC-2, AC-3)', async ({ page }) => {
    await mock(page);
    await open(page);
    const kept = page.getByText('Brainstorm is open source', { exact: false });
    await expect(kept, 'AC-1: /about\'s existing content is unchanged').toBeVisible();
    await expect(page.getByText('Brainstorm is a project of', { exact: false })).toBeVisible();
    const s = section(page);
    await expect(s, `AC-1: the section carries id="${F.ANCHOR_ID}"`).toBeVisible();
    await expect(s.getByRole('heading', { name: F.COPY.title, exact: true }), 'the title').toBeVisible();
    await expect(s.getByText(F.COPY.subtitle, { exact: true }), 'the subtitle').toBeVisible();
    await settled(page);

    const keptBox = await kept.boundingBox();
    const sectionBox = await s.boundingBox();
    expect(sectionBox.y, 'AC-1: the section sits below the existing content').toBeGreaterThan(keptBox.y);

    const owner = cardFor(page, F.OWNER);
    await expect(owner, 'AC-2: the Owner card').toHaveCount(1);
    await expect(owner).toContainText('Olive Owner');
    await expect(owner).toContainText('olive@example.com');

    await expect(s, 'AC-2: the Admins count beside its heading').toContainText(new RegExp(`${F.COPY.adminsHeading}\\s*2(?!\\d)`));
    const named = cardFor(page, F.ADMIN_NAMED);
    await expect(named, 'AC-2: the named Admin\'s card').toHaveCount(1);
    await expect(named).toContainText('adam');
    await expect(named).toContainText('adam@example.org');
    const unknown = cardFor(page, F.ADMIN_UNKNOWN);
    await expect(unknown, 'AC-2: the Admin with no profile').toHaveCount(1);
    await expect(unknown, 'AC-2: no profile → a shortened npub').toContainText(F.shortNpub(F.ADMIN_UNKNOWN));
    await expect(s.locator('a[href^="/user/"]'), 'one Owner card and two Admin cards, nothing else').toHaveCount(3);

    await expect(s, 'AC-3: the count line').toContainText(new RegExp(`(?<!\\d)12\\s*${F.COPY.customerMany}\\b`));
  });

  test('B2: the Owner\'s and an Admin\'s cards open /user/<their pubkey> (AC-2)', async ({ page }) => {
    await mock(page);
    await open(page);
    await settled(page);
    await cardFor(page, F.OWNER).click();
    await expect(page, 'the Owner card opens the Owner\'s profile').toHaveURL(new RegExp(`/user/${F.OWNER}$`));
    await page.goBack();
    await settled(page);
    await cardFor(page, F.ADMIN_UNKNOWN).click();
    await expect(page, 'an Admin card opens that Admin\'s profile').toHaveURL(new RegExp(`/user/${F.ADMIN_UNKNOWN}$`));
  });

  test('B3: zero Admins reads "0" beside the heading and "No admins"; the Owner card alone (AC-2)', async ({ page }) => {
    await mock(page, { about: { ...ABOUT, adminPubkeys: [] } });
    await open(page);
    await settled(page);
    const s = section(page);
    await expect(s).toContainText(new RegExp(`${F.COPY.adminsHeading}\\s*0(?!\\d)`));
    await expect(s.getByText(F.COPY.noAdmins, { exact: false }), 'the empty note').toBeVisible();
    await expect(s.locator('a[href^="/user/"]'), 'the Owner card alone').toHaveCount(1);
  });

  test('B4: the count line reads "1 customer", "0 customers", and "Customer count unavailable" for a count that could not be taken (AC-3)', async ({ page }) => {
    for (const [count, want] of [[1, new RegExp(`(?<!\\d)1\\s*${F.COPY.customerOne}(?!s)\\b`)], [0, new RegExp(`(?<!\\d)0\\s*${F.COPY.customerMany}\\b`)]]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { about: { ...ABOUT, customerCount: count } });
      await open(page);
      await settled(page);
      await expect(section(page), `customerCount ${count}`).toContainText(want);
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { about: { ...ABOUT, customerCount: null } });
    await open(page);
    await settled(page);
    await expect(section(page).getByText(F.COPY.countUnavailable, { exact: false }), 'a null count').toBeVisible();
    await expect(cardFor(page, F.OWNER), 'the Owner card still shows').toHaveCount(1);
  });

  test('B5: a visitor\'s page reads no customer list and no owner-only read, asks profiles only for the Owner and the Admins, and only reads (AC-4)', async ({ page }) => {
    const log = await mock(page);
    await open(page);
    await settled(page);
    await page.waitForTimeout(500);
    expect(log.aboutCalls, `the path under test: the page reads ${F.ROUTE}`).toBeGreaterThanOrEqual(1);
    const forbidden = log.api.filter((l) => F.FORBIDDEN_READS.some((r) => l.endsWith(` ${r}`)));
    expect(forbidden, 'AC-4: no customer list, no roster, no owner-only admin list').toEqual([]);
    const allowed = new Set([F.OWNER, ...ADMINS]);
    expect(log.profilePubkeys.filter((pk) => !allowed.has(pk)), 'profiles only for the Owner and the Admins').toEqual([]);
    expect(log.nonGet, 'the page only reads').toEqual([]);
  });

  test('B6: a failed read shows the failure line and leaves /about intact; while the read is on its way the title and subtitle are already there (AC-6, AC-1)', async ({ page }) => {
    for (const about of ['error', 'unsuccessful', 'abort']) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { about });
      await open(page);
      const s = section(page);
      await expect(s.getByText(F.COPY.loadFailed, { exact: false }), `${about}: the failure line`).toBeVisible({ timeout: 10000 });
      await expect(s.locator('a[href^="/user/"]'), `${about}: no cards`).toHaveCount(0);
      await expect(page.getByText('Brainstorm is open source', { exact: false }), `${about}: /about's own content intact`).toBeVisible();
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { about: 'hang' });
    await open(page);
    const s = section(page);
    await expect(s.getByRole('heading', { name: F.COPY.title, exact: true }), 'hang: the title is there before the data').toBeVisible();
    await expect(s.getByText(F.COPY.subtitle, { exact: true }), 'hang: the subtitle too').toBeVisible();
    await expect(s.getByText(F.COPY.loadFailed, { exact: false }), 'hang: not a failure').toHaveCount(0);
  });

  test('B7: a failed profile lookup leaves every card on its shortened npub, and shows no failure line (AC-2, AC-6)', async ({ page }) => {
    await mock(page, { profiles: 'error' });
    await open(page);
    await settled(page);
    for (const pk of [F.OWNER, ...ADMINS]) {
      await expect(cardFor(page, pk), `${pk.slice(0, 8)}…: the shortened npub`).toContainText(F.shortNpub(pk));
    }
    await expect(section(page).getByText(F.COPY.loadFailed, { exact: false })).toHaveCount(0);
    await expect(section(page)).toContainText(new RegExp(`(?<!\\d)12\\s*${F.COPY.customerMany}\\b`));
  });

  test('B8: a signed-in customer sees the same section (AC-1)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER });
    await open(page);
    await settled(page);
    await expect(section(page).getByRole('heading', { name: F.COPY.title, exact: true })).toBeVisible();
    await expect(cardFor(page, F.OWNER)).toContainText('Olive Owner');
    await expect(section(page).locator('a[href^="/user/"]')).toHaveCount(3);
    await expect(section(page)).toContainText(new RegExp(`(?<!\\d)12\\s*${F.COPY.customerMany}\\b`));
  });

  test('B9: /about#this-instance opened directly lands on the section (AC-1)', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await mock(page);
    await open(page);
    await settled(page);
    const plainTop = await topOf(page);
    expect(plainTop, `fixture check: at ${NARROW.width}×${NARROW.height} the section must start below the fold without the anchor, or this test proves nothing`).toBeGreaterThan(NARROW.height);

    // From a blank page, so this is a fresh load of /about#this-instance — not a same-document hash change, which the
    // browser would scroll by itself once the section exists, proving nothing about the section's own effect.
    await page.goto('about:blank');
    await page.goto(F.LINK_HREF);
    await settled(page);
    await expect.poll(() => topOf(page), { message: 'the section is scrolled into view', timeout: 5000 })
      .toBeLessThan(NARROW.height / 2);
    expect(await topOf(page)).toBeGreaterThan(-5);
  });

  test('B10: the link on /about-brainstorm-search lands on the section (AC-5)', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await mock(page);
    await page.goto(F.SEARCH_ABOUT);
    const link = page.getByRole('link', { name: F.COPY.linkText, exact: true });
    await expect(link, `AC-5: "${F.COPY.linkText}" on ${F.SEARCH_ABOUT}`).toBeVisible({ timeout: 20000 });
    await expect(link).toHaveAttribute('href', F.LINK_HREF);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${F.LINK_HREF}$`));
    await settled(page);
    await expect.poll(() => topOf(page), { message: 'the section is scrolled into view', timeout: 5000 })
      .toBeLessThan(NARROW.height / 2);
  });
});
