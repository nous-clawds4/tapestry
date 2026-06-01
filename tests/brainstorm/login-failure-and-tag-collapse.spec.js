const { test, expect } = require('@playwright/test');

/**
 * Companion e2e for ADR 0021 — the observable behavior the Node
 * source-contract suite (test/login-failure-and-tag-collapse.test.js) can't
 * reach. Auth + search endpoints are mocked; no live data dependency.
 *
 * Bug 1 — login failure surfacing:
 *   AC-6/AC-4 — clicking sign-in with NO signer shows the shared modal with
 *               vendor-neutral copy (no brand names).
 *   AC-1/Decision-3 — a signer that injects LATE must NOT trip a false
 *               "no signer"; login proceeds past the wait (here it reaches the
 *               server, which we make reject → modal shows the SERVER message,
 *               proving the no-signer branch was skipped).
 *
 * Bug 2 — tag-result collapse:
 *   AC-9/AC-10 — with >3 tag hits, only 3 render plus a "N more tags" toggle;
 *               clicking it reveals the rest.
 *
 * Mirrors the auth/window.nostr mocking conventions in
 * tests/brainstorm/pin-a-tag.spec.js.
 */

test.describe('Login failure surfacing + tag-result collapse (ADR 0021)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
    // Deterministically logged-out so the sign-in button is present.
    await page.route('**/api/auth/status', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }) }));
  });

  const modal = (page) => page.locator('.bs-login-error-modal, [role="alertdialog"]');
  const signInButton = (page) =>
    page.getByRole('button', { name: /sign in with nostr/i }).first();

  test('AC-6/AC-4: no signer → shared modal with vendor-neutral copy', async ({ page }) => {
    // No NIP-07 signer at all, and it never injects.
    await page.addInitScript(() => { try { delete window.nostr; } catch {} });

    await page.goto('/');
    await signInButton(page).click();

    await expect(modal(page)).toBeVisible({ timeout: 5000 });
    const text = (await modal(page).innerText()).toLowerCase();
    expect(text).toMatch(/signer/);                 // explains what's needed
    expect(text).not.toMatch(/nos2x|alby/);          // …without naming software
  });

  test('AC-1/Decision-3: a LATE-injected signer must not trip a false "no signer"', async ({ page }) => {
    // window.nostr appears ~400ms after load — after a fast click. The bounded
    // wait must catch it, so login proceeds to the server. We make the server
    // reject, so the modal (if any) shows the SERVER message — never the
    // no-signer copy. That proves the no-signer branch was skipped.
    await page.route('**/api/auth/verify-user', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ authorized: false, message: 'Not in this instance’s web of trust.' }) }));

    await page.addInitScript(() => {
      setTimeout(() => {
        window.nostr = {
          getPublicKey: async () => 'f'.repeat(64),
          signEvent: async (e) => ({ ...e, id: 'a'.repeat(64), sig: 'b'.repeat(128) }),
        };
      }, 400);
    });

    await page.goto('/');
    await signInButton(page).click(); // clicked before injection completes

    // Either no modal, or a modal whose text is the server reason — but NOT the
    // vendor-neutral no-signer copy.
    await page.waitForTimeout(2000);
    if (await modal(page).count() > 0 && await modal(page).isVisible()) {
      const text = (await modal(page).innerText()).toLowerCase();
      expect(text).not.toMatch(/no nostr signer detected|install one/);
      expect(text).toMatch(/web of trust|not authorized/);
    }
  });

  test('AC-9/AC-10: with >3 tag hits, only 3 show until the toggle is clicked', async ({ page }) => {
    const tagHits = Array.from({ length: 6 }, (_, i) => ({
      eventId: String(i).repeat(64).slice(0, 64),
      slug: `tag-${i}`,
      name: `Tag ${i}`,
      description: `fixture tag ${i}`,
    }));
    await page.route('**/api/search/profiles/meili**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, hits: [], tagHits,
          estimatedTotalHits: 0, processingTimeMs: 1, povSuffix: null,
        }) }));

    await page.goto('/?q=fixture');

    const rows = page.locator('.bs-results-taghits .bs-tag-result-row');
    await expect(rows).toHaveCount(3); // collapsed to the first TAG_COLLAPSE_LIMIT

    const toggle = page.locator('.bs-taghits-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText(/3 more tags/i); // 6 − 3

    await toggle.click();
    await expect(rows).toHaveCount(6);                  // expanded
    await expect(toggle).toContainText(/fewer/i);
  });
});
