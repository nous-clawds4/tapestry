const { test, expect } = require('@playwright/test');

/**
 * Story 4: Tag index page — UI tests.
 *
 * Route (per ADR-0003): /tags
 *
 * BaseURL is configured in playwright.config.js (default http://localhost:7778).
 *
 * Covers the auth-independent affordances: TopBar nav entry, sort labels,
 * default-sort indicator, search-input reuse, empty state. Server-side
 * algorithm correctness is covered in test/tag-index-publish.test.js.
 */
test.describe('Tag index page (Story 4)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  test('AC-1: an "All tags" link on the single-tag-view page reaches /tags', async ({ page }) => {
    // Per user direction during implementation, the tag-index entry point
    // lives only on the single-tag-view page (not in the global app top-nav).
    // Use a synthetic unknown tagId — Tag.jsx still renders its TopBar (with
    // the "All tags" link) even in the not-found state.
    const UNKNOWN_TAG_ID = 'b'.repeat(64);
    await page.goto(`/tag/${UNKNOWN_TAG_ID}`);
    await page.waitForLoadState('networkidle');
    const allTagsLink = page.locator('a[href="/tags"]').first();
    await expect(allTagsLink).toBeVisible({ timeout: 10000 });
    await allTagsLink.click();
    await page.waitForURL(/\/tags$/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/tags$/);
  });

  test('AC-4: three sort-mode labels are present on /tags', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');
    for (const label of [/most used/i, /most endorsed/i, /most divisive/i]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('AC-5: default sort indicator is "Most used"', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');
    // Implementer is free to use <select>, aria-pressed buttons, or any
    // equivalent active-state signal. We accept any of these on the
    // "Most used" control.
    const activeMostUsed = page.locator(
      [
        '[aria-current="true"]:has-text("Most used")',
        '[aria-pressed="true"]:has-text("Most used")',
        '[aria-selected="true"]:has-text("Most used")',
        'option[selected]:has-text("Most used")',
        '[data-active="true"]:has-text("Most used")',
      ].join(', ')
    );
    await expect(activeMostUsed.first()).toBeVisible({ timeout: 5000 });
  });

  test('AC-7: /tags reuses the same search-bar visual treatment as the root app', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');
    // The shared <SearchInput> component wraps in .bs-search-box-results
    // (results variant) — the same class the root app uses post-search.
    // Verifying the class proves the extraction was reused.
    const sharedBox = page.locator('.bs-search-box-results').first();
    await expect(sharedBox).toBeVisible({ timeout: 5000 });
    const sharedInput = sharedBox.locator('input.bs-search-input-results').first();
    await expect(sharedInput).toBeVisible({ timeout: 5000 });
  });

  test('AC-10: empty state still renders the page heading on a fresh /tags load', async ({ page }) => {
    // The empty state isn't deterministic against shared test data — on a DB
    // with no WoT-known tags, /tags renders the empty-state CTA; on a DB
    // with tags, it renders rows. Either way, the page heading must be
    // visible. This guards against regressions that blank the page.
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');
    const h = page.locator('h1, h2').first();
    await expect(h).toBeVisible({ timeout: 10000 });
  });
});
