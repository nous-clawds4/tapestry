/**
 * The `TAGS` writer's Neo4j port (tagging-edges story 2, ADR tagging-edges/0002 D4/D6/D7/D12).
 * Story 3 writes `TAGS` only through this port (ADR 0002, "Binding for story 3").
 *
 * neo4j-driver is required lazily, so this module loads stack-free. The pass builds its own driver
 * from the environment, never the shared getDriver(), so its output never carries a credential.
 *
 * Every update, move and removal runs in one write transaction per batch: take each relationship's
 * write lock (`SET r.address = r.address` locks without writing), re-read it with the snapshot's
 * projection, compare fingerprints in JS, and act only on the rows that still match. A create
 * proceeds only while no `TAGS` relationship holds the address, which the uniqueness rule
 * `tags_address` makes atomic. The only node clause is a bare keyed MERGE of a NostrUser.
 */

const { TAGS_PROPERTY_KEYS, fingerprint } = require('../../lib/tagging-edges/sweep');

const SCALAR_TYPES = Object.freeze(['INTEGER NOT NULL', 'FLOAT NOT NULL', 'STRING NOT NULL', 'BOOLEAN NOT NULL']);
const MAX_BATCH = 250;
const TAGS_CONSTRAINT_NAME = 'tags_address';
const NOSTR_USER_CONSTRAINT_NAME = 'nostrUser_pubkey';

const PROJECTION = `RETURN elementId(r) AS rid,
       s.pubkey AS fromPubkey, valueType(s.pubkey) AS fromPubkeyType, s:NostrUser AS fromIsUser,
       t.pubkey AS toPubkey,   valueType(t.pubkey) AS toPubkeyType,   t:NostrUser AS toIsUser,
       [k IN keys(r) | [k, valueType(r[k]),
          CASE WHEN valueType(r[k]) IN $scalarTypes THEN toString(r[k]) END,
          CASE WHEN NOT valueType(r[k]) IN $scalarTypes THEN r[k] END]] AS props`;

const CYPHER = Object.freeze({
  READ_ALL: `MATCH (s)-[r:TAGS]->(t)
${PROJECTION}`,
  READ_AT: `UNWIND $addresses AS a
MATCH (s)-[r:TAGS {address: a}]->(t)
${PROJECTION}`,
  // The real-time path's catch-up keys (ADR tagging-edges/0003): one (address, eventId) row per relationship.
  READ_KEYS: 'MATCH ()-[r:TAGS]->() RETURN r.address AS address, r.eventId AS eventId',
  LOCK: 'UNWIND $addresses AS a MATCH ()-[r:TAGS {address: a}]->() SET r.address = r.address RETURN count(r) AS locked',
  UPDATE: 'UNWIND $rows AS row MATCH ()-[r:TAGS {address: row.address}]->() SET r = row.props RETURN count(r) AS n',
  MOVE: `UNWIND $rows AS row MATCH ()-[r:TAGS {address: row.address}]->() DELETE r
WITH row MERGE (a:NostrUser {pubkey: row.from}) MERGE (b:NostrUser {pubkey: row.to})
CREATE (a)-[n:TAGS]->(b) SET n = row.props RETURN count(n) AS n`,
  REMOVE: 'UNWIND $addresses AS a MATCH ()-[r:TAGS {address: a}]->() DELETE r RETURN count(*) AS n',
  CREATE_IF_ABSENT: `UNWIND $rows AS row
OPTIONAL MATCH ()-[x:TAGS {address: row.address}]->()
WITH row, x WHERE x IS NULL
MERGE (a:NostrUser {pubkey: row.from}) MERGE (b:NostrUser {pubkey: row.to})
CREATE (a)-[n:TAGS]->(b) SET n = row.props
RETURN row.address AS address`,
  CREATE_TAGS_CONSTRAINT: 'CREATE CONSTRAINT tags_address IF NOT EXISTS FOR ()-[r:TAGS]-() REQUIRE r.address IS UNIQUE',
  SHOW_CONSTRAINTS: 'SHOW CONSTRAINTS YIELD name, type, entityType, labelsOrTypes, properties, ownedIndex RETURN name, type, entityType, labelsOrTypes, properties, ownedIndex',
  SHOW_INDEXES: 'SHOW INDEXES YIELD name, state, type, entityType, labelsOrTypes, properties, owningConstraint RETURN name, state, type, entityType, labelsOrTypes, properties, owningConstraint',
});

const ROW_COLUMNS = Object.freeze(['rid', 'fromPubkey', 'fromPubkeyType', 'fromIsUser', 'toPubkey', 'toPubkeyType', 'toIsUser', 'props']);

let _neo4j = null;
function neo4j() {
  if (!_neo4j) _neo4j = require('neo4j-driver');
  return _neo4j;
}

/** A driver Integer (checked by shape, so this module needs no driver to load). */
function isInt(v) {
  if (_neo4j && _neo4j.isInt(v)) return true;
  return !!v && typeof v === 'object' && typeof v.toNumber === 'function' && typeof v.low === 'number' && typeof v.high === 'number';
}

/** A count from the driver (an Integer, or a plain number) as a JS number. Every count graph.js compares passes here. */
function toCount(v) {
  return isInt(v) ? v.toNumber() : v;
}

/** The nine contract properties to store: nulls omitted, createdAt as a BigInt (stored as INTEGER). */
function toWriteProps(edge) {
  const out = {};
  for (const k of TAGS_PROPERTY_KEYS) {
    const v = edge ? edge[k] : undefined;
    if (v === null || v === undefined) continue;
    out[k] = k === 'createdAt' ? BigInt(v) : v;
  }
  return out;
}

function sameList(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
}

function describe(defn, constraints, indexes) {
  const rows = Array.isArray(constraints) ? constraints : [];
  const idx = Array.isArray(indexes) ? indexes : [];
  const matches = rows.filter((c) => c && c.entityType === defn.entityType
    && sameList(c.labelsOrTypes, defn.labelsOrTypes) && sameList(c.properties, defn.properties)
    && typeof c.type === 'string' && c.type.endsWith('UNIQUENESS'));
  const named = rows.find((c) => c && c.name === defn.name) || null;
  const pick = matches.find((c) => c.name === defn.name) || matches[0] || null;
  const owned = pick ? idx.find((i) => i && (i.name === pick.ownedIndex || i.owningConstraint === pick.name)) : null;
  return {
    present: !!pick,
    online: !!(owned && owned.state === 'ONLINE'),
    name: pick ? pick.name : null,
    underAnotherName: !!pick && pick.name !== defn.name,
    // A rule with another definition holds the name, so `CREATE … IF NOT EXISTS` would do nothing.
    nameTaken: !!named && !matches.includes(named),
  };
}

/**
 * Pure: which of the pass's two database rules are present, judged by definition (and by name).
 * → { tagsAddress: { present, online, name, underAnotherName, nameTaken }, nostrUserPubkey: { … } }
 */
function schemaStatusFromRows(constraints, indexes) {
  return {
    tagsAddress: describe({ name: TAGS_CONSTRAINT_NAME, entityType: 'RELATIONSHIP', labelsOrTypes: ['TAGS'], properties: ['address'] }, constraints, indexes),
    nostrUserPubkey: describe({ name: NOSTR_USER_CONSTRAINT_NAME, entityType: 'NODE', labelsOrTypes: ['NostrUser'], properties: ['pubkey'] }, constraints, indexes),
  };
}

function plain(v) {
  if (v === null || v === undefined) return null;
  if (isInt(v)) return v.toNumber();
  if (Array.isArray(v)) return v.map(plain);
  return v;
}

function recordsToPlain(records) {
  return records.map((rec) => {
    const o = {};
    for (const k of rec.keys) o[k] = plain(rec.get(k));
    return o;
  });
}

/** Snapshot rows keep their raw values (Integers stay Integers, lossless). A row missing a column throws. */
function recordsToRows(records) {
  return records.map((rec) => {
    const row = {};
    for (const k of ROW_COLUMNS) {
      if (!rec.keys.includes(k)) {
        const err = new Error(`snapshot row is missing column ${k}`);
        err.code = 'missing-column';
        throw err;
      }
      row[k] = rec.get(k);
    }
    if (!Array.isArray(row.props)) {
      const err = new Error('snapshot row has no property list');
      err.code = 'missing-column';
      throw err;
    }
    return row;
  });
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function isConstraintViolation(err) {
  return !!err && err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed';
}

function invariant(message) {
  const err = new Error(message);
  err.code = 'invariant';
  return err;
}

/**
 * A caller's row as the port acts on it (clarification C6). An update, move or removal row carries
 * `snapshot`, the READ_ALL row its decision was made from; an update, move or create row carries `desired`,
 * the contract edge to write. The port computes `fingerprint(snapshot)` and `toWriteProps(desired)` itself,
 * and refuses a row without what its kind needs, or whose edge is not for its own address. The caller's
 * other keys are kept, so `preimage(batch)` sees the rows as sent.
 */
function toPortRow(kind, r) {
  if (!r || typeof r !== 'object' || typeof r.address !== 'string') throw invariant(`a ${kind} row has no address`);
  const out = { ...r };
  if (kind !== 'create') {
    const snapshot = r.snapshot !== undefined ? r.snapshot : r.row;
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.props)) throw invariant(`${kind} row ${r.address} has no snapshot`);
    out.row = snapshot;
    out.fingerprint = fingerprint(snapshot);
  }
  if (kind !== 'remove') {
    if (!r.desired || typeof r.desired !== 'object') throw invariant(`${kind} row ${r.address} has no desired edge`);
    out.props = toWriteProps(r.desired);
    out.from = r.desired.from;
    out.to = r.desired.to;
    if (out.props.address !== r.address || typeof out.from !== 'string' || typeof out.to !== 'string') {
      throw invariant(`${kind} row ${r.address} does not carry an edge for its own address`);
    }
  }
  return out;
}

/** Attach the counts an apply had committed before it failed (ADR step 11: "with the partial counts"). */
function withPartial(err, total) {
  if (err && typeof err === 'object') err.partial = { ...total, appliedAddresses: total.appliedAddresses.slice() };
  return err;
}

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Open the pass's own driver (lossless integers; pool 4; 30 s acquisition and retry budgets).
 * → { readSchema, ensureTagsConstraint, readAll, readAt, readKeys, applyLocked, applyCreates, close }
 */
function openGraph({ uri, user, password } = {}) {
  const n = neo4j();
  const driver = n.driver(uri, n.auth.basic(user, password || ''), {
    maxConnectionPoolSize: 4,
    connectionAcquisitionTimeout: 30000,
    maxTransactionRetryTime: 30000,
  });

  async function withSession(mode, fn) {
    // 'READ' / 'WRITE' are the driver's session access-mode values (neo4j.session.READ / .WRITE).
    const session = driver.session({ defaultAccessMode: mode === 'write' ? 'WRITE' : 'READ' });
    try {
      return await fn(session);
    } finally {
      await session.close();
    }
  }

  /**
   * SHOW CONSTRAINTS and SHOW INDEXES. With `timeoutMs` each runs under that transaction time-out (the real-time path
   * passes its own); without it, under none, as story 2's pass reads the schema (ADR tagging-edges/0003: the pass's
   * behaviour does not change).
   */
  async function readSchema({ timeoutMs } = {}) {
    const runShow = (session, statement) => (timeoutMs == null
      ? session.run(statement)
      : session.run(statement, {}, { timeout: timeoutMs }));
    return withSession('read', async (session) => {
      const c = await runShow(session, CYPHER.SHOW_CONSTRAINTS);
      const i = await runShow(session, CYPHER.SHOW_INDEXES);
      return { constraints: recordsToPlain(c.records), indexes: recordsToPlain(i.records) };
    });
  }

  /**
   * Create `tags_address` if it is not present (its own auto-commit statement), then wait for it ONLINE.
   * When a rule with another definition holds the name, the CREATE would do nothing: answer at once.
   */
  async function ensureTagsConstraint({ timeoutMs = 60000, pollMs = 1000, sleep = sleepMs } = {}) {
    let s = await readSchema();
    let status = schemaStatusFromRows(s.constraints, s.indexes);
    if (!status.tagsAddress.present) {
      if (status.tagsAddress.nameTaken) return status;
      await withSession('write', (session) => session.run(CYPHER.CREATE_TAGS_CONSTRAINT));
    }
    let waited = 0;
    for (;;) {
      s = await readSchema();
      status = schemaStatusFromRows(s.constraints, s.indexes);
      if (status.tagsAddress.present && status.tagsAddress.online) return status;
      if (waited >= timeoutMs) return status;
      await sleep(pollMs);
      waited += pollMs;
    }
  }

  /** The whole-graph `TAGS` snapshot (the pass's first read). */
  async function readAll({ timeoutMs = 120000 } = {}) {
    return withSession('read', async (session) => {
      const res = await session.executeRead(
        (tx) => tx.run(CYPHER.READ_ALL, { scalarTypes: SCALAR_TYPES }),
        { timeout: timeoutMs },
      );
      return recordsToRows(res.records);
    });
  }

  /** The `TAGS` rows at `addresses` (the real-time path's graph read, ADR tagging-edges/0003): raw rows, as readAll's. */
  async function readAt(addresses, { timeoutMs = 60000 } = {}) {
    return withSession('read', async (session) => {
      const res = await session.executeRead(
        (tx) => tx.run(CYPHER.READ_AT, { addresses, scalarTypes: SCALAR_TYPES }),
        { timeout: timeoutMs },
      );
      return recordsToRows(res.records);
    });
  }

  /**
   * Every `TAGS` relationship's (address, eventId), unfiltered (the real-time path's catch-up keys). → plain
   * [{ address, eventId }], each value as stored, or null when the relationship lacks it (clarification T30).
   */
  async function readKeys({ timeoutMs = 120000 } = {}) {
    return withSession('read', async (session) => {
      const res = await session.executeRead((tx) => tx.run(CYPHER.READ_KEYS), { timeout: timeoutMs });
      const value = (rec, k) => { const v = rec.get(k); return v === undefined ? null : v; };
      return res.records.map((rec) => ({ address: value(rec, 'address'), eventId: value(rec, 'eventId') }));
    });
  }

  /**
   * Update, move or remove verified rows, one locked transaction per batch of ≤ 250.
   * rows: [{ address, snapshot, desired? }] (clarification C6; a removal has no desired). Extra keys are kept
   * and passed to `preimage`, which is awaited before each transaction opens; without it nothing runs.
   * → { applied, lostRace, nodesCreated, transientRetries, appliedAddresses }; a rejection carries `partial`,
   * the counts of the batches committed before it.
   */
  async function applyLocked(kind, rows0, { timeoutMs = 60000, preimage } = {}) {
    if (typeof preimage !== 'function') throw invariant('applyLocked needs a preimage recorder');
    if (!['update', 'move', 'remove'].includes(kind)) throw invariant(`unknown locked write ${kind}`);
    const rows = (Array.isArray(rows0) ? rows0 : []).map((r) => toPortRow(kind, r));
    const total = { applied: 0, lostRace: 0, nodesCreated: 0, transientRetries: 0, appliedAddresses: [] };
    try {
      for (const batch of chunks(rows, MAX_BATCH)) {
        await preimage(batch);
        let attempts = 0;
        const result = await withSession('write', (session) => session.executeWrite(async (tx) => {
          attempts += 1;
          const addresses = batch.map((r) => r.address);
          await tx.run(CYPHER.LOCK, { addresses });
          let rowsNow;
          try {
            const reRead = await tx.run(CYPHER.READ_AT, { addresses, scalarTypes: SCALAR_TYPES });
            rowsNow = recordsToRows(reRead.records);
          } catch (err) {
            if (err && typeof err === 'object') err.read = 'graph-verify';
            throw err;
          }
          const now = new Map();
          const repeated = new Set();
          for (const r of rowsNow) {
            const a = r.props.find((p) => Array.isArray(p) && p[0] === 'address');
            const key = a ? String(a[2]) : null;
            if (key === null) continue;
            if (now.has(key)) repeated.add(key);
            now.set(key, r);
          }
          const verified = [];
          const lost = [];
          for (const row of batch) {
            const current = now.get(row.address);
            if (!current || repeated.has(row.address) || fingerprint(current) !== row.fingerprint) lost.push(row);
            else verified.push(row);
          }
          let nodesCreated = 0;
          if (verified.length > 0) {
            let res;
            if (kind === 'update') {
              res = await tx.run(CYPHER.UPDATE, { rows: verified.map((r) => ({ address: r.address, props: r.props })) });
            } else if (kind === 'move') {
              res = await tx.run(CYPHER.MOVE, { rows: verified.map((r) => ({ address: r.address, from: r.from, to: r.to, props: r.props })) });
              const c = res.summary && res.summary.counters && res.summary.counters.updates ? res.summary.counters.updates() : null;
              nodesCreated = c ? toCount(c.nodesCreated) || 0 : 0;
            } else {
              res = await tx.run(CYPHER.REMOVE, { addresses: verified.map((r) => r.address) });
            }
            const rec = res.records && res.records[0];
            const count = rec ? toCount(rec.get('n')) : 0;
            if (count !== verified.length) throw invariant(`${kind} touched ${count} relationships for ${verified.length} verified rows`);
          }
          return { verified, lost, nodesCreated };
        }, { timeout: timeoutMs }));
        total.applied += result.verified.length;
        total.lostRace += result.lost.length;
        total.nodesCreated += result.nodesCreated;
        total.transientRetries += Math.max(0, attempts - 1);
        total.appliedAddresses.push(...result.verified.map((r) => r.address));
      }
    } catch (err) {
      throw withPartial(err, total);
    }
    return total;
  }

  async function createOnce(batch, timeoutMs) {
    let attempts = 0;
    const out = await withSession('write', (session) => session.executeWrite(async (tx) => {
      attempts += 1;
      const res = await tx.run(CYPHER.CREATE_IF_ABSENT, { rows: batch.map((r) => ({ address: r.address, from: r.from, to: r.to, props: r.props })) });
      const created = res.records.map((rec) => rec.get('address'));
      const c = res.summary && res.summary.counters && res.summary.counters.updates ? res.summary.counters.updates() : null;
      return { created, nodesCreated: c ? toCount(c.nodesCreated) || 0 : 0 };
    }, { timeout: timeoutMs }));
    return { ...out, retries: Math.max(0, attempts - 1) };
  }

  /**
   * Create-if-absent, one transaction per batch of ≤ 250; after a uniqueness refusal the batch is re-run
   * one row per transaction and the refused row counts as a lost race.
   * rows: [{ address, desired }] (clarification C6) → { applied, lostRace, nodesCreated, transientRetries,
   * appliedAddresses }; a rejection carries `partial`, the counts of the transactions committed before it.
   */
  async function applyCreates(rows0, { timeoutMs = 60000 } = {}) {
    const rows = (Array.isArray(rows0) ? rows0 : []).map((r) => toPortRow('create', r));
    const total = { applied: 0, lostRace: 0, nodesCreated: 0, transientRetries: 0, appliedAddresses: [] };
    const record = (batch, out) => {
      const created = new Set(out.created);
      for (const r of batch) {
        if (created.has(r.address)) { total.applied += 1; total.appliedAddresses.push(r.address); } else { total.lostRace += 1; }
      }
      total.nodesCreated += out.nodesCreated;
      total.transientRetries += out.retries;
    };
    try {
      for (const batch of chunks(rows, MAX_BATCH)) {
        try {
          record(batch, await createOnce(batch, timeoutMs));
        } catch (err) {
          if (!isConstraintViolation(err)) throw err;
          for (const one of batch) {
            try {
              record([one], await createOnce([one], timeoutMs));
            } catch (e) {
              if (!isConstraintViolation(e)) throw e;
              total.lostRace += 1;
            }
          }
        }
      }
    } catch (err) {
      throw withPartial(err, total);
    }
    return total;
  }

  async function close() {
    await driver.close();
  }

  return { readSchema, ensureTagsConstraint, readAll, readAt, readKeys, applyLocked, applyCreates, close };
}

const RETRY_CODES = Object.freeze([
  'ServiceUnavailable',
  'SessionExpired',
  'Neo.ClientError.Security.Unauthorized',
  'Neo.ClientError.Security.AuthenticationRateLimit',
  'Neo.ClientError.Security.CredentialsExpired',
]);

function retriable(err) {
  const code = err && typeof err.code === 'string' ? err.code : '';
  return code.startsWith('Neo.TransientError.') || RETRY_CODES.includes(code);
}

/**
 * AC-6: put the one-per-tagging rule in place at control-panel boot, with no owner step. Never awaited
 * by the caller and never rejects. Checks by definition; creates `tags_address` if missing, in its own
 * auto-commit statement; retries transient, connection and authentication errors with backoff from 5 s
 * to 60 s for up to 30 min (the entrypoint may still be changing the database password); stops at the
 * first other error and logs one line. Never drops anything.
 * → Promise<{ outcome: 'present' | 'present-under-another-name' | 'created' | 'not-created' | 'gave-up', code? }>
 */
async function ensureTagsConstraintOnBoot({ runWrite, runRead, log = () => {}, sleep = sleepMs, windowMs = 30 * 60 * 1000 } = {}) {
  const say = (m) => { try { log(m); } catch (_) { /* never throw */ } };
  try {
    let waited = 0;
    let delay = 5000;
    for (;;) {
      try {
        const constraints = await runRead(CYPHER.SHOW_CONSTRAINTS, {});
        const indexes = await runRead(CYPHER.SHOW_INDEXES, {});
        const status = schemaStatusFromRows(constraints, indexes).tagsAddress;
        if (status.present) {
          if (status.underAnotherName) {
            say(`[tagging-edges] uniqueness rule for TAGS.address present under another name: ${status.name}`);
            return { outcome: 'present-under-another-name', name: status.name };
          }
          return { outcome: 'present' };
        }
        if (status.nameTaken) {
          say('[tagging-edges] uniqueness rule tags_address not created: name-taken (the name tags_address is held by a rule with another definition)');
          return { outcome: 'not-created', code: 'name-taken' };
        }
        await runWrite(CYPHER.CREATE_TAGS_CONSTRAINT, {});
        // IF NOT EXISTS can do nothing; say "created" only when the rule is now listed.
        const after = schemaStatusFromRows(await runRead(CYPHER.SHOW_CONSTRAINTS, {}), await runRead(CYPHER.SHOW_INDEXES, {})).tagsAddress;
        if (!after.present) {
          say('[tagging-edges] uniqueness rule tags_address not created: no-change (the CREATE changed nothing)');
          return { outcome: 'not-created', code: 'no-change' };
        }
        say('[tagging-edges] uniqueness rule tags_address created');
        return { outcome: 'created' };
      } catch (err) {
        if (!retriable(err)) {
          const code = (err && err.code) || 'no-status';
          say(`[tagging-edges] uniqueness rule tags_address not created: ${code}`);
          return { outcome: 'not-created', code };
        }
        if (waited + delay > windowMs) {
          say(`[tagging-edges] uniqueness rule tags_address not created: ${err.code} (gave up after ${Math.round(waited / 1000)}s)`);
          return { outcome: 'gave-up', code: err.code };
        }
        await sleep(delay);
        waited += delay;
        delay = Math.min(delay * 2, 60000);
      }
    }
  } catch (err) {
    say(`[tagging-edges] uniqueness rule tags_address not created: ${(err && err.code) || 'no-status'}`);
    return { outcome: 'not-created', code: (err && err.code) || 'no-status' };
  }
}

module.exports = {
  CYPHER,
  SCALAR_TYPES,
  MAX_BATCH,
  toWriteProps,
  schemaStatusFromRows,
  toCount,
  openGraph,
  ensureTagsConstraintOnBoot,
};
