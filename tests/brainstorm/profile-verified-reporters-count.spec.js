/**
 * Playwright behavioral check for story verified-reporters #1 / ADR 0001: the
 * profile page shows a "Verified Reporters" count beside "Following" and "Verified
 * Followers", as a state-dependent counter (link only when > 0).
 * See engineering-team/stories/verified-reporters/1-verified-reporters-count.test-plan.md
 *
 * SUPPLEMENTARY + LIVE-DATA DEPENDENT (mirrors the profile-verified-followers-count
 * spec). The deterministic coverage is the node suite
 * test/profile-verified-reporters-count.test.js (no stack dependency). This spec
 * additionally verifies the browser-rendered result and the not-an-anchor behavior
 * that source-regex can only approximate.
 *
 * Preconditions / fragility:
 *   - A reachable Brainstorm instance (BRAINSTORM_BASE_URL or http://localhost:7778)
 *     with the change BUILT into the UI (`npm run build` in ui/) AND House-PoV WoT
 *     scores loaded into Meilisearch (the count comes from
 *     wot_verifiedReporterCount_<houseSuffix>).
 *   - Relies on LIVE DATA. The account below (Jack Dorsey) is a well-indexed account
 *     expected to have trust scores loaded and — being broadly trusted — ZERO
 *     verified reporters under the House PoV, which exercises the "0 → not a link"
 *     state. If scores aren't loaded the counter shows "—" (also not a link).
 *
 * Not run pre-implementation (current code has no such counter); exercised at the
 * staging smoke after the feature deploys.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// Jack Dorsey — a well-indexed account: trust scores loaded, and (broadly trusted)
// expected to have 0 verified reporters under the House PoV.
const ZERO_PUBKEY = '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2';

test.describe('Story verified-reporters #1 — Verified Reporters count on the profile', () => {
  test('a "Verified Reporters" count is shown beside "Following" and "Verified Followers"', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${ZERO_PUBKEY}`);

    await expect(page.getByText('Following', { exact: true })).toBeVisible();
    await expect(page.getByText('Verified Followers', { exact: true })).toBeVisible();
    await expect(page.getByText('Verified Reporters', { exact: true })).toBeVisible();
  });

  test('with 0 verified reporters the counter is NOT a link; the sibling counts remain links', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/${ZERO_PUBKEY}`);

    // AC3: a genuine 0 (or unavailable "—") renders the Verified Reporters counter
    // as plain text, not a <Link> — there is nothing to inspect.
    await expect(page.getByText('Verified Reporters', { exact: true })).toBeVisible();
    expect(
      await page.getByRole('link', { name: /verified reporters/i }).count(),
      'with 0 verified reporters the counter must be plain text, not a <Link> (the link appears only when count > 0).'
    ).toBe(0);

    // Regression: the sibling counts are still same-tab links.
    await expect(page.getByRole('link', { name: /^Following/i })).toHaveAttribute('href', new RegExp(`/user/${ZERO_PUBKEY}/follows$`));
    await expect(page.getByRole('link', { name: /verified followers/i })).toHaveAttribute('href', new RegExp(`/user/${ZERO_PUBKEY}/followers$`));
  });

  // MANUAL / FIXTURE-DEPENDENT (left as a documented check, like the PoV check below):
  // The > 0 state — link to /user/:pubkey/reporters, the --red negative value, and the
  // aria-label "{n} verified reporters. View list." — needs a fixture account that has
  // verified reporters under the active PoV at smoke time. To verify:
  //   1. Pick a pubkey with >0 verified reporters under the House PoV (or pin one via ?pov=).
  //   2. Confirm the "Verified Reporters" count is a same-tab link whose href matches
  //      /\/user\/[0-9a-f]{64}\/reporters$/ and is NOT target=_blank.
  //   3. Confirm its accessible name matches /\d+ verified reporters\. view list\./i.
  //   4. Confirm the value renders in the --red negative color.
  //
  // PoV (AC1) is exercisable by appending ?pov=<8hex> (e.g. ?pov=a1420e44) and confirming
  // the count reflects that PoV when its scores are indexed, falling back to House otherwise.
});
