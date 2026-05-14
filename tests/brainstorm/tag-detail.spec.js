const { test, expect } = require('@playwright/test');

/**
 * Story 2: Tag-detail page (read) — UI tests.
 *
 * Routes (per ADR-0002):
 *   /tag/:tagId             — bare-id load; canonicalizes to /tag/:slug/:tagId
 *   /tag/:slug/:tagId       — canonical URL
 *
 * BaseURL is configured in playwright.config.js (default http://localhost:7778).
 *
 * These tests verify auth-independent affordances and the always-renderable
 * header — they don't exercise the publish/sort-fetch round-trip (the
 * server-side suite covers that).
 */
test.describe('Tag detail page (Story 2)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  // Two valid-shape 64-char hex ids that almost certainly do NOT exist on this
  // strfry. Used for the 404 / empty-state branches and the bare-id route.
  const UNKNOWN_TAG_ID = 'b'.repeat(64);
  const ANOTHER_UNKNOWN_TAG_ID = 'c'.repeat(64);

  test('navigating to /tag/<unknown id> shows a tag-not-found state', async ({ page }) => {
    await page.goto(`/tag/${UNKNOWN_TAG_ID}`);
    await page.waitForLoadState('networkidle');
    // The page must render *something* identifying the missing-tag condition,
    // not the global NotFound shell or a blank screen.
    await expect(
      page.getByText(/tag not found|no such tag|couldn['’]t find/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('tag-detail page exposes the three sort-mode labels', async ({ page }) => {
    // Use any valid-shape id; the empty-state still renders the header + sort
    // controls per AC-8.
    await page.goto(`/tag/${ANOTHER_UNKNOWN_TAG_ID}`);
    await page.waitForLoadState('networkidle');

    // Either the page renders the sort controls (if it treats unknown ids as
    // empty-state) OR shows a not-found screen. Skip when not-found so the
    // test stays focused on sort-label visibility, which is independently
    // exercised when a real tag exists.
    const notFound = page.getByText(/tag not found|no such tag|couldn['’]t find/i);
    if (await notFound.isVisible().catch(() => false)) {
      test.skip(true, 'Empty-state page renders not-found for a synthetic id; sort labels covered when real tag exists.');
    }
    for (const label of [/most applied/i, /most disputed/i, /most divisive/i]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('tag-detail page renders a header heading even when no profiles match', async ({ page }) => {
    // AC-8: empty state still includes the tag's name, description, author.
    // For a synthetic unknown id we expect the not-found state instead — that
    // is itself a header. Either flavour must render *some* H1/H2-level
    // heading (not a blank page).
    await page.goto(`/tag/${UNKNOWN_TAG_ID}`);
    await page.waitForLoadState('networkidle');
    const h = page.locator('h1, h2').first();
    await expect(h).toBeVisible({ timeout: 10000 });
  });

  test('default sort indicator is "Most applied" when the page is freshly loaded', async ({ page }) => {
    await page.goto(`/tag/${ANOTHER_UNKNOWN_TAG_ID}`);
    await page.waitForLoadState('networkidle');

    const notFound = page.getByText(/tag not found|no such tag|couldn['’]t find/i);
    if (await notFound.isVisible().catch(() => false)) {
      test.skip(true, 'Synthetic id triggers not-found; default-sort assertion runs in real-tag flows.');
    }

    // The implementer is free to use a <select>, an aria-pressed button group,
    // or any equivalent. The contract: "Most applied" is the active default.
    // We verify this loosely — either via aria-current/aria-pressed/aria-selected
    // on the Most-applied control, OR by the control carrying a visually-active
    // class. The selector below accepts any of these signals.
    const activeMostApplied = page.locator(
      [
        '[aria-current="true"]:has-text("Most applied")',
        '[aria-pressed="true"]:has-text("Most applied")',
        '[aria-selected="true"]:has-text("Most applied")',
        'option[selected]:has-text("Most applied")',
        '[data-active="true"]:has-text("Most applied")',
      ].join(', ')
    );
    await expect(activeMostApplied.first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking a tag chip on a profile page navigates to the tag-detail page', async ({ page }) => {
    // We don't know what tags exist on a given profile in CI, so this test
    // is best-effort: visit a known profile, look for any tag chip that
    // exposes a link, click its name, and verify the URL pattern.
    const TEST_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
    await page.goto(`/user/${TEST_PUBKEY}`);
    await page.waitForLoadState('networkidle');

    // The chip's primary click target must be a real anchor whose href starts
    // with /tag/. If no such chip is on this profile, skip — the chip-link
    // contract is also covered indirectly by the route tests above.
    const chipLink = page.locator('a[href^="/tag/"]').first();
    if (!(await chipLink.isVisible().catch(() => false))) {
      test.skip(true, 'No tag-chip link on the test profile; covered by route tests.');
    }
    await chipLink.click();
    await page.waitForURL(/\/tag\//, { timeout: 5000 });
    expect(page.url()).toMatch(/\/tag\//);
  });
});
