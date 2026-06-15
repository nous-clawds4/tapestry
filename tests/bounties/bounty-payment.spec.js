/**
 * Real-money bounty payment + cap enforcement, end to end.
 *
 * This is the focused companion to receiving-lifecycle.spec.js. That spec proves
 * the *receiving-method setup UI*; this one assumes the claimant already has a
 * tracked Lightning address and zeroes in on the bounty/payment/cap machine —
 * the reason fix/bounty-cap-enforcement exists.
 *
 * It cannot run in CI: it needs the live stack (rank() + strfry), a WoT rank-≥2
 * edge issuer→claimant, a claimant whose kind-0 profile carries a tracked
 * Lightning address, and a human with a funded wallet to pay one (or two) real
 * BOLT11 invoices. So it is SKIPPED unless BOUNTY_E2E=1, and inputs come from env:
 *
 *   BOUNTY_E2E=1               enable this spec
 *   BRAINSTORM_BASE_URL=…      app base (defaults to the playwright config)
 *   ISSUER_NSEC=nsec1…|hex     issuer signing key (must rank each claimant ≥ 2)
 *   CLAIMANT_NSEC=nsec1…|hex   claimant signing key (paid in both tests)
 *   CLAIMANT_LUD16=name@host   the claimant's REAL, tracked (allowsNostr) address;
 *                              must match the lud16 on the claimant's kind-0 profile
 *   CLAIMANT2_NSEC / CLAIMANT3_NSEC   extra claimants for the cap test (rank ≥ 2);
 *                              if unset, the cap test is skipped
 *   PAY_TIMEOUT_MS=600000      how long each checkpoint waits for you to pay
 *   CAP_FULFILL=1              also pay the 2nd invoice to assert `fulfilled`
 *                              (claimant2's profile must then also carry a tracked
 *                              lud16, and claimant3 must be login-authorized)
 *
 * Run a single browser project so a human pays each invoice once, e.g.:
 *   BOUNTY_E2E=1 ISSUER_NSEC=… CLAIMANT_NSEC=… CLAIMANT_LUD16=… \
 *     npx playwright test tests/bounties/bounty-payment.spec.js --project=chromium --headed
 *
 * The WoT precondition (rank ≥ 2) is asserted by the first claim-visibility poll
 * with a precise message — rather than a separate throwaway probe, which would
 * add DB rows and fail no faster. See tests/bounties/README.md.
 */

const { test, expect } = require('@playwright/test');
const {
  loadKey,
  signIn,
  injectSigner,
  publishListEvent,
  publishClaim,
  fetchBounty,
  pollClaimVisible,
  pollAllClaimsVisible,
  pollPaidRewardCount,
  readZapInvoice,
  printCheckpoint,
  probeTracked,
  fetchProfileLud16,
} = require('./helpers');

const ENABLED = process.env.BOUNTY_E2E === '1';
const CAP_FULFILL = process.env.CAP_FULFILL === '1';
const PAY_TIMEOUT_MS = Number(process.env.PAY_TIMEOUT_MS) || 600000;

function optionalKey(raw, label) {
  return raw ? loadKey(raw, label) : null;
}

test.describe('bounty payment + cap enforcement (real money)', () => {
  test.skip(!ENABLED, 'set BOUNTY_E2E=1 (+ ISSUER_NSEC/CLAIMANT_NSEC/CLAIMANT_LUD16) to run the real-payment walkthrough');
  // Human-paced: run the two checkpoints one after another, not interleaved.
  test.describe.configure({ mode: 'serial' });

  let issuer, claimant, lud16;
  let gateSkip = null; // a precondition failure that should skip (not error) the tests

  test.beforeAll(async ({ browser }) => {
    try {
      issuer = loadKey(process.env.ISSUER_NSEC, 'ISSUER_NSEC');
      claimant = loadKey(process.env.CLAIMANT_NSEC, 'CLAIMANT_NSEC');
      lud16 = process.env.CLAIMANT_LUD16;
      if (!lud16) throw new Error('CLAIMANT_LUD16 is required (a real, tracked name@host)');

      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        // 1) The declared address must be tracked (allowsNostr) — the same gate
        //    receiving-lifecycle.spec.js uses, so a non-payable address fails loud.
        const probe = await probeTracked(page, lud16);
        if (!probe.tracked) {
          gateSkip = `CLAIMANT_LUD16 (${lud16}) is not tracked / does not allow Nostr zaps: ${JSON.stringify(probe.verdict)}`;
          return;
        }
        // 2) The zap reads the recipient's address from their kind-0 profile, not
        //    from CLAIMANT_LUD16 — so the profile must already carry the same one.
        const profileLud16 = await fetchProfileLud16(page, claimant.pk);
        if (!profileLud16) {
          gateSkip = `claimant ${claimant.pk.slice(0, 8)}… has no lud16/lud06 on their kind-0 profile — publish one (Settings → Receiving) first; the zap reads the address from the profile.`;
          return;
        }
        if (profileLud16.trim().toLowerCase() !== lud16.trim().toLowerCase()) {
          gateSkip = `claimant profile lud16 (${profileLud16}) ≠ CLAIMANT_LUD16 (${lud16}) — reconcile them so you pay the address you probed.`;
          return;
        }
      } finally {
        await ctx.close();
      }
    } catch (err) {
      gateSkip = err.message;
    }
  });

  test.beforeEach(() => {
    if (gateSkip) test.skip(true, gateSkip);
  });

  test('happy path — one real payment flips the claim to paid and fulfills the bounty', async ({ browser }) => {
    test.setTimeout(PAY_TIMEOUT_MS + 120000);

    const iCtx = await browser.newContext();
    const cCtx = await browser.newContext();
    try {
      const iPage = await iCtx.newPage();
      await injectSigner(iPage, issuer.sk, issuer.pk); // issuer signs the kind-9734 zap request via window.nostr
      await signIn(iPage, issuer.sk, issuer.pk);

      const cPage = await cCtx.newPage();
      await signIn(cPage, claimant.sk, claimant.pk); // needed only to read payments-to-me

      // Single-slot bounty: amount == cap.
      const dTag = `bounty-e2e-${issuer.pk.slice(0, 8)}-${Date.now()}`;
      const { listCoordinate } = await publishListEvent(iPage, { sk: issuer.sk, pk: issuer.pk, dTag });

      const createResp = await iPage.request.post('/api/bounties', {
        data: { listCoordinate, amountSats: 21, bountyCapSats: 21, criteria: 'Bounty payment E2E — pay the real invoice' },
      });
      expect(createResp.ok(), await createResp.text()).toBeTruthy();
      const { bounty } = await createResp.json();

      await publishClaim(cPage, { sk: claimant.sk, listCoordinate, dTag: `${dTag}-c1` });

      // Surfaces only if rank(issuer, claimant) ≥ 2.
      await pollClaimVisible(iPage, bounty.id, claimant.pk);

      // Payable before any payment.
      {
        const { bounty: b, claims } = await fetchBounty(iPage, bounty.id);
        expect(b.paymentState.totalRewardSlots).toBe(1);
        const mine = claims.find(c => c.event.pubkey === claimant.pk);
        expect(mine.paymentStatus).toBe('payable');
      }

      // Issuer mints a real BOLT11 invoice for the claim.
      const invoice = await readZapInvoice(iPage, listCoordinate);
      printCheckpoint(invoice, PAY_TIMEOUT_MS, 'Happy path: single 21-sat reward.');

      await pollPaidRewardCount(iPage, bounty.id, 1, { timeout: PAY_TIMEOUT_MS });

      // The receipt flips the claim to paid and fulfills the single-slot bounty.
      const { bounty: paid, claims: paidClaims } = await fetchBounty(iPage, bounty.id);
      const mine = paidClaims.find(c => c.event.pubkey === claimant.pk);
      expect(mine.zapReceipt, 'claim should carry a kind-9735 receipt').toBeTruthy();
      expect(mine.paymentStatus).toBe('paid');
      expect(paid.paymentState.paidRewardCount).toBe(1);
      expect(paid.paymentState.remainingRewardSlots).toBe(0);
      expect(paid.paymentState.fulfilled).toBe(true);
      expect(paid.derivedStatus).toBe('fulfilled');

      // Claimant's Payments-to-Me: the claim is paid, not pending.
      const ptm = await (await cPage.request.get('/api/bounties/mine/payments-to-me')).json();
      expect(ptm.paid.some(r => r.bounty.id === bounty.id && r.claim.event.pubkey === claimant.pk),
        'claim should appear in payments-to-me paid[]').toBeTruthy();
      expect(ptm.pending.some(r => r.bounty.id === bounty.id),
        'claim should not still be pending').toBeFalsy();

      // Issuer's Payments-Due: the fulfilled bounty is gone.
      const due = await (await iPage.request.get('/api/bounties/mine/payments-due')).json();
      expect(due.items.some(it => it.bounty.id === bounty.id),
        'fulfilled bounty should drop off payments-due').toBeFalsy();
    } finally {
      await iCtx.close();
      await cCtx.close();
    }
  });

  test('cap enforcement — free split pre-payment, slot decrement after one payment', async ({ browser }) => {
    const claimant2 = optionalKey(process.env.CLAIMANT2_NSEC, 'CLAIMANT2_NSEC');
    const claimant3 = optionalKey(process.env.CLAIMANT3_NSEC, 'CLAIMANT3_NSEC');
    test.skip(!claimant2 || !claimant3, 'set CLAIMANT2_NSEC and CLAIMANT3_NSEC (both rank ≥ 2) to run the cap-enforcement test');
    test.setTimeout((CAP_FULFILL ? 2 : 1) * PAY_TIMEOUT_MS + 180000);

    const iCtx = await browser.newContext();
    try {
      const iPage = await iCtx.newPage();
      await injectSigner(iPage, issuer.sk, issuer.pk);
      await signIn(iPage, issuer.sk, issuer.pk);

      // Two-slot bounty: cap = 2 × amount.
      const dTag = `bounty-cap-e2e-${issuer.pk.slice(0, 8)}-${Date.now()}`;
      const { listCoordinate } = await publishListEvent(iPage, { sk: issuer.sk, pk: issuer.pk, dTag, title: 'Bounty cap E2E list' });

      const createResp = await iPage.request.post('/api/bounties', {
        data: { listCoordinate, amountSats: 21, bountyCapSats: 42, criteria: 'Bounty cap E2E — 2 slots, 3 claimants' },
      });
      expect(createResp.ok(), await createResp.text()).toBeTruthy();
      const { bounty } = await createResp.json();
      expect(bounty.amount_sats).toBe(21);
      expect(bounty.bounty_cap_sats).toBe(42);

      // Three claims, timestamps staggered so oldest-first ordering is deterministic:
      // claimant1 < claimant2 < claimant3, all strictly after the bounty.
      const claimants = [claimant, claimant2, claimant3];
      for (let i = 0; i < claimants.length; i++) {
        // The publish endpoint is keyless (it relays a pre-signed event), so all
        // three can go through the issuer's page — no per-claimant session needed.
        await publishClaim(iPage, {
          sk: claimants[i].sk,
          listCoordinate,
          dTag: `${dTag}-c${i + 1}`,
          createdAt: bounty.created_at + 1 + i,
        });
      }

      await pollAllClaimsVisible(iPage, bounty.id, claimants.map(c => c.pk));

      // ── Free split: with ZERO payments, the cap is already enforced. This is
      //    the core of the cap-enforcement fix and costs no sats. ──
      {
        const { bounty: b, claims } = await fetchBounty(iPage, bounty.id);
        expect(b.paymentState.totalRewardSlots).toBe(2);
        expect(b.paymentState.paidRewardCount).toBe(0);
        expect(b.paymentState.payableRewardCount).toBe(2);
        expect(b.paymentState.fulfilled).toBe(false);

        const byPk = new Map(claims.map(c => [c.event.pubkey, c]));
        expect(byPk.get(claimant.pk).paymentStatus, 'oldest claim payable').toBe('payable');
        expect(byPk.get(claimant2.pk).paymentStatus, 'second claim payable').toBe('payable');
        expect(byPk.get(claimant3.pk).paymentStatus, 'third (newest) claim over cap').toBe('closed');
        expect(byPk.get(claimant3.pk).closedReason).toBe('cap');
      }

      // ── One real payment → the slot decrements; the split holds. ──
      const invoice1 = await readZapInvoice(iPage, listCoordinate); // oldest payable = claimant1
      printCheckpoint(invoice1, PAY_TIMEOUT_MS, `Cap test, payment 1 of ${CAP_FULFILL ? 2 : 1} (claimant 1 of 3).`);
      await pollPaidRewardCount(iPage, bounty.id, 1, { timeout: PAY_TIMEOUT_MS });

      {
        const { bounty: b, claims } = await fetchBounty(iPage, bounty.id);
        expect(b.paymentState.paidRewardCount).toBe(1);
        expect(b.paymentState.remainingRewardSlots).toBe(1);
        expect(b.paymentState.payableRewardCount).toBe(1);
        expect(b.paymentState.fulfilled).toBe(false);
        expect(b.derivedStatus).toBe('open');
        const c3 = claims.find(c => c.event.pubkey === claimant3.pk);
        expect(c3.paymentStatus, 'third claim still over cap after one payment').toBe('closed');
        expect(c3.closedReason).toBe('cap');
      }

      // ── Optional second payment → bounty fulfilled; the 3rd claim stays closed. ──
      if (CAP_FULFILL) {
        const c2Lud16 = await fetchProfileLud16(iPage, claimant2.pk);
        expect(c2Lud16, `CAP_FULFILL pays claimant2 (${claimant2.pk.slice(0, 8)}…), who needs a tracked lud16 on their profile`).toBeTruthy();

        const invoice2 = await readZapInvoice(iPage, listCoordinate); // now-only payable = claimant2
        printCheckpoint(invoice2, PAY_TIMEOUT_MS, 'Cap test, payment 2 of 2 (claimant 2 of 3).');
        await pollPaidRewardCount(iPage, bounty.id, 2, { timeout: PAY_TIMEOUT_MS });

        const { bounty: b, claims } = await fetchBounty(iPage, bounty.id);
        expect(b.paymentState.fulfilled).toBe(true);
        expect(b.paymentState.payableRewardCount).toBe(0);
        expect(b.derivedStatus).toBe('fulfilled');
        const c3 = claims.find(c => c.event.pubkey === claimant3.pk);
        expect(c3.paymentStatus, 'third claim still over cap even when fulfilled').toBe('closed');
        expect(c3.closedReason).toBe('cap');

        // Claimant3 sees their over-cap claim in payments-to-me closed[].
        const c3Ctx = await browser.newContext();
        try {
          const c3Page = await c3Ctx.newPage();
          await signIn(c3Page, claimant3.sk, claimant3.pk);
          const ptm = await (await c3Page.request.get('/api/bounties/mine/payments-to-me')).json();
          expect(ptm.closed.some(r => r.bounty.id === bounty.id && r.claim.event.pubkey === claimant3.pk),
            'over-cap claim should appear in payments-to-me closed[]').toBeTruthy();
        } finally {
          await c3Ctx.close();
        }
      }
    } finally {
      await iCtx.close();
    }
  });
});
