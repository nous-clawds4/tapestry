# Communities Protocol — Design Handoff

**Status:** 🔴 OPEN — protocol *design* settled (foundations + identity + membership); the remaining open item is **delivery: three-branch reconciliation** (§7), an org decision for the user + Avi + Vinney. **Not yet in the BIBLE.**

**Created:** 2026-06-05, from a `/discuss` (Product Expert) scoping session.
**Builds on:** story #31 / ADR 0027 / BIBLE §25 — the `b` / inherit-from tag.
**Related:** `engineering-team/stories/_intake.md` → "2026-06-05 — Tapestry Communities Protocol (full draft → BIBLE)".
**Supersedes (in spirit):** the founder-centric framing of the original Communities Protocol draft — see [§ What changed from the draft](#what-changed-from-the-original-draft).
**Audience:** the design partners getting aligned before branches reconcile — notably **Avi** (`feat/communities`, the communities branch) and **Vinney** (`feat/pubkey-tagging-target`, the tagging branch). Read §1–§6 for the redesign; §7 for the branch situation.

> **Why this doc exists.** Scoping the Communities Protocol produced a stack of foundational decisions, most of which turned out to be *general concept-graph machinery*, not community-specific. This doc preserves that reasoning so it survives between sessions. The **general** piece (Resolved Definition) is ready to extract into the BIBLE; the **community-specific** foundations are settled but the protocol is incomplete, so they live here until they graduate.

---

## 1. The founding tenet — no privileged center

Every Community Declaration (CD) is **its author's own view, resolved from their own PoV**. There is no protocol-level founder, leader, anchor, or canonical roster — and crucially, **no default field for any of those**, because a slot for "leader" makes centralization read as expected.

- Centralization is always a **hard opt-in**, expressed in your own CD via the `b` tag ("I defer to X"), and **revocable** (re-publish without it). No one can stop you; no one is nudged into it.
- "Canonical" membership is **emergent**, never imposed: when many people happen to `b`-defer to the same CD *and* their webs of trust overlap, their resolved rosters converge — and that convergence *is* the community. Any of them can defer out tomorrow.
- Disagreement is **native**: "Alice and Bob agree today, disagree tomorrow about leadership" → Alice keeps `b`→X, Bob drops it or points `b`→Y. They diverge; the protocol just reflects it. There is no global leadership to dispute, so no dispute machinery is needed.

**Principle (ADR-worthy as the protocol's foundational tenet):** *No privileged center. Every CD is its author's own view from their own PoV; deference (`b`) is the only path to shared definition, and it is always a personal, revocable opt-in — never a default field. Centralization must be built by participants, never assumed by the protocol.*

---

## 2. The general primitive — Resolved Definition  ✅ READY to extract

**This is general concept-graph machinery, not community machinery.** Alice has a resolved definition of "dog" that may or may not equal Bob's — same mechanism as a community.

**Resolved Definition = the read-side companion to the `b` tag (§25).** `b` is the *write* primitive ("I defer to X"); the resolved definition is the *read* primitive ("what I actually mean by X, after following my deferences").

- **Closure.** From a node, trace `b` / `INHERITS_FROM` transitively → the set of all CDs/concepts it defers to (the **Declaration Closure** for CDs). The closure is a derived query (`MATCH (n)-[:INHERITS_FROM*0..]->(x)`), not stored.
- **The closure is not a DAG.** Dense mutual deference *will* create cycles (Alice `b`→Bob, Bob `b`→Alice). That's fine — see the resolution rule's visited-set.
- **Resolution rule** (produces the resolved definition by merging the closure):
  1. **Your own stated fields win** (child overrides ancestors — ADR 0027). So any conflict can always be settled by stating the field yourself; conflicts only bite for fields you left unstated.
  2. **For unstated conflicts among multiple `b` parents, first-listed `b` tag wins.** You order your `b` tags, so you control precedence — deterministic, no PoV-dependence. Walk depth-first in listed order; first value to land sticks.
  3. **Visited-set (keyed on a-tag) bounds cycles** (carried from ADR 0027). The walk always terminates and always yields *an* answer — never "ambiguous → undefined."
- **Multi-parent is allowed**, and therefore **multiple roots are possible** (a closure can reach several `b`-less CDs). Roots are powerless, so root-count doesn't matter.
- This **formally fills the multi-parent resolution order that ADR 0027 deferred** ("resolution order is a consumer concern") and **defines the general `effectiveX`** that §25 forward-referenced as `effectiveCD` — i.e. extracting this **closes story #31's one open review follow-up**.

**Status:** settled. Destined for a new BIBLE section (≈ §26 "Resolved Definition", next to §25) + an ADR in the 0027 lineage. Heuristic note: first-listed-wins is "good enough for now"; WoT-weighted field resolution was explicitly *rejected for v1* (it would make your own definition vary by observer — surprising, not worth it yet).

---

## 3. Communities foundations (settled; protocol still incomplete)

Built **on top of** the general primitive above. The throughline: **a community is just a concept.**

- **community = concept; member = element; CD = concept-definition; `b` = definition-inheritance.** The Communities Protocol is a thin reading of the existing concept graph, not its own thing.
- **Declaration Closure does double duty**: as a *set* it gives **identity**; as an *ordered DAG* it gives the **resolved definition** (§2).
- **"Same community" is two orthogonal axes** — both per-observer, both graded:
  1. **Definition overlap** — graded similarity over closures (overlap coefficient / Jaccard). `0` = unrelated, `1` = identical. (Replaces the earlier binary "overlap > 0".)
  2. **Mutual membership** — each is actually a member (below).
  You need the **conjunction**. Overlap alone = "talking about the same thing"; membership alone = "each in *a* community."
  - Consequence (a *feature*, but state it): overlap-based sameness is **non-transitive** → communities overlap and bleed; they do **not** partition people into disjoint buckets. Any *gating* feature must therefore pick a *specific* closure/definition to gate against (the enforcer's own); there is no global roster.
- **Membership = trust-weighted element-of-concept**, and it is **orthogonal to authoring a CD**:
  - A **CD** is a *definition* (your view + rules + `b`-deferences). Authoring one makes you a **definer**, not a member (the zoologist who defines "dog" is not a dog).
  - A **membership Tag** is the *assertion of belonging* — self-tag ("I'm in") or vouch ("they're in"). It is literally "this pubkey is an **element** of the community concept," but *earned through trust-weighted vouches*, not a bare self-claim.
  - **Membership is derived**: Tags evaluated against the resolved definition, from a PoV, GrapeRank-weighted.
  - So: author a CD with no Tag (an observer with opinions, not a member); or hold a Tag with no CD (vouched in, never published a definition — the site resolves a default view).
- **A CD needs no `b` tag** — a `b`-less CD is a standalone definition (a "root" with zero special status). Plural roots are normal.

### Identity — RESOLVED (2026-06-05): identity = concept identity

Community identity is **concept identity, inherited wholesale** — no new mechanism. "Which LFO is *the* LFO" is the same question as "which `dogs` is *the* dogs," and §22 grapevine-resolution already answers it.

- **The shared referent is an ordinary community concept** (kind-39998, e.g. `39998:somebody:lfo`) — forkable, WoT-ranked, **powerless**, exactly like `dogs`. Members are its trust-weighted **elements**; CDs are its **definitions**. There is no privileged node *above* the definitions.
- **Bootstrap:** a newcomer becomes comparable by *pointing at that concept* — tag against it (enter the **population**) and/or `b`-defer to a CD in its cluster (adopt a **ruleset**). First-mover gets only a forkable **naming** advantage, **zero protocol power** — a Schelling edge that's forkable isn't durable.
- **Safety property — keep population (Tags/elements) separate from ruleset (CDs).** Load-bearing, not tidiness: a captured definition-hub can drift *cutoffs/roles* for its voluntary deferrers, but it **cannot retag people** — it can't add or remove members. The *who's-in* layer does not move with a rogue rule-hub.
- **Live-`b` caveat** (the §25 trust-coupling cost, now load-bearing): because deference tracks future edits, the dominant CD holds a *retroactive editorial lever* over live deferrers, and a compromised mid-chain CD can drift a deferrer's identity (closure shift). Blunted by (1) the population/ruleset split above, and (2) **distance-weighted** closure overlap (nearer shared ancestors count more) — the concrete reason to make the overlap metric distance-aware when refined.

### Membership — RESOLVED in design (2026-06-05): consume the nostr-user-tag

Membership is **the existing pubkey-tagging primitive, consumed** — not a community-specific schema. The `feat/pubkey-tagging-target` branch (Vinney) already ships the **nostr-user-tag** (its `ADR-0001`): a kind-39999 event —

- `pubkey` = the **asserter** A (GrapeRank-weighted),
- `['p', target]` = the tagged pubkey **P**,
- `['e', concept]` = the **applied concept**,
- `['polarity', '+1' | '-1']` = **apply / dispute**,
- `['z', '39998:<TA>:nostr-user-tag']` = class.

This is a 1:1 match for the membership Tag we designed: **self-tag vs vouch** = `pubkey == p`; **disputes** = `polarity: -1` (already present); **per-PoV weighting** = the POV-namespaced Meili WoT scores (`wot_<metric>_<povSuffix>`, via the branch's `wotScore.js`).

**Community membership = nostr-user-tags whose applied concept (`e`) is a community concept.** The roster, from a PoV: gather those tags → weight each asserter by GrapeRank from the PoV → net assert-vs-dispute → gate by an influence cutoff (the existing `INFLUENCE_CUTOFF` presets: permissive 0.05 / default 0.6 / restrictive 0.9) → apply the resolved-definition's threshold/roles. Structurally **the existing verified-follower pattern over membership-tags.** "No veto" falls out automatically — disputes are WoT-weighted, not counted.

**The Communities layer adds only a thin top:** (a) recognize a concept as a person-taggable "community" concept, and (b) apply the resolved-definition's cutoff/threshold/roles to the existing tag-member-set. Self/vouch, disputes, and per-PoV weighting are all inherited.

**Roles** (applicant = self-tagged, below threshold; member = net qualifying vouches clear threshold; **admin OFF in v1**) are predicates over this roster, defined in the resolved definition.

**Future-signals hook (filed, NOT v1):** membership currently derives from Tags alone. We may later let membership also depend on signals *beyond* Tags. The design leaves room for that — address if/when we decide; do not design it now.

---

## 4. Naming

- **Declaration Closure** for the `b`-closure of a CD. **Avoid "Set"** (collides with Tapestry's existing `Set` node — a subset of a superset, BIBLE §6). **Avoid "Array"** (implies order, but *identity* is a set-overlap operation). "Deference Lineage" / "Definition Lineage" are acceptable alternatives.
- **"Resolved Definition"** for the merged read-side result (general).
- **CD term itself — OPEN.** "Declaration" vs "Definition" undecided; this doc uses *Declaration* (CD).
- **"House PoV" leaves the protocol** — it survives only as a *site rendering default* (which PoV to show a PoV-less visitor), never a community/protocol property.

---

## 5. Open questions (where we paused)

1. ~~**Identity / the shared referent**~~ — **RESOLVED 2026-06-05.** Community identity = concept identity (an ordinary forkable, WoT-ranked community concept; members = elements, CDs = definitions; first-mover powerless). See §3 → "Identity".
2. ~~**The membership half**~~ — **RESOLVED in design 2026-06-05.** Membership = consume the nostr-user-tag (`feat/pubkey-tagging-target`), gated by the resolved definition. See §3 → "Membership". The *remaining* open item is delivery, not design — see §7.
3. **Mechanical leftovers**: membership threshold (1 vouch vs N ≥ 2 for a safe space); the CD-term name; the eventual ADR/BIBLE section split.

---

## 6. Decisions explicitly ratified for capture

The user explicitly agreed to both:
1. **Promote "Resolved Definition + the resolution rule" to a general primitive** (BIBLE near §25 + an ADR), with Communities as the thin application on top.
2. **`first-listed-wins`** as the multi-parent conflict heuristic for now (refine — possibly WoT-weighted — later).

The founding tenet (§1), the foundations (§3), **identity**, and **membership** (§3) are agreed in substance. What remains before a Communities BIBLE section is **delivery** (§7), not protocol design.

---

## 7. Open issue (delivery, not protocol): three-branch reconciliation

The protocol *design* is settled, but membership depends on the nostr-user-tag schema, which lives on a **different branch**. Three branches, three owners:

- **`staging`** — the integration branch (this doc lives here).
- **`feat/pubkey-tagging-target`** (**Vinney**) — ships the nostr-user-tag membership primitive communities will consume. Large/divergent: ~203 files, ~46k insertions vs staging, and it carries its own `ADR-0001` (nostr-user-tag) plus `ADR 0019/0020/0021` that **collide** with staging's task-queue ADR numbers (the branch predates the #236 epic-folder reorg). *Note for Vinney:* the nostr-user-tag schema is now **load-bearing for communities**, not just profile-tagging.
- **`feat/communities`** (**Avi**) — presumably still on the original founder-centric draft this redesign supersedes. *Note for Avi:* the design shifted substantially — read §1–§6 before continuing on that branch.

Reconciling the three is an **organizational + delivery** decision, not a protocol one. The open question for the user + Avi + Vinney: e.g. land `feat/pubkey-tagging-target` (or carve out just the nostr-user-tag schema) onto staging first, vs. design communities against the schema and merge later. **Communities v1 membership is blocked on the nostr-user-tag core reaching staging.** The ADR/story-number collisions on `feat/pubkey-tagging-target` need an explicit renumbering/merge plan — the epic-folder scheme from #236 is the tool for that.

---

## What changed from the original draft

The original Communities Protocol draft was founder-centric; this design **replaces** those parts:

- Draft §3.2 "a community *requires* a first author; that author is the founder" → **deleted.** No required founder; many powerless roots.
- Draft §5.1 "House PoV (default; canonical), seed = founding author" → **deleted.** No canonical seed; default is per-observer; "House PoV" is only a site rendering default.
- Draft §5.3 "canonical membership" as a recommended default → **replaced** by emergent convergence (deference clusters) + the two-axis fuzzy "same community."
- The draft's `affiliation` tag → already generalized to the `b` tag (story #31 / ADR 0027 / §25). The draft's `effectiveCD` → generalized to **Resolved Definition** (§2).

What survives from the draft: the Tag-vs-CD split (now sharpened as membership-vs-definition / element-vs-concept), roles-as-predicates, trust-weighted disputes (no veto), GrapeRank-gated membership, and the LFO (Les Femmes Orange) safe-space worked example.

---

## Next steps

1. **(A) Extract Resolved Definition into the BIBLE** — new §26 + an ADR in the 0027 lineage, via the proven story-#31 path (thin story → ADR → BIBLE → review; Test Design skipped). Closes story #31's `effectiveCD` follow-up. *Independent of the branch reconciliation — can proceed anytime.*
2. **(B) Three-branch reconciliation (§7)** — user discusses sequencing with **Avi** (`feat/communities`) and **Vinney** (`feat/pubkey-tagging-target`). Gates Communities v1 membership.
3. **(C) Later:** the Communities Protocol's own BIBLE section(s), layered on §26, once the branches reconcile and the design is locked. Then flip this doc's Status to ✅ SUPERSEDED.
