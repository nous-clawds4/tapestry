# Test Plan: Story 1 — Information for agents: the page and the briefing

**Story:** `engineering-team/stories/information-for-agents/1-information-for-agents-page-and-briefing.md`
**ADR:** `engineering-team/decisions/information-for-agents/0001-serve-the-briefing-and-build-the-page.md`
**Date:** 2026-10-05

All tests are in `test/information-for-agents.test.js`, registered in `test/registry.js` right after `llms-txt.test.js`. The suite is modeled on `test/llms-txt.test.js`, using the same runner contract and per-test `'SKIP'` returns.

## Coverage map

| Criterion (story) | Test | Level |
|---|---|---|
| Briefing: `GET /information-for-agents.md` → 200, `text/plain; charset=utf-8`, the briefing | U1, S1, S2, **H1** | unit · sentinel · live |
| Briefing: one source file, `docs/information-for-agents.md`; body = that file | U2, U3, H1 | unit · live |
| Briefing: required content (what Brainstorm is, no-global-score, one section per integration point with maturity + spec link, where-to-start table) | B1, B2, B3, B6 | content |
| Briefing: every link resolves 2xx | L0, L1 (one per link) | live network |
| Briefing: points rather than duplicates; NIP-50 grammar is the one exception | B5 | content |
| Briefing: production endpoints; R&D labeled as R&D | B4 | content |
| Reachability: non-production `robots.txt` allows the briefing ahead of `Disallow: /`; nothing else newly allowed | U4, H2 | unit · live |
| Reachability: production `robots.txt` byte-unchanged | U5 | unit |
| Reachability: `llms.txt` links `https://<domain>/information-for-agents.md` when a domain is configured; omitted otherwise; other links unchanged | U6, U7, U8, S3, H4 | unit · sentinel · live |
| Page: renders at `/information-for-agents`, deep link included, in `/developers` style, with the story's copy | S5, S6, H3 | sentinel · live |
| Page: "What are you building?" box fills the prompt live; empty → `<describe your project>` | S6, P3 | sentinel · unit |
| Page: the prompt text, host-derived URL | P2, P6, P8 | unit |
| Page: "Copy prompt" copies as shown and confirms visibly | S6, P7 | sentinel · unit |
| Page: links the briefing and `/developers` | S7 | sentinel |
| Links in: `/developers` hub | S8 | sentinel |
| Links in: `/brainstorm-skill` | S9 | sentinel |
| Unchanged: `security.txt`, honest 404s, SPA routes | the existing `site-trust-signals` and `llms-txt` suites, run unmodified in the same gate | regression |

**Test classes:**

- **U:** pure server functions in `src/utils/siteTrust.js`.
- **P:** the page's pure prompt builder `ui/src/utils/agentPrompt.js`, loaded with `import()`.
- **B:** the briefing file's content.
- **S:** source sentinels.
- **H:** live HTTP against `:7778`. Each test SKIPs when the stack is absent.
- **L:** live link resolution.

## Edge cases

- [x] **Blank or missing project:** `''`, whitespace, `undefined` and `null` all give the placeholder prompt (P3).
- [x] **Multi-line or padded project:** trimmed, with inner whitespace collapsed to single spaces, so the prompt stays one paragraph (P4).
- [x] **Project ending in a period:** "I'm building X." doesn't become "X.." (P5). Not a story criterion; added because the box invites full sentences.
- [x] **Local dev origin:** `http://localhost:7778` gives a working URL. The ADR uses `window.location.origin`, not a hardcoded `https://` (P6).
- [x] **Domain hygiene in `llms.txt`:** an empty, whitespace-only or `localhost` domain is treated as absent (U6); a padded domain is trimmed (U8); the route never reads the request's Host header (S3).
- [x] **The silent failure:** `.md` isn't a blocked extension, so a missing or misplaced route returns the SPA shell with a 200 instead of a 404. S1 pins the route ahead of the catch-all, and H1 rejects an HTML body outright.
- [x] **Shadow copies:** no `public/` or `ui/public/` copy of the briefing, which static middleware would serve first as `text/markdown` (S4).
- [x] **Router trap:** the briefing link must be `<a href>`, not `<Link>`. A router link would render the SPA's NotFound (S7).
- [x] **Paths drifting apart:** the UI's `BRIEFING_PATH` must equal the server's `INFORMATION_FOR_AGENTS_PATH` (P8).
- [x] **Egress false-fail** (ledger `2026-10-04-llms-txt-egress-403-false-fail`): L1 treats a 403 written by a sandbox egress gateway (bodies "Host not in allowlist…" or "…not enabled for this session") as SKIP, not as a broken link. Every other non-2xx fails. Reproduced on 2026-10-05: Node's `fetch` from this cloud container gets the gateway's 403 for `relay.tools` and `brainstorm.world` and a 2xx for everything else. I chose classification over routing `fetch` through `HTTPS_PROXY`, because Node 22's env-proxy agent is experimental (it prints a warning) and adds GitHub-scope 403s of its own.
- [ ] **Read failure** (briefing file missing at runtime → 500 with a plain message): not automated. Faking a missing file means monkey-patching `fs` inside a live server. It's covered by review of the handler (S2 pins that the handler goes through the loader), and the ADR specifies the `catch`.

## What the Node gate can't see (verified at Review instead)

The page's browser behavior can only be seen in a browser:

- the text box updating the prompt as you type;
- the clipboard write and the "Copied" / "Couldn't copy" feedback;
- the layout matching `/developers`.

The P-class tests pin every string involved, and S6 pins that the page uses them. The interaction itself is browser-verified at Review, on a local `vite build` + preview if UI dependencies install in that session, otherwise on staging after deploy. This matches the `developers-pages` stories' browser-verified treatment. The Review records which was used.

## Test infrastructure

- **Runner:** Node built-in (`node test/test.js`, through `test/registry.js`). A single suite runs with `node test/information-for-agents.test.js`.
- **Live API:** H-class targets `BRAINSTORM_BASE_URL` (default `http://localhost:7778`). This session is stack-absent, so H1–H4 SKIP here.
- **Network:** L-class needs outbound HTTPS. Each test SKIPs on no network or an egress refusal.
- **Firmware state:** none. No concepts are touched.
- **Fixtures:** none. U/P/B/S read the repo's own files.
- **Dependencies:** none. The suite requires only Node built-ins plus `src/utils/siteTrust.js`, which has no requires today; the ADR adds `fs` and `path`.

## How to run

```
node test/information-for-agents.test.js   # this suite
npm test                                    # the whole gate
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-05 at commit `67efdc6` (branch `claude/bold-noether-fbtzrv`), stack absent:

```
information-for-agents: 26 passed, 25 failed, 6 skipped
```

- **25 failures, all for the feature's absence:**
  - U1–U8: `FEATURE MISSING: src/utils/siteTrust.js does not export INFORMATION_FOR_AGENTS_PATH, INFORMATION_FOR_AGENTS_SOURCE, readInformationForAgents`;
  - P1–P8: `ui/src/utils/agentPrompt.js does not exist`;
  - S1–S3, S5–S9: route, `llms.txt` domain wiring, page, App route, hub card and skill-page link all absent;
  - B3: the whitelist section ("3. Spam filtering for a relay: whitelists") links no reference document. The Implementer adds the OpenAPI document link there, the one edit the build makes to the approved briefing.
- **26 passes:** B1, B2, B4, B5, B6 (the approved draft already meets them), S4 (no shadow copy), L0, and 19 of the 21 briefing links.
- **6 skips:** H1–H4 (stack absent), plus L1 for `https://brainstorm.world` and `https://relay.tools` (egress gateway 403).
