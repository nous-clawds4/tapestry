# A structural suite's comment-stripper reads the Express wildcard route `'/api/settings/*'` as an opening block comment and blanks ~300 lines of `src/api/index.js`

**Id:** 2026-09-20-comment-stripper-eats-wildcard-route
**Type:** meta
**Opened:** 2026-09-20 (author-scoped-inspection #1 implementation)
**Status:** OPEN
**Done:** —

Structural suites in this repo blank comments before asserting on source, so an assertion cannot be
satisfied by prose. The house idiom is a regex pair:

```js
function code(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
```

It cannot tell a comment from a **string** containing the same two characters, and this repo has
exactly one such string: `src/api/index.js:343` registers the Express wildcard route

```js
app.delete('/api/settings/*', requireOwner, handleResetSetting);
```

The regex reads that `/*` as a comment opener, scans to the next real `*/` at `:649`, and replaces
lines **343–649** with a single space — every route registered in that span.

**How it surfaced.** author-scoped-inspection #1 registered `GET /api/assistant/roster` at `:543`.
The route was live and answering — the suite's own live class (H1–H5) passed against it, and
`curl localhost:7778/api/assistant/roster` returned the expected body — while the structural
assertion S1 reported it missing. The failure looked like an implementation defect for as long as it
took to bisect the two `replace` calls.

**Fixed here, latent elsewhere.** This book's two suites now use a string-aware scanner instead
(`test/author-scoped-inspection-roster.test.js` § `code()`, mirrored in `…-views.test.js`). It
tracks the three quote forms and deliberately does **not** track regex literals; that limit is
stated in its docstring, and no file these suites read contains a regex with `/*` or `//` in it.

Five other suites still carry the naive regex:

- `test/curated-dlist-update-publish.test.js`
- `test/curated-dlist-update-pointer-switch.test.js`
- `test/note-tagging-raw-events-inspector-ui.test.js`
- `test/tag-actions-menu-ui.test.js`
- `test/tagging-raw-event-inspector-ui.test.js`

None of them reads `src/api/index.js` (verified 2026-09-20), so none is wrong today. The trap
springs the moment one does — and `src/api/index.js:343` is the only `/*`-inside-a-string in `src/`,
so adding a second wildcard route anywhere would widen the blast radius for free.

**Why it matters more than one red test.** A *positive* assertion over blanked source fails loudly,
which is how this was found. A **negative** one — "this string must NOT appear" — passes vacuously,
reporting a guarantee it never checked. Several suites in this repo assert exactly that shape.

**Fix shape.** Lift the scanner into `test/helpers/` and repoint the five; or leave them and let
each adopt it the first time it reads a file carrying the trap. The first is a harness-definition
change and owes a CHANGELOG row.

**Pointer:** `src/api/index.js:343`; the scanner in `test/author-scoped-inspection-roster.test.js`
§ `code()`. Siblings — all checks that silently search less than they appear to: OPEN.md row 165
(the `grep` shim honors `.gitignore`) and row 342 (a vacuous negative search under zsh).
