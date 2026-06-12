/**
 * Shared plumbing for the real-money bounty e2e specs.
 *
 * These helpers were lifted out of receiving-lifecycle.spec.js so the new
 * bounty-payment.spec.js can share one copy. Nothing here talks to a wallet:
 * signing happens in Node with nostr-tools (a deterministic test signer), and
 * the only human step lives in the specs (paying a printed BOLT11 invoice).
 *
 * Everything reaches the app through `page.request` (which shares the browser
 * context's cookie jar) or through page navigation, so the same session applies
 * to authed API calls and to UI steps.
 */

const { expect } = require('@playwright/test');
const { finalizeEvent, getPublicKey, nip19 } = require('nostr-tools');

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

/** Parse an nsec1…/64-char-hex secret into { sk: Uint8Array, pk: hex }. */
function loadKey(raw, label) {
  if (!raw) throw new Error(`${label} is required (set ${label}=nsec1…|hex)`);
  let hex;
  if (raw.startsWith('nsec1')) {
    const d = nip19.decode(raw);
    if (d.type !== 'nsec') throw new Error(`${label} is not an nsec`);
    hex = Buffer.from(d.data).toString('hex');
  } else if (/^[0-9a-f]{64}$/i.test(raw)) {
    hex = raw.toLowerCase();
  } else {
    throw new Error(`${label} must be nsec1… or 64-char hex`);
  }
  const sk = Uint8Array.from(Buffer.from(hex, 'hex'));
  return { sk, pk: getPublicKey(sk) };
}

/**
 * Authenticate `page`'s context with the app: verify-user → sign the kind-22242
 * challenge (in Node) → login-user. page.request shares the cookie jar with the
 * browser context, so the session applies to subsequent UI navigations and to
 * the authed /api/receiving/* and /api/bounties/* calls.
 */
async function signIn(page, sk, pk) {
  const verify = await page.request.post('/api/auth/verify-user', { data: { pubkey: pk } });
  const vbody = await verify.json().catch(() => ({}));
  if (!vbody.authorized) throw new Error(`verify-user denied ${pk.slice(0, 8)}…: ${vbody.message || verify.status()}`);
  const signed = finalizeEvent({
    kind: 22242,
    created_at: nowSec(),
    tags: [['challenge', vbody.challenge]],
    content: 'Tapestry authentication',
  }, sk);
  const login = await page.request.post('/api/auth/login-user', { data: { event: signed } });
  const lbody = await login.json().catch(() => ({}));
  if (!lbody.success) throw new Error(`login-user failed ${pk.slice(0, 8)}…: ${lbody.message || login.status()}`);
}

/** Install a NIP-07 window.nostr on `page` that signs with `sk` in Node. */
async function injectSigner(page, sk, pk) {
  await page.exposeFunction('__bountySignEvent', (unsigned) => {
    const tmpl = {
      kind: unsigned.kind,
      created_at: unsigned.created_at || nowSec(),
      tags: unsigned.tags || [],
      content: unsigned.content || '',
    };
    return finalizeEvent(tmpl, sk);
  });
  await page.addInitScript((pkHex) => {
    window.nostr = {
      getPublicKey: async () => pkHex,
      signEvent: async (ev) => window.__bountySignEvent(ev),
    };
  }, pk);
}

/** Relay an already-signed event to local strfry (the endpoint is keyless). */
async function publishEvent(page, event) {
  const resp = await page.request.post('/api/strfry/publish', { data: { event, signAs: 'client' } });
  expect(resp.ok(), `publish failed (${resp.status()}): ${await resp.text().catch(() => '')}`).toBeTruthy();
  return resp;
}

/**
 * Publish a kind-30000 list and return its coordinate. Normally done from the
 * New List UI; here we sign + publish directly so the specs focus on the
 * payment seam.
 */
async function publishListEvent(page, { sk, pk, dTag, title = 'Bounty E2E list', createdAt } = {}) {
  const issuer = pk || getPublicKey(sk);
  const event = finalizeEvent({
    kind: 30000,
    created_at: createdAt || nowSec(),
    tags: [['d', dTag], ['title', title]],
    content: '',
  }, sk);
  await publishEvent(page, event);
  return { event, dTag, listCoordinate: `30000:${issuer}:${dTag}` };
}

/** Publish a kind-39999 claim tagged #z = listCoordinate. Returns the event. */
async function publishClaim(page, { sk, listCoordinate, dTag, content = 'Bounty E2E claim', createdAt } = {}) {
  const event = finalizeEvent({
    kind: 39999,
    created_at: createdAt || nowSec(),
    tags: [['z', listCoordinate], ['d', dTag]],
    content,
  }, sk);
  await publishEvent(page, event);
  return event;
}

/** GET /api/bounties/:id -> { success, bounty, claims }. */
async function fetchBounty(page, bountyId) {
  const r = await page.request.get(`/api/bounties/${bountyId}`);
  expect(r.ok(), `GET /api/bounties/${bountyId} failed (${r.status()})`).toBeTruthy();
  return r.json();
}

const RANK_HINT =
  'is rank(issuer, claimant) ≥ 2? Publish a kind-30382 edge from the issuer\'s rankAuthor, or run the app with DEV_SKIP_TRUST_CHECK=true.';

/** Poll until a claim from `pk` surfaces on the bounty (gated by the WoT rank check). */
async function pollClaimVisible(page, bountyId, pk, { timeout = 30000, message } = {}) {
  await expect.poll(async () => {
    const { claims } = await fetchBounty(page, bountyId);
    return (claims || []).some(c => c.event?.pubkey === pk);
  }, { timeout, message: message || `claim from ${pk.slice(0, 8)}… never appeared — ${RANK_HINT}` }).toBeTruthy();
}

/** Poll until every pubkey in `pks` has a visible claim on the bounty. */
async function pollAllClaimsVisible(page, bountyId, pks, { timeout = 45000, message } = {}) {
  await expect.poll(async () => {
    const { claims } = await fetchBounty(page, bountyId);
    const seen = new Set((claims || []).map(c => c.event?.pubkey));
    return pks.filter(pk => seen.has(pk)).length;
  }, { timeout, message: message || `not all ${pks.length} claims appeared — ${RANK_HINT}` }).toBe(pks.length);
}

/** Poll the live payment state until paidRewardCount reaches `expected`. */
async function pollPaidRewardCount(page, bountyId, expected, { timeout = 600000, message } = {}) {
  await expect.poll(async () => {
    const { bounty } = await fetchBounty(page, bountyId);
    return bounty?.paymentState?.paidRewardCount ?? -1;
  }, {
    timeout,
    intervals: [5000],
    message: message || 'no kind-9735 receipt reached paidRewardCount — was the invoice paid, and does the receipt land on the local relay?',
  }).toBe(expected);
}

/**
 * Drive the Payments-Due UI to mint a real BOLT11 invoice for the *oldest
 * payable claim of a specific bounty*. Scoped by the run-unique listCoordinate
 * so persisted prior-run bounties (same env keys) are never zapped by accident.
 */
async function readZapInvoice(page, listCoordinate, { navigate = true } = {}) {
  if (navigate) await page.goto('/tapestry/bounties/payments-due');

  // The card is the deepest <div> that both shows this coordinate and holds a
  // Zap button (the bare coordinate label has no button; page/app roots do but
  // are shallower).
  const card = page
    .locator('div', { hasText: listCoordinate })
    .filter({ has: page.getByRole('button', { name: /zap/i }) })
    .last();
  await expect(card, `no Payments-Due card for ${listCoordinate} — is a claim still payable?`).toBeVisible({ timeout: 30000 });

  await card.getByRole('button', { name: /zap/i }).first().click();

  const invoiceBox = card.locator('textarea[readonly]').first();
  try {
    await expect(invoiceBox).toBeVisible({ timeout: 30000 });
  } catch (e) {
    const text = await card.innerText().catch(() => '');
    throw new Error(`No BOLT11 invoice appeared after Zap for ${listCoordinate}. Card said:\n${text}`);
  }
  const invoice = (await invoiceBox.inputValue()).trim();
  expect(invoice, 'expected a BOLT11 invoice').toMatch(/^ln(bc|tb)/i);
  return invoice;
}

/** Loud console banner asking the human to pay an invoice. */
function printCheckpoint(invoice, timeoutMs, note = '') {
  console.log('\n========================= PAY THIS INVOICE =========================');
  if (note) console.log(note);
  console.log(invoice);
  console.log(`(waiting up to ${Math.round(timeoutMs / 1000)}s for the kind-9735 receipt…)`);
  console.log('====================================================================\n');
}

/** POST /api/receiving/probe -> { tracked, verdict }. */
async function probeTracked(page, value) {
  const resp = await page.request.post('/api/receiving/probe', { data: { value } });
  if (!resp.ok()) return { tracked: false, status: resp.status(), verdict: null };
  const body = await resp.json().catch(() => ({}));
  return { tracked: !!body.verdict?.tracked, verdict: body.verdict ?? null };
}

/** Read a pubkey's lud16 (or lud06) from their kind-0 profile via /api/profiles. */
async function fetchProfileLud16(page, pk) {
  const resp = await page.request.get(`/api/profiles?pubkeys=${pk}`);
  if (!resp.ok()) return null;
  const payload = await resp.json().catch(() => null);
  if (!payload) return null;
  const profiles = payload.profiles ?? payload;
  const entry = Array.isArray(profiles) ? profiles[0] : (profiles?.[pk] ?? null);
  return entry?.lud16 ?? entry?.lud06 ?? null;
}

module.exports = {
  nowSec,
  loadKey,
  signIn,
  injectSigner,
  publishEvent,
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
};
