# Review: doc lane — `design-philosophies/` folder, with Show and Tell as the first philosophy

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19
**Diff:** `git show 1dba05af` on `docs/design-philosophies` (one commit ahead of `main`; the branch is local only — `git branch -a --contains 1dba05af` lists no remote)
**Lane:** doc lane (`engineering-team/workflows/0-intake.md` step 3 — Implementer + Reviewer, non-numbered review, no story, no ADR, no test plan, no book). This file is the lane's record.
**Intent audited against:** the owner's two typed messages of 2026-09-19 (session transcript entries at 19:11:50Z and 20:14:13Z). The second is a refinement and wins where they differ.
**Round:** 1

Four lens reviewers and a set of skeptic verifiers worked the diff before me. I treated their output as input. Everything listed under Findings I re-derived from the files, the code, the owner's typed messages in the session transcript, the article mirror, and `gh`. Where I disagree with them I say so.

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` — last line `harness-lint: clean (0 violations)`. The other lines are WAIVED entries for files this change does not touch.
- [x] `wc -l CLAUDE.md AGENTS.md` — 190 and 102, exactly the caps in `scripts/harness-budgets.txt`. The CLAUDE.md row was rewritten in place, net 0 lines.
- [x] L10 — commit 1dba05af touches a harness-definition path (`CLAUDE.md`) and `engineering-team/CHANGELOG.md`.
- [x] Suites, run through their `run()` exports (running a suite file directly can silently no-op): `harness-lint` {pass 41, fail 0}; `operational-direction` {pass 86, fail 0, skipped 0}; `session-start` {pass 10, fail 0}.
- [x] The six other suites that open one of the changed files (`CLAUDE.md`, `OPEN.md`, `CHANGELOG.md`, `_intake.md`), also through `run()`: `curated-dlist-update-publish` 69/0, `curated-dlist-update-update-preview` 34/0, `kill-timeout-orphans-by-default` 9/0, `note-tagging-raw-events-inspector-ui` 32/0, `restore-historical-data-and-fix-tl-author-filter` 22/0, `harness-stats` 12/0.
- [ ] Full `npm test` — not run. The diff holds no code and no test file, and the nine suites above are every suite that opens a changed file. `npm run gate:status` prints `no gate run records in …/tmp/gate-runs`, so there is no status line to quote.
- [x] Relative links: every `](…)` link in the four `design-philosophies/*.md` files resolves on disk; `bibliography.md#show-and-tell` exists as an explicit anchor; the two `../../` links added to `_intake.md` resolve.
- [x] Bibliography: all 16 `naddr` links decode (repo `nostr-tools`) to kind 30023, author `e5272de9…a102f`, the d-tag shown in the same row, no relay hints; the cited-section coordinate matches its naddr; the npub encodes from the hex key. The Show AND Tell `njump.me` link returned HTTP 200 with the right `<title>` when I fetched it.
- [x] OPEN.md rows 331–335 each have 7 cells; `bash scripts/whats-open.sh` exits 0 and surfaces them.
- [x] Control-byte sweep over all 8 changed files: nothing.
- [x] `design-philosophies` is absent from `scripts/harness-def-paths.txt`, as the README says.
- [x] Working tree clean after the review, apart from this file.
- [ ] _Lint / typecheck / build not configured — skipped._

## Claims adherence (doc-lane variant)

| # | Claim the change makes | Evidence | Holds? |
|---|---|---|---|
| 1 | The owner reviewed `show-and-tell.md` on 2026-09-19 (header, line 4) | Owner's last typed message 20:14:13Z; the file is first committed 20:24:54Z (16:24:54 −0400); no owner message follows | **No — B1** |
| 2 | "The pin dialog explains that pinning publishes a Trusted List…"; `CurationMethodDialog.jsx` is "what the pinner is told" | `TagPinAffordance.jsx` header, `Tag.jsx` `handlePin`, single `mode="edit"` mount in `PinnedListPanel.jsx` | **No — B2** |
| 3 | Intake block is the owner's request "verbatim" | Owner typed "which still allowing"; the block prints "while still allowing" | **No — B3** |
| 4 | E10 quotes the owner | Owner typed "for no other reason that to communicate"; E10 prints "than" inside the quotation marks | **No — B4** |
| 5 | The other owner blockquotes are the owner's words | Diffed against the typed messages, not the relayed copy. Lines 32, 38, 106 and intake blocks 2 and 3 are exact apart from a dropped lead-in and an initial capital. Lines 10 and 93 differ typographically: curly quotes became straight, and the owner's `to“tell”` gained a space | Yes, with a rule gap — see B4 |
| 6 | Every quotation from the 2024 article | Article mirror lines 16, 18, 28, 32, 36, 53–59: all present word for word (initial capitals aside) | Yes |
| 7 | Issue #150 quotes | `gh issue view 150 --repo nous-clawds4/tapestry`: heading "Primary Motivation for Pinning"; the "secondary method for curation…" sentence sits under "Fringe benefits to the community" | Yes (wording nit N3) |
| 8 | Spec quotes: "Hint, never gate", "a bookmark is not agreement", "explicit, signed, revocable, and costly" | `protocols/drafts/tags.md:60`; `shared-concepts.md:55` and `:18` (§ Terminology, not the header) | Yes (pointer fixed in S11) |
| 9 | "usage is the operative source" (E5) | `tags.md:64–65` and the epic give "operative" to the derived union; `buildMembers` keeps hint-only Tags, listed last | **No — S9** |
| 10 | P1: the picker "offers same-slug matches under 'Show other results'" | `AddTagDialog.jsx`: `otherHits` filters `!inScope(t)` — other target type only; usage order applies only with an empty query; `handleAvailableTags` sorts by name | **Misleading — S12** |
| 11 | "The shipped examples above all derive their counts on read" | True for E1, E3, E4, E6 and the E5 picker. E2's kind-30392 list, E5's kind-30394 lists and E7's GrapeRank columns are stored | **Overbroad — S14** |
| 12 | "a scoring method, a point of view and a cutoff" is a shipped definition found via `tags.md` § Pins | The words exist only in `audits/curated-dlist-update/prd-seed.md:85` (§ 4, Domain model) | True quote, wrong pointer — S4 |
| 13 | "ADR 0009 left the unqualified 'pinning' slug free" | Three files are numbered 0009; the text is in `decisions/0009-pin-a-tag.md`, Option A, "Concept slug" | True, ambiguous — S16 |
| 14 | Folder is advisory; "curation signal" replaces "Curation Method"; poles with hybrids; status column; three intake entries; working URLs | Owner message 2, answers 1–4 and the two "Agree" lines | Yes |
| 15 | OPEN rows 331–335 | 331: `protocols/README.md:15` and no such BIBLE section; 332: budgets header text, no `@` import; 333: `docs/research/` never tracked; 335: bibliography verified above. 334's live production/staging state I did not re-fetch | Yes (334 on the lens reviewers' evidence) |
| 16 | CHANGELOG row cites this review's path | The file did not exist at 1dba05af; it exists now, at exactly the cited path | Resolved by this file |
| 17 | CLAUDE.md stays at 190 lines; row rewritten in place | `wc -l`; `git show 1dba05af -- CLAUDE.md` | Yes |

## Things tests can't catch

- [x] No secrets, no debug code, no code at all in the diff.
- [x] No hardcoded TA pubkey. The only pubkey literal is straycat's author key in `bibliography.md`, which is the correct thing to cite there.
- [x] Scope: the three intake entries and OPEN rows 331–335 go beyond "write the document", but the owner asked for the intake entries and the rows are survey findings with no other surface. No scope creep.
- [x] Architecture invariants: nothing in the folder gates publication, hard-codes a trusted set, or stores a per-point-of-view result. The one tension (a steward's by-hand dictionary entry) is addressed in S13.

## Concept-graph integrity / ADR adherence / product-guide adherence

Not applicable: no concept definitions, no ADR, no PRD-traced copy.

## Findings

### Blocking

**B1. The header says the owner reviewed a document the owner has not seen.**
`design-philosophies/show-and-tell.md:4` — `> **Opened:** 2026-09-19 · **Last reviewed by the owner:** 2026-09-19`
Evidence: the owner typed two messages in the session, at 19:11:50Z and 20:14:13Z. The second answers a plan ("1. Yes. 2. Advisory, not binding. … 4. Yes, prepare the working URLs"). The file was first committed at 20:24:54Z and quotes that second message three times, so it postdates it. No owner message follows. `/usr/bin/grep -rn -i reviewed design-philosophies/` finds only this line and the template's placeholder; the README never says what the field means or who sets it. The stamp lends the owner's name to everything drafted around the quotes.
Asked change, three places:
1. `show-and-tell.md:4` →
   `> **Opened:** 2026-09-19 · **Last reviewed by the owner:** not yet — drafted 2026-09-19 from the owner's two statements of that date; the owner has not read this text`
2. `_template.md:4` →
   `> **Opened:** {YYYY-MM-DD} · **Last reviewed by the owner:** {the date the owner said they had read this file, or "not yet"}`
3. `README.md` § "How to extend a philosophy", new bullet after "Quoted owner's words are not edited.":
   `- **"Last reviewed by the owner" is the owner's to set.** Write a date there only when the owner has said they read the file itself. Stating the idea, approving a plan for it, or being quoted in it is not a review. Until then the field reads "not yet". Entries added after that date keep their own provenance and stay unreviewed until the owner moves the date.`

**B2. The worked case describes a pin flow that does not ship.**
`show-and-tell.md:116` — "The pin dialog explains that pinning publishes a Trusted List…"; `:140` (E3, Where to look) — "`ui/src/components/CurationMethodDialog.jsx` (what the pinner is told)"; `:167` (Q3) — "the dialog does not mention…"; `:24` — "the pin dialog".
Evidence: `ui/src/components/TagPinAffordance.jsx` header: "Unpinned: single-click action; Tag.jsx publishes immediately with defaults (no curation-dialog interstitial)". `ui/src/pages/Tag.jsx` `handlePin` calls `publishWithCuration(defaultCurationMethod(user.pubkey))` directly. `CurationMethodDialog` is mounted once in `ui/src`, in `PinnedListPanel.jsx` with `mode="edit"`, behind the "⚙️ Edit curation" button, and `PinnedListPanel` is mounted only inside the Tag page's Pinned tab (`{isPinned && …}`). All a pinner is told beforehand is the Pin button's tooltip, a CSS pseudo-element shown on `:hover` / `:focus-visible` and set to `display: none` under `@media (hover: none)` (`ui/src/styles.css`). The same click also fires `publishNip51ExportForPin` (kind 30000) and `publishNoteBookmarkSetForPin` (kind 30003), each signed by `window.nostr.signEvent`, sent to `[...userWriteRelays, ...WELL_KNOWN_FALLBACK_RELAYS]`, each skipped when empty (default `targetTypes` is `['profile','note']`). The doc's conclusion survives: no pinner-facing copy mentions "Most pinned"; the only such words are the viewer-facing `title="Pins by people in your POV's WoT"` (`ui/src/pages/Tags.jsx:163`). This is the section the owner asked us "to understand in great detail", and its first question is "Do they know?" — a dialog and a tooltip a phone never shows are different answers.
Asked change:
1. `show-and-tell.md:116`, replace the paragraph with:
   `Where the Pin stands today, as a worked case (2026-09-19): every pin is a published, signed event; there is no private pin. Pinning is one click, with no dialog. All the pinner is told beforehand is the Pin button's tooltip: "Pin this tag to publish a Trusted List (kind-30392) curated to your preferences. Other Nostr apps can read it for content discovery and trust-weighted ranking." The tooltip shows on hover or keyboard focus and is switched off on touch screens, so on a phone the pinner is told nothing before the click. A fuller explanation — that the instance will periodically publish the list under the pinner's point of view, and that other Nostr apps can read it — opens the /pins page and the Edit-curation dialog; the dialog can be reached only from the Pinned tab of the Tag's page, once the pin exists. The same click also signs, with the pinner's own key, up to two NIP-51 lists — a follow set (kind 30000) of the listed accounts and a bookmark set (kind 30003) of the Tag's curated notes — and sends them to the pinner's write relays plus a set of well-known public relays. Each is skipped when it would be empty. The tooltip mentions neither. None of this copy says that pins are also counted, per Tag, in the Tags directory's "Most pinned" sort — which is the reuse (E3). The only words about that are shown to viewers, not pinners: the count's tooltip, "Pins by people in your POV's WoT". Whether any of this needs to change is Q3.`
2. E3, Where to look: replace `` `ui/src/components/CurationMethodDialog.jsx` (what the pinner is told) `` with
   `` `ui/src/components/TagPinAffordance.jsx` (the tooltip — all the pinner is told at pin time); `ui/src/pages/Pins.jsx` (`PinsIntro`) and `ui/src/components/CurationMethodDialog.jsx` (the fuller explanation, seen only after pinning); `publishNip51ExportForPin` and `publishNoteBookmarkSetForPin` in `ui/src/utils/publishTagPin.js` (what else the click publishes) ``
3. Q3, replace the second sentence with:
   `Today every pin is a published event; pinning is one click, and the only notice beforehand is a tooltip that touch screens never show. Neither the tooltip nor the /pins and Edit-curation copy mentions that pins are counted in "Most pinned", or that the click also publishes NIP-51 lists under the pinner's own key to public relays.`
4. Line 24: see S4, which also changes "the pin dialog" to "the pin's Edit-curation dialog".

**B3. A block labelled "verbatim" is not.**
`engineering-team/stories/_intake.md:2487`, under `**Raw request (verbatim, 2026-09-19):**` — "…the more popular one, while still allowing them to find the alternatives…"
Evidence: the owner's typed message (transcript, 19:11:50Z) reads "which still allowing them". A character diff of the whole block shows that one substitution and nothing else. The other two intake blocks are exact substrings of the owner's message. `_intake.md` calls itself an append-only raw log and has no `[sic]` convention.
Asked change: restore the owner's word — "…the more popular one, which still allowing them to find the alternatives…". If the slip must be flagged, put the note outside the blockquote: `("which" is the owner's typing; read "while".)`. `show-and-tell.md` P1 is already right: it keeps "while" outside the quotation marks.

**B4. E10 changes a word inside the owner's quotation marks, in the commit that adds the rule against it.**
`show-and-tell.md:147` — `**Tell**, when Alice says it "for no other reason than to communicate this idea explicitly".`
Evidence: the owner typed "for no other reason that to communicate this idea explicitly". `README.md:38`: "Quoted owner's words are not edited"; `show-and-tell.md:173`: "leave the owner's quoted words alone". One skeptic rated this should-fix because the slip is obvious and the meaning unchanged. I keep it blocking with B3: same class, one-cell fix, and the folder's first document sets the precedent for whether the rule is meant.
Asked change (the full row is given in S3, which also edits its last sentence): move the repaired word outside the marks, as P1 does — `**Tell**, when Alice says it for no other reason than "to communicate this idea explicitly".`
Also (should-fix, same rule): my diff against the typed messages shows two blockquotes were normalised typographically — curly quotes became straight in lines 10 and 93, and the owner's `to“tell”` gained a space in line 10. That is ordinary quoting practice, but the rule as written forbids it. Replace `README.md:38` with:
`- **Quoted owner's words are not edited.** Tidying typography is fine: straight quotes for curly, a missing space, a capital where a lead-in clause is dropped. A changed word is not. If the owner's typing has a slip, keep the slip, or move the repaired word outside the quotation marks. If the owner's view changes, add the new statement with its date and say what it supersedes.`

### Non-blocking — should-fix (required this round)

All locations are in `design-philosophies/show-and-tell.md` unless a file is named. Where several findings touch one line, the replacement below is the single final text.

**S1. The refinement's supersessions are not recorded, against the README's own rule.** `README.md:38` says a changed view gets "the new statement with its date and say what it supersedes". The doc does that only for the term. The owner's ratification sentence appears nowhere (`grep "hybrids exist"` → 0 hits); message 1's Pin-as-Tell sentences appear nowhere; the label "How to use the Tell Me method effectively:" was cut from the line-93 quote; all five attributions read alike, so a reader cannot order them. "The dictionary" in the opening quote is also undefined anywhere in the folder.
- Line 12 → `> — the owner, 2026-09-19, first statement. *(This document says "curation signals" where the quote says "Curation Methods" — see Terms for why. "The dictionary" is one of the planned Dictionaries — Tags, DLists, Concepts — whose entries are meant to be earned by community usage. The owner's model is stated on the Dictionaries index page, `ui/src/pages/dictionaries/Placeholders.jsx`; none of it is built yet.)*`
- Insert after it, before the "**Show** and **Tell**…" paragraph:
  `> I agree: Show and Tell are two poles, and hybrids exist.`
  `>`
  `> — the owner, 2026-09-19, refinement (later the same day). Where the two statements differ, the refinement wins. It supersedes "two opposing Curation Methods" read as a strict either-or, and it supersedes the first statement's use of the Pin as its example of Tell (see Terms).`
- Line 34 → `> — the owner, 2026-09-19, refinement`
- Line 40 → `> — the owner, 2026-09-19, refinement`, then a new paragraph directly after the quote block:
  `This supersedes the first statement, which offered the Pin as its example of Tell: "According to the second method, we allow users to Pin individual Tags. We incentivize users to use Pinning system because it is how they tell us of their interest in individual Tags." The refinement names a five-star product review as "a better example" of Tell (E9) and adds the ontology edge (E10).`
- Line 95 → `> — the owner, 2026-09-19, first statement, where this passage sat under the label "How to use the Tell Me method effectively". The refinement classes the Pin it describes as a hybrid, not a Tell (see Terms, and consequence 1 below). *(The profile-page behaviour in the example is proposed, not built — see E13.)*`
- Line 108 → `> — the owner, 2026-09-19, refinement`

**S2. Drafting glosses carry bare owner provenance.** S+1 marks its gloss; these do not.
- S+2 provenance → `owner, 2026-09-19 (the gloss was added in drafting)`
- S−3 provenance → `converse of T+2 (drafting, 2026-09-19); tag applicability (E5) was designed around it`
- S−4 provenance → `converse of T+1 (drafting, 2026-09-19)`
- S−5 row ("The person never agreed to be counted" is unconditional; the owner's hazard has three conditions) →
  `| S-5 | **The reuse hazard.** The action was taken for the person's own reasons. Counting it for other people can anger them if they do not know it is public, cannot keep it private, or would not endorse how we read it. See the section of that name. | owner, 2026-09-19 — said of the Pin; applied to every Show signal, and named, in drafting |`
- Line 110, replace the first two sentences and the lead-in with:
  `The Pin is one case of a general pattern. Every Show signal is a reuse: someone did a thing for their own reasons, and we are reading it as evidence about something else. The owner's statement, made about the Pin, names three separate ways that can go wrong. Ask all three of any design that counts a personal action for other people (the wording of the questions, and the illustration in the third, were added in drafting):`
- H1 (drops "decentralized"; the Baseball rationale is not the owner's) →
  `| H1 | **Decentralized curation of a graph probably wants Tell.** The owner's hunch, in the owner's words: "Probably better when it comes to decentralized curation of a graph." The owner gave no reason. A possible reason, added in drafting: usage seldom reveals an edge such as "Baseball is a child category of Sports" (E10). | owner, 2026-09-19 (the possible reason was added in drafting) |`
- E2, replace the opening `**Mixed signal, leaning Show** (owner, 2026-09-19).` with
  `**Mixed signal, leaning Show.** The owner calls the Pin "a hybrid" (2026-09-19); "leaning Show" was added in drafting, because the owner expects people to pin "because they are using the Pinning feature, not because they are making a public statement".`
- Line 36, replace `Pinning a Tag is the type specimen:` with `Pinning a Tag is the clearest case. The owner calls it a hybrid, and gives the motive as the reason:`
- `README.md:35` → `- **Every entry says where it came from**: the owner (with a date), a cited article, or a piece of shipped work (a book, story, ADR or spec). An entry worked out from another entry says so and names it — `converse of T+1 (drafting, 2026-09-19)`. A sentence added in drafting to an entry credited to a source is marked in its provenance cell — `(the gloss was added in drafting)`. An entry with no provenance is an opinion; put it under Open questions instead.`

**S3. E10 row, final text** (settles B4 and the "case behind H1" link the owner never made):
`| E10 | Building an ontology: "Baseball is a child category of Sports" | An edge in a graph | **Tell**, when Alice says it for no other reason than "to communicate this idea explicitly". Used in drafting to illustrate H1; the owner did not link the two. | illustrative (owner, 2026-09-19) | — |`

**S4. The "curation method" quotation's source is not among the places the sentence points to.** Line 24 →
`> Not to be confused with a **curation method**, which is already a shipped term: "a scoring method, a point of view and a cutoff" (`engineering-team/audits/curated-dlist-update/prd-seed.md` § 4, Domain model). It ships as the "Curation method" panel on Curated DLists, as the pin's Edit-curation dialog, and as the `curation-method` tag on pin events (`protocols/drafts/tags.md` § Pins). A curation method is how one point of view turns signals into a list. Signals go in; a method decides what comes out.`

**S5. Project words are used with no definition and no pointer; "Trusted List" carries the whole Pin example and is not in the BIBLE glossary.** Insert directly under `## Terms`:
`Project words used below are defined elsewhere. **DList**, **GrapeRank** and **point of view**: [BIBLE.md](../BIBLE.md) §21 (Glossary). **Tag**, **tagging** and **pin**: [protocols/drafts/tags.md](../protocols/drafts/tags.md). **Trusted List**: a published, signed list of members computed from one point of view — a pin's Trusted List is the accounts (or notes) that trusted people have tagged with the pinned Tag. See [protocols/drafts/trusted-lists.md](../protocols/drafts/trusted-lists.md).`

**S6. "The owner" is never defined, and nothing in `show-and-tell.md` says straycat is the owner,** so "owner, 2026-09-19" and "2024 article" read as two authorities. (BIBLE §20 lists "Dave Strayhorn (wds4/straycat)" with the same npub as the bibliography; the article mirror's pubkey matches.)
- Line 6 → `> **Sources:** the owner's statement of the idea (2026-09-19, quoted below, with a refinement later the same day); *To get Web of Trust right, we must Show AND Tell* (the owner's 2024 article, published as straycat, 2024-08-22 — [bibliography](./bibliography.md#show-and-tell)); GitHub issue [nous-clawds4/tapestry#150](https://github.com/nous-clawds4/tapestry/issues/150), *Pinning (aka Tracked tags)*.`
  (This also settles the unresolvable "issue #150": the checkout has two remotes and a bare `gh issue view 150` fails with "Could not resolve"; with `--repo nous-clawds4/tapestry` it returns the issue.)
- Line 14 → `**Show** and **Tell** are the two poles of a spectrum, not a pair of boxes. Real mechanisms sit between them, and the best designs usually use both. The owner's 2024 article ([bibliography](./bibliography.md#show-and-tell)) took the same position: "we don't have to pick". In this document "the 2024 article" always means that piece — the same author as the 2026-09-19 statements, two years earlier.`
- `README.md`, new paragraph after line 28: `**"The owner"** in this folder means the person who owns this project: the creator of Brainstorm, listed in [BIBLE.md](../BIBLE.md) §20 (People) as wds4/straycat, who publishes on nostr as straycat. It does not mean the instance owner or the Owner point of view (BIBLE §27), which name whoever runs a given deployment. An article by straycat in the [bibliography](./bibliography.md) is the owner's earlier view, not a second authority. Only a statement the owner made counts as "owner" provenance; a collaborator's statement is attributed to the collaborator by name.`
- `bibliography.md:11`, replace `- **Author:** straycat — ` with `- **Author:** straycat (the owner — see the [README](./README.md)) — `

**S7. A five-star rating is the Tell exemplar at line 28 and E9 and an "in-between case" at line 53, and reactions are Show in the article and Tell in E6, with no reconciliation.** The doc's own rule (name the datum) resolves both. The article gives no reason for its placement, so the reconciliation must be marked as drafting.
- Line 28 → `**Tell signal.** A statement made in order to communicate a judgment about the datum: a five-star product review, "Baseball is a child category of Sports". The 2024 article calls these *explicit trust attestations* — "TELL ME data".`
- Line 51 → `The article was about one datum — a person's standing in your web of trust — and asked which raw data should feed the trust score: follows, mutes, zaps and reactions (Show), or explicit attestations of trust (Tell). Its answer was both.`
- Line 53, replace the last sentence ("The article's in-between cases … are why this is a spectrum.") with a new paragraph:
  `The article already treated this as a spectrum: a five-star rating "for a host on a couchsurfing platform or a vendor on an ecommerce site", and a "superfollow", "lie somewhere on the spectrum" between its poles. That does not conflict with E9, because the datum differs. In the article the datum is the host's or vendor's standing in your web of trust, and its Tell pole is a full attestation with "a context, a score, and a confidence"; a star rating for one stay or one sale falls short of that. In E9 the datum is the product, and the review is a statement about exactly that. Reactions move the same way: the article lists them among its proxy indicators — a reaction to someone's note, read as trust in its author — while an up or down vote on a DList item is the same kind-7 event used as an explicit statement about that item (E6). Name the datum. *(This reconciliation was added in drafting, 2026-09-19; the article does not say why its in-between cases sit where they do.)*`
- E9, fourth cell → `**Near the Tell end** (the owner's placing, 2026-09-19). "Users leave reviews because they are making a statement; there need be no other motivation." Not the same datum as the article's five-star rating for a host or vendor — see "What is new since the 2024 article".`

**S8. "Tell-grade" is defined nowhere, and the section's first conclusion is that the technique does not yield a Tell.** H4 already has the right word. Nothing links to the heading's anchor; T−2's "See the next section" is positional. Line 91 → `## Getting explicit signals: give people a reason of their own`

**S9. E5 gives "operative" to usage; the spec and the epic give it to the derived union.** Replace `The hint covers a new Tag's cold start and is "hint, never gate"; usage is the operative source.` with
`The hint covers a new Tag's cold start and is "hint, never gate". The operative source is the derived union, not the hint alone and not usage alone: a hinted Tag with no usage is still offered, listed last, and usage orders the rest.`

**S10. Ledger IDs use U+2212, not the keyboard hyphen.** 14 occurrences across three files, every one an ID separator; `grep 'S-2'` finds nothing; the README says other documents will cite these IDs; the repo's ID convention is the ASCII hyphen. Nothing outside the folder cites them yet. Run:
`perl -CSD -pi -e 's/\x{2212}/-/g' design-philosophies/README.md design-philosophies/_template.md design-philosophies/show-and-tell.md`

**S11. E8 is placed at the Tell pole by form, which the Terms section rules out, and the placement has no provenance.** E2 and E8 apply opposite tests to the same shape of action. The owner never placed deference, so leave it open.
- E8, fourth cell → `**Mixed signal — placement open (Q6).** Explicit in form: the spec calls deference "explicit, signed, revocable, and costly", because inheriting subscribes the author to the parent's future edits. But the likely motive is the author's own — they inherit to give their own concept a working definition, which is usage, the same shape as the Pin (E2). A pointer is cheap and carries zero weight: "a bookmark is not agreement". So the spec counts the action that costs its author something and ignores the one that costs nothing. Counting who defers, for other people, would then be a reuse. *(Placement by drafting, 2026-09-19; the spec does not use the words Show or Tell.)*`
- E8, Where to look → `` `protocols/drafts/shared-concepts.md` (header, § Terminology, § Aggregated deference) ``
- Append to Open questions: `| Q6 | **Where does deference sit (E8)?** An inherit edge is explicit and signed, and the spec calls it a "claim". But an author most likely inherits to get a definition for their own concept, which is usage. Is it a Tell made costly, or a Show that happens to be signed? If it is a Show, counting who defers is a reuse, and the reuse hazard's three questions apply — worth settling before deference aggregation is built. | drafting, 2026-09-19 |`

**S12. P1 misdescribes "Show other results", and the `P` prefix is undefined and encodes a status that will change.** The expander lists Tags from the *other* target type; same-context duplicates sit side by side, unmarked. The README lists `P1` among ID forms but never defines it, the template has only `E1`, and "never renumber" plus "when a proposed example ships, change its status" guarantees a row that reads "P3 … shipped". The branch is unpushed, so renumbering now breaks nothing. The owner asked for a status column, not a prefix.
- Rows P1, P2, P3 → IDs `E11`, `E12`, `E13`. Line 95's "see P3" → "see E13" (already in S1's text).
- E11, fourth cell → `**Show.** "In this way, consensus can be achieved naturally." Nearest shipped behaviour: with nothing typed, the Add-a-tag picker lists the current target type's Tags by trusted usage; once a name is typed, matches come back in alphabetical order, not by usage. Its "Show other results" expander covers a different case: it lists matching Tags from the *other* target type (a profile Tag while tagging a note), exact-slug first, so people adopt an existing Tag instead of minting a copy. Duplicates within one target type are not handled: two same-slug Tags by different authors appear side by side in the main list, unmarked, and nothing nudges toward the more used one.` Add `ui/src/components/AddTagDialog.jsx` to its Where to look cell.
- Line 134 → `Name the datum. State the status honestly. Append at the end of the table; never renumber. A proposed idea is an ordinary `E` row whose Status says so; it is also tracked in `engineering-team/stories/_intake.md` — this table is not its only home.`
- `README.md:34` → `- **Ledger entries, heuristics, examples and open questions carry IDs** (`S+1`, `T-2`, `H3`, `E7`, `Q4`). The plus and minus are the plain keyboard characters, so an ID can be typed and grepped. The prefix names the table, never the status: a proposed example is an `E` row like any other, and its Status column says `proposed`. Add a new entry as the last row of its table, numbered one past the highest number already there. Never renumber — other documents cite these IDs.`
- `_template.md`, insert between `## Examples` and the table: `Append at the end of the table; never renumber. A proposed example is an ordinary `E` row — the Status column says it is proposed.`
- `_intake.md`: "example **P1**" → "example **E11**"; "example **P2**" → "example **E12**"; "example **P3**" → "example **E13**".
- `_intake.md`, "Nudge people toward…" entry, "What exists today": replace the sentence from "The Add-a-tag picker lists candidates by trusted usage…" through "…(`engineering-team/epics/tag-applicability.md`, story 3)." with
  `With nothing typed, the Add-a-tag picker lists the current target type's Tags by trusted usage; once a name is typed, matches come back in alphabetical order, not by usage (`ui/src/components/AddTagDialog.jsx`). Its "Show other results" expander covers a different case: it lists matching Tags from the *other* target type (a profile Tag while tagging a note), exact-slug first, so people adopt an existing Tag instead of minting a per-type copy. The standalone same-slug create-time warning was superseded and folded into that expander (`engineering-team/epics/tag-applicability.md`, story 3). Two same-slug Tags by different authors in the same target type appear side by side in the main list, and nothing, not even the author, marks them as duplicates.`

**S13. "A Tell is not more official than a Show" sits unreconciled beside the owner's written dictionaries model,** where a steward's by-hand entry "will override community-based criteria". The repo has already recorded the tension and its resolution (`audits/navigation-scaffolding/prd-seed.md` § 4, hazard 2). Decentralized-first bullet →
`- **Decentralized-first.** Anyone may publish either kind of signal. A Tell is not more official than a Show, and nobody's Tell is binding on anyone else — the legislative analogy stops there. There is no legislature; there is only whose statements your point of view trusts. The owner's dictionaries model (`ui/src/pages/dictionaries/Placeholders.jsx`) lets a steward add an entry by hand, overriding the community criteria. That is one point of view deciding what its own dictionary holds, not a Tell that binds anyone else. `engineering-team/audits/navigation-scaffolding/prd-seed.md` § 4 says how to model it: as an assertion anyone may publish, which the house point of view happens to weigh heavily.`

**S14. "The shipped examples above all derive their counts on read" is overbroad,** right after "a stored list is wrong the moment the point of view changes". Filter-at-view-time bullet →
`- **Filter at view time.** Count signals when the view is computed. A stored "popular Tags" list is wrong the moment the point of view changes or a new signal arrives. The counts the app itself shows — E1, E3, E4, E6, and the in-app Tag picker in E5 — are derived on read. Three things in the table are stored, each computed under one named point of view: the Trusted Lists a pin commissions (E2 — kinds 30392 and 30393, rebuilt on pin, on manual refresh, and daily where the operator has enabled that task); the applicability lists published for other clients (E5 — kind 30394, house point of view, republished when their membership changes); and GrapeRank scores (E7 — the `wot_rank_<suffix>` columns that E1 and E3 filter by). Each is a snapshot that can lag its signals. Invariant 3 in [CLAUDE.md](../CLAUDE.md) says when storing a per-point-of-view result is justified: only when the read-time cost has been measured and is too high.`

**S15. The Local-first bullet calls an unpublished edge "a Tell" and then applies a Show-side hazard to it** — classifying by form after Terms said form does not settle it. Local-first bullet →
`- **Local-first.** A statement does not have to be an event. Alice's "Baseball is a child category of Sports" may live only in her own graph, kept for her own use; while it stays there it is not a signal to anyone else. Whether and when she publishes it is her call — local-first is the private option that the reuse hazard's second question asks for. Why she publishes is what places it on the axis: to say it to others, it is a Tell (E10); for her own reasons, it is a mixed signal like the Pin (E2), and the reuse hazard applies.`

**S16. "ADR 0009" matches three files,** one of them the taggings ADR that the pinning ADR `event-tagging/0015` itself calls "ADR 0009". The folder's rule is to point at files.
- Q4 parenthesis → ``(`engineering-team/decisions/0009-pin-a-tag.md`, Option A, "Concept slug", left the unqualified "pinning" slug free for the last of these.)``
- `_intake.md`, "Categories of pins", last sentence of "What exists today" → `` `engineering-team/decisions/0009-pin-a-tag.md` (Option A, "Concept slug") left the unqualified "pinning" slug free for pinning things other than Tags, which is a different axis.``
- Do not cite `event-tagging/0015` against Q4's third option: there the pinned thing is still a Tag.

**S17. CLAUDE.md's trigger misses the case the owner singled out.** "Community-curation feature" appears nowhere else in CLAUDE.md, and a pin or a mute starts life as a personalization feature. OPEN row 332 (same commit) says this row is the only universal discovery hook. One line, stays at 190. `CLAUDE.md:11` →
`| Product direction · design judgment | [ROADMAP.md](./ROADMAP.md) — vision, principles, and the strategic roadmap for Brainstorm Search. [design-philosophies/](./design-philosophies/README.md) — advisory frameworks for recurring design choices, with tradeoff ledgers and worked examples. First: Show and Tell — curating by what trusted people *do* vs what they *say*; read it before designing anything where other people's activity decides what a user sees, or where something a user does for themselves (a pin, a mute) gets counted for other people. |`
A fix commit that touches CLAUDE.md must also touch `engineering-team/CHANGELOG.md` (L10 checks the latest harness-definition commit). Amending 1dba05af, or fixing nit N4 in the same commit, satisfies it.

**S18. The README's boundary table omits the binding rules a product role would meet.** `ROADMAP.md` § Product Principles ("Non-negotiable") and `product-team/guardrails/` ("These rules apply to every design decision"; a registered harness-def path). `README.md:19` →
`| a rule every design must honor | the architecture invariants in [CLAUDE.md](../CLAUDE.md), with full standards in [BIBLE.md](../BIBLE.md); the Product Principles in [ROADMAP.md](../ROADMAP.md); the design and language rules in [`product-team/guardrails/`](../product-team/guardrails/) |`
Leave the ADR row as it is; "for one story" says where the decision is made, not that it lapses.

**S19. Nothing prompts anyone to add an example at the moments the README names.** `6-book-close.md` step 7 and `product-team/workflows/7-story-decomposition.md` ("Product retro at the gate") do not mention the folder. Both are harness-def paths, so wiring a prompt is the owner's call; record the question. Add to `OPEN.md`:
`| 336 | meta | **Nothing prompts anyone to add a design-philosophy example at the moments the README names.** `design-philosophies/README.md` § "How to extend a philosophy" lists "a book close, a product retro" as good moments, but `engineering-team/workflows/6-book-close.md` (step 7, the post-mortem) and `product-team/workflows/7-story-decomposition.md` ("Product retro at the gate") do not mention the folder, so the examples tables grow only if a session remembers. Owner's call: add a one-line, non-gating prompt to each ("Did this book settle a question a design philosophy covers? Add an example row"), or leave it to memory. The folder stays advisory either way; both files are harness-def paths, so the edit owes a CHANGELOG row. | 2026-09-19 (design-philosophies doc lane) | OPEN | | `design-philosophies/README.md` |`
No README change for the review cost: line 41 already names it and links the single normative copy, as `0-intake.md` step 3 requires.

**S20. CHANGELOG forward reference.** The 2026-09-19 row cited this review before it existed; L8 does not scan the CHANGELOG or backticked paths. This file now exists at exactly the cited path, so the row needs no edit — provided this file is committed on `docs/design-philosophies` before the PR merges, under this name.

### Non-blocking — nits (optional)

- **N1.** The one-line "question" (line 5, README index, CLAUDE.md) frames the axis as do vs say, a test of form. Cheap improvement: "what trusted people *do* for their own reasons, or what they *say* because they mean to say it".
- **N2.** No "using this in a design" reading order; the steps are spread over Terms, the ledger and the reuse hazard. A short pointer-style block under "The idea" would help. Do not move "What is new since the 2024 article" below the ledger: it scopes the six article-sourced rows.
- **N3.** Line 97, "listed as a secondary effect": in the issue "secondary" modifies the method. Better: `…and the curation of popular Tags appears only under "Fringe benefits to the community".`
- **N4.** CHANGELOG Why cell, "the owner's source article could be found only on one machine": the article is public (its `njump.me` link returned 200 for me); what was on one machine is the only full-text mirror. OPEN row 335 words it correctly. Suggested: "…and no bibliography — no repo carried a working link to the owner's source article, and the only full-text mirror was on one machine".
- **N5.** E2 Status carries undated operator state. Add "(as of 2026-09-19; per-deployment state: OPEN.md row 334)".
- **N6.** H2 cites the article's "steps 1 and 5–7"; the raw list skips 4, so a renderer shows different numbers. Cite by content.
- **N7.** E11–E13 "Where to look" say "intake entry 2026-09-19"; four entries carry that date. Quote the heading: `` `engineering-team/stories/_intake.md` § "2026-09-19 — Nudge people toward the more-used of two duplicate Tags" ``, "…Categories of pins", "…Pinned Tags first on profile pages, under a default maximum".
- **N8.** Two examples worth adding when convenient: the Trusted Dictionary as a shipped Show (`ui/src/pages/shared-concepts/TrustedDictionary.jsx`; `decisions/done/shared-concepts-adoption/0005-trusted-dictionary.md`, "usage-derived only" — the Show counterpart to E8), and the Dictionaries model itself, which is the owner's own example in the defining sentence. The second has no intake entry, so the README's definition of `proposed` would need a word of adjustment first. The owner said the table can start with a handful; this is not a defect.
- **N9.** The template has no slot for philosophy-specific sections; Show and Tell has three.
- **N10.** Filler: "type specimen" (settled in S2), "This document will grow here."
- **N11.** OPEN row 334 uses type `ops`, which the ledger legend does not list. 22 existing rows do the same; not this change's defect.
- **N12.** H4's second half and S+4 / S−1's closing sentences are small drafting glosses under source provenance. With S2's README sentence in place, mark them the same way when next touched.

### Harness friction

1. **Quote checks were run against a normalised copy.** The lens reviewers reported all five owner blockquotes "character-exact"; they compared against the workflow's relayed copy of message 1, which had already turned curly quotes straight and repaired `to“tell”`. Against the typed message in the session transcript, two blockquotes differ typographically (harmless; see B4). A quote check should name its source, and the source should be the transcript. Candidate `meta` row.
2. **A CHANGELOG row can cite a file that does not exist and no lint will notice** (S20). L8 scans neither `CHANGELOG.md` nor backticked paths. The earlier precedent (`stranded-close-2026-09-18.md`) cited its review only after it existed. Candidate `meta` row, or fold into an existing L8 row.
3. **Role file and workflow disagree on the commit.** `workflows/5-review.md` says to commit the review regardless of verdict; this run's task said not to commit. I did not commit; the orchestrator owns that step. This file must be committed before the PR merges (S20).
4. **`OPEN.md` has two rows numbered 329.** Pre-existing, and the `ledger-row-identity` epic exists for it; noted only because the new rows continue from 330.
5. `npm run gate:status` has no run records on this machine, so a docs-lane review has no gate line to quote.

## What round 2 will check

Per `roles/reviewer.md` step 10, every replacement above is a claim, mine included. I derived each from a command or a file this round, but round 2 re-derives whatever lands: every owner quotation against the typed messages in the transcript; B2's paragraph against `TagPinAffordance.jsx`, `Tag.jsx`, `PinnedListPanel.jsx`, `styles.css` and `publishTagPin.js`; S12 against `AddTagDialog.jsx` and `handleAvailableTags`; S14 against `refreshPinnedTags.js`, `refreshApplicabilityLists.js` and `scheduled-tasks/index.js`; every ID renumbered in S10 and S12 (no `P` IDs and no U+2212 left in the folder or in `_intake.md`); CLAUDE.md still 190 lines; harness-lint clean.

## Verdict

**CHANGES_REQUESTED**

Four blocking items (B1–B4) and twenty should-fix items (S1–S20). The folder's shape, its advisory standing, the terminology, the status column, the intake entries, the bibliography and the wiring all match what the owner asked for, and the gates are clean. The blocking items are about truthfulness in a folder whose whole mechanism is provenance: an owner review that did not happen, a shipped flow described wrongly in the section the owner singled out, and two owner quotations changed by a word.
