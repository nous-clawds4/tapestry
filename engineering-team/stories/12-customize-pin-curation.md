# Story 12: Customize curation method at pin time and on `/pins`

**Status:** Approved
**Created:** 2026-05-20
**Type:** Feature

> **Epic-internal label:** "Story 11" in `engineering-team/epics/pin-a-tag.md`.
> Global story numbering proceeds sequentially. Epic-internal #11 became
> the third epic story to ship after #10 (Pin foundational) and the
> shipped #12 (TL publication, global #11).

## Background

Story 10 (foundational Pin) writes every pin event with a hard-coded
default `curation-method`:

```json
{ "observer": "<self>", "method": "nip85:rank", "cutoff": 2, "includeScoreInTL": false }
```

Story 11 (TL publication, shipped as global #11) honors those values
at refresh time but provides no way to change them. The cutoff=2
default is too strict for nascent / low-density WoT data — a user
running on a small POV sees one-member TLs because barely any
targets get 2+ WoT-trusted endorsements. The includeScoreInTL=false
default means the published TLs are flat member lists, losing the
per-member rank signal that downstream apps could rank by.

This story exposes the curation-method fields directly to the user,
both at pin time and on `/pins` for editing existing pins. The
`refreshPinnedTags` generator from Story 11 already reads each pin's
own curation-method, so this story is mostly UI plus a small generator
extension for `includeScoreInTL=true`.

Per the decentralized-first invariant: anyone publishes whatever
curation values they choose. The published values are theirs to set.
Aggregating consumers may or may not respect them.

## User-facing description

As a NIP-07-authenticated user who has pinned tags, I want to choose
or change the **curation method** that drives my pinned-tag Trusted
Lists — primarily the **cutoff** (how many WoT-trusted endorsements a
target needs to be included) and whether to **include rank scores**
alongside each member — both when I first pin a tag and at any later
point from my `/pins` page; so that I can tune my pinned TLs to my
data density and to the level of detail downstream consumers need.

## Acceptance criteria

- [ ] **AC-1** — Given I am NIP-07-authenticated and on a tag detail
  page, when I open the Pin affordance, then I see (inline or in a
  dialog — the Architect picks the placement) editable controls for
  the curation method: a **cutoff** field, an **include rank scores
  in TL** toggle, and (under an Advanced disclosure) an **observer
  pubkey** field. Defaults match the Story-10 default
  (`cutoff=2`, `includeScoreInTL=false`, `observer=self`).

- [ ] **AC-2** — Given I have customized the curation-method controls
  and click the publish action, when the publication succeeds, then
  the kind-39999 Pin event is published with my customized
  `curation-method` JSON in both the `curation-method` event-tag
  and the `content` body — *not* the hard-coded default.

- [ ] **AC-3** — Given I am on my `/pins` page, when I look at a
  pinned-tag row, then I see an **Edit curation** affordance that
  opens the same controls as AC-1, pre-filled with that pin's current
  values.

- [ ] **AC-4** — Given I save an edit on `/pins`, when the publish
  succeeds, then the kind-39999 Pin event is **replaced in place**
  (same `d`-tag, new `created_at`, new curation-method values), and
  the pin row's row data reflects the new values immediately after
  the page re-fetches.

- [ ] **AC-5** — Given I edit a pin's curation-method on `/pins`, when
  the publish succeeds, then a TL refresh fires for that pin
  (fire-and-forget, the same shape as Story 11's refresh-on-pin) so
  the published kind-30392 reflects the new values within a short
  time without me clicking a separate Refresh now.

- [ ] **AC-6** — Given I enter a **cutoff** value that is not a
  positive integer (zero, negative, fractional, non-numeric, empty),
  when I try to save, then the form prevents submission and shows an
  inline validation message explaining the constraint
  (`cutoff must be a positive integer`).

- [ ] **AC-7** — Given my pin has `includeScoreInTL=true` **and** an
  observer POV that resolves to a WoT-rank column in Meili, when the
  TL is generated, then each member's `p` tag carries the member's
  `wot_rank` score in the documented kind-30392 slot
  (`["p", <pubkey>, "", "<score>"]`), and the existing
  TrustedListDetail page renders the score column for the TL.

- [ ] **AC-8** — Given my pin has `includeScoreInTL=true` **and** no
  WoT-rank column is resolvable for the observer (POV not configured),
  when the TL is generated, then the TL still publishes (does not
  fail) — members appear without scores, same as if the toggle were
  off; the UI surfaces a small warning on the editor that scores
  can't be included until POV is configured.

- [ ] **AC-9** — Given I view the **method** picker, when I look at
  the available choices, then `nip85:rank` is selectable (and is the
  default); the other documented options (`follows`,
  `trust-everyone`, `trusted-list`) appear as visible but disabled
  with a "coming soon" hint. Submitting a form with method ≠
  `nip85:rank` is impossible from the UI.

- [ ] **AC-10** — Given the **observer pubkey** field under the
  Advanced disclosure, when I enter a value that isn't a 64-char
  lowercase hex pubkey (or a valid `npub1...`), then submission is
  blocked with an inline validation message; when I leave it empty,
  it defaults to my own pubkey on submit.

- [ ] **AC-11** — Given I cancel the editor (close the dialog or
  click Cancel) without saving, when nothing has been published,
  then the pin event remains unchanged.

## Concepts touched

- `39998:<TA>:tag-pinning` — the existing Pin concept (no schema
  changes; the curation-method values are already named in its
  schema's `curationMethod` property). **No firmware reinstall**.
- `39998:<TA>:tag` — the tag being pinned (read-only in this story).
- `39998:<TA>:web-of-trust` — the WoT-rank scores read when
  `includeScoreInTL=true`.

## Out of scope

- **Methods other than `nip85:rank`.** UI shows them disabled; the
  generator branches for `follows` / `trust-everyone` / `trusted-list`
  remain Story-stubs (each will get its own story when promoted).
- **Per-pin schedule** (custom refresh interval) — global schedule
  from Story 11 still applies.
- **Backfilling existing TLs** when the user edits a pin —
  Story-11's refresh-on-pin pattern is reused for AC-5; no separate
  retroactive sweep.
- **A trusted-list reference picker** (the `trustedList` field of
  the curation-method) — only relevant once `method=trusted-list`
  is supported, which is a different story.
- **Multi-pin bulk edit** — one pin at a time in v1.
- **Audit log of curation-method changes** — kind-39999 replaceable
  events leave history on the relay; no app-level audit surface in
  v1.
- **Curation-method preset library** ("standard", "loose",
  "strict") — useful follow-up but not in v1.
- **Curation-method validation on the read side** — the existing
  pins-reader still trusts whatever's in the event; the form's
  client-side validation is the entire validation surface in v1.

## Open questions

These belong to the Architect to resolve in Phase 2:

- **Placement of the customizer:** inline expansion below the Pin
  button vs modal dialog vs side panel? Same component reused on
  `/pins` Edit. — Architect.

- **Where exactly on `/pins`** does the Edit affordance live —
  per-row button, click-through on the PinDetail page, or both? —
  Architect.

- **When `includeScoreInTL=true` and POV is unresolvable** (AC-8),
  exact UX wording for the warning and the toggle's behavior (force
  off? leave on but silently degrade?). — Architect.

- **Cutoff upper bound** — sensible UI maximum? `cutoff = 1` plus
  no upper bound is the spec; the form may want a 1–N slider for
  better UX. Architect picks N (or leaves it as a number input). —
  Architect.

- **Observer pubkey input format** — hex only? Accept npub and
  decode? Trim whitespace? — Architect.

- **Whether AC-5's auto-refresh-on-edit fires the
  `refresh-pinned-tag` endpoint** (using the pin event id) or the
  `refresh-pinned-tags-for-viewer` endpoint (scope to viewer). The
  former is per-pin and cheaper; the latter is the existing
  "Refresh all" path. — Architect.

## Linked artifacts

- Epic: `engineering-team/epics/pin-a-tag.md`
- Predecessor stories:
  - `engineering-team/stories/done/10-pin-a-tag.md` (the Pin event +
    curation-method JSON shape)
  - `engineering-team/stories/done/11-tl-publication-from-pins.md`
    (the generator that reads curation-method values per pin;
    `refreshPinnedTags.js`'s `runOnePin` is the call site for AC-7)
- ADR: `engineering-team/decisions/0011-customize-pin-curation.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
