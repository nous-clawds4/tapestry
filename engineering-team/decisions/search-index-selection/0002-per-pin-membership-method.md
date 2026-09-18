# ADR 0002: `membershipMethod` — a per-pin membership method, disclosed on every 30392

**Status:** Accepted (J1 design gate 2026-09-18; re-aim table amended at Review — the three live suites' S1 source contracts also follow the vocabulary into `ui/src/config/tlMembershipMethods.js`)
**Date:** 2026-09-18
**Story:** `engineering-team/stories/search-index-selection/3-per-pin-membership-method.md`

## Context

The membership fold that turns a pin's trust-filtered assertions into Trusted-List members is
today one **deployment-wide** dial: `resolveMembershipMethod()` reads
`trustedLists.membershipMethod` out of the settings store and fails safe to `'count'`
(`src/api/trustedList/membershipMethods.js:33-42`; vocabulary at `:20`, implemented set at `:23`;
default shipped at `src/config/defaults.json:58`). `runOnePin` is its **only** functional consumer
(`src/api/trustedList/refreshPinnedTags.js:303-305`), where the resolved value is downgraded to
`'count'` when the WoT filter did not run (`:306-307`) and then dispatched through
`membershipFolds` (`:308-332`). The note and item runners never call it — they already read a
**per-pin** `curation.noteMethod` (`:530`, `:645`) and publish it as `['curation-method', …]`
(`:574`, `:691`).

So the book's day-one need — one strictly-curated list a search backend subscribes to, running
beside ordinary lists on the same deployment — is unreachable: tightening to `certainty` retunes
every Trusted List on the instance (OPEN 307, `OPEN.md:363`).

Gate A settled the wire shape (story § "Gate A rulings"): field **`membershipMethod`** on the
pin's `curationMethod` blob, values from `METHOD_IDS`, **absent ⇒ the instance dial**; the
published 30392 carries `['membership-method', <the fold that ran>]` — restoring a tag Story 4
stripped, the one non-additive change; the dial stays as the default for pins that do not choose,
with the `TrustDetermination.jsx:93` copy made true. This ADR decides *how resolution is
composed*, *where the disclosure sits*, *how the dialog sources the vocabulary*, and *which files
move*. It does not re-open those rulings.

### What HEAD (`88a326d6`) actually looks like

- **The carrier needs no parser change.** `parseCurationMethod`
  (`src/api/profile-tags/index.js:588-601`) returns the whole blob, so `curation.membershipMethod`
  is available with zero code change and "absent ⇒ `undefined`" is automatic. `pinTag`
  (`ui/src/utils/publishTagPin.js:138-172`) stringifies one variable into **both** copies
  (`:169`, `:171`), so AC-5's "the two copies agree" is structural.
- **The registry's seam is a zero-arg function.** `runOnePin` calls
  `deps.resolveMembershipMethod ? deps.resolveMembershipMethod() : resolveMembershipMethod()`
  (`:303-305`), and every hermetic suite injects an **argument-blind** stub
  (`test/pin-stack-composition.test.js:106`, `test/only-me-curation.test.js:139`). One suite goes
  further and asserts the resolver is *never handed the pin's context*
  (`test/pin-stack-composition.test.js:360-375`).
- **`extraTags` is a pass-through** (`src/api/trustedList/index.js:116-133`), so a new tag is a
  one-line edit at `refreshPinnedTags.js:364-375` — exactly where the strip comment sits
  (`:372-374`).
- **The strip is pinned by more assertions than the story lists.** Besides
  `test/tl-weighted-sum-method.test.js:324`, `:387`, `:426`, the same absence is asserted at
  `test/tl-certainty-method.test.js:288-289` and
  `test/tl-membership-method-selector.test.js:373-374` (both live-stack suites, `test/registry.js:205-207`).
  And `test/only-me-curation.test.js:386-392` pins the 30392's **whole** `extraTags` array as
  byte-identical — it is a re-aim target too, not the untouched guard the story assumed.
- **`/api/settings` is owner/admin-gated** (`src/api/index.js:340-344`; `requireOwner`,
  `src/api/settings/settingsApi.js:47-57`). No unauthenticated surface exposes
  `trustedLists.membershipMethod` — the card itself falls back to `'count'` on 401/403
  (`ui/src/pages/grapevine/TrustDetermination.jsx:41-51`).
- **The UI mirror is a page-local constant.** `TL_MEMBERSHIP_METHODS`
  (`TrustDetermination.jsx:15-22`, "keep in sync", `:14`) is not exported.
- **Origin drift.** The working base is 66 commits behind `origin/staging`, but **zero** of those
  commits touch any file in this blast radius (`git log HEAD..origin/staging -- src/api/trustedList
  ui/src/components/CurationMethodDialog.jsx ui/src/pages/grapevine/TrustDetermination.jsx …` is
  empty). Designing here is safe; the rebase is a scheduling question, not a correctness one.

### Concepts touched

- `39998:<TA>:tag-pinning` — the pin element (graph-confirmed: three-call orientation against the
  local panel, `:8778`). Its JSON schema declares `curationMethod` as a free-form `object` whose
  **prose** enumerates the v1 fields
  (`firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json:41`, which already lists
  `targetTypes`, `noteMethod`, `authorConstraint`). A new field is structurally valid today.
- `39998:<TA>:trusted-list` — the published 30392. No schema field changes; the disclosure is an
  event tag.

No new concept, no new handle, no TA-pubkey literal.

## Options considered

### Option A — the runner composes; the registry stays the *dial*
`runOnePin` reads `curation.membershipMethod` and gates it on the registry's vocabulary before
falling back to the existing zero-arg resolver:

```js
const pinMethod = curation.membershipMethod;
const requestedMethod = isImplementedMembershipMethod(pinMethod)
  ? pinMethod
  : (warnIfUnknownPinMethod(pinMethod), resolveDial());
```

- **Pros.** `resolveMembershipMethod()` keeps its exact signature and meaning — "what this
  deployment is set to" — so the `deps.resolveMembershipMethod` injection seam keeps meaning the
  same thing in every existing suite, and `test/only-me-curation.test.js:678-688` (the registry is
  untouched) stays green for free. Crucially, **the per-pin path is not stubbable away**: a suite
  that injects the dial stub still exercises real precedence, so AC-1 tests the shipped code
  rather than a mock. Precedence sits in the same 20 lines as the WoT downgrade (`:306-307`) and
  the disclosure (`:372-375`) — one place to read the whole story of "which fold ran". Exactly
  mirrors `noteMethod` (`:530`, `:645`), the per-pin precedent this story is the third instance of.
- **Cons.** The runner imports one more symbol from the registry. Precedence logic lives outside
  the module named for the vocabulary (mitigated: the *vocabulary check* stays in the registry as
  a pure predicate).

### Option B — the resolver gains a parameter: `resolveMembershipMethod({ pinValue })`
The registry owns precedence; the runner passes the pin's value down.

- **Pros.** One function answers "which method?"; a future rung-2 precedence rule lands in one
  file.
- **Cons.** It silently breaks the injection contract. Every existing stub is argument-blind
  (`pin-stack-composition.test.js:106`, `only-me-curation.test.js:139`), so under injection the pin's
  choice would be **discarded** — the feature becomes invisible to precisely the hermetic suites
  that are supposed to guard it, and a Tester must remember to write arg-aware stubs or AC-1
  passes vacuously. It also pushes settings-reading and per-pin blob semantics into one function
  (the dial re-reads disk on every call; the pin value does not), and it hands pin-derived data to
  a resolver that `pin-stack-composition.test.js:360-375` exists to keep pin-blind. Rejected.

### Option C — a new "effective curation" resolver module above both
A `resolveCuration(pin)` that returns `{ method, authorConstraint, membershipMethod, … }` for all
three runners.

- **Pros.** A future home for rung-2/rung-3 precedence across fields.
- **Cons.** Speculative generality in a Light lane: today there is exactly one field with
  instance-level fallback. It would also have to reproduce the WoT downgrade (which depends on
  `wotFiltering`, only known *after* the aggregation returns, `:294-296`) or leave the resolution
  split across two places — the worst of both. Rejected; reconsider when a second field acquires a
  dial.

### Sub-option — always disclose vs disclose only when the pin chose
Gate A ruling 3 settles it (**always**); recorded here with the reason. A consumer of the
permanent contract must be able to read one event and know how it was folded. "Disclose only when
the pin chose" makes silence ambiguous — it would mean "the dial, whatever that is on the
deployment that published this, at the time it published" — which is exactly the lookup the
per-pin move abolishes. This is the reason the tag is **unconditional** while ADR 0001's
`author-constraint` is **conditional**: an absent constraint has no resolved value to name
(absence *is* the meaning), whereas a method always has one.

### Sub-option — where the UI vocabulary lives
(a) a third hand-kept copy inside the dialog — rejected, three mirrors of a wire vocabulary in a
no-build project is how they drift; (b) export `TL_MEMBERSHIP_METHODS` from
`TrustDetermination.jsx` and import it into the dialog — rejected: a shared component importing
from a page inverts the dependency direction and drags that page's imports (`TrustContext`,
`useProfiles`, `queryRelay`) into every bundle that shows the pin dialog; (c) **one UI module**
under `ui/src/config/` (the existing home for static constant modules — `avatarMenuLinks.js`,
`pubkeys.js`), imported by both consumers — chosen; the mirror count stays **1**, not 2.
(d) Move `METHOD_IDS` into the shipped-to-UI SDK (`src/lib/event-tagging/`, the ADR 0001 §7
precedent) so server and client share one definition — architecturally the best answer and a real
follow-up, but it widens a Light story into the SDK tree and the registry's settings coupling; the
labels/blurbs are UI prose and would stay in the UI anyway. Deferred (see Consequences).

## Decision

We chose **Option A**, with always-on disclosure and one UI constants module.

**1. Resolution (AC-1, AC-3).** In `runOnePin` (`refreshPinnedTags.js:232`), read the pin's value
next to the other blob reads, **after** the observer bail (same ordering rule ADR 0001 §1 set for
`authorConstraint`, `:260-263`):

```js
// search-index-selection ADR 0002 §1 — the pin's own fold wins; absent ⇒ the
// instance dial (AC-2). An unknown / future-rung / malformed value FAILS OPEN to
// the dial, matching the registry's own posture (membershipMethods.js:33-42).
const pinMembershipMethod = curation.membershipMethod;
```

and at `:303-305` replace the resolver call with a composition:

```js
const resolveDial = deps.resolveMembershipMethod || resolveMembershipMethod;
const requestedMethod = isImplementedMembershipMethod(pinMembershipMethod)
  ? pinMembershipMethod
  : (warnUnknownPinMembershipMethod(pinMembershipMethod), resolveDial());
```

- `isImplementedMembershipMethod(v)` is a **new pure predicate exported from
  `src/api/trustedList/membershipMethods.js`** — `IMPLEMENTED_METHOD_IDS.includes(v)` — so the
  vocabulary check stays in the registry that owns the vocabulary. `METHOD_IDS`,
  `IMPLEMENTED_METHOD_IDS` and `resolveMembershipMethod`'s signature/body are **unchanged**
  (`test/only-me-curation.test.js:678-688` and `test/tl-membership-method-selector.test.js:163-218`
  stay green unamended).
- The **fail-safe to `'count'` is preserved**, unchanged, inside `resolveMembershipMethod`
  (`:39-41`): the pin's fallback is the dial, and the dial's fallback is `'count'`.
- The **one-time warn** lives in `refreshPinnedTags.js` beside `authorConstraintTags`
  (`:49-51`), as a module-level `Set` + `warnUnknownPinMembershipMethod(v)`, mirroring
  `warnUnknownAuthorConstraint` (`src/api/profile-tags/index.js:643-649`) verbatim in shape. It
  **must not fire when the field is absent** (`v === undefined || v === null` ⇒ return), only on a
  present-but-unimplemented value; keyed by the offending value so one bad pin cannot flood the
  log across refresh cycles. It does not belong in the registry (which stays pure w.r.t. pins) and
  it does not belong in the SDK (ADR 0001 §1: the SDK takes no `console`).
- **The WoT downgrade is untouched** (`:306-307`): it now applies to the per-pin value exactly as
  it applied to the dial's (E2). `membershipFolds` (`:308-332`) is byte-identical — no method is
  special-cased.

**2. Disclosure (AC-4).** At `refreshPinnedTags.js:372-374`, delete the strip comment and emit the
tag **unconditionally on every 30392**, immediately after `authorConstraintTags(...)` and
immediately before the conditional `rigor`:

```js
['observer', observer],
['source-tag', …],
['cutoff', String(cutoff)],
['min-rank', String(minRankForTag)],
...authorConstraintTags(authorConstraint),
['membership-method', membershipMethod],      // ← NEW, always present
...(membershipMethod === 'certainty' ? [['rigor', '0.5']] : []),
...tlZTags,
```

The value is the **`membershipMethod` variable at `:306`** — i.e. post-downgrade, post-fail-open:
the fold that actually ran, never the one that was requested (E2). Position: it is a *scoring*
tag, so it joins `cutoff` / `min-rank` / `author-constraint` before the discovery `z` pair, and it
sits adjacent to `rigor`, which is a parameter *of* `certainty` and therefore reads correctly only
after the method it qualifies. ADR 0001 §4's "the disclosure rides immediately after `min-rank`"
is unaffected — `author-constraint` keeps that slot.

- **30393 / 30394 gain nothing.** They already disclose their per-pin fold as
  `['curation-method', noteMethod]` (`:574`, `:691`); a second, differently-named tag for the same
  idea on those kinds would be noise (E1).
- **`retractStaleTLs` `carryOver` does NOT gain it** (`:466-469`). Confirmed, on ADR 0001 §4's
  reasoning: `carryOver` is identity + provenance + discovery (`title`, `metric`, `observer`,
  `source-tag`, `z`); the *scoring* tags `cutoff`, `min-rank` and `author-constraint` are already
  dropped, and `membership-method` is their sibling — a retracted list has an empty membership, so
  there is no fold left to characterise. Additive and reversible if a consumer ever needs it.

**3. Dialog (AC-5).** `ui/src/components/CurationMethodDialog.jsx` gains a **Membership method**
`<select>` placed directly under the existing Method select (`:271-291`) and above the "Trust
scope" radio group, because both answer "how is this list computed" while Trust scope answers
"whose assertions count".

- **Vocabulary:** new module `ui/src/config/tlMembershipMethods.js` exporting
  `TL_MEMBERSHIP_METHODS` (the array currently at `TrustDetermination.jsx:15-22`, moved verbatim,
  keeping its "mirrors `src/api/trustedList/membershipMethods.js` — keep in sync" comment).
  `TrustDetermination.jsx` deletes its local const and imports it; the dialog imports it. One
  mirror, two consumers.
- **Default when absent:** the first `<option>` is `value=""` labelled **"Instance default"** with
  helper text "whatever this instance's operator has selected; the published list records the
  method that actually ran." The dialog **does not** attempt to name the current dial: the only
  endpoint carrying it is owner/admin-gated (`src/api/index.js:340`), so for most curators the
  fetch returns 403 and the label would have to degrade anyway; adding a public settings-read
  endpoint is a new surface and out of this story's lane. The honest place to learn the effective
  method is the published list itself, which after AC-4 always says so (§5 below).
- **Edit path (E3 of ADR 0001's discipline, `CurationMethodDialog.jsx:75-93`, `:137-152`):** state
  is seeded from `init.membershipMethod`; the **raw** initial value is kept and a `touched` flag
  recorded, so an untouched control re-emits the pin's original value verbatim (a future-rung value
  this build does not recognise is never silently downgraded), and the field is included in the
  submitted blob **only** when the effective selection is non-empty (conditional spread, never
  `membershipMethod: undefined`). Absent stays absent ⇒ editing a pre-story pin reproduces today's
  blob exactly.
- **`defaultCurationMethod` (`ui/src/utils/publishTagPin.js:96-119`) does NOT gain the field** — a
  new pin follows the instance dial, same call ADR 0001 §2 made for `authorConstraint`. Comment
  only.

**4. Copy fix (AC-6).** `ui/src/pages/grapevine/TrustDetermination.jsx:89-94` becomes true rather
than aspirational. Final copy for the card's blurb (last two sentences replaced):

> This is the **default for pins that don't choose** — a pin can set its own membership method in
> its curation dialog, and that choice wins. Every published Trusted List records the method that
> actually ran in a `membership-method` tag.

The heading, the radio group, the owner gate, and the settings write (`:60-77`) are unchanged.

**5. Read surfaces.** `ui/src/hooks/useTLDetail.js:63-100` parses one more tag —
`membershipMethod = findTag('membership-method')?.[1] || null` — into the `tl` object, and
`ui/src/components/PinnedListPanel.jsx:465-485` renders one more `<dl>` row, **"Membership
method"**, immediately after the ADR 0001 "Curation scope" row and before "Min rank", with the
label from `TL_MEMBERSHIP_METHODS` when the id is known and the raw id otherwise (a list published
by a future rung must still display). Rendered only when the tag is present, so pre-story lists
are unaffected. **`enrichRowsWithTLStatus` (`src/api/profile-tags/index.js:1646`, `:1690`, `:1715`)
is untouched** — it keys on `method` + `observer` + context, none of which move; the pins API
already ships the whole `curationMethod` blob (`:1600-1606`), so the field reaches the client for
free.

**6. Composition with ADR 0001.** `authorConstraint`, `membershipMethod` and the context are
**three independent fields** on one blob, applied at three different stages: the context is
*identity* (d-tag + discovery `z` only, `:262`), the constraint is *eligibility* (applied inside
the aggregation, before the fold), the method is *scoring* (the fold itself). They compose without
interaction. In particular ADR 0001's carve-out — **under `authorConstraint: 'observer'` the
observer's own weight is 1.0** (`src/lib/event-tagging/pins.js:186-199`) — is a property of the
weight function, not of any method, so it applies whichever fold runs, whether the fold came from
the pin or the dial (E3). The day-one search-index pin is exactly
`{ authorConstraint: 'observer', membershipMethod: 'certainty' }` on a `count` deployment, and
nothing special-cases that pairing.

**7. Firmware.** `firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json:41` — the
`curationMethod` description gains, after the `authorConstraint` clause:
`membershipMethod ('count' | 'input' | 'certainty'; absent = the instance-wide default)`.
Description-only edit to a free-form object: no structural validation change, no graph reshape.

### Invariant check
Read-time only: no publish path is gated and anyone may still pin anything or tag anything
(CLAUDE.md invariants 2 and 3). The method decides only how **this pin's** already-trust-filtered
set is folded, per POV — the answer to "who is this list true for?" remains "the pin's observer",
and it is now disclosed on the wire instead of implied by a deployment setting. No TA-pubkey
literal is introduced.

## Consequences

- **Enables** the book's day-one need: a `certainty` + `observer` search-index pin beside ordinary
  `count` lists on one deployment, and a consumer who can tell them apart from the event alone.
- **The 30392 tag array changes for every pin** — the one deliberate, non-additive break of AC-2's
  byte-identity, ruled at Gate A. Downstream readers that deep-equal a 30392's tags will see one
  new entry; nothing in this repo does except the tests listed below.
- **`membership-method` becomes a permanent wire contract.** The ids are already declared
  wire-stable (`membershipMethods.js:16`), so rungs 2–4 extend values, never rename them. Having
  stripped and then restored this tag once, a future story that wants to remove it again owes a
  superseding ADR.
- **Fail-open means a future-rung pin value degrades silently** on an un-upgraded runner: it falls
  back to the dial and the disclosure names the dial's fold, so the list never over-claims. The
  cost is that a rung-2 pin refreshed by an old runner publishes an ordinary list under a name the
  curator did not choose — acceptable on ADR 0001's precedent, and detectable because the
  disclosure is honest.
- **New debt / follow-ups.** (a) The UI still hand-mirrors the server ids; sourcing `METHOD_IDS`
  once from `src/lib/event-tagging/` (sub-option d) is the real fix and is worth an `OPEN.md` row
  rather than this lane. (b) `test/tl-certainty-method.test.js` and
  `test/tl-membership-method-selector.test.js` are live-stack suites outside the scoped gate whose
  absence assertions now invert — they must be re-aimed in the same Phase-3 pass even though the
  judge gate cannot run them (operator runs them at Gate B).
- **Firmware reinstall required? YES** — `POST /api/firmware/install`, because
  `firmware/…/tag-pinning/json-schema.json:41` is the only human-readable definition of the
  `curationMethod` vocabulary and the graph copy drifts until it is reinstalled. Locally: via the
  container loopback per AGENTS.md §6 (this dev panel is `http://localhost:8778`). On
  `tags.brainstorm.world`: as part of the deploy, or the deployed graph will describe a blob
  vocabulary one field short.

## Implementation notes

Blast radius — every file that changes:

- `src/api/trustedList/membershipMethods.js` — add and export the pure predicate
  `isImplementedMembershipMethod(v)`. `METHOD_IDS`, `IMPLEMENTED_METHOD_IDS` and
  `resolveMembershipMethod()` are **unchanged** (no new parameter, same fail-safe to `'count'`).
  Update the module docstring (`:2-13`) to say the dial is now the *fallback* for pins that carry
  no `membershipMethod`.
- `src/api/trustedList/refreshPinnedTags.js` —
  (i) module scope, beside `authorConstraintTags` (`:49-51`): `warnUnknownPinMembershipMethod(v)`
  with a module-level `Set`, silent on absent values, modelled on
  `profile-tags/index.js:643-649`;
  (ii) in `runOnePin`, read `curation.membershipMethod` after the observer bail (`:260-263`
  neighbourhood);
  (iii) at `:303-305`, compose pin-value-then-dial as in §1 — keep `deps.resolveMembershipMethod`
  as the **zero-arg** dial seam;
  (iv) at `:372-374`, replace the strip comment with the unconditional
  `['membership-method', membershipMethod]`, before the `rigor` spread;
  (v) `retractStaleTLs` `carryOver` (`:466-469`) unchanged; `runOneNotePin` / `runOneItemPin`
  unchanged (E1).
- `ui/src/config/tlMembershipMethods.js` — **new**: `export const TL_MEMBERSHIP_METHODS = [...]`,
  moved verbatim from `TrustDetermination.jsx:13-22` with its sync comment.
- `ui/src/pages/grapevine/TrustDetermination.jsx` — delete the local const (`:13-22`), import from
  the new module, and replace the blurb's last sentence per §4 (`:89-94`).
- `ui/src/components/CurationMethodDialog.jsx` — import `TL_MEMBERSHIP_METHODS`; state
  `membershipMethod` + `membershipMethodTouched` seeded from `init.membershipMethod` per the
  `:75-93` discipline; a `<select>` with a leading `value=""` "Instance default" option under the
  Method field (`:271-291`); conditional spread into the `custom` blob (`:137-152`).
- `ui/src/utils/publishTagPin.js` — comment only in `defaultCurationMethod` (`:92-119`): new pins
  deliberately carry no `membershipMethod`.
- `ui/src/hooks/useTLDetail.js` — parse `membership-method` into `tl.membershipMethod` (`:63-105`).
- `ui/src/components/PinnedListPanel.jsx` — one conditional `<dl>` row (`:465-485`).
- `firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json:41` — description clause; then
  `POST /api/firmware/install`.

**Not implementation — Phase 3 (the Tester's lane).** The scoped gate is in the story. Test files
that must be **re-aimed**, with the reason each one moves:

| File | Lines | Why |
|---|---|---|
| `test/tl-weighted-sum-method.test.js` | `:324-325`, `:387-388`, `:426-427` | assert the tag's absence; now assert `['membership-method', <fold>]` (`'input'`, `'input'`, `'count'` respectively per their setups at `:304`, `:337`, `:417`) |
| `test/pin-stack-composition.test.js` | `:296-312` (count fixture), `:315-333` (certainty fixture) | literal AC-4 `extraTags` fixtures gain `['membership-method','count']` / `['membership-method','certainty']` after `min-rank`. The 30393 fixture (`:336-355`) and the context test (`:358-375`) are **unchanged** |
| `test/only-me-curation.test.js` | `:386-392` (H3) | pins the whole 30392 `extraTags` array byte-identically; gains the one tag. Every other assertion in the file, including the 30393/30394 arrays at `:414-421` / `:442-448` and R3 at `:678-688`, stays green unchanged — **the story listed this file as an untouched guard; it is a one-line re-aim target** |
| `test/tl-certainty-method.test.js` | `:288-289` | same absence assertion; live-stack suite, outside the judge gate, operator runs it at Gate B |
| `test/tl-membership-method-selector.test.js` | `:370-374` | same; also live-stack (`test/registry.js:205`), Gate B |

The sharpest sentinel for the new suite (AC-1): one corpus, one observer, a deployment dial of
`count`, two pins differing **only** in `membershipMethod` (`certainty` vs absent) ⇒ two lists
whose members/scores differ, each carrying its own honest `membership-method` tag. The second
sentinel (E2/AC-3): `membershipMethod: 'certainty'` with `wotFiltering === false` ⇒ the fold and
the published tag both read `count`; and `membershipMethod: 'rung-9'` ⇒ the dial's fold, one warn,
no refusal to refresh.

## Out of scope

- **Part B / story 5** — the explicit pin variant key, the `d`-tag schemes, the uniqueness guard.
  Nothing here creates a second pin of a tag or a new chip.
- **Story 4** — the first-pin confirm step.
- **Retiring the instance dial.** It stays (AC-6); only its copy and its status as *fallback*
  change.
- **Rungs 2–4 of the method ladder**, and rung 2/3 of the author-constraint ladder.
- **Sourcing `METHOD_IDS` once across server and client** via `src/lib/event-tagging/` — named
  above as the right eventual fix; deferred to its own change with an `OPEN.md` row.
- **A public (non-owner) read endpoint for `trustedLists.membershipMethod`** — would let the
  dialog name the current dial; deliberately not added here.
- **Adding a disclosure tag to the 30393/30394** — they already carry `curation-method`.
- Anything the search backend does with the resulting list, and the `worth-indexing-for-search`
  tag itself.
