/**
 * Canonical list of Neo4j constraints and indexes that the Brainstorm schema
 * requires. Mirrors what setup/neo4jConstraintsAndIndexes.sh creates. Used by
 * the constraints-status handler to verify the database is ready before the UI
 * lets the user install firmware.
 *
 * If the setup script is updated, update this list too.
 */

const EXPECTED_CONSTRAINTS = [
    'nostrEvent_id',
    'nostrEvent_uuid',
    'nostrEventTag_uuid',
    'nostrUser_pubkey',
    'SetOfNostrUserWotMetricsCards_observee_pubkey',
    'nostrUserWotMetricsCard_unique_combination_1',
    'nostrUserWotMetricsCard_unique_combination_2',
];

const EXPECTED_INDEXES = [
    'nostrEvent_kind',
    'nostrUser_hops',
    'nostrUser_personalizedPageRank',
    'nostrUser_influence',
    'nostrUser_verifiedFollowerCount',
    'nostrUser_verifiedMuterCount',
    'nostrUser_verifiedReporterCount',
    'nostrUser_followerInput',
    'nostrUserWotMetricsCard_customer_id',
    'nostrUserWotMetricsCard_observer_pubkey',
    'nostrUserWotMetricsCard_observee_pubkey',
    'nostrUserWotMetricsCard_hops',
    'nostrUserWotMetricsCard_personalizedPageRank',
    'nostrUserWotMetricsCard_influence',
    'nostrUserWotMetricsCard_verifiedFollowerCount',
    'nostrUserWotMetricsCard_verifiedMuterCount',
    'nostrUserWotMetricsCard_verifiedReporterCount',
    'nostrUserWotMetricsCard_followerInput',
];

module.exports = {
    EXPECTED_CONSTRAINTS,
    EXPECTED_INDEXES,
};
