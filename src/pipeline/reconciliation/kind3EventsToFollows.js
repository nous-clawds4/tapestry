#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Path configuration
const inputPath = path.join(__dirname, 'allKind3EventsStripped.json');

// reconcileNetwork (Story #23 / ADR 0020): optionally restrict output to a
// covered author set. With --filterAuthorsFile <path>, only events whose author
// is in that newline-delimited pubkey set are written — keeping the per-pubkey
// fanout bounded to the network instead of every strfry author.
let filterAuthors = null;
{
  const fIdx = process.argv.indexOf('--filterAuthorsFile');
  if (fIdx !== -1 && process.argv[fIdx + 1]) {
    filterAuthors = new Set(
      fs.readFileSync(process.argv[fIdx + 1], 'utf8')
        .split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean)
    );
    console.log(`Filtering output to ${filterAuthors.size} covered authors from ${process.argv[fIdx + 1]}`);
  }
}

// Count total lines for progress reporting
async function countLines() {
  return new Promise((resolve) => {
    let lineCount = 0;
    const lineReader = readline.createInterface({
      input: fs.createReadStream(inputPath),
      crlfDelay: Infinity
    });
    
    lineReader.on('line', () => {
      lineCount++;
    });
    
    lineReader.on('close', () => {
      resolve(lineCount);
    });
  });
}

async function processFile() {
  const totalLines = await countLines();
  console.log(`Total events to process: ${totalLines}`);
  
  let eventCounter = 0;
  
  // Create readline interface for reading the input file line by line
  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity
  });
  
  // Process each line
  rl.on('line', (line) => {
    eventCounter++;
    
    // Log progress every 1000 events
    if (eventCounter % 1000 === 0) {
      const date = new Date();
      console.log(`[${date.toISOString()}] Processing event ${eventCounter} out of ${totalLines}`);
    }
    
    try {
      const oEvent = JSON.parse(line);
      const pk_rater = oEvent.pubkey.toLowerCase();
      if (filterAuthors && !filterAuthors.has(pk_rater)) { return; }
      const aTags = oEvent.tags;
      const created_at = oEvent.created_at;
      let oTemp = {};
      oTemp[pk_rater] = {};

      const outputPath = path.join(__dirname,'currentRelationshipsFromStrfry/follows/', pk_rater + '.json');
      
      for (let x = 0; x < aTags.length; x++) {
        const tag = aTags[x];
        if (tag[0] === 'p') {
          const pk_ratee = tag[1].toLowerCase();
          oTemp[pk_rater][pk_ratee] = true;
        }
      }

      fs.appendFileSync(outputPath, JSON.stringify(oTemp, null, 2) + '\n');
    } catch (e) {
      console.error(`Error processing line: ${e.message}`);
    }
  });

  // Return a promise that resolves when processing is complete
  return new Promise((resolve) => {
    rl.on('close', () => {
      console.log(`Processed all ${eventCounter} events. Output written to file.`);
      resolve();
    });
  });
}

// Run the process and handle any errors
processFile()
  .then(() => {
    console.log('Processing completed successfully');
  })
  .catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });