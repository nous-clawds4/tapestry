# Two Tester source assertions pinned spelling rather than behaviour, and Phase 4 reshaped correct code to satisfy them

**Id:** 2026-09-20-source-assertions-pin-spelling
**Type:** meta
**Opened:** 2026-09-20 (book close `shared-concepts-row-detail`, retro finding 3)
**Status:** OPEN
**Done:** —

The Tester role says not to *"write tests against implementation details that the spec doesn't pin
down — those are brittle and constrain the Implementer unnecessarily."* This book's suite did it
twice, in a way worth recording because both tests were otherwise good and the failure mode is easy
to repeat.

`test/shared-concepts-row-detail.test.js`:

- **S4** asserts `/key=\{\s*rowKey\(/` — that the React key is *textually* `rowKey(...)` at the use
  site. The first implementation bound the result to a local (`const key = rowKey(row, i)`) and used
  `key={key}`, which satisfies the stated invariant — one derivation feeding both the key and the
  panel state — but not the regex.
- **S14** matches `/(^|\})\s*\.text-muted\s*\{/` — the rule must directly follow a `}` or the start of
  the file. An explanatory CSS comment between the preceding rule and this one is legal, idiomatic and
  breaks the match.

Both were resolved the right way: the Implementer moved the *code*, never the test, because loosening
a judge mid-implementation is what the standing rule forbids (`templates/adr.md` § Implementation
notes). The Phase-4 `test/` diff stayed empty. But the cost was real — `rowKey()` is now re-derived at
three sites instead of one, and the CSS comment sits below its rule instead of above it — and both
files are now slightly harder to edit than they need to be.

**Why it is worth a row rather than a shrug:** the repo's UI suites are largely source assertions,
because `.jsx` cannot be imported without a transform. That makes this the *default* shape of a UI
test here, so the failure mode is structural, not a one-off lapse. The distinction that matters is
whether an assertion pins **an invariant that would break behaviour if violated** or **a spelling that
merely differs**.

**Fix shape:** a short note in `engineering-team/roles/tester.md` — when writing a source assertion,
state the invariant in the failure message and match the loosest pattern that still catches a real
violation; prefer matching *both* use sites of a shared derivation over matching one literal call
form, and never anchor a CSS or JS declaration to its immediate predecessor, since comments are legal
between them. Optionally re-aim S4 and S14 in this suite as the worked example.

**Pointer:** `test/shared-concepts-row-detail.test.js` S4, S14; `engineering-team/roles/tester.md`
§ "What you do NOT do"; audit `engineering-team/audits/shared-concepts-row-detail/audit.md` §7.
