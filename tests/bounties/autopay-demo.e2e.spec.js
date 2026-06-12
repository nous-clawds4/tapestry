/**
 * Auto-pay bounty demo, end to end with REAL money — no human in the loop.
 *
 * Walks the full production path introduced by the moneydevkit wallet swap:
 *   list → auto-pay bounty → claim → autoPayWatcher mints a NIP-57 zap invoice
 *   → pays it through the mdk agent-wallet → Strike publishes the kind-9735
 *   receipt → claim settles. Screenshots land in screenshots-autopay/.
 *
 * The local strfry has no inbound path from public relays, so this spec also
 * runs a relay bridge: it subscribes to the AUTO_PAY_ZAP_RELAYS (where Strike
 * publishes the receipt, as instructed by the zap request's relays tag) and
 * republishes the pre-signed 9735 into local strfry via the keyless publish
 * endpoint. A deployed instance with a publicly reachable relay wouldn't need
 * this hop.
 *
 * Gated by AUTOPAY_E2E=1. Requires the dev stack with AUTO_PAY_ENABLED=true,
 * a registered delegate for ISSUER_NSEC's pubkey (allowlisted), a funded mdk
 * wallet in the container, and DEV_SKIP_TRUST_CHECK=true (or real WoT edges).
 *
 *   AUTOPAY_E2E=1 ISSUER_NSEC=… CLAIMANT_NSEC=… CLAIMANT_LUD16=name@host \
 *     npx playwright test tests/bounties/autopay-demo.e2e.spec.js --project=chromium
 */

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { finalizeEvent } = require('nostr-tools');
const { SimplePool } = require('nostr-tools/pool');
const {
  loadKey,
  nowSec,
  signIn,
  publishEvent,
  publishListEvent,
  publishClaim,
  fetchBounty,
  pollClaimVisible,
  probeTracked,
} = require('./helpers');

const ENABLED = process.env.AUTOPAY_E2E === '1';
const SHOT_DIR = 'screenshots-autopay';
const RECEIPT_RELAYS = (process.env.AUTO_PAY_ZAP_RELAYS || 'wss://relay.damus.io,wss://nos.lol')
  .split(',').map(s => s.trim()).filter(Boolean);

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = `${SHOT_DIR}/${String(shotIndex).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[shot] ${file}`);
  return file;
}

/**
 * Bridge the claim's kind-9735 receipt from the public receipt relays into
 * local strfry the moment Strike publishes it. Returns { stop, done }.
 */
function startReceiptBridge(page, claimEventId) {
  const pool = new SimplePool();
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  const sub = pool.subscribeMany(RECEIPT_RELAYS, [{ kinds: [9735], '#e': [claimEventId] }], {
    onevent: async (event) => {
      console.log(`[bridge] receipt ${event.id.slice(0, 8)}… seen on public relay, importing to local strfry`);
      try {
        await publishEvent(page, event);
        resolveDone(event);
      } catch (err) {
        console.error('[bridge] local import failed:', err.message);
      }
    },
  });
  return {
    done,
    stop: () => { try { sub.close(); pool.close(RECEIPT_RELAYS); } catch { /* closing */ } },
  };
}

test.describe('auto-pay bounty demo (real money, no human)', () => {
  test.skip(!ENABLED, 'set AUTOPAY_E2E=1 (+ ISSUER_NSEC/CLAIMANT_NSEC/CLAIMANT_LUD16) to run');

  test('list → bounty → claim → auto-paid → settled', async ({ browser }) => {
    test.setTimeout(420000);
    fs.mkdirSync(SHOT_DIR, { recursive: true });

    const issuer = loadKey(process.env.ISSUER_NSEC, 'ISSUER_NSEC');
    const claimant = loadKey(process.env.CLAIMANT_NSEC, 'CLAIMANT_NSEC');
    const lud16 = process.env.CLAIMANT_LUD16;
    expect(lud16, 'CLAIMANT_LUD16 is required').toBeTruthy();

    const iCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const cCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const iPage = await iCtx.newPage();
      await signIn(iPage, issuer.sk, issuer.pk);
      const cPage = await cCtx.newPage();
      await signIn(cPage, claimant.sk, claimant.pk);

      // ── 0. Claimant's kind-0 profile carries the real Strike address. ──
      const profile = finalizeEvent({
        kind: 0,
        created_at: nowSec(),
        tags: [],
        content: JSON.stringify({
          name: 'autopay-demo-claimant',
          about: 'Auto-pay e2e demo claimant (moneydevkit wallet swap)',
          lud16,
        }),
      }, claimant.sk);
      await publishEvent(cPage, profile);
      const probe = await probeTracked(cPage, lud16);
      expect(probe.tracked, `${lud16} must be tracked (allowsNostr)`).toBeTruthy();

      // ── 1. Issuer creates the list. ──
      const dTag = `autopay-demo-${Date.now()}`;
      const { listCoordinate } = await publishListEvent(iPage, {
        sk: issuer.sk, pk: issuer.pk, dTag, title: 'Auto-pay demo list',
      });
      console.log('[demo] list coordinate:', listCoordinate);

      // ── 2. Issuer creates a single-slot AUTO-PAY bounty (21 sats). ──
      const createResp = await iPage.request.post('/api/bounties', {
        data: {
          listCoordinate,
          amountSats: 21,
          bountyCapSats: 21,
          criteria: 'Auto-pay demo — paid automatically by the moneydevkit wallet',
          autoPay: true,
        },
      });
      expect(createResp.ok(), await createResp.text()).toBeTruthy();
      const { bounty } = await createResp.json();
      console.log('[demo] bounty id:', bounty.id, 'auto_pay_enabled:', bounty.auto_pay_enabled);

      await iPage.goto('/tapestry/bounties');
      await iPage.waitForLoadState('networkidle');
      await shot(iPage, 'issuer-bounty-list');

      await iPage.goto(`/tapestry/bounties/${bounty.id}`);
      await iPage.waitForLoadState('networkidle');
      await shot(iPage, 'issuer-bounty-detail-open');

      // ── 3. Claimant sees the bounty and submits a claim. ──
      await cPage.goto(`/tapestry/bounties/${bounty.id}`);
      await cPage.waitForLoadState('networkidle');
      await shot(cPage, 'claimant-bounty-detail-before-claim');

      const claimEvent = await publishClaim(cPage, {
        sk: claimant.sk, listCoordinate, dTag: `${dTag}-claim`,
        content: 'Auto-pay demo claim',
      });
      console.log('[demo] claim event:', claimEvent.id);

      // Receipt bridge FIRST, so the 9735 lands locally inside the watcher's
      // 60s receipt poll and the payment settles rather than paid_unreceipted.
      const bridge = startReceiptBridge(cPage, claimEvent.id);

      await pollClaimVisible(iPage, bounty.id, claimant.pk);
      await iPage.goto(`/tapestry/bounties/${bounty.id}`);
      await iPage.waitForLoadState('networkidle');
      await shot(iPage, 'issuer-bounty-detail-claim-payable');

      // ── 4. The autoPayWatcher pays through the mdk agent-wallet. ──
      console.log('[demo] waiting for autoPayWatcher to pay (tick interval 15s, mdk send ≤160s)…');
      await expect.poll(async () => {
        const { claims } = await fetchBounty(iPage, bounty.id);
        const mine = claims.find(c => c.event.pubkey === claimant.pk);
        const state = mine?.autoPayment?.state ?? 'none';
        console.log(`[demo] auto-payment state: ${state}`);
        return ['paid', 'settled', 'paid_unreceipted', 'failed'].includes(state) ? state : null;
      }, { timeout: 300000, intervals: [10000] }).not.toBeNull();

      {
        const { claims } = await fetchBounty(iPage, bounty.id);
        const mine = claims.find(c => c.event.pubkey === claimant.pk);
        expect(mine.autoPayment.state, `auto-payment failed: ${mine.autoPayment?.reason || ''}`)
          .not.toBe('failed');
      }

      // ── 5. The Strike receipt lands (bridged) and the payment settles. ──
      await expect.poll(async () => {
        const { claims } = await fetchBounty(iPage, bounty.id);
        const mine = claims.find(c => c.event.pubkey === claimant.pk);
        return mine?.autoPayment?.state;
      }, {
        timeout: 120000, intervals: [5000],
        message: 'auto-payment never reached settled — did the receipt bridge import the 9735 in time?',
      }).toBe('settled');
      bridge.stop();

      const { bounty: finalBounty, claims: finalClaims } = await fetchBounty(iPage, bounty.id);
      const mine = finalClaims.find(c => c.event.pubkey === claimant.pk);
      expect(mine.zapReceipt, 'claim should carry the kind-9735 receipt').toBeTruthy();
      expect(finalBounty.paymentState.paidRewardCount).toBe(1);
      expect(finalBounty.paymentState.fulfilled).toBe(true);
      console.log('[demo] SETTLED — receipt', mine.zapReceipt.id.slice(0, 8) + '…,',
        'preimage recorded:', Boolean(mine.autoPayment.preimage));

      await iPage.goto(`/tapestry/bounties/${bounty.id}`);
      await iPage.waitForLoadState('networkidle');
      await shot(iPage, 'issuer-bounty-detail-paid');

      await iPage.goto('/tapestry/bounties/payments-due');
      await iPage.waitForLoadState('networkidle');
      await shot(iPage, 'issuer-payments-due-empty');

      await cPage.goto('/tapestry/bounties/payments-to-me');
      await cPage.waitForLoadState('networkidle');
      await shot(cPage, 'claimant-payments-to-me-paid');

      fs.writeFileSync(`${SHOT_DIR}/run.json`, JSON.stringify({
        bountyId: bounty.id,
        listCoordinate,
        claimEventId: claimEvent.id,
        receiptId: mine.zapReceipt.id,
        autoPayment: mine.autoPayment,
        paymentState: finalBounty.paymentState,
      }, null, 2));
    } finally {
      await iCtx.close();
      await cCtx.close();
    }
  });
});
