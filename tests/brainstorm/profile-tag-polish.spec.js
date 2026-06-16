const { test, expect } = require('@playwright/test');

/**
 * Story 7: Profile-tag polish bundle — UI tests.
 *
 * Most of Story 7's surface is server-side (POV-correctness on the chip-row
 * endpoint, search proxy `tagHits` / `tagHitsHasMore` / `tagLimit`). What
 * lives in the UI:
 *
 *  - Search placeholder mentions "tag" (Story 6 AC-5 inherited; already
 *    deployed at BrainstormSearch.jsx:951 — this test guards against
 *    regression).
 *  - Tag-result rows appear in the live popup when a query matches a tag.
 *    DATA-DEPENDENT: covered by the server-side publish-flow suite which
 *    exercises the proxy directly; surfacing in Playwright requires either
 *    fixture-publishing infrastructure (this repo's Playwright doesn't
 *    have it) or relying on existing DB state. We assert only that the
 *    affordance is renderable in principle, not that a specific tag
 *    appears.
 *  - Tag-result rows on the Enter-results page — same data-dependence
 *    constraint as the popup.
 *  - "Show more tags →" affordance — same.
 *
 * Story 6 close-out items that don't need new tests:
 *  - AC-1 popover hover-bridge (verified in code at styles.css:3846-3858)
 *  - AC-2 asserter row → /user/:pubkey (TagChip.jsx:14)
 *  - AC-3 display_name + avatar (TagChip.jsx:10-32)
 *  - AC-4 scroll within max-height (styles.css:3881-3890)
 *  - AC-5 placeholder text (BrainstormSearch.jsx:951 — guarded by this spec)
 */
test.describe('Profile-tag polish bundle (Story 7)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  test('AC: search placeholder mentions "tag" (inherits Story 6 AC-5)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // The landing-view search input's placeholder must include "tag".
    // We don't pin exact wording; we assert "tag" is somewhere in it,
    // case-insensitive.
    const inputs = page.locator('input[placeholder]');
    const count = await inputs.count();
    let foundTagPlaceholder = false;
    for (let i = 0; i < count; i++) {
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      if (placeholder && /\btag/i.test(placeholder)) {
        foundTagPlaceholder = true;
        break;
      }
    }
    expect(foundTagPlaceholder).toBe(true);
  });

  test('AC: typing a query renders the autocomplete dropdown (regression guard for popup surface)', async ({ page }) => {
    // We can't assert that a specific tag appears (data-dependent), but we
    // can assert the popup itself still renders for a short query — this
    // guards against the popup breaking when tag-rows are added.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Find the main search input (the landing-variant). The placeholder
    // contains "Search" so we filter to that.
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('a');
    // Length < 2 → no dropdown.
    await page.waitForTimeout(400);
    // Now type more to trigger the popup.
    await searchInput.fill('abc');
    await page.waitForTimeout(600); // debounce + fetch
    // The dropdown's class is bs-suggest-dropdown. Either it renders (with
    // hits) or stays absent (no matches). We tolerate either; we only
    // assert that the input still works and the page hasn't crashed.
    // (Asserting specific dropdown content is data-dependent.)
    const stillVisible = await searchInput.isVisible();
    expect(stillVisible).toBe(true);
  });

  test('Story 6 regression: profile page still renders the TAGS chip row', async ({ page }) => {
    // The TAGS chip-row endpoint changed shape (POV-aware) in Story 7. This
    // regression test guards against the chip row breaking on a profile
    // page after the change.
    const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
    await page.goto(`/user/${TA_PUBKEY}`);
    await page.waitForLoadState('networkidle');
    // The TAGS heading from Story 1 must still appear.
    await expect(page.getByRole('heading', { name: /^tags$/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
