/**
 * Neo4j event sync API endpoints.
 *
 * GET /api/neo4j/event-check?uuid=<uuid>
 *   Check if an event exists in Neo4j and compare with strfry.
 *
 * POST /api/neo4j/event-update
 *   Body: { uuid } — update/import an event in Neo4j from strfry
 */
const { exec } = require('child_process');

/**
 * Run a Cypher query and return parsed rows.
 */
function runCypher(query) {
  return new Promise((resolve, reject) => {
    const oneLine = query.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const escaped = oneLine.replace(/'/g, "'\\''");
    const cmd = `echo '${escaped}' | cypher-shell -u neo4j -p 3wGDrv6c8svbHVxKiXPL --format plain 2>/dev/null`;
    exec(cmd, { timeout: 15000 }, (error, stdout) => {
      if (error) return reject(error);
      resolve(parseCSV(stdout.trim()));
    });
  });
}

function parseCSV(raw) {
  if (!raw) return [];
  const lines = raw.split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] === 'NULL' ? null : vals[i]; });
    return row;
  });
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Scan strfry for events.
 */
function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safeFilter}'`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      const events = [];
      for (const line of stdout.trim().split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

/**
 * Look up an event in strfry by uuid.
 */
async function findInStrfry(uuid) {
  if (uuid.match(/^(9998|39998|9999|39999):/)) {
    const parts = uuid.split(':');
    const kind = parseInt(parts[0], 10);
    const pubkey = parts[1];
    const dTag = parts.slice(2).join(':');
    const events = await strfryScan({ kinds: [kind], authors: [pubkey], '#d': [dTag] });
    return events[0] || null;
  }
  // Non-replaceable: lookup by id
  const events = await strfryScan({ ids: [uuid] });
  return events[0] || null;
}

/**
 * GET /api/neo4j/event-check?uuid=<uuid>
 */
async function handleEventCheck(req, res) {
  try {
    const uuid = req.query.uuid;
    if (!uuid) return res.status(400).json({ success: false, error: 'Missing uuid parameter' });

    // Check Neo4j
    const rows = await runCypher(
      `MATCH (e:NostrEvent {uuid: '${esc(uuid)}'}) RETURN e.id AS id, e.created_at AS created_at, e.uuid AS uuid, e.name AS name LIMIT 1`
    );
    const neo4jNode = rows.length > 0 ? rows[0] : null;

    // Check strfry
    const strfryEvent = await findInStrfry(uuid);

    // Determine status
    let status, needsUpdate = false;

    if (!neo4jNode && !strfryEvent) {
      status = 'not_found';
    } else if (!neo4jNode && strfryEvent) {
      status = 'missing_from_neo4j';
    } else if (neo4jNode && !strfryEvent) {
      status = 'missing_from_strfry';
    } else {
      const neo4jCreatedAt = parseInt(neo4jNode.created_at, 10);
      const idsMatch = neo4jNode.id === strfryEvent.id;

      if (idsMatch) {
        status = 'in_sync';
      } else if (strfryEvent.created_at > neo4jCreatedAt) {
        status = 'neo4j_outdated';
        needsUpdate = true;
      } else {
        status = 'neo4j_newer_or_conflict';
      }
    }

    const strfryName = strfryEvent?.tags?.find(t => t[0] === 'names')?.[1]
      || strfryEvent?.tags?.find(t => t[0] === 'name')?.[1]
      || null;

    res.json({
      success: true,
      uuid,
      status,
      needsUpdate,
      neo4j: neo4jNode ? {
        id: neo4jNode.id,
        created_at: parseInt(neo4jNode.created_at, 10),
        name: neo4jNode.name,
      } : null,
      strfry: strfryEvent ? {
        id: strfryEvent.id,
        created_at: strfryEvent.created_at,
        name: strfryName,
      } : null,
    });
  } catch (error) {
    console.error('Event check error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Determine the Neo4j label for a given event kind.
 */
function kindToLabel(kind) {
  if (kind === 9998 || kind === 39998) return 'ListHeader';
  if (kind === 9999 || kind === 39999) return 'ListItem';
  if (kind === 7) return 'Reaction';
  return null; // No extra label for unknown kinds
}

/**
 * Import a single event into Neo4j.
 * Runs the same Cypher that batchTransfer + setup produces, but targeted.
 *
 * Supports kinds 9998/39998 (ListHeader), 9999/39999 (ListItem), and 7 (Reaction).
 * For kind 7 reactions:
 *   - Node gets :Reaction label
 *   - content field is stored as e.content
 *
 * For all events:
 *   - NostrEventTags with type "e" get a REFERENCES relationship to the referenced NostrEvent
 *     (created as a "naked" node if not already present, with id and uuid only)
 *   - NostrEventTags with type "a" get a REFERENCES relationship to the referenced NostrEvent
 *     (created as a "naked" node if not already present, with uuid, kind, and pubkey only)
 */
function buildImportCypher(event) {
  const statements = [];
  const isReplaceable = event.kind >= 30000;
  const dTag = event.tags.find(t => t[0] === 'd')?.[1];
  const uuid = isReplaceable ? `${event.kind}:${event.pubkey}:${dTag}` : event.id;
  const aTag = isReplaceable ? uuid : null;
  const extraLabel = kindToLabel(event.kind);

  // Create/update event node
  const parts = [];
  if (isReplaceable) {
    parts.push(`MERGE (e:NostrEvent {uuid: '${esc(uuid)}'})`);
    parts.push(`SET e.id = '${event.id}', e.pubkey = '${event.pubkey}', e.created_at = ${event.created_at}, e.kind = ${event.kind}, e.aTag = '${esc(aTag)}'`);
  } else {
    parts.push(`MERGE (e:NostrEvent {id: '${event.id}'})`);
    parts.push(`SET e.pubkey = '${event.pubkey}', e.created_at = ${event.created_at}, e.kind = ${event.kind}, e.uuid = '${uuid}'`);
  }
  if (extraLabel) parts.push(`SET e:${extraLabel}`);

  // Store content for reactions
  if (event.kind === 7 && event.content !== undefined) {
    parts.push(`SET e.content = '${esc(event.content)}'`);
  }

  const bestName = event.tags.find(t => t[0] === 'name')?.[1]
    || event.tags.find(t => t[0] === 'names')?.[1]
    || event.tags.find(t => t[0] === 'title')?.[1];
  if (bestName) parts.push(`SET e.name = '${esc(bestName)}'`);

  parts.push(`WITH e`);
  parts.push(`MERGE (u:NostrUser {pubkey: '${event.pubkey}'})`);
  parts.push(`MERGE (u)-[:AUTHORS]->(e)`);
  statements.push(parts.join(' '));

  // Tags
  const tagParts = [];
  const refStatements = []; // REFERENCES relationships built separately

  for (let i = 0; i < event.tags.length; i++) {
    const tag = event.tags[i];
    if (!tag[0]) continue;

    // Include index in tagUuid to avoid collisions for multiple tags of the same type
    const tagUuid = `${event.id.slice(-8)}_${i}_${tag[0]}`;
    let setClause = `SET t${i}.type = '${esc(tag[0])}'`;
    for (let j = 0; j < Math.min(tag.length - 1, 5); j++) {
      const suffix = j === 0 ? '' : String(j);
      setClause += `, t${i}.value${suffix} = '${esc(tag[j + 1])}'`;
    }
    if (tagParts.length === 0) {
      tagParts.push(`MATCH (e:NostrEvent {id: '${event.id}'})`);
    }
    tagParts.push(`MERGE (t${i}:NostrEventTag {uuid: '${esc(tagUuid)}'})`);
    tagParts.push(setClause);
    tagParts.push(`MERGE (e)-[:HAS_TAG]->(t${i})`);

    // Build REFERENCES relationships for "e" and "a" tags
    if (tag[0] === 'e' && tag[1]) {
      // "e" tag references an event by id
      const refId = tag[1];
      refStatements.push(
        `MATCH (t:NostrEventTag {uuid: '${esc(tagUuid)}'}) ` +
        `MERGE (ref:NostrEvent {id: '${esc(refId)}'}) ` +
        `ON CREATE SET ref.uuid = '${esc(refId)}' ` +
        `MERGE (t)-[:REFERENCES]->(ref)`
      );
    } else if (tag[0] === 'a' && tag[1]) {
      // "a" tag references a replaceable event by kind:pubkey:d-tag
      const aVal = tag[1];
      const aParts = aVal.split(':');
      if (aParts.length >= 3) {
        const refKind = parseInt(aParts[0], 10);
        const refPubkey = aParts[1];
        // d-tag may contain colons
        const refDTag = aParts.slice(2).join(':');
        const refUuid = aVal;
        refStatements.push(
          `MATCH (t:NostrEventTag {uuid: '${esc(tagUuid)}'}) ` +
          `MERGE (ref:NostrEvent {uuid: '${esc(refUuid)}'}) ` +
          `ON CREATE SET ref.kind = ${refKind}, ref.pubkey = '${esc(refPubkey)}' ` +
          `MERGE (t)-[:REFERENCES]->(ref)`
        );
      }
    }
  }
  if (tagParts.length > 0) statements.push(tagParts.join(' '));

  // Add REFERENCES statements after tags are created
  statements.push(...refStatements);

  return statements;
}

/**
 * Execute Cypher statements via stdin pipe.
 */
function executeCypher(statements) {
  return new Promise((resolve, reject) => {
    const content = statements.map(s => s.trim().replace(/;*$/, '') + ';').join('\n') + '\n';
    const child = exec(
      'cypher-shell -u neo4j -p 3wGDrv6c8svbHVxKiXPL',
      { timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(`cypher-shell: ${error.message}\n${stderr}`));
        resolve(stdout);
      }
    );
    child.stdin.write(content);
    child.stdin.end();
  });
}

/**
 * POST /api/neo4j/event-update
 * Body: { uuid }
 */
async function handleEventUpdate(req, res) {
  try {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ success: false, error: 'Missing uuid' });

    // Find the event in strfry
    const strfryEvent = await findInStrfry(uuid);
    if (!strfryEvent) {
      return res.json({ success: false, error: 'Event not found in strfry' });
    }

    // Check current Neo4j state
    const rows = await runCypher(
      `MATCH (e:NostrEvent {uuid: '${esc(uuid)}'}) RETURN e.id AS id, e.created_at AS created_at LIMIT 1`
    );
    const neo4jNode = rows.length > 0 ? rows[0] : null;

    // If exists in Neo4j, delete old tags first
    if (neo4jNode) {
      console.log(`Deleting old tags for ${uuid}`);
      await executeCypher([
        `MATCH (e:NostrEvent {uuid: '${esc(uuid)}'})-[r:HAS_TAG]->(t:NostrEventTag) DETACH DELETE t`
      ]);
    }

    // Import (or re-import) the event
    const importStatements = buildImportCypher(strfryEvent);
    await executeCypher(importStatements);

    const action = neo4jNode ? 'updated' : 'imported';
    console.log(`Event ${action} in Neo4j: ${uuid}`);

    res.json({
      success: true,
      action,
      uuid,
      eventId: strfryEvent.id,
    });
  } catch (error) {
    console.error('Event update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/neo4j/event-uuids
 * Returns all NostrEvent uuids currently in Neo4j.
 * Response: { success: true, uuids: ["uuid1", "uuid2", ...] }
 */
async function handleEventUuids(req, res) {
  try {
    const rows = await runCypher('MATCH (n:NostrEvent) RETURN n.uuid AS uuid');
    const uuids = rows.map(r => r.uuid).filter(Boolean);
    res.json({ success: true, uuids });
  } catch (error) {
    console.error('Event uuids error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { handleEventCheck, handleEventUpdate, handleEventUuids, buildImportCypher, executeCypher };
