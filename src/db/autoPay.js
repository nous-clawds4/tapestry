const { randomUUID } = require('crypto');
const { db } = require('./bounties');
const SecureKeyStorage = require('../utils/secureKeyStorage');

const AUTO_PAY_DAILY_LIMIT_SATS = 5000;
const AUTO_PAY_WINDOW_SECONDS = 24 * 60 * 60;
const SPEND_CAPABLE_STATES = ['attempting', 'paid', 'settled', 'paid_unreceipted'];
const FINAL_STATES = ['settled', 'paid_unreceipted', 'failed'];

db.exec(`
  CREATE TABLE IF NOT EXISTS auto_payments (
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
  CREATE INDEX IF NOT EXISTS idx_auto_payments_bounty ON auto_payments(bounty_id);
  CREATE INDEX IF NOT EXISTS idx_auto_payments_issuer ON auto_payments(issuer_pubkey);
  CREATE INDEX IF NOT EXISTS idx_auto_payments_state_created ON auto_payments(state, created_at);

  CREATE TABLE IF NOT EXISTS auto_pay_delegates (
    issuer_pubkey    TEXT PRIMARY KEY,
    delegate_pubkey  TEXT NOT NULL,
    delegate_nsec    TEXT NOT NULL,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
  );
`);

const selectByClaimIdsStmt = db.prepare(`
  SELECT * FROM auto_payments
  WHERE claim_event_id IN (
    SELECT value FROM json_each(@claimIdsJson)
  )
`);

const selectByClaimIdStmt = db.prepare(`
  SELECT * FROM auto_payments WHERE claim_event_id = ?
`);

const sumSpendCapableStmt = db.prepare(`
  SELECT COALESCE(SUM(amount_sats), 0) AS total
  FROM auto_payments
  WHERE created_at >= @since
    AND state IN ('attempting','paid','settled','paid_unreceipted')
`);

const insertAttemptingStmt = db.prepare(`
  INSERT INTO auto_payments (
    id, claim_event_id, bounty_id, issuer_pubkey, amount_sats,
    state, reason, bolt11, preimage, wallet_response, created_at, updated_at
  )
  VALUES (
    @id, @claim_event_id, @bounty_id, @issuer_pubkey, @amount_sats,
    'attempting', NULL, NULL, NULL, NULL, @created_at, @updated_at
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
  WHERE claim_event_id = @claim_event_id
`);

const selectRecentStmt = db.prepare(`
  SELECT *
  FROM auto_payments
  ORDER BY created_at DESC
  LIMIT @limit
`);

const selectDelegateStmt = db.prepare(`
  SELECT * FROM auto_pay_delegates WHERE issuer_pubkey = ?
`);

const upsertDelegateStmt = db.prepare(`
  INSERT INTO auto_pay_delegates (
    issuer_pubkey, delegate_pubkey, delegate_nsec, created_at, updated_at
  )
  VALUES (@issuer_pubkey, @delegate_pubkey, @delegate_nsec, @created_at, @updated_at)
  ON CONFLICT(issuer_pubkey) DO UPDATE SET
    delegate_pubkey = excluded.delegate_pubkey,
    delegate_nsec = excluded.delegate_nsec,
    updated_at = excluded.updated_at
`);

function secureStorage() {
  return new SecureKeyStorage();
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
    amount_sats,
    state,
    reason,
    created_at,
    updated_at,
  };
}

function listAutoPaymentsByClaimIds(claimIds = []) {
  const ids = [...new Set(claimIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = selectByClaimIdsStmt.all({ claimIdsJson: JSON.stringify(ids) });
  return new Map(rows.map(row => [row.claim_event_id, row]));
}

function getAutoPaymentByClaimId(claimId) {
  if (!claimId) return null;
  return selectByClaimIdStmt.get(claimId) ?? null;
}

function rollingWindowStart(now = nowSeconds()) {
  return now - AUTO_PAY_WINDOW_SECONDS;
}

function spendCapableTotalSince(since) {
  return Number(sumSpendCapableStmt.get({ since })?.total || 0);
}

function dailyLimitStatus({ amountSats, now = nowSeconds(), limitSats = AUTO_PAY_DAILY_LIMIT_SATS } = {}) {
  const amount = Number(amountSats);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('amountSats must be a positive integer');
  }
  const spentSats = spendCapableTotalSince(rollingWindowStart(now));
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

const insertAttemptingTransaction = db.transaction(({ claimEventId, bountyId, issuerPubkey, amountSats, now, limitSats }) => {
  const existing = getAutoPaymentByClaimId(claimEventId);
  if (existing) return { inserted: false, existing };

  const limit = dailyLimitStatus({ amountSats, now, limitSats });
  if (!limit.ok) return { inserted: false, reason: 'daily_cap_exceeded', limit };

  const row = {
    id: randomUUID(),
    claim_event_id: claimEventId,
    bounty_id: bountyId,
    issuer_pubkey: issuerPubkey,
    amount_sats: amountSats,
    created_at: now,
    updated_at: now,
  };
  insertAttemptingStmt.run(row);
  return { inserted: true, payment: getAutoPaymentByClaimId(claimEventId), limit };
});

function insertAttemptingPayment({
  claimEventId,
  bountyId,
  issuerPubkey,
  amountSats,
  now = nowSeconds(),
  limitSats = AUTO_PAY_DAILY_LIMIT_SATS,
}) {
  if (!claimEventId) throw new Error('claimEventId is required');
  if (!bountyId) throw new Error('bountyId is required');
  if (!issuerPubkey) throw new Error('issuerPubkey is required');
  return insertAttemptingTransaction({ claimEventId, bountyId, issuerPubkey, amountSats, now, limitSats });
}

function updatePaymentState(claimEventId, state, fields = {}) {
  if (!claimEventId) throw new Error('claimEventId is required');
  if (![...SPEND_CAPABLE_STATES, 'failed'].includes(state)) throw new Error(`invalid auto-payment state: ${state}`);
  updatePaymentStmt.run({
    claim_event_id: claimEventId,
    state,
    reason: fields.reason ?? null,
    bolt11: fields.bolt11 ?? null,
    preimage: fields.preimage ?? null,
    wallet_response: fields.walletResponse ? JSON.stringify(fields.walletResponse) : null,
    updated_at: fields.now ?? nowSeconds(),
  });
  return getAutoPaymentByClaimId(claimEventId);
}

function listRecentAutoPayments({ limit = 50 } = {}) {
  return selectRecentStmt.all({ limit: Math.min(Number(limit) || 50, 200) });
}

function getDelegate(issuerPubkey) {
  if (!issuerPubkey) return null;
  const row = selectDelegateStmt.get(issuerPubkey);
  if (!row) return null;
  return { ...row, delegate_nsec: decryptSecret(row.delegate_nsec) };
}

function upsertDelegate({ issuerPubkey, delegatePubkey, delegateNsec, now = nowSeconds() }) {
  upsertDelegateStmt.run({
    issuer_pubkey: issuerPubkey,
    delegate_pubkey: delegatePubkey,
    delegate_nsec: encryptSecret(delegateNsec),
    created_at: now,
    updated_at: now,
  });
  return getDelegate(issuerPubkey);
}

module.exports = {
  AUTO_PAY_DAILY_LIMIT_SATS,
  AUTO_PAY_WINDOW_SECONDS,
  FINAL_STATES,
  SPEND_CAPABLE_STATES,
  dailyLimitStatus,
  getAutoPaymentByClaimId,
  getDelegate,
  insertAttemptingPayment,
  listAutoPaymentsByClaimIds,
  listRecentAutoPayments,
  rowToClient,
  spendCapableTotalSince,
  updatePaymentState,
  upsertDelegate,
};
