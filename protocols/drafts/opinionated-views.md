> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** the Tapestry Dictionary's GitHub Accounts views (staging, 2026-10-03: `ui/src/pages/dictionary/github.js`, `useGithubAccount.js`, `GithubAccount.jsx`, `Item.jsx`; design record `docs/DICTIONARY_PAGE_HANDOFF.md`, the 2026-10-03 bullet); the owner's notes to the Brainstorm team (2026-10-03); [Content Categories](./content-categories.md); [Shared Concepts](./shared-concepts.md) § Declared affiliation; NIP-89 (prior art).
> **Why this exists:** Brainstorm is about to show DList items in its search results, starting with GitHub Accounts, and Tapestry has built the first such view. This draft names the parts, so that each platform can build its own views for the same categories. It also sets out how views could later be shared as nostr events.
> **Boundary note:** §§ 1–6 are a convention with no wire format: each platform's views stay in its own code. They live here because § 7's wire format builds on them, and because two independent codebases (Tapestry and Brainstorm) share them. Tapestry's own view code belongs in the BIBLE once it settles.
> **Related:** the uppercase `Z` tag idea (auxiliary events of a DList header) is worksheet [W25](../worksheet.md#w25--uppercase-z-auxiliary-events-of-a-dlist-header). This draft doesn't depend on it.

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
| **Schema-driven** | once per platform | every DList whose header declares its fields | each field the header names in `required` / `allowed`, labeled, formatted by `field-type` |
| **Opinionated** | by hand, per category | the categories the platform chooses | GitHub Accounts in GitHub's idiom |

- Every platform MUST have the generic tier. Opinionated views fall back to it (§ 5, rule 2).
- The schema-driven tier is RECOMMENDED for any platform that shows DLists in search. There will always be far more DLists than anyone can build views for. A header's `required` and `allowed` tags, plus Tapestry's `field-type` tag (`["field-type", "github-username", "text"]`, not yet in any spec; open question 8), already say enough to render a decent card.
- Profiles and NIP-defined event kinds mostly have opinionated views already: most clients have a profile card, a note renderer, a listing card. This draft just gives them a name. DLists are the new case.

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

So a DList view binds to one header coordinate **H**, usually a shared concept. The view applies to an item when the item's `z` names one of:

- **H** itself (this includes items stamped with H's handle, per [Stamping](./stamping.md));
- a header carrying a `b` tag that names H. A pointer-typed `b` declares affiliation ([Shared Concepts](./shared-concepts.md) § Declared affiliation); an inherit-typed `b` defers to H's definition ([Inherit-From](./inherit-from.md)). Either counts.

Platforms SHOULD follow that one hop. They MAY follow `b` edges further (Shared Concepts § Reach), but they aren't required to.

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

A relay-indexed pointer to the category would be the job of the proposed uppercase `Z` tag (worksheet W25). If `Z` is adopted, a brief adds `["Z", "<coordinate>", "opinionated-view"]`, and nothing else here changes.

### 7.3 Which briefs to trust

Briefs are ranked like any other DList items: per point of view, by the reader's web of trust. Briefs can't be gated at write time; anyone may publish one.

A strong signal is a platform saying it built from a brief, because that is something a platform does for its own reasons ([Show and Tell](../../design-philosophies/show-and-tell.md)). How a platform says so is open question 4.

### 7.4 Relation to NIP-89

A NIP-89 handler announcement (kind `31990`) says *which app* can open a given event kind. A view brief says *how* to show a category. They complement each other:

- A platform MAY also announce, through NIP-89, the event-kind categories it has views for.
- NIP-89 has no way to name a DList category (open question 5).

## 8. Open questions

1. **Surfaces.** Are four enough? Should `card` be split into a search-result card and a grid tile?
2. **Affiliated headers.** Content Categories § 2 gives each header its own identifier, while § 4.2 here treats affiliated headers as one category for views. Should Content Categories say so too?
3. **`category` vs `context`.** The Pins draft's `["context", <coordinate>]` ([#762](https://github.com/nous-clawds4/tapestry/issues/762)) also names a category, but by coordinate. For profiles, event kinds and external types, that coordinate is a deployment's own `content-category` item. Briefs cross deployments, so they need identifiers that belong to no deployment. Unify the two once #762 settles?
4. **Saying "built from".** How does a platform record which briefs it built from? A pointer-typed `b` from a platform record to the brief, or something else?
5. **Advertising coverage.** Should a platform publish which view sets it has: a NIP-89 extension for DList categories, or an event of its own?
6. **Reference code.** May a brief link to reference code (a commit URL in an `r` tag)? Proposal: yes, labeled "read, don't run".
7. **The Opinionated Views header.** Who publishes the shared `opinionated-view` header: firmware, or a community handle (worksheet W1)?
8. **The schema-driven tier.** Should this draft, or Content Categories, define a `field-type` vocabulary (`text`, `url`, `image`, `date`, …) so that schema-driven views agree across platforms?

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
