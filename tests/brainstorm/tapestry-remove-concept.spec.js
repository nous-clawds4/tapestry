const { test, expect } = require('@playwright/test');

/**
 * tapestries #6: Take a concept back out of a Tapestry (remove-only, on the existing
 * Exploration page).
 * Story: engineering-team/stories/tapestries/6-take-a-concept-back-out.md
 * ADR:   engineering-team/decisions/tapestries/0006-remove-concept-remove-only-republish.md
 *
 * Network-mocked browser round-trip (the binding wire-shape unit tests live in
 * test/take-a-concept-back-out.test.js). Mirrors tapestry-add-concept.spec.js's mocked
 * pattern. ALL network is page.route-mocked: nothing reads or writes any relay, and the
 * live b0b48b00 element is never touched.
 *
 * UI contract pinned here (Tester's mechanics under ADR 0006 Decision 5):
 *   - Per-member take-out control: a BUTTON whose accessible name is `Take out <name>`
 *     (e.g. aria-label "Take out cow"), rendered with the members in the existing page's
 *     Concepts sidebar when the tapestry is editable and holds >= 2 authored concepts.
 *   - Arming publishes NOTHING: an inline confirm step appears naming the member
 *     (text matching /Take out .*<name>/i) with buttons "Take out" (exact) and "Cancel".
 *   - Exactly-one-concept tapestries show the plain-language refusal
 *     (/keeps at least one concept/i) INSTEAD of any control.
 *   - After a successful save the element scan serves back THE PUBLISHED BODY, so what
 *     renders post-save is exactly what the implementation published — and import scans
 *     keep resolving every member's concept-graph, so a replacement that removed the node
 *     but kept its import re-materializes the member at compose time and FAILS "gone".
 *
 *   E1  — owner + TA-authored tapestry → per-member take-out controls on the page.  [AC-1 +]
 *   E2  — signed-in non-owner (guest) → no take-out control (members render).       [AC-1 −]
 *   E3  — unauthenticated visitor → no take-out control.                            [AC-1 −]
 *   E4  — an ADMIN who is not the owner → none (owner-STRICT, Director ruling).     [AC-1 −]
 *   E5  — owner viewing a tapestry authored by some OTHER pubkey → none.            [AC-1 −]
 *   E6  — exactly one concept: the refusal sentence, NO control, nothing published. [AC-2]
 *   E7  — arming publishes nothing; Cancel returns to idle, tapestry unchanged.     [AC-3 confirm]
 *   E8  — confirm on a TA tapestry POSTs signAs:"assistant": same d-tag, the chosen
 *         node AND its import gone, all else byte-preserved, created_at newer.      [AC-3]
 *   E9  — own-key tapestry: NIP-07-signed, signAs:"client", author's key, same d.   [AC-3]
 *   E10 — after the save the page RE-READS the coordinate; the removed concept no
 *         longer shows (and no stale detail pane for it).                           [AC-4]
 *   E11 — a different, not-signed-in session opening the same uuid afterwards no
 *         longer sees the removed concept; everything else still there.             [AC-5]
 *   E12 — a failed publish shows a clear inline error; membership unchanged.        [AC-3 failure]
 *   E13 — graph-less (b0b48b00-shaped) degraded tapestry: no take-out control
 *         (nothing in it to take out; the add affordance is untouched).             [scope guard]
 *   E14 — malformed graph: no take-out control.                                     [scope guard]
 *
 * E1, E6, E7, E8, E9, E10, E12 FAIL against the current build (no removal affordance
 * exists). E2–E5, E11, E13, E14 pass today and are the permanent negative/read-path
 * guards — each is non-vacuous (it first asserts the page rendered).
 */

test.describe('Take a concept back out of a Tapestry (tapestries #6)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  // Fixture pubkeys (fixtures only — production code resolves the TA at runtime; CLAUDE.md).
  const TA    = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
  const OWNER = '1111111111111111111111111111111111111111111111111111111111111111';
  const GUEST = '2222222222222222222222222222222222222222222222222222222222222222';
  const THIRD = '3333333333333333333333333333333333333333333333333333333333333333';
  const ADMIN = '4444444444444444444444444444444444444444444444444444444444444444';

  const TA_DTAG     = 'tapestry-farm-a1b2c3d4';
  const OWN_DTAG    = 'tapestry-farm-own-9f8e7d6c';
  const SINGLE_DTAG = 'tapestry-solo-5e6f7a8b';
  const B0B_DTAG    = 'b0b48b00';

  const BASE_CREATED_AT = 1773183323;

  /** Members-carrying tapestry json: dog + golden retriever + cow, one authored relationship
   *  between the DOG side only (never involving cow — the member the tests remove). */
  function farmJson() {
    return {
      tapestry: { slug: 'farmyard', title: 'Farmyard', description: 'animals of the farm' },
      graph: {
        graphType: 'tapestry',
        nodes: [
          { slug: 'concept-header-for-the-concept-of-dogs', uuid: `39998:${TA}:dog`, name: 'dog' },
          { slug: 'concept-header-for-the-concept-of-golden-retrievers', uuid: `39998:${TA}:golden-retriever`, name: 'golden retriever' },
          { slug: 'concept-header-for-the-concept-of-cows', uuid: `39998:${TA}:cow`, name: 'cow' },
          { slug: 'superset-for-the-concept-of-dogs', uuid: `39999:${TA}:dog-superset`, name: 'superset for the concept of dogs' },
        ],
        relationshipTypes: [{ slug: 'CLASS_THREAD_PROPAGATION', alias: 'IS_A_SUPERSET_OF' }],
        relationships: [{
          nodeFrom: { slug: 'superset-for-the-concept-of-dogs' },
          relationshipType: { slug: 'CLASS_THREAD_PROPAGATION' },
          nodeTo: { slug: 'concept-header-for-the-concept-of-golden-retrievers' },
        }],
        imports: [
          { slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` },
          { slug: 'concept-graph-for-golden-retriever', uuid: `39999:${TA}:golden-retriever-concept-graph` },
          { slug: 'concept-graph-for-cow', uuid: `39999:${TA}:cow-concept-graph` },
        ],
      },
    };
  }

  /** The same json with cow already taken out — what the relay holds "afterwards" (E11). */
  function shrunkJson() {
    const j = farmJson();
    j.graph.nodes = j.graph.nodes.filter((n) => n.uuid !== `39998:${TA}:cow`);
    j.graph.imports = j.graph.imports.filter((i) => i.uuid !== `39999:${TA}:cow-concept-graph`);
    return j;
  }

  /** Exactly ONE authored concept (dog) — AC-2's refusal case. */
  function singleJson() {
    return {
      tapestry: { slug: 'solo', title: 'Solo', description: 'one concept only' },
      graph: {
        graphType: 'tapestry',
        nodes: [{ slug: 'concept-header-for-the-concept-of-dogs', uuid: `39998:${TA}:dog`, name: 'dog' }],
        relationshipTypes: [], relationships: [],
        imports: [{ slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` }],
      },
    };
  }

  function el(pubkey, dTag, json) {
    return {
      id: 'f'.repeat(64), pubkey, kind: 39999, created_at: BASE_CREATED_AT,
      tags: [['d', dTag], ['name', dTag], ['z', `39998:${TA}:tapestry`], ['json', JSON.stringify(json)]],
      content: '', sig: '0'.repeat(128),
    };
  }

  // The live-instance degraded shape: bare-hex d-tag, slug-valued name tag, NO graph block.
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

  // Concept headers for useConceptOptions (kind-39998 scan) — matcher (b)'s evidence.
  function headerEv(shortSlug, descriptiveSlug, name) {
    return {
      id: 'a'.repeat(64), pubkey: TA, kind: 39998, created_at: BASE_CREATED_AT,
      tags: [['d', shortSlug], ['json', JSON.stringify({
        word: { slug: descriptiveSlug, name },
        conceptHeader: { oNames: { singular: name }, oSlugs: { singular: shortSlug }, description: `the concept of ${name}s` },
      })]],
      content: '', sig: '0'.repeat(128),
    };
  }
  const CONCEPTS = [
    headerEv('dog', 'concept-header-for-the-concept-of-dogs', 'dog'),
    headerEv('golden-retriever', 'concept-header-for-the-concept-of-golden-retrievers', 'golden retriever'),
    headerEv('cow', 'concept-header-for-the-concept-of-cows', 'cow'),
  ];

  // Concept-graph events served on import scans: each carries its concept's header node
  // under the SAME slug the tapestry's member node uses (the live containment shape the
  // ADR verified). Serving these makes the re-materialization failure mode REAL in the
  // mock: a published body that keeps a removed member's import row shows the member again.
  function cgEvent(shortSlug, descriptiveSlug, name) {
    return {
      id: 'c'.repeat(64), pubkey: TA, kind: 39999, created_at: BASE_CREATED_AT,
      tags: [['d', `${shortSlug}-concept-graph`], ['json', JSON.stringify({
        graph: {
          graphType: 'conceptGraph',
          nodes: [{ slug: descriptiveSlug, uuid: `39998:${TA}:${shortSlug}`, name }],
          relationshipTypes: [], relationships: [],
        },
      })]],
      content: '', sig: '0'.repeat(128),
    };
  }
  const CG_BY_DTAG = {
    'dog-concept-graph': cgEvent('dog', 'concept-header-for-the-concept-of-dogs', 'dog'),
    'golden-retriever-concept-graph': cgEvent('golden-retriever', 'concept-header-for-the-concept-of-golden-retrievers', 'golden retriever'),
    'cow-concept-graph': cgEvent('cow', 'concept-header-for-the-concept-of-cows', 'cow'),
  };

  /**
   * Install the route mocks.
   *  - classification: 'owner' | 'admin' | 'guest' | 'unauthenticated' (drives the gate).
   *  - element: the tapestry event the #d scan returns BEFORE a publish.
   *  - published: captured publish bodies. publishStatus/publishError: force a failure.
   * After a successful publish the element scan serves the PUBLISHED body (signed-back),
   * so the post-save page state is exactly what the implementation published.
   * Returns { counts } — element-scan request counter (re-read discrimination, E10).
   */
  async function mock(page, {
    classification = 'owner', element, published = [],
    publishStatus = 200, publishError = null,
  } = {}) {
    const pubkey =
      classification === 'owner' ? OWNER
        : classification === 'admin' ? ADMIN
          : classification === 'unauthenticated' ? null : GUEST;

    const state = { publishedEvent: null };
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

    // strfry scans, dispatched on the PARSED filter (never substring-matching the whole
    // URL): kind-39998 → concept headers; the element's #d → the tapestry (the published
    // body once one landed); a *-concept-graph #d → that import; anything else → empty.
    await page.route('**/api/strfry/scan**', (r) => {
      let filter = {};
      try {
        const url = new URL(r.request().url());
        filter = JSON.parse(url.searchParams.get('filter') || '{}');
      } catch { /* fall through to empty */ }
      const kinds = filter.kinds || [];
      const dtags = filter['#d'] || [];
      const reply = (events) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events }) });

      if (kinds.includes(39998)) return reply(CONCEPTS);
      if (dtags.includes(elDtag)) {
        counts.elementScans += 1;
        return reply([state.publishedEvent || element]);
      }
      const cg = dtags.find((d) => CG_BY_DTAG[d]);
      if (cg) return reply([CG_BY_DTAG[cg]]);
      return reply([]);
    });

    // Publish sink — capture the body; on success serve the published event back on
    // subsequent element scans (what any session would now read at that coordinate).
    await page.route('**/api/strfry/publish', (r) => {
      const body = r.request().postDataJSON();
      published.push(body);
      if (publishStatus !== 200) {
        return r.fulfill({ status: publishStatus, contentType: 'application/json', body: JSON.stringify({ success: false, error: publishError || 'publish refused' }) });
      }
      const ev = { ...(body.event || {}), id: 'e'.repeat(64), sig: '0'.repeat(128), pubkey: body.signAs === 'assistant' ? TA : (body.event && body.event.pubkey) || OWNER };
      state.publishedEvent = ev;
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

  // The affordance contract: per-member BUTTONS named "Take out <name>"; the armed
  // confirm step has buttons "Take out" (exact) and "Cancel" (exact).
  const takeOutBtn = (page, name) => page.getByRole('button', { name: `Take out ${name}`, exact: true });
  const anyTakeOut = (page) => page.getByRole('button', { name: /^take out/i });
  const confirmBtn = (page) => page.getByRole('button', { name: 'Take out', exact: true });
  const cancelBtn  = (page) => page.getByRole('button', { name: 'Cancel', exact: true });
  const refusal    = (page) => page.getByText(/keeps at least one concept/i);

  /** Arm and confirm the removal of one member — the full save gesture. */
  async function removeConcept(page, name) {
    await takeOutBtn(page, name).click();
    await confirmBtn(page).click();
  }

  /** Assert the page rendered the tapestry's members (guards the negatives against vacuity). */
  async function expectMembersVisible(page) {
    await expect(page.getByText('dog', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('golden retriever').first()).toBeVisible();
  }

  /* ───────── E1 — owner + TA-authored: per-member take-out controls, on the existing page ───────── */
  test('E1: the owner sees a take-out control for each member concept on the Exploration page of a TA-authored tapestry', async ({ page }) => {
    await mock(page, { classification: 'owner', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expectMembersVisible(page); // the page is the SAME Exploration page…
    await expect(takeOutBtn(page, 'cow')).toBeVisible({ timeout: 10000 }); // …now carrying the affordance
    await expect(takeOutBtn(page, 'dog')).toBeVisible();
    expect(page.url()).toContain(TA_DTAG); // no new page
  });

  /* ───────── E2–E4 — non-owner viewers get NO affordance ───────── */
  test('E2: a signed-in non-owner (guest) gets no take-out control', async ({ page }) => {
    await mock(page, { classification: 'guest', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');
    await expectMembersVisible(page);
    await expect(anyTakeOut(page)).toHaveCount(0);
  });

  test('E3: an unauthenticated visitor gets no take-out control', async ({ page }) => {
    await mock(page, { classification: 'unauthenticated', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');
    await expectMembersVisible(page);
    await expect(anyTakeOut(page)).toHaveCount(0);
  });

  test('E4: an ADMIN who is not the owner gets no take-out control (the gate is owner-STRICT, not hasAdminAccess)', async ({ page }) => {
    await mock(page, { classification: 'admin', element: el(TA, TA_DTAG, farmJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');
    await expectMembersVisible(page);
    // Director ruling (carried from #5): an admin may create (#3) but may NOT edit here.
    await expect(anyTakeOut(page)).toHaveCount(0);
  });

  /* ───────── E5 — foreign-authored tapestry: not editable, even for the owner ───────── */
  test('E5: the owner gets no take-out control on a tapestry authored by someone else\'s pubkey', async ({ page }) => {
    await mock(page, { classification: 'owner', element: el(THIRD, TA_DTAG, farmJson()) });
    await page.goto(urlFor(THIRD, TA_DTAG));
    await page.waitForLoadState('networkidle');
    await expectMembersVisible(page);
    await expect(anyTakeOut(page)).toHaveCount(0);
  });

  /* ───────── E6 — the last concept cannot be taken out: refusal, not offer-then-error ───────── */
  test('E6: a tapestry with exactly one concept shows the plain-language refusal instead of any take-out control, and nothing can be published', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', element: el(TA, SINGLE_DTAG, singleJson()), published });
    await page.goto(urlFor(TA, SINGLE_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('dog', { exact: true }).first()).toBeVisible({ timeout: 10000 }); // the member renders
    await expect(refusal(page)).toBeVisible({ timeout: 10000 }); // the owner SEES the refusal up-front…
    await expect(anyTakeOut(page)).toHaveCount(0);               // …and no control exists to attempt a save
    expect(published.length, 'no save is possible for a single-concept tapestry — nothing may reach the publish path').toBe(0);
  });

  /* ───────── E7 — confirm-before-publish; declining leaves the tapestry unchanged ───────── */
  test('E7: choosing a concept publishes NOTHING until the owner confirms; Cancel returns to idle with the tapestry unchanged', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', element: el(TA, TA_DTAG, farmJson()), published });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(takeOutBtn(page, 'cow')).toBeVisible({ timeout: 10000 });
    await takeOutBtn(page, 'cow').click();

    // Armed: the confirm step names the member and offers Take out / Cancel — no publish yet.
    // (\W? = optional quote/punct before the name, with no quote characters in the regex
    // source: Playwright's selector-chain splitter tracks quotes, so an unbalanced " or '
    // inside a regex breaks any appended chaining like `>> nth=0` — the Gate-3 kick-back.
    // The confirm copy renders exactly once, so no .first() is needed under strict mode.)
    await expect(page.getByText(/take out\s+\W?cow/i)).toBeVisible({ timeout: 10000 });
    await expect(confirmBtn(page)).toBeVisible();
    await expect(cancelBtn(page)).toBeVisible();
    expect(published.length, 'arming must publish nothing — the save is the owner\'s explicit confirmation (ratified reading 2)').toBe(0);

    await cancelBtn(page).click();
    await expect(confirmBtn(page)).toHaveCount(0); // back to idle
    await expect(page.getByText('cow', { exact: true }).first()).toBeVisible(); // cow is still a member
    expect(published.length, 'declining must leave the tapestry unchanged — nothing published').toBe(0);
  });

  /* ───────── E8 — TA branch: remove-only republish at the same coordinate ───────── */
  test('E8: confirming on a TA tapestry POSTs signAs:"assistant" — same d-tag, the removed node AND its import gone, every other member/relationship/tag intact, created_at newer, no navigation', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', element: el(TA, TA_DTAG, farmJson()), published });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(takeOutBtn(page, 'cow')).toBeVisible({ timeout: 10000 });
    await removeConcept(page, 'cow');

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
    expect(json.graph.nodes, 'exactly the cow node is removed; every other node survives in order')
      .toEqual(base.graph.nodes.filter((n) => n.uuid !== `39998:${TA}:cow`));
    expect(json.graph.imports, 'the cow concept-graph import leaves with the member; the others survive in order')
      .toEqual(base.graph.imports.filter((i) => i.uuid !== `39999:${TA}:cow-concept-graph`));
    expect(json.graph.relationships, 'authored integrations pass through unchanged').toEqual(base.graph.relationships);
    expect(json.graph.relationshipTypes).toEqual(base.graph.relationshipTypes);

    expect(page.url(), 'the save happens on the existing page — no navigation').toContain(TA_DTAG);
  });

  /* ───────── E9 — own-key branch ───────── */
  test('E9: on an owner-authored tapestry the save NIP-07-signs and POSTs signAs:"client" under the owner\'s key, same d-tag', async ({ page }) => {
    const published = [];
    await mock(page, { classification: 'owner', element: el(OWNER, OWN_DTAG, farmJson()), published });
    await injectSigner(page, OWNER);
    await page.goto(urlFor(OWNER, OWN_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(takeOutBtn(page, 'cow')).toBeVisible({ timeout: 10000 });
    await removeConcept(page, 'cow');

    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);
    const body = published[0];
    expect(body.signAs, 'an owner-key tapestry republishes as a client-signed event').toBe('client');
    expect(body.event.pubkey, 'the replacement is authored under the tapestry\'s EXISTING author key').toBe(OWNER);
    expect(body.event.sig, 'the client path publishes an already-signed event').toBeTruthy();
    const dTag = body.event.tags.find((t) => t[0] === 'd');
    expect(dTag && dTag[1]).toBe(OWN_DTAG);
  });

  /* ───────── E10 — gone for me, by re-read (and no stale detail pane) ───────── */
  test('E10: after a successful save the page re-reads the same coordinate and the removed concept no longer shows — not among the members, no leftover detail pane', async ({ page }) => {
    const published = [];
    const { counts } = await mock(page, { classification: 'owner', element: el(TA, TA_DTAG, farmJson()), published });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    // Look at cow first — the removed member is the SELECTED one, so a page that forgets
    // to reset the selection would keep showing a detail pane for a non-member.
    await expect(page.getByRole('button', { name: 'cow', exact: true })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'cow', exact: true }).click();

    const scansBefore = counts.elementScans;
    await removeConcept(page, 'cow');
    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);

    // The member list the owner sees is the PUBLISHED truth: the element scan now serves
    // the exact body the implementation published, and the cow import STILL RESOLVES —
    // so a replacement that removed the node but kept the import re-materializes cow at
    // compose time and this assertion fails (ADR 0006 Decision 2-A's functional guarantee).
    await expect(page.getByRole('button', { name: 'cow', exact: true })).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'dog', exact: true })).toBeVisible(); // everything else stays
    expect(counts.elementScans, 'the element must be re-read from strfry after the save (reload), not patched locally').toBeGreaterThan(scansBefore);
    // No stale per-concept pane for the removed member (the selected-reset, ADR Decision 5).
    await expect(page.getByText(/not in the graph/i)).toHaveCount(0);
  });

  /* ───────── E11 — gone for anyone else afterwards ───────── */
  test('E11: a different, not-signed-in session opening the same uuid afterwards no longer sees the removed concept among the members', async ({ page }) => {
    // Simulates "afterwards": the relay now holds the shrunk replacement; a fresh anonymous
    // session reads the same coordinate through the same read path as every visitor.
    await mock(page, { classification: 'unauthenticated', element: el(TA, TA_DTAG, shrunkJson()) });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expectMembersVisible(page); // dog + golden retriever still there
    await expect(page.getByRole('button', { name: 'cow', exact: true })).toHaveCount(0);
    await expect(anyTakeOut(page)).toHaveCount(0); // and they still cannot edit
  });

  /* ───────── E12 — publish failure: clear error, membership unchanged ───────── */
  test('E12: a failed publish shows a clear inline error and the membership is unchanged', async ({ page }) => {
    const published = [];
    await mock(page, {
      classification: 'owner', element: el(TA, TA_DTAG, farmJson()),
      published, publishStatus: 500, publishError: 'relay refused the event',
    });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(takeOutBtn(page, 'cow')).toBeVisible({ timeout: 10000 });
    await removeConcept(page, 'cow');

    await expect.poll(() => published.length, { timeout: 10000 }).toBeGreaterThan(0);
    // The owner sees the error the publish path raised…
    await expect(page.getByText(/relay refused the event|failed|error/i).first()).toBeVisible({ timeout: 10000 });
    // …and the tapestry did not change: cow is still among the members.
    await expect(page.getByRole('button', { name: 'cow', exact: true })).toBeVisible();
  });

  /* ───────── E13 — graph-less degraded tapestry: nothing in it to take out ───────── */
  test('E13: the graph-less b0b48b00-shaped tapestry offers NO take-out control (the first-add affordance stays exactly as shipped)', async ({ page }) => {
    await mock(page, { classification: 'owner', element: b0bElement() });
    await page.goto(urlFor(TA, B0B_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Tapestry for Farm Animals/i).first()).toBeVisible({ timeout: 10000 });
    // #5's shipped first-add affordance anchors non-vacuity: the degraded branch rendered
    // its editing surface, and removal is still absent from it.
    await expect(page.getByRole('textbox', { name: /add a concept/i })).toBeVisible({ timeout: 10000 });
    await expect(anyTakeOut(page)).toHaveCount(0);
    await expect(refusal(page)).toHaveCount(0); // no refusal either — there is nothing to refuse
  });

  /* ───────── E14 — malformed graph: no affordance ───────── */
  test('E14: a tapestry whose graph block is malformed (nodes not an array) offers no take-out control', async ({ page }) => {
    const broken = el(TA, TA_DTAG, { tapestry: { slug: 'farmyard', title: 'Farmyard', description: 'x' }, graph: { nodes: 'broken' } });
    await mock(page, { classification: 'owner', element: broken });
    await page.goto(urlFor(TA, TA_DTAG));
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Farmyard/i).first()).toBeVisible({ timeout: 10000 });
    // Malformed ≠ absent: the transform would refuse this structure, so nothing is offered.
    await expect(anyTakeOut(page)).toHaveCount(0);
  });
});
