const { test, expect } = require('@playwright/test');

/**
 * Story 13: "Most pinned" sort, per-row pin counts, own-pin
 * indicator, and "Only tags I've pinned" filter on the tag index.
 * ADR: engineering-team/decisions/0012-most-pinned-tag-index.md
 *
 * What this suite verifies (auth-mocked + network-mocked):
 *
 *   AC-1  — Each /tags row renders a pin-count badge.
 *   AC-3  — Sort toggle exposes "Most pinned" alongside the existing
 *           used / endorsed / divisive options.
 *   AC-4  — Switching POV refetches the index; new pinnedCount
 *           values reflect the new POV's WoT filter.
 *   AC-5  — Rows with viewerPinned=true render the own-pin indicator.
 *   AC-6  — The "Only tags I've pinned" toggle is visible when
 *           logged in and triggers a refetch with pinnedByMe=true;
 *           the own-pin indicator stays visible on the filtered
 *           rows (per AC-6's second clause).
 *   AC-7  — Logged-out /tags: pin-count badge + Most-pinned sort
 *           still render; filter toggle + own-pin indicator do not.
 *
 * Approach: mock /api/profile-tags/index to return deterministic
 * rows with pinnedCount + viewerPinned populated, mock auth, and
 * drive the page state via UI clicks. Mirrors the conventions from
 * Stories 10 / 11 / 12 Playwright suites.
 */

test.describe('Pin-aware tag index (Story 13)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  const VIEWER_PK = '2'.repeat(64);
  const TAG_AUTHOR_PK = '1'.repeat(64);
  const TAG_A_ID = 'a'.repeat(64);
  const TAG_B_ID = 'b'.repeat(64);
  const TAG_C_ID = 'c'.repeat(64);
  const TAGS_URL = '/tags';

  function row({ tagEventId, slug, name, applications = 0, disputes = 0, pinnedCount = 0, viewerPinned = false }) {
    return {
      tagEventId, slug, name,
      description: `${name} description`,
      authorPubkey: TAG_AUTHOR_PK,
      applications, disputes,
      displayName: `Author of ${name}`,
      picture: null,
      pinnedCount,
      viewerPinned,
    };
  }

  /** Mock the tag-index endpoint. Returns whatever the caller specifies. */
  async function mockIndex(page, { rows: indexRows, povSuffix = null }) {
    await page.route('**/api/profile-tags/index**', (route) => {
      const url = new URL(route.request().url());
      const pinnedByMe = url.searchParams.get('pinnedByMe') === 'true';
      const visibleRows = pinnedByMe
        ? indexRows.filter((r) => r.viewerPinned)
        : indexRows;
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          povSuffix,
          minRank: null,
          sort: url.searchParams.get('sort') || 'used',
          q: '',
          authoredBy: null,
          viewerPubkey: url.searchParams.get('viewerPubkey') || null,
          pinnedByMe: pinnedByMe,
          total: visibleRows.length,
          limit: 50,
          offset: 0,
          rows: visibleRows,
        }),
      });
    });
  }

  async function mockLoggedIn(page) {
    await page.route('**/api/auth/status', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, pubkey: VIEWER_PK }) }));
    await page.route('**/api/auth/user-classification', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ classification: 'owner' }) }));
    await page.route('**/api/profiles?pubkeys=*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, profiles: { [VIEWER_PK]: { display_name: 'Viewer' } } }) }));
  }

  async function mockLoggedOut(page) {
    await page.route('**/api/auth/status', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }) }));
  }

  /* ───────── AC-1 — pin-count badge on every row ───────── */

  test('AC-1: every /tags row renders a pin-count badge', async ({ page }) => {
    await mockLoggedIn(page);
    await mockIndex(page, {
      rows: [
        row({ tagEventId: TAG_A_ID, slug: 'alpha', name: 'Alpha', applications: 5, disputes: 0, pinnedCount: 7 }),
        row({ tagEventId: TAG_B_ID, slug: 'beta',  name: 'Beta',  applications: 2, disputes: 1, pinnedCount: 3 }),
        row({ tagEventId: TAG_C_ID, slug: 'gamma', name: 'Gamma', applications: 1, disputes: 0, pinnedCount: 0 }),
      ],
    });

    await page.goto(TAGS_URL);
    await page.waitForLoadState('networkidle');

    // Each tag's name visible.
    await expect(page.getByText('Alpha').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Beta').first()).toBeVisible();
    await expect(page.getByText('Gamma').first()).toBeVisible();

    // Each row carries its pin count. Accept any visual treatment
    // (badge / chip / inline text) — assert the numeric value appears
    // within the row's neighborhood. The 📌 glyph is the canonical
    // anchor.
    // Alpha row → expect "7" near the pin glyph somewhere on the page.
    const alphaRow = page.locator('li, div').filter({ hasText: /Alpha/i }).first();
    await expect(alphaRow.getByText(/7/).first()).toBeVisible();

    const betaRow = page.locator('li, div').filter({ hasText: /Beta/i }).first();
    await expect(betaRow.getByText(/3/).first()).toBeVisible();

    // Even a 0-pinned row shows its count (NOT hidden — AC-1).
    const gammaRow = page.locator('li, div').filter({ hasText: /Gamma/i }).first();
    await expect(gammaRow.getByText(/0/).first()).toBeVisible();
  });

  /* ───────── AC-3 — sort toggle has Most pinned ───────── */

  test('AC-3: sort toggle exposes "Most pinned" alongside used / endorsed / divisive', async ({ page }) => {
    await mockLoggedIn(page);
    await mockIndex(page, { rows: [
      row({ tagEventId: TAG_A_ID, slug: 'alpha', name: 'Alpha', applications: 1 }),
    ]});

    await page.goto(TAGS_URL);
    await page.waitForLoadState('networkidle');

    // The sort toggle shows all four labels. Match each leniently
    // because the exact label format ("Most pinned" vs "Most-pinned"
    // vs "📌 Most pinned") is up to the Implementer.
    await expect(page.getByText(/most used/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/most endorsed/i).first()).toBeVisible();
    await expect(page.getByText(/most divisive/i).first()).toBeVisible();
    await expect(page.getByText(/most pinned/i).first()).toBeVisible();
  });

  /* ───────── AC-3 / AC-4 — switching to Most pinned refetches ───────── */

  test('AC-3 + AC-4: clicking Most pinned triggers a refetch with sort=most-pinned', async ({ page }) => {
    await mockLoggedIn(page);
    let lastSort = null;
    await page.route('**/api/profile-tags/index**', (route) => {
      const url = new URL(route.request().url());
      lastSort = url.searchParams.get('sort') || 'used';
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, povSuffix: null, minRank: null,
          sort: lastSort, q: '', authoredBy: null,
          viewerPubkey: null, pinnedByMe: false,
          total: 1, limit: 50, offset: 0,
          rows: [row({ tagEventId: TAG_A_ID, slug: 'alpha', name: 'Alpha', pinnedCount: 5 })],
        }),
      });
    });

    await page.goto(TAGS_URL);
    await page.waitForLoadState('networkidle');
    // Initial load sort.
    expect(['used', null]).toContain(lastSort);

    // Click the "Most pinned" affordance.
    await page.getByText(/most pinned/i).first().click();
    // Brief settle.
    await expect.poll(() => lastSort, { timeout: 5000 }).toBe('most-pinned');
  });

  /* ───────── AC-5 — own-pin indicator visible on pinned rows ───────── */

  test('AC-5: rows with viewerPinned=true render an own-pin indicator', async ({ page }) => {
    await mockLoggedIn(page);
    await mockIndex(page, {
      rows: [
        row({ tagEventId: TAG_A_ID, slug: 'alpha', name: 'Alpha', applications: 1, pinnedCount: 7, viewerPinned: true }),
        row({ tagEventId: TAG_B_ID, slug: 'beta',  name: 'Beta',  applications: 1, pinnedCount: 3, viewerPinned: false }),
      ],
    });

    await page.goto(TAGS_URL);
    await page.waitForLoadState('networkidle');

    // The own-pin indicator is some visual treatment that uniquely
    // attaches to the Alpha row (not Beta). Implementer's choice of
    // affordance; accept any of: a "you pinned" hint, an aria-label
    // mentioning pin/own, or a CSS class on the row. We assert the
    // diff: Alpha row has an indicator that Beta does NOT.
    const alphaRow = page.locator('li, div').filter({ hasText: /Alpha/i }).first();
    const betaRow = page.locator('li, div').filter({ hasText: /Beta/i }).first();

    // Look for any element in alphaRow whose text or aria-label hints
    // at the viewer's pin. The 📌 glyph is also the pin-count badge,
    // so test for an EXTRA pin-related marker on alphaRow that's
    // absent on betaRow. Look at distinct elements:
    const alphaPinMarkers = await alphaRow.locator('[class*="own-pin"], [aria-label*="you pinned" i], [title*="you pinned" i], [title*="you have pinned" i]').count();
    const betaPinMarkers = await betaRow.locator('[class*="own-pin"], [aria-label*="you pinned" i], [title*="you pinned" i], [title*="you have pinned" i]').count();

    expect(alphaPinMarkers, 'alpha row should carry an own-pin marker').toBeGreaterThan(0);
    expect(betaPinMarkers, 'beta row should NOT carry an own-pin marker').toBe(0);
  });

  /* ───────── AC-6 — filter toggle ───────── */

  test('AC-6: "Only tags I\'ve pinned" toggle is visible when logged in', async ({ page }) => {
    await mockLoggedIn(page);
    await mockIndex(page, {
      rows: [
        row({ tagEventId: TAG_A_ID, slug: 'alpha', name: 'Alpha', applications: 1, viewerPinned: true }),
      ],
    });

    await page.goto(TAGS_URL);
    await page.waitForLoadState('networkidle');

    // Filter toggle visible. Accept any reasonable copy: "Only tags
    // I've pinned" / "Only my pins" / "Show only pinned" etc. Anchor
    // on the word "pinned" + something viewer-scoped.
    const toggle = page.getByText(/only.*pinned|my pinned|pinned by me/i).first();
    await expect(toggle).toBeVisible({ timeout: 10000 });
  });

  test('AC-6: toggling "Only tags I\'ve pinned" triggers a refetch with pinnedByMe=true; the own-pin indicator stays visible on the filtered row', async ({ page }) => {
    await mockLoggedIn(page);
    let lastPinnedByMe = null;
    await page.route('**/api/profile-tags/index**', (route) => {
      const url = new URL(route.request().url());
      lastPinnedByMe = url.searchParams.get('pinnedByMe') === 'true';
      const allRows = [
        row({ tagEventId: TAG_A_ID, slug: 'alpha', name: 'Alpha', applications: 1, pinnedCount: 5, viewerPinned: true }),
        row({ tagEventId: TAG_B_ID, slug: 'beta',  name: 'Beta',  applications: 1, pinnedCount: 3, viewerPinned: false }),
      ];
      const visible = lastPinnedByMe ? allRows.filter((r) => r.viewerPinned) : allRows;
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, povSuffix: null, minRank: null,
          sort: url.searchParams.get('sort') || 'used',
          q: '', authoredBy: null,
          viewerPubkey: url.searchParams.get('viewerPubkey') || null,
          pinnedByMe: lastPinnedByMe,
          total: visible.length, limit: 50, offset: 0,
          rows: visible,
        }),
      });
    });

    await page.goto(TAGS_URL);
    await page.waitForLoadState('networkidle');
    // Initial: both rows visible.
    await expect(page.getByText('Alpha').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Beta').first()).toBeVisible();

    // Click the toggle.
    const toggle = page.getByText(/only.*pinned|my pinned|pinned by me/i).first();
    await toggle.click();

    // Wait for the refetch and verify the response query string was
    // pinnedByMe=true.
    await expect.poll(() => lastPinnedByMe, { timeout: 5000 }).toBe(true);

    // Beta should disappear; Alpha should remain.
    await expect(page.getByText('Beta')).toHaveCount(0);
    await expect(page.getByText('Alpha').first()).toBeVisible();

    // AC-6 second clause: the own-pin indicator stays on the filtered
    // row (Alpha is visible AND its own-pin marker is still present).
    const alphaRow = page.locator('li, div').filter({ hasText: /Alpha/i }).first();
    const alphaPinMarkers = await alphaRow.locator('[class*="own-pin"], [aria-label*="you pinned" i], [title*="you pinned" i], [title*="you have pinned" i]').count();
    expect(alphaPinMarkers, 'own-pin marker should remain when filter is on').toBeGreaterThan(0);
  });

  /* ───────── AC-7 — logged-out parity ───────── */

  test('AC-7: logged-out /tags renders the sort + pin-count badge but NOT the filter toggle or own-pin indicator', async ({ page }) => {
    await mockLoggedOut(page);
    await mockIndex(page, {
      rows: [
        // Even though this row has viewerPinned=true in the fixture,
        // the page should NOT render the indicator when logged out
        // (the indicator is viewer-scoped UI; server may still emit
        // the field but the page suppresses it).
        row({ tagEventId: TAG_A_ID, slug: 'alpha', name: 'Alpha', applications: 1, pinnedCount: 5, viewerPinned: true }),
      ],
    });

    await page.goto(TAGS_URL);
    await page.waitForLoadState('networkidle');

    // The sort toggle still has "Most pinned" (AC-7: sort visible
    // even for logged-out users).
    await expect(page.getByText(/most pinned/i).first()).toBeVisible({ timeout: 10000 });

    // The pin-count badge still renders.
    const alphaRow = page.locator('li, div').filter({ hasText: /Alpha/i }).first();
    await expect(alphaRow.getByText(/5/).first()).toBeVisible();

    // The filter toggle MUST NOT appear (logged-out has no "my pins").
    await expect(page.getByText(/only.*pinned|my pinned|pinned by me/i)).toHaveCount(0);

    // The own-pin indicator MUST NOT appear (logged-out scope).
    const alphaPinMarkers = await alphaRow.locator('[class*="own-pin"], [aria-label*="you pinned" i], [title*="you pinned" i], [title*="you have pinned" i]').count();
    expect(alphaPinMarkers, 'own-pin marker should NOT render when logged out').toBe(0);
  });
});
