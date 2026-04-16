const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_PROD_DIR = '/var/lib/brainstorm';
const DEFAULT_DEV_DIR = path.join(__dirname, '..', '..', 'data');

function resolveDbPath() {
  if (process.env.BOUNTIES_DB_PATH) return process.env.BOUNTIES_DB_PATH;
  const prodDir = DEFAULT_PROD_DIR;
  try {
    fs.accessSync(prodDir, fs.constants.W_OK);
    return path.join(prodDir, 'bounties.db');
  } catch {
    fs.mkdirSync(DEFAULT_DEV_DIR, { recursive: true });
    return path.join(DEFAULT_DEV_DIR, 'bounties.db');
  }
}

const dbPath = resolveDbPath();
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS bounties (
    id              TEXT PRIMARY KEY,
    issuer_pubkey   TEXT NOT NULL,
    list_coordinate TEXT NOT NULL,
    amount_sats     INTEGER NOT NULL CHECK (amount_sats > 0),
    criteria        TEXT NOT NULL,
    expiration      INTEGER,
    created_at      INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled','expired'))
  );
  CREATE INDEX IF NOT EXISTS idx_bounties_list   ON bounties(list_coordinate);
  CREATE INDEX IF NOT EXISTS idx_bounties_issuer ON bounties(issuer_pubkey);
  CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
`);

const insertStmt = db.prepare(`
  INSERT INTO bounties (id, issuer_pubkey, list_coordinate, amount_sats, criteria, expiration, created_at, status)
  VALUES (@id, @issuer_pubkey, @list_coordinate, @amount_sats, @criteria, @expiration, @created_at, 'open')
`);
const selectOpenStmt = db.prepare(`
  SELECT * FROM bounties
  WHERE status = 'open' AND (expiration IS NULL OR expiration > @now)
  ORDER BY amount_sats DESC
  LIMIT @limit
`);
const selectAllStmt = db.prepare(`SELECT * FROM bounties ORDER BY amount_sats DESC LIMIT @limit`);
const selectByIdStmt = db.prepare(`SELECT * FROM bounties WHERE id = ?`);
const selectByIssuerStmt = db.prepare(`SELECT * FROM bounties WHERE issuer_pubkey = ? ORDER BY created_at DESC`);
const markFulfilledStmt = db.prepare(`UPDATE bounties SET status = 'fulfilled' WHERE id = ?`);

function createBounty({ issuerPubkey, listCoordinate, amountSats, criteria, expiration }) {
  const id = uuidv4();
  const row = {
    id,
    issuer_pubkey: issuerPubkey,
    list_coordinate: listCoordinate,
    amount_sats: amountSats,
    criteria,
    expiration: expiration ?? null,
    created_at: Math.floor(Date.now() / 1000),
  };
  insertStmt.run(row);
  return { ...row, status: 'open' };
}

function listOpenBounties({ limit = 100 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return selectOpenStmt.all({ now, limit });
}

function listAllBounties({ limit = 100 } = {}) {
  return selectAllStmt.all({ limit });
}

function getBounty(id) {
  return selectByIdStmt.get(id) ?? null;
}

function bountiesByIssuer(pubkey) {
  return selectByIssuerStmt.all(pubkey);
}

function markFulfilled(id) {
  markFulfilledStmt.run(id);
}

module.exports = {
  db,
  dbPath,
  createBounty,
  listOpenBounties,
  listAllBounties,
  getBounty,
  bountiesByIssuer,
  markFulfilled,
};
