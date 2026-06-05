/**
 * Playwright behavioral check for story #30: profile "Website" link must resolve
 * to an absolute external URL even when the kind-0 website value has no scheme.
 * See engineering-team/stories/30-profile-website-link-scheme.test-plan.md
 *
 * Preconditions / fragility:
 *   - A reachable Brainstorm instance (BRAINSTORM_BASE_URL or http://localhost:7778),
 *     with the change deployed.
 *   - This relies on LIVE DATA: the profile below currently has a scheme-less
 *     website ("kate-cate.com"). If that account updates its kind-0 to include a
 *     scheme, the test no longer exercises the scheme-less path (it would still
 *     pass, just not meaningfully). This is supplementary to the deterministic
 *     node unit test (test/profile-website-link.test.js, which has no live-data
 *     dependency). Flagged in the test plan.
 *
 * Fails pre-fix (raw href renders `href="kate-cate.com"`, a relative URL), passes
 * once the href is normalized to an absolute https:// URL.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// Profile whose kind-0 `website` is "kate-cate.com" (no scheme).
const SCHEMELESS_WEBSITE_PUBKEY = 'a366c6a73754786fcb8007a78388f3e62e7c58579a6282a74ebd7c0b2f041044';

test.describe('Story 30 — profile website link (scheme-less URLs)', () => {
  test('the Website link resolves to an absolute external URL, not a relative /user path', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${SCHEMELESS_WEBSITE_PUBKEY}`);

    // The website link's visible text is the scheme-stripped host ("kate-cate.com").
    const link = page.getByRole('link', { name: /kate-cate/i });
    await expect(link).toBeVisible();

    const href = await link.getAttribute('href');
    expect(href, `Website link href should be an absolute http(s) URL, got: ${href}`).toMatch(/^https?:\/\//i);
    // And specifically NOT a relative same-origin /user/... path (the bug).
    expect(href).not.toMatch(/\/user\//);
  });
});
