const { test, expect } = require('@playwright/test');

/**
 * tapestries #5: Add a concept to a Tapestry (add-only, on the existing Exploration page).
 * Story: engineering-team/stories/tapestries/5-add-a-concept-to-a-tapestry.md
 * ADR:   engineering-team/decisions/tapestries/0005-add-concept-add-only-republish.md
 *
 * Network-mocked browser round-trip (the binding wire-shape unit tests live in
 * test/add-a-concept-to-a-tapestry.test.js). Mirrors tapestry-create.spec.js's mocked pattern
 * and tapestry-exploration.spec.js's scan-by-d-tag dispatch.
 *
 * UI contract pinned here: the affordance is a TEXTBOX whose accessible name matches
 * /add a concept/i (e.g. aria-label "Add a concept"), rendered in the existing page's
 * Concepts sidebar; matching concepts appear as buttons named "Add <name>" (the
 * NewTapestry typeahead idiom); PICKING a result performs the save (one concept per save).
 *
 *   E1  — owner + TA-authored tapestry → the affordance is present on the EXISTING page.  [AC-1 +]
 *   E2  — signed-in non-owner (guest) → no affordance (members still render).             [AC-1 −]
 *   E3  — unauthenticated visitor → no affordance.                                        [AC-1 −]
 *   E4  — an ADMIN who is not the owner → no affordance (owner-STRICT; Director ruling).  [AC-1 −]
 *   E5  — owner viewing a tapestry authored by some OTHER pubkey → no affordance.         [AC-1 −]
 *   E6  — the picker excludes current members; non-members are offered.                   [AC-2]
 *   E7  — picking a concept on a TA tapestry POSTs signAs:"assistant" with the SAME d-tag,
 *         prior nodes + relationships intact, the new member appended, created_at newer;
 *         no navigation away from the page.                                               [AC-3]
 *   E8  — on an owner-authored tapestry the save NIP-07-signs and POSTs signAs:"client"
 *         under the owner's key, same d-tag.                                              [AC-3]
 *   E9  — after a successful save the page RE-READS the coordinate and shows the added
 *         concept among the members (scan count grows; no optimistic state).              [AC-4]
 *   E10 — a different, not-signed-in session opening the same uuid afterwards sees the
 *         added concept among the members.                                                [AC-5]
 *   E11 — a failed publish shows a clear inline error and membership is unchanged.        [AC-3 failure]
 *   E12 — the graph-less b0b48b00-shaped tapestry (degraded view) still offers the owner
 *         the affordance; the first add publishes the minimal graph envelope, name tag
 *         still slug-valued.                                                              [AC-1/AC-3 + ADR first-add]
 *   E13 — a tapestry with a MALFORMED graph block offers no affordance.                   [ADR Decision 4]
 *
 * E1, E6–E9, E11, E12 FAIL against the current build (no affordance exists on TapestryDetail).
 * E2–E5, E10, E13 pass today and are the permanent negative/read-path guards.
 */

test.describe('Add a concept to a Tapestry (tapestries #5)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  const TA    = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
  const OWNER = '1111111111111111111111111111111111111111111111111111111111111111';
  const GUEST = '2222222222222222222222222222222222222222222222222222222222222222';
  const THIRD = '3333333333333333333333333333333333333333333333333333333333333333';
  const ADMIN = '4444444444444444444444444444444444444444444444444444444444444444';

  const TA_DTAG  = 'tapestry-farm-a1b2c3d4';
  const OWN_DTAG = 'tapestry-farm-own-9f8e7d6c';
  const B0B_DTAG = 'b0b48b00';

  const BASE_CREATED_AT = 1773183323;

  /** Members-carrying tapestry json: dog + golden retriever, one authored relationship. */
  function farmJson() {
    return {
      tapestry: { slug: 'farmyard', title: 'Farmyard', description: 'animals of the farm' },
      graph: {
        graphType: 'tapestry',
        nodes: [
          { slug: 'concept-header-for-the-concept-of-dogs', uuid: `39998:${TA}:dog`, name: 'dog' },
          { slug: 'concept-header-for-the-concept-of-golden-retrievers', uuid: `39998:${TA}:golden-retriever`, name: 'golden retriever' },
          { slug: 'superset-for-the-concept-of-dogs', uuid: `39999:${TA}:dog-superset`, name: 'superset for the concept of dogs' },
          { slug: 'superset-for-the-concept-of-golden-retrievers', uuid: `39999:${TA}:golden-retriever-superset`, name: 'superset for the concept of golden retrievers' },
        ],
        relationshipTypes: [{ slug: 'CLASS_THREAD_PROPAGATION', alias: 'IS_A_SUPERSET_OF' }],
        relationships: [{
          nodeFrom: { slug: 'superset-for-the-concept-of-dogs' },
          relationshipType: { slug: 'CLASS_THREAD_PROPAGATION' },
          nodeTo: { slug: 'superset-for-the-concept-of-golden-retrievers' },
        }],
        imports: [
          { slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` },
          { slug: 'concept-graph-for-golden-retriever', uuid: `39999:${TA}:golden-retriever-concept-graph` },
        ],
      },
    };
  }

  /** The same json grown by one member (cow) — what the relay returns AFTER a successful add. */
  function grownJson() {
    const j = farmJson();
    j.graph.nodes.push({ slug: 'concept-header-for-the-concept-of-cows', uuid: `39998:${TA}:cow`, name: 'cow' });
    j.graph.imports.push({ slug: 'concept-graph-for-cow', uuid: `39999:${TA}:cow-concept-graph` });
    return j;
  }

  function el(pubkey, dTag, json, extraTags = []) {
    return {
      id: 'f'.repeat(64), pubkey, kind: 39999, created_at: BASE_CREATED_AT,
      tags: [['d', dTag], ['name', dTag], ...extraTags, ['json', JSON.stringify(json)]],
      content: '', sig: '0'.repeat(128),
    };
  }

  // The live-instance shape: bare-hex d-tag, slug-valued name tag, NO graph block.
  function b0bElement() {
    return {
      id: 'f'.repeat(64), pubkey: TA, kind: 39999, created_at: BASE_CREATED_AT,
      tags: [
        ['d', B0B_DTAG],
        ['name', 'tapestry-for-farm-animals'],
        ['z', `39998:${TA}:tapestry`],
        ['json', JSON.stringify({ tapestry: { slug: 'tapestry-for-farm-animals', title: 'Tapestry for Farm Animals', description: 'farm animals for toddlers' } })],
      ],
      content: '', sig: '0'.repeat(128),
    };
  }

  // Concept headers for the picker (kind-39998 scan): two members + cow (a non-member).
  function headerEv(shortSlug, descriptiveSlug, name) {
    return {
      id: 'a'.repeat(64), pubkey: TA, kind: 39998, created_at: BASE_CREATED_AT,
      tags: [['d', shortSlug], ['json', JSON.stringify({
        word: { slug: descriptiveSlug, name },
        conceptHeader: { oNames: { singular: name }, description: `the concept of ${name}s` },
      })]],
      content: '', sig: '0'.repeat(128),
    };
  }
  const CONCEPTS = [
    headerEv('dog', 'concept-header-for-the-concept-of-dogs', 'dog'),
    headerEv('golden-retriever', 'concept-header-for-the-concept-of-golden-retrievers', 'golden retriever'),
    headerEv('cow', 'concept-header-for-the-concept-of-cows', 'cow'),
  ];

  /**
   * Install the route mocks.
   *  - classification: 'owner' | 'admin' | 'guest' | 'unauthenticated' (drives the gate).
   *  - element: the tapestry event the #d scan returns BEFORE a publish.
   *  - grownElement: what the #d scan returns AFTER a publish landed (re-read proof).
   *  - published: captured publish bodies. publishStatus/publishBody: force a failure.
   * Returns { counts } — element-scan request counter (re-read discrimination, E9).
   */
  async function mock(page, {
    classification = 'owner', element, grownElement = null, published = [],
    publishStatus = 200, publishError = null,
  } = {}) {
    const pubkey =
      classification === 'owner' ? OWNER
        : classification === 'admin' ? ADMIN
          : classification === 'unauthenticated' ? null : GUEST;

    const state = { publishedOk: false };
    const counts = { elementScans: 0 };
    const elDtag = element.tags.find((t) => t[0] === 'd')[1];

    // Config plumbing (unmocked ones would hang the load).
    await page.route('**/api/assistant/pubkey', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pubkey: TA }) }));
    await page.route('**/api/owner/pubkey', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pubkey: OWNER }) }));
    await page.route('**/api/relays', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, relays: [] }) }));
    await page.route('**/api/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));

    // Auth.
    await page.route('**/api/auth/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: !!pubkey, pubkey }) }));
    await page.route('**/api/auth/user-classification', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ classification, pubkey, assistantPubkey: TA }) }));
    await page.route('**/api/profiles**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, profiles: {} }) }));

    // strfry scans: kind-39998 → concept headers (the picker); the element's #d → the
    // tapestry (grown after a successful publish); anything else (imports) → empty.
    await page.route('**/api/strfry/scan**', (r) => {
      const raw = r.request().url();
      if (/39998/.test(raw)) {
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: CONCEPTS }) });
      }
      if (raw.includes(elDtag)) {
        counts.elementScans += 1;
        const ev = (state.publishedOk && grownElement) ? grownElement : element;
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [ev] }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [] }) });
    });

    // Publish sink — capture the body; flip the scan to the grown element on success.
    await page.route('**/api/strfry/publish', (r) => {
      const body = r.request().postDataJSON();
      published.push(body);
      if (publishStatus !== 200) {
        return r.fulfill({ status: publishStatus, contentType: 'application/json', body: JSON.stringify({ success: false, error: publishError || 'publish refused' }) });
      }
      state.publishedOk = true;
      const ev = { ...(body.event || {}), id: 'e'.repeat(64), sig: '0'.repeat(128), pubkey: body.signAs === 'assistant' ? TA : (body.event && body.event.pubkey) || OWNER };
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, event: ev }) });
    });

    return { counts };
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

  const urlFor = (pubkey, dTag) => `/tapestry/tapestries/${encodeURIComponent(`39999:${pubkey}:${dTag}`)}`;

  // The affordance contract: a textbox whose accessible name matches /add a concept/i.
  const addBox = (page) => page.getByRole('textbox', { name: /add a concept/i });

  /** Type into the add box and pick the "Add <name>" result — picking IS the save. */
  async function addConcept(page, name) {
    await addBox(page).fill(name);
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).first().click();
  }

  /** Assert the page rendered the tapestry's members (guards the negatives against vacuity). */
  async function expectMembersVisible(page) {
    await expect(page.getByText('dog', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('golden retriever').first()).toBeVisible();
  }

  /* ───────── E1 — owner + TA-authored: the affordance exists, on the existing page ───────── */
  test('E1: the owner sees the add-a-concept affordance on the Exploration page of a TA-authored tapestry', async ({ page }) => {
    await mock(page, { classification: 'owner', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expectMembersVisible(page); // the page is the SAME Exploration page…
    await expect(addBox(page)).toBeVisible({ timeout: 10000 }); // …now carrying the affordance
    expect(page.url()).toContain(TA_DTAG); // no new page
  });

  /* ───────── E2–E4 — non-owner viewers get NO affordance ───────── */
  test('E2: a signed-in non-owner (guest) gets no add affordance', async ({ page }) => {
    await mock(page, { classification: 'guest', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');
    await expectMembersVisible(page);
    await expect(addBox(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /add a concept/i })).toHaveCount(0);
  });

  test('E3: an unauthenticated visitor gets no add affordance', async ({ page }) => {
    await mock(page, { classification: 'unauthenticated', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');
    await expectMembersVisible(page);
    await expect(addBox(page)).toHaveCount(0);
  });

  test('E4: an ADMIN who is not the owner gets no add affordance (the gate is owner-STRICT, not hasAdminAccess)', async ({ page }) => {
    await mock(page, { classification: 'admin', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');
    await expectMembersVisible(page);
    // Director ruling (ADR 0005 Decision 3): an admin may create (#3) but may NOT add here.
    await expect(addBox(page)).toHaveCount(0);
  });

  /* ───────── E5 — foreign-authored tapestry: not editable, even for the owner ───────── */
  test('E5: the owner gets no add affordance on a tapestry authored by someone else\'s pubkey', async ({ page }) => {
    await mock(page, { classification: 'owner', element: el(THIRD, TA_DTAG, farmJson()) });
    await page.goto(urlFor(THIRD, TA_DTAG));
    await page.waitForLoadState('networkidle');
    await expectMembersVisible(page);
    await expect(addBox(page)).toHaveCount(0);
  });

  /* ───────── E6 — only non-members are addable ───────── */
  test('E6: the picker excludes concepts that are already members and offers the ones that are not', async ({ page }) => {
    await mock(page, { classification: 'owner', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    const box = addBox(page);
    await expect(box).toBeVisible({ timeout: 10000 });
    // "dog" is already a member → it must not be offered.
    await box.fill('dog');
    await expect(page.getByRole('button', { name: 'Add dog', exact: true })).toHaveCount(0);
    // "cow" exists on the instance and is NOT a member → offered.
    await box.fill('cow');
    await expect(page.getByRole('button', { name: 'Add cow', exact: true })).toBeVisible();
  });

  /* ───────── E7 — TA branch: add-only republish at the same coordinate ───────── */
  test('E7: picking a concept on a TA tapestry POSTs signAs:"assistant" — same d-tag, prior members + integrations intact, one member appended, created_at newer, no navigation', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', element: el(TA, TA_DTAG, farmJson()), grownElement: el(TA, TA_DTAG, grownJson()), published });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(addBox(page)).toBeVisible({ timeout: 10000 });
    await addConcept(page, 'cow');

    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);
    const body = published[0];
    expect(body.signAs, 'a TA-authored tapestry republishes server-signed as the assistant').toBe('assistant');
    expect(body.event.kind).toBe(39999);
    const dTag = body.event.tags.find((t) => t[0] === 'd');
    expect(dTag && dTag[1], 'the replacement must reuse the EXISTING d-tag (same coordinate — same uuid/URL, no duplicate directory row)').toBe(TA_DTAG);
    const nameTag = body.event.tags.find((t) => t[0] === 'name');
    expect(nameTag && nameTag[1], 'the name tag must be unchanged').toBe(TA_DTAG);
    expect(body.event.created_at, 'the replacement must be strictly newer than the base event').toBeGreaterThan(BASE_CREATED_AT);

    const json = JSON.parse(body.event.tags.find((t) => t[0] === 'json')[1]);
    const base = farmJson();
    expect(json.tapestry, 'title/description unchanged').toEqual(base.tapestry);
    expect(json.graph.relationships, 'prior integrations pass through unchanged').toEqual(base.graph.relationships);
    expect(json.graph.nodes.slice(0, base.graph.nodes.length), 'all prior member nodes still present, in order').toEqual(base.graph.nodes);
    expect(json.graph.nodes.length, 'exactly one node appended').toBe(base.graph.nodes.length + 1);
    expect(json.graph.nodes[json.graph.nodes.length - 1].uuid).toBe(`39998:${TA}:cow`);

    expect(page.url(), 'the save happens on the existing page — no navigation').toContain(TA_DTAG);
  });

  /* ───────── E8 — own-key branch ───────── */
  test('E8: on an owner-authored tapestry the save NIP-07-signs and POSTs signAs:"client" under the owner\'s key, same d-tag', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', element: el(OWNER, OWN_DTAG, farmJson()), grownElement: el(OWNER, OWN_DTAG, grownJson()), published });
    await injectSigner(page, OWNER);
    await page.goto(urlFor(OWNER, OWN_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(addBox(page)).toBeVisible({ timeout: 10000 });
    await addConcept(page, 'cow');

    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);
    const body = published[0];
    expect(body.signAs, 'an owner-key tapestry republishes as a client-signed event').toBe('client');
    expect(body.event.pubkey, 'the replacement is authored under the tapestry\'s EXISTING author key').toBe(OWNER);
    expect(body.event.sig, 'the client path publishes an already-signed event').toBeTruthy();
    const dTag = body.event.tags.find((t) => t[0] === 'd');
    expect(dTag && dTag[1]).toBe(OWN_DTAG);
  });

  /* ───────── E9 — visible to me, by re-read ───────── */
  test('E9: after a successful save the page re-reads the same coordinate and the added concept appears among the members', async ({ page }) => {
    const published = [];
    const { counts } = await mock(page, { classification: 'owner', element: el(TA, TA_DTAG, farmJson()), grownElement: el(TA, TA_DTAG, grownJson()), published });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(addBox(page)).toBeVisible({ timeout: 10000 });
    const scansBefore = counts.elementScans;
    await addConcept(page, 'cow');

    // The member list the owner sees is the PUBLISHED truth: cow only renders because the
    // mock serves the grown event to a fresh scan — optimistic state alone cannot pass this
    // together with the scan-count growth below.
    await expect(page.getByText('cow', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    expect(counts.elementScans, 'the element must be re-read from strfry after the save (reload), not patched locally').toBeGreaterThan(scansBefore);
  });

  /* ───────── E10 — visible to anyone else afterwards ───────── */
  test('E10: a different, not-signed-in session opening the same uuid afterwards sees the added concept among the members', async ({ page }) => {
    // Simulates "afterwards": the relay now holds the grown event; a fresh anonymous
    // session reads the same coordinate through the same read path as every visitor.
    await mock(page, { classification: 'unauthenticated', element: el(TA, TA_DTAG, grownJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expectMembersVisible(page);
    await expect(page.getByText('cow', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(addBox(page)).toHaveCount(0); // and they still cannot edit
  });

  /* ───────── E11 — publish failure: clear error, membership unchanged ───────── */
  test('E11: a failed publish shows a clear inline error and the membership is unchanged', async ({ page }) => {
    const published = [];
    await mock(page, {
      classification: 'owner', element: el(TA, TA_DTAG, farmJson()), grownElement: el(TA, TA_DTAG, grownJson()),
      published, publishStatus: 500, publishError: 'relay refused the event',
    });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(addBox(page)).toBeVisible({ timeout: 10000 });
    await addConcept(page, 'cow');

    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);
    // The owner sees the error the publish path raised…
    await expect(page.getByText(/relay refused the event|failed|error/i).first()).toBeVisible({ timeout: 10000 });
    // …and the tapestry did not change: cow is NOT among the members.
    await expect(page.getByRole('button', { name: 'cow', exact: true })).toHaveCount(0);
  });

  /* ───────── E12 — first add on the graph-less (b0b48b00-shaped) tapestry ───────── */
  test('E12: the graph-less b0b48b00-shaped tapestry still offers the owner the affordance, and the first add publishes the minimal envelope at the same bare-hex coordinate', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', element: b0bElement(), published });
    await page.goto(urlFor(TA, B0B_DTAG));
    await page.waitForLoadState('networkidle');

    // The degraded view (no graph to explore) must still offer the add — otherwise the
    // instance's one real tapestry could never be grown.
    await expect(page.getByText(/Tapestry for Farm Animals/i).first()).toBeVisible({ timeout: 10000 });
    await expect(addBox(page)).toBeVisible({ timeout: 10000 });

    await addConcept(page, 'cow');
    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);
    const body = published[0];
    const dTag = body.event.tags.find((t) => t[0] === 'd');
    expect(dTag && dTag[1], 'the bare-hex d-tag must be reused verbatim').toBe(B0B_DTAG);
    const nameTag = body.event.tags.find((t) => t[0] === 'name');
    expect(nameTag && nameTag[1], 'the slug-valued name tag must NOT be rewritten to the title').toBe('tapestry-for-farm-animals');
    const json = JSON.parse(body.event.tags.find((t) => t[0] === 'json')[1]);
    expect(json.tapestry.title).toBe('Tapestry for Farm Animals');
    expect(json.graph, 'the first add creates the graph envelope').toBeTruthy();
    expect(json.graph.nodes.length, 'the envelope holds exactly the one new member').toBe(1);
    expect(json.graph.nodes[0].uuid).toBe(`39998:${TA}:cow`);
    expect(json.graph.relationships).toEqual([]);
  });

  /* ───────── E13 — malformed graph: no affordance ───────── */
  test('E13: a tapestry whose graph block is malformed (nodes not an array) offers no add affordance', async ({ page }) => {
    const broken = el(TA, TA_DTAG, { tapestry: { slug: 'farmyard', title: 'Farmyard', description: 'x' }, graph: { nodes: 'broken' } });
    await mock(page, { classification: 'owner', element: broken });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Farmyard/i).first()).toBeVisible({ timeout: 10000 });
    // Malformed ≠ absent: the transform would refuse this structure, so nothing is offered.
    await expect(addBox(page)).toHaveCount(0);
  });
});
