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

const treasureMaps = require('./treasure-maps-router-preset.test.js');
const scheduledRefresh = require('./scheduled-search-and-house-scores-refresh.test.js');
const strfryRouterFirstBoot = require('./strfry-router-first-boot-config.test.js');
const perQueryNeo4jTimeout = require('./per-query-neo4j-timeout-safety-net.test.js');
const communitiesUiScaffold = require('./communities-ui-scaffold.test.js');
const firmwareV110Finalization = require('./firmware-v1.1.0-finalization.test.js');
const grCommunityScoringAndApi = require('./gr-community-scoring-and-api.test.js');
const discoverSwapsMockDataForApi = require('./discover-swaps-mock-data-for-api.test.js');
const nip07SigninAndWrites = require('./nip07-signin-and-writes.test.js');
const createFlowPublishes = require('./create-flow-publishes.test.js');
const participateKind1ReadsWrites = require('./participate-kind1-reads-writes.test.js');
const nip05CheckmarkVerification = require('./nip05-checkmark-verification.test.js');
const publishExportConcept = require('./publish-export-a-concept.test.js');
const communityReferenceStub = require('./community-reference-nostr-relay-stub.test.js');
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
const foundACircle = require('./found-a-circle.test.js');
const viewACircle = require('./view-a-circle.test.js');
const discoverCircles = require('./discover-circles.test.js');

async function main() {
  console.log('Running Brainstorm tests...\n');

  const configOk = testConfigLoading();
  console.log(`\nConfiguration Loading: ${configOk ? 'PASS' : 'FAIL'}\n`);

  console.log('treasure-maps-router-preset suite:');
  const treasureMapsResult = await treasureMaps.run();

  console.log('\nscheduled-search-and-house-scores-refresh suite:');
  const scheduledRefreshResult = await scheduledRefresh.run();

  console.log('\nstrfry-router-first-boot-config suite:');
  const strfryRouterFirstBootResult = await strfryRouterFirstBoot.run();

  console.log('\nper-query-neo4j-timeout-safety-net suite:');
  const perQueryNeo4jTimeoutResult = await perQueryNeo4jTimeout.run();

  console.log('\ncommunities-ui-scaffold suite:');
  const communitiesUiScaffoldResult = await communitiesUiScaffold.run();

  console.log('\nfirmware-v1.1.0-finalization suite:');
  const firmwareV110FinalizationResult = await firmwareV110Finalization.run();

  console.log('\ngr-community-scoring-and-api suite:');
  const grCommunityScoringAndApiResult = await grCommunityScoringAndApi.run();

  console.log('\ndiscover-swaps-mock-data-for-api suite:');
  const discoverSwapsMockDataForApiResult = await discoverSwapsMockDataForApi.run();

  console.log('\nnip07-signin-and-writes suite:');
  const nip07SigninAndWritesResult = await nip07SigninAndWrites.run();

  console.log('\ncreate-flow-publishes suite:');
  const createFlowPublishesResult = await createFlowPublishes.run();

  console.log('\nparticipate-kind1-reads-writes suite:');
  const participateKind1Result = await participateKind1ReadsWrites.run();
  console.log('\nnip05-checkmark-verification suite:');
  const nip05CheckmarkVerificationResult = await nip05CheckmarkVerification.run();

  console.log('\npublish-export-a-concept suite:');
  const publishExportConceptResult = await publishExportConcept.run();

  console.log('\ncommunity-reference-nostr-relay-stub suite:');
  const communityReferenceStubResult = await communityReferenceStub.run();

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

  console.log('\nfound-a-circle suite:');
  const foundACircleResult = await foundACircle.run();

  console.log('\nview-a-circle suite:');
  const viewACircleResult = await viewACircle.run();

  console.log('\ndiscover-circles suite:');
  const discoverCirclesResult = await discoverCircles.run();

  console.log('\nTest Results');
  console.log('-------------');
  console.log(`Configuration Loading:                           ${configOk ? 'PASS' : 'FAIL'}`);
  console.log(
    `treasure-maps-router-preset suite:               ${treasureMapsResult.fail === 0 ? 'PASS' : 'FAIL'} (${treasureMapsResult.pass} passed, ${treasureMapsResult.fail} failed)`
  );
  console.log(
    `scheduled-search-and-house-scores-refresh suite: ${scheduledRefreshResult.fail === 0 ? 'PASS' : 'FAIL'} (${scheduledRefreshResult.pass} passed, ${scheduledRefreshResult.fail} failed)`
  );
  console.log(
    `strfry-router-first-boot-config suite:           ${strfryRouterFirstBootResult.fail === 0 ? 'PASS' : 'FAIL'} (${strfryRouterFirstBootResult.pass} passed, ${strfryRouterFirstBootResult.fail} failed)`
  );
  console.log(
    `per-query-neo4j-timeout-safety-net suite:        ${perQueryNeo4jTimeoutResult.fail === 0 ? 'PASS' : 'FAIL'} (${perQueryNeo4jTimeoutResult.pass} passed, ${perQueryNeo4jTimeoutResult.fail} failed)`
  );
  console.log(
    `communities-ui-scaffold suite:                   ${communitiesUiScaffoldResult.fail === 0 ? 'PASS' : 'FAIL'} (${communitiesUiScaffoldResult.pass} passed, ${communitiesUiScaffoldResult.fail} failed)`
  );
  console.log(
    `firmware-v1.1.0-finalization suite:              ${firmwareV110FinalizationResult.fail === 0 ? 'PASS' : 'FAIL'} (${firmwareV110FinalizationResult.pass} passed, ${firmwareV110FinalizationResult.fail} failed)`
  );
  console.log(
    `gr-community-scoring-and-api suite:              ${grCommunityScoringAndApiResult.fail === 0 ? 'PASS' : 'FAIL'} (${grCommunityScoringAndApiResult.pass} passed, ${grCommunityScoringAndApiResult.fail} failed)`
  );
  console.log(
    `discover-swaps-mock-data-for-api suite:          ${discoverSwapsMockDataForApiResult.fail === 0 ? 'PASS' : 'FAIL'} (${discoverSwapsMockDataForApiResult.pass} passed, ${discoverSwapsMockDataForApiResult.fail} failed)`
  );
  console.log(
    `nip07-signin-and-writes suite:                   ${nip07SigninAndWritesResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip07SigninAndWritesResult.pass} passed, ${nip07SigninAndWritesResult.fail} failed)`
  );
  console.log(
    `create-flow-publishes suite:                     ${createFlowPublishesResult.fail === 0 ? 'PASS' : 'FAIL'} (${createFlowPublishesResult.pass} passed, ${createFlowPublishesResult.fail} failed)`
  );
  console.log(
    `participate-kind1-reads-writes suite:            ${participateKind1Result.fail === 0 ? 'PASS' : 'FAIL'} (${participateKind1Result.pass} passed, ${participateKind1Result.fail} failed)`
  );
  console.log(
    `nip05-checkmark-verification suite:              ${nip05CheckmarkVerificationResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip05CheckmarkVerificationResult.pass} passed, ${nip05CheckmarkVerificationResult.fail} failed)`
  );
  console.log(
    `publish-export-a-concept suite:                  ${publishExportConceptResult.fail === 0 ? 'PASS' : 'FAIL'} (${publishExportConceptResult.pass} passed, ${publishExportConceptResult.fail} failed)`
  );
  console.log(
    `community-reference-nostr-relay-stub suite:      ${communityReferenceStubResult.fail === 0 ? 'PASS' : 'FAIL'} (${communityReferenceStubResult.pass} passed, ${communityReferenceStubResult.fail} failed)`
  );
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
    `found-a-circle suite:                            ${foundACircleResult.fail === 0 ? 'PASS' : 'FAIL'} (${foundACircleResult.pass} passed, ${foundACircleResult.fail} failed)`
  );
  console.log(
    `view-a-circle suite:                             ${viewACircleResult.fail === 0 ? 'PASS' : 'FAIL'} (${viewACircleResult.pass} passed, ${viewACircleResult.fail} failed)`
  );
  console.log(
    `discover-circles suite:                          ${discoverCirclesResult.fail === 0 ? 'PASS' : 'FAIL'} (${discoverCirclesResult.pass} passed, ${discoverCirclesResult.fail} failed)`
  );

  const overallOk =
    configOk &&
    treasureMapsResult.fail === 0 &&
    scheduledRefreshResult.fail === 0 &&
    strfryRouterFirstBootResult.fail === 0 &&
    perQueryNeo4jTimeoutResult.fail === 0 &&
    communitiesUiScaffoldResult.fail === 0 &&
    firmwareV110FinalizationResult.fail === 0 &&
    grCommunityScoringAndApiResult.fail === 0 &&
    discoverSwapsMockDataForApiResult.fail === 0 &&
    nip07SigninAndWritesResult.fail === 0 &&
    createFlowPublishesResult.fail === 0 &&
    participateKind1Result.fail === 0 &&
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
    foundACircleResult.fail === 0 &&
    viewACircleResult.fail === 0 &&
    discoverCirclesResult.fail === 0;
  console.log(`Overall:                                         ${overallOk ? 'PASS' : 'FAIL'}`);
  process.exit(overallOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
