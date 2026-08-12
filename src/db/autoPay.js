const path = require('path');
const { randomUUID } = require('crypto');
const { db, dbPath } = require('./bounties');
const { SecureKeyStorage } = require('../utils/secureKeyStorage');

const AUTO_PAY_DAILY_LIMIT_SATS = 5000;
const AUTO_PAY_WINDOW_SECONDS = 24 * 60 * 60;
const DEFAULT_RECEIPT_GRACE_SECONDS = 6 * 60 * 60;
const SPEND_CAPABLE_STATES = ['attempting', 'paid', 'settled', 'paid_unreceipted'];
const FINAL_STATES = ['settled', 'paid_unreceipted'];

function autoPaymentsTableSql(name) {
  return `
    CREATE TABLE ${name} (
      id               TEXT PRIMARY KEY,
      claim_event_id   TEXT NOT NULL,
      bounty_id        TEXT NOT NULL,
      issuer_pubkey    TEXT NOT NULL,
      claimant_pubkey  TEXT,
      claim_address    TEXT NOT NULL,
      amount_sats      INTEGER NOT NULL CHECK (amount_sats > 0),
      state            TEXT NOT NULL CHECK (state IN ('attempting','paid','settled','paid_unreceipted','failed')),
      reason           TEXT,
      bolt11           TEXT,
      preimage         TEXT,
      wallet_response  TEXT,
      created_at       INTEGER NOT NULL,
      updated_at       INTEGER NOT NULL,
      UNIQUE (bounty_id, claim_address)
    )
  `;
}

function legacyClaimAddress(claimEventId) {
  return `legacy:${claimEventId}`;
}

function normalizeStoredClaimAddress(row) {
  const pubkey = String(row.claimant_pubkey || '').toLowerCase();
  const address = String(row.claim_address || '');
  if (/^[0-9a-f]{64}$/.test(pubkey) && address.startsWith(`39999:${pubkey}:`) && address.length > 72) {
    return { claimantPubkey: pubkey, claimAddress: address };
  }
  return { claimantPubkey: null, claimAddress: legacyClaimAddress(row.claim_event_id) };
}

function isLegacyClaimAddress(value) {
  return String(value || '').startsWith('legacy:');
}

// A resolver may hand back the real claimant identity for an old row that
// carried only a claim event id. Accept it only when it is internally
// consistent, so a bad resolver can never invent a payment identity.
function validatedIdentity(candidate) {
  const claimantPubkey = String(candidate?.claimantPubkey || '').toLowerCase();
  const claimAddress = String(candidate?.claimAddress || '');
  if (!/^[0-9a-f]{64}$/.test(claimantPubkey)) return null;
  if (!claimAddress.startsWith(`39999:${claimantPubkey}:`) || claimAddress.length <= 72) return null;
  return { claimantPubkey, claimAddress };
}

// resolveLegacyIdentity is an optional synchronous lookup that turns an old row
// into a real (claimant, claim address) identity. Rows it cannot resolve keep a
// `legacy:` address; bin/agent.js repair-legacy-payments resolves those later
// against the relay, which the migration cannot reach synchronously.
function ensureAutoPaymentsSchema({ resolveLegacyIdentity = null } = {}) {
  const table = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'auto_payments'`).get();
  if (!table) {
    db.exec(autoPaymentsTableSql('auto_payments'));
    return;
  }
  const columns = db.prepare(`PRAGMA table_info(auto_payments)`).all().map(column => column.name);
  const current = columns.includes('claimant_pubkey')
    && columns.includes('claim_address')
    && /UNIQUE\s*\(\s*bounty_id\s*,\s*claim_address\s*\)/i.test(table.sql || '');
  if (current) return;

  const migrate = db.transaction(() => {
    db.exec(autoPaymentsTableSql('auto_payments_next'));
    const rows = db.prepare(`SELECT * FROM auto_payments ORDER BY created_at, id`).all();
    const insert = db.prepare(`
      INSERT INTO auto_payments_next (
        id, claim_event_id, bounty_id, issuer_pubkey, claimant_pubkey, claim_address,
        amount_sats, state, reason, bolt11, preimage, wallet_response, created_at, updated_at
      ) VALUES (
        @id, @claim_event_id, @bounty_id, @issuer_pubkey, @claimant_pubkey, @claim_address,
        @amount_sats, @state, @reason, @bolt11, @preimage, @wallet_response, @created_at, @updated_at
      )
    `);
    const used = new Set();
    for (const row of rows) {
      let identity = normalizeStoredClaimAddress(row);
      if (isLegacyClaimAddress(identity.claimAddress) && resolveLegacyIdentity) {
        try {
          identity = validatedIdentity(resolveLegacyIdentity(row)) || identity;
        } catch { /* an unresolvable row keeps its legacy identity */ }
      }
      let key = `${row.bounty_id}\u0000${identity.claimAddress}`;
      if (used.has(key)) {
        identity = { claimantPubkey: null, claimAddress: legacyClaimAddress(row.claim_event_id) };
        key = `${row.bounty_id}\u0000${identity.claimAddress}`;
      }
      if (used.has(key)) throw new Error(`duplicate legacy payment identity for ${row.id}`);
      used.add(key);
      insert.run({
        ...row,
        claimant_pubkey: identity.claimantPubkey,
        claim_address: identity.claimAddress,
      });
    }
    db.exec(`DROP TABLE auto_payments; ALTER TABLE auto_payments_next RENAME TO auto_payments`);
  });
  migrate();
}

ensureAutoPaymentsSchema();
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_auto_payments_bounty ON auto_payments(bounty_id);
  CREATE INDEX IF NOT EXISTS idx_auto_payments_issuer ON auto_payments(issuer_pubkey);
  CREATE INDEX IF NOT EXISTS idx_auto_payments_event ON auto_payments(bounty_id, claim_event_id);
  CREATE INDEX IF NOT EXISTS idx_auto_payments_state_created ON auto_payments(state, created_at);

  CREATE TABLE IF NOT EXISTS auto_pay_delegates (
    issuer_pubkey    TEXT PRIMARY KEY,
    delegate_pubkey  TEXT NOT NULL,
    delegate_nsec    TEXT NOT NULL,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
  );
`);

const selectByIdentityStmt = db.prepare(`
  SELECT * FROM auto_payments
  WHERE bounty_id = @bounty AND claim_address = @address
`);
const selectByEventStmt = db.prepare(`
  SELECT * FROM auto_payments
  WHERE bounty_id = @bounty AND claim_event_id = @event
`);
const selectByBountyStmt = db.prepare(`
  SELECT * FROM auto_payments
  WHERE bounty_id = @bounty AND issuer_pubkey = @issuer
  ORDER BY created_at, id
`);

const sumSpendCapableStmt = db.prepare(`
  SELECT COALESCE(SUM(amount_sats), 0) AS total
  FROM auto_payments
  WHERE created_at >= @since
    AND (
      state IN ('attempting','paid','settled','paid_unreceipted')
      OR (state = 'failed' AND reason LIKE 'ambiguous_send:%')
    )
`);

const sumSpendCapableByIssuerStmt = db.prepare(`
  SELECT COALESCE(SUM(amount_sats), 0) AS total
  FROM auto_payments
  WHERE created_at >= @since
    AND issuer_pubkey = @issuer
    AND (
      state IN ('attempting','paid','settled','paid_unreceipted')
      OR (state = 'failed' AND reason LIKE 'ambiguous_send:%')
    )
`);
// blocks the claim forever. This used to flip stale rows straight to 'failed'
// by SQL alone; now that a bolt11 may already be in flight when a row goes
// stale, deciding the final state needs a wallet-status check per row (see
// autoPayWatcher.reconcileStuckAttempts), so this only selects candidates —
// it never writes state itself.
const selectStuckAttemptingStmt = db.prepare(`
  SELECT * FROM auto_payments
  WHERE state = 'attempting' AND updated_at < @cutoff
`);

const deletePaymentStmt = db.prepare(`
  DELETE FROM auto_payments
  WHERE id = @id AND bounty_id = @bounty AND issuer_pubkey = @issuer
`);

const insertAttemptingStmt = db.prepare(`
  INSERT INTO auto_payments (
    id, claim_event_id, bounty_id, issuer_pubkey, claimant_pubkey, claim_address,
    amount_sats, state, reason, bolt11, preimage, wallet_response, created_at, updated_at
  )
  VALUES (
    @id, @claim_event_id, @bounty_id, @issuer_pubkey, @claimant_pubkey, @claim_address,
    @amount_sats, 'attempting', NULL, NULL, NULL, NULL, @created_at, @updated_at
  )
`);

const updatePaymentStmt = db.prepare(`
  UPDATE auto_payments
  SET state = @state,
      reason = @reason,
      bolt11 = COALESCE(@bolt11, bolt11),
      preimage = COALESCE(@preimage, preimage),
      wallet_response = COALESCE(@wallet_response, wallet_response),
      updated_at = @updated_at
  WHERE id = @id AND bounty_id = @bounty AND issuer_pubkey = @issuer
`);

const selectRecentStmt = db.prepare(`
  SELECT *
  FROM auto_payments
  ORDER BY created_at DESC
  LIMIT @limit
`);
const selectRecentByIssuerStmt = db.prepare(`
  SELECT *
  FROM auto_payments
  WHERE issuer_pubkey = @issuer
  ORDER BY created_at DESC
  LIMIT @limit
`);

// paid_unreceipted means the sats left and no kind-9735 receipt appeared. It is
// not repairable by another pass: Strike publishes the receipt or it never
// does. Keep such a row in the reconciliation queue only until the grace window
// closes, otherwise one missing receipt fails the settlement timer forever.
const selectReconciliationByIssuerStmt = db.prepare(`
  SELECT *
  FROM auto_payments
  WHERE issuer_pubkey = @issuer
    AND (
      state IN ('attempting','paid','failed')
      OR (state = 'paid_unreceipted' AND created_at > @receiptGraceCutoff)
    )
  ORDER BY created_at ASC
`);

const selectLegacyStmt = db.prepare(`
  SELECT *
  FROM auto_payments
  WHERE claim_address LIKE 'legacy:%'
  ORDER BY created_at, id
`);
const selectLegacyByIssuerStmt = db.prepare(`
  SELECT *
  FROM auto_payments
  WHERE claim_address LIKE 'legacy:%' AND issuer_pubkey = @issuer
  ORDER BY created_at, id
`);
const repairIdentityStmt = db.prepare(`
  UPDATE auto_payments
  SET claimant_pubkey = @claimant, claim_address = @address, updated_at = @updated_at
  WHERE id = @id AND bounty_id = @bounty AND claim_address = @previous
`);


const selectDelegateStmt = db.prepare(`
  SELECT * FROM auto_pay_delegates WHERE issuer_pubkey = ?
`);

const insertDelegateStmt = db.prepare(`
  INSERT INTO auto_pay_delegates (
    issuer_pubkey, delegate_pubkey, delegate_nsec, created_at, updated_at
  )
  VALUES (@issuer_pubkey, @delegate_pubkey, @delegate_nsec, @created_at, @updated_at)
  ON CONFLICT(issuer_pubkey) DO NOTHING
`);

function secureStorage() {
  // We only use encrypt()/decrypt() (the nsec lives in SQLite, not the file
  // backend), but the constructor still mkdirs storagePath — co-locate it with
  // the bounties DB so it's writable wherever that is (prod /var/lib, dev data/).
  // ponytail: encrypt-only; revisit if we ever use the file/vault backends.
  return new SecureKeyStorage({ storagePath: path.join(path.dirname(dbPath), 'secure-keys') });
}

function encryptSecret(value) {
  return JSON.stringify(secureStorage().encrypt(value));
}

function decryptSecret(value) {
  if (!value) return value;
  try {
    return secureStorage().decrypt(JSON.parse(value));
  } catch {
    return value;
  }
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function rowToClient(row) {
  if (!row) return null;
  const {
    id,
    claim_event_id,
    bounty_id,
    issuer_pubkey,
    claimant_pubkey,
    claim_address,
    amount_sats,
    state,
    reason,
    created_at,
    updated_at,
  } = row;
  return {
    id,
    claim_event_id,
    bounty_id,
    issuer_pubkey,
    claimant_pubkey,
    claim_address,
    amount_sats,
    state,
    reason,
    created_at,
    updated_at,
  };
}

function stableClaimAddress(event, expectedListCoordinate = null) {
  const pubkey = String(event?.pubkey || '').toLowerCase();
  const coordinates = (event?.tags || []).filter(tag => tag[0] === 'z').map(tag => tag[1]);
  if (Number(event?.kind) !== 39999 || !/^[0-9a-f]{64}$/.test(pubkey)
      || coordinates.length !== 1
      || typeof coordinates[0] !== 'string' || !coordinates[0]
      || (expectedListCoordinate !== null && coordinates[0] !== expectedListCoordinate)) {
    return null;
  }
  return `39999:${pubkey}:${coordinates[0]}`;
}

function getAutoPayment({ bountyId, claimAddress = null, claimEventId = null, issuerPubkey = null } = {}) {
  if (!bountyId) throw new Error('bountyId is required');
  if (!claimAddress && !claimEventId) throw new Error('claimAddress or claimEventId is required');
  const row = claimAddress
    ? selectByIdentityStmt.get({ bounty: bountyId, address: claimAddress })
    : selectByEventStmt.get({ bounty: bountyId, event: claimEventId });
  if (row && issuerPubkey && String(row.issuer_pubkey).toLowerCase() !== String(issuerPubkey).toLowerCase()) {
    throw new Error('payment issuer mismatch');
  }
  return row ?? null;
}

function listAutoPaymentsForBounty({ bountyId, issuerPubkey } = {}) {
  if (!bountyId) throw new Error('bountyId is required');
  if (!issuerPubkey) throw new Error('issuerPubkey is required');
  return selectByBountyStmt.all({
    bounty: bountyId,
    issuer: String(issuerPubkey).toLowerCase(),
  });
}

function rollingWindowStart(now = nowSeconds()) {
  return now - AUTO_PAY_WINDOW_SECONDS;
}

function spendCapableTotalSince(since, issuerPubkey = null) {
  if (issuerPubkey) {
    return Number(sumSpendCapableByIssuerStmt.get({
      since,
      issuer: String(issuerPubkey).toLowerCase(),
    })?.total || 0);
  }
  return Number(sumSpendCapableStmt.get({ since })?.total || 0);
}

// issuerPubkey scopes the 24h cap to one issuer; omit it for a global view
// (back-compat for callers/tests that pre-date per-issuer caps).
function dailyLimitStatus({ amountSats, now = nowSeconds(), limitSats = AUTO_PAY_DAILY_LIMIT_SATS, issuerPubkey = null } = {}) {
  const amount = Number(amountSats);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('amountSats must be a positive integer');
  }
  const spentSats = spendCapableTotalSince(rollingWindowStart(now), issuerPubkey);
  const remainingSats = Math.max(0, limitSats - spentSats);
  return {
    ok: spentSats + amount <= limitSats,
    limitSats,
    spentSats,
    remainingSats,
    nextAmountSats: amount,
    reason: spentSats + amount <= limitSats ? null : 'daily_cap_exceeded',
  };
}

const insertAttemptingTransaction = db.transaction(({
  claimEventId,
  bountyId,
  issuerPubkey,
  claimantPubkey,
  claimAddress,
  amountSats,
  now,
  limitSats,
}) => {
  const existing = getAutoPayment({ bountyId, claimAddress, issuerPubkey });
  if (existing) return { inserted: false, existing };

  const limit = dailyLimitStatus({ amountSats, now, limitSats, issuerPubkey });
  if (!limit.ok) return { inserted: false, reason: 'daily_cap_exceeded', limit };

  const row = {
    id: randomUUID(),
    claim_event_id: claimEventId,
    bounty_id: bountyId,
    issuer_pubkey: String(issuerPubkey).toLowerCase(),
    claimant_pubkey: String(claimantPubkey).toLowerCase(),
    claim_address: claimAddress,
    amount_sats: amountSats,
    created_at: now,
    updated_at: now,
  };
  insertAttemptingStmt.run(row);
  return {
    inserted: true,
    payment: getAutoPayment({ bountyId, claimAddress, issuerPubkey }),
    limit,
  };
});

function insertAttemptingPayment({
  claimEventId,
  bountyId,
  issuerPubkey,
  claimantPubkey,
  claimAddress,
  amountSats,
  now = nowSeconds(),
  limitSats = AUTO_PAY_DAILY_LIMIT_SATS,
}) {
  if (!claimEventId) throw new Error('claimEventId is required');
  if (!bountyId) throw new Error('bountyId is required');
  if (!/^[0-9a-f]{64}$/i.test(String(issuerPubkey || ''))) throw new Error('issuerPubkey is required');
  if (!/^[0-9a-f]{64}$/i.test(String(claimantPubkey || ''))) throw new Error('claimantPubkey is required');
  if (typeof claimAddress !== 'string' || !claimAddress.startsWith(`39999:${String(claimantPubkey).toLowerCase()}:`)) {
    throw new Error('claimAddress must match claimantPubkey');
  }
  return insertAttemptingTransaction({
    claimEventId,
    bountyId,
    issuerPubkey,
    claimantPubkey,
    claimAddress,
    amountSats,
    now,
    limitSats,
  });
}

function paymentReference(row) {
  if (!row?.id || !row?.bounty_id || !row?.issuer_pubkey) throw new Error('scoped payment reference is required');
  return { paymentId: row.id, bountyId: row.bounty_id, issuerPubkey: row.issuer_pubkey };
}

function updatePaymentState({ paymentId, bountyId, issuerPubkey } = {}, state, fields = {}) {
  if (!paymentId || !bountyId || !issuerPubkey) throw new Error('scoped payment reference is required');
  if (![...SPEND_CAPABLE_STATES, 'failed'].includes(state)) throw new Error(`invalid auto-payment state: ${state}`);
  const result = updatePaymentStmt.run({
    id: paymentId,
    bounty: bountyId,
    issuer: String(issuerPubkey).toLowerCase(),
    state,
    reason: fields.reason ?? null,
    bolt11: fields.bolt11 ?? null,
    preimage: fields.preimage ?? null,
    wallet_response: fields.walletResponse ? JSON.stringify(fields.walletResponse) : null,
    updated_at: fields.now ?? nowSeconds(),
  });
  if (result.changes !== 1) throw new Error('payment scope mismatch');
  return db.prepare(`SELECT * FROM auto_payments WHERE id = ?`).get(paymentId);
}

function listRecentAutoPayments({ limit = 50, issuerPubkey = null } = {}) {
  const params = { limit: Math.min(Number(limit) || 50, 200) };
  if (!issuerPubkey) return selectRecentStmt.all(params);
  return selectRecentByIssuerStmt.all({ ...params, issuer: issuerPubkey });
}
function receiptGraceSeconds(value = process.env.AUTO_PAY_RECEIPT_GRACE_SECONDS) {
  // Blank means unset: docker-compose's ${VAR:-} pattern passes "" and Number("") is 0,
  // which would silently collapse the grace window to zero seconds.
  if (value == null || String(value).trim() === '') return DEFAULT_RECEIPT_GRACE_SECONDS;
  const configured = Number(value);
  if (!Number.isSafeInteger(configured) || configured < 0) return DEFAULT_RECEIPT_GRACE_SECONDS;
  return configured;
}

function listReconciliationPayments(issuerPubkey, {
  now = nowSeconds(),
  graceSeconds = receiptGraceSeconds(),
} = {}) {
  if (!issuerPubkey) return [];
  return selectReconciliationByIssuerStmt.all({
    issuer: issuerPubkey,
    receiptGraceCutoff: now - graceSeconds,
  });
}

// Old rows carry only a claim event id. resolveIdentity is given the row and
// returns the real (claimant, claim address) pair, or null when the claim event
// is gone from the relay and only a human can decide. Nothing is guessed.
async function repairLegacyPayments({
  issuerPubkey = null,
  resolveIdentity,
  dryRun = false,
  now = nowSeconds(),
} = {}) {
  if (typeof resolveIdentity !== 'function') throw new Error('resolveIdentity is required');
  const rows = issuerPubkey
    ? selectLegacyByIssuerStmt.all({ issuer: String(issuerPubkey).toLowerCase() })
    : selectLegacyStmt.all();
  const results = [];
  for (const row of rows) {
    const base = {
      paymentId: row.id,
      bountyId: row.bounty_id,
      claimEventId: row.claim_event_id,
      issuerPubkey: row.issuer_pubkey,
      state: row.state,
    };
    let identity = null;
    try {
      identity = validatedIdentity(await resolveIdentity(row));
    } catch (error) {
      results.push({ ...base, repaired: false, status: 'resolver_failed', reason: error.message });
      continue;
    }
    if (!identity) {
      results.push({ ...base, repaired: false, status: 'unresolvable' });
      continue;
    }
    const conflict = selectByIdentityStmt.get({ bounty: row.bounty_id, address: identity.claimAddress });
    if (conflict && conflict.id !== row.id) {
      results.push({ ...base, repaired: false, status: 'identity_conflict', claimAddress: identity.claimAddress });
      continue;
    }
    if (dryRun) {
      results.push({ ...base, repaired: false, status: 'would_repair', claimAddress: identity.claimAddress });
      continue;
    }
    const changed = repairIdentityStmt.run({
      id: row.id,
      bounty: row.bounty_id,
      previous: row.claim_address,
      claimant: identity.claimantPubkey,
      address: identity.claimAddress,
      updated_at: now,
    }).changes;
    results.push({
      ...base,
      repaired: changed === 1,
      status: changed === 1 ? 'repaired' : 'write_skipped',
      claimAddress: identity.claimAddress,
    });
  }
  return {
    ok: results.every(result => result.status === 'repaired' || result.status === 'would_repair'),
    dryRun: Boolean(dryRun),
    legacyRows: rows.length,
    results,
  };
}


function getDelegate(issuerPubkey) {
  if (!issuerPubkey) return null;
  const row = selectDelegateStmt.get(issuerPubkey);
  if (!row) return null;
  return { ...row, delegate_nsec: decryptSecret(row.delegate_nsec) };
}

// Read-only: returns just the (plaintext) delegate pubkey for receipt matching,
// never constructing SecureKeyStorage. The signing path uses getDelegate().
function getDelegatePubkey(issuerPubkey) {
  if (!issuerPubkey) return null;
  return selectDelegateStmt.get(issuerPubkey)?.delegate_pubkey ?? null;
}

// Raw candidate list for the stuck-attempt sweep — see selectStuckAttemptingStmt.
function listStuckAttempting({ olderThanSeconds = 600, now = nowSeconds() } = {}) {
  return selectStuckAttemptingStmt.all({ cutoff: now - olderThanSeconds });
}

// Admin escape hatch: drop a payment row so the claim can be re-attempted. We
// never auto-retry a payment (could double-pay); this is a deliberate reset.
//
// Only 'failed' rows are resettable AT ALL: an 'attempting' row may have a
// live send still in flight, and paid/settled/paid_unreceipted rows are
// definitively-paid money — deleting any of those re-opens the claim for a
// second send. force does not override this; those rows need a different
// remediation (wait, or manual DB surgery with wallet history in hand).
//
// Among 'failed' rows, a reason prefixed 'ambiguous_send:' represents a send
// we could not verify as failed (the wallet was inconclusive after an error) —
// blocked unless the caller explicitly forces it after checking wallet
// history. (Pinned contract: the auto-pay reset API spreads this return value
// as-is, so the shape here — {reset} or {reset:false, blocked} — must not change.)
function resetPayment({ bountyId, claimEventId, issuerPubkey } = {}, opts = {}) {
  if (!bountyId) throw new Error('bountyId is required');
  if (!claimEventId) throw new Error('claimEventId is required');
  if (!issuerPubkey) throw new Error('issuerPubkey is required');
  const existing = getAutoPayment({ bountyId, claimEventId });
  if (!existing) return { reset: false };
  if (String(existing.issuer_pubkey).toLowerCase() !== String(issuerPubkey).toLowerCase()) {
    throw new Error('payment issuer mismatch');
  }
  if (existing.state !== 'failed') {
    return { reset: false, blocked: 'not_failed' };
  }
  if (String(existing.reason || '').startsWith('ambiguous_send:') && opts.force !== true) {
    return { reset: false, blocked: 'ambiguous_payment' };
  }
  return {
    reset: deletePaymentStmt.run({
      id: existing.id,
      bounty: existing.bounty_id,
      issuer: existing.issuer_pubkey,
    }).changes > 0,
  };
}

function insertDelegateIfAbsent({ issuerPubkey, delegatePubkey, delegateNsec, now = nowSeconds() }) {
  const result = insertDelegateStmt.run({
    issuer_pubkey: issuerPubkey,
    delegate_pubkey: delegatePubkey,
    delegate_nsec: encryptSecret(delegateNsec),
    created_at: now,
    updated_at: now,
  });
  return {
    inserted: result.changes > 0,
    delegatePubkey: getDelegatePubkey(issuerPubkey),
  };
}

module.exports = {
  AUTO_PAY_DAILY_LIMIT_SATS,
  AUTO_PAY_WINDOW_SECONDS,
  DEFAULT_RECEIPT_GRACE_SECONDS,
  FINAL_STATES,
  SPEND_CAPABLE_STATES,
  dailyLimitStatus,
  ensureAutoPaymentsSchema,
  receiptGraceSeconds,
  repairLegacyPayments,
  getAutoPayment,
  getDelegate,
  getDelegatePubkey,
  insertDelegateIfAbsent,
  insertAttemptingPayment,
  listAutoPaymentsForBounty,
  listRecentAutoPayments,
  listReconciliationPayments,
  listStuckAttempting,
  paymentReference,
  resetPayment,
  rowToClient,
  spendCapableTotalSince,
  stableClaimAddress,
  updatePaymentState,
};
