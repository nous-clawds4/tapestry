/**
 * The real-time path's durable state (tagging-edges story 3, ADR tagging-edges/0003 § "Knowing what changed while it
 * was away" and its amendment A1; clarifications T21 and T26; story 5, ADR tagging-edges/0005 D1).
 *
 * Everything lives in <stateDir>/realtime/, on the `tapestry-data` volume beside the pass's report.json, which this
 * module never touches:
 *
 *   switch.json     {"version":2,"on":true,"changedAt":ISO,"changedBy":"<8-char prefix>","role":"owner"|"admin",
 *                   "onSince":ISO|null}, canonical compact form (the wrapper matches its literal "on":true, so no other
 *                   key may hold that text); written by the owner-or-admin route only. A version 1 record (story 3's,
 *                   no role or onSince) still reads, as the owner's change.
 *   switch-history.json  { version: 1, changes: [{ on, at, role, key }] }, the last 10 changes newest first, pretty
 *                   JSON, best effort beside switch.json (ADR 0005 D2); a change not recorded has null at, role and key
 *   started.json    { version: 1, firstStartedAt }, written once, after record.json
 *   record.json     the compacted state (its lineage rows and journal epoch included, A1-6) plus a sha256 over its
 *                   canonical body (object keys sorted recursively); written, hashed and read back as a stream of
 *                   rows, one member and one row per line, never as one whole text (A1-18, A1 clarification 19)
 *   journal.jsonl   one fact per line: cut back to its last newline at open, every append fsynced, replayed streamed;
 *                   truncated at each compaction, after which the engine opens its next generation with `e {epoch}`
 *   status.json     what the public status route reads
 *   daemon.lock     the wrapper's flock file (never written here)
 *
 * Whole-file writes go through state.writeAtomic (temp file, fsync, rename, directory fsync); record.json takes the
 * same steps itself, streamed. Every method is synchronous (T26). A file that is present but cannot be read or parsed
 * reads as { unreadable: true } (record.json adds its reason), never as missing, so a damaged marker is never taken for
 * a first start (AC-4). switch.json and switch-history.json also tell a read error from damage: a read error other
 * than ENOENT adds readError, its code (ADR 0005 D1).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const state = require('../state');

const RECORD_VERSION = 1;
const READ_CHUNK = 64 * 1024;
const WRITE_CHUNK = 256 * 1024; // record.json is written in pieces of about this many characters
const NEWLINE = 0x0a;

/** Make `dir` if it is missing (mode 0700, as the wrapper makes it). */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function fsyncDir(dir) {
  let fd = null;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } catch (_) {
    // Some filesystems refuse a directory fsync.
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* closed */ } }
  }
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * switch.json's text → { version, on, changedAt, changedBy, role, onSince } (version as parsed, never defaulted), or
 * { unreadable: true } unless it parses to an object whose `on` is a boolean (T26; ADR 0005 D1). The status and record
 * routes read the file through their own readFile and apply this same rule (T32).
 */
function parseSwitch(text) {
  let parsed;
  try { parsed = JSON.parse(Buffer.isBuffer(text) ? text.toString('utf8') : String(text)); } catch (_) { return { unreadable: true }; }
  if (!isObject(parsed) || typeof parsed.on !== 'boolean') return { unreadable: true };
  return { version: parsed.version, on: parsed.on, changedAt: parsed.changedAt, changedBy: parsed.changedBy, role: parsed.role, onSince: parsed.onSince };
}

const badSwitch = (message) => Object.assign(new Error(message), { code: 'EBADSWITCH' });

/**
 * switch.json's canonical text: compact, keys in the order version, on, changedAt, changedBy (T26), and for version 2
 * then role and onSince (ADR 0005 D1). A record with no version serialises as version 1; a version 2 record needs a role
 * of 'owner' or 'admin'.
 */
function canonicalSwitch(record) {
  const r = record || {};
  if (typeof r.on !== 'boolean') throw badSwitch('switch.json needs a boolean on');
  if (r.version === 2) {
    if (r.role !== 'owner' && r.role !== 'admin') throw badSwitch('a version 2 switch.json needs the role owner or admin');
    return `${JSON.stringify({ version: 2, on: r.on, changedAt: r.changedAt, changedBy: r.changedBy, role: r.role, onSince: r.onSince })}\n`;
  }
  return `${JSON.stringify({ version: r.version === undefined ? 1 : r.version, on: r.on, changedAt: r.changedAt, changedBy: r.changedBy })}\n`;
}

/**
 * switch-history.json's text → the parsed { version, changes } as it is (which entries are valid is the record's rule,
 * ADR 0005 D3), or { unreadable: true } unless it parses to an object whose `changes` is an array (D1).
 */
function parseSwitchHistory(text) {
  let parsed;
  try { parsed = JSON.parse(Buffer.isBuffer(text) ? text.toString('utf8') : String(text)); } catch (_) { return { unreadable: true }; }
  if (!isObject(parsed) || !Array.isArray(parsed.changes)) return { unreadable: true };
  return parsed;
}

/** A copy of `v` with object keys sorted at every level; arrays keep their order. */
function sortedDeep(v) {
  if (Array.isArray(v)) return v.map(sortedDeep);
  if (isObject(v)) return Object.keys(v).sort().reduce((o, k) => { o[k] = sortedDeep(v[k]); return o; }, {});
  return v;
}

/** One value's canonical JSON (T26), as JSON.stringify writes it inside an array: `null` for what it would drop. */
function canonicalValue(v) {
  const s = JSON.stringify(sortedDeep(v));
  return s === undefined ? 'null' : s;
}

/**
 * The record's members in canonical order, without sha256: [key, value] for each member JSON.stringify would write,
 * keys in the order JSON.stringify(sortedDeep(record)) writes them (sorted, as a fresh object orders them).
 */
function canonicalMembers(record) {
  const order = Object.keys(Object.keys(record).filter((k) => k !== 'sha256').sort().reduce((o, k) => { o[k] = true; return o; }, {}));
  const out = [];
  for (const k of order) {
    const v = record[k];
    if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
    out.push([k, v]);
  }
  return out;
}

/**
 * The record as a stream of pieces (A1-18): its canonical text piece by piece — each member, and each row of an array
 * member, serialised on its own — so neither a sorted copy of the whole body nor its whole text is ever built. Each
 * piece is { canon, file }: `canon` is exactly its part of JSON.stringify(sortedDeep(record without sha256)) (T26), and
 * `file` the same text as record.json lays it out, one member and one row per line.
 */
function* recordPieces(record) {
  const members = canonicalMembers(record);
  yield { canon: '{', file: '{\n' };
  for (let m = 0; m < members.length; m += 1) {
    const [k, v] = members[m];
    const sep = m ? ',' : '';
    if (Array.isArray(v)) {
      yield { canon: `${sep}${JSON.stringify(k)}:[`, file: `${JSON.stringify(k)}:[\n` };
      for (let i = 0; i < v.length; i += 1) {
        const row = canonicalValue(v[i]);
        yield { canon: i ? `,${row}` : row, file: `${row}${i < v.length - 1 ? ',' : ''}\n` };
      }
      yield { canon: ']', file: '],\n' };
    } else {
      const text = canonicalValue(v);
      yield { canon: `${sep}${JSON.stringify(k)}:${text}`, file: `${JSON.stringify(k)}:${text},\n` };
    }
  }
  yield { canon: '}', file: '' };
}

/** sha256 (lower-case hex) over the record's canonical body (T26: without sha256, keys sorted), piece by piece. */
function recordSha256(record) {
  const hash = crypto.createHash('sha256');
  for (const p of recordPieces(record)) hash.update(p.canon, 'utf8');
  return hash.digest('hex');
}

const MEMBER_LINE = /^("(?:[^"\\]|\\.)*"):(.*)$/s;

/**
 * record.json read back as it is written (A1-18): line by line from the file, each member and each row parsed on its
 * own, so the file's whole text is never held. → the record, or null when the file is not in that layout (then the
 * caller parses it whole, so a record another writer laid out differently still reads by T26's rule).
 */
function readRecordRows(file, size) {
  const out = {};
  let phase = 'open'; // open → member (⇄ rows) → last → end
  let rows = null;
  let lastRow = true; // whether the previous row line ended without a comma
  for (const line of fileLines(file, size)) {
    if (phase === 'open') {
      if (line !== '{') return null;
      phase = 'member';
    } else if (phase === 'rows') {
      if (line === ']' || line === '],') {
        if (!lastRow && rows.length > 0) return null;
        rows = null;
        phase = line === ']' ? 'last' : 'member';
        continue;
      }
      if (lastRow && rows.length > 0) return null;
      const comma = line.endsWith(',');
      rows.push(JSON.parse(comma ? line.slice(0, -1) : line));
      lastRow = !comma;
    } else if (phase === 'member') {
      if (line === '}') return null; // the writer always ends with sha256, unterminated by a comma
      const m = MEMBER_LINE.exec(line);
      if (!m) return null;
      const key = JSON.parse(m[1]);
      if (Object.prototype.hasOwnProperty.call(out, key)) return null;
      if (m[2] === '[') {
        rows = [];
        out[key] = rows;
        lastRow = true;
        phase = 'rows';
        continue;
      }
      const comma = m[2].endsWith(',');
      out[key] = JSON.parse(comma ? m[2].slice(0, -1) : m[2]);
      if (!comma) phase = 'last';
    } else if (phase === 'last') {
      if (line !== '}') return null;
      phase = 'end';
    } else {
      return null; // anything after the closing brace
    }
  }
  return phase === 'end' ? out : null;
}

/**
 * The byte length of the open file `fd` up to and including its last newline, reading back from the end in chunks
 * (the journal is never loaded whole). 0 when it holds no newline.
 */
function lastNewlineEnd(fd, size) {
  const buf = Buffer.alloc(Math.min(READ_CHUNK, Math.max(size, 1)));
  let end = size;
  while (end > 0) {
    const start = Math.max(0, end - buf.length);
    const n = fs.readSync(fd, buf, 0, end - start, start);
    const at = buf.subarray(0, n).lastIndexOf(NEWLINE);
    if (at >= 0) return start + at + 1;
    end = start;
  }
  return 0;
}

/**
 * A file's complete lines, without their newlines, read in chunks from the start up to `limit` bytes (for the journal,
 * the length cut at open, so a line appended since is not replayed twice; for record.json, its size). Lines are split
 * on the newline byte before decoding, so a multi-byte character is never split.
 */
function* fileLines(file, limit) {
  if (limit <= 0) return;
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(READ_CHUNK);
    let pos = 0;
    let rest = Buffer.alloc(0);
    while (pos < limit) {
      const n = fs.readSync(fd, buf, 0, Math.min(buf.length, limit - pos), pos);
      if (n === 0) break;
      pos += n;
      let chunk = rest.length ? Buffer.concat([rest, buf.subarray(0, n)]) : buf.subarray(0, n);
      let at = chunk.indexOf(NEWLINE);
      while (at >= 0) {
        yield chunk.subarray(0, at).toString('utf8');
        chunk = chunk.subarray(at + 1);
        at = chunk.indexOf(NEWLINE);
      }
      rest = Buffer.from(chunk);
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * The store over `dir` (default <stateDir>/realtime, TAGGING_EDGES_STATE_DIR read when the store is made).
 * → readSwitch, writeSwitch, unlinkSwitch, readSwitchHistory, writeSwitchHistory, readStarted, writeStarted,
 *   readRecord, writeRecord, openJournal, appendJournal, truncateJournal, journalBytes, readStatus, writeStatus (T21;
 *   ADR 0005 D1).
 */
function createStore({ dir } = {}) {
  const root = dir || path.join(state.stateDir(), 'realtime');
  const file = (name) => path.join(root, name);
  const SWITCH = file('switch.json');
  const SWITCH_HISTORY = file('switch-history.json');
  const STARTED = file('started.json');
  const RECORD = file('record.json');
  const JOURNAL = file('journal.jsonl');
  const STATUS = file('status.json');

  /** A file's text, or null when it does not exist; any other read error is thrown. */
  const readText = (p) => {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }
  };
  /** Parsed JSON, null when missing, { unreadable: true } when present but unreadable or not an object. */
  const readObject = (p) => {
    let text;
    try { text = readText(p); } catch (_) { return { unreadable: true }; }
    if (text === null) return null;
    try {
      const parsed = JSON.parse(text);
      return isObject(parsed) ? parsed : { unreadable: true };
    } catch (_) {
      return { unreadable: true };
    }
  };

  /** A file through `parse`: null when missing, { unreadable: true, readError } on any other read error (D1). */
  const readParsed = (p, parse) => {
    let text;
    try { text = readText(p); } catch (err) { return { unreadable: true, readError: (err && err.code) || 'error' }; }
    return text === null ? null : parse(text);
  };

  function readSwitch() { return readParsed(SWITCH, parseSwitch); }

  function writeSwitch(record) {
    state.writeAtomic(SWITCH, canonicalSwitch(record));
  }

  function readSwitchHistory() { return readParsed(SWITCH_HISTORY, parseSwitchHistory); }

  /** Write the whole { version, changes } object (ADR 0005 D1, D2). */
  function writeSwitchHistory(obj) {
    state.writeAtomic(SWITCH_HISTORY, `${JSON.stringify(obj, null, 2)}\n`);
  }

  /** Remove switch.json, which then reads as off: the route's fallback when an off-write fails (it needs no space). */
  function unlinkSwitch() {
    try {
      fs.unlinkSync(SWITCH);
    } catch (err) {
      if (!err || err.code !== 'ENOENT') throw err;
    }
    fsyncDir(root);
  }

  function readStarted() { return readObject(STARTED); }

  function writeStarted(obj) {
    state.writeAtomic(STARTED, `${JSON.stringify(obj, null, 2)}\n`);
  }

  /**
   * The record, null when missing, or { unreadable: true, reason: 'record-unreadable' } on a parse, version or sha256
   * mismatch. Read as it is written (A1-18): row by row, and its sha256 checked over the canonical body streamed piece
   * by piece; a file laid out otherwise (another writer's) is parsed whole and checked by the same rule (T26).
   */
  function readRecord() {
    let size;
    try {
      size = fs.statSync(RECORD).size;
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      return { unreadable: true, reason: 'record-unreadable' };
    }
    let rec = null;
    try { rec = readRecordRows(RECORD, size); } catch (_) { rec = null; }
    if (rec === null) {
      rec = readObject(RECORD);
      if (rec === null) return null;
    }
    if (!isObject(rec) || rec.version !== RECORD_VERSION || typeof rec.sha256 !== 'string' || rec.sha256 !== recordSha256(rec)) {
      return { unreadable: true, reason: 'record-unreadable' };
    }
    return rec;
  }

  /**
   * Write `body` plus a sha256 over its canonical form (T26); a sha256 handed in is replaced, not hashed. Streamed
   * (A1-18, A1 clarification 19): each member and each row is serialised on its own, hashed and written through a temp
   * file, fsynced and renamed onto record.json, then the directory fsynced — state.writeAtomic's steps, without ever
   * holding the whole text or a sorted copy of the body. → the bytes written (the engine's compaction cadence, A1-6).
   */
  function writeRecord(body) {
    const rec = { ...body };
    delete rec.sha256;
    ensureDir(root);
    const tmp = `${RECORD}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    const hash = crypto.createHash('sha256');
    let fd = null;
    let bytes = 0;
    let parts = [];
    let partsLength = 0;
    const flush = () => {
      if (parts.length === 0) return;
      const buf = Buffer.from(parts.join(''), 'utf8');
      parts = [];
      partsLength = 0;
      let off = 0;
      while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
      bytes += buf.length;
    };
    const put = (text) => {
      if (!text) return;
      parts.push(text);
      partsLength += text.length;
      if (partsLength >= WRITE_CHUNK) flush();
    };
    try {
      fd = fs.openSync(tmp, 'w', 0o600);
      for (const piece of recordPieces(rec)) { hash.update(piece.canon, 'utf8'); put(piece.file); }
      put(`"sha256":${JSON.stringify(hash.digest('hex'))}\n}\n`);
      flush();
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      fs.renameSync(tmp, RECORD);
    } catch (err) {
      if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* closed */ } }
      try { fs.unlinkSync(tmp); } catch (_) { /* never created */ }
      throw err;
    }
    fsyncDir(root);
    return bytes;
  }

  /**
   * Cut a torn tail (a crash mid-append) back to just after the last newline, fsync the cut, and hand out the complete
   * lines as a stream. → { lines: Iterable<string> }, { lines: [] } with no journal (a first start), or
   * { unreadable: true } when the journal cannot be opened or read at all (a lost record, 'journal-unreadable').
   * The lines are read as they are iterated, so a read error can also be thrown by the iteration; the engine treats
   * that as 'journal-unreadable' too.
   */
  function openJournal() {
    let fd = null;
    let limit;
    try {
      fd = fs.openSync(JOURNAL, 'r+');
      const size = fs.fstatSync(fd).size;
      limit = lastNewlineEnd(fd, size);
      if (limit !== size) {
        fs.ftruncateSync(fd, limit);
        fs.fsyncSync(fd);
      }
    } catch (err) {
      if (err && err.code === 'ENOENT') return { lines: [] };
      return { unreadable: true };
    } finally {
      if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* closed */ } }
    }
    return { lines: { [Symbol.iterator]: () => fileLines(JOURNAL, limit) } };
  }

  /**
   * Append lines (each as journalLine makes it, ending in a newline) and fsync. A failed write is cut back off, so the
   * next append never sticks onto a partial line.
   */
  function appendJournal(lines) {
    const list = Array.isArray(lines) ? lines : [lines];
    const text = list.map((l) => { const s = String(l); return s.endsWith('\n') ? s : `${s}\n`; }).join('');
    if (text === '') return;
    ensureDir(root);
    const existed = fs.existsSync(JOURNAL);
    const fd = fs.openSync(JOURNAL, 'a', 0o600);
    const sizeBefore = fs.fstatSync(fd).size;
    try {
      fs.writeFileSync(fd, text); // every byte, or a throw
      fs.fsyncSync(fd);
    } catch (err) {
      try { fs.ftruncateSync(fd, sizeBefore); fs.fsyncSync(fd); } catch (_) { /* the caller sees the first error */ }
      throw err;
    } finally {
      fs.closeSync(fd);
    }
    if (!existed) fsyncDir(root);
  }

  /**
   * Empty the journal (compaction, right after record.json is written). One it creates gets its directory entry
   * fsynced too, as an append that creates it does: the append that follows finds it and skips that step.
   */
  function truncateJournal() {
    ensureDir(root);
    const existed = fs.existsSync(JOURNAL);
    const fd = fs.openSync(JOURNAL, 'w', 0o600);
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (!existed) fsyncDir(root);
  }

  /** The journal's size in bytes; 0 when there is none. */
  function journalBytes() {
    try {
      return fs.statSync(JOURNAL).size;
    } catch (err) {
      if (err && err.code === 'ENOENT') return 0;
      throw err;
    }
  }

  function readStatus() { return readObject(STATUS); }

  function writeStatus(obj) {
    state.writeAtomic(STATUS, `${JSON.stringify(obj, null, 2)}\n`);
  }

  return {
    readSwitch,
    writeSwitch,
    unlinkSwitch,
    readSwitchHistory,
    writeSwitchHistory,
    readStarted,
    writeStarted,
    readRecord,
    writeRecord,
    openJournal,
    appendJournal,
    truncateJournal,
    journalBytes,
    readStatus,
    writeStatus,
  };
}

module.exports = { createStore, parseSwitch, parseSwitchHistory };
