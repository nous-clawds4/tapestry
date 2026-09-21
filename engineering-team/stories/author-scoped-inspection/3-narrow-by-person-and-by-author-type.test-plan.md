# Test plan — author-scoped-inspection #3: narrow by person, and by kind of author

**Story:** `engineering-team/stories/author-scoped-inspection/3-narrow-by-person-and-by-author-type.md`
**ADR:** `engineering-team/decisions/author-scoped-inspection/0002-author-scoped-views-on-active-b-tags.md`
**Suites:** `test/author-scoped-inspection-views.test.js` · `tests/brainstorm/author-scoped-inspection.spec.js`

## Levels and why

The narrowing rules are pure and live in one module, so most of this story is **P** — unit tests
over `ui/src/utils/authorScope.js`, loaded by dynamic `import()` (the idiom
`test/add-node-as-element-restore.test.js:48` uses). Everything a rule cannot decide — which
control exists, what it is labelled, what the default resolves to, what the empty state says — is
**E**.

**Signed-in states need no signer.** `AuthContext` reads `/api/auth/status` and
`/api/auth/user-classification` and nothing else (`ui/src/context/AuthContext.jsx:46,51`), so both
signed-in cases are reached by mocking those two routes. No NIP-07 extension, no dev bypass.

## Coverage

| Test | Asserts | AC |
|---|---|---|
| P1 | the four rules are exported | ADR §Implementation |
| P2 | an instance-controlled assistant classifies `assistant` | AC-5 |
| P3 | an account those assistants belong to classifies `person` — **including an admin with no assistant** | AC-5 |
| P4 | anyone else classifies `external`; an empty roster makes everyone external, not everyone a person | AC-5 |
| P5 | a person carries both their account and their assistant | AC-1 |
| P6 | a `null` assistant never becomes a matchable author | AC-3 |
| P7 | the no-op values narrow nothing; Mine+Assistants, Mine+People and Everyone+Everyone-else each select what §Vocabulary says | AC-4, AC-5 |
| P8 | one person + "everyone else" returns `false` for **every** author — never a silent widening | AC-6 |
| E1 | signed out → Owner, and that person's rows only | AC-2 |
| E4 | signed in with an assistant → Mine, both keys | AC-1 |
| E5 | signed in with no assistant → Mine stays selected, a notice appears, no silent fallback | AC-3 |
| E6 · E7 · E8 | each author-type option yields its own set | AC-5 |
| E9 | the empty combination reports itself **and names both selections** | AC-6 |

## Edge cases covered beyond the happy path

- An **admin with no assistant** is still a person (P3) and contributes only one key (P6) — the
  case that would otherwise silently disappear from every view.
- An **empty roster** (P4): the failure mode to avoid is a classifier that defaults to `person`
  and reports the whole relay as local.
- The **guaranteed-empty combination** (P8, E9) — chosen over disabling the control so the two
  axes stay independent.

## Expected before implementation

All **FAIL** — P1–P8 because the module does not exist, E1–E9 because no selector does.

## Prerequisites

None.
