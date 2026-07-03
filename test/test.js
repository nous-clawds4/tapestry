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
const eventTaggingForTag = require('./event-tagging-for-tag.test.js');
const unifiedTagIndex = require('./unified-tag-index.test.js');
const eventTaggingNotesByAuthor = require('./event-tagging-notes-by-author.test.js');
const unifiedTagsDirectory = require('./unified-tags-directory.test.js');
const profileAuthoredNotesUi = require('./profile-authored-notes-ui.test.js');
// epic: feed-usability — Story 1 (notes/replies toggle)
const notesRepliesToggle = require('./notes-replies-toggle.test.js');

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

  console.log('\nTest Results');
  console.log('-------------');
  console.log(`Configuration Loading:                           ${configOk ? 'PASS' : 'FAIL'}`);
  console.log(`profile-tags suite:                              ${profileTagsResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagsResult.pass} passed, ${profileTagsResult.fail} failed)`);
  const publishLine = publishResult.skipped
    ? `SKIP (${publishResult.skipped} tests; preconditions not met)`
    : `${publishResult.fail === 0 ? 'PASS' : 'FAIL'} (${publishResult.pass} passed, ${publishResult.fail} failed)`;
  console.log(`profile-tags-publish suite:                      ${publishLine}`);
  console.log(`tag-detail suite:                                ${tagDetailResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailResult.pass} passed, ${tagDetailResult.fail} failed)`);
  const tdpLine = tagDetailPublishResult.skipped
    ? `SKIP (${tagDetailPublishResult.skipped} tests; preconditions not met)`
    : `${tagDetailPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailPublishResult.pass} passed, ${tagDetailPublishResult.fail} failed)`;
  console.log(`tag-detail-publish suite:                        ${tdpLine}`);
  console.log(`tag-detail-write suite:                          ${tagDetailWriteResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailWriteResult.pass} passed, ${tagDetailWriteResult.fail} failed)`);
  const tdwpLine = tagDetailWritePublishResult.skipped
    ? `SKIP (${tagDetailWritePublishResult.skipped} tests; preconditions not met)`
    : `${tagDetailWritePublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailWritePublishResult.pass} passed, ${tagDetailWritePublishResult.fail} failed)`;
  console.log(`tag-detail-write-publish suite:                  ${tdwpLine}`);
  console.log(`tag-index suite:                                 ${tagIndexResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagIndexResult.pass} passed, ${tagIndexResult.fail} failed)`);
  const tipLine = tagIndexPublishResult.skipped
    ? `SKIP (${tagIndexPublishResult.skipped} tests; preconditions not met)`
    : `${tagIndexPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagIndexPublishResult.pass} passed, ${tagIndexPublishResult.fail} failed)`;
  console.log(`tag-index-publish suite:                         ${tipLine}`);
  console.log(`authored-tagging suite:                          ${authoredTaggingResult.fail === 0 ? 'PASS' : 'FAIL'} (${authoredTaggingResult.pass} passed, ${authoredTaggingResult.fail} failed)`);
  const atpLine = authoredTaggingPublishResult.skipped
    ? `SKIP (${authoredTaggingPublishResult.skipped} tests; preconditions not met)`
    : `${authoredTaggingPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${authoredTaggingPublishResult.pass} passed, ${authoredTaggingPublishResult.fail} failed)`;
  console.log(`authored-tagging-publish suite:                  ${atpLine}`);
  console.log(`profile-tag-polish suite:                        ${profileTagPolishResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagPolishResult.pass} passed, ${profileTagPolishResult.fail} failed)`);
  const ptppLine = profileTagPolishPublishResult.skipped
    ? `SKIP (${profileTagPolishPublishResult.skipped} tests; preconditions not met)`
    : `${profileTagPolishPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagPolishPublishResult.pass} passed, ${profileTagPolishPublishResult.fail} failed)`;
  console.log(`profile-tag-polish-publish suite:                ${ptppLine}`);
  console.log(`search-result-parity suite:                      ${searchResultParityResult.fail === 0 ? 'PASS' : 'FAIL'} (${searchResultParityResult.pass} passed, ${searchResultParityResult.fail} failed)`);
  console.log(`search-results-url suite:                        ${searchResultsUrlResult.fail === 0 ? 'PASS' : 'FAIL'} (${searchResultsUrlResult.pass} passed, ${searchResultsUrlResult.fail} failed)`);
  console.log(`pin-a-tag suite:                                 ${pinATagResult.fail === 0 ? 'PASS' : 'FAIL'} (${pinATagResult.pass} passed, ${pinATagResult.fail} failed)`);
  const patpLine = pinATagPublishResult.skipped
    ? `SKIP (${pinATagPublishResult.skipped} tests; preconditions not met)`
    : `${pinATagPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${pinATagPublishResult.pass} passed, ${pinATagPublishResult.fail} failed)`;
  console.log(`pin-a-tag-publish suite:                         ${patpLine}`);
  console.log(`tl-publication-from-pins suite:                  ${tlPubFromPinsResult.fail === 0 ? 'PASS' : 'FAIL'} (${tlPubFromPinsResult.pass} passed, ${tlPubFromPinsResult.fail} failed)`);
  const tlppLine = tlPubFromPinsPublishResult.skipped
    ? `SKIP (${tlPubFromPinsPublishResult.skipped} tests; preconditions not met)`
    : `${tlPubFromPinsPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tlPubFromPinsPublishResult.pass} passed, ${tlPubFromPinsPublishResult.fail} failed)`;
  console.log(`tl-publication-from-pins-publish suite:          ${tlppLine}`);
  const cpcLine = customizePinCurationPublishResult.skipped
    ? `SKIP (${customizePinCurationPublishResult.skipped} tests; preconditions not met)`
    : `${customizePinCurationPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${customizePinCurationPublishResult.pass} passed, ${customizePinCurationPublishResult.fail} failed)`;
  console.log(`customize-pin-curation-publish suite:            ${cpcLine}`);
  console.log(`most-pinned-tag-index suite:                     ${mostPinnedTagIndexResult.fail === 0 ? 'PASS' : 'FAIL'} (${mostPinnedTagIndexResult.pass} passed, ${mostPinnedTagIndexResult.fail} failed)`);
  const mptpLine = mostPinnedTagIndexPublishResult.skipped
    ? `SKIP (${mostPinnedTagIndexPublishResult.skipped} tests; preconditions not met)`
    : `${mostPinnedTagIndexPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${mostPinnedTagIndexPublishResult.pass} passed, ${mostPinnedTagIndexPublishResult.fail} failed)`;
  console.log(`most-pinned-tag-index-publish suite:             ${mptpLine}`);
  console.log(`tag-detail-curated-view-and-pin-polish suite:    ${tagDetailCuratedResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailCuratedResult.pass} passed, ${tagDetailCuratedResult.fail} failed)`);
  const tdcpLine = tagDetailCuratedPublishResult.skipped
    ? `SKIP (${tagDetailCuratedPublishResult.skipped} tests; preconditions not met)`
    : `${tagDetailCuratedPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailCuratedPublishResult.pass} passed, ${tagDetailCuratedPublishResult.fail} failed)`;
  console.log(`tag-detail-curated-view-and-pin-polish-publish suite: ${tdcpLine}`);
  console.log(`restore-historical-data-and-fix-tl-author-filter suite: ${restoreHistoricalDataAndTlFilterResult.fail === 0 ? 'PASS' : 'FAIL'} (${restoreHistoricalDataAndTlFilterResult.pass} passed, ${restoreHistoricalDataAndTlFilterResult.fail} failed)`);
  console.log(`treasure-maps-router-preset suite:               ${treasureMapsResult.fail === 0 ? 'PASS' : 'FAIL'} (${treasureMapsResult.pass} passed, ${treasureMapsResult.fail} failed)`);
  console.log(`scheduled-search-and-house-scores-refresh suite: ${scheduledRefreshResult.fail === 0 ? 'PASS' : 'FAIL'} (${scheduledRefreshResult.pass} passed, ${scheduledRefreshResult.fail} failed)`);
  console.log(`strfry-router-first-boot-config suite:           ${strfryRouterFirstBootResult.fail === 0 ? 'PASS' : 'FAIL'} (${strfryRouterFirstBootResult.pass} passed, ${strfryRouterFirstBootResult.fail} failed)`);
  console.log(`per-query-neo4j-timeout-safety-net suite:        ${perQueryNeo4jTimeoutResult.fail === 0 ? 'PASS' : 'FAIL'} (${perQueryNeo4jTimeoutResult.pass} passed, ${perQueryNeo4jTimeoutResult.fail} failed)`);
  console.log(`nip05-checkmark-verification suite:              ${nip05CheckmarkVerificationResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip05CheckmarkVerificationResult.pass} passed, ${nip05CheckmarkVerificationResult.fail} failed)`);
  console.log(`publish-export-a-concept suite:                  ${publishExportConceptResult.fail === 0 ? 'PASS' : 'FAIL'} (${publishExportConceptResult.pass} passed, ${publishExportConceptResult.fail} failed)`);
  console.log(`community-reference-nostr-relay-stub suite:      ${communityReferenceStubResult.fail === 0 ? 'PASS' : 'FAIL'} (${communityReferenceStubResult.pass} passed, ${communityReferenceStubResult.fail} failed)`);
  console.log(`nip51-list-export-from-pins suite:               ${nip51ListExportResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip51ListExportResult.pass} passed, ${nip51ListExportResult.fail} failed)`);
  const nleLine = nip51ListExportPublishResult.skipped
    ? `SKIP (${nip51ListExportPublishResult.skipped} tests; preconditions not met)`
    : `${nip51ListExportPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip51ListExportPublishResult.pass} passed, ${nip51ListExportPublishResult.fail} failed)`;
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
    `verified-muters-read-api suite:                  ${verifiedMutersReadApiResult.fail === 0 ? 'PASS' : 'FAIL'} (${verifiedMutersReadApiResult.pass} passed, ${verifiedMutersReadApiResult.fail} failed)`
  );
  console.log(
    `verified-muters-profile-surface suite:           ${verifiedMutersProfileSurfaceResult.fail === 0 ? 'PASS' : 'FAIL'} (${verifiedMutersProfileSurfaceResult.pass} passed, ${verifiedMutersProfileSurfaceResult.fail} failed)`
  );

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
    bTagPrimitiveResult.fail === 0 &&
    bTagSeedsResult.fail === 0 &&
    dualZWriterResult.fail === 0 &&
    openRankingStatsResult.fail === 0 &&
    openRankingSearchResult.fail === 0 &&
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
    notesRepliesToggleResult.fail === 0;
  console.log(`Overall:                                         ${overallOk ? 'PASS' : 'FAIL'}`);
  process.exit(overallOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
