# ADR 0001: Serve the briefing from its markdown file, and build the page from a pure prompt builder

**Status:** Proposed
**Date:** 2026-10-05
**Story:** `engineering-team/stories/information-for-agents/1-information-for-agents-page-and-briefing.md`

## Context

The story has two halves:

1. **Server.** Serve `docs/information-for-agents.md` at `/information-for-agents.md` as `text/plain; charset=utf-8` on every tapestry-fleet host. Exempt it from non-production `robots.txt`. Link it from `llms.txt` on the host's own domain.
2. **Page.** Build `/information-for-agents` in the `/developers` pages' style. It has a "What are you building?" box that fills a prompt live, a copy button, and links to the briefing and `/developers`. The `/developers` hub and `/brainstorm-skill` link to the page.

What the code already provides (stack absent this session, so this was read from source per AGENTS.md §2; no concept handles are involved):

- `src/utils/siteTrust.js` is the single owner of agent- and crawler-facing root documents: `buildSecurityTxt`, `buildRobotsTxt` (`:144`), `LLMS_TXT_PATH` / `buildLlmsTxt` (`:163`, `:200`), and `isBlockedProbePath` (`:226`). Its routes are registered in `bin/control-panel.js` after all `express.static` middleware and before the session middleware (`:183–201`, `:210`). The honest-404 deny rule (`:362`) and the SPA catch-all (`:373`) come later.
- **Path classification, checked.** `.md` is not in `BLOCKED_EXTENSIONS`, so `isBlockedProbePath('/information-for-agents.md')` is `false`. Without an explicit route, the request falls through to the SPA catch-all and returns the empty `index.html` shell with a `200`. That is exactly the failure this story exists to remove, and it would pass any check that looks only at the status code.
- `express.static(public)` (`:133`) serves `public/` at the root, and again under `/control` and `/legacy`. `send` maps `.md` to `text/markdown`.
- `buildRobotsTxt`'s non-indexing branch is `User-agent: *\nAllow: ${LLMS_TXT_PATH}\nDisallow: /\n`; the indexing branch is `User-agent: *\nAllow: /\n`. The existing suites assert the `/llms.txt` allow line by `indexOf` (`test/llms-txt.test.js:220`) and production's body by exact equality (`:211`). An added non-production line is compatible with both.
- `DOMAIN_NAME` is set per deployment (`docker-compose.yml:19`, defaulting to `localhost`; OPERATIONS.md §droplets). `security.txt` already derives `Canonical` from it and deliberately never from the attacker-controllable `Host` header (`siteTrust.js:95–104`).
- The `/developers` pages share `ui/src/pages/developers/DevPage.jsx` (top bar, centered column, `S` styles, `CopyBlock`) and derive host-specific URLs from `window.location` (`Nip50.jsx:3–5`).
- Node test suites load pure UI helpers by dynamic `import()` of import-free ESM files under `ui/src/` (`ui/package.json` is `"type": "module"`; e.g. `test/author-scoped-inspection-views.test.js:28`). New suites are registered in `test/registry.js`.

Constraints: no new build or lint tooling (CLAUDE.md house rule). No new UI dependency: there's no markdown renderer, and the story keeps the briefing as plain text. The briefing is static and identical for every viewer, so it's outside the four architecture invariants (story, "Concepts touched").

**This ADR amends one decision of `llms-txt/0001`.** That ADR fixed `llms.txt` as "static content, identical on all four hosts — no per-host templating." The story now requires a link to the briefing on the host's own domain, so `buildLlmsTxt` gains the same optional `domain` input `buildSecurityTxt` already takes. When no domain is configured, the output stays byte-identical to today's.

## Options considered

### Option A — Explicit route that reads the markdown file, inside the siteTrust block (chosen)

`siteTrust.js` gains the path constant and an async loader that reads `docs/information-for-agents.md`. `control-panel.js` registers `GET /information-for-agents.md` beside `/llms.txt`, sets the content type, and sends the file's text. The robots exemption and the `llms.txt` link both reference the same constant.

Pros:
- One file stays the source of the briefing, as the story requires, and it's readable on GitHub as normal markdown.
- The content type is under our control.
- The served path, the robots exemption and the `llms.txt` link can't drift apart, because all three use one constant in the module that already owns every agent-facing root document.
- Reading the file on each request means a dev bind-mount edit is live without a restart, the same as other source edits.

Cons:
- One more route whose placement matters: it must come before the SPA catch-all.
- The file is read on every request. That's negligible: about 15 KB, on a low-traffic path.

### Option B — Drop the file into `public/` and let `express.static` serve it

Pros: no route code at all.

Cons, decisive:
- It's served as `text/markdown`, which some browsers download instead of showing. That fails the story's content-type criterion.
- `public/` is also mounted at `/control` and `/legacy`, so the briefing would appear at three URLs.
- The file would live apart from the robots exemption and the `llms.txt` link: the split `llms-txt/0001` rejected for the same reasons.
- Moving the source into `public/` also changes where people edit it.

### Option C — Embed the briefing in `siteTrust.js` as a template literal, like `LLMS_TXT`

Pros: a pure function, unit-testable without the filesystem, and identical to the `llms.txt` precedent.

Cons, decisive:
- The story requires a markdown file as the single source.
- The briefing uses dozens of backticks for inline code, and every one would need escaping inside a JS template literal. The source becomes unreadable and edits become error-prone.
- `LLMS_TXT` works as a literal because it's a short pointer list that "almost never changes." The briefing is longer prose that will be revised as protocols mature.

### Page alternatives (considered, not written up as full options)

- **Render the briefing as HTML inside the page.** Rejected: it needs a markdown dependency, and the story keeps it out of scope.
- **Put the prompt text inline in the JSX.** Rejected in favor of a pure builder module: the exact prompt wording is a story criterion, so it should be unit-testable without a browser. The same reasoning was applied to `authorScope.js`.

## Decision

We chose **Option A** for the server and a **pure prompt-builder module plus a thin page component** for the UI.

The briefing must stay a markdown file people can edit, so it's read from disk rather than embedded. It must not reach a reader as the SPA shell or as a download, so it gets an explicit route with an explicit content type. It also has to stay in step with its robots exemption and its `llms.txt` link, so all three hang off one constant in `siteTrust.js`.

## Consequences

- **Enables:** a stable, plain-text, agent-readable URL on every tapestry host; a page whose prompt names that URL on the same origin; `llms.txt` pointing agents at the briefing.
- **Constrains:** `llms.txt` now varies by host when `DOMAIN_NAME` is set (amending `llms-txt/0001`). Its other links stay static and identical everywhere.
- **Constrains:** `docs/information-for-agents.md` is now served content, not an internal doc. Renaming or moving it breaks the route. The loader's path constant and a test sentinel (Test Design's to place) guard this.
- **New debt:** the briefing's links need re-verifying at the same renewal ritual that already covers `llms.txt`'s links (OPEN.md row 172). The briefing also states facts about live systems (endpoint shapes, the 0–1 vs 0–100 rank scales, maturity labels) that can go stale as production evolves. Its "Last reviewed" date makes staleness visible; keeping it current is an editorial duty, not something the code can check.
- **Known test hazard:** a link check run from a cloud container sees proxy 403s from Node's `fetch` (ledger `2026-10-04-llms-txt-egress-403-false-fail`). Test Design should not copy `llms-txt`'s L-class fetch unchanged; see Implementation notes.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

**File: `src/utils/siteTrust.js`**

- Add `const INFORMATION_FOR_AGENTS_PATH = '/information-for-agents.md';` — the one source for the served path.
- Add `const INFORMATION_FOR_AGENTS_SOURCE = path.join(__dirname, '../../docs/information-for-agents.md');` (add `require('path')` and `require('fs')` at the top; the module has no requires today).
- Add `function readInformationForAgents() { return fs.promises.readFile(INFORMATION_FOR_AGENTS_SOURCE, 'utf8'); }`. It's async, has no caching, and the caller handles errors.
- In `buildRobotsTxt`'s non-indexing branch, add `Allow: ${INFORMATION_FOR_AGENTS_PATH}` on its own line directly after the `/llms.txt` allow line and before `Disallow: /`. The indexing branch is untouched, so production stays byte-identical.
- Change `buildLlmsTxt()` to `buildLlmsTxt(opts = {})`. It normalizes `domain` exactly as `buildSecurityTxt` does: trim it, and treat empty or `localhost` as absent. With no domain, return `LLMS_TXT` unchanged, byte for byte. With a domain, insert this section immediately before `## Protocols`, so it's the first section an agent reads:

  ```markdown
  ## Start here

  - [Information for agents](https://<domain>/information-for-agents.md): what Brainstorm offers a nostr project — trust scores as NIP-85 events and over HTTP, relay whitelists, web-of-trust search, Decentralized Lists, Trusted Lists — with each piece's maturity and where to start.

  ```

  Don't alter the H1, the blockquote, the notes, or any other section.
- Export `INFORMATION_FOR_AGENTS_PATH`, `INFORMATION_FOR_AGENTS_SOURCE` and `readInformationForAgents`, and update the module's header comment to name the new document.

**File: `bin/control-panel.js`**

- Extend the `siteTrust` destructure (`:57`) with `INFORMATION_FOR_AGENTS_PATH, readInformationForAgents`.
- `/llms.txt` route (`:198`): pass the domain, as in `buildLlmsTxt({ domain: process.env.DOMAIN_NAME })`.
- Register the new route immediately after the `/llms.txt` route and before `app.use(session(...))` (`:210`):

  ```js
  app.get(INFORMATION_FOR_AGENTS_PATH, async (req, res) => {
      try {
          const body = await readInformationForAgents();
          res.set('Content-Type', 'text/plain; charset=utf-8');
          res.send(body);
      } catch (err) {
          console.error('information-for-agents.md: could not read the briefing:', err.message);
          res.status(500).type('text/plain').send('The briefing is temporarily unavailable.\n');
      }
  });
  ```

  Placement matters for two reasons. It has to come before the session middleware so agent fetches don't mint Redis sessions, matching the block's existing rationale. And it has to come before the SPA catch-all (`:373`), or the request returns the HTML shell with a `200`. The deny rule doesn't affect this path either way, because `.md` isn't a blocked extension. Extend the block's header comment to say so.

- **Guardrail:** do not also place a copy at `public/information-for-agents.md` or `ui/public/information-for-agents.md`. A static copy would be served first (static middleware precedes this route), as `text/markdown`, and silently diverge.

**File: `ui/src/utils/agentPrompt.js`** (new; import-free ESM so Node suites can `import()` it)

- `export const PROJECT_PLACEHOLDER = '<describe your project>';`
- `export const BRIEFING_PATH = '/information-for-agents.md';` (mirrors the server constant; a test asserts the two agree).
- `export function buildAgentPrompt({ project, origin })`. It trims `project` and uses `PROJECT_PLACEHOLDER` when the result is empty. It returns the story's prompt text verbatim, with `{project}` filled in and the URL set to `${origin}${BRIEFING_PATH}`. The text is plain, with no markdown bold. The story shows the project in bold only to mark the slot; the copied prompt must read naturally when pasted.

**File: `ui/src/pages/InformationForAgents.jsx`** (new)

- Wrap the page in `DevPage` with `title="The Technology Behind Brainstorm"` and `back={false}`. The page isn't a child of `/developers`, so it doesn't get the "← Developers" back link.
- Use the story's two intro paragraphs verbatim.
- Add a labeled `<textarea>` ("What are you building?", two rows, placeholder `a nostr client for long-form writers`) bound to state.
- Show the prompt from `buildAgentPrompt({ project, origin: window.location.origin })` in a box styled like `S.pre`, with `whiteSpace: 'pre-wrap'`.
  - **Use `origin`, not `https://` + `host`.** On every deployed host it reads `https://<host>`, as the story specifies. In local dev it reads `http://localhost:7778`, which resolves, whereas a hardcoded `https://` wouldn't.
- Add a "Copy prompt" button that calls `navigator.clipboard.writeText` and shows "Copied" for about 2 seconds. On rejection, or when `navigator.clipboard` is unavailable, it shows "Couldn't copy — select the text above and copy it."
- Links: "Read the briefing yourself" must be a plain `<a href="/information-for-agents.md">`, never a React Router `<Link>`, because client-side routing would render the SPA's NotFound instead of fetching the file. The `/developers` link is a `<Link>`.

**File: `ui/src/App.jsx`**: import the page and add `{ path: '/information-for-agents', element: <InformationForAgents /> }` next to the `/brainstorm-skill` route.

**File: `ui/src/pages/developers/Hub.jsx`**: add a card first, above the NIP-50 card, in the same `card` style. It links to `/information-for-agents` with the title "Ask your AI agent →" and the line "Describe your project and get a prompt for your agent, backed by a briefing on all of Brainstorm's scores and protocols."

**File: `ui/src/pages/BrainstormSkill.jsx`**: after the existing paragraphs, add one paragraph: "Building something on nostr? <Link to="/information-for-agents">Ask your agent how to use Brainstorm's technology</Link>."

**Tests (Phase 3's to finalize; named here per role convention):** a new `test/information-for-agents.test.js`, registered in `test/registry.js`, in the `llms-txt.test.js` shape.

- **U-class:** the robots allow line and production's unchanged body; `buildLlmsTxt()` byte-identical with no domain or `localhost`, and with the one new section otherwise; `readInformationForAgents()` resolving to the file's content; `buildAgentPrompt` covering the placeholder, trimming, origin and the exact wording.
- **S-class sentinels:**
  - the route is registered before the session middleware and the catch-all;
  - no static copy of the file exists in `public/` or `ui/public/`;
  - the page links the briefing with `<a href>`, not `<Link>`;
  - the route exists in `App.jsx`, and `Hub.jsx` and `BrainstormSkill.jsx` link to it;
  - the UI's `BRIEFING_PATH` matches the server's constant.
- **H-class:** live checks against `:7778`, skipped per test when the stack is absent.
- **L-class link check over the briefing's links:** it must not repeat the egress-403 false fail. Route the fetch through `HTTPS_PROXY` when it's set, or classify a proxy-originated 403 as SKIP. The Tester picks one and records why.

Existing `site-trust-signals` and `llms-txt` suites must pass unmodified. All of their U-class and S-class checks call `buildLlmsTxt()` without a domain or match the route by its path, so they're unaffected.

One caveat is for Test Design to weigh. `llms-txt` H1 (`test/llms-txt.test.js:~273`) asserts that the live `/llms.txt` equals `buildLlmsTxt()` with no domain. That holds whenever the stack under test runs with `DOMAIN_NAME` unset or `localhost`, which is the docker-compose default and the only way any workflow or deploy skill runs that suite today (checked: no skill or CI job sets `BRAINSTORM_BASE_URL` to a deployed host). If someone points `BRAINSTORM_BASE_URL` at a deployed host, H1 would now fail by design. Test Design decides whether to leave that documented or loosen H1, for example to accept either the domainless body or that body plus the one "Start here" section.

## Out of scope

- The briefing's wording, which was approved at Planning. This ADR only decides how it's served.
- Serving on `brainstorm.world` (Product UI fleet).
- Fixing the existing `llms-txt` L-class egress false fail itself (ledger `2026-10-04-llms-txt-egress-403-false-fail`). The new suite avoids the hazard, and the old suite's fix stays with that ledger row.
- Any change to `ALLOW_INDEXING` or to production's `robots.txt`.
