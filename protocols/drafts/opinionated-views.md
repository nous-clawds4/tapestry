> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** the Tapestry Dictionary's GitHub Accounts views (staging, 2026-10-03: `ui/src/pages/dictionary/github.js`, `useGithubAccount.js`, `GithubAccount.jsx`, `Item.jsx`; design record `docs/DICTIONARY_PAGE_HANDOFF.md`, the 2026-10-03 bullet); the owner's notes to the Brainstorm team (2026-10-03); the V4V Songs community header and three sample items, supplied by the owner (Appendix B), and Tapestry's build from it (staging, 2026-10-04); [Content Categories](./content-categories.md); [Shared Concepts](./shared-concepts.md) § Declared affiliation; NIP-89 (prior art).
> **Why this exists:** Brainstorm is about to show DList items in its search results, starting with GitHub Accounts, and Tapestry has built the first such view. This draft names the parts, so that each platform can build its own views for the same categories. It also sets out how views could later be shared as nostr events.
> **Boundary note:** §§ 1–6 are a convention with no wire format: each platform's views stay in its own code. They live here because § 7's wire format builds on them, and because two independent codebases (Tapestry and Brainstorm) share them. Tapestry's own view code belongs in the BIBLE once it settles.
> **State (2026-10-03):** §§ 1–6 are ready for phase-1 builds, starting with Brainstorm's GitHub Accounts views. Appendix B (V4V Songs, playback only) is the first brief written before any build; Tapestry built from it on 2026-10-04, and its findings are in Appendix B's Changes. § 7 and open questions 1 and 3–7 wait until a second platform has built from a brief. Questions about how DList items get into search results at all are out of scope; they are worksheet [W26](../worksheet.md#w26--dlist-items-in-search-results).
> **Related:** the `o` tag (an auxiliary event's pointer to the list it serves; first proposed as uppercase `Z`, worksheet W25) is specified in [DList Auxiliary Events](./dlist-auxiliary-events.md). This draft doesn't depend on it.

---

Opinionated Views
=================

`draft` `optional`

An **opinionated view** is a platform's own way of showing one item of a content category on one surface. Examples: a GitHub account shown the way GitHub shows it, a song with a play button, a relay with its uptime.

It is *opinionated* because the platform decides what matters about this kind of thing and shows it in the thing's own idiom. A generic event viewer can't do that.

Each platform decides for itself:

- which content categories get views;
- which surfaces each category gets (a full page, a search-result card, a table row, a thumbnail);
- what each view shows.

This draft supplies the shared vocabulary for those choices, rules every view follows (§ 5), and a **view brief** (§ 6). A view brief describes a set of views precisely enough for another platform, or an LLM coding agent working for it, to build its own. Briefs are written in prose, not code.

## 1. Terms

| Term | Meaning |
|---|---|
| **Platform** | An app that shows nostr content: Tapestry, Brainstorm, and others. |
| **Content category** | A kind of thing, as defined in [Content Categories](./content-categories.md). There are four types: profile, event kind, DList, and external. Each event kind defined by a NIP is a category (a NIP may define several). Each DList header is a category. |
| **Item** | One member of a category: a pubkey, an event, a DList item, or an external identifier. |
| **Subject** | What the item is about (Content Categories § 5.1). For an item on the GitHub Accounts DList, the subject is the GitHub account. |
| **Surface** | Where an item is shown: `page`, `card`, `row`, `thumbnail` (§ 3). |
| **Opinionated view** | One platform's rendering of one category's items on one surface. |
| **View set** | All of one platform's views for one category. |
| **View brief** | A written description of a view set: what to show, where the data comes from, and what to do when a read fails (§ 6). |

## 2. Three tiers of rendering

| Tier | Built | Covers | Example |
|---|---|---|---|
| **Generic** | once per platform | every item of every category | name, description, who published it, raw event |
| **Schema-driven** | once per platform | every DList item | the default DList card (§ 2.1): title, the DList's name, description, the header's `required` fields, the filer |
| **Opinionated** | by hand, per category | the categories the platform chooses | GitHub Accounts in GitHub's idiom |

- Every platform MUST have the generic tier. Opinionated views fall back to it (§ 5, rule 2).
- The schema-driven tier is RECOMMENDED for any platform that shows DLists in search. There will always be far more DLists than anyone can build views for. What a header and its items already carry is enough for a decent card (§ 2.1).
- Profiles and NIP-defined event kinds mostly have opinionated views already: most clients have a profile card, a note renderer, a listing card. This draft just gives them a name. DLists are the new case.

### 2.1 The default DList card

A DList item whose category has no opinionated view gets this card. It uses only what nearly every header and item already carries.

1. **Title:** the item's `name`; else its `title`; else its `d` tag; else the first field shown in step 4.
2. **Category label:** the header's singular name (the first value of its `names` tag), e.g. "GitHub Account", "V4V Song".
3. **Description:** the item's `description`, cut to a line or two.
4. **Fields:** each field the header names in `required`, in the header's order, as "label: value".
   - The label is the field's tag name. The header's description of the field (the third element of its `required` tag, per the DList NIP) MAY serve as a tooltip.
   - The value is the item's first non-blank value of that tag. A field the item lacks is skipped, and so is a field already used as the title.
   - Item-reference fields (`p`, `e`, `a`, `i`) aren't shown as text: they name the subject (below).
   - Show at most three fields on a `card`.
5. **Who's behind it:** the filer, by profile name, and how many people the viewer trusts have filed the same subject: "Filed by Alice and 3 others you trust". The count comes from the active point of view's read (§ 5, rule 1).

The card links to the item's `page`.

**The subject** follows Content Categories § 5.1:

- When the header's `required` names `p`, `e`, `a` or `i`, the item points at its subject: a pubkey, an event, an external identifier. The card SHOULD present the subject with the platform's own view of it (a profile's name and picture, an event's title). Items with the same subject value count as filings of the same subject.
- Otherwise the item *is* the subject, and the card names only its own filer.

**`field-type`.** Some headers pair a field with a type: `["field-type", "<field>", "<type>"]`, e.g. `["field-type", "github-username", "text"]`.

- Few headers carry it: 10 of 384 on one community relay, in October 2026. The only type seen in use is `text`.
- Treat `text`, a missing type and an unknown type alike: show the value as plain text. The one exception is a value that begins `https://`, which becomes a link (§ 5, rule 6).
- A fuller vocabulary (`url`, `image`, `date`, …) waits until headers actually use one.

**On a `row`:** the title, then one field or the description, then the filer. The category label is left out, since the table already names it.

## 3. Surfaces

| Surface | Where it appears | Shows at least |
|---|---|---|
| `page` | the item's own page | everything the view offers, plus the Nostr record (§ 5, rule 3) |
| `card` | a search result; a tile in a grid | the subject's identity, a line or two of what matters, the category's name or mark |
| `row` | one line in a list or table | the subject's identity and one line |
| `thumbnail` | avatar size: a chip, a mention, a picker | an identity mark, and an accessible name |

- A platform chooses which surfaces it supports, and MAY add surfaces of its own.
- Use these four names where they fit, so that views and briefs line up across platforms.
- Every surface smaller than `page` SHOULD link to the item's `page`.

## 4. Binding a view to a category

### 4.1 Identifiers

A view set names its category by the category's canonical identifier ([Content Categories](./content-categories.md) § 2):

| Type | Identifier | An item is recognized by |
|---|---|---|
| Profile | — (there is one profile category) | being a pubkey |
| Event kind | the kind number, e.g. `30402`, `30818`, `31990` | its `kind` |
| DList | the header's coordinate (`39998` / `39999`) or event id (`9998` / `9999`) | its `z` tag (§ 4.2) |
| External | the NIP-73 type, e.g. `isbn` | its identifier's type prefix |

### 4.2 DList views bind to a shared concept

Many headers can stand for the same concept. Every Tapestry instance, for example, makes its own "GitHub Account" header, and each one points to one shared header. A view bound to a single instance's header would miss the items filed under all the others.

So a DList view binds to one header coordinate **H**: a widely recognized community header (a shared concept). The view applies to an item when the item's `z` names one of:

- **H** itself (this includes items stamped with H's handle, per [Stamping](./stamping.md));
- a header carrying a `b` tag that names H directly. A pointer-typed `b` declares affiliation ([Shared Concepts](./shared-concepts.md) § Declared affiliation); an inherit-typed `b` defers to H's definition ([Inherit-From](./inherit-from.md)). Either counts.

**This draft covers only that simple case:** a personal header with one `b` to the community header, followed one hop. A swarm of headers whose `b` tags point at one another is out of scope here. How to process one is an open question. [Shared Concepts](./shared-concepts.md) covers that ground: § Reach (every header connected through `b` edges, followed transitively) and § Clouds (the headers an observer resolves a shared concept to). Worksheet W1 tracks it.

A binding names a category; it makes no claim about trust. Which items appear, and in what order, is still decided by the active point of view's read (§ 5, rule 1).

### 4.3 The subject key

The **subject key** is the item field a view reads to identify the subject. Examples: the `github-username` of a GitHub Accounts item, a `p` tag, an `i` identifier.

- For a DList, the subject key SHOULD be a field that H names in `required`.
- A view MUST normalize the key, validate it, and treat a malformed value as missing.
- A view MAY group items that share a normalized key into one entry (§ 5, rule 1).

### 4.4 Which categories get views

This is the platform's call: it is what makes the views *opinionated*. A sensible default is the categories in the house point of view's Dictionary (the instance owner's), most-used first.

A platform choosing what to build doesn't change what anyone sees. A user browsing from their own point of view sees opinionated views for the categories the platform has built, and the schema-driven or generic tier for everything else. An item never fails to render because the house didn't pick its category.

## 5. Rules for every opinionated view

1. **Present, never decide.** The items shown, their order, their ranks and their trust verdicts all come from the active point of view's read. A view MUST NOT drop, add or reorder items by its own logic. It MAY merge items that name the same subject into one entry (two filings of one GitHub account become one row), but only if the entry still names every publisher.
2. **Fall back.** If the subject key is missing or malformed, the item gets the schema-driven or generic view. If an external read fails, the view shows what it already has (the identity, a link out) and says what failed. A view never renders blank.
3. **Keep the Nostr record.** The `page` view MUST show who published the item and MUST give access to the raw event. The item is a signed statement by a person, and the view must not hide that.
4. **Label what isn't nostr.** External data (from GitHub's API, say) isn't signed and isn't filtered by any point of view. A view MUST say where external data comes from. It MUST NOT present external data as the publisher's claim or the community's verdict, nor present the publisher's words as if they came from the external source.
5. **Don't store enrichment as truth.** A view MAY cache external reads briefly, for rate limits. It MUST NOT write them into events or into the graph as if they belonged to the item. Read them again later; they change.
6. **Read safely.** When calling third-party APIs:
   - send no credentials or cookies unless the user has opted in, and no referrer;
   - check every field before using it;
   - accept a link only with the expected scheme and host;
   - never render HTML from an external answer, and never run code from one.

   Where the reader's own browser makes the call, the view SHOULD say so, because the call reveals the reader's IP address to the third party.
7. **Don't gate.** A view never stops anyone from publishing or filing an item. A GitHub login that doesn't exist can still be filed; the view just says GitHub has no such account.

## 6. View briefs

A view brief describes a view set precisely enough that a developer, or an LLM coding agent, on another platform can build an equivalent set in that platform's own stack. It says *what* to show and *where the data comes from*. It never contains code a platform is meant to run.

A brief SHOULD have these sections:

| Section | Says |
|---|---|
| **Category** | the type and identifier (§ 4.1); for a DList, H and how affiliated headers are found (§ 4.2) |
| **Subject key** | the field; how to normalize and validate it; the grouping rule, if any |
| **Sources** | the nostr fields used; for each external source: endpoint, documentation URL, authentication, rate limits, caching advice, and which fields to keep and how to check each |
| **Surfaces** | for each surface: what to show, in order of importance, and what to show when an external read fails |
| **Idiom** | the visual language: marks, icons, colors, and their licenses |
| **Failures** | each failure by name, with suggested wording |
| **Privacy and safety** | who gets contacted, what is sent, which links are accepted |
| **Reference** | an existing implementation to read (not to run) |
| **Changes** | a dated log. When an external API changes, this is where platforms find out what they must update. |

- **Now (phase 1):** briefs are markdown documents: in this draft (Appendix A), or in a platform's own repo. A platform that builds from a brief SHOULD record which brief it used, and the brief's date.
- **Later (phase 2):** the same brief is published as a nostr event (§ 7). The text doesn't change; it just gets signed.

## 7. Publishing view briefs (proposed, phase 2)

Platforms share **briefs**, not code.

- Running another author's code inside your platform would let a stranger run code on your users' machines.
- Platforms are built on different stacks, so code written for one rarely fits another.

A brief is data. A developer reads it, and decides whether to act on it.

### 7.1 The event

A brief is an item on the **Opinionated Views** DList, a header with `d` = `opinionated-view`:

```json
{ "kind": 39999, "pubkey": "<author>", "content": "<the brief, in markdown>", "tags": [
  ["d", "opinionated-view-github-accounts"],
  ["z", "39998:<pubkey>:opinionated-view"],
  ["category", "dlist", "39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:github-accounts"],
  ["surface", "page"], ["surface", "card"], ["surface", "row"], ["surface", "thumbnail"],
  ["name", "GitHub Accounts, in GitHub's idiom"],
  ["description", "Avatar, profile and recent repositories from GitHub's public API; one entry per account."],
  ["r", "https://docs.github.com/en/rest/users/users#get-a-user"],
  ["r", "https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user"]
]}
```

- **`category`**, one per brief, in one of four forms: `["category", "profile"]`, `["category", "event-kind", "30402"]`, `["category", "dlist", "<coordinate or event id>"]`, `["category", "external", "isbn"]`.
- **`surface`**, repeatable: the surfaces the brief covers.
- **`r`**, repeatable: the external documentation the brief relies on.
- The brief is **addressable** (kind `39999`), so an update replaces it at the same address. A platform watches the addresses of the briefs it built from. A newer `created_at` means: read the Changes section and see what needs updating.

### 7.2 Finding briefs

```json
{"kinds": [39999], "#z": ["39998:<pubkey>:opinionated-view"]}
```

then keep, client-side, the briefs whose `category` matches. Briefs are few, so this is cheap. It is the same choice worksheet W18 made for Trusted Lists: browse by category client-side.

For a brief whose category is a DList, a relay-indexed pointer is the job of the `o` tag ([DList Auxiliary Events](./dlist-auxiliary-events.md)). Such a brief adds `["o", "<H>", "opinionated-view"]`, where `<H>` is the coordinate or event id its `category` tag names. The two MUST agree; if they don't, `category` governs. Briefs for profiles, event kinds and external types have no list to point at, carry no `o`, and are still found as above.

### 7.3 Which briefs to trust

Briefs are ranked like any other DList items: per point of view, by the reader's web of trust. Briefs can't be gated at write time; anyone may publish one.

A strong signal is a platform saying it built from a brief, because that is something a platform does for its own reasons ([Show and Tell](../../design-philosophies/show-and-tell.md)). How a platform says so is open question 4.

### 7.4 Relation to NIP-89

A NIP-89 handler announcement (kind `31990`) says *which app* can open a given event kind. A view brief says *how* to show a category. They complement each other:

- A platform MAY also announce, through NIP-89, the event-kind categories it has views for.
- NIP-89 has no way to name a DList category (open question 5).

## 8. Open questions

1. **Surfaces.** Are four enough? Should `card` be split into a search-result card and a grid tile?
2. ~~**Affiliated headers as one category.**~~ Out of scope (owner, 2026-10-03). This draft handles only one hop: a personal header with one `b` to a community header (§ 4.2). Swarms of mutually pointing headers belong to [Shared Concepts](./shared-concepts.md) § Clouds.
3. **`category` vs `context`.** The Pins draft's `["context", <coordinate>]` ([#762](https://github.com/nous-clawds4/tapestry/issues/762)) also names a category, but by coordinate. For profiles, event kinds and external types, that coordinate is a deployment's own `content-category` item. Briefs cross deployments, so they need identifiers that belong to no deployment. Unify the two once #762 settles?
4. **Saying "built from".** How does a platform record which briefs it built from? A pointer-typed `b` from a platform record to the brief, or something else?
5. **Advertising coverage.** Should a platform publish which view sets it has: a NIP-89 extension for DList categories, or an event of its own?
6. **Reference code.** May a brief link to reference code (a commit URL in an `r` tag)? Proposal: yes, labeled "read, don't run".
7. **The Opinionated Views header.** Who publishes the shared `opinionated-view` header: firmware, or a community handle (worksheet W1)?
8. ~~**The schema-driven tier.**~~ Resolved (owner, 2026-10-03): the default DList card (§ 2.1). It records current `field-type` practice only (`text`, plus links for `https://` values). A fuller vocabulary waits until more headers use `field-type`.

---

## Appendix A — View brief: GitHub Accounts

*Distilled from Tapestry's implementation (staging, 2026-10-03). The `card` and `thumbnail` surfaces aren't built on Tapestry yet; their entries below are suggestions.*

### Category

- **Type:** DList.
- **H:** `39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:github-accounts`. Names: *GitHub Account* / *GitHub Accounts*.
- H is a shared concept. Each Tapestry instance's own "GitHub Account" header points to it with `["b", "<H>", "pointer"]` and copies its field tags:

  ```json
  ["required", "github-username"], ["field-type", "github-username", "text"]
  ```
- A page is about this category when its header, the shared concept that header is wired to, or one of the header's `b` targets is H (§ 4.2).

### Subject key

- **Field:** the item's first non-blank `github-username` tag. (Tapestry's item page currently takes the first tag, blank or not; ledger `2026-10-03-github-login-rule-edge-cases` tracks aligning it.)
- **Normalize:** trim spaces; drop a leading `@`; accept a profile link (`github.com/<login>`, with or without the scheme or `www.`) and take the login from it.
- **Validate:** GitHub's login rule: 1–39 characters, letters, digits or single hyphens, not starting or ending with a hyphen. As a case-insensitive regular expression: `^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$`. A value that fails gets the generic view.
- **Group:** filings of the same login, compared case-insensitively, are one entry. The earliest filing stands for the entry (its address, its publisher and its description), and the entry names every publisher in filing order. An item without a valid login stays an entry of its own.

### Sources

**Nostr, from the item:** the publisher's `description`, the publisher, every other publisher of the same login, and the raw event.

**Avatar:** `https://github.com/<login>.png?size=<px>`

- This redirects to the image and costs no API read, so it shows even when the API can't be read.
- Request twice the display size, for sharp screens.
- If it fails to load, show the login's first letter instead.

**Profile:** `GET https://api.github.com/users/<login>` ([docs](https://docs.github.com/en/rest/users/users#get-a-user)).

| Keep | Check |
|---|---|
| `login`, `name`, `bio`, `company`, `location` | non-empty strings, trimmed |
| `type` | `"Organization"` means an organization |
| `blog` | may lack a scheme. Accept it as `http(s)` with a dotted host; drop anything else |
| `twitter_username` | 1–15 characters of `A–Z a–z 0–9 _` |
| `public_repos`, `followers`, `following` | non-negative integers |
| `created_at` | a date |

**Repositories:** `GET https://api.github.com/users/<login>/repos?type=owner&sort=pushed&per_page=12` ([docs](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user)).

- Drop forks. Keep a repository only if its `html_url` is an `https://github.com/…` link.
- Sort by `pushed_at`, newest first, and show six.
- Keep `name`, `html_url`, `description`, `language`, `stargazers_count`, `pushed_at` and `archived`.

**Authentication and limits:**

- Tapestry's reads are unauthenticated, made by the reader's browser with `Accept: application/vnd.github+json`, no credentials and no referrer.
- GitHub allows 60 such reads an hour per IP address, and a `page` spends two. Keep a complete answer for about 30 minutes; show a partial answer, but don't keep it.
- **The limit is hit** on HTTP 429, or on 403 with `x-ratelimit-remaining: 0`. `x-ratelimit-reset` (epoch seconds) says when reads come back.
- **A server can read instead.** A platform with its own server MAY proxy and cache these reads, optionally with a token (GitHub allows authenticated reads at a far higher hourly rate). This spares the per-reader limit and keeps the reader's IP address from GitHub. If the server reads, don't tell readers that their browser did.

### Surfaces

**`page`**, top to bottom:

1. **Head.**
   - The avatar, with GitHub's mark as a badge on it.
   - The GitHub `name` as the title, with the login beneath, linking to the profile. Show the login alone when there is no name.
   - "Item N in ⟨concept⟩".
   - A **View on GitHub** button, linking to `https://github.com/<login>`.
2. **Lede:** the publisher's `description`, unless it only repeats the title.
3. **Profile card.**
   - The bio, then a list: Organization, company, location, site, X account, and "Joined ⟨Month Year⟩".
   - Followers · following · public repositories, each linking to its tab (`?tab=followers`, `?tab=following`, `?tab=repositories`).
   - A source line: "From GitHub's public profile, read by your browser."
4. **Recently active repositories:** a grid of up to six cards. Each shows the name (linked), an *Archived* label when archived, the description, the language with its color dot, the stars when there are any, and "Updated ⟨3 days ago⟩". Beside the heading, a link: "All ⟨N⟩ on GitHub".
5. **The Nostr record**, quiet, below a divider:
   - "Filed by ⟨name⟩ · View Nostr profile";
   - "Also filed by ⟨names⟩", when others filed it too;
   - a disclosure: "Raw Nostr event".

**`row`** (one line in the category's Items table):

- A 32 px avatar; the login, linking to the item's page; and the publisher's description beneath.
- "+N more" when others filed the same account. The names stay readable by screen readers.
- GitHub's mark beside the list's title, and a note under the table: "Avatars are loaded from GitHub by your browser."
- Search matches the login, the description and every publisher. A→Z sorts by login.

**`card`** (suggested for search results):

- The avatar, the login, GitHub's mark, and the publisher's description, linking to the item's page.
- **Spend no API reads on cards.** Twenty results at two reads each would use up the 60-an-hour limit at once. Use only the free data (the avatar URL, the login, the description) unless a server-side cache supplies the profile.

**`thumbnail`** (suggested): the avatar with GitHub's mark as a badge; the login as its accessible name.

### Idiom

- **Marks and icons:** GitHub's mark (Primer Octicons `mark-github`, MIT license). Octicons at 16 px for location, link, organization, calendar, star, repository and people. X's mark for the X account.
- **Language colors:** from `github-linguist`; grey for languages it doesn't list.
- **Numbers and dates:** counts written GitHub's way (37, 1.2k, 15k); relative dates for updates ("yesterday", "2 months ago").

### Failures

The head and the View on GitHub link show in every case.

| Failure | Suggested wording |
|---|---|
| 404: no such account | "GitHub has no account named ⟨login⟩. It may have been renamed or deleted." |
| hourly limit reached | "GitHub allows a browser sixty profile reads an hour, and this one has used them up. They come back at ⟨time⟩; the profile will show then." |
| any other error | "Couldn't read ⟨login⟩'s profile from GitHub (GitHub answered HTTP ⟨status⟩)." |

### Privacy and safety

- The reader's browser contacts `github.com` (for the avatar) and `api.github.com` (for the profile). The page says so.
- No cookies, no credentials, no referrer.
- Links that GitHub's data supplies are kept only when they are `https://github.com/…`. The `blog` field may be any `http(s)` site.
- Text fields (`bio` and the rest) are shown as text, never as HTML.

### Reference

Read, don't run:

- Tapestry `ui/src/pages/dictionary/github.js`: the pure rules (login, grouping, field checks, failures).
- `useGithubAccount.js`: the reads and the cache.
- `GithubAccount.jsx`: the head, profile, repositories and row cell.
- `Item.jsx`: choosing the view.
- Tests: `test/dictionary-github-account.test.js`.

### Changes

- **2026-10-03:** first version, from Tapestry's build.

---

## Appendix B — View brief: V4V Songs

*Written before any platform built it (2026-10-03), from the community header and three sample items. Playback only: paying the artist is left for a later version (see "Not in this version"). Tapestry built its `page` and `row` from it on 2026-10-04; what that build needed and the brief didn't say is now in it (see Changes).*

**Why this category needs a view.** Without one, a V4V Song gets the default DList card (§ 2.1): its title, then "t: 4d338528-…", "artist: …" and a long `op3.dev` link. With one, it gets cover art, the artist and a play button, and every surface still costs no API reads: the item carries everything a player needs.

### Category

- **Type:** DList.
- **H:** `39998:77599c5c4a7ba08456679d812a414037f4b01c975fb4f577187df11d189f80d3:b504f5a8-949f-4d31-ad14-8afcebde2b34`. Names: *V4V Song* / *V4V Songs*. Description: "Value-for-value enabled music tracks from Podcast Index".
- H carries a `b` tag pointing at itself, declaring itself the canonical header. An instance's own V4V Song header points to H with a `b` tag (§ 4.2).
- H's fields:

  ```json
  ["required", "t"], ["required", "title"], ["required", "artist"], ["required", "url"], ["required", "duration"],
  ["required", "feedId"], ["required", "feedGuid"], ["required", "artwork"], ["required", "alt"]
  ```
- The sample items are kind `9999`, so they are referenced by event id, not by address. Each `z`-points straight at H.
- **It is large.** One deployment's relay held 22,556 items under H in October 2026. Expect list reads that stop short (Sources).

### The fields

| Tag | Holds | Check |
|---|---|---|
| `title` | the song's title | non-empty text |
| `artist` | the artist's name as the feed gives it; may contain " / " (`Tilted Halo / T ' Halo`) | non-empty text |
| `url` | the audio file (MP3 in the samples), usually behind an OP3 prefix: `https://op3.dev/e,pg=<feedGuid>/<file URL>` | `https://` only. Use it exactly as given: the prefix counts plays for the artist |
| `duration` | the length in whole seconds, as a string (`"219"`) | a non-negative integer. Show it as `m:ss` (`3:39`), or `h:mm:ss` from an hour up |
| `artwork` | the cover image | `https://` only |
| `t` | the track's ID. In every sample it equals the file name in `url` (`…/track/<t>.mp3`) | an opaque string, compared exactly after trimming; never shown |
| `feedGuid` | the release's feed GUID (Podcasting 2.0 `podcast:guid`); also the `pg=` value in the OP3 prefix | an opaque string, compared exactly after trimming |
| `feedId` | Podcast Index's numeric ID for the release's feed | a positive integer |
| `alt` | NIP-31 text: "Song: ⟨title⟩ by ⟨artist⟩" | text. Use it as the accessible name |

Where an item repeats a tag, read its first non-blank value, as § 2.1 does. A **release** is the set of items sharing a `feedGuid`: an album, an EP or a single.

### Subject key

- **Use the view** when the item has a `title` and an `https://` `url`. Otherwise it gets the default card (§ 2.1).
- **Identity:** `feedGuid` plus `t`, the pair Podcasting 2.0 uses to name one track, each compared exactly after trimming. Filings with the same pair are one song: the earliest stands for the entry, and the entry names every filer (§ 5, rule 1). An item missing either value stands alone.
- **By the DList NIP,** `["required", "t"]` makes each item a *string* item, so the subject is the `t` value (Content Categories § 5.1).

### Sources

**Nostr, from the item:** every field above, the filer, and the raw event. Displaying a song needs nothing else.

**What a row needs from a list read.** A row (in the Items table, or in the page's lists) is drawn from the platform's read of the category's items, not from each event. That read must carry each item's `title`, `artist`, `url`, `artwork`, `duration`, `feedGuid` and `t`.

- **Keep `t`.** List reads often drop single-letter tags, as index tags or hashtags. Here `t` is the item's own key: without it, no row can tell two filings of one song apart.
- **Keep `title` as itself.** A read that folds it into a general display name (name, else title, else `d`, …) can't tell an item with a title from one showing a fallback.
- **Never play or load a link the read may have cut.** If the read bounds the length of values, a `url` or `artwork` value at that bound may be cut, and a cut link is a wrong one. Treat it as missing on that surface; the item's page, which reads the whole event, has it.

**From the category's items (no external reads):**

- *From this release:* other items with the same `feedGuid`.
- *More by this artist:* other items whose `artist` matches, compared case-insensitively after trimming.

Both come from the active point of view's read, like the Items table, and never search beyond it.

- **Ask for these items only.** Read the items whose `feedGuid` or `artist` matches the song's, from that read: never the whole list. One deployment's list is 22,556 items, and its first 1,000 alone are 620 KB. The same answer says who else filed the song (its other filings share its `feedGuid`), and whether its own filing is among the trusted ones. A song with neither field (anyone may file one) asks for the items with its own `url`: it has no lists, but its own filing still comes back. Never ask with nothing to match, which is the whole list again.
- **In the Items' order** (§ 5, rule 1). Show ten of each, then the rest on request: one artist can have hundreds (that deployment's first 1,000 V4V Songs held 173 by one artist).
- **When the read stops short.** If even the matching read is capped, the lists cover only what it returned, and the page says so: "These lists show the first ⟨1,000⟩ of the ⟨1,204⟩ items from this release and by this artist."

**Contacted by the listener's browser:**

- **The artwork's host,** when the image loads. Load it lazily.
- **The audio's hosts, only when the listener presses play.** With an OP3 prefix, that is first `op3.dev`, which counts the play and redirects, then the file's own host. Set the player to load nothing in advance (`preload="none"` on an HTML `<audio>` element). That way a page of twenty cards contacts no audio host, and counts no plays that never happened. `preload` is only a hint, so a row's player MAY be left without its source until play is pressed.

**Link out:** Podcast Index's page for the release, `https://podcastindex.org/podcast/<feedId>`.

**API reads:** none.

### Surfaces

**`page`**, top to bottom:

1. **Head.**
   - The artwork, large and square.
   - The title as the heading, with the artist beneath.
   - "Item N in ⟨concept⟩", the concept's name as the platform shows it (Tapestry: "Item 1 in V4V Song"). N is the song's place in the whole list, so show it only when the page already has it, as when it was opened from the Items table, whose row carries it. Never read the whole list just to number a song: say "Filed under ⟨concept⟩" instead.
   - The duration.
2. **Player.**
   - Play / pause, a seek bar, and the elapsed and total time. A platform's native audio controls are enough.
   - Never autoplay.
   - Where the platform supports it, give the device the song's title, artist and artwork (the Media Session API in browsers), so lock-screen and headset controls show and control it. When the player leaves the page, clear it.
3. **From this release:** the release's other songs, each a `row`, when the Items read has any.
4. **More by ⟨artist⟩:** the same, by artist, leaving out songs already listed above.
   - Both lists keep the Items' order and show ten, then "Show all ⟨N⟩"; when the matching read stopped short, a line says how far they reach (Sources).
   - A song opened from these lists opens its own page at the top.
5. **Link:** "This release on Podcast Index".
6. **The Nostr record**, quiet, below a divider: "Filed by ⟨name⟩ · View Nostr profile"; "Also filed by ⟨names⟩"; a disclosure, "Raw Nostr event" (§ 5, rule 3).

**`row`** (one line in the Items table, or in the page's lists):

- The artwork at about 40 px, with a play / pause button over it. The artwork is decorative here (the title is beside it); the button is named "Play ⟨title⟩ by ⟨artist⟩", and "Pause ⟨title⟩" while playing.
- The title, linking to the item's page, with the artist beneath.
- The duration, at the end of the line.
- Pressing play plays the song in place. Where the whole row opens the item, the play button doesn't.
- In the Items table: "+N more" when others filed the same song, with their names readable by screen readers; search matches the title, the artist and every filer; A→Z sorts by title; and a note under the table: "Cover art is loaded from each song's host by your browser, and pressing play loads the song from its host."

**`card`** (a search result):

- The artwork, square, with a play / pause button over it.
- The title, linking to the item's page; the artist; the duration; and the category label "V4V Song".

**`thumbnail`:** the artwork, 32–48 px; the `alt` text as its accessible name.

**On every surface:**

- **One song at a time.** Starting a song pauses any other song playing on the page.
- **Keep playing while browsing (optional).** A platform MAY keep a small docked player going as the listener moves between pages.

### Idiom

- **The look of a music player:** square cover art, a round play button, times written `m:ss`.
- **The category mark:** a music note, by the category's name and in place of missing artwork. Any music-note glyph will do; Tapestry draws its own (a stem, a flag and a head), so there is no license to carry. Leave the lightning bolt, the usual value-for-value sign, for the version that can pay: showing it now would promise something the view can't do.

### Failures

| Failure | What to show |
|---|---|
| no `title`, or a `url` that isn't `https://` | the default card (§ 2.1) |
| the audio fails to load or play | "Couldn't play this song: its host didn't answer." Keep the rest of the page, plus a plain link to the file |
| a row's song fails to load or play | the play button becomes a failure mark, titled "Couldn't play this song: its host didn't answer." and named the same, plus "Try ⟨title⟩ again"; pressing it tries again |
| the matching read fails | one notice. Opened from a row (the Items table's, or the page's own lists'), the page still knows the song is in the Items: "Couldn't read the entry's Items (⟨reason⟩), so this page can't list the release's other songs or more by the artist." Otherwise: "… so this page can't say where the song stands in them, or list the release's other songs or more by the artist." |
| the artwork fails to load | a music-note placeholder, in the same square |
| `duration` isn't a whole number | leave the duration out; the player shows the file's own length once it loads |
| the matching read stopped short | the page's lists say how far they reach (Sources) |

### Privacy and safety

- **Before play:** a viewer's browser contacts only the artwork's host.
- **On play:** it contacts `op3.dev` (when the URL carries the prefix) and the file's host. Both see the listener's IP address, so the page says so near the player: "Playing loads the song from its host." So does the Items table, under its rows (`row`).
- **Referrers:** send no referrer where the platform can.
  - The artwork can carry its own policy (`referrerpolicy="no-referrer"` on the image).
  - An `<audio>` element has no setting of its own for this, so use a page-wide referrer policy.
  - In a single-page app, "page-wide" means the whole app. Either set `no-referrer` for all of it, or set it while a player is shown (a `<meta name="referrer">`, the last of which wins) and set the app's own policy again when the last player goes: removing that meta doesn't undo it.
- **Links:** accept only `https://` for `url` and `artwork`. Never strip or rewrite the OP3 prefix.
- **Text:** `title`, `artist` and `alt` are shown as text, never as HTML.

### Not in this version

**Paying the artist.** A V4V song names who gets paid, and in what shares, in its feed's value block (Podcasting 2.0 `podcast:value`), not in the item. A later version would:

- read the value block by `feedId` or `feedGuid`: from the Podcast Index API, which needs a key and secret and so a server; or from the feed itself, which browsers generally can't fetch from another site;
- pay through the listener's own Lightning wallet (WebLN, or Nostr Wallet Connect), streaming sats while the song plays, or sending a one-off "boost".

Until then, a view MUST NOT suggest that playing pays anyone.

### Reference

Read, don't run. Tapestry (staging, 2026-10-04) built the `page` and the `row`; its `card` and `thumbnail` aren't built yet.

- `ui/src/pages/dictionary/v4v.js`: the pure rules (recognising H, each field's check, the duration, one row per song, the page's two lists).
- `V4vSong.jsx`: the head, the player, the lists and the row; one song at a time; the Media Session; the referrer policy while a player is shown.
- `Item.jsx`: choosing the view. `ui/src/pages/dictionaries/ConceptEntry.jsx`: the Items table's rows.
- `src/lib/trustedDictionary.js` (`itemProperties`, `trustedItems`, `parseItemMatch`): the list read, carrying `t` and `title`, and its `match` parameter (`match=feedGuid:<guid>&match=artist:<name>` on `GET /api/dictionaries/concepts/items`), which answers with the matching items only.
- Tests: `test/dictionary-v4v-song.test.js`; the browser test D43 in `tests/brainstorm/dictionary-concepts.spec.js`.

### Changes

- **2026-10-03:** first version, from the community header and three sample items (Musica Ancap, Tilted Halo, sabu). Playback only.
- **2026-10-04:** Tapestry built the `page` and `row` from this brief alone (Reference). What the build needed that the brief didn't say, now added:
  1. **A list read must carry `t` and `title`** (Sources). Tapestry's Items read dropped every single-letter tag, so none of the first 1,000 rows on staging had `t`, and no row could tell two filings of one song apart. It also folded `title` into a display name.
  2. **A link a bounded read may have cut is never played or loaded** (Sources). Tapestry's read bounds each value at 300 characters.
  3. **A capped list read:** the page's lists say how far they reach (Sources, Failures). Staging returns the first 1,000 of 22,556 items.
  4. **The page's lists:** in the Items' order, ten, then the rest on request; a song opened from them opens at the top (Sources, Surfaces).
  5. **How the pair and the artist are compared** (The fields, Subject key, Sources), and first non-blank values (The fields).
  6. **The `row`:** play plays in place, the button's accessible names, its failure, "+N more", search and sort, and the note under the table (Surfaces, Failures, Privacy and safety).
  7. **The referrer policy in a single-page app** (Privacy and safety).
  8. **Smaller points:** the music note's source and where it shows (Idiom); `preload` is a hint (Sources); clearing the Media Session (Surfaces); H's size (Category).
  9. **What the head says and what fails** (after review): the head's line is "Item N in ⟨concept⟩", as Appendix A's is, not a fixed "V4V Songs"; a failed row's button name ends "Try ⟨title⟩ again"; a failed Items read is a failure of its own (Surfaces, Failures).
  10. **Ask only for the songs the page shows** (the owner, after using it): a song's page reads the items of its release and its artist, never the whole list, which also says who else filed it. So it numbers a song only when it already has the number, from the Items table's row, and otherwise says "Filed under ⟨concept⟩". A failed read gets one notice (Sources, Surfaces, Failures). After review: a song with neither `feedGuid` nor `artist` asks for its own `url`, never for nothing (Sources).
