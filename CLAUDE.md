# Tapestry / Brainstorm Search

Decentralized knowledge-graph protocol and search engine on nostr. Reference deployment runs at brainstorm.world.

Before starting work, read all four:

- [AGENTS.md](./AGENTS.md) — concept-graph orientation pattern. Read this BEFORE touching code.
- [ROADMAP.md](./ROADMAP.md) — product vision, principles, and the strategic roadmap for Brainstorm Search
- [BIBLE.md](./BIBLE.md) — architecture, protocol, data model, API, design decisions (universal, fork-agnostic)
- [OPERATIONS.md](./OPERATIONS.md) — brainstorm.world deployment: branches, CI/CD, droplets, gotchas

## ⚠️ Architecture invariants — read every session

Brainstorm/Tapestry is built around three principles. Default coding instincts trained on centralized SaaS systems will silently violate these. If a design feels "obvious" and it doesn't honor these, the design is probably wrong — pause and re-derive.

### 1. POV-first: there is no "the view," only views from a perspective

Every personalized output — search ranking, whether a user is "in the WoT," whether a tag "counts," what's trustworthy — is computed *from a specific point-of-view*. A POV is identified by a delegated pubkey (the "house POV" is the instance's default delegate; logged-in users can switch to their own POV after computing their WoT).

- Profile docs in Meilisearch already carry POV-namespaced columns: `wot_rank_<8charsuffix>`, `wot_followers_<8charsuffix>`, etc. Each suffix is one POV's perspective on that profile. Search filters/sorts are POV-namespaced.
- When you're answering "is this user trusted?" or "does this assertion count?" — **the answer depends on the POV**. There is no global truth. Don't write code that pretends otherwise.
- **Common mistake**: pre-computing a denormalized "trusted set," "applied tags," or "relevant assertions" column per target and treating it as global. There is no such thing. If you want per-POV behavior, either (a) provision per-POV columns and accept the denormalization burden, or (b) — usually right — *filter at query time* using the existing POV columns.

### 2. Decentralized-first: publishing is permissionless; aggregation is opinionated

Anyone publishes anything — follows, mutes, reports, tags, kind-39999 list-elements, profile metadata. The system does **not** gate publication. It aggregates and presents per-POV.

- Don't write code that requires a "canonical author" or "approved list" before something can exist. Tags can be created by any pubkey. Tag applications can be published by any pubkey. The TA (Tapestry Assistant) is not special at write time — it's special only because it publishes the firmware seed.
- The "trusted set" emerges from a POV's WoT computation, not from a list someone administers. If your code asks "is this user allowed?", you probably want "does this user's published assertion count *for this POV*?"
- **Common mistake**: validation that rejects events from unknown authors, or features that only work for "verified" users. Wrong layer. Accept all signed events; trust filtering happens at read time, per POV.

### 3. Filter at view time, not write time

A POV's view of the world is `(assertions from anyone) × (that POV's trust scoring)`. Both inputs change over time. Storing the *result* — "what does PoV X think today" — invites stale data and a combinatorial denormalization burden across N POVs × M targets.

- Prefer scanning raw assertions + applying the active POV's filter at query time. The strfry index supports filtered scans (`#z`, `#p`, `#e`, etc.); the Meili index already carries per-POV trust columns. Compose them.
- Only denormalize per-POV columns when the query-time cost is provably unacceptable. "It might be slow" is not enough — measure.
- **Common mistake**: "let me compute this once and store it" for anything subjective. The answer changes when the POV changes or when a new assertion arrives. Re-derive on read.

### Reflex checks when designing anything

Before writing the design, run these four questions on it:

1. **"Who is this true for?"** If the answer is "everyone" or "the database," check again — it's usually "*this POV's view*; others may differ."
2. **"Where does this trust come from?"** If you're about to hard-code an admin/owner/role check, look harder — there's usually a WoT-derived signal you should use instead (`wot_rank_<suffix>`, follow graph, etc.).
3. **"Could anyone else publish their own version of this?"** If yes, your code must not gate them at write time.
4. **"What changes when the POV changes?"** If your design forces a re-index or migration each time a user switches POV, the abstraction is at the wrong layer — push it to query time.

If the design you're about to write fails any of these, stop and re-derive from a POV-aware vantage point before continuing.

## Engineering Team Mode

This project runs every change through a **Product Owner → Architect → Tester → Implementer → Reviewer** harness with explicit human approval gates between phases. Pattern adapted from Rob Conery's *Eliminate Crappy Slop Code* (https://bigmachine.io/articles/video/eliminate-crappy-slop-code/).

The harness lives in two places:

- **`engineering-team/`** — roles, workflows, templates, and accumulating decisions/stories/reviews. Source of truth for behavior. Read [engineering-team/README.md](./engineering-team/README.md) for the layout and phase wiring.
- **`.claude/`** — wiring only:
  - `.claude/commands/<phase>.md` — slash commands: `/plan-feature`, `/design-architecture`, `/design-tests`, `/implement-feature`, `/review-changes`, `/discuss`.
  - `.claude/agents/<role>.md` — subagents with role-appropriate tool whitelists. The Architect cannot Edit source. The Reviewer cannot Edit source.

### How to operate

1. **Classify the request.** Ask: "Is this a new feature, a bug fix, a refactor, or a doc/typo change?" That answer determines which phases apply (Standard strictness):

   | Type | Phases that apply |
   |---|---|
   | Feature | All five phases |
   | Bug | Skip Architecture if obvious; otherwise all |
   | Refactor | Skip Tests if no behavior change |
   | Doc / typo / one-liner | Implementer + Reviewer only |

2. **Know which role you're in.** When a phase command is invoked, state at the top of your first response: "I'm acting as the {Role}. Phase: {Phase}."
3. **Stay in role.** The Architect doesn't write the implementation. The Implementer doesn't invent new requirements. If the inputs are unclear, kick back to the prior phase rather than drifting.
4. **Honor the gates.** End each phase by summarizing the output and asking the user to approve before moving on. Do not auto-advance.
5. **Use the templates.** Stories, ADRs, test plans, and reviews start from `engineering-team/templates/`.

### Project settings

| Setting | Value |
|---|---|
| Strictness | Standard |
| ADRs | enabled |
| Clean working tree before starting a feature | yes |
| Commit at each phase boundary | yes |

## House rules

- The Concept Graph API on the local control panel is the authoritative source for domain concepts. Always check there before reading source. See AGENTS.md §1–§3 for the port, TA pubkey, and three-call orientation pattern.
- Reinstall firmware after adding/changing concept definitions — see AGENTS.md §6 for the exact curl.
- Don't add new lint or typecheck tooling without an explicit ADR. This project is intentionally JS-without-build.

### Per-deployment TA pubkey — NEVER hardcode

The Tapestry Assistant (TA) pubkey is **created at first container startup** (`setup/create_nostr_identity.sh`) and is **different on every deployment**. The local-dev value (`82b75e47...973833` on this machine) is NOT shared with `tags.brainstorm.world`, `staging.brainstorm.world`, `brainstorm.world`, or any other instance.

A literal hardcode in shared code silently breaks the pin/TL stack (and any other surface that signs as the TA or filters events by TA author) on every non-dev deployment: the signer reads the actual on-disk TA key, but the readers filter `authors: [hardcoded]` and find nothing.

**Always resolve the TA pubkey at runtime:**

- **Server-side:** `const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys')` then `const TA_PUBKEY = getOwnerAssistantPubkey()` at module init (the function caches internally). Falls back through env → `brainstorm.conf` → `SecureKeyStorage` JSON. See `src/utils/assistantKeys.js:49–82`.
- **Client-side:** `const { taPubkey } = useConfig()` (backed by `/api/assistant/pubkey`). See `ui/src/context/ConfigContext.jsx:14–18`. The rest of the codebase already does this (e.g., `ui/src/pages/concepts/ConceptList.jsx:59`, `ui/src/pages/databases/Neo4jOverview.jsx:13`).

This rule applies anywhere the TA pubkey is used as: an `authors:` filter on a strfry scan; a substring of a concept handle (`39998:<TA>:<slug>`); a `pubkey` argument to `nip19.naddrEncode`; or any identity check. If you find yourself typing `'82b75e47...'`, stop — use the runtime lookup instead.

Reference incident: the Pin/TL stack (Stories 10–12) hardcoded the literal in `ui/src/utils/publishTagPin.js` and `src/api/profile-tags/index.js`. The local instance kept working by coincidence (same TA pubkey); `tags.brainstorm.world` reported "No TL yet" forever because TLs were signed under its real TA but searched for under the hardcoded one. Fix: replace literals with the runtime helpers above. See `engineering-team/stories/_intake.md` entry dated 2026-05-20.
