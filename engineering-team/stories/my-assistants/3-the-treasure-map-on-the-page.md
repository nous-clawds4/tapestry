# Story 3: What each Assistant does — your Treasure Map on the My Assistants page

**Status:** Approved
**Created:** 2026-09-30
**Type:** Feature
**Epic:** `my-assistants`
**Book:** `engineering-team/audits/my-assistants/book.md`

## Background

Your **Treasure Map** (your kind-10040 event) tells every client which Assistant publishes what for you: your Scores,
your Lists, your curated Concepts. Story 1's introduction already promises "Open a row to see what that Assistant
does according to your Treasure Map". This story keeps that promise and finishes the blueprint's page:

- **Each Assistant's status:** a row says whether it's on your Treasure Map, and the count says how many are.
- **Its duties:** opening a row lists that Assistant's duties, grouped as the blueprint groups them, with a way to
  the Treasure Map page to change them.
- **Assistants on your Treasure Map that you haven't tagged** get their own section, with the Tag buttons from
  story 2.
- **A Duties tab** lists every duty on your Treasure Map, read-only: its Assistants, in order, and what it means in
  plain English.

**Read-only by decision** (book decision 2). The design's Duties tab can reorder, add and remove Assistants, and
simulate "a client that adopts…". Those depend on Treasure Map grammar that's still a draft
(`protocols/drafts/treasure-maps.md`): catch-alls, family wildcards, adopted providers. Here the tab shows what your
Treasure Map says, for the entry types the app reads today:
- a **Score** for one metric (`30382:rank`);
- a **whole kind of List** (`30392`);
- **one curated Concept** (`39998:<list>`);
- **all your Concepts** (`39998:dlist-header`).

Changing duties stays on the Treasure Map page.

## User-facing description

As a signed-in person with Assistants, I want to see which of them my Treasure Map actually uses, and for what, and
to spot Assistants it uses that I haven't claimed as mine, so I can tell who is doing what for me without reading
raw events.

## Acceptance criteria

- [ ] **AC-1: whose Treasure Map.** Given a signed-in person, the page reads **their own** Treasure Map, the newest
  one they signed, from the relays the Treasure Map page reads.
  - With none published, every Assistant reads **Not on Treasure Map**, and the Duties tab says so (§ Copy).
  - If it can't be read, the page says that instead (§ Copy). It never claims "Not on Treasure Map" from a read that
    failed.
- [ ] **AC-2: status and count.** Given the list:
  - every row carries **On Treasure Map** (a green dot) when your Treasure Map gives that Assistant at least one
    duty, and **Not on Treasure Map** (a hollow dot) otherwise;
  - next to the count, **M on your Treasure Map** counts the rows that are on it.
- [ ] **AC-3: an Assistant's duties.** Given an open row, now any row including your untagged Assistant here:
  - its panel heads **Duties on your Treasure Map**, with the number of duties (§ Copy);
  - the duties are grouped as **Scores**, **Lists** and **Concepts**, each listed by its name and its entry, as on
    the Duties tab;
  - with none, the blueprint's line explains that clients won't ask it for anything;
  - the panel has **Manage on Treasure Map**, which opens the Treasure Map page.

  Story 2's Change and Remove stay as they are, and the untagged Local row has neither.
- [ ] **AC-4: on the map, but not tagged.** Given a Treasure Map that gives duties to Assistants who aren't in your
  list, a section below the list, **On your Treasure Map, but not tagged**, shows each one:
  - its name, URL and NIP-05, and **N duties on your Treasure Map**;
  - buttons **Tag: Brainstorm** and **Tag: Tapestry**, which do what story 2's Tag buttons do: signed, reported,
    disabled while unavailable, and refreshed. A tagged one moves into the list.

  With none, there's no section.
- [ ] **AC-5: two tabs.** Above the search card there's a switch, **Assistants | Duties**. **Assistants** is the
  default, and holds everything stories 1 and 2 built. The switch works from the keyboard, and a screen reader hears
  it as tabs, with the current one selected.
- [ ] **AC-6: the Duties tab.** Given your Treasure Map, the tab shows:
  - one row per duty, **most generic first** (a whole kind before one exact Score, List or Concept), each with:
    - its number;
    - its name and its entry;
    - a level: **Scope** or **Exact**;
    - the Assistant listed first for it, marked **Not tagged** when it isn't in your list;
    - the others listed after it;
  - a count, **N duties**;
  - opening a row lists all its Assistants in order, labelled **Preferred** then **Alternate** (§ Resolved at the
    story gate 1); then the duty as a sentence ("I entrust … to publish and maintain …"), its raw entries, and a link
    to the Treasure Map page.

  Nothing here edits anything.
- [ ] **AC-7: the honest states.**
  - **While the Treasure Map is being read:** no status, count or duty claims anything. The rows show without a
    status; the Duties tab shows a loading line.
  - **None published:** the Duties tab's empty line.
  - **Unreadable:** an error line with **Try again**, in both places.
  - **Entries the app can't place** (an unknown kind, or no valid Assistant) aren't duties. They're left out, and
    the Treasure Map page still shows them.

## Copy

From the blueprint unless marked **new** or **adapted**. Curly apostrophes, as on the rest of the page.

| Element | Text |
|---|---|
| Row status | On Treasure Map · Not on Treasure Map |
| Count beside the total | M on your Treasure Map |
| Panel heading | Duties on your Treasure Map — 1 duty / N duties / No duties |
| Group labels | Scores · Lists · Concepts |
| No duties | This Assistant isn’t listed on your Treasure Map, so clients won’t ask it for anything. Add it from your Treasure Map to give it duties. |
| Panel button | Manage on Treasure Map |
| Section heading | On your Treasure Map, but not tagged |
| Section text | These Assistants have duties on your Treasure Map, but you haven’t tagged them as yours. Tag them to add them to the table above. |
| Section line | N duties on your Treasure Map |
| Section buttons | Tag: Brainstorm · Tag: Tapestry |
| Tabs | Assistants · Duties |
| Duties intro | **adapted**: Every duty on your Treasure Map, from the most generic (a whole kind of Score or List) to the most granular (one exact Score, List or Concept). Within a duty, the first Assistant listed is preferred; the rest are alternates. |
| Duties count | 1 duty / N duties · Most generic first |
| Column heads | # · Duty · Preferred Assistant |
| Levels | Scope · Exact |
| Not tagged mark | Not tagged |
| Others line | Alternates: A, B |
| Open duty | Assistants for this duty — First listed is preferred / Only provider · Preferred · Alternate (Alternate 1, 2 … when more than one) |
| Sentence label | On your Treasure Map |
| Sentence | I entrust {name} to publish and maintain {what}. If it can’t, ask {alternates, joined by “, then ”}. |
| Link | **adapted**: Manage on Treasure Map → |
| Loading | **new**: Reading your Treasure Map… |
| None published | **new**: You haven’t published a Treasure Map yet, so no Assistant has duties. |
| No duties | **new**: Your Treasure Map lists no duties yet. |
| Unreadable | **new**: Couldn’t read your Treasure Map. · Try again |

**What each kind of duty is called, and its sentence's "what",** in the blueprint's words:

| Entry | Name | {what} |
|---|---|---|
| `30382:<metric>` (one Score) | `<metric>` | a rank for every profile, as seen from my trusted community. (for `rank`) / a “`<metric>`” score for every profile. (any other metric) |
| a bare Score kind, e.g. `30382` (every Score of that kind) | All Scores about `<things>` | every Score about `<things>`, except where this Map says otherwise. |
| a bare List kind, e.g. `30392` (every List of that kind) | All Lists of `<things>` | every Trusted List of `<things>`, except where this Map says otherwise. |
| `39998:<list>` | Curated DList: `<list name>` | my curated copy of `<list name>`: its header, and a copy of each item. |
| `39998:dlist-header` | All Concept headers | my Concept Graph — my DList headers and the items filed under them, except where this Map says otherwise. |

`<things>` is the kind's subject: profiles for `30382`/`30392`, events for `30383`/`30393`, addressable events for
`30384`/`30394`, content categories for `30386`/`30396`.

## Concepts touched

The `39998` handles carry this machine's TA as their author. Resolve them at runtime.

- **The Treasure Map** (kind 10040). There's no concept in the graph; its entry grammar is the app's
  (`tl-treasure-map` and `dlist-curation` ADRs), with `protocols/drafts/treasure-maps.md` as the draft ahead of it.
  The Architect resolves whether a concept handle applies.
- `39998:<TA>:tapestry-assistant` — tapestry assistant. The Assistants whose duties are shown.
- `39998:<TA>:nostr-user-tag` — nostr user tag. Story 2's tagging, reused by AC-4.

## Out of scope

- **Editing duties here:** reorder, add, remove, Make preferred, Reset. The Treasure Map page does that.
- **The draft grammar:** catch-all (`*`) and family-wildcard (`3038x`/`3039x` as keys) duties, tag- and DList-based
  list keys, the "Show which Assistant a client uses" adopted-provider selector, and the Fallback (catch-all) group.
- Entries the app can't place (AC-7).
- Verifying that an Assistant actually publishes what its duty says.

## Also in this cycle

**The withdrawal's send, pinned by a test** (from the book's § Before shipping; review 2, non-blocking 1). Remove and
Change already send their withdrawal to `wss://dcosl.brainstorm.world` (ADR 0002 Amendment 1). Today only the report
of that is tested. This cycle's Test Design and Implementation add the test that pins the send itself. It's a
test-only change, and users see nothing new.

## Open questions

None open. The two raised with the draft were answered by the owner on 2026-09-30, below.

## Resolved at the story gate

The owner's answers, 2026-09-30:

1. **Several Assistants on one duty: Preferred, then Alternates.** That's the design's and the draft protocol's
   wording. The first listed is **Preferred**, and the rest are **Alternate**, numbered when there's more than one.
2. **The withdrawal-send test is folded into this cycle** (§ Also in this cycle).

## Linked artifacts
- ADR: `engineering-team/decisions/my-assistants/0003-the-pages-treasure-map-is-the-shared-hook-read-strictly.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
