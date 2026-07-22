# PRD Seed: About Brainstorm Search (product explanation surface)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** [`engineering-team/audits/about-brainstorm-search/audit.md`](./audit.md)
**Anchor:** acceptance frame in [`book.md`](./book.md) — itself reconstructed at close from the operator's verbatim in-session spec
**Confidence:** medium
**Date:** 2026-07-22

> A **reverse-engineered baseline** in PRD shape, built from what shipped. A strawman for the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.
>
> **Read this first:** a Discovery conversation for this work was *started and then deliberately abandoned* when the operator supplied a complete spec (2026-07-21). That was the right call for shipping — the spec was concrete and the pages are small — but it means **the product questions Discovery would have answered were never answered.** They are listed in §7. This seed's main value to the product team is that it makes those unanswered questions explicit rather than letting the shipped pages imply they were settled.

## 1. Product vision

`[INFERRED]` Brainstorm Search now has an explanatory front door. Its organizing claim is that Brainstorm Search is **not only a search bar** — it is a web-of-trust service reachable three ways: by a human typing, by an agent acting on a human's behalf, and by other nostr clients integrating it.

`[FROM FRAME]` The structure is deliberately *purposes-first* — organized by how someone wants to work, not by feature list. That is the more persuasive framing and the operator arrived at it directly.

`[UNKNOWN — product input needed]` The underlying problem was never stated. It is not recorded anywhere whether this page answers an **observed** confusion (visitors asking "what is this for?", a demo that fell flat, a capability going unused) or is **anticipatory** completeness. The two imply different success criteria and different next pages. This question was asked during the aborted Discovery and never answered.

## 2. Personas

`[INFERRED]` from the shipped copy and the story's "As a visitor…" line:

- **The arriving visitor** — lands on the search home, doesn't yet know what Brainstorm is or why trust-filtered results matter. The About page is written at them.
- **The nostr-client developer** — knows nostr, wants integration surfaces. Served by `/developers`, now four cards wide.
- **The agent operator** `[INFERRED, speculative]` — someone who expects to reach search through tooling rather than a browser. **No such user has been observed**; the persona is implied by a placeholder page describing a capability that does not exist yet.

`[UNKNOWN — product input needed]` When asked who the page was for, the operator answered **"all of the above"** — newcomers, existing nostr users, developers, and instance operators. That was flagged during Discovery as the single biggest risk to the page (four audiences with different vocabularies and different definitions of a good answer), and the question was never resolved before the spec arrived. The page as shipped is written primarily for **the arriving visitor**, with developers routed out to `/developers`. Whether that de-facto choice is the intended one has not been confirmed.

## 3. Scope (as-built)

`[FROM FRAME]` In scope and shipped:

- `/about-brainstorm-search` — two sections: "How Search Works" (brief, links to the pre-existing mechanism page) and "How to Use Brainstorm Search" (three ways).
- Search home footer routes to it, replacing the `How search works` link.
- `/brainstorm-skill` — placeholder asserting search is going agentic.
- `/developers` hub at four cards; `/developers/trusted-assertions` and `/developers/relay-tools` as placeholders.

`[FROM FRAME]` Explicitly out of scope, by operator decision:

- Any edit to `/how-search-works` or `/personalization` — untouched, byte-identical.
- Resolving the `/about` ↔ `/about-brainstorm-search` naming overlap — deferred knowingly.
- Real content behind any placeholder.

## 4. Domain model

`[INFERRED]` **None touched.** This book added no entities, attributes, or relationships. No concept-graph handles, no event kinds, no stored shapes, no POV-dependent logic — static presentational pages only.

`[INFERRED]` Domain concepts *named in copy* (referenced, not modelled): **Trusted Assertions** (kind 30382 WoT-score events, per NIP-85 — whose own title is "Trusted Assertions"), **web of trust**, **point of view**, **GrapeRank verification**.

## 5. Design rules (as-built)

`[INFERRED]` — no design guide exists for these pages; the following are read off the code and were never written down as rules:

- Informational pages use a shared shape: logo top bar + `BrainstormUserMenu`, centered column at `maxWidth: 680`, `h1` 1.5rem, `h2` 1.1rem, body 0.95rem at 0.85 opacity, internal links `#a5b4fc`.
- Developer sub-pages instead use the `DevPage` wrapper (`maxWidth: 720`, automatic "← Developers" back-link) — so the two families are **deliberately distinct but internally consistent**.
- Placeholder pages state what the surface *is*, then "Documentation coming soon" — rather than a bare stub. This convention emerged during this book; it is not recorded anywhere else.
- Styling is **inline style objects**, not CSS classes, on all new pages — matching the existing informational pages.

`[UNKNOWN — product input needed]` No rule exists for how long a placeholder may stay public, or what should happen if the promised content never arrives. Three are live on production today.

## 6. Carry-forward & open questions

Promoted from [`audit.md`](./audit.md) §6:

- [ ] Operator copy review of the live pages — the About page's §1 prose was authored by the Implementer and never signed off; `/brainstorm-skill` copy is explicitly draft.
- [ ] Independently verify the **Relay Tools** integration — a public page asserts a live third-party integration on operator say-so, unverified by engineering, with the host deliberately unnamed.
- [ ] Real documentation for Trusted Assertions and Relay Tools (one story each).
- [ ] Real `/brainstorm-skill` content — no agent skill, MCP server, or integration exists in the repo today.
- [ ] Resolve the `/about` naming overlap.
- [ ] Story 2's copy block no longer matches the shipped page (NIP-85 link drift).

## 7. What product must validate

The `[INFERRED]` / `[UNKNOWN]` items needing a human product decision before this seed becomes a real PRD — **most of these are the questions the aborted Discovery would have answered:**

- [ ] **What problem does this page solve?** Observed confusion, or anticipatory completeness? Everything downstream depends on this.
- [ ] **Who is it actually for?** "All of the above" was the answer given; the page as built serves the arriving visitor. Confirm or redirect.
- [ ] **Is "three ways to use it" the right decomposition**, and is it complete? It currently privileges the agentic path — one of three slots — for a capability that does not exist.
- [ ] **Is it acceptable for the most intriguing item on the page to be a placeholder?** The agentic thesis is the page's most distinctive claim and its most likely click; it lands on a page with no substance behind it yet.
- [ ] **How should success be judged?** No metric was defined. Candidates: footer-link click-through, `/developers` referrals from the About page, bounce rate on `/brainstorm-skill`.
- [ ] **Was pushing the verification/GrapeRank explanation one click deeper the right trade?** Accepted knowingly at planning, but it moves the product's most differentiating idea off the front door.
- [ ] **What is the placeholder policy?** Three draft-copy pages are public on production with no expiry.
