# PRD Seed: Goal Intent — the prompt, the estimate, and the two flags

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/audit.md`
**Anchor:** acceptance frame in `book.md` — **goal-derived**, transcribed verbatim from an owner-ratified goal by `GET /api/brain/direction/<slug>`, not hand-authored
**Confidence:** **medium-high** — unusually high for a seed, because the anchor is the owner's own words rather than a reconstruction. It is *not* high, because the frame is one owner's two-sentence goal statement, and everything about *why* the four exist and *who else* would use them is inference.
**Date:** 2026-07-27

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`. Adopt it as the starting point for `/discover` on the next phase and validate each section.
>
> **What makes this seed unusual, and where to be careful.** The anchor is genuinely the owner's — two sentences the owner wrote on a goal, ratified through a proposal, and transcribed byte-for-byte. That makes §3 (scope) trustworthy. It also means there is **no stated problem, no stated user other than the owner, and no stated success measure** anywhere in the record. §1, §2 and most of §5 are inference from the code and from sibling second-brain artifacts. Do not read confidence in §3 as confidence in §1.

---

## 1. Product vision

`[FROM FRAME]` The owner's goals should carry not just *what* the goal is, but *how it should be worked* — and that information should be visible everywhere a goal shows up.

`[INFERRED]` Tapestry's second brain records the owner's goals as signed records in a local-first knowledge graph. Sessions (agents) read that brain to orient themselves; the owner reads it through three control-panel screens. This book added the first properties that describe a goal's **workability** rather than its content:

| Owner's words | Stored as | What it says |
|---|---|---|
| the prompt | `prompt` | the markdown to give an agent at the start of a session aimed at this goal |
| the estimate | `chanceOfSuccess` | 0–100: chance an agent completes this goal with no human input |
| flag: needs the owner | `needsHumanInput` | the goal can't move without the owner answering something |
| flag: too big as it stands | `needsBreakdown` | the goal should be broken into smaller goals |

`[INFERRED]` Read together, these four are **the seed of an agent-dispatch layer**: a prompt to launch with, an estimate of whether launching is worth it, and two blockers that say *don't launch yet, and why*. Nothing in this book acts on any of that — the frame forbade it explicitly. But the shape of the four is unmistakably "which goals can an agent be pointed at, and with what."

`[UNKNOWN — product input needed]` **The problem this solves was never written down.** The frame states a *gap* (*"anything set today is invisible"*) rather than a *need*. Why the owner wants the four, what they will do once all four are visible, and whether the dispatch reading above is the intent or an artifact of the property names — none of that is in the record.

## 2. Personas

`[FROM FRAME]` **The owner.** The only persona the frame names, in the first person: *"I can set … and all four come back."* Behaviour visible in the as-built: captures goals in conversation with an assistant, browses them on three screens, and — for the four specifically — currently has **no way to set them from a screen** (§3).

`[INFERRED]` **A session (an agent reading the brain).** Not named in the frame, but the epic's Planning gate ratified that *"every surface that shows a goal"* includes the machine-facing reads (`orient`, the proposal queue, the Direction transcription). The four now travel on all of them. A session is arguably the *primary* consumer of `prompt` — a human does not need their own prompt handed back to them.

`[UNKNOWN — product input needed]` **Anyone other than the owner.** Every brain read surface is owner-gated (`403 Owner access required` for anyone else, verified on staging). There is no shared, delegated or multi-owner story here at all. Whether that is a v1 simplification or the permanent shape is not recorded.

## 3. Scope (as-built)

### In scope — shipped and verified `[FROM FRAME]`

- **Set the four when a goal is captured** — capturing a new root goal from a session, and capturing a child goal while breaking a bigger one down.
- **Set the four when a goal is updated** — the intent-update path accepts them alongside the three fields it already took.
- **Set the four by supplying a whole goal record** — seven record-replicating paths (record editor, wholesale replacement, restore from export, archive import, fork, re-import from the relay, direct json replacement) already carried them and were deliberately left untouched.
- **A brand-new instance can hold them** — a fresh instance's self-provisioned goal concept now declares all four, so they are no longer silently dropped there.
- **All four come back on every projecting read** — goals list, goal detail, session orientation (`served`), proposal queue (the nominated goal), Direction transcription.
- **All four are shown on the three existing goal screens** — Goals, Goal detail, Proposals. The prompt is shown **as its own text**: in full on the detail screen, as an excerpt of the real text on the two list-type screens. A bare "has prompt" badge was explicitly ruled insufficient.
- **A never-set value is never invented at any layer below the screen.** Storage omits the key; every read surface returns `null`. Only the *screen* interprets absence, using the concept's own declared defaults.

### Out of scope — and these are the interesting ones `[FROM FRAME]`

- **No rules about which prompts may run.** Nothing validates, clamps, rejects, coerces or trims any of the four. A prompt comes back byte-identical; an estimate of `150` or `"75"` is stored as supplied.
- **Nothing acts on the estimate or the flags.** No ranking, sorting, filtering, grouping, gating or badge keys off them anywhere — verified at the read surfaces and at the screens.
- **No new screen, route, tab or view.**

### Deliberately not built, and worth knowing `[INFERRED]`

- **No way to set the four from a screen.** They are visible on three screens and settable on none of them. The owner sets them in conversation with an assistant, or by editing a goal's raw record in the generic element editor. *(This is the single largest gap between "what a user can see" and "what a user can do" that this book leaves.)*
- **No way to clear a value back to unset.** The frame's verb is *set*; erasing was ruled a capability it does not name.
- **No backfill.** Goals that already exist have whatever they had.
- **`dependsOn` / prerequisites** — a fifth declared-but-unused property, still underivable. Never in scope; reported as still-unavailable rather than as a miss.

### Where "every surface" has ratified exceptions `[INFERRED]`

Three goal-showing payloads carry **none** of the four, by design: the session-orientation read's bounded root list, a goal's ancestry chain, and a proposal's "considered instead" runners-up. Each is a *bounded slice* or a *reference to a different goal*. A fourth exclusion is harder: the Direction transcription's blinded-judge steps are closed to goal content permanently, because a goal field there would break a blinding contract. **The product team should know that "every" was interpreted, not applied literally.**

## 4. Domain model

`[INFERRED]` from the concept graph and the shipped code.

**Entity: the owner's goal** — concept handle `39998:<TA>:tapestry-owner-goal` (`<TA>` resolved at runtime, never hardcoded). Adopted by this book, not redefined; no property was added to the concept and none was renamed.

| Attribute | Type | Set by | Absence means |
|---|---|---|---|
| `name`, `slug`, `description` | string | capture | required |
| `origin`, `capturedOn` | string | capture | — |
| `deliverable`, `boundary`, `parent` | string | capture / update | not stated |
| **`prompt`** | string (markdown) | capture / update | **no declared default** — the screen says *"No prompt written yet."* |
| **`chanceOfSuccess`** | number 0–100 | capture / update | concept says *"The default is 0, if not otherwise estimated"* |
| **`needsHumanInput`** | boolean | capture / update | concept says *"Absent means false"* |
| **`needsBreakdown`** | boolean | capture / update | concept says *"Absent means false"* |

**The one rule that governs all four, across three layers** — worth carrying into any future PRD verbatim, because it was arrived at through two gate kick-backs:

> *A value that was never set is stored as an absent key, returned as `null`, and only **interpreted** at the screen. No storage layer, transport or read surface ever fabricates `0`, `false`, or an empty prompt.*

The decisive argument was a round trip: the export omits unset keys and restore writes an export's section back **verbatim**, so a `0` invented at any lower layer would convert *"never estimated"* into *"estimated at zero"* on every goal, permanently, in a single backup cycle.

**A consequence the product team should decide about.** At the screen, the interpretation is applied and the distinction disappears: a never-set estimate reads `0 out of 100`, identical to a stored `0`; both flags read `no` whether stored `false` or never set. **Five of the 31 live goals store `needsHumanInput: false` explicitly**, so this is not hypothetical. The data keeps the distinction; the screens do not show it.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI and the ADRs; the rules were derived per-story rather than from any design guide, except where noted.

1. **The screen is the interpretation point.** Absence is turned into meaning exactly once, at the last possible moment, in one shared formatter module (`ui/src/utils/goalIntent.js`).
2. **The prompt is shown as content, never as a badge.** Full text on the detail screen; a ~140-character excerpt of the real text on list screens. *(A Product Owner call, flagged as overrulable, not an owner ratification.)*
3. **A never-set prompt says so in words** — *"No prompt written yet."* — and a prompt that was set and then emptied says something different — *"The prompt is empty."* Rendering a literal `null`, or an area indistinguishable from an empty prompt, was ruled insufficient.
4. **Owner-facing labels are plain-language, not field names:** *"Could run on its own:"*, *"Needs you:"*, *"Too big as it stands:"*, *"Prompt:"*. Values are words, not booleans: `yes` / `no`.
5. **A number appears only where the owner wrote one.** `[RATIFIED — needs product follow-up]` The second-brain design principle *"no numeric score, percentage, gauge or ranking number in owner-facing proposal content"* was **narrowly superseded by the owner** for owner-recorded values. The prohibition on *system-generated* scores is fully intact. Consequence: on the proposal card a never-set estimate renders in words (*"no — you haven't estimated this one"*) rather than as `0`, because a screen-applied default was authored by nobody. **The two other screens do render `0`.** The per-screen inconsistency is documented and is an open operator lever.
6. **No new design token, no new component, no new hook.** The change is one pure formatter module, three screen edits, and exactly one CSS declaration (`white-space: pre-wrap` so a multi-line prompt keeps its line structure).

`[UNKNOWN — product input needed]` **No rule was ever recorded for a very long prompt.** One live goal carries a 6 155-character prompt, which renders in full on the detail page with no collapse affordance. That was ruled out as new screen-level machinery.

## 6. Carry-forward & open questions

Promoted from build audit §6. The product-shaped ones first.

**Product decisions**

- [ ] **Should the owner be able to set the four from a screen?** They are now visible on three screens and settable on none. Today they are set in conversation or by editing raw JSON. This is the biggest see-but-can't-do gap the book leaves.
- [ ] **Should *never estimated* look different from *estimated at 0*, and *explicitly false* different from *never flagged*?** The data distinguishes them; the screens do not.
- [ ] **Resolve the estimate's per-screen inconsistency** — either widen the ratified exception so a screen-applied `0` may render as a number on the proposal card, or state the never-set estimate in words on all three screens. Currently the operator's open lever.
- [ ] **The second-brain style guide is out of date.** It still says a numeric score never appears in owner-facing copy in v1; that now has a ratified exception. Engineering does not write into `product-team/` — this is the product team's edit.
- [ ] **What happens to a malformed value?** An estimate of `150`, or `"75"` as a string, is stored and displayed as supplied. Deliberately undefined by the frame. If the four ever feed a decision, this becomes a real question.
- [ ] **Is the agent-dispatch reading of the four the intent?** If yes, the next phase is about *acting on* the estimate and the flags — which this frame explicitly forbade, so it needs a new ratified goal, not an extension of this one.
- [ ] **A collapse affordance for very long prompts** on the goal detail page.
- [ ] **`dependsOn` / prerequisites** — the fifth declared property, still unused and underivable. Is it wanted?

**Engineering follow-ups** *(listed so the product team can see what is already owed; details in audit §6)*

- [ ] A staging (or signed-in) read of the five brain surfaces — the one frame bullet not verified end to end there.
- [ ] Promote to production, or decide not to. Nothing is on `main`.
- [ ] OPEN.md row 102 (goal-schema `required`) is repaired on local only; staging and production presumably still carry it.
- [ ] Retire the Direction endpoint's raw-record estimate workaround and correct a now-false sentence in its `unavailable` block.
- [ ] A fresh-instance drill — the only acceptance criterion in the book without end-to-end evidence.
- [ ] Two latent drift hazards: the Direction core's hand-maintained copy of the field list, and the absence of any checker comparing the provisioned schema against the live one.

## 7. What product must validate

- [ ] **§1's problem statement is entirely inferred.** The record contains a gap, not a need. What is the owner actually trying to do with the four?
- [ ] **§2's session persona is inferred from a gate ratification**, not from any stated user model. Is a reading agent a first-class user of this data, or incidental?
- [ ] **§1's agent-dispatch reading** — is that the direction, or a coincidence of the property names?
- [ ] **The "every surface" exceptions in §3** were engineering interpretations of the owner's word *"every"*, ratified at a gate. Confirm each: root list, ancestry, proposal runners-up, blinded judge steps.
- [ ] **The two Product Owner calls in §5** (prompt excerpt on list screens; never-set prompt shown in words) were explicitly flagged as overrulable without disturbing anything else.
- [ ] **Success measure — none exists.** There is no metric, no target, and no stated way to tell whether making the four visible helped. If the next phase acts on them, it will need one.
- [ ] **Owner-only is currently absolute.** Confirm that is intended and not merely unbuilt.
