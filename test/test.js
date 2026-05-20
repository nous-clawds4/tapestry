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
// Suites added on main since this branch forked
const treasureMaps = require('./treasure-maps-router-preset.test.js');
const scheduledRefresh = require('./scheduled-search-and-house-scores-refresh.test.js');
const strfryRouterFirstBoot = require('./strfry-router-first-boot-config.test.js');
const perQueryNeo4jTimeout = require('./per-query-neo4j-timeout-safety-net.test.js');
const nip05CheckmarkVerification = require('./nip05-checkmark-verification.test.js');
const publishExportConcept = require('./publish-export-a-concept.test.js');
const communityReferenceStub = require('./community-reference-nostr-relay-stub.test.js');

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
  console.log(`treasure-maps-router-preset suite:               ${treasureMapsResult.fail === 0 ? 'PASS' : 'FAIL'} (${treasureMapsResult.pass} passed, ${treasureMapsResult.fail} failed)`);
  console.log(`scheduled-search-and-house-scores-refresh suite: ${scheduledRefreshResult.fail === 0 ? 'PASS' : 'FAIL'} (${scheduledRefreshResult.pass} passed, ${scheduledRefreshResult.fail} failed)`);
  console.log(`strfry-router-first-boot-config suite:           ${strfryRouterFirstBootResult.fail === 0 ? 'PASS' : 'FAIL'} (${strfryRouterFirstBootResult.pass} passed, ${strfryRouterFirstBootResult.fail} failed)`);
  console.log(`per-query-neo4j-timeout-safety-net suite:        ${perQueryNeo4jTimeoutResult.fail === 0 ? 'PASS' : 'FAIL'} (${perQueryNeo4jTimeoutResult.pass} passed, ${perQueryNeo4jTimeoutResult.fail} failed)`);
  console.log(`nip05-checkmark-verification suite:              ${nip05CheckmarkVerificationResult.fail === 0 ? 'PASS' : 'FAIL'} (${nip05CheckmarkVerificationResult.pass} passed, ${nip05CheckmarkVerificationResult.fail} failed)`);
  console.log(`publish-export-a-concept suite:                  ${publishExportConceptResult.fail === 0 ? 'PASS' : 'FAIL'} (${publishExportConceptResult.pass} passed, ${publishExportConceptResult.fail} failed)`);
  console.log(`community-reference-nostr-relay-stub suite:      ${communityReferenceStubResult.fail === 0 ? 'PASS' : 'FAIL'} (${communityReferenceStubResult.pass} passed, ${communityReferenceStubResult.fail} failed)`);

  const overallOk = configOk
    && profileTagsResult.fail === 0
    && publishResult.fail === 0
    && tagDetailResult.fail === 0
    && tagDetailPublishResult.fail === 0
    && tagDetailWriteResult.fail === 0
    && tagDetailWritePublishResult.fail === 0
    && tagIndexResult.fail === 0
    && tagIndexPublishResult.fail === 0
    && authoredTaggingResult.fail === 0
    && authoredTaggingPublishResult.fail === 0
    && profileTagPolishResult.fail === 0
    && profileTagPolishPublishResult.fail === 0
    && searchResultParityResult.fail === 0
    && searchResultsUrlResult.fail === 0
    && pinATagResult.fail === 0
    && pinATagPublishResult.fail === 0
    && tlPubFromPinsResult.fail === 0
    && tlPubFromPinsPublishResult.fail === 0
    && customizePinCurationPublishResult.fail === 0
    && mostPinnedTagIndexResult.fail === 0
    && mostPinnedTagIndexPublishResult.fail === 0
    && treasureMapsResult.fail === 0
    && scheduledRefreshResult.fail === 0
    && strfryRouterFirstBootResult.fail === 0
    && perQueryNeo4jTimeoutResult.fail === 0
    && nip05CheckmarkVerificationResult.fail === 0
    && publishExportConceptResult.fail === 0
    && communityReferenceStubResult.fail === 0;
  console.log(`Overall:                                         ${overallOk ? 'PASS' : 'FAIL'}`);
  process.exit(overallOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
