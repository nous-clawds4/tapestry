/* Standalone snapshot tool: signs in as issuer/claimant and screenshots the
 * current state of a bounty + payments pages. Usage:
 *   node tests/bounties/autopay-snap.js <bountyId> <prefix>
 * Env: ISSUER_NSEC, CLAIMANT_NSEC, BRAINSTORM_BASE_URL (default :7778)
 */
const { chromium } = require('@playwright/test');
const { finalizeEvent, getPublicKey, nip19 } = require('nostr-tools');

const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const [bountyId, prefix = 'snap'] = process.argv.slice(2);

function loadKey(raw) {
  const hex = raw.startsWith('nsec1')
    ? Buffer.from(nip19.decode(raw).data).toString('hex')
    : raw.toLowerCase();
  const sk = Uint8Array.from(Buffer.from(hex, 'hex'));
  return { sk, pk: getPublicKey(sk) };
}

async function signIn(ctx, { sk, pk }) {
  const req = ctx.request;
  const v = await (await req.post(`${BASE}/api/auth/verify-user`, { data: { pubkey: pk } })).json();
  if (!v.authorized) throw new Error(`verify-user denied: ${v.message}`);
  const signed = finalizeEvent({
    kind: 22242, created_at: Math.floor(Date.now() / 1000),
    tags: [['challenge', v.challenge]], content: 'Tapestry authentication',
  }, sk);
  const l = await (await req.post(`${BASE}/api/auth/login-user`, { data: { event: signed } })).json();
  if (!l.success) throw new Error(`login failed: ${l.message}`);
}

(async () => {
  const issuer = loadKey(process.env.ISSUER_NSEC);
  const claimant = loadKey(process.env.CLAIMANT_NSEC);
  const browser = await chromium.launch();
  let n = 0;
  const snap = async (page, name) => {
    n += 1;
    const file = `screenshots-autopay/${prefix}-${String(n).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  };
  try {
    for (const [who, key, pages] of [
      ['issuer', issuer, [[`/tapestry/bounties/${bountyId}`, 'bounty-detail'], ['/tapestry/bounties/payments-due', 'payments-due']]],
      ['claimant', claimant, [[`/tapestry/bounties/${bountyId}`, 'bounty-detail'], ['/tapestry/bounties/payments-to-me', 'payments-to-me']]],
    ]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: BASE });
      await signIn(ctx, key);
      const page = await ctx.newPage();
      for (const [path, name] of pages) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await snap(page, `${who}-${name}`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err.message); process.exit(1); });
