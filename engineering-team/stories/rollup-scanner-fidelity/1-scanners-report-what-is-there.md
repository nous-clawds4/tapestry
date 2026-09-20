# Story 1: the roll-up's scanners report what is there

**Status:** Approved
**Created:** 2026-09-20
**Type:** Bug

## Background

`scripts/whats-open.sh` and `scripts/lib/collect-meta.sh` are the two programs that tell a session
what is still open — the first at `/whats-open`, the second at every session start. Six separate
defects make them under-report, each verified on `origin/staging` `a55b9631` on 2026-09-20.

1. **The 150-byte trim can emit invalid UTF-8.** `collect-meta.sh:43` and `whats-open.sh:57` trim
   with `cut -c1-150`. GNU `cut -c` counts bytes under every locale; BSD `cut` counts bytes when no
   UTF-8 locale is set, and agent and hook shells here run with `LANG` and `LC_ALL` unset. Measured:
   of the 115 open meta rows the collector lists today, exactly one — row 193 — is cut inside a
   multi-byte character and comes out as invalid UTF-8. Row 290, refinement (a): setting a UTF-8
   locale cures macOS only, so only a multibyte-aware trim is portable.
2. **Open-book ages never print.** `whats-open.sh:72-73` computes an age with GNU `date -d`. On
   this Mac `date -d 2026-01-01 +%s` answers `date: illegal option -- d`, the guard fails, and the
   age is dropped. All six open books print with no age today. `scripts/lib/date-epoch.sh` is the
   portable helper row 19 added for exactly this, and `whats-open.sh` was missed.
3. **`collect-meta.sh:76` matches its intake markers unanchored.** `/PICKED UP|RESOLVED/` also
   matches `**NOT PICKED UP**` and any prose mention. `whats-open.sh:101` fixed the same bug on
   2026-09-13, where it had hidden 8 entries; the sibling was left. Measured: the unanchored reader
   sees 27 open entries where the anchored one sees 33. None of the 6 is a `— Meta:` entry today, so
   the meta count is unaffected — the defect is latent for meta and live for the class.
4. **A marker that says work remains still retires the entry.** Five entries carry a qualifier in
   the marker's own parenthetical — `(partial)` ×3, `(Part A)`, `(in progress)` — and none is listed
   by either reader. `_intake.md:611` reads `**PICKED UP** (Part A) → … **Part B still OPEN**` and
   has been invisible since its marker was backfilled on 2026-07-02. This is `OPEN.md` row 208's
   defect, in the form the file actually takes.
5. **`**DONE**` and `**REASSIGNED**` are not markers.** Both are used (`_intake.md:1564`, `:2207`)
   and neither reader knows them. Latent today, because a later session backfilled a `**RESOLVED**`
   line above each; a future entry marked only `**DONE**` reads as open forever.
6. **A `###` sub-entry disappears with its parent.** The readers key on `##` headings only, so
   marking a parent resolved erases every `###` block inside it with no warning. It happened in
   September to an untriaged security note filed a day after its parent, and was caught only because
   a reviewer was reading the file by hand.

Separately, the closed-book carry-forward section prints unticked §6 items from **55** audits — 359
items, capped at 10 per book — and nothing ever ticks one when it is resolved elsewhere, so most of
that section is stale and it is skimmed rather than read.

## User-facing description

As a session picking up work in this repo, I want the roll-up and the digest to list every item that
is actually open — and nothing they cannot show me honestly — so that "we checked and there was
nothing there" means what it says.

## Acceptance criteria

Trim (defect 1)

- [ ] **AC-1** Given a line whose 150th byte falls inside a multi-byte character, when either script
      trims it, then the output is valid UTF-8 and ends on a character boundary — under `LC_ALL=C`
      and under a UTF-8 locale alike, on BSD and GNU userland.
- [ ] **AC-2** Given this repo's real `OPEN.md`, when the collector runs, then no line of
      `META_LINES` is invalid UTF-8 (row 193 is the one that fails today).
- [ ] **AC-3** Given a line shorter than the limit, or one that ends exactly on a character
      boundary, when it is trimmed, then it is returned whole — no character is lost to the fix.

Ages (defect 2)

- [ ] **AC-4** Given an open book with an `**Opened:**` date, when `/whats-open` prints the open-books
      section on a machine whose `date` rejects `-d`, then the line carries the opened date and a
      real age in days.
- [ ] **AC-5** Given an open book whose `**Opened:**` line holds no parseable date, then the book is
      still listed, without an age.

Intake markers (defects 3–5)

- [ ] **AC-6** Given an entry marked `**NOT PICKED UP**`, when either reader scans, then the entry is
      listed as open — both readers agree on every entry in the real `_intake.md`.
- [ ] **AC-7** Given an entry whose marker carries a parenthetical qualifier (`(partial)`,
      `(Part A)`, `(Tier 1–2)`, `(in progress)`), then it is listed as partly picked up, not retired.
- [ ] **AC-8** Given an entry whose marker is unqualified, or where the word *partial* appears only
      in prose after the marker's link (`_intake.md:1847`), then it is retired as it is today.
- [ ] **AC-9** Given an entry marked `**DONE**` or `**REASSIGNED**` at line start, then it is retired.

Nesting (defect 6)

- [ ] **AC-10** Given a retired entry that still contains `###` sub-headings, when `/whats-open`
      runs, then it names the entry and those sub-headings under a warning, so the loss is visible.
- [ ] **AC-11** Given a retired entry with no `###` sub-headings, then nothing is printed for it.

Carry-forwards

- [ ] **AC-12** Given audits closed longer ago than the recency window, when `/whats-open` prints the
      carry-forward section, then those books are not listed and the section states how many books
      and items it suppressed, with the window that did it.
- [ ] **AC-13** `engineering-team/workflows/6-book-close.md` instructs a closer to tick a §6 item when
      it is resolved elsewhere, and says why (this section is the register that rots otherwise).

Ledger

- [ ] **AC-14** `OPEN.md` rows 290 and 208 read DONE with this PR in their Done cell; defects 2–6 and
      the carry-forward disposition each have a `ledger/` row, flipped DONE in the same PR.

## Concepts touched

None — this story touches no concept-graph handle. It changes two shell scripts, their tests, one
workflow file, and the ledger.

## Out of scope

- The reader gap at `whats-open.sh`'s ledger section (row
  `2026-09-20-rollup-reader-gap-and-stale-comment`) and the CRLF row-file gap (row
  `2026-09-20-crlf-row-file-invisible-to-readers`). Same scripts, already filed, owned elsewhere.
- Disposing of the entries these fixes make visible. Five partly-picked-up entries and whatever the
  `###` warning names are the next session's triage, not this story's.
- Re-writing existing `_intake.md` markers. The fix reads the file as it is.
- Any change to `scripts/harness-lint.sh`.

## Open questions

Resolved with the operator at the intake gate on 2026-09-20:

- Row 208's fix shape → **the mechanical one** (row 208 shape (b)): a parenthetical qualifier keeps
  the entry visible, plus a line of convention in `0-intake.md`. Chosen over the convention-only
  shape (a) because the convention is what failed for 80 days at `:611`, and over (c) because
  splitting five live entries by hand buys nothing the scanner cannot read.
- `###` sub-entries → **warn in the script**, and recognise `**DONE**`/`**REASSIGNED**` as well.
- Carry-forwards → **scope the section by recency, state the suppressed total, and add the tick rule
  to `6-book-close.md`.** Not retired: it is the only surface for deferred book scope.

## Linked artifacts
- ADR: `engineering-team/decisions/rollup-scanner-fidelity/0001-shared-scanner-libs-and-marker-grammar.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
