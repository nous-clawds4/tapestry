# The /dictionary browser test D6 is flaky: it reads the recorded request before the page has sent it

**Id:** 2026-09-30-dictionary-d6-reads-before-request
**Type:** bug
**Opened:** 2026-09-30 (my-assistants #1, Implementation)
**Status:** DONE
**Done:** 2026-10-02 — every `asked.at(-1)` check in the spec (D1–D6 among them) now waits with `expect.poll` (the Dictionary concept-edit PR to `staging`). D6 had failed once in a full WebKit run that day.

`tests/brainstorm/dictionary-concepts.spec.js` D6 ("a signed-in customer sees their own dictionary as
“Your Dictionary.”") waits for the h1 and then asserts `asked.at(-1)`, the `authors` the page sent to
`GET /api/dictionaries/concepts`. The h1 can read "Your Dictionary." before that request has left, so
`asked` is still empty and the assertion gets `undefined`:

    Expected: "3333…,4444…"
    Received: undefined

The flake is in the test, not in any recent change. Measured 2026-09-30 with `--repeat-each=10 -g D6`, chromium:

- a build of `staging` at `58abd891`, without my-assistants: **7 of 10 failed**;
- the my-assistants #1 build: 3 of 10 failed.

A single run passes often enough to look green: my-assistants' Test Design proof ran the whole spec
once on each build, and got 9/9 both times. D5 has the same shape (`asked.at(-1)` right after the h1).
It passed in these runs, but it can race the same way.

**Fix shape (test only):** wait for the request before reading it. For example,
`await expect.poll(() => asked.at(-1)).toBe(…)`, or `page.waitForRequest('**/api/dictionaries/concepts**')`
before the assertion. Do the same in D5.

**Pointer:** `tests/brainstorm/dictionary-concepts.spec.js` D5, D6; found while running the
my-assistants #1 suites (`engineering-team/stories/done/my-assistants/1-the-my-assistants-page.md` § Deviations).
