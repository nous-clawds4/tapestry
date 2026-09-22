# ADR 0001: Serve llms.txt through the site-trust plumbing

**Status:** Accepted
**Date:** 2026-09-22
**Story:** `engineering-team/stories/done/llms-txt/1-serve-llms-txt-on-the-fleet.md`

## Context

`site-trust-signals` (closed 2026-09-22) built `src/utils/siteTrust.js`: pure, unit-testable functions that render `security.txt` and `robots.txt`, registered in `bin/control-panel.js` ahead of a shape-based 404 rule (`isBlockedProbePath`) that keeps the SPA catch-all from swallowing every root document. The story asks for a third document, `llms.txt`, through the same mechanism, plus a targeted exemption so `/llms.txt` stays reachable on non-production hosts despite their `robots.txt: Disallow: /`.

Constraints from the story:

- Static content, identical on all four hosts — no per-host templating like `security.txt`'s `Canonical` field.
- Exact link inventory and section structure are already specified (story AC-3/AC-4); this ADR decides *how it's served*, not *what it says*.
- `robots.txt`'s indexing opt-out and `llms.txt`'s discoverability are different concerns — the exemption must not touch `ALLOW_INDEXING` or any other indexing behavior (story, Out of scope).
- House rule: no new lint/build tooling. No concept-graph changes — confirmed via the graph probe (`/api/concept-graph/summaries`, 200) and the story's own "Concepts touched: None."

**A load-bearing fact, verified against the running code, not assumed:** `BLOCKED_EXTENSIONS` in `siteTrust.js:84-89` includes `'txt'`. `isBlockedProbePath('/llms.txt')` returns `true` — confirmed by calling it directly. This is not a new problem `llms.txt` introduces: `isBlockedProbePath('/robots.txt')` is **also** `true` today. The existing code already depends on `/robots.txt`'s explicit route being registered, and therefore matched by Express, *before* the deny-rule middleware ever runs (`bin/control-panel.js`: the routes at ~178-186 precede the deny rule at ~330-343). `/llms.txt` inherits the identical requirement: get the registration order wrong and the route 404s instead of serving content, silently.

## Options considered

### Option A — Extend `siteTrust.js`; a third explicit route
Add `buildLlmsTxt()` to `src/utils/siteTrust.js` (a pure function returning a static template-literal constant, mirroring `buildSecurityTxt`/`buildRobotsTxt`'s shape) and register `app.get('/llms.txt', ...)` in `bin/control-panel.js`, in the same spot as the existing two routes — after all `express.static` middleware, before session middleware, before the deny rule.

Pros: one file stays the single owner of every well-known root document, matching the existing header comment's framing and making every such document discoverable by reading one module. Content is a pure function, unit-testable the same way `U`-class tests already cover `buildSecurityTxt`/`buildRobotsTxt` — no HTTP server needed to test content or structure. No dependency on a UI rebuild: content changes take effect on the next server deploy, same as `security.txt`/`robots.txt` today, with no separate `vite build` step in between.
Cons: one more function, one more route registration to place correctly (the `.txt`-extension gotcha above makes this a *must-get-right*, not a nicety).

### Option B — Static file under `ui/public/llms.txt`
Drop the content as a plain file; Vite copies it into `dist/` at build time; the existing `app.use(express.static(dist))` (registered `bin/control-panel.js:124-131`, well before either the explicit routes or the deny rule) serves it with zero new application code.

Pros: no new route, no registration-order risk.
Cons, decisive:
- **It doesn't compose with the `robots.txt` exemption.** The exemption lives inside `buildRobotsTxt`; a static `llms.txt` file is a wholly separate mechanism with nothing connecting the two, so the two AC's (serve the file; exempt it in `robots.txt`) would live in different layers of the app for no reason.
- **Loses the single-owner property.** A future engineer auditing "every well-known root document this deployment serves" would have to know to check both `siteTrust.js` *and* `ui/public/` — exactly the kind of split this repo has been bitten by before (the `ESTATE_ATTESTATION` drift, OPEN.md row 173).
- **Not unit-testable as content.** Content/structure could only be asserted by reading the file off disk (a source-sentinel-style check, workable but a strictly weaker test than calling a pure function) — and the live-HTTP tier becomes the *only* way to assert the served bytes match what's committed, rather than a redundant confirmation of what the unit tier already proved.
- Checked, not assumed: `mime.contentType('llms.txt')` on this repo's installed `mime-types` (`send@0.19.0`'s dependency) already resolves to `text/plain; charset=utf-8`, so the content-type risk I initially expected for this option doesn't actually apply — this is **not** a reason to reject Option B, and I want to record that rather than let a stale intuition stand.

Considered and rejected as its own path (not written up as a full option): a *generalized* `robots.txt` exempt-paths parameter (e.g., `buildRobotsTxt({ allowIndexing, exemptPaths: [...] })`). Over-engineered for exactly one fixed exemption today — YAGNI. A single hardcoded `Allow: <path>` line is simpler, and if a second exemption is ever needed, generalizing then costs less than carrying unused flexibility now.

## Decision

We chose **Option A**.

`llms.txt`'s content is static and its route is a red-hot candidate for the exact silent-404 failure mode `isBlockedProbePath` was designed to catch for *other* paths — that argues for keeping it inside the module that already understands and tests that interaction, not moving it to a mechanism (static files) that has no awareness of the deny rule at all. Option B's "zero new code" is real, but it buys that by fragmenting one concern (root document serving) across two unrelated code paths, for a feature whose entire premise is "there should be one place an agent looks."

`robots.txt`'s exemption is a one-line change to `buildRobotsTxt`'s existing non-indexing branch — not a new parameter, not a new function — because there is exactly one exemption to make today.

## Consequences

- Enables: `/llms.txt` on all four hosts returns real content instead of the SPA shell; non-production hosts stay non-indexed while remaining discoverable to a deliberate agent fetch of `/llms.txt` specifically.
- Constrains: updating `llms.txt`'s content requires editing a JS template literal and redeploying, not a docs-only PR to a markdown file. Accepted — the story's own framing is that this content "almost never changes," same as `ESTATE_ATTESTATION`.
- New debt: the link-resolution check (story AC-7) needs a home in the `security.txt` `Expires` renewal ritual (OPEN.md row 172) — Test Design's to place, noted here so it isn't lost between phases. The four `raw.githubusercontent.com/.../main/...` URLs assume each source repo's default branch stays `main`; if any of those four repos ever renames its default branch, all references to it here need updating together. Inherent to a pointer-manifest's content, not something the architecture prevents.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

**File: `src/utils/siteTrust.js`** — add, after `buildRobotsTxt` (currently ending `siteTrust.js:142`) and before `isBlockedProbePath`:

- `const LLMS_TXT_PATH = '/llms.txt';` — the single source of truth for the served path. Referenced both by the route registration in `control-panel.js` and inside `buildRobotsTxt`'s exemption line below, so a future rename can't silently desync the two.
- `const LLMS_TXT = \`...\`;` — a module-level template literal, the exact content (content sketch below), following the same pattern as `ESTATE_ATTESTATION`.
- `function buildLlmsTxt() { return LLMS_TXT; }` — no options; content has no per-host variation. Shaped like `buildSecurityTxt`/`buildRobotsTxt` for call-site and test symmetry, even though it takes no arguments.
- Export `buildLlmsTxt` and `LLMS_TXT_PATH` alongside the existing exports.

Change `buildRobotsTxt`'s non-indexing branch (`siteTrust.js:139-141`) from:
```js
: 'User-agent: *\nDisallow: /\n';
```
to:
```js
: `User-agent: *\nAllow: ${LLMS_TXT_PATH}\nDisallow: /\n`;
```
The indexing branch (`'User-agent: *\nAllow: /\n'`) is untouched — production's `robots.txt` stays byte-identical to today, matching the story's "behavior unchanged" acceptance criterion.

**Content sketch** for `LLMS_TXT` (the exact text; assembled from the story's AC-3/AC-4, which already specified every link, section, and required fact — this is transcription, not a new decision):

```markdown
# Tapestry (Brainstorm Search)

> Tapestry is the research-and-development side of Brainstorm, a personalized web-of-trust system for nostr: a local-first personal knowledge graph plus a trust engine that computes GrapeRank scores from a chosen observer's point of view and publishes them back to nostr as signed events. Protocols are drafted and piloted here, then adopted by the production Brainstorm stack at brainstorm.world.

Notes for agents:

- This site is a JavaScript single-page app. Its page URLs return an empty HTML shell to clients that do not run JavaScript, so read the markdown documents linked below instead of scraping pages.
- There is no global trust score. Every score is computed from a specific observer's point of view, and the same account can rank high from one point of view and be invisible from another. When answering "is this account trustworthy?", say whose point of view the answer comes from.
- Each wire format is normative in exactly one place: matured specs live in NosFabrica/protocols, drafts in this repository's protocols directory. For which hosts and repositories exist and what role each plays, ECOSYSTEM.md is authoritative.

## Protocols

- [Concepts](https://raw.githubusercontent.com/NosFabrica/protocols/main/CONCEPTS.md): the model behind every spec (five claims, the roles, shared vocabulary). Start here.
- [Trusted Assertions](https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/trusted-assertions.md): consumer spec for finding and reading published trust scores (companion to NIP-85).
- [GrapeRank](https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/graperank.md): how personalized trust scores are computed.
- [Ecosystem map](https://raw.githubusercontent.com/NosFabrica/protocols/main/ECOSYSTEM.md): canonical inventory of the organizations, repositories, and hosts, and each one's role.

## Tapestry

- [README](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/README.md): what Tapestry is and how to run your own instance with Docker.
- [AGENTS.md](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/AGENTS.md): orientation for coding agents working in the Tapestry codebase.
- [Protocol drafts](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/protocols/README.md): index and status of pre-NIP drafts (decentralized lists, concepts, tags).
- [tapestry-cli](https://raw.githubusercontent.com/nous-clawds4/tapestry-cli/main/README.md): command-line tools for agents curating concepts via the Tapestry protocol.

## Optional

- [BIBLE.md](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/BIBLE.md): full architecture, data model, and API reference (about 185 KB; read its table of contents first and fetch only the sections you need).
- [brainstorm-cli](https://raw.githubusercontent.com/nous-clawds4/brainstorm-cli/main/README.md): command-line tool for agents using the production Brainstorm backend.
- [Brainstorm API (OpenAPI)](https://api.brainstorm.world/openapi.json): machine-readable description of the production API (about 130 KB of JSON).
- [Security policy](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/SECURITY.md): how to report a vulnerability, and which hosts this codebase serves.
```

**File: `bin/control-panel.js`** — import `buildLlmsTxt, LLMS_TXT_PATH` alongside the existing `siteTrust` destructure (`:57`). Register immediately after the existing `/robots.txt` route (`:183-186`) and before the session middleware (`:188` on) — **placement is load-bearing, identically to `security.txt`/`robots.txt`**: this must land before the honest-404 deny-rule middleware (`:~330-343`), or `isBlockedProbePath` (which the deny rule calls) classifies `/llms.txt` as a blocked `.txt` probe path and it 404s instead of serving content.
```js
app.get(LLMS_TXT_PATH, (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(buildLlmsTxt());
});
```

**Guardrail:** do not also place a file at `ui/public/llms.txt` or `public/llms.txt`. `express.static(dist)` is registered before this route (`:124-131`); a stray static file there would be served first, silently diverging from `LLMS_TXT`, and the explicit route would become dead code.

**Test file:** a new `test/llms-txt.test.js`, structured like `test/site-trust-signals.test.js` (U-class content/format unit tests against `buildLlmsTxt`/`buildRobotsTxt`; S-class source sentinels for route registration and its position relative to the deny rule and the catch-all; H-class live HTTP against `:7778`, skipped when the stack is absent) — a new file rather than extending the closed `site-trust-signals` suite, so that suite's provenance stays scoped to the book it was audited under. Test Design's call to finalize; noted here because the Architect names files per role convention.

## Out of scope

- The exact link inventory and required blockquote/notes facts — already decided at Planning (story AC-3/AC-4); this ADR only assembles them into a servable form.
- Placing the link-resolution check into the `security.txt` `Expires` renewal ritual — Test Design's to design (story AC-7 names the requirement; this ADR doesn't design the test).
- Any change to `ALLOW_INDEXING` or production's indexing posture.
- The Product UI, relay, and API-host fleets (book, "Related work outside this book").
