# `docs/SMOKE_TEST.md` Tier 3 has no recipe for a change whose observable is the *absence* of an action

**Id:** 2026-09-20-smoke-tier3-cannot-verify-a-negative
**Type:** meta
**Opened:** 2026-09-20 (nip05-ssrf-guard book close, retro §7)
**Status:** OPEN
**Done:** —

Tier 3 ("PR-specific") assumes every change shows up *in a response*: new endpoint → hit it and
check the shape; behaviour changed → check the new field or threshold; UI → grep the bundle. That
covers changes that add something observable.

It does not cover the opposite shape: a change whose entire effect is that the server **stops doing
something**. The NIP-05 address guard is exactly that — a refused lookup and a failed lookup return
the identical `{"verified":false}`. Nothing in the response distinguishes guarded from unguarded.

**The trap, walked into during this book's smoke test.** The obvious move is to reach for timing —
a guarded refusal should be fast. It is (75–112 ms), but that proves nothing on its own: a *public*
control, `example.com`, answered in 108 ms, inside the same band, because it 404s quickly. The
timing contrast was reported as evidence and then withdrawn.

**What actually worked:** a control whose time differs *by construction*, not by luck — TEST-NET-1
`192.0.2.1`, a documentation-range address guaranteed to blackhole, so an unguarded fetch **must**
hang to its abort. Measured against the unpromoted production instance as the unguarded reference:

| | |
|---|---|
| staging (guarded) | 0.078 s / 0.090 s |
| production (unguarded, promotion pending) | 5.35 s / 5.13 s |

~60×, and unambiguous. Note the second ingredient: a *live instance still running the old code* —
which exists only in the window between a staging merge and its promotion, and is gone afterwards.

**Fix shape:** a short Tier 3 subsection — "verifying a negative" — saying that when the change's
observable is an action not taken, (a) a raw timing comparison is not evidence unless the control's
time differs by construction, (b) pick a target that must be slow when unguarded (a blackholed
documentation range, not merely an unrelated public host), and (c) the pre-promotion window gives a
free unguarded reference instance; use it while it exists. Worth a line about what a negative looks
like in Tier 5 too.

`docs/SMOKE_TEST.md` is not in `scripts/harness-def-paths.txt`, so amending it needs no CHANGELOG
row — but it does need operator ratification, which is why this is a row rather than a commit.

**Pointer:** `docs/SMOKE_TEST.md` § Tier 3; `engineering-team/audits/nip05-ssrf-guard/audit.md` §5
(the measurements) and §7.
