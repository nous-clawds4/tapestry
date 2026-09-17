# PRD Seed: Shrinking a Tapestry in place (remove-only membership editing)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/take-a-concept-back-out/audit.md`
**Anchor:** acceptance frame in `book.md` — **goal-derived** (operational Direction): the frame was transcribed verbatim from the owner-ratified goal `take-a-concept-back-out` (anchor distance 0), not hand-authored and not reverse-engineered at close
**Confidence:** **high** for scope and behavior (the frame is the owner's own ratified words; the shipped behavior is verified by suites three parties ran, and — unusually — by the owner's *own live use on both targets*, corroborated on the relays at close); **low** for vision and personas (never stated beyond the goal's prompt — inferred and flagged)
**Date:** 2026-08-04

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the goal-derived acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. The product team adopts this as the starting point for the next phase and validates each section. This seed is the sibling of `audits/add-a-concept-to-a-tapestry/prd-seed.md` — together they now describe both directions of membership editing.

## 1. Product vision

`[FROM FRAME]` The owner of a Tapestry instance can shrink a Tapestry they are looking at: take out a concept that is in it, save, and the Tapestry — at its same address, with everything else as it was — no longer shows that concept to them or to anyone who opens it afterwards.

`[INFERRED]` The larger arc: Tapestries are owner-curated, living collections of concepts (browse → explore → create → per-concept depth → add (#5) → now remove (#6)). With both editing directions shipped, membership is fully owner-curatable in place — a concept added by mistake, or one that no longer belongs, no longer forces abandoning the tapestry and starting over. The goal's own framing ("an emptied Tapestry is a deletion, and deleting is not this goal") implies tapestries are meant to *persist and evolve*, not to be disposable.

`[UNKNOWN — product input needed]` What the owner ultimately curates tapestries *for* (presentation? navigation? teaching?) — still never stated anywhere in the record (carried unanswered from the add-book seed).

## 2. Personas

- **The instance owner (curator).** `[FROM FRAME]` The acting user, strictly. The frame's first person (*"my own key or my assistant one"*) was ratified — same reading as #5 — to mean the owner's key and the instance's Tapestry Assistant (TA). Only a session classified `owner` is ever offered the take-out control. **This time the persona is validated by behavior:** the owner personally performed the removal on local and staging (2026-08-04) and reported it functions as intended.
- **Every other visitor (passive beneficiary).** `[FROM FRAME]` Signed-out sessions, guests, non-owner users: they see the reduced membership when they open the Tapestry afterwards. They are never offered the edit — the option "is not offered," absence over explanation.
- **The admin-who-is-not-the-owner (excluded, seam widened).** `[INFERRED]` Can still *create* a Tapestry (#3's shipped owner-or-admin gate) but can neither add (#5) nor remove (#6) — both editing affordances now gate on the single owner-strict `canEdit` expression. The documented inconsistency from the add book now spans two affordances.

## 3. Scope (as-built)

`[FROM FRAME]` — all shipped and verified:

- From the existing per-Tapestry Exploration page (`/tapestry/tapestries/<uuid>`), the owner can take out **one member concept per save**; the flow repeats to remove more.
- **Nothing publishes until the owner confirms**: choosing a concept arms an inline confirmation naming it ("Take out *{name}*? … Nothing changes until you confirm"); Cancel — or a failed publish — leaves the tapestry unchanged.
- **A Tapestry keeps at least one concept**: at exactly one member, the owner sees a plain-language refusal sentence *instead of* any control — refused up-front, never offered-then-errored. No save from this surface can empty a tapestry.
- Works on Tapestries authored under the **owner's key or the TA's**; the save republishes under the Tapestry's **existing author key** through the already-existing publish paths. Anyone else's tapestry, or any non-owner viewer: the option is simply not offered.
- **Everything else stays as it was** — structurally: the replacement is a verbatim copy minus the one concept and what the tapestry carried *solely on its behalf*; every other member, title, description, authored connections, unknown fields, and ordering pass through byte-identical.
- **No new page, no new route, no new server endpoint, no new dependency.**

`[FROM FRAME]` — explicitly out of scope (the boundary's own words):

- Adding (shipped, untouched — regression-guarded to zero changed lines); changing how concepts connect.
- Emptying or deleting a Tapestry, by any means.
- Editing a Tapestry published by someone else — including whose key could republish it (unsettled, separately goaled).

`[INFERRED]` — additional as-built properties worth knowing:

- **"Gone" is real, not cosmetic:** the per-member import the tapestry carried for the removed concept leaves with it, attributed by a union of evidence (what the page actually resolved ∪ the picker's derivation ∪ the naming convention) — necessary because a surviving import would silently re-materialize the concept at read time, and because real data already contains a member whose naming diverged. An import the system cannot attribute to anyone **stays** (removing it would be an edit beyond removing).
- The last-concept count counts **concepts only** — a tapestry whose graph holds one concept plus auxiliary nodes still refuses.
- "Ghost" members (visible only via an import, with no authored membership) get no take-out control and a clear refusal — cleaning those up is a different kind of edit, deliberately not built (none exist in the wild).
- Removal is **recoverable in principle** (the relay keeps replacement history) but no undo/restore affordance exists.
- Batch removal is not offered (the frame's promise is singular); repeat-the-flow is the supported path.

## 4. Domain model

`[INFERRED]` from the concepts touched and the stored shapes (all handles use the runtime-resolved TA pubkey — never a literal):

- **Tapestry** — `39998:<TA>:tapestry`; an instance is a kind-39999 element z-tagged to it, identity = the coordinate `39999:<author>:<d-tag>`, which survives edits (relay-native replacement: newer `created_at` at the same coordinate wins; no reindex step; the graph database is not in the read path).
- **Membership** — the element's own `json.graph` block: a member is a node (`uuid: 39998:<TA>:<slug>`) plus an import (`39999:<TA>:<cg>-concept-graph`). **Removal = the member node + its solely-carried import(s) leave together**; the concepts themselves are untouched on the instance.
- **Attribution needs evidence** — the element stores no node→import mapping and real data proves naming can diverge; the shipped matcher uses read-time containment ∪ derivation ∪ convention, with a "claimed by no remaining member" guard. One documented residual exists (an import unresolvable now that resurrects later) — accepted over blocking removals.
- **The signing branch is data, not a decision** — the Tapestry's author pubkey selects owner-browser-signing vs assistant-signing (unchanged from #3/#5).
- **Concurrency** — last-write-wins at whole-event granularity (accepted: the actor is a single owner).
- No concept definitions changed; no firmware reinstall; no schema change; no new event kinds; no server-side surface at all.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI and the review record (no product-team design guide exists for this surface):

- **The affordance lives inside the existing page** (sidebar "Concepts" section, directly under the member rows, above the add control): per-member "Take out ⟨name⟩" actions in a compact list — deliberately *not* "×" buttons on the member rows themselves (those rows are selection buttons; the shipped markup stays byte-identical).
- **Destructive-feeling actions get a named, inline confirm** — not a browser `window.confirm()`: the confirm step carries the member's name and a plain-language reassurance ("The tapestry itself stays, at the same address; only this concept leaves it"), styled with the page's own idiom.
- **Refusal is a sentence, not a disabled button**: when the action is impossible (last concept), the owner reads *why* in plain words, and no control exists to fail.
- **Absence over explanation** for ineligible viewers/tapestries — nothing disabled, nothing to explain.
- **Truth over optimism:** post-save visibility comes from re-reading the same published coordinate every other session reads; if the removed concept was the one selected, the detail pane resets rather than showing a member that no longer exists.
- **Errors are inline and legible**, in the transform's/publish path's own words; membership is untouched on every failure path; a multi-layer busy guard prevents double-submit.
- `[UNKNOWN — product input needed]` Still no recorded visual/copy rule for the Tapestry surface beyond "follow the sibling idiom" — the confirm/refusal prose shipped Implementer-authored within an ADR-pinned shape. Two editing affordances now accrete idiom-by-idiom; a real guide is increasingly owed.

## 6. Carry-forward & open questions

Promoted from build audit §6 (see there for sources):

- **The rest of Edit a Tapestry:** author/alter integrations; edit title/description — each separately-goaled. Removing a *connected* concept is deliberately a successor of connection-editing (no tapestry in existence carries connections yet).
- **Editing tapestries published by someone else** — whose key may republish remains unsettled, separately goaled.
- **The two-curator-gates seam** (create: owner-or-admin; add/remove: owner only) — ratify or harmonize; it now spans two affordances.
- **Undo / restore** — history exists on the relay; is a recovery affordance wanted, or is "re-add it" enough?
- **Ghost members / unattributable imports** — refused/passed-through today; an import-editing successor if the wild ever produces one.
- **Batch promotion to production** — staging now carries both editing directions (#5 + #6); nothing is on `main`; the operator's stated intent is a future multi-feature batch.
- **Deleting a whole Tapestry** — explicitly not this goal ("an emptied Tapestry is a deletion"); no deletion path exists anywhere in the epic.
- **POV/WoT filtering** of the directory / affordances; the **~71 unread Neo4j tapestry rows** (epic-level continuity, untouched).

## 7. What product must validate

- [ ] **Is removal-with-confirm the right friction level?** The run ratified an inline named confirm (the owner's own prompt asked for it); validate it against real usage — too much ceremony for frequent curation, or right for a destructive-feeling act?
- [ ] **Undo/restore** — replacement history makes recovery *possible*; decide whether "re-add the concept" is the product answer or a real restore surface is wanted.
- [ ] **The owner-strict gate vs #3's owner-or-admin create gate** — now a two-affordance asymmetry an admin will eventually hit; ratify or unify (carried from the add seed, unresolved).
- [ ] **One-concept-per-save** — carried from the add seed for the remove direction too: acceptable long-term, or is batch curation wanted?
- [ ] **Non-owner users editing their own-key tapestries** on a multi-user instance — still excluded by the ratified reading of "my" (owner only); still unvalidated as product intent.
- [ ] **Whole-tapestry deletion** — the boundary fenced it out *of this goal*; is it wanted as its own goal, and with what recovery story?
- [ ] **What comes next in Edit a Tapestry** — integrations? rename? (each separately-goaled under the owner's Direction model).
- [ ] **A design/copy guide for the Tapestry surface** — two editing affordances shipped idiom-by-idiom; decide before the third.
- [ ] **Persona ground truth** — §1/§2's inferences about what Tapestries are *for* remain unvalidated (the owner's live use validates the *mechanics*, not the *purpose*).
