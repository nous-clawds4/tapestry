/**
 * The view model for the Tagging pipeline panel (tagging-edges Story 4 / ADR tagging-edges/0004 § UI).
 *
 * Every derivation the panel shows lives here, so the Node gate can import it without a React runner
 * (the nextTaskCountdown.js precedent): which pass is running (by liveness, never by the stored outcome),
 * the newest finished pass, the path's figures against "not yet available", the backstop schedule's
 * verdict, the drift arithmetic, and the code-to-sentence table with its "not recognised" fallback.
 *
 * Inputs are the bodies of the public reads (GET /api/tagging-edges/status, /realtime/status,
 * /api/scheduled-tasks/list) and of the gated GET /api/tagging-edges/drift-counts. Nothing here reads a
 * clock: what is stale or expired is the server's verdict, passed through. Results carry a tone
 * (ok | warn | bad | neutral), never a colour; the panel maps tones to design tokens.
 *
 * Plain ESM with Node 16 syntax and built-ins only, so the host gate can import it.
 */

/** How often the panel re-reads the pass and path status (AC-5: a change shows within 10 s). */
export const POLL_MS = 5000;
/** How often the panel re-reads the schedule list, whose handler reads each entry's task log. */
export const SCHEDULE_POLL_MS = 60000;

const NOT_RECOGNISED = 'not recognised';

/**
 * One sentence per code the producers can write today, by kind. The guard test
 * (test/tagging-pipeline-codes.test.js) extracts each kind's codes from its producer and fails until every
 * one has its own entry here. A code with no entry is shown as it is, "not recognised" (ADR 0004
 * § Consequences). Written from the producers: the pass runner (reconcileTaggingEdges.js), the tagging
 * contract and planner (src/lib/tagging-edges/), the real-time engine (realtime/index.js) and the routes.
 */
export const EXPLANATIONS = Object.freeze({
  // The pass's outcome (finish(…) and the pessimistic first record).
  passOutcome: Object.freeze({
    done: 'The pass finished, and no removals were held. Any lost races or conflicting addresses it names wait for the next pass.',
    'done-removals-held': 'The pass finished, but more removals were due than the safety limit allows, so it held all of them for the owner to confirm. On a run the owner had confirmed, it held every removal the owner had not confirmed. It made the other changes it could.',
    refused: 'A start check failed, so the pass changed nothing. The reason says which check.',
    failed: 'The pass ended before it finished. The reason says where, and the next pass repairs what it left.',
  }),
  // The pass's reason code (refuse(…), fail(…) and reasonCode: …).
  passReason: Object.freeze({
    identity: 'A tagging stamp identity is missing or not a valid key, so the pass changed nothing. The details name which one and where it is read from.',
    config: 'The database settings are missing or the database driver could not be opened, so the pass changed nothing. Check NEO4J_URI and NEO4J_USER in brainstorm.conf.',
    schema: 'A start check on the database failed, so the pass changed no relationship or person. The pass\'s code says which case. ServiceUnavailable or SessionExpired: Neo4j is down or cannot be reached. A Neo.ClientError.Security code: Neo4j refused the credentials or the permission the pass needs. Fix either one first, then run the pass again. tags_address-not-online: the one-per-tagging rule is not online yet, usually because Neo4j is still building it. Wait a few minutes, then run the pass again, and raise it with the owner if it stays offline. tags_address-missing: the pass could not create the one-per-tagging rule. Raise it with the owner. The control panel\'s log, /var/log/supervisor/brainstorm.log in the tapestry container, says why at its last start. nostrUser_pubkey-missing: the NostrUser pubkey rule is missing. Run the constraints fix on the Dashboard, then run the pass again. Any other code has its own explanation beside it.',
    read: 'A read of the graph or the relay failed, so the pass changed nothing. The next pass tries again. Any owner confirmation this pass claimed is used up, so held removals need confirming again.',
    plan: 'Planning the changes failed, so the pass changed nothing. The next pass tries again. Any owner confirmation this pass claimed is used up, so held removals need confirming again.',
    write: 'A write failed, either to the graph or of a safety copy of rows to the data volume. Batches written before it stand, and the next pass finishes the rest. Any owner confirmation this pass claimed is used up, so held removals need confirming again. If the code is ENOSPC, free space on the data volume.',
    report: 'The pass could not write its report or its held list to the data volume. Check the volume has free space, then run the pass again.',
    error: 'A fault in the pass\'s own code ended it. The task log has the details, and the next pass tries again.',
    stopped: 'The pass never recorded its end. Either a time-out, a container restart or a deploy stopped it before it finished, or it reached its end but could not write its final report to the data volume. The next pass repairs anything it left. In the second case, the pass\'s TASK_ERROR event in /var/log/brainstorm/taskQueue/events.jsonl, in the tapestry container, carries reportWriteFailed. Free space on the data volume, then run the pass again.',
    signal: 'A stop signal ended the pass at a safe point between its steps. Anything written before it stands, and the next pass finishes the rest.',
    'removals-held': 'More removals were due than the safety limit allows, so the pass held them for the owner to confirm. It applied the other changes it could.',
    done: 'The pass finished with nothing held. Any lost races or conflicting addresses wait for the next pass.',
  }),
  // Where a pass failed (failure.stage).
  failureStage: Object.freeze({
    report: 'The pass failed while writing its report or held list to the data volume.',
    signal: 'A stop signal (SIGTERM or SIGINT) ended the pass at a safe point between its steps.',
    identity: 'The pass failed while checking the two tagging stamp identities.',
    config: 'The pass failed while reading the database settings or opening the driver.',
    schema: 'The pass failed while checking the database\'s uniqueness rules.',
    read: 'The pass failed while reading the graph or the relay.',
    plan: 'The pass failed while planning the changes.',
    write: 'The pass failed while writing to the graph, or while saving a safety copy of rows to the data volume.',
    unexpected: 'A fault in the pass\'s own code ended it.',
  }),
  // Which read failed (failure.read).
  failureRead: Object.freeze({
    graph: 'Reading the graph\'s tagging relationships failed or took too long.',
    relay: 'Reading the relay\'s tagging events failed or took too long.',
    'graph-verify': 'Re-reading a batch of relationships just before writing it failed.',
  }),
  // Why the definition refuses a tagging (contract.js REFUSAL).
  refusedReason: Object.freeze({
    'not-an-event': 'The relay returned something that is not a well-formed nostr event.',
    'wrong-kind': 'The event is not kind 39999, so it cannot be a tagging.',
    'no-d': 'The event has no usable d tag, so it has no tagging address.',
    'no-nostr-user-tag-stamp': 'The event carries neither nostr user tag stamp, the canonical one or this instance\'s own.',
    'no-target': 'The event names no tagged person.',
    'several-targets': 'The event names more than one tagged person, so it cannot be one tagging.',
    'bad-target': 'The tagged person\'s key is not a 64-character hex pubkey.',
    'no-tag-reference': 'The event names no tag, by address or by event id.',
    'several-tag-references': 'The event names more than one tag, so it cannot be one tagging.',
    'bad-tag-address': 'The event\'s tag address is not a well-formed kind 39999 address.',
  }),
  // Why a removal is due, and so may be held (sweep.js REMOVAL_REASON).
  heldReason: Object.freeze({
    'not-on-relay': 'The relay no longer holds a tagging at this address, so its relationship is due for removal.',
    'non-tagging': 'The relay\'s event at this address is not a tagging the definition accepts, so its relationship is due for removal.',
  }),
  // Why a relationship is left in place (sweep.js LEFT_REASON).
  leftInPlaceReason: Object.freeze({
    'missing-address': 'The relationship has no address, so the pass cannot match it to the relay and leaves it alone.',
    'not-a-tagging-address': 'The relationship\'s address is not a tagging address, so the pass leaves it alone.',
  }),
  // How a relationship changed (sweep.js CHANGE_KIND).
  changeKind: Object.freeze({
    newer: 'The relay holds a newer version of the tagging, and the relationship now records it.',
    older: 'The relay\'s current version is older than the one recorded, and the relationship now follows the relay.',
    moved: 'The relationship did not join the NostrUser nodes the tagging names, so the pass moved it to them.',
    refreshed: 'The version is the same, and the pass rewrote the relationship to match it. Its tag or stamps were out of date, or it carried properties a tagging relationship does not have. The pass kept a safety copy of those properties on the data volume before removing them.',
    repaired: 'The stored relationship was malformed, and the pass rewrote it from the relay\'s version.',
  }),
  // Why a pass did not honour the owner's confirmation (validateClaim's why).
  confirmationWhy: Object.freeze({
    unreadable: 'The owner\'s confirmation could not be read, so the pass did not honour it. The owner can confirm again.',
    malformed: 'The owner\'s confirmation is not in the expected form, so the pass did not honour it. The owner can confirm again.',
    expired: 'The owner\'s confirmation passed its 24-hour limit before a pass claimed it, so the pass did not honour it. The owner can confirm again.',
    'report-changed': 'A newer pass ran after the one the owner confirmed, so this pass did not honour the confirmation. The owner can confirm the latest held list.',
    'report-not-held': 'The pass the owner confirmed no longer reads as one that held removals, so this pass did not honour the confirmation.',
    'held-file-missing': 'The held list the owner confirmed is no longer on the data volume, so this pass did not honour the confirmation.',
    'digest-mismatch': 'The held list on the data volume differs from the one the owner confirmed, so this pass did not honour the confirmation.',
  }),
  // The real-time path's state (currentState(), and the route's forced off).
  pathState: Object.freeze({
    off: 'The path is switched off. Changes on the relay wait for the next pass.',
    starting: 'The path is connecting to the relay, or taking its first-start reading of the relay.',
    'waiting-setup': 'The path found a setup problem and writes nothing until it is fixed. The setup problem below says what to fix.',
    'waiting-graph': 'The path cannot reach the graph. It waits and retries, and loses nothing.',
    'waiting-relay': 'The path lost its relay subscription. It waits and retries, and loses nothing.',
    'catching-up': 'The path is reading the relay\'s taggings and the graph\'s to find changes it missed. It does this at each start and reconnect, every 10 minutes, after dropping changes over its backlog, when a pass that overlapped its work ends, and when the graph comes back. It still applies live changes meanwhile. The exception is a re-read of the relay after the path lost its record: live changes then wait for that read.',
    live: 'The path is subscribed to the relay and reflects each change as it arrives.',
    stopped: 'The path ended after a crash or a stop signal, and reflects nothing until it starts again. After a crash, its last error says why.',
  }),
  // The path's setup problem, keyed identity:<problem> or schema:<rule>:<problem> (checkIdentity, schemaReady).
  setupProblem: Object.freeze({
    'identity:missing': 'A tagging stamp identity has no value at its source, so the path writes nothing. Set it there, then turn the path off and on again.',
    'identity:empty': 'A tagging stamp identity is blank at its source, so the path writes nothing. Set it there, then turn the path off and on again.',
    'identity:upper-case': 'A tagging stamp identity is in upper-case hex, and the path needs lower case, so it writes nothing. Correct it at its source, then turn the path off and on again.',
    'identity:not-64-hex': 'A tagging stamp identity is not a 64-character hex key, so the path writes nothing. Correct it at its source, then turn the path off and on again.',
    'schema:tags_address:missing': 'The one-per-tagging rule is missing from the database, so the path writes nothing. Run the constraints fix on the Dashboard, and the path picks the rule up within 15 seconds.',
    'schema:tags_address:not-online': 'The one-per-tagging rule exists but is not online yet, so the path writes nothing. The path picks it up within 15 seconds of it coming online.',
    'schema:nostrUser_pubkey:missing': 'The NostrUser pubkey rule is missing from the database, so the path writes nothing. Run the constraints fix on the Dashboard, and the path picks the rule up within 15 seconds.',
    'schema:nostrUser_pubkey:not-online': 'The NostrUser pubkey rule exists but is not online yet, so the path writes nothing. The path picks it up within 15 seconds of it coming online.',
  }),
  // Where the path's last error came from (STAGE_TEXT's keys).
  lastErrorStage: Object.freeze({
    'relay-read': 'Reading a tagging from the relay failed. The path retries it.',
    'element-read': 'Reading a tag element from the relay failed. The path retries it.',
    'graph-read': 'Reading the graph failed. The path waits for the graph and retries.',
    'graph-write': 'A write to the graph failed. The path retries it, and parks an address the database keeps refusing.',
    schema: 'Checking the database\'s uniqueness rules failed. The path retries the check.',
    config: 'The path could not open the database driver. Check NEO4J_URI and NEO4J_USER in brainstorm.conf.',
    'catch-up': 'A read made while catching up failed. The path retries it with a growing wait.',
    baseline: 'The first start\'s reading of the relay failed. The path retries it with a growing wait.',
    journal: 'The path could not write its journal to the data volume. It keeps the lines it could not write in memory, and keeps writing to the graph. Free space on the volume: the next write that succeeds saves the kept lines. If the path stops before then, those lines are lost. Its next start\'s catch-up then finds again what the relay still holds, and the rest waits for the next pass.',
    record: 'The path could not write its record file to the data volume. Check the volume has free space.',
    status: 'The path could not write its status file, so this page may show old figures. Check the data volume has free space.',
    unexpected: 'A fault in the path\'s own code stopped what it was doing. The path\'s log, /var/log/supervisor/tagging-edges-realtime.log in the tapestry container, has the details.',
  }),
  // How the path's last catch-up ended (endCatchUp).
  catchUpOutcome: Object.freeze({
    done: 'The catch-up finished. The path compared the relay\'s taggings with the graph\'s and reflected the changes it had missed, apart from any at a parked address.',
    failed: 'The catch-up failed at the stage named beside it. The path retries it with a growing wait.',
    stopped: 'The path stopped before the catch-up finished. Its next start runs it again.',
    'not-established': 'The path lost its record of what it had seen, and read the relay afresh. What the relay stored during the gap waits for the next pass.',
  }),
  // Where a catch-up failed (failCatchUp).
  catchUpStage: Object.freeze({
    'graph-keys': 'Reading the graph\'s tagging keys failed.',
    'stamp-scan': 'Scanning the relay for stamped taggings failed.',
    unexpected: 'A fault in the path\'s own code ended the catch-up.',
  }),
  // Why the path's record was not established at a start (LOST_REASONS).
  notEstablishedReason: Object.freeze({
    'record-missing': 'The path\'s record file was not on the data volume at its start.',
    'record-unreadable': 'The path\'s record file could not be read, or failed its checksum.',
    'journal-unreadable': 'The path\'s journal could not be read at its start.',
    'identity-changed': 'A tagging stamp identity changed after the record was written, so the record no longer applies.',
  }),
  // Why a count or a read failed: the strict reader's codes, plus the drift route's own (identity,
  // timeout, unparseable) and allowErrorCode's fallback. A path's lastError code is one of these too.
  countCode: Object.freeze({
    spawn: 'The strfry command could not be started. Try again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    'process-error': 'The strfry command could not run, or its output could not be read. Try again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    timeout: 'The operation ran past its time limit, so its result is unknown. Try again, and check that the relay and Neo4j are answering if it repeats.',
    exit: 'The strfry command ended with a failure code. Try again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    signal: 'A signal ended the strfry command before it finished. Try again.',
    truncated: 'The strfry command\'s output stopped part-way through a line. Try again.',
    unparseable: 'The answer came back in an unexpected form, so it is not used as a figure. Try again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log, and Neo4j\'s, /var/log/supervisor/neo4j.log, both in the tapestry container.',
    'not-an-event-line': 'The strfry command printed a line that is not an event. Try again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    duplicate: 'The strfry command printed the same event twice, so the read is not trusted. Try again.',
    'off-filter': 'The strfry command returned an event the read did not ask for, so the read is not trusted. Try again.',
    'too-large': 'The strfry command\'s output passed its size limit, so the read stopped. A retry fails the same way until fewer or smaller events match, so check the relay for a flood of large events.',
    'filter-too-large': 'The relay filter was too long to hand to strfry, so the read never started. A retry with the same filter fails the same way, so report it as a bug.',
    identity: 'A tagging stamp identity could not be resolved, so the relay was not counted. Check the Tapestry Assistant key.',
    error: 'The operation failed with a code that is not passed on. Try again. If this is the path\'s last error, the path\'s log, /var/log/supervisor/tagging-edges-realtime.log in the tapestry container, has the details.',
    // The status route's own code for a state file that is not valid JSON (src/api/tagging-edges/index.js readJson).
    EBADJSON: 'A file of the pass\'s state on the data volume is damaged and cannot be parsed. If it is the owner\'s confirmation, the owner can confirm again, which replaces it.',
  }),
  // A failed or refused pass's own failure.code (ADR 0004 T12), shown under where it failed. The runner
  // (reconcileTaggingEdges.js) mints most of these; graph.js's invariant, checkIdentity's problems and the strict
  // relay reader's ScanError codes (SCAN_ERROR_CODES) reach it too. The E…, Neo.… and connection codes are families below.
  failureCode: Object.freeze({
    // Identity (refuse('identity', …): the problem checkIdentity or resolveIdentities found).
    missing: 'A tagging stamp identity has no value at its source, so the pass changed nothing. The reason names the identity and its source. For the local identity, set it there (TA_PUBKEY, or BRAINSTORM_RELAY_PUBKEY in /etc/brainstorm.conf, or the assistant\'s key), then run the pass again. The canonical identity comes from the code itself, so raise that with the owner.',
    empty: 'A tagging stamp identity is blank at its source, so the pass changed nothing. The reason names the identity and its source. Set it there, then run the pass again.',
    'upper-case': 'A tagging stamp identity is written in upper case hex, and the pass needs lower case, so it changed nothing. The reason names the identity and its source. Correct it there, then run the pass again.',
    'not-64-hex': 'A tagging stamp identity is not a 64-character hex key, so the pass changed nothing. The reason names the identity and its source. Correct it there, then run the pass again.',
    // Config (the settings check, then the pass's own driver).
    'missing-NEO4J_URI': 'NEO4J_URI is not set, so the pass could not reach the database and changed nothing. Set it in /etc/brainstorm.conf in the tapestry container, then run the pass again.',
    'missing-NEO4J_USER': 'NEO4J_USER is not set, so the pass could not sign in to the database and changed nothing. Set it in /etc/brainstorm.conf in the tapestry container, then run the pass again.',
    driver: 'The Neo4j driver could not be built from NEO4J_URI, so the pass changed nothing. Check that NEO4J_URI in /etc/brainstorm.conf in the tapestry container is a Neo4j address such as bolt://localhost:7687, then run the pass again.',
    // Schema (the start check on the uniqueness rules).
    'tags_address-missing': 'The pass could not create the one-per-tagging rule, so it changed no relationship or person. One cause is another rule that already holds its name, tags_address. Raise it with the owner. The control panel\'s log, /var/log/supervisor/brainstorm.log in the tapestry container, says why at its last start.',
    'tags_address-not-online': 'The one-per-tagging rule exists but its index was not online within the 60 seconds the pass waited, so it changed no relationship or person. Usually Neo4j is still building it: wait a few minutes, then run the pass again. If it stays offline, its index may have failed, so raise it with the owner.',
    'nostrUser_pubkey-missing': 'The NostrUser pubkey rule is missing from the database, so the pass changed no relationship or person. Run the constraints fix on the Dashboard, then run the pass again.',
    'no-status': 'Checking or creating the one-per-tagging rule failed with an error that carried no code, most often from Neo4j, so the pass changed no relationship or person. Check that Neo4j is running in the tapestry container, and read its log, /var/log/supervisor/neo4j.log. Then run the pass again.',
    // Reads (the graph read, its schema re-check, the relay read and a write's re-read).
    incomplete: 'The graph or the relay answered a read with no list of results, so the pass did not trust it and changed nothing. The next pass tries again. If it repeats, check that Neo4j and the relay are running in the tapestry container.',
    'missing-column': 'A row the graph returned lacks a column the pass reads, so the pass stopped rather than use it. If it stopped while writing, batches written before it stand. The next pass tries again. If it repeats, report it as a bug.',
    'uniqueness-not-holding': 'The graph read found two relationships at one tagging address, or the same relationship twice because a write landed during the read, and a re-check found the one-per-tagging rule not in force, so the pass changed nothing. Run the pass again. Its start check creates the rule if it is missing, and names the problem if it cannot.',
    // The rest: the planner, the graph writer's own checks, a stop signal, and the fallback for a code-less error.
    'plan-error': 'Planning the changes failed, so the pass changed nothing. This is a fault in the pass\'s own code, and the task log has the details. The next pass tries again. If it repeats, report it as a bug.',
    invariant: 'A safety check in the graph writer refused a batch, so that batch was not written. Batches written before it stand. This is a fault in the pass\'s own code, so report it as a bug. The next pass tries again.',
    signal: 'A signal ended the pass, or ended the strfry command reading the relay. The stage beside it says which. A stop signal ends the pass at a safe point between its steps. Anything written before it stands, and the next pass finishes the rest.',
    error: 'The step failed without a code that says why. The task log has the details, and the next pass tries again.',
    // The relay read's codes (strfryScanStrict's ScanError, SCAN_ERROR_CODES), at the relay read.
    spawn: 'The pass could not start the strfry command that reads the relay, so it changed nothing. The next pass tries again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    'process-error': 'The strfry command that reads the relay could not run, or its output could not be read, so the pass changed nothing. The next pass tries again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    timeout: 'The relay read ran past its time limit, so the pass changed nothing. The next pass tries again. If it repeats, check that the relay is answering in the tapestry container.',
    exit: 'The strfry command that reads the relay ended with a failure code, so the pass changed nothing. The next pass tries again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    truncated: 'The relay read\'s output stopped part-way through a line, so the pass did not trust it and changed nothing. The next pass tries again.',
    unparseable: 'The relay read printed a line that is not JSON, so the pass did not trust it and changed nothing. The next pass tries again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    'not-an-event-line': 'The relay read printed a line that is not an event, so the pass did not trust it and changed nothing. The next pass tries again. If it repeats, check the relay\'s log, /var/log/supervisor/strfry-error.log in the tapestry container.',
    duplicate: 'The relay read returned the same event twice, so the pass did not trust it and changed nothing. The next pass tries again.',
    'off-filter': 'The relay read returned an event the pass did not ask for, so the pass did not trust it and changed nothing. The next pass tries again.',
    'too-large': 'The relay read\'s output passed its size limit, so the read stopped and the pass changed nothing. The next pass fails the same way until fewer or smaller events match, so check the relay for a flood of large events.',
    'filter-too-large': 'The relay filter was too long to hand to strfry, so the read never started and the pass changed nothing. The next pass fails the same way, so report it as a bug.',
  }),
  // Why one of the panel's own reads failed (readSection's codes; http-<status> is a family below).
  fetchCode: Object.freeze({
    network: 'The request did not reach the server. Check the connection, then try again.',
    timeout: 'The server took too long to answer, so the panel stopped waiting. Try again.',
    'bad-json': 'The server\'s answer was not the data the panel expects. Try again. If it repeats, check the control panel\'s log, /var/log/supervisor/brainstorm.log in the tapestry container.',
  }),
});

/**
 * The open code families, checked after the exact table, each under its own kind only. The error codes are
 * the shapes allowErrorCode lets through (src/lib/tagging-edges/realtime.js); the two confirmation prefixes are
 * validateClaim's and the claim's templates, followed by an error code.
 */
export const FAMILIES = Object.freeze([
  Object.freeze({ kind: 'fetchCode', test: /^http-\d{3}$/,
    sentence: 'The server answered with this HTTP status instead of the figures. For 401 or 403, sign in again as the owner or an admin, from the instance\'s own address. For any other status, try again. If it repeats, check the control panel\'s log, /var/log/supervisor/brainstorm.log in the tapestry container.' }),
  Object.freeze({ kind: 'countCode', test: /^E(?!RR_)[A-Z0-9_]+$/,
    sentence: 'The operating system reported this error code, for example a refused connection or a full disk. Try again. If it repeats, check that the relay and Neo4j are running in the tapestry container, and that the data volume has free space.' }),
  // A Security code is a credentials or permission problem, not an outage, so it is told apart before the general
  // Neo4j family. The E family excludes Node's own ERR_* codes, which are not the operating system's.
  Object.freeze({ kind: 'countCode', test: /^Neo\.ClientError\.Security\.[A-Za-z]+$/,
    sentence: 'Neo4j refused the request on security grounds: the credentials it was given, or the permission that user has. Check NEO4J_USER and NEO4J_PASSWORD in /etc/brainstorm.conf in the tapestry container against the database\'s own, and that user\'s role, then try again.' }),
  Object.freeze({ kind: 'countCode', test: /^Neo\.(ClientError|TransientError|DatabaseError)\.[A-Za-z]+\.[A-Za-z]+$/,
    sentence: 'Neo4j answered with this status. A transient one usually clears on a retry, so try again. If another repeats, check that Neo4j is running, and read its log, /var/log/supervisor/neo4j.log in the tapestry container.' }),
  Object.freeze({ kind: 'countCode', test: /^(ServiceUnavailable|SessionExpired)$/,
    sentence: 'Neo4j could not be reached, or it dropped the session. Check that Neo4j is running in the tapestry container, then try again.' }),
  // The same open families under a pass's own failure code (ADR 0004 T12), Security again before the general family.
  Object.freeze({ kind: 'failureCode', test: /^E(?!RR_)[A-Z0-9_]+$/,
    sentence: 'The operating system reported this error code, for example a full disk or a refused permission. If the pass failed writing its report, its held list or a safety copy, check that the data volume has free space and is writable. Otherwise check that the relay and Neo4j are running in the tapestry container. Then run the pass again.' }),
  Object.freeze({ kind: 'failureCode', test: /^Neo\.ClientError\.Security\.[A-Za-z]+$/,
    sentence: 'Neo4j refused the pass on security grounds: the credentials it gave, or the permission that user has, for example to create a uniqueness rule. Check NEO4J_USER and NEO4J_PASSWORD in /etc/brainstorm.conf in the tapestry container against the database\'s own, and that user\'s role, then run the pass again.' }),
  Object.freeze({ kind: 'failureCode', test: /^Neo\.(ClientError|TransientError|DatabaseError)\.[A-Za-z]+\.[A-Za-z]+$/,
    sentence: 'Neo4j answered the pass with this status. A transient one usually clears by the next pass. If another repeats, check that Neo4j is running, and read its log, /var/log/supervisor/neo4j.log in the tapestry container.' }),
  Object.freeze({ kind: 'failureCode', test: /^(ServiceUnavailable|SessionExpired)$/,
    sentence: 'Neo4j could not be reached, or it dropped the pass\'s session. Check that Neo4j is running in the tapestry container, then run the pass again.' }),
  Object.freeze({ kind: 'confirmationWhy', test: /^held-file-unreadable /,
    sentence: 'The held list the owner confirmed could not be read from the data volume, so this pass did not honour the confirmation. The code after it says why.' }),
  Object.freeze({ kind: 'confirmationWhy', test: /^claim failed: /,
    sentence: 'The pass could not claim the owner\'s confirmation, so it held any removals over the limit again. The code after it says why.' }),
]);

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The sentence for one code. → { code, text, recognised }, with `code` exactly as given. The exact table is
 * looked up by own property only, then the kind's families; anything else, a non-string or an unknown kind
 * included, is `not recognised` (T6).
 */
export function explain(kind, code) {
  if (typeof kind === 'string' && typeof code === 'string' && own(EXPLANATIONS, kind)) {
    const table = EXPLANATIONS[kind];
    if (own(table, code)) return { code, text: table[code], recognised: true };
    for (const f of FAMILIES) {
      if (f.kind === kind && f.test.test(code)) return { code, text: f.sentence, recognised: true };
    }
  }
  return { code, text: NOT_RECOGNISED, recognised: false };
}

const FINISHED = ['done', 'done-removals-held'];
const isFinished = (r) => isObject(r) && FINISHED.includes(r.outcome);
const reachedPlan = (r) => isObject(r) && Array.isArray(r.phases) && r.phases.some((p) => isObject(p) && p.phase === 'plan');
const sum = (o) => (isObject(o) ? Object.values(o).reduce((a, v) => a + (num(v) || 0), 0) : 0);

/**
 * The owner's pending confirmation, in five states checked in order (§ UI). The server decides `expired`;
 * the client clock is never read.
 */
function confirmationView(c) {
  if (c === null || c === undefined) return { state: 'none', tone: 'neutral' };
  if (!isObject(c)) return { state: 'unreadable', code: null, tone: 'bad' };
  if (c.unreadable) return { state: 'unreadable', code: c.unreadable, tone: 'bad' };
  if (c.expired === true) return { state: 'expired', runId: c.runId, expiresAt: c.expiresAt, tone: 'warn' };
  if (typeof c.expiresAt !== 'string' || !Number.isFinite(Date.parse(c.expiresAt))) {
    return { state: 'unknown-expiry', runId: c.runId, tone: 'warn' };
  }
  return { state: 'pending', runId: c.runId, expiresAt: c.expiresAt, tone: 'warn' };
}

const OUTCOME_TONE = Object.freeze({ done: 'ok', 'done-removals-held': 'warn', refused: 'bad', failed: 'bad' });

/**
 * The pass section (AC-2; T1). A pass is running when the status says it is alive, and nothing else: while
 * it runs, its stored record (the pessimistic "failed, stopped" one) is never shown as a result, only as
 * `current`. → { running, current, latest, earlier, empty, confirmation, tone }, or null for a non-object.
 */
export function passView(statusBody) {
  if (!isObject(statusBody)) return null;
  const running = statusBody.running === true;
  const stored = isObject(statusBody.latest) ? statusBody.latest : null;
  const earlier = Array.isArray(statusBody.previous) ? statusBody.previous.slice() : [];
  const current = running && stored
    ? { runId: stored.runId, startedAt: stored.startedAt, phases: Array.isArray(stored.phases) ? stored.phases : [],
      finishing: stored.endedAt !== null && stored.endedAt !== undefined }
    : null;
  const latest = running ? null : stored;
  let tone = 'neutral';
  if (latest && own(OUTCOME_TONE, latest.outcome)) tone = OUTCOME_TONE[latest.outcome];
  return {
    running,
    current,
    latest,
    earlier,
    empty: stored === null && earlier.length === 0,
    confirmation: confirmationView(statusBody.confirmationPending),
    tone,
  };
}

/**
 * The newest finished pass (outcome done or done-removals-held): the latest record when no pass runs, else
 * the first such record in `previous`. → that record itself, or null (T2).
 */
export function newestFinishedPass(statusBody) {
  if (!isObject(statusBody)) return null;
  const records = [];
  if (statusBody.running !== true && isObject(statusBody.latest)) records.push(statusBody.latest);
  if (Array.isArray(statusBody.previous)) records.push(...statusBody.previous);
  for (const r of records) if (isFinished(r)) return r;
  return null;
}

const WARNINGS = ['stale', 'statusUnreadable', 'switchUnreadable'];

/** The section's tone: a dead or unreadable path is bad, a waiting or stale one a warning, live is ok. */
function pathTone(v) {
  if (v.onButNotRunning || v.warnings.includes('statusUnreadable') || v.state === 'stopped') return 'bad';
  if (v.warnings.length > 0 || v.setupProblemKey !== null || (typeof v.state === 'string' && v.state.startsWith('waiting-'))) return 'warn';
  if (v.on && v.state === 'live') return 'ok';
  return 'neutral';
}

/**
 * The path section (AC-3; T3). Liveness first: a path switched on whose process is not alive shows no state,
 * since the stored one may still read live. Before the first start every figure is null, which the panel
 * reads as "not yet available", never 0. Counts (cumulative since the first start, or since a reset) and
 * gauges (parked, pending) are kept apart. → the view, or null for a non-object.
 */
export function pathView(rtBody) {
  if (!isObject(rtBody)) return null;
  const on = rtBody.on === true;
  const running = rtBody.running === true;
  const onButNotRunning = on && !running;
  const c = isObject(rtBody.counts) ? rtBody.counts : null;
  const started = (rtBody.firstStartedAt !== null && rtBody.firstStartedAt !== undefined) || c !== null;

  let counts = null;
  if (started) {
    const k = c || {};
    const fr = isObject(k.failedReads) ? k.failedReads : {};
    const reads = { relay: num(fr.relay), graph: num(fr.graph), element: num(fr.element), catchUp: num(fr.catchUp) };
    const known = Object.values(reads).filter((v) => v !== null);
    counts = {
      added: num(k.added),
      changed: num(k.changed),
      removed: num(k.removed),
      unchanged: num(k.unchanged),
      peopleAdded: num(k.peopleAdded),
      refusedLooks: isObject(k.refused) ? num(k.refused.total) : null,
      failedReads: { ...reads, total: known.length ? known.reduce((a, v) => a + v, 0) : null },
      dbRefused: isObject(k.dbRefused) ? num(k.dbRefused.total) : null,
      removalsNotPrompted: num(k.removalsNotPrompted),
      droppedOverBacklog: num(k.droppedOverBacklog),
    };
  }

  // The status records no time for a reset (it follows a lost status), so the panel gives none.
  let countsSince = null;
  if (started) {
    countsSince = c && c.countsReset === true
      ? { from: 'reset', at: null }
      : { from: 'first-start', at: rtBody.firstStartedAt === undefined ? null : rtBody.firstStartedAt };
  }

  const sp = rtBody.setupProblem;
  let setupProblemKey = null;
  if (isObject(sp)) {
    if (sp.kind === 'identity') setupProblemKey = `identity:${sp.problem}`;
    else if (sp.kind === 'schema') setupProblemKey = `schema:${sp.rule}:${sp.problem}`;
    else setupProblemKey = `${sp.kind}:${sp.problem}`; // an unknown shape is shown, as not recognised
  }

  const catchUp = isObject(rtBody.catchUp) ? rtBody.catchUp : null;
  let state = null;
  if (!onButNotRunning) state = on ? (rtBody.state === undefined ? null : rtBody.state) : 'off';

  const view = {
    on,
    running,
    onButNotRunning,
    started,
    state,
    warnings: WARNINGS.filter((w) => rtBody[w] === true),
    countsSince,
    lastFigures: !on && started ? { updatedAt: rtBody.updatedAt === undefined ? null : rtBody.updatedAt } : null,
    counts,
    gauges: started ? { parked: num(rtBody.parked), pending: num(rtBody.pending) } : null,
    lastCatchUp: catchUp && isObject(catchUp.last) ? catchUp.last : null,
    setupProblemKey,
    lastError: isObject(rtBody.lastError) ? rtBody.lastError : null,
  };
  view.tone = pathTone(view);
  return view;
}

const SCHEDULE_TASK_ID = 'reconcileTaggingEdges';
const DAY_MINUTES = 1440;
// The last three fields of a 5- or 6-field cron (day of month, month, day of week) that mean "every".
const EVERY = ['*', '?', '*/1'];
const FULL_RANGE = [['1-31'], ['1-12'], ['0-6', '0-7', '1-7']];

/**
 * Is a (trimmed, non-blank) cron weaker than daily? ADR 0004's reading with no cron parser: @hourly and
 * @daily are not; a 5- or 6-field cron is not when each of its last three fields means "every"; any other
 * shape is. Some crons that do run daily (a list naming every day) are accepted false positives.
 */
function cronWeakerThanDaily(cron) {
  if (cron === '@hourly' || cron === '@daily') return false;
  const fields = cron.split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) return true;
  return !fields.slice(-3).every((f, i) => EVERY.includes(f) || FULL_RANGE[i].includes(f));
}

/** An interval in minutes as text, in the largest whole unit. */
function intervalText(minutes) {
  const every = (n, unit) => `every ${n} ${unit}${n === 1 ? '' : 's'}`;
  if (minutes > 0 && minutes % DAY_MINUTES === 0) return every(minutes / DAY_MINUTES, 'day');
  if (minutes > 0 && minutes % 60 === 0) return every(minutes / 60, 'hour');
  if (Number.isInteger(minutes)) return every(minutes, 'minute');
  const days = Math.floor(minutes / DAY_MINUTES);
  const hours = Math.floor((minutes % DAY_MINUTES) / 60);
  return `every ${days} days ${hours} hours ${minutes % 60} minutes`;
}

/**
 * The backstop schedule (AC-2; T4): the Scheduled Tasks entries that run the pass, split by `enabled === true`.
 * As in the scheduler, a non-blank cron wins and the interval fields are then ignored; a missing field reads as
 * 0. → { verdict: none | one | several, enabledCount, disabledCount, intervalText, nextRunAt, unscheduled,
 * weakerThanDaily, tone }, or null when the body is not a list.
 */
export function scheduleView(listBody) {
  if (!isObject(listBody) || !Array.isArray(listBody.entries)) return null;
  const entries = listBody.entries.filter((e) => isObject(e) && e.taskId === SCHEDULE_TASK_ID);
  const enabled = entries.filter((e) => e.enabled === true);
  const view = {
    verdict: enabled.length === 0 ? 'none' : enabled.length === 1 ? 'one' : 'several',
    enabledCount: enabled.length,
    disabledCount: entries.length - enabled.length,
    intervalText: null,
    nextRunAt: null,
    unscheduled: false,
    weakerThanDaily: false,
    tone: 'warn',
  };
  if (enabled.length !== 1) return view;

  const e = enabled[0];
  const cron = typeof e.cron === 'string' ? e.cron.trim() : '';
  if (cron !== '') {
    view.intervalText = cron;
    view.weakerThanDaily = cronWeakerThanDaily(cron);
  } else {
    const minutes = (Number(e.intervalDays) || 0) * DAY_MINUTES + (Number(e.intervalHours) || 0) * 60 + (Number(e.intervalMinutes) || 0);
    view.intervalText = intervalText(minutes);
    view.weakerThanDaily = minutes > DAY_MINUTES;
  }
  const next = isObject(e.timer) && typeof e.timer.nextRunAt === 'string' && e.timer.nextRunAt !== '' ? e.timer.nextRunAt : null;
  view.nextRunAt = next;
  view.unscheduled = next === null;
  view.tone = view.unscheduled || view.weakerThanDaily ? 'warn' : 'ok';
  return view;
}

/** A fresh unknown count per call, so a caller that changes a returned count changes no later result. */
const unknownCount = () => ({ known: false, code: null });
const isKnownCount = (c) => isObject(c) && c.known === true && num(c.count) !== null;
/** A server time as epoch ms, or null when it is not a string Date.parse reads. */
const instant = (t) => (typeof t === 'string' ? num(Date.parse(t)) : null);

/**
 * Drift between the relay and the graph, explained (AC-4; T5). `counts` is the drift-counts answer, or null
 * when that read failed (both counts then unknown). The difference is relay minus graph; the explained part
 * comes from the newest finished pass (its refused taggings, minus the removals it held, minus the
 * relationships it left in place); the remainder is "unexplained". An unknown count gives no difference,
 * never 0. What the pass left to the next one, and the path's refused looks and parked addresses, are named
 * beside the remainder and never subtracted. `countsPredatePass` is true when the earlier count was taken before
 * the explaining pass ended (server times only): the tone is then neutral, and the figures are still computed.
 */
export function driftView(counts, statusBody, rtBody) {
  const relay = isObject(counts) && isObject(counts.relay) ? counts.relay : unknownCount();
  const graph = isObject(counts) && isObject(counts.graph) ? counts.graph : unknownCount();
  const known = isKnownCount(relay) && isKnownCount(graph);
  const report = isObject(statusBody) ? statusBody : null;
  const pass = report ? newestFinishedPass(report) : null;

  const view = {
    known,
    relay,
    graph,
    difference: null,
    explained: null,
    unexplained: null,
    explainedReason: null,
    explainedBy: null,
    leftToNextPass: null,
    passRunning: !!report && report.running === true,
    newerUnfinished: false,
    countsPredatePass: false,
    pathRefusedLooks: null,
    parked: null,
    waitsForPass: false,
    pathUnknown: false,
    tone: 'warn',
  };

  if (pass) {
    view.leftToNextPass = sum(isObject(pass.relationships) ? pass.relationships.lostRace : null) + sum(pass.anomalies);
    // A record newer than the explaining pass that is not finished (a running one included) and reached its
    // plan phase may have written after it.
    const newestFirst = [report.latest].concat(Array.isArray(report.previous) ? report.previous : []);
    for (const r of newestFirst) {
      if (r === pass) break;
      const finished = isFinished(r) && !(r === report.latest && report.running === true);
      if (!finished && reachedPlan(r)) view.newerUnfinished = true;
    }
  }

  if (!isObject(rtBody)) view.pathUnknown = true;
  else if (rtBody.on === true) {
    view.pathRefusedLooks = isObject(rtBody.counts) && isObject(rtBody.counts.refused) ? num(rtBody.counts.refused.total) : null;
    view.parked = num(rtBody.parked);
  } else view.waitsForPass = true;

  if (!known) return view;
  view.difference = relay.count - graph.count;
  if (!pass) {
    view.explainedReason = report ? 'no-finished-pass' : 'report-unavailable';
    view.unexplained = view.difference;
    return view;
  }
  const rel = isObject(pass.relationships) ? pass.relationships : {};
  const refused = isObject(pass.refused) ? num(pass.refused.total) || 0 : 0;
  const held = isObject(pass.held) ? num(pass.held.total) || 0 : 0;
  view.explained = refused - held - (num(rel.leftInPlace) || 0);
  view.unexplained = view.difference - view.explained;
  view.explainedBy = { runId: pass.runId, endedAt: pass.endedAt, usedInsteadOfLatest: pass !== report.latest };
  // Counts taken before the explaining pass ended cannot be explained by it (T5). Server times only; a time that
  // does not parse gives false.
  const relayAt = instant(relay.takenAt);
  const graphAt = instant(graph.takenAt);
  const endedAt = instant(pass.endedAt);
  view.countsPredatePass = relayAt !== null && graphAt !== null && endedAt !== null && Math.min(relayAt, graphAt) < endedAt;
  if (view.countsPredatePass) view.tone = 'neutral';
  else view.tone = view.unexplained === 0 ? 'ok' : 'warn';
  return view;
}
