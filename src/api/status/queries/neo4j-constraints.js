/**
 * Neo4j Constraints Status Query Handler
 *
 * Reports whether all Brainstorm-required constraints and (online) indexes
 * exist in the running Neo4j instance. The Firmware settings page uses this
 * to gate the Install Firmware button — see ui/src/pages/settings/FirmwareExplorer.jsx.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { getNeo4jConnection } = require('../../../utils/config');
const { EXPECTED_CONSTRAINTS, EXPECTED_INDEXES } = require('./expectedNeo4jSchema');

const execAsync = promisify(exec);

async function runCypher(query) {
    const { user, password } = getNeo4jConnection();
    if (!password) {
        throw new Error('Neo4j password not configured (NEO4J_PASSWORD)');
    }
    const command = `cypher-shell -u ${user} -p ${password} "${query}"`;
    const { stdout } = await execAsync(command);
    return stdout;
}

// cypher-shell prints YIELD'd string columns as quoted tokens (e.g. `"nostrEvent_id"`).
// Pull every quoted token out of the output and put it in a Set.
function parseQuotedNames(output) {
    const names = new Set();
    const re = /"([^"]+)"/g;
    let m;
    while ((m = re.exec(output)) !== null) {
        names.add(m[1]);
    }
    return names;
}

async function handleGetNeo4jConstraintsStatus(req, res) {
    console.log('Getting Neo4j constraints setup status...');

    try {
        const [constraintsOut, indexesOut] = await Promise.all([
            runCypher('SHOW CONSTRAINTS YIELD name;'),
            runCypher("SHOW INDEXES YIELD name, state WHERE state = 'ONLINE' RETURN name;"),
        ]);

        const constraintNames = parseQuotedNames(constraintsOut);
        const indexNames = parseQuotedNames(indexesOut);

        const missingConstraints = EXPECTED_CONSTRAINTS.filter(n => !constraintNames.has(n));
        const missingIndexes = EXPECTED_INDEXES.filter(n => !indexNames.has(n));
        const ready = missingConstraints.length === 0 && missingIndexes.length === 0;
        const timestamp = ready ? Math.floor(Date.now() / 1000) : 0;

        return res.json({
            success: true,
            constraintsTimestamp: timestamp,
            status: ready ? 'set up' : 'not set up',
            setupTime: ready ? new Date(timestamp * 1000).toISOString() : null,
            missingConstraints,
            missingIndexes,
        });
    } catch (error) {
        console.error('Error getting Neo4j constraints status:', error);
        return res.json({
            success: false,
            error: error.message,
            constraintsTimestamp: 0,
            status: 'not set up',
            setupTime: null,
        });
    }
}

module.exports = {
    handleGetNeo4jConstraintsStatus,
};
