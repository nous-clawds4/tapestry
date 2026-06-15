/**
 * End-to-end bounty lifecycle with a REAL Lightning payment checkpoint.
 *
 * This is the proof of the plan's "walk the whole loop" goal: a claimant sets a
 * real tracked Lightning address through the new Settings → Receiving UI, an
 * issuer creates and pays out a bounty, YOU pay the real BOLT11 invoice from your
 * wallet at the checkpoint, and the kind-9735 receipt flips Payments-to-Me to
 * "paid".
 *
 * It cannot run in CI: it needs the live docker stack (Neo4j for rank(), strfry
 * for claim scans), a WoT rank-≥2 edge from issuer → claimant, and a human with a
 * funded wallet. So it is SKIPPED unless RECEIVING_E2E=1, and several inputs come
 * from the environment:
 *
 *   RECEIVING_E2E=1            enable this spec
 *   BRAINSTORM_BASE_URL=…      app base (defaults to the playwright config)
 *   ISSUER_NSEC=nsec1…|hex     issuer signing key (must rank the claimant ≥ 2)
 *   CLAIMANT_NSEC=nsec1…|hex   claimant signing key
 *   CLAIMANT_LUD16=name@host   a REAL, tracked (allowsNostr) Lightning address
 *   PAY_TIMEOUT_MS=600000      how long the checkpoint waits for you to pay
 *
 * Signing/publishing/poll plumbing is shared with bounty-payment.spec.js via
 * ./helpers — NIP-07 is provided by injecting a window.nostr backed by a Node
 * signer (nostr-tools), a deterministic test signer, not a wallet extension.
 */

const { test, expect } = require('@playwright/test');
const {
  loadKey,
  signIn,
  injectSigner,
  publishListEvent,
  publishClaim,
  pollClaimVisible,
} = require('./helpers');

const ENABLED = process.env.RECEIVING_E2E === '1';
const PAY_TIMEOUT_MS = Number(process.env.PAY_TIMEOUT_MS) || 600000;

test.describe('bounty lifecycle with real payment', () => {
  test.skip(!ENABLED, 'set RECEIVING_E2E=1 (+ ISSUER_NSEC/CLAIMANT_NSEC/CLAIMANT_LUD16) to run the real-payment walkthrough');

  test('claimant sets a tracked address, issuer pays, receipt flips to paid', async ({ browser }) => {
    test.setTimeout(PAY_TIMEOUT_MS + 120000);

    const issuer = loadKey(process.env.ISSUER_NSEC, 'ISSUER_NSEC');
    const claimant = loadKey(process.env.CLAIMANT_NSEC, 'CLAIMANT_NSEC');
    const lud16 = process.env.CLAIMANT_LUD16;
    if (!lud16) throw new Error('CLAIMANT_LUD16 is required (a real, tracked name@host)');

    // ── Claimant: set a tracked receiving method through the NEW Settings UI ──
    const claimantCtx = await browser.newContext();
    const cPage = await claimantCtx.newPage();
    await injectSigner(cPage, claimant.sk, claimant.pk);
    await signIn(cPage, claimant.sk, claimant.pk);
    await cPage.goto('/settings');

    // The probe must confirm the address is tracked before we publish it.
    const probeResp = await cPage.request.post('/api/receiving/probe', { data: { value: lud16 } });
    expect(probeResp.ok()).toBeTruthy();
    const probeBody = await probeResp.json();
    expect(probeBody.verdict?.tracked, `CLAIMANT_LUD16 must allow Nostr zaps to be tracked: ${JSON.stringify(probeBody.verdict)}`).toBe(true);

    // Drive the Receiving card: choose "Lightning address", type it, Save & publish.
    await cPage.getByText('Lightning address', { exact: false }).first().click();
    await cPage.getByPlaceholder('name@domain.com').fill(lud16);
    await cPage.getByRole('button', { name: /Save & publish/i }).click();
    await expect(cPage.getByText(/Published lud16/i)).toBeVisible({ timeout: 15000 });

    // ── Issuer: create a list + bounty, deterministically via the HTTP API ──
    const issuerCtx = await browser.newContext();
    const iPage = await issuerCtx.newPage();
    await injectSigner(iPage, issuer.sk, issuer.pk);
    await signIn(iPage, issuer.sk, issuer.pk);
    await iPage.goto('/');

    // A list coordinate the bounty is keyed to (kind:pubkey:d-tag). Publishing the
    // 30000-series list event is normally done from the New List UI; here we sign
    // and publish it directly so the test focuses on the payment seam.
    const dTag = `recv-e2e-${issuer.pk.slice(0, 8)}`;
    const { listCoordinate } = await publishListEvent(iPage, {
      sk: issuer.sk, pk: issuer.pk, dTag, title: 'Receiving E2E list',
    });

    const createResp = await iPage.request.post('/api/bounties', {
      data: { listCoordinate, amountSats: 21, criteria: 'Receiving E2E — pay the real invoice' },
    });
    expect(createResp.ok(), await createResp.text()).toBeTruthy();
    const { bounty } = await createResp.json();

    // ── Claimant: submit a kind-39999 claim tagged #z = listCoordinate ──
    await publishClaim(cPage, {
      sk: claimant.sk, listCoordinate, dTag: `${dTag}-claim`, content: 'Receiving E2E claim',
    });

    // The claim only surfaces if the issuer ranks the claimant ≥ 2 (WoT precondition).
    await pollClaimVisible(iPage, bounty.id, claimant.pk, {
      message: 'claim never appeared — is the issuer→claimant rank ≥ 2 edge in place?',
    });

    // ── Issuer: zap the claim → a real BOLT11 invoice ──
    await iPage.goto('/tapestry/bounties/payments-due');
    await iPage.getByRole('button', { name: /zap/i }).first().click();
    const invoiceBox = iPage.locator('textarea[readonly]');
    await expect(invoiceBox).toBeVisible({ timeout: 20000 });
    const invoice = (await invoiceBox.inputValue()).trim();
    expect(invoice, 'expected a BOLT11 invoice').toMatch(/^ln(bc|tb)/i);

    // ── CHECKPOINT: pay it from your wallet ──
    console.log('\n========================= PAY THIS INVOICE =========================');
    console.log(invoice);
    console.log(`(waiting up to ${Math.round(PAY_TIMEOUT_MS / 1000)}s for the kind-9735 receipt…)`);
    console.log('====================================================================\n');

    // Poll the bounty until the issuer's zap receipt lands on the claim.
    await expect.poll(async () => {
      const r = await iPage.request.get(`/api/bounties/${bounty.id}`);
      const body = await r.json();
      return (body.claims || []).some(c => c.event?.pubkey === claimant.pk && c.zapReceipt);
    }, { timeout: PAY_TIMEOUT_MS, intervals: [5000], message: 'no kind-9735 receipt — was the invoice paid?' }).toBeTruthy();

    // ── Claimant: Payments-to-Me shows the claim as paid ──
    await cPage.goto('/tapestry/bounties/payments-to-me');
    await expect(cPage.getByText('paid', { exact: false }).first()).toBeVisible({ timeout: 20000 });

    await claimantCtx.close();
    await issuerCtx.close();
  });
});
