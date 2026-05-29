# Story 21: Collapse pin publication into a single "Export" concept

**Status:** Approved
**Created:** 2026-05-29
**Type:** Feature

## Background

Stories 10–12 (ADR 0010/0011) shipped the Pin → kind-30392 Trusted
List pipeline (TA-signed, auto-refreshed). Story 19 (ADR 0017) added
a parallel, user-signed kind-30000 NIP-51 follow set so a pinned
list opens as a feed in mainstream nostr clients. Story 20 (ADR 0018)
moved the pin detail into the tag's **"Pinned" tab**.

The result is correct but presents the user with **three distinct
publication affordances** on a pinned tag — "Refresh now" (recompute
the kind-30392), "Share" (copy the kind-30392's address), and
"Export for other clients" (sign + publish the kind-30000) — each
with its own timing, signer, and mental model. The distinction
between "Export" and "Refresh," and between the two event kinds, is
overhead the user should not have to carry. For most users, *both*
lists should simply exist and stay current, with the underlying
kind/timing differences abstracted away.

Two facts make a naive "just do both, always" hard, and the design
must respect them:

1. **Only the user can sign the kind-30000.** By NIP-51 convention a
   follow set is signed by the user whose list it is; a TA-signed
   kind-30000 surfaces in other clients as the *TA's* list, defeating
   the purpose. So any (re)publication of the kind-30000 requires a
   user NIP-07 signature — it can never be silent/background. The
   kind-30392 (TA-signed) *can* be recomputed silently.
2. **There are no scheduled tasks for non-customers.** We still want
   their published lists to stay current. The lever we have: a user's
   own Apply/Dispute actions are *already* user-signed events, so we
   can piggyback a kind-30000 re-export onto those moments — keeping
   the published list dynamic without a cron.

This story (a) collapses the three affordances into one **"Export"**
concept, (b) keeps both lists current by re-exporting whenever the
user re-tags or reconfigures a pinned tag, and (c) makes the
in-Brainstorm status messaging honest about sync state — including
when *other people's* taggings drift the live list away from the
user's last export.

## User-facing description

As a Brainstorm user who has pinned a tag, I want a single **Export**
action that publishes both my cross-client follow set and my Trusted
List at once, without me having to understand the difference between
"Export," "Refresh," the two event kinds, or who signs what. I want
both lists to stay current as I tag and dispute people, so that if I
open my list in another nostr client it reflects my latest curation.
On the pin's detail view I want a clear, copyable address for each
published list with a one-line hint about where each is useful, and a
plain-language status that tells me when my export is in sync, when
it's mid-update, and when someone else's activity has drifted the
list out of sync.

## Acceptance criteria

Testable from the outside. Each criterion gets at least one test.

### A. One "Export" concept

- [ ] **AC-1** — Given a viewer who has pinned a tag, when they view
  that tag's "Pinned" tab, then there is exactly **one** publication
  affordance, labeled **"Export"** — the separate "Refresh now",
  "Share", and "Export for other clients" affordances are no longer
  present as distinct controls.

- [ ] **AC-2** — Given the viewer activates **Export**, when the
  action opens, then a single **Export modal** appears that governs
  publication of both list kinds.

### B. Export modal — choose-what-but-default-to-both

- [ ] **AC-3** — Given the Export modal is open, then it offers two
  export targets — a **Follow Set** (kind-30000) and a **Trusted
  List** (kind-30392) — and **both are checked by default**.

- [ ] **AC-4** — Given the Export modal is open, then the two target
  checkboxes are **hidden behind a collapsed "What will be exported?"
  disclosure**; with the disclosure left collapsed, the user can
  still confirm the Export and both targets are published (the common
  path requires no expansion).

- [ ] **AC-5** — Given the Export modal, when the user unchecks
  **both** targets, then the confirm ("Export") control is
  **disabled**; re-checking at least one target re-enables it.

- [ ] **AC-6** — Given both targets are checked, when the user
  confirms Export, then **both** a kind-30392 (recomputed,
  TA-signed) and a kind-30000 (user-signed via NIP-07) are published
  for that pin. (The kind-30000 step prompts the user to sign; the
  kind-30392 step does not.)

- [ ] **AC-7** — Given exactly one target is checked, when the user
  confirms Export, then only that kind is published and the unchecked
  kind's existing event (if any) is left unchanged.

### C. Detail-view addresses + hints (post-export)

- [ ] **AC-8** — Given a viewer has an exported kind-30392 for a pin,
  when they view the Pinned tab detail, then a row shows that list's
  **shareable address with a copy control**, and a help line below it
  reads to the effect of *"The Trusted List includes ranks; useful in
  curation pipelines."*

- [ ] **AC-9** — Given a viewer has an exported kind-30000 for a pin,
  when they view the Pinned tab detail, then a row shows that list's
  **shareable address with a copy control**, and a help line below it
  reads to the effect of *"Look for this list in your favorite client
  that supports Lists and Follow Sets."*

- [ ] **AC-10** — Given a kind has not been exported for the pin,
  then its address row does not appear (the address rows are a
  post-export artifact).

- [ ] **AC-11** — Given either address row, the copied value is an
  **`naddr`** (an addressable identifier that resolves the latest
  replaceable event in other clients), **not** a raw event id.

### D. Keep both lists dynamic via re-export on tagging / reconfig

- [ ] **AC-12** — Given the viewer has a tag **pinned** and has
  **previously exported** it, when the viewer **applies** that tag to
  a profile, then the system recomputes the pin's kind-30392 and
  initiates a re-export of whichever kinds are part of the pin's
  **existing export footprint** (e.g. re-publishes a fresh kind-30000
  if one exists), exactly as if the user had run Export manually.

- [ ] **AC-13** — Same as AC-12 for a **dispute** action, and for a
  change to the pin's **curation configuration** (e.g. cutoff /
  min-rank): each triggers the same recompute + re-export of the
  existing footprint.

- [ ] **AC-14** — Given an auto-re-export requires a kind-30000 user
  signature, when the viewer **declines/cancels** that signature,
  then the kind-30392 recompute still stands and the pin is shown as
  **out of sync** (the published kind-30000 is now stale). The user
  is not blocked from completing their original tagging action.

- [ ] **AC-15** — Given the viewer has a tag pinned but has **never
  exported** it, when they apply/dispute that tag, then **no export
  prompt occurs** (there is no footprint to re-export).

- [ ] **AC-16** — Given the viewer applies/disputes a tag they have
  **not** pinned, then **no** re-export occurs.

### E. Honest sync status messaging

- [ ] **AC-17** — Given the viewer has at least one export (a
  kind-30000 or a kind-30392) for a pin, then the detail surface
  shows a **"last exported …"** timestamp message.

- [ ] **AC-18** — Given the published export(s) match the pin's
  current computed membership, then a status line below the
  timestamp reads to the effect of **"last export is in sync with
  current Pin."**

- [ ] **AC-19** — Given the status is visible and the viewer performs
  a tagging or changes the pin's curation config, then — because that
  action triggers an auto-re-export (AC-12/13) — the status line
  transitions to **"Pinned list changed, last export out of sync"**
  and the timestamp message transitions to **"exporting…"** while the
  recompute/publish is in flight; on success both revert to **"last
  exported …"** + in-sync. (This is a transient state in the happy
  path.)

- [ ] **AC-20** — Given **other pubkeys'** taggings cause the pin's
  current computed membership to **diverge** from the viewer's last
  export (with no action by the viewer), then the status reflects the
  divergence (out of sync) and includes a caveat to the effect of
  **"(background list refresh coming soon!)"**.

### F. Default curation cutoff is 1

- [ ] **AC-21** — Given a newly pinned tag for which the user did not
  explicitly choose a cutoff, then the curation cutoff used to compute
  its kind-30392 membership is **1**.

- [ ] **AC-22** — Given any user-facing surface that states the
  default cutoff, then it states **1** (no surface still says "2").

- [ ] **AC-23** — Given the user **explicitly chooses** a cutoff
  greater than 1, then that chosen value is honored end-to-end (the
  normalization to 1 applies only to the unset/default case).

### G. No regression / POV invariants

- [ ] **AC-24** — Given the existing Brainstorm-internal pin surfaces
  (Pinned-tab membership list, Search "Pinned tag" filter), they
  continue to read the kind-30392 and do not regress.

- [ ] **AC-25** — POV-first: two distinct viewers who both pin the
  same tag produce **distinct** exports computed under their own POV;
  one viewer's auto-re-export never alters another viewer's exports.

- [ ] **AC-26** — Decentralized-first: the kind-30000 remains
  **user-signed** (the TA never signs it) and the kind-30392 remains
  **TA-signed**; no write-time gating is added by this story.

## Concepts touched

- `39998:<TA>:tag-pinning` — pin events drive membership and d-tag /
  z-tag composition; both export kinds correlate to a pin via the
  shared d-tag. (central)
- `39998:<TA>:nostr-user-tag` — Apply / Dispute assertions; in this
  story they become the **trigger** for keeping a pinned list's
  exports current. (trigger)
- `39998:<TA>:web-of-trust` — per-POV scoring that determines which
  pubkeys qualify for a pin's list. (read, unchanged)
- `39998:<TA>:tag` — parent concept. (context)
- kind-30392 (Trusted List) and kind-30000 (NIP-51 follow set) are
  protocol event kinds, **not** firmware concepts — **no new firmware
  concept, no reinstall** expected.

The Architect should resolve the literal `<TA>` suffix at runtime per
CLAUDE.md, and confirm the z-tag legacy-pubkey rule (ADR 0015)
carries over unchanged.

## Out of scope

- **Background / scheduled refresh of the kind-30000** for
  non-customers. v1 keeps it current only via manual Export and the
  on-tagging / on-reconfig re-export above; the divergence caused by
  *other* people's activity (AC-20) is surfaced, not auto-fixed —
  hence the "background list refresh coming soon!" caveat.
- **Encrypted (NIP-44) members** on either list.
- **Scores on kind-30000 `p`-tags** (kept membership-only per Story
  19; scores stay on the kind-30392).
- **Retraction of the kind-30000 on unpin** beyond Story 19's
  existing minimal handling.
- Re-parenting the legacy z-tag concepts off the literal pubkey
  (separate epic; see ADR 0015).

## Open questions

1. **Re-export debounce.** If the viewer applies/disputes several
   profiles in quick succession, should each one prompt a separate
   kind-30000 re-sign, or should rapid actions be debounced/coalesced
   into a single re-sign prompt at the end? PO lean: **coalesce** to
   reduce NIP-07 prompt fatigue, provided the final export reflects
   all the actions. (Architect's call on mechanism.)
2. **Address rows: kind-30392 audience.** The kind-30392 isn't
   broadly renderable in other clients today. Do we still show its
   `naddr` row to all users, or only when a "what will be exported"
   power-user path is in play? PO lean: **always show both** once
   exported (matches the "for those doing some hunting" framing) — but
   confirm the help copy keeps expectations honest.
3. **Exact in-sync detection signal.** AC-18/-20 depend on comparing
   "current computed membership" vs "last exported membership." Story
   19 already derives a staleness count; Architect to confirm whether
   that signal is sufficient for the four message states or needs
   extending (especially distinguishing *self-caused, transient*
   drift from *other-caused* drift for AC-19 vs AC-20).

## Linked artifacts

- ADR: `engineering-team/decisions/0019-collapse-into-export-concept.md`
- Test plan: `engineering-team/stories/21-collapse-into-export-concept.test-plan.md`
- Review: `engineering-team/reviews/21-collapse-into-export-concept.md` (PASS)
