> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Builds on:** [Treasure Maps](./treasure-maps.md) § 9.1 (methods filed under keys; the most specific wins); [Assistant Tasks](../../docs/ASSISTANT_TASKS_DESIGN_NOTE.md) (each run records its method); `inherit-from.md` (the `b` tag); `class-thread-relationships.md` (`s`); [Amendments proposal](./amendments-2026-09.md) § 3 (self-pointing `b`); the Trust Determination Methods pages in the Brainstorm mock.
> **Principle:** a method says **how** an insight is computed, so it is **private by default** (*what and where, never how*). This concept gives methods a shared shape. Publishing them openly is optional.
> **Draft 2:**
> - Methods are published **by the owner's Assistant**, encrypted to itself.
> - Trust sources become a growable firmware list.
> - NIP-85 native Scores get their own child. It is provider-specific: it names the algorithm (GrapeRank is one of several) and holds that algorithm's parameters.
> - Pin-based sits in parallel with Tag-based and DList-based.
> - The Publish toggle stays on the method page, as a shortcut to the Treasure Map.

---

# The Trust Determination Method concept

## 1. What it is

A **Trust Determination Method** is the recipe an Assistant follows to turn community activity into one insight: whose views count, and how they are combined.

- **Every insight has one method:** the most specific stored method filed under the insight's key. The **Default** is filed under `*`.
- **Default privacy.** Methods are **published by the owner's Assistant** and **encrypted so only that Assistant can read them**. The owner reads and edits them *through* the Assistant.
- **Optional public templates.** Anyone may publish a method openly as a template (§ 6).

## 2. Firmware

Seeded under the deployment's authority key (`<TA>`). Each is a kind-`39998` DList header.

| Concept `d` | Role | Tags |
|---|---|---|
| `trust-determination-method` | the parent: the fields every method shares | `["b", "39998:<TA>:trust-determination-method"]` (self-declared canonical) |
| `native-score-trust-determination-method` | NIP-85 native Scores (`30382:rank`, …), e.g. GrapeRank parameters | `["s", <parent>]`, `["b", <parent>, "inherit"]` |
| `tag-based-trust-determination-method` | Tag-based insights (`…:tag:…`) | `["s", <parent>]`, `["b", <parent>, "inherit"]` |
| `dlist-based-trust-determination-method` | DList-based insights (`…:dlist:…`) | `["s", <parent>]`, `["b", <parent>, "inherit"]` |
| `pin-based-trust-determination-method` | Pin-based insights (the community half of an effective set) | `["s", <parent>]`, `["b", <parent>, "inherit"]` |
| `trust-source` | the list of ways to measure trust (§ 3.1) | `["b", "39998:<TA>:trust-source"]` (self-declared canonical) |

- **The children sit in parallel.** Each one:
  - *is a subset of* the parent (`s`, class threads);
  - *inherits* the parent's field definitions (`b … "inherit"`);
  - adds its own fields.
- **A new system** adds one child. The parent is unchanged.
- **Pin-based mirrors Tag-based for now:** its fields are the same (§ 3.5), but it is its own child, so the two can diverge later without migrating anyone's methods.
- **Declaring fields.** Each header uses the DList NIP's `required` / `allowed` tags, with the three-element description form:

```json
{ "kind": 39998, "pubkey": "<TA>", "tags": [
  ["d", "tag-based-trust-determination-method"],
  ["names", "Tag-based Trust Determination Method", "Tag-based Trust Determination Methods"],
  ["description", "How taggings of one Tag in one category are combined into a Trusted List and its Scores."],
  ["s", "39998:<TA>:trust-determination-method"],
  ["b", "39998:<TA>:trust-determination-method", "inherit"],
  ["required", "algorithm", "count | weight | confidence | rank"],
  ["allowed", "cutoff", "algorithm-specific threshold for membership"],
  ["allowed", "disputes", "subtract | ignore | veto"]
]}
```

## 3. Fields

### 3.1 Parent (every method)

| Field | Values | Meaning |
|---|---|---|
| `name`, `description` | text | for the owner's own reference |
| `filed-under` | a Treasure Map key, e.g. `*`, `30382:rank`, `30396:tag:⟨Restaurants in Nashville⟩` | the insights this method governs. The most specific filing wins. |
| `point-of-view` | `me`, or a pubkey | whose web of trust the computation starts from |
| `trust-source` | the coordinate of a `trust-source` item | how "trusted" is measured from that point of view |
| `trust-threshold` | number | the minimum trust for someone's activity to count; its meaning depends on the trust source |

**Trust sources** are items of the firmware `trust-source` DList, so the list can grow without a firmware change. Each item has a `name`, a `description`, and the unit its threshold is in. Seed items:

| `d` | Name | Threshold means |
|---|---|---|
| `graperank` | GrapeRank | a minimum influence score (0–1) |
| `follows` | People I follow | — (no threshold) |
| `hops` | Follow-graph distance | a maximum number of hops |

### 3.2 Native-score child (NIP-85 Scores)

Governs Scores such as `30382:rank`.

- **A Score name is not an algorithm.** `rank` names the output. Each WoT Service Provider chooses its own algorithm to compute it: Brainstorm and Tapestry use GrapeRank; other providers use others.
- **The method is therefore provider-specific:**

| Field | Meaning |
|---|---|
| `algorithm` | the coordinate of an item in the firmware `score-algorithm` DList (`graperank`, `pagerank`, …), which is growable |
| `parameters` | that algorithm's settings, as the algorithm's own item defines them |

- **Applying a method.** An Assistant applies a native-score method only if it runs that algorithm. Otherwise it ignores the method, uses its own defaults, and says so in the run record.
- **Example: GrapeRank.** The `graperank` item declares the parameters Tapestry already uses. They are managed today on the legacy page `public/pages/graperank-control-panel.html` and stored per customer in `graperank.conf` (default: `customers/default/preferences/graperank.conf`):

| Parameter | Range | Default preset |
|---|---|---|
| `RIGOR` | 0 to 1 | 0.5 |
| `ATTENUATION_FACTOR` | 0 to 1 | 0.85 |
| `FOLLOW_RATING` / `FOLLOW_CONFIDENCE` | −1 to 1 / 0 to 1 | 1 / 0.03 |
| `MUTE_RATING` / `MUTE_CONFIDENCE` | −1 to 1 / 0 to 1 | −0.1 / 0.5 |
| `REPORT_RATING` / `REPORT_CONFIDENCE` | −1 to 1 / 0 to 1 | −0.1 / 0.5 |
| `FOLLOW_CONFIDENCE_OF_OBSERVER` | 0 to 1 | 0.5 |
| `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` | 0 to 1 | 0.01 |
| `VERIFIED_MUTERS_INFLUENCE_CUTOFF` | 0 to 1 | 0.01 |
| `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` | 0 to 1 | 0.01 |

  The file's three presets, **permissive**, **default** and **restrictive**, map directly onto public **templates** (§ 6). A user's live parameters become their stored method, filed under `30382:rank`.
- **Existing firmware.** `firmware/versions/v1.0.0/concepts/graperank/` already defines a GrapeRank concept, whose elements are implementations or configurations with `name`, `povPubkey`, `inputKinds` and `outputKind`. It is the natural home for the `graperank` item of `score-algorithm`. Its JSON schema can grow the parameters above.
- **Filing.** Each parameter set is one item of this child concept, filed under the Score it governs (`filed-under: 30382:rank`).

### 3.3 Tag-based child

| Field | Values | Meaning |
|---|---|---|
| `algorithm` | `count`, `weight`, `confidence`, `rank` | how trusted taggings are combined |
| `cutoff` | number | minimum count / weight / confidence, or a maximum rank, for membership |
| `disputes` | `subtract` (default), `ignore`, `veto` | how `polarity -1` taggings count |

### 3.4 DList-based child

| Field | Values | Meaning |
|---|---|---|
| `acceptance` | `endorsements`, `author-trust`, `both` | what makes an item accepted: trusted `+` reactions, a trusted author, or both |
| `min-endorsements` | number | trusted endorsements needed |
| `objections` | `subtract` (default), `ignore`, `veto` | how trusted `−` reactions count |

### 3.5 Pin-based child

For now, the same fields as Tag-based (`algorithm`, `cutoff`, `disputes`), applied to pinnings instead of taggings. It governs only `community(X)`. The owner's own pinnings always override it (Pins § 6), whatever the method says.

### 3.6 The Publish toggle (UI, not a field)

The method page keeps a **Publish** toggle, because owners want to edit a method and switch it on in one place. The toggle is not stored in the method. Turning it on adds this Assistant to the Treasure Map entry for the method's key (the List entry, or the Score entry for Scores); turning it off removes it. The method stays *how*; the Map stays *what and where*.

## 4. The item (a stored method)

```json
{
  "kind": 39999,
  "pubkey": "<owner's Assistant>",
  "tags": [
    ["d", "tdm-<h8 of filed-under>"],
    ["z", "39998:<TA>:tag-based-trust-determination-method"],
    ["private", "1"]
  ],
  "content": "<NIP-44 encrypted to the Assistant's own pubkey: the JSON below>"
}
```

```json
{ "trustDeterminationMethod": {
    "name": "Stricter for Nashville restaurants",
    "filedUnder": "30396:tag:⟨Restaurants in Nashville⟩",
    "pointOfView": "me",
    "trustSource": "39999:<TA>:graperank", "trustThreshold": 0.2 },
  "tagBasedTrustDeterminationMethod": {
    "algorithm": "confidence", "cutoff": 0.6, "disputes": "subtract" } }
```

- **Signed by the Assistant.** Each Assistant key serves one owner (Treasure Maps § 9), so the item needs no owner field and the `d` tag needs no owner segment. Only the Assistant can decrypt it; the owner sees and edits it through the Assistant's interface.
- **One live method per key.** `d` is deterministic per filed-under key, and the method is replaceable in place.
- **`filed-under` stays inside the encrypted content.** Publishing it would reveal which insights the owner customizes.
- **Content** follows the Tapestry concept-content convention: one section per concept in the class thread, parent first, then child.

## 5. Choosing the method for a task (normative for Assistants)

1. Collect the stored methods whose child concept matches the insight: native Score, `tag`, `dlist` or `pin`.
2. Choose the one whose `filed-under` key is the **most specific** match for the insight's key, by the Treasure Map precedence rule.
3. If none matches, use the **Default** (`filed-under: *`, parent fields only), with system-specific defaults for the child fields.
4. Record the chosen method's `d` in the run record (Assistant Tasks § 4).

## 6. Templates (optional, public)

- A **template** is a method item published **unencrypted**, **without** `private` and **without** `filed-under`, by anyone. Examples: "Strict community filter", "Friends of friends only", "Cautious GrapeRank".
- A stored method can **inherit** a template — `["b", "<template coord>", "inherit"]`, inside the encrypted content — and override single fields. Templates can then be shared, curated and trust-ranked like any list item, while each owner's filings stay private.
- **Crediting a template (opt-in).** The link to a template stays encrypted by default. If the owner ticks "Credit this template", the Assistant also publishes a public `+` reaction to the template (the DList NIP's endorsement mechanism). Template authors get a usage signal, and templates can be ranked by trusted endorsements. No filing is revealed.

## 7. Several Assistants

- **A method belongs to its owner, not to an Assistant.** When the owner saves a method, their client encrypts one copy to **each Assistant named on the winning Treasure Map entry** for its `filed-under` key: Preferred and Alternates. Each copy is published by that Assistant, as in § 4.
- **An Alternate is therefore a warm standby.** It computes the same insight, the same way.
- **Only where named.** A method is never sent to an Assistant that isn't on the entry for its key.
- **Unsupported algorithms.** An Alternate that doesn't run the method's algorithm uses its own defaults, and says so (§ 3.2).
- **The client sends each copy directly.** One Assistant never forwards to another, so no Assistant sees another's key or copy.

## 8. Resolved questions

1. ~~Algorithm parameter names~~ — resolved for GrapeRank from `graperank.conf` (§ 3.2). Other algorithms declare their own in their `score-algorithm` item.
2. **Visible template links** — hidden by default; public credit is opt-in, as a `+` reaction (§ 6).
3. **Several Assistants** — the owner's edits sync to every Assistant named for the key, as client-encrypted copies (§ 7).
