/**
 * Neo4j Bolt driver — shared singleton for the Tapestry Express server.
 *
 * Usage:
 *   const { runCypher, getDriver } = require('../lib/neo4j-driver');
 *
 *   // Simple query — returns array of plain objects
 *   const rows = await runCypher('MATCH (n) RETURN count(n) AS total');
 *   // → [{ total: 5891 }]
 *
 *   // Parameterized query
 *   const rows = await runCypher(
 *     'MATCH (n {uuid: $uuid}) RETURN n.name AS name',
 *     { uuid: '39998:2d1f...:abc123' }
 *   );
 *
 *   // Direct driver access (for transactions, etc.)
 *   const driver = getDriver();
 */

const neo4j = require('neo4j-driver');
const { getConfigFromFile } = require('../utils/config');

let _driver = null;

/**
 * Get or create the singleton Neo4j driver.
 */
function getDriver() {
  if (!_driver) {
    const user = getConfigFromFile('NEO4J_USER', 'neo4j');
    const password = getConfigFromFile('NEO4J_PASSWORD', '');
    const uri = getConfigFromFile('NEO4J_URI', 'bolt://localhost:7687');

    _driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 20,
      connectionAcquisitionTimeout: 30000,
    });
  }
  return _driver;
}

/**
 * Run a Cypher query and return an array of plain JS objects.
 *
 * Neo4j Integer values are automatically converted to JS numbers
 * (safe for values < Number.MAX_SAFE_INTEGER).
 *
 * @param {string} cypher - Cypher query string
 * @param {Object} [params={}] - Query parameters
 * @returns {Promise<Array<Object>>}
 */
async function runCypher(cypher, params = {}) {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(cypher, params);
    return result.records.map(record => {
      const obj = {};
      for (const key of record.keys) {
        obj[key] = toJS(record.get(key));
      }
      return obj;
    });
  } finally {
    await session.close();
  }
}

/**
 * Run a write query (CREATE, MERGE, DELETE, SET, etc.).
 * Same interface as runCypher but uses WRITE access mode.
 */
async function writeCypher(cypher, params = {}) {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.run(cypher, params);
    return result.records.map(record => {
      const obj = {};
      for (const key of record.keys) {
        obj[key] = toJS(record.get(key));
      }
      return obj;
    });
  } finally {
    await session.close();
  }
}

/**
 * Gracefully close the driver (call on process shutdown).
 */
async function closeDriver() {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}

/**
 * Convert Neo4j driver values to plain JS.
 *  - Integer → number
 *  - Node/Relationship → plain object with properties
 *  - Path → array of nodes
 *  - Arrays → recursively converted
 *  - null/undefined → null
 */
function toJS(value) {
  if (value === null || value === undefined) return null;

  // Neo4j Integer
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }

  // Node
  if (value.constructor && value.constructor.name === 'Node') {
    return { ...value.properties, _labels: value.labels, _id: value.identity.toNumber() };
  }

  // Relationship
  if (value.constructor && value.constructor.name === 'Relationship') {
    return { ...value.properties, _type: value.type, _id: value.identity.toNumber() };
  }

  // Path
  if (value.constructor && value.constructor.name === 'Path') {
    return value.segments.map(seg => ({
      start: toJS(seg.start),
      rel: toJS(seg.relationship),
      end: toJS(seg.end),
    }));
  }

  // Array
  if (Array.isArray(value)) {
    return value.map(toJS);
  }

  return value;
}

module.exports = { getDriver, runCypher, writeCypher, closeDriver, toJS };
