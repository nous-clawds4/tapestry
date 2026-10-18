# Review: docs lane — Event Index pre-NIP and its cross-doc batch

**Reviewer:** Claude, a separate agent acting as Reviewer (read-only)
**Date:** 2026-10-15
**Diff:** this branch against `staging` at `4b6326d1`.
**Lane:** doc lane (0-intake § 3: Implementer + Reviewer), Protocol-Spec workflow docs-mode. There is no story; this is the non-numbered review form.
**Inputs checked against:** the design decisions recorded in `docs/EVENT_INDEX_DESIGN_HANDOFF.md`; NIP-52 and NIP-22 at `nostr-protocol/nips` `a79e21d`, and NIP-09, NIP-05, NIP-65, NIP-49, NIP-31 upstream; Brainstorm-UI issue #213; Keycast's README and `api/src/api/http/{routes,auth}.rs`; Flockstr's and Formstr's `p` role words; PR #819 and PR #583; every remote branch's `protocols/worksheet.md`.

## Quality gates

- [x] **`npm test`** (read per engineering-team/README.md § Running and reading the test gate): run `20261016T005745Z-73873-cb0b`, FAIL, exit 1, 6082 passed, 4 failed, 582 skipped, 312/312 suites. Neither failing suite reads a file this batch changes, and the batch changes no code. `router-stream-limit-on-connect` P1–P3 is BSD `sed -i` on macOS, a known failure on every macOS gate on any branch (ledger row `2026-10-09-router-patch-sed-macos`, OPEN). `event-tagging-firmware-seed`'s one LIVE check queried a local Docker stack that had started during the session and serves a different checkout; an earlier run on the same docs with no stack up failed only the `sed` suite (6076 passed, 3 failed, 589 skipped). CI's stack-free run on Linux is the clean check.
- [x] **Doc-pinning suites:** `curated-dlist-update-pointer-switch` (reads `assistant-designation.md`), `b-coverage-audit-and-disposition` (reads the worksheet) and `event-tagging-spec` (reads `protocols/README.md`) pass.
- [x] **`bash scripts/harness-lint.sh`:** clean, including L13 (both ADRs carry `## Consequences`) and L14.
- [x] **Links and anchors:** every relative link and anchor in the touched files resolves.
- [x] **Worksheet numbers:** W30–W34 collide with nothing on any remote branch or open PR. W27 is PR #819's; W28–W29 are kept for `feat/tags`' two `field-type` entries, which #819's ledger row renumbers; PR #583's stale W17 must take W35 or later, as the worksheet note says.

## Findings, all applied

A first pass found 5 errors, 10 inconsistencies and 8 nits; a second pass found every one fixed, plus two small problems the fixes introduced (A, B), which were then fixed and confirmed.

| # | Finding | Fix |
|---|---|---|
| 1 | W33 misread Brainstorm-UI #213 | Restated: 48 creators in the first 100 results under the house lens, 62 without |
| 2 | "A deletion loses the reason": NIP-09 allows a reason in `content` | The reason given is that a deleted entry vanishes instead of reading as removed, and some relays honor deletion by `e` only |
| 3 | The widened `q` rule named NIP-52 events as originals, but the carry rule would copy their `p`/`t` as items and drop `start` | Example removed; ADR 0001 records the carry-rule gap as Debt |
| 4 | A native calendar's entry would get a key, and its events would be re-signed | Keys only for feed-backed calendar entries |
| 5 | No rule for an end not after the start | No `end` tag then (NIP-52 requires `start` < `end`) |
| 6 | `["client", "eventindex"]` hard-coded a deployment value | `<index client name>` placeholder |
| 7 | 31924 `d` = `calendar` vs NIP-52's "unique identifier" | The address is unique per key; said so |
| 8 | `nostr:` `d` prefix read as a NIP-21 URI | Stated to be a prefix, not a URI |
| 9 | Claiming with the organizer's own key left old projections without a directory `p` | Old key kept as a second `p`, and followed, until its last projection passes |
| 10 | Removal vs § 4.6's cancel-with-RSVPs rule | "Deleted, even one that has RSVPs" |
| 11 | README row mislabeled W33/W34 | "Its open conventions" |
| 12 | Index key's own kind 0/10002/3 missing from Terms, § 5.5, § 10 | Added |
| 13 | W31 said PR #819 lists `date`; only its design doc does | Pointed at that doc's § 4.1 |
| 14 | ADR 0001 Option C title contradicted itself | Renamed "No list: events by kind only" |
| 15 | Keycast route path and wording | `/api/user/export-key`; "the only `format` value" |
| A | Two unmarked `p` tags during a claim | The first `p` is always the current key; the second is dropped once the last projection passes |
| B | An address change went through § 4.6's cancel path | The old address is deleted, never marked cancelled |
| Nits | NIP-31 `unrecommended` and the `alt` date format; `start_tzid` 31923-only; one `r` not two; entry `name` fallback; W27 pointer; editor SHOULD NOT aimed at the index; reference-value order | Applied |
| Nit kept | `decentralized-lists-compat.md` (🧪 publish-ready) now links a local pre-NIP | Publication rewrites the draft's relative links anyway; whoever publishes should point it at Event Index's published home |

**Correctness against upstream:** NIP-22 comment shape (including the parent `e` on a top-level comment), NIP-52 RSVP tags, NIP-65 unmarked relay, NIP-09 deletion shapes and NIP-05 characters check out; the example's `D` value and geohashes match its time and place.

**After the review (2026-10-15):** the draft was matched to the live *Event Calendars* header (a maintainer's key signs the headers; the index key signs only directory entries; `optional` declarations; `index-name`, `luma-id` and `meetup-group` fields; links from three URL templates; a list image and license tags), and the *Events* header is described as proposed. Links, anchors and lint were checked again; the protocol rules this review audited didn't change.

## Verdict

**PASS**

---

## Second review: the event-items rewrite (2026-10-16)

**Diff:** the rewrite on this branch after `90bc8295`: no custodial calendar keys; feed events as kind-`39999` items signed by the index key; native NIP-52 events read by kind; a new general section, event-index § 6, "Lists pulled by kind"; ADR 0001 superseded by ADRs 0003 and 0004, ADR 0002 amended; W32 restated, W33 re-scoped, W34 graduated.
**Inputs checked against:** the decisions in `docs/EVENT_INDEX_DESIGN_HANDOFF.md`; DList Cross-NIP Compatibility's `item-kind` rules and the DList NIP; NIP-52, NIP-22, NIP-09, NIP-40, NIP-46 and NIP-73 upstream; the index's public event id rule (its `spec/`), against which the example item's `d`, public id and `expiration` were recomputed.

**Gates:** harness lint clean; every relative link and anchor resolves; the doc-pinning suites pass; no person's names or private references in the added text.

**Findings, all applied** (a first pass found 5 errors, 4 gaps in § 6 and 7 inconsistencies; a second pass found two section references the renumbering broke; a third pass confirmed):

| Finding | Fix |
|---|---|
| The subject rule was misapplied: the header `required`s none of `p`, `e`, `a`, `i` | `p`, `i`, `t` and `calendar` are stated as plain fields; grouping by `i` is the draft's own rule |
| Items carry `expiration`, but NIP-40 says not to send expiring events to relays that don't support it | Items go only to relays that list NIP-40 or whose operators confirm it |
| A NIP-46 signer is limited by kind only, so "publish for me" could delete or overwrite any of the organizer's events | A MUST: the index signs kind `5` only for events it published, and `31924` only with the entry's `d`; the claim page says so |
| The upstream proposal cited old section numbers | Re-pointed |
| A directory filter is only as good as its author's vetting, and native publishers are filed automatically | Said so in § 6.3 |
| § 6 gaps: unknown fourth element; relay hints the header can't carry; newest-per-address, deletions and expiry; `optional` in a general extension | An unknown value reads as `z`; header relays dropped; a "keep the newest" bullet; § 6.1 uses the NIP's words, and the proposed headers write `allowed` |
| Smaller: informative deployment values; ADR 0003 lacked the carried-over sub-decisions and the carry-rule debt; the `p` description vs aggregators; the `google:` `d`; `i` normalization; a relay-hint fallback; stale references in W31 and ADR 0002 | Applied |
| The handoff's body was rewritten | Kept as a knowing choice: its decision history is in its § 3 |

## Verdict (second review)

**PASS**

**After the second review (2026-10-18):** the team's review of the *Events* header changed three things, folded in here: `source` names where a calendar lives (a platform, or the feed's host name), never `ics`; an item's `d` is the public event id alone, with no source prefix; and the child lists are named by platform (*Luma*, *Meetup*, *Other platforms*, *Nostr*). The proposed *Events* header and the item fields now follow the team's draft: `when`, `luma-slug`, `meetup-group`, `meetup-event`, `index-id` and `url`, links from URL templates, and no `r`. Links, anchors, lint and the example's JSON were checked again.
