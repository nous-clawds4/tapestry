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
const profileVerifiedFollowersCount = require('./profile-verified-followers-count.test.js');
const profileFollowersList = require('./profile-followers-list.test.js');
const profileVerifiedReportersCount = require('./profile-verified-reporters-count.test.js');
const verifiedReportersMembershipData = require('./verified-reporters-membership-data.test.js');
const verifiedReportersListPage = require('./verified-reporters-list-page.test.js');
const profileVerifiedCountsOwnerPov = require('./profile-verified-counts-owner-pov.test.js');
const profileVerifiedCountsExplainerAndAlarm = require('./profile-verified-counts-explainer-and-alarm.test.js');
const reputationInfoPopup = require('./reputation-info-popup.test.js');

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

  console.log('\nreputation-info-popup suite:');
  const reputationInfoPopupResult = await reputationInfoPopup.run();

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
    `reputation-info-popup suite:                     ${reputationInfoPopupResult.fail === 0 ? 'PASS' : 'FAIL'} (${reputationInfoPopupResult.pass} passed, ${reputationInfoPopupResult.fail} failed)`
  );

  const overallOk =
    configOk &&
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
    reputationInfoPopupResult.fail === 0;
  console.log(`Overall:                                         ${overallOk ? 'PASS' : 'FAIL'}`);
  process.exit(overallOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
