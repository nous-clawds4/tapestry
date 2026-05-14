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

const profileTags = require('./profile-tags.test.js');
const profileTagsPublish = require('./profile-tags-publish.test.js');
const tagDetail = require('./tag-detail.test.js');
const tagDetailPublish = require('./tag-detail-publish.test.js');
const tagIndex = require('./tag-index.test.js');
const tagIndexPublish = require('./tag-index-publish.test.js');

async function main() {
  console.log('Running Brainstorm tests...');

  const configOk = testConfigLoading();
  console.log(`Configuration Loading: ${configOk ? 'PASS' : 'FAIL'}`);

  const profileTagsResult = await profileTags.run();
  const publishResult = await profileTagsPublish.run();
  const tagDetailResult = await tagDetail.run();
  const tagDetailPublishResult = await tagDetailPublish.run();
  const tagIndexResult = await tagIndex.run();
  const tagIndexPublishResult = await tagIndexPublish.run();

  console.log('\nTest Results');
  console.log('-------------');
  console.log(`Configuration Loading:        ${configOk ? 'PASS' : 'FAIL'}`);
  console.log(`profile-tags suite:           ${profileTagsResult.fail === 0 ? 'PASS' : 'FAIL'} (${profileTagsResult.pass} passed, ${profileTagsResult.fail} failed)`);
  const publishLine = publishResult.skipped
    ? `SKIP (${publishResult.skipped} tests; preconditions not met)`
    : `${publishResult.fail === 0 ? 'PASS' : 'FAIL'} (${publishResult.pass} passed, ${publishResult.fail} failed)`;
  console.log(`profile-tags-publish suite:   ${publishLine}`);
  console.log(`tag-detail suite:             ${tagDetailResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailResult.pass} passed, ${tagDetailResult.fail} failed)`);
  const tdpLine = tagDetailPublishResult.skipped
    ? `SKIP (${tagDetailPublishResult.skipped} tests; preconditions not met)`
    : `${tagDetailPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagDetailPublishResult.pass} passed, ${tagDetailPublishResult.fail} failed)`;
  console.log(`tag-detail-publish suite:     ${tdpLine}`);
  console.log(`tag-index suite:              ${tagIndexResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagIndexResult.pass} passed, ${tagIndexResult.fail} failed)`);
  const tipLine = tagIndexPublishResult.skipped
    ? `SKIP (${tagIndexPublishResult.skipped} tests; preconditions not met)`
    : `${tagIndexPublishResult.fail === 0 ? 'PASS' : 'FAIL'} (${tagIndexPublishResult.pass} passed, ${tagIndexPublishResult.fail} failed)`;
  console.log(`tag-index-publish suite:      ${tipLine}`);

  const overallOk = configOk
    && profileTagsResult.fail === 0
    && publishResult.fail === 0
    && tagDetailResult.fail === 0
    && tagDetailPublishResult.fail === 0
    && tagIndexResult.fail === 0
    && tagIndexPublishResult.fail === 0;
  console.log(`Overall:                      ${overallOk ? 'PASS' : 'FAIL'}`);
  process.exit(overallOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
