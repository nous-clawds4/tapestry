const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const Database = require('better-sqlite3');
const session = require('express-session');

const DEFAULT_PROD_PATH = '/var/lib/brainstorm/sessions.db';
const DEFAULT_DEV_PATH = path.join(__dirname, '..', '..', 'data', 'sessions.db');
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const INSECURE_PLACEHOLDER = 'brainstorm-default-session-secret-please-change-in-production';
let developmentSecret;

function readSessionSecretFromConfig(configPath = '/etc/brainstorm.conf') {
  try {
    const source = fs.readFileSync(configPath, 'utf8');
    const match = source.match(/^\s*(?:export\s+)?SESSION_SECRET=(?:\"([^\"]*)\"|'([^']*)'|([^\s#]+))/m);
    return match ? (match[1] ?? match[2] ?? match[3]) : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function resolveSessionSecret({
  secret,
  env = process.env,
  configPath = '/etc/brainstorm.conf',
  nodeEnv = env.NODE_ENV,
} = {}) {
  let resolved = secret;
  if (resolved === undefined || resolved === null || resolved === '') resolved = env.SESSION_SECRET;
  if (resolved === undefined || resolved === null || resolved === '') {
    resolved = readSessionSecretFromConfig(configPath);
  }
  const valid = resolved
    && resolved !== INSECURE_PLACEHOLDER
    && (nodeEnv !== 'production' || Buffer.byteLength(resolved, 'utf8') >= 32);
  if (valid) return resolved;
  if (nodeEnv === 'production') {
    throw new Error('SESSION_SECRET must be at least 32 bytes and configured securely in production');
  }
  developmentSecret ||= randomBytes(32).toString('hex');
  return developmentSecret;
}


function resolveSessionDbPath() {
  if (process.env.SESSION_DB_PATH) return process.env.SESSION_DB_PATH;
  try {
    fs.accessSync(path.dirname(DEFAULT_PROD_PATH), fs.constants.W_OK);
    return DEFAULT_PROD_PATH;
  } catch {
    return DEFAULT_DEV_PATH;
  }
}

function serializableSession(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => (key === 'nsec' ? undefined : item)));
}

class SqliteSessionStore extends session.Store {
  constructor({ dbPath = resolveSessionDbPath(), defaultMaxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
    super();
    this.dbPath = dbPath;
    this.defaultMaxAgeMs = defaultMaxAgeMs;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    fs.chmodSync(dbPath, 0o600);
    this.db.pragma('journal_mode = DELETE');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
    this.getStatement = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires_at > ?');
    this.setStatement = this.db.prepare(`
      INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at
    `);
    this.destroyStatement = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.pruneStatement = this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  }

  expiry(sessionValue) {
    const expires = sessionValue?.cookie?.expires;
    const parsed = expires ? new Date(expires).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now() + this.defaultMaxAgeMs;
  }

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionValue, callback = () => {}) {
    try {
      const safe = serializableSession(sessionValue);
      const now = Date.now();
      this.pruneStatement.run(now);
      this.setStatement.run(sid, JSON.stringify(safe), this.expiry(safe));
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sessionValue, callback = () => {}) {
    this.set(sid, sessionValue, callback);
  }

  destroy(sid, callback = () => {}) {
    try {
      this.destroyStatement.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  close() {
    this.db.close();
  }
}

function configureSession(app, options = {}) {
  if (app._brainstormSessionConfigured) return app._brainstormSessionStore;
  const {
    dbPath = resolveSessionDbPath(),
    secure = false,
  } = options;
  const secret = resolveSessionSecret(options);
  const store = new SqliteSessionStore({ dbPath });
  app.use(session({
    store,
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure, maxAge: DEFAULT_MAX_AGE_MS },
  }));
  app._brainstormSessionConfigured = true;
  app._brainstormSessionStore = store;
  return store;
}

module.exports = {
  DEFAULT_DEV_PATH,
  DEFAULT_PROD_PATH,
  SqliteSessionStore,
  configureSession,
  resolveSessionDbPath,
  readSessionSecretFromConfig,
  resolveSessionSecret,
  serializableSession,
};
