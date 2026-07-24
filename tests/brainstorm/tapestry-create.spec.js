const { test, expect } = require('@playwright/test');

/**
 * tapestries #3: Create a Tapestry (members-only authoring) — ui/src/pages/tapestries/NewTapestry.jsx
 * at /tapestry/tapestries/new.
 * Story: engineering-team/stories/tapestries/3-create-tapestry.md
 * ADR:   engineering-team/decisions/tapestries/0003-create-tapestry-authoring.md
 *
 * Network-mocked browser round-trip (the binding wire-shape unit tests live in
 * test/create-tapestry.test.js). Verifies:
 *   E1 — the OWNER sees a working form (title, concept picker, signing selector, Create).   [AC Owner-gated +]
 *   E2 — a signed-in NON-owner sees an owner-only notice, no working create form.           [AC Owner-gated −]
 *   E3 — submit with no title / no concept is blocked; nothing is published.                [AC Validation]
 *   E4 — a valid submit as Tapestry Assistant POSTs signAs:"assistant" + a kind-39999        [AC Publish shape +
 *        element z-tagged 39998:<TA>:tapestry with one node/import for the picked concept.    AC Signing selector]
 *   E5 — on success the owner is navigated to the new tapestry's /tapestry/tapestries/:uuid.  [AC Round-trips]
 *   E6 — choosing "my own key" NIP-07-signs and POSTs signAs:"client" (author = owner).       [AC Signing selector]
 *
 * These FAIL against the current build: NewTapestry.jsx is still the inert placeholder.
 * (The "non-owner TA-sign is server-refused" server half is guarded by test/create-tapestry.test.js R3.)
 */

test.describe('Create a Tapestry (tapestries #3)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  const TA    = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
  const OWNER = '1111111111111111111111111111111111111111111111111111111111111111';
  const GUEST = '2222222222222222222222222222222222222222222222222222222222222222';
  const URL = '/tapestry/tapestries/new';

  // Concept-header fixtures for the picker (kind-39998 scan), shaped like the live events:
  // d-tag = short slug, json.word.slug = descriptive slug, json.conceptHeader.oNames.singular = name.
  function headerEv(shortSlug, descriptiveSlug, name) {
    return {
      id: 'a'.repeat(64), pubkey: TA, kind: 39998, created_at: 1784821324,
      tags: [['d', shortSlug], ['json', JSON.stringify({
        word: { slug: descriptiveSlug, name },
        conceptHeader: { oNames: { singular: name } },
      })]],
      content: '', sig: '0'.repeat(128),
    };
  }
  const CONCEPTS = [
    headerEv('dog', 'concept-header-for-the-concept-of-dogs', 'dog'),
    headerEv('golden-retriever', 'concept-header-for-the-concept-of-golden-retrievers', 'golden retriever'),
  ];

  /**
   * Install the common route mocks. `classification` drives the owner gate;
   * captured publish bodies are pushed into `published`.
   */
  async function mock(page, { classification = 'owner', published = [] } = {}) {
    const pubkey = classification === 'owner' || classification === 'admin' ? OWNER
      : classification === 'unauthenticated' ? null : GUEST;

    // Config plumbing (ConfigContext fetches these; unmocked ones would hang the load).
    await page.route('**/api/assistant/pubkey', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pubkey: TA }) }));
    await page.route('**/api/owner/pubkey', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pubkey: OWNER }) }));
    await page.route('**/api/relays', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, relays: [] }) }));
    await page.route('**/api/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));

    // Auth: status → (maybe) classification → profile.
    await page.route('**/api/auth/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: !!pubkey, pubkey }) }));
    await page.route('**/api/auth/user-classification', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ classification, pubkey, assistantPubkey: TA }) }));
    await page.route('**/api/profiles**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, profiles: {} }) }));

    // Concept picker: kind-39998 scan → concept headers. Other scans → empty.
    await page.route('**/api/strfry/scan**', (r) => {
      const raw = r.request().url();
      const is39998 = /%2239998%22|kinds%22%3A%5B39998|39998/.test(raw);
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: is39998 ? CONCEPTS : [] }) });
    });

    // Publish sink — capture the body, echo a signed-looking event back.
    await page.route('**/api/strfry/publish', (r) => {
      const body = r.request().postDataJSON();
      published.push(body);
      const ev = { ...(body.event || {}), id: 'e'.repeat(64), sig: '0'.repeat(128), pubkey: body.signAs === 'assistant' ? TA : (body.event && body.event.pubkey) || OWNER };
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, event: ev }) });
    });
  }

  /** Inject a NIP-07 signer (window.nostr) for the own-key path. */
  async function injectSigner(page, pubkey) {
    await page.addInitScript((pk) => {
      window.nostr = {
        getPublicKey: async () => pk,
        getRelays: async () => ({}),
        signEvent: async (ev) => ({ ...ev, pubkey: pk, id: 'f'.repeat(64), sig: '0'.repeat(128) }),
      };
    }, pubkey);
  }

  async function pickConcept(page, name) {
    // Typeahead: search for the concept, then click its "Add <name>" result row.
    await page.getByRole('textbox', { name: /search concepts/i }).fill(name);
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).first().click();
  }

  /* ───────── E1 — owner sees the working form ───────── */
  test('E1: the owner sees a working create form (title, concept picker, signing selector, Create)', async ({ page }) => {
    await mock(page, { classification: 'owner' });
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel(/title/i).or(page.getByPlaceholder(/tapestry for dog/i)).first()).toBeVisible({ timeout: 10000 });
    // Concept typeahead: the search box is present; the results panel stays hidden until you search.
    await expect(page.getByRole('textbox', { name: /search concepts/i })).toBeVisible();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    const signAs = page.getByRole('combobox'); // the "Sign as" dropdown (the only select on the page)
    await expect(signAs).toBeVisible();
    await expect(signAs.locator('option', { hasText: /Tapestry Assistant/i })).toHaveCount(1);
    await expect(signAs.locator('option', { hasText: /own key/i })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /create tapestry/i })).toBeVisible();
  });

  /* ───────── E2 — non-owner is blocked ───────── */
  test('E2: a signed-in non-owner sees an owner-only notice and no working form', async ({ page }) => {
    await mock(page, { classification: 'guest' });
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/owner/i).first()).toBeVisible({ timeout: 10000 });
    // The editable title control must not be present for a non-owner.
    await expect(page.getByLabel(/title/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /create tapestry/i })).toHaveCount(0);
  });

  /* ───────── E3 — validation blocks; nothing published ───────── */
  test('E3: submitting with no title / no concept is blocked and publishes nothing', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', published });
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /create tapestry/i }).click().catch(() => {});
    await page.waitForTimeout(500);
    expect(published, 'no publish should fire when the form is invalid (no title, no concept)').toHaveLength(0);
    await expect(page.getByText(/required|enter a title|select .* concept/i).first()).toBeVisible();
  });

  /* ───────── E4 — TA publish shape ───────── */
  test('E4: a valid submit as Tapestry Assistant POSTs signAs:"assistant" + a well-formed kind-39999 element', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', published });
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/title/i).or(page.getByPlaceholder(/tapestry for dog/i)).first().fill('My Dogs');
    await pickConcept(page, 'dog');
    await page.getByRole('button', { name: /create tapestry/i }).click();

    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);
    const body = published[0];
    expect(body.signAs, 'default signing identity is the Tapestry Assistant').toBe('assistant');
    expect(body.event.kind).toBe(39999);
    const zTag = body.event.tags.find((t) => t[0] === 'z');
    expect(zTag && zTag[1]).toBe(`39998:${TA}:tapestry`);
    const jsonTag = JSON.parse(body.event.tags.find((t) => t[0] === 'json')[1]);
    expect(jsonTag.tapestry.title).toBe('My Dogs');
    expect(jsonTag.graph.nodes.length).toBe(1);
    expect(jsonTag.graph.imports.length).toBe(1);
    expect(jsonTag.graph.nodes[0].uuid).toBe(`39998:${TA}:dog`);
  });

  /* ───────── E5 — round-trip navigation ───────── */
  test('E5: on success the owner is navigated to the new tapestry page', async ({ page }) => {
    await mock(page, { classification: 'owner' });
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/title/i).or(page.getByPlaceholder(/tapestry for dog/i)).first().fill('My Dogs');
    await pickConcept(page, 'dog');
    await page.getByRole('button', { name: /create tapestry/i }).click();

    // Lands on /tapestry/tapestries/<encoded 39999:TA:tapestry-...>
    await page.waitForURL(new RegExp(`/tapestry/tapestries/39999(%3A|:)${TA}`), { timeout: 10000 });
    expect(page.url()).toContain('tapestry-my-dogs');
  });

  /* ───────── E6 — own-key signing path ───────── */
  test('E6: choosing "my own key" NIP-07-signs and POSTs signAs:"client" (author = owner)', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', published });
    await injectSigner(page, OWNER);
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/title/i).or(page.getByPlaceholder(/tapestry for dog/i)).first().fill('My Dogs');
    await pickConcept(page, 'dog');
    await page.getByRole('combobox').selectOption('client'); // switch signing identity to own key
    await page.getByRole('button', { name: /create tapestry/i }).click();

    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);
    const body = published[0];
    expect(body.signAs, 'own-key path publishes a client-signed event').toBe('client');
    expect(body.event.pubkey, 'client-signed event is authored by the owner').toBe(OWNER);
    expect(body.event.sig, 'client-signed event must carry a signature').toBeTruthy();
    // Round-trip: the redirect must land on the OWNER-keyed coordinate (39999:<OWNER>:…), not the
    // TA's — the own-key event is authored by the owner, so a TA-keyed redirect would 404.
    await page.waitForURL(new RegExp(`/tapestry/tapestries/39999(%3A|:)${OWNER}`), { timeout: 10000 });
  });

  /* ───────── E7 — concept typeahead: panel only while searching; adds to a chip list ───────── */
  test('E7: the results panel appears only while searching; adding a concept moves it into the selected list', async ({ page }) => {
    await mock(page, { classification: 'owner' });
    await page.goto(URL);
    await page.waitForLoadState('networkidle');

    const search = page.getByRole('textbox', { name: /search concepts/i });
    // Empty search → no results panel (the space-saving behavior).
    await expect(page.getByRole('listbox')).toHaveCount(0);
    // Typing shows matching concepts.
    await search.fill('dog');
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add dog', exact: true })).toBeVisible();
    // Adding it → becomes a removable chip and drops out of the results.
    await page.getByRole('button', { name: 'Add dog', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove dog', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add dog', exact: true })).toHaveCount(0);
    // Clearing the search hides the panel again; the chip persists.
    await search.fill('');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove dog', exact: true })).toBeVisible();
    // Removing the chip empties the selection.
    await page.getByRole('button', { name: 'Remove dog', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove dog', exact: true })).toHaveCount(0);
  });
});
