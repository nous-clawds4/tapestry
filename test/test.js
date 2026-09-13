/**
 * Brainstorm test entry point — `npm test` (package.json).
 *
 * Runs every suite in test/registry.js through the gate engine
 * (test/helpers/gateRunner.js), which writes a run record under tmp/gate-runs/ and
 * exits with the verdict it recorded. Read a run's result with `npm run gate:status`:
 * engineering-team/README.md — "Running and reading the test gate"
 * (honest-test-gate #1, ADR honest-test-gate/0001).
 *
 * Adding a suite is one line in test/registry.js.
 */

// Mock environment variables for the config smoke check (the registry's first entry).
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';

const { runGate } = require('./helpers/gateRunner');

runGate({ suites: require('./registry').suites, label: process.env.GATE_LABEL });
