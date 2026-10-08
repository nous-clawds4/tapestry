// The prompt the /information-for-agents page hands a builder to paste into their own AI agent
// (information-for-agents #1, ADR 0001). Pure and import-free: Node test suites load this file directly.

export const PROJECT_PLACEHOLDER = '<describe your project>';

// Must equal the server's INFORMATION_FOR_AGENTS_PATH (src/utils/siteTrust.js); a test checks the two agree.
export const BRIEFING_PATH = '/information-for-agents.md';

// One paragraph of plain text, so it pastes cleanly anywhere. `origin` is the page's own
// (window.location.origin), so staging's prompt names staging's briefing and local dev's resolves.
export function buildAgentPrompt({ project, origin }) {
  const described = String(project ?? '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
  const slot = described || PROJECT_PLACEHOLDER;
  return `I'm building ${slot}. I'd like to use Brainstorm's web-of-trust technology in it: ` +
    'reputation scores, NIP-85 Trusted Assertions, Decentralized Lists, Trusted Lists, and the other ' +
    `protocols behind them. Read ${origin}${BRIEFING_PATH} and follow its links to the specs that apply ` +
    "to my project. Then tell me which pieces fit, how I'd integrate them, and what to build first. " +
    "Point out anything that is still a draft. If you can't open web pages, tell me and I'll paste the file in.";
}
