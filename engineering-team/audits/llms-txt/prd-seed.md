# PRD Seed: llms.txt — a first-hop pointer manifest for visiting AI agents

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/llms-txt/audit.md`
**Anchor:** the acceptance frame in `book.md`, itself sourced from the estate-wide intake entry (2026-08-18, `NosFabrica/protocols#6`)
**Confidence:** high on §3 and §6, checked against the diff and all four live hosts during this close. **Low on §1, §2 and §5**: like `site-trust-signals`, this book answered an estate-wide affordance request, not a product research question, so the framing below is inferred and should be read as a strawman.
**Date:** 2026-09-22

> A reverse-engineered baseline in PRD shape, built from what shipped. Every section is tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`. **Read the confidence line above before adopting any of it.**

## 1. Product vision

`[FROM FRAME]` Every deployment in the estate should route a visiting AI agent, on its very first request, to the documents that actually explain the system — not leave it to scrape a JavaScript SPA's empty shell. The trigger was the same `site-trust-signals` incident (safescan.io's blocklist) reframed forward: `llms.txt` is "cheap insurance plus a deliberate-agent affordance, not SEO" (the estate issue's own honest caveat, carried verbatim into the story).

`[INFERRED]` The deeper bet is that developer-facing AI assistants are becoming a real adoption channel for the estate's trust scores — an agent that gets routed correctly on the first hop is more likely to build something that actually uses `GrapeRank`/Trusted Assertions correctly, rather than guessing from scraped fragments.

`[UNKNOWN — product input needed]` Whether `llms.txt` is expected to move any real adoption metric, or whether "cheap insurance" is the whole of its justification and no metric was ever intended.

## 2. Personas

`[INFERRED]` from the story's own framing and from who actually fetches this file:

- **The coding-assistant-in-the-loop.** A developer's AI assistant (Claude Code, Cursor, etc.) asked to "integrate with Brainstorm" or "read Brainstorm's trust scores," landing on a tapestry host and looking for orientation. This is the persona the story's acceptance criteria were written for.
- **A deliberate, non-crawling agent.** Something that fetches `/llms.txt` specifically because it knows the convention — never a search-engine crawler (the estate issue is explicit that no major crawler consumes this today). This is *why* the `robots.txt` exemption exists: the file's whole value depends on being reachable outside the indexing opt-out.
- **The operator maintaining the fleet.** Whoever adds or retires a host, or whoever one of the four linked repos' default-branch renames would affect — inherits a small, ongoing content-maintenance obligation this book created.

## 3. Scope (as-built)

`[FROM FRAME]`: shipped and verified live on all four hosts:

- `/llms.txt`, `text/plain; charset=utf-8`, llmstxt.org format: H1, blockquote, notes, then `## Protocols` / `## Tapestry` / `## Optional` sections.
- Twelve links, pointers only — four each into `NosFabrica/protocols`'s specs/ecosystem docs, this repo's own top-level orientation docs, and secondary "Optional" material (`BIBLE.md`, the two agent CLIs, the production OpenAPI doc, `SECURITY.md`).
- A targeted `robots.txt` carve-out on the three non-production hosts.
- The `security.txt` renewal ritual (OPEN.md row 172) extended to cover these links too.

`[FROM FRAME]`: explicitly **out** — same as `site-trust-signals`: the Product UI fleet, the relay fleet, the API-host fleet (different repositories, same estate issue); an `llms-full.txt` full-text variant (rejected: a second copy of every linked document that drifts independently); duplicating any linked document's actual text.

## 4. Domain model

`[INFERRED]` No Tapestry domain model touched — same as `site-trust-signals`, this sits below the concept-graph layer entirely. What this book adds to the *operational* model (not the product domain) is one more member of the "well-known root document" family alongside `security.txt`/`robots.txt`, now three deep in `src/utils/siteTrust.js`, and it inherits that family's maintenance shape: a hand-maintained estate inventory, one per-deployment env-driven field pattern (though `llms.txt` itself needs none — it's the first of the three that's fully static).

## 5. Design rules (as-built)

`[INFERRED]` — none of these were ever recorded as rules before this book; read off the ADR and the review, candidates for ratification:

1. **One module owns every well-known root document.** Considered and explicitly rejected the alternative (a static file) specifically because it would split that ownership — this is now a two-for-two precedent (`security.txt`+`robots.txt`, then `llms.txt`).
2. **A `.txt`-extension route needs its registration order checked, not assumed.** The ADR didn't take `isBlockedProbePath`'s interaction on faith — it called the function directly and found `/llms.txt` would 404 itself if misplaced, exactly as `/robots.txt` would. Worth carrying into any future well-known-document addition.
3. **Content that "almost never changes" still gets a renewal ritual, not an exemption from one.** Both `security.txt`'s attestation and now `llms.txt`'s links share the same yearly re-verification trigger, on the theory that "rarely changes" and "never needs checking" are different claims.
4. **Syncing a shipped feature to a long-lived sandbox branch is not a merge — it's a per-file judgment call**, discovered the hard way in this book's own close: two sandboxes at different drift distances needed entirely different treatment, from "one doc-path conflict" to "three files don't exist on this branch at all, drop them."

## 6. Carry-forward & open questions

Promoted from build audit §6:

- **`feature-magic-carpet` (and structurally, any sandbox at similar drift) has no ledger, no test registry, no intake tracking, and no deploy-safety gate.** No written guidance exists for the next person who needs to sync something there.
- **A worktree can silently verify the wrong branch's server** through the shared local Docker container — caught this time, not yet prevented.
- **`feat/tags` still carries its own known, unrelated `test/test.js` divergence** (OPEN.md row 195), unaffected by this book but relevant to whoever syncs there next.
- **The relay and API fleets, and three outside-repo host lists**, remain exactly where `site-trust-signals`' own audit left them — this book didn't touch either.

## 7. What product must validate

- [ ] **Does `llms.txt` need to be discoverable, or just present?** (§1) Nothing links to it from anywhere a human or agent would naturally find it except by convention (`/llms.txt` by name). If the "coding assistant" persona is real and matters, is convention-only discovery enough?
- [ ] **Should `feature-magic-carpet` and comparably-drifted sandboxes get a harness catch-up, or stay permanently narrow-sync-only?** (§4/§6) This book's own close surfaced that the sandbox has none of the process infrastructure the rest of the estate now assumes. That's either fine (it's Matthias's isolated feature space) or a growing liability every future sync will re-discover from scratch.
- [ ] **Are the three personas in §2 real?** Inferred from the story's own framing and from mechanical necessity (who *can* reach this file), not from research.
- [ ] **Is "cheap insurance, not SEO" the complete justification, or does someone expect a measurable outcome?** (§1) If a metric is expected, none exists today to check it against.
