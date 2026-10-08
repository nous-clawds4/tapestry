# Review: Story 1 — Information for agents: the page and the briefing

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-05
**Diff:** `git diff origin/staging...HEAD` (base `e5c0b923`, HEAD `d67c6dad`, branch `claude/bold-noether-fbtzrv`). Phase commits: plan `5c9909b` + `2e5ef36`, ADR `67efdc6` + `2832696`, tests `5fe316c`, implementation `6a4b230` + `d67c6da`.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`: I ran the full gate myself on a clean tree at `d67c6dad` (`GATE_LABEL=review-ifa npm test`). The `npm run gate:status` line:

  ```
  20261005T195530Z-19384-90f7 [review-ifa] started 2026-10-05T19:55:30.353Z on d67c6dad — PASS, exit 0, 4917 passed, 0 failed, 579 skipped, 269/269 suites · /home/user/tapestry/tmp/gate-runs/20261005T195530Z-19384-90f7.json
  ```

  No suite failed, so no failure needed classifying against the base. Relevant suites in that run:
  - `information-for-agents`: 51 passed, 0 failed, 6 skipped.
  - `llms-txt`: 24 passed, 0 failed, 3 skipped. It ran unmodified. Its known egress hazard (ledger `2026-10-04-llms-txt-egress-403-false-fail`) didn't produce a failure this run.
  - `site-trust-signals`: 20 passed, 0 failed, 8 skipped (unmodified).
  - `harness-lint`: 76 passed, 0 failed. The possible pre-existing L10 issue didn't appear.

  Standalone, `node test/information-for-agents.test.js` gave 51 passed, 0 failed, 6 skipped. The 6 skips are:
  - H1–H4: no stack in this cloud session, so `:7778` is unreachable.
  - L1 for `https://brainstorm.world` and `https://relay.tools`: the sandbox egress gateway refuses both hosts. I confirmed with curl through the configured proxy that it is the gateway refusing: `CONNECT tunnel failed, response 403` for both.

  The other 19 briefing links resolved with a 2xx from this container.

  `git diff 5fe316c HEAD -- test/` is empty, so the Implementer did not touch the Tester's suite or the registry.
- [x] `npm run test:playwright`: not applicable. Browser behavior was checked in headless Chromium instead; see "Browser verification" below.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._ I ran `vite build` of `ui/` at HEAD into a scratch directory for the browser check. It built cleanly; the only warning is the existing chunk-size one.

### Browser verification (stand-in server, not the real control panel)

The Implementer checked the page in headless Chromium against a stand-in HTTP server. The stand-in uses the real `src/utils/siteTrust.js` builders and loader, plus a `vite build` of the branch. I didn't rely on that build. I made my own `vite build` from HEAD, ran my own copy of the stand-in with `DOMAIN_NAME=staging.brainstorm.world`, and ran an extended check script. Results:

- **Page and prompt:**
  - The title and both intro paragraphs render.
  - With the box empty, the prompt's slot reads `<describe your project>`. A whitespace-only entry also gives the placeholder.
  - The prompt's URL is the page's own origin plus `/information-for-agents.md`.
- **Text box:**
  - Clicking the "What are you building?" label focuses the textarea, so the label is associated with it.
  - Typing on the keyboard updates the prompt live.
  - A trailing period isn't doubled.
- **Copy button:**
  - "Copy prompt" writes exactly the displayed prompt to the clipboard (`clipboard === <pre> text`) and shows "Copied".
  - Editing the box afterwards clears "Copied". The Implementer's run also shows it clearing after about 2 s.
  - When `writeText` rejects, the page shows "Couldn't copy — select the text above and copy it." It shows the same message when `navigator.clipboard` is missing.
  - The status span is `role="status"` `aria-live="polite"`.
- **Links:**
  - "Read the briefing yourself" does a real navigation to `/information-for-agents.md`: `200`, `text/plain; charset=utf-8`, body starting `# The Technology Behind Brainstorm`.
  - "developer documentation" client-routes to `/developers`.
  - The `/developers` hub cards are in this order: `/information-for-agents`, `/developers/nip-50`, `/developers/open-ranking`, `/developers/trusted-assertions`, `/developers/relay-tools`.
  - `/brainstorm-skill` carries `a[href="/information-for-agents"]`.
- **Phone width:** no horizontal overflow at 360 px. The Implementer's `shot-phone.png` shows 390 px.
- **Console:** no console errors other than API ones. The only errors were `/api/*` 404s, because the stand-in has no API. They come from the shared `DevPage` and app chrome, which the existing `/developers` pages also load.
- **Screenshots:** the Implementer's `shot-empty.png`, `shot-copied.png`, `shot-hub.png` and `shot-phone.png` match the story's copy and the `/developers` style.

Probing the stand-in with curl confirmed the other server outputs:
- non-production `robots.txt` = `User-agent: *\nAllow: /llms.txt\nAllow: /information-for-agents.md\nDisallow: /\n`
- `llms.txt` with a domain opens with `## Start here`, linking `https://staging.brainstorm.world/information-for-agents.md`, ahead of `## Protocols`.

**What the stand-in can't show, so it stays unverified until staging:**
- **Real route order.** The real Express registration order at runtime is checked only by S1, a source-order sentinel. I confirmed it by reading the source:
  - `bin/control-panel.js:214` registers the route after every `express.static` (`:128–169`).
  - It comes before `app.use(session(...))` (`:232`), `authMiddleware` (`:323`), the honest-404 rule and the SPA catch-all (`:392`).
  - `authMiddleware` passes every non-`/api/` path (`src/middleware/auth.js:332–341`), so the page isn't gated.
  - Neither nginx config intercepts the path (`docker/nginx.conf:40–43` proxies `/` straight through).
  - The briefing ships in the image: `Dockerfile:92` is `COPY . …`, and `.dockerignore` doesn't exclude `docs/`.

  A live H1 is still the only proof that the request returns the file and not the SPA shell.
- **`DOMAIN_NAME` wiring at runtime.** This is checked by S3 (sentinel) and follows the same env read `security.txt` already uses (`bin/control-panel.js:190`). The live staging `llms.txt` naming `staging.brainstorm.world` is unverified.
- **Live behavior on staging.** Still unverified on staging:
  - H2: the live `robots.txt` allow line.
  - H3: the deep link through the real catch-all.
  - Console-clean on the real server, with a real API behind the page.
- **The two egress-refused links** (`https://brainstorm.world`, `https://relay.tools`).
- **Other browsers.** Only Chromium was exercised.

Suggested post-deploy check: `BRAINSTORM_BASE_URL=https://staging.brainstorm.world node test/information-for-agents.test.js`. It runs H1–H4 against staging, and H4 accepts a domain-bearing `llms.txt`.

## Spec adherence
- [x] Every acceptance criterion has a passing test. The interaction criteria were checked in a browser instead, as the test plan intended.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story. Small refinements are listed under Non-blocking #3.

| Acceptance criterion | Evidence |
|---|---|
| `GET /information-for-agents.md` → 200, `text/plain; charset=utf-8`, the briefing | S1, S2 and U3 pass. The handler matches the ADR verbatim (`bin/control-panel.js:214–223`). The stand-in confirms 200 and the content type. H1 skipped (no stack). |
| One source file, `docs/information-for-agents.md` | U2 and U3 pass. S4 passes: no shadow copy in `public/` or `ui/public/`. `siteTrust.js:254` is the only path to it. |
| Required content | B1, B2, B3 and B6 pass. I read the briefing in full. Sections 1–8 each carry a maturity line and a spec or reference link, and "Where to start" has 7 rows. |
| Every link resolves 2xx | L1: 19 of 21 links PASS live, 2 SKIP (egress gateway, see above). |
| Points rather than duplicates; the NIP-50 grammar is the one exception | B5 passes: exactly one fenced block, the NIP-50 REQ. The ORE endpoint table summarizes request shapes only to help an agent choose, and links the spec and the OpenAPI document. |
| Production endpoints; R&D labeled | B4 passes. Sections 4, 6 and 8 are labeled R&D or Draft. No staging, tags or localhost hosts appear. |
| Non-production `robots.txt` allows the briefing ahead of `Disallow: /`; nothing else newly allowed | U4 passes (exact body). `siteTrust.js:158`. |
| Production `robots.txt` byte-unchanged | U5 passes. The indexing branch at `siteTrust.js:157` is untouched. |
| `llms.txt` links `https://<domain>/information-for-agents.md` with a domain; omitted otherwise; other links unchanged | U6, U7, U8 and S3 pass. U7 asserts that removing the section gives back the domainless body byte for byte. |
| Page renders at `/information-for-agents` (deep link included) with the story's copy | S5 and S6 pass. Checked in the browser. H3 (live deep link) skipped. |
| "What are you building?" box fills the slot live; empty → `<describe your project>` | S6 and P3 pass. Checked in the browser. |
| Prompt wording, host-derived URL | P2, P6, P7 and P8 pass. `InformationForAgents.jsx:22` uses `window.location.origin`, as the ADR says. |
| "Copy prompt" copies exactly as shown and confirms | S6 passes. Checked in the browser: the clipboard equals the shown prompt, then "Copied" appears. The failure paths show "Couldn't copy". |
| Links to the briefing and to `/developers` | S7 passes. The briefing link is a plain `<a href={BRIEFING_PATH}>` (`InformationForAgents.jsx:70`). Checked in the browser. |
| `/developers` hub links the page | S8 passes. The card is first (`Hub.jsx:17–22`). Checked in the browser. |
| `/brainstorm-skill` links the page | S9 passes (`BrainstormSkill.jsx:37–42`). Checked in the browser. |
| `security.txt`, honest 404s and SPA routes unchanged; no console errors on the new page | `site-trust-signals` and `llms-txt` pass unmodified in the same gate. The `security.txt` route (`control-panel.js:188–191`) and the deny rule are untouched. Console-clean in Chromium apart from the stand-in's API 404s. |

## ADR adherence
- [x] Files changed match the ADR's implementation notes. Each note was checked against the code:
  - **`siteTrust.js`:**
    - It requires `fs` and `path`.
    - `INFORMATION_FOR_AGENTS_PATH` (`:252`) and `INFORMATION_FOR_AGENTS_SOURCE` (`:254`) are defined.
    - `readInformationForAgents` is async, has no cache, and leaves errors to the caller (`:259–261`).
    - The robots allow line sits directly after `/llms.txt`'s (`:158`).
    - `buildLlmsTxt(opts = {})` normalizes the domain exactly as `buildSecurityTxt` does: trim it, and treat empty or `localhost` as absent (`:231–236` vs `:115–126`). It inserts the ADR's "Start here" text verbatim before `## Protocols`.
    - The three new symbols are exported, and the header comment is updated.
  - **`control-panel.js`:** the destructure is extended (`:57–60`), and `/llms.txt` passes `DOMAIN_NAME` (`:205`). The route is placed directly after `/llms.txt`, ahead of the session middleware, with the ADR's handler. The block comment explains why `.md` placement matters.
  - **`agentPrompt.js`:** import-free, with the two constants and the builder.
  - **Page:**
    - It uses `DevPage` with `back={false}` and a 2-row textarea with the ADR's placeholder.
    - The prompt box is styled like `S.pre` with `pre-wrap`.
    - "Copied" resets after 2 s, and the exact failure copy appears.
    - The briefing link is `<a href>`, and `/developers` is a `<Link>`.
  - **`App.jsx`:** the route sits next to `/brainstorm-skill`.
  - **Hub:** the card is first, with the ADR's exact title and line.
  - **`BrainstormSkill.jsx`:** the ADR's sentence is added.
  - **Guardrail:** there is no static copy in `public/` or `ui/public/`.
- [x] Layering / module boundaries respected. `siteTrust.js` still owns every agent-facing root document. `INFORMATION_FOR_AGENTS_PATH` is read before its `const` declaration only inside function bodies (`buildRobotsTxt`, `llmsTxtStartHere`). Those run at call time, after the module has loaded, so there is no TDZ hazard; the U-class tests exercise exactly this.
- [x] No new dependencies the ADR didn't authorize. `package.json`, `package-lock.json`, `ui/package.json` and `ui/package-lock.json` are not in the diff.
- [x] The only edit to the Planning-approved briefing is the one line the test plan called for: `docs/information-for-agents.md:105`, the OpenAPI "Reference:" line in the whitelist section. `git diff 2e5ef36 HEAD -- docs/information-for-agents.md` shows nothing else.

## Concept-graph integrity
- [x] Not applicable: the story touches no concepts. The diff touches no concept handles, firmware or Concept Graph API calls.
- [x] No firmware reinstall needed (ADR Consequences).
- [x] Not applicable: no new code reasons about domain concepts.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging. The only new `console.*` outside the test runner is the ADR-prescribed `console.error` in the route's `catch` (`control-panel.js:220`).
- [x] No commented-out code.
- [x] Error paths:
  - **Route read failure:** the 500 path (`control-panel.js:219–222`) is untested by design (test plan, unchecked edge case). I reviewed it by reading. It returns a fixed plain-text message and logs only `err.message`, so no file path or stack reaches the client. Express 4 doesn't catch async rejections, but the whole handler body is inside `try`.
  - **Copy button:** it clears its timer before every copy and on unmount (`InformationForAgents.jsx:20, 25`). Both the missing-API and rejected-promise branches land on the failure message.
- [x] Concurrency / races:
  - **Rapid double-clicks:** "Copy prompt" clears the pending timer first.
  - **Unmount mid-copy:** a `setState` after unmount is harmless in React 18.
  - **Server:** the briefing route has no shared mutable state, and each request reads the file independently.
- [x] Security:
  - **Briefing route:** it takes no input; the path is a fixed constant, so there's no traversal.
  - **`llms.txt` domain:** it comes only from `process.env.DOMAIN_NAME`. The `/llms.txt` handler never reads the Host header (S3 asserts this, and I read `control-panel.js:203–206`).
  - **Page:** it renders the user's text only as a React text node inside `<pre>`, so there is no HTML injection.
- [x] Accessibility basics:
  - The label is associated with the textarea through `htmlFor`/`id`, confirmed in the browser.
  - The button is `type="button"`.
  - Copy feedback is in a polite live region.
  - "Your prompt" is a heading.
  - The link text is descriptive.

## House rules check
- [x] Concept Graph API authority respected (not applicable; no concepts touched).
- [x] No new lint/typecheck/build tooling. The TA pubkey isn't involved anywhere in the diff.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] Not applicable. This is an acceptance-frame book with no PRD. The page copy was checked against the story's verbatim copy instead (S6 and the screenshots).

## Findings

### Blocking
None.

### Non-blocking
1. **`src/utils/siteTrust.js:217–220` and `:190`**: with a domain configured, `llms.txt` now carries two "start here" pointers. One is the new `## Start here` section; the other is the Concepts entry under `## Protocols`, which still ends "Start here." Both texts are as the ADR prescribes. The ADR forbids altering other sections, and `LLMS_TXT` has hand-maintained copies in the sibling fleets (`siteTrust.js` export note), so rewording is a separate change. Optional: next time `llms.txt` is edited, reword the Concepts note (for example "read this first among the specs").
2. **`test/llms-txt.test.js:273–282`** (`llms-txt` H1): the ADR left one decision to Test Design: loosen this test, or leave the caveat documented. The test plan records no decision. The suite stays unmodified, as the ADR required. That means `llms-txt` H1 now fails by design against any stack whose `DOMAIN_NAME` is a real domain, for example with `BRAINSTORM_BASE_URL` pointed at staging for the book's live check. This story's H4 accepts both bodies, so it doesn't have the problem. Not blocking: the ADR itself documents the caveat, and nothing runs H-class against a deployed host today. Ask (for the orchestrating session): add an `OPEN.md` row so the next person to aim the gate at staging isn't surprised, or loosen `llms-txt` H1 to H4's rule in a follow-up.
3. **Refinements beyond the ADR's literal notes** (no action):
   - **`ui/src/utils/agentPrompt.js:12`:** collapses inner whitespace and strips trailing periods. The approved test plan sanctions both (edge cases P4 and P5).
   - **`ui/src/pages/InformationForAgents.jsx:53`:** editing the box clears a stale "Copied". The ADR doesn't specify this, but it's correct, since the confirmation would otherwise refer to a prompt that no longer matches.
   - **`d67c6da`:** spaces the intro paragraphs (`:38, :42`) and styles the label like the "Your prompt" heading (`:46`).

   None of these change a criterion.

### Harness friction
1. None. The one process gap, the undecided `llms-txt` H1 question, is recorded as Non-blocking #2 rather than as a harness defect.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result is reported in the chat hand-off to the orchestrating session, not in this file.
