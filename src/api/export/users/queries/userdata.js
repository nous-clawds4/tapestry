/**
 * NostrUser Data Queries
 * Handles retrieval of individual NostrUser data from Neo4j
 * able to pull from NostrUser nodes or from NostrUserWotMetricsCard nodes depending on whether a valid observerPubkey is provided.
 */

const neo4j = require('neo4j-driver');
const { exec } = require('child_process');
const { getConfigFromFile } = require('../../../../utils/config');
const fs = require('fs');
const path = require('path');
const { nip19 } = require('nostr-tools');

/**
 * Get detailed data for a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function handleGetUserData(req, res) {
  try {
    // Get query parameters for filtering
    const pubkey = req.query.pubkey;

    let observerPubkey = req.query.observerPubkey || 'owner';

    if (!pubkey) {
      return res.status(400).json({ error: 'Missing pubkey parameter' });
    }

    // Use nip19 to validate pubkey
    const npub1 = nip19.npubEncode(pubkey);
    // if string does not start with 'npub'
    if (!npub1.startsWith('npub')) {
      return res.status(400).json({ error: 'Invalid pubkey parameter' });
    }

    // Get pubkey of the owner from brainstorm.conf
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '');

    let source = 'NostrUser'

    // If observerPubkey is set and is not owner, validate it
    if (observerPubkey && observerPubkey !== 'owner') {
      const npub2 = nip19.npubEncode(observerPubkey);
      if (!npub2.startsWith('npub')) {
        return res.status(400).json({ error: 'Invalid observerPubkey parameter' });
      }
      source = 'NostrUserWotMetricsCard'
    }

    // if no observerPubkey or if observerPubkey is 'owner', use owner pubkey
    if (!observerPubkey || observerPubkey === 'owner') {
      observerPubkey = ownerPubkey
    }
    
    // Create Neo4j driver
    const neo4jUri = getConfigFromFile('NEO4J_URI', 'bolt://localhost:7687');
    const neo4jUser = getConfigFromFile('NEO4J_USER', 'neo4j');
    const neo4jPassword = getConfigFromFile('NEO4J_PASSWORD', 'neo4j');
    const queryTimeoutMs = parseInt(getConfigFromFile('NEO4J_QUERY_TIMEOUT_MS', 15000), 10);

    const driver = neo4j.driver(
      neo4jUri,
      neo4j.auth.basic(neo4jUser, neo4jPassword)
    );

    const session = driver.session();

    let cypherQuery = `
    MATCH (u:NostrUser {pubkey: '${pubkey}'})
    MATCH (observer:NostrUser {pubkey: '${observerPubkey}'})
    `
    let nodeTrustScoreSource = ''
    let nodesToCarryWith = ''
    if (source === 'NostrUser') {
      nodeTrustScoreSource = 'u'
      nodesToCarryWith = 'u,'
    }
    if (source === 'NostrUserWotMetricsCard') {
      nodeTrustScoreSource = 'observeeCard'
      nodesToCarryWith = 'u, observeeCard, '
      cypherQuery += `
      MATCH (observeeCard:NostrUserWotMetricsCard {observer_pubkey: '${observerPubkey}', observee_pubkey: '${pubkey}'})
      `
    }
    ////////// Social Graph Analysis
    cypherQuery += `
      OPTIONAL MATCH (u)-[m3:FOLLOWS]->(fren:NostrUser)-[m4:FOLLOWS]->(u)
      WITH ${nodesToCarryWith} observer, count(fren) as frenCount

      OPTIONAL MATCH (groupie:NostrUser)-[m5:FOLLOWS]->(u)
      WHERE NOT (u)-[:FOLLOWS]->(groupie)
      WITH ${nodesToCarryWith} observer, frenCount, count(groupie) as groupieCount

      OPTIONAL MATCH (u)-[f2:FOLLOWS]->(idol:NostrUser)
      WHERE NOT (idol)-[:FOLLOWS]->(u)
      WITH ${nodesToCarryWith} observer, frenCount, groupieCount, count(idol) as idolCount
    `
    ////////// Mutuals: Social Graph Overlaps & Interactions
    cypherQuery += `
      OPTIONAL MATCH (u)-[m3:FOLLOWS]->(fren:NostrUser)-[m4:FOLLOWS]->(u)
      WHERE (fren)-[:FOLLOWS]->(observer)
      AND (observer)-[:FOLLOWS]->(fren)
      WITH ${nodesToCarryWith} observer, frenCount, groupieCount, idolCount, count(fren) as mutualFrenCount

      OPTIONAL MATCH (groupie:NostrUser)-[m5:FOLLOWS]->(u)
      WHERE NOT (u)-[:FOLLOWS]->(groupie)
      AND (groupie)-[:FOLLOWS]->(observer)
      AND NOT (observer)-[:FOLLOWS]->(groupie)
      WITH ${nodesToCarryWith} observer, frenCount, groupieCount, idolCount, mutualFrenCount, count(groupie) as mutualGroupieCount

      OPTIONAL MATCH (u)-[f2:FOLLOWS]->(idol:NostrUser)
      WHERE NOT (idol)-[:FOLLOWS]->(u)
      AND (observer)-[:FOLLOWS]->(idol)
      AND NOT (idol)-[:FOLLOWS]->(observer)
      WITH ${nodesToCarryWith} observer, frenCount, groupieCount, idolCount, mutualFrenCount, mutualGroupieCount, count(idol) as mutualIdolCount

      OPTIONAL MATCH (follower:NostrUser)-[f2:FOLLOWS]->(u)
      WHERE (follower)-[:FOLLOWS]->(observer)
      WITH ${nodesToCarryWith} observer, frenCount, groupieCount, idolCount, mutualFrenCount, mutualGroupieCount, mutualIdolCount, count(follower) as mutualFollowerCount

      OPTIONAL MATCH (u)-[f2:FOLLOWS]->(followee:NostrUser)
      WHERE (observer)-[:FOLLOWS]->(followee)
      WITH ${nodesToCarryWith} observer, frenCount, groupieCount, idolCount, mutualFrenCount, mutualGroupieCount, mutualIdolCount, mutualFollowerCount, count(followee) as mutualFollowCount
    `
    ////////// Recommendations 
    cypherQuery += `
      OPTIONAL MATCH (u)-[m3:FOLLOWS]->(recommendation:NostrUser)-[m4:FOLLOWS]->(u)
      WHERE (recommendation)-[:FOLLOWS]->(observer)
      AND NOT (observer)-[:FOLLOWS]->(recommendation)
      WITH ${nodesToCarryWith} observer, frenCount, groupieCount, idolCount, mutualFrenCount, mutualGroupieCount, mutualIdolCount, mutualFollowerCount, mutualFollowCount, count(recommendation) as recommendationsToObserverCount

      OPTIONAL MATCH (observer)-[m3:FOLLOWS]->(recommendation:NostrUser)-[m4:FOLLOWS]->(observer)
      WHERE (recommendation)-[:FOLLOWS]->(u)
      AND NOT (u)-[:FOLLOWS]->(recommendation)
      WITH ${nodesToCarryWith} observer, frenCount, groupieCount, idolCount, mutualFrenCount, mutualGroupieCount, mutualIdolCount, mutualFollowerCount, mutualFollowCount, recommendationsToObserverCount, count(recommendation) as recommendationsFromObserverCount
    `
    
    cypherQuery += `
    RETURN u.pubkey as pubkey,
    u.npub as npub,
    u.followerCount as followerCount,
    u.muterCount as muterCount,
    u.reporterCount as reporterCount,
    u.followingCount as followingCount,
    u.mutingCount as mutingCount,
    u.reportingCount as reportingCount,
    ${nodeTrustScoreSource}.personalizedPageRank as personalizedPageRank,
    ${nodeTrustScoreSource}.hops as hops,
    ${nodeTrustScoreSource}.influence as influence,
    ${nodeTrustScoreSource}.average as average,
    ${nodeTrustScoreSource}.confidence as confidence,
    ${nodeTrustScoreSource}.input as input,
    ${nodeTrustScoreSource}.verifiedFollowerCount as verifiedFollowerCount,
    ${nodeTrustScoreSource}.verifiedMuterCount as verifiedMuterCount,
    ${nodeTrustScoreSource}.verifiedReporterCount as verifiedReporterCount,
    ${nodeTrustScoreSource}.followerInput as followerInput,
    ${nodeTrustScoreSource}.muterInput as muterInput,
    ${nodeTrustScoreSource}.reporterInput as reporterInput,
    frenCount,
    groupieCount,
    idolCount,
    mutualFrenCount,
    mutualGroupieCount,
    mutualIdolCount,
    mutualFollowerCount,
    mutualFollowCount,
    recommendationsToObserverCount,
    recommendationsFromObserverCount
    `
    
    // Execute the query with a driver-layer deadline so a runaway Cypher
    // (e.g. high-fanout pubkeys whose follow/follower expansion is unbounded —
    // see story #6) fails fast with a 504 instead of hanging the nginx upstream.
    const queryStartMs = Date.now();
    session.run(cypherQuery, {}, { timeout: queryTimeoutMs })
      .then(result => {
        if (result.records.length === 0) {
          return res.json({
            success: false,
            message: 'No profile data found for this user'
          });
        }
        const user = result.records[0];
        
        let isUserInNeo4j = true
        let userData = {}
        if (!user) {
          isUserInNeo4j = false;
          userData = {
            pubkey: pubkey,
            npub: npub,
            followerCount: null,
            muterCount: null,
            reporterCount: null,
            followingCount: null,
            mutingCount: null,
            reportingCount: null,
            personalizedPageRank: null,
            hops: null,
            influence: null,
            average: null,
            confidence: null,
            input: null,
            verifiedFollowerCount: null,
            verifiedMuterCount: null,
            verifiedReporterCount: null,
            followerInput: null,
            muterInput: null,
            reporterInput: null,
            frenCount: null,
            groupieCount: null,
            idolCount: null,
            mutualFrenCount: null,
            mutualGroupieCount: null,
            mutualIdolCount: null,
            mutualFollowerCount: null,
            mutualFollowCount: null,
            recommendationsToObserverCount: null,
            recommendationsFromObserverCount: null
          }
        } else {
          userData = {
            pubkey: user.get('pubkey') ? user.get('pubkey') : null,
            npub: user.get('npub') ? user.get('npub') : null,
            followerCount: user.get('followerCount') ? parseInt(user.get('followerCount').toString()) : 0,
            muterCount: user.get('muterCount') ? parseInt(user.get('muterCount').toString()) : 0,
            reporterCount: user.get('reporterCount') ? parseInt(user.get('reporterCount').toString()) : 0,
            followingCount: user.get('followingCount') ? parseInt(user.get('followingCount').toString()) : 0,
            mutingCount: user.get('mutingCount') ? parseInt(user.get('mutingCount').toString()) : 0,
            reportingCount: user.get('reportingCount') ? parseInt(user.get('reportingCount').toString()) : 0,
            personalizedPageRank: user.get('personalizedPageRank') ? parseFloat(user.get('personalizedPageRank').toString()) : null,
            hops: user.get('hops') ? parseInt(user.get('hops').toString()) : null,
            influence: user.get('influence') ? parseFloat(user.get('influence').toString()) : null,
            average: user.get('average') ? parseFloat(user.get('average').toString()) : null,
            confidence: user.get('confidence') ? parseFloat(user.get('confidence').toString()) : null,
            input: user.get('input') ? parseFloat(user.get('input').toString()) : null,
            verifiedFollowerCount: user.get('verifiedFollowerCount') ? parseInt(user.get('verifiedFollowerCount').toString()) : null,
            verifiedMuterCount: user.get('verifiedMuterCount') ? parseInt(user.get('verifiedMuterCount').toString()) : null,
            verifiedReporterCount: user.get('verifiedReporterCount') ? parseInt(user.get('verifiedReporterCount').toString()) : null,
            followerInput: user.get('followerInput') ? parseFloat(user.get('followerInput').toString()) : null,
            muterInput: user.get('muterInput') ? parseFloat(user.get('muterInput').toString()) : null,
            reporterInput: user.get('reporterInput') ? parseFloat(user.get('reporterInput').toString()) : null,
            frenCount: user.get('frenCount') ? parseInt(user.get('frenCount').toString()) : null,
            groupieCount: user.get('groupieCount') ? parseInt(user.get('groupieCount').toString()) : null,
            idolCount: user.get('idolCount') ? parseInt(user.get('idolCount').toString()) : null,
            mutualFrenCount: user.get('mutualFrenCount') ? parseInt(user.get('mutualFrenCount').toString()) : null,
            mutualGroupieCount: user.get('mutualGroupieCount') ? parseInt(user.get('mutualGroupieCount').toString()) : null,
            mutualIdolCount: user.get('mutualIdolCount') ? parseInt(user.get('mutualIdolCount').toString()) : null,
            mutualFollowerCount: user.get('mutualFollowerCount') ? parseInt(user.get('mutualFollowerCount').toString()) : null,
            mutualFollowCount: user.get('mutualFollowCount') ? parseInt(user.get('mutualFollowCount').toString()) : null,
            recommendationsToObserverCount: user.get('recommendationsToObserverCount') ? parseInt(user.get('recommendationsToObserverCount').toString()) : null,
            recommendationsFromObserverCount: user.get('recommendationsFromObserverCount') ? parseInt(user.get('recommendationsFromObserverCount').toString()) : null
          }
        }
      
        // clean up cypherQuery = cypherQuery.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        const cypherQueryCleaned = cypherQuery.replace(/\n/g, ' ').replace(/\s+/g, ' ').replaceAll('\u003E', '>').replaceAll('\u003C', '<');
        const apiResponse = {
          success: true,
          isUserInNeo4j,
          metaData: {
            pubkey: pubkey,
            observerPubkey: observerPubkey,
            query: cypherQueryCleaned
          },
          data: userData
        };
        res.status(200).json(apiResponse);
      })
      .catch(error => {
        const elapsedMs = Date.now() - queryStartMs;
        const isTimeout = error && typeof error.code === 'string' && /TransactionTimedOut/i.test(error.code);
        if (isTimeout) {
          console.error('Neo4j query timeout fetching user data:', { pubkey, observerPubkey, elapsedMs, limitMs: queryTimeoutMs, code: error.code });
          return res.status(504).json({
            success: false,
            message: `Neo4j query timeout after ${elapsedMs}ms (limit ${queryTimeoutMs}ms). The user-data query is unbounded for this pubkey; see story #6 for the planned Cypher fix.`
          });
        }
        console.error('Error fetching user data:', error);
        res.status(500).json({
          success: false,
          query,
          message: `Error fetching user data: ${error.message}`
        });
      })
      .finally(() => {
        session.close();
        driver.close();
      });
  } catch (error) {
    console.error('Error in handleGetUserData:', error);
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
}

/**
 * Get count metrics for a user that can be derived directly from strfry.
 *
 * Currently returns just `followingCount`, computed as the number of `p` tags
 * on the user's most recent kind 3 event. Reads from strfry rather than from
 * the precomputed `NostrUser.followingCount` property because the property is
 * batch-recomputed by calculateFollowingCounts.sh and can lag the kind 3 event
 * by hours/days. The kind 3 event is the source of truth.
 *
 * Other counts (followerCount, verifiedFollowerCount, etc.) require either
 * inverse strfry scans (slow) or Neo4j (stale + dependent on graph crawl), so
 * they're not included here. If we need them later, this endpoint can grow
 * a hybrid implementation: strfry for follow*, Neo4j for the WoT-derived counts.
 */
function handleGetUserCounts(req, res) {
  const pubkey = req.query.pubkey;
  if (!pubkey) {
    return res.status(400).json({ success: false, error: 'Missing pubkey parameter' });
  }
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
    return res.status(400).json({ success: false, error: 'Invalid pubkey parameter' });
  }

  const filter = JSON.stringify({ kinds: [3], authors: [pubkey], limit: 1 });
  const cmd = `strfry scan '${filter}'`;

  exec(cmd, { maxBuffer: 16 * 1024 * 1024 }, async (error, stdout) => {
    if (error) {
      console.error('handleGetUserCounts strfry scan error:', error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    let followingCount = null;
    for (const line of stdout.trim().split('\n')) {
      if (!line) continue;
      try {
        const event = JSON.parse(line);
        if (Array.isArray(event.tags)) {
          followingCount = event.tags.filter(t => Array.isArray(t) && t[0] === 'p').length;
        }
        break;
      } catch {
        // skip strfry log lines
      }
    }

    // Owner-PoV verified counts from Neo4j (ADR 0031, the "hybrid" this endpoint's
    // docstring anticipated). Prefer the precomputed NostrUser node property (O(1));
    // when null, fall back to a count-only live query bounded by NEO4J_QUERY_TIMEOUT_MS
    // → null on timeout/error (renders "—"), NEVER raw followers. Same edges + cutoffs
    // as the /followers and /reporters tables, so badge ≡ table definition.
    let verifiedFollowerCount = null;
    let verifiedMuterCount = null;
    let verifiedReporterCount = null;
    const neo4jUri = getConfigFromFile('NEO4J_URI', 'bolt://localhost:7687');
    const neo4jUser = getConfigFromFile('NEO4J_USER', 'neo4j');
    const neo4jPassword = getConfigFromFile('NEO4J_PASSWORD', 'neo4j');
    const queryTimeoutMs = parseInt(getConfigFromFile('NEO4J_QUERY_TIMEOUT_MS', 15000), 10);
    const vfCutoff = parseFloat(getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', 0.05));
    const vmCutoff = parseFloat(getConfigFromFile('VERIFIED_MUTERS_INFLUENCE_CUTOFF', 0.05));
    const vrCutoff = parseFloat(getConfigFromFile('VERIFIED_REPORTERS_INFLUENCE_CUTOFF', 0.05));
    const toInt = (v) => {
      if (v == null) return null;
      if (typeof v.toNumber === 'function') return v.toNumber();
      if (typeof v === 'object' && typeof v.low === 'number') return v.low;
      const n = parseInt(v.toString(), 10);
      return Number.isNaN(n) ? null : n;
    };
    const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
    const session = driver.session();
    try {
      // 1) Precomputed Owner node properties (cheap, O(1)).
      const propRes = await session.run(
        'MATCH (u:NostrUser {pubkey: $pubkey}) RETURN u.verifiedFollowerCount AS vfc, u.verifiedMuterCount AS vmc, u.verifiedReporterCount AS vrc',
        { pubkey },
        { timeout: queryTimeoutMs }
      );
      if (propRes.records.length > 0) {
        verifiedFollowerCount = toInt(propRes.records[0].get('vfc'));
        verifiedMuterCount = toInt(propRes.records[0].get('vmc'));
        verifiedReporterCount = toInt(propRes.records[0].get('vrc'));
      }
      // 2) Count-only live fallback when a property is absent (deadline-bounded; null on
      //    timeout/error so the badge shows "—" — never a raw/other-metric substitution).
      if (verifiedFollowerCount == null) {
        try {
          const vfRes = await session.run(
            'MATCH (f:NostrUser)-[:FOLLOWS]->(u:NostrUser {pubkey: $pubkey}) WHERE f.influence > $cutoff RETURN count(f) AS c',
            { pubkey, cutoff: vfCutoff },
            { timeout: queryTimeoutMs }
          );
          verifiedFollowerCount = vfRes.records.length ? toInt(vfRes.records[0].get('c')) : 0;
        } catch (e) {
          console.error('handleGetUserCounts verifiedFollowerCount fallback failed:', e.message);
          verifiedFollowerCount = null;
        }
      }
      if (verifiedMuterCount == null) {
        try {
          const vmRes = await session.run(
            'MATCH (m:NostrUser)-[:MUTES]->(u:NostrUser {pubkey: $pubkey}) WHERE m.influence > $cutoff RETURN count(m) AS c',
            { pubkey, cutoff: vmCutoff },
            { timeout: queryTimeoutMs }
          );
          verifiedMuterCount = vmRes.records.length ? toInt(vmRes.records[0].get('c')) : 0;
        } catch (e) {
          console.error('handleGetUserCounts verifiedMuterCount fallback failed:', e.message);
          verifiedMuterCount = null;
        }
      }
      if (verifiedReporterCount == null) {
        try {
          const vrRes = await session.run(
            'MATCH (u:NostrUser {pubkey: $pubkey})<-[:REPORTS]-(r:NostrUser) WHERE r.influence > $cutoff RETURN count(r) AS c',
            { pubkey, cutoff: vrCutoff },
            { timeout: queryTimeoutMs }
          );
          verifiedReporterCount = vrRes.records.length ? toInt(vrRes.records[0].get('c')) : 0;
        } catch (e) {
          console.error('handleGetUserCounts verifiedReporterCount fallback failed:', e.message);
          verifiedReporterCount = null;
        }
      }
    } catch (e) {
      console.error('handleGetUserCounts Neo4j read failed:', e.message);
      // Leave verified counts null → "—"; Following (strfry) is still returned.
    } finally {
      await session.close();
      await driver.close();
    }

    res.status(200).json({
      success: true,
      data: { pubkey, followingCount, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount }
    });
  });
}

module.exports = {
  handleGetUserData,
  handleGetUserCounts
};