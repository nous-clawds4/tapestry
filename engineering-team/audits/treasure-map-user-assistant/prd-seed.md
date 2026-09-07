# PRD Seed: Whose Assistant Publishes Your Lists

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/treasure-map-user-assistant/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for what shipped; the open questions below are genuinely open
**Date:** 2026-09-07

> A reverse-engineered baseline in PRD shape. This book was a **defect correction** on a surface
> the `tl-treasure-map` book built, so this seed is deliberately thin on vision (that lives in
> `audits/tl-treasure-map/prd-seed.md`) and pointed on the one product model it clarified:
> **assistants are per-user, and every surface must say whose.**

## 1. Product vision

`[INFERRED]` Each person on a Tapestry instance has their **own** Assistant, minted at signup.
The instance owner's Assistant is not a shared utility that acts for everyone — it is simply the
owner's. Any surface that says "your Assistant will do X" must resolve *your* Assistant from the
session, and any surface that judges "is this already delegated to me?" must judge against the
viewer's own key. `[UNKNOWN]` Whether users should ever be able to delegate to *another* user's
Assistant deliberately (today an entry pointing anywhere else is shown as "external" and the
product offers to replace it).

## 2. Personas

- `[FROM FRAME]` **The Brainstorm customer on someone else's instance** — signs up, gets an
  Assistant minted, and expects the instance to publish *his* lists under *his* Assistant. This
  book exists because that expectation was violated for the first real one of these users.
- `[INFERRED]` **The instance owner** — the only persona for whom the old (wrong) behavior was
  indistinguishable from the right one. A single-persona dev environment cannot surface this
  class of bug; a second signed-in identity is the cheapest instrument that can.
- `[INFERRED]` **The unprovisioned viewer** — signed in, no Assistant. Today: sees the Map, its
  entries, and the hand-edit panel; sees no delegation card at all. See §7.

## 3. Scope (as-built)

`[FROM FRAME]` Per-user delegate everywhere on the Treasure Map surface (check, preview,
published tag, badge); null-assistant safety; copy and spec wording; the hand-edit panel
available to every viewer of a found Map. Out of scope and still out: provisioning flows,
creating a Map from nothing, delegating to a third party on purpose.

## 4. Domain model

`[INFERRED]` unchanged by this book, with one relationship sharpened:
- **User → Assistant** is 1:1 and per-user (`getAssistantKeys`); the **owner's** Assistant
  doubles as the *instance* Assistant (the TA that signs firmware and instance-level artifacts).
  These are the same key for one person and different keys for everyone else — the conflation
  that caused the defect. Surfaces about *identity of the instance* (e.g. the TA badge on an
  avatar) correctly keep using the instance value; surfaces about *what will happen for you*
  must use the session value.

## 5. Design rules (as-built)

`[INFERRED]`
- **Name the owner of a judgment in the copy.** "Published by your Tapestry Assistant",
  "Your assistant" — first person, so a wrong key becomes visible as a wrong claim.
- **Withhold judgment rather than guess** while the baseline is unresolved, and render nothing
  rather than a prompt that cannot be honored (null assistant).
- **An escape hatch outranks the feature it sits beside.** The hand-edit panel needs only a
  found event, so it is mounted by the page, never nested inside a conditional panel.

## 6. Carry-forward & open questions

Promoted from audit §6: provisioning UX for unprovisioned viewers; creating a Map when none is
found; the operational items (duplicate cherry-picked commit, the unpromoted `trusted-lists`
bundle) which are engineering-side only.

## 7. What product must validate

- [ ] `[UNKNOWN]` **The unprovisioned viewer.** Silence is the current answer. Should they be
      told why there is no card, offered provisioning, or left alone? This is the one user-facing
      gap the fix deliberately left.
- [ ] `[UNKNOWN]` Should delegating to *someone else's* Assistant ever be a supported choice
      rather than something the UI offers to replace?
- [ ] `[INFERRED→validate]` That "one Assistant per user, and the owner's happens to also be the
      instance's" is the durable model — every surface built on this page now assumes it.
