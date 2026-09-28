# Test Plan: Story 1 — The tagging edge contract

**Story:** `engineering-team/stories/tagging-edges/1-tagging-edge-contract.md`
**ADR:** `engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md` (including its "Clarifications (Test
Design, 2026-09-27)" section)
**Date:** 2026-09-27

One suite, `test/tagging-edge-contract.test.js` (76 tests), registered last in `test/registry.js`. It is pure: no
stack, no network, no signing. Fixture pubkeys are fake 64-hex. The two stamp pubkeys are parameters of the contract,
so no deployment's real key appears in the suite.

## Coverage map

Test names are abbreviated; the suite's names are full sentences.

| Criterion | Tests (see the test index below for exact names) | Level |
|---|---|---|
| Module surface | exports the four functions, `REFUSAL` and `TAGS_RELATIONSHIP = "TAGS"`; `REFUSAL` is frozen with exactly the ten reason strings | unit |
| AC-1 — every shape converts to a record of the same form | address+id full record (exact object); address-only; id-only resolved from a supplied element; id-only unresolved; never borrows another author's same-slug tag; exactly the contract's keys; stance kept as published (`"1"`, `"-1"`, `"0"`, `"0.5"`, `""`); absent / valueless / non-string stance → `null`; first `polarity` tag is the stance (a non-string first tag gives `null`); identity from the first `d`; target lower-cased; stamp flags (canonical, local, both, canonical + another deployment's, canonical == local); `a` pubkey segment and `e` lower-cased, slug keeps its case; slug is everything after `39999:<pubkey>:`; element must be a kind-39999 tag element with a `:tag` stamp and a non-empty first `d`; element must pass the event check (lowercase id/pubkey); a throwing lookup leaves the record unresolved; an empty stamp pubkey matches nothing; `created_at` 0 accepted | unit |
| AC-1 — owner ruling (`a` is identity) | `a` and `e` naming different tags → `tagAddress` follows `a`, `e` kept as provenance, no refusal | unit |
| AC-2 — refusals, each with its reason, never a throw | `not-an-event` (null, number, string, upper-case id/pubkey, short id, non-integer / negative `created_at`, non-array tags); `wrong-kind`; `no-d` (missing, empty first, valueless or non-string first, over 255 UTF-8 bytes, with 255 bytes accepted); `no-nostr-user-tag-stamp` (no z, a `:tag` z, another deployment's own only, local stamp with no `localPubkey`, no options); `no-target` / `several-targets` / `bad-target` (including a valid `p` beside a malformed one → `several-targets`); same `p` in two cases is one target; `no-tag-reference` (neither, or only a non-hex `e`); `several-tag-references` (two distinct `a`, two distinct `e` with markers ignored); same `a` / `e` in two cases is one reference; a non-string `a` is ignored; `bad-tag-address` (kind 39998, short / non-hex pubkey, empty or missing slug); every refusal after step 1 carries address, event id, `created_at`, author; step-1 refusals carry no address; garbage never throws | unit |
| AC-2 — nothing refused for who wrote it | unknown author, self-tagging, dispute, neutral, absent stance, a tag not on this relay, a test-fixture slug, a `d` without the `profile-tag-` prefix | unit |
| AC-3 — one version stands | newer wins in both orders (`newer` / `older-ignored`, `superseded`, `changed`); equal `created_at` → lower id in both orders; a target move names the dropped target (not for an ignored older version or the same target); same version is no change, and resolution only moves null → value (no downgrade); stamp flags follow the incoming record; `new`, `no-incoming`, `address-mismatch`, and `(null, null)`; a newer non-tagging version retires the edge and drops its target; an older non-tagging version is ignored; a non-tagging version with nothing standing retires nothing; at equal `created_at` a non-tagging version retires only with the lower id; the same event later seen as a non-tagging retires the edge (`changed`, `superseded`, `droppedTarget`) | unit |
| AC-4 — a revoke removes only what it names | the tagger's kind-5 naming the id applies, including one seen before the version; case-insensitive `e`; a superseded or later version's id does not apply; an address revoke applies at `created_at` ≥ the version's and not before; a different address does not apply; the `a` pubkey segment is case-insensitive and the `d` keeps its case; another signer does not apply (by id or address); an `e` match wins over an older address on the same kind-5; several ids, any match applies; not a kind-5, an upper-case deletion pubkey or id, or a bad `created_at` → `not-a-deletion`; garbage deletions and a missing edge never throw; `revokeTargets` lists lower-cased valid ids and addresses, arrays, empty for anything else | unit |
| AC-5 — BIBLE says what a tagging edge is | §6 has `#### Social Graph Relationships (NostrUser → NostrUser)` after `#### Infrastructure`; FOLLOWS / MUTES / REPORTS / TAGS each on a line with source kind and direction, the first three with no properties; TAGS' `nostr-user-tag` stamp; every property; absent = apply and the `coalesce(toFloat(r.polarity), 1.0)` bucketing; the standing rule (NIP-01 or "lower … id"); the revoke rule (kind-5 by the tagger); "no trust" + "read time"; the §30 class (event-projection); pointers to `src/lib/tagging-edges` and `tagging-edges/0001`; "no pipeline writes TAGS yet"; a glossary row separating TAGS from `HAS_TAG` / `NostrEventTag`; the §30 coverage line names TAGS; the Last updated line records the change | doc (reads `BIBLE.md`) |
| Purity (ADR Implementation notes) | `index.js` + `contract.js` exist; sibling-only requires, no ESM, no clock, randomness, network, logging or `process` use (comments are stripped first, so a comment may name what the code avoids) | source contract |
| ADR 0015 | no 64-hex literal anywhere in the module | source contract |

## Test index (exact names, all in `test/tagging-edge-contract.test.js`)

**surface** (2)

- `surface: exports taggingToEdge, standingEdge, revokeApplies, revokeTargets, REFUSAL and TAGS_RELATIONSHIP = "TAGS"`
- `surface: REFUSAL is frozen and holds exactly the ten stable reason strings`

**AC-1** (22)

- `AC-1: a tagging naming its tag by address and id converts to the full record`
- `AC-1: an address-only tagging carries the address and slug, and no tag event id`
- `AC-1: an id-only tagging resolves its address and slug from the supplied tag element`
- `AC-1: an id-only tagging with no element supplied is unresolved — id kept, no address, no slug`
- `AC-1: an id-only tagging never takes the address of a same-slug tag by another author`
- `AC-1: every shape's record carries exactly the contract's properties — no names, counts, ranks or applied flags`
- `AC-1: the stance is kept exactly as published`
- `AC-1: an absent stance is recorded as null, not as "1"`
- `AC-1: the first polarity tag is the stance`
- `AC-1: identity is 39999:<author>:<first d>, with event id and created_at`
- `AC-1: the target is the p pubkey, lower-cased`
- `AC-1: which stamps the event carried — canonical, this deployment's own, both, or canonical plus another deployment's`
- `AC-1: a tag address and a tag event id are lower-cased`
- `AC-1: a supplied element resolves only if it is a kind-39999 tag element (a :tag stamp, a non-empty d)`
- `AC-1: a tag-element lookup that throws leaves the record unresolved rather than refusing it`
- `AC-1 (owner ruling): when a and e name different tags, a is the tag and e is provenance — no refusal`
- `AC-1: a non-string or valueless first polarity tag makes the stance null, even if a later one is a string`
- `AC-1: only the pubkey segment of a is lower-cased — the slug keeps its case`
- `AC-1: the slug is everything after 39999:<pubkey>:, even when it contains a colon`
- `AC-1: a supplied element must itself be a well-formed event — an upper-case pubkey or id, or no usable first d, leaves the record unresolved`
- `AC-1: an empty stamp pubkey matches nothing, for the tagging and for the tag element`
- `AC-1: created_at 0 is a valid non-negative integer`

**AC-2** (18)

- `AC-2: malformed events are refused as not-an-event`
- `AC-2: another kind is refused as wrong-kind`
- `AC-2: a missing, empty, or over-long first d is refused as no-d (255 UTF-8 bytes is the limit)`
- `AC-2: a tagging without a nostr-user-tag stamp this deployment honours is refused`
- `AC-2: zero, several, or malformed p targets are refused`
- `AC-2: the same p repeated (even in another case) is one target, not several`
- `AC-2: no tag named at all is refused as no-tag-reference (a non-hex e does not count)`
- `AC-2: several different tags named — more than one distinct a, or more than one distinct e — are refused`
- `AC-2: an a that is not 39999:<64-hex>:<slug> is refused as bad-tag-address`
- `AC-2: once the event is valid, a refusal also carries its address, event id, created_at and author`
- `AC-2: a refusal before the event is known to be a valid kind-39999 with a d carries no address`
- `AC-2: the conversion never throws on garbage`
- `AC-2: nothing is refused for who wrote it — any author, self-taggings, disputes, neutral, absent stance, unknown tag, fixture slugs, any d`
- `AC-2: a valueless or non-string first d is no-d, even with a later valued d`
- `AC-2: a valid p beside a malformed p is several-targets`
- `AC-2: the same e in two cases, or the same a in two pubkey cases, is one tag reference`
- `AC-2: a non-string a value is not a tag reference`
- `AC-2: every refusal after step 1 carries the address, event id, created_at and author`

**AC-3** (13)

- `AC-3: the newer created_at stands, whichever order the versions arrive in`
- `AC-3: on equal created_at the lower event id stands (NIP-01), in both orders`
- `AC-3: a version that moves the tagging to another target names the target that no longer holds it`
- `AC-3: the same version seen twice is no change, and resolution only moves from unresolved to resolved`
- `AC-3: for the same version, the stamp flags follow the incoming record`
- `AC-3: a first version is new; no incoming version changes nothing; different addresses change nothing`
- `AC-3: a newer non-tagging version at the same address retires the edge and drops its target`
- `AC-3: an older non-tagging version is ignored; a non-tagging version with nothing standing retires nothing`
- `AC-3: the same event later seen as a non-tagging retires the edge`
- `AC-3: a non-tagging version at the same created_at retires the edge only if its id is lower (NIP-01)`
- `AC-3: the same event later seen as a non-tagging supersedes the edge and drops its target`
- `AC-3: for the same version both stamp flags follow the incoming record`
- `AC-3: nothing standing and nothing incoming is no change, and never throws`

**AC-4** (12)

- `AC-4: the tagger's kind-5 naming the version's event id applies — even if seen before the version`
- `AC-4: a kind-5 naming a superseded or a later version does not apply`
- `AC-4: a kind-5 naming the tagging's address applies from the version's created_at on, not before`
- `AC-4: the address match is case-insensitive in the pubkey segment`
- `AC-4: a kind-5 signed by anyone other than the tagger does not apply`
- `AC-4: anything that is not a well-formed kind-5 is not-a-deletion, and garbage never throws`
- `AC-4: revokeTargets lists what a kind-5 names — valid e ids and a addresses, lower-cased — and nothing for anything else`
- `AC-4: an id match applies even when the same kind-5 also names the address with an older created_at`
- `AC-4: a kind-5 naming several ids applies if any of them is the version`
- `AC-4: revoke matching keeps the d's case — only the pubkey segment is lower-cased`
- `AC-4: a deletion with an upper-case id or a bad created_at is not-a-deletion`
- `AC-4: revokeApplies with no edge never throws and does not apply`

**AC-5** (7)

- `AC-5: BIBLE §6 has a Social Graph Relationships subsection after Infrastructure`
- `AC-5: the subsection names FOLLOWS, MUTES, REPORTS and TAGS with direction and source kind — the first three by those only`
- `AC-5: the subsection gives TAGS' identity, every property, the absent-stance rule, the standing and revoke rules, and read-time POV`
- `AC-5: the docs say plainly that no pipeline writes TAGS yet`
- `AC-5: the glossary tells TAGS apart from HAS_TAG and NostrEventTag`
- `AC-5: BIBLE's Last updated line records this change`
- `AC-5: §30's coverage status line lists TAGS among the social edges derivers do not cover`

**purity** (1)

- `purity: the module is pure CommonJS — sibling requires only, no I/O, no time, no randomness, no logging`

**ADR 0015** (1)

- `ADR 0015: the module hard-codes no pubkey — both stamp pubkeys are parameters`

## Edge cases

- [x] Garbage input to every function (no throws).
- [x] Hex case everywhere strfry is case-insensitive (`p`, `e`, `a` pubkey segment), and the lowercase requirement on
      event-level `id` / `pubkey` for taggings, deletions and supplied tag elements.
- [x] strfry's identity rule: the first `d`, 255-byte limit (bytes, not characters).
- [x] Revoke arrival order, and ties between edge and non-tagging versions.
- [x] The census shapes (story Open question 6): address+id, address-only, id-only, dual stamp, neutral, absent,
      self-tagging.
- [ ] Concept Graph API unavailable / handle not found: not applicable. The contract is pure and takes no graph
      input.

## Test infrastructure

- Test framework: the project's gate engine (`node test/test.js` / `npm test`, suite registered in
  `test/registry.js`). Read a run's result with `npm run gate:status`. The suite also runs alone via its `run()`
  export.
- Concept Graph API / stack: not needed. The suite never skips, and it runs in CI's stack-free job.
- Firmware state: none (no concept definitions change).
- Fixtures: built in the suite (`tagging()`, `tagElement()`, `deletion()`), with fake 64-hex pubkeys and ids.

## How to run

```
npm test
```

Only this suite, through the gate engine (writes a run record):

```
node -e "require('./test/helpers/gateRunner').runGate({ suites: [{ file: 'tagging-edge-contract.test.js' }], label: 'tagging-edges-1' })"
npm run gate:status -- --label tagging-edges-1
```

## Validation of the suite itself (2026-09-27)

- **Against a reference implementation:** an implementation written from the ADR alone, blind to the tests, and
  adjusted only for the eight ADR clarifications, plus a `BIBLE.md` mock carrying the ADR-mandated sections, passes
  **76 / 76**. So every test can pass, including the docs tests. That check caught a section-helper bug that would
  have made three docs tests unpassable. After the Gate 3 fixes (per-line direction check, key set for every shape) it
  was re-run: still 76 / 76 on the reference, 0 / 76 on the repo.
- **Mutation testing:** 42 single-point mutants of the reference were run first. 31 were killed by the first draft
  of the suite, and each of the 11 survivors got a test. Seven of those survivors, re-run against the revised suite,
  are all killed: first-string polarity, empty stamp pubkey, `created_at > 0`, distinct `e` counted before
  lower-casing, `e` match skipped, distinct `p` counted before lower-casing, element event check dropped.
- **Coverage review:** every rule the reviewer found untested now has a test. Four spots where tests pinned details
  the ADR left open were settled in the ADR's clarifications, and the purity guard no longer scans comments. The
  review items not covered here are Review-phase diff checks ("Unchanged: …", "no §16 entry").

## Verification

The new tests fail on the current code. Confirmed on 2026-09-27 at commit `03c75544` plus the uncommitted suite:

```
$ npm run gate:status -- --label tagging-edges-1-red
20260927T045340Z-9613-93f2 [tagging-edges-1-red] started 2026-09-27T04:53:40.092Z on 03c75544+dirty — FAIL, exit 1, 0 passed, 76 failed, 0 skipped, 1/1 suites; failed: tagging-edge-contract

Failure reasons (76):
  67 tagging-edges contract not implemented yet (require('../src/lib/tagging-edges') failed: Cannot find module …)
   3 no Social Graph Relationships subsection in §6
   1 §6 needs "#### Social Graph Relationships (NostrUser → NostrUser)" after "#### Infrastructure"
   1 §30 coverage status line names TAGS
   1 the Last updated line names the TAGS / tagging-edges change
   1 a glossary row for TAGS
   1 src/lib/tagging-edges/ does not exist yet (purity check)
   1 src/lib/tagging-edges/ does not exist yet
```

Every failure is the missing module or the missing BIBLE text; none comes from a typo or a load error. A full labelled
baseline (`GATE_LABEL=tagging-edges-1-baseline npm test`) is recorded for Implementation's suite-by-suite comparison,
because the full gate on this host is already red on unrelated live suites (OPEN.md row 289).

## Review round (2026-09-27)

The Review found behaviors the ADR had left open, and the owner ratified four clarifications, 9–12, at the Review gate.
Six tests pin them, and one AC-5 assertion was added for the target-move rule. That makes 82 tests in all.

| Clarification | Test |
|---|---|
| 9 — the identity `d` is the first `d` strfry indexes | `clarification 9: an over-long first d is skipped …`; `clarification 9: a version the relay filed under a later d …` |
| 10 — the order holds for a BigInt or Integer-like `createdAt` | `clarification 10: the version order holds when createdAt is a BigInt …` |
| 11 — the element id must match; a throwing element is absent | `clarification 11: a supplied element resolves only if its id is the e …`; `clarification 11: an element that throws …` |
| 12 — addresses match any character after the second colon | `clarification 12: an address may carry any character …` |
| AC-5 — BIBLE states the target-move rule | an added assertion in `AC-5: the subsection gives TAGS' identity …` |

Red before the fix, with 7 failing, each on the behavior it pins:

```
$ npm run gate:status -- --label tagging-edges-1-round2-red
20260927T123353Z-66902-577b [tagging-edges-1-round2-red] started 2026-09-27T12:33:53.320Z on aff3c1cd+dirty — FAIL, exit 1, 75 passed, 7 failed, 0 skipped, 1/1 suites; failed: tagging-edge-contract
```

A scratch copy of the module carrying the intended fixes, plus a BIBLE with the target-move sentence, passes 82 / 82,
so every new test can pass.
