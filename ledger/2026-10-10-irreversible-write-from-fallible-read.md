# Architecture and Test Design never ask what a failed or stale read does to an irreversible write built from it

**Id:** 2026-10-10-irreversible-write-from-fallible-read
**Type:** meta
**Opened:** 2026-10-10 (book `assistant-profile-checklist` close, audit §7)
**Status:** OPEN
**Done:** —

The checklist's one-click fixes read the Assistant's published profile, change one field, and publish the result: a
read-modify-write whose write is signed, replaces the kind 0 here, and goes out to every outside relay. It cannot be
undone. ADR `assistant-profile-checklist/0002` sub-decision 5 made the default profile the base when the press-time read
said "no profile", and the test plan pinned that (P9). Neither asked what that read returns when it fails or is stale:
- **Round 1 (story 2 B1):** the read's local scan is not strict, so a failed `strfry scan` reads as "no profile", and a
  fix would have published the default name, About and picture over the real profile.
- **Round 2 (R2-1):** after round 1's guard, a failed local scan fell back to the outside relays, which can hold an
  older copy, and a fix would have republished it over the newer one.

Each cost a full review round, an ADR amendment, a failing pin and a fix. ADR 0001 had already made the *check's* scan
strict for exactly this reason ("a broken local relay reads as 'no profile'"), but nothing carried the lesson to the
second read on the write path. Sibling: OPEN.md row `2026-10-09-architecture-misses-outbound-connections` (Architecture
did not ask where the server connects).

**Fix shape:** one line each in the Architect's checklist (`engineering-team/roles/architect.md` or the ADR template)
and the Tester's (`engineering-team/workflows/3-test-design.md`): *for a write that cannot be undone and is built from a
read, name the read, what it returns on failure, timeout and fallback, and require the write to stop unless the read
is authoritative; pin each of those returns.* Ports to Direction mode: yes, the same phases. Both files are
harness-definition paths, so the change owes a CHANGELOG row.

**Pointer:** `engineering-team/audits/assistant-profile-checklist/audit.md` § 7; ADR
`assistant-profile-checklist/0002` Amendments 1–2; `engineering-team/reviews/done/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md`.
