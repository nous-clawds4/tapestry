# ADR 0001: one lib per scanner concern, and a written marker grammar

**Status:** Proposed
**Date:** 2026-09-20
**Story:** `engineering-team/stories/rollup-scanner-fidelity/1-scanners-report-what-is-there.md`

## Context

Two programs read the repo's tracking surfaces: `scripts/whats-open.sh` (the `/whats-open`
roll-up) and `scripts/lib/collect-meta.sh` (sourced by the roll-up *and* by
`scripts/session-start.sh`, so it runs at every session start). Six defects in them are recorded
in the story, each measured on `origin/staging` `a55b9631`.

Two structural facts shape the decision:

- **Three of the six defects are the same defect twice.** `collect-meta.sh` and `whats-open.sh`
  each carry their own copy of a 150-byte trim and their own copy of an intake-marker regex.
  One copy of the marker regex was fixed on 2026-09-13 and the other was not; the two now
  disagree about 6 of `_intake.md`'s 33 open entries. Row 19 fixed GNU-only `date -d` in
  `collect-meta.sh` on 2026-07-06 and left the copy in `whats-open.sh` alive, where it still
  suppresses every open-book age. Duplication is the mechanism.
- **The marker vocabulary was never written down.** `_intake.md` has grown eight marker spellings
  (`**PICKED UP**`, `**PICKED UP** <date>`, `**PICKED UP <date>**`, `**RESOLVED**`,
  `**RESOLVED** <date>`, `**DONE** <date>`, `**REASSIGNED (<date>)**`, `**NOT PICKED UP**`) plus
  five qualified pick-ups. The readers know two of them.

Constraints: bash 3.2 (macOS) and bash 5.1 (the `tapestry` container); BSD and GNU userland;
agent and hook shells run with `LANG` and `LC_ALL` unset; the digest runs `collect_meta` at every
session start, so its cost is on the critical path; `scripts/lib` is a harness-definition path, so
anything added here owes a CHANGELOG row.

## Options considered

### Option A — patch each defect where it sits

Six small edits, in place. Pros: smallest diff; no new files. Cons: it re-creates the exact
condition that produced three of the six defects — two copies of the same rule, one of them
fixed. The next session to fix a marker bug will again fix one of two.

### Option B — one shared lib per concern; the scripts become consumers

Three concerns, three homes:

- `scripts/lib/utf8-trim.sh` — `utf8_trim <max-bytes> <string>`, the one trim.
- `scripts/lib/date-epoch.sh` — already exists and already carries the portable converter; the
  roll-up starts calling it instead of `date -d`.
- `scripts/lib/collect-intake.sh` — `intake_entries()`, the one reader of `_intake.md`, which
  classifies each entry and hands both scripts the same answer.

Pros: each of the three duplicated rules has exactly one home, so the class cannot recur; the
marker grammar becomes a documented artifact rather than a regex folklore; the `###` warning has
an obvious place to live. Cons: two new files in a harness-definition path; one more `source` in
each consumer; the intake lib is a new interface that has to be right.

### Option C — rewrite both scanners as one program

Pros: no duplication anywhere. Cons: enormously out of proportion; `collect-meta.sh` is on the
session-start critical path and has its own consumers and its own ADRs (harness-self-improvement
0004/0006); a rewrite would put every one of those contracts back in play.

## Decision

We chose **Option B**. Three of the six defects exist because a rule lives in two files, and only
a shared home removes that. It is also the smallest option that lets the marker grammar be
*written down* — the thing whose absence let `_intake.md` grow eight spellings that the readers
know two of.

### The trim

`utf8_trim` slices under `LC_ALL=C`, then walks back off an incomplete trailing sequence:

```
local LC_ALL=C LANG=C                    # byte semantics everywhere, BSD and GNU alike
[ ${#s} -le $max ] && return s whole
t=${s:0:$max}
if the byte at ${s:$max:1} is a continuation byte (0x80-0xBF):   # we cut mid-character
  drop trailing continuation bytes, then the lead byte
```

Pure bash parameter expansion — no subprocess, bash-3.2-safe. Setting a UTF-8 locale instead was
rejected on the evidence in row 290 refinement (a): GNU `cut -c` counts bytes under every locale,
so a locale fix cures macOS and changes nothing in the container or on CI. An `awk`/`perl` trim
was rejected because `awk`'s `substr` is byte- or character-based depending on which `awk` and
which locale — the same divergence, relocated.

The limit stays a **byte** budget (150), which is what the current code already delivers on GNU
and what a terminal column count approximates. The fix is that the budget can no longer land
inside a character.

### The marker grammar

Written in the header of `collect-intake.sh`, and this is the whole of it:

| Line, at line start | Meaning |
|---|---|
| `**PICKED UP…`, `**RESOLVED…`, `**DONE…`, `**REASSIGNED…` | retires the entry |
| any of those, **with a qualifier parenthetical** in the first 60 characters — `(partial)`, `(in progress)`, `(Part A)`, `(Tier 1–2)` | **partly** picked up: still listed |
| `**NOT PICKED UP…` | never a marker (it does not start `**PICKED`) |
| no such line | open |

The qualifier vocabulary is closed — `partial`, `in progress`, `Part <A-Z>`, `Tier` — and the
window is 60 characters, so a `(partial…)` appearing in prose further along the line does not
qualify it. Checked against all 80 entries in the real `_intake.md`: exactly the five entries
whose markers are genuinely partial match, and `_intake.md:1847`, which says "partially
delivered" in prose at character 150, does not.

### The `###` warning

`intake_entries()` reports the `###` sub-headings inside each entry. The roll-up prints a warning
block naming any **retired** entry that still carries some. One entry qualifies today.

### The carry-forward section

**A measurement changed the shape here, and the operator should see it.** The disposition agreed
at the intake gate was a recency window. Measured afterwards: of the 55 closed books with
unticked §6 items, a 90-day window suppresses **8 books and 46 items**, leaving 47 books and 313
items — because the repo's whole book history is about three and a half months old. The window is
the right durable mechanism and it does nearly nothing today.

So the section gets a window **and** a book budget: the `N` most recently closed books within the
window, per-book cap unchanged at 10 items, and one summary line stating the true totals and what
each suppressor removed. Defaults `WHATS_OPEN_CARRY_DAYS=90` and `WHATS_OPEN_CARRY_BOOKS=8`, both
overridable by environment so a session that wants the whole register can have it. A book whose
close date cannot be parsed is listed, never suppressed — the section must not hide something it
failed to date. (All 55 can be dated today once `**Status:** Closed (<date>)` is read as a
fallback for a `**Closed:** —` line; four books carry the date only there.)

The cure is still the tick rule in `6-book-close.md`; the budget only keeps the section readable
until the register is worked down.

## Consequences

- One home each for the trim, the date conversion and the intake grammar. The "fixed in one copy
  of two" class — three of this story's six defects — cannot recur for these three rules.
- `_intake.md` gains a *written* contract. A session can now look up what a marker means instead
  of inferring it, and `0-intake.md` gains the one line that says a qualified marker keeps the
  entry alive.
- The roll-up gets longer by one warning block and shorter by most of the carry-forward section.
- Two new sourced libs on the session-start path. `utf8_trim` forks nothing; `intake_entries()`
  is one `awk` over one file, replacing an `awk` over the same file in each consumer — the digest
  should not measurably slow. The Implementer records the before/after timing.
- New follow-up: the five partly-picked-up entries and whatever the `###` warning names become
  visible backlog. Surfacing them is this story; triaging them is not (story § Out of scope).
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

- **New** `scripts/lib/utf8-trim.sh` — `utf8_trim <max-bytes> <string>`, prints the trimmed
  string. Header documents the byte budget and the `LC_ALL=C` contract.
- **New** `scripts/lib/collect-intake.sh` — `intake_entries [<path>]`, defaulting to
  `engineering-team/stories/_intake.md`. Prints one TAB-separated line per `## 20YY-…` entry:
  `state <TAB> line <TAB> heading <TAB> nested`, where `state` is `open` | `partial` | `retired`
  and `nested` is a `; `-joined list of the entry's `### ` headings (empty when there are none).
  No file: prints nothing, returns 0 — the same silence `collect-ledger.sh` keeps.
- `scripts/lib/collect-meta.sh` — source the two libs; replace `cut -c1-150` with `utf8_trim 150`;
  replace the inline intake `awk` with `intake_entries`, keeping only the `— Meta:` filter and
  counting `open` **and** `partial` entries.
- `scripts/whats-open.sh` — replace `cut -c1-150` with `utf8_trim 150`; replace `date -d` with
  `date_to_epoch` in the open-books loop; replace the intake `awk` with `intake_entries`, printing
  `open` entries as today, `partial` entries under their own sub-heading, and a warning block for
  retired entries carrying `###`; rework the carry-forward section per the decision above.
- `engineering-team/workflows/6-book-close.md` — the tick rule, with the reason.
- `engineering-team/workflows/0-intake.md` — one line on qualified markers.
- `engineering-team/CHANGELOG.md` — one row (`scripts/lib`, `scripts/whats-open.sh` and the two
  workflow files are all harness-definition paths).

## Out of scope

- The ledger-section reader gap and the CRLF row-file gap, both already filed as `ledger/` rows.
- Any change to `scripts/harness-lint.sh`, including a lint that would enforce the marker grammar.
  The grammar is written down first; enforcing it is a later decision.
- Normalising the eight existing marker spellings in `_intake.md`. The reader accepts them all.
