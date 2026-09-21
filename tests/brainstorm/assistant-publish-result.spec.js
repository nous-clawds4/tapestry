const { test, expect } = require('@playwright/test');

/**
 * assistant-profile #2: Publish the assistant's profile to the right relays, and say what happened —
 * browser half (B-class: what the editor SHOWS after a publish).
 *
 * Story: engineering-team/stories/assistant-profile/2-publish-to-the-right-relays.md
 * ADR:   engineering-team/decisions/assistant-profile/0002-publish-to-configured-relays-report-each.md
 * Node half: test/assistant-publish-relays.test.js (L/P/M/E/G/S).
 *
 * The server's answer is fixed by a route mock, so each test decides exactly what the relays said and
 * asserts only what the editor makes of it:
 *
 *   B0 — the served bundle is the new editor: the old one-line tally is gone.  [prerequisite]
 *   B1 — a mixed result: the summary, then one line per relay — accepted, rejected with the
 *        relay's reason, unreachable with the reason, timed out.               [AC4]
 *   B2 — local-only: the summary says so, and every relay reads skipped.       [AC3]
 *   B3 — the local write failed: the user is told, and no relay line appears.  [AC4 — guard]
 *
 * Prerequisites: BRAINSTORM_BASE_URL pointing at an origin serving the BUILT ui. From an isolated
 * worktree that is `cd ui && npm run build && npx vite preview --port 4173`. Every API call below is
 * route-mocked, so no stack and no relay is touched.
 *
 * B0–B2 FAIL against current code: the editor prints the server's message plus
 * "Pushed to local strfry + X/Y external relays." and has no per-relay lines. B3 passes before and
 * after — the editor already shows `data.error`; it guards that the new local-failure message
 * reaches the user.
 *
 * Re-aimed by assistant-profile #4 (ADR 0004): the editor now lives on the My Assistant page, /assistant —
 * where story 4's AC1 asks for exactly this per-relay result.
 */

const OWNER = 'bb'.repeat(32);
const TA = 'aa'.repeat(32);
const SUBJECT = "The Tapestry Assistant's profile";

const MIXED = {
  success: true, outcome: 'published', localOnly: false,
  assistantPubkey: TA, assistantName: 'Fixture Assistant',
  relays: {
    total: 4, success: 1,
    results: [
      { relay: 'wss://nos.lol', status: 'accepted', reason: '' },
      { relay: 'wss://purplepag.es', status: 'refused', reason: 'blocked: kind 0 only from members' },
      { relay: 'wss://wot.example.org', status: 'unreachable', reason: 'certificate has expired' },
      { relay: 'wss://relay.damus.io', status: 'timeout', reason: '' },
    ],
  },
  message: `${SUBJECT} was saved on this instance's relay and accepted by 1 of 4 relays. 3 did not accept it; see below.`,
};

const KEPT_LOCAL = {
  success: true, outcome: 'kept-local', localOnly: true,
  assistantPubkey: TA, assistantName: 'Fixture Assistant',
  relays: {
    total: 2, success: 0,
    results: [
      { relay: 'wss://nos.lol', status: 'skipped', reason: 'local-only publish mode' },
      { relay: 'wss://purplepag.es', status: 'skipped', reason: 'local-only publish mode' },
    ],
  },
  message: `${SUBJECT} was saved on this instance's relay only: local-only publish mode is on, so it was not sent to any other relay.`,
};

const LOCAL_FAILED = {
  success: false, stage: 'local', localOnly: false,
  relays: { total: 0, success: 0, results: [] },
  error: `${SUBJECT} could not be saved on this instance's relay (strfry import failed), so it was not sent to any other relay.`,
};

test.describe('The publish result, relay by relay (assistant-profile #2)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /** Signed in as the owner, on the My Assistant page; `publish` is what the server answers. */
  async function mock(page, publish) {
    const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // Catch-all FIRST: Playwright resolves overlapping routes in reverse registration order,
    // so the specific handlers below win.
    await page.route('**/api/**', (r) => r.fulfill(json({ success: true })));

    await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
    await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
    await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
    await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
    await page.route('**/api/auth/status', (r) => r.fulfill(json({ authenticated: true, pubkey: OWNER })));
    await page.route('**/api/auth/user-classification', (r) =>
      r.fulfill(json({ classification: 'owner', pubkey: OWNER, assistantPubkey: TA })));
    await page.route('**/api/assistant/status**', (r) => r.fulfill(json({
      success: true, hasRelayKey: true, hasProfile: true, profileSource: 'local', isOwner: true, assistantPubkey: TA,
      profile: { name: 'Fixture Assistant', about: 'fixture' },
      defaults: { name: 'Fixture Assistant', display_name: '', about: 'fixture', picture: '', banner: '', website: '', lud16: '' },
    })));

    const posted = [];
    await page.route('**/api/assistant/publish-profile', (r) => {
      posted.push(r.request().url());
      return r.fulfill(json(publish.body, publish.status || 200));
    });
    return posted;
  }

  async function publishFromEditor(page) {
    await page.goto('/assistant');
    await page.waitForLoadState('networkidle');
    const button = page.getByRole('button', { name: /publish profile/i }).first();
    await expect(button, 'the My Assistant page must show the editor to a signed-in owner').toBeVisible({ timeout: 20000 });
    await button.click();
  }

  /** The editor panel's visible text, runs of spaces collapsed; line breaks kept. */
  async function panelText(page) {
    return (await page.locator('.settings-group').first().innerText()).replace(/[ \t]+/g, ' ');
  }

  const relayLines = (text) => (text.match(/wss:\/\//g) || []).length;

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served bundle is the new editor — the old one-line relay tally is gone', async ({ request, baseURL }) => {
    const index = await request.get('/');
    expect(index.ok(), `${baseURL} did not serve an app shell (HTTP ${index.status()}).`).toBe(true);
    const assets = [...(await index.text()).matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
    expect(assets.length, 'no built JS referenced from the app shell — is this a built UI?').toBeGreaterThan(0);
    const holding = [];
    for (const a of assets) {
      const res = await request.get(a);
      if (res.ok() && (await res.text()).includes('Pushed to local strfry')) holding.push(a);
    }
    expect(holding,
      'the served bundle still contains "Pushed to local strfry", the tally ADR 0002 removes. Either the bundle ' +
      'predates your edit — a source-only change is INVISIBLE to this class, so run `cd ui && npm run build` — or ' +
      'the editor is not updated yet, in which case B1 says so directly.').toEqual([]);
  });

  /* ───────── B1 — AC4: one line per relay ───────── */
  test('B1: after a publish, the editor shows the summary, then one line per relay — accepted, rejected with the relay\'s reason, unreachable with the reason, timed out', async ({ page }) => {
    await mock(page, { body: MIXED });
    await publishFromEditor(page);
    await expect(page.getByText(MIXED.message),
      'AC4: the summary the server wrote must be shown').toBeVisible({ timeout: 15000 });

    const text = await panelText(page);
    const expected = [
      [/wss:\/\/nos\.lol\b[^\n]*\baccepted\b/i, 'wss://nos.lol — accepted'],
      [/wss:\/\/purplepag\.es\b[^\n]*\brejected\b[^\n]*blocked: kind 0 only from members/i, 'wss://purplepag.es — rejected, with its reason'],
      [/wss:\/\/wot\.example\.org\b[^\n]*\bunreachable\b[^\n]*certificate has expired/i, 'wss://wot.example.org — unreachable, with the reason'],
      [/wss:\/\/relay\.damus\.io\b[^\n]*\btimed out\b/i, 'wss://relay.damus.io — timed out'],
    ];
    for (const [re, line] of expected) {
      expect(text, `AC4: "one line per relay" — expected a line reading ${line}. Panel read:\n${text.slice(0, 1200)}`).toMatch(re);
    }
    expect(relayLines(text), `AC4: exactly one line for each of the 4 relays. Panel read:\n${text.slice(0, 1200)}`).toBe(4);
    expect(text, 'the old tally "Pushed to local strfry + X/Y external relays" counted relays without saying which — it must go')
      .not.toMatch(/Pushed to local strfry/);
  });

  /* ───────── B2 — AC3: kept local, by configuration ───────── */
  test('B2: in local-only mode, the editor says the profile was kept on this instance\'s relay, and lists every relay as skipped', async ({ page }) => {
    await mock(page, { body: KEPT_LOCAL });
    await publishFromEditor(page);
    await expect(page.getByText(KEPT_LOCAL.message),
      'AC3: the result must say it was kept local by configuration').toBeVisible({ timeout: 15000 });

    const text = await panelText(page);
    for (const relay of ['nos\\.lol', 'purplepag\\.es']) {
      expect(text, `AC3: each configured relay reads skipped, because of local-only mode. Panel read:\n${text.slice(0, 1200)}`)
        .toMatch(new RegExp(`wss://${relay}\\b[^\\n]*\\bskipped\\b[^\\n]*local-only publish mode`, 'i'));
    }
    expect(relayLines(text), 'one line for each of the 2 configured relays').toBe(2);
    expect(text).not.toMatch(/Pushed to local strfry/);
  });

  /* ───────── B3 — AC4: the local write failed ───────── */
  test('B3: when saving on this instance\'s relay fails, the editor says so — and shows no relay as tried', async ({ page }) => {
    await mock(page, { body: LOCAL_FAILED, status: 500 });
    await publishFromEditor(page);
    await expect(page.getByText(LOCAL_FAILED.error),
      'AC4: the user must be told the local save failed and that nothing was sent').toBeVisible({ timeout: 15000 });
    const text = await panelText(page);
    expect(relayLines(text), `nothing was sent outward, so no relay line may appear. Panel read:\n${text.slice(0, 1200)}`).toBe(0);
  });
});
