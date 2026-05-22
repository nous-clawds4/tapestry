#!/usr/bin/env node
/**
 * getCurrentReportsFromNeo4j.js
 * 
 * Extracts current REPORTS relationship data from Neo4j and creates individual JSON files
 * for each rater, stored in currentRelationshipsFromNeo4j/reports/
 * 
 * Each file is named after the pubkey of the rater and contains a JSON object with
 * the rater's pubkey as key and an object of ratee pubkeys as values.
 */

const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Create promisified versions of fs functions
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('neo4jUri', {
    describe: 'Neo4j connection URI',
    type: 'string',
    default: 'bolt://localhost:7687'
  })
  .option('neo4jUser', {
    describe: 'Neo4j username',
    type: 'string',
    default: 'neo4j'
  })
  .option('neo4jPassword', {
    describe: 'Neo4j password',
    type: 'string',
    default: ''
  })
  .option('outputDir', {
    describe: 'Directory for output files',
    type: 'string',
    default: path.join(__dirname, 'currentRelationshipsFromNeo4j/reports')
  })
  .option('logFile', {
    describe: 'Log file path',
    type: 'string',
    default: '/var/log/brainstorm/reconciliation.log'
  })
  .option('batchSize', {
    describe: 'Number of users to process in each batch',
    type: 'number',
    default: 1000
  })
  .option('authorsFromDir', {
    describe: 'Incremental/author mode: restrict extraction to the <pubkey>.json files in this directory (the matching currentRelationshipsFromStrfry/<kind>/ dir) instead of scanning every rater in Neo4j',
    type: 'string',
    default: ''
  })
  .help()
  .argv;

// Configuration
const config = {
  neo4j: {
    uri: argv.neo4jUri,
    user: argv.neo4jUser,
    password: argv.neo4jPassword
  },
  outputDir: argv.outputDir,
  logFile: argv.logFile,
  batchSize: argv.batchSize,
  authorsFromDir: argv.authorsFromDir
};

// Ensure log directory exists
const logDir = path.dirname(config.logFile);
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (error) {
    // If we can't create the log directory, fall back to local logs
    config.logFile = path.join(__dirname, 'logs', 'reconciliation.log');
    if (!fs.existsSync(path.dirname(config.logFile))) {
      fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
    }
  }
}

/**
 * Log a message to the log file and console
 * @param {string} message - Message to log
 */
async function log(message) {
  const timestamp = new Date().getTime();
  const logMessage = `${timestamp}: getCurrentReportsFromNeo4j - ${message}\n`;
  
  console.log(message);
  
  try {
    fs.appendFileSync(config.logFile, logMessage);
  } catch (error) {
    console.error(`Error writing to log file: ${error.message}`);
  }
}

// Initialize the Neo4j driver
const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
  { maxConnectionPoolSize: 50 }
);

/**
 * Ensure output directory exists
 */
async function ensureOutputDirectory() {
  try {
    if (!fs.existsSync(config.outputDir)) {
      await mkdir(config.outputDir, { recursive: true });
      await log(`Created output directory: ${config.outputDir}`);
    }
  } catch (error) {
    await log(`ERROR: Failed to create output directory: ${error.message}`);
    throw error;
  }
}

/**
 * Get count of raters (users who have REPORTS relationships)
 */
async function getRaterCount() {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (u:NostrUser)-[r:REPORTS]->()
      RETURN COUNT(DISTINCT u) AS count
    `);
    
    const count = result.records[0].get('count').toInt();
    await log(`Found ${count} users with REPORTS relationships`);
    return count;
  } catch (error) {
    await log(`ERROR: Failed to get rater count: ${error.message}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Get all raters (users who have REPORTS relationships)
 * @param {number} skip - Number of raters to skip
 * @param {number} limit - Maximum number of raters to return
 * @returns {Array} Array of rater pubkeys
 */
async function getRaters(skip, limit) {
  const session = driver.session();
  try {
    const cypherQuery = ` MATCH (u:NostrUser)-[r:REPORTS]->(target:NostrUser)
      RETURN DISTINCT u.pubkey AS pubkey
      ORDER BY u.pubkey
      SKIP ${skip}
      LIMIT ${limit}`;
    const result = await session.run(cypherQuery);
    
    return result.records.map(record => record.get('pubkey'));
  } catch (error) {
    await log(`ERROR: Failed to get raters: ${error.message}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Incremental/author mode: read the covered rater pubkeys from the strfry
 * relationship directory (one <pubkey>.json file per covered author) instead of
 * scanning every rater in Neo4j. This restricts the extraction to the SAME
 * author set as the strfry side — the reconciliation correctness invariant
 * (ADR 0018 §Option A). No Neo4j query, no N+1 over the whole graph.
 * @param {string} dir - the matching currentRelationshipsFromStrfry/<kind>/ dir
 * @returns {Array<string>} rater pubkeys
 */
function getRatersFromDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== '_summary.json')
    .map(f => f.replace(/\.json$/, ''));
}

/**
 * Get all REPORTS relationships for a specific rater
 * @param {string} raterPubkey - Pubkey of the rater
 * @returns {Object} Object containing the rater's REPORTS relationships
 */
async function getReportsForRater(raterPubkey) {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (u:NostrUser {pubkey: $pubkey})-[r:REPORTS]->(target:NostrUser)
      RETURN target.pubkey AS ratee, r.report_type AS report_type
    `, { pubkey: raterPubkey });
    
    const reports = {};
    result.records.forEach(record => {
      const ratee = record.get('ratee');
      let report_type = record.get('report_type');
      if (!report_type) report_type = 'unspecified';
      // Use boolean true instead of timestamp
      reports[report_type] = reports[report_type] || {};
      reports[report_type][ratee] = true;
    });
    
    return { [raterPubkey]: reports };
  } catch (error) {
    await log(`ERROR: Failed to get reports for rater ${raterPubkey}: ${error.message}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Write file with timeout and retry logic
 * @param {string} filePath - Path to file to write
 * @param {string|Buffer} data - Data to write
 * @param {Object} options - Write file options
 * @param {number} timeoutMs - Timeout in milliseconds for each attempt
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialBackoffMs - Initial backoff time in milliseconds
 * @returns {Promise<void>}
 */
async function writeFileWithTimeout(
  filePath, 
  data, 
  options = {}, 
  timeoutMs = 10000, 
  maxRetries = 3, 
  initialBackoffMs = 500
) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If not the first attempt, log the retry
      if (attempt > 0) {
        await log(`writeFileWithTimeout error: Retry ${attempt}/${maxRetries} for writing file ${filePath}`);
      }
      
      // Try to write the file with timeout
      await Promise.race([
        writeFile(filePath, data, options),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`writeFileWithTimeout error: writeFile to ${filePath} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
      
      // If we get here, the write was successful
      if (attempt > 0) {
        await log(`writeFileWithTimeout success: Retry ${attempt} succeeded for ${filePath}`);
      }
      return;
      
    } catch (error) {
      lastError = error;
      
      // If this was our last attempt, don't wait, just throw
      if (attempt === maxRetries) {
        break;
      }
      
      // Log the error
      await log(`writeFileWithTimeout error: Write attempt ${attempt + 1} failed for ${filePath}: ${error.message}`);
      
      // Calculate backoff with exponential delay (500ms, 1000ms, 2000ms...)
      const backoffMs = initialBackoffMs * Math.pow(2, attempt);
      await log(`writeFileWithTimeout error: Waiting ${backoffMs}ms before retry ${attempt + 1}`);
      
      // Wait before the next attempt
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
}

/**
 * Process a batch of raters and create individual JSON files
 * @param {Array} raters - Array of rater pubkeys
 * @param {number} batchIndex - Index of the current batch
 * @param {number} totalBatches - Total number of batches
 */
async function processRaterBatch(raters, batchIndex, totalBatches) {
  // await log(`Processing batch ${batchIndex}/${totalBatches} (${raters.length} raters)...`);
  
  let processedCount = 0;
  let errorCount = 0;
  
  for (const raterPubkey of raters) {
    try {
      const reportsData = await getReportsForRater(raterPubkey);
      const filePath = path.join(config.outputDir, `${raterPubkey}.json`);
      
      if (reportsData) {       
        await writeFileWithTimeout(filePath, JSON.stringify(reportsData, null, 2));     
        processedCount++;
      } else {
        await log(`WARNING: Empty data for rater ${raterPubkey}, skipping file write`);
      }

      // Log progress periodically
      if (processedCount % 10 === 0 || processedCount === raters.length) {
        const progress = Math.round((processedCount / raters.length) * 100);
        // await log(`Batch ${batchIndex} of ${totalBatches} progress: ${progress}% (${processedCount}/${raters.length} Neo4j reported users)`);
      }
    } catch (error) {
      await log(`WARNING: Failed to process rater ${raterPubkey}: ${error.message}`);
      errorCount++;
    }
    
    // Force garbage collection if available
    if (global.gc) global.gc();
  }
  
  await log(`Completed batch ${batchIndex} of ${totalBatches}. Processed: ${processedCount}, Errors: ${errorCount}`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    const startTime = Date.now();
    await log('Starting extraction of REPORTS relationships from Neo4j');
    
    // Ensure output directory exists
    await ensureOutputDirectory();
    
    // Incremental/author mode: restrict to the covered author set discovered in
    // the strfry relationship dir; otherwise scan every rater in Neo4j (full mode).
    let restrictedRaters = null;
    if (config.authorsFromDir) {
      restrictedRaters = getRatersFromDir(config.authorsFromDir);
      await log(`Restricting extraction to ${restrictedRaters.length} authors from ${config.authorsFromDir}`);
    }

    // Get total count of raters
    const raterCount = restrictedRaters ? restrictedRaters.length : await getRaterCount();

    // Process raters in batches
    const batchCount = Math.ceil(raterCount / config.batchSize) || 1;

    for (let i = 0; i < raterCount; i += config.batchSize) {
      const batchIndex = Math.floor(i / config.batchSize) + 1;
      const batchRaters = restrictedRaters
        ? restrictedRaters.slice(i, i + config.batchSize)
        : await getRaters(i, config.batchSize);

      await processRaterBatch(batchRaters, batchIndex, batchCount);

      // Force garbage collection if available
      if (global.gc) global.gc();
    }
    
    // Create a summary file with the count of extracted relationships
    const summaryFile = path.join(config.outputDir, '_summary.json');
    await writeFile(summaryFile, JSON.stringify({
      extractedAt: new Date().toISOString(),
      raterCount,
      type: 'REPORTS'
    }, null, 2));
    
    // Log completion
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    await log(`Completed extraction of REPORTS relationships in ${duration.toFixed(2)} seconds`);
    
    await driver.close();
    process.exit(0);
  } catch (error) {
    await log(`ERROR: ${error.message}`);
    console.error(error);
    
    // Close Neo4j driver before exiting
    try {
      await driver.close();
    } catch (closeError) {
      console.error('Error closing Neo4j driver:', closeError);
    }
    
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  // If --expose-gc flag is provided, enable garbage collection
  if (process.argv.includes('--expose-gc')) {
    global.gc = global.gc || function() {};
  }
  
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
