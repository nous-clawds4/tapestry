// Regression cover for the auto_payments schema migration.
//
// Old rows stored only a claim event id. The migration rewrites them with a
// `legacy:<event>` claim address. A read path that treats every such row as a
// block closes all remaining slots on a live bounty the first time the new
// image boots. These checks pin the opposite behaviour: a migrated row whose
// claim event is still on the relay is resolved and leaves the bounty
// claimable, and only a row with no live event blocks anything.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brainstorm-auto-pay-migration-'));
process.env.BOUNTIES_DB_PATH = path.join(directory, 'bounties.db');
process.env.AUTO_PAY_MAX_SATS = '1000000';

const issuer = 'a'.repeat(64);
const paidClaimant = 'b'.repeat(64);
const newClaimant = 'c'.repeat(64);
const missingClaimant = 'd'.repeat(64);
const paidClaimEventId = '1'.repeat(64);
const newClaimEventId = '2'.repeat(64);
const missingClaimEventId = '3'.repeat(64);

// ── the pre-migration fixture ────────────────────────────────────────────────
const { createBounty } = require('../src/db/bounties');
const openBounty = createBounty({
  issuerPubkey: issuer,
  listCoordinate: `39998:${issuer}:migration-open`,
  amountSats: 100,
  bountyCapSats: 500,
  criteria: 'Submit one item.',
});
const strandedBounty = createBounty({
  issuerPubkey: issuer,
  listCoordinate: `39998:${issuer}:migration-stranded`,
  amountSats: 100,
  bountyCapSats: 500,
  criteria: 'Submit one item.',
});

const OLD_AUTO_PAYMENTS_SCHEMA = `
  CREATE TABLE auto_payments (
    id              TEXT PRIMARY KEY,
    claim_event_id  TEXT NOT NULL UNIQUE,
    bounty_id       TEXT NOT NULL,
    issuer_pubkey   TEXT NOT NULL,
    amount_sats     INTEGER NOT NULL CHECK (amount_sats > 0),
    state           TEXT NOT NULL CHECK (state IN ('attempting','paid','settled','paid_unreceipted','failed')),
    reason          TEXT,
    bolt11          TEXT,
    preimage        TEXT,
    wallet_response TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  );
`;
const fixture = new Database(process.env.BOUNTIES_DB_PATH);
fixture.exec(OLD_AUTO_PAYMENTS_SCHEMA);
const insertOldRow = fixture.prepare(`
  INSERT INTO auto_payments (
    id, claim_event_id, bounty_id, issuer_pubkey, amount_sats, state,
    reason, bolt11, preimage, wallet_response, created_at, updated_at
  ) VALUES (
    @id, @claim_event_id, @bounty_id, @issuer_pubkey, @amount_sats, @state,
    NULL, NULL, NULL, NULL, @created_at, @updated_at
  )
`);
const fixtureNow = Math.floor(Date.now() / 1000) - 3600;
insertOldRow.run({
  id: 'legacy-settled-1',
  claim_event_id: paidClaimEventId,
  bounty_id: openBounty.id,
  issuer_pubkey: issuer,
  amount_sats: 100,
  state: 'settled',
  created_at: fixtureNow,
  updated_at: fixtureNow,
});
insertOldRow.run({
  id: 'legacy-settled-2',
  claim_event_id: missingClaimEventId,
  bounty_id: strandedBounty.id,
  issuer_pubkey: issuer,
  amount_sats: 100,
  state: 'settled',
  created_at: fixtureNow,
  updated_at: fixtureNow,
});
fixture.close();

// ── relay and rank stubs, installed before the read path loads ───────────────
const claimEvent = (id, pubkey, coordinate, createdAt) => ({
  id,
  kind: 39999,
  pubkey,
  created_at: createdAt,
  tags: [['z', coordinate]],
  content: 'fixture claim',
});
const relayEvents = [
  claimEvent(paidClaimEventId, paidClaimant, openBounty.list_coordinate, fixtureNow),
  claimEvent(newClaimEventId, newClaimant, openBounty.list_coordinate, fixtureNow + 10),
];

const childProcess = require('child_process');
childProcess.exec = (command, options, callback) => {
  const done = typeof options === 'function' ? options : callback;
  const filter = JSON.parse(command.replace(/^strfry scan '/, '').replace(/'$/, ''));
  let matched = relayEvents;
  if (filter.kinds) matched = matched.filter(event => filter.kinds.includes(event.kind));
  if (filter.ids) matched = matched.filter(event => filter.ids.includes(event.id));
  if (filter['#z']) matched = matched.filter(event => event.tags.some(tag => tag[0] === 'z' && filter['#z'].includes(tag[1])));
  if (filter['#e']) matched = [];
  done(null, { stdout: `${matched.map(event => JSON.stringify(event)).join('\n')}\n`, stderr: '' });
  return { on() {} };
};

const trustRank = require('../src/lib/trust-rank');
trustRank.rank = async () => 100;

// Requiring the auto-pay module runs ensureAutoPaymentsSchema against the
// fixture database above — this is the migration under test.
const autoPay = require('../src/db/autoPay');
const { listClaimsFor, scanClaimEvent } = require('../src/api/bounties');
const { calculateBountyPaymentState } = require('../src/lib/bounty-policy');

const migratedRows = autoPay.listAutoPaymentsForBounty({ bountyId: openBounty.id, issuerPubkey: issuer });
assert.equal(migratedRows.length, 1);
assert.equal(migratedRows[0].claim_address, `legacy:${paidClaimEventId}`);
assert.equal(migratedRows[0].claimant_pubkey, null);
assert.equal(migratedRows[0].state, 'settled');

(async () => {
  // ── a migrated row with a live claim event must not close the bounty ───────
  const claims = await listClaimsFor(openBounty);
  assert.equal(claims.length, 2);
  const paidClaim = claims.find(claim => claim.event.id === paidClaimEventId);
  const newClaim = claims.find(claim => claim.event.id === newClaimEventId);
  assert.ok(paidClaim && newClaim);
  assert.equal(paidClaim.autoPayment.state, 'settled');
  assert.equal(paidClaim.legacyPaymentBlock, false, 'a resolvable migrated row must not block its bounty');
  assert.equal(newClaim.autoPayment, null);

  const state = calculateBountyPaymentState(openBounty, claims);
  assert.equal(state.legacyPaymentBlock, false);
  assert.equal(state.totalRewardSlots, 5);
  assert.equal(state.heldRewardCount, 1, 'the migrated payment still consumes exactly one slot');
  assert.equal(state.payableClaims.length, 1, 'a new claim stays claimable after migration');
  assert.equal(state.payableClaims[0].event.id, newClaimEventId);
  assert.equal(state.closedClaims.length, 0);

  // ── a migrated row with no live claim event still blocks, by design ────────
  const strandedClaims = await listClaimsFor(strandedBounty);
  assert.equal(strandedClaims.length, 1);
  assert.equal(strandedClaims[0].durableOnly, true);
  assert.equal(strandedClaims[0].legacyPaymentBlock, true, 'an unresolvable migrated row must keep blocking');

  // ── the repair command resolves what the migration could not ──────────────
  assert.equal((await scanClaimEvent(paidClaimEventId)).pubkey, paidClaimant);
  assert.equal(await scanClaimEvent(missingClaimEventId), null);

  const dry = await autoPay.repairLegacyPayments({
    issuerPubkey: issuer,
    dryRun: true,
    resolveIdentity: async (row) => {
      const event = await scanClaimEvent(row.claim_event_id);
      if (!event) return null;
      const bounty = row.bounty_id === openBounty.id ? openBounty : strandedBounty;
      return {
        claimantPubkey: event.pubkey,
        claimAddress: autoPay.stableClaimAddress(event, bounty.list_coordinate),
      };
    },
  });
  assert.equal(dry.legacyRows, 2);
  assert.equal(dry.ok, false, 'an unresolvable row must fail the repair run');
  assert.equal(dry.results.filter(result => result.status === 'would_repair').length, 1);
  assert.equal(dry.results.filter(result => result.status === 'unresolvable').length, 1);
  assert.equal(
    autoPay.listAutoPaymentsForBounty({ bountyId: openBounty.id, issuerPubkey: issuer })[0].claim_address,
    `legacy:${paidClaimEventId}`,
    'a dry run must not write',
  );

  const repaired = await autoPay.repairLegacyPayments({
    issuerPubkey: issuer,
    resolveIdentity: async (row) => {
      const event = await scanClaimEvent(row.claim_event_id);
      if (!event) return null;
      return {
        claimantPubkey: event.pubkey,
        claimAddress: autoPay.stableClaimAddress(event, openBounty.list_coordinate),
      };
    },
  });
  assert.equal(repaired.results.filter(result => result.status === 'repaired').length, 1);
  const repairedRow = autoPay.listAutoPaymentsForBounty({ bountyId: openBounty.id, issuerPubkey: issuer })[0];
  assert.equal(repairedRow.claimant_pubkey, paidClaimant);
  assert.equal(repairedRow.claim_address, `39999:${paidClaimant}:${openBounty.list_coordinate}`);

  // A repaired row keeps its slot and keeps the bounty open.
  const afterRepair = calculateBountyPaymentState(openBounty, await listClaimsFor(openBounty));
  assert.equal(afterRepair.heldRewardCount, 1);
  assert.equal(afterRepair.payableClaims.length, 1);

  // ── the migration accepts an identity resolver when one is available ──────
  const { db } = require('../src/db/bounties');
  db.exec('DROP TABLE auto_payments');
  db.exec(OLD_AUTO_PAYMENTS_SCHEMA);
  db.prepare(`
    INSERT INTO auto_payments (
      id, claim_event_id, bounty_id, issuer_pubkey, amount_sats, state,
      reason, bolt11, preimage, wallet_response, created_at, updated_at
    ) VALUES (
      @id, @claim_event_id, @bounty_id, @issuer_pubkey, 100, 'settled',
      NULL, NULL, NULL, NULL, @created_at, @created_at
    )
  `).run({
    id: 'legacy-settled-3',
    claim_event_id: paidClaimEventId,
    bounty_id: openBounty.id,
    issuer_pubkey: issuer,
    created_at: fixtureNow,
  });
  autoPay.ensureAutoPaymentsSchema({
    resolveLegacyIdentity: (row) => (row.claim_event_id === paidClaimEventId
      ? { claimantPubkey: paidClaimant, claimAddress: `39999:${paidClaimant}:${openBounty.list_coordinate}` }
      : null),
  });
  const backfilled = db.prepare('SELECT * FROM auto_payments WHERE id = ?').get('legacy-settled-3');
  assert.equal(backfilled.claimant_pubkey, paidClaimant);
  assert.equal(backfilled.claim_address, `39999:${paidClaimant}:${openBounty.list_coordinate}`);

  db.exec('DROP TABLE auto_payments');
  db.exec(OLD_AUTO_PAYMENTS_SCHEMA);
  db.prepare(`
    INSERT INTO auto_payments (
      id, claim_event_id, bounty_id, issuer_pubkey, amount_sats, state,
      reason, bolt11, preimage, wallet_response, created_at, updated_at
    ) VALUES (
      @id, @claim_event_id, @bounty_id, @issuer_pubkey, 100, 'settled',
      NULL, NULL, NULL, NULL, @created_at, @created_at
    )
  `).run({
    id: 'legacy-settled-4',
    claim_event_id: paidClaimEventId,
    bounty_id: openBounty.id,
    issuer_pubkey: issuer,
    created_at: fixtureNow,
  });
  autoPay.ensureAutoPaymentsSchema({
    resolveLegacyIdentity: () => ({ claimantPubkey: 'not-a-pubkey', claimAddress: 'nonsense' }),
  });
  const refused = db.prepare('SELECT * FROM auto_payments WHERE id = ?').get('legacy-settled-4');
  assert.equal(refused.claim_address, `legacy:${paidClaimEventId}`, 'an invalid resolver result must be refused');
  assert.equal(missingClaimant.length, 64);

  console.log('auto-pay migration self-checks passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
