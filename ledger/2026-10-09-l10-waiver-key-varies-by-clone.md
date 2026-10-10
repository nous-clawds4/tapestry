# An L10 waiver written in one clone may not match in another: its `commit:<short-sha>` key changes length

**Id:** 2026-10-09-l10-waiver-key-varies-by-clone
**Type:** meta
**Opened:** 2026-10-09 (review of story `harness-gate-integrity` #3, harness friction 1)
**Status:** OPEN
**Done:** —

`harness-lint` L10 names its offender as `commit:<short-sha>`, built from git's `%h`, and an L10 waiver matches that
string as a glob (`scripts/harness-lint-waivers.txt`, shape documented in the script header). `%h` grows with the
repo's object count: the same commit prints as `695fac48` in a full clone of this repo and as `695fac4` in a shallow
cloud-session clone. A waiver keyed `commit:695fac4` written in a cloud session therefore stops matching once the
lint runs in a full clone (CI, a local checkout), and one keyed `commit:695fac48` never matches in a shallow clone.
Either way, the waiver is reported as `STALE-WAIVER` and the violation returns.

No L10 waiver is in use today, so nothing is broken yet.

**Fix shape.** Match waivers on a fixed-length prefix: print `%h` at a set length (`--abbrev=12`, say), or have the
L10 waiver lookup compare the full sha against the waiver's prefix. Document the key in the script header. Keep the
existing `commit:*` glob test passing.

**Pointer:** `scripts/harness-lint.sh` (`check_L10`, `violation()`); the review
`engineering-team/reviews/harness-gate-integrity/3-history-checks-honest-in-a-shallow-clone.md` § "Harness friction".
