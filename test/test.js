/**
 * Brainstorm test entry point. Runs in two phases:
 *   1. Hand-rolled smoke tests (config loading).
 *   2. Story-scoped test suites under test/*.test.js.
 *
 * Exit code is 0 only if every phase passes.
 */

const { loadConfig } = require('../lib/config');

// Mock environment variables for the config smoke check
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';

function testConfigLoading() {
  try {
    const config = loadConfig();
    console.log('Configuration loaded successfully:', Object.keys(config));
    return true;
  } catch (error) {
    console.error('Configuration loading failed:', error.message);
    return false;
  }
}

// Tag-stack suites (from feat/pubkey-tagging-target)
const profileTags = require('./profile-tags.test.js');
const profileTagsPublish = require('./profile-tags-publish.test.js');
const tagDetail = require('./tag-detail.test.js');
const tagDetailPublish = require('./tag-detail-publish.test.js');
const tagDetailWrite = require('./tag-detail-write.test.js');
const tagDetailWritePublish = require('./tag-detail-write-publish.test.js');
const tagIndex = require('./tag-index.test.js');
const tagIndexPublish = require('./tag-index-publish.test.js');
const authoredTagging = require('./authored-tagging.test.js');
const authoredTaggingPublish = require('./authored-tagging-publish.test.js');
const profileTagPolish = require('./profile-tag-polish.test.js');
const profileTagPolishPublish = require('./profile-tag-polish-publish.test.js');
const searchResultParity = require('./search-result-parity.test.js');
const searchResultsUrl = require('./search-results-url.test.js');
const pinATag = require('./pin-a-tag.test.js');
const pinATagPublish = require('./pin-a-tag-publish.test.js');
const tlPubFromPins = require('./tl-publication-from-pins.test.js');
const tlPubFromPinsPublish = require('./tl-publication-from-pins-publish.test.js');
const customizePinCurationPublish = require('./customize-pin-curation-publish.test.js');
const mostPinnedTagIndex = require('./most-pinned-tag-index.test.js');
const mostPinnedTagIndexPublish = require('./most-pinned-tag-index-publish.test.js');
const tagDetailCurated = require('./tag-detail-curated-view-and-pin-polish.test.js');
const tagDetailCuratedPublish = require('./tag-detail-curated-view-and-pin-polish-publish.test.js');
const restoreHistoricalDataAndTlFilter = require('./restore-historical-data-and-fix-tl-author-filter.test.js');
// Suites added on main since this branch forked
const treasureMaps = require('./treasure-maps-router-preset.test.js');
const scheduledRefresh = require('./scheduled-search-and-house-scores-refresh.test.js');
const strfryRouterFirstBoot = require('./strfry-router-first-boot-config.test.js');
const perQueryNeo4jTimeout = require('./per-query-neo4j-timeout-safety-net.test.js');
const nip05CheckmarkVerification = require('./nip05-checkmark-verification.test.js');
const publishExportConcept = require('./publish-export-a-concept.test.js');
const communityReferenceStub = require('./community-reference-nostr-relay-stub.test.js');
const nip51ListExport = require('./nip51-list-export-from-pins.test.js');
const nip51ListExportPublish = require('./nip51-list-export-from-pins-publish.test.js');
const pinDetailIntoTagTab = require('./pin-detail-into-tag-pinned-tab.test.js');
const collapseIntoExport = require('./collapse-into-export-concept.test.js');
const loginFailureAndTagCollapse = require('./login-failure-and-tag-collapse.test.js');
const headerConceptGraphTag = require('./header-conceptgraph-tag.test.js');
const communityReferenceSupersetLink = require('./community-reference-superset-link.test.js');
const graperankSharedCsvRace = require('./graperank-shared-csv-race.test.js');
const communityClassThreadPull = require('./community-class-thread-pull.test.js');
const taskQueueBullmq = require('./task-queue-bullmq.test.js');
const taskQueueNeo4jResourceClass = require('./task-queue-neo4j-resource-class.test.js');
const entrypointTemplateRendering = require('./entrypoint-template-rendering.test.js');
const bullboardAdminAccess = require('./bullboard-admin-access.test.js');
const adminToolsDashboardPanel = require('./admin-tools-dashboard-panel.test.js');
const createTapestry = require('./create-tapestry.test.js');
const reconciliationIncrementalMode = require('./reconciliation-incremental-mode.test.js');
const generalizedTaskScheduler = require('./generalized-task-scheduler.test.js');
const reconciliationRearchitecture = require('./reconciliation-rearchitecture.test.js');
const scheduledTasksWithArguments = require('./scheduled-tasks-with-arguments.test.js');
const manualTaskRetriggerAfterFinish = require('./manual-task-retrigger-after-finish.test.js');
const scheduledTaskTimeoutPropagation = require('./scheduled-task-timeout-propagation.test.js');
const killTimeoutOrphansByDefault = require('./kill-timeout-orphans-by-default.test.js');
const taskQueueSemaphoreProtectionAudit = require('./task-queue-semaphore-protection-audit.test.js');
const profileFollowsList = require('./profile-follows-list.test.js');
const profileWebsiteLink = require('./profile-website-link.test.js');
const profileVerifiedFollowersCount = require('./profile-verified-followers-count.test.js');
const profileFollowersList = require('./profile-followers-list.test.js');
const profileVerifiedReportersCount = require('./profile-verified-reporters-count.test.js');
const verifiedReportersMembershipData = require('./verified-reporters-membership-data.test.js');
const verifiedReportersListPage = require('./verified-reporters-list-page.test.js');
const profileVerifiedCountsOwnerPov = require('./profile-verified-counts-owner-pov.test.js');
const profileVerifiedCountsExplainerAndAlarm = require('./profile-verified-counts-explainer-and-alarm.test.js');
const searchApiResultTypeSettings = require('./search-api-result-type-settings.test.js');
const trustedListPinPublishBlockers = require('./trusted-list-pin-publish-blockers.test.js');
const nostrUserTagHybridEaWriter = require('./nostr-user-tag-hybrid-ea-writer.test.js');
const reputationInfoPopup = require('./reputation-info-popup.test.js');
const liveFeedReadPath = require('./live-feed-read-path.test.js');
const stackFreeNpmTest = require('./stack-free-npm-test.test.js');
const ciTestJob = require('./ci-test-job.test.js');
const syncPanelTagFilters = require('./sync-panel-tag-filters.test.js');
const routerStreamTagFilters = require('./router-stream-tag-filters.test.js');
const liveFeedFeedPage = require('./live-feed-feed-page.test.js');
const noteSurfacesReadPath = require('./note-surfaces-read-path.test.js');
const noteSurfacesUi = require('./note-surfaces-ui.test.js');
const eventPageReadPath = require('./event-page-read-path.test.js');
const eventPageUi = require('./event-page-ui.test.js');
const verifiedReportersReportColumns = require('./verified-reporters-report-columns.test.js');
const profileIdentityDetailsPopover = require('./profile-identity-details-popover.test.js');
const profileFollowsHops = require('./profile-follows-hops.test.js');
const profileHopsPath = require('./profile-hops-path.test.js');
const tagReadUnion = require('./tag-read-union.test.js');
const bTagPrimitive = require('./b-tag-primitive.test.js');
const bTagSeeds = require('./b-tag-seeds.test.js');
const dualZWriter = require('./dual-z-writer.test.js');
const openRankingStats = require('./open-ranking-stats.test.js');
const openRankingSearch = require('./open-ranking-search.test.js');
const openRankingRank = require('./open-ranking-rank.test.js');
const openRankingFollowersMuters = require('./open-ranking-followers-muters.test.js');
const verifiedMutersReadApi = require('./verified-muters-read-api.test.js');
const verifiedMutersProfileSurface = require('./verified-muters-profile-surface.test.js');
// epic: event-tagging — Story 1 (protocol core + spec)
const eventTaggingCore = require('./event-tagging-core.test.js');
const eventTaggingSpec = require('./event-tagging-spec.test.js');
const globalPublishGate = require('./global-publish-gate.test.js');
const eventTaggingFirmwareSeed = require('./event-tagging-firmware-seed.test.js');
const eventTaggingReadApi = require('./event-tagging-read-api.test.js');
const eventTaggingWritePath = require('./event-tagging-write-path.test.js');
const eventTaggingReadViewerStance = require('./event-tagging-read-viewer-stance.test.js');
const eventTagNoteAffordanceUi = require('./event-tag-note-affordance-ui.test.js');
const tagActionsMenuUi = require('./tag-actions-menu-ui.test.js');
const taggingRawEventInspectorUi = require('./tagging-raw-event-inspector-ui.test.js');
const noteTaggingRawEventsInspectorUi = require('./note-tagging-raw-events-inspector-ui.test.js');
const noteTaggingRawEventsInspectorHttp = require('./note-tagging-raw-events-inspector-http.test.js');
const eventTaggingForTag = require('./event-tagging-for-tag.test.js');
const unifiedTagIndex = require('./unified-tag-index.test.js');
const eventTaggingNotesByAuthor = require('./event-tagging-notes-by-author.test.js');
const unifiedTagsDirectory = require('./unified-tags-directory.test.js');
const profileAuthoredNotesUi = require('./profile-authored-notes-ui.test.js');
// epic: feed-usability — Story 1 (notes/replies toggle)
const notesRepliesToggle = require('./notes-replies-toggle.test.js');
// epic: feed-usability — Story 2 (load-more pagination)
const feedPagination = require('./feed-pagination.test.js');
// epic: feed-usability — Story 3 (pinned-note-aware Content card)
const profileContentCard = require('./profile-content-card.test.js');
// epic: tag-applicability — Story 1 (z-hints + applicability TLs)
const tagApplicability = require('./tag-applicability.test.js');
// epic: tag-applicability — Story 2 (type-aware picker + scheduled regen)
const tagApplicabilityPicker = require('./tag-applicability-picker.test.js');
// epic: event-tagging — Story 17 (TA-signed note Trusted List, issue #336)
const noteTrustedList = require('./note-trusted-list.test.js');
const profileTagConsumeByA = require('./profile-tag-consume-by-a-coordinate.test.js');
const povSelectableTagSurfaces = require('./pov-selectable-tag-surfaces.test.js');
const povResolutionStatus = require('./pov-resolution-status.test.js');
const povRankThresholdKey = require('./pov-rank-threshold-key.test.js');
const povNoticeText = require('./pov-notice-text.test.js');
const povStateUnification = require('./pov-state-unification.test.js');
// epic: tag-applicability — Story 4 (event-driven applicability republish)
const applicabilityRepublish = require('./applicability-republish.test.js');
const harnessLint = require('./harness-lint.test.js');
const harnessStats = require('./harness-stats.test.js');
const sessionStart = require('./session-start.test.js');
// epic: deploy-safety-gate — Story 1 (status endpoint + pure verdict core)
const deploySafetyStatus = require('./deploy-safety-status.test.js');
// epic: deploy-safety-gate — Story 2 (safe-to-merge check script + shared recipe)
const safeToMergeCheck = require('./safe-to-merge-check.test.js');
// epic: deploy-safety-gate — Story 3 (Scheduled Tasks panel aggregate countdown)
const nextTaskCountdown = require('./next-task-countdown.test.js');
const closeUnauthWriteSurface = require('./close-unauth-write-surface.test.js');
const defaultDenyMutations = require('./default-deny-mutations.test.js');
// bug: users page called the removed run-query endpoint (regression guard).
const usersPageNeo4jEndpoint = require('./users-page-neo4j-endpoint.test.js');
// security follow-up: strfry/wipe owner-gate (audit 2026-07-21).
const strfryWipeOwnerGate = require('./strfry-wipe-owner-gate.test.js');
// epic: relationship-primitives — Story 1 (strfry-free relationship add/delete primitives).
const relationshipPrimitives = require('./relationship-primitives.test.js');
// epic: relationship-primitives — Story 2 (read-only deployment probe).
const relationshipPrimitivesProbe = require('./relationship-primitives-probe.test.js');
// epic: test-suite-hermeticity — Story 1 (author-scoped strfry write-assertion brackets).
const strfryWriteAssertionBracket = require('./strfry-write-assertion-bracket.test.js');
// epic: graph-curation-ui — Story 1 (place/move nodes between sets from the concept pages).
const moveNodesBetweenSetsUi = require('./move-nodes-between-sets-ui.test.js');
// epic: second-brain — Story 1 (capture a goal and see it).
const captureAGoalAndSeeIt = require('./capture-a-goal-and-see-it.test.js');
const firmwareConceptElementsSets = require('./firmware-concept-elements-sets.test.js');
// epic: tapestries — Story 4 (per-concept detail views, Neo4j+LMDB read path).
const tapestryPerConceptDetailViews = require('./tapestry-per-concept-detail-views.test.js');
// epic: second-brain — Story 2 (hygiene check + primary-property reconcile).
const structuresTheBrainCanTrust = require('./structures-the-brain-can-trust.test.js');
// epic: second-brain — Story 3 (break a goal into pieces — decomposition).
const breakAGoalIntoPieces = require('./break-a-goal-into-pieces.test.js');
// epic: second-brain — Story 4 (attach the world — pointers + one-spine detail).
const attachTheWorld = require('./attach-the-world.test.js');
// epic: second-brain — Story 5 (sessions read the brain — work records + orient).
const sessionsReadTheBrain = require('./sessions-read-the-brain.test.js');
const theProposalLoop = require('./the-proposal-loop.test.js');
const teachItWhatMatters = require('./teach-it-what-matters.test.js');
const theBrainSurvives = require('./the-brain-survives.test.js');
// epic: operational-direction — Story 1 (goal-derived Director run terms).
const operationalDirection = require('./operational-direction.test.js');
// epic: goal-intent-fields — Story 1 (store the four when a goal is captured or updated).
const storeTheFour = require('./store-the-four-when-a-goal-is-captured-or-updated.test.js');
// epic: goal-intent-fields — Story 2 (return the four on every read surface).
const returnTheFour = require('./return-the-four-on-every-read-surface.test.js');
// epic: goal-intent-fields — Story 3 (show the four on the goal screens that already exist).
const showTheFour = require('./show-the-four-on-the-goal-screens-that-already-exist.test.js');
// bug — tapestry-key handlePut must await the async LMDB write (regression guard).
const tapestryKeyPutAwait = require('./tapestry-key-put-await.test.js');
// epic: tapestries — Story 5 (add a concept to a tapestry — add-only, same-coordinate republish).
const addConceptToTapestry = require('./add-a-concept-to-a-tapestry.test.js');
// epic: tapestries — Story 6 (take a concept back out — remove-only, same-coordinate republish).
const takeAConceptBackOut = require('./take-a-concept-back-out.test.js');
// epic: tapestries — Story 7 (brain-first tapestry authoring — publish-hook dual write).
const brainFirstTapestryAuthoring = require('./brain-first-tapestry-authoring.test.js');
// epic: ta-avatar — Story 1 (in-app badged TA avatar). S/R source class; the ACs
// themselves are settled by the browser class, tests/brainstorm/ta-badged-avatar.spec.js.
const inAppBadgedTaAvatar = require('./in-app-badged-ta-avatar.test.js');
// epic: ta-avatar — Story 2 (recognizable published TA profile defaults). A/U/S are
// stack-free; the H class asserts one invariant whose branch is chosen by whether the
// instance under test has a publicly reachable address.
const recognizablePublishedTaProfile = require('./recognizable-published-ta-profile.test.js');
// epic: ta-avatar — Story 3 (the stamped composite). U/S are stack-free; the H class
// SKIPs unless the reachable instance actually serves this story. AC1's preview and the
// composite geometry are settled by tests/brainstorm/ta-composite-avatar.spec.js.
const stampedCompositeAvatar = require('./stamped-composite-avatar.test.js');
// epic: shared-concepts-adoption — Story 1 (b-coverage audit + guided disposition).
const bCoverageAuditAndDisposition = require('./b-coverage-audit-and-disposition.test.js');
// epic: shared-concepts-adoption — Story 2 (adoption-candidates queue).
const adoptionCandidatesQueue = require('./adoption-candidates-queue.test.js');
// epic: shared-concepts-adoption — Story 3 (inverse queue — publish candidates).
const inverseQueuePublishCandidates = require('./inverse-queue-publish-candidates.test.js');
// epic: shared-concepts-adoption — Story 4 (publish-time default stamping).
const publishTimeDefaultStamping = require('./publish-time-default-stamping.test.js');
// epic: shared-concepts-adoption — Story 5 (trusted dictionary).
const trustedDictionary = require('./trusted-dictionary.test.js');
// epic: shared-concepts-adoption — Story 7 (graph-derived twin picker).
const adoptionTwins = require('./adoption-twins.test.js');
// epic: shared-concepts-adoption — Story 9 (clickable rows → raw header event).
const adoptionRawEventView = require('./adoption-raw-event-view.test.js');
// epic: shared-concepts-legibility — Story 1 (sharing state on the concept page).
const stateOnConceptPage = require('./state-on-concept-page.test.js');
// epic: shared-concepts-legibility — Story 2 (my offerings: local ∪ relay).
const sharedByMe = require('./shared-by-me.test.js');
// epic: shared-concepts-seeding — Story 2 (retire the offering vocabulary).
const retireOfferingVocabulary = require('./retire-offering-vocabulary.test.js');
const siteTrustSignals = require('./site-trust-signals.test.js');
// epic: shared-concepts-seeding — Story 1 (honest broadcast reporting).
const honestBroadcastReporting = require('./honest-broadcast-reporting.test.js');
// epic: shared-concepts-seeding — Story 3 (not-yet-shared filter on the Concepts list).
const notYetSharedFilter = require('./not-yet-shared-filter.test.js');
// epic: shared-concepts-seeding — Story 4 (route from Shared by me to the not-yet-shared list).
const shareFromSharedByMe = require('./share-from-shared-by-me.test.js');

async function main() {
  console.log('Running Brainstorm tests...');

  const configOk = testConfigLoading();
  console.log(`Configuration Loading: ${configOk ? 'PASS' : 'FAIL'}`);

  const profileTagsResult = await profileTags.run();
  const publishResult = await profileTagsPublish.run();
  const tagDetailResult = await tagDetail.run();
  const tagDetailPublishResult = await tagDetailPublish.run();
  const tagDetailWriteResult = await tagDetailWrite.run();
  const tagDetailWritePublishResult = await tagDetailWritePublish.run();
  const tagIndexResult = await tagIndex.run();
  const tagIndexPublishResult = await tagIndexPublish.run();
  const authoredTaggingResult = await authoredTagging.run();
  const authoredTaggingPublishResult = await authoredTaggingPublish.run();
  const profileTagPolishResult = await profileTagPolish.run();
  const profileTagPolishPublishResult = await profileTagPolishPublish.run();
  const searchResultParityResult = await searchResultParity.run();
  const searchResultsUrlResult = await searchResultsUrl.run();
  const pinATagResult = await pinATag.run();
  const pinATagPublishResult = await pinATagPublish.run();
  const tlPubFromPinsResult = await tlPubFromPins.run();
  const tlPubFromPinsPublishResult = await tlPubFromPinsPublish.run();
  const customizePinCurationPublishResult = await customizePinCurationPublish.run();
  const mostPinnedTagIndexResult = await mostPinnedTagIndex.run();
  const mostPinnedTagIndexPublishResult = await mostPinnedTagIndexPublish.run();
  const tagDetailCuratedResult = await tagDetailCurated.run();
  const tagDetailCuratedPublishResult = await tagDetailCuratedPublish.run();
  const restoreHistoricalDataAndTlFilterResult = await restoreHistoricalDataAndTlFilter.run();

  // Main-side suites — these don't print their own banner, so we announce
  // each one before running.
  console.log('\ntreasure-maps-router-preset suite:');
  const treasureMapsResult = await treasureMaps.run();
  console.log('\nscheduled-search-and-house-scores-refresh suite:');
  const scheduledRefreshResult = await scheduledRefresh.run();
  console.log('\nstrfry-router-first-boot-config suite:');
  const strfryRouterFirstBootResult = await strfryRouterFirstBoot.run();
  console.log('\nper-query-neo4j-timeout-safety-net suite:');
  const perQueryNeo4jTimeoutResult = await perQueryNeo4jTimeout.run();

  console.log('\nnip05-checkmark-verification suite:');
  const nip05CheckmarkVerificationResult = await nip05CheckmarkVerification.run();

  console.log('\npublish-export-a-concept suite:');
  const publishExportConceptResult = await publishExportConcept.run();

  console.log('\ncommunity-reference-nostr-relay-stub suite:');
  const communityReferenceStubResult = await communityReferenceStub.run();

  const nip51ListExportResult = await nip51ListExport.run();
  console.log('\nnip51-list-export-from-pins publish-flow suite:');
  const nip51ListExportPublishResult = await nip51ListExportPublish.run();
  const pinDetailIntoTagTabResult = await pinDetailIntoTagTab.run();
  const collapseIntoExportResult = await collapseIntoExport.run();
  const loginFailureAndTagCollapseResult = await loginFailureAndTagCollapse.run();

  console.log('\nheader-conceptgraph-tag suite:');
  const headerConceptGraphTagResult = await headerConceptGraphTag.run();

  console.log('\ncommunity-reference-superset-link suite:');
  const communityReferenceSupersetLinkResult = await communityReferenceSupersetLink.run();

  console.log('\ngraperank-shared-csv-race suite:');
  const graperankSharedCsvRaceResult = await graperankSharedCsvRace.run();

  console.log('\ncommunity-class-thread-pull suite:');
  const communityClassThreadPullResult = await communityClassThreadPull.run();

  console.log('\ntask-queue-bullmq suite:');
  const taskQueueBullmqResult = await taskQueueBullmq.run();

  console.log('\ntask-queue-neo4j-resource-class suite:');
  const taskQueueNeo4jResourceClassResult = await taskQueueNeo4jResourceClass.run();

  console.log('\nentrypoint-template-rendering suite:');
  const entrypointTemplateRenderingResult = await entrypointTemplateRendering.run();

  console.log('\nbullboard-admin-access suite:');
  const bullboardAdminAccessResult = await bullboardAdminAccess.run();

  console.log('\nadmin-tools-dashboard-panel suite:');
  const adminToolsDashboardPanelResult = await adminToolsDashboardPanel.run();

  console.log('\ncreate-tapestry suite:');
  const createTapestryResult = await createTapestry.run();

  console.log('\nreconciliation-incremental-mode suite:');
  const reconciliationIncrementalModeResult = await reconciliationIncrementalMode.run();

  console.log('\ngeneralized-task-scheduler suite:');
  const generalizedTaskSchedulerResult = await generalizedTaskScheduler.run();

  console.log('\nreconciliation-rearchitecture suite:');
  const reconciliationRearchitectureResult = await reconciliationRearchitecture.run();

  console.log('\nscheduled-tasks-with-arguments suite:');
  const scheduledTasksWithArgumentsResult = await scheduledTasksWithArguments.run();

  console.log('\nmanual-task-retrigger-after-finish suite:');
  const manualTaskRetriggerAfterFinishResult = await manualTaskRetriggerAfterFinish.run();

  console.log('\nscheduled-task-timeout-propagation suite:');
  const scheduledTaskTimeoutPropagationResult = await scheduledTaskTimeoutPropagation.run();

  console.log('\nkill-timeout-orphans-by-default suite:');
  const killTimeoutOrphansByDefaultResult = await killTimeoutOrphansByDefault.run();

  console.log('\ntask-queue-semaphore-protection-audit suite:');
  const taskQueueSemaphoreProtectionAuditResult = await taskQueueSemaphoreProtectionAudit.run();

  console.log('\nprofile-follows-list suite:');
  const profileFollowsListResult = await profileFollowsList.run();

  console.log('\nprofile-website-link suite:');
  const profileWebsiteLinkResult = await profileWebsiteLink.run();

  console.log('\nprofile-verified-followers-count suite:');
  const profileVerifiedFollowersCountResult = await profileVerifiedFollowersCount.run();

  console.log('\nprofile-followers-list suite:');
  const profileFollowersListResult = await profileFollowersList.run();

  console.log('\nprofile-verified-reporters-count suite:');
  const profileVerifiedReportersCountResult = await profileVerifiedReportersCount.run();

  console.log('\nverified-reporters-membership-data suite:');
  const verifiedReportersMembershipDataResult = await verifiedReportersMembershipData.run();

  console.log('\nverified-reporters-list-page suite:');
  const verifiedReportersListPageResult = await verifiedReportersListPage.run();

  console.log('\nprofile-verified-counts-owner-pov suite:');
  const profileVerifiedCountsOwnerPovResult = await profileVerifiedCountsOwnerPov.run();

  console.log('\nprofile-verified-counts-explainer-and-alarm suite:');
  const profileVerifiedCountsExplainerAndAlarmResult = await profileVerifiedCountsExplainerAndAlarm.run();

  const searchApiResultTypeSettingsResult = await searchApiResultTypeSettings.run();

  const trustedListPinPublishBlockersResult = await trustedListPinPublishBlockers.run();

  const nostrUserTagHybridEaWriterResult = await nostrUserTagHybridEaWriter.run();

  console.log('\nreputation-info-popup suite:');
  const reputationInfoPopupResult = await reputationInfoPopup.run();

  console.log('\nlive-feed-read-path suite:');
  const liveFeedReadPathResult = await liveFeedReadPath.run();

  console.log('\nlive-feed-feed-page suite:');
  const liveFeedFeedPageResult = await liveFeedFeedPage.run();

  console.log('\nnote-surfaces-read-path suite:');
  const noteSurfacesReadPathResult = await noteSurfacesReadPath.run();

  console.log('\nnote-surfaces-ui suite:');
  const noteSurfacesUiResult = await noteSurfacesUi.run();

  console.log('\nevent-page-read-path suite:');
  const eventPageReadPathResult = await eventPageReadPath.run();

  console.log('\nevent-page-ui suite:');
  const eventPageUiResult = await eventPageUi.run();

  console.log('\nverified-reporters-report-columns suite:');
  const verifiedReportersReportColumnsResult = await verifiedReportersReportColumns.run();

  console.log('\nprofile-identity-details-popover suite:');
  const profileIdentityDetailsPopoverResult = await profileIdentityDetailsPopover.run();

  console.log('\nprofile-follows-hops suite:');
  const profileFollowsHopsResult = await profileFollowsHops.run();

  console.log('\nprofile-hops-path suite:');
  const profileHopsPathResult = await profileHopsPath.run();

  const tagReadUnionResult = await tagReadUnion.run();

  console.log('\nb-tag-primitive suite:');
  const bTagPrimitiveResult = await bTagPrimitive.run();

  console.log('\nb-tag-seeds suite:');
  const bTagSeedsResult = await bTagSeeds.run();

  console.log('\ndual-z-writer suite:');
  const dualZWriterResult = await dualZWriter.run();

  console.log('\nopen-ranking-stats suite:');
  const openRankingStatsResult = await openRankingStats.run();

  console.log('\nopen-ranking-search suite:');
  const openRankingSearchResult = await openRankingSearch.run();

  console.log('\nopen-ranking-rank suite:');
  const openRankingRankResult = await openRankingRank.run();

  console.log('\nopen-ranking-followers-muters suite:');
  const openRankingFollowersMutersResult = await openRankingFollowersMuters.run();

  console.log('\nverified-muters-read-api suite:');
  const verifiedMutersReadApiResult = await verifiedMutersReadApi.run();

  console.log('\nverified-muters-profile-surface suite:');
  const verifiedMutersProfileSurfaceResult = await verifiedMutersProfileSurface.run();

  console.log('\nevent-tagging-core suite:');
  const eventTaggingCoreResult = await eventTaggingCore.run();
  console.log('\nevent-tagging-spec suite:');
  const eventTaggingSpecResult = await eventTaggingSpec.run();
  console.log('\nglobal-publish-gate suite:');
  const globalPublishGateResult = await globalPublishGate.run();
  console.log('\nevent-tagging-firmware-seed suite:');
  const eventTaggingFirmwareSeedResult = await eventTaggingFirmwareSeed.run();
  console.log('\nevent-tagging-read-api suite:');
  const eventTaggingReadApiResult = await eventTaggingReadApi.run();
  console.log('\nevent-tagging-write-path suite:');
  const eventTaggingWritePathResult = await eventTaggingWritePath.run();
  console.log('\nevent-tagging-read-viewer-stance suite:');
  const eventTaggingReadViewerStanceResult = await eventTaggingReadViewerStance.run();
  console.log('\nevent-tag-note-affordance-ui suite:');
  const eventTagNoteAffordanceUiResult = await eventTagNoteAffordanceUi.run();
  console.log('\ntag-actions-menu-ui suite:');
  const tagActionsMenuUiResult = await tagActionsMenuUi.run();
  const taggingRawEventInspectorUiResult = await taggingRawEventInspectorUi.run();
  const noteTaggingRawEventsInspectorUiResult = await noteTaggingRawEventsInspectorUi.run();
  const noteTaggingRawEventsInspectorHttpResult = await noteTaggingRawEventsInspectorHttp.run();
  console.log('\nevent-tagging-for-tag suite:');
  const eventTaggingForTagResult = await eventTaggingForTag.run();
  console.log('\nunified-tag-index suite:');
  const unifiedTagIndexResult = await unifiedTagIndex.run();
  console.log('\nevent-tagging-notes-by-author suite:');
  const eventTaggingNotesByAuthorResult = await eventTaggingNotesByAuthor.run();
  console.log('\nunified-tags-directory suite:');
  const unifiedTagsDirectoryResult = await unifiedTagsDirectory.run();
  console.log('\nprofile-authored-notes-ui suite:');
  const profileAuthoredNotesUiResult = await profileAuthoredNotesUi.run();
  console.log('\nnotes-replies-toggle suite:');
  const notesRepliesToggleResult = await notesRepliesToggle.run();
  console.log('\nfeed-pagination suite:');
  const feedPaginationResult = await feedPagination.run();
  console.log('\nprofile-content-card suite:');
  const profileContentCardResult = await profileContentCard.run();
  console.log('\ntag-applicability suite:');
  const tagApplicabilityResult = await tagApplicability.run();
  console.log('\ntag-applicability-picker suite:');
  const tagApplicabilityPickerResult = await tagApplicabilityPicker.run();
  console.log('\nnote-trusted-list suite:');
  const noteTrustedListResult = await noteTrustedList.run();
  console.log('\nprofile-tag-consume-by-a-coordinate suite:');
  const profileTagConsumeByAResult = await profileTagConsumeByA.run();
  console.log('\npov-selectable-tag-surfaces suite:');
  const povSelectableTagSurfacesResult = await povSelectableTagSurfaces.run();
  console.log('\npov-resolution-status suite:');
  const povResolutionStatusResult = await povResolutionStatus.run();
  console.log('\npov-rank-threshold-key suite:');
  const povRankThresholdKeyResult = await povRankThresholdKey.run();
  console.log('\npov-notice-text suite:');
  const povNoticeTextResult = await povNoticeText.run();
  console.log('\npov-state-unification suite:');
  const povStateUnificationResult = await povStateUnification.run();
  console.log('\napplicability-republish suite:');
  const applicabilityRepublishResult = await applicabilityRepublish.run();
  console.log('\nharness-lint suite:');
  const harnessLintResult = await harnessLint.run();

  console.log('\nharness-stats suite:');
  const harnessStatsResult = await harnessStats.run();

  console.log('\nsession-start suite:');
  const sessionStartResult = await sessionStart.run();

  console.log('\nstack-free-npm-test suite:');
  const stackFreeNpmTestResult = await stackFreeNpmTest.run();

  console.log('\nci-test-job suite:');
  const ciTestJobResult = await ciTestJob.run();

  console.log('\nsync-panel-tag-filters suite:');
  const syncPanelTagFiltersResult = await syncPanelTagFilters.run();

  console.log('\nrouter-stream-tag-filters suite:');
  const routerStreamTagFiltersResult = await routerStreamTagFilters.run();

  console.log('\ndeploy-safety-status suite:');
  const deploySafetyStatusResult = await deploySafetyStatus.run();

  console.log('\nsafe-to-merge-check suite:');
  const safeToMergeCheckResult = await safeToMergeCheck.run();

  console.log('\nnext-task-countdown suite:');
  const nextTaskCountdownResult = await nextTaskCountdown.run();
  const closeUnauthWriteSurfaceResult = await closeUnauthWriteSurface.run();
  const defaultDenyMutationsResult = await defaultDenyMutations.run();
  const usersPageNeo4jEndpointResult = await usersPageNeo4jEndpoint.run();
  const strfryWipeOwnerGateResult = await strfryWipeOwnerGate.run();
  const relationshipPrimitivesResult = await relationshipPrimitives.run();
  const relationshipPrimitivesProbeResult = await relationshipPrimitivesProbe.run();
  const strfryWriteAssertionBracketResult = await strfryWriteAssertionBracket.run();
  const moveNodesBetweenSetsUiResult = await moveNodesBetweenSetsUi.run();
  const captureAGoalAndSeeItResult = await captureAGoalAndSeeIt.run();
  const firmwareConceptElementsSetsResult = await firmwareConceptElementsSets.run();
  const tapestryPerConceptDetailViewsResult = await tapestryPerConceptDetailViews.run();
  const structuresTheBrainCanTrustResult = await structuresTheBrainCanTrust.run();
  const breakAGoalIntoPiecesResult = await breakAGoalIntoPieces.run();
  const attachTheWorldResult = await attachTheWorld.run();
  const sessionsReadTheBrainResult = await sessionsReadTheBrain.run();
  const theProposalLoopResult = await theProposalLoop.run();
  const teachItWhatMattersResult = await teachItWhatMatters.run();
  const theBrainSurvivesResult = await theBrainSurvives.run();
  const operationalDirectionResult = await operationalDirection.run();
  const storeTheFourResult = await storeTheFour.run();
  const returnTheFourResult = await returnTheFour.run();
  const showTheFourResult = await showTheFour.run();

  console.log('\nin-app-badged-ta-avatar suite:');
  const inAppBadgedTaAvatarResult = await inAppBadgedTaAvatar.run();
  const recognizablePublishedTaProfileResult = await recognizablePublishedTaProfile.run();
  const stampedCompositeAvatarResult = await stampedCompositeAvatar.run();

  console.log('\ntapestry-key-put-await suite:');
  const tapestryKeyPutAwaitResult = await tapestryKeyPutAwait.run();

  console.log('\nadd-a-concept-to-a-tapestry suite:');
  const addConceptToTapestryResult = await addConceptToTapestry.run();

  console.log('\ntake-a-concept-back-out suite:');
  const takeAConceptBackOutResult = await takeAConceptBackOut.run();

  console.log('\nbrain-first-tapestry-authoring suite:');
  const brainFirstTapestryAuthoringResult = await brainFirstTapestryAuthoring.run();

  console.log('\nb-coverage-audit-and-disposition suite:');
  const bCoverageAuditAndDispositionResult = await bCoverageAuditAndDisposition.run();

  console.log('\nadoption-candidates-queue suite:');
  const adoptionCandidatesQueueResult = await adoptionCandidatesQueue.run();

  console.log('\ninverse-queue-publish-candidates suite:');
  const inverseQueuePublishCandidatesResult = await inverseQueuePublishCandidates.run();

  console.log('\npublish-time-default-stamping suite:');
  const publishTimeDefaultStampingResult = await publishTimeDefaultStamping.run();

  console.log('\ntrusted-dictionary suite:');
  const trustedDictionaryResult = await trustedDictionary.run();

  console.log('\nadoption-twins suite:');
  const adoptionTwinsResult = await adoptionTwins.run();

  console.log('\nadoption-raw-event-view suite:');
  const adoptionRawEventViewResult = await adoptionRawEventView.run();

  console.log('\nstate-on-concept-page suite:');
  const stateOnConceptPageResult = await stateOnConceptPage.run();

  console.log('\nshared-by-me suite:');
  const sharedByMeResult = await sharedByMe.run();

  console.log('\nretire-offering-vocabulary suite:');
  const retireOfferingVocabularyResult = await retireOfferingVocabulary.run();
  const siteTrustSignalsResult = await siteTrustSignals.run();

  console.log('\nhonest-broadcast-reporting suite:');
  const honestBroadcastReportingResult = await honestBroadcastReporting.run();
  const notYetSharedFilterResult = await notYetSharedFilter.run();
  const shareFromSharedByMeResult = await shareFromSharedByMe.run();

  console.log('\nTest Results');
  console.log('-------------');
  console.log(`Configuration Loading:                           ${configOk ? 'PASS' : 'FAIL'}`);
  console.log(`profile-tags suite:                              ${profileTagsResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagsResult.pass} passed, ${profileTagsResult.fail} failed)`);
  console.log(`note-trusted-list suite:                         ${noteTrustedListResult.fail === 0 ? 'PASS' : 'FAIL'} (${noteTrustedListResult.pass} passed, ${noteTrustedListResult.fail} failed)`);
  console.log(`profile-tag-consume-by-a-coordinate suite:       ${profileTagConsumeByAResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagConsumeByAResult.pass} passed, ${profileTagConsumeByAResult.fail} failed)`);
  console.log(`pov-selectable-tag-surfaces suite:               ${povSelectableTagSurfacesResult.fail === 0 ? 'PASS' : 'FAIL'} (${povSelectableTagSurfacesResult.pass} passed, ${povSelectableTagSurfacesResult.fail} failed)`);
  console.log(`pov-resolution-status suite:                     ${povResolutionStatusResult.fail === 0 ? 'PASS' : 'FAIL'} (${povResolutionStatusResult.pass} passed, ${povResolutionStatusResult.fail} failed)`);
  console.log(`pov-rank-threshold-key suite:                      ${povRankThresholdKeyResult.fail === 0 ? 'PASS' : 'FAIL'} (${povRankThresholdKeyResult.pass} passed, ${povRankThresholdKeyResult.fail} failed)`);
  console.log(`pov-notice-text suite:                            ${povNoticeTextResult.fail === 0 ? 'PASS' : 'FAIL'} (${povNoticeTextResult.pass} passed, ${povNoticeTextResult.fail} failed)`);
  console.log(`pov-state-unification suite:                      ${povStateUnificationResult.fail === 0 ? 'PASS' : 'FAIL'} (${povStateUnificationResult.pass} passed, ${povStateUnificationResult.fail} failed)`);
  console.log(`applicability-republish suite:                   ${applicabilityRepublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${applicabilityRepublishResult.pass} passed, ${applicabilityRepublishResult.fail} failed)`);
  const profileTagsLine =
    (profileTagsResult.pass + profileTagsResult.fail) === 0 && profileTagsResult.skipped
      ? `SKIP (${profileTagsResult.skipped} tests; control panel not reachable)`
      : `${profileTagsResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagsResult.pass} passed, ${profileTagsResult.fail} failed${profileTagsResult.skipped ? `, ${profileTagsResult.skipped} skipped` : ''})`;
  console.log(`profile-tags suite:                              ${profileTagsLine}`);
  const publishLine =
    (publishResult.pass + publishResult.fail) === 0 && publishResult.skipped
      ? `SKIP (${publishResult.skipped} tests; preconditions not met)`
      : `${publishResult.fail === 0 ? 'PASS' : 'FAIL'} (${publishResult.pass} passed, ${publishResult.fail} failed${publishResult.skipped ? `, ${publishResult.skipped} skipped` : ''})`;
  console.log(`profile-tags-publish suite:                      ${publishLine}`);
  const tagDetailLine =
    (tagDetailResult.pass + tagDetailResult.fail) === 0 && tagDetailResult.skipped
      ? `SKIP (${tagDetailResult.skipped} tests; control panel not reachable)`
      : `${tagDetailResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailResult.pass} passed, ${tagDetailResult.fail} failed${tagDetailResult.skipped ? `, ${tagDetailResult.skipped} skipped` : ''})`;
  console.log(`tag-detail suite:                                ${tagDetailLine}`);
  const tdpLine =
    (tagDetailPublishResult.pass + tagDetailPublishResult.fail) === 0 && tagDetailPublishResult.skipped
      ? `SKIP (${tagDetailPublishResult.skipped} tests; preconditions not met)`
      : `${tagDetailPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailPublishResult.pass} passed, ${tagDetailPublishResult.fail} failed${tagDetailPublishResult.skipped ? `, ${tagDetailPublishResult.skipped} skipped` : ''})`;
  console.log(`tag-detail-publish suite:                        ${tdpLine}`);
  const tagDetailWriteLine =
    (tagDetailWriteResult.pass + tagDetailWriteResult.fail) === 0 && tagDetailWriteResult.skipped
      ? `SKIP (${tagDetailWriteResult.skipped} tests; control panel not reachable)`
      : `${tagDetailWriteResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailWriteResult.pass} passed, ${tagDetailWriteResult.fail} failed${tagDetailWriteResult.skipped ? `, ${tagDetailWriteResult.skipped} skipped` : ''})`;
  console.log(`tag-detail-write suite:                          ${tagDetailWriteLine}`);
  const tdwpLine =
    (tagDetailWritePublishResult.pass + tagDetailWritePublishResult.fail) === 0 && tagDetailWritePublishResult.skipped
      ? `SKIP (${tagDetailWritePublishResult.skipped} tests; preconditions not met)`
      : `${tagDetailWritePublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailWritePublishResult.pass} passed, ${tagDetailWritePublishResult.fail} failed${tagDetailWritePublishResult.skipped ? `, ${tagDetailWritePublishResult.skipped} skipped` : ''})`;
  console.log(`tag-detail-write-publish suite:                  ${tdwpLine}`);
  const tagIndexLine =
    (tagIndexResult.pass + tagIndexResult.fail) === 0 && tagIndexResult.skipped
      ? `SKIP (${tagIndexResult.skipped} tests; control panel not reachable)`
      : `${tagIndexResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagIndexResult.pass} passed, ${tagIndexResult.fail} failed${tagIndexResult.skipped ? `, ${tagIndexResult.skipped} skipped` : ''})`;
  console.log(`tag-index suite:                                 ${tagIndexLine}`);
  const tipLine =
    (tagIndexPublishResult.pass + tagIndexPublishResult.fail) === 0 && tagIndexPublishResult.skipped
      ? `SKIP (${tagIndexPublishResult.skipped} tests; preconditions not met)`
      : `${tagIndexPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagIndexPublishResult.pass} passed, ${tagIndexPublishResult.fail} failed${tagIndexPublishResult.skipped ? `, ${tagIndexPublishResult.skipped} skipped` : ''})`;
  console.log(`tag-index-publish suite:                         ${tipLine}`);
  const authoredTaggingLine =
    (authoredTaggingResult.pass + authoredTaggingResult.fail) === 0 && authoredTaggingResult.skipped
      ? `SKIP (${authoredTaggingResult.skipped} tests; control panel not reachable)`
      : `${authoredTaggingResult.fail === 0 ? 'PASS' : 'FAIL'} (${authoredTaggingResult.pass} passed, ${authoredTaggingResult.fail} failed${authoredTaggingResult.skipped ? `, ${authoredTaggingResult.skipped} skipped` : ''})`;
  console.log(`authored-tagging suite:                          ${authoredTaggingLine}`);
  const atpLine =
    (authoredTaggingPublishResult.pass + authoredTaggingPublishResult.fail) === 0 && authoredTaggingPublishResult.skipped
      ? `SKIP (${authoredTaggingPublishResult.skipped} tests; preconditions not met)`
      : `${authoredTaggingPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${authoredTaggingPublishResult.pass} passed, ${authoredTaggingPublishResult.fail} failed${authoredTaggingPublishResult.skipped ? `, ${authoredTaggingPublishResult.skipped} skipped` : ''})`;
  console.log(`authored-tagging-publish suite:                  ${atpLine}`);
  const profileTagPolishLine =
    (profileTagPolishResult.pass + profileTagPolishResult.fail) === 0 && profileTagPolishResult.skipped
      ? `SKIP (${profileTagPolishResult.skipped} tests; control panel not reachable)`
      : `${profileTagPolishResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagPolishResult.pass} passed, ${profileTagPolishResult.fail} failed${profileTagPolishResult.skipped ? `, ${profileTagPolishResult.skipped} skipped` : ''})`;
  console.log(`profile-tag-polish suite:                        ${profileTagPolishLine}`);
  const ptppLine =
    (profileTagPolishPublishResult.pass + profileTagPolishPublishResult.fail) === 0 && profileTagPolishPublishResult.skipped
      ? `SKIP (${profileTagPolishPublishResult.skipped} tests; preconditions not met)`
      : `${profileTagPolishPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagPolishPublishResult.pass} passed, ${profileTagPolishPublishResult.fail} failed${profileTagPolishPublishResult.skipped ? `, ${profileTagPolishPublishResult.skipped} skipped` : ''})`;
  console.log(`profile-tag-polish-publish suite:                ${ptppLine}`);
  console.log(`search-result-parity suite:                      ${searchResultParityResult.fail === 0 ? 'PASS' : 'FAIL'} (${searchResultParityResult.pass} passed, ${searchResultParityResult.fail} failed)`);
  console.log(`search-results-url suite:                        ${searchResultsUrlResult.fail === 0 ? 'PASS' : 'FAIL'} (${searchResultsUrlResult.pass} passed, ${searchResultsUrlResult.fail} failed)`);
  const pinATagLine =
    (pinATagResult.pass + pinATagResult.fail) === 0 && pinATagResult.skipped
      ? `SKIP (${pinATagResult.skipped} tests; control panel not reachable)`
      : `${pinATagResult.fail === 0 ? 'PASS' : 'FAIL'} (${pinATagResult.pass} passed, ${pinATagResult.fail} failed${pinATagResult.skipped ? `, ${pinATagResult.skipped} skipped` : ''})`;
  console.log(`pin-a-tag suite:                                 ${pinATagLine}`);
  const patpLine =
    (pinATagPublishResult.pass + pinATagPublishResult.fail) === 0 && pinATagPublishResult.skipped
      ? `SKIP (${pinATagPublishResult.skipped} tests; preconditions not met)`
      : `${pinATagPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${pinATagPublishResult.pass} passed, ${pinATagPublishResult.fail} failed${pinATagPublishResult.skipped ? `, ${pinATagPublishResult.skipped} skipped` : ''})`;
  console.log(`pin-a-tag-publish suite:                         ${patpLine}`);
  const tlPubFromPinsLine =
    (tlPubFromPinsResult.pass + tlPubFromPinsResult.fail) === 0 && tlPubFromPinsResult.skipped
      ? `SKIP (${tlPubFromPinsResult.skipped} tests; control panel not reachable)`
      : `${tlPubFromPinsResult.fail === 0 ? 'PASS' : 'FAIL'} (${tlPubFromPinsResult.pass} passed, ${tlPubFromPinsResult.fail} failed${tlPubFromPinsResult.skipped ? `, ${tlPubFromPinsResult.skipped} skipped` : ''})`;
  console.log(`tl-publication-from-pins suite:                  ${tlPubFromPinsLine}`);
  const tlppLine =
    (tlPubFromPinsPublishResult.pass + tlPubFromPinsPublishResult.fail) === 0 && tlPubFromPinsPublishResult.skipped
      ? `SKIP (${tlPubFromPinsPublishResult.skipped} tests; preconditions not met)`
      : `${tlPubFromPinsPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tlPubFromPinsPublishResult.pass} passed, ${tlPubFromPinsPublishResult.fail} failed${tlPubFromPinsPublishResult.skipped ? `, ${tlPubFromPinsPublishResult.skipped} skipped` : ''})`;
  console.log(`tl-publication-from-pins-publish suite:          ${tlppLine}`);
  const cpcLine =
    (customizePinCurationPublishResult.pass + customizePinCurationPublishResult.fail) === 0 && customizePinCurationPublishResult.skipped
      ? `SKIP (${customizePinCurationPublishResult.skipped} tests; preconditions not met)`
      : `${customizePinCurationPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${customizePinCurationPublishResult.pass} passed, ${customizePinCurationPublishResult.fail} failed${customizePinCurationPublishResult.skipped ? `, ${customizePinCurationPublishResult.skipped} skipped` : ''})`;
  console.log(`customize-pin-curation-publish suite:            ${cpcLine}`);
  const mostPinnedTagIndexLine =
    (mostPinnedTagIndexResult.pass + mostPinnedTagIndexResult.fail) === 0 && mostPinnedTagIndexResult.skipped
      ? `SKIP (${mostPinnedTagIndexResult.skipped} tests; control panel not reachable)`
      : `${mostPinnedTagIndexResult.fail === 0 ? 'PASS' : 'FAIL'} (${mostPinnedTagIndexResult.pass} passed, ${mostPinnedTagIndexResult.fail} failed${mostPinnedTagIndexResult.skipped ? `, ${mostPinnedTagIndexResult.skipped} skipped` : ''})`;
  console.log(`most-pinned-tag-index suite:                     ${mostPinnedTagIndexLine}`);
  const mptpLine =
    (mostPinnedTagIndexPublishResult.pass + mostPinnedTagIndexPublishResult.fail) === 0 && mostPinnedTagIndexPublishResult.skipped
      ? `SKIP (${mostPinnedTagIndexPublishResult.skipped} tests; preconditions not met)`
      : `${mostPinnedTagIndexPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${mostPinnedTagIndexPublishResult.pass} passed, ${mostPinnedTagIndexPublishResult.fail} failed${mostPinnedTagIndexPublishResult.skipped ? `, ${mostPinnedTagIndexPublishResult.skipped} skipped` : ''})`;
  console.log(`most-pinned-tag-index-publish suite:             ${mptpLine}`);
  const tagDetailCuratedLine =
    (tagDetailCuratedResult.pass + tagDetailCuratedResult.fail) === 0 && tagDetailCuratedResult.skipped
      ? `SKIP (${tagDetailCuratedResult.skipped} tests; control panel not reachable)`
      : `${tagDetailCuratedResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailCuratedResult.pass} passed, ${tagDetailCuratedResult.fail} failed${tagDetailCuratedResult.skipped ? `, ${tagDetailCuratedResult.skipped} skipped` : ''})`;
  console.log(`tag-detail-curated-view-and-pin-polish suite:    ${tagDetailCuratedLine}`);
  const tdcpLine =
    (tagDetailCuratedPublishResult.pass + tagDetailCuratedPublishResult.fail) === 0 && tagDetailCuratedPublishResult.skipped
      ? `SKIP (${tagDetailCuratedPublishResult.skipped} tests; preconditions not met)`
      : `${tagDetailCuratedPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailCuratedPublishResult.pass} passed, ${tagDetailCuratedPublishResult.fail} failed${tagDetailCuratedPublishResult.skipped ? `, ${tagDetailCuratedPublishResult.skipped} skipped` : ''})`;
  console.log(`tag-detail-curated-view-and-pin-polish-publish suite: ${tdcpLine}`);
  const restoreHistoricalLine =
    (restoreHistoricalDataAndTlFilterResult.pass + restoreHistoricalDataAndTlFilterResult.fail) === 0 && restoreHistoricalDataAndTlFilterResult.skipped
      ? `SKIP (${restoreHistoricalDataAndTlFilterResult.skipped} tests; control panel not reachable)`
      : `${restoreHistoricalDataAndTlFilterResult.fail === 0 ? 'PASS' : 'FAIL'} (${restoreHistoricalDataAndTlFilterResult.pass} passed, ${restoreHistoricalDataAndTlFilterResult.fail} failed${restoreHistoricalDataAndTlFilterResult.skipped ? `, ${restoreHistoricalDataAndTlFilterResult.skipped} skipped` : ''})`;
  console.log(`restore-historical-data-and-fix-tl-author-filter suite: ${restoreHistoricalLine}`);
  console.log(`treasure-maps-router-preset suite:               ${treasureMapsResult.fail === 0 ? 'PASS' : 'FAIL'} (${treasureMapsResult.pass} passed, ${treasureMapsResult.fail} failed)`);
  console.log(`scheduled-search-and-house-scores-refresh suite: ${scheduledRefreshResult.fail === 0 ? 'PASS' : 'FAIL'} (${scheduledRefreshResult.pass} passed, ${scheduledRefreshResult.fail} failed)`);
  console.log(`strfry-router-first-boot-config suite:           ${strfryRouterFirstBootResult.fail === 0 ? 'PASS' : 'FAIL'} (${strfryRouterFirstBootResult.pass} passed, ${strfryRouterFirstBootResult.fail} failed)`);
  console.log(`per-query-neo4j-timeout-safety-net suite:        ${perQueryNeo4jTimeoutResult.fail === 0 ? 'PASS' : 'FAIL'} (${perQueryNeo4jTimeoutResult.pass} passed, ${perQueryNeo4jTimeoutResult.fail} failed)`);
  console.log(`nip05-checkmark-verification suite:              ${nip05CheckmarkVerificationResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip05CheckmarkVerificationResult.pass} passed, ${nip05CheckmarkVerificationResult.fail} failed)`);
  console.log(`publish-export-a-concept suite:                  ${publishExportConceptResult.fail === 0 ? 'PASS' : 'FAIL'} (${publishExportConceptResult.pass} passed, ${publishExportConceptResult.fail} failed)`);
  console.log(`community-reference-nostr-relay-stub suite:      ${communityReferenceStubResult.fail === 0 ? 'PASS' : 'FAIL'} (${communityReferenceStubResult.pass} passed, ${communityReferenceStubResult.fail} failed)`);
  const nip51ListExportLine =
    (nip51ListExportResult.pass + nip51ListExportResult.fail) === 0 && nip51ListExportResult.skipped
      ? `SKIP (${nip51ListExportResult.skipped} tests; control panel not reachable)`
      : `${nip51ListExportResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip51ListExportResult.pass} passed, ${nip51ListExportResult.fail} failed${nip51ListExportResult.skipped ? `, ${nip51ListExportResult.skipped} skipped` : ''})`;
  console.log(`nip51-list-export-from-pins suite:               ${nip51ListExportLine}`);
  const nleLine =
    (nip51ListExportPublishResult.pass + nip51ListExportPublishResult.fail) === 0 && nip51ListExportPublishResult.skipped
      ? `SKIP (${nip51ListExportPublishResult.skipped} tests; preconditions not met)`
      : `${nip51ListExportPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip51ListExportPublishResult.pass} passed, ${nip51ListExportPublishResult.fail} failed${nip51ListExportPublishResult.skipped ? `, ${nip51ListExportPublishResult.skipped} skipped` : ''})`;
  console.log(`nip51-list-export-from-pins-publish suite:       ${nleLine}`);
  console.log(`pin-detail-into-tag-pinned-tab suite:            ${pinDetailIntoTagTabResult.fail === 0 ? 'PASS' : 'FAIL'} (${pinDetailIntoTagTabResult.pass} passed, ${pinDetailIntoTagTabResult.fail} failed)`);
  console.log(`collapse-into-export-concept suite:              ${collapseIntoExportResult.fail === 0 ? 'PASS' : 'FAIL'} (${collapseIntoExportResult.pass} passed, ${collapseIntoExportResult.fail} failed)`);
  console.log(`login-failure-and-tag-collapse suite:            ${loginFailureAndTagCollapseResult.fail === 0 ? 'PASS' : 'FAIL'} (${loginFailureAndTagCollapseResult.pass} passed, ${loginFailureAndTagCollapseResult.fail} failed)`);
  console.log(
    `header-conceptgraph-tag suite:                   ${headerConceptGraphTagResult.fail === 0 ? 'PASS' : 'FAIL'} (${headerConceptGraphTagResult.pass} passed, ${headerConceptGraphTagResult.fail} failed)`
  );
  console.log(
    `community-reference-superset-link suite:         ${communityReferenceSupersetLinkResult.fail === 0 ? 'PASS' : 'FAIL'} (${communityReferenceSupersetLinkResult.pass} passed, ${communityReferenceSupersetLinkResult.fail} failed)`
  );
  console.log(
    `graperank-shared-csv-race suite:                 ${graperankSharedCsvRaceResult.fail === 0 ? 'PASS' : 'FAIL'} (${graperankSharedCsvRaceResult.pass} passed, ${graperankSharedCsvRaceResult.fail} failed)`
  );
  console.log(
    `community-class-thread-pull suite:               ${communityClassThreadPullResult.fail === 0 ? 'PASS' : 'FAIL'} (${communityClassThreadPullResult.pass} passed, ${communityClassThreadPullResult.fail} failed)`
  );
  console.log(
    `task-queue-bullmq suite:                         ${taskQueueBullmqResult.fail === 0 ? 'PASS' : 'FAIL'} (${taskQueueBullmqResult.pass} passed, ${taskQueueBullmqResult.fail} failed)`
  );
  console.log(
    `task-queue-neo4j-resource-class suite:           ${taskQueueNeo4jResourceClassResult.fail === 0 ? 'PASS' : 'FAIL'} (${taskQueueNeo4jResourceClassResult.pass} passed, ${taskQueueNeo4jResourceClassResult.fail} failed)`
  );
  console.log(
    `entrypoint-template-rendering suite:             ${entrypointTemplateRenderingResult.fail === 0 ? 'PASS' : 'FAIL'} (${entrypointTemplateRenderingResult.pass} passed, ${entrypointTemplateRenderingResult.fail} failed)`
  );
  console.log(
    `bullboard-admin-access suite:                    ${bullboardAdminAccessResult.fail === 0 ? 'PASS' : 'FAIL'} (${bullboardAdminAccessResult.pass} passed, ${bullboardAdminAccessResult.fail} failed)`
  );
  console.log(
    `admin-tools-dashboard-panel suite:               ${adminToolsDashboardPanelResult.fail === 0 ? 'PASS' : 'FAIL'} (${adminToolsDashboardPanelResult.pass} passed, ${adminToolsDashboardPanelResult.fail} failed)`
  );
  console.log(
    `create-tapestry suite:                           ${createTapestryResult.fail === 0 ? 'PASS' : 'FAIL'} (${createTapestryResult.pass} passed, ${createTapestryResult.fail} failed)`
  );
  console.log(
    `tapestry-key-put-await suite:                    ${tapestryKeyPutAwaitResult.fail === 0 ? 'PASS' : 'FAIL'} (${tapestryKeyPutAwaitResult.pass} passed, ${tapestryKeyPutAwaitResult.fail} failed)`
  );
  console.log(
    `reconciliation-incremental-mode suite:           ${reconciliationIncrementalModeResult.fail === 0 ? 'PASS' : 'FAIL'} (${reconciliationIncrementalModeResult.pass} passed, ${reconciliationIncrementalModeResult.fail} failed)`
  );
  console.log(
    `generalized-task-scheduler suite:                ${generalizedTaskSchedulerResult.fail === 0 ? 'PASS' : 'FAIL'} (${generalizedTaskSchedulerResult.pass} passed, ${generalizedTaskSchedulerResult.fail} failed)`
  );
  console.log(
    `reconciliation-rearchitecture suite:             ${reconciliationRearchitectureResult.fail === 0 ? 'PASS' : 'FAIL'} (${reconciliationRearchitectureResult.pass} passed, ${reconciliationRearchitectureResult.fail} failed)`
  );
  console.log(
    `scheduled-tasks-with-arguments suite:            ${scheduledTasksWithArgumentsResult.fail === 0 ? 'PASS' : 'FAIL'} (${scheduledTasksWithArgumentsResult.pass} passed, ${scheduledTasksWithArgumentsResult.fail} failed)`
  );
  console.log(
    `manual-task-retrigger-after-finish suite:        ${manualTaskRetriggerAfterFinishResult.fail === 0 ? 'PASS' : 'FAIL'} (${manualTaskRetriggerAfterFinishResult.pass} passed, ${manualTaskRetriggerAfterFinishResult.fail} failed)`
  );
  console.log(
    `scheduled-task-timeout-propagation suite:        ${scheduledTaskTimeoutPropagationResult.fail === 0 ? 'PASS' : 'FAIL'} (${scheduledTaskTimeoutPropagationResult.pass} passed, ${scheduledTaskTimeoutPropagationResult.fail} failed)`
  );
  console.log(
    `kill-timeout-orphans-by-default suite:           ${killTimeoutOrphansByDefaultResult.fail === 0 ? 'PASS' : 'FAIL'} (${killTimeoutOrphansByDefaultResult.pass} passed, ${killTimeoutOrphansByDefaultResult.fail} failed)`
  );
  console.log(
    `task-queue-semaphore-protection-audit suite:     ${taskQueueSemaphoreProtectionAuditResult.fail === 0 ? 'PASS' : 'FAIL'} (${taskQueueSemaphoreProtectionAuditResult.pass} passed, ${taskQueueSemaphoreProtectionAuditResult.fail} failed)`
  );
  console.log(
    `profile-follows-list suite:                      ${profileFollowsListResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileFollowsListResult.pass} passed, ${profileFollowsListResult.fail} failed)`
  );
  console.log(
    `profile-website-link suite:                      ${profileWebsiteLinkResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileWebsiteLinkResult.pass} passed, ${profileWebsiteLinkResult.fail} failed)`
  );
  console.log(
    `profile-verified-followers-count suite:          ${profileVerifiedFollowersCountResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileVerifiedFollowersCountResult.pass} passed, ${profileVerifiedFollowersCountResult.fail} failed)`
  );
  console.log(
    `profile-followers-list suite:                    ${profileFollowersListResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileFollowersListResult.pass} passed, ${profileFollowersListResult.fail} failed)`
  );
  console.log(
    `profile-verified-reporters-count suite:          ${profileVerifiedReportersCountResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileVerifiedReportersCountResult.pass} passed, ${profileVerifiedReportersCountResult.fail} failed)`
  );
  console.log(
    `verified-reporters-membership-data suite:        ${verifiedReportersMembershipDataResult.fail === 0 ? 'PASS' : 'FAIL'} (${verifiedReportersMembershipDataResult.pass} passed, ${verifiedReportersMembershipDataResult.fail} failed)`
  );
  console.log(
    `verified-reporters-list-page suite:              ${verifiedReportersListPageResult.fail === 0 ? 'PASS' : 'FAIL'} (${verifiedReportersListPageResult.pass} passed, ${verifiedReportersListPageResult.fail} failed)`
  );
  console.log(
    `profile-verified-counts-owner-pov suite:         ${profileVerifiedCountsOwnerPovResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileVerifiedCountsOwnerPovResult.pass} passed, ${profileVerifiedCountsOwnerPovResult.fail} failed)`
  );
  console.log(
    `profile-verified-counts-explainer-and-alarm suite: ${profileVerifiedCountsExplainerAndAlarmResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileVerifiedCountsExplainerAndAlarmResult.pass} passed, ${profileVerifiedCountsExplainerAndAlarmResult.fail} failed)`
  );
  console.log(
    `search-api-result-type-settings suite:           ${searchApiResultTypeSettingsResult.fail === 0 ? 'PASS' : 'FAIL'} (${searchApiResultTypeSettingsResult.pass} passed, ${searchApiResultTypeSettingsResult.fail} failed${searchApiResultTypeSettingsResult.skipped ? `, ${searchApiResultTypeSettingsResult.skipped} skipped` : ''})`
  );
  console.log(
    `trusted-list-pin-publish-blockers suite:         ${trustedListPinPublishBlockersResult.fail === 0 ? 'PASS' : 'FAIL'} (${trustedListPinPublishBlockersResult.pass} passed, ${trustedListPinPublishBlockersResult.fail} failed${trustedListPinPublishBlockersResult.skipped ? `, ${trustedListPinPublishBlockersResult.skipped} skipped` : ''})`
  );
  console.log(
    `nostr-user-tag-hybrid-ea-writer suite:           ${nostrUserTagHybridEaWriterResult.fail === 0 ? 'PASS' : 'FAIL'} (${nostrUserTagHybridEaWriterResult.pass} passed, ${nostrUserTagHybridEaWriterResult.fail} failed)`
  );
  console.log(
    `reputation-info-popup suite:                     ${reputationInfoPopupResult.fail === 0 ? 'PASS' : 'FAIL'} (${reputationInfoPopupResult.pass} passed, ${reputationInfoPopupResult.fail} failed)`
  );
  console.log(
    `live-feed-read-path suite:                       ${liveFeedReadPathResult.fail === 0 ? 'PASS' : 'FAIL'} (${liveFeedReadPathResult.pass} passed, ${liveFeedReadPathResult.fail} failed)`
  );
  console.log(
    `live-feed-feed-page suite:                       ${liveFeedFeedPageResult.fail === 0 ? 'PASS' : 'FAIL'} (${liveFeedFeedPageResult.pass} passed, ${liveFeedFeedPageResult.fail} failed)`
  );
  console.log(
    `note-surfaces-read-path suite:                   ${noteSurfacesReadPathResult.fail === 0 ? 'PASS' : 'FAIL'} (${noteSurfacesReadPathResult.pass} passed, ${noteSurfacesReadPathResult.fail} failed)`
  );
  console.log(
    `note-surfaces-ui suite:                          ${noteSurfacesUiResult.fail === 0 ? 'PASS' : 'FAIL'} (${noteSurfacesUiResult.pass} passed, ${noteSurfacesUiResult.fail} failed)`
  );
  console.log(
    `event-page-read-path suite:                      ${eventPageReadPathResult.fail === 0 ? 'PASS' : 'FAIL'} (${eventPageReadPathResult.pass} passed, ${eventPageReadPathResult.fail} failed)`
  );
  console.log(
    `event-page-ui suite:                             ${eventPageUiResult.fail === 0 ? 'PASS' : 'FAIL'} (${eventPageUiResult.pass} passed, ${eventPageUiResult.fail} failed)`
  );
  console.log(
    `verified-reporters-report-columns suite:         ${verifiedReportersReportColumnsResult.fail === 0 ? 'PASS' : 'FAIL'} (${verifiedReportersReportColumnsResult.pass} passed, ${verifiedReportersReportColumnsResult.fail} failed)`
  );
  console.log(
    `profile-identity-details-popover suite:          ${profileIdentityDetailsPopoverResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileIdentityDetailsPopoverResult.pass} passed, ${profileIdentityDetailsPopoverResult.fail} failed)`
  );
  console.log(
    `profile-follows-hops suite:                      ${profileFollowsHopsResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileFollowsHopsResult.pass} passed, ${profileFollowsHopsResult.fail} failed)`
  );
  console.log(
    `profile-hops-path suite:                         ${profileHopsPathResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileHopsPathResult.pass} passed, ${profileHopsPathResult.fail} failed)`
  );
  console.log(
    `tag-read-union suite:                            ${tagReadUnionResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagReadUnionResult.pass} passed, ${tagReadUnionResult.fail} failed)`
  );
  console.log(
    `b-tag-primitive suite:                           ${bTagPrimitiveResult.fail === 0 ? 'PASS' : 'FAIL'} (${bTagPrimitiveResult.pass} passed, ${bTagPrimitiveResult.fail} failed)`
  );
  console.log(
    `b-tag-seeds suite:                               ${bTagSeedsResult.fail === 0 ? 'PASS' : 'FAIL'} (${bTagSeedsResult.pass} passed, ${bTagSeedsResult.fail} failed)`
  );
  console.log(
    `dual-z-writer suite:                             ${dualZWriterResult.fail === 0 ? 'PASS' : 'FAIL'} (${dualZWriterResult.pass} passed, ${dualZWriterResult.fail} failed)`
  );
  console.log(
    `open-ranking-stats suite:                        ${openRankingStatsResult.fail === 0 ? 'PASS' : 'FAIL'} (${openRankingStatsResult.pass} passed, ${openRankingStatsResult.fail} failed)`
  );
  console.log(
    `open-ranking-search suite:                       ${openRankingSearchResult.fail === 0 ? 'PASS' : 'FAIL'} (${openRankingSearchResult.pass} passed, ${openRankingSearchResult.fail} failed)`
  );
  console.log(
    `open-ranking-rank suite:                         ${openRankingRankResult.fail === 0 ? 'PASS' : 'FAIL'} (${openRankingRankResult.pass} passed, ${openRankingRankResult.fail} failed)`
  );
  console.log(
    `open-ranking-followers-muters suite:             ${openRankingFollowersMutersResult.fail === 0 ? 'PASS' : 'FAIL'} (${openRankingFollowersMutersResult.pass} passed, ${openRankingFollowersMutersResult.fail} failed)`
  );
  console.log(
    `verified-muters-read-api suite:                  ${verifiedMutersReadApiResult.fail === 0 ? 'PASS' : 'FAIL'} (${verifiedMutersReadApiResult.pass} passed, ${verifiedMutersReadApiResult.fail} failed)`
  );
  console.log(
    `verified-muters-profile-surface suite:           ${verifiedMutersProfileSurfaceResult.fail === 0 ? 'PASS' : 'FAIL'} (${verifiedMutersProfileSurfaceResult.pass} passed, ${verifiedMutersProfileSurfaceResult.fail} failed)`
  );
  console.log(
    `harness-lint suite:                              ${harnessLintResult.fail === 0 ? 'PASS' : 'FAIL'} (${harnessLintResult.pass} passed, ${harnessLintResult.fail} failed)`
  );
  console.log(
    `harness-stats suite:                             ${harnessStatsResult.fail === 0 ? 'PASS' : 'FAIL'} (${harnessStatsResult.pass} passed, ${harnessStatsResult.fail} failed)`
  );
  console.log(
    `session-start suite:                             ${sessionStartResult.fail === 0 ? 'PASS' : 'FAIL'} (${sessionStartResult.pass} passed, ${sessionStartResult.fail} failed)`
  );
  console.log(
    `stack-free-npm-test suite:                       ${stackFreeNpmTestResult.fail === 0 ? 'PASS' : 'FAIL'} (${stackFreeNpmTestResult.pass} passed, ${stackFreeNpmTestResult.fail} failed${stackFreeNpmTestResult.skipped ? `, ${stackFreeNpmTestResult.skipped} skipped` : ''})`
  );
  console.log(
    `ci-test-job suite:                               ${ciTestJobResult.fail === 0 ? 'PASS' : 'FAIL'} (${ciTestJobResult.pass} passed, ${ciTestJobResult.fail} failed)`
  );
  console.log(
    `sync-panel-tag-filters suite:                    ${syncPanelTagFiltersResult.fail === 0 ? 'PASS' : 'FAIL'} (${syncPanelTagFiltersResult.pass} passed, ${syncPanelTagFiltersResult.fail} failed)`
  );
  console.log(
    `router-stream-tag-filters suite:                 ${routerStreamTagFiltersResult.fail === 0 ? 'PASS' : 'FAIL'} (${routerStreamTagFiltersResult.pass} passed, ${routerStreamTagFiltersResult.fail} failed)`
  );
  console.log(
    `tag-actions-menu-ui suite:                       ${tagActionsMenuUiResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagActionsMenuUiResult.pass} passed, ${tagActionsMenuUiResult.fail} failed)`,
    `tagging-raw-event-inspector-ui suite:            ${taggingRawEventInspectorUiResult.fail === 0 ? 'PASS' : 'FAIL'} (${taggingRawEventInspectorUiResult.pass} passed, ${taggingRawEventInspectorUiResult.fail} failed)`
  );
  console.log(
    `note-tagging-raw-events-inspector-ui suite:      ${noteTaggingRawEventsInspectorUiResult.fail === 0 ? 'PASS' : 'FAIL'} (${noteTaggingRawEventsInspectorUiResult.pass} passed, ${noteTaggingRawEventsInspectorUiResult.fail} failed)`
  );
  // Wholesale-skip aware (this suite skips {pass:0, fail:0} when nak/the control
  // panel is missing — CI's stack-free job); partial skips print beside PASS/FAIL.
  const noteTaggingRawHttpLine =
    (noteTaggingRawEventsInspectorHttpResult.pass + noteTaggingRawEventsInspectorHttpResult.fail) === 0 && noteTaggingRawEventsInspectorHttpResult.skipped
      ? `SKIP (${noteTaggingRawEventsInspectorHttpResult.skipped} tests; preconditions not met)`
      : `${noteTaggingRawEventsInspectorHttpResult.fail === 0 ? 'PASS' : 'FAIL'} (${noteTaggingRawEventsInspectorHttpResult.pass} passed, ${noteTaggingRawEventsInspectorHttpResult.fail} failed${noteTaggingRawEventsInspectorHttpResult.skipped ? `, ${noteTaggingRawEventsInspectorHttpResult.skipped} skipped` : ''})`;
  console.log(`note-tagging-raw-events-inspector-http suite:    ${noteTaggingRawHttpLine}`);
  // Skip-aware: H-class live tests skip when the control panel is absent
  // (CI's stack-free job); U/S classes always run and gate.
  const deploySafetyStatusLine =
    (deploySafetyStatusResult.pass + deploySafetyStatusResult.fail) === 0 && deploySafetyStatusResult.skipped
      ? `SKIP (${deploySafetyStatusResult.skipped} tests; preconditions not met)`
      : `${deploySafetyStatusResult.fail === 0 ? 'PASS' : 'FAIL'} (${deploySafetyStatusResult.pass} passed, ${deploySafetyStatusResult.fail} failed${deploySafetyStatusResult.skipped ? `, ${deploySafetyStatusResult.skipped} skipped` : ''})`;
  console.log(`deploy-safety-status suite:                      ${deploySafetyStatusLine}`);
  console.log(
    `safe-to-merge-check suite:                       ${safeToMergeCheckResult.fail === 0 ? 'PASS' : 'FAIL'} (${safeToMergeCheckResult.pass} passed, ${safeToMergeCheckResult.fail} failed)`
  );
  console.log(
    `next-task-countdown suite:                       ${nextTaskCountdownResult.fail === 0 ? 'PASS' : 'FAIL'} (${nextTaskCountdownResult.pass} passed, ${nextTaskCountdownResult.fail} failed)`
  );
  // Skip-aware: H-class live tests skip when the local stack is absent (CI's
  // stack-free job); U/S classes always run and gate.
  const relationshipPrimitivesLine =
    (relationshipPrimitivesResult.pass + relationshipPrimitivesResult.fail) === 0 && relationshipPrimitivesResult.skipped
      ? `SKIP (${relationshipPrimitivesResult.skipped} tests; preconditions not met)`
      : `${relationshipPrimitivesResult.fail === 0 ? 'PASS' : 'FAIL'} (${relationshipPrimitivesResult.pass} passed, ${relationshipPrimitivesResult.fail} failed${relationshipPrimitivesResult.skipped ? `, ${relationshipPrimitivesResult.skipped} skipped` : ''})`;
  console.log(`relationship-primitives suite:                   ${relationshipPrimitivesLine}`);
  // Skip-aware: H-class live tests skip when the local stack is absent (CI's
  // stack-free job); U/S classes always run and gate.
  const relationshipPrimitivesProbeLine =
    (relationshipPrimitivesProbeResult.pass + relationshipPrimitivesProbeResult.fail) === 0 && relationshipPrimitivesProbeResult.skipped
      ? `SKIP (${relationshipPrimitivesProbeResult.skipped} tests; preconditions not met)`
      : `${relationshipPrimitivesProbeResult.fail === 0 ? 'PASS' : 'FAIL'} (${relationshipPrimitivesProbeResult.pass} passed, ${relationshipPrimitivesProbeResult.fail} failed${relationshipPrimitivesProbeResult.skipped ? `, ${relationshipPrimitivesProbeResult.skipped} skipped` : ''})`;
  console.log(`relationship-primitives-probe suite:             ${relationshipPrimitivesProbeLine}`);
  // Skip-aware: H-class teeth tests skip when the local stack is absent (CI's
  // stack-free job); the S-class bracket audit always runs and gates.
  const strfryWriteAssertionBracketLine =
    (strfryWriteAssertionBracketResult.pass + strfryWriteAssertionBracketResult.fail) === 0 && strfryWriteAssertionBracketResult.skipped
      ? `SKIP (${strfryWriteAssertionBracketResult.skipped} tests; preconditions not met)`
      : `${strfryWriteAssertionBracketResult.fail === 0 ? 'PASS' : 'FAIL'} (${strfryWriteAssertionBracketResult.pass} passed, ${strfryWriteAssertionBracketResult.fail} failed${strfryWriteAssertionBracketResult.skipped ? `, ${strfryWriteAssertionBracketResult.skipped} skipped` : ''})`;
  console.log(`strfry-write-assertion-bracket suite:            ${strfryWriteAssertionBracketLine}`);
  // Skip-aware: H-class live sentinels skip when the local stack is absent
  // (CI's stack-free job); U/S classes always run and gate.
  const moveNodesBetweenSetsUiLine =
    (moveNodesBetweenSetsUiResult.pass + moveNodesBetweenSetsUiResult.fail) === 0 && moveNodesBetweenSetsUiResult.skipped
      ? `SKIP (${moveNodesBetweenSetsUiResult.skipped} tests; preconditions not met)`
      : `${moveNodesBetweenSetsUiResult.fail === 0 ? 'PASS' : 'FAIL'} (${moveNodesBetweenSetsUiResult.pass} passed, ${moveNodesBetweenSetsUiResult.fail} failed${moveNodesBetweenSetsUiResult.skipped ? `, ${moveNodesBetweenSetsUiResult.skipped} skipped` : ''})`;
  console.log(`move-nodes-between-sets-ui suite:                ${moveNodesBetweenSetsUiLine}`);
  // Skip-aware: H-class live tests skip when the local stack is absent (CI's
  // stack-free job); U/S classes always run and gate.
  const captureAGoalAndSeeItLine =
    (captureAGoalAndSeeItResult.pass + captureAGoalAndSeeItResult.fail) === 0 && captureAGoalAndSeeItResult.skipped
      ? `SKIP (${captureAGoalAndSeeItResult.skipped} tests; preconditions not met)`
      : `${captureAGoalAndSeeItResult.fail === 0 ? 'PASS' : 'FAIL'} (${captureAGoalAndSeeItResult.pass} passed, ${captureAGoalAndSeeItResult.fail} failed${captureAGoalAndSeeItResult.skipped ? `, ${captureAGoalAndSeeItResult.skipped} skipped` : ''})`;
  console.log(`capture-a-goal-and-see-it suite:                 ${captureAGoalAndSeeItLine}`);
  // Skip-aware: H-class live tests skip when the local stack is absent (CI's
  // stack-free job); U/S classes always run and gate.
  const structuresTheBrainCanTrustLine =
    (structuresTheBrainCanTrustResult.pass + structuresTheBrainCanTrustResult.fail) === 0 && structuresTheBrainCanTrustResult.skipped
      ? `SKIP (${structuresTheBrainCanTrustResult.skipped} tests; preconditions not met)`
      : `${structuresTheBrainCanTrustResult.fail === 0 ? 'PASS' : 'FAIL'} (${structuresTheBrainCanTrustResult.pass} passed, ${structuresTheBrainCanTrustResult.fail} failed${structuresTheBrainCanTrustResult.skipped ? `, ${structuresTheBrainCanTrustResult.skipped} skipped` : ''})`;
  console.log(`structures-the-brain-can-trust suite:            ${structuresTheBrainCanTrustLine}`);

  const firmwareConceptElementsSetsLine =
    (firmwareConceptElementsSetsResult.pass + firmwareConceptElementsSetsResult.fail) === 0 && firmwareConceptElementsSetsResult.skipped
      ? `SKIP (${firmwareConceptElementsSetsResult.skipped} tests; preconditions not met)`
      : `${firmwareConceptElementsSetsResult.fail === 0 ? 'PASS' : 'FAIL'} (${firmwareConceptElementsSetsResult.pass} passed, ${firmwareConceptElementsSetsResult.fail} failed${firmwareConceptElementsSetsResult.skipped ? `, ${firmwareConceptElementsSetsResult.skipped} skipped` : ''})`;
  console.log(`firmware-concept-elements-sets suite:            ${firmwareConceptElementsSetsLine}`);

  const tapestryPerConceptDetailViewsLine =
    (tapestryPerConceptDetailViewsResult.pass + tapestryPerConceptDetailViewsResult.fail) === 0 && tapestryPerConceptDetailViewsResult.skipped
      ? `SKIP (${tapestryPerConceptDetailViewsResult.skipped} tests; preconditions not met)`
      : `${tapestryPerConceptDetailViewsResult.fail === 0 ? 'PASS' : 'FAIL'} (${tapestryPerConceptDetailViewsResult.pass} passed, ${tapestryPerConceptDetailViewsResult.fail} failed${tapestryPerConceptDetailViewsResult.skipped ? `, ${tapestryPerConceptDetailViewsResult.skipped} skipped` : ''})`;
  console.log(`tapestry-per-concept-detail-views suite:         ${tapestryPerConceptDetailViewsLine}`);
  // Skip-aware: H-class live tests skip when the local stack is absent (CI's
  // stack-free job); U/S classes always run and gate.
  const breakAGoalIntoPiecesLine =
    (breakAGoalIntoPiecesResult.pass + breakAGoalIntoPiecesResult.fail) === 0 && breakAGoalIntoPiecesResult.skipped
      ? `SKIP (${breakAGoalIntoPiecesResult.skipped} tests; preconditions not met)`
      : `${breakAGoalIntoPiecesResult.fail === 0 ? 'PASS' : 'FAIL'} (${breakAGoalIntoPiecesResult.pass} passed, ${breakAGoalIntoPiecesResult.fail} failed${breakAGoalIntoPiecesResult.skipped ? `, ${breakAGoalIntoPiecesResult.skipped} skipped` : ''})`;
  console.log(`break-a-goal-into-pieces suite:                  ${breakAGoalIntoPiecesLine}`);

  const attachTheWorldLine =
    (attachTheWorldResult.pass + attachTheWorldResult.fail) === 0 && attachTheWorldResult.skipped
      ? `SKIP (${attachTheWorldResult.skipped} tests; preconditions not met)`
      : `${attachTheWorldResult.fail === 0 ? 'PASS' : 'FAIL'} (${attachTheWorldResult.pass} passed, ${attachTheWorldResult.fail} failed${attachTheWorldResult.skipped ? `, ${attachTheWorldResult.skipped} skipped` : ''})`;
  console.log(`attach-the-world suite:                          ${attachTheWorldLine}`);

  const sessionsReadTheBrainLine =
    (sessionsReadTheBrainResult.pass + sessionsReadTheBrainResult.fail) === 0 && sessionsReadTheBrainResult.skipped
      ? `SKIP (${sessionsReadTheBrainResult.skipped} tests; preconditions not met)`
      : `${sessionsReadTheBrainResult.fail === 0 ? 'PASS' : 'FAIL'} (${sessionsReadTheBrainResult.pass} passed, ${sessionsReadTheBrainResult.fail} failed${sessionsReadTheBrainResult.skipped ? `, ${sessionsReadTheBrainResult.skipped} skipped` : ''})`;
  console.log(`sessions-read-the-brain suite:                   ${sessionsReadTheBrainLine}`);

  const theProposalLoopLine =
    (theProposalLoopResult.pass + theProposalLoopResult.fail) === 0 && theProposalLoopResult.skipped
      ? `SKIP (${theProposalLoopResult.skipped} tests; preconditions not met)`
      : `${theProposalLoopResult.fail === 0 ? 'PASS' : 'FAIL'} (${theProposalLoopResult.pass} passed, ${theProposalLoopResult.fail} failed${theProposalLoopResult.skipped ? `, ${theProposalLoopResult.skipped} skipped` : ''})`;
  console.log(`the-proposal-loop suite:                         ${theProposalLoopLine}`);
  const teachItWhatMattersLine =
    (teachItWhatMattersResult.pass + teachItWhatMattersResult.fail) === 0 && teachItWhatMattersResult.skipped
      ? `SKIP (${teachItWhatMattersResult.skipped} tests; preconditions not met)`
      : `${teachItWhatMattersResult.fail === 0 ? 'PASS' : 'FAIL'} (${teachItWhatMattersResult.pass} passed, ${teachItWhatMattersResult.fail} failed${teachItWhatMattersResult.skipped ? `, ${teachItWhatMattersResult.skipped} skipped` : ''})`;
  console.log(`teach-it-what-matters suite:                     ${teachItWhatMattersLine}`);
  const theBrainSurvivesLine =
    (theBrainSurvivesResult.pass + theBrainSurvivesResult.fail) === 0 && theBrainSurvivesResult.skipped
      ? `SKIP (${theBrainSurvivesResult.skipped} tests; preconditions not met)`
      : `${theBrainSurvivesResult.fail === 0 ? 'PASS' : 'FAIL'} (${theBrainSurvivesResult.pass} passed, ${theBrainSurvivesResult.fail} failed${theBrainSurvivesResult.skipped ? `, ${theBrainSurvivesResult.skipped} skipped` : ''})`;
  console.log(`the-brain-survives suite:                        ${theBrainSurvivesLine}`);
  const operationalDirectionLine =
    (operationalDirectionResult.pass + operationalDirectionResult.fail) === 0 && operationalDirectionResult.skipped
      ? `SKIP (${operationalDirectionResult.skipped} tests; preconditions not met)`
      : `${operationalDirectionResult.fail === 0 ? 'PASS' : 'FAIL'} (${operationalDirectionResult.pass} passed, ${operationalDirectionResult.fail} failed${operationalDirectionResult.skipped ? `, ${operationalDirectionResult.skipped} skipped` : ''})`;
  console.log(`operational-direction suite:                     ${operationalDirectionLine}`);
  const storeTheFourLine =
    (storeTheFourResult.pass + storeTheFourResult.fail) === 0 && storeTheFourResult.skipped
      ? `SKIP (${storeTheFourResult.skipped} tests; preconditions not met)`
      : `${storeTheFourResult.fail === 0 ? 'PASS' : 'FAIL'} (${storeTheFourResult.pass} passed, ${storeTheFourResult.fail} failed${storeTheFourResult.skipped ? `, ${storeTheFourResult.skipped} skipped` : ''})`;
  console.log(`store-the-four suite:                            ${storeTheFourLine}`);
  // OPEN.md #104/#106 — an all-skipped live class is otherwise invisible in the
  // roll-up. Say which live classes actually ran.
  console.log(`store-the-four H-class:                          ${storeTheFourResult.hExecuted} executed / ${storeTheFourResult.hSkipped} skipped`);
  const returnTheFourLine =
    (returnTheFourResult.pass + returnTheFourResult.fail) === 0 && returnTheFourResult.skipped
      ? `SKIP (${returnTheFourResult.skipped} tests; preconditions not met)`
      : `${returnTheFourResult.fail === 0 ? 'PASS' : 'FAIL'} (${returnTheFourResult.pass} passed, ${returnTheFourResult.fail} failed${returnTheFourResult.skipped ? `, ${returnTheFourResult.skipped} skipped` : ''})`;
  console.log(`return-the-four suite:                           ${returnTheFourLine}`);
  console.log(`return-the-four H-class:                         ${returnTheFourResult.hExecuted} executed / ${returnTheFourResult.hSkipped} skipped`);
  const showTheFourLine =
    (showTheFourResult.pass + showTheFourResult.fail) === 0 && showTheFourResult.skipped
      ? `SKIP (${showTheFourResult.skipped} tests; preconditions not met)`
      : `${showTheFourResult.fail === 0 ? 'PASS' : 'FAIL'} (${showTheFourResult.pass} passed, ${showTheFourResult.fail} failed${showTheFourResult.skipped ? `, ${showTheFourResult.skipped} skipped` : ''})`;
  console.log(`show-the-four suite:                             ${showTheFourLine}`);
  console.log(`show-the-four H-class:                           ${showTheFourResult.hExecuted} executed / ${showTheFourResult.hSkipped} skipped`);
  console.log(`in-app-badged-ta-avatar suite:                   ${inAppBadgedTaAvatarResult.fail === 0 ? 'PASS' : 'FAIL'} (${inAppBadgedTaAvatarResult.pass} passed, ${inAppBadgedTaAvatarResult.fail} failed)`);
  console.log(`in-app-badged-ta-avatar B-class:                 browser only — tests/brainstorm/ta-badged-avatar.spec.js (npm run test:playwright)`);
  console.log(`recognizable-published-ta-profile suite:         ${recognizablePublishedTaProfileResult.fail === 0 ? 'PASS' : 'FAIL'} (${recognizablePublishedTaProfileResult.pass} passed, ${recognizablePublishedTaProfileResult.fail} failed${recognizablePublishedTaProfileResult.skipped ? `, ${recognizablePublishedTaProfileResult.skipped} skipped` : ''})`);
  console.log(`recognizable-published-ta-profile H-class:       ${recognizablePublishedTaProfileResult.hExecuted} executed / ${recognizablePublishedTaProfileResult.hSkipped} skipped`);
  console.log(`stamped-composite-avatar suite:                  ${stampedCompositeAvatarResult.fail === 0 ? 'PASS' : 'FAIL'} (${stampedCompositeAvatarResult.pass} passed, ${stampedCompositeAvatarResult.fail} failed${stampedCompositeAvatarResult.skipped ? `, ${stampedCompositeAvatarResult.skipped} skipped` : ''})`);
  console.log(`stamped-composite-avatar H-class:                ${stampedCompositeAvatarResult.hExecuted} executed / ${stampedCompositeAvatarResult.hSkipped} skipped`);
  console.log(`stamped-composite-avatar B-class:                browser only — tests/brainstorm/ta-composite-avatar.spec.js (npm run test:playwright)`);
  console.log(`add-a-concept-to-a-tapestry suite:               ${addConceptToTapestryResult.fail === 0 ? 'PASS' : 'FAIL'} (${addConceptToTapestryResult.pass} passed, ${addConceptToTapestryResult.fail} failed)`);
  console.log(`take-a-concept-back-out suite:                   ${takeAConceptBackOutResult.fail === 0 ? 'PASS' : 'FAIL'} (${takeAConceptBackOutResult.pass} passed, ${takeAConceptBackOutResult.fail} failed)`);
  console.log(`brain-first-tapestry-authoring suite:            ${brainFirstTapestryAuthoringResult.fail === 0 ? 'PASS' : 'FAIL'} (${brainFirstTapestryAuthoringResult.pass} passed, ${brainFirstTapestryAuthoringResult.fail} failed, ${brainFirstTapestryAuthoringResult.skipped} skipped)`);
  console.log(`b-coverage-audit-and-disposition suite:          ${bCoverageAuditAndDispositionResult.fail === 0 ? 'PASS' : 'FAIL'} (${bCoverageAuditAndDispositionResult.pass} passed, ${bCoverageAuditAndDispositionResult.fail} failed, ${bCoverageAuditAndDispositionResult.skipped} skipped)`);
  console.log(`adoption-candidates-queue suite:                 ${adoptionCandidatesQueueResult.fail === 0 ? 'PASS' : 'FAIL'} (${adoptionCandidatesQueueResult.pass} passed, ${adoptionCandidatesQueueResult.fail} failed, ${adoptionCandidatesQueueResult.skipped} skipped)`);
  console.log(`inverse-queue-publish-candidates suite:          ${inverseQueuePublishCandidatesResult.fail === 0 ? 'PASS' : 'FAIL'} (${inverseQueuePublishCandidatesResult.pass} passed, ${inverseQueuePublishCandidatesResult.fail} failed, ${inverseQueuePublishCandidatesResult.skipped} skipped)`);
  console.log(`publish-time-default-stamping suite:             ${publishTimeDefaultStampingResult.fail === 0 ? 'PASS' : 'FAIL'} (${publishTimeDefaultStampingResult.pass} passed, ${publishTimeDefaultStampingResult.fail} failed, ${publishTimeDefaultStampingResult.skipped} skipped)`);
  console.log(`trusted-dictionary suite:                        ${trustedDictionaryResult.fail === 0 ? 'PASS' : 'FAIL'} (${trustedDictionaryResult.pass} passed, ${trustedDictionaryResult.fail} failed, ${trustedDictionaryResult.skipped} skipped)`);
  console.log(`adoption-twins suite:                            ${adoptionTwinsResult.fail === 0 ? 'PASS' : 'FAIL'} (${adoptionTwinsResult.pass} passed, ${adoptionTwinsResult.fail} failed, ${adoptionTwinsResult.skipped} skipped)`);
  console.log(`adoption-raw-event-view suite:                   ${adoptionRawEventViewResult.fail === 0 ? 'PASS' : 'FAIL'} (${adoptionRawEventViewResult.pass} passed, ${adoptionRawEventViewResult.fail} failed, ${adoptionRawEventViewResult.skipped} skipped)`);
  console.log(`state-on-concept-page suite:                     ${stateOnConceptPageResult.fail === 0 ? 'PASS' : 'FAIL'} (${stateOnConceptPageResult.pass} passed, ${stateOnConceptPageResult.fail} failed, ${stateOnConceptPageResult.skipped} skipped)`);
  console.log(`shared-by-me suite:                              ${sharedByMeResult.fail === 0 ? 'PASS' : 'FAIL'} (${sharedByMeResult.pass} passed, ${sharedByMeResult.fail} failed, ${sharedByMeResult.skipped} skipped)`);
  console.log(`retire-offering-vocabulary suite:                ${retireOfferingVocabularyResult.fail === 0 ? 'PASS' : 'FAIL'} (${retireOfferingVocabularyResult.pass} passed, ${retireOfferingVocabularyResult.fail} failed, ${retireOfferingVocabularyResult.skipped} skipped)`);
  console.log(`site-trust-signals suite:                        ${siteTrustSignalsResult.fail === 0 ? 'PASS' : 'FAIL'} (${siteTrustSignalsResult.pass} passed, ${siteTrustSignalsResult.fail} failed, ${siteTrustSignalsResult.skipped} skipped)`);
  console.log(`honest-broadcast-reporting suite:                ${honestBroadcastReportingResult.fail === 0 ? 'PASS' : 'FAIL'} (${honestBroadcastReportingResult.pass} passed, ${honestBroadcastReportingResult.fail} failed, ${honestBroadcastReportingResult.skipped} skipped)`);
  // Skip-aware: H-class contract checks skip when the local stack is absent;
  // the U-class predicate and S-class source audit always run and gate.
  const notYetSharedFilterLine =
    (notYetSharedFilterResult.pass + notYetSharedFilterResult.fail) === 0 && notYetSharedFilterResult.skipped
      ? `SKIP (${notYetSharedFilterResult.skipped} tests; preconditions not met)`
      : `${notYetSharedFilterResult.fail === 0 ? 'PASS' : 'FAIL'} (${notYetSharedFilterResult.pass} passed, ${notYetSharedFilterResult.fail} failed${notYetSharedFilterResult.skipped ? `, ${notYetSharedFilterResult.skipped} skipped` : ''})`;
  console.log(`not-yet-shared-filter suite:                     ${notYetSharedFilterLine}`);
  console.log(`share-from-shared-by-me suite:                   ${shareFromSharedByMeResult.fail === 0 ? 'PASS' : 'FAIL'} (${shareFromSharedByMeResult.pass} passed, ${shareFromSharedByMeResult.fail} failed)`);

  const overallOk =
    configOk &&
    profileTagsResult.fail === 0 &&
    publishResult.fail === 0 &&
    tagDetailResult.fail === 0 &&
    tagDetailPublishResult.fail === 0 &&
    tagDetailWriteResult.fail === 0 &&
    tagDetailWritePublishResult.fail === 0 &&
    tagIndexResult.fail === 0 &&
    tagIndexPublishResult.fail === 0 &&
    authoredTaggingResult.fail === 0 &&
    authoredTaggingPublishResult.fail === 0 &&
    profileTagPolishResult.fail === 0 &&
    profileTagPolishPublishResult.fail === 0 &&
    searchResultParityResult.fail === 0 &&
    searchResultsUrlResult.fail === 0 &&
    pinATagResult.fail === 0 &&
    pinATagPublishResult.fail === 0 &&
    tlPubFromPinsResult.fail === 0 &&
    tlPubFromPinsPublishResult.fail === 0 &&
    customizePinCurationPublishResult.fail === 0 &&
    mostPinnedTagIndexResult.fail === 0 &&
    mostPinnedTagIndexPublishResult.fail === 0 &&
    tagDetailCuratedResult.fail === 0 &&
    tagDetailCuratedPublishResult.fail === 0 &&
    restoreHistoricalDataAndTlFilterResult.fail === 0 &&
    nip51ListExportResult.fail === 0 &&
    nip51ListExportPublishResult.fail === 0 &&
    pinDetailIntoTagTabResult.fail === 0 &&
    collapseIntoExportResult.fail === 0 &&
    loginFailureAndTagCollapseResult.fail === 0 &&
    treasureMapsResult.fail === 0 &&
    scheduledRefreshResult.fail === 0 &&
    strfryRouterFirstBootResult.fail === 0 &&
    perQueryNeo4jTimeoutResult.fail === 0 &&
    nip05CheckmarkVerificationResult.fail === 0 &&
    publishExportConceptResult.fail === 0 &&
    communityReferenceStubResult.fail === 0 &&
    headerConceptGraphTagResult.fail === 0 &&
    communityReferenceSupersetLinkResult.fail === 0 &&
    graperankSharedCsvRaceResult.fail === 0 &&
    communityClassThreadPullResult.fail === 0 &&
    taskQueueBullmqResult.fail === 0 &&
    taskQueueNeo4jResourceClassResult.fail === 0 &&
    entrypointTemplateRenderingResult.fail === 0 &&
    bullboardAdminAccessResult.fail === 0 &&
    adminToolsDashboardPanelResult.fail === 0 &&
    reconciliationIncrementalModeResult.fail === 0 &&
    generalizedTaskSchedulerResult.fail === 0 &&
    reconciliationRearchitectureResult.fail === 0 &&
    scheduledTasksWithArgumentsResult.fail === 0 &&
    manualTaskRetriggerAfterFinishResult.fail === 0 &&
    scheduledTaskTimeoutPropagationResult.fail === 0 &&
    killTimeoutOrphansByDefaultResult.fail === 0 &&
    taskQueueSemaphoreProtectionAuditResult.fail === 0 &&
    profileFollowsListResult.fail === 0 &&
    profileWebsiteLinkResult.fail === 0 &&
    profileVerifiedFollowersCountResult.fail === 0 &&
    profileFollowersListResult.fail === 0 &&
    profileVerifiedReportersCountResult.fail === 0 &&
    verifiedReportersMembershipDataResult.fail === 0 &&
    verifiedReportersListPageResult.fail === 0 &&
    profileVerifiedCountsOwnerPovResult.fail === 0 &&
    profileVerifiedCountsExplainerAndAlarmResult.fail === 0 &&
    searchApiResultTypeSettingsResult.fail === 0 &&
    trustedListPinPublishBlockersResult.fail === 0 &&
    nostrUserTagHybridEaWriterResult.fail === 0 &&
    reputationInfoPopupResult.fail === 0 &&
    liveFeedReadPathResult.fail === 0 &&
    liveFeedFeedPageResult.fail === 0 &&
    noteSurfacesReadPathResult.fail === 0 &&
    noteSurfacesUiResult.fail === 0 &&
    eventPageReadPathResult.fail === 0 &&
    eventPageUiResult.fail === 0 &&
    verifiedReportersReportColumnsResult.fail === 0 &&
    profileIdentityDetailsPopoverResult.fail === 0 &&
    profileFollowsHopsResult.fail === 0 &&
    profileHopsPathResult.fail === 0 &&
    tagReadUnionResult.fail === 0 &&
    profileTagConsumeByAResult.fail === 0 &&
    povSelectableTagSurfacesResult.fail === 0 &&
    povResolutionStatusResult.fail === 0 &&
    povRankThresholdKeyResult.fail === 0 &&
    povNoticeTextResult.fail === 0 &&
    povStateUnificationResult.fail === 0 &&
    bTagPrimitiveResult.fail === 0 &&
    bTagSeedsResult.fail === 0 &&
    dualZWriterResult.fail === 0 &&
    openRankingStatsResult.fail === 0 &&
    openRankingSearchResult.fail === 0 &&
    openRankingRankResult.fail === 0 &&
    openRankingFollowersMutersResult.fail === 0 &&
    verifiedMutersReadApiResult.fail === 0 &&
    verifiedMutersProfileSurfaceResult.fail === 0 &&
    eventTaggingCoreResult.fail === 0 &&
    eventTaggingSpecResult.fail === 0 &&
    globalPublishGateResult.fail === 0 &&
    eventTaggingFirmwareSeedResult.fail === 0 &&
    eventTaggingReadApiResult.fail === 0 &&
    eventTaggingWritePathResult.fail === 0 &&
    eventTaggingReadViewerStanceResult.fail === 0 &&
    eventTagNoteAffordanceUiResult.fail === 0 &&
    eventTaggingForTagResult.fail === 0 &&
    unifiedTagIndexResult.fail === 0 &&
    eventTaggingNotesByAuthorResult.fail === 0 &&
    unifiedTagsDirectoryResult.fail === 0 &&
    profileAuthoredNotesUiResult.fail === 0 &&
    notesRepliesToggleResult.fail === 0 &&
    feedPaginationResult.fail === 0 &&
    profileContentCardResult.fail === 0 &&
    tagApplicabilityResult.fail === 0 &&
    tagApplicabilityPickerResult.fail === 0 &&
    tagActionsMenuUiResult.fail === 0 &&
    taggingRawEventInspectorUiResult.fail === 0 &&
    noteTaggingRawEventsInspectorUiResult.fail === 0 &&
    noteTaggingRawEventsInspectorHttpResult.fail === 0 &&
    // deploy-safety-gate #1 — registered in the LIVE overallOk chain (the
    // block below this expression's terminator is severed — see OPEN.md #43).
    deploySafetyStatusResult.fail === 0 &&
    // deploy-safety-gate #2 — safe-to-merge check script + shared recipe.
    safeToMergeCheckResult.fail === 0 &&
    // deploy-safety-gate #3 — Scheduled Tasks panel aggregate countdown.
    nextTaskCountdownResult.fail === 0 &&
    // security-auth-exposure #1 — close the unauthenticated write-surface.
    closeUnauthWriteSurfaceResult.fail === 0 &&
    // security-auth-exposure #2 — default-deny for unauthenticated mutations.
    defaultDenyMutationsResult.fail === 0 &&
    // bug — users page called the removed run-query endpoint (regression guard).
    usersPageNeo4jEndpointResult.fail === 0 &&
    // security follow-up — strfry/wipe owner-gate (audit 2026-07-21).
    strfryWipeOwnerGateResult.fail === 0 &&
    // relationship-primitives #1 — strfry-free add/delete primitives
    relationshipPrimitivesResult.fail === 0 &&
    // relationship-primitives #2 — read-only deployment probe
    relationshipPrimitivesProbeResult.fail === 0 &&
    // test-suite-hermeticity #1 — author-scoped strfry write-assertion brackets
    strfryWriteAssertionBracketResult.fail === 0 &&
    // graph-curation-ui #1 — place/move nodes between sets UI
    moveNodesBetweenSetsUiResult.fail === 0 &&
    // second-brain #1 — capture a goal and see it
    captureAGoalAndSeeItResult.fail === 0 &&
    // firmware-explorer #1 — concept Elements & Sets viewer
    firmwareConceptElementsSetsResult.fail === 0 &&
    // tapestries #4 — per-concept detail views (Neo4j+LMDB read path)
    tapestryPerConceptDetailViewsResult.fail === 0 &&
    // second-brain #2 — structures the brain can trust (hygiene + reconcile)
    structuresTheBrainCanTrustResult.fail === 0 &&
    // second-brain #3 — break a goal into pieces (decomposition)
    breakAGoalIntoPiecesResult.fail === 0 &&
    // second-brain #4 — attach the world (pointers + one-spine detail)
    attachTheWorldResult.fail === 0 &&
    // second-brain #5 — sessions read the brain (work records + bounded orient)
    sessionsReadTheBrainResult.fail === 0 &&
    // second-brain #6 — the proposal loop (propose/decide + queue view)
    theProposalLoopResult.fail === 0 &&
    // tapestries #3 — create a tapestry (members-only authoring)
    createTapestryResult.fail === 0 &&
    // bug — tapestry-key handlePut must await the async LMDB write.
    tapestryKeyPutAwaitResult.fail === 0 &&
    // second-brain #7 — teach it what matters (priority signals)
    teachItWhatMattersResult.fail === 0 &&
    // second-brain #8 — the brain survives (export + restore drill)
    theBrainSurvivesResult.fail === 0 &&
    // operational-direction #1 — goal-derived Director run terms
    operationalDirectionResult.fail === 0 &&
    // goal-intent-fields #1 — store the four when a goal is captured or updated
    storeTheFourResult.fail === 0 &&
    // goal-intent-fields #2 — return the four on every read surface
    returnTheFourResult.fail === 0 &&
    // goal-intent-fields #3 — show the four on the goal screens that already exist
    showTheFourResult.fail === 0 &&
    // ta-avatar #1 — in-app badged TA avatar (S/R source class; ACs live in the Playwright class)
    inAppBadgedTaAvatarResult.fail === 0 &&
    // ta-avatar #2 — recognizable published TA profile defaults
    recognizablePublishedTaProfileResult.fail === 0 &&
    // ta-avatar #3 — the stamped composite avatar (server half)
    stampedCompositeAvatarResult.fail === 0 &&
    // tapestries #5 — add a concept to a tapestry (add-only, same-coordinate republish)
    addConceptToTapestryResult.fail === 0 &&
    // tapestries #6 — take a concept back out (remove-only, same-coordinate republish)
    takeAConceptBackOutResult.fail === 0 &&
    // tapestries #7 — brain-first tapestry authoring (publish-hook dual write)
    brainFirstTapestryAuthoringResult.fail === 0 &&
    // shared-concepts-adoption #1 — b-coverage audit + guided disposition
    bCoverageAuditAndDispositionResult.fail === 0 &&
    // shared-concepts-adoption #2 — adoption-candidates queue
    adoptionCandidatesQueueResult.fail === 0 &&
    // shared-concepts-adoption #3 — inverse queue (publish candidates)
    inverseQueuePublishCandidatesResult.fail === 0 &&
    // shared-concepts-adoption #4 — publish-time default stamping
    publishTimeDefaultStampingResult.fail === 0 &&
    // shared-concepts-adoption #5 — trusted dictionary
    trustedDictionaryResult.fail === 0 &&
    // shared-concepts-adoption #7 — graph-derived twin picker
    adoptionTwinsResult.fail === 0 &&
    // shared-concepts-adoption #9 — clickable rows → raw header event
    adoptionRawEventViewResult.fail === 0 &&
    // shared-concepts-legibility #1 — sharing state on the concept page
    stateOnConceptPageResult.fail === 0 &&
    // shared-concepts-legibility #2 — my offerings
    sharedByMeResult.fail === 0 &&
    // shared-concepts-seeding #2 — the vocabulary guard
    retireOfferingVocabularyResult.fail === 0 &&
    siteTrustSignalsResult.fail === 0 &&
    // shared-concepts-seeding #1 — honest broadcast reporting
    honestBroadcastReportingResult.fail === 0 &&
    // shared-concepts-seeding #3 — not-yet-shared filter on the Concepts list
    notYetSharedFilterResult.fail === 0 &&
    // shared-concepts-seeding #4 — route from Shared by me to the not-yet-shared list
    shareFromSharedByMeResult.fail === 0 &&
    harnessLintResult.fail === 0 &&
    harnessStatsResult.fail === 0 &&
    sessionStartResult.fail === 0 &&
    stackFreeNpmTestResult.fail === 0 &&
    ciTestJobResult.fail === 0 &&
    syncPanelTagFiltersResult.fail === 0 &&
    routerStreamTagFiltersResult.fail === 0 &&
    // note-trusted-list + tag-applicability republish — declared but never wired
    // into the gate before harness-gate-integrity #1 (OPEN.md #43); added here.
    noteTrustedListResult.fail === 0 &&
    applicabilityRepublishResult.fail === 0;
  // Aggregate skip visibility (story test-hermeticity-ci #2, reviewer
  // constraint: skips are counted, never silent). Purely informational —
  // overallOk above never consults .skipped.
  const totalSkipped = [
    profileTagsResult, publishResult, tagDetailResult, tagDetailPublishResult,
    tagDetailWriteResult, tagDetailWritePublishResult, tagIndexResult, tagIndexPublishResult,
    authoredTaggingResult, authoredTaggingPublishResult, profileTagPolishResult, profileTagPolishPublishResult,
    searchResultParityResult, searchResultsUrlResult, pinATagResult, pinATagPublishResult,
    tlPubFromPinsResult, tlPubFromPinsPublishResult, customizePinCurationPublishResult, mostPinnedTagIndexResult,
    mostPinnedTagIndexPublishResult, tagDetailCuratedResult, tagDetailCuratedPublishResult, restoreHistoricalDataAndTlFilterResult,
    treasureMapsResult, scheduledRefreshResult, strfryRouterFirstBootResult, perQueryNeo4jTimeoutResult,
    nip05CheckmarkVerificationResult, publishExportConceptResult, communityReferenceStubResult, nip51ListExportResult,
    nip51ListExportPublishResult, pinDetailIntoTagTabResult, collapseIntoExportResult, loginFailureAndTagCollapseResult,
    headerConceptGraphTagResult, communityReferenceSupersetLinkResult, graperankSharedCsvRaceResult, communityClassThreadPullResult,
    taskQueueBullmqResult, taskQueueNeo4jResourceClassResult, entrypointTemplateRenderingResult, bullboardAdminAccessResult,
    adminToolsDashboardPanelResult, createTapestryResult, teachItWhatMattersResult, theBrainSurvivesResult, reconciliationIncrementalModeResult, generalizedTaskSchedulerResult, reconciliationRearchitectureResult,
    scheduledTasksWithArgumentsResult, manualTaskRetriggerAfterFinishResult, scheduledTaskTimeoutPropagationResult, killTimeoutOrphansByDefaultResult,
    taskQueueSemaphoreProtectionAuditResult, profileFollowsListResult, profileWebsiteLinkResult, profileVerifiedFollowersCountResult,
    profileFollowersListResult, profileVerifiedReportersCountResult, verifiedReportersMembershipDataResult, verifiedReportersListPageResult,
    profileVerifiedCountsOwnerPovResult, profileVerifiedCountsExplainerAndAlarmResult, searchApiResultTypeSettingsResult, trustedListPinPublishBlockersResult,
    nostrUserTagHybridEaWriterResult, reputationInfoPopupResult, liveFeedReadPathResult, liveFeedFeedPageResult,
    noteSurfacesReadPathResult, noteSurfacesUiResult, eventPageReadPathResult, eventPageUiResult,
    verifiedReportersReportColumnsResult, profileIdentityDetailsPopoverResult, profileFollowsHopsResult, profileHopsPathResult,
    tagReadUnionResult, bTagPrimitiveResult, bTagSeedsResult, dualZWriterResult,
    openRankingStatsResult, openRankingSearchResult, openRankingRankResult, openRankingFollowersMutersResult, verifiedMutersReadApiResult, verifiedMutersProfileSurfaceResult,
    harnessLintResult, harnessStatsResult, sessionStartResult, stackFreeNpmTestResult,
    ciTestJobResult, syncPanelTagFiltersResult, routerStreamTagFiltersResult,
    noteTaggingRawEventsInspectorHttpResult, deploySafetyStatusResult, safeToMergeCheckResult, nextTaskCountdownResult,
    closeUnauthWriteSurfaceResult, defaultDenyMutationsResult, usersPageNeo4jEndpointResult, strfryWipeOwnerGateResult,
    relationshipPrimitivesResult, relationshipPrimitivesProbeResult, moveNodesBetweenSetsUiResult,
    captureAGoalAndSeeItResult, firmwareConceptElementsSetsResult, tapestryPerConceptDetailViewsResult, structuresTheBrainCanTrustResult,
    breakAGoalIntoPiecesResult, attachTheWorldResult, sessionsReadTheBrainResult, theProposalLoopResult,
    operationalDirectionResult, storeTheFourResult, returnTheFourResult, showTheFourResult,
    inAppBadgedTaAvatarResult, recognizablePublishedTaProfileResult, stampedCompositeAvatarResult,
    addConceptToTapestryResult, takeAConceptBackOutResult, brainFirstTapestryAuthoringResult,
    bCoverageAuditAndDispositionResult, adoptionCandidatesQueueResult, inverseQueuePublishCandidatesResult,
    publishTimeDefaultStampingResult, trustedDictionaryResult, adoptionTwinsResult, adoptionRawEventViewResult,
    stateOnConceptPageResult, sharedByMeResult, honestBroadcastReportingResult,
    retireOfferingVocabularyResult, siteTrustSignalsResult,
  ].reduce((sum, r) => sum + ((r && r.skipped) || 0), 0);
  console.log(`Total skipped:                                   ${totalSkipped}`);
  console.log(`Overall:                                         ${overallOk ? 'PASS' : 'FAIL'}`);
  process.exit(overallOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
