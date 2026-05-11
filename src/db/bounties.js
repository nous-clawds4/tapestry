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
    bounty_cap_sats INTEGER NOT NULL CHECK (bounty_cap_sats > 0),
    reward_per_item INTEGER NOT NULL DEFAULT 0 CHECK (reward_per_item IN (0,1)),
    max_rewards_per_npub INTEGER CHECK (max_rewards_per_npub IS NULL OR max_rewards_per_npub > 0),
    criteria        TEXT NOT NULL,
    expiration      INTEGER,
    created_at      INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled','expired'))
  );
  CREATE INDEX IF NOT EXISTS idx_bounties_list   ON bounties(list_coordinate);
  CREATE INDEX IF NOT EXISTS idx_bounties_issuer ON bounties(issuer_pubkey);
  CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
`);

function ensureBountyColumn(name, alterSql) {
  const columns = db.prepare('PRAGMA table_info(bounties)').all();
  if (!columns.some(c => c.name === name)) db.exec(alterSql);
}

ensureBountyColumn('bounty_cap_sats', 'ALTER TABLE bounties ADD COLUMN bounty_cap_sats INTEGER');
ensureBountyColumn('reward_per_item', 'ALTER TABLE bounties ADD COLUMN reward_per_item INTEGER NOT NULL DEFAULT 0');
ensureBountyColumn('max_rewards_per_npub', 'ALTER TABLE bounties ADD COLUMN max_rewards_per_npub INTEGER');
db.exec(`UPDATE bounties SET bounty_cap_sats = amount_sats WHERE bounty_cap_sats IS NULL`);

const insertStmt = db.prepare(`
  INSERT INTO bounties (
    id, issuer_pubkey, list_coordinate, amount_sats, bounty_cap_sats,
    reward_per_item, max_rewards_per_npub, criteria, expiration, created_at, status
  )
  VALUES (
    @id, @issuer_pubkey, @list_coordinate, @amount_sats, @bounty_cap_sats,
    @reward_per_item, @max_rewards_per_npub, @criteria, @expiration, @created_at, 'open'
  )
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

function createBounty({
  issuerPubkey,
  listCoordinate,
  amountSats,
  bountyCapSats,
  rewardPerItem = false,
  maxRewardsPerNpub = null,
  criteria,
  expiration,
}) {
  const id = uuidv4();
  const row = {
    id,
    issuer_pubkey: issuerPubkey,
    list_coordinate: listCoordinate,
    amount_sats: amountSats,
    bounty_cap_sats: bountyCapSats,
    reward_per_item: rewardPerItem ? 1 : 0,
    max_rewards_per_npub: rewardPerItem ? maxRewardsPerNpub : null,
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

function bountiesByListCoordinates(coords) {
  if (!coords?.length) return [];
  const placeholders = coords.map(() => '?').join(',');
  return db.prepare(
    `SELECT * FROM bounties WHERE list_coordinate IN (${placeholders}) ORDER BY created_at DESC`
  ).all(...coords);
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
  bountiesByListCoordinates,
  markFulfilled,
};
