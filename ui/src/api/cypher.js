/**
 * API client for Neo4j Cypher queries via the Brainstorm API.
 */

const API_BASE = '/api';

/**
 * Run a Cypher query and return parsed rows.
 * @param {string} query - Cypher query string
 * @returns {Promise<Array<Object>>} Array of row objects with column keys
 */
export async function cypher(query) {
  const encoded = encodeURIComponent(query);
  const res = await fetch(`${API_BASE}/neo4j/run-query?cypher=${encoded}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Query failed');
  }

  return parseCypherCSV(data.cypherResults);
}

/**
 * Parse cypher-shell CSV output into array of objects.
 * Handles quoted strings, escaped quotes, and NULL values.
 */
function parseCypherCSV(raw) {
  if (!raw || !raw.trim()) return [];

  const lines = raw.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cleanValue(values[j]);
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote (CSV-style "")
      } else if (ch === '\\' && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote (backslash-style \")
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Clean a CSV value: handle NULL, unescape quotes, parse JSON-like arrays.
 */
function cleanValue(val) {
  if (val === undefined || val === 'NULL' || val === 'null') return null;

  // Unescape \" → "
  let cleaned = val.replace(/\\"/g, '"');

  // Try to parse as JSON (for arrays, objects)
  if ((cleaned.startsWith('[') && cleaned.endsWith(']')) ||
      (cleaned.startsWith('{') && cleaned.endsWith('}'))) {
    try { return JSON.parse(cleaned); } catch {}
  }

  // Strip surrounding quotes if present
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned;
}
