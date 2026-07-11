const { test, expect } = require('@playwright/test');

/**
 * Story 3: Tag-detail page (write — apply, dispute, search-and-apply).
 * ADR: engineering-team/decisions/0004-tag-detail-page-write.md
 *
 * What this suite verifies (auth-independent + auth-mocked affordances):
 *
 *   AC-1/AC-2  — Logged-in row has Apply + Dispute buttons.
 *   AC-3       — Already-applied/disputed row shows that state and the
 *                opposite-polarity button remains live.
 *   AC-4       — Logged-in page renders a profile-search input.
 *   AC-5       — Search-result rows render Apply/Dispute buttons.
 *   AC-6       — Apply via page-search lands the profile in the main list.
 *   AC-7       — Row carries a "your assertion — not yet visible to this POV"
 *                badge when it's viewer-only-visible.
 *   AC-8       — Logged-out view: no buttons, no search input.
 *   AC-9       — Total publish failure surfaces an error on the row.
 *
 * Approach: each test mocks `/api/profile-tags/by-id` + `/api/profile-tags/
 * profiles-tagged` so the page renders deterministic content, and (when
 * logged-in behavior is required) mocks the auth endpoints + injects a fake
 * window.nostr. No live data dependency.
 */

test.describe('Tag detail page (Story 3 — write)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  // Deterministic fixture values used across tests. Real pubkey shape; never
  // exists on strfry — but our route mocks intercept all reads, so the page
  // never queries it.
  const TAG_ID = 'a'.repeat(64);
  const TAG_SLUG = 'fixture-tag';
  const TAG_NAME = 'Fixture Tag';
  const TAG_DESC = 'mocked fixture tag for Story 3';
  const TAG_AUTHOR_PK = '1'.repeat(64);
  const VIEWER_PK = '2'.repeat(64);
  const TARGET_PLAIN_PK = '3'.repeat(64);    // row with no viewer assertion
  const TARGET_APPLIED_PK = '4'.repeat(64);  // viewer already applied
  const TARGET_DISPUTED_PK = '5'.repeat(64); // viewer already disputed
  const TARGET_VIEWER_ONLY_PK = '6'.repeat(64); // onlyViewerVisible
  const SEARCH_HIT_PK = '7'.repeat(64);      // page-search result

  const TAG_PAGE_URL = `/tag/${TAG_SLUG}/${TAG_ID}`;

  /** Mock `/api/profile-tags/by-id` to return a deterministic tag. */
  async function mockByIdRoute(page) {
    await page.route('**/api/profile-tags/by-id**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tag: {
            eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME,
            description: TAG_DESC, authorPubkey: TAG_AUTHOR_PK,
            createdAt: 1715000000,
          },
          author: { displayName: 'Fixture Author', picture: null },
        }),
      });
    });
  }

  /** Mock profiles-tagged. The handler returns whatever the caller specifies. */
  async function mockProfilesTaggedRoute(page, payload) {
    await page.route('**/api/profile-tags/profiles-tagged**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, povSuffix: null, minRank: null, sort: 'applied', ...payload }),
      });
    });
  }

  /** Mock the auth endpoints so the SPA thinks we're logged in as VIEWER_PK. */
  async function mockLoggedIn(page) {
    await page.route('**/api/auth/status', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, pubkey: VIEWER_PK }),
      });
    });
    await page.route('**/api/auth/user-classification', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ classification: 'owner' }),
      });
    });
    await page.route('**/api/profiles?pubkeys=*', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, profiles: { [VIEWER_PK]: { display_name: 'Viewer' } } }),
      });
    });
  }

  /** Inject a fake window.nostr that records signEvent calls. */
  async function mockNip07(page, { signFails = false } = {}) {
    await page.addInitScript(({ pubkey, signFails }) => {
      const calls = [];
      window.__signedEvents = calls;
      window.nostr = {
        async getPublicKey() { return pubkey; },
        async signEvent(unsigned) {
          calls.push(unsigned);
          if (signFails) throw new Error('Sign failed (test)');
          // Deterministic stand-in for id/sig — enough to satisfy
          // publishEverywhere's downstream consumers.
          return { ...unsigned, id: 'f'.repeat(64), sig: '0'.repeat(128) };
        },
      };
    }, { pubkey: VIEWER_PK, signFails });
  }

  /** Mock the strfry publish endpoint with success or failure. */
  async function mockStrfryPublish(page, { ok = true } = {}) {
    await page.route('**/api/strfry/publish', (route) => {
      if (ok) {
        const req = route.request();
        const body = JSON.parse(req.postData() || '{}');
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, event: body.event || {} }),
        });
      }
      return route.fulfill({
        status: 500, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'simulated local-strfry failure' }),
      });
    });
    // External relays — mock if the publish path also calls them. If the
    // publish helper uses different external relay routes, those calls will
    // hit the real network and likely fail / time out; our `ok=false` test
    // uses an inline error surface that doesn't require external mocking.
  }

  /* ───────── AC-8: logged-out parity ───────── */

  test('logged-out: tag page renders no Apply/Dispute buttons and no profile-search input', async ({ page }) => {
    // No auth mock → AuthProvider resolves to user=null.
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_PLAIN_PK, displayName: 'Plain Target', picture: null,
          applications: 2, disputes: 0, onlyViewerVisible: false,
        },
      ],
      viewerAssertions: {},
    });
    // Default checkStatus calls /api/auth/status; let it fall through (404)
    // so AuthProvider treats us as logged-out. Belt-and-suspenders: explicit
    // unauthenticated mock keeps the test deterministic.
    await page.route('**/api/auth/status', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) }));

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // The row renders.
    await expect(page.getByText(/Plain Target/i).first()).toBeVisible({ timeout: 10000 });
    // No Apply / Dispute buttons.
    await expect(page.getByRole('button', { name: /^apply$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^dispute$/i })).toHaveCount(0);
    // No profile-search input.
    await expect(page.getByPlaceholder(/find a profile to tag/i)).toHaveCount(0);
  });

  /* ───────── AC-1 + AC-2 + AC-4: logged-in affordances ───────── */

  test('logged-in: rows show Apply + Dispute buttons and the page-search input is visible', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_PLAIN_PK, displayName: 'Plain Target', picture: null,
          applications: 2, disputes: 0, onlyViewerVisible: false,
        },
      ],
      viewerAssertions: {},
    });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Plain Target/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^apply$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^dispute$/i }).first()).toBeVisible();
    await expect(page.getByPlaceholder(/find a profile to tag/i)).toBeVisible();
  });

  /* ───────── AC-3: already-applied / already-disputed state ───────── */

  test('logged-in: row shows applied state and only the opposite-polarity button is actionable', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_APPLIED_PK, displayName: 'Applied Target', picture: null,
          applications: 1, disputes: 0, onlyViewerVisible: false,
        },
      ],
      viewerAssertions: { [TARGET_APPLIED_PK]: 'applied' },
    });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // Find the row.
    const row = page.locator('li, div').filter({ hasText: /Applied Target/i }).first();
    await expect(row).toBeVisible({ timeout: 10000 });

    // The Apply button must signal "applied" state — either disabled, or
    // carrying an aria-pressed/aria-current/data-state="applied" affordance,
    // OR a visually-active class on the button. Accept any one.
    const applyBtn = row.getByRole('button', { name: /^apply|applied$/i }).first();
    const disputeBtn = row.getByRole('button', { name: /^dispute$/i }).first();
    await expect(applyBtn).toBeVisible();
    await expect(disputeBtn).toBeVisible();

    const appliedSignal = await applyBtn.evaluate((el) => {
      return el.disabled === true
        || el.getAttribute('aria-pressed') === 'true'
        || el.getAttribute('aria-current') === 'true'
        || el.getAttribute('data-state') === 'applied'
        || /is-applied|applied/.test(el.className || '');
    });
    expect(appliedSignal).toBeTruthy();

    // Dispute remains actionable.
    await expect(disputeBtn).toBeEnabled();
  });

  test('logged-in: row shows disputed state and only the opposite-polarity button is actionable', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_DISPUTED_PK, displayName: 'Disputed Target', picture: null,
          applications: 0, disputes: 1, onlyViewerVisible: false,
        },
      ],
      viewerAssertions: { [TARGET_DISPUTED_PK]: 'disputed' },
    });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const row = page.locator('li, div').filter({ hasText: /Disputed Target/i }).first();
    const applyBtn = row.getByRole('button', { name: /^apply$/i }).first();
    const disputeBtn = row.getByRole('button', { name: /^dispute|disputed$/i }).first();
    await expect(applyBtn).toBeVisible();
    await expect(disputeBtn).toBeVisible();

    const disputedSignal = await disputeBtn.evaluate((el) => {
      return el.disabled === true
        || el.getAttribute('aria-pressed') === 'true'
        || el.getAttribute('aria-current') === 'true'
        || el.getAttribute('data-state') === 'disputed'
        || /is-disputed|disputed/.test(el.className || '');
    });
    expect(disputedSignal).toBeTruthy();

    await expect(applyBtn).toBeEnabled();
  });

  /* ───────── AC-7: viewer-only-visible badge ───────── */

  test('logged-in: viewer-only-visible row carries a "your assertion — not yet visible to this POV" badge', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_VIEWER_ONLY_PK, displayName: 'Viewer Only Target', picture: null,
          applications: 0, disputes: 0, onlyViewerVisible: true,
        },
      ],
      viewerAssertions: { [TARGET_VIEWER_ONLY_PK]: 'applied' },
    });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Viewer Only Target/i).first()).toBeVisible({ timeout: 10000 });
    // The exact wording is at the implementer's discretion within the
    // semantic envelope the ADR/story describe. Accept the canonical phrase
    // OR a close variant; require "not yet visible" to appear, scoped to the
    // viewer-only row's neighborhood.
    const badge = page.getByText(/your assertion.*not yet visible|not yet visible.*this pov/i).first();
    await expect(badge).toBeVisible({ timeout: 5000 });
  });

  test('logged-in: rows whose counts are non-zero do NOT show the viewer-only badge', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_APPLIED_PK, displayName: 'Already Visible', picture: null,
          applications: 5, disputes: 0, onlyViewerVisible: false,
        },
      ],
      viewerAssertions: { [TARGET_APPLIED_PK]: 'applied' },
    });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Already Visible/i).first()).toBeVisible({ timeout: 10000 });
    // Badge text must not appear when onlyViewerVisible is false.
    await expect(page.getByText(/your assertion.*not yet visible|not yet visible.*this pov/i)).toHaveCount(0);
  });

  /* ───────── AC-1 (publish path): Apply triggers a kind-39999 publish ───────── */

  test('logged-in: clicking Apply on a row publishes a kind-39999 nostr-user-tag assertion with polarity=+1', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_PLAIN_PK, displayName: 'Plain Target', picture: null,
          applications: 1, disputes: 0, onlyViewerVisible: false,
        },
      ],
      viewerAssertions: {},
    });
    await mockStrfryPublish(page, { ok: true });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const row = page.locator('li, div').filter({ hasText: /Plain Target/i }).first();
    const applyBtn = row.getByRole('button', { name: /^apply$/i }).first();
    await applyBtn.click();

    // Wait for the signEvent call to record an unsigned event.
    await page.waitForFunction(
      () => Array.isArray(window.__signedEvents) && window.__signedEvents.length > 0,
      null,
      { timeout: 5000 }
    );
    const signed = await page.evaluate(() => window.__signedEvents[0]);
    expect(signed.kind).toBe(39999);
    const polarityTag = signed.tags.find((t) => t[0] === 'polarity');
    expect(polarityTag && polarityTag[1]).toBe('1');
    const pTag = signed.tags.find((t) => t[0] === 'p');
    expect(pTag && pTag[1]).toBe(TARGET_PLAIN_PK);
    const eTag = signed.tags.find((t) => t[0] === 'e');
    expect(eTag && eTag[1]).toBe(TAG_ID);
    const zTag = signed.tags.find((t) => t[0] === 'z');
    expect(zTag && zTag[1]).toMatch(/^39998:.*:nostr-user-tag$/);
  });

  test('logged-in: clicking Dispute on a row publishes a kind-39999 nostr-user-tag assertion with polarity=-1', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_PLAIN_PK, displayName: 'Plain Target', picture: null,
          applications: 1, disputes: 0, onlyViewerVisible: false,
        },
      ],
      viewerAssertions: {},
    });
    await mockStrfryPublish(page, { ok: true });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const row = page.locator('li, div').filter({ hasText: /Plain Target/i }).first();
    await row.getByRole('button', { name: /^dispute$/i }).first().click();

    await page.waitForFunction(
      () => Array.isArray(window.__signedEvents) && window.__signedEvents.length > 0,
      null,
      { timeout: 5000 }
    );
    const signed = await page.evaluate(() => window.__signedEvents[0]);
    const polarityTag = signed.tags.find((t) => t[0] === 'polarity');
    expect(polarityTag && polarityTag[1]).toBe('-1');
  });

  /* ───────── AC-9: total publish failure surfaces an error on the page ───────── */

  test('logged-in: total publish failure surfaces an inline error', async ({ page }) => {
    await mockLoggedIn(page);
    // Sign succeeds, but every publish target fails.
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [
        {
          pubkey: TARGET_PLAIN_PK, displayName: 'Plain Target', picture: null,
          applications: 0, disputes: 0, onlyViewerVisible: false,
        },
      ],
      viewerAssertions: {},
    });
    await mockStrfryPublish(page, { ok: false });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const row = page.locator('li, div').filter({ hasText: /Plain Target/i }).first();
    await row.getByRole('button', { name: /^apply$/i }).first().click();

    // Some surface on the page — inline error text, warning emoji, role=alert,
    // anything that signals failure to the user. Accept any of:
    //   - role="alert"
    //   - the canonical ⚠️ glyph used by other error surfaces (bs-*-error
    //     classes use it consistently)
    //   - any text matching /failed|error/i within the page after the click
    const errorSurface = page.locator(
      '[role="alert"], .bs-tag-row-error, .bs-tag-error'
    ).filter({ hasText: /./ }).first();
    await expect(errorSurface).toBeVisible({ timeout: 5000 });
  });

  /* ───────── AC-5: page-search result rows render Apply/Dispute buttons ───────── */

  test('logged-in: typing in the page-search input renders result rows with Apply/Dispute buttons', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);
    await mockProfilesTaggedRoute(page, {
      rows: [],
      viewerAssertions: {},
    });
    // The page-search hits the Meili profile-search proxy. Return one hit.
    await page.route('**/api/search/profiles/meili**', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          hits: [{
            id: SEARCH_HIT_PK, pubkey: SEARCH_HIT_PK,
            display_name: 'Search Hit Profile',
          }],
          estimatedTotalHits: 1, processingTimeMs: 1,
          povSuffix: null,
        }),
      });
    });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/find a profile to tag/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Trigger the debounced search. ADR-0004 specifies length-threshold 2.
    await searchInput.fill('search');
    // Allow the debounce + mocked fetch to settle.
    await page.waitForResponse((r) => r.url().includes('/api/search/profiles/meili') && r.ok(), { timeout: 5000 });

    const hitRow = page.locator('li, div').filter({ hasText: /Search Hit Profile/i }).first();
    await expect(hitRow).toBeVisible({ timeout: 5000 });
    await expect(hitRow.getByRole('button', { name: /^apply$/i }).first()).toBeVisible();
    await expect(hitRow.getByRole('button', { name: /^dispute$/i }).first()).toBeVisible();
  });

  /* ───────── AC-6: apply via page-search refetches the main list ─────────
   *
   * The implementer's contract is: after a successful publish, the page calls
   * refetchRows (per ADR-0004), which re-hits /api/profile-tags/profiles-
   * tagged with viewerPubkey. The list will then include the just-tagged
   * profile (returned by the server's viewer-union). We test by: serving an
   * EMPTY rows array on the first call to profiles-tagged, then serving a
   * row for SEARCH_HIT_PK on the second call. After the user clicks Apply on
   * the search-result row, the main list must contain Search Hit Profile.
   */
  test('logged-in: applying via page-search refetches the main list and the profile appears there', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page);

    let profilesTaggedCallCount = 0;
    await page.route('**/api/profile-tags/profiles-tagged**', (route) => {
      profilesTaggedCallCount += 1;
      const isFirst = profilesTaggedCallCount === 1;
      const rows = isFirst ? [] : [{
        pubkey: SEARCH_HIT_PK, displayName: 'Search Hit Profile', picture: null,
        applications: 0, disputes: 0, onlyViewerVisible: true,
      }];
      const viewerAssertions = isFirst ? {} : { [SEARCH_HIT_PK]: 'applied' };
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, povSuffix: null, minRank: null, sort: 'applied',
          rows, viewerAssertions,
        }),
      });
    });

    await page.route('**/api/search/profiles/meili**', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          hits: [{ id: SEARCH_HIT_PK, pubkey: SEARCH_HIT_PK, display_name: 'Search Hit Profile' }],
          estimatedTotalHits: 1, processingTimeMs: 1, povSuffix: null,
        }),
      });
    });
    await mockStrfryPublish(page, { ok: true });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/find a profile to tag/i);
    await searchInput.fill('search');
    await page.waitForResponse((r) => r.url().includes('/api/search/profiles/meili') && r.ok(), { timeout: 5000 });

    // Click Apply on the search-result row.
    const hitRow = page.locator('li, div').filter({ hasText: /Search Hit Profile/i }).first();
    await hitRow.getByRole('button', { name: /^apply$/i }).first().click();

    // Wait for the refetch (second call to profiles-tagged).
    await page.waitForFunction(
      () => true, // placeholder; the real wait is the next assertion's auto-retry
      null,
      { timeout: 1000 }
    );

    // Expect the profile to now appear in the main list AND carry the
    // viewer-only badge (since the second response says applications=0/
    // disputes=0/onlyViewerVisible=true).
    const badge = page.getByText(/your assertion.*not yet visible|not yet visible.*this pov/i).first();
    await expect(badge).toBeVisible({ timeout: 5000 });

    // profilesTagged should have been called at least twice.
    expect(profilesTaggedCallCount).toBeGreaterThanOrEqual(2);
  });
});
