# PRD Seed: Tagging Event Inspector — auditing the assertions behind a profile's score

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/profile-tagging-inspector/audit.md`
**Anchor:** acceptance frame in `book.md` (operator's verbatim ask, captured + confirmed at intake)
**Confidence:** **high** on scope and behavior (grounded in a verbatim frame and verified on three live deployments); **medium** on the product *reasoning* beneath it (who this is for and what job it does was inferred, never stated as product discovery).
**Date:** 2026-07-17

> A reverse-engineered baseline in the product-team PRD shape, built from what shipped. A strawman for the product team, not a ratified spec. Sections tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN — product input needed]`. The product team adopts this as the `/discover` starting point for the next phase.

## 1. Product vision

`[INFERRED]` The tag detail page makes a claim about each profile — a score, `+N −M`, "N people in your web of trust applied this tag, M disputed it." Until now that number was the one thing on the page a reader could not check. This capability turns the number into **evidence**: open the signed assertions behind it and see who actually asserted what.

`[FROM FRAME]` It is the second instance of a deliberate pattern — *verifiability as a product feature* — established by the previous book on the tag's own definition event. The premise (from the architecture, not invented here): assertions in this system are public, signed, and auditable by anyone, so a UI that renders a score while hiding its evidence asks for trust the protocol was built to make unnecessary.

`[UNKNOWN]` Whether "audit the number" is a mainstream reader need or a power-user/operator one was never established by product discovery — see §7.

## 2. Personas

`[INFERRED]` from the story's "As a someone reading a tag's page" and the previous book's named audiences:

- **The skeptical reader** — deciding whether a tag on a profile is meaningful, and wanting to see *who* vouched before trusting the count. Behavior: opens the panel on a specific row, reads authors.
- **The operator** — debugging federation ("did this assertion arrive with both `z` tags?"). Behavior: reads the raw event's tag array.
- **The developer** — learning the on-the-wire shape of a `nostr-user-tag`. Behavior: reads the JSON.

`[UNKNOWN]` Relative size/priority of these three. The design serves all three identically (raw JSON + author pubkey); no persona was optimized for over the others.

## 3. Scope (as-built)

`[FROM FRAME]` **In scope, shipped:**
- Per-row raw-event panel on the tag detail page, toggled from the row's `⋯` menu (Show/Hide Raw Event).
- The panel shows **every** assertion behind the row's `+N −M` — the POV's WoT-trusted set unioned with the viewer's own — each as the complete signed event.
- Each block is identifiable (polarity + author pubkey) and the counted blocks reconcile exactly to the score.
- The `⋯` is reachable at every viewport width (raw-event-only on desktop; full menu on mobile).
- Read-only, no login gate (public data).

`[FROM FRAME]` **Deliberately out of scope** (deferred, not forgotten):
- Copy-identifier actions per assertion block.
- The same inspection on **other surfaces**: Note rows, the tag index, the Pinned tab, profile pages. *(This is the obvious next scope — see §6.)*
- Pagination/capping a large panel; a close affordance on the panel itself.
- Showing assertions from authors **outside** the POV's WoT ("who else said this, trusted or not") — a legitimate different feature.
- Syntax highlighting / JSON tree; client-side signature verification.

## 4. Domain model

`[INFERRED]` from concepts read (no definitions changed):

- **nostr-user-tag** (`39998:<TA>:nostr-user-tag`) — *"an assertion that a specific nostr user belongs to a tag category. **Each element** links a target pubkey to a tag event ID, with optional polarity."* The "each element" is the whole feature's premise: **many** assertions per (tag, target), from **many** authors. A profile's score is an aggregate over these.
- **nostr-event** (`39998:<TA>:nostr-event`) — the 7-field signed object the panel renders verbatim (id, pubkey, created_at, kind, tags, content, sig).
- **A key domain fact worth ratifying** `[INFERRED]`: *an event's bytes are point-of-view-invariant, but which events are "in view" is per-POV.* A signed event is identical from everyone's perspective; the *set* behind a score is defined by the viewer's web of trust, so it differs per POV. This is the opposite of the tag *definition* event (one event, POV-invariant end-to-end). The distinction is load-bearing for any future inspection surface and is currently captured only in an engineering guardrail.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI:
- Raw events render as **plain formatted JSON** in a monospaced, wrapping, scroll-capped block — no highlighting, no tree. (Consistent with the previous book; "plain JSON is the bar.")
- Each block is **captioned** with polarity ("Applied by" / "Disputed by") and the **author pubkey** — never a display name in the pubkey's place (a name is a claim the event doesn't make; the audience reads pubkeys).
- An assertion shown but not counted under the active POV carries an explicit **"not counted under this POV"** marker.
- The affordance emulates the page's existing `⋯` row menu; the menu **closes** on selecting the raw item (unlike the tag-header menu, which stays open) — because on mobile it is a full-screen sheet that would cover the panel.
- `[UNKNOWN]` No product-level design rule was ever recorded for raw-event surfaces; these are read off two engineering instances. If raw-event inspection becomes a first-class pattern, a design-guide entry (caption format, empty/degraded states, where the panel lives relative to its object) is the thing to author.

## 6. Carry-forward & open questions

Promoted from build audit §6:
- **Verify the `counted:false` marker empirically** — it shipped proven-by-code-read only (no runtime could reach the below-threshold-viewer state). Low risk, but unconfirmed.
- **The pattern is now established on two object types; the third is the decision point.** Note rows / tag index / Pinned tab / profile pages all have the same latent need. Generalizing is cheap now and (per the previous book's warning) expensive after three divergent one-offs — the two existing instances have already diverged structurally.
- **Payload / performance:** the API ships uncompressed on-deployment, so a very popular tag's panel data is heavier on the wire than modeled. Product-relevant only at extreme scale (~1,000+ assertions on one tag); engineering has a revisit trigger.

## 7. What product must validate

- [ ] **Is "audit the score" a reader feature or an operator/developer feature?** It shipped serving all three identically (raw JSON). If readers are the target, a friendlier rendering (names alongside pubkeys, a summary) may matter; if operators/devs, the raw form is right. This was never decided by discovery.
- [ ] **Should the pattern generalize deliberately now, or continue one surface at a time?** Deciding *before* the third one-off is materially cheaper. If yes, which surface next — Note rows (most analogous) or profile pages (highest traffic)?
- [ ] **"Who else said this, outside my WoT?"** — deferred as a different feature. Is it wanted? It would change the panel from "the evidence behind *your* number" to "all evidence," which is a different product statement.
- [ ] **Does a raw-event surface warrant a design-guide entry** (caption format, degraded/empty states, placement) rather than being re-derived per instance?
- [ ] **Ratify the POV domain fact** (§4) — "bytes are POV-invariant, the set is per-POV" — as product language, since it governs every future inspection surface.
