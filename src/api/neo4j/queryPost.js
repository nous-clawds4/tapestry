/**
 * POST /api/neo4j/query — Run a Cypher query via POST body.
 *
 * Now uses the Neo4j Bolt driver instead of shelling out to cypher-shell.
 *
 * Request body: { "cypher": "<cypher string>", "params": { ... } }
 * Response:     { "success": true, "data": [...rows...] }
 *
 * For backward compatibility, also returns "cypherResults" as a simplified
 * CSV-like string (header + rows). New callers should use "data" instead.
 */

const { runCypher, writeCypher } = require('../../lib/neo4j-driver');

// Detect write operations that require WRITE access mode
const WRITE_KEYWORDS = /\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i;

async function queryPost(req, res) {
    const cypherCommand = (req.body && req.body.cypher) || '';
    const params = (req.body && req.body.params) || {};

    if (!cypherCommand.trim()) {
        return res.status(400).json({ success: false, error: 'Missing "cypher" in request body' });
    }

    try {
        const isWrite = WRITE_KEYWORDS.test(cypherCommand);
        const rows = isWrite
            ? await writeCypher(cypherCommand, params)
            : await runCypher(cypherCommand, params);

        // Build backward-compatible cypherResults string
        let cypherResults = '';
        if (rows.length > 0) {
            const keys = Object.keys(rows[0]);
            cypherResults = keys.join(',') + '\n';
            for (const row of rows) {
                cypherResults += keys.map(k => {
                    const v = row[k];
                    if (v === null || v === undefined) return 'NULL';
                    if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;  // CSV-escape quotes
                    if (Array.isArray(v)) return JSON.stringify(v);
                    return String(v);
                }).join(',') + '\n';
            }
        }

        res.json({ success: true, data: rows, cypherResults });
    } catch (err) {
        console.error('Neo4j query error:', err.message);
        res.json({ success: false, error: err.message, cypherResults: '' });
    }
}

module.exports = { queryPost };
